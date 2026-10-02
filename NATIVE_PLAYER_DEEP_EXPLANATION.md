# 🎬 AniLove Native Player, Subtitle Engine & Download System — Developer Manual

Welcome to the **AniLove Native Player, Subtitle Pipeline & Download Engine** architecture documentation!  
This document serves as the **definitive developer manual** for maintaining, troubleshooting, or expanding the video player, subtitle engine, streaming pipeline, or background download system.

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
| [`NativePlayerActivity.java`](file:///C:/Users/sanya/StudioProjects/AniLove2/android/app/src/main/java/com/anilove/app/NativePlayerActivity.java) | Native Android | Primary activity hosting 100% Native Media3 ExoPlayer engine (`PlayerView`), direct extraction fallbacks, `ExoPlaybackException` source error auto-recovery via VideoSniffer fallback, `.m4s` segment chunk filtering, real-time TrackSelectionParameters for video resolution and audio language changing, Cookie sync from CookieManager, dedicated Subtitle API (`subtitles.php`) parser, dual-audio prevention via VideoSniffer lifecycle cleanup, shared-element landscape transitions, auto-next countdown toast, gesture overlays, floating layout, PiP mode, AniSkip skip buttons, yellow seekbar OP/ED indicators, independent subtitle overlay, and caption controls. |
| [`VideoSniffer.java`](file:///C:/Users/sanya/StudioProjects/AniLove2/android/app/src/main/java/com/anilove/app/VideoSniffer.java) | Native Utilities | Background headless WebView sniffer intercepting XHR/Fetch/DOM streams with static instance tracking (`cancelActiveSniffers()`), audio-only track variant filtering (`-a1.m3u8`, `audio.m3u8`), dummy wrapper link filtering (`tryembed.us.cc/s/`, `vidnest.fun/s/`), dynamic base URL matching (`tryembed.us.cc`, `vidnest.fun`), and `.m4s` chunk filtering to extract direct `.m3u8` master video playlists and `.vtt` subtitles. |
| [`NativePlayerPlugin.java`](file:///C:/Users/sanya/StudioProjects/AniLove2/android/app/src/main/java/com/anilove/app/NativePlayerPlugin.java) | Capacitor Bridge | Exposes native player controls (`play`, `pause`, `seek`, `updatePosition`, `notifyLanguageChange`) to React with rapid `play()` call de-duplication and navigation listener callbacks. |
| [`nativePlayer.ts`](file:///C:/Users/sanya/StudioProjects/AniLove2/src/services/nativePlayer.ts) | Frontend Service | TypeScript wrapper service registering the `NativePlayer` Capacitor plugin and handling episode navigation events. |
| [`subtitleService.ts`](file:///C:/Users/sanya/StudioProjects/AniLove2/src/services/subtitleService.ts) | Subtitle Pipeline | Dedicated Subtitle API fetching (`subtitles-l8cm.onrender.com/subtitles.php`), 3-day local caching, provider anonymization, priority sorting, and pre-download batch validation. **(FULLY PRESERVED & INTRACT)** |
| [`EpisodeDownloadService.java`](file:///C:/Users/sanya/StudioProjects/AniLove2/android/app/src/main/java/com/anilove/app/EpisodeDownloadService.java) | Foreground Service | Handles multi-threaded background episode downloads, `#EXT-X-STREAM-INF` master playlist resolution parsing for 1080p / 720p / 480p quality selection, notification actions (Pause/Resume/Cancel), and byte-range HTTP resumption. |
| [`DownloadPlugin.java`](file:///C:/Users/sanya/StudioProjects/AniLove2/android/app/src/main/java/com/anilove/app/DownloadPlugin.java) | Capacitor Bridge | Manages download state JS bindings, offline playback launching, and public storage exports (`Storage/Downloads/AniLove/`). |
| [`streamingProviders.ts`](file:///C:/Users/sanya/StudioProjects/AniLove2/src/services/streamingProviders.ts) | Server Resolvers | **CLEAN STUB**: Previous buggy server resolver code has been reset to a clean interface, ready for building a fresh server engine from scratch. |
| [`WatchView.tsx`](file:///C:/Users/sanya/StudioProjects/AniLove2/src/components/WatchView.tsx) | Web Component | Manages playback UI state, audio toggles, episode switching, and player position sync. |
| [`StreamCache.java`](file:///C:/Users/sanya/StudioProjects/AniLove2/android/app/src/main/java/com/anilove/app/StreamCache.java) | Native Utilities | Thread-safe memory cache storing pre-fetched stream URLs and subtitle tracks for instant zero-latency episode transitions using `ConcurrentHashMap`. |

---

## 🧹 3. Reset Server Engine & Removed Diagnostic HUD

### 🔄 Server Resolvers Clean Reset (`streamingProviders.ts`)
- All legacy/buggy server resolvers, API extractors (`AnimeDekho`, `HiAnime`, `AnimeSalt`, `MovieBox`, `ANIME_WORLD_V1`), regex scrapers, and URL unpackers have been removed from `streamingProviders.ts`.
- `streamingProviders.ts` now exports a clean TypeScript interface and stub functions (`resolveEpisodeSource`, `STREAM_PROVIDERS`, `SUPPORTED_LANGUAGES`, `createDirectStreamSource`) allowing new streaming providers to be implemented from scratch without legacy bugs.

### 🗑️ Diagnostic HUD Overlay Removed
- Removed the Diagnostic HUD overlay view (`hud_diagnostic_overlay`) from `activity_native_player.xml`.
- Removed `updateDiagnosticHud()` and all associated `TextView` references from `NativePlayerActivity.java`.

---

## 💬 4. Subtitle Engine & Dedicated Subtitle API (`subtitles.php`)

### 🎯 Subtitle Sources & Priority (100% PRESERVED)
1. **Dedicated Subtitle API**: `fetchUnifiedSubtitles(anilistId, episodeNumber)` calls `https://subtitles-l8cm.onrender.com/subtitles.php?anilistId=...&ep=...`.
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
  - Real-time live preview canvas inside the caption settings modal.

---

## 📥 5. Background Download Engine (`EpisodeDownloadService.java` & `DownloadPlugin.java`)

AniLove includes a full-featured background episode downloader capable of downloading high-bitrate HLS streams for offline playback:
1. **Foreground Service**: `EpisodeDownloadService` runs as an Android Foreground Service with continuous notification progress updates (percent, speed in MB/s, downloaded/total bytes).
2. **Master Playlist Parsing**: Parses `#EXT-X-STREAM-INF` master HLS playlists to automatically select or let the user choose between **1080p**, **720p**, and **480p** variants.
3. **Range Resumption**: Supports byte-range HTTP request resumption (`Range: bytes=...`) using `.part` temporary files, allowing downloads to survive network interruptions.
4. **Offline Playback**: `DownloadPlugin.playOffline()` launches `NativePlayerActivity` in offline mode, loading local video files and local VTT subtitles directly from internal storage without requiring internet connection.
5. **Public Storage Export**: `DownloadPlugin.exportToPublicStorage()` exports downloaded episodes to `Storage/Downloads/AniLove/` with formatted titles and triggers `MediaScannerConnection` so files immediately appear in system media apps and gallery.

---

## 🧠 6. Stream Caching (`StreamCache.java`)

To ensure instant episode switches when binge-watching:
- `StreamCache.java` maintains a thread-safe `ConcurrentHashMap` mapping `anilistId_epNumber_audio` keys to pre-fetched video stream URLs and subtitle tracks.
- When an episode is playing, `triggerNextEpisodePreFetch()` quietly resolves the next episode's stream in the background.
- When the user taps "Next Episode" or auto-next triggers, the player retrieves the stream from `StreamCache` instantly with zero buffering delay!

---

## 🎮 7. Player Gestures & UI Features

- **Gesture Control**:
  - **Horizontal Swipe**: Fast-forward / rewind seek with visual time indicator overlays.
  - **Vertical Swipe (Left Half)**: Screen brightness adjustment.
  - **Vertical Swipe (Right Half)**: Media volume adjustment.
  - **Long-Press**: Instant 2.0x playback speed boost with floating speed pill indicator; releases back to standard speed upon finger lift.
- **AniSkip Integration**:
  - `fetchAniSkipIntervals(idMal, anilistId, episodeNumber)` fetches Opening (OP) and Ending (ED) timestamps from the AniSkip API.
  - **AniList GraphQL Fallback**: Resolves `idMal` automatically for all servers and episodes.
  - Renders vibrant yellow segment markers (`#FFD700`) directly onto the seekbar using custom `OpEdSeekBarDrawable`.
  - Displays "⏭️ Skip Intro" and "⏭️ Skip Ending" overlay buttons when playback reaches designated OP/ED time ranges.
- **Picture-in-Picture (PiP)**:
  - Supports Android native PiP mode (`enterPipMode()`).
  - Resets window layout bounds automatically when exiting PiP to prevent layout clipping or top-bar offsets.
- **Auto-Next Countdown**:
  - `checkAutoNextEpisodeTrigger()` detects when playback is within 120 seconds or 85% completion.
  - Displays a subtle countdown toast prompting transition to the next episode.

---

## 🛠️ 8. Maintenance Checklist for Developers

1. **Building New Streaming Resolvers**: Implement new server extractors in `src/services/streamingProviders.ts` or native extractors inside `NativePlayerActivity.java`.
2. **Preserve Subtitle Engine**: The dedicated subtitle API (`subtitles-l8cm.onrender.com/subtitles.php` & `subtitleService.ts`) handles all subtitle tracks and is completely decoupled from streaming server resolvers.
3. **Build & Sync Protocol**: Whenever modifying frontend TS or native Java code, run:
   ```cmd
   npm run build:android
   ```
   Followed by Gradle build:
   ```cmd
   gradlew assembleDebug
   ```
