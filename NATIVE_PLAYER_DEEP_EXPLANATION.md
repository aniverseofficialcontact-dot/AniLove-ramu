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
| `NativePlayerActivity.java` | Native Android | Primary activity hosting 100% Native Media3 ExoPlayer engine (`PlayerView`), `ExoPlaybackException` source error auto-recovery via VideoSniffer fallback, `.m4s` segment chunk filtering, real-time TrackSelectionParameters for video resolution and audio language changing, Cookie sync from CookieManager, dedicated Subtitle API (`subtitles.php`) parser, dual-audio prevention via VideoSniffer lifecycle cleanup, shared-element landscape transitions, auto-next countdown toast, gesture overlays, floating layout, PiP mode, AniSkip skip buttons, yellow seekbar OP/ED indicators, independent subtitle overlay, and caption controls. |
| `VideoSniffer.java` | Native Utilities | Background headless WebView sniffer intercepting XHR/Fetch/DOM streams with static instance tracking (`cancelActiveSniffers()`), dummy wrapper link filtering (`tryembed.us.cc/s/`, `vidnest.fun/s/`), dynamic base URL matching (`tryembed.us.cc`, `vidnest.fun`), and `.m4s` chunk filtering to extract direct `.m3u8` master video playlists (`god.anixx.cloud/proxy/...`) and `.vtt` subtitles. |
| `subtitleService.ts` | Subtitle Pipeline | Dedicated Subtitle API fetching (`subtitles-l8cm.onrender.com/subtitles.php`), 3-day local caching, provider anonymization, priority sorting, and pre-download batch validation. |
| `NativePlayerPlugin.java` | Capacitor Bridge | Exposes native player controls (`play`, `pause`, `seek`, `updatePosition`, `notifyLanguageChange`) to React. |
| `EpisodeDownloadService.java` | Foreground Service | Handles multi-threaded background episode downloads, `#EXT-X-STREAM-INF` master playlist resolution parsing for 1080p / 720p / 480p quality selection, notification actions (Pause/Resume/Cancel), and byte-range HTTP resumption. |
| `DownloadPlugin.java` | Capacitor Bridge | Manages download state JS bindings and handles public storage exports (`Storage/Downloads/AniLove/`). |
| `streamingProviders.ts` | Server Resolvers | Direct deterministic Server 2 URL pattern generator (`https://vidnest.fun/anime/{id}/{ep}/{sub|dub}` and `https://tryembed.us.cc/embed/anime/{id}/{ep}/{sub|dub}`) + Tier 2 API fallbacks. |
| `WatchView.tsx` | Web Component | Manages playback UI state, server selectors, audio toggles, episode switching, expandable server dropdown, and player position sync. |
| `StreamCache.java` | Native Utilities | Thread-safe memory cache storing pre-fetched stream URLs and subtitle tracks for instant zero-latency episode transitions. |

---

## ⚡ 2. URL System & Deep Logcat Analysis for Server 2

### 🔍 How Server 2 URLs are Generated
Server 2 URLs are constructed deterministically in `src/services/streamingProviders.ts` (`generateTier1HiAnimeServers`):
- **Server 2-A-SUB**: `https://vidnest.fun/anime/${anilistId}/${episodeNumber}/sub`
- **Server 2-A-DUB**: `https://vidnest.fun/anime/${anilistId}/${episodeNumber}/dub`
- **Server 2-B-SUB**: `https://tryembed.us.cc/embed/anime/${anilistId}/${episodeNumber}/sub`
- **Server 2-B-DUB**: `https://tryembed.us.cc/embed/anime/${anilistId}/${episodeNumber}/dub`

### 💡 Logcat Analysis & Dummy Wrapper Link Bypass
Deep analysis of the provided logcat revealed:
1. `VideoSniffer` initially intercepted `https://tryembed.us.cc/s/BtkvRxtjvHet...m3u8`. `/s/...m3u8` is an internal token wrapper link on `tryembed` that returns **HTTP 400 Bad Request** if requested directly without browser JWPlayer cookies/headers.
2. Inside `tryembed`'s web page, JWPlayer processes `/s/...m3u8` and redirects to the **actual unencrypted CDN video stream**: `https://god.anixx.cloud/proxy/astra?url=https%3A%2F%2Fhls.dramahot.top%2F...%2Fmaster.m3u8` or `https://sora.anixx.cloud/proxy/astra?url=.../master.m3u8`.
3. **Fix Implemented**:
   - Added dummy wrapper filter in `VideoSniffer.java`: `lowerUrl.contains("tryembed.us.cc/s/") || lowerUrl.contains("vidnest.fun/s/")`.
   - `VideoSniffer` ignores dummy wrapper links and captures the real `.m3u8` CDN stream (`god.anixx.cloud/proxy/astra?url=.../master.m3u8`).
   - `NativePlayerActivity` maps `god.anixx.cloud` and `sora.anixx.cloud` Referer to `https://tryembed.us.cc/` and syncs cookies from `CookieManager.getInstance().getCookie(hlsUrl)`.
   - ExoPlayer loads the master HLS stream with HTTP 200 OK, delivering 1080p HD video + audio flawlessly!

---

## 💬 3. Dedicated Subtitle API Integration (`subtitles.php`)

- **Dedicated API Priority**: `fetchUnifiedSubtitlesJava(anilistId, episodeNumber)` queries `https://subtitles-l8cm.onrender.com/subtitles.php?anilistId=...&ep=...`.
- **Protected Subtitle Track**: VideoSniffer is explicitly prevented from overwriting `subtitleUrl` if a track from the dedicated Subtitle API is already loaded.

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

---

## 🛠️ 5. Maintenance Checklist for Developers

1. **Dummy Token Wrapper Links**: Do not allow `VideoSniffer` to capture internal token links like `/s/...m3u8` on `tryembed.us.cc` or `vidnest.fun`. Always let the WebView player run until it resolves the real CDN stream (`god.anixx.cloud/proxy/...`).
2. **Cookie Synchronization**: Sync cookies from `CookieManager.getInstance().getCookie(hlsUrl)` into `DefaultHttpDataSource.Factory` request headers for Cloudflare/Anixx proxy validation.
