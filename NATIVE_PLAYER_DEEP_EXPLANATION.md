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
| `NativePlayerActivity.java` | Native Android | Primary activity hosting 100% Native Media3 ExoPlayer engine (`PlayerView`), multi-route direct HTTP API extractor (`attemptServer2DirectExtract` for `anime` and `animepahe` routes), `ExoPlaybackException` source error auto-recovery via VideoSniffer fallback, `.m4s` segment chunk filtering, real-time TrackSelectionParameters for video resolution and audio language changing, Cookie sync from CookieManager, dedicated Subtitle API (`subtitles.php`) parser, dual-audio prevention via VideoSniffer lifecycle cleanup, shared-element landscape transitions, auto-next countdown toast, gesture overlays, floating layout, PiP mode, AniSkip skip buttons, yellow seekbar OP/ED indicators, independent subtitle overlay, and caption controls. |
| `VideoSniffer.java` | Native Utilities | Background headless WebView sniffer intercepting XHR/Fetch/DOM streams with static instance tracking (`cancelActiveSniffers()`), audio-only track variant filtering (`-a1.m3u8`, `audio.m3u8`), dummy wrapper link filtering (`tryembed.us.cc/s/`, `vidnest.fun/s/`), dynamic base URL matching (`tryembed.us.cc`, `vidnest.fun`), and `.m4s` chunk filtering to extract direct `.m3u8` master video playlists (`god.anixx.cloud/proxy/...`) and `.vtt` subtitles. |
| `NativePlayerPlugin.java` | Capacitor Bridge | Exposes native player controls (`play`, `pause`, `seek`, `updatePosition`, `notifyLanguageChange`) to React with rapid `play()` call de-duplication. |
| `subtitleService.ts` | Subtitle Pipeline | Dedicated Subtitle API fetching (`subtitles-l8cm.onrender.com/subtitles.php`), 3-day local caching, provider anonymization, priority sorting, and pre-download batch validation. |
| `EpisodeDownloadService.java` | Foreground Service | Handles multi-threaded background episode downloads, `#EXT-X-STREAM-INF` master playlist resolution parsing for 1080p / 720p / 480p quality selection, notification actions (Pause/Resume/Cancel), and byte-range HTTP resumption. |
| `DownloadPlugin.java` | Capacitor Bridge | Manages download state JS bindings and handles public storage exports (`Storage/Downloads/AniLove/`). |
| `streamingProviders.ts` | Server Resolvers | Direct deterministic Server 2 URL pattern generator (`Server 2-A`, `Server 2-B`, `Server 2-C-SUB`: `https://vidnest.fun/animepahe/{id}/{ep}/sub` and `Server 2-C-DUB`: `https://vidnest.fun/animepahe/{id}/{ep}/dub`). |
| `WatchView.tsx` | Web Component | Manages playback UI state, server selectors, audio toggles, episode switching, expandable server dropdown, and player position sync. |
| `StreamCache.java` | Native Utilities | Thread-safe memory cache storing pre-fetched stream URLs and subtitle tracks for instant zero-latency episode transitions. |

---

## ⚡ 2. Server 2-C Addition & Multi-Route Direct Extractor

### Server 2-C (AnimePahe Stream Route)
- **URL Pattern**:
  - `Server 2-C-SUB`: `https://vidnest.fun/animepahe/${anilistId}/${episodeNumber}/sub`
  - `Server 2-C-DUB`: `https://vidnest.fun/animepahe/${anilistId}/${episodeNumber}/dub`
- **Multi-Route Extractor (`attemptServer2DirectExtract`)**:
  - Updated regex matcher in `NativePlayerActivity.java` to support both `anime` and `animepahe` routes:
    `Pattern.compile("(anime|animepahe)/(\\d+)/(\\d+)/(sub|dub)")`.
  - Sends direct API query to `https://vidnest.fun/api/stream_data?id={id}&episode={ep}&audio={type}&route={anime|animepahe}`.
  - Returns direct 1080p `.m3u8` master video stream and loads it into ExoPlayer instantly.

---

## 💬 3. Dedicated Subtitle API Integration (`subtitles.php`)

- **Dedicated API Priority**: `fetchUnifiedSubtitlesJava(anilistId, episodeNumber)` queries `https://subtitles-l8cm.onrender.com/subtitles.php?anilistId=...&ep=...`.
- **Protected Subtitle Track**: VideoSniffer is explicitly prevented from overwriting `subtitleUrl` if a track from the dedicated Subtitle API is already loaded.

---

## 🛠️ 4. Maintenance Checklist for Developers

1. **Server 2-C Integration**: Both `Server 2-C-SUB` and `Server 2-C-DUB` use `vidnest.fun`'s `animepahe` route, processed via `attemptServer2DirectExtract` or `VideoSniffer`.
