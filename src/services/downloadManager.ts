import { registerPlugin, Capacitor } from '@capacitor/core';
import { Anime, Episode } from '../types';
import { resolveEpisodeSource, resolveHiAnimeSource, resolveAnimeSaltSource, STREAM_PROVIDERS, StreamLanguage, SUPPORTED_LANGUAGES } from './streamingProviders';
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

export async function queueBatchEpisodeDownloads(
  anime: Anime,
  episodes: Episode[],
  audio: StreamLanguage = 'DUB',
  serverName: string = 'Server 1',
  quality: string = '1080p'
): Promise<{ queuedCount: number; errors: string[] }> {
  let queuedCount = 0;
  const errors: string[] = [];

  const displayTitle =
    anime.title?.english || anime.title?.romaji || anime.title?.userPreferred || 'Anime';

  const isSubOrDub = audio === 'SUB' || audio === 'DUB';

  for (const ep of episodes) {
    try {
      let streamUrl = '';
      let selectedServerName = serverName;
      let effectiveQuality = quality;
      let effectiveSource = isSubOrDub ? 'HiAnime' : 'Multi-Lang';

      // RULE 1: Japanese (SUB) and English (DUB) downloads are LOCKED to HiAnime source at 1080p quality
      if (isSubOrDub) {
        effectiveSource = 'HiAnime';
        effectiveQuality = '1080p';
        selectedServerName = serverName.toLowerCase().includes('server 2') ? 'Server 2' : serverName.toLowerCase().includes('server 3') ? 'Server 3' : 'Server 1';
      }

      // RULE 7: Fetch & embed WebVTT subtitles with every episode download
      let subtitleUrl = '';
      try {
        const subs = await fetchUnifiedSubtitles(anime.id, ep.number, 3000);
        if (subs && subs.length > 0) {
          const formatted = anonymizeAndSortSubtitleTracks(subs, 'English', 'English 2');
          if (formatted && formatted.length > 0) {
            subtitleUrl = formatted[0].url;
          }
        }
      } catch (e) {
        console.warn(`Subtitle fetch warning for EP ${ep.number}:`, e);
      }

      // RESOLVE STREAM BASED ON SOURCE RULES
      if (effectiveSource === 'HiAnime') {
        const hi = resolveHiAnimeSource(anime.id, ep.number, audio, selectedServerName);
        if (hi && hi.selectedUrl) {
          streamUrl = hi.selectedUrl;
        } else {
          errors.push(`EP ${ep.number}: HiAnime 1080p ${audio} stream is not available. Download skipped.`);
          continue;
        }
      } else if (effectiveSource === 'AnimeSalt') {
        const salt = await resolveAnimeSaltSource(displayTitle, ep.number, anime.id);
        if (salt && salt.selectedUrl) {
          streamUrl = salt.selectedUrl;
        } else {
          errors.push(`EP ${ep.number}: AnimeSalt stream is not available. Download skipped.`);
          continue;
        }
      } else {
        // Multi-Lang (MovieBox API)
        const res = await resolveEpisodeSource({
          anime,
          episodeNumber: ep.number,
          providerId: 'anime-world-v1',
          language: audio,
          resolution: (effectiveQuality as any) || '1080p',
          serverName: 'Multi-Lang-Server-1',
          sourceName: 'Multi-Lang',
        });

        if (res && res.status === 'available' && res.source?.url) {
          // RULE 6: Strict Quality & Audio Availability Check Per Episode
          const availableLangs = res.source.availableLanguages || [];
          if (availableLangs.length > 0 && !availableLangs.includes(audio)) {
            const langLabel = SUPPORTED_LANGUAGES.find(l => l.code === audio)?.label || audio;
            errors.push(`EP ${ep.number}: ${langLabel} audio track is not available on Multi-Lang. Download skipped.`);
            continue; // DO NOT PROCEED
          }

          const availableRes = res.source.availableResolutions || [];
          if (availableRes.length > 0 && !availableRes.includes(effectiveQuality as any)) {
            errors.push(`EP ${ep.number}: ${effectiveQuality} quality in ${audio} audio is not available on Multi-Lang. Download skipped.`);
            continue; // DO NOT PROCEED
          }

          streamUrl = res.source.url;
        } else {
          errors.push(`EP ${ep.number}: Multi-Lang stream is not available. Download skipped.`);
          continue;
        }
      }

      if (!streamUrl) {
        errors.push(`EP ${ep.number}: Video stream URL could not be resolved. Download skipped.`);
        continue;
      }

      const downloadId = `${anime.id}_ep_${ep.number}_${audio.toLowerCase()}_${effectiveQuality}`;

      const item: any = {
        id: downloadId,
        anilistId: anime.id,
        animeTitle: displayTitle,
        episodeNumber: ep.number,
        streamUrl,
        pageUrl: streamUrl,
        subtitleUrl: subtitleUrl || '',
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
  }

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
