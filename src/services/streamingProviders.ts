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
  category: 'anify' | 'miruro' | 'renime' | 'official';
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
  type: string; // SUB, DUB, HIN, TAM, TEL
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
}

export interface ResolveEpisodeSourceResult {
  status: StreamSourceStatus;
  source?: StreamSource;
  message?: string;
}

// 1. Anify Cloud (Primary Multi-Quality Engine)
const ANIFY_CLOUD: StreamProvider = {
  id: 'anify-cloud',
  label: 'Anify Cloud',
  category: 'anify',
  description: 'Primary high-speed multi-quality stream engine.',
  supportedLanguages: ['SUB', 'DUB'],
  tag: 'Multi-Quality',
  apiEndpoint: '/api/anify/resolve',
};

// 2. Miruro HD (High Definition Stream Mirror)
const MIRURO_HD: StreamProvider = {
  id: 'miruro-stream',
  label: 'Miruro HD',
  category: 'miruro',
  description: 'High definition fast streaming server.',
  supportedLanguages: ['SUB', 'DUB'],
  tag: 'Fast HD',
  apiEndpoint: '/api/miruro/resolve',
};

// 3. Renime Multi (Multi-Source Stream Engine)
const RENIME_MULTI: StreamProvider = {
  id: 'renime-dub',
  label: 'Renime Multi',
  category: 'renime',
  description: 'Multi-source reliable stream mirror.',
  supportedLanguages: ['SUB', 'DUB'],
  tag: 'Multi-Source',
  apiEndpoint: '/api/renime/resolve',
};

// 4. Official Universal (Universal Embed Server)
const OFFICIAL_LINK: StreamProvider = {
  id: 'official-link',
  label: 'Official Universal',
  category: 'official',
  description: 'Universal multi-server embed network.',
  supportedLanguages: ['SUB', 'DUB', 'HIN'],
  tag: 'Universal',
  apiEndpoint: '/api/stream/resolve',
};

export const STREAM_PROVIDERS: StreamProvider[] = [
  ANIFY_CLOUD,
  MIRURO_HD,
  RENIME_MULTI,
  OFFICIAL_LINK,
];

export const DEFAULT_STREAM_PROVIDER_ID: StreamServerId = 'anify-cloud';

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
    { name: 'VidLink Ultra HD', type: isDub ? 'DUB' : 'SUB', linkId: `https://vidlink.pro/anime/${anilistId}/${episodeNumber}?dub=${isDub ? 'true' : 'false'}` },
    { name: 'AutoEmbed Multi-Source', type: isDub ? 'DUB' : 'SUB', linkId: `https://autoembed.co/anime/anilist/${anilistId}/${episodeNumber}?dub=${isDub ? 1 : 0}` },
    { name: 'VidSrc Fast Mirror', type: isDub ? 'DUB' : 'SUB', linkId: `https://vidsrc.cc/v2/embed/anime/${anilistId}/${episodeNumber}?dub=${isDub ? 'true' : 'false'}` },
    { name: 'Pahe Compact Stream', type: 'SUB', linkId: `https://player.smashystream.com/anime/${anilistId}/${episodeNumber}` },
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
    isFallback: true,
    requestedLanguage: language,
    actualLanguage: language,
  };
}

/**
 * Universal episode stream resolver supporting Anify, Miruro, Renime, and Universal Embed CDNs
 */
export async function resolveEpisodeSource({
  anime,
  episodeNumber,
  providerId = DEFAULT_STREAM_PROVIDER_ID,
  language = 'DUB',
  resolution = '1080p',
  serverName,
}: ResolveEpisodeSourceInput): Promise<ResolveEpisodeSourceResult> {
  const targetProviderId = (providerId as StreamServerId) || DEFAULT_STREAM_PROVIDER_ID;
  let provider = STREAM_PROVIDERS.find(item => item.id === targetProviderId) || ANIFY_CLOUD;

  const englishTitle = anime.title?.english || '';
  const romajiTitle = anime.title?.romaji || '';
  const userTitle = anime.title?.userPreferred || '';
  const nativeTitle = anime.title?.native || '';
  const synonyms = (anime as any).synonyms || [];
  const animeTitle = englishTitle || romajiTitle || userTitle || 'Anime';
  const seasonNumber = (anime as any).seasonNumber || (anime as any).season || undefined;
  const anilistId = anime.id || 1;

  let desiredServerName = serverName;
  if (!desiredServerName && provider.serverMatch) {
    desiredServerName = provider.serverMatch;
  }

  const endpoint = provider.apiEndpoint || '/api/stream/resolve';

  try {
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), 7500);

    let res: Response;
    try {
      res = await apiFetch(endpoint, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          anilistId,
          providerId: provider.id,
          category: provider.category,
          animeTitle,
          romajiTitle,
          englishTitle,
          nativeTitle,
          synonyms,
          episodeNumber,
          seasonNumber,
          language,
          serverName: desiredServerName,
          format: anime.format || 'TV',
        }),
        signal: controller.signal,
      });
    } finally {
      clearTimeout(timeoutId);
    }

    if (res.ok) {
      const data = await res.json();
      if (data.success && data.streamUrl) {
        return {
          status: 'available',
          source: {
            provider,
            url: data.streamUrl,
            language: (data.language as StreamLanguage) || language,
            resolution,
            isEmbeddable: true,
            external: false,
            skipData: data.skipData,
            availableServers: data.availableServers,
            availableLanguages: (data.availableLanguages as StreamLanguage[]) || ['SUB', 'DUB'],
            selectedServerName: data.selectedServer || desiredServerName,
            isDubAvailable: Boolean(
              data.isDubAvailable ??
                data.availableServers?.some((s: any) =>
                  ['DUB', 'ENG', 'ENGLISH', 'DUAL'].includes(s.type?.toUpperCase())
                )
            ),
            isFallback: Boolean(data.isFallback),
            fallbackReason: data.fallbackReason,
            requestedLanguage: data.requestedLanguage || language,
            actualLanguage: data.actualLanguage || data.language || language,
            subtitleUrl: data.subtitleUrl ? apiUrl(`/api/proxy/subtitle?url=${encodeURIComponent(data.subtitleUrl)}`) : undefined,
            subtitleLang: data.subtitleLang || 'English',
          },
        };
      }
    }

    // If specific provider endpoint returned non-ok, attempt universal fallback endpoint with short timeout
    if (endpoint !== '/api/stream/resolve') {
      try {
        const fbController = new AbortController();
        const fbTimeoutId = setTimeout(() => fbController.abort(), 3500);
        const fallbackRes = await apiFetch('/api/stream/resolve', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            anilistId,
            providerId: 'universal',
            category: 'universal',
            animeTitle,
            romajiTitle,
            englishTitle,
            nativeTitle,
            synonyms,
            episodeNumber,
            language,
            serverName: desiredServerName,
            format: anime.format || 'TV',
          }),
          signal: fbController.signal,
        }).finally(() => clearTimeout(fbTimeoutId));

        if (fallbackRes.ok) {
          const fbData = await fallbackRes.json();
          if (fbData.success && fbData.streamUrl) {
            return {
              status: 'available',
              source: {
                provider,
                url: fbData.streamUrl,
                language: (fbData.language as StreamLanguage) || language,
                resolution,
                isEmbeddable: true,
                external: false,
                skipData: fbData.skipData,
                availableServers: fbData.availableServers,
                availableLanguages: (fbData.availableLanguages as StreamLanguage[]) || ['SUB', 'DUB'],
                selectedServerName: fbData.selectedServer || desiredServerName,
                isDubAvailable: Boolean(fbData.isDubAvailable),
                isFallback: Boolean(fbData.isFallback),
                fallbackReason: fbData.fallbackReason,
                requestedLanguage: fbData.requestedLanguage || language,
                actualLanguage: fbData.actualLanguage || fbData.language || language,
                subtitleUrl: fbData.subtitleUrl,
                subtitleLang: fbData.subtitleLang || 'English',
              },
            };
          }
        }
      } catch {
        // Fallback to direct client stream below
      }
    }

    // Fall back to direct resilient multi-source embed stream
    const directSource = createDirectStreamSource(anime, episodeNumber, provider, language, resolution, desiredServerName);
    return {
      status: 'available',
      source: directSource,
    };
  } catch (_err: any) {
    // Return resilient direct stream source on any network or fetch failure
    const directSource = createDirectStreamSource(anime, episodeNumber, provider, language, resolution, desiredServerName);
    return {
      status: 'available',
      source: directSource,
    };
  }
}
