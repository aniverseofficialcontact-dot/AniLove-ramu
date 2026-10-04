import { registerPlugin, Capacitor } from '@capacitor/core';
import { Anime } from '../types';
import { resolveEpisodeSource, StreamLanguage } from './streamingProviders';
import { getStoredSettings } from './storage';

export interface NativePlayerPlugin {
  play(options: {
    url: string;
    serverName?: string;
    targetUrl?: string;
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
    const maxEp = activeAnimeForNative.episodes || 9999;
    const targetEp = data.direction === 'next' ? currentEpNumForNative + 1 : currentEpNumForNative - 1;
    if (targetEp >= 1 && targetEp <= maxEp) {
      await launchNativePlayer({
        anime: activeAnimeForNative,
        episodeNumber: targetEp,
        audio: currentAudioForNative,
        totalEpisodes: activeAnimeForNative.episodes,
      });
    } else {
      console.warn(`[NativePlayer] Aborting auto-navigation to episode ${targetEp}: exceeds episode count ${maxEp}.`);
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
  const settings = getStoredSettings();
  const dTitle = anime.title?.english || anime.title?.romaji || anime.title?.userPreferred || 'Anime';
  const epNum = Number(episodeNumber) || 1;
  const maxEp = totalEpisodes || anime.episodes || 9999;

  if (epNum > maxEp || epNum < 1) {
    console.warn(`[NativePlayer] Aborting launch: episode ${epNum} is out of bounds (1..${maxEp}).`);
    return;
  }

  activeAnimeForNative = anime;
  currentEpNumForNative = epNum;
  currentAudioForNative = (audio as string) || 'DUB';

  // Resolve stream source
  const res = await resolveEpisodeSource({
    anime,
    episodeNumber: epNum,
    language: (audio as StreamLanguage) || 'DUB',
    serverName,
  });

  const streamUrl = res.source?.url || `https://vidlink.pro/anime/${anime.id}/${epNum}?dub=${audio === 'DUB' ? 'true' : 'false'}`;
  const activeServerName = res.source?.selectedServerName || serverName || 'AnimeDekho-Server-1';

  // Launch NativePlayerActivity directly
  await NativePlayer.play({
    url: streamUrl,
    serverName: activeServerName,
    targetUrl: res.source?.url || streamUrl,
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
