# 🎬 AniLove Native Player, Servers & Download Engine — Complete Developer Manual

Welcome to the **AniLove Native Player & Download Engine** architecture documentation!  
This document serves as the **definitive guide** for developers maintaining or expanding the player, server resolvers, streaming pipeline, subtitle engine, or background download system.

---

## 🏗️ 1. High-Level Architecture Overview

AniLove is built as a hybrid **Capacitor + Native Android** application. While the primary UI (Home, Search, Details, Anime Lists) is managed in React/TypeScript inside Capacitor's WebView, the video player engine is handled natively by `NativePlayerActivity.java`.

```
               ┌──────────────────────────────────────────────┐
               │         React / Web UI Layer (TypeScript)    │
               │   WatchView.tsx / ProVideoPlayer.tsx         │
               └──────────────────────┬───────────────────────┘
                                      │ Capacitor Bridge
                                      ▼
               ┌──────────────────────────────────────────────┐
               │            NativePlayerPlugin.java           │
               └──────────────────────┬───────────────────────┘
                                      │ Android Intent / IPC
                                      ▼
               ┌──────────────────────────────────────────────┐
               │           NativePlayerActivity.java          │
               │  ┌────────────────────┬───────────────────┐  │
               │  │  Hybrid Engine     │  Offline Engine   │  │
               │  │ (WebView + HLS.js) │  (Media3 ExoPlayer)│  │
               │  └────────────────────┴───────────────────┘  │
               └──────────────────────────────────────────────┘
```

### 🔑 Core Source Files Index

| File | Subsystem | Responsibility |
| :--- | :--- | :--- |
| `NativePlayerActivity.java` | Native Android | Primary activity hosting video rendering, gesture overlays, floating layout, AdEraser engine, PiP mode, AniSkip skip buttons, permanent yellow seekbar OP/ED indicators, Native WebVTT subtitle overlay, and caption controls. |
| `NativePlayerPlugin.java` | Capacitor Bridge | Exposes native player controls (`play`, `pause`, `seek`, `updatePosition`, `setCaptionOffset`) to React. |
| `EpisodeDownloadService.java` | Foreground Service | Handles multi-threaded background episode downloads, notification actions (Pause/Resume/Cancel), and byte-range HTTP resumption. |
| `DownloadPlugin.java` | Capacitor Bridge | Manages download state JS bindings and handles public storage exports (`Storage/Downloads/AniLove/`). |
| `streamingProviders.ts` | Server Resolvers | 2-tier server resolver architecture (Tier 1 client generators + Tier 2 API fallbacks) with dynamic HLS quality resolution probing. |
| `WatchView.tsx` | Web Component | Manages playback UI state, server selectors, audio toggles, episode switching, and player position sync. |
| `StreamCache.java` | Native Utilities | Thread-safe memory cache storing pre-fetched stream URLs and subtitle tracks for instant zero-latency episode transitions. |

---

## 📺 2. Playback Modes & Window Mechanics

`NativePlayerActivity` operates in **three primary modes**:

### Mode 1: Portrait Floating Overlay (Hybrid Mode)
- **Visuals**: The player floats over the web content at a specific vertical offset (`yOffset`) synced to the web scroll position.
- **Window Flags**:
  - `FLAG_NOT_TOUCH_MODAL` & `FLAG_WATCH_OUTSIDE_TOUCH`: Allows user touch events outside player bounds to pass through cleanly to the web page beneath.
  - `FLAG_KEEP_SCREEN_ON`: Prevents Android OS CPU/GPU throttling and display dimming during playback.
- **Hide Trigger (`y <= -9000`)**: When `NativePlayer.updatePosition({ y: -9999 })` is invoked (e.g. opening the Download modal), the native overlay sets `decorView.setVisibility(View.GONE)`, making the native player completely invisible without destroying playback state.

### Mode 2: Fullscreen Sensor Landscape
- **Visuals**: Rotates to `SCREEN_ORIENTATION_SENSOR_LANDSCAPE` and expands to `MATCH_PARENT` x `MATCH_PARENT`.
- **Display Cutout**: Utilizes `LAYOUT_IN_DISPLAY_CUTOUT_MODE_SHORT_EDGES` so video extends edge-to-edge around notch/camera cutouts.
- **System Insets**: Standard system bars (Status & Navigation) are hidden automatically.

### Mode 3: Offline Download Playback
- Uses **AndroidX Media3 ExoPlayer** to render downloaded `.mp4` video files alongside local `.vtt` / `.srt` subtitle files.
- Operates with constant-bitrate seeking enabled for smooth scrubbing over local storage.

### 📱 Picture-in-Picture (PiP) Mode
- **Android 12+ (API 31+)**: Sets `PictureInPictureParams.Builder.setAutoEnterEnabled(isPlaying)`.
- **Android 8+ (API 26+)**: Overrides `onUserLeaveHint()` so navigating Home while a video is playing automatically transitions into PiP mode.

---

## 🌐 3. Server Architecture & Multi-Tier Strategy

To ensure 100% uptime and instant stream loading, AniLove utilizes a **2-Tier Server Strategy**:

```
                              [Episode Request]
                                      │
                   ┌──────────────────┴──────────────────┐
                   ▼                                     ▼
        ┌─────────────────────┐               ┌─────────────────────┐
        │ Tier 1: Instant URL │               │ Tier 2: Remote API  │
        │      Generators     │               │      Fallback       │
        └──────────┬──────────┘               └──────────┬──────────┘
                   │                                     │
         ┌─────────┴─────────┐                           ▼
         ▼                   ▼                     Server 1 (AW)
    Server 2-A          Server 2-B                 Server 1-B (RubyStm)
    (VidNest)           (TryEmbed)
```

### Server Specifications & Rules

1. **Server 2-A (VidNest)**: Instant deterministic URL generator (`https://vidnest.fun/anime/{anilistId}/{ep}/{sub|dub}`).
2. **Server 2-B (TryEmbed)**: Instant deterministic URL generator (`https://tryembed.us.cc/embed/anime/{anilistId}/{ep}/{sub|dub}`). Multi-language subtitle tracks supported.
3. **Server 1 (AnimeWorld India / AbyssPlayer)**: High-speed server loaded directly in top-level frame.
4. **Server 1-B (RubyStm)**: Strict inclusion rule — **included ONLY IF** resolved stream URL originates from `rubystm.com`. Otherwise filtered out to maintain quality.

---

## ⚡ 4. Logcat Native Crash (`pthread_mutex_lock`) & SSL Fix

- **Root Cause Analysis**: Logcat showed `pthread_mutex_lock called on a destroyed mutex` and `net_error -101 (SSL handshake failed)`. This occurred when destroying secondary `subSnifferWebView` instances while C++ SSL socket handshakes were active in Chromium.
- **Fix**:
  1. Handled `onReceivedSslError(handler.proceed())` in both `playerWebView` and `subSnifferWebView` to bypass SSL handshake errors without crashing Chromium's SSL socket pool.
  2. Reused a single persistent `subSnifferWebView` instance attached to `R.id.player_activity_root` (`1x1` px) instead of calling `destroy()` on active WebViews.

---

## 🛡️ 5. Security Check & Human Verification Ad Popup Elimination

- **AdEraser DOM Text Sweeper**:
  - `absoluteCleanse()` includes a DOM text sweeper that scans every element on 0ms for text containing `"security check"`, `"verify you are human"`, `"verification required"`, or `"confirm you are human"`.
  - Instantly destroys and removes fake security check/human verification ad overlays before they can block the video screen.

---

## 💬 6. Native Subtitle Engine for Server 2-B-SUB Captions

Regardless of which streaming server is selected (Server 1, Server 1-B, Server 2-A, or Server 2-B):

1. **Dual Ingestion & WebVTT Parser (`parseVttContent`)**:
   - `subSnifferWebView` is attached directly to `R.id.player_activity_root` with `1x1` px dimensions to run background WebVTT sniffing continuously.
   - Dual failover queries `https://tryembed.us.cc/embed/anime/{anilistId}/{ep}/sub` and `https://vidnest.fun/anime/{anilistId}/{ep}/sub`.
   - `downloadAndParseVttFile` parses WebVTT timestamp cues into in-memory `VttCue` structures in Native Java.
2. **Native Android Subtitle Overlay (`text_native_subtitle_overlay`)**:
   - Matches current video time against parsed cues during the 200ms player ticker and renders captions in a Native Android `TextView`.
   - Bypasses all web player cross-origin, iframe, and JS player boundaries!
3. **Server 1 Native Track Suppression**:
   - Suppresses and hides Server 1's native caption elements (`.art-subtitle`, `.jw-captions`, `.vjs-text-track-display`) via CSS/JS injection (`display: none !important`).
   - **Result**: You enjoy high-speed Server 1 video playback while Server 2-B-SUB's multi-language captions display cleanly in Native Android!

---

## ⏩ 7. AniSkip Integration, OP/ED Skip Buttons & Permanent Yellow Seekbar Highlights

- **AniSkip API Parameter Fix**: AniSkip API v2 requires the `episodeLength` parameter (`&episodeLength=1440`). Adding `episodeLength` resolved the `HTTP 400 Bad Request` error, returning `HTTP 200 OK` with exact OP/ED skip intervals!
- **Permanent Yellow Seekbar Highlight (`OpEdSeekBarDrawable`)**:
  - Draws a vibrant **yellow highlight bar** (`#FFD700`) on the seekbar track across the exact Opening (`aniSkipOpStart` to `aniSkipOpEnd`) and Ending (`aniSkipEdStart` to `aniSkipEdEnd`) intervals.
  - Drawn **ON TOP** of the progress bar so the yellow highlight remains permanent on the seekbar even after current progress passes over it.
- **Independent Skip Buttons**:
  - Moved `btn_skip_intro` outside `controls_overlay`.
  - Automatically displays `"⏭️ Skip Intro"` during Opening (OP) scenes and `"⏭️ Skip Ending"` during Ending (ED) scenes, **remaining 100% visible on screen even when player controls overlay hides**.
  - Tapping the skip button instantly seeks the player to the exact end timestamp of the section.
  - Defaults to `+85s Skip` when controls are tapped outside OP/ED timestamps.

---

## ⏱️ 8. 2-Minutes-Remaining Stream Pre-Fetching Pipeline

- **Trigger Rule**: When video playback reaches **2 minutes remaining** (`duration - current <= 120` seconds), `NativePlayerActivity` automatically pre-fetches the stream URL for Episode $N+1$ in the background.
- **Cache Storage**: Resolved stream URLs are stored in `StreamCache`. When tapping "Next Episode", playback begins instantly with **0ms API latency**.

---

## 💾 9. 500 MB LRU Disk Segment Cache

- **ExoPlayer & HLS LRU Cache**: Configured `LeastRecentlyUsedCacheEvictor` with a **500 MB disk limit** (`media_lru_cache`).
- **WebView Storage**: Enables HTML5 IndexedDB, DOM Storage, and HTTP disk caching (`LOAD_DEFAULT`).
- **Benefit**: Seeking backwards or re-watching scenes loads segment chunks instantly from local disk without re-downloading data over the network.

---

## 📦 10. Bundle Optimization & Dynamic View Code-Splitting

- **React Lazy Loading (`App.tsx`)**: Replaced static imports with `React.lazy()` for heavy secondary views:
  - `ReelsView` (~23 KB chunk)
  - `ArcadeView` (~6 KB chunk)
  - `CardInventoryView` (~22 KB chunk)
  - `ScheduleView` (~11 KB chunk)
- **Result**: Significantly reduced main bundle size and improved initial app startup speed on Android devices.

---

## 🛠️ 11. Maintenance & Troubleshooting Checklist for Developers

When updating or adding new servers or player features, verify:
1. **Never use `el.remove()` on embed elements**: Always use CSS `display: none !important` to hide elements without crashing JS player event listeners.
2. **Keep Main Thread free**: Any background WebView sniffing or network resolution must be rate-limited or run off the main thread.
3. **Verify Keep-Screen-On**: Ensure `FLAG_KEEP_SCREEN_ON` remains active in portrait and fullscreen modes to avoid video stall after 1 minute.
4. **ExoPlayer Cleanup**: Always release ExoPlayer instances in `onPause()`, `onStop()`, and `onDestroy()` to prevent background ghost audio.
