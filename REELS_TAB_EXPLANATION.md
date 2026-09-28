# AniLove - Reels Tab Architecture & Technical Guide

This document provides a comprehensive, simple, and detailed technical walkthrough of the **Anime Reels** feature in AniLove. It is designed to help any developer, teammate, or contributor understand exactly how the Reels system works under the hood.

---

## 1. Executive Summary & Overview

The **Reels Tab** in AniLove is a 100% serverless, high-performance vertical video feed powering 2,049+ anime edit clips directly from Google Drive Edge CDN. 

Key Highlights:
- **No Heavy Backend Required:** Streams MP4 clips directly via Google Drive Edge CDN without needing custom streaming server infrastructure.
- **0ms Instant RAM Caching:** Pre-buffers upcoming clips directly into phone RAM using `Blob` Object URLs (`URL.createObjectURL(blob)`).
- **Zero CORS / WebView Restrictions:** Bypasses browser cross-origin blocks and redirects using direct stream endpoints (`&confirm=t`) and native HTTP routing (`CapacitorHttp`).
- **AI Scene Identification:** Integrated with `trace.moe` API to analyze video frames or uploaded screenshots and identify the exact Anime Title, Episode, and Timestamp.
- **Native Android Downloading:** Integrates directly with Android's native `DownloadManager` background service (`EpisodeDownloadService`) to save reels directly to device storage.
- **Anti-Repetition Engine:** Tracks watched reel IDs in `localStorage` so unseen clips are prioritized across sessions.
- **Smart Session Persistence:** Remembers the user's exact scroll position (e.g. 10th reel) when switching between app tabs until the app is cleared from recent apps.

---

## 2. Architecture & Data Flow Diagram

```
[ Google Drive Vault (2,049 Reels) ]
              │
              ▼
[ reelsService.ts / animeReels.json ] ─── (Sanitizes URLs & Metadata)
              │
              ▼
[ reelMediaCache.ts (RAM Blob Caching) ] ─── (Pre-fetches Reel #1 + Next 3 Reels)
              │
              ▼
[ ReelsView.tsx (HTML5 Video Stage) ] ─── (Zero-Flash Poster Masking & Unmuted Playback)
              │
              ├──► [ Action Bar (Share, Save, Crop, Download, Chevrons) ]
              ├──► [ trace.moe Scene Finder Modal ]
              └──► [ Native DownloadManager Service ]
```

---

## 3. Core Components Breakdown

### A. Dataset & Folder Protection (`src/data/animeReels.json` & `src/services/reelsService.ts`)
- **Folder Obfuscation:** The parent Google Drive folder ID/URL is hidden and set to `"anime_edits_vault"`. Users can never inspect or leak the original parent folder.
- **Endpoint URL Structure:**
  - Stream Endpoint: `https://drive.google.com/uc?export=view&id=${reelId}`
  - Fallback Direct Stream: `https://drive.usercontent.google.com/download?id=${reelId}&export=download&confirm=t`
  - Poster Image: `https://lh3.googleusercontent.com/d/${reelId}`
  - **`&confirm=t` Flag:** Automatically bypasses Google Drive's "can't scan file for viruses" HTML warning page and forces Google Drive to return raw MP4 bytes.

### B. Pre-Warming & RAM Caching Engine (`src/services/reelMediaCache.ts`)
- **Pre-Warming Reel #1:** On app launch, `prewarmInitialReelsOnAppStart()` pre-fetches Reel #1's MP4 stream into RAM before the user opens the Reels tab.
- **RAM Blob Object URLs:**
  - Fetches raw MP4 bytes in the background.
  - Converts response bytes into in-memory Blob Object URLs (`blob:https://...`).
  - Stored in a LRU (Least Recently Used) map with a limit of 12 reels (~45MB RAM).
  - When the user swipes to a reel, the video plays out of local RAM with 0ms buffering delay.
- **Instant Eviction on Close:** Listens to `visibilitychange` (hidden state), `pagehide`, and `beforeunload`. When the app is closed, `cleanupAllMediaCache()` revokes all Object URLs and purges RAM memory.

### C. UI & Gesture Controls (`src/components/ReelsView.tsx`)
- **Pure HTML5 Video Stage:** Control-less borderless `<video>` element (NO `iframe`, NO Google Drive web controls).
- **Zero-Flash Poster Mask:** Keeps the high-res poster image layered over the video stage until `onPlaying` / `onLoadedData` fires, preventing black box flashes.
- **Audio & Autoplay:** Plays unmuted (`muted={false}`, `volume={1.0}`) by default.
- **Interactive Gestures:**
  - Single Tap: Toggle Play / Pause with smooth glassmorphism pulse animation.
  - Double Tap: Heart burst animation + saves/bookmarks reel.
  - Hold / Long-press: Smooth 2x speed playback with a subtle white `"2x Speed"` badge.
  - Vertical Drag / Flick: Instagram/Shorts style Framer Motion spring slide transitions between reels.
- **6 Transparent Minimal Line Icons (Action Bar):**
  1. **Paperplane / Share (`<Send />`):** Copies share link or opens native Android Share sheet.
  2. **Bookmark (`<Bookmark />`):** Saves reel to local bookmarks collection.
  3. **Fit / Fill (`<Crop />`):** Toggles video aspect ratio between `object-cover` and `object-contain`.
  4. **Download (`<Download />`):** Invokes native Android background download service.
  5. **Chevron Up (`<ChevronUp />`):** Scrolls to previous reel.
  6. **Chevron Down (`<ChevronDown />`):** Scrolls to next reel.

### D. Native Android Download Service (`android/.../EpisodeDownloadService.java`)
- **Invocation:** `DownloadPlugin.startDownload({ item: { streamUrl, pageUrl, ... } })`.
- **Cross-Domain Redirect Handler:** Handles HTTP 301/302/303/307 redirects in a Java loop in `openConnectionWithHeaders`, resolving Google Drive redirects to direct download URLs.
- **Foreground Service:** Runs in Android's background service with notification bar progress tracking, saving the downloaded MP4 directly into the device's Downloads directory and listing it in AniLove's **Downloads Tab**.

### E. AI Scene Finder (`src/components/AnimeSceneFinderModal.tsx`)
- Captures current video frame or accepts user gallery screenshot upload.
- Sends base64 image payload to `https://api.trace.moe/search?cutBorders`.
- Returns verified Anime Title, Episode, Timestamp, AniList ID, and similarity confidence score.

---

## 4. Key Developer Tips for Future Maintainers

1. **Do NOT re-introduce `<iframe>` or embed links:** HTML5 `<video>` with direct MP4 streams and RAM Blob URLs is the only approach that guarantees custom UI gestures without clunky Google Drive web controls.
2. **Keep `streamUrl` and `pageUrl` in `DownloadPlugin` calls:** Android's `EpisodeDownloadService` requires `streamUrl` in the JSON payload to parse download targets correctly.
3. **Session Persistence:** `saveStoredReelsSession()` maintains the active feed history and history index during tab switches. Do not clear session memory unless the user manually refreshes or closes the app.
