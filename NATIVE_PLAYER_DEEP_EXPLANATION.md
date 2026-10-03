# 🎬 AniLove Native Player, Streaming Pipeline, Subtitle Engine & Download System — Developer Manual

Welcome to the **AniLove Native Player, Streaming Resolvers, Subtitle Pipeline & Download Engine** architecture documentation!  
This document serves as the **authoritative developer manual** for maintaining, troubleshooting, or expanding the video player, streaming resolvers, subtitle engine, and background download system.

---

## 🏗️ 1. High-Level Architecture Overview

AniLove is engineered as a hybrid **Capacitor + Pure Native Media3 ExoPlayer** application. While the primary UI (Home, Search, Details, Anime Lists, Account, Settings) is managed in React/TypeScript inside Capacitor's WebView, the core video player engine, hardware decoding, stream sniffing, multi-audio/quality switching, and download engine are handled **natively in Java** using **AndroidX Media3 ExoPlayer**.

```
               ┌──────────────────────────────────────────────────┐
               │        React / Web UI Layer (TypeScript)         │
               │   WatchView.tsx / ProVideoPlayer.tsx /           │
               │   streamingProviders.ts / nativePlayer.ts /      │
               │   downloadManager.ts / subtitleService.ts        │
               └────────────────────────┬─────────────────────────┘
                                        │ Capacitor Bridge (IPC)
                                        ▼
               ┌──────────────────────────────────────────────────┐
               │    NativePlayerPlugin.java / DownloadPlugin.java │
               └────────────────────────┬─────────────────────────┘
                                        │ Android Intent / IPC
                                        ▼
               ┌──────────────────────────────────────────────────┐
               │           NativePlayerActivity.java              │
               │  ┌────────────────────────────────────────────┐  │
               │  │   Dual Engine Player System:               │  │
               │  │   1. ⚡ ExoPlayer (Media3 GPU Engine)     │  │
               │  │   2. 🌐 WebView Player (AdBlock/Sandbox)  │  │
               │  └────────────────────────────────────────────┘  │
               │  ┌────────────────────────────────────────────┐  │
               │  │   VideoSniffer.java (Headless WebView)     │  │
               │  └────────────────────────────────────────────┘  │
               │  ┌────────────────────────────────────────────┐  │
               │  │   StreamCache.java (In-Memory Stream Cache)│  │
               │  └────────────────────────────────────────────┘  │
               └──────────────────────────────────────────────────┘
```

---

## 🔑 2. Core Source Files Index

| File | Subsystem | Responsibility |
| :--- | :--- | :--- |
| [`NativePlayerActivity.java`](file:///C:/Users/sanya/StudioProjects/AniLove2/android/app/src/main/java/com/anilove/app/NativePlayerActivity.java) | Native Android | Primary activity hosting 100% Native Media3 ExoPlayer engine (`PlayerView`), Dual Engine mode toggle (`ExoPlayer` <-> `WebView Player`), direct MP4/HLS playback, position-preserving quality & language switching, background thread player release, `ExoPlaybackException` source error auto-recovery via `VideoSniffer` fallback, `.m4s` segment chunk filtering, Cookie sync from CookieManager, custom Referer header injection, dedicated Subtitle API (`subtitles.php`) parser, dual-audio prevention, shared-element landscape transitions, gesture overlays, floating layout, native Picture-in-Picture (`enterPipMode()`), AniSkip skip buttons with yellow seekbar indicators, and custom native caption overlay. |
| [`VideoSniffer.java`](file:///C:/Users/sanya/StudioProjects/AniLove2/android/app/src/main/java/com/anilove/app/VideoSniffer.java) | Native Utilities | Background headless WebView sniffer intercepting XHR/Fetch/DOM streams with static instance tracking (`cancelActiveSniffers()`), audio-only track variant filtering (`-a1.m3u8`, `audio.m3u8`), dummy wrapper link filtering (`tryembed.us.cc/s/`, `vidnest.fun/s/`), and `.m4s` chunk filtering to extract direct `.m3u8` master video playlists and `.vtt` subtitles. |
| [`NativePlayerPlugin.java`](file:///C:/Users/sanya/StudioProjects/AniLove2/android/app/src/main/java/com/anilove/app/NativePlayerPlugin.java) | Capacitor Bridge | Exposes native player controls (`play`, `pause`, `seek`, `updatePosition`, `notifyLanguageChange`) to React with rapid `play()` call de-duplication and navigation listener callbacks. |
| [`streamingProviders.ts`](file:///C:/Users/sanya/StudioProjects/AniLove2/src/services/streamingProviders.ts) | Server Resolvers | Core multi-source streaming resolver managing 4 streaming sources (`Multi-Lang`, `AnimeDekho`, `HiAnime`, `AnimeSalt`), 20-minute local caching (`STREAM_CACHE`), dynamic audio/resolution mapping, and primary/secondary language hierarchy fallback. |
| [`nativePlayer.ts`](file:///C:/Users/sanya/StudioProjects/AniLove2/src/services/nativePlayer.ts) | Frontend Service | TypeScript wrapper service registering the `NativePlayer` Capacitor plugin and handling episode navigation events. |
| [`subtitleService.ts`](file:///C:/Users/sanya/StudioProjects/AniLove2/src/services/subtitleService.ts) | Subtitle Pipeline | Dedicated Subtitle API fetching (`subtitles-l8cm.onrender.com/subtitles.php`), 3-day local caching, provider anonymization, priority sorting, and pre-download batch validation. |
| [`EpisodeDownloadService.java`](file:///C:/Users/sanya/StudioProjects/AniLove2/android/app/src/main/java/com/anilove/app/EpisodeDownloadService.java) | Foreground Service | Handles multi-threaded background episode downloads, `#EXT-X-STREAM-INF` master playlist resolution parsing for 1080p / 720p / 480p quality selection, notification actions (Pause/Resume/Cancel), and byte-range HTTP resumption. |
| [`DownloadPlugin.java`](file:///C:/Users/sanya/StudioProjects/AniLove2/android/app/src/main/java/com/anilove/app/DownloadPlugin.java) | Capacitor Bridge | Manages download state JS bindings, offline playback launching, and public storage exports (`Storage/Downloads/AniLove/`). |
| [`WatchView.tsx`](file:///C:/Users/sanya/StudioProjects/AniLove2/src/components/WatchView.tsx) | Web Component | Manages playback UI state, audio/quality dropdown toggles, episode switching, and player position sync. |
| [`ProVideoPlayer.tsx`](file:///C:/Users/sanya/StudioProjects/AniLove2/src/components/ProVideoPlayer.tsx) | Web Component | Handles native player bridging, WebView video fallback, gesture listeners, and source/server routing props. |
| [`StreamCache.java`](file:///C:/Users/sanya/StudioProjects/AniLove2/android/app/src/main/java/com/anilove/app/StreamCache.java) | Native Utilities | Thread-safe memory cache storing pre-fetched stream URLs and subtitle tracks for instant zero-latency episode transitions using `ConcurrentHashMap`. |

---

## 📡 3. Multi-Source Streaming Architecture (`streamingProviders.ts`)

AniLove powers video delivery through **4 distinct streaming sources**:

### 1️⃣ Multi-Lang (`Multi-Lang` / MovieBox Engine)
- **API**: `https://moviebox-api-mklm.onrender.com/api/stream-all-languages?title={title}&se=1&ep={ep}`
- **Default 1st Source**: Positioned at the top of the frontend dropdown menu.
- **Dynamic Multi-Audio**: Supports `JAP (Sub)`, `ENG (Dub)`, `Hindi`, `Tamil`, `Telugu`, `French`, `Spanish`, `Russian`...
- **Dynamic Quality Maps**: Returns specific quality options (`1080p`, `720p`, `480p`, `360p`) mapped to each audio language.
- **Header Injection**: Requires `Referer: https://netfilm.world/` for `hakunaymatata.com` / `netfilm.world` CDN streams.
- **100% Fresh Episode Transitions**: Appends `&_t=${Date.now()}` with `Cache-Control: no-cache, no-store` headers to `CapacitorHttp` calls, preventing stale OkHttp response caching on episode switches.
- **20-Min Local Cache**: Stores resolved streams under `MultiLang_{cleanTitle}_s1_ep{ep}` for instant audio/resolution switching with **0ms latency**. Synchronously cleared on episode change.

### 2️⃣ AnimeDekho (`AnimeDekho`)
- **API**: `https://animeworld-india-api-njtl.onrender.com/api/anime-world-india/v1/stream.php?anilistId={anilistId}&ep={ep}`
- **Server Priority Targets**:
  1. `Server 1` -> `piratexplay` (`https://piratexplay.cc/...`)
  2. `Server 2` -> `rubystm` (`https://rubystm.com/e/...`)
  3. `Server 3` -> `blakiteapi` (`https://blakiteapi.xyz/...`)
  4. `Server 4` -> `vidmoly` (`https://vidmoly.biz/...`)
  5. `Server 5` -> `abyssplayer` (`https://abyssplayer.com/...` — automatically unpacks `short.icu/` links)
- **Dynamic Server Shift**: If a target server is missing, lower servers automatically shift up sequentially (`Server 1`, `Server 2`...).

### 3️⃣ HiAnime (`HiAnime`)
- **7-Day Fresh Release Auto-Priority**: If an episode aired within the last 7 days ($X \rightarrow X + 7$ days), `HiAnime` is **automatically set as the 1st default source** upon opening the watch view.
- **Deterministic Embed Routes**:
  - `Server 1`: `https://vidnest.fun/anime/{anilistId}/{ep}/{sub|dub}`
  - `Server 2`: `https://tryembed.us.cc/embed/anime/{anilistId}/{ep}/{sub|dub}`
  - `Server 3`: `https://vidnest.fun/animepahe/{anilistId}/{ep}/{sub|dub}`
- **Language Options**: Supports `JAP (Sub)` and `ENG (Dub)` by replacing `/sub` and `/dub` in the route URL.

### 4️⃣ AnimeSalt (`AnimeSalt`)
- **API**: `https://animesalt-api-omega.vercel.app/api/stream?id={slug}&ep=ep-{ep}`
- **Header Injection**: Requires `Referer: https://animesalt.me/`.

---

## 🔀 4. Primary & Secondary Preferred Language Hierarchy

In Account Settings (`AccountView.tsx`), users select:
- **Primary Preferred Language** (e.g. `English Dub`)
- **Secondary Preferred Language** (e.g. `Japanese Sub`)

### Resolution Algorithm:
1. When resolving an episode, check if **Primary Preferred Language** is present in the source tracks. If yes, load Primary Language.
2. If Primary is unavailable, check if **Secondary Preferred Language** is present. If yes, load Secondary Language.
3. If neither Primary nor Secondary is available, fall back to any available language.

---

## ⚡ 5. Native ExoPlayer & WebView Dual Engine Architecture

### ⚡ 1. Media3 ExoPlayer Engine (`isWebViewPlayerMode = false`)
- Default 1080p hardware-accelerated playback engine using AndroidX Media3 ExoPlayer.
- **Position-Preserving Quality & Audio Switching**: Captures `player.getCurrentPosition()` and seeks smoothly when switching resolutions or audio tracks.
- **Offloaded Player Release**: Releases ExoPlayer asynchronously on a background thread executor when closing the activity to prevent main thread UI locks.

### 🌐 2. Embedded WebView Player Engine (`isWebViewPlayerMode = true`)
- Triggered by user toggle (`btnEngineToggle`) or when embed URLs are not direct video streams.
- Loads an iframe or HTML5 video container inside `playerWebView`.
- **Ad-Eraser & Anti-Redirect Sandbox**: Intercepts `shouldOverrideUrlLoading` and `onCreateWindow` to block popups, YouTube redirects, and malicious ad scripts.
- **Custom Gesture Overlay**: Captures touch gestures on WebView to allow double-tap seeking and long-press 2.0x speed boost directly over web embeds!

---

## 💬 6. Subtitle Engine & Dedicated Subtitle API (`subtitles.php`)

### 🎯 Subtitle Sources & Priority
1. **Dedicated Subtitle API**: Calls `https://subtitles-l8cm.onrender.com/subtitles.php?anilistId=...&ep=...`.
2. **Non-Blocking Execution**: `fetchUnifiedSubtitles` executes with a strict 3s AbortController timeout (2.5s Promise.race fallback in `ProVideoPlayer`), guaranteeing video stream playback launches instantly without waiting for subtitle server cold-starts.
3. **Protected Track Locking**: When a subtitle track from the dedicated Subtitle API is loaded, `VideoSniffer` is explicitly prevented from overwriting `subtitleUrl`.
4. **VTT Subtitle Engine**:
   - Downloads and parses `.vtt` WebVTT subtitle files into timestamped cues.
   - Renders subtitles on a custom native subtitle overlay synced with ExoPlayer playback position in milliseconds.

### 🎨 Custom Caption Styling
Full caption customization menu supporting font size, text colors, background opacity/color, text edges (Drop Shadow, Outline), and live preview canvas inside settings.

---

## 📥 7. Background Download Engine (`EpisodeDownloadService.java`)

1. **Foreground Service**: Runs with a persistent Android notification displaying progress, download speed (MB/s), and byte counters.
2. **Master Playlist Parsing**: Parses `#EXT-X-STREAM-INF` HLS master playlists for **1080p / 720p / 480p** resolution selection.
3. **Range Resumption**: Uses `.part` temporary files with `Range: bytes=...` headers to survive network drops.
4. **Offline Playback & Storage Export**: `DownloadPlugin.playOffline()` plays saved files natively without internet, and `exportToPublicStorage()` exports episodes to `Storage/Downloads/AniLove/`.

---

## 🎮 8. Player Gestures & Interactive Features

- **Swipe Gestures**: Horizontal swipe for seeking; vertical swipe left for brightness, right for volume.
- **Long-Press**: Instant 2.0x speed boost with floating speed pill indicator; returns to normal speed on release.
- **AniSkip Integration**: Fetches OP/ED timestamps from AniSkip API (or AniList GraphQL fallback) and renders yellow segment indicators (`#FFD700`) on the seekbar with "Skip Intro" / "Skip Ending" overlay buttons.
- **Picture-in-Picture (PiP)**: Full Android native PiP support (`enterPipMode()`) with automatic layout recalculation on exit.

---

## 🛠️ 9. Build, Sync & Deployment Protocol

Whenever making changes to frontend code or native player files:
1. Sync web bundle to Android assets:
   ```cmd
   npm run build:android
   ```
2. Compile debug APK:
   ```cmd
   gradlew assembleDebug
   ```
