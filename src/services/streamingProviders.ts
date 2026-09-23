import { Anime, StreamServerId } from '../types';

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
}

export interface ResolveEpisodeSourceResult {
  status: StreamSourceStatus;
  source?: StreamSource;
  message?: string;
}

export const STREAM_PROVIDERS: StreamProvider[] = [];

export const DEFAULT_STREAM_PROVIDER_ID: StreamServerId = 'none';

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
  return {
    provider: provider || {
      id: 'none',
      label: 'No Server',
      category: 'official',
      description: 'No streaming servers configured.',
      supportedLanguages: ['SUB', 'DUB', 'HIN'],
    },
    url: '',
    language,
    resolution,
    isEmbeddable: false,
    external: false,
    skipData: { intro: [0, 0], outro: [0, 0] },
    availableServers: [],
    availableLanguages: ['SUB', 'DUB', 'HIN'],
    selectedServerName: 'No Server Available',
    isDubAvailable: false,
    isFallback: false,
    requestedLanguage: language,
    actualLanguage: language,
  };
}

/**
 * Universal episode stream resolver - Returns unavailable when no stream servers are enabled
 */
export async function resolveEpisodeSource({
  anime,
  episodeNumber,
  language = 'DUB',
}: ResolveEpisodeSourceInput): Promise<ResolveEpisodeSourceResult> {
  const displayTitle = anime.title?.english || anime.title?.romaji || anime.title?.userPreferred || 'Anime';
  return {
    status: 'unavailable',
    message: `No streaming servers are currently enabled for "${displayTitle}" Episode ${episodeNumber}.`,
  };
}
