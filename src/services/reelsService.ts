import { AnimeReel } from '../types';
import { reelMediaCache } from './reelMediaCache';
import bundledReelsRaw from '../data/animeReels.json';
import { db } from '../lib/firebase';
import { doc, getDoc, setDoc } from 'firebase/firestore';

const SAVED_REELS_STORAGE_KEY = 'anilove_saved_anime_reels';
const WATCHED_REELS_IDS_KEY = 'anilove_reels_watched_ids';
const REELS_SESSION_STORAGE_KEY = 'anilove_active_reels_session';

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

// Temporary in-memory RAM cache for active session
const cloudMetadataCache = new Map<string, EnrichedReelMetadata>();

/**
 * Fetch enriched metadata for a reel.
 * Order of lookup:
 * 1. Active Session RAM Memory Map (0ms)
 * 2. Firebase Firestore (with 2s timeout)
 * (NO local storage persistence used)
 */
export async function fetchReelCloudMetadata(reelId: string): Promise<EnrichedReelMetadata | null> {
  if (!reelId) return null;

  // 1. Session RAM Memory Lookup
  if (cloudMetadataCache.has(reelId)) {
    return cloudMetadataCache.get(reelId)!;
  }

  // 2. Firebase Firestore Lookup (Fail-Safe with Timeout)
  try {
    const docRef = doc(db, 'reels_metadata', reelId);

    const snap = await Promise.race([
      getDoc(docRef),
      new Promise<null>((_, reject) => setTimeout(() => reject(new Error('Firebase timeout')), 2000))
    ]);

    if (snap && snap.exists()) {
      const data = snap.data() as EnrichedReelMetadata;
      cloudMetadataCache.set(reelId, data);
      return data;
    }
  } catch (err) {
    // Firebase failed / offline -> Gracefully fallback to on-demand trace.moe identification!
  }

  return null;
}

/**
 * Save enriched reel metadata (identified via trace.moe).
 * Saves to Firebase Firestore only (NO local disk storage used).
 */
export async function saveReelCloudMetadata(reelId: string, metadata: EnrichedReelMetadata): Promise<void> {
  if (!reelId || !metadata) return;

  // Store in active session RAM
  cloudMetadataCache.set(reelId, metadata);

  // Safely attempt to sync to Firebase Firestore
  try {
    const docRef = doc(db, 'reels_metadata', reelId);
    await setDoc(docRef, {
      ...metadata,
      identifiedAt: Date.now()
    }, { merge: true });
  } catch (err) {
    // Firebase unavailable -> trace.moe will run on-demand as needed
  }
}

/**
 * Watched Reels Registry Management (Anti-Repetition Engine)
 */
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

export function sanitizeReelForStorage(reel: Partial<AnimeReel>): AnimeReel {
  const id = String(reel.id || '').trim();
  const directCdnUrl = `https://lh3.googleusercontent.com/d/${id}`;
  const downloadUrl = `https://drive.google.com/uc?export=download&id=${id}`;

  return {
    id,
    title: String(reel.title || `Anime Reel ${id.slice(0, 6)}`),
    cleanTitle: String(reel.cleanTitle || reel.title || `Anime Reel ${id.slice(0, 6)}`),
    folderId: String(reel.folderId || '1L7FrLGfkUSNJNDGseo6g9K0itnS3xxdE'),
    folderName: String(reel.folderName || 'Anime Edits'),
    url: directCdnUrl,
    directUrl: directCdnUrl,
    thumbnailUrl: directCdnUrl,
    streamProxyUrl: directCdnUrl,
    downloadProxyUrl: downloadUrl,
    size: reel.size ? String(reel.size) : 'HD Video',
    mimeType: String(reel.mimeType || 'video/mp4')
  };
}

export function getBundledReels(shuffle: boolean = true): AnimeReel[] {
  let list = Array.isArray(bundledReelsRaw) ? bundledReelsRaw.map(sanitizeReelForStorage) : [];
  if (list.length === 0) return [];

  const watched = getWatchedReelIds();
  const unseen = list.filter(r => !watched.has(r.id));
  const candidatePool = unseen.length > 0 ? unseen : list;

  if (shuffle) {
    return [...candidatePool].sort(() => Math.random() - 0.5);
  }
  return candidatePool;
}

export function getStartingReelsFeed(
  initialReelId?: string,
  initialFilterMode?: 'all' | 'saved'
): {
  feed: AnimeReel[];
  index: number;
  filterMode: 'all' | 'saved';
} {
  const existingSession = getStoredReelsSession();
  const bundled = getBundledReels(true);
  const savedReels = getStoredSavedReels();

  if (initialFilterMode === 'saved') {
    if (savedReels.length > 0) {
      const foundIdx = initialReelId ? findReelIndexByIdOrPrefix(savedReels, initialReelId) : 0;
      return {
        feed: savedReels,
        index: foundIdx >= 0 ? foundIdx : 0,
        filterMode: 'saved',
      };
    }
    return { feed: [], index: 0, filterMode: 'saved' };
  }

  if (initialReelId && String(initialReelId).trim()) {
    const cleanId = String(initialReelId).trim();
    let match = findReelByIdOrPrefix(bundled, cleanId) || findReelByIdOrPrefix(savedReels, cleanId);

    if (!match && existingSession && Array.isArray(existingSession.feedHistory)) {
      match = findReelByIdOrPrefix(existingSession.feedHistory, cleanId);
    }

    if (!match) {
      match = sanitizeReelForStorage({ id: cleanId });
    }

    reelMediaCache.preloadReel(match.id);
    const others = bundled.filter(r => r.id !== match!.id).slice(0, 3);
    const feed = [match, ...others];

    saveStoredReelsSession({
      feedHistory: feed,
      historyIndex: 0,
      lastWatchedReelId: match.id,
      filterMode: 'all',
    });

    return { feed, index: 0, filterMode: 'all' };
  }

  if (existingSession && existingSession.feedHistory.length > 0) {
    let resumeIndex = existingSession.historyIndex;
    if (existingSession.lastWatchedReelId) {
      const matchIdx = existingSession.feedHistory.findIndex(r => r.id === existingSession.lastWatchedReelId);
      if (matchIdx >= 0) resumeIndex = matchIdx;
    }
    resumeIndex = Math.max(0, Math.min(resumeIndex, existingSession.feedHistory.length - 1));

    return {
      feed: existingSession.feedHistory,
      index: resumeIndex,
      filterMode: existingSession.filterMode || 'all',
    };
  }

  return {
    feed: bundled.slice(0, 5),
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
