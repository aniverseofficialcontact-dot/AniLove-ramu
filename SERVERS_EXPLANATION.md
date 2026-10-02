# 📡 AniLove Multi-Source Streaming & Server Architecture

This document serves as the **authoritative reference manual** for all streaming sources, server resolver workflows, fallback priorities, local caching mechanisms, and referer header configurations in AniLove.

---

## 🗺️ High-Level Source & Server Index

AniLove supports **4 distinct streaming sources**, each with its own specialized API architecture, server priority fallback logic, and language/quality controls:

| Source Name | Frontend Label | Servers Available | Primary Protocol / Endpoint |
| :--- | :--- | :--- | :--- |
| **`AnimeDekho`** | **AnimeDekho** | `Server 1` – `Server 5` (Dynamic) | Custom `stream.php` API with dynamic priority target extraction (`rubystm`, `piratexplay`, `blakiteapi`, `vidmoly`, `abyssplayer`). |
| **`HiAnime`** | **HiAnime** | `Server 1` – `Server 3` | Deterministic URL patterns (`vidnest.fun`, `tryembed.us.cc`, `vidnest.fun/animepahe`) supporting dynamic `/sub` (Japanese) & `/dub` (English) language switching. |
| **`AnimeSalt`** | **AnimeSalt** | `Server 1` | AnimeSalt Vercel API returning `data.embedUrl` with `Referer: https://animesalt.me/`. |
| **`MovieBox`** | **MovieBox** | `Server 1` | MovieBox Render API returning multi-quality MP4 sources (`1080p`, `720p`, `480p`, `360p`) with `Referer: https://netfilm.world/`. |

---

## ⚡ 1. Source 1: AnimeDekho (`AnimeDekho`)

### 📌 API Endpoint
`https://animeworld-india-api-njtl.onrender.com/api/anime-world-india/v1/stream.php?anilistId={anilistId}&ep={episodeNumber}`

### 🎯 Server Selection & Priority Target Ordering
The API response returns an array of raw server links (`stream.servers`). The engine evaluates and extracts servers strictly in the following priority order:

1. **`Server 1`** -> **First `rubystm` link** (Triggers the first `https://rubystm.com/e/...` stream).
2. **`Server 2`** -> **First `piratexplay` link** (Triggers the first `https://piratexplay.cc/...` stream).
3. **`Server 3`** -> **First `blakiteapi` link** (Triggers the first `https://blakiteapi.xyz/...` stream).
4. **`Server 4`** -> **First `vidmoly` link** (Triggers the first `https://vidmoly.biz/...` stream).
5. **`Server 5`** -> **First `abyssplayer` link** (Triggers the first `https://abyssplayer.com/...` stream).

### 📉 Dynamic Server Decrement & Auto-Shift Rule
If an anime episode lacks one or more server targets (e.g. `blakiteapi` is not provided by the API for that episode):
- Missing server targets are omitted completely.
- Remaining available targets shift up sequentially into `Server 1`, `Server 2`, `Server 3`...
- *Example*: If `blakiteapi` is absent:
  - `Server 1` = `rubystm`
  - `Server 2` = `piratexplay`
  - `Server 3` = `vidmoly`
  - `Server 4` = `abyssplayer`
  - *(No `Server 5` will be displayed in frontend)*.

### 💾 20-Minute Local Cache
- **Cache Key**: `AnimeDekho_${anilistId}_ep${episodeNumber}`
- **TTL**: 20 minutes (`20 * 60 * 1000` ms).
- **Benefit**: Once an episode API call completes, switching between Server 1, Server 2, Server 3... occurs with **0ms latency** without redundant HTTP requests.

---

## 🌸 2. Source 2: HiAnime (`HiAnime`)

### 📌 Deterministic URL Pattern
HiAnime operates without API latency by using direct deterministic embed patterns:

- **Server 1 (Vidnest)**: `https://vidnest.fun/anime/{anilistId}/{episodeNumber}/{sub|dub}`
- **Server 2 (Tryembed)**: `https://tryembed.us.cc/embed/anime/{anilistId}/{episodeNumber}/{sub|dub}`
- **Server 3 (Animepahe)**: `https://vidnest.fun/animepahe/{anilistId}/{episodeNumber}/{sub|dub}`

### 🗣️ Sub / Dub Language Switching
- **Japanese (Sub)**: Appends `/sub` to the URL.
- **English (Dub)**: Appends `/dub` to the URL.
- Toggling the language option in player settings updates the endpoint instantly between Japanese (`/sub`) and English (`/dub`).

---

## 🧂 3. Source 3: AnimeSalt (`AnimeSalt`)

### 📌 API Endpoint
`https://animesalt-api-omega.vercel.app/api/stream?id={animeSlug}&ep=ep-{episodeNumber}`

### 🛠️ Execution & Referer
- Queries `data.embedUrl` from the AnimeSalt API.
- Serves as **Server 1** under AnimeSalt.
- **Header Authorization**: Standardized with `Referer: https://animesalt.me/`.
- **20-Minute Local Cache**: `AnimeSalt_${anilistId}_ep${episodeNumber}`.

---

## 🎬 4. Source 4: MovieBox (`MovieBox`)

### 📌 API Endpoint
`https://moviebox-api-mklm.onrender.com/api/stream-by-name?title={cleanTitle}&se=1&ep={episodeNumber}&include_captions=true`

### 🎞️ Multi-Quality Resolution Integration
- Displayed as **Server 1** in the main server selector.
- The API returns an array of direct MP4 stream URLs across multiple video resolutions (`1080p`, `720p`, `480p`, `360p`).
- **Quality Selector in Settings**: Player settings dynamically lists **only** the video resolutions returned by MovieBox for that specific episode.
- Selecting a resolution (e.g. `720p` or `1080p`) immediately updates the playback stream URL.
- **Header Authorization**: Requires `Referer: https://netfilm.world/`.
- **20-Minute Local Cache**: `MovieBox_${cleanTitle}_s1_ep${episodeNumber}` caches all resolution URLs for instant quality toggling.

---

## 🛡️ 5. Domain-Specific Referer Headers Reference

To prevent 403 Forbidden errors when loading streams natively in ExoPlayer or WebView, `NativePlayerActivity.java` applies these required referers:

| Stream Domain | Required Referer Header |
| :--- | :--- |
| `hakunaymatata.com` / `netfilm.world` (MovieBox) | `Referer: https://netfilm.world/` |
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
