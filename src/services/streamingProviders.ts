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
  category: 'anikoto' | 'anify' | 'tatakai' | 'miruro' | 'renime' | 'official';
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


// 1. Anikoto HD-1 (1080p Master - Default)
const ANIKOTO_HD1: StreamProvider = {
  id: 'anikoto-hd1',
  label: 'Anikoto HD-1',
  category: 'anikoto',
  description: 'Primary 1080p high-bitrate master server from MegaCloud (Eng Dub & Jap Sub).',
  supportedLanguages: ['SUB', 'DUB'],
  tag: '1080p Master',
  serverMatch: 'HD-1',
};

// 2. AnimeWorld India (Hindi & Multi-Audio)
const ANIMEWORLD_INDIA: StreamProvider = {
  id: 'animeworld-india',
  label: 'AnimeWorld India',
  category: 'official',
  description: 'Premier Indian multi-audio anime network (Hindi, English, Japanese).',
  supportedLanguages: ['HIN', 'DUB', 'SUB'],
  tag: 'Hindi / Regional',
  apiEndpoint: '/api/animeworld-india/resolve',
};

// 3. Tatakai Ultra (TatakaiAPI Engine with Sub, Dub & Hindi)
const TATAKAI_MULTI: StreamProvider = {
  id: 'tatakai-multi',
  label: 'Tatakai Ultra',
  category: 'tatakai',
  description: 'Real-time TatakaiAPI engine with 1080p Direct HLS, English Dub, Japanese Sub & Hindi.',
  supportedLanguages: ['SUB', 'DUB', 'HIN'],
  tag: 'Tatakai HD',
  apiEndpoint: '/api/tatakai/resolve',
};

// 4. Anikoto Backup (Secondary HD Mirror)
const ANIKOTO_HD2: StreamProvider = {
  id: 'anikoto-hd2',
  label: 'Anikoto Backup',
  category: 'anikoto',
  description: 'Secondary high-definition server mirror for reliable failover.',
  supportedLanguages: ['SUB', 'DUB'],
  tag: 'Backup Mirror',
  serverMatch: 'HD-2',
};

export const STREAM_PROVIDERS: StreamProvider[] = [
  ANIKOTO_HD1,
  ANIMEWORLD_INDIA,
  TATAKAI_MULTI,
  ANIKOTO_HD2,
];

export const DEFAULT_STREAM_PROVIDER_ID: StreamServerId = 'anikoto-hd1';

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
  const isIndian = language === 'HIN';
  const displayTitle = anime.title?.english || anime.title?.romaji || anime.title?.userPreferred || 'Anime';
  const cleanSlug = displayTitle.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '');

  let availableServers: AvailableServerOption[] = [];

  if (isIndian || provider.id === 'animeworld-india') {
    availableServers = [
      { name: 'AnimeWorld Multi-Audio', type: language, linkId: `https://play.zephyrix.org/video/${cleanSlug}-episode-${episodeNumber}` },
      { name: 'AnimeWorld Edge Mirror', type: language, linkId: `https://watchanimeworld.top/episode/${cleanSlug}-episode-${episodeNumber}` },
      { name: 'Anikoto Fast Edge', type: isDub ? 'DUB' : 'SUB', linkId: `https://megaplay.buzz/stream/s-2/${anilistId}/${isDub ? 'dub' : 'sub'}` },
    ];
  } else {
    availableServers = [
      { name: 'Anikoto Fast Edge', type: isDub ? 'DUB' : 'SUB', linkId: `https://megaplay.buzz/stream/s-2/${anilistId}/${isDub ? 'dub' : 'sub'}` },
      { name: 'Anikoto Vidstream CDN', type: isDub ? 'DUB' : 'SUB', linkId: `https://megaplay.buzz/stream/s-1/${anilistId}/${isDub ? 'dub' : 'sub'}` },
      { name: 'Pahe Compact Stream', type: isDub ? 'DUB' : 'SUB', linkId: `https://player.smashystream.com/anime/${anilistId}/${episodeNumber}` },
    ];
  }

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
    availableLanguages: isIndian ? ['HIN', 'DUB', 'SUB'] : ['SUB', 'DUB'],
    selectedServerName,
    isDubAvailable: true,
    isFallback: true,
    requestedLanguage: language,
    actualLanguage: language,
  };
}

/**
 * Universal episode stream resolver supporting Anikoto, Anify, Tatakai, Miruro, AnimeWorld India and Multi-Engine CDNs
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
  const isIndianLang = language === 'HIN';
  let provider = STREAM_PROVIDERS.find(item => item.id === targetProviderId) || ANIKOTO_HD1;

  // Auto-switch to Indian multi-audio provider if an Indian language was requested and current provider doesn't support it
  if (isIndianLang && !provider.supportedLanguages.includes(language)) {
    provider = ANIMEWORLD_INDIA;
  }

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

  // Determine endpoint to hit based on provider and language
  // RESPECT user provider choice first
  let endpoint = provider.apiEndpoint || '/api/stream/resolve';

  if (provider.category === 'anikoto') {
    endpoint = '/api/anikoto/resolve';
  } else if (isIndianLang && endpoint === '/api/stream/resolve') {
    // Only default to animeworld if no specific provider endpoint is set
    endpoint = '/api/animeworld/resolve';
  }

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
            subtitleUrl: data.subtitleUrl,
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
