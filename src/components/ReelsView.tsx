import React, { useState, useEffect, useRef, useCallback, useMemo } from 'react';
import {
  Bookmark,
  Play,
  Pause,
  ChevronUp,
  ChevronDown,
  ChevronLeft,
  Crop,
  Heart,
  Camera,
  Volume2,
  VolumeX,
  Download,
  RefreshCw,
  Send
} from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';
import { registerPlugin, Capacitor } from '@capacitor/core';
import { AnimeReel } from '../types';
import {
  getBundledReels,
  getStoredSavedReels,
  toggleSaveReel,
  preloadReels,
  getStartingReelsFeed,
  markReelAsWatched,
  fetchReelCloudMetadata,
  sanitizeReelForStorage,
  saveStoredReelsSession,
  EnrichedReelMetadata
} from '../services/reelsService';
import bundledReelsRaw from '../data/animeReels.json';
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

const DownloadPlugin = registerPlugin<any>('DownloadPlugin');

// Framer Motion Spring Slide Variants (Instagram / Shorts Style)
const slideVariants = {
  enter: (direction: number) => ({
    y: direction > 0 ? '100%' : '-100%',
    opacity: 0,
    scale: 0.97,
  }),
  center: {
    y: 0,
    opacity: 1,
    scale: 1,
    transition: {
      y: { type: 'spring', stiffness: 350, damping: 30 },
      opacity: { duration: 0.2 },
    },
  },
  exit: (direction: number) => ({
    y: direction < 0 ? '100%' : '-100%',
    opacity: 0,
    scale: 0.97,
    transition: {
      y: { type: 'spring', stiffness: 350, damping: 30 },
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
  const [isPlaying, setIsPlaying] = useState(true);
  const [isMuted, setIsMuted] = useState(false); // Unmuted audio by default as requested
  const [showPlayPauseFeedback, setShowPlayPauseFeedback] = useState<'play' | 'pause' | null>(null);
  const [progress, setProgress] = useState(0);
  const [duration, setDuration] = useState(0);
  const [currentTime, setCurrentTime] = useState(0);
  const [showHeartBurst, setShowHeartBurst] = useState(false);
  const [is2xSpeed, setIs2xSpeed] = useState(false);
  const [isVideoLoaded, setIsVideoLoaded] = useState(false);
  const [videoSrcOverride, setVideoSrcOverride] = useState<string | null>(null);

  // Scene Finder Modal & Cloud Enriched Metadata
  const [isSceneFinderOpen, setIsSceneFinderOpen] = useState(false);
  const [enrichedMetadata, setEnrichedMetadata] = useState<Record<string, EnrichedReelMetadata>>({});

  const [aspectFitMode, setAspectFitMode] = useState<'contain' | 'cover'>('cover');

  // Drag Physics State
  const [dragOffsetY, setDragOffsetY] = useState(0);
  const [isDragging, setIsDragging] = useState(false);

  const containerRef = useRef<HTMLDivElement>(null);
  const videoRef = useRef<HTMLVideoElement | null>(null);
  const seekbarRef = useRef<HTMLDivElement>(null);
  const isInitialMountRef = useRef<boolean>(true);

  // Gesture & Hold references
  const touchStartYRef = useRef<number | null>(null);
  const touchStartTimeRef = useRef<number>(0);
  const lastWheelTimeRef = useRef<number>(0);
  const tapTimerRef = useRef<NodeJS.Timeout | null>(null);
  const holdTimerRef = useRef<NodeJS.Timeout | null>(null);
  const lastTapTimeRef = useRef<number>(0);
  const isManuallyPausedRef = useRef<boolean>(false);

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

  // Save session state to restore position when switching tabs in app
  useEffect(() => {
    if (feedHistory.length > 0 && currentReel) {
      saveStoredReelsSession({
        feedHistory,
        historyIndex,
        filterMode,
        lastWatchedReelId: currentReel.id
      });
    }
  }, [historyIndex, feedHistory, filterMode, currentReel?.id]);

  // Direct Stream Source or RAM Blob URL
  const activeVideoUrl = useMemo(() => {
    if (videoSrcOverride) return videoSrcOverride;
    if (!currentReel?.id) return '';
    const syncBlob = reelMediaCache.getSynchronousBlobUrl(currentReel.id);
    if (syncBlob) return syncBlob;
    return `https://drive.google.com/uc?export=view&id=${currentReel.id}`;
  }, [currentReel?.id, videoSrcOverride]);

  // Poster Image Source
  const activePosterUrl = useMemo(() => {
    if (!currentReel?.id) return '';
    return `https://lh3.googleusercontent.com/d/${currentReel.id}`;
  }, [currentReel?.id]);

  useEffect(() => {
    setVideoSrcOverride(null);
    setIs2xSpeed(false);
    setIsVideoLoaded(false);
  }, [currentReel?.id, historyIndex]);

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
    if (!currentReel?.id || !isPlaying) return;
    const timer = setTimeout(() => {
      markReelAsWatched(currentReel.id);
    }, 3000);
    return () => clearTimeout(timer);
  }, [currentReel?.id, isPlaying]);

  // Preload upcoming reels
  useEffect(() => {
    if (!currentReel) return;
    const upcoming = feedHistory.slice(historyIndex + 1, historyIndex + 4).map(r => r.id);
    preloadReels([currentReel.id, ...upcoming]);
  }, [historyIndex, currentReel?.id, feedHistory]);

  // Instant Autoplay Loop
  useEffect(() => {
    isManuallyPausedRef.current = false;
    const video = getActiveVideo();
    if (!video || !currentReel) return;

    video.playbackRate = is2xSpeed ? 2.0 : 1.0;

    const playVideo = async () => {
      try {
        video.muted = isMuted;
        video.volume = 1.0;
        await video.play();
        setIsPlaying(true);
      } catch {
        try {
          video.muted = true;
          setIsMuted(true);
          await video.play();
          setIsPlaying(true);
        } catch {
          setIsPlaying(false);
        }
      }
    };

    playVideo();
  }, [historyIndex, currentReel?.id, activeVideoUrl, getActiveVideo]);

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

  const toggleMute = useCallback(() => {
    const video = getActiveVideo();
    if (!video) return;
    const nextMuted = !video.muted;
    video.muted = nextMuted;
    setIsMuted(nextMuted);
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

  // Native Android & Web Download Handler
  const handleDownloadReel = () => {
    if (!currentReel) return;
    const downloadUrl = `https://drive.google.com/uc?export=download&id=${currentReel.id}&confirm=t`;
    const displayTitle = currentMeta?.animeTitle || currentReel.cleanTitle || 'Anime Reel';

    if (onShowToast) {
      onShowToast('success', `Starting download: ${displayTitle}...`, 'Reel Download');
    }

    if (Capacitor.isNativePlatform()) {
      try {
        DownloadPlugin.startDownload({
          item: {
            id: `reel_${currentReel.id}`,
            anilistId: 0,
            animeTitle: 'Anime Reels',
            episodeNumber: historyIndex + 1,
            streamUrl: downloadUrl,
            pageUrl: downloadUrl,
            audio: 'SUB',
            quality: '1080p',
            serverName: 'GoogleDrive',
            status: 'QUEUED',
            progress: 0,
            bytesDownloaded: 0,
            totalBytes: 0,
            localFilePath: '',
            localSubPath: '',
            thumbnail: activePosterUrl,
            title: displayTitle,
          }
        }).catch(() => {
          window.open(downloadUrl, '_system');
        });
      } catch {
        window.open(downloadUrl, '_system');
      }
    } else {
      const a = document.createElement('a');
      a.href = downloadUrl;
      a.download = `${displayTitle}.mp4`;
      a.target = '_blank';
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
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

  // Tap & Double Tap
  const handleCanvasInteraction = useCallback(() => {
    const video = getActiveVideo();
    if (video && video.muted) {
      video.muted = false;
      setIsMuted(false);
    }

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

  // Long-press 2x Fast Forward Speed Handlers
  const handlePointerDown = (e: React.PointerEvent) => {
    const video = getActiveVideo();
    if (video && video.muted) {
      video.muted = false;
      setIsMuted(false);
    }

    touchStartYRef.current = e.clientY;
    touchStartTimeRef.current = Date.now();
    setIsDragging(true);

    if (holdTimerRef.current) clearTimeout(holdTimerRef.current);
    holdTimerRef.current = setTimeout(() => {
      const v = getActiveVideo();
      if (v) {
        v.playbackRate = 2.0;
        setIs2xSpeed(true);
      }
    }, 250);
  };

  const handlePointerUp = (e: React.PointerEvent) => {
    if (holdTimerRef.current) {
      clearTimeout(holdTimerRef.current);
      holdTimerRef.current = null;
    }

    const video = getActiveVideo();
    if (video && is2xSpeed) {
      video.playbackRate = 1.0;
      setIs2xSpeed(false);
    }

    if (!touchStartYRef.current) return;
    setIsDragging(false);

    const diffY = e.clientY - touchStartYRef.current;
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

  const handlePointerLeave = () => {
    if (holdTimerRef.current) {
      clearTimeout(holdTimerRef.current);
      holdTimerRef.current = null;
    }
    const video = getActiveVideo();
    if (video && is2xSpeed) {
      video.playbackRate = 1.0;
      setIs2xSpeed(false);
    }
    setIsDragging(false);
    setDragOffsetY(0);
  };

  // Interactive Bottom Seekbar Tap / Drag Handler
  const handleSeekbarInteraction = (e: React.MouseEvent<HTMLDivElement> | React.TouchEvent<HTMLDivElement>) => {
    e.stopPropagation();
    const video = getActiveVideo();
    if (!video || !seekbarRef.current || !duration) return;

    const rect = seekbarRef.current.getBoundingClientRect();
    const clientX = 'touches' in e ? e.touches[0].clientX : e.clientX;
    const clickPos = Math.max(0, Math.min(clientX - rect.left, rect.width));
    const targetPercentage = clickPos / rect.width;
    const newTime = targetPercentage * duration;

    video.currentTime = newTime;
    setCurrentTime(newTime);
    setProgress(targetPercentage * 100);
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
      } else if (e.key === ' ' || e.key === 'Spacebar') {
        e.preventDefault();
        togglePlay();
      } else if (e.key === 'm' || e.key === 'M') {
        e.preventDefault();
        toggleMute();
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
  }, [goToNext, goToPrev, togglePlay, toggleMute, handleToggleSave, onBack]);

  const handleVideoError = () => {
    if (currentReel?.id && !videoSrcOverride) {
      setVideoSrcOverride(`https://drive.usercontent.google.com/download?id=${currentReel.id}&export=view`);
    }
  };

  const currentMeta = currentReel ? enrichedMetadata[currentReel.id] : null;
  const displayTitle = currentMeta?.animeTitle || currentReel?.cleanTitle || 'Anime Edit';

  return (
    <div
      ref={containerRef}
      onWheel={handleWheel}
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

        <div className="flex items-center gap-2">
          {/* Mute/Unmute Quick Toggle */}
          <button
            onClick={toggleMute}
            className="p-2 rounded-full bg-black/50 text-white backdrop-blur-md border border-white/10 transition-all cursor-pointer"
            title={isMuted ? 'Unmute' : 'Mute'}
          >
            {isMuted ? <VolumeX className="w-4 h-4 text-pink-400" /> : <Volume2 className="w-4 h-4 text-emerald-400" />}
          </button>

          {/* Scene Finder Trigger Button */}
          <button
            onClick={() => setIsSceneFinderOpen(true)}
            className="px-3.5 py-1.5 rounded-full bg-black/50 text-pink-400 hover:text-white border border-pink-500/30 backdrop-blur-md text-xs font-bold flex items-center gap-1.5 shadow-lg transition-all cursor-pointer"
          >
            <Camera className="w-4 h-4" />
            <span>Identify Scene</span>
          </button>
        </div>
      </div>

      {/* 2x Fast Forward Small White Text Badge Indicator */}
      <AnimatePresence>
        {is2xSpeed && (
          <motion.div
            initial={{ opacity: 0, y: -15, scale: 0.9 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: -15, scale: 0.9 }}
            className="absolute top-16 left-1/2 -translate-x-1/2 z-40 px-3 py-1 rounded-full bg-black/60 text-white font-extrabold text-xs backdrop-blur-md border border-white/20 shadow-lg flex items-center gap-1.5 pointer-events-none"
          >
            <span>2x Speed</span>
          </motion.div>
        )}
      </AnimatePresence>

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
                onPointerDown={handlePointerDown}
                onPointerUp={handlePointerUp}
                onPointerLeave={handlePointerLeave}
                className="absolute inset-0 w-full h-full flex items-center justify-center cursor-pointer overflow-hidden touch-none"
              >
                {/* Background Ambient Blur Poster */}
                <div className="absolute inset-0 bg-black -z-10 overflow-hidden">
                  <img
                    src={activePosterUrl}
                    alt=""
                    className="w-full h-full object-cover blur-3xl opacity-30 scale-125"
                  />
                </div>

                {/* Zero-Flash Poster Overlay Mask */}
                <div
                  className={`absolute inset-0 w-full h-full flex items-center justify-center pointer-events-none transition-opacity duration-300 z-10 ${
                    isVideoLoaded ? 'opacity-0' : 'opacity-100'
                  }`}
                >
                  <img
                    src={activePosterUrl}
                    alt=""
                    className={`w-full h-full ${
                      aspectFitMode === 'cover' ? 'object-cover' : 'object-contain max-w-[420px] max-h-[92vh]'
                    }`}
                  />
                </div>

                {/* Pure Borderless HTML5 Video Element (NO Google Drive Embed Controls!) */}
                <video
                  id="active-reel-video"
                  ref={el => { videoRef.current = el; }}
                  src={activeVideoUrl}
                  poster={activePosterUrl}
                  autoPlay
                  playsInline
                  loop
                  muted={isMuted}
                  referrerPolicy="no-referrer"
                  onError={handleVideoError}
                  onPlaying={() => setIsVideoLoaded(true)}
                  onLoadedData={() => setIsVideoLoaded(true)}
                  className={`w-full h-full ${
                    aspectFitMode === 'cover' ? 'object-cover' : 'object-contain max-w-[420px] max-h-[92vh]'
                  }`}
                  onCanPlay={e => {
                    e.currentTarget.play().then(() => setIsPlaying(true)).catch(() => {});
                  }}
                  onTimeUpdate={e => {
                    const el = e.currentTarget;
                    if (el.duration) {
                      setProgress((el.currentTime / el.duration) * 100);
                      setDuration(el.duration);
                      setCurrentTime(el.currentTime);
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

                {/* Play/Pause Glassmorphism Overlay Feedback */}
                {showPlayPauseFeedback && (
                  <div className="absolute inset-0 flex items-center justify-center pointer-events-none z-30">
                    <motion.div
                      initial={{ scale: 0.6, opacity: 0 }}
                      animate={{ scale: 1.1, opacity: 1 }}
                      exit={{ scale: 0.6, opacity: 0 }}
                      className="p-5 rounded-full bg-black/50 text-white backdrop-blur-md border border-white/20 shadow-2xl"
                    >
                      {showPlayPauseFeedback === 'play' ? <Play className="w-12 h-12 fill-white" /> : <Pause className="w-12 h-12 fill-white" />}
                    </motion.div>
                  </div>
                )}
              </motion.div>
            </AnimatePresence>
          )
        )}

        {/* Right Side Floating Action Column (Matching Image 2: Clean Transparent Line Icons) */}
        {feedHistory.length > 0 && currentReel && (
          <div className="absolute right-4 bottom-20 z-30 flex flex-col items-center gap-6 pointer-events-auto">
            {/* 1. Share / Send Icon */}
            <button
              onClick={(e) => { e.stopPropagation(); handleShare(); }}
              className="p-1.5 text-white/90 hover:text-white transition-all cursor-pointer drop-shadow-[0_2px_8px_rgba(0,0,0,0.8)] active:scale-90"
              title="Share Reel"
            >
              <Send className="w-6 h-6 -rotate-45" />
            </button>

            {/* 2. Bookmark / Save Icon */}
            <button
              onClick={(e) => { e.stopPropagation(); handleToggleSave(); }}
              className="p-1.5 text-white/90 hover:text-white transition-all cursor-pointer drop-shadow-[0_2px_8px_rgba(0,0,0,0.8)] active:scale-90"
              title="Save Reel"
            >
              <Bookmark className={`w-6 h-6 ${savedStatus[currentReel.id] ? 'fill-white text-white' : ''}`} />
            </button>

            {/* 3. Crop / Fit Mode Icon */}
            <button
              onClick={(e) => { e.stopPropagation(); setAspectFitMode(prev => prev === 'contain' ? 'cover' : 'contain'); }}
              className="p-1.5 text-white/90 hover:text-white transition-all cursor-pointer drop-shadow-[0_2px_8px_rgba(0,0,0,0.8)] active:scale-90"
              title="Fit / Fill Aspect Ratio"
            >
              <Crop className="w-6 h-6" />
            </button>

            {/* 4. Download Icon */}
            <button
              onClick={(e) => { e.stopPropagation(); handleDownloadReel(); }}
              className="p-1.5 text-white/90 hover:text-white transition-all cursor-pointer drop-shadow-[0_2px_8px_rgba(0,0,0,0.8)] active:scale-90"
              title="Download Reel"
            >
              <Download className="w-6 h-6" />
            </button>

            {/* 5. Chevron Up Icon */}
            <button
              onClick={(e) => { e.stopPropagation(); goToPrev(); }}
              disabled={historyIndex === 0}
              className="p-1.5 text-white/90 hover:text-white disabled:opacity-30 transition-all cursor-pointer drop-shadow-[0_2px_8px_rgba(0,0,0,0.8)] active:scale-90"
              title="Previous Reel"
            >
              <ChevronUp className="w-6 h-6" />
            </button>

            {/* 6. Chevron Down Icon */}
            <button
              onClick={(e) => { e.stopPropagation(); goToNext(); }}
              className="p-1.5 text-white/90 hover:text-white transition-all cursor-pointer drop-shadow-[0_2px_8px_rgba(0,0,0,0.8)] active:scale-90"
              title="Next Reel"
            >
              <ChevronDown className="w-6 h-6" />
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

      {/* Interactive Bottom Seekbar */}
      {feedHistory.length > 0 && currentReel && (
        <div
          ref={seekbarRef}
          onClick={handleSeekbarInteraction}
          onTouchStart={handleSeekbarInteraction}
          onTouchMove={handleSeekbarInteraction}
          className="relative w-full h-3.5 z-30 group cursor-pointer flex items-end px-2 pb-1"
        >
          <div className="w-full h-1 group-hover:h-2 rounded-full bg-white/20 relative overflow-hidden transition-all duration-200">
            <div
              className="h-full bg-gradient-to-r from-pink-500 via-purple-500 to-indigo-500 rounded-full transition-all duration-75 relative"
              style={{ width: `${progress}%` }}
            >
              <div className="absolute right-0 top-1/2 -translate-y-1/2 w-2.5 h-2.5 rounded-full bg-pink-400 shadow-[0_0_8px_#ec4899]" />
            </div>
          </div>
        </div>
      )}

      {/* Trace.moe Scene Finder Modal */}
      <AnimeSceneFinderModal
        isOpen={isSceneFinderOpen}
        onClose={() => setIsSceneFinderOpen(false)}
        onShowToast={onShowToast}
      />
    </div>
  );
};
