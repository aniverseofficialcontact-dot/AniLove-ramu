# AniLove - Reels Tab Architecture & Technical Guide

This document provides a comprehensive, complete, and up-to-date technical guide for the **Anime Reels** tab in AniLove. It is designed so that any new developer, contributor, or maintainer can read this single file to understand every detail of how the Reels architecture, buffering, gesture controls, and auto-recovery systems work under the hood.

---

## 1. Executive Summary & Overview

The **Reels Tab** in AniLove is a 100% serverless, ultra-fast vertical video feed powering 2,049+ anime edit clips directly from Google Drive Edge CDN (`https://drive.usercontent.google.com/download?id=${reelId}&export=download&confirm=t`).

### Key Features & Architectural Highlights
- **100% Direct Copy from `AniLove2-sam` (Web App Core):** Replaced the Reels pipeline with an exact 1:1 copy of the core logic from `AniLove2-sam` (`src/components/ReelsView.tsx`, `src/services/reelsService.ts`, `src/services/reelMediaCache.ts`, `src/services/reelRandomizer.ts`, `src/data/animeReels.json`).
- **Option B Serverless Direct Drive Streaming:** Direct MP4 byte streams (`https://drive.usercontent.google.com/download?id=${reelId}&export=download&confirm=t`) bypass local Node proxy routes so the Capacitor Android APK streams directly from Google Drive Edge CDN with 0ms startup delay.
- **Multi-Drive Stratified Non-Repeating Deck Manager (`reelRandomizer.ts`):** Uses Fisher-Yates stratified shuffle and drive partitioning (`partitionReelsByDrive`) to interleave reels fairly across drives, guaranteeing 0% repeats until all 2,049+ clips are watched.
- **One-Time Global Audio Unlocker (`unlockAudio`):** Attaches a one-time gesture listener (`click`, `touchstart`, `touchend`, `pointerdown`, `keydown`) so unmuted audio unlocks seamlessly on the user's first touch anywhere on screen.
- **Zero-Flash Poster & Buffering Engine (`isFrameRendered` & `isBuffering`):** Keeps a crisp poster mask overlay with a sleek pink spinner until `onPlaying` fires on the `<video>` element, completely eliminating black-screen flashes.
- **GPU-Accelerated Tween Flick Physics (`slideVariants`):** 280ms cubic-bezier tween transition (`ease: [0.22, 1, 0.36, 1], duration: 0.28`) matching Instagram / TikTok vertical swipe gesture feel.
- **Native Android Download Service (`EpisodeDownloadService`):** Integrated with native `DownloadPlugin.startDownload` on Capacitor Android so tapping download saves MP4 files to device storage with background notification progress tracking.

---

## 2. Architecture & Data Flow Diagram

```
[ Google Drive Vault (2,049 Reels) ]
              │
              ▼
[ reelsService.ts / animeReels.json ] ─── (Sanitizes URLs, Folder Obfuscation & Metadata)
              │
              ▼
[ reelRandomizer.ts (Stratified Deck) ] ─── (Multi-Drive Round-Robin 0% Repetition Generator)
              │
              ▼
[ reelMediaCache.ts (RAM & Cache Storage) ] ─── (Client-Side Object URL & Image Pre-Warming)
              │
              ▼
[ ReelsView.tsx (HTML5 Video Stage) ] ─── (Direct Drive Binary Stream & Unmuted Audio Unlock)
              │
              ├──► [ 1-Touch Audio Unlocker & Media Handlers ]
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
- **`&confirm=t` Parameter:** Bypasses Google Drive's "file cannot be scanned for viruses" HTML warning page and forces Google Drive to serve raw MP4 byte streams directly to the `<video>` element (returning HTTP 200 with `Content-Type: video/mp4`).

### B. Multi-Drive Stratified Non-Repeating Deck Manager (`src/services/reelRandomizer.ts`)
- **Partitioning:** Groups reels by drive/folder source (`partitionReelsByDrive`).
- **Fair Interleaving:** Round-robin interleaves items across drives (`generateStratifiedDeck`) so reels from different drives are evenly spaced out.
- **Watched History Persistence:** Saves watched reel IDs in `localStorage` (`anilove_watched_reels_history_v2`). Resets watched history automatically once <10 unplayed reels remain in the 2,049+ catalog.

### C. Client-Side Media Cache (`src/services/reelMediaCache.ts`)
- **Cache Storage API & In-Memory LRU Map:** Stores up to 25 Object URLs in RAM (~75MB) and up to 50 entries in browser Cache Storage.
- **Synchronous Lookup (`getSynchronousObjectUrl`):** Instantly retrieves RAM-cached Object URLs during the initial render pass.
- **App Teardown Cleanup (`cleanup`):** Revokes Object URLs on unmount / pagehide to release phone RAM.

### D. Audio Autoplay Policy & Video Stage (`src/components/ReelsView.tsx`)
- **Unmuted Audio Unlocker:** On initial mount, `unlockAudio()` attaches passive event listeners to `click`, `touchstart`, `touchend`, `pointerdown`, and `keydown`. Tapping anywhere on screen instantly unmutes `<video>` audio and resumes playback.
- **`settings.setMediaPlaybackRequiresUserGesture(false)`**: Added in `MainActivity.java` so WebView allows unmuted video autoplay without requiring user interaction blocks.
- **`android:usesCleartextTraffic="true"`**: Configured in `AndroidManifest.xml` so HTTP/HTTPS media streams are never blocked by Android cleartext network security policy.

---

## 4. Summary of Files Copied & Replaced from `AniLove2-sam`

1. `src/data/animeReels.json` — 100% copied (2,049 anime reel catalog).
2. `src/services/reelRandomizer.ts` — 100% copied (Stratified deck shuffler).
3. `src/services/reelMediaCache.ts` — Copied & adapted for Option B Direct Drive streams.
4. `src/services/reelsService.ts` — Copied & adapted for Option B Direct Drive streams.
5. `src/components/ReelsView.tsx` — 100% UI, gestures, audio unlock, and player structure copied from `AniLove2-sam` + Native DownloadPlugin integration.
