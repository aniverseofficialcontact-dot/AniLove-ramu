# 🎬 AniLove Native Player, Servers & Download Engine — Complete Developer Manual

Welcome to the **AniLove Native Player & Download Engine** architecture documentation!  
This document serves as the **definitive guide** for developers maintaining or expanding the player, server resolvers, streaming pipeline, subtitle engine, or background download system.

---

## 🏗️ 1. High-Level Architecture Overview

AniLove is built as a hybrid **Capacitor + Pure Native Media3 ExoPlayer** application. While the primary UI (Home, Search, Details, Anime Lists) is managed in React/TypeScript inside Capacitor's WebView, the video player engine is handled 100% natively by `NativePlayerActivity.java` using **AndroidX Media3 ExoPlayer**.

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
               │  ┌────────────────────────────────────────┐  │
               │  │  100% Native Media3 ExoPlayer Engine   │  │
               │  │  (GPU Hardware Acceleration / HLS)     │  │
               │  └────────────────────────────────────────┘  │
               └──────────────────────────────────────────────┘
```

### 🔑 Core Source Files Index

| File | Subsystem | Responsibility |
| :--- | :--- | :--- |
| `NativePlayerActivity.java` | Native Android | Primary activity hosting 100% Native Media3 ExoPlayer engine (`PlayerView`), shared-element landscape transitions, auto-next countdown toast, gesture overlays, floating layout, PiP mode, AniSkip skip buttons, yellow seekbar OP/ED indicators, independent subtitle overlay, and caption controls. |
| `subtitleService.ts` | Subtitle Pipeline | Unified API fetching (`subtitles.php`), 3-day local caching, provider anonymization, priority sorting, and pre-download batch validation. |
| `NativePlayerPlugin.java` | Capacitor Bridge | Exposes native player controls (`play`, `pause`, `seek`, `updatePosition`) to React. |
| `EpisodeDownloadService.java` | Foreground Service | Handles multi-threaded background episode downloads, `#EXT-X-STREAM-INF` master playlist resolution parsing for 1080p / 720p / 480p quality selection, notification actions (Pause/Resume/Cancel), and byte-range HTTP resumption. |
| `DownloadPlugin.java` | Capacitor Bridge | Manages download state JS bindings and handles public storage exports (`Storage/Downloads/AniLove/`). |
| `streamingProviders.ts` | Server Resolvers | 2-tier server resolver architecture (Tier 1 client generators + Tier 2 API fallbacks) with dynamic HLS quality resolution probing. |
| `WatchView.tsx` | Web Component | Manages playback UI state, server selectors, audio toggles, episode switching, expandable server dropdown, and player position sync. |
| `StreamCache.java` | Native Utilities | Thread-safe memory cache storing pre-fetched stream URLs and subtitle tracks for instant zero-latency episode transitions. |

---

## ⚡ 2. 100% Pure Native Media3 ExoPlayer Engine

The web-based WebView video player has been **completely removed** and replaced entirely with **AndroidX Media3 ExoPlayer**:
- **Hardware-Accelerated GPU Decoding**: Direct communication with Android `MediaCodec` C++ decoders, delivering 60fps playback with **30-40% lower battery usage** and zero web worker overhead.
- **Unified Online & Offline Architecture**: The same ExoPlayer engine renders online direct HLS (`.m3u8`) / MP4 streams and local offline downloaded episodes with exact frame seeking.
- **Custom HTTP Headers**: `DefaultHttpDataSource.Factory` injects required `Referer` and `User-Agent` headers (e.g. for RubyStm / VidNest) to play protected streams natively.

---

## 💬 3. Subtitle Appearance Styling & Priority Ordering

- **Caption Stream Ordering**: `"English"` is ALWAYS placed #1 and `"English 2"` is ALWAYS placed #2 at the front of the track list in the Captions menu.
- **Native Subtitle Overlay Styling Sync**:
  - `applyCaptionStyle()` applies styles directly to `text_native_subtitle_overlay`:
    - **Bottom Margin**: Dynamic bottom margin calculation (`(int) (12 + (bmPercentage * 2.2f)) * density`) with `requestLayout()` / `invalidate()`.
    - **Outline / Shadow**: Sets `textOverlay.setShadowLayer()` based on `"Shadow"`, `"Outline"`, or `"None"`.
    - **Regular / Bold**: Sets `Typeface.create(Typeface.DEFAULT, Typeface.BOLD)` + `setFakeBoldText(true)` for `"Bold"`.

---

## 📺 4. Playback Modes & Shared-Element Landscape Transitions

`NativePlayerActivity` operates in **three primary modes**:

### Mode 1: Portrait Floating Overlay
- **Visuals**: The player floats over the web content at a specific vertical offset (`yOffset`) synced to the web scroll position.
- **Window Flags**:
  - `FLAG_NOT_TOUCH_MODAL` & `FLAG_WATCH_OUTSIDE_TOUCH`: Allows user touch events outside player bounds to pass through cleanly to the web page beneath.
  - `FLAG_KEEP_SCREEN_ON`: Prevents Android OS CPU/GPU throttling and display dimming during playback.

### Mode 2: Fullscreen Sensor Landscape & Smooth Scale Transition
- **Shared-Element Scale Transition**: When toggling fullscreen landscape (`toggleFullscreenInPlace()`), `video_root_container` animates its scale smoothly (`1.04x` scale bounce) before adjusting orientation and layout params, creating a polished native app transition.
- **Display Cutout**: Utilizes `LAYOUT_IN_DISPLAY_CUTOUT_MODE_SHORT_EDGES` so video extends edge-to-edge around notch/camera cutouts.
- **System Insets**: Standard system bars (Status & Navigation) are hidden automatically.

### Mode 3: Offline Download Playback
- Uses **AndroidX Media3 ExoPlayer** to render downloaded `.mp4` video files alongside local `.vtt` / `.srt` subtitle files.
- Operates with constant-bitrate seeking enabled for smooth scrubbing over local storage.

---

## ⏩ 5. AniSkip Integration, OP/ED Seekbar Highlights & Auto-Next Countdown Toast

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

## 💾 6. Multi-Quality HLS Downloader & 500 MB LRU Disk Cache

### Multi-Quality HLS Variant Parser (`EpisodeDownloadService.java`)
- When downloading `.m3u8` streams, `EpisodeDownloadService` fetches the master playlist and scans `#EXT-X-STREAM-INF` entries for `RESOLUTION` and `BANDWIDTH`.
- **Quality Resolution Matching**:
  - `"1080p"`: Selects variant with height $\ge 1000$ (e.g. 1920x1080).
  - `"720p"`: Selects variant with height $700 \le h < 1000$ (e.g. 1280x720).
  - `"480p"` / `"360p"`: Selects variant with height $360 \le h < 700$ (e.g. 854x480).
- **Multi-Threaded 10-Worker Parallel Downloader**: Downloads segment chunks concurrently for maximum 5G/Wi-Fi speed, saving final video as `ep_X.mp4`.

---

## 🛠️ 7. Maintenance & Troubleshooting Checklist for Developers

1. **ExoPlayer Cleanup**: Always release ExoPlayer instances in `onPause()`, `onStop()`, and `onDestroy()` to prevent background ghost audio or memory leaks.
2. **Custom Headers**: Ensure any server requiring custom HTTP headers passes `Referer` or `User-Agent` into `setupExoPlayerOnline`.
