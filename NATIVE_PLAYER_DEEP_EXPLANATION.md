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
| [`VideoSniffer.java`](file:///C:/Users/sanya/StudioProjects/AniLove2/android/app/src/main/java/com/anilove/app/VideoSniffer.java) | Native Utilities | Background headless WebView sniffer intercepting XHR/Fetch/DOM streams with static instance tracking (`cancelActiveSniffers()`), audio-only track variant filtering (`-a1.m3u8`, `audio.m3u8`), dummy wrapper link filtering (`tryembed.us.cc/s/`, `vidnest.fun/s/`), and `.m4s` chunk filtering to extract direct `.m3u8` master video playlists and `.vtt` subtitles. |
| [`NativePlayerPlugin.java`](file:///C:/Users/sanya/StudioProjects/AniLove2/android/app/src/main/java/com/anilove/app/NativePlayerPlugin.java) | Capacitor Bridge | Exposes native player controls (`play`, `pause`, `seek`, `updatePosition`, `notifyLanguageChange`) to React with rapid `play()` call de-duplication and navigation listener callbacks. |
| [`DownloadPlugin.java`](file:///C:/Users/sanya/StudioProjects/AniLove2/android/app/src/main/java/com/anilove/app/DownloadPlugin.java) | Capacitor Bridge | Capacitor IPC plugin bridging React JS download commands (`startDownload`, `pauseDownload`, `resumeDownload`, `cancelDownload`, `getDownloads`) to `EpisodeDownloadService`, dispatching real-time progress/status events, launching offline playback in `NativePlayerActivity`, and exporting episodes to public gallery storage. |
| [`EpisodeDownloadService.java`](file:///C:/Users/sanya/StudioProjects/AniLove2/android/app/src/main/java/com/anilove/app/EpisodeDownloadService.java) | Foreground Service | High-performance Android Foreground Service executing multi-episode parallel background downloading (2 concurrent download tasks, 10 segment download workers), master HLS playlist quality selection, fMP4 init chunk handling, Range-based HTTP resumption, and system progress notifications with Pause/Resume/Cancel actions. |
| [`downloadManager.ts`](file:///C:/Users/sanya/StudioProjects/AniLove2/src/services/downloadManager.ts) | Frontend Service | React TypeScript download service handling batch episode queueing (`queueBatchEpisodeDownloads`), stream resolver selection rules (HiAnime 1080p lock for SUB/DUB), subtitle pre-fetching, download state caching, and native event subscription. |
| [`BatchDownloadModal.tsx`](file:///C:/Users/sanya/StudioProjects/AniLove2/src/components/BatchDownloadModal.tsx) | Web Component | Modal UI allowing users to select multiple episodes, select audio tracks (SUB, DUB, Multi-Lang), select quality, pre-validate subtitle availability, and launch batch downloads. |
| [`DownloadsView.tsx`](file:///C:/Users/sanya/StudioProjects/AniLove2/src/components/DownloadsView.tsx) | Web Component | Full-screen offline download manager UI displaying active downloading progress, completed downloads grouped by Anime series, pause/resume/delete actions, offline playback triggering, and public storage exports. |
| [`streamingProviders.ts`](file:///C:/Users/sanya/StudioProjects/AniLove2/src/services/streamingProviders.ts) | Server Resolvers | Core multi-source streaming resolver managing 4 streaming sources (`Multi-Lang`, `AnimeDekho`, `HiAnime`, `AnimeSalt`), 20-minute local caching (`STREAM_CACHE`), dynamic audio/resolution mapping, and primary/secondary language hierarchy fallback. |
| [`nativePlayer.ts`](file:///C:/Users/sanya/StudioProjects/AniLove2/src/services/nativePlayer.ts) | Frontend Service | TypeScript wrapper service registering the `NativePlayer` Capacitor plugin and handling episode navigation events. |
| [`subtitleService.ts`](file:///C:/Users/sanya/StudioProjects/AniLove2/src/services/subtitleService.ts) | Subtitle Pipeline | Dedicated Subtitle API fetching (`subtitles-l8cm.onrender.com/subtitles.php`), 3-day local caching, provider anonymization, priority sorting, and pre-download batch validation. |
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

## 📥 7. Deep Dive: Complete Anime Download Subsystem

The download system in AniLove is designed for **high-speed, resilient, multi-threaded background episode downloading** with full offline playback and storage export capabilities.

```
 [BatchDownloadModal.tsx] ──> [downloadManager.ts] ──> [DownloadPlugin.java]
                                                              │
                                                        Start Foreground
                                                              │
                                                              ▼
                                                 [EpisodeDownloadService.java]
                                                  ├── Pre-cache / Sniff Stream
                                                  ├── Download Subtitles (.vtt)
                                                  ├── Parse HLS Master / Direct MP4
                                                  ├── 10-Worker Segment Downloader
                                                  └── Merge & Save to Local Disk
```

### 7.1 Download Workflow & Stream Enforcement Rules (`downloadManager.ts`)

1. **User Initiation**:
   - User opens `BatchDownloadModal.tsx` on an anime details page.
   - Selects episode range, audio language (`SUB`, `DUB`, or Indian languages), server, and quality (`1080p`, `720p`, `480p`, `360p`).
   - Modal validates subtitle language presence before queueing.

2. **Stream Source & Quality Locking Rules**:
   - **Japanese (SUB) & English (DUB) Rule**: Forced to use `HiAnime` source at `1080p` resolution. `HiAnime` produces clean, direct HLS streams.
   - **Multi-Language Rule**: Uses `resolveEpisodeSource` (MovieBox Engine). Verifies that the selected audio track and quality exist before queueing. If missing, download is skipped with a clear error message.
   - **AnimeSalt Rule**: Uses `resolveAnimeSaltSource`.

3. **Subtitle Track Pre-Fetching**:
   - Before queueing the video stream, `fetchUnifiedSubtitles(anime.id, ep.number, 3000)` is called.
   - Standardizes subtitle tracks via `anonymizeAndSortSubtitleTracks`.
   - The top English WebVTT URL is attached to the download payload as `subtitleUrl`.

4. **Payload Construction & Queueing**:
   - A unique `downloadId` is generated: `${anime.id}_ep_${ep.number}_${audio.toLowerCase()}_${effectiveQuality}`.
   - Construct download payload `item`:
     ```typescript
     {
       id: downloadId,
       anilistId: anime.id,
       animeTitle: displayTitle,
       episodeNumber: ep.number,
       streamUrl,
       pageUrl: streamUrl,
       subtitleUrl,
       audio,
       serverName,
       quality: effectiveQuality,
       thumbnail: ep.thumbnail || anime.coverImage?.large
     }
     ```
   - Calls `DownloadPlugin.startDownload({ item })` via Capacitor IPC bridge.

---

### 7.2 Capacitor IPC Bridge (`DownloadPlugin.java`)

`DownloadPlugin.java` acts as the communications bridge between Capacitor JS and the native Android `EpisodeDownloadService`:

- **`startDownload`**: Accepts `item` JSON object and launches `EpisodeDownloadService` with action `ACTION_START` via `startForegroundService()` (Android O+) or `startService()`.
- **`pauseDownload` / `resumeDownload` / `cancelDownload`**: Sends intent actions (`ACTION_PAUSE`, `ACTION_RESUME`, `ACTION_CANCEL`) with `downloadId` to `EpisodeDownloadService`.
- **`getDownloads`**: Asynchronously scans local app storage (`Android/data/com.anilove.app/files/downloads/`), loads all saved `meta_EP.json` metadata files, and returns a JSON array of all queued, downloading, paused, and completed downloads to JavaScript.
- **`progressListener` Callbacks**: Registers a native callback listener with `EpisodeDownloadService`. As download progress or status changes occur natively, `DownloadPlugin` fires JS events (`onDownloadProgress` and `onDownloadStatusChange`) to keep the web UI (`DownloadsView.tsx`) updated in real-time.
- **`playOffline`**: Receives `localFilePath` and `localSubPath`, constructs an intent targeting `NativePlayerActivity`, sets `offlineMode = true`, and launches native ExoPlayer for zero-buffering offline watching.
- **`exportToPublicStorage`**: Reads local episode MP4 file from app storage, copies it into the public `Storage/Downloads/AniLove/` folder with clean naming (`AnimeTitle_EP1.mp4`), and invokes `MediaScannerConnection.scanFile()` so the video immediately appears in the Android System Gallery and Files app.

---

### 7.3 Foreground Service Architecture (`EpisodeDownloadService.java`)

`EpisodeDownloadService` is a robust, multi-threaded Android Foreground Service built to ensure downloads continue uninterrupted even if the app is minimized or closed.

1. **Foreground Service Lifecycle & Notification**:
   - Immediately invokes `startForeground()` in `onCreate()` with `FOREGROUND_SERVICE_TYPE_DATA_SYNC` to satisfy strict Android 14 foreground service requirements.
   - Displays persistent notification on `anilove_downloads_channel` showing active episode title, percentage progress, download speed (MB/s or KB/s), and byte counters.
   - Provides action buttons directly inside the Android system notification drawer: **Pause**, **Resume**, and **Cancel**.

2. **Concurrency & Thread Pooling**:
   - `threadPool = Executors.newFixedThreadPool(2)`: Allows up to **2 simultaneous episode downloads** at once. Additional downloads wait in `QUEUED` status and begin automatically when a slot frees up.
   - `snifferSemaphore = Semaphore(1)`: Restricts on-device `VideoSniffer` headless WebView instances to **1 active sniffer at a time**, preventing WebView thread locks or memory spikes.

3. **Stream Resolution Engine**:
   - **Step A: Active Player Cache Check**: Checks `StreamCache.get(anilistId, ep, audio)`. If the user previously played or pre-loaded this episode in the video player, reuses the direct cached stream URL instantly!
   - **Step B: Backend Extraction**: If stream URL is an embed player, calls AnimeWorld API (`/stream.php`). Unpacks encoded embed links (e.g. Base64 `multi.php?data=`, `short.icu/` -> `abyssplayer.com/`, `iqsmart`) natively in Java (`unpackServerUrlInJava`).
   - **Step C: On-Device VideoSniffer**: If still an embed URL, launches `VideoSniffer.java` in background to intercept XHR/Fetch network traffic and extract direct `.m3u8` or `.mp4` stream URLs.

---

### 7.4 Stream Downloading Algorithms (`EpisodeDownloadService.java`)

#### 🎥 Algorithm A: Direct MP4 Download (`downloadDirectVideo`)
1. Checks for existing file size for byte-range resumption.
2. Sets `Range: bytes=<existing_length>-` HTTP request header on `HttpURLConnection`.
3. If server returns `HTTP 206 Partial Content`, seeks output file to `existing_length` and appends data.
4. Reads incoming network stream using a high-efficiency **64KB byte buffer**.
5. Calculates real-time transfer speed every 600ms and dispatches progress updates.

#### 🍿 Algorithm B: Multi-Threaded HLS Stream Download (`downloadHlsStream`)
1. **Playlist Resolution**: Connects to `.m3u8` playlist with HTTP redirect tracking (`openHlsConnectionWithRedirects`).
2. **Master Playlist Quality Selection**:
   - If playlist is a Master Playlist (`#EXT-X-STREAM-INF`), parses all variant streams (`HlsVariant`) extracting resolution height (e.g., `1080`, `720`, `480`) and bandwidth.
   - Sorts variants and picks the best stream matching `item.quality` (or closest available).
   - Re-connects to selected variant media playlist.
3. **Initialization Chunk Handling (fMP4 / CMAF)**:
   - Parses `#EXT-X-MAP:URI="init.mp4"`.
   - If present, downloads `init.mp4` first and writes header box bytes into the final MP4 file.
4. **10-Worker Parallel Segment Downloader**:
   - Spawns an internal worker pool: `segmentPool = Executors.newFixedThreadPool(10)`.
   - Downloads up to **10 segment chunks simultaneously in parallel** to achieve maximum 5G/WiFi bandwidth utilization.
   - Saves individual segment files into temporary directory `segments_ep_<number>/seg_<i.ts>`.
5. **Sequential Stream Merging & Cleanup**:
   - Once all segments finish downloading, sequentially merges `seg_0.ts`, `seg_1.ts`, ... into final `ep_<number>.mp4` file.
   - Recursively deletes temporary `segments_ep_<number>` folder upon completion.

---

### 7.5 Metadata Storage & State Recovery (`meta_EP.json`)

- Downloads are stored in app-private external storage: `Android/data/com.anilove.app/files/downloads/<anime_title>_<anilistId>/`.
- Each completed/queued episode creates a `meta_<episodeNumber>.json` metadata file containing:
  ```json
  {
    "id": "12345_ep_1_dub_1080p",
    "anilistId": 12345,
    "animeTitle": "Demon Slayer",
    "episodeNumber": 1,
    "audio": "DUB",
    "quality": "1080p",
    "serverName": "Server 1",
    "status": "COMPLETED",
    "progress": 100,
    "bytesDownloaded": 245890124,
    "totalBytes": 245890124,
    "localFilePath": "/storage/emulated/0/Android/data/com.anilove.app/files/downloads/demon_slayer_12345/ep_1.mp4",
    "localSubPath": "/storage/emulated/0/Android/data/com.anilove.app/files/downloads/demon_slayer_12345/ep_1.vtt",
    "thumbnail": "https://...",
    "completedAt": 1710000000000
  }
  ```
- **Auto-Recovery**: On app launch, `EpisodeDownloadService.scanDirForMeta()` automatically scans the download directory. If app cache was cleared or files moved, it repairs `localFilePath` pointers automatically.

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
