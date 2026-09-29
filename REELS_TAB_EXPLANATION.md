# AniLove - Reels Tab Architecture & Technical Guide

This document provides a comprehensive, complete, and up-to-date technical guide for the **Anime Reels** tab in AniLove. It is designed so that any new developer, contributor, or maintainer can read this single file to understand every detail of how the Reels architecture, buffering, gesture controls, and auto-recovery systems work under the hood.

---

## 1. Executive Summary & Overview

The **Reels Tab** in AniLove is a serverless, ultra-fast vertical video feed powering 2,049+ anime edit clips streamed directly from Google Drive Edge CDN.

### Key Features & Architectural Highlights
- **Direct Edge CDN Streaming (No Custom Video Server):** Streams MP4 clips directly via Google Drive Edge CDN (`https://drive.usercontent.google.com/download?id=${reelId}&export=download&confirm=t`) without requiring expensive streaming server infrastructure.
- **0ms Instant Reel #1 Startup:** Checks in-memory Blob Object URLs synchronously on initial render pass so Reel #1 plays instantly without black-screen delay or source swaps.
- **Adaptive Network RAM Caching:** Pre-buffers upcoming reels in parallel directly into phone RAM using Blob Object URLs (`blob:https://...`). Dynamically adjusts pre-buffer depth (4 reels on 4G/Wi-Fi vs. 1 reel on 2G/3G/Data Saver).
- **3-Tier Automatic Stall & Resume Watchdog:** Continuously monitors playback every 350ms. If network drops or WebView auto-pauses the video, the watchdog recovers and resumes playback automatically within <1 second without forcing the user to scroll away and back.
- **App Foreground & Visibility Auto-Resume:** Listens to `visibilitychange` and `focus` events to seamlessly resume video playback from the exact same timestamp when returning from backgrounding or tab switches.
- **Hardware Decoder Memory Cleanup:** Explicitly strips `src` attributes and reloads the video pipeline on swipe transitions to prevent V8/WebView RAM leaks and GPU decoder exhaustion.
- **Dynamic Touch-Coordinate Heart Burst:** Double-tapping anywhere on the video stage captures exact `(clientX, clientY)` coordinates and animates a floating heart burst directly under the user's finger.
- **Native Android Downloading:** Integrates directly with Android's native `DownloadManager` background service (`EpisodeDownloadService`) with notification progress tracking and offline storage.
- **Anti-Repetition & Smart Session Persistence:** Tracks watched reel IDs in `localStorage` so unseen clips are prioritized across sessions, while preserving active scroll position in `sessionStorage` during tab switches.

---

## 2. Architecture & Data Flow Diagram

```
[ Google Drive Vault (2,049 Reels) ]
              │
              ▼
[ reelsService.ts / animeReels.json ] ─── (Sanitizes URLs, Folder Obfuscation & Metadata)
              │
              ▼
[ reelMediaCache.ts (Adaptive RAM Caching) ] ─── (Synchronous 0ms RAM Lookup + Network-Aware Preload)
              │
              ▼
[ ReelsView.tsx (Pure HTML5 Video Stage) ] ─── (Zero-Flash Poster Masking & Autoplay Engine)
              │
              ├──► [ 3-Tier Watchdog & Visibility Resume Engine ]
              ├──► [ Interactive Gestures & Dynamic Heart Burst ]
              ├──► [ Action Bar (Share, Save, Crop, Download, Chevrons) ]
              └──► [ Native DownloadManager Background Service ]
```

---

## 3. Detailed Technical Components

### A. Dataset & Folder Protection (`src/data/animeReels.json` & `src/services/reelsService.ts`)
- **Folder Obfuscation:** The original Google Drive parent folder ID is obfuscated to `"anime_edits_vault"`.
- **Direct Stream Endpoint Structure:**
  - Direct MP4 Stream: `https://drive.usercontent.google.com/download?id=${reelId}&export=download&confirm=t`
  - Fallback Stream: `https://drive.google.com/uc?export=download&id=${reelId}&confirm=t`
  - Poster Image: `https://lh3.googleusercontent.com/d/${reelId}`
- **`&confirm=t` Parameter:** Bypasses Google Drive's "file cannot be scanned for viruses" HTML warning page and forces Google Drive to serve raw MP4 byte streams directly to the `<video>` element.

### B. Adaptive RAM Caching Engine (`src/services/reelMediaCache.ts`)
- **Synchronous RAM Lookup (`getSynchronousBlobUrl`):** Checks if an in-memory Blob Object URL (`blob:https://...`) is already cached in RAM during the first render pass.
- **Network Bandwidth Awareness:** Checks `navigator.connection` (`effectiveType`, `saveData`).
  - **4G / Wi-Fi:** Pre-buffers 4 upcoming reels in parallel (~60MB RAM).
  - **2G / 3G / Data Saver:** Pre-buffers 1 upcoming reel to save mobile data and prevent buffer starvation.
- **LRU Eviction Policy:** Maintains up to 16 Blob Object URLs in memory. When capacity is reached, the oldest unused Blob URL is revoked via `URL.revokeObjectURL()`.
- **App Teardown Cleanup (`cleanupAllMediaCache`):** Listens to `visibilitychange` (hidden state), `pagehide`, and `beforeunload`. When the app is closed or removed from recent apps, all Blob Object URLs are revoked to release phone RAM completely.

### C. Video Stage & Autoplay Engine (`src/components/ReelsView.tsx`)
- **Pure HTML5 Video Stage:** Control-less borderless `<video>` element (NO `iframe`, NO embedded Google web controls).
- **Zero-Flash Poster Masking:** Keeps a high-res poster image layered over the video stage until `onPlaying` / `onLoadedData` fires, preventing black screen flashes.
- **Strict Declaration Ordering:** All states, refs, callbacks (`getActiveVideo`), and derived values (`currentReel`, `currentMeta`, `displayTitle`, `activeVideoUrl`, `activePosterUrl`) are declared **above** all `useEffect` hooks to prevent JavaScript Temporal Dead Zone (`ReferenceError: Cannot access 's' before initialization`) runtime errors.
- **Media Event Attachment:** Listens to `canplay`, `loadeddata`, and `playing` events to automatically trigger `video.play()` as soon as media bytes become ready.

### D. 3-Tier Auto-Reconnect Watchdog & Resume Engine
The watchdog runs an interval every 350ms to detect if the video is frozen, stalled, or auto-paused by WebView while `isManuallyPausedRef.current` is `false`:

1. **Level 1 Kickstart (800ms):** If the video is paused or `currentTime` hasn't advanced for >800ms, calls `video.play()`.
2. **Level 2 Soft Reload (2,200ms):** If stuck for >2.2 seconds, reloads the video media element pipeline (`video.load()`, restoring `video.currentTime`) to kickstart stuck decoders.
3. **Level 3 Stream Fallback (4,200ms):** Swaps the source override endpoint with a fresh timestamp parameter (`&retry=${now}`) to bypass temporary CDN stalls.
4. **App Resume Listener:** Listens to `visibilitychange` and window `focus` events. Returning from backgrounding instantly triggers `video.play()`.

### E. Gesture Controls & Dynamic UI
- **Single Tap:** Toggles Play / Pause with transparent feedback overlay.
- **Double Tap:** Captures exact touch `(clientX, clientY)` coordinates, animates a floating heart burst directly under the user's finger, and toggles reel bookmarking.
- **Hold / Long-Press:** Accelerates video playback speed smoothly to 2.0x with a white `"2x Speed"` badge.
- **Vertical Drag / Flick:** Framer Motion spring slide transitions between reels.
- **Hardware Memory Cleanup:** `cleanupVideoElement()` pauses the current video, removes its `src` attribute, and calls `.load()` on every swipe to release GPU decoders.
- **Interactive Seekbar:** Seekbar timestamps (`0:05` / `0:15`) stay hidden during normal playback and appear ONLY while the user is actively scrubbing the seekbar.

### F. Native Android Download Service (`android/.../EpisodeDownloadService.java`)
- **Invocation:** Triggered via `DownloadPlugin.startDownload({ item: { streamUrl, pageUrl, ... } })`.
- **Redirect Handler:** Bypasses Google Drive 302/307 redirects in a native Java HTTP loop in `openConnectionWithHeaders`.
- **Foreground Download Service:** Runs in Android's background service with notification bar progress tracking, saving downloaded MP4 files directly to the device's Downloads folder.

---

## 4. Developer Guidelines for Future Contributors

1. **Never Re-introduce `<iframe>` Embeds:** HTML5 `<video>` with direct MP4 streams and RAM Blob URLs is required for smooth gesture controls, custom speed handling, and control-less UI.
2. **Always Keep Derived Variables Above Hooks:** Maintain `const currentReel = feedHistory[historyIndex] || null;` and `activeVideoUrl` above all `useEffect` hooks in `ReelsView.tsx` to avoid TDZ errors.
3. **Do Not Bypass `cleanupVideoElement()`:** Always invoke `cleanupVideoElement()` before changing `historyIndex` to prevent GPU memory leaks on low-end Android devices.
4. **Keep `sessionStorage` for Session State:** `saveStoredReelsSession()` uses `sessionStorage` so active scroll position persists during tab switches and clears when the app is removed from recent apps.
