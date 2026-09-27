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
| `NativePlayerActivity.java` | Native Android | Primary activity hosting video rendering, gesture overlays, floating layout, AdEraser engine, PiP mode, and subtitle timing controls. |
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

### In-Memory Stream API Caching (`EPISODE_STREAM_CACHE`)
- API responses for server URLs per episode are cached in memory in `streamingProviders.ts`.
- Switching audio languages (SUB ↔ DUB) or servers within the active episode resolves in **0ms** without redundant network calls.

---

## 🛡️ 4. Hybrid Engine, AdEraser & Protection Bypasses

When loading embed players, `NativePlayerActivity` bypasses anti-embed restrictions and ad overlays using the following techniques:

1. **Direct Top-Level Main Frame Loading**: Embed URLs are loaded directly onto the main WebView frame rather than nested inside `<iframe>` tags. This eliminates cross-origin (`Same-Origin Policy`) JavaScript restrictions.
2. **Referer & Referrer Overriding**:
   - HTTP Headers: Sets `Referer: https://piratexplay.cc/` or `https://pro.iqsmartgames.com/` on web requests.
   - DOM Property: Injects `Object.defineProperty(document, 'referrer', { get: function() { return 'https://piratexplay.cc/'; } })` so scripts checking `document.referrer` pass security validation.
3. **Frame Breaking Prevention**: Injects `Object.defineProperty(window, 'top', { get: function() { return {}; } })` to prevent embed scripts (`abyssplayer.com`) from executing `top.location = window.location` redirects.
4. **Non-Destructive DOM AdEraser (`absoluteCleanse`)**:
   - Overlays, popups, and ad containers (`.art-state`, `#playback`, `.top-gradient`, `#btn-server`) are hidden visually using CSS rules (`display: none !important; opacity: 0 !important; pointer-events: none !important;`).
   - **Crucial Rule**: Elements are **never deleted (`el.remove()`)** from the DOM. Preserving elements prevents Virtual DOM / JS framework reconciliation exceptions (`Application error: a client-side exception has occurred`).
5. **Mobile Touch Synthesis**: Dispatches mobile `TouchEvent('touchstart')` and `TouchEvent('touchend')` events to auto-trigger video playback on mobile JS players (JWPlayer / ArtPlayer).

---

## 💬 5. Subtitle & Caption Engine

### Single Track Enforcement & Blinking Fix
- Prevents track mode toggling loops by enforcing `if (v.textTracks[0].mode !== 'showing') v.textTracks[0].mode = 'showing'`.
- Eliminates subtitle flashing and cue blinking on `Server 2-A` and `Server 2-B`.

### Dynamic Caption Timing Stepper Controls
- Native customization dialog allows real-time subtitle sync adjustments:
  - Stepper buttons: `[-1.0s]`, `[-0.1s]`, `[+0.1s]`, `[+1.0s]`.
- Accumulated offsets dynamically shift WebVTT cue `startTime` and `endTime` bounds.
- Timing offsets are cached for **7 days** per episode in Android `SharedPreferences`.

---

## ⚡ 6. High-Speed Multi-Worker Download System

### Parallel Downloader (10-Worker Thread Pool)
- `EpisodeDownloadService.java` utilizes a `ThreadPoolExecutor` with **10 concurrent workers** downloading HLS `.ts` video segments simultaneously.
- Delivers download speeds of **10 MB/s – 30 MB/s+ (Full 5G / High-Speed Wi-Fi bandwidth)**.

### Main Thread Protection (`Semaphore`)
- Uses `Semaphore snifferSemaphore = new Semaphore(1, true)` during batch URL resolving.
- Prevents Main Thread UI freezes when queueing dozens of episodes simultaneously.

### Active Notification Controls
- Foreground notification includes direct action buttons: `Pause`, `Resume`, and `Cancel`.
- Supports byte-range resumption (`Range: bytes=existingBytes-`).

### Public Device Storage Export
- Downloaded episodes can be exported directly to `Storage/Downloads/AniLove/` via `DownloadPlugin.java`.
- Triggers `MediaScannerConnection` so exported videos appear immediately in Android Gallery and external media players (VLC, MX Player).

---

## 🛠️ 7. Maintenance & Troubleshooting Checklist for Developers

When updating or adding new servers or player features, verify:
1. **Never use `el.remove()` on embed elements**: Always use CSS `display: none !important` to hide elements without crashing JS player event listeners.
2. **Keep Main Thread free**: Any background WebView sniffing or network resolution must be rate-limited or run off the main thread.
3. **Verify Keep-Screen-On**: Ensure `FLAG_KEEP_SCREEN_ON` remains active in portrait and fullscreen modes to avoid video stall after 1 minute.
4. **ExoPlayer Cleanup**: Always release ExoPlayer instances in `onPause()`, `onStop()`, and `onDestroy()` to prevent background ghost audio.
