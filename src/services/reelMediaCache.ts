/**
 * High-Performance Client-Side Media Cache for Anime Reels
 * Direct Google Drive Edge CDN integration with immediate memory cleanup.
 */

const CACHE_NAME = 'anime-reels-media-v1';
const MAX_MEMORY_OBJECT_URLS = 10; // Keep up to 10 reels in RAM (~30MB)

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
   * Get direct playable Google Drive CDN URL for a reel.
   */
  async getReelVideoUrl(reelId: string): Promise<string> {
    if (!reelId) return '';

    // 1. Check in-memory Object URL cache
    const mem = this.memoryCache.get(reelId);
    if (mem) {
      mem.lastAccessed = Date.now();
      return mem.objectUrl;
    }

    // 2. Direct Google Drive Edge CDN URL
    return `https://lh3.googleusercontent.com/d/${reelId}`;
  }

  /**
   * Preload a reel into local memory cache in the background
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
        const streamUrl = `https://lh3.googleusercontent.com/d/${reelId}`;

        const controller = new AbortController();
        const timeoutId = setTimeout(() => controller.abort(), 15000);

        const response = await fetch(streamUrl, {
          signal: controller.signal,
          headers: { 'Accept': 'video/mp4,video/*;q=0.9,*/*;q=0.8' },
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

  async preloadBatch(reelIds: string[]): Promise<void> {
    if (!reelIds || reelIds.length === 0) return;
    const top2 = reelIds.slice(0, 2);
    await Promise.allSettled(top2.map(id => (id ? this.preloadReel(id, 'high') : Promise.resolve(null))));
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
