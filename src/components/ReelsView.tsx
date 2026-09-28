import React, { useState, useEffect, useRef, useCallback, useMemo } from 'react';
import {
  Bookmark,
  ChevronUp,
  ChevronDown,
  ChevronLeft,
  Share2,
  Crop,
  Heart,
  Camera,
  Download,
  RefreshCw
} from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';
import { AnimeReel } from '../types';
import {
  getBundledReels,
  getStoredSavedReels,
  toggleSaveReel,
  getStartingReelsFeed,
  markReelAsWatched,
  fetchReelCloudMetadata,
  sanitizeReelForStorage,
  EnrichedReelMetadata
} from '../services/reelsService';
import bundledReelsRaw from '../data/animeReels.json';
import { AnimeSceneFinderModal } from './AnimeSceneFinderModal';

interface ReelsViewProps {
  onBack?: () => void;
  onNavigateToAccount?: () => void;
  onShowToast: (type: 'success' | 'info' | 'error' | 'sync', message: string, title?: string) => void;
  initialReelId?: string;
  initialFilterMode?: 'all' | 'saved';
  refreshTrigger?: number;
}

// Framer Motion Spring Slide Variants (Instagram / Shorts Style)
const slideVariants = {
  enter: (direction: number) => ({
    y: direction > 0 ? '100%' : '-100%',
    opacity: 0,
    scale: 0.96,
  }),
  center: {
    y: 0,
    opacity: 1,
    scale: 1,
    transition: {
      y: { type: 'spring', stiffness: 320, damping: 32 },
      opacity: { duration: 0.2 },
    },
  },
  exit: (direction: number) => ({
    y: direction < 0 ? '100%' : '-100%',
    opacity: 0,
    scale: 0.96,
    transition: {
      y: { type: 'spring', stiffness: 320, damping: 32 },
      opacity: { duration: 0.2 },
    },
  }),
};

export const ReelsView: React.FC<ReelsViewProps> = ({
  onBack,
  onNavigateToAccount,
  onShowToast,
  initialReelId,
  initialFilterMode,
  refreshTrigger,
}) => {
  const [savedStatus, setSavedStatus] = useState<Record<string, boolean>>(() => {
    const saved = getStoredSavedReels();
    const map: Record<string, boolean> = {};
    saved.forEach(r => { if (r?.id) map[r.id] = true; });
    return map;
  });

  const [filterMode, setFilterMode] = useState<'all' | 'saved'>(initialFilterMode || 'all');

  const [feedHistory, setFeedHistory] = useState<AnimeReel[]>(() => {
    const session = getStartingReelsFeed(initialReelId, initialFilterMode);
    if (session.feed && session.feed.length > 0) return session.feed;
    const fallback = getBundledReels(true);
    return fallback.length > 0 ? fallback : (bundledReelsRaw as any[]).map(sanitizeReelForStorage);
  });

  const [historyIndex, setHistoryIndex] = useState<number>(() => {
    const session = getStartingReelsFeed(initialReelId, initialFilterMode);
    return session.index || 0;
  });

  const [slideDirection, setSlideDirection] = useState<number>(1);
  const [showHeartBurst, setShowHeartBurst] = useState(false);

  // Scene Finder Modal & Cloud Enriched Metadata
  const [isSceneFinderOpen, setIsSceneFinderOpen] = useState(false);
  const [enrichedMetadata, setEnrichedMetadata] = useState<Record<string, EnrichedReelMetadata>>({});

  // Drag Physics State
  const [dragOffsetY, setDragOffsetY] = useState(0);
  const [isDragging, setIsDragging] = useState(false);

  const containerRef = useRef<HTMLDivElement>(null);
  const isInitialMountRef = useRef<boolean>(true);

  // Gesture & Hold references
  const touchStartYRef = useRef<number | null>(null);
  const touchStartTimeRef = useRef<number>(0);
  const lastWheelTimeRef = useRef<number>(0);
  const tapTimerRef = useRef<NodeJS.Timeout | null>(null);
  const lastTapTimeRef = useRef<number>(0);

  // Mode Switch ('all' vs 'saved') - Skips initial mount
  useEffect(() => {
    if (isInitialMountRef.current) {
      isInitialMountRef.current = false;
      return;
    }

    if (filterMode === 'saved') {
      const saved = getStoredSavedReels();
      setFeedHistory(saved);
      setHistoryIndex(0);
    } else {
      const bundled = getBundledReels(true);
      const fallback = bundled.length > 0 ? bundled : (bundledReelsRaw as any[]).map(sanitizeReelForStorage);
      setFeedHistory(fallback);
      setHistoryIndex(0);
    }
  }, [filterMode]);

  const currentReel = feedHistory[historyIndex] || null;

  // Direct Google Drive Embed Player URL (Bypasses WebView CORS completely!)
  const embedPlayerUrl = useMemo(() => {
    if (!currentReel?.id) return '';
    return `https://drive.google.com/file/d/${currentReel.id}/preview`;
  }, [currentReel?.id]);

  // Poster Image
  const activePosterUrl = useMemo(() => {
    if (!currentReel?.id) return '';
    return `https://lh3.googleusercontent.com/d/${currentReel.id}`;
  }, [currentReel?.id]);

  // Fetch enriched metadata from Cloud/Cache
  useEffect(() => {
    if (!currentReel?.id) return;
    const reelId = currentReel.id;

    let isMounted = true;
    fetchReelCloudMetadata(reelId).then(meta => {
      if (isMounted && meta) {
        setEnrichedMetadata(prev => ({ ...prev, [reelId]: meta }));
      }
    });

    return () => { isMounted = false; };
  }, [currentReel?.id]);

  // Mark reel as watched after 3s
  useEffect(() => {
    if (!currentReel?.id) return;
    const timer = setTimeout(() => {
      markReelAsWatched(currentReel.id);
    }, 3000);
    return () => clearTimeout(timer);
  }, [currentReel?.id]);

  const goToNext = useCallback(() => {
    setDragOffsetY(0);
    setSlideDirection(1);
    setHistoryIndex(prev => {
      const nextIdx = prev + 1;
      if (nextIdx >= feedHistory.length) {
        const bundled = getBundledReels(true);
        if (bundled.length > 0) {
          setFeedHistory(old => [...old, ...bundled.slice(0, 5)]);
        }
      }
      return nextIdx;
    });
  }, [feedHistory.length]);

  const goToPrev = useCallback(() => {
    setDragOffsetY(0);
    setSlideDirection(-1);
    setHistoryIndex(prev => Math.max(0, prev - 1));
  }, []);

  const handleToggleSave = useCallback((targetReel?: AnimeReel) => {
    const target = targetReel || currentReel;
    if (!target?.id) return;

    const isNowSaved = toggleSaveReel(target);
    setSavedStatus(prev => ({ ...prev, [target.id]: isNowSaved }));

    if (onShowToast) {
      onShowToast('info', isNowSaved ? 'Saved to Bookmarks' : 'Removed from Bookmarks', 'Saved Reels');
    }
  }, [currentReel, onShowToast]);

  const handleDownloadReel = () => {
    if (!currentReel) return;
    const downloadUrl = `https://drive.google.com/uc?export=download&id=${currentReel.id}`;
    const displayTitle = currentMeta?.animeTitle || currentReel.cleanTitle || 'Anime Reel';

    if (onShowToast) {
      onShowToast('success', `Starting download: ${displayTitle}...`, 'Reel Download');
    }

    try {
      const a = document.createElement('a');
      a.href = downloadUrl;
      a.download = `${currentReel.cleanTitle || 'Anime_Reel'}.mp4`;
      a.target = '_blank';
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
    } catch {
      window.open(downloadUrl, '_blank');
    }
  };

  const handleShare = async () => {
    if (!currentReel) return;
    const shareUrl = `${window.location.origin}/reel/${encodeURIComponent(currentReel.id)}`;

    if (navigator.share) {
      try {
        await navigator.share({ url: shareUrl });
        return;
      } catch (err: any) {
        if (err.name === 'AbortError') return;
      }
    }

    if (navigator.clipboard) {
      try {
        await navigator.clipboard.writeText(shareUrl);
        if (onShowToast) onShowToast('success', 'Reel link copied!', 'Share Reel');
      } catch {}
    }
  };

  // Double Tap Heart Burst
  const handleCanvasInteraction = useCallback(() => {
    const now = Date.now();
    const DOUBLE_TAP_GAP = 280;

    if (now - lastTapTimeRef.current < DOUBLE_TAP_GAP) {
      if (tapTimerRef.current) {
        clearTimeout(tapTimerRef.current);
        tapTimerRef.current = null;
      }
      setShowHeartBurst(true);
      setTimeout(() => setShowHeartBurst(false), 900);
      handleToggleSave();
      lastTapTimeRef.current = 0;
    } else {
      lastTapTimeRef.current = now;
      tapTimerRef.current = setTimeout(() => {
        tapTimerRef.current = null;
      }, DOUBLE_TAP_GAP);
    }
  }, [handleToggleSave]);

  // Touch Swipe & Drag Physics Handlers
  const handleTouchStart = (e: React.TouchEvent) => {
    const touch = e.touches[0];
    touchStartYRef.current = touch.clientY;
    touchStartTimeRef.current = Date.now();
    setIsDragging(true);
  };

  const handleTouchMove = (e: React.TouchEvent) => {
    if (!touchStartYRef.current || !isDragging) return;
    const touch = e.touches[0];
    const diffY = touch.clientY - touchStartYRef.current;
    setDragOffsetY(diffY);
  };

  const handleTouchEnd = (e: React.TouchEvent) => {
    if (!touchStartYRef.current) return;
    setIsDragging(false);
    const diffY = e.changedTouches[0].clientY - touchStartYRef.current;
    const timeDiff = Date.now() - touchStartTimeRef.current;
    touchStartYRef.current = null;

    const DRAG_THRESHOLD = 50;
    const isQuickFlick = timeDiff < 300 && Math.abs(diffY) > 30;

    if (diffY < -DRAG_THRESHOLD || (isQuickFlick && diffY < 0)) {
      goToNext();
    } else if (diffY > DRAG_THRESHOLD || (isQuickFlick && diffY > 0)) {
      goToPrev();
    } else {
      setDragOffsetY(0);
      if (timeDiff < 220 && Math.abs(diffY) < 15) {
        handleCanvasInteraction();
      }
    }
  };

  // Wheel Scroll Handler
  const handleWheel = (e: React.WheelEvent) => {
    const now = Date.now();
    const WHEEL_COOLDOWN = 380;
    if (now - lastWheelTimeRef.current < WHEEL_COOLDOWN) return;

    if (Math.abs(e.deltaY) > 20) {
      lastWheelTimeRef.current = now;
      if (e.deltaY > 0) {
        goToNext();
      } else {
        goToPrev();
      }
    }
  };

  // Keyboard navigation
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      const activeEl = document.activeElement;
      if (activeEl && (['INPUT', 'TEXTAREA', 'SELECT'].includes(activeEl.tagName) || activeEl.isContentEditable)) {
        return;
      }
      if (e.key === 'ArrowDown' || e.key === 'j' || e.key === 'J') {
        e.preventDefault();
        goToNext();
      } else if (e.key === 'ArrowUp' || e.key === 'k' || e.key === 'K') {
        e.preventDefault();
        goToPrev();
      } else if (e.key === 's' || e.key === 'S') {
        e.preventDefault();
        handleToggleSave();
      } else if (e.key === 'Escape' && onBack) {
        e.preventDefault();
        onBack();
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [goToNext, goToPrev, handleToggleSave, onBack]);

  const currentMeta = currentReel ? enrichedMetadata[currentReel.id] : null;
  const displayTitle = currentMeta?.animeTitle || currentReel?.cleanTitle || 'Anime Edit';

  return (
    <div
      ref={containerRef}
      onWheel={handleWheel}
      onTouchStart={handleTouchStart}
      onTouchMove={handleTouchMove}
      onTouchEnd={handleTouchEnd}
      className="relative w-full h-[100dvh] bg-slate-950 text-white overflow-hidden select-none flex flex-col justify-between font-sans touch-pan-y"
    >
      {/* Top Floating Header Overlay */}
      <div className="absolute top-0 left-0 right-0 z-30 flex items-center justify-between p-4 bg-gradient-to-b from-black/80 via-black/30 to-transparent pointer-events-auto">
        <div className="flex items-center gap-2">
          {onBack && (
            <button
              onClick={onBack}
              className="p-2 rounded-full bg-black/40 text-white hover:bg-black/60 backdrop-blur-md border border-white/10 transition-all cursor-pointer"
            >
              <ChevronLeft className="w-5 h-5" />
            </button>
          )}

          {/* Filter Mode Toggle */}
          <div className="flex items-center bg-black/50 p-1 rounded-full border border-white/10 backdrop-blur-md">
            <button
              onClick={() => setFilterMode('all')}
              className={`px-3.5 py-1 rounded-full text-xs font-bold transition-all ${
                filterMode === 'all'
                  ? 'bg-gradient-to-r from-pink-600 to-indigo-600 text-white shadow-lg'
                  : 'text-slate-400 hover:text-white'
              }`}
            >
              All Reels
            </button>
            <button
              onClick={() => setFilterMode('saved')}
              className={`px-3.5 py-1 rounded-full text-xs font-bold transition-all ${
                filterMode === 'saved'
                  ? 'bg-gradient-to-r from-pink-600 to-indigo-600 text-white shadow-lg'
                  : 'text-slate-400 hover:text-white'
              }`}
            >
              Saved ({Object.values(savedStatus).filter(Boolean).length})
            </button>
          </div>
        </div>

        {/* Scene Finder Trigger Button */}
        <button
          onClick={() => setIsSceneFinderOpen(true)}
          className="px-3.5 py-1.5 rounded-full bg-black/50 text-pink-400 hover:text-white border border-pink-500/30 backdrop-blur-md text-xs font-bold flex items-center gap-1.5 shadow-lg transition-all cursor-pointer"
        >
          <Camera className="w-4 h-4" />
          <span>Identify Scene</span>
        </button>
      </div>

      {/* Main Video Stage with Instagram Spring Slide Transitions */}
      <div className="relative w-full h-full flex items-center justify-center overflow-hidden">
        {feedHistory.length === 0 ? (
          /* Empty State */
          <div className="flex flex-col items-center justify-center text-center p-8 space-y-4 z-20">
            <div className="w-16 h-16 rounded-full bg-pink-500/20 text-pink-400 flex items-center justify-center text-3xl border border-pink-500/30">
              🔖
            </div>
            <h3 className="text-xl font-bold text-white">
              {filterMode === 'saved' ? 'No Saved Reels Yet' : 'Loading Reels Catalog...'}
            </h3>
            <p className="text-xs text-slate-400 max-w-xs">
              {filterMode === 'saved'
                ? 'Tap the bookmark button on any anime edit reel to save it to your collection.'
                : 'Fetching latest anime edit reels from Google Drive.'}
            </p>
            {filterMode === 'saved' ? (
              <button
                onClick={() => setFilterMode('all')}
                className="px-5 py-2.5 bg-pink-600 hover:bg-pink-500 text-white font-bold text-xs rounded-xl shadow-lg transition-all"
              >
                Explore All Reels
              </button>
            ) : (
              <button
                onClick={() => {
                  const bundled = getBundledReels(true);
                  setFeedHistory(bundled.length > 0 ? bundled : (bundledReelsRaw as any[]).map(sanitizeReelForStorage));
                  setHistoryIndex(0);
                }}
                className="px-5 py-2.5 bg-indigo-600 hover:bg-indigo-500 text-white font-bold text-xs rounded-xl shadow-lg flex items-center gap-2 transition-all"
              >
                <RefreshCw className="w-4 h-4" />
                <span>Reload Catalog</span>
              </button>
            )}
          </div>
        ) : (
          currentReel && (
            <AnimatePresence initial={false} custom={slideDirection} mode="popLayout">
              <motion.div
                key={currentReel.id}
                custom={slideDirection}
                variants={slideVariants}
                initial="enter"
                animate="center"
                exit="exit"
                style={{ y: dragOffsetY }}
                className="absolute inset-0 w-full h-full flex items-center justify-center cursor-pointer overflow-hidden"
              >
                {/* Background Ambient Poster Image */}
                <div className="absolute inset-0 bg-black -z-10 overflow-hidden">
                  <img
                    src={activePosterUrl}
                    alt=""
                    className="w-full h-full object-cover blur-3xl opacity-30 scale-125"
                  />
                </div>

                {/* Google Drive Embed Player (Zero WebView CORS blocks - plays video MP4 instantly!) */}
                <div className="w-full h-full max-w-[420px] max-h-[92vh] flex items-center justify-center overflow-hidden rounded-2xl border border-slate-800 bg-black shadow-2xl">
                  <iframe
                    key={currentReel.id}
                    src={embedPlayerUrl}
                    title={displayTitle}
                    allow="autoplay"
                    className="w-full h-full border-0 pointer-events-auto"
                  />
                </div>

                {/* Double Tap Heart Burst Animation */}
                {showHeartBurst && (
                  <motion.div
                    initial={{ scale: 0.5, opacity: 0 }}
                    animate={{ scale: 1.2, opacity: 1 }}
                    exit={{ scale: 0.5, opacity: 0 }}
                    className="absolute inset-0 flex items-center justify-center pointer-events-none z-40"
                  >
                    <Heart className="w-28 h-28 text-pink-500 fill-pink-500 drop-shadow-[0_0_25px_rgba(236,72,153,0.8)]" />
                  </motion.div>
                )}
              </motion.div>
            </AnimatePresence>
          )
        )}

        {/* Right Side Floating Action Buttons & Navigation Chevrons */}
        {feedHistory.length > 0 && currentReel && (
          <div className="absolute right-4 bottom-20 z-30 flex flex-col items-center gap-3.5 pointer-events-auto">
            {/* Scroll Up Button */}
            <button
              onClick={(e) => { e.stopPropagation(); goToPrev(); }}
              disabled={historyIndex === 0}
              className="p-3 rounded-full bg-black/50 text-white backdrop-blur-md border border-white/20 hover:bg-pink-600 disabled:opacity-30 transition-all cursor-pointer shadow-lg"
              title="Previous Reel"
            >
              <ChevronUp className="w-5 h-5" />
            </button>

            {/* Bookmark / Save Button */}
            <button
              onClick={(e) => { e.stopPropagation(); handleToggleSave(); }}
              className="flex flex-col items-center gap-1 group cursor-pointer"
            >
              <div className={`p-3 rounded-full backdrop-blur-md border transition-all ${
                savedStatus[currentReel.id]
                  ? 'bg-pink-600 text-white border-pink-500 shadow-[0_0_15px_rgba(236,72,153,0.5)]'
                  : 'bg-black/40 text-white border-white/20 hover:bg-black/60'
              }`}>
                <Bookmark className={`w-5 h-5 ${savedStatus[currentReel.id] ? 'fill-white' : ''}`} />
              </div>
              <span className="text-[10px] font-bold text-slate-200">Save</span>
            </button>

            {/* Download Reel Button */}
            <button
              onClick={(e) => { e.stopPropagation(); handleDownloadReel(); }}
              className="flex flex-col items-center gap-1 group cursor-pointer"
            >
              <div className="p-3 rounded-full bg-black/40 text-white backdrop-blur-md border border-white/20 hover:bg-pink-600 hover:border-pink-500 transition-all">
                <Download className="w-5 h-5" />
              </div>
              <span className="text-[10px] font-bold text-slate-200">Download</span>
            </button>

            {/* Share Button */}
            <button
              onClick={(e) => { e.stopPropagation(); handleShare(); }}
              className="flex flex-col items-center gap-1 group cursor-pointer"
            >
              <div className="p-3 rounded-full bg-black/40 text-white backdrop-blur-md border border-white/20 hover:bg-black/60 transition-all">
                <Share2 className="w-5 h-5" />
              </div>
              <span className="text-[10px] font-bold text-slate-200">Share</span>
            </button>

            {/* Scroll Down Button */}
            <button
              onClick={(e) => { e.stopPropagation(); goToNext(); }}
              className="p-3 rounded-full bg-pink-600 text-white backdrop-blur-md border border-pink-400 hover:bg-pink-500 transition-all cursor-pointer shadow-lg animate-pulse"
              title="Next Reel"
            >
              <ChevronDown className="w-5 h-5" />
            </button>
          </div>
        )}

        {/* Bottom Metadata Info Card */}
        {feedHistory.length > 0 && currentReel && (
          <div className="absolute bottom-6 left-4 right-20 z-30 flex flex-col gap-1.5 pointer-events-auto">
            {currentMeta && (
              <div className="inline-flex items-center gap-2">
                <span className="px-2 py-0.5 rounded bg-pink-500/20 text-pink-400 font-bold text-[10px] border border-pink-500/30">
                  Ep {currentMeta.episode || '1'} @ {currentMeta.timestamp || '0:00'}
                </span>
                <span className="text-[10px] text-slate-400 font-medium">trace.moe verified</span>
              </div>
            )}

            <h3 className="text-white font-extrabold text-base leading-snug drop-shadow-md">
              {displayTitle}
            </h3>

            <div className="flex items-center gap-2 text-xs text-slate-300 font-medium">
              <span>🎬 Anime Edit</span>
              <span>•</span>
              <span className="text-pink-400">#AniLoveReels</span>
            </div>
          </div>
        )}
      </div>

      {/* Trace.moe Scene Finder Modal */}
      <AnimeSceneFinderModal
        isOpen={isSceneFinderOpen}
        onClose={() => setIsSceneFinderOpen(false)}
        onShowToast={onShowToast}
      />
    </div>
  );
};
