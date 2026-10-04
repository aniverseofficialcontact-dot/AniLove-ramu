# 🎬 AniLove Native Player, Streaming Pipeline, Subtitle Engine & Download System — Developer Manual

Welcome to the **AniLove Native Player, Streaming Resolvers, Subtitle Pipeline & Download Engine** architecture documentation!  
This document serves as the **authoritative developer manual** for maintaining, troubleshooting, or expanding the video player, streaming resolvers, subtitle engine, background download system, and 18+ Secret Profile isolation mode.

---

## 🏗️ 1. High-Level Architecture Overview

AniLove is engineered as a hybrid **Capacitor + Pure Native Media3 ExoPlayer** application. While the primary UI (Home, Search, Details, Anime Lists, Account, Settings, Downloads View, Anime Express, Fan Arts) is managed in React/TypeScript inside Capacitor's WebView, the core video player engine, hardware decoding, stream sniffing, multi-audio/quality switching, background downloading, and file management are handled **natively in Java** using **AndroidX Media3 ExoPlayer** and an **Android Foreground Service**.

```
               ┌──────────────────────────────────────────────────┐
               │        React / Web UI Layer (TypeScript)         │
               │   WatchView.tsx / ProVideoPlayer.tsx /           │
               │   BatchDownloadModal.tsx / DownloadsView.tsx /     │
               │   streamingProviders.ts / nativePlayer.ts /      │
               │   downloadManager.ts / subtitleService.ts /      │
               │   hentaioceanService.ts                          │
               └────────────────────────┬─────────────────────────┘
                                        │ Capacitor Bridge (IPC)
                                        ▼
               ┌──────────────────────────────────────────────────┐
               │    NativePlayerPlugin.java / DownloadPlugin.java │
               └────────────────────────┬─────────────────────────┘
                                        │ Android Intent / IPC
                                        ▼
               ┌──────────────────────────────────────────────────┐
               │  NativePlayerActivity  │  EpisodeDownloadService │
               │  (Media3 ExoPlayer)    │  (Foreground Service)   │
               │  ┌──────────────────┐  │  ┌──────────────────┐   │
               │  │ Dual Engine      │  │  │ Multi-Threaded   │   │
               │  │ Exo / WebView    │  │  │ HLS/MP4 Engine   │   │
               │  └──────────────────┘  │  └──────────────────┘   │
               │  ┌──────────────────┐  │  ┌──────────────────┐   │
               │  │ VideoSniffer     │  │  │ VideoSniffer     │   │
               │  └──────────────────┘  │  └──────────────────┘   │
               │  ┌──────────────────┐  │  ┌──────────────────┐   │
               │  │ StreamCache      │  │  │ Disk Storage     │   │
               │  └──────────────────┘  │  └──────────────────┘   │
               └──────────────────────────────────────────────────┘
```

---

## 🔑 2. Core Source Files Index

| File | Subsystem | Responsibility |
| :--- | :--- | :--- |
| [`NativePlayerActivity.java`](file:///C:/Users/sanya/StudioProjects/AniLove2/android/app/src/main/java/com/anilove/app/NativePlayerActivity.java) | Native Android | Primary activity hosting 100% Native Media3 ExoPlayer engine (`PlayerView`), Dual Engine mode toggle (`ExoPlayer` <-> `WebView Player`), direct MP4/HLS playback, offline local playback, position-preserving quality & language switching, background thread player release, `ExoPlaybackException` source error auto-recovery via `VideoSniffer` fallback, `.m4s` segment chunk filtering, Cookie sync from CookieManager, custom Referer header injection, dedicated Subtitle API (`subtitles.php`) parser, dual-audio prevention, shared-element landscape transitions, gesture overlays, floating layout, native Picture-in-Picture (`enterPipMode()`), AniSkip skip buttons with yellow seekbar indicators, and custom native caption overlay. |
| [`VideoSniffer.java`](file:///C:/Users/sanya/StudioProjects/AniLove2/android/app/src/main/java/com/anilove/app/VideoSniffer.java) | Native Utilities | Background headless WebView sniffer intercepting XHR/Fetch/DOM streams with static instance tracking (`cancelActiveSniffers()`), proxy domain matching (`anixx.cloud`, `dramahot.top`, `hentaiocean.com`), and direct `.m3u8` / `.mp4` video stream extraction. |
| [`NativePlayerPlugin.java`](file:///C:/Users/sanya/StudioProjects/AniLove2/android/app/src/main/java/com/anilove/app/NativePlayerPlugin.java) | Capacitor Bridge | Exposes native player controls (`play`, `pause`, `seek`, `updatePosition`, `notifyLanguageChange`) to React with rapid `play()` call de-duplication and navigation listener callbacks. |
| [`DownloadPlugin.java`](file:///C:/Users/sanya/StudioProjects/AniLove2/android/app/src/main/java/com/anilove/app/DownloadPlugin.java) | Capacitor Bridge | Capacitor IPC plugin bridging React JS download commands (`startDownload`, `pauseDownload`, `resumeDownload`, `cancelDownload`, `getDownloads`) to `EpisodeDownloadService`, dispatching real-time progress/status events, launching offline playback in `NativePlayerActivity`, and exporting episodes to public gallery storage. |
| [`EpisodeDownloadService.java`](file:///C:/Users/sanya/StudioProjects/AniLove2/android/app/src/main/java/com/anilove/app/EpisodeDownloadService.java) | Foreground Service | High-performance Android Foreground Service executing multi-episode parallel background downloading (2 concurrent download tasks, 10 segment download workers), master HLS playlist quality selection, fMP4 init chunk handling, Range-based HTTP resumption, dual WebVTT subtitle track downloading (`localSubPath`, `localSubPath2`), and system progress notifications with Pause/Resume/Cancel actions. |
| [`hentaioceanService.ts`](file:///C:/Users/sanya/StudioProjects/AniLove2/src/services/hentaioceanService.ts) | 18+ API Service | Service parsing `https://hentaiocean.com/rss.xml` feed, fetching title details from `https://hentaiocean.com/api?action=hentai&slug=${slug}`, searching 18+ catalog, and mapping entries into AniLove `Anime` model format. |
| [`storage.ts`](file:///C:/Users/sanya/StudioProjects/AniLove2/src/services/storage.ts) | Local Storage Engine | Manages user settings, profile preferences, and **profile-isolated keys**: `anilove_library_v3` (Normal) vs `anilove_library_18plus_v1` (18+ Mode), and `anilove_watch_history_v2` (Normal) vs `anilove_watch_history_18plus_v1` (18+ Mode). |
| [`downloadManager.ts`](file:///C:/Users/sanya/StudioProjects/AniLove2/src/services/downloadManager.ts) | Frontend Service | React TypeScript download service handling MovieBox Batch Download API requests (`batch-download`), Batch Subtitle API requests (`batch_subtitles.php`), stream URL resolution, download state caching, and native event subscription. |
| [`BatchDownloadModal.tsx`](file:///C:/Users/sanya/StudioProjects/AniLove2/src/components/BatchDownloadModal.tsx) | Web Component | Modal UI allowing users to select multiple episodes, select audio tracks (SUB, DUB, Indian Dubs), select quality (`1080p`, `720p`, `480p`, `360p`), select subtitle language, and launch batch downloads without restrictive locks. |
| [`DownloadsView.tsx`](file:///C:/Users/sanya/StudioProjects/AniLove2/src/components/DownloadsView.tsx) | Web Component | Full-screen offline download manager UI displaying active downloading progress, completed downloads grouped by Anime series, pause/resume/delete actions, offline playback triggering, and public storage exports. |
| [`streamingProviders.ts`](file:///C:/Users/sanya/StudioProjects/AniLove2/src/services/streamingProviders.ts) | Server Resolvers | Core multi-source streaming resolver managing 5 streaming sources (`Multi-Lang`, `AnimeDekho`, `HiAnime`, `AnimeSalt`, `HentaiOcean`), 20-minute local caching (`STREAM_CACHE`), dynamic audio/resolution mapping, and primary/secondary language hierarchy fallback. |
| [`nativePlayer.ts`](file:///C:/Users/sanya/StudioProjects/AniLove2/src/services/nativePlayer.ts) | Frontend Service | TypeScript wrapper service registering the `NativePlayer` Capacitor plugin and handling episode navigation events. |

---

## 📡 3. Multi-Source Streaming Architecture (`streamingProviders.ts`)

AniLove powers video delivery through **5 distinct streaming sources**:

### 1️⃣ Multi-Lang (`Multi-Lang` / MovieBox Engine)
- **API**: `https://moviebox-api-mklm.onrender.com/api/stream-all-languages?title={title}&se=1&ep={ep}`
- **Batch Download API**: `https://moviebox-api-mklm.onrender.com/api/anime/batch-download?title={title}&episodes={1,2,3}&se=1&audio={audio}&quality={quality}`
- **Default 1st Source**: Positioned at the top of the frontend dropdown menu.
- **Dynamic Multi-Audio**: Supports `JAP (Sub)`, `ENG (Dub)`, `Hindi`, `Tamil`, `Telugu`, `Malayalam`, `Kannada`, `Bengali`...
- **Dynamic Quality Maps**: Returns direct CDN `.mp4` URLs (`bcdnxw.hakunaymatata.com`) with required header `Referer: https://netfilm.world/`.

### 2️⃣ AnimeDekho (`AnimeDekho`)
- **API**: `https://animeworld-india-api-njtl.onrender.com/api/anime-world-india/v1/stream.php?anilistId={anilistId}&ep={ep}`
- Streaming only (not integrated into downloading).

### 3️⃣ HiAnime (`HiAnime`)
- **Deterministic Embed Routes**:
  - `Server 1`: `https://vidnest.fun/anime/{anilistId}/{ep}/{sub|dub}`
  - `Server 2`: `https://tryembed.us.cc/embed/anime/{anilistId}/{ep}/{sub|dub}`
  - `Server 3`: `https://vidnest.fun/animepahe/{anilistId}/{ep}/{sub|dub}`
- Stream URLs are resolved on-device via `VideoSniffer.java` capturing proxied `.m3u8` streams from `anixx.cloud` / `dramahot.top`.

### 4️⃣ AnimeSalt (`AnimeSalt`)
- **API**: `https://animesalt-api-omega.vercel.app/api/stream?id={slug}&ep=ep-{ep}`
- **Header Injection**: Requires `Referer: https://animesalt.me/`.

### 5️⃣ HentaiOcean (`HentaiOcean` - 18+ Mode Only)
- **Embed URL**: `https://hentaiocean.com/embed/{slug}?la=1`
- **Stream Extraction**: On-device sniffing in `VideoSniffer.java` intercepts `.m3u8` / `.mp4` streams from embed URL.
- **Privacy & Profile Isolation**: Active ONLY when `settings.is18PlusMode` is `true`.

---

## 🔒 4. Dual Profile & 18+ Secret Isolation Architecture

To ensure safety and privacy, AniLove operates as **two completely separate user profiles on a single device**:

```
                              ┌────────────────────────┐
                              │  UserSettings.is18Plus │
                              └───────────┬────────────┘
                                          │
                  ┌───────────────────────┴───────────────────────┐
                  │                                               │
                  ▼ (OFF = Normal Mode)                           ▼ (ON = 18+ Secret Profile)
┌──────────────────────────────────────────┐    ┌──────────────────────────────────────────┐
│ Normal Profile Storage & UI              │    │ 18+ Secret Profile Storage & UI          │
│ ├── Library: anilove_library_v3          │    │ ├── Library: anilove_library_18plus_v1   │
│ ├── History: anilove_watch_history_v2    │    │ ├── History: anilove_watch_history_18plus│
│ ├── Catalog: AniList GraphQL             │    │ ├── Catalog: HentaiOcean API & RSS Feed  │
│ └── Search: Normal Anime Catalog         │    │ └── Search: HentaiOcean 18+ Search       │
└──────────────────────────────────────────┘    └──────────────────────────────────────────┘
```

- Switching profiles in Account Settings (`AccountView.tsx`) immediately switches active storage keys and re-renders Home, Search, Library, and Continue Watching instantly with zero cross-contamination!

---

## 📥 5. Deep Dive: Complete Anime Download Subsystem

The download system in AniLove is designed for **high-speed, resilient, multi-threaded background episode downloading** with full offline playback and storage export capabilities.

```
 [BatchDownloadModal.tsx] ──> [downloadManager.ts] ──> [DownloadPlugin.java]
                                                              │
                                                        Start Foreground
                                                              │
                                                              ▼
                                                 [EpisodeDownloadService.java]
                                                  ├── Pre-cache / Sniff Stream
                                                  ├── Download Dual Subtitles (.vtt)
                                                  ├── Parse HLS Master / Direct MP4
                                                  ├── 10-Worker Segment Downloader
                                                  └── Merge & Save to Local Disk
```

### Flow & Lifecycle:
1. **User triggers download**: In `BatchDownloadModal.tsx`, the user selects quality, audio track, and episodes.
2. **Download Queueing**: `downloadManager.ts` formats the request payload and calls `DownloadPlugin.startDownload(...)`.
3. **Service Launch**: `DownloadPlugin.java` starts `EpisodeDownloadService` as an Android Foreground Service with ongoing system notification.
4. **HLS/MP4 Parallel Downloader**: `EpisodeDownloadService` spawns 10 worker threads to stream segment chunks, merging them locally into `/Android/data/com.anilove.app/files/downloads/`.
5. **Offline Playback**: In `DownloadsView.tsx`, clicking a downloaded episode invokes `DownloadPlugin.playLocalEpisode(...)` which launches `NativePlayerActivity` pointing directly to the local file path `file:///...`.

---

## 🛠️ 6. Build, Sync & Deployment Protocol

Whenever making changes to frontend code or native player files:
1. Sync web bundle to Android assets:
   ```cmd
   npm run build:android
   ```
2. Compile debug APK:
   ```cmd
   gradlew assembleDebug
   ```
3. Commit and push code:
   ```cmd
   git add .
   git commit -m "update message"
   git push origin main
   ```
