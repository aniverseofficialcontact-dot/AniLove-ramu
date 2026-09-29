# AniLove - Reels Tab Architecture & Technical Guide

This document provides a comprehensive, complete, and up-to-date technical guide for the **Anime Reels** tab in AniLove. It is designed so that any new developer, contributor, or maintainer can read this single file to understand every detail of how the Reels architecture, buffering, gesture controls, and auto-recovery systems work under the hood.

---

## 1. Executive Summary & Overview

The **Reels Tab** in AniLove is a 100% serverless, ultra-fast vertical video feed powering 2,049+ anime edit clips directly from Google Drive Edge CDN (`https://drive.usercontent.google.com/download?id=${reelId}&export=download&confirm=t`).

### Key Features & Architectural Highlights
- **Randomized Fresh Starting Feed:** On app launch or session start, `getStartingReelsFeed()` draws a fresh 10-reel stratified deck (`generateStratifiedDeck`) so users never see the same initial reels.
- **Hold for 2x Fast-Forward Playback:** Holding down anywhere on screen (>250ms) accelerates video playback to 2.0x and displays a clean white `"2x Speed"` badge on top. Releasing the finger resumes 1.0x playback speed.
- **Tablet / Pad Screen Crop Alignment:** Video stage expands smoothly on tablet/pad screens (`w-full h-full`), allowing full-screen cover (`object-cover`) or aspect fit (`object-contain max-w-[420px] md:max-w-[540px] max-h-[92vh]`).
- **Interactive Scrubber Bar & Scrubbing Timestamps:** Dragging the seekbar scrubs video position in real-time. Video timestamps (`0:04 / 0:19`) remain hidden during normal playback and appear on the seekbar ends ONLY while scrubbing.
- **Refined Dynamic Heart Burst:** Double-tapping captures exact touch/mouse `(x, y)` coordinates and animates a solid pink glowing heart (`fill-pink-500 text-pink-500`) without any pink background circle.
- **Watched Reels History (Last 50 Reels):** Automatically records last 50 watched reels in `localStorage` (`anilove_reels_history_view_v1`, requiring <15 KB storage). Accessible via Account / Library with 1-tap playback!
- **App Closure Session Refresh:** `saveStoredReelsSession()` uses `sessionStorage` only. When the app is closed or removed from recent tabs, active session history resets automatically, giving the user a fresh, newly shuffled feed on next launch.
- **Option B Serverless Direct Drive Streaming:** Direct MP4 byte streams (`https://drive.usercontent.google.com/download?id=${reelId}&export=download&confirm=t`) bypass local Node proxy routes so the Capacitor Android APK streams directly from Google Drive Edge CDN with 0ms startup delay.
- **Multi-Drive Stratified Non-Repeating Deck Manager (`reelRandomizer.ts`):** Uses Fisher-Yates stratified shuffle and drive partitioning (`partitionReelsByDrive`) to interleave reels fairly across drives, guaranteeing 0% repeats until all 2,049+ clips are watched.
- **One-Time Global Audio Unlocker (`unlockAudio`):** Attaches a one-time gesture listener (`click`, `touchstart`, `touchend`, `pointerdown`, `keydown`) so unmuted audio unlocks seamlessly on the user's first touch anywhere on screen.
- **Zero-Flash Poster & Buffering Engine (`isFrameRendered` & `isBuffering`):** Keeps a crisp poster mask overlay with a sleek pink spinner until `onPlaying` fires on the `<video>` element, completely eliminating black-screen flashes.
- **GPU-Accelerated Tween Flick Physics (`slideVariants`):** 280ms cubic-bezier tween transition (`ease: [0.22, 1, 0.36, 1], duration: 0.28`) matching Instagram / TikTok vertical swipe gesture feel.
- **Separate Offline Downloads Section (`DownloadsView.tsx`):** Downloads tab features dedicated category tabs separating **Downloaded Anime Series** from **Downloaded Anime Edit Clips**.
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
              ├──► [ 2x Fast Forward Speed Gesture & "2x Speed" Badge ]
              ├──► [ Dynamic Touch-Coordinate Heart Burst ]
              ├──► [ Interactive Seekbar Scrubbing & Hidden Timestamps ]
              ├──► [ Aspect Ratio Cover/Fit Crop Mode (Tablet & Phone Alignment) ]
              └──► [ Native DownloadManager Background Service ]
```

---

## 3. Detailed Technical Components

### A. Anime Tagging & Reel Numbering System
- **Reel Identifier System:** Every reel is assigned a clean formatted identifier (`cleanTitle = "Anime Reel #${index + 1}"` or `"Anime Reel (${reelId.slice(0, 6)})"`) regardless of raw Google Drive file names.
- **Cloud AI Enriched Tagging:** `fetchReelCloudMetadata(reelId)` fetches enriched anime titles, episode numbers, and timestamps (`currentMeta?.animeTitle`) when available.

### B. Watched Reels History Storage Analysis
- **Storage Footprint:** Storing the last 50 watched reel objects (ID, clean title, thumbnail URL, size) in `localStorage` requires **less than 15 Kilobytes (~0.015 MB)** of text storage.
- **Storage Capacity:** `localStorage` provides 5 MB - 10 MB per origin, meaning 50 watched reels consume **less than 0.15%** of available local storage.

### C. Multi-Drive Stratified Non-Repeating Deck Manager (`src/services/reelRandomizer.ts`)
- **Partitioning:** Groups reels by drive/folder source (`partitionReelsByDrive`).
- **Fair Interleaving:** Round-robin interleaves items across drives (`generateStratifiedDeck`) so reels from different drives are evenly spaced out.
- **Watched History Persistence:** Saves watched reel IDs in `localStorage` (`anilove_watched_reels_history_v2`). Resets watched history automatically once <10 unplayed reels remain in the 2,049+ catalog.

---

## 4. Summary of Core Files

1. `src/data/animeReels.json` — 2,049 anime reel catalog.
2. `src/services/reelRandomizer.ts` — Stratified deck shuffler.
3. `src/services/reelMediaCache.ts` — Adapted for Option B Direct Drive streams.
4. `src/services/reelsService.ts` — Session management (`sessionStorage` only), Drive endpoints, and Watched Reels History manager.
5. `src/components/ReelsView.tsx` — Full UI, 2x speed hold gesture, scrub timestamps, touch coordinates heart burst, tablet crop mode, and Native DownloadPlugin integration.
6. `src/components/SavedReelsGallery.tsx` — Dual-tab gallery for Saved Bookmarks and Last 50 Seen Watched Reels History.
7. `src/components/AccountView.tsx` — Account settings with 1-tap Reels History access.
8. `src/components/DownloadsView.tsx` — Separate category tabs for Downloaded Anime Series vs Downloaded Anime Edit Clips.
