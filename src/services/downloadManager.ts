import { Capacitor, registerPlugin } from '@capacitor/core';
import { Anime, StreamingEpisode } from '../types';

export interface DownloadItemInfo {
  id: string;
  anilistId: number;
  animeTitle: string;
  episodeNumber: number;
  episodeTitle: string;
  quality: string;
  audio: string;
  downloadUrl: string;
  status: 'QUEUED' | 'DOWNLOADING' | 'PAUSED' | 'COMPLETED' | 'FAILED' | 'CANCELLED';
  progress: number;
  bytesDownloaded: number;
  totalBytes: number;
  speed: number;
  error?: string;
  localFilePath?: string;
  localSubPath?: string;
  subtitlesJson?: string;
  thumbnail?: string;
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
    animeTitle: string;
    episodeNumber: number;
    audio: string;
    quality: string;
  }): Promise<void>;
  exportToPublicStorage(options: { downloadId: string }): Promise<{ publicPath: string }>;
  downloadImage(options: { imageUrl: string; fileName: string }): Promise<{ success: boolean; path?: string }>;
  addListener(
    eventName: 'onDownloadProgress',
    listenerFunc: (data: {
      downloadId: string;
      progress: number;
      bytesDownloaded: number;
      totalBytes: number;
      speed: number;
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

const isPluginAvailable = () => Capacitor.isNativePlatform() && Capacitor.isPluginAvailable('DownloadPlugin');

// Safe Initialization of plugin listeners on mobile
if (isPluginAvailable()) {
  try {
    DownloadPlugin.addListener('onDownloadProgress', data => {
      const item = downloadsCache.find(d => d.id === data.downloadId);
      if (item) {
        item.progress = data.progress;
        item.bytesDownloaded = data.bytesDownloaded;
        item.totalBytes = data.totalBytes;
        item.speed = data.speed;
        notifySubscribers();
      }
    }).catch(() => {});

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
        await refreshDownloadsList().catch(() => {});
      }
    }).catch(() => {});

    refreshDownloadsList().catch(() => {});
  } catch (e) {
    console.warn('DownloadPlugin setup notice:', e);
  }
}

function notifySubscribers() {
  subscribers.forEach(sub => sub([...downloadsCache]));
}

export async function refreshDownloadsList(): Promise<DownloadItemInfo[]> {
  if (!isPluginAvailable()) {
    return downloadsCache;
  }
  try {
    const result = await DownloadPlugin.getDownloads();
    downloadsCache = result?.downloads || [];
    notifySubscribers();
    return downloadsCache;
  } catch (err) {
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

export async function queueEpisodeDownload(
  anime: Anime,
  ep: StreamingEpisode & { number: number },
  quality: string = '1080p',
  audio: string = 'sub'
): Promise<void> {
  const downloadId = `${anime.id}_ep_${ep.number}_${quality}_${audio}`;

  const item: any = {
    id: downloadId,
    anilistId: anime.id,
    animeTitle: anime.title?.english || anime.title?.romaji || 'Anime',
    episodeNumber: ep.number,
    episodeTitle: ep.title || `Episode ${ep.number}`,
    quality,
    audio,
    downloadUrl: ep.url || '',
    thumbnail: ep.thumbnail || anime.coverImage?.large || '',
  };

  if (isPluginAvailable()) {
    try {
      await DownloadPlugin.startDownload({ item });
    } catch (e) {}
  }

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

  notifySubscribers();
}

export async function queueBatchEpisodeDownloads(
  anime: Anime,
  episodes: (StreamingEpisode & { number: number })[],
  quality: string = '1080p',
  audio: string = 'sub'
): Promise<{ queuedCount: number; errors: string[] }> {
  let queuedCount = 0;
  const errors: string[] = [];

  const tasks = episodes.map(async ep => {
    try {
      const downloadId = `${anime.id}_ep_${ep.number}_${quality}_${audio}`;

      const item: any = {
        id: downloadId,
        anilistId: anime.id,
        animeTitle: anime.title?.english || anime.title?.romaji || 'Anime',
        episodeNumber: ep.number,
        episodeTitle: ep.title || `Episode ${ep.number}`,
        quality,
        audio,
        downloadUrl: ep.url || '',
        thumbnail: ep.thumbnail || anime.coverImage?.large || '',
      };

      if (isPluginAvailable()) {
        try {
          await DownloadPlugin.startDownload({ item });
        } catch (e) {}
      }

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
  if (isPluginAvailable()) {
    try {
      await DownloadPlugin.pauseDownload({ downloadId });
    } catch (e) {}
  }
  const item = downloadsCache.find(d => d.id === downloadId);
  if (item) {
    item.status = 'PAUSED';
    notifySubscribers();
  }
}

export async function resumeDownload(downloadId: string): Promise<void> {
  if (isPluginAvailable()) {
    try {
      await DownloadPlugin.resumeDownload({ downloadId });
    } catch (e) {}
  }
  const item = downloadsCache.find(d => d.id === downloadId);
  if (item) {
    item.status = 'QUEUED';
    item.error = undefined;
    notifySubscribers();
  }
}

export async function cancelDownload(downloadId: string): Promise<void> {
  if (isPluginAvailable()) {
    try {
      await DownloadPlugin.cancelDownload({ downloadId });
    } catch (e) {}
  }
  downloadsCache = downloadsCache.filter(d => d.id !== downloadId);
  notifySubscribers();
}

export async function playOfflineEpisode(download: DownloadItemInfo): Promise<void> {
  let filePath = download.localFilePath;
  let subPath = download.localSubPath;

  if (!filePath && isPluginAvailable()) {
    const latest = await refreshDownloadsList().catch(() => []);
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

  if (isPluginAvailable()) {
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

export function getDownloadedEpisodes(anilistId: number): DownloadItemInfo[] {
  return downloadsCache.filter(d => d.anilistId === anilistId && d.status === 'COMPLETED');
}

export async function exportDownloadToPublic(downloadId: string): Promise<string | null> {
  if (isPluginAvailable()) {
    try {
      const result = await DownloadPlugin.exportToPublicStorage({ downloadId });
      return result?.publicPath || null;
    } catch (e) {
      return null;
    }
  }
  return null;
}

export const exportDownloadToPublicStorage = exportDownloadToPublic;

export async function downloadCoverImageToGallery(imageUrl: string, fileName: string): Promise<boolean> {
  if (isPluginAvailable()) {
    try {
      const res = await DownloadPlugin.downloadImage({ imageUrl, fileName });
      return Boolean(res?.success);
    } catch (e) {
      return false;
    }
  }
  return false;
}

export const downloadFanArtImage = downloadCoverImageToGallery;
