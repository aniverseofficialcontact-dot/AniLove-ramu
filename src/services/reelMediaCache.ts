/**
 * High-Performance RAM Blob URL Cache for Anime Reels
 * Bypasses Google Drive player iframe completely and converts raw MP4 streams into 0ms RAM Blob URLs.
 */

const CACHE_NAME = 'anime-reels-media-v2';
const MAX_MEMORY_OBJECT_URLS = 12; // Keep up to 12 reels in instant RAM (~45MB)

interface CacheEntry {
  objectUrl: string;
  blob: Blob;
  size: number;
  lastAccessed: number;
}

class ReelMediaCache {
  private memoryCache = new Map<string, CacheEntry>();
  private inFlightFetches = new Map<string, Promise<string | null>>();
  private isCacheStorageSupported = typeof window !== 'undefined' && 'caches' in window;

  /**
   * Get raw MP4 video stream URL for a reel.
   * Returns in-memory Blob URL (0ms RAM lookup) if available, or direct stream with &confirm=t
   */
  async getReelVideoUrl(reelId: string): Promise<string> {
    if (!reelId) return '';

    // 1. Check 0ms RAM Blob URL
    const mem = this.memoryCache.get(reelId);
    if (mem) {
      mem.lastAccessed = Date.now();
      return mem.objectUrl;
    }

    // 2. Direct raw MP4 binary stream with &confirm=t flag (Bypasses Google Drive virus scan warning)
    return `https://drive.usercontent.google.com/download?id=${reelId}&export=download&confirm=t`;
  }

  /**
   * Preload upcoming reel into RAM Blob URL in background
   */
  async preloadReel(reelId: string, priority: 'high' | 'low' = 'low'): Promise<string | null> {
    if (!reelId) return null;

    const mem = this.memoryCache.get(reelId);
    if (mem) {
      mem.lastAccessed = Date.now();
      return mem.objectUrl;
    }

    if (this.inFlightFetches.has(reelId)) {
      return this.inFlightFetches.get(reelId)!;
    }

    const fetchPromise = (async () => {
      try {
        const rawStreamUrl = `https://drive.usercontent.google.com/download?id=${reelId}&export=download&confirm=t`;

        const controller = new AbortController();
        const timeoutId = setTimeout(() => controller.abort(), 20000);

        const response = await fetch(rawStreamUrl, {
          signal: controller.signal,
          headers: {
            'Accept': 'video/mp4,video/*;q=0.9,*/*;q=0.8',
            'Referer': 'https://drive.google.com/'
          },
        });
        clearTimeout(timeoutId);

        if (!response.ok && response.status !== 206) {
          return null;
        }

        const blob = await response.blob();
        if (blob.size < 1000) return null;

        const objectUrl = URL.createObjectURL(blob);
        this.setMemoryCache(reelId, objectUrl, blob);
        return objectUrl;
      } catch {
        return null;
      } finally {
        this.inFlightFetches.delete(reelId);
      }
    })();

    this.inFlightFetches.set(reelId, fetchPromise);
    return fetchPromise;
  }

  /**
   * Preload active reel + next 2 reels in background RAM
   */
  async preloadBatch(reelIds: string[]): Promise<void> {
    if (!reelIds || reelIds.length === 0) return;
    const top3 = reelIds.slice(0, 3);
    await Promise.allSettled(top3.map(id => (id ? this.preloadReel(id, 'high') : Promise.resolve(null))));
  }

  /**
   * Synchronous check if Blob Object URL is available in RAM
   */
  getSynchronousBlobUrl(reelId: string): string | null {
    const mem = this.memoryCache.get(reelId);
    if (mem) {
      mem.lastAccessed = Date.now();
      return mem.objectUrl;
    }
    return null;
  }

  private setMemoryCache(reelId: string, objectUrl: string, blob: Blob) {
    if (this.memoryCache.size >= MAX_MEMORY_OBJECT_URLS) {
      let oldestKey = '';
      let oldestTime = Infinity;
      for (const [k, v] of this.memoryCache.entries()) {
        if (v.lastAccessed < oldestTime) {
          oldestTime = v.lastAccessed;
          oldestKey = k;
        }
      }

      if (oldestKey) {
        const oldEntry = this.memoryCache.get(oldestKey);
        if (oldEntry) {
          URL.revokeObjectURL(oldEntry.objectUrl);
          this.memoryCache.delete(oldestKey);
        }
      }
    }

    this.memoryCache.set(reelId, {
      objectUrl,
      blob,
      size: blob.size,
      lastAccessed: Date.now()
    });
  }

  /**
   * Complete eviction & purge: Revokes all Blob Object URLs and deletes CacheStorage.
   * Executed automatically on app hide / close / recent tabs removal.
   */
  async cleanupAllMediaCache(): Promise<void> {
    for (const entry of this.memoryCache.values()) {
      try {
        URL.revokeObjectURL(entry.objectUrl);
      } catch {
        // silent
      }
    }
    this.memoryCache.clear();
    this.inFlightFetches.clear();

    if (this.isCacheStorageSupported) {
      try {
        await caches.delete(CACHE_NAME);
      } catch {
        // silent
      }
    }
  }
}

export const reelMediaCache = new ReelMediaCache();

// Register global app lifecycle listeners to wipe video media cache when app is hidden / closed
if (typeof window !== 'undefined') {
  const wipeCache = () => {
    reelMediaCache.cleanupAllMediaCache().catch(() => {});
  };

  window.addEventListener('beforeunload', wipeCache);
  window.addEventListener('pagehide', wipeCache);
  document.addEventListener('visibilitychange', () => {
    if (document.visibilityState === 'hidden') {
      wipeCache();
    }
  });
}
