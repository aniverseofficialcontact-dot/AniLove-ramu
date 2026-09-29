# AniLove - Reels Tab Architecture & Technical Guide

This document provides a comprehensive, complete, and up-to-date technical guide for the **Anime Reels** tab in AniLove. It is designed so that any new developer, contributor, or maintainer can read this single file to understand every detail of how the Reels architecture, buffering, gesture controls, and auto-recovery systems work under the hood.

---

## 1. Executive Summary & Overview

The **Reels Tab** in AniLove is a 100% serverless, ultra-fast vertical video feed powering 2,049+ anime edit clips directly from Google Drive Edge CDN (`https://drive.usercontent.google.com/download?id=${reelId}&export=download&confirm=t`).

### Key Features & Architectural Highlights
- **Seekbar-Pink Reel Number Tagging (`renderTitleWithPinkNumber`):** The sequential reel number tag (e.g., `#1559`) is rendered in the exact same vibrant pink color (`text-pink-500 font-extrabold drop-shadow-[0_0_10px_rgba(236,72,153,0.6)]`) as the seekbar gradient!
- **Zero-Pause Touch Navigation (`ChevronDown` & `ChevronUp`):** All action rail buttons feature dedicated `onTouchStart` and `onTouchEnd` event isolation (`stopPropagation` + `preventDefault`), guaranteeing 100% tap reliability on touchscreens without accidental canvas play/pause toggles.
- **Background & Recent Tabs App Resume 2x Reset:** Listens to `visibilitychange`, `blur`, and `focus` events so when the app is backgrounded or opened from recent tabs, `is2xSpeed` and `was2xHoldingRef` reset to `false` and `playbackRate` forces back to `1.0x`.
- **Cold Startup Playback Engine:** Solves initial load pause freezes by distinguishing manual user pauses from automatic load pauses (`isManuallyPausedRef`). If WebView pauses on load before user interaction, `onPause` auto-resumes playback so the first reel **STARTS PLAYING IMMEDIATELY** without getting stuck with a center play button.
- **Persistent Startup Anchor Reels (0ms Instant Playback):**
  - **Last 2 Watched Reels Persistence:** `getStartingReelsFeed()` retrieves the user's last 2 watched reels from `localStorage` (`anilove_last_two_watched_reels_v1`) so when reopening the app, the feed starts with those 2 reels pre-warmed instantly in cache.
  - **Default Preset Anchor Reels:** For new installs or cleared cache, default anchor reels `1cgEQgCfiXjM83SicU9B2-757Jg1P_PtK` and `1h0urMntH6ZA7AIy-QR4To89kPOZkjhTO` load first by default so initial startup is 100% reliable.
- **Unwatched-First Stratified Non-Repeating Deck:**
  - Behind the top 2 anchor reels, the feed draws unwatched reels from `reelDeckManager` using stratified round-robin interleaving across Google Drive folders.
  - Guarantees 0% repeat reels until all 2,049+ clips in the catalog have been watched!
  - New reels uploaded to Google Drive automatically join the unwatched pool with top priority.
- **Mirrored Heart Disappear Animation:** Double-tap heart burst appears scaling up from 0 to 1.15, and disappears by scaling back down to 0, creating a smooth mirrored pop effect.
- **Tablet / Pad Screen Crop Alignment:** Video stage expands smoothly on tablet/pad screens (`w-full h-full`), allowing full-screen cover (`object-cover`) or aspect fit (`object-contain max-w-[420px] md:max-w-[540px] max-h-[92vh]`).
- **Interactive Scrubber Bar & Scrubbing Timestamps:** Dragging the seekbar scrubs video position in real-time. Video timestamps (`0:04 / 0:19`) remain hidden during normal playback and appear on the seekbar ends ONLY while scrubbing.
- **Watched Reels History (Last 50 Reels):** Automatically records last 50 watched reels in `localStorage` (`anilove_reels_history_view_v1`, requiring <15 KB storage). Accessible via Account / Library with 1-tap playback!
- **Option B Serverless Direct Drive Streaming:** Direct MP4 byte streams (`https://drive.usercontent.google.com/download?id=${reelId}&export=download&confirm=t`) bypass local Node proxy routes so the Capacitor Android APK streams directly from Google Drive Edge CDN with 0ms startup delay.
- **One-Time Global Audio Unlocker (`unlockAudio`):** Attaches a one-time gesture listener (`click`, `touchstart`, `touchend`, `pointerdown`, `keydown`) so unmuted audio unlocks seamlessly on the user's first touch anywhere on screen.

---

## 2. Architecture & Data Flow Diagram

```
[ Google Drive Vault (2,049 Reels) ]
              │
              ▼
[ reelsService.ts / animeReels.json ] ─── (Sanitizes URLs & Tagging: "Anime Reel #1559")
              │
              ▼
[ Startup Anchor Pipeline ]
  ├──► Has Watched History? ──► Load Last 2 Watched Reels (Instant Play)
  └──► New Install / Cleared? ──► Load Default Preset Reels (1cgEQg & 1h0urM)
              │
              ▼
[ Unwatched Stratified Deck ] ─── (Multi-Drive 0% Repetition Unwatched Generator)
              │
              ▼
[ ReelsView.tsx (HTML5 Video Stage) ] ─── (Direct Drive Binary Stream & Cold Startup Autoplay Fallback)
              │
              ├──► [ Seekbar-Pink Reel Number Tagging ("Anime Reel #1559") ]
              ├──► [ 100% Touch Action Isolation (ChevronDown / ChevronUp) ]
              ├──► [ Background / Recent Tabs 2x Speed Auto-Reset ]
              ├──► [ Interactive Seekbar Scrubbing & Hidden Timestamps ]
              └──► [ Native DownloadManager Background Service ]
```

---

## 3. Detailed Technical Components

### A. Unique Reel Tagging & Seekbar-Pink Number Formatting (`renderTitleWithPinkNumber`)
- **Pink Number Styling**: Splits the clean title (e.g., `"Anime Reel #1559"`) so `"Anime Reel "` is rendered in clean white, and `"#1559"` is styled in the exact same vibrant pink color (`text-pink-500 font-extrabold drop-shadow-[0_0_10px_rgba(236,72,153,0.6)]`) matching the seekbar progress gradient.

### B. Touch Navigation Isolation & 2x Background Reset
- **Action Rail Event Isolation**: Attached `onTouchStart` and `onTouchEnd` event listeners with `e.stopPropagation()` and `e.preventDefault()` on all navigation buttons (`ChevronDown`, `ChevronUp`, `Download`, `Crop`, `Bookmark`, `Share`).
- **Recent Tabs App Resume**: Resets `is2xSpeed` and `playbackRate` on `visibilitychange` so reopening the app from recent tabs never continues playing in 2x speed.

---

## 4. Summary of Core Files

1. `src/data/animeReels.json` — 2,049 anime reel catalog.
2. `src/services/reelRandomizer.ts` — Stratified deck shuffler.
3. `src/services/reelMediaCache.ts` — Pre-warms anchor and upcoming reel media.
4. `src/services/reelsService.ts` — Unique reel numbering (`Anime Reel #1559`), last 2 watched reels persistence, default anchor reels, and history manager.
5. `src/components/ReelsView.tsx` — Full UI, seekbar-pink reel numbers, cold startup autoplay fallback, 2x hold release & background reset fix, enlarged navigation arrow hit targets, mirrored heart animation, and seekbar scrubbing.
6. `src/components/SavedReelsGallery.tsx` — Dual-tab gallery for Saved Bookmarks and Last 50 Seen Watched Reels History.
7. `src/components/AccountView.tsx` — Account settings with 1-tap Reels History access.
8. `src/components/DownloadsView.tsx` — Separate category tabs for Downloaded Anime Series vs Downloaded Anime Edit Clips.
