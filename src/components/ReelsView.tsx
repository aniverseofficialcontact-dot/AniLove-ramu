import React, { useState, useEffect, useRef, useCallback, useMemo } from 'react';
import {
  Bookmark,
  Play,
  Pause,
  Shuffle,
  ChevronUp,
  ChevronDown,
  ChevronLeft,
  Share2,
  Maximize2,
  Minimize2,
  Film,
  Download,
  Check,
  Crop,
  Heart,
  Camera,
  Tag
} from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';
import { AnimeReel } from '../types';
import {
  fetchAllReels,
  fetchReelById,
  getBundledReels,
  getStoredSavedReels,
  toggleSaveReel,
  preloadReels,
  getStartingReelsFeed,
  saveStoredReelsSession,
  clearReelsSession,
  markReelAsWatched,
  fetchReelCloudMetadata,
  saveReelCloudMetadata,
  syncLiveGoogleDriveFolder,
  EnrichedReelMetadata
} from '../services/reelsService';
import { reelMediaCache } from '../services/reelMediaCache';
import { AnimeSceneFinderModal } from './AnimeSceneFinderModal';

interface ReelsViewProps {
  onBack?: () => void;
  onNavigateToAccount?: () => void;
  onShowToast: (type: 'success' | 'info' | 'error' | 'sync', message: string, title?: string) => void;
  initialReelId?: string;
  initialFilterMode?: 'all' | 'saved';
  refreshTrigger?: number;
}

export const ReelsView: React.FC<ReelsViewProps> = ({
  onBack,
  onNavigateToAccount,
  onShowToast,
  initialReelId,
  initialFilterMode,
  refreshTrigger,
}) => {
  const [allReels, setAllReels] = useState<AnimeReel[]>(() => getBundledReels(false));
  const [savedStatus, setSavedStatus] = useState<Record<string, boolean>>(() => {
    const saved = getStoredSavedReels();
    const map: Record<string, boolean> = {};
    saved.forEach(r => { if (r?.id) map[r.id] = true; });
    return map;
  });
  const [filterMode, setFilterMode] = useState<'all' | 'saved'>(() => {
    if (initialFilterMode) return initialFilterMode;
    const session = getStartingReelsFeed(initialReelId, initialFilterMode);
    return session.filterMode || 'all';
  });

  const [feedHistory, setFeedHistory] = useState<AnimeReel[]>(() => {
    const session = getStartingReelsFeed(initialReelId, initialFilterMode);
    return session.feed;
  });
  const [historyIndex, setHistoryIndex] = useState<number>(() => {
    const session = getStartingReelsFeed(initialReelId, initialFilterMode);
    return session.index;
  });
  const [slideDirection, setSlideDirection] = useState<number>(1);
  
  const [isPlaying, setIsPlaying] = useState(true);
  const [showPlayPauseFeedback, setShowPlayPauseFeedback] = useState<'play' | 'pause' | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [isBuffering, setIsBuffering] = useState(false);
  const [progress, setProgress] = useState(0);
  const [duration, setDuration] = useState(0);
  const [currentTime, setCurrentTime] = useState(0);
  const [showHeartBurst, setShowHeartBurst] = useState(false);
  const [isFullscreen, setIsFullscreen] = useState(false);
  const [copiedLink, setCopiedLink] = useState(false);
  const [isFrameRendered, setIsFrameRendered] = useState(false);

  // Scene Finder Modal & Cloud Enriched Metadata
  const [isSceneFinderOpen, setIsSceneFinderOpen] = useState(false);
  const [enrichedMetadata, setEnrichedMetadata] = useState<Record<string, EnrichedReelMetadata>>({});

  const [videoAspectRatio, setVideoAspectRatio] = useState<number>(9 / 16);
  const [aspectFitMode, setAspectFitMode] = useState<'contain' | 'cover'>('contain');

  const [dragOffsetY, setDragOffsetY] = useState(0);
  const [isDragging, setIsDragging] = useState(false);

  const containerRef = useRef<HTMLDivElement>(null);
  const videoRef = useRef<HTMLVideoElement | null>(null);

  const getActiveVideo = useCallback((): HTMLVideoElement | null => {
    if (videoRef.current && typeof videoRef.current.play === 'function') {
      return videoRef.current;
    }
    const el = document.getElementById('active-reel-video') as HTMLVideoElement | null;
    if (el) {
      videoRef.current = el;
      return el;
    }
    return null;
  }, []);

  const tapTimerRef = useRef<NodeJS.Timeout | null>(null);
  const lastTapTimeRef = useRef<number>(0);

  const currentReel = feedHistory[historyIndex] || null;

  // Direct Google Drive CDN Video Source
  const activeVideoUrl = useMemo(() => {
    if (!currentReel?.id) return '';
    return `https://lh3.googleusercontent.com/d/${currentReel.id}`;
  }, [currentReel?.id]);

  // Live Auto-Sync: Scrapes Google Drive folder on mount to automatically discover new reels added in future
  useEffect(() => {
    let isMounted = true;
    syncLiveGoogleDriveFolder('1L7FrLGfkUSNJNDGseo6g9K0itnS3xxdE').then(({ reels, newCount }) => {
      if (isMounted && newCount > 0) {
        setAllReels(reels);
        if (onShowToast) {
          onShowToast('success', `Synced ${newCount} new anime reels from Google Drive!`, 'Catalog Updated');
        }
      }
    });
    return () => { isMounted = false; };
  }, [onShowToast]);

  // Fetch enriched metadata from Cloud/Cache or trigger background trace.moe identification
  useEffect(() => {
    if (!currentReel?.id) return;
    const reelId = currentReel.id;

    let isMounted = true;
    fetchReelCloudMetadata(reelId).then(meta => {
      if (isMounted && meta) {
        setEnrichedMetadata(prev => ({ ...prev, [reelId]: meta }));
      }
    });

    return () => {
      isMounted = false;
    };
  }, [currentReel?.id]);

  // Mark reel as watched in local storage after 3s of playback
  useEffect(() => {
    if (!currentReel?.id || !isPlaying) return;
    const timer = setTimeout(() => {
      markReelAsWatched(currentReel.id);
    }, 3000);
    return () => clearTimeout(timer);
  }, [currentReel?.id, isPlaying]);

  // Keep URL path clean
  useEffect(() => {
    if (currentReel?.id && typeof window !== 'undefined') {
      try {
        const cleanPath = `/reel/${encodeURIComponent(currentReel.id)}`;
        if (window.location.pathname !== cleanPath) {
          window.history.replaceState(null, '', cleanPath);
        }
      } catch {}
    }
  }, [currentReel?.id]);

  // Preload upcoming reels
  useEffect(() => {
    if (!currentReel) return;
    const upcoming = feedHistory.slice(historyIndex + 1, historyIndex + 4).map(r => r.id);
    preloadReels([currentReel.id, ...upcoming]);
  }, [historyIndex, currentReel?.id, feedHistory]);

  // Auto-play video
  useEffect(() => {
    isManuallyPausedRef.current = false;
    const video = getActiveVideo();
    if (!video || !currentReel) return;

    video.muted = false;
    video.volume = 1.0;
    video.currentTime = 0;
    setProgress(0);
    setCurrentTime(0);

    const playPromise = video.play();
    if (playPromise !== undefined) {
      playPromise
        .then(() => {
          setIsPlaying(true);
          setIsBuffering(false);
        })
        .catch(() => {
          setIsPlaying(false);
          setIsBuffering(false);
        });
    }
  }, [historyIndex, currentReel, getActiveVideo]);

  const isManuallyPausedRef = useRef<boolean>(false);

  const goToNext = useCallback(() => {
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
    setSlideDirection(-1);
    setHistoryIndex(prev => Math.max(0, prev - 1));
  }, []);

  const togglePlay = useCallback(() => {
    const video = getActiveVideo();
    if (!video) return;

    if (video.paused) {
      isManuallyPausedRef.current = false;
      video.play().then(() => setIsPlaying(true)).catch(() => {});
      setShowPlayPauseFeedback('play');
    } else {
      isManuallyPausedRef.current = true;
      video.pause();
      setIsPlaying(false);
      setShowPlayPauseFeedback('pause');
    }

    setTimeout(() => setShowPlayPauseFeedback(null), 800);
  }, [getActiveVideo]);

  const handleToggleSave = useCallback((targetReel?: AnimeReel) => {
    const target = targetReel || currentReel;
    if (!target?.id) return;

    const isNowSaved = toggleSaveReel(target);
    setSavedStatus(prev => ({ ...prev, [target.id]: isNowSaved }));

    if (onShowToast) {
      onShowToast('info', isNowSaved ? 'Saved to Bookmarks' : 'Removed from Bookmarks', 'Saved Reels');
    }
  }, [currentReel, onShowToast]);

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
        setCopiedLink(true);
        setTimeout(() => setCopiedLink(false), 2000);
        if (onShowToast) onShowToast('success', 'Reel link copied!', 'Share Reel');
      } catch {}
    }
  };

  const handleCanvasInteraction = useCallback(() => {
    const video = getActiveVideo();
    if (!video) return;

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
        togglePlay();
        tapTimerRef.current = null;
      }, DOUBLE_TAP_GAP);
    }
  }, [getActiveVideo, handleToggleSave, togglePlay]);

  const isLandscape = videoAspectRatio > 1.1;
  const currentMeta = currentReel ? enrichedMetadata[currentReel.id] : null;
  const displayTitle = currentMeta?.animeTitle || currentReel?.cleanTitle || 'Anime Edit';

  return (
    <div
      ref={containerRef}
      className="relative w-full h-[100dvh] bg-slate-950 text-white overflow-hidden select-none flex flex-col justify-between font-sans"
    >
      {/* Top Floating Overlay Controls */}
      <div className="absolute top-0 left-0 right-0 z-30 flex items-center justify-between p-4 bg-gradient-to-b from-black/80 via-black/40 to-transparent pointer-events-auto">
        <div className="flex items-center gap-2">
          {onBack && (
            <button
              onClick={onBack}
              className="p-2 rounded-full bg-slate-900/60 text-white hover:bg-slate-800 backdrop-blur-md border border-slate-700/50 transition-all"
            >
              <ChevronLeft className="w-5 h-5" />
            </button>
          )}

          {/* Filter Mode Toggle */}
          <div className="flex items-center bg-slate-900/70 p-1 rounded-full border border-slate-700/50 backdrop-blur-md">
            <button
              onClick={() => setFilterMode('all')}
              className={`px-3 py-1 rounded-full text-xs font-bold transition-all ${
                filterMode === 'all'
                  ? 'bg-pink-600 text-white shadow-lg'
                  : 'text-slate-400 hover:text-white'
              }`}
            >
              All Reels
            </button>
            <button
              onClick={() => setFilterMode('saved')}
              className={`px-3 py-1 rounded-full text-xs font-bold transition-all ${
                filterMode === 'saved'
                  ? 'bg-pink-600 text-white shadow-lg'
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
          className="px-3 py-1.5 rounded-full bg-slate-900/80 text-pink-400 hover:text-white border border-pink-500/40 backdrop-blur-md text-xs font-bold flex items-center gap-1.5 shadow-lg transition-all"
        >
          <Camera className="w-4 h-4" />
          <span>Identify Scene</span>
        </button>
      </div>

      {/* Main Video Stage */}
      <div className="relative w-full h-full flex items-center justify-center overflow-hidden">
        {currentReel && (
          <div
            onClick={handleCanvasInteraction}
            className="relative w-full h-full flex items-center justify-center cursor-pointer"
          >
            {/* Background Ambient Poster */}
            <div className="absolute inset-0 bg-black -z-10 overflow-hidden">
              <img
                src={activeVideoUrl}
                alt=""
                className="w-full h-full object-cover blur-3xl opacity-30 scale-125"
              />
            </div>

            {/* Video Element */}
            <video
              id="active-reel-video"
              key={currentReel.id}
              ref={el => { videoRef.current = el; }}
              src={activeVideoUrl}
              poster={activeVideoUrl}
              autoPlay
              playsInline
              loop
              muted={false}
              className={`w-full h-full max-w-[420px] max-h-[92vh] ${
                aspectFitMode === 'cover' ? 'object-cover' : 'object-contain'
              }`}
              onTimeUpdate={e => {
                const el = e.currentTarget;
                if (el.duration) {
                  setProgress((el.currentTime / el.duration) * 100);
                  setDuration(el.duration);
                  setCurrentTime(el.currentTime);
                }
              }}
              onLoadedMetadata={e => {
                const el = e.currentTarget;
                if (el.videoWidth && el.videoHeight) {
                  setVideoAspectRatio(el.videoWidth / el.videoHeight);
                }
              }}
            />

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

            {/* Play/Pause Overlay Feedback */}
            {showPlayPauseFeedback && (
              <div className="absolute inset-0 flex items-center justify-center pointer-events-none z-30">
                <div className="p-4 rounded-full bg-black/60 text-white backdrop-blur-md animate-ping">
                  {showPlayPauseFeedback === 'play' ? <Play className="w-10 h-10 fill-white" /> : <Pause className="w-10 h-10 fill-white" />}
                </div>
              </div>
            )}
          </div>
        )}

        {/* Right Side Overlay Action Buttons */}
        <div className="absolute right-4 bottom-24 z-30 flex flex-col items-center gap-5">
          {/* Bookmark Button */}
          <button
            onClick={() => handleToggleSave()}
            className="flex flex-col items-center gap-1 group"
          >
            <div className={`p-3 rounded-full backdrop-blur-md border transition-all ${
              savedStatus[currentReel?.id || '']
                ? 'bg-pink-600 text-white border-pink-500 shadow-[0_0_15px_rgba(236,72,153,0.5)]'
                : 'bg-black/40 text-white border-white/20 hover:bg-black/60'
            }`}>
              <Bookmark className={`w-6 h-6 ${savedStatus[currentReel?.id || ''] ? 'fill-white' : ''}`} />
            </div>
            <span className="text-[10px] font-bold text-slate-200">Save</span>
          </button>

          {/* Share Button */}
          <button
            onClick={handleShare}
            className="flex flex-col items-center gap-1 group"
          >
            <div className="p-3 rounded-full bg-black/40 text-white backdrop-blur-md border border-white/20 hover:bg-black/60 transition-all">
              <Share2 className="w-6 h-6" />
            </div>
            <span className="text-[10px] font-bold text-slate-200">Share</span>
          </button>

          {/* Fit Mode Toggle */}
          <button
            onClick={() => setAspectFitMode(prev => prev === 'contain' ? 'cover' : 'contain')}
            className="flex flex-col items-center gap-1 group"
          >
            <div className="p-3 rounded-full bg-black/40 text-white backdrop-blur-md border border-white/20 hover:bg-black/60 transition-all">
              <Crop className="w-6 h-6" />
            </div>
            <span className="text-[10px] font-bold text-slate-200">{aspectFitMode === 'contain' ? 'Fit' : 'Fill'}</span>
          </button>
        </div>

        {/* Bottom Metadata Info Card */}
        <div className="absolute bottom-6 left-4 right-16 z-30 flex flex-col gap-1.5 pointer-events-auto">
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
      </div>

      {/* Progress Bar */}
      <div className="relative w-full h-1 bg-slate-800 z-30">
        <div
          className="h-full bg-gradient-to-r from-pink-500 to-indigo-500 transition-all duration-100"
          style={{ width: `${progress}%` }}
        />
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
