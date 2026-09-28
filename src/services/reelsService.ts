import { AnimeReel } from '../types';
import { reelMediaCache } from './reelMediaCache';
import bundledReelsRaw from '../data/animeReels.json';

const SAVED_REELS_STORAGE_KEY = 'anilove_saved_anime_reels';
const WATCHED_REELS_IDS_KEY = 'anilove_reels_watched_ids';
const REELS_SESSION_STORAGE_KEY = 'anilove_active_reels_session';
const DYNAMIC_REELS_STORAGE_KEY = 'anilove_dynamic_live_reels';

export interface EnrichedReelMetadata {
  animeTitle?: string;
  episode?: number | string;
  timestamp?: string;
  anilistId?: number;
  similarity?: number;
  categories?: string[];
  identifiedAt?: number;
}

export interface ReelsSessionState {
  feedHistory: AnimeReel[];
  historyIndex: number;
  lastWatchedReelId?: string;
  filterMode?: 'all' | 'saved';
}

let inMemoryReelsSession: ReelsSessionState | null = null;
const cloudMetadataCache = new Map<string, EnrichedReelMetadata>();

export async function fetchReelCloudMetadata(reelId: string): Promise<EnrichedReelMetadata | null> {
  if (!reelId) return null;
  if (cloudMetadataCache.has(reelId)) {
    return cloudMetadataCache.get(reelId)!;
  }
  return null;
}

export async function saveReelCloudMetadata(reelId: string, metadata: EnrichedReelMetadata): Promise<void> {
  if (!reelId || !metadata) return;
  cloudMetadataCache.set(reelId, metadata);
}

export function getWatchedReelIds(): Set<string> {
  try {
    const raw = localStorage.getItem(WATCHED_REELS_IDS_KEY);
    if (!raw) return new Set();
    const arr = JSON.parse(raw);
    return new Set(Array.isArray(arr) ? arr : []);
  } catch {
    return new Set();
  }
}

export function markReelAsWatched(reelId: string): void {
  if (!reelId) return;
  try {
    const set = getWatchedReelIds();
    if (!set.has(reelId)) {
      set.add(reelId);
      localStorage.setItem(WATCHED_REELS_IDS_KEY, JSON.stringify(Array.from(set)));
    }
  } catch {
    // silent
  }
}

export function clearWatchedReelIds(): void {
  try {
    localStorage.removeItem(WATCHED_REELS_IDS_KEY);
  } catch {
    // silent
  }
}

export function sanitizeReelForStorage(reel: Partial<AnimeReel>): AnimeReel {
  const id = String(reel.id || '').trim();
  const videoStreamUrl = `https://drive.usercontent.google.com/download?id=${id}&export=download`;
  const fallbackDownloadUrl = `https://drive.google.com/uc?export=download&id=${id}`;
  const posterImageUrl = `https://lh3.googleusercontent.com/d/${id}`;

  return {
    id,
    title: String(reel.title || `Anime Reel ${id.slice(0, 6)}`),
    cleanTitle: String(reel.cleanTitle || reel.title || `Anime Reel ${id.slice(0, 6)}`),
    folderId: 'anime_edits_vault',
    folderName: String(reel.folderName || 'Anime Edits'),
    url: videoStreamUrl,
    directUrl: videoStreamUrl,
    thumbnailUrl: posterImageUrl,
    streamProxyUrl: videoStreamUrl,
    downloadProxyUrl: fallbackDownloadUrl,
    size: reel.size ? String(reel.size) : 'HD Video',
    mimeType: String(reel.mimeType || 'video/mp4')
  };
}

export async function syncLiveGoogleDriveFolder(folderId: string = '1L7FrLGfkUSNJNDGseo6g9K0itnS3xxdE'): Promise<{ reels: AnimeReel[]; newCount: number }> {
  try {
    const isLocalhost = typeof window !== 'undefined' && (window.location.hostname === 'localhost' || window.location.hostname === '127.0.0.1');
    const isCapacitor = typeof window !== 'undefined' && Boolean((window as any).Capacitor);

    if (isLocalhost || isCapacitor) {
      return { reels: getBundledReels(false), newCount: 0 };
    }

    const res = await fetch(`https://drive.google.com/embeddedfolderview?id=${folderId}#list`, {
      mode: 'cors',
      headers: {
        'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8',
      }
    });

    if (!res.ok) return { reels: getBundledReels(false), newCount: 0 };

    const html = await res.text();
    const entryRegex = /<div class="flip-entry" id="entry-([A-Za-z0-9_\-]{20,45})"[^>]*>([\s\S]*?)<\/div>\s*<\/div>\s*<\/div>/g;
    const entries = [...html.matchAll(entryRegex)];

    if (entries.length === 0) return { reels: getBundledReels(false), newCount: 0 };

    const existingMap = new Map<string, AnimeReel>();
    const baseList = getBundledReels(false);
    baseList.forEach(r => existingMap.set(r.id, r));

    let newCount = 0;
    entries.forEach((e, idx) => {
      const id = e[1];
      if (!existingMap.has(id)) {
        newCount++;
        const titleMatch = e[2].match(/<div class="flip-entry-title">([^<]+)<\/div>/);
        const rawTitle = titleMatch ? titleMatch[1].trim() : `Anime Reel ${idx + 1}`;
        let cleanTitle = rawTitle.replace(/\.(mp4|mov|mkv|webm|avi)$/i, '').trim();
        if (!cleanTitle || cleanTitle.toLowerCase().includes('unknown')) {
          cleanTitle = `Anime Reel #${idx + 1}`;
        }

        const newReel = sanitizeReelForStorage({
          id,
          name: cleanTitle,
          title: cleanTitle,
          cleanTitle: cleanTitle,
          folderId: 'anime_edits_vault',
          folderName: 'Anime Edits'
        });
        existingMap.set(id, newReel);
      }
    });

    const fullList = Array.from(existingMap.values());
    if (newCount > 0) {
      try {
        localStorage.setItem(DYNAMIC_REELS_STORAGE_KEY, JSON.stringify(fullList));
      } catch {}
    }

    return { reels: fullList, newCount };
  } catch (err) {
    return { reels: getBundledReels(false), newCount: 0 };
  }
}

export function getBundledReels(shuffle: boolean = true): AnimeReel[] {
  let list = Array.isArray(bundledReelsRaw) ? bundledReelsRaw.map(sanitizeReelForStorage) : [];

  try {
    const rawDynamic = localStorage.getItem(DYNAMIC_REELS_STORAGE_KEY);
    if (rawDynamic) {
      const parsed = JSON.parse(rawDynamic);
      if (Array.isArray(parsed) && parsed.length > 0) {
        const map = new Map<string, AnimeReel>();
        list.forEach(r => map.set(r.id, r));
        parsed.forEach(r => {
          if (r?.id && !map.has(r.id)) {
            map.set(r.id, sanitizeReelForStorage(r));
          }
        });
        list = Array.from(map.values());
      }
    }
  } catch {}

  if (list.length === 0) return [];

  const watched = getWatchedReelIds();
  const unseen = list.filter(r => !watched.has(r.id));
  const candidatePool = unseen.length > 0 ? unseen : list;

  if (shuffle) {
    return [...candidatePool].sort(() => Math.random() - 0.5);
  }
  return candidatePool;
}

export function getStoredReelsSession(): ReelsSessionState | null {
  if (inMemoryReelsSession && inMemoryReelsSession.feedHistory.length > 0) {
    return inMemoryReelsSession;
  }
  try {
    const raw = (typeof sessionStorage !== 'undefined' ? sessionStorage.getItem(REELS_SESSION_STORAGE_KEY) : null) ||
      (typeof localStorage !== 'undefined' ? localStorage.getItem(REELS_SESSION_STORAGE_KEY) : null);
    if (!raw) return null;
    const parsed = JSON.parse(raw);
    if (parsed && Array.isArray(parsed.feedHistory) && parsed.feedHistory.length > 0) {
      const sanitizedHistory = parsed.feedHistory.map(sanitizeReelForStorage).filter((r: AnimeReel) => Boolean(r.id));
      if (sanitizedHistory.length === 0) return null;
      const safeIndex = Math.max(0, Math.min(Number(parsed.historyIndex) || 0, sanitizedHistory.length - 1));
      inMemoryReelsSession = {
        feedHistory: sanitizedHistory,
        historyIndex: safeIndex,
        lastWatchedReelId: sanitizedHistory[safeIndex]?.id || parsed.lastWatchedReelId,
        filterMode: parsed.filterMode === 'saved' ? 'saved' : 'all',
      };
      return inMemoryReelsSession;
    }
  } catch {
    // silent
  }
  return null;
}

export function saveStoredReelsSession(session: ReelsSessionState): void {
  if (!session || !Array.isArray(session.feedHistory) || session.feedHistory.length === 0) return;
  const safeIndex = Math.max(0, Math.min(session.historyIndex, session.feedHistory.length - 1));
  let trimmedFeed = session.feedHistory;
  let targetIndex = safeIndex;
  if (trimmedFeed.length > 50) {
    const start = Math.max(0, targetIndex - 25);
    trimmedFeed = trimmedFeed.slice(start, start + 50);
    targetIndex = targetIndex - start;
  }

  const cleanSession: ReelsSessionState = {
    feedHistory: trimmedFeed.map(sanitizeReelForStorage),
    historyIndex: Math.max(0, Math.min(targetIndex, trimmedFeed.length - 1)),
    lastWatchedReelId: session.feedHistory[safeIndex]?.id || session.lastWatchedReelId,
    filterMode: session.filterMode || 'all',
  };
  inMemoryReelsSession = cleanSession;
  try {
    const json = JSON.stringify(cleanSession);
    if (typeof sessionStorage !== 'undefined') {
      sessionStorage.setItem(REELS_SESSION_STORAGE_KEY, json);
    }
    if (typeof localStorage !== 'undefined') {
      localStorage.setItem(REELS_SESSION_STORAGE_KEY, json);
      if (cleanSession.lastWatchedReelId) {
        localStorage.setItem('anilove_last_watched_reel_id', cleanSession.lastWatchedReelId);
      }
    }
  } catch {
    // silent
  }
}

export function clearReelsSession(): void {
  inMemoryReelsSession = null;
  try {
    if (typeof sessionStorage !== 'undefined') {
      sessionStorage.removeItem(REELS_SESSION_STORAGE_KEY);
    }
    if (typeof localStorage !== 'undefined') {
      localStorage.removeItem(REELS_SESSION_STORAGE_KEY);
    }
  } catch {
    // silent
  }
}

export function findReelByIdOrPrefix(reels: AnimeReel[], queryId?: string): AnimeReel | null {
  if (!queryId) return null;
  const q = String(queryId).trim();
  const qLower = q.toLowerCase();
  return reels.find(r => 
    r.id === q || 
    r.id.toLowerCase() === qLower || 
    (q.length >= 5 && r.id.toLowerCase().startsWith(qLower)) ||
    (r.title && r.title.toLowerCase().includes(qLower)) ||
    (r.cleanTitle && r.cleanTitle.toLowerCase().includes(qLower))
  ) || null;
}

export function findReelIndexByIdOrPrefix(reels: AnimeReel[], queryId?: string): number {
  if (!queryId) return -1;
  const q = String(queryId).trim();
  const qLower = q.toLowerCase();
  return reels.findIndex(r => 
    r.id === q || 
    r.id.toLowerCase() === qLower || 
    (q.length >= 5 && r.id.toLowerCase().startsWith(qLower)) ||
    (r.title && r.title.toLowerCase().includes(qLower)) ||
    (r.cleanTitle && r.cleanTitle.toLowerCase().includes(qLower))
  );
}

export function getStartingReelsFeed(
  initialReelId?: string,
  initialFilterMode?: 'all' | 'saved'
): {
  feed: AnimeReel[];
  index: number;
  filterMode: 'all' | 'saved';
} {
  const bundled = getBundledReels(true);
  const savedReels = getStoredSavedReels();

  if (initialFilterMode === 'saved') {
    if (savedReels.length > 0) {
      const foundIdx = initialReelId ? findReelIndexByIdOrPrefix(savedReels, initialReelId) : 0;
      return {
        feed: savedReels,
        index: Math.max(0, foundIdx),
        filterMode: 'saved',
      };
    }
    return { feed: [], index: 0, filterMode: 'saved' };
  }

  if (initialReelId && String(initialReelId).trim()) {
    const cleanId = String(initialReelId).trim();
    let match = findReelByIdOrPrefix(bundled, cleanId) || findReelByIdOrPrefix(savedReels, cleanId);

    if (!match) {
      match = sanitizeReelForStorage({ id: cleanId });
    }

    reelMediaCache.preloadReel(match.id);
    const others = bundled.filter(r => r.id !== match!.id);
    const feed = [match, ...others];

    return {
      feed,
      index: 0,
      filterMode: 'all',
    };
  }

  const fullPool = bundled.length > 0 ? bundled : (bundledReelsRaw as any[]).map(sanitizeReelForStorage);

  return {
    feed: fullPool,
    index: 0,
    filterMode: 'all',
  };
}

export function getStoredSavedReels(): AnimeReel[] {
  try {
    const raw = localStorage.getItem(SAVED_REELS_STORAGE_KEY);
    if (!raw) return [];
    const parsed = JSON.parse(raw);
    if (Array.isArray(parsed)) {
      return parsed.map(sanitizeReelForStorage).filter(r => Boolean(r.id));
    }
    return [];
  } catch (err) {
    return [];
  }
}

export function saveStoredSavedReels(reels: AnimeReel[]): void {
  try {
    const cleanList = reels.map(sanitizeReelForStorage).filter(r => Boolean(r.id));
    localStorage.setItem(SAVED_REELS_STORAGE_KEY, JSON.stringify(cleanList));
    window.dispatchEvent(new CustomEvent('anilove-saved-reels-updated'));
  } catch (err) {
    console.error('Error saving reels:', err);
  }
}

export function isReelSaved(reelId: string): boolean {
  if (!reelId) return false;
  return getStoredSavedReels().some(r => r.id === reelId);
}

export function toggleSaveReel(reel: AnimeReel): boolean {
  if (!reel || !reel.id) return false;
  const current = getStoredSavedReels();
  const index = current.findIndex(r => r.id === reel.id);
  let isNowSaved = false;

  let updated: AnimeReel[];
  if (index >= 0) {
    updated = current.filter(r => r.id !== reel.id);
    isNowSaved = false;
  } else {
    updated = [sanitizeReelForStorage(reel), ...current];
    isNowSaved = true;
  }

  saveStoredSavedReels(updated);
  return isNowSaved;
}

export function removeSavedReel(reelId: string): AnimeReel[] {
  if (!reelId) return getStoredSavedReels();
  const current = getStoredSavedReels();
  const updated = current.filter(r => r.id !== reelId);
  saveStoredSavedReels(updated);
  return updated;
}

export function clearAllSavedReels(): void {
  localStorage.removeItem(SAVED_REELS_STORAGE_KEY);
  window.dispatchEvent(new CustomEvent('anilove-saved-reels-updated'));
}

export async function fetchAllReels(shuffle: boolean = true): Promise<AnimeReel[]> {
  return getBundledReels(shuffle);
}

export async function fetchReelById(reelId: string): Promise<AnimeReel | null> {
  if (!reelId) return null;
  const cleanId = String(reelId).trim();
  const bundled = getBundledReels(false);
  const found = findReelByIdOrPrefix(bundled, cleanId);
  if (found) return found;

  return sanitizeReelForStorage({ id: cleanId });
}

export async function preloadReels(reelIds: string[]): Promise<void> {
  if (!reelIds || reelIds.length === 0) return;
  try {
    reelMediaCache.preloadBatch(reelIds);
  } catch {
    // silent
  }
}

export function prewarmInitialReelsOnAppStart(): void {
  try {
    const bundled = getBundledReels(false);
    if (bundled && bundled.length > 0) {
      const topReelIds = bundled.slice(0, 5).map(r => r.id);
      preloadReels(topReelIds);

      for (const id of topReelIds) {
        const img = new Image();
        img.src = `https://lh3.googleusercontent.com/d/${id}`;
      }
    }
  } catch {
    // silent
  }
}

if (typeof window !== 'undefined') {
  setTimeout(() => {
    prewarmInitialReelsOnAppStart();
  }, 50);
}
