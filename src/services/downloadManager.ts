import { registerPlugin, Capacitor } from '@capacitor/core';
import { Anime, Episode } from '../types';
import { resolveEpisodeSource, createDirectStreamSource, STREAM_PROVIDERS, StreamLanguage } from './streamingProviders';

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

const DownloadPlugin = registerPlugin<DownloadPluginInterface>('DownloadPlugin');

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

  for (const ep of episodes) {
    try {
      let streamUrl = '';
      let selectedServerName = serverName;

      const matchedProvider =
        STREAM_PROVIDERS.find(p => p.serverMatch === serverName || p.label === serverName || p.id === serverName) ||
        STREAM_PROVIDERS[0];

      let subtitleUrl = '';
      // 1. Quick probe to see if backend returns a direct URL
      try {
        const res = await resolveEpisodeSource({
          anime,
          episodeNumber: ep.number,
          providerId: matchedProvider.id,
          language: audio,
          serverName,
        });
        if (res && res.status === 'available' && res.source?.url) {
          streamUrl = res.source.url;
          selectedServerName = res.source.selectedServerName || serverName;
          if (res.source.subtitles && res.source.subtitles.length > 0) {
            subtitleUrl = res.source.subtitles[0].url || '';
          } else if ((res.source as any).subtitleUrl) {
            subtitleUrl = (res.source as any).subtitleUrl;
          }
        }
      } catch {
        // Fallback immediately
      }

      // 2. Direct embed stream source generator
      if (!streamUrl) {
        const direct = createDirectStreamSource(anime, ep.number, matchedProvider, audio, '1080p', serverName);
        streamUrl = direct.url;
        selectedServerName = direct.selectedServerName || serverName;
      }

      const downloadId = `${anime.id}_ep_${ep.number}_${audio.toLowerCase()}`;

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
        quality,
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
