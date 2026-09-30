# 🎬 AniLove Native Player, Servers & Download Engine — Complete Developer Manual

Welcome to the **AniLove Native Player, Server Extractor & Download Engine** architecture documentation!  
This document serves as the **definitive developer manual** for maintaining, troubleshooting, or expanding the video player, server resolvers, streaming pipeline, subtitle engine, or background download system.

---

## 🏗️ 1. High-Level Architecture Overview

AniLove is engineered as a hybrid **Capacitor + Pure Native Media3 ExoPlayer** application. While the primary UI (Home, Search, Details, Anime Lists, Settings) is managed in React/TypeScript inside Capacitor's WebView, the core video player engine, hardware decoding, stream sniffing, and download engine are handled **100% natively in Java** using **AndroidX Media3 ExoPlayer**.

```
               ┌──────────────────────────────────────────────────┐
               │        React / Web UI Layer (TypeScript)         │
               │   WatchView.tsx / ProVideoPlayer.tsx /           │
               │   nativePlayer.ts / downloadManager.ts           │
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
               │  │   100% Native Media3 ExoPlayer Engine      │  │
               │  │   (GPU Hardware Acceleration / HLS / VTT)   │  │
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
| [`NativePlayerActivity.java`](file:///C:/Users/sanya/StudioProjects/AniLove2/android/app/src/main/java/com/anilove/app/NativePlayerActivity.java) | Native Android | Primary activity hosting 100% Native Media3 ExoPlayer engine (`PlayerView`), direct VidLink API extractor (`attemptVidLinkDirectExtract`), direct Server 2 HTTP API extractor (`attemptServer2DirectExtract`), `ExoPlaybackException` source error auto-recovery via VideoSniffer fallback, `.m4s` segment chunk filtering, real-time TrackSelectionParameters for video resolution and audio language changing, Cookie sync from CookieManager, dedicated Subtitle API (`subtitles.php`) parser, dual-audio prevention via VideoSniffer lifecycle cleanup, shared-element landscape transitions, auto-next countdown toast, gesture overlays, floating layout, PiP mode, AniSkip skip buttons, yellow seekbar OP/ED indicators, independent subtitle overlay, and caption controls. |
| [`VideoSniffer.java`](file:///C:/Users/sanya/StudioProjects/AniLove2/android/app/src/main/java/com/anilove/app/VideoSniffer.java) | Native Utilities | Background headless WebView sniffer intercepting XHR/Fetch/DOM streams with static instance tracking (`cancelActiveSniffers()`), audio-only track variant filtering (`-a1.m3u8`, `audio.m3u8`), dummy wrapper link filtering (`tryembed.us.cc/s/`, `vidnest.fun/s/`), dynamic base URL matching (`tryembed.us.cc`, `vidnest.fun`), and `.m4s` chunk filtering to extract direct `.m3u8` master video playlists (`god.anixx.cloud/proxy/...`) and `.vtt` subtitles. |
| [`NativePlayerPlugin.java`](file:///C:/Users/sanya/StudioProjects/AniLove2/android/app/src/main/java/com/anilove/app/NativePlayerPlugin.java) | Capacitor Bridge | Exposes native player controls (`play`, `pause`, `seek`, `updatePosition`, `notifyLanguageChange`) to React with rapid `play()` call de-duplication and navigation listener callbacks. |
| [`nativePlayer.ts`](file:///C:/Users/sanya/StudioProjects/AniLove2/src/services/nativePlayer.ts) | Frontend Service | TypeScript wrapper service registering the `NativePlayer` Capacitor plugin, resolving streaming sources, and handling episode navigation events. |
| [`subtitleService.ts`](file:///C:/Users/sanya/StudioProjects/AniLove2/src/services/subtitleService.ts) | Subtitle Pipeline | Dedicated Subtitle API fetching (`subtitles-l8cm.onrender.com/subtitles.php`), 3-day local caching, provider anonymization, priority sorting, and pre-download batch validation. |
| [`EpisodeDownloadService.java`](file:///C:/Users/sanya/StudioProjects/AniLove2/android/app/src/main/java/com/anilove/app/EpisodeDownloadService.java) | Foreground Service | Handles multi-threaded background episode downloads, `#EXT-X-STREAM-INF` master playlist resolution parsing for 1080p / 720p / 480p quality selection, notification actions (Pause/Resume/Cancel), and byte-range HTTP resumption. |
| [`DownloadPlugin.java`](file:///C:/Users/sanya/StudioProjects/AniLove2/android/app/src/main/java/com/anilove/app/DownloadPlugin.java) | Capacitor Bridge | Manages download state JS bindings, offline playback launching, and public storage exports (`Storage/Downloads/AniLove/`). |
| [`streamingProviders.ts`](file:///C:/Users/sanya/StudioProjects/AniLove2/src/services/streamingProviders.ts) | Server Resolvers | Direct deterministic Server 2 URL pattern generator (`Server 2-A`, `Server 2-B`, `Server 2-C-SUB`: `https://vidnest.fun/animepahe/{id}/{ep}/sub` and `Server 2-C-DUB`: `https://vidnest.fun/animepahe/{id}/{ep}/dub`). |
| [`WatchView.tsx`](file:///C:/Users/sanya/StudioProjects/AniLove2/src/components/WatchView.tsx) | Web Component | Manages playback UI state, direct server switch bridge (`handleServerSwitchDirect`), audio toggles, episode switching, expandable server dropdown, and player position sync. |
| [`StreamCache.java`](file:///C:/Users/sanya/StudioProjects/AniLove2/android/app/src/main/java/com/anilove/app/StreamCache.java) | Native Utilities | Thread-safe memory cache storing pre-fetched stream URLs and subtitle tracks for instant zero-latency episode transitions using `ConcurrentHashMap`. |

---

## ⚡ 3. Verified Server 1 Configuration & Direct API Extractors

### 📺 Server 1 Active Server Selection
Server 1 has been cleaned to keep strictly the **4 verified working & promising servers**:
1. **Server 1-C (`piratexplay.cc Multi`)**: Multi-audio proxy server providing Hindi, Tamil, Telugu, English, and Japanese audio links. Unpacks language choices directly into target `abyssplayer.com` stream URLs.
2. **Server 1-P (`blakiteapi.xyz`)**: Direct API embed stream server.
3. **Server 1-Q (`abyssplayer.com`)**: High-performance Abyss Player server.
4. **Server 1-R (`vidmoly.biz`)**: Ultra-reliable HLS video stream server.

*(All non-working legacy Server 1 options—A, B, D, E, F, G, H, I, J, K, L, M, N, O, S—have been removed to ensure 100% playback reliability).*

### 🛡️ Abyss Player Frame-Busting & Anti-Redirect Fix
Abyss Player (`abyssplayer.com` / `short.icu`) enforces a strict iframe frame-busting check:
`if(top.location == self.location && !/^(.+?)\.abyss\.to$/.test(document.location.hostname)) { window.location = "https://abyss.to"; }`
- **Solution in `VideoSniffer.java`**:
  - `injectAntiRedirectScript()` overrides the `window.top` getter dynamically so `top.location == self.location` evaluates to `false`.
  - `shouldOverrideUrlLoading()` intercepts and aborts any navigation attempt to `https://abyss.to/`.
  - This keeps `abyssplayer.com` executing its `SoTrym` payload on page, decoding `datas` and requesting the raw video stream for ExoPlayer!

### 🚀 Direct Server Switch Bridge (`WatchView.tsx`)
- When any server option is selected in the UI dropdown (`Server 1-C`, `Server 1-P`, `Server 1-Q`, `Server 1-R`, `Server 2-A-SUB`, `Server 2-A-DUB`, `Server 2-B-SUB`, `Server 2-B-DUB`, `Server 2-C-SUB`, `Server 2-C-DUB`), `handleServerSwitchDirect` is invoked **instantly**, passing the exact server URL and `serverName` to `NativePlayer.play()`.
- Bypasses web player resolver delays, updating the **Live Diagnostic HUD** and switching the active video stream in Java immediately!

---

## 🕵️ 4. Headless VideoSniffer Engine (`VideoSniffer.java`)

When direct API extraction is unavailable or returns an error, `NativePlayerActivity` seamlessly delegates stream discovery to `VideoSniffer.java`:
1. **Headless Execution**: Spawns an invisible Android `WebView` off-screen with JavaScript enabled and standard desktop/mobile user-agent headers.
2. **Network Interception**: Overrides `shouldInterceptRequest` and `onPageStarted`/`onPageFinished` to inspect all XHR, Fetch, and media requests.
3. **Smart Filters**:
   - **Dummy Wrapper Filter**: Filters out wrapper / iframe redirect pages (e.g. `tryembed.us.cc/s/`, `vidnest.fun/s/`).
   - **Audio-Only Variant Filter**: Ignores `-a1.m3u8` or `audio.m3u8` tracks to prevent loading audio without video.
   - **Segment Chunk Filter**: Filters out individual `.m4s` or `.ts` chunks, focusing exclusively on `#EXT-X-STREAM-INF` master playlists (`god.anixx.cloud/proxy/...`).
4. **Lifecycle & Cancellation**: `VideoSniffer.cancelActiveSniffers()` is invoked whenever a new episode or server is selected. This ensures older background sniffers immediately abort, completely eliminating dual-audio or overlapping video bugs.

---

## 💬 5. Subtitle Engine & Dedicated Subtitle API (`subtitles.php`)

### 🎯 Subtitle Sources & Priority
1. **Dedicated Subtitle API**: `fetchUnifiedSubtitlesJava(anilistId, episodeNumber)` calls `https://subtitles-l8cm.onrender.com/subtitles.php?anilistId=...&ep=...`.
2. **Protected Track Locking**: When a subtitle track from the dedicated Subtitle API is loaded, `VideoSniffer` is explicitly prevented from overwriting `subtitleUrl`.
3. **VTT Subtitle Engine**:
   - `parseVttContent` downloads and parses `.vtt` WebVTT subtitle files into `VttCue` timestamp ranges.
   - `updateNativeSubtitleOverlay` renders subtitles onto the custom native subtitle overlay synced with ExoPlayer's current playback position in milliseconds.

### ⏱️ Per-Episode Timing Offset
- `saveEpisodeSubOffset` / `loadEpisodeSubOffset` persist user-defined subtitle sync adjustments per episode in `SharedPreferences`.
- `applySubtitleTimingOffsetInWeb` applies timing shifts dynamically to guarantee lip-sync precision.

### 🎨 Custom Caption Styling System
- Full caption customization menu supporting:
  - Font sizes (Small, Medium, Large, Extra Large).
  - Text colors (White, Yellow, Cyan, Green).
  - Background opacity & background colors (Transparent, Black 50%, Black 100%, Dark Blue).
  - Text edge types (None, Drop Shadow, Outline).
  - Real-time live preview canvas canvas inside the caption settings modal.

---

## 📥 6. Background Download Engine (`EpisodeDownloadService.java` & `DownloadPlugin.java`)

AniLove includes a full-featured background episode downloader capable of downloading high-bitrate HLS streams for offline playback:
1. **Foreground Service**: `EpisodeDownloadService` runs as an Android Foreground Service with continuous notification progress updates (percent, speed in MB/s, downloaded/total bytes).
2. **Master Playlist Parsing**: Parses `#EXT-X-STREAM-INF` master HLS playlists to automatically select or let the user choose between **1080p**, **720p**, and **480p** variants.
3. **Range Resumption**: Supports byte-range HTTP request resumption (`Range: bytes=...`) using `.part` temporary files, allowing downloads to survive network interruptions.
4. **Offline Playback**: `DownloadPlugin.playOffline()` launches `NativePlayerActivity` in offline mode, loading local video files and local VTT subtitles directly from internal storage without requiring internet connection.
5. **Public Storage Export**: `DownloadPlugin.exportToPublicStorage()` exports downloaded episodes to `Storage/Downloads/AniLove/` with formatted titles and triggers `MediaScannerConnection` so files immediately appear in system media apps and gallery.

---

## 🧠 7. Stream Caching (`StreamCache.java`)

To ensure instant episode switches when binge-watching:
- `StreamCache.java` maintains a thread-safe `ConcurrentHashMap` mapping `anilistId_epNumber_audio` keys to pre-fetched video stream URLs and subtitle tracks.
- When an episode is playing, `triggerNextEpisodePreFetch()` quietly resolves the next episode's stream in the background.
- When the user taps "Next Episode" or auto-next triggers, the player retrieves the stream from `StreamCache` instantly with zero buffering delay!

---

## 🎮 8. Player Gestures & UI Features

- **Gesture Control**:
  - **Horizontal Swipe**: Fast-forward / rewind seek with visual time indicator overlays.
  - **Vertical Swipe (Left Half)**: Screen brightness adjustment.
  - **Vertical Swipe (Right Half)**: Media volume adjustment.
  - **Long-Press**: Instant 2.0x playback speed boost with floating speed pill indicator; releases back to standard speed upon finger lift.
- **AniSkip Integration**:
  - `fetchAniSkipIntervals(idMal, episodeNumber)` fetches Opening (OP) and Ending (ED) timestamps from the AniSkip API.
  - Renders yellow segment markers directly onto the ExoPlayer seekbar using custom `OpEdSeekBarDrawable`.
  - Displays "Skip Opening" and "Skip Ending" overlay buttons when playback reaches designated time ranges.
- **Picture-in-Picture (PiP)**:
  - Supports Android native PiP mode (`enterPipMode()`).
  - Resets window layout bounds automatically when exiting PiP to prevent layout clipping or top-bar offsets.
- **Auto-Next Countdown**:
  - `checkAutoNextEpisodeTrigger()` detects when playback is within 120 seconds or 85% completion.
  - Displays a subtle countdown toast prompting transition to the next episode.

---

## 🧹 9. Codebase Cleanup & Removed Obsolete Components

In this update, dead legacy files were safely purged to keep the codebase lightweight and maintainable:
- **Removed**: `ExoPlayerActivity.java` (Obsolete empty activity)
- **Removed**: `ExoPlayerPlugin.java` (Obsolete plugin stub)
- **Removed**: `activity_exo_player.xml` (Obsolete layout)
- **Cleaned**: Unused imports (`android.os.Message`, `android.os.Build`) and stub methods in `NativePlayerActivity.java` and `VideoSniffer.java`.

---

## 🛠️ 10. Maintenance Checklist for Developers

1. **Direct Server Switch Bridge**: Always pass `serverName` in `handleServerSwitchDirect` so `NativePlayerActivity` and the Live Diagnostic HUD reflect the selected server in real-time.
2. **VidLink & Server 2 Direct Extractors**: Maintain `attemptVidLinkDirectExtract` and `attemptServer2DirectExtract` for instant playback without web view overhead.
3. **VideoSniffer Cleanups**: Always call `VideoSniffer.cancelActiveSniffers()` before starting a new sniff task to prevent overlapping audio/video streams.
4. **Build & Sync Protocol**: Whenever modifying frontend TS or native Java code, run:
   ```cmd
   npm run build:android
   ```
   Followed by Gradle build:
   ```cmd
   gradlew assembleDebug
   ```
   This guarantees web assets and native Java classes are synchronized for testing.
