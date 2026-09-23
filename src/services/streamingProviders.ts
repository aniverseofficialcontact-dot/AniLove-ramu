import { Anime, StreamServerId } from '../types';
import { API_BASE, apiFetch, apiUrl } from './api';

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

  try {
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), 9500);

    let res: Response;
    try {
      res = await fetch(streamUrlReq, {
        headers: { 'Accept': 'application/json' },
        signal: controller.signal,
      });
    } finally {
      clearTimeout(timeoutId);
    }

    if (res.ok) {
      const data = await res.json();
      if (data.success && data.stream) {
        const streamInfo = data.stream;
        const rawServers: Array<{ name: string; url: string }> = streamInfo.servers || [];

        // STRICT FILTER: Keep ONLY Server 1, Server 2, and Server 3
        let targetServers = rawServers.filter(s =>
          s.name === 'Server 1' || s.name === 'Server 2' || s.name === 'Server 3'
        );

        if (targetServers.length === 0 && (streamInfo.streamLink || streamInfo.file)) {
          targetServers = [{ name: 'Server 1', url: streamInfo.streamLink || streamInfo.file }];
        }

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

        const selectedUrl = selectedServer?.url || streamInfo.streamLink || streamInfo.file;

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
              availableLanguages: ['SUB', 'DUB', 'HIN', 'TAM', 'TEL', 'MAL', 'KAN', 'BEN'],
              selectedServerName: selectedServer?.name || 'Server 1',
              isDubAvailable: true,
              isFallback: false,
              requestedLanguage: language,
              actualLanguage: language,
            },
          };
        }
      }
    }

    // Direct fallback embed
    const directSource = createDirectStreamSource(anime, episodeNumber, provider, language, resolution, serverName);
    return {
      status: 'available',
      source: directSource,
    };
  } catch (_err) {
    const directSource = createDirectStreamSource(anime, episodeNumber, provider, language, resolution, serverName);
    return {
      status: 'available',
      source: directSource,
    };
  }
}
