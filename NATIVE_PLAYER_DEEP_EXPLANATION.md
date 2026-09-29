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
               │  │  WebView Engine    │  Native ExoPlayer │  │
               │  │  (HLS.js + Web)    │ (Media3 Hardware) │  │
               │  └────────────────────┴───────────────────┘  │
               └──────────────────────────────────────────────┘
```

### 🔑 Core Source Files Index

| File | Subsystem | Responsibility |
| :--- | :--- | :--- |
| `NativePlayerActivity.java` | Native Android | Primary activity hosting dual rendering engines (WebView HLS.js & Media3 ExoPlayer), runtime engine toggle (`btn_engine_toggle`), shared-element landscape transitions, auto-next countdown toast, gesture overlays, floating layout, AdEraser engine, PiP mode, AniSkip skip buttons, yellow seekbar OP/ED indicators, independent subtitle overlay, and caption controls. |
| `subtitleService.ts` | Subtitle Pipeline | Unified API fetching (`subtitles.php`), 3-day local caching, provider anonymization, priority sorting, and pre-download batch validation. |
| `NativePlayerPlugin.java` | Capacitor Bridge | Exposes native player controls (`play`, `pause`, `seek`, `updatePosition`, `togglePlayerEngine`) to React. |
| `EpisodeDownloadService.java` | Foreground Service | Handles multi-threaded background episode downloads, `#EXT-X-STREAM-INF` master playlist resolution parsing for 1080p / 720p / 480p quality selection, notification actions (Pause/Resume/Cancel), and byte-range HTTP resumption. |
| `DownloadPlugin.java` | Capacitor Bridge | Manages download state JS bindings and handles public storage exports (`Storage/Downloads/AniLove/`). |
| `streamingProviders.ts` | Server Resolvers | 2-tier server resolver architecture (Tier 1 client generators + Tier 2 API fallbacks) with dynamic HLS quality resolution probing. |
| `WatchView.tsx` | Web Component | Manages playback UI state, server selectors, audio toggles, episode switching, expandable server dropdown, and player position sync. |
| `StreamCache.java` | Native Utilities | Thread-safe memory cache storing pre-fetched stream URLs and subtitle tracks for instant zero-latency episode transitions. |

---

## ⚡ 2. Dual Video Engine & Seamless Runtime Toggle

`NativePlayerActivity` features a **Dual-Engine Architecture**:
1. **WebView Engine (HLS.js / HTML5)**: Handles web embeds, encrypted stream formats, and complex iframe players.
2. **Native ExoPlayer Engine (Media3)**: Provides hardware-accelerated HLS (`HlsMediaSource`) decoding directly on Android GPU, offering lower battery consumption, smoother gesture scrubbing, zero web worker overhead, and native 60fps rendering.

### Engine Switch & Position Sync Mechanics
- **Runtime Toggle Button (`btn_engine_toggle`)**: Located in the top bar (`⚡ Exo` / `🌐 Web`).
- **Position Persistence**:
  - Toggling to ExoPlayer queries current time from JS `document.querySelector('video').currentTime`, mutes/pauses WebView, initializes `setupExoPlayerOnline(hlsUrl, referer)`, and seeks ExoPlayer to the exact second.
  - Toggling back to WebView stops ExoPlayer, retrieves `exoPlayer.getCurrentPosition()`, restores WebView visibility, and seeks HTML5 `<video>` to the target position seamlessly.
- **Auto-Fallback on Network Error**: If online ExoPlayer encounters a decoding error or HTTP 403/504 stream block, it automatically displays a short toast and switches back to the WebView engine cleanly without crashing or interrupting playback.

---

## 🛡️ 3. Permanent Ad Eraser & Security Check Sweeper

- **DOM Text-Sweeper**: Scans DOM nodes on 0ms for text containing `"verify you are human"`, `"are you human"`, `"human verification"`, `"security check"`, or `"one quick check"`, instantly removing those popup elements before they can display.
- **Prototype-Level Lock**: Locked `window.open` at prototype level (`writable: false, configurable: false`).
- **Touch-Trap Deactivation**: Applied `pointer-events: none !important; z-index: -9999 !important` to ad overlays (`.art-mask`, `#overlay`, `#playback`, `.jw-controls`), leaving ONLY `<video>` touchable.
- **Media Stream Protection**: `.m3u8`, `.mp4`, `.ts`, and `.m4s` streams are **NEVER blocked**, resolving JWPlayer Error Code 233011.

---

## 💬 4. Subtitle Appearance Styling & Priority Ordering

- **Caption Stream Ordering**: `"English"` is ALWAYS placed #1 and `"English 2"` is ALWAYS placed #2 at the front of the track list in the Captions menu.
- **Native Subtitle Overlay Styling Sync**:
  - `applyCaptionStyle()` applies styles directly to `text_native_subtitle_overlay`:
    - **Bottom Margin**: Dynamic bottom margin calculation (`(int) (12 + (bmPercentage * 2.2f)) * density`) with `requestLayout()` / `invalidate()`.
    - **Outline / Shadow**: Sets `textOverlay.setShadowLayer()` based on `"Shadow"`, `"Outline"`, or `"None"`.
    - **Regular / Bold**: Sets `Typeface.create(Typeface.DEFAULT, Typeface.BOLD)` + `setFakeBoldText(true)` for `"Bold"`.

---

## 📺 5. Playback Modes & Shared-Element Landscape Transitions

`NativePlayerActivity` operates in **three primary modes**:

### Mode 1: Portrait Floating Overlay (Hybrid Mode)
- **Visuals**: The player floats over the web content at a specific vertical offset (`yOffset`) synced to the web scroll position.
- **Window Flags**:
  - `FLAG_NOT_TOUCH_MODAL` & `FLAG_WATCH_OUTSIDE_TOUCH`: Allows user touch events outside player bounds to pass through cleanly to the web page beneath.
  - `FLAG_KEEP_SCREEN_ON`: Prevents Android OS CPU/GPU throttling and display dimming during playback.
- **Hide Trigger (`y <= -9000`)**: When `NativePlayer.updatePosition({ y: -9999 })` is invoked (e.g. opening the Download modal), the native overlay sets `decorView.setVisibility(View.GONE)`, making the native player completely invisible without destroying playback state.

### Mode 2: Fullscreen Sensor Landscape & Smooth Scale Transition
- **Shared-Element Scale Transition**: When toggling fullscreen landscape (`toggleFullscreenInPlace()`), `video_root_container` animates its scale smoothly (`1.04x` scale bounce) before adjusting orientation and layout params, creating a polished native app transition.
- **Display Cutout**: Utilizes `LAYOUT_IN_DISPLAY_CUTOUT_MODE_SHORT_EDGES` so video extends edge-to-edge around notch/camera cutouts.
- **System Insets**: Standard system bars (Status & Navigation) are hidden automatically.

### Mode 3: Offline Download Playback
- Uses **AndroidX Media3 ExoPlayer** to render downloaded `.mp4` video files alongside local `.vtt` / `.srt` subtitle files.
- Operates with constant-bitrate seeking enabled for smooth scrubbing over local storage.

### 📱 Picture-in-Picture (PiP) Mode
- **Android 12+ (API 31+)**: Sets `PictureInPictureParams.Builder.setAutoEnterEnabled(isPlaying)`.
- **Android 8+ (API 26+)**: Overrides `onUserLeaveHint()` so navigating Home while a video is playing automatically transitions into PiP mode.

---

## ⏩ 6. AniSkip Integration, OP/ED Seekbar Highlights & Auto-Next Countdown Toast

- **AniSkip API Parameter Fix**: AniSkip API v2 requires the `episodeLength` parameter (`&episodeLength=1440`). Adding `episodeLength` resolved `HTTP 400 Bad Request` errors, returning exact OP/ED skip intervals.
- **Permanent Yellow Seekbar Highlight (`OpEdSeekBarDrawable`)**:
  - Draws a vibrant **yellow highlight bar** (`#FFD700`) on the seekbar track across the exact Opening (`aniSkipOpStart` to `aniSkipOpEnd`) and Ending (`aniSkipEdStart` to `aniSkipEdEnd`) intervals.
  - Drawn **ON TOP** of the progress bar so the yellow highlight remains permanent on the seekbar even after current progress passes over it.
- **Independent Skip Buttons**:
  - Automatically displays `"⏭️ Skip Intro"` during Opening (OP) scenes and `"⏭️ Skip Ending"` during Ending (ED) scenes, remaining 100% visible on screen even when player controls hide.
- **Auto-Next Episode Countdown Toast (`layout_auto_next_toast`)**:
  - When `duration - position <= 10s` (10 seconds remaining), a non-intrusive pill toast appears at the bottom overlay:
    - Text: `"Next in X s"` with active circular progress indicator.
    - Buttons: `"Play Now"` (triggers instant episode transition) and `"✕ Cancel"` (dismisses toast and cancels auto-next trigger for current episode).
    - When countdown reaches `0s`, `navigateEpisode(true)` triggers automatically.

---

## 🌐 7. Server Architecture & Multi-Tier Strategy

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

---

## 💾 8. Multi-Quality HLS Downloader & 500 MB LRU Disk Cache

### Multi-Quality HLS Variant Parser (`EpisodeDownloadService.java`)
- When downloading `.m3u8` streams, `EpisodeDownloadService` fetches the master playlist and scans `#EXT-X-STREAM-INF` entries for `RESOLUTION` and `BANDWIDTH`.
- **Quality Resolution Matching**:
  - `"1080p"`: Selects variant with height $\ge 1000$ (e.g. 1920x1080).
  - `"720p"`: Selects variant with height $700 \le h < 1000$ (e.g. 1280x720).
  - `"480p"` / `"360p"`: Selects variant with height $360 \le h < 700$ (e.g. 854x480).
  - Fallback: Calculates absolute height difference $\min(|h - targetH|)$ to ensure the closest available stream is downloaded.
- **Multi-Threaded 10-Worker Parallel Downloader**: Downloads segment chunks concurrently for maximum 5G/Wi-Fi speed, saving final video as `ep_X.mp4`.

### 500 MB LRU Disk Segment Cache
- Configured `LeastRecentlyUsedCacheEvictor` with a **500 MB limit** (`media_lru_cache`) for ExoPlayer and WebView storage.

---

## ⚙️ 9. Smart Adaptive Buffer Tuning (Technical Reference)

> [!NOTE]
> Smart Adaptive Buffer Tuning is an architectural design pattern for optimizing stream buffers dynamically based on network throughput.

### ExoPlayer (`DefaultLoadControl`) Mechanics
Standard ExoPlayer defaults use fixed buffer limits (`minBufferMs = 15,000`, `maxBufferMs = 50,000`). Under Smart Adaptive Tuning:
- **High Bandwidth (5G / Wi-Fi > 15 Mbps)**: Increases `maxBufferMs` to **90,000ms (90s)** and `minBufferMs` to **30,000ms (30s)**. Pre-buffers upcoming high-bitrate action scenes in full 1080p, preventing frame drops or micro-stutters during network speed drops.
- **Low / Variable Bandwidth (< 5 Mbps)**: Decreases `bufferForPlaybackMs` to **1,000ms (1s)** so playback starts instantly without long loading spinners.

### HLS.js Buffer Mechanics
- `maxBufferLength`: Controls seconds of video buffered ahead (default 60s).
- `maxBufferSize`: Controls RAM limit in bytes allocated for buffer chunks (default 60 MB).

---

## 🛠️ 10. Maintenance & Troubleshooting Checklist for Developers

1. **Never use `el.remove()` on embed elements**: Always use CSS `display: none !important` to hide elements without crashing JS player event listeners.
2. **Keep Main Thread free**: Any background WebView sniffing or network resolution must be rate-limited or run off the main thread.
3. **ExoPlayer Cleanup**: Always release ExoPlayer instances in `onPause()`, `onStop()`, and `onDestroy()` to prevent background ghost audio.
