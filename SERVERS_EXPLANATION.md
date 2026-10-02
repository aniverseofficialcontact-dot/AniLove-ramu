# 📡 AniLove Multi-Source Streaming & Server Architecture

This document serves as the **authoritative reference manual** for all streaming sources, server resolver workflows, fallback priorities, local caching mechanisms, and referer header configurations in AniLove.

---

## 🗺️ High-Level Source & Server Index

AniLove supports **4 distinct streaming sources**, each with its own specialized API architecture, server priority fallback logic, and language/quality controls:

| Source Name | Frontend Label | Servers Available | Primary Protocol / Endpoint |
| :--- | :--- | :--- | :--- |
| **`Multi-Lang`** | **Multi-Lang** (Source 1) | `Server 1` | `stream-all-languages` API returning multi-audio tracks (`Original Audio / JAP`, `English`, `Hindi`, `Tamil`, `Telugu`, `French`, `Spanish`, `Russian`...) with multi-quality MP4 links (`1080p`, `720p`, `480p`, `360p`). |
| **`AnimeDekho`** | **AnimeDekho** (Source 2) | `Server 1` – `Server 5` (Dynamic) | Custom `stream.php` API with dynamic priority target extraction (`rubystm`, `piratexplay`, `blakiteapi`, `vidmoly`, `abyssplayer`). |
| **`HiAnime`** | **HiAnime** (Source 3) | `Server 1` – `Server 3` | Deterministic URL patterns (`vidnest.fun`, `tryembed.us.cc`, `vidnest.fun/animepahe`) supporting dynamic `/sub` (Japanese) & `/dub` (English) language switching. |
| **`AnimeSalt`** | **AnimeSalt** (Source 4) | `Server 1` | AnimeSalt Vercel API returning `data.embedUrl` with `Referer: https://animesalt.me/`. |

---

## 🎬 1. Source 1: Multi-Lang (`Multi-Lang` / MovieBox Engine)

### 📌 API Endpoint
`https://moviebox-api-mklm.onrender.com/api/stream-all-languages?title={cleanTitle}&se=1&ep={episodeNumber}`

### 🗣️ Multi-Audio & Video Quality Integration Rules
- **Shifted to 1st Source Position**: `Multi-Lang` is the default 1st source in the frontend dropdown.
- **Dynamic Audio Language Menu**: Displays **ONLY** the audio languages returned by the API for that specific episode (e.g. `JAP (Sub)`, `ENG (Dub)`, `Hindi`, `French`, `Spanish`, `Tamil`, `Telugu`...). No default hardcoded languages!
- **Language-Dependent Video Quality Menu**: Video quality options (`1080p`, `720p`, `480p`, `360p`) dynamically update based on the selected audio language to match what is available for that track.
- **Header Authorization**: Requires `Referer: https://netfilm.world/`.
- **20-Minute Local Cache**: `MultiLang_${cleanTitle}_s1_ep${episodeNumber}` caches all audio tracks and quality maps so toggling languages or resolutions occurs with **0ms latency** without repeated network calls.

---

## ⚡ 2. Source 2: AnimeDekho (`AnimeDekho`)

### 📌 API Endpoint
`https://animeworld-india-api-njtl.onrender.com/api/anime-world-india/v1/stream.php?anilistId={anilistId}&ep={episodeNumber}`

### 🎯 Server Selection & Priority Target Ordering
The API response returns an array of raw server links (`stream.servers`). The engine evaluates and extracts servers strictly in the following priority order:

1. **`Server 1`** -> **First `rubystm` link** (Triggers `https://rubystm.com/e/...`).
2. **`Server 2`** -> **First `piratexplay` link** (Triggers `https://piratexplay.cc/...`).
3. **`Server 3`** -> **First `blakiteapi` link** (Triggers `https://blakiteapi.xyz/...`).
4. **`Server 4`** -> **First `vidmoly` link** (Triggers `https://vidmoly.biz/...`).
5. **`Server 5`** -> **First `abyssplayer` link** (Triggers `https://abyssplayer.com/...` — automatically unpacks `short.icu/` links into `abyssplayer.com/`).

### 📉 Dynamic Server Decrement & Auto-Shift Rule
If an anime episode lacks one or more server targets (e.g. `blakiteapi` is not provided by the API for that episode):
- Missing server targets are omitted completely.
- Remaining available targets shift up sequentially into `Server 1`, `Server 2`, `Server 3`...

### 💾 20-Minute Local Cache
- **Cache Key**: `AnimeDekho_${anilistId}_ep${episodeNumber}`
- **TTL**: 20 minutes (`20 * 60 * 1000` ms).

---

## 🌸 3. Source 3: HiAnime (`HiAnime`)

### 📌 Deterministic URL Pattern
- **Server 1 (Vidnest)**: `https://vidnest.fun/anime/{anilistId}/{episodeNumber}/{sub|dub}`
- **Server 2 (Tryembed)**: `https://tryembed.us.cc/embed/anime/{anilistId}/{episodeNumber}/{sub|dub}`
- **Server 3 (Animepahe)**: `https://vidnest.fun/animepahe/{anilistId}/{episodeNumber}/{sub|dub}`

### 🗣️ Sub / Dub Language & Quality Options
- **Filtered Settings Modal**: Player settings displays **ONLY** `JAP (Sub)` and `ENG (Dub)` for HiAnime under Audio Language.
- **Video Quality**: Set to `1080p`.
- **Japanese (Sub)**: Replaces `/dub` with `/sub` in URL.
- **English (Dub)**: Replaces `/sub` with `/dub` in URL.

---

## 🧂 4. Source 4: AnimeSalt (`AnimeSalt`)

### 📌 API Endpoint
`https://animesalt-api-omega.vercel.app/api/stream?id={animeSlug}&ep=ep-{episodeNumber}`
- **Header Authorization**: `Referer: https://animesalt.me/`.
- **Filtered Settings Modal**: Audio Language = `JAP (Sub)`, Video Quality = `1080p`.
- **20-Minute Local Cache**: `AnimeSalt_${anilistId}_ep${episodeNumber}`.

---

## 🛡️ 5. Domain-Specific Referer Headers Reference

| Stream Domain | Required Referer Header |
| :--- | :--- |
| `hakunaymatata.com` / `netfilm.world` (Multi-Lang / MovieBox) | `Referer: https://netfilm.world/` |
| `abyssplayer.com` / `short.icu` | `Referer: https://abyssplayer.com/` |
| `piratexplay.cc` | `Referer: https://piratexplay.cc/` |
| `animesalt-api` / `animesalt.me` | `Referer: https://animesalt.me/` |
| `vidmoly.biz` / `vidmoly.net` | `Referer: https://vidmoly.biz/` |
| `blakiteapi.xyz` | `Referer: https://blakiteapi.xyz/` |
| `rubystm.com` | `Referer: https://rubystm.com/` |

---

## 🧪 6. Testing & Build Protocol

Whenever modifying server APIs or resolver logic:
1. Re-build frontend web assets and sync Capacitor:
   ```cmd
   npm run build:android
   ```
2. Re-compile Android APK:
   ```cmd
   gradlew assembleDebug
   ```
