import { Anime, StreamServerId } from '../types';
import { CapacitorHttp, Capacitor } from '@capacitor/core';

export type StreamLanguage = 'SUB' | 'DUB' | 'HIN' | 'TAM' | 'TEL' | 'MAL' | 'KAN' | 'BEN';
export type StreamResolution = 'auto' | '1080p' | '720p' | '480p' | '360p';

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
  intro: [number, number];
  outro: [number, number];
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
  qualityMap?: Record<string, string>;
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
  sourceName?: string;
  refresh?: boolean;
}

export interface ResolveEpisodeSourceResult {
  status: StreamSourceStatus;
  source?: StreamSource;
  message?: string;
}

// 20-Minute Local Cache Storage
interface CacheEntry {
  timestamp: number;
  data: any;
}

const CACHE_TTL_MS = 20 * 60 * 1000; // 20 Minutes
const STREAM_CACHE = new Map<string, CacheEntry>();

function getFromCache(key: string): any | null {
  const entry = STREAM_CACHE.get(key);
  if (!entry) return null;
  if (Date.now() - entry.timestamp > CACHE_TTL_MS) {
    STREAM_CACHE.delete(key);
    return null;
  }
  return entry.data;
}

function setToCache(key: string, data: any): void {
  STREAM_CACHE.set(key, {
    timestamp: Date.now(),
    data,
  });
}

// Universal Stream Providers
const DEFAULT_PROVIDER: StreamProvider = {
  id: 'anime-world-v1',
  label: 'AniLove Universal',
  category: 'official',
  description: 'AniLove Multi-Source Stream Resolver Engine',
  supportedLanguages: ['SUB', 'DUB', 'HIN', 'TAM', 'TEL'],
  tag: 'v1',
};

export const STREAM_PROVIDERS: StreamProvider[] = [DEFAULT_PROVIDER];
export const DEFAULT_STREAM_PROVIDER_ID: StreamServerId = 'anime-world-v1';

export const isStreamProviderId = (providerId: string): providerId is StreamServerId =>
  STREAM_PROVIDERS.some(provider => provider.id === providerId);

/**
 * Universal Fetch Helper supporting CapacitorHttp (Native Android) and standard fetch (Web)
 */
async function fetchWithTimeout(url: string, headers: Record<string, string> = {}, timeoutMs: number = 9000): Promise<any> {
  if (Capacitor.isNativePlatform()) {
    try {
      const httpRes = await CapacitorHttp.get({
        url,
        headers: { Accept: 'application/json', ...headers },
      });
      if (httpRes.status >= 200 && httpRes.status < 300 && httpRes.data) {
        return typeof httpRes.data === 'string' ? JSON.parse(httpRes.data) : httpRes.data;
      }
    } catch (e) {
      console.warn('[CapacitorHttp] Native fetch error:', e);
    }
  }

  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeoutMs);
  try {
    const res = await fetch(url, {
      headers: { Accept: 'application/json', ...headers },
      signal: controller.signal,
    });
    if (res.ok) {
      return await res.json();
    }
  } catch (e) {
    console.warn('[WebFetch] Fetch error:', e);
  } finally {
    clearTimeout(timer);
  }
  return null;
}

/**
 * Clean Title Sanitization for MovieBox & AnimeSalt Search Queries
 */
function cleanTitleForQuery(title: string): string {
  if (!title) return 'Anime';
  return title
    .replace(/\s*\(.*?\)/g, '')
    .replace(/\s*\[.*?\]/g, '')
    .replace(/:\s*Season\s*\d+.*/i, '')
    .replace(/\s+Season\s*\d+.*/i, '')
    .replace(/:\s*Part\s*\d+.*/i, '')
    .replace(/:\s*2nd\s*Season.*/i, '')
    .replace(/:\s*3rd\s*Season.*/i, '')
    .trim();
}

/**
 * ─────────────────────────────────────────────────────────────
 * SOURCE 1: AnimeDekho Engine
 * ─────────────────────────────────────────────────────────────
 * Priority Target Order:
 * 1. rubystm
 * 2. piratexplay
 * 3. blakiteapi
 * 4. vidmoly
 * 5. abyssplayer
 * Dynamic Decrement: Only available targets are collected, sequentially named Server 1, Server 2...
 */
async function resolveAnimeDekhoSource(
  anilistId: number | undefined,
  episodeNumber: number,
  title: string,
  serverName?: string,
  refresh: boolean = false
): Promise<{ availableServers: AvailableServerOption[]; selectedUrl: string; selectedServerName: string }> {
  const cacheKey = `AnimeDekho_${anilistId || title}_ep${episodeNumber}`;

  let rawServers: Array<{ name: string; url: string }> = [];

  if (!refresh) {
    const cached = getFromCache(cacheKey);
    if (cached) {
      rawServers = cached;
    }
  }

  if (!rawServers || rawServers.length === 0) {
    const epNum = episodeNumber || 1;
    let apiUrl = `https://animeworld-india-api-njtl.onrender.com/api/anime-world-india/v1/stream.php?anilistId=${anilistId || 113415}&ep=${epNum}`;

    const res = await fetchWithTimeout(apiUrl);
    if (res && res.success && res.stream && Array.isArray(res.stream.servers)) {
      rawServers = res.stream.servers;
      setToCache(cacheKey, rawServers);
    }
  }

  // Target Priorities
  const rubyMatch = rawServers.find(s => s.url && s.url.toLowerCase().includes('rubystm'));
  const pirateMatch = rawServers.find(s => s.url && s.url.toLowerCase().includes('piratexplay'));
  const blakiteMatch = rawServers.find(s => s.url && (s.url.toLowerCase().includes('blakiteapi') || s.url.toLowerCase().includes('blaketapi') || s.url.toLowerCase().includes('animedekho.piratexplay.com')));
  const vidmolyMatch = rawServers.find(s => s.url && (s.url.toLowerCase().includes('vidmoly.biz') || s.url.toLowerCase().includes('vidmoly.net') || s.url.toLowerCase().includes('vidmoly')));
  const abyssMatch = rawServers.find(s => s.url && (s.url.toLowerCase().includes('abyssplayer.com') || s.url.toLowerCase().includes('short.icu') || s.url.toLowerCase().includes('abyss')));

  // Filter existing candidates in priority order
  const candidates: Array<{ codeKey: string; url: string }> = [];
  if (rubyMatch) candidates.push({ codeKey: 'rubystm', url: rubyMatch.url });
  if (pirateMatch) candidates.push({ codeKey: 'piratexplay', url: pirateMatch.url });
  if (blakiteMatch) candidates.push({ codeKey: 'blakiteapi', url: blakiteMatch.url });
  if (vidmolyMatch) candidates.push({ codeKey: 'vidmoly', url: vidmolyMatch.url });
  if (abyssMatch) {
    let abyssUrl = abyssMatch.url;
    if (abyssUrl.includes('short.icu/')) {
      abyssUrl = abyssUrl.replace('short.icu/', 'abyssplayer.com/');
    }
    candidates.push({ codeKey: 'abyssplayer', url: abyssUrl });
  }

  // Map to dynamic Server 1, Server 2, Server 3...
  const availableServers: AvailableServerOption[] = candidates.map((cand, idx) => ({
    name: `Server ${idx + 1}`,
    type: 'SUB/DUB',
    linkId: cand.url,
  }));

  if (availableServers.length === 0) {
    // Fallback if no specific match
    availableServers.push({
      name: 'Server 1',
      type: 'SUB/DUB',
      linkId: `https://vidlink.pro/anime/${anilistId || 113415}/${episodeNumber}`,
    });
  }

  let selectedOption = availableServers[0];

  if (serverName) {
    const normReq = serverName.toLowerCase().replace(/[^a-z0-9]/g, '');
    const matched = availableServers.find(s => {
      const sNorm = s.name.toLowerCase().replace(/[^a-z0-9]/g, '');
      return sNorm === normReq || normReq.includes(sNorm) || sNorm.includes(normReq);
    });
    if (matched) {
      selectedOption = matched;
    }
  }

  return {
    availableServers,
    selectedUrl: selectedOption.linkId,
    selectedServerName: selectedOption.name,
  };
}

/**
 * ─────────────────────────────────────────────────────────────
 * SOURCE 2: HiAnime Engine
 * ─────────────────────────────────────────────────────────────
 * Server 1 (Vidnest): https://vidnest.fun/anime/{id}/{ep}/{sub/dub}
 * Server 2 (Tryembed): https://tryembed.us.cc/embed/anime/{id}/{ep}/{sub/dub}
 * Server 3 (Animepahe): https://vidnest.fun/animepahe/{id}/{ep}/{sub/dub}
 */
function resolveHiAnimeSource(
  anilistId: number | undefined,
  episodeNumber: number,
  language: StreamLanguage = 'SUB',
  serverName?: string
): { availableServers: AvailableServerOption[]; selectedUrl: string; selectedServerName: string } {
  const id = anilistId || 113415;
  const ep = episodeNumber || 1;
  const subOrDub = (language === 'DUB' || language === 'ENG' || language === 'HIN') ? 'dub' : 'sub';

  const availableServers: AvailableServerOption[] = [
    {
      name: 'Server 1',
      type: subOrDub.toUpperCase(),
      linkId: `https://vidnest.fun/anime/${id}/${ep}/${subOrDub}`,
    },
    {
      name: 'Server 2',
      type: subOrDub.toUpperCase(),
      linkId: `https://tryembed.us.cc/embed/anime/${id}/${ep}/${subOrDub}`,
    },
    {
      name: 'Server 3',
      type: subOrDub.toUpperCase(),
      linkId: `https://vidnest.fun/animepahe/${id}/${ep}/${subOrDub}`,
    },
  ];

  let selectedOption = availableServers[0];

  if (serverName) {
    const normReq = serverName.toLowerCase().replace(/[^a-z0-9]/g, '');
    if (normReq.includes('server2') || normReq.endsWith('2')) {
      selectedOption = availableServers[1];
    } else if (normReq.includes('server3') || normReq.endsWith('3')) {
      selectedOption = availableServers[2];
    }
  }

  return {
    availableServers,
    selectedUrl: selectedOption.linkId,
    selectedServerName: selectedOption.name,
  };
}

/**
 * ─────────────────────────────────────────────────────────────
 * SOURCE 3: AnimeSalt Engine
 * ─────────────────────────────────────────────────────────────
 * API: https://animesalt-api-omega.vercel.app/api/stream?id=$animeSlug&ep=ep-$episodeNumber
 */
async function resolveAnimeSaltSource(
  title: string,
  episodeNumber: number,
  anilistId?: number,
  refresh: boolean = false
): Promise<{ availableServers: AvailableServerOption[]; selectedUrl: string; selectedServerName: string }> {
  const cacheKey = `AnimeSalt_${anilistId || title}_ep${episodeNumber}`;

  if (!refresh) {
    const cached = getFromCache(cacheKey);
    if (cached) {
      return cached;
    }
  }

  const cleanTitle = cleanTitleForQuery(title).toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '');
  const slugCandidates = [
    `${cleanTitle}-season-1`,
    cleanTitle,
  ];

  let embedUrl = `https://animesalt-api-omega.vercel.app/api/stream?id=${encodeURIComponent(slugCandidates[0])}&ep=ep-${episodeNumber}`;

  for (const slug of slugCandidates) {
    const apiUrl = `https://animesalt-api-omega.vercel.app/api/stream?id=${encodeURIComponent(slug)}&ep=ep-${episodeNumber}`;
    const res = await fetchWithTimeout(apiUrl);
    if (res && res.success && res.data && res.data.embedUrl) {
      embedUrl = res.data.embedUrl;
      break;
    }
  }

  const result = {
    availableServers: [{ name: 'Server 1', type: 'SUB', linkId: embedUrl }],
    selectedUrl: embedUrl,
    selectedServerName: 'Server 1',
  };

  setToCache(cacheKey, result);
  return result;
}

/**
 * ─────────────────────────────────────────────────────────────
 * SOURCE 4: MovieBox Engine
 * ─────────────────────────────────────────────────────────────
 * API: https://moviebox-api-mklm.onrender.com/api/stream-by-name?title={title}&se=1&ep={ep}
 */
async function resolveMovieBoxSource(
  title: string,
  seasonNumber: number = 1,
  episodeNumber: number = 1,
  requestedResolution: StreamResolution = '1080p',
  refresh: boolean = false
): Promise<{
  availableServers: AvailableServerOption[];
  selectedUrl: string;
  selectedServerName: string;
  availableResolutions: StreamResolution[];
  qualityMap: Record<string, string>;
  subtitleUrl?: string;
}> {
  const cleanTitle = cleanTitleForQuery(title);
  const cacheKey = `MovieBox_${cleanTitle}_s${seasonNumber}_ep${episodeNumber}`;

  let cachedData = null;
  if (!refresh) {
    cachedData = getFromCache(cacheKey);
  }

  if (!cachedData) {
    const reqUrl = `https://moviebox-api-mklm.onrender.com/api/stream-by-name?title=${encodeURIComponent(cleanTitle)}&se=${seasonNumber}&ep=${episodeNumber}&include_captions=true`;
    const res = await fetchWithTimeout(reqUrl);

    if (res && res.has_resource && Array.isArray(res.sources) && res.sources.length > 0) {
      const qualityMap: Record<string, string> = {};
      const resList: StreamResolution[] = [];

      res.sources.forEach((src: any) => {
        if (src.url) {
          const resKey: StreamResolution = (src.resolution || '1080p') as StreamResolution;
          qualityMap[resKey] = src.url;
          if (!resList.includes(resKey)) {
            resList.push(resKey);
          }
        }
      });

      let subtitleUrl: string | undefined = undefined;
      if (res.captions && Array.isArray(res.captions) && res.captions.length > 0) {
        subtitleUrl = res.captions[0].url;
      }

      cachedData = {
        qualityMap,
        availableResolutions: resList,
        primaryUrl: res.sources[0].url,
        subtitleUrl,
      };
      setToCache(cacheKey, cachedData);
    }
  }

  if (!cachedData || !cachedData.qualityMap) {
    return {
      availableServers: [{ name: 'Server 1', type: 'DUB', linkId: '' }],
      selectedUrl: '',
      selectedServerName: 'Server 1',
      availableResolutions: ['1080p'],
      qualityMap: {},
    };
  }

  const { qualityMap, availableResolutions, primaryUrl, subtitleUrl } = cachedData;

  // Pick requested resolution or best available
  let selectedUrl = qualityMap[requestedResolution] || primaryUrl;

  return {
    availableServers: [{ name: 'Server 1', type: 'DUB', linkId: selectedUrl }],
    selectedUrl,
    selectedServerName: 'Server 1',
    availableResolutions,
    qualityMap,
    subtitleUrl,
  };
}

/**
 * ─────────────────────────────────────────────────────────────
 * MAIN RESOLVE EPISODE SOURCE RESOLVER
 * ─────────────────────────────────────────────────────────────
 */
export async function resolveEpisodeSource({
  anime,
  episodeNumber,
  providerId = DEFAULT_STREAM_PROVIDER_ID,
  language = 'DUB',
  resolution = '1080p',
  serverName,
  sourceName,
  refresh = false,
}: ResolveEpisodeSourceInput): Promise<ResolveEpisodeSourceResult> {
  const englishTitle = anime.title?.english || anime.title?.romaji || anime.title?.userPreferred || 'Anime';
  const anilistId = anime.id;

  const reqSrc = (sourceName || '').toLowerCase().trim();
  const reqServer = (serverName || '').toLowerCase().trim();
  const combined = `${reqSrc} ${reqServer}`;

  // ROUTE 1: MovieBox Source
  if (combined.includes('moviebox')) {
    const mb = await resolveMovieBoxSource(englishTitle, 1, episodeNumber, resolution, refresh);
    if (!mb.selectedUrl) {
      return {
        status: 'error',
        message: `MovieBox stream is not available for Episode ${episodeNumber}. Please switch to AnimeDekho or HiAnime.`,
      };
    }
    return {
      status: 'available',
      source: {
        provider: DEFAULT_PROVIDER,
        url: mb.selectedUrl,
        subtitleUrl: mb.subtitleUrl,
        subtitleLang: 'English',
        language,
        resolution,
        isEmbeddable: true,
        external: false,
        skipData: { intro: [0, 0], outro: [0, 0] },
        availableServers: mb.availableServers,
        availableLanguages: ['SUB', 'DUB'],
        availableResolutions: mb.availableResolutions,
        qualityMap: mb.qualityMap,
        selectedServerName: mb.selectedServerName,
        isDubAvailable: true,
      },
    };
  }

  // ROUTE 2: HiAnime Source
  if (combined.includes('hianime')) {
    const hi = resolveHiAnimeSource(anilistId, episodeNumber, language, serverName);
    return {
      status: 'available',
      source: {
        provider: DEFAULT_PROVIDER,
        url: hi.selectedUrl,
        language,
        resolution,
        isEmbeddable: true,
        external: false,
        skipData: { intro: [0, 0], outro: [0, 0] },
        availableServers: hi.availableServers,
        availableLanguages: ['SUB', 'DUB'],
        availableResolutions: ['1080p'],
        selectedServerName: hi.selectedServerName,
        isDubAvailable: true,
      },
    };
  }

  // ROUTE 3: AnimeSalt Source
  if (combined.includes('animesalt')) {
    const salt = await resolveAnimeSaltSource(englishTitle, episodeNumber, anilistId, refresh);
    return {
      status: 'available',
      source: {
        provider: DEFAULT_PROVIDER,
        url: salt.selectedUrl,
        language,
        resolution,
        isEmbeddable: true,
        external: false,
        skipData: { intro: [0, 0], outro: [0, 0] },
        availableServers: salt.availableServers,
        availableLanguages: ['SUB'],
        availableResolutions: ['1080p'],
        selectedServerName: salt.selectedServerName,
        isDubAvailable: true,
      },
    };
  }

  // ROUTE 4: AnimeDekho Source (Default)
  const dekho = await resolveAnimeDekhoSource(anilistId, episodeNumber, englishTitle, serverName, refresh);
  return {
    status: 'available',
    source: {
      provider: DEFAULT_PROVIDER,
      url: dekho.selectedUrl,
      language,
      resolution,
      isEmbeddable: true,
      external: false,
      skipData: { intro: [0, 0], outro: [0, 0] },
      availableServers: dekho.availableServers,
      availableLanguages: ['SUB', 'DUB', 'HIN', 'TAM', 'TEL'],
      availableResolutions: ['1080p', '720p', '480p'],
      selectedServerName: dekho.selectedServerName,
      isDubAvailable: true,
    },
  };
}

export function createDirectStreamSource(
  anime: Anime,
  episodeNumber: number,
  provider: StreamProvider = DEFAULT_PROVIDER,
  language: StreamLanguage = 'DUB',
  resolution: StreamResolution = '1080p',
  serverName?: string
): StreamSource {
  return {
    provider: provider || DEFAULT_PROVIDER,
    url: '',
    language,
    resolution,
    isEmbeddable: true,
    external: false,
    skipData: { intro: [0, 0], outro: [0, 0] },
    availableServers: [],
    availableLanguages: ['SUB', 'DUB'],
    availableResolutions: ['1080p'],
    selectedServerName: serverName || 'Server 1',
    isDubAvailable: true,
    isFallback: false,
    requestedLanguage: language,
    actualLanguage: language,
  };
}
