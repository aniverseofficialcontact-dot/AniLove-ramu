# 🎬 AniLove Native Player, Streaming Pipeline, Subtitle Engine & Download System — Developer Manual

Welcome to the **AniLove Native Player, Streaming Resolvers, Subtitle Pipeline & Download Engine** architecture documentation!  
This document serves as the **authoritative developer manual** for maintaining, troubleshooting, or expanding the video player, streaming resolvers, subtitle engine, and background download system.

---

## 🏗️ 1. High-Level Architecture Overview

AniLove is engineered as a hybrid **Capacitor + Pure Native Media3 ExoPlayer** application. While the primary UI (Home, Search, Details, Anime Lists, Account, Settings, Downloads View) is managed in React/TypeScript inside Capacitor's WebView, the core video player engine, hardware decoding, stream sniffing, multi-audio/quality switching, background downloading, and file management are handled **natively in Java** using **AndroidX Media3 ExoPlayer** and an **Android Foreground Service**.

```
               ┌──────────────────────────────────────────────────┐
               │        React / Web UI Layer (TypeScript)         │
               │   WatchView.tsx / ProVideoPlayer.tsx /           │
               │   BatchDownloadModal.tsx / DownloadsView.tsx /     │
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
| [`VideoSniffer.java`](file:///C:/Users/sanya/StudioProjects/AniLove2/android/app/src/main/java/com/anilove/app/VideoSniffer.java) | Native Utilities | Background headless WebView sniffer intercepting XHR/Fetch/DOM streams with static instance tracking (`cancelActiveSniffers()`), proxy domain matching (`anixx.cloud`, `dramahot.top`), and direct `.m3u8` master video playlist extraction. |
| [`NativePlayerPlugin.java`](file:///C:/Users/sanya/StudioProjects/AniLove2/android/app/src/main/java/com/anilove/app/NativePlayerPlugin.java) | Capacitor Bridge | Exposes native player controls (`play`, `pause`, `seek`, `updatePosition`, `notifyLanguageChange`) to React with rapid `play()` call de-duplication and navigation listener callbacks. |
| [`DownloadPlugin.java`](file:///C:/Users/sanya/StudioProjects/AniLove2/android/app/src/main/java/com/anilove/app/DownloadPlugin.java) | Capacitor Bridge | Capacitor IPC plugin bridging React JS download commands (`startDownload`, `pauseDownload`, `resumeDownload`, `cancelDownload`, `getDownloads`) to `EpisodeDownloadService`, dispatching real-time progress/status events, launching offline playback in `NativePlayerActivity`, and exporting episodes to public gallery storage. |
| [`EpisodeDownloadService.java`](file:///C:/Users/sanya/StudioProjects/AniLove2/android/app/src/main/java/com/anilove/app/EpisodeDownloadService.java) | Foreground Service | High-performance Android Foreground Service executing multi-episode parallel background downloading (2 concurrent download tasks, 10 segment download workers), master HLS playlist quality selection, fMP4 init chunk handling, Range-based HTTP resumption, dual WebVTT subtitle track downloading (`localSubPath`, `localSubPath2`), and system progress notifications with Pause/Resume/Cancel actions. |
| [`downloadManager.ts`](file:///C:/Users/sanya/StudioProjects/AniLove2/src/services/downloadManager.ts) | Frontend Service | React TypeScript download service handling MovieBox Batch Download API requests (`batch-download`), Batch Subtitle API requests (`batch_subtitles.php`), stream URL resolution, download state caching, and native event subscription. |
| [`BatchDownloadModal.tsx`](file:///C:/Users/sanya/StudioProjects/AniLove2/src/components/BatchDownloadModal.tsx) | Web Component | Modal UI allowing users to select multiple episodes, select audio tracks (SUB, DUB, Indian Dubs), select quality (`1080p`, `720p`, `480p`, `360p`), select subtitle language, and launch batch downloads without restrictive locks. |
| [`DownloadsView.tsx`](file:///C:/Users/sanya/StudioProjects/AniLove2/src/components/DownloadsView.tsx) | Web Component | Full-screen offline download manager UI displaying active downloading progress, completed downloads grouped by Anime series, pause/resume/delete actions, offline playback triggering, and public storage exports. |
| [`streamingProviders.ts`](file:///C:/Users/sanya/StudioProjects/AniLove2/src/services/streamingProviders.ts) | Server Resolvers | Core multi-source streaming resolver managing 4 streaming sources (`Multi-Lang`, `AnimeDekho`, `HiAnime`, `AnimeSalt`), 20-minute local caching (`STREAM_CACHE`), dynamic audio/resolution mapping, and primary/secondary language hierarchy fallback. |
| [`nativePlayer.ts`](file:///C:/Users/sanya/StudioProjects/AniLove2/src/services/nativePlayer.ts) | Frontend Service | TypeScript wrapper service registering the `NativePlayer` Capacitor plugin and handling episode navigation events. |
| [`subtitleService.ts`](file:///C:/Users/sanya/StudioProjects/AniLove2/src/services/subtitleService.ts) | Subtitle Pipeline | Dedicated Subtitle API fetching (`subtitles-l8cm.onrender.com/subtitles.php` & `batch_subtitles.php`), 3-day local caching, provider anonymization, priority sorting, and pre-download batch validation. |
| [`StreamCache.java`](file:///C:/Users/sanya/StudioProjects/AniLove2/android/app/src/main/java/com/anilove/app/StreamCache.java) | Native Utilities | Thread-safe memory cache storing pre-fetched stream URLs and subtitle tracks for instant zero-latency episode transitions using `ConcurrentHashMap`. |

---

## 📡 3. Multi-Source Streaming Architecture (`streamingProviders.ts`)

AniLove powers video delivery through **4 distinct streaming sources**:

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

---

## 📥 4. Deep Dive: Complete Anime Download Subsystem

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

### 4.1 Download Workflow & Stream Enforcement Rules ([`downloadManager.ts`](file:///C:/Users/sanya/StudioProjects/AniLove2/src/services/downloadManager.ts))

1. **User Initiation**:
   - User opens `BatchDownloadModal.tsx` on an anime details page.
   - Selects episode range, audio language (`SUB`, `DUB`, or Indian languages), server source, quality (`1080p`, `720p`, `480p`, `360p`), and subtitle language.
   - Select controls are completely unlocked for user freedom.

2. **MovieBox Batch API Integration**:
   - For `Multi-Lang` / `MovieBox` source, `downloadManager.ts` sends a single batch stream request:
     `https://moviebox-api-mklm.onrender.com/api/anime/batch-download?title=${title}&episodes=${eps}&se=1&audio=${audio}&quality=${quality}`
   - Resolves direct CDN `.mp4` URLs from `hakunaymatata.com` with `Referer: https://netfilm.world/`.

3. **Batch Subtitles API Integration**:
   - Calls `https://subtitles-l8cm.onrender.com/batch_subtitles.php?anilistId=${id}&eps=${eps}&lang=${lang}&format=vtt` for all selected episodes in a single request.
   - Attaches primary `subtitleUrl` AND secondary `subtitleUrl2` to the download payload if multiple subtitle tracks exist for the same language (e.g., HiAnime + SubtitleCat).

4. **Payload Construction & Queueing**:
   - Constructs download payload `item`:
     ```typescript
     {
       id: downloadId,
       anilistId: anime.id,
       animeTitle: displayTitle,
       episodeNumber: ep.number,
       streamUrl,
       pageUrl: 'https://netfilm.world/',
       subtitleUrl: subUrl1 || '',
       subtitleUrl2: subUrl2 || '',
       audio,
       serverName,
       quality,
       thumbnail: ep.thumbnail || anime.coverImage?.large
     }
     ```
   - Calls `DownloadPlugin.startDownload({ item })` via Capacitor IPC bridge.

---

### 4.2 Foreground Service Architecture ([`EpisodeDownloadService.java`](file:///C:/Users/sanya/StudioProjects/AniLove2/android/app/src/main/java/com/anilove/app/EpisodeDownloadService.java))

1. **Foreground Service Lifecycle**:
   - Runs with notification controls (**Pause**, **Resume**, **Cancel**).
   - Thread pool handles 2 simultaneous episode downloads, while 10 worker threads handle HLS segment chunks in parallel.

2. **Dual Subtitle Track Support**:
   - Downloads primary subtitle track (`subtitleUrl`) to `ep_<number>.vtt` (`localSubPath`).
   - Downloads secondary subtitle track (`subtitleUrl2`) to `ep_<number>_2.vtt` (`localSubPath2`).
   - Saves both paths to `meta_EP.json`.

3. **Direct MP4 & CDN Header Support**:
   - Direct MP4 links from MovieBox (`bcdnxw.hakunaymatata.com`) include `Referer: https://netfilm.world/`.
   - Supports HTTP Range resumption (`Range: bytes=...`).

---

## 🛠️ 5. Build, Sync & Deployment Protocol

Whenever making changes to frontend code or native player files:
1. Sync web bundle to Android assets:
   ```cmd
   npm run build:android
   ```
2. Compile debug APK:
   ```cmd
   gradlew assembleDebug
   ```
