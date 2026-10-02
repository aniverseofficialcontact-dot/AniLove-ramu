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

### 🧂 Server 3 Integration (AnimeSalt API)
- **API Endpoint**: `https://animesalt-api-omega.vercel.app/api/stream?id=$animeSlug&ep=ep-$episodeNumber`
- **Embed URL Sniffing**: Queries `data.embedUrl` from AnimeSalt API and passes it to `VideoSniffer.java`.
- **Iframe Wrapper**: Embed URLs from AnimeSalt (such as `abyssplayer.com` or `megaplay.buzz`) are loaded inside an `<iframe>` HTML wrapper with `loadDataWithBaseURL("https://animesalt.me/", iframeHtml, "text/html", "UTF-8", null)`.
- **ExoPlayer Header Authorization**: Captures the `.m3u8` master playlist and passes `Referer: https://animesalt.me/` and desktop/mobile User-Agent to ExoPlayer's `DefaultHttpDataSource.Factory`.
- **RAM Optimization**: As soon as the `.m3u8` stream URL is captured, `VideoSniffer.cleanup()` immediately stops, clears (`about:blank`), and destroys (`destroy()`) the background WebView to free mobile RAM!

### 🌐 Dual Player Engine & Standalone Engine Switch Button
`NativePlayerActivity.java` includes a 1-click **Dual Player Engine**:
1. **Media3 ExoPlayer Mode (Default - `⚡ EXO`)**: Hardware-accelerated 1080p native playback with gesture overlays, yellow OP/ED seekbar indicators, volume boost, and native caption customization.
2. **Embedded Web Player Mode (`🌐 WEB`)**: Interactive embedded `<WebView>` player (`#player_webview`) loading target embed pages (`abyssplayer.com`, `animesalt.me`, `blakiteapi.xyz`, `vidmoly.biz`, etc.) directly inside an iframe container.
3. **Standalone Floating Engine Button (`btn_engine_toggle`)**:
   - `btn_engine_toggle` is placed as a standalone floating overlay button (`elevation="25dp"`, `translationZ="25dp"`) at the top right of the video frame.
   - Remains **ALWAYS VISIBLE and CLICKABLE** in both ExoPlayer mode (`⚡ EXO`) and Web View mode (`🌐 WEB`), even when player controls auto-hide or when touching the Web View!
4. **✂️ Surgical Control Eraser Engine (Option A Injection Engine)**:
   - Injects a recursive 250ms CSS and JS DOM eraser into `playerWebView` across all top-level documents and nested child `<iframe>`s.
   - **Completely hides and erases**:
     - HTML Fullscreen buttons (`.jw-icon-fullscreen`, `.art-icon-fullscreen`, `.vjs-fullscreen-control`, etc.)
     - Quality / HD selector menus (`.jw-icon-settings`, `.art-icon-setting`, `.vjs-quality-selector`, etc.)
     - Subtitle CC & Captions buttons (`.jw-icon-cc`, `.art-icon-subtitle`, `.v-cc`, etc.)
     - Download buttons / links (`a[href*="download"]`, `.download-btn`, `.btn-download`, etc.)
     - Picture-in-Picture (`PiP`) buttons (`.v-pip`, `.art-icon-pip`, `.jw-icon-pip`, etc.)
     - Forward `+10s` / Rewind `-10s` skip icons (`.art-control-jump`, `.blakite-skip`, `[class*="-10"]`, etc.)
     - Bottom-left Play/Pause and Volume buttons (`.art-control-play`, `.art-control-volume`, etc.)
     - Internal seekbar tracks and duration displays (`.art-control-progress`, `.art-control-time`, `.jw-text-elapsed`, etc.)
5. **👆 Web View Gesture Control Engine**:
   - **Double-Tap Seeking**: Left side double-taps rewind 10s (`◄◄ 10s`), right side double-taps forward 10s (`10s ►►`).
   - **2.0x Hold Speed Boost**: Long-pressing on Web View sets `video.playbackRate = 2.0` across all frames with `2.0x SPEED ⏩` floating pill.
   - **Anti-Context-Menu**: Capture-phase event listener blocks JWPlayer / ArtPlayer right-click context menus.
6. **⚡ Web View Real-Time `timeupdate` Event Binding**:
   - Binds HTML5 `<video>` `timeupdate` events across all child frames to `@JavascriptInterface` `AndroidBridge.onStateUpdate(c, d, paused)`.
   - Sends real-time progress to Java with 0ms latency, updating `currentVideoTime`, `videoDuration`, and syncing native controls and AniSkip buttons.
7. **Dual Audio Elimination**:
   - `VideoSniffer.java` sets `setMediaPlaybackRequiresUserGesture(true)` and injects `injectMuteScript()` on page start/finish to mute all background `<video>` and `<audio>` elements while sniffing.
   - `setupExoPlayerOnlineDirect()` and `switchPlayerEngine()` explicitly invoke `VideoSniffer.cancelActiveSniffers()` before starting playback, guaranteeing zero background audio overlap.
8. **Heavyweight Native Ad-Blocker**: When in Web Player Mode, `NativePlayerActivity` applies strict native ad-blocking:
   - Blocks popup windows in `WebChromeClient.onCreateWindow()`.
   - Intercepts and blocks ad network domains (`AD_DOMAINS` blacklist) in `shouldInterceptRequest()`.
   - Cancels external ad redirects, YouTube redirects, and download redirects in `shouldOverrideUrlLoading()`.
   - Injects JavaScript ad eraser (`window.open = function() { return null; }`) in `onPageStarted()` and `onPageFinished()` to remove pop-up triggers and overlay ad banners.
9. **Auto-Fallback**: If ExoPlayer encounters an unrecoverable source / CORS error, `NativePlayerActivity` automatically falls back to Embedded Web Player Mode so the video plays without interruption.

### 🌐 Dual Side-by-Side SOURCES & SERVERS Dropdowns (`WatchView.tsx`)
In `WatchView.tsx`, the player UI features a side-by-side **SOURCES** selector placed directly beside the **SERVERS** selector:

```
┌───────────────────────────┐    ┌───────────────────────────┐
│ SOURCES  [AnimeDekho  ▼]  │    │ SERVERS  [Server 1    ▼]  │
└───────────────────────────┘    └───────────────────────────┘
```

#### 📺 1. Sources Available:
4. **`MovieBox`**: Uses MovieBox Render API (`/api/stream-by-name?title=...&se=...&ep=...`) with CDN `Referer: https://netfilm.world/` header authorization.

#### 🏷️ 2. Filtered Server Naming & Mapping:
When a Source is chosen, the **SERVERS** dropdown displays **only** the servers available for that Source, simplified into clean, user-friendly labels (**`Server 1`**, **`Server 2`**, **`Server 3`**, **`Server 4`**...):

| Active Source | Display Name in SERVERS Dropdown | Internal Server Code | Description / Backend Endpoint |
| :--- | :--- | :--- | :--- |
| **`AnimeDekho`** | **`Server 1`** | `AnimeDekho-Server-1` | Multi-audio proxy (`piratexplay.cc`) providing Hindi, Tamil, Telugu, English & Japanese audio links unpacked into `abyssplayer.com`. |
| **`AnimeDekho`** | **`Server 2`** | `AnimeDekho-Server-2` | Direct API embed stream server (`blakiteapi.xyz`). |
| **`AnimeDekho`** | **`Server 3`** | `AnimeDekho-Server-3` | High-performance Abyss Player server (`abyssplayer.com`). |
| **`AnimeDekho`** | **`Server 4`** | `AnimeDekho-Server-4` | Ultra-reliable HLS video stream server (`vidmoly.biz`). |
| **`HiAnime`** | **`Server 1`** | `HiAnime-Server-1` | HiAnime VidNest stream (`vidnest.fun/anime/{id}/{ep}/sub` or `/dub` based on audio language). |
| **`HiAnime`** | **`Server 2`** | `HiAnime-Server-2` | HiAnime TryEmbed stream (`tryembed.us.cc/embed/anime/{id}/{ep}/sub` or `/dub` based on audio language). |
| **`HiAnime`** | **`Server 3`** | `HiAnime-Server-3` | HiAnime AnimePahe stream (`vidnest.fun/animepahe/{id}/{ep}/sub` or `/dub` based on audio language). |
| **`AnimeSalt`** | **`Server 1`** | `AnimeSalt-Server-1` | AnimeSalt API stream (`animesalt-api-omega.vercel.app`). |
| **`MovieBox`** | **`Server 1`** | `MovieBox-Server-1` | MovieBox Render API stream (`moviebox-api-mklm.onrender.com`) with `Referer: https://netfilm.world/`. |

#### 🗣️ Dynamic HiAnime SUB / DUB Link Triggering & Instant Source Routing:
1. **Clean 3-Server List**: Instead of cluttering the UI with 6 separate SUB/DUB links, HiAnime displays **3 clean servers** (`Server 1`, `Server 2`, `Server 3`).
2. **Dynamic URL Construction**: Each server dynamically constructs and triggers its `/sub` or `/dub` URL endpoint based on the selected Audio Language:
   - When **Japanese (SUB)** is selected: `HiAnime-Server-1` -> `https://vidnest.fun/anime/{id}/{ep}/sub`
   - When **English (DUB)** is selected: `HiAnime-Server-1` -> `https://vidnest.fun/anime/{id}/{ep}/dub`
   - Switching language in Native Player or WatchView automatically triggers the corresponding SUB or DUB endpoint!
3. **Single Unified Native Stream Pipeline**: Consolidated server switching in `WatchView.tsx` and `ProVideoPlayer.tsx` into a single, non-overlapping stream resolution pipeline. This completely eliminates duplicate parallel `NativePlayer.play()` calls and intent overwrites when toggling sources or servers.
4. **Clean Title Sanitization for MovieBox API**: `fetchMovieBoxStream()` strips season subtitles and parenthetical notes (`cleanTitleForMovieBox`) to ensure high match accuracy on `https://moviebox-api-mklm.onrender.com`. If MovieBox stream data is unavailable for a specific title/episode, it returns a clean error status rather than passing a JSON string to ExoPlayer.
4. **Enhanced Diagnostic HUD**: Diagnostic overlay displays **`TARGET`** (requested embed/api URL) alongside **`PLAYING`** (resolved media URL) and `REFERER` headers for full real-time stream transparency.
4. **Native Route Extractor & Engine Toggle Unblock**:
   - Updated `attemptServer2DirectExtract()` in `NativePlayerActivity.java` with regex pattern `(embed/anime|anime|animepahe|v|e)/([a-zA-Z0-9_.-]+)/(\\d+)/(sub|dub)` to match both numeric IDs and alphanumeric slugs, enabling instant direct extraction for HiAnime/TryEmbed streams.
   - Repositioned `btn_engine_toggle` (`⚡ EXO` / `🌐 WEB`) in `activity_native_player.xml` to `top|center_horizontal`, completely unblocking the top-right settings gear icon (`btn_settings`).

### 🛡️ WebView Ad-Blocker & Sniffer Filter Optimization Engine
To eliminate infinite buffering, Cloudflare challenge lockups, and web player JS exceptions while keeping ads, popups, and fullscreens hidden:
1. **Non-Destructive CSS Ad Eraser (`NativePlayerActivity.java`)**:
   - Replaced destructive JavaScript DOM node removal (`el.remove()`) with pure CSS rules (`display: none !important; opacity: 0 !important; visibility: hidden !important; pointer-events: none !important;`) injected into `<style id="anilove_style">`.
   - **Unblocked 10sec +/- Seek Buttons**: Removed all CSS rules targeting +/-10s rewind and forward skip buttons (`.jw-icon-rewind`, `.art-control-jump`, `[class*="-10"]`, etc.) so internal player 10sec seek controls remain functional, while maintaining 100% ad, popup, and redirect blocking (`.ad-container`, `.popunder`, `win.open = null`).
   - **Why**: Removing DOM nodes destroyed internal state objects in web player frameworks (JWPlayer, ArtPlayer, Video.js), throwing unhandled JS `TypeError`s that caused infinite buffering or player crashes. CSS hiding keeps nodes intact so player scripts run smoothly while remaining completely hidden and non-interactive.
   - **Interval Optimization**: Optimized the injection loop from 250ms to 1000ms, drastically reducing CPU thrashing in WebView.
2. **Cloudflare Turnstile & Challenge Protection Exemption**:
   - Removed `turnstile` and `challenge-platform` from the ad blacklist in `isAdUrl()`.
   - Allows Cloudflare Turnstile human verification and security challenges to pass cleanly on embed domains (`abyssplayer`, `vidnest`, `tryembed`, `blakiteapi`, `vidmoly`, `piratexplay`, `rubystm`), preventing HTTP 403 / 503 errors and infinite loading.
3. **Smart Stream Path Exemption (`VideoSniffer.java`)**:
   - Prioritizes direct media URLs (`.m3u8`, `.mp4`, `.mpd`, `manifest.m3u8`, `master.m3u8`) over generic resource rules.
   - Removed false-positive blacklists (`/track`, `/events`, `/log`, `/stats`, `.php`, `.json`) that previously caused VideoSniffer to ignore valid HLS playlist URLs containing track identifiers or dynamic PHP/JSON endpoints.
4. **Strict YouTube & Top-Level Redirect Cancellation**:
   - `shouldOverrideUrlLoading()` strictly intercepts and cancels (`return true`) any navigation attempt to YouTube (`youtube.com`, `youtu.be`, `ytimg.com`), external app schemes (`intent://`, `market://`, `itmss://`, `whatsapp://`, `tg://`), or top-level domain redirects away from the original embed server host (`originalHost`).
   - Prevents embed players from navigating `playerWebView` away to YouTube or ad pages during playback.
5. **Touch Interception & App Freezing Fix (`activity_native_player.xml`)**:
   - Removed an obsolete `<TabHost>` element that spanned `match_parent` height across the screen.
   - Set `portrait_bottom_container` to `android:visibility="gone"` during portrait streaming mode so `NativePlayerActivity` bounds strictly fit the top video frame and do NOT block touch events on the React UI underneath.

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
  - `fetchAniSkipIntervals(idMal, anilistId, episodeNumber)` fetches Opening (OP) and Ending (ED) timestamps from the AniSkip API.
  - **AniList GraphQL Fallback**: If `idMal` is not provided directly, it queries AniList GraphQL API (`query ($id: Int) { Media (id: $id) { idMal } }`) to resolve `idMal` automatically for all servers and episodes!
  - Renders vibrant yellow segment markers (`#FFD700`) directly onto the seekbar using custom `OpEdSeekBarDrawable`.
  - Displays "⏭️ Skip Intro" and "⏭️ Skip Ending" overlay buttons when playback reaches designated OP/ED time ranges.
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
