import { registerPlugin, Capacitor } from '@capacitor/core';
import { Anime } from '../types';
import { resolveEpisodeSource, StreamLanguage } from './streamingProviders';
import { getStoredSettings } from './storage';

export interface NativePlayerPlugin {
  play(options: {
    url: string;
    title: string;
    hasNext?: boolean;
    hasPrev?: boolean;
    startFullscreen?: boolean;
    yOffset?: number;
    anilistId?: number;
    episodeNumber?: number;
    audio?: string;
    advancePlayer?: boolean;
    startTime?: number;
    subtitleUrl?: string;
    subtitleLang?: string;
  }): Promise<void>;
  updatePosition(options: { y: number }): Promise<void>;
  close(): Promise<void>;
  addListener(eventName: 'onEpisodeNavigation', listenerFunc: (data: { direction: 'next' | 'prev' }) => void): Promise<any>;
  addListener(eventName: 'onBackButtonPressed', listenerFunc: () => void): Promise<any>;
}

export const NativePlayer = registerPlugin<NativePlayerPlugin>('NativePlayer');

let activeAnimeForNative: Anime | null = null;
let currentEpNumForNative = 1;
let currentAudioForNative = 'DUB';

// Global listeners for episode navigation & back button
if (Capacitor.isNativePlatform()) {
  NativePlayer.addListener('onEpisodeNavigation', async (data) => {
    if (!activeAnimeForNative) return;
    const targetEp = data.direction === 'next' ? currentEpNumForNative + 1 : currentEpNumForNative - 1;
    if (targetEp >= 1) {
      await launchNativePlayer({
        anime: activeAnimeForNative,
        episodeNumber: targetEp,
        audio: currentAudioForNative,
        totalEpisodes: activeAnimeForNative.episodes,
      });
    }
  });

  window.addEventListener('nativeEpisodeNavigation', async (e: any) => {
    if (!activeAnimeForNative) return;
    const direction = e?.detail?.direction;
    const targetEp = direction === 'next' ? currentEpNumForNative + 1 : currentEpNumForNative - 1;
    if (targetEp >= 1) {
      await launchNativePlayer({
        anime: activeAnimeForNative,
        episodeNumber: targetEp,
        audio: currentAudioForNative,
        totalEpisodes: activeAnimeForNative.episodes,
      });
    }
  });
}

/**
 * Directly launches NativePlayerActivity with all controls, bypassing any extra web pages.
 */
export async function launchNativePlayer({
  anime,
  episodeNumber = 1,
  startTime = 0,
  audio = 'DUB',
  serverName,
  totalEpisodes,
}: {
  anime: Anime;
  episodeNumber?: number;
  startTime?: number;
  audio?: StreamLanguage | string;
  serverName?: string;
  totalEpisodes?: number;
}) {
  activeAnimeForNative = anime;
  currentEpNumForNative = Number(episodeNumber) || 1;
  currentAudioForNative = (audio as string) || 'DUB';

  const settings = getStoredSettings();
  const dTitle = anime.title?.english || anime.title?.romaji || anime.title?.userPreferred || 'Anime';
  const epNum = Number(episodeNumber) || 1;
  const maxEp = totalEpisodes || anime.episodes || 9999;

  // Resolve stream source from AnimeWorld India v1 API
  const res = await resolveEpisodeSource({
    anime,
    episodeNumber: epNum,
    language: (audio as StreamLanguage) || 'DUB',
    serverName,
  });

  const streamUrl = res.source?.url || `https://vidlink.pro/anime/${anime.id}/${epNum}?dub=${audio === 'DUB' ? 'true' : 'false'}`;

  // Launch NativePlayerActivity directly
  await NativePlayer.play({
    url: streamUrl,
    subtitleUrl: res.source?.subtitleUrl,
    subtitleLang: res.source?.subtitleLang || 'English',
    title: `${dTitle} - Ep ${epNum}`,
    hasNext: epNum < maxEp,
    hasPrev: epNum > 1,
    startFullscreen: false,
    yOffset: 0,
    anilistId: anime.id,
    episodeNumber: epNum,
    audio: (audio as string) || 'DUB',
    advancePlayer: settings?.advancePlayerEnabled ?? false,
    startTime: startTime || 0,
  });
}
