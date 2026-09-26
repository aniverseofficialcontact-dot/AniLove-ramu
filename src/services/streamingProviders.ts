import { Anime, StreamServerId } from '../types';
import { API_BASE, apiFetch, apiUrl } from './api';
import { CapacitorHttp, Capacitor } from '@capacitor/core';

export type StreamLanguage = 'SUB' | 'DUB' | 'HIN' | 'TAM' | 'TEL' | 'MAL' | 'KAN' | 'BEN';
export type StreamResolution = 'auto' | '1080p' | '720p' | '480p';

export interface LanguageOption {
  code: StreamLanguage;
  label: string;
  nativeLabel: string;
  flag: string;
  short: string;
}

export const SUPPORTED_LANGUAGES: LanguageOption[] = [
  { code: 'SUB', label: 'Japanese (Sub)', nativeLabel: '日本語', flag: '🇯🇵', short: 'JAP/SUB' },
  { code: 'DUB', label: 'English Dub', nativeLabel: 'English', flag: '🇺🇸', short: 'ENG/DUB' },
  { code: 'HIN', label: 'Hindi Dub', nativeLabel: 'हिन्दी', flag: '🇮🇳', short: 'HINDI' },
  { code: 'TAM', label: 'Tamil Dub', nativeLabel: 'தமிழ்', flag: '🇮🇳', short: 'TAMIL' },
  { code: 'TEL', label: 'Telugu Dub', nativeLabel: 'తెలుగు', flag: '🇮🇳', short: 'TELUGU' },
  { code: 'MAL', label: 'Malayalam Dub', nativeLabel: 'മലയാളം', flag: '🇮🇳', short: 'MALAYALAM' },
  { code: 'KAN', label: 'Kannada Dub', nativeLabel: 'கன்னட', flag: '🇮🇳', short: 'KANNADA' },
  { code: 'BEN', label: 'Bengali Dub', nativeLabel: 'বাংলা', flag: '🇮🇳', short: 'BENGALI' },
];

export interface StreamProvider {
  id: StreamServerId;
  label: string;
  category: 'official';
  description: string;
  supportedLanguages: StreamLanguage[];
  tag?: string;
  serverMatch?: string;
  apiEndpoint?: string;
}

export interface SkipData {
  intro: [number, number]; // [startSec, endSec]
  outro: [number, number]; // [startSec, endSec]
}

export interface AvailableServerOption {
  name: string;
  type: string;
  linkId: string;
  providerId?: StreamServerId;
}

export interface StreamSource {
  provider: StreamProvider;
  url: string;
  language: StreamLanguage;
  resolution: StreamResolution;
  isEmbeddable: boolean;
  external: boolean;
  skipData?: SkipData;
  availableServers?: AvailableServerOption[];
  availableLanguages?: StreamLanguage[];
  availableResolutions?: StreamResolution[];
  selectedServerName?: string;
  isDubAvailable?: boolean;
  isFallback?: boolean;
  fallbackReason?: string;
  requestedLanguage?: StreamLanguage;
  actualLanguage?: StreamLanguage;
  subtitleUrl?: string;
  subtitleLang?: string;
}

export type StreamSourceStatus = 'available' | 'unavailable' | 'error';

export interface ResolveEpisodeSourceInput {
  anime: Anime;
  episodeNumber: number;
  providerId?: StreamServerId | string;
  language?: StreamLanguage;
  resolution?: StreamResolution;
  serverName?: string;
  refresh?: boolean;
}

export interface ResolveEpisodeSourceResult {
  status: StreamSourceStatus;
  source?: StreamSource;
  message?: string;
}

// 1. AnimeWorld India v1 API Stream Provider
const ANIME_WORLD_V1: StreamProvider = {
  id: 'anime-world-v1',
  label: 'AnimeWorld Ultra',
  category: 'official',
  description: 'Custom AnimeWorld India v1 PHP Stream API with Redis caching & multi-server failover.',
  supportedLanguages: ['SUB', 'DUB', 'HIN', 'TAM', 'TEL', 'MAL', 'KAN', 'BEN'],
  tag: 'v1 Ultra',
  apiEndpoint: '/api/anime-world-india/v1/stream',
};

export const STREAM_PROVIDERS: StreamProvider[] = [ANIME_WORLD_V1];

export const DEFAULT_STREAM_PROVIDER_ID: StreamServerId = 'anime-world-v1';

export const isStreamProviderId = (providerId: string): providerId is StreamServerId =>
  STREAM_PROVIDERS.some(provider => provider.id === providerId);

export function createDirectStreamSource(
  anime: Anime,
  episodeNumber: number,
  provider: StreamProvider,
  language: StreamLanguage = 'DUB',
  resolution: StreamResolution = '1080p',
  serverName?: string
): StreamSource {
  const anilistId = anime.id || 1;
  const isDub = language === 'DUB';

  const availableServers: AvailableServerOption[] = [
    { name: 'Server 1', type: isDub ? 'DUB' : 'SUB', linkId: `https://vidlink.pro/anime/${anilistId}/${episodeNumber}?dub=${isDub ? 'true' : 'false'}` },
    { name: isDub ? 'Server 2-A-DUB' : 'Server 2-A-SUB', type: isDub ? 'DUB' : 'SUB', linkId: `https://vidnest.fun/anime/${anilistId}/${episodeNumber}/${isDub ? 'dub' : 'sub'}` },
    { name: isDub ? 'Server 2-B-DUB' : 'Server 2-B-SUB', type: isDub ? 'DUB' : 'SUB', linkId: `https://tryembed.us.cc/embed/anime/${anilistId}/${episodeNumber}/${isDub ? 'dub' : 'sub'}` },
    { name: isDub ? 'Server 2-C-DUB' : 'Server 2-C-SUB', type: isDub ? 'DUB' : 'SUB', linkId: `https://vidnest.fun/animepahe/${anilistId}/${episodeNumber}/${isDub ? 'dub' : 'sub'}` },
  ];

  let selectedUrl = availableServers[0].linkId;
  let selectedServerName = availableServers[0].name;

  if (serverName) {
    const norm = serverName.toLowerCase().trim();
    const matched = availableServers.find(s => s.name.toLowerCase().startsWith(norm));
    if (matched) {
      selectedUrl = matched.linkId;
      selectedServerName = matched.name;
    }
  }

  return {
    provider: provider || ANIME_WORLD_V1,
    url: selectedUrl,
    language,
    resolution,
    isEmbeddable: true,
    external: false,
    skipData: { intro: [0, 0], outro: [0, 0] },
    availableServers,
    availableLanguages: ['SUB', 'DUB', 'HIN', 'TAM', 'TEL', 'MAL', 'KAN', 'BEN'],
    availableResolutions: ['1080p', '720p', '480p'],
    selectedServerName,
    isDubAvailable: true,
    isFallback: true,
    requestedLanguage: language,
    actualLanguage: language,
  };
}

export function extractAvailableLanguagesFromStreamData(rawServers: any[]): StreamLanguage[] {
  const detected = new Set<StreamLanguage>();

  for (const s of rawServers || []) {
    if (s && s.url && (s.url.includes('multi.php?data=') || s.url.includes('data='))) {
      try {
        const match = s.url.match(/[?&]data=([^&]+)/);
        if (match && match[1]) {
          const decoded = atob(decodeURIComponent(match[1]));
          const list = JSON.parse(decoded);
          if (Array.isArray(list)) {
            for (const item of list) {
              const l = (item.language || '').toLowerCase();
              if (l.includes('hin') || l.includes('hindi')) detected.add('HIN');
              else if (l.includes('tam') || l.includes('tamil')) detected.add('TAM');
              else if (l.includes('tel') || l.includes('telugu')) detected.add('TEL');
              else if (l.includes('mal') || l.includes('malayalam')) detected.add('MAL');
              else if (l.includes('kan') || l.includes('kannada')) detected.add('KAN');
              else if (l.includes('ben') || l.includes('bengali')) detected.add('BEN');
              else if (l.includes('eng') || l.includes('dub')) detected.add('DUB');
              else if (l.includes('jap') || l.includes('sub') || l.includes('japanese')) detected.add('SUB');
            }
          }
        }
      } catch {
        // ignore
      }
    }
  }

  if (detected.size === 0) {
    return ['SUB', 'DUB'];
  }

  return Array.from(detected);
}

export function unpackServerUrl(rawUrl: string, language: StreamLanguage = 'DUB'): string {
  if (!rawUrl) return rawUrl;
  if (rawUrl.includes('short.icu/')) {
    return rawUrl.replace('short.icu/', 'abyssplayer.com/');
  }
  if (rawUrl.includes('/public/player/') && rawUrl.includes('id=')) {
    try {
      const match = rawUrl.match(/[?&]id=([^&]+)/);
      if (match && match[1]) {
        return `https://pro.iqsmartgames.com/embed/${match[1]}`;
      }
    } catch {
      // fallback
    }
  }
  if (rawUrl.includes('multi.php?data=') || rawUrl.includes('data=')) {
    try {
      const match = rawUrl.match(/[?&]data=([^&]+)/);
      if (match && match[1]) {
        const decoded = atob(decodeURIComponent(match[1]));
        const list = JSON.parse(decoded);
        if (Array.isArray(list) && list.length > 0) {
          const reqLang = (language || '').toLowerCase();
          let target = list[0];

          const found = list.find((item: any) => {
            const l = (item.language || '').toLowerCase();
            if (reqLang === 'hin' || reqLang.includes('hin') || reqLang.includes('hindi')) {
              return l.includes('hin') || l.includes('hindi');
            }
            if (reqLang === 'tam' || reqLang.includes('tam') || reqLang.includes('tamil')) {
              return l.includes('tam') || l.includes('tamil');
            }
            if (reqLang === 'tel' || reqLang.includes('tel') || reqLang.includes('telugu')) {
              return l.includes('tel') || l.includes('telugu');
            }
            if (reqLang === 'mal' || reqLang.includes('mal') || reqLang.includes('malayalam')) {
              return l.includes('mal') || l.includes('malayalam');
            }
            if (reqLang === 'kan' || reqLang.includes('kan') || reqLang.includes('kannada')) {
              return l.includes('kan') || l.includes('kannada');
            }
            if (reqLang === 'ben' || reqLang.includes('ben') || reqLang.includes('bengali')) {
              return l.includes('ben') || l.includes('bengali');
            }
            if (reqLang === 'dub' || reqLang.includes('eng') || reqLang.includes('dub')) {
              return l.includes('eng') || l.includes('dub') || l.includes('english');
            }
            if (reqLang === 'sub' || reqLang.includes('jap') || reqLang.includes('sub')) {
              return l.includes('jap') || l.includes('sub') || l.includes('japanese');
            }
            return false;
          });

          if (found) {
            target = found;
          }

          if (target && target.link) {
            const slug = target.link.split('/').filter(Boolean).pop();
            if (slug) {
              return `https://abyssplayer.com/${slug}`;
            }
            return target.link.replace('short.icu', 'abyssplayer.com');
          }
        }
      }
    } catch {
      // fallback to rawUrl
    }
  }
  return rawUrl;
}

export async function probeHlsResolutions(playlistUrl: string): Promise<StreamResolution[]> {
  if (!playlistUrl || !playlistUrl.includes('.m3u8')) {
    return ['1080p', '720p', '480p'];
  }
  try {
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), 4000);
    const res = await fetch(playlistUrl, { signal: controller.signal });
    clearTimeout(timeoutId);

    if (res.ok) {
      const text = await res.text();
      const detected = new Set<StreamResolution>();
      const lines = text.split('\n');

      for (const line of lines) {
        if (line.includes('RESOLUTION=')) {
          const match = line.match(/RESOLUTION=(\d+)x(\d+)/i);
          if (match && (match[1] || match[2])) {
            const w = parseInt(match[1], 10);
            const h = parseInt(match[2], 10);
            const maxDim = Math.max(w, h);
            if (maxDim >= 1000) detected.add('1080p');
            else if (maxDim >= 700) detected.add('720p');
            else if (maxDim >= 400) detected.add('480p');
          }
        }
      }

      if (detected.size > 0) {
        const order: StreamResolution[] = ['1080p', '720p', '480p'];
        return order.filter(q => detected.has(q));
      }
    }
  } catch {
    // fallback
  }
  return ['1080p', '720p', '480p'];
}

const EPISODE_STREAM_CACHE = new Map<string, any>();
const HIANIME_EPISODE_CACHE = new Map<string, AvailableServerOption[]>();

export async function fetchHiAnimeApiServers(
  anilistId: number | string | undefined,
  animeTitle: string,
  episodeNumber: number,
  isOngoing?: boolean,
  refresh?: boolean
): Promise<AvailableServerOption[]> {
  const cacheKey = `${anilistId || animeTitle}_ep${episodeNumber}`;

  if (!refresh && HIANIME_EPISODE_CACHE.has(cacheKey)) {
    return HIANIME_EPISODE_CACHE.get(cacheKey) || [];
  }

  const queryParams = new URLSearchParams();
  if (anilistId) {
    queryParams.set('anilistId', String(anilistId));
    queryParams.set('ep', String(episodeNumber));
  } else {
    const cleanSlug = animeTitle.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '');
    queryParams.set('animeId', cleanSlug);
    queryParams.set('ep', String(episodeNumber));
  }

  if (isOngoing) queryParams.set('ongoing', 'true');
  if (refresh) queryParams.set('refresh', 'true');

  const reqUrl = `https://hianime-api-qqp7.onrender.com/stream.php?${queryParams.toString()}`;
  let data: any = null;

  try {
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), 2500);

    if (Capacitor.isNativePlatform()) {
      try {
        const httpRes = await CapacitorHttp.get({
          url: reqUrl,
          headers: { Accept: 'application/json' },
        });
        clearTimeout(timeoutId);
        if (httpRes.status === 200 && httpRes.data) {
          data = typeof httpRes.data === 'string' ? JSON.parse(httpRes.data) : httpRes.data;
        }
      } catch {
        // fallback
      }
    }

    if (!data) {
      const res = await fetch(reqUrl, {
        headers: { Accept: 'application/json' },
        signal: controller.signal,
      });
      clearTimeout(timeoutId);
      if (res.ok) {
        data = await res.json();
      }
    }
  } catch {
    // Non-blocking timeout or fetch error
  }

  const serverOptions: AvailableServerOption[] = [];

  if (data && data.success && data.stream && Array.isArray(data.stream.servers)) {
    const subServers = data.stream.servers.filter((s: any) => s.type === 'sub');
    const dubServers = data.stream.servers.filter((s: any) => s.type === 'dub');

    const letters = ['A', 'B', 'C', 'D', 'E'];

    subServers.forEach((s: any, idx: number) => {
      const code = `Server 2-${letters[idx] || (idx + 1)}-SUB`;
      serverOptions.push({
        name: code,
        type: 'SUB',
        linkId: unpackServerUrl(s.url, 'SUB'),
      });
    });

    dubServers.forEach((s: any, idx: number) => {
      const code = `Server 2-${letters[idx] || (idx + 1)}-DUB`;
      serverOptions.push({
        name: code,
        type: 'DUB',
        linkId: unpackServerUrl(s.url, 'DUB'),
      });
    });

    if (serverOptions.length > 0) {
      HIANIME_EPISODE_CACHE.set(cacheKey, serverOptions);
    }
  }

  return serverOptions;
}

/**
 * Stream resolver using AnimeWorld India v1 PHP API & HiAnime API with numeric anilistId + ep parameter.
 */
export async function resolveEpisodeSource({
  anime,
  episodeNumber,
  providerId = DEFAULT_STREAM_PROVIDER_ID,
  language = 'DUB',
  resolution = '1080p',
  serverName,
  refresh = false,
}: ResolveEpisodeSourceInput): Promise<ResolveEpisodeSourceResult> {
  const provider = ANIME_WORLD_V1;
  const anilistId = anime.id;
  const isOngoing = anime.status === 'RELEASING';

  const cacheKey = `${anilistId || anime.title}_ep${episodeNumber}_${language}`;

  let data: any = null;

  if (!refresh && EPISODE_STREAM_CACHE.has(cacheKey)) {
    data = EPISODE_STREAM_CACHE.get(cacheKey);
  }

  if (!data) {
    const queryParams = new URLSearchParams();

    if (anilistId) {
      queryParams.set('anilistId', String(anilistId));
      queryParams.set('ep', String(episodeNumber));
    } else {
      const englishTitle = anime.title?.english || anime.title?.romaji || anime.title?.userPreferred || 'Anime';
      const cleanSlug = englishTitle.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '');
      queryParams.set('id', `${cleanSlug}-season-1-1x${episodeNumber}`);
    }

    if (isOngoing) {
      queryParams.set('ongoing', 'true');
    }

    if (refresh) {
      queryParams.set('refresh', 'true');
    }

    const BASE_API = 'https://animeworld-india-api-njtl.onrender.com/api/anime-world-india/v1';
    const streamUrlReq = `${BASE_API}/stream.php?${queryParams.toString()}`;

    if (Capacitor.isNativePlatform()) {
      try {
        const httpRes = await CapacitorHttp.get({
          url: streamUrlReq,
          headers: { 'Accept': 'application/json' },
        });
        if (httpRes.status === 200 && httpRes.data) {
          data = typeof httpRes.data === 'string' ? JSON.parse(httpRes.data) : httpRes.data;
        }
      } catch {
        // Fallback
      }
    }

    if (!data) {
      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), 9500);

      try {
        const res = await fetch(streamUrlReq, {
          headers: { 'Accept': 'application/json' },
          signal: controller.signal,
        });
        if (res.ok) {
          data = await res.json();
        }
      } catch {
        // Fallback
      } finally {
        clearTimeout(timeoutId);
      }
    }

    if (data && data.success) {
      EPISODE_STREAM_CACHE.set(cacheKey, data);
    }
  }

  if (data && data.success && data.stream) {
    const streamInfo = data.stream;
    const rawServers: Array<{ name: string; url: string }> = streamInfo.servers || [];

    let targetServers: Array<{ name: string; url: string }> = [];

    // Filter raw servers: Server 3 is completely purged. Server 2 becomes Server 1-B.
    const filteredRaw = rawServers.filter(s => s.name === 'Server 1' || s.name === 'Server 2');

    if (filteredRaw.length > 0) {
      targetServers = filteredRaw.map(s => ({
        name: s.name === 'Server 2' ? 'Server 1-B' : s.name,
        url: s.url,
      }));
    } else if (rawServers.length > 0) {
      targetServers = rawServers
        .filter(s => s.name !== 'Server 3')
        .slice(0, 2)
        .map((s, idx) => ({
          name: idx === 1 ? 'Server 1-B' : 'Server 1',
          url: s.url,
        }));
    } else if (streamInfo.streamLink || streamInfo.file) {
      targetServers = [{ name: 'Server 1', url: streamInfo.streamLink || streamInfo.file }];
    }

    const availableLangs = extractAvailableLanguagesFromStreamData(rawServers);

    // Unpack URLs and apply STRICT RUBYSTM DOMAIN RULE for Server 1-B
    const processedServers: Array<{ name: string; url: string }> = [];

    for (const s of targetServers) {
      const unpackedUrl = unpackServerUrl(s.url, language);

      if (s.name === 'Server 1-B') {
        // STRICT RULE: Server 1-B appears ONLY IF its URL originates from rubystm (e.g. rubystm.com)
        const isRubyStm = unpackedUrl && unpackedUrl.toLowerCase().includes('rubystm');
        if (isRubyStm) {
          processedServers.push({ name: 'Server 1-B', url: unpackedUrl });
        }
        // If not rubystm (e.g. piratexplay.com), Server 1-B is omitted entirely!
      } else {
        processedServers.push({ name: s.name, url: unpackedUrl });
      }
    }

    // Ensure at least Server 1 exists
    if (processedServers.length === 0 && (streamInfo.streamLink || streamInfo.file)) {
      processedServers.push({
        name: 'Server 1',
        url: unpackServerUrl(streamInfo.streamLink || streamInfo.file, language),
      });
    }

    const availableServers: AvailableServerOption[] = processedServers.map(srv => ({
      name: srv.name,
      type: language,
      linkId: srv.url,
    }));

    // Query HiAnime API for Server 2 options safely (6 servers: 3 SUB, 3 DUB)
    let hiAnimeServers: AvailableServerOption[] = [];
    try {
      hiAnimeServers = await fetchHiAnimeApiServers(
        anilistId,
        anime.title?.english || anime.title?.romaji || anime.title?.userPreferred || 'Anime',
        episodeNumber,
        isOngoing,
        refresh
      );
    } catch {
      // Non-blocking fallback
    }

    const isSubMode = language === 'SUB' || language === 'JAP';
    const isDubMode = language === 'DUB' || language === 'ENG';

    // Include HiAnime sub/dub servers cleanly according to audio mode or include both if regional
    let matchedHiAnime = hiAnimeServers.filter(s => {
      if (isSubMode) return s.type === 'SUB';
      if (isDubMode) return s.type === 'DUB';
      return true; // For regional audio (HIN, TAM, TEL, etc.), present all HiAnime options
    });

    if (matchedHiAnime.length === 0 && hiAnimeServers.length > 0) {
      matchedHiAnime = hiAnimeServers;
    }

    const combinedAvailableServers: AvailableServerOption[] = [
      ...availableServers,
      ...matchedHiAnime,
    ];

    // Select requested server URL
    let selectedUrl = processedServers[0]?.url || streamInfo.streamLink || streamInfo.file;
    let selectedServerName = processedServers[0]?.name || 'Server 1';

    if (serverName) {
      const norm = serverName.toLowerCase().trim();

      // Check HiAnime servers if requested (e.g., Server 2-A-SUB, Server 2-B-DUB, Server 2-A)
      const matchedHi = hiAnimeServers.find(s => {
        const sNorm = s.name.toLowerCase();
        if (sNorm === norm) return true;
        if (norm.startsWith('server 2') && sNorm.startsWith(norm)) return true;
        if (norm.startsWith('server 2') && norm.startsWith(sNorm)) return true;
        return false;
      });

      if (matchedHi) {
        selectedUrl = matchedHi.linkId;
        selectedServerName = matchedHi.name;
      } else {
        const reqNorm = norm.replace(/server\s*2$/i, 'server 1-b');
        const matchedAw = processedServers.find(s => s.name.toLowerCase() === reqNorm);
        if (matchedAw) {
          selectedUrl = matchedAw.url;
          selectedServerName = matchedAw.name;
        }
      }
    }

    selectedUrl = unpackServerUrl(selectedUrl, language);
    const detectedResolutions = await probeHlsResolutions(selectedUrl);

    if (selectedUrl) {
      return {
        status: 'available',
        source: {
          provider,
          url: selectedUrl,
          language,
          resolution,
          isEmbeddable: true,
          external: false,
          skipData: { intro: [0, 0], outro: [0, 0] },
          availableServers: combinedAvailableServers,
          availableLanguages: availableLangs,
          availableResolutions: detectedResolutions,
          selectedServerName,
          isDubAvailable: true,
          isFallback: false,
          requestedLanguage: language,
          actualLanguage: language,
        },
      };
    }
  }

  // Direct fallback embed
  const directSource = createDirectStreamSource(anime, episodeNumber, provider, language, resolution, serverName);
  return {
    status: 'available',
    source: directSource,
  };
}
