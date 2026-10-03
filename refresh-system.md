# AniLove Hybrid Native Player & Refresh System Manual

> **Purpose**: This technical manual explains the end-to-end architecture of the **Stream Resolution, Automatic Refresh, Subtitle Pipeline, and Hybrid Native Player** in the AniLove Android application. Keep this manual safe for future developers or AI agents if streaming or episode transitions ever need maintenance.

---

## 1. High-Level Architecture Overview

AniLove uses a **Hybrid Dual-Engine Architecture** where the main web application runs inside Capacitor's `MainActivity` (WebView), while video playback is rendered by a native Android `Activity` (`NativePlayerActivity`) using **AndroidX Media3 ExoPlayer**.

```
┌─────────────────────────────────────────────────────────────────────────────────────────────┐
│                                 1. Web Layer (React / TypeScript)                           │
│  [WatchView.tsx] ──(Select Episode)──> [ProVideoPlayer.tsx] ──(API Call)──> [streamingProviders.ts]
└──────────────────────────────────────────────┬──────────────────────────────────────────────┘
                                               │ Resolves Stream Source
                                               ▼
┌─────────────────────────────────────────────────────────────────────────────────────────────┐
│                             2. Direct Native Launch Trigger                                  │
│  [ProVideoPlayer.tsx] ──(triggerNativePlayerLaunch)──> Synchronously triggers NativePlayer.play
└──────────────────────────────────────────────┬──────────────────────────────────────────────┘
                                               │ Capacitor IPC Bridge (Capacitor.isNativePlatform())
                                               ▼
┌─────────────────────────────────────────────────────────────────────────────────────────────┐
│                            3. Native Android Layer (Java & Media3)                           │
│  [NativePlayerPlugin.java] ──(Intent: singleTop)──> [NativePlayerActivity.java]             │
│                                                          │                                  │
│                                  Reuses ExoPlayer & sets MediaSource with                   │
│                                  unique MediaID (hlsUrl + "_" + timestamp)                  │
└─────────────────────────────────────────────────────────────────────────────────────────────┘
```

---

## 2. Key Component Responsibilities & File Paths

| File Path | Role & Key Responsibilities |
| :--- | :--- |
| **[`src/components/WatchView.tsx`](file:///C:/Users/sanya/StudioProjects/AniLove2/src/components/WatchView.tsx)** | Manages episode state (`episodeNumber`), source selection (`selectedSource`), server selection (`selectedSubServer`), and the **REFRESH** trigger (`refreshKey`). |
| **[`src/components/ProVideoPlayer.tsx`](file:///C:/Users/sanya/StudioProjects/AniLove2/src/components/ProVideoPlayer.tsx)** | Handles stream resolution, manages local component cache (`episodeCacheKey`, `serverUrlCache`), and directly invokes `triggerNativePlayerLaunch(...)` when stream URLs resolve. |
| **[`src/services/streamingProviders.ts`](file:///C:/Users/sanya/StudioProjects/AniLove2/src/services/streamingProviders.ts)** | Resolves stream URLs across providers (`Multi-Lang` MovieBox API, `AnimeDekho`, `HiAnime`, `AnimeSalt`). Handles 20-minute local caching (`setToCache` / `getFromCache`). |
| **[`src/services/subtitleService.ts`](file:///C:/Users/sanya/StudioProjects/AniLove2/src/services/subtitleService.ts)** | Synchronous local subtitle cache reader (`getCachedSubtitles`) and background WebVTT subtitle fetcher (`fetchUnifiedSubtitles`). |
| **[`android/app/src/main/java/com/anilove/app/NativePlayerPlugin.java`](file:///C:/Users/sanya/StudioProjects/AniLove2/android/app/src/main/java/com/anilove/app/NativePlayerPlugin.java)** | Capacitor IPC Bridge that receives `NativePlayer.play(...)` calls from JS and sends `Intent` with `FLAG_ACTIVITY_REORDER_TO_FRONT \| FLAG_ACTIVITY_SINGLE_TOP`. |
| **[`android/app/src/main/java/com/anilove/app/NativePlayerActivity.java`](file:///C:/Users/sanya/StudioProjects/AniLove2/android/app/src/main/java/com/anilove/app/NativePlayerActivity.java)** | Floating Native Player running Media3 ExoPlayer. Receives intents via `onNewIntent`, clears previous stream items, sets `MediaSource` with unique timestamped `mediaId`, and fetches subtitles asynchronously in Java (`fetchUnifiedSubtitlesJava`). |

---

## 3. How Episode Switching & Automatic Refreshing Work

### Step 1: Episode Selection & Refresh State Trigger
When a user taps an episode card or clicks Next/Prev Episode in [`WatchView.tsx`](file:///C:/Users/sanya/StudioProjects/AniLove2/src/components/WatchView.tsx):
1. `onEpisodeChange(epNumber)` updates the active `episodeNumber` prop.
2. `WatchView.tsx` runs an `useEffect` watching `[episodeNumber]`:
   ```tsx
   const [refreshKey, setRefreshKey] = useState<number>(0);

   const handleRefreshPlayer = () => {
     setRefreshKey(prev => prev + 1);
     const firstServer = SOURCE_CONFIG[selectedSource]?.servers[0];
     if (firstServer) {
       setSelectedServerDisplay(firstServer.displayName);
       setSelectedSubServer(firstServer.displayName);
     }
   };

   // Automatically trigger handleRefreshPlayer whenever episodeNumber changes
   useEffect(() => {
     handleRefreshPlayer();
   }, [episodeNumber]);
   ```
3. This increments `refreshKey` and passes `refreshTrigger={refreshKey}` to [`ProVideoPlayer.tsx`](file:///C:/Users/sanya/StudioProjects/AniLove2/src/components/ProVideoPlayer.tsx).

### Step 2: Cache Purging & Direct Stream Resolution
When [`ProVideoPlayer.tsx`](file:///C:/Users/sanya/StudioProjects/AniLove2/src/components/ProVideoPlayer.tsx) receives updated `episodeNumber` or `refreshTrigger`:
1. It immediately purges stale component-level caches:
   ```tsx
   if (episodeCacheKey.current !== cacheKey) {
     episodeCacheKey.current = '';
     serverUrlCache.current = {};
     baseSourceRef.current = null;
   }
   ```
2. It invokes `resolveEpisodeSource(...)` in [`streamingProviders.ts`](file:///C:/Users/sanya/StudioProjects/AniLove2/src/services/streamingProviders.ts).

### Step 3: MovieBox / Multi-Lang API Stream Resolution
For `Multi-Lang` (MovieBox API), [`resolveMultiLangSource`](file:///C:/Users/sanya/StudioProjects/AniLove2/src/services/streamingProviders.ts) checks local 20-minute cache (`MultiLang_{cleanTitle}_s{season}_ep{episode}`).
- If cached: Returns stream URL instantly (0ms).
- If not cached: Calls `https://moviebox-api-mklm.onrender.com/api/stream-all-languages?title={title}&se=1&ep={ep}`, parses all audio tracks (English, Japanese, Hindi, French, etc.) and qualities (1080p, 720p, 480p, 360p), stores in local cache, and returns the selected MP4 stream URL.

### Step 4: Direct Launch Activation (Zero-Delay Execution)
The moment `resolveEpisodeSource` completes inside `.then(result => { ... })`:
```tsx
.then(result => {
  if (result.status === 'available' && result.source) {
    baseSourceRef.current = result.source;
    setStreamSource(result.source);
    setResolvedEp(episodeNumber);
    setStreamStatus('ready');
    
    // DIRECT ACTIVATION: Launch NativePlayer IMMEDIATELY upon stream resolution
    triggerNativePlayerLaunch(result.source, episodeNumber);
  }
});
```
This bypasses React's asynchronous `useEffect` re-rendering queue, ensuring `NativePlayer.play(...)` is invoked **in the exact same millisecond** the stream URL is received.

### Step 5: Native ExoPlayer Instance Reuse on Android
When `NativePlayer.play(...)` reaches [`NativePlayerActivity.java`](file:///C:/Users/sanya/StudioProjects/AniLove2/android/app/src/main/java/com/anilove/app/NativePlayerActivity.java) via `onNewIntent(Intent intent)`:
1. `cleanupPlaybackEngines()` stops old playback without destroying the ExoPlayer instance:
   ```java
   if (exoPlayer != null) {
       exoPlayer.stop();
       exoPlayer.clearMediaItems();
   }
   ```
2. To prevent Progressive MP4 media period caching collisions on direct `.mp4` URLs (e.g. `bcdnxw.hakunaymatata.com`), a **unique timestamped `mediaId`** is assigned to the `MediaItem`:
   ```java
   MediaItem.Builder mediaBuilder = new MediaItem.Builder()
           .setUri(Uri.parse(hlsUrl))
           .setMediaId(hlsUrl + "_" + System.currentTimeMillis());
   ```
3. The player updates its MediaSource with forced position reset:
   ```java
   exoPlayer.setMediaSource(mediaSource, true);
   exoPlayer.prepare();
   exoPlayer.setPlayWhenReady(true);
   ```
4. Episode playback begins immediately in ~100ms.

---

## 4. Non-Blocking Subtitle Architecture

1. **Synchronous Local Read**: `triggerNativePlayerLaunch` checks `getCachedSubtitles(anime.id, currentEp)` from `localStorage` (0ms read). If cached, subtitle tracks are formatted into `subtitleUrl` and `allSubtitles` JSON payload.
2. **Immediate Player Launch**: `NativePlayer.play(...)` executes immediately (never blocked by HTTP subtitle API timeouts).
3. **Native Asynchronous Fetching**: In [`NativePlayerActivity.java`](file:///C:/Users/sanya/StudioProjects/AniLove2/android/app/src/main/java/com/anilove/app/NativePlayerActivity.java), `updateMetadataFromIntent(intent)` invokes `fetchUnifiedSubtitlesJava(anilistId, epNum)`. Native Java fetches `subtitles.php` in a background thread, downloads the `.vtt` file, parses WebVTT cues, and renders subtitles directly on the native overlay text view.

---

## 5. Troubleshooting Cheat Sheet for Future Reference

| Symptom | Primary Cause | Fix / Verification |
| :--- | :--- | :--- |
| **Video does not change on episode tap** | Stale fast-path cache or missing `refreshTrigger` notification. | Verify `handleRefreshPlayer()` is called in `useEffect([episodeNumber])` in `WatchView.tsx` and `episodeCacheKey.current = ''` is reset in `ProVideoPlayer.tsx`. |
| **Old episode video keeps playing** | ExoPlayer reusing old `MediaPeriod` due to non-unique `MediaItem` ID. | Verify `MediaItem.Builder.setMediaId(hlsUrl + "_" + System.currentTimeMillis())` and `exoPlayer.setMediaSource(mediaSource, true)` in `NativePlayerActivity.java`. |
| **Subtitles not appearing on screen** | `subtitleUrl` is empty and native Java fetcher was not triggered. | Verify `fetchUnifiedSubtitlesJava(anilistId, epNum)` is called inside `updateMetadataFromIntent(intent)` in `NativePlayerActivity.java`. |
| **JavaScript crash `ReferenceError`** | Unused ref variable referenced in code. | Run `npm run build:android` to verify TypeScript/Vite compilation. |

---

*Manual maintained for AniLove project repository (`anilove-ramu`).*
