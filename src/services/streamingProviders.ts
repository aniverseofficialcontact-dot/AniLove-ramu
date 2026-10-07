export const STREAM_PROVIDERS = [];
export const DEFAULT_STREAM_PROVIDER_ID = 'none';
export const SUPPORTED_LANGUAGES = [{ code: 'en', name: 'English', flag: '🇺🇸', label: 'English' }];
export type StreamLanguage = 'en' | 'sub' | 'dub' | string;
export async function fetchStreamSources() { return null; }
export async function resolveEpisodeSource(..._args: any[]) { return null; }
export async function probeMovieBoxAvailability(..._args: any[]): Promise<any> {
  return { availableLanguages: ['en'], languageQualityMap: {} };
}
