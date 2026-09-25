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
    { name: 'Server 2', type: isDub ? 'DUB' : 'SUB', linkId: `https://autoembed.co/anime/anilist/${anilistId}/${episodeNumber}?dub=${isDub ? 1 : 0}` },
    { name: 'Server 3', type: isDub ? 'DUB' : 'SUB', linkId: `https://vidsrc.cc/v2/embed/anime/${anilistId}/${episodeNumber}?dub=${isDub ? 'true' : 'false'}` },
  ];

  let selectedUrl = availableServers[0].linkId;
  let selectedServerName = availableServers[0].name;

  if (serverName) {
    const matched = availableServers.find(s => s.name.toLowerCase() === serverName.toLowerCase());
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
    return ['720p', '480p'];
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
          if (match && match[2]) {
            const h = parseInt(match[2], 10);
            if (h >= 1000) detected.add('1080p');
            else if (h >= 700) detected.add('720p');
            else if (h >= 400) detected.add('480p');
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
  return ['720p', '480p'];
}

const EPISODE_STREAM_CACHE = new Map<string, any>();

/**
 * Stream resolver using AnimeWorld India v1 PHP API with numeric anilistId + ep parameter.
 * Fetches exclusively Server 1, Server 2, and Server 3.
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

    const explicitNamed = rawServers.filter(s =>
      s.name === 'Server 1' || s.name === 'Server 2' || s.name === 'Server 3'
    );

    if (explicitNamed.length > 0) {
      targetServers = explicitNamed;
    } else if (rawServers.length > 0) {
      targetServers = rawServers.slice(0, 3).map((s, idx) => ({
        name: `Server ${idx + 1}`,
        url: s.url,
      }));
    } else if (streamInfo.streamLink || streamInfo.file) {
      targetServers = [{ name: 'Server 1', url: streamInfo.streamLink || streamInfo.file }];
    }

    const availableLangs = extractAvailableLanguagesFromStreamData(rawServers);

    targetServers = targetServers.map(s => ({
      name: s.name,
      url: unpackServerUrl(s.url, language),
    }));

    const availableServers: AvailableServerOption[] = targetServers.map(srv => ({
      name: srv.name,
      type: language,
      linkId: srv.url,
    }));

    let selectedServer = targetServers[0];
    if (serverName) {
      const matched = targetServers.find(s => s.name.toLowerCase() === serverName.toLowerCase());
      if (matched) {
        selectedServer = matched;
      }
    }

    const selectedUrl = unpackServerUrl(selectedServer?.url || streamInfo.streamLink || streamInfo.file, language);
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
          availableServers,
          availableLanguages: availableLangs,
          availableResolutions: detectedResolutions,
          selectedServerName: selectedServer?.name || 'Server 1',
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
