import { Anime, StreamServerId } from '../types';
import { API_BASE, apiFetch, apiUrl } from './api';

export type StreamLanguage = 'SUB' | 'DUB' | 'HIN';
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
  supportedLanguages: ['SUB', 'DUB', 'HIN'],
  tag: 'v1 Ultra',
  apiEndpoint: '/api/anime-world-india/v1/stream',
};

export const STREAM_PROVIDERS: StreamProvider[] = [ANIME_WORLD_V1];

export const DEFAULT_STREAM_PROVIDER_ID: StreamServerId = 'anime-world-v1';

export const isStreamProviderId = (providerId: string): providerId is StreamServerId =>
  STREAM_PROVIDERS.some(provider => provider.id === providerId);

export function generateAnimeWorldSlug(anime: Anime, episodeNumber: number): { episodeId?: string; movieId?: string } {
  const isMovie = anime.format === 'MOVIE';
  const englishTitle = anime.title?.english || '';
  const romajiTitle = anime.title?.romaji || '';
  const userTitle = anime.title?.userPreferred || '';
  const displayTitle = englishTitle || romajiTitle || userTitle || 'Anime';
  const cleanTitle = displayTitle.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '');
  const anilistId = anime.id || 1;
  const seasonNum = (anime as any).seasonNumber || (anime as any).season || 1;
  const year = anime.startDate?.year || (anime as any).year || 2024;

  if (isMovie) {
    return {
      movieId: `${cleanTitle}-${year}-${anilistId}`,
    };
  }

  return {
    episodeId: `${cleanTitle}-season-${seasonNum}-${anilistId}-${seasonNum}x${episodeNumber}`,
  };
}

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
    { name: 'VidLink Ultra HD', type: isDub ? 'DUB' : 'SUB', linkId: `https://vidlink.pro/anime/${anilistId}/${episodeNumber}?dub=${isDub ? 'true' : 'false'}` },
    { name: 'AutoEmbed Multi-Source', type: isDub ? 'DUB' : 'SUB', linkId: `https://autoembed.co/anime/anilist/${anilistId}/${episodeNumber}?dub=${isDub ? 1 : 0}` },
    { name: 'VidSrc Fast Mirror', type: isDub ? 'DUB' : 'SUB', linkId: `https://vidsrc.cc/v2/embed/anime/${anilistId}/${episodeNumber}?dub=${isDub ? 'true' : 'false'}` },
  ];

  let selectedUrl = availableServers[0].linkId;
  let selectedServerName = availableServers[0].name;

  if (serverName) {
    const matched = availableServers.find(s => s.name.toLowerCase().includes(serverName.toLowerCase()));
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
    availableLanguages: ['SUB', 'DUB', 'HIN'],
    selectedServerName,
    isDubAvailable: true,
    isFallback: true,
    requestedLanguage: language,
    actualLanguage: language,
  };
}

/**
 * Universal episode stream resolver using custom AnimeWorld India v1 PHP Stream API
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
  const anilistId = anime.id || 1;
  const isOngoing = anime.status === 'RELEASING';
  const slugs = generateAnimeWorldSlug(anime, episodeNumber);

  const queryParams = new URLSearchParams();

  if (slugs.movieId) {
    queryParams.set('movieId', slugs.movieId);
  } else if (slugs.episodeId) {
    queryParams.set('id', slugs.episodeId);
  } else {
    queryParams.set('id', `anime-${anilistId}-1x${episodeNumber}`);
  }

  if (isOngoing) {
    queryParams.set('ongoing', 'true');
  }

  if (refresh) {
    queryParams.set('refresh', 'true');
  }

  const endpoint = `/api/anime-world-india/v1/stream?${queryParams.toString()}`;

  try {
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), 8500);

    let res: Response;
    try {
      res = await apiFetch(endpoint, {
        method: 'GET',
        headers: {
          'Accept': 'application/json',
        },
        signal: controller.signal,
      });
    } finally {
      clearTimeout(timeoutId);
    }

    if (res.ok) {
      const data = await res.json();
      if (data.success && data.stream) {
        const streamInfo = data.stream;
        const mainUrl = streamInfo.streamLink || streamInfo.file || (streamInfo.servers?.[0]?.url);

        const availableServers: AvailableServerOption[] = (streamInfo.servers || []).map((srv: any, idx: number) => ({
          name: srv.name || `Server ${idx + 1}`,
          type: language,
          linkId: srv.url || mainUrl,
        }));

        let selectedUrl = mainUrl;
        let selectedServerName = availableServers[0]?.name || 'Server 1';

        if (serverName) {
          const matched = availableServers.find(s => s.name.toLowerCase().includes(serverName.toLowerCase()));
          if (matched) {
            selectedUrl = matched.linkId;
            selectedServerName = matched.name;
          }
        }

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
              availableLanguages: ['SUB', 'DUB', 'HIN'],
              selectedServerName,
              isDubAvailable: true,
              isFallback: false,
              requestedLanguage: language,
              actualLanguage: language,
            },
          };
        }
      }
    }

    // Fall back to direct embed source if primary API endpoint is unreachable
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
