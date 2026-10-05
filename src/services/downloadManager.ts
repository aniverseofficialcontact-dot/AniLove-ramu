import { registerPlugin, Capacitor } from '@capacitor/core';
import { Anime, Episode } from '../types';
import { resolveEpisodeSource, STREAM_PROVIDERS, StreamLanguage, SUPPORTED_LANGUAGES } from './streamingProviders';
import { fetchUnifiedSubtitles, anonymizeAndSortSubtitleTracks } from './subtitleService';

export interface DownloadItemInfo {
  id: string;
  anilistId: number;
  animeTitle: string;
  episodeNumber: number;
  audio: StreamLanguage;
  quality: string;
  serverName: string;
  status: 'QUEUED' | 'DOWNLOADING' | 'PAUSED' | 'COMPLETED' | 'ERROR';
  progress: number;
  bytesDownloaded: number;
  totalBytes: number;
  localFilePath?: string;
  localSubPath?: string;
  thumbnail?: string;
  speed?: string;
  error?: string;
}

export interface DownloadPluginInterface {
  startDownload(options: { item: any }): Promise<void>;
  downloadImage(options: { imageUrl: string; fileName?: string }): Promise<{ success: boolean; filePath: string }>;
  pauseDownload(options: { downloadId: string }): Promise<void>;
  resumeDownload(options: { downloadId: string }): Promise<void>;
  cancelDownload(options: { downloadId: string }): Promise<void>;
  getDownloads(): Promise<{ downloads: DownloadItemInfo[] }>;
  playOffline(options: {
    localFilePath: string;
    localSubPath?: string;
    title: string;
    animeTitle?: string;
    episodeNumber: number;
    audio?: string;
    quality?: string;
  }): Promise<void>;
  exportToPublicStorage(options: {
    localFilePath: string;
    animeTitle?: string;
    episodeNumber: number;
  }): Promise<{ success: boolean; exportPath: string; fileName: string }>;
  addListener(
    eventName: 'onDownloadProgress',
    listenerFunc: (data: {
      downloadId: string;
      progress: number;
      bytesDownloaded: number;
      totalBytes: number;
      speed: string;
    }) => void
  ): Promise<any>;
  addListener(
    eventName: 'onDownloadStatusChange',
    listenerFunc: (data: {
      downloadId: string;
      status: string;
      error?: string;
      localFilePath?: string;
      localSubPath?: string;
    }) => void
  ): Promise<any>;
}

export const DownloadPlugin = registerPlugin<DownloadPluginInterface>('DownloadPlugin');

type DownloadSubscriber = (downloads: DownloadItemInfo[]) => void;
const subscribers = new Set<DownloadSubscriber>();

let downloadsCache: DownloadItemInfo[] = [];

// Initialize listeners on mobile
if (Capacitor.isNativePlatform()) {
  DownloadPlugin.addListener('onDownloadProgress', data => {
    const item = downloadsCache.find(d => d.id === data.downloadId);
    if (item) {
      item.progress = data.progress;
      item.bytesDownloaded = data.bytesDownloaded;
      item.totalBytes = data.totalBytes;
      item.speed = data.speed;
      notifySubscribers();
    }
  });

  DownloadPlugin.addListener('onDownloadStatusChange', async data => {
    const item = downloadsCache.find(d => d.id === data.downloadId);
    if (item) {
      item.status = data.status as any;
      if (data.error) item.error = data.error;
      if (data.localFilePath) item.localFilePath = data.localFilePath;
      if (data.localSubPath) item.localSubPath = data.localSubPath;
      notifySubscribers();
    }
    if (data.status === 'COMPLETED') {
      await refreshDownloadsList();
    }
  });

  // Initial fetch
  refreshDownloadsList();
}

function notifySubscribers() {
  subscribers.forEach(sub => sub([...downloadsCache]));
}

export async function refreshDownloadsList(): Promise<DownloadItemInfo[]> {
  if (!Capacitor.isNativePlatform()) {
    return downloadsCache;
  }
  try {
    const result = await DownloadPlugin.getDownloads();
    downloadsCache = result.downloads || [];
    notifySubscribers();
    return downloadsCache;
  } catch (err) {
    console.warn('Error fetching downloads from plugin:', err);
    return downloadsCache;
  }
}

export function subscribeToDownloads(callback: DownloadSubscriber): () => void {
  subscribers.add(callback);
  callback([...downloadsCache]);
  return () => {
    subscribers.delete(callback);
  };
}

function getMovieBoxAudioLabel(audio: StreamLanguage): string {
  switch (audio) {
    case 'SUB': return 'Japanese';
    case 'DUB': return 'English';
    case 'HIN': return 'Hindi';
    case 'TAM': return 'Tamil';
    case 'TEL': return 'Telugu';
    case 'MAL': return 'Malayalam';
    case 'KAN': return 'Kannada';
    case 'BEN': return 'Bengali';
    default: return 'English';
  }
}

function getSubLangCode(lang: string): string {
  const lower = lang.toLowerCase();
  if (lower.includes('eng')) return 'en';
  if (lower.includes('spa') || lower.includes('spanish')) return 'es';
  if (lower.includes('fre') || lower.includes('french')) return 'fr';
  if (lower.includes('ger') || lower.includes('german')) return 'de';
  if (lower.includes('ita') || lower.includes('italian')) return 'it';
  if (lower.includes('por') || lower.includes('portuguese')) return 'pt';
  if (lower.includes('rus') || lower.includes('russian')) return 'ru';
  if (lower.includes('ara') || lower.includes('arabic')) return 'ar';
  if (lower.includes('jap') || lower.includes('japanese')) return 'ja';
  if (lower.includes('hin') || lower.includes('hindi')) return 'hi';
  return 'en';
}

export async function queueBatchEpisodeDownloads(
  anime: Anime,
  episodes: Episode[],
  audio: StreamLanguage = 'DUB',
  serverName: string = 'Server 1',
  quality: string = '1080p',
  subtitleLang: string = 'English'
): Promise<{ queuedCount: number; errors: string[] }> {
  let queuedCount = 0;
  const errors: string[] = [];

  const displayTitle =
    anime.title?.english || anime.title?.romaji || anime.title?.userPreferred || 'Anime';

  const targetEpNumbers = episodes.map(e => e.number);
  const epsListStr = targetEpNumbers.join(',');

  // Process all episodes concurrently in parallel
  const tasks = episodes.map(async (ep) => {
    try {
      let streamUrl = '';
      let selectedServerName = serverName;
      let effectiveQuality = quality;
      let subtitleUrl = '';
      let subtitleUrl2 = '';

      // Concurrent fetch: Subtitles + Stream URL
      const [subs, streamRes] = await Promise.all([
        fetchUnifiedSubtitles(anime.id, ep.number, 2500).catch(() => []),
        resolveEpisodeSource({
          anime,
          episodeNumber: ep.number,
          providerId: 'anime-world-v1',
          language: audio,
          resolution: (effectiveQuality as any) || '1080p',
          serverName,
        }).catch(() => null),
      ]);

      if (streamRes && streamRes.status === 'available' && streamRes.source?.url) {
        streamUrl = streamRes.source.url;
        selectedServerName = streamRes.source.selectedServerName || serverName;
      }

      // Format Subtitles
      if (subs && subs.length > 0) {
        const formatted = anonymizeAndSortSubtitleTracks(subs, subtitleLang, `${subtitleLang} 2`);
        if (formatted && formatted.length > 0) {
          const targetLangClean = (subtitleLang || 'English').toLowerCase().trim();
          const matchingLang = formatted.filter(t => {
            const l = (t.language || '').toLowerCase().trim();
            const d = (t.displayLabel || '').toLowerCase().trim();
            return l === targetLangClean || d.startsWith(targetLangClean) || targetLangClean.includes(l);
          });

          if (matchingLang.length > 0) {
            subtitleUrl = matchingLang[0].url;
            if (matchingLang.length > 1) {
              subtitleUrl2 = matchingLang[1].url;
            }
          } else {
            subtitleUrl = formatted[0].url;
            if (formatted.length > 1) subtitleUrl2 = formatted[1].url;
          }
        }
      }

      streamUrl = streamRes || '';

      if (!streamUrl) {
        errors.push(`EP ${ep.number}: Could not resolve stream URL`);
        return;
      }

      const downloadId = `${anime.id}_ep_${ep.number}_${audio.toLowerCase()}_${effectiveQuality}`;

      const item: any = {
        id: downloadId,
        anilistId: anime.id,
        animeTitle: displayTitle,
        episodeNumber: ep.number,
        streamUrl,
        pageUrl: isMovieBox ? 'https://netfilm.world/' : streamUrl,
        subtitleUrl: subtitleUrl || '',
        subtitleUrl2: subtitleUrl2 || '',
        audio,
        serverName: selectedServerName,
        quality: effectiveQuality,
        thumbnail: ep.thumbnail || anime.coverImage?.large || '',
      };

      if (Capacitor.isNativePlatform()) {
        await DownloadPlugin.startDownload({ item });
      }

      // Add to local cache if not present
      const existing = downloadsCache.find(d => d.id === downloadId);
      if (!existing) {
        downloadsCache.push({
          ...item,
          status: 'QUEUED',
          progress: 0,
          bytesDownloaded: 0,
          totalBytes: 0,
        });
      } else {
        existing.status = 'QUEUED';
      }

      queuedCount++;
    } catch (err: any) {
      errors.push(`EP ${ep.number}: ${err?.message || 'Download failed'}`);
    }
  });

  await Promise.allSettled(tasks);
  notifySubscribers();
  return { queuedCount, errors };
}

export async function pauseDownload(downloadId: string): Promise<void> {
  if (Capacitor.isNativePlatform()) {
    await DownloadPlugin.pauseDownload({ downloadId });
  }
  const item = downloadsCache.find(d => d.id === downloadId);
  if (item) {
    item.status = 'PAUSED';
    notifySubscribers();
  }
}

export async function resumeDownload(downloadId: string): Promise<void> {
  if (Capacitor.isNativePlatform()) {
    await DownloadPlugin.resumeDownload({ downloadId });
  }
  const item = downloadsCache.find(d => d.id === downloadId);
  if (item) {
    item.status = 'QUEUED';
    item.error = undefined;
    notifySubscribers();
  }
}

export async function cancelDownload(downloadId: string): Promise<void> {
  if (Capacitor.isNativePlatform()) {
    await DownloadPlugin.cancelDownload({ downloadId });
  }
  downloadsCache = downloadsCache.filter(d => d.id !== downloadId);
  notifySubscribers();
}

export async function playOfflineEpisode(download: DownloadItemInfo): Promise<void> {
  let filePath = download.localFilePath;
  let subPath = download.localSubPath;

  // If localFilePath is missing in the passed object, attempt to refresh and find it
  if (!filePath && Capacitor.isNativePlatform()) {
    const latest = await refreshDownloadsList();
    const matched = latest.find(
      d => d.id === download.id || (d.anilistId === download.anilistId && d.episodeNumber === download.episodeNumber)
    );
    if (matched && matched.localFilePath) {
      filePath = matched.localFilePath;
      subPath = matched.localSubPath;
    }
  }

  if (!filePath) {
    throw new Error('Local file path is missing');
  }

  if (Capacitor.isNativePlatform()) {
    await DownloadPlugin.playOffline({
      localFilePath: filePath,
      localSubPath: subPath,
      title: `${download.animeTitle} - EP ${download.episodeNumber}`,
      animeTitle: download.animeTitle,
      episodeNumber: download.episodeNumber,
      audio: download.audio,
      quality: download.quality,
    });
  }
}

export function isEpisodeDownloaded(anilistId: number, episodeNumber: number): boolean {
  return downloadsCache.some(
    d => d.anilistId === anilistId && d.episodeNumber === episodeNumber && d.status === 'COMPLETED'
  );
}

export function getEpisodeDownloadItem(
  anilistId: number,
  episodeNumber: number
): DownloadItemInfo | undefined {
  return downloadsCache.find(d => d.anilistId === anilistId && d.episodeNumber === episodeNumber);
}

export async function exportDownloadToPublicStorage(
  download: DownloadItemInfo
): Promise<{ success: boolean; exportPath: string; fileName: string }> {
  let filePath = download.localFilePath;

  if (!filePath && Capacitor.isNativePlatform()) {
    const latest = await refreshDownloadsList();
    const matched = latest.find(
      d => d.id === download.id || (d.anilistId === download.anilistId && d.episodeNumber === download.episodeNumber)
    );
    if (matched && matched.localFilePath) {
      filePath = matched.localFilePath;
    }
  }

  if (!filePath) {
    throw new Error('Local file path is missing or file not found.');
  }

  if (Capacitor.isNativePlatform()) {
    return await DownloadPlugin.exportToPublicStorage({
      localFilePath: filePath,
      animeTitle: download.animeTitle,
      episodeNumber: download.episodeNumber,
    });
  } else {
    throw new Error('Exporting to device storage is only supported on Android native devices.');
  }
}

export async function downloadFanArtImage(imageUrl: string, fileName?: string): Promise<{ success: boolean; filePath: string }> {
  if (Capacitor.isNativePlatform()) {
    return await DownloadPlugin.downloadImage({ imageUrl, fileName });
  } else {
    // Web Browser Fallback
    const response = await fetch(imageUrl);
    const blob = await response.blob();
    const blobUrl = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = blobUrl;
    a.download = fileName || `AniLove_FanArt_${Date.now()}.jpg`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(blobUrl);
    return { success: true, filePath: '' };
  }
}
