import { AnimeReel } from '../types';
import { reelMediaCache } from './reelMediaCache';
import bundledReelsRaw from '../data/animeReels.json';
import { generateStratifiedDeck, reelDeckManager, recordReelAsWatched } from './reelRandomizer';

const SAVED_REELS_STORAGE_KEY = 'anilove_saved_anime_reels';
const WATCHED_REELS_HISTORY_KEY = 'anilove_watched_reels_history';
const REELS_SESSION_STORAGE_KEY = 'anilove_active_reels_session';

export interface ReelsSessionState {
  feedHistory: AnimeReel[];
  historyIndex: number;
  lastWatchedReelId?: string;
  filterMode?: 'all' | 'saved';
}

let inMemoryReelsSession: ReelsSessionState | null = null;

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

const DEFAULT_ANCHOR_REEL_1 = '1cgEQgCfiXjM83SicU9B2-757Jg1P_PtK';
const DEFAULT_ANCHOR_REEL_2 = '1h0urMntH6ZA7AIy-QR4To89kPOZkjhTO';
const LAST_TWO_WATCHED_KEY = 'anilove_last_two_watched_reels_v1';

export function getStoredLastTwoWatchedReels(): AnimeReel[] {
  try {
    const raw = localStorage.getItem(LAST_TWO_WATCHED_KEY);
    if (!raw) return [];
    const parsed = JSON.parse(raw);
    if (Array.isArray(parsed) && parsed.length > 0) {
      return parsed.map(sanitizeReelForStorage).filter(r => Boolean(r.id));
    }
  } catch {}
  return [];
}

export function recordLastTwoWatchedReels(reel: AnimeReel): void {
  if (!reel || !reel.id) return;
  try {
    const current = getStoredLastTwoWatchedReels();
    const filtered = current.filter(r => r.id !== reel.id);
    const updated = [sanitizeReelForStorage(reel), ...filtered].slice(0, 2);
    localStorage.setItem(LAST_TWO_WATCHED_KEY, JSON.stringify(updated));
  } catch {}
}

export function getStartingReelsFeed(
  initialReelId?: string,
  initialFilterMode?: 'all' | 'saved'
): {
  feed: AnimeReel[];
  index: number;
  filterMode: 'all' | 'saved';
} {
  const bundled = getBundledReels(false);
  const savedReels = getStoredSavedReels();

  if (initialFilterMode === 'saved') {
    if (savedReels.length > 0) {
      const foundIdx = initialReelId ? findReelIndexByIdOrPrefix(savedReels, initialReelId) : 0;
      const targetIdx = foundIdx >= 0 ? foundIdx : 0;
      return {
        feed: savedReels,
        index: targetIdx,
        filterMode: 'saved',
      };
    } else {
      return {
        feed: [],
        index: 0,
        filterMode: 'saved',
      };
    }
  }

  if (initialReelId && String(initialReelId).trim()) {
    const cleanId = String(initialReelId).trim();
    let match = findReelByIdOrPrefix(bundled, cleanId) || findReelByIdOrPrefix(savedReels, cleanId);

    if (!match) {
      match = sanitizeReelForStorage({
        id: cleanId,
        name: `Anime Reel ${cleanId.slice(0, 6)}`,
        title: `Anime Reel ${cleanId.slice(0, 6)}`,
        cleanTitle: 'Anime Reel',
        folderId: '',
        folderName: 'Anime Edits',
        url: `https://drive.usercontent.google.com/download?id=${cleanId}&export=download&confirm=t`,
        directUrl: `https://drive.usercontent.google.com/download?id=${cleanId}&export=download&confirm=t`,
        thumbnailUrl: `https://lh3.googleusercontent.com/d/${cleanId}`,
        mimeType: 'video/mp4'
      });
    }

    reelMediaCache.preloadReel(match.id);
    const upcoming = reelDeckManager.drawNextReels(bundled, 8, [match.id]);
    const feed = [match, ...upcoming];

    return {
      feed,
      index: 0,
      filterMode: 'all',
    };
  }

  // 1. Retrieve persistent last 2 watched reels from localStorage
  const lastTwo = getStoredLastTwoWatchedReels();
  let anchorReels: AnimeReel[] = [];

  if (lastTwo.length >= 1) {
    anchorReels = lastTwo;
  } else {
    // Fresh install or cleared cache: load preset default anchor reels (1cgEQg and 1h0urM)
    const def1 = findReelByIdOrPrefix(bundled, DEFAULT_ANCHOR_REEL_1) || sanitizeReelForStorage({ id: DEFAULT_ANCHOR_REEL_1, cleanTitle: 'Anime Reel 1cgEQg' });
    const def2 = findReelByIdOrPrefix(bundled, DEFAULT_ANCHOR_REEL_2) || sanitizeReelForStorage({ id: DEFAULT_ANCHOR_REEL_2, cleanTitle: 'Anime Reel 1h0urM' });
    anchorReels = [def1, def2];
  }

  const anchorIds = anchorReels.map(r => r.id);

  // 2. Pre-warm anchor reels in media cache
  for (const r of anchorReels) {
    if (r?.id) reelMediaCache.preloadReel(r.id, 'high');
  }

  // 3. Draw unwatched stratified non-repeating deck for upcoming feed items
  const upcomingUnwatched = reelDeckManager.drawNextReels(bundled, 10, anchorIds);
  const feed = [...anchorReels, ...upcomingUnwatched];

  return {
    feed,
    index: 0,
    filterMode: 'all',
  };
}

const reelIdIndexMap = new Map<string, number>();

function initializeReelIndexMap() {
  if (reelIdIndexMap.size > 0) return;
  if (Array.isArray(bundledReelsRaw)) {
    bundledReelsRaw.forEach((item, idx) => {
      if (item && item.id) {
        reelIdIndexMap.set(item.id.toLowerCase(), idx + 1);
      }
    });
  }
}

export function formatUniqueReelTitle(reelId: string, customTitle?: string, fallbackIndex?: number): string {
  initializeReelIndexMap();
  const cleanId = String(reelId || '').trim().toLowerCase();

  if (cleanId) {
    const foundNum = reelIdIndexMap.get(cleanId);
    if (foundNum !== undefined) {
      return `Anime Reel #${foundNum}`;
    }
  }

  if (fallbackIndex !== undefined && fallbackIndex > 0) {
    return `Anime Reel #${fallbackIndex}`;
  }

  const generatedNum = (reelIdIndexMap.size || 2049) + 1;
  if (cleanId) {
    reelIdIndexMap.set(cleanId, generatedNum);
  }
  return `Anime Reel #${generatedNum}`;
}

export function sanitizeReelForStorage(reel: Partial<AnimeReel>, indexHint?: number): AnimeReel {
  const fileId = String(reel.id || '').trim();
  const cleanTitle = formatUniqueReelTitle(fileId, reel.cleanTitle || reel.title, indexHint);
  return {
    id: fileId,
    title: cleanTitle,
    cleanTitle: cleanTitle,
    folderId: String(reel.folderId || ''),
    folderName: String(reel.folderName || ''),
    url: String(reel.url || `https://drive.usercontent.google.com/download?id=${fileId}&export=download&confirm=t`),
    directUrl: String(reel.directUrl || `https://drive.usercontent.google.com/download?id=${fileId}&export=download&confirm=t`),
    thumbnailUrl: String(reel.thumbnailUrl || `https://lh3.googleusercontent.com/d/${fileId}`),
    size: reel.size ? String(reel.size) : undefined,
    sizeBytes: typeof reel.sizeBytes === 'number' ? reel.sizeBytes : undefined,
    mimeType: String(reel.mimeType || 'video/mp4')
  };
}

export function getBundledReels(shuffle: boolean = true): AnimeReel[] {
  let list = Array.isArray(bundledReelsRaw)
    ? bundledReelsRaw.map((r, idx) => sanitizeReelForStorage(r, idx + 1))
    : [];
  if (shuffle && list.length > 0) {
    list = generateStratifiedDeck(list);
  }
  return list;
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
    console.error('Error loading saved reels from localStorage:', err);
    return [];
  }
}

const REELS_HISTORY_STORAGE_KEY = 'anilove_reels_history_view_v1';

export function getStoredReelsHistory(): AnimeReel[] {
  try {
    const raw = localStorage.getItem(REELS_HISTORY_STORAGE_KEY);
    if (!raw) return [];
    const parsed = JSON.parse(raw);
    if (Array.isArray(parsed)) {
      return parsed.map(sanitizeReelForStorage).filter(r => Boolean(r.id));
    }
    return [];
  } catch {
    return [];
  }
}

export function recordReelToHistory(reel: AnimeReel): void {
  if (!reel || !reel.id) return;
  try {
    const current = getStoredReelsHistory();
    const filtered = current.filter(r => r.id !== reel.id);
    const updated = [sanitizeReelForStorage(reel), ...filtered].slice(0, 50);
    localStorage.setItem(REELS_HISTORY_STORAGE_KEY, JSON.stringify(updated));
    window.dispatchEvent(new CustomEvent('anilove-reels-history-updated'));
  } catch {
    // silent
  }
}

export function clearReelsHistory(): void {
  try {
    localStorage.removeItem(REELS_HISTORY_STORAGE_KEY);
    window.dispatchEvent(new CustomEvent('anilove-reels-history-updated'));
  } catch {
    // silent
  }
}

export function saveStoredSavedReels(reels: AnimeReel[]): void {
  try {
    const cleanList = reels.map(sanitizeReelForStorage).filter(r => Boolean(r.id));
    localStorage.setItem(SAVED_REELS_STORAGE_KEY, JSON.stringify(cleanList));
    window.dispatchEvent(new CustomEvent('anilove-saved-reels-updated'));
  } catch (err) {
    console.error('Error saving reels to localStorage:', err);
  }
}

export function isReelSaved(reelId: string): boolean {
  if (!reelId) return false;
  const current = getStoredSavedReels();
  return current.some(r => r.id === reelId);
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
  const foundLocal = findReelByIdOrPrefix(bundled, cleanId);
  if (foundLocal) return foundLocal;

  return sanitizeReelForStorage({
    id: cleanId,
    title: `Anime Reel ${cleanId.slice(0, 6)}`,
    cleanTitle: 'Anime Reel',
    url: `https://drive.usercontent.google.com/download?id=${cleanId}&export=download&confirm=t`,
    directUrl: `https://drive.usercontent.google.com/download?id=${cleanId}&export=download&confirm=t`,
    thumbnailUrl: `https://lh3.googleusercontent.com/d/${cleanId}`,
    mimeType: 'video/mp4',
  });
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

export async function syncReelsFromGoogleDrive(): Promise<AnimeReel[]> {
  return fetchAllReels();
}
