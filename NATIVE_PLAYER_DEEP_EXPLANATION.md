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
| `NativePlayerActivity.java` | Native Android | Primary activity hosting 100% Native Media3 ExoPlayer engine (`PlayerView`), window touch isolation (`FLAG_NOT_TOUCH_MODAL` removal), `ExoPlaybackException` source error auto-recovery via VideoSniffer fallback, `.m4s` segment chunk filtering, real-time TrackSelectionParameters for video resolution and audio language changing, Cookie sync from CookieManager, dedicated Subtitle API (`subtitles.php`) parser, dual-audio prevention via VideoSniffer lifecycle cleanup, shared-element landscape transitions, auto-next countdown toast, gesture overlays, floating layout, PiP mode, AniSkip skip buttons, yellow seekbar OP/ED indicators, independent subtitle overlay, and caption controls. |
| `VideoSniffer.java` | Native Utilities | Background headless WebView sniffer intercepting XHR/Fetch/DOM streams with static instance tracking (`cancelActiveSniffers()`), dummy wrapper link filtering (`tryembed.us.cc/s/`, `vidnest.fun/s/`), dynamic base URL matching (`tryembed.us.cc`, `vidnest.fun`), and `.m4s` chunk filtering to extract direct `.m3u8` master video playlists (`god.anixx.cloud/proxy/...`) and `.vtt` subtitles. |
| `NativePlayerPlugin.java` | Capacitor Bridge | Exposes native player controls (`play`, `pause`, `seek`, `updatePosition`, `notifyLanguageChange`) to React with rapid `play()` call de-duplication. |
| `subtitleService.ts` | Subtitle Pipeline | Dedicated Subtitle API fetching (`subtitles-l8cm.onrender.com/subtitles.php`), 3-day local caching, provider anonymization, priority sorting, and pre-download batch validation. |
| `EpisodeDownloadService.java` | Foreground Service | Handles multi-threaded background episode downloads, `#EXT-X-STREAM-INF` master playlist resolution parsing for 1080p / 720p / 480p quality selection, notification actions (Pause/Resume/Cancel), and byte-range HTTP resumption. |
| `DownloadPlugin.java` | Capacitor Bridge | Manages download state JS bindings and handles public storage exports (`Storage/Downloads/AniLove/`). |
| `streamingProviders.ts` | Server Resolvers | Direct deterministic Server 2 URL pattern generator (`https://vidnest.fun/anime/{id}/{ep}/{sub|dub}` and `https://tryembed.us.cc/embed/anime/{id}/{ep}/{sub|dub}`) + Tier 2 API fallbacks. |
| `WatchView.tsx` | Web Component | Manages playback UI state, server selectors, audio toggles, episode switching, expandable server dropdown, and player position sync. |
| `StreamCache.java` | Native Utilities | Thread-safe memory cache storing pre-fetched stream URLs and subtitle tracks for instant zero-latency episode transitions. |

---

## ⚡ 2. Window Touch Isolation & Play De-duplication

### Touch Bleed-Through Prevention
- **`FLAG_NOT_TOUCH_MODAL` Removal**: Cleared `FLAG_NOT_TOUCH_MODAL` and `FLAG_WATCH_OUTSIDE_TOUCH` in `NativePlayerActivity.java`. Touches on screen are now processed natively by `NativePlayerActivity` and do NOT bleed through to `MainActivity` or trigger accidental web page re-renders during video playback.

### Rapid Play Request De-duplication
- **De-duplication Buffer (`NativePlayerPlugin.java`)**: Added a 2-second timestamp filter to `NativePlayerPlugin.play()`. Duplicate `play()` requests sent within 2,000ms for the same URL are safely ignored, preventing infinite re-sniffing loops.

---

## 💬 3. Dedicated Subtitle API Integration (`subtitles.php`)

- **Dedicated API Priority**: `fetchUnifiedSubtitlesJava(anilistId, episodeNumber)` queries `https://subtitles-l8cm.onrender.com/subtitles.php?anilistId=...&ep=...`.
- **Protected Subtitle Track**: VideoSniffer is explicitly prevented from overwriting `subtitleUrl` if a track from the dedicated Subtitle API is already loaded.

---

## 📺 4. Playback Modes & Shared-Element Landscape Transitions

`NativePlayerActivity` operates in **three primary modes**:

### Mode 1: Portrait Streaming Activity
- **Visuals**: Full activity layout with 16:9 video container at the top and episode details below, with native touch isolation.

### Mode 2: Fullscreen Sensor Landscape & Smooth Scale Transition
- **Shared-Element Scale Transition**: When toggling fullscreen landscape (`toggleFullscreenInPlace()`), `video_root_container` animates its scale smoothly (`1.04x` scale bounce) before adjusting orientation and layout params, creating a polished native app transition.

---

## 🛠️ 5. Maintenance Checklist for Developers

1. **Touch Window Flags**: Always clear `FLAG_NOT_TOUCH_MODAL` on `NativePlayerActivity` so touches control video overlays instead of bleeding through to `MainActivity`.
2. **De-duplication**: `NativePlayerPlugin.play()` ignores duplicate calls within 2,000ms to preserve sniffer stability.
