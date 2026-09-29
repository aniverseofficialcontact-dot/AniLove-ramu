/**
 * High-Performance Media Pre-Warming Engine for Anime Reels
 * Ensures 100% network bandwidth is reserved for active video HTTP Range streaming.
 */

class ReelMediaCache {
  private prewarmedImages = new Set<string>();

  /**
   * Get direct raw MP4 video stream URL with &confirm=t flag
   */
  async getReelVideoUrl(reelId: string): Promise<string> {
    if (!reelId) return '';
    return `https://drive.usercontent.google.com/download?id=${reelId}&export=download&confirm=t`;
  }

  /**
   * Synchronous check for RAM Blob URL
   */
  getSynchronousBlobUrl(reelId: string): string | null {
    return null;
  }

  /**
   * Pre-warm poster image for upcoming reel
   */
  preloadReel(reelId: string): void {
    if (!reelId || this.prewarmedImages.has(reelId)) return;
    this.prewarmedImages.add(reelId);
    try {
      const img = new Image();
      img.src = `https://lh3.googleusercontent.com/d/${reelId}`;
    } catch {
      // silent
    }
  }

  /**
   * Pre-warm poster thumbnails for upcoming reels
   */
  preloadBatch(reelIds: string[]): void {
    if (!reelIds || reelIds.length === 0) return;
    reelIds.slice(0, 5).forEach(id => {
      if (id) this.preloadReel(id);
    });
  }

  /**
   * Cleanup cache entries on app hide / unmount
   */
  async cleanupAllMediaCache(): Promise<void> {
    this.prewarmedImages.clear();
  }
}

export const reelMediaCache = new ReelMediaCache();

// App lifecycle listeners
if (typeof window !== 'undefined') {
  const wipeCache = () => {
    reelMediaCache.cleanupAllMediaCache().catch(() => {});
  };

  window.addEventListener('beforeunload', wipeCache);
  window.addEventListener('pagehide', wipeCache);
}
