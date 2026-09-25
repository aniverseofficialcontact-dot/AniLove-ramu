# AniLove Native Player & Server System — Deep Explanation & Update Log

## 🏗️ Architecture Overview
AniLove is a hybrid Capacitor app for Android. The web UI runs inside Capacitor's WebView, while the native player (`NativePlayerActivity`) runs in a separate Android Activity layered over or alongside the web UI.

### Key Components:
1. **`NativePlayerActivity.java`**: The native activity rendering the video player (ExoPlayer + WebView hybrid engine).
2. **`NativePlayerPlugin.java`**: Capacitor bridge relaying events and calls between React/TypeScript and Android Native.
3. **`ProVideoPlayer.tsx`**: Web component managing player state, scroll updates, and episode navigation.
4. **`StreamCache.java`**: In-memory thread-safe cache for pre-fetched stream URLs and subtitle tracks.
5. **`EpisodeDownloadService.java`**: Foreground service for managing background episode downloads with resume & notification controls.
6. **`VideoSniffer.java`**: Background hidden WebView engine for capturing direct `.m3u8` / `.mp4` video streams from embed servers.

---

## 🧱 The Three Playback Modes
1. **Mode 1: Portrait Floating Overlay (Hybrid Mode)**
   - Window floats as a transparent overlay over the Capacitor web page.
   - Fixed aspect ratio (16:9) placed at `yOffset` CSS pixels from top.
   - Non-modal flags (`FLAG_NOT_TOUCH_MODAL` | `FLAG_WATCH_OUTSIDE_TOUCH`) pass touch events through to web content outside player bounds.
2. **Mode 2: Fullscreen Landscape**
   - Expands to `MATCH_PARENT` x `MATCH_PARENT`.
   - Sets orientation to `SCREEN_ORIENTATION_SENSOR_LANDSCAPE`.
   - Hides system bars and utilizes display cutout (`LAYOUT_IN_DISPLAY_CUTOUT_MODE_SHORT_EDGES`).
3. **Mode 3: Offline Download Playback**
   - Full activity using Media3 ExoPlayer for local `.mp4` files and local `.vtt` subtitles.

---

## ⚙️ Hybrid Engine Architecture
- **Direct HLS Streams (`.m3u8`)**: Loaded into WebView using `hls.js` with an inline HTML5 video container.
- **Embed Players (AbyssPlayer, PirateXPlay, IQSmart, VidLink, etc.)**: Wrapped in an iframe and loaded via `loadDataWithBaseURL("https://piratexplay.cc/", iframeHtml, "text/html", "UTF-8", null)` to bypass anti-embed origin checks.
- **AdEraser JS (`injectAdEraser`)**: Injected into all frames every second to strip ad overlays, block popups (`window.open = null`), inject custom controls CSS, and report state back to Java via `AndroidScrubber`.

---

## 🛠️ Detailed Log of Recent Updates & Features

### 1. Fix Video Freezing / Stalling After 1 Minute
#### **Problem Identified**:
- Episodes were freezing on a single video frame after approximately 1 minute of playback (no buffering indicator, no black screen, stream stuck at an instant).
- **Root Cause Analysis**:
  1. **Continuous Play Trigger & Click Loop**: `injectAdEraser()` was executing every 1 second via `syncPlayerState()` and querying play buttons (`.art-icon-play`, `.jw-display-icon-container`, `#playback`, etc.) and invoking `.click()` and `.play()` unconditionally. When the HTML5 video element was buffering new segment chunks at the 1-minute mark, these repeated click and `.play()` calls interrupted Chrome's internal media pipeline, causing video decoding to lock up.
  2. **Ad-Block Filter Over-Blocking Media Resources**: `shouldInterceptRequest` was returning blank responses for URLs matching patterns like `openfpcdn.io` or containing `/ads/`, which some stream providers use to serve video segment chunks (`.ts` / `.m4s`).
  3. **HLS.js Web Worker & Error Recovery Missing**: In direct HLS mode, `enableWorker: true` in `hls.js` was subject to Web Worker CORS/XHR throttling in WebView. Furthermore, `hls.js` lacked an `Hls.Events.ERROR` handler to automatically recover from media and network stalls.
  4. **OS Power Manager CPU Throttling**: The native window lacked `FLAG_KEEP_SCREEN_ON`, allowing Android OS to throttle CPU/GPU/WebView decoding after 1 minute of touch inactivity.

#### **Technical Changes Applied**:
1. **Screen Keep-Alive Flag**:
   - Added `window.addFlags(WindowManager.LayoutParams.FLAG_KEEP_SCREEN_ON);` in `applyWindowSettings()` in `NativePlayerActivity.java`.
2. **Conditional Play Auto-Trigger in `injectAdEraser()`**:
   - Added `var isVideoActive = v && (v.currentTime > 0 || !v.paused);`.
   - Prevented clicking play buttons or invoking forced `.play()` loops whenever `isVideoActive` is true. Auto-start and play button clicks now only execute if `v.currentTime === 0` and the video is initially paused.
3. **Enhanced HLS.js Configuration & Fatal Error Recovery**:
   - Disabled workers (`enableWorker: false`) in `hlsHtml` so segment fetching executes reliably on the main thread.
   - Configured buffer parameters: `maxBufferLength: 60`, `maxMaxBufferLength: 120`, `maxBufferSize: 60 * 1000 * 1000`.
   - Added `Hls.Events.ERROR` listener with `hls.startLoad()` for network errors and `hls.recoverMediaError()` for media errors.
4. **Ad-Block Filter Bypass for Media Segment Resources**:
   - Updated `shouldInterceptRequest` in `NativePlayerActivity.java` to explicitly exempt `.m3u8`, `.ts`, `.m4s`, `.mp4`, `.key`, `.vtt`, and `.srt` resources from ad-blocking rules.

---

### 2. Auto Picture-in-Picture (PiP) on Home Gesture (Android 12+ & Android 8+)
- **Implementation**:
  - Configured `PictureInPictureParams.Builder.setAutoEnterEnabled(isPlaying)` on Android 12+ (API 31+).
  - Overrode `onUserLeaveHint()` in `NativePlayerActivity.java` so that when a user performs the gesture to return home while video is playing, the activity seamlessly transitions into Picture-in-Picture mode on all supported Android versions.

---

### 3. Next-Episode Stream Pre-Fetching
- **Implementation**:
  - Integrated automatic pre-fetching in `NativePlayerActivity.java` when video progress reaches **80%** completion (`current >= duration * 0.8`).
  - Executes a background asynchronous request via `Executors.newSingleThreadExecutor()` to query the AnimeWorld India API for Episode $N+1$.
  - Stores the resolved stream URL in `StreamCache.put(anilistId, nextEp, audio, streamUrl)`.
  - When tapping "Next Episode", the stream URL is retrieved instantly from `StreamCache`, eliminating API latency between episodes.

---

### 4. Animated Gesture Feedback Overlays & Modern UI Indicators
- **Implementation**:
  - Updated layout elements in `activity_native_player.xml` with `@drawable/indicator_pill_bg` (semi-transparent dark rounded pill containers with a subtle white border).
  - Animated seek badges (`◄◄ 10s` / `10s ►►`), long-press speed badge (`2.0x SPEED ⏩`), volume pill (`🔊 80%`), and brightness pill (`☀️ 60%`).
  - Added spring-like alpha and scale animations (`scaleX` / `scaleY` 0.7 -> 1.05 -> 1.0 -> fade out) in `NativePlayerActivity.java` for polished visual feedback during double-tap seeking and vertical drags.

---

### 5. Enhanced Native Download Manager Notifications & Resume
- **Implementation**:
  - Added `Pause`, `Resume`, and `Cancel` `PendingIntent` action buttons directly to the active foreground notification in `EpisodeDownloadService.java`.
  - Enabled direct control of background downloads from the Android notification shade and lockscreen.
  - Retained `Range: bytes=existingLength-` HTTP headers for byte-accurate download resuming.

---

### 6. Comprehensive Download System Overhaul & Server Unpacking Fix
- **Problem Identified**:
  - Batch downloads were failing completely because:
    1. Server selection in `BatchDownloadModal.tsx` displayed outdated provider names rather than the active API servers (**Server 1**, **Server 2**, **Server 3**).
    2. `tryServerSideExtractFull` in `EpisodeDownloadService.java` passed `id=slug` instead of numeric `anilistId` and `ep` query parameters to the stream API.
    3. Server 2 returns base64 `multi.php?data=` payloads containing multi-language streams, and Server 3 returns `index11.php?id=` URLs. `EpisodeDownloadService` was failing to decode these URLs in Java for the specified audio language.
    4. `VideoSniffer` loaded embed pages directly via `loadUrl` without iframe origin context (`loadDataWithBaseURL`), causing embed anti-fraud scripts (AbyssPlayer / Rubystm / IQSmart) to halt playback and time out after 35 seconds.
- **Technical Changes Applied**:
  1. **UI Server & Quality Selectors**: Updated `BatchDownloadModal.tsx` and `downloadManager.ts` to present **Server 1 (Fast HLS)**, **Server 2 (AbyssPlayer / Multi-Audio)**, **Server 3 (IQSmart / Embed)**, and a **Video Quality Selector** (`1080p Full HD`, `720p HD`, `480p SD`).
  2. **API Parameter & Unpacking Fix**: Fixed `tryServerSideExtractFull` in `EpisodeDownloadService.java` to query `stream.php?anilistId=<id>&ep=<ep>&ongoing=true`. Added `unpackServerUrlInJava` to parse base64 `multi.php` payload for the selected audio language (`HIN`, `DUB`, `SUB`, `TAM`, `TEL`, `MAL`, `KAN`, `BEN`).
  3. **Iframe Sniffing Engine**: Updated `VideoSniffer.java` to wrap embed URLs in an iframe container and load via `loadDataWithBaseURL("https://piratexplay.cc/", iframeHtml, ...)`. This satisfies anti-embed origin checks, causing embed players to initialize instantly and yield the underlying `.m3u8` or `.mp4` video stream URL in under 2 seconds.
  4. **Quality & Subtitle Extraction**:
     - Parsed `#EXT-X-STREAM-INF` variants in `downloadHlsStream` to download the exact stream variant matching the selected quality (`1080p`, `720p`, `480p`).
     - Extracted `#EXT-X-MEDIA:TYPE=SUBTITLES` and intercepted `.vtt` / `.srt` URLs in `VideoSniffer.java` to download subtitle tracks (`ep_X.vtt`) automatically alongside video files.
  5. **Resilient Download Execution**: Added a 3-retry loop for fetching `.ts` HLS segments in `EpisodeDownloadService.java` so temporary network drops do not interrupt downloads.
