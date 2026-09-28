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
| `NativePlayerActivity.java` | Native Android | Primary activity hosting video rendering, gesture overlays, floating layout, AdEraser engine, PiP mode, AniSkip skip buttons, permanent yellow seekbar OP/ED indicators, independent subtitle overlay, and caption controls. |
| `subtitleService.ts` | Subtitle Pipeline | Unified API fetching (`subtitles.php`), 3-day local caching, provider anonymization, priority sorting, and pre-download batch validation. |
| `NativePlayerPlugin.java` | Capacitor Bridge | Exposes native player controls (`play`, `pause`, `seek`, `updatePosition`, `setCaptionOffset`) to React. |
| `EpisodeDownloadService.java` | Foreground Service | Handles multi-threaded background episode downloads, notification actions (Pause/Resume/Cancel), and byte-range HTTP resumption. |
| `DownloadPlugin.java` | Capacitor Bridge | Manages download state JS bindings and handles public storage exports (`Storage/Downloads/AniLove/`). |
| `streamingProviders.ts` | Server Resolvers | 2-tier server resolver architecture (Tier 1 client generators + Tier 2 API fallbacks) with dynamic HLS quality resolution probing. |
| `WatchView.tsx` | Web Component | Manages playback UI state, server selectors, audio toggles, episode switching, expandable server dropdown, and player position sync. |
| `StreamCache.java` | Native Utilities | Thread-safe memory cache storing pre-fetched stream URLs and subtitle tracks for instant zero-latency episode transitions. |

---

## 💬 2. Direct Native Subtitle Fetching, Appearance Sync & Timing Correction

- **Direct Native Java Subtitle Fetcher (`fetchUnifiedSubtitlesJava`)**:
  - `NativePlayerActivity.java` executes `fetchUnifiedSubtitlesJava(anilistId, episodeNumber)` directly on a Java background thread upon episode load.
  - Queries `https://subtitles-l8cm.onrender.com/subtitles.php?anilistId={anilistId}&ep={epNum}` and parses all 20+ tracks (`"English"`, `"English 2"`, `"Spanish"`, `"Spanish 2"`, `"French"`, `"German"`, `"Russian"`, `"Arabic"`, `"Japanese"`, etc.), populating `capturedServer2BSubtitles` and `detectedSubtitles` automatically.
  - All tracks display cleanly as interactive pills under `SUBTITLE TRACK` in the Captions menu.
- **Caption Appearance Customization Sync**:
  - Updated `applyCaptionStyle()`:
    - **Bottom Margin**: Parses `bottomMargin` (`"0%"` to `"25%"`) and sets dynamic bottom margin on `text_native_subtitle_overlay`.
    - **Outline / Shadow**: Sets `textOverlay.setShadowLayer()` based on `edgeStyle` (`"Shadow"`, `"Outline"`, `"None"`).
    - **Regular / Bold**: Sets `Typeface.DEFAULT_BOLD` vs `Typeface.DEFAULT` based on `captionWeight`.
- **Corrected Timing Stepper Direction**:
  - In `updateNativeSubtitleOverlay(double currentSec)`, updated `currentMs` formula to `(currentSec - subtitleTimingOffset)`.
  - Adding `+1.0s` now correctly delays subtitles to appear at 11 seconds (instead of 9s), and `-1.0s` advances subtitles to appear earlier at 9 seconds.

---

## 📺 3. Playback Modes & Window Mechanics

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

## 🌐 4. Server Architecture & Multi-Tier Strategy

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

## ⏩ 5. AniSkip Integration, OP/ED Skip Buttons & Permanent Yellow Seekbar Highlights

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

## ⏱️ 6. 2-Minutes-Remaining Stream Pre-Fetching Pipeline

- **Trigger Rule**: When video playback reaches **2 minutes remaining** (`duration - current <= 120` seconds), `NativePlayerActivity` automatically pre-fetches the stream URL for Episode $N+1$ in the background.
- **Cache Storage**: Resolved stream URLs are stored in `StreamCache`. When tapping "Next Episode", playback begins instantly with **0ms API latency**.

---

## 💾 7. 500 MB LRU Disk Segment Cache

- **ExoPlayer & HLS LRU Cache**: Configured `LeastRecentlyUsedCacheEvictor` with a **500 MB limit** (`media_lru_cache`).
- **WebView Storage**: Enables HTML5 IndexedDB, DOM Storage, and HTTP disk caching (`LOAD_DEFAULT`).
- **Benefit**: Seeking backwards or re-watching scenes loads segment chunks instantly from local disk without re-downloading data over the network.

---

## 📦 8. Bundle Optimization & Dynamic View Code-Splitting

- **React Lazy Loading (`App.tsx`)**: Replaced static imports with `React.lazy()` for heavy secondary views:
  - `ReelsView` (~23 KB chunk)
  - `ArcadeView` (~6 KB chunk)
  - `CardInventoryView` (~22 KB chunk)
  - `ScheduleView` (~11 KB chunk)
- **Result**: Significantly reduced main bundle size and improved initial app startup speed on Android devices.

---

## 🛠️ 9. Maintenance & Troubleshooting Checklist for Developers

When updating or adding new servers or player features, verify:
1. **Never use `el.remove()` on embed elements**: Always use CSS `display: none !important` to hide elements without crashing JS player event listeners.
2. **Keep Main Thread free**: Any background WebView sniffing or network resolution must be rate-limited or run off the main thread.
3. **Verify Keep-Screen-On**: Ensure `FLAG_KEEP_SCREEN_ON` remains active in portrait and fullscreen modes to avoid video stall after 1 minute.
4. **ExoPlayer Cleanup**: Always release ExoPlayer instances in `onPause()`, `onStop()`, and `onDestroy()` to prevent background ghost audio.
