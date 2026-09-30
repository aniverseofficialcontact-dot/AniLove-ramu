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
| `NativePlayerActivity.java` | Native Android | Primary activity hosting 100% Native Media3 ExoPlayer engine (`PlayerView`), `.m4s` segment chunk filtering, real-time TrackSelectionParameters for video resolution and audio language changing, dedicated Subtitle API (`subtitles.php`) parser, dual-audio prevention via VideoSniffer lifecycle cleanup, shared-element landscape transitions, auto-next countdown toast, gesture overlays, floating layout, PiP mode, AniSkip skip buttons, yellow seekbar OP/ED indicators, independent subtitle overlay, and caption controls. |
| `VideoSniffer.java` | Native Utilities | Background headless WebView sniffer intercepting XHR/Fetch/DOM streams with static instance tracking (`cancelActiveSniffers()`), dynamic base URL matching (`tryembed.us.cc`, `vidnest.fun`), and `.m4s` chunk filtering to extract direct `.m3u8` master video playlists and `.vtt` subtitles. |
| `subtitleService.ts` | Subtitle Pipeline | Dedicated Subtitle API fetching (`subtitles-l8cm.onrender.com/subtitles.php`), 3-day local caching, provider anonymization, priority sorting, and pre-download batch validation. |
| `NativePlayerPlugin.java` | Capacitor Bridge | Exposes native player controls (`play`, `pause`, `seek`, `updatePosition`, `notifyLanguageChange`) to React. |
| `EpisodeDownloadService.java` | Foreground Service | Handles multi-threaded background episode downloads, `#EXT-X-STREAM-INF` master playlist resolution parsing for 1080p / 720p / 480p quality selection, notification actions (Pause/Resume/Cancel), and byte-range HTTP resumption. |
| `DownloadPlugin.java` | Capacitor Bridge | Manages download state JS bindings and handles public storage exports (`Storage/Downloads/AniLove/`). |
| `streamingProviders.ts` | Server Resolvers | 2-tier server resolver architecture (Tier 1 client generators + Tier 2 API fallbacks) with dynamic HLS quality resolution probing. |
| `WatchView.tsx` | Web Component | Manages playback UI state, server selectors, audio toggles, episode switching, expandable server dropdown, and player position sync. |
| `StreamCache.java` | Native Utilities | Thread-safe memory cache storing pre-fetched stream URLs and subtitle tracks for instant zero-latency episode transitions. |

---

## ⚡ 2. 100% Pure Native Media3 ExoPlayer Engine & Server 2-A / 2-B Fixes

### Black Screen Fix (Server 2-A VidNest)
- **Segment Chunk Filtering (`.m4s` / `.ts`)**: Previously, VideoSniffer captured 2-second `.m4s` / `.ts` audio segment fragments, causing ExoPlayer to load an audio-only track with a black screen. `.m4s` and `.ts` chunk files are now strictly filtered out in both `VideoSniffer.java` and `NativePlayerActivity.java`, forcing VideoSniffer to wait for the real `.m3u8` master playlist (which contains full 1080p video + multi-audio tracks).

### Embed Sniffing & Base URL Resolution (Server 2-B TryEmbed)
- **Host Base URL Matching**: Added `tryembed.us.cc` (`https://tryembed.us.cc/`) and `vidnest.fun` (`https://vidnest.fun/`) to `VideoSniffer` iframe base URL resolution and HTTP headers (`Referer` & `Origin`), ensuring same-origin security policies pass smoothly and direct `.m3u8` playlists and `.vtt` subtitles are sniffed successfully.

---

## 💬 3. Dedicated Subtitle API Integration (`subtitles.php`)

- **Dedicated API Priority**: `fetchUnifiedSubtitlesJava(anilistId, episodeNumber)` queries `https://subtitles-l8cm.onrender.com/subtitles.php?anilistId=...&ep=...`.
- **Protected Subtitle Track**: VideoSniffer is explicitly prevented from overwriting `subtitleUrl` if a track from the dedicated Subtitle API is already loaded.
- **VTT/SRT Cue Reset (`downloadAndParseVttFile`)**: `parsedVttCues.clear()` is called immediately before downloading new `.vtt` / `.srt` files to ensure stale cues from previous episodes or servers do not persist.

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

### Mode 3: Offline Download Playback
- Uses **AndroidX Media3 ExoPlayer** to render downloaded `.mp4` video files alongside local `.vtt` / `.srt` subtitle files.

---

## 🛠️ 5. Maintenance Checklist for Developers

1. **Segment Chunk Filtering**: Never allow 2-second `.m4s` or `.ts` chunks to be captured as video URLs in `VideoSniffer`. VideoSniffer must always capture master or variant `.m3u8` playlists or complete `.mp4` files.
2. **Server Base URLs**: Ensure any new embed provider domain is registered in `VideoSniffer.sniff()` and `getBestRefererForUrl()` so same-origin iframe security policies pass without HTTP 403 errors.
