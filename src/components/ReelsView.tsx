import React, { useState, useEffect, useRef, useCallback, useMemo } from 'react';
import {
  Bookmark,
  Play,
  Pause,
  ChevronUp,
  ChevronDown,
  ChevronLeft,
  Film,
  Download,
  Check,
  Crop,
  Heart,
  Send
} from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';
import { Capacitor } from '@capacitor/core';
import { AnimeReel } from '../types';
import {
  fetchAllReels,
  fetchReelById,
  getBundledReels,
  getStoredSavedReels,
  toggleSaveReel,
  syncReelsFromGoogleDrive,
  preloadReels,
  getStartingReelsFeed,
  saveStoredReelsSession,
  recordReelToHistory,
  recordLastTwoWatchedReels
} from '../services/reelsService';
import { reelMediaCache } from '../services/reelMediaCache';
import { reelDeckManager, recordReelAsWatched } from '../services/reelRandomizer';
import { DownloadPlugin } from '../services/downloadManager';

interface ReelsViewProps {
  onBack?: () => void;
  onNavigateToAccount?: () => void;
  onShowToast: (type: 'success' | 'info' | 'error' | 'sync', message: string, title?: string) => void;
  initialReelId?: string;
  initialFilterMode?: 'all' | 'saved';
  refreshTrigger?: number;
}

const preloadedThumbnailCache = new Set<string>();

const renderTitleWithPinkNumber = (title?: string) => {
  if (!title) return 'Anime Reel';
  const match = title.match(/^(.*?)(\s*#\d+)?$/);
  if (match && match[2]) {
    return (
      <>
        <span>{match[1]}</span>
        <span className="text-pink-500 font-extrabold drop-shadow-[0_0_10px_rgba(236,72,153,0.6)] ml-1">{match[2]}</span>
      </>
    );
  }
  return title;
};

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
  const [copiedLink, setCopiedLink] = useState(false);
  const [isFrameRendered, setIsFrameRendered] = useState(false);
  const [is2xSpeed, setIs2xSpeed] = useState(false);
  const [isScrubbing, setIsScrubbing] = useState(false);

  const [videoAspectRatio, setVideoAspectRatio] = useState<number>(9 / 16);
  const [aspectFitMode, setAspectFitMode] = useState<'contain' | 'cover'>('cover');

  const [heartBurstPos, setHeartBurstPos] = useState<{ x: number; y: number } | null>(null);

  const [dragOffsetY, setDragOffsetY] = useState(0);
  const [isDragging, setIsDragging] = useState(false);

  const containerRef = useRef<HTMLDivElement>(null);
  const videoRef = useRef<HTMLVideoElement | null>(null);
  const seekbarRef = useRef<HTMLDivElement>(null);
  const holdTimerRef = useRef<NodeJS.Timeout | null>(null);
  const was2xHoldingRef = useRef<boolean>(false);
  const is2xSpeedRef = useRef<boolean>(false);

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
  const lastTouchTimeRef = useRef<number>(0);
  const lastWheelTimeRef = useRef<number>(0);
  const touchStartYRef = useRef<number | null>(null);
  const touchStartXRef = useRef<number | null>(null);
  const touchStartTimeRef = useRef<number>(0);
  const hasMovedSignificantRef = useRef<boolean>(false);
  const isManuallyPausedRef = useRef<boolean>(false);
  const hasUnlockedAudioRef = useRef<boolean>(false);

  const refreshSavedMap = useCallback(() => {
    const saved = getStoredSavedReels();
    const map: Record<string, boolean> = {};
    saved.forEach(r => {
      if (r && r.id) map[r.id] = true;
    });
    setSavedStatus(map);
  }, []);

  useEffect(() => {
    refreshSavedMap();
    window.addEventListener('anilove-saved-reels-updated', refreshSavedMap);
    return () => window.removeEventListener('anilove-saved-reels-updated', refreshSavedMap);
  }, [refreshSavedMap]);

  // Reset 2x speed whenever document visibility changes or app goes to background
  useEffect(() => {
    const reset2xSpeed = () => {
      if (holdTimerRef.current) {
        clearTimeout(holdTimerRef.current);
        holdTimerRef.current = null;
      }
      was2xHoldingRef.current = false;
      setIs2xSpeed(false);
      const v = getActiveVideo();
      if (v) {
        v.playbackRate = 1.0;
        if (!isManuallyPausedRef.current && v.paused) {
          v.play().then(() => setIsPlaying(true)).catch(() => {});
        }
      }
    };

    document.addEventListener('visibilitychange', reset2xSpeed);
    window.addEventListener('blur', reset2xSpeed);
    window.addEventListener('focus', reset2xSpeed);

    return () => {
      document.removeEventListener('visibilitychange', reset2xSpeed);
      window.removeEventListener('blur', reset2xSpeed);
      window.removeEventListener('focus', reset2xSpeed);
    };
  }, [getActiveVideo]);

  const pickRandomReel = useCallback((pool: AnimeReel[], excludeIds: string[] = []): AnimeReel | null => {
    if (!pool || pool.length === 0) return null;
    if (filterMode === 'saved') {
      const candidates = pool.filter(r => !excludeIds.includes(r.id));
      const selectionPool = candidates.length > 0 ? candidates : pool;
      const randIdx = Math.floor(Math.random() * selectionPool.length);
      return selectionPool[randIdx];
    }
    return reelDeckManager.pickNextReel(pool, excludeIds);
  }, [filterMode]);

  const currentPool = React.useMemo(() => {
    if (filterMode === 'saved') {
      return getStoredSavedReels();
    }
    return allReels;
  }, [allReels, filterMode, savedStatus]);

  useEffect(() => {
    let isMounted = true;
    const load = async () => {
      try {
        if (initialReelId) {
          fetchReelById(initialReelId).then(reel => {
            if (reel && isMounted) {
              setFeedHistory(prev => prev.map(item => {
                if (item.id === reel.id || item.id.toLowerCase() === reel.id.toLowerCase()) {
                  return { ...item, ...reel };
                }
                return item;
              }));
            }
          }).catch(() => {});
        }

        const data = await fetchAllReels(true);
        if (!isMounted) return;

        if (data && data.length > 0) {
          setAllReels(data);
          if (filterMode === 'all') {
            setFeedHistory(prev => {
              if (prev.length === 0) {
                const q = data.slice(0, 4);
                preloadReels(q.map(r => r.id));
                return q;
              }
              return prev;
            });
          }
        }
      } catch {
        // silent fallback to bundled
      }
    };

    load();
    return () => {
      isMounted = false;
    };
  }, [initialReelId, filterMode]);

  const feedHistoryRef = useRef(feedHistory);
  const historyIndexRef = useRef(historyIndex);
  const filterModeRef = useRef(filterMode);

  useEffect(() => {
    feedHistoryRef.current = feedHistory;
    historyIndexRef.current = historyIndex;
    filterModeRef.current = filterMode;
  }, [feedHistory, historyIndex, filterMode]);

  useEffect(() => {
    if (feedHistory.length > 0) {
      saveStoredReelsSession({
        feedHistory,
        historyIndex,
        lastWatchedReelId: feedHistory[historyIndex]?.id,
        filterMode,
      });
    }
  }, [feedHistory, historyIndex, filterMode]);

  useEffect(() => {
    return () => {
      if (feedHistoryRef.current.length > 0) {
        const idx = Math.max(0, Math.min(historyIndexRef.current, feedHistoryRef.current.length - 1));
        const currentItem = feedHistoryRef.current[idx];
        saveStoredReelsSession({
          feedHistory: feedHistoryRef.current,
          historyIndex: idx,
          lastWatchedReelId: currentItem?.id,
          filterMode: filterModeRef.current,
        });
      }
    };
  }, []);

  const prevInitialReelIdRef = useRef<string | undefined>(initialReelId);
  const prevInitialFilterModeRef = useRef<'all' | 'saved' | undefined>(initialFilterMode);

  useEffect(() => {
    const reelChanged = initialReelId !== undefined && initialReelId !== prevInitialReelIdRef.current;
    const modeChanged = initialFilterMode !== undefined && initialFilterMode !== prevInitialFilterModeRef.current;

    if (reelChanged || modeChanged) {
      prevInitialReelIdRef.current = initialReelId;
      prevInitialFilterModeRef.current = initialFilterMode;
      const targetMode = initialFilterMode || (initialReelId ? 'all' : undefined);
      const session = getStartingReelsFeed(initialReelId, targetMode);
      if (targetMode) setFilterMode(targetMode);
      setFeedHistory(session.feed);
      setHistoryIndex(session.index);
    }
  }, [initialReelId, initialFilterMode]);

  useEffect(() => {
    if (filterMode === 'saved' || currentPool.length === 0) return;
    const remainingAhead = feedHistory.length - 1 - historyIndex;
    if (remainingAhead < 3) {
      const needed = 3 - remainingAhead;
      const excludeIds = feedHistory.map(r => r.id);
      const newItems = reelDeckManager.drawNextReels(currentPool, needed, excludeIds);
      if (newItems.length > 0) {
        setFeedHistory(prev => [...prev, ...newItems]);
      }
    }
  }, [historyIndex, feedHistory.length, currentPool, filterMode]);

  const currentReel = feedHistory[historyIndex] || null;
  const nextReel1 = feedHistory[historyIndex + 1] || null;
  const nextReel2 = feedHistory[historyIndex + 2] || null;
  const nextReel3 = feedHistory[historyIndex + 3] || null;

  useEffect(() => {
    if (currentReel?.id) {
      recordReelAsWatched(currentReel.id);
      recordReelToHistory(currentReel);
      recordLastTwoWatchedReels(currentReel);
    }
  }, [currentReel?.id]);

  useEffect(() => {
    if (!currentReel?.id) return;
    reelMediaCache.preloadReel(currentReel.id, 'high');
  }, [currentReel?.id]);

  useEffect(() => {
    if (!currentReel) return;
    const idsToPreload = [
      currentReel.id,
      nextReel1?.id,
      nextReel2?.id,
      nextReel3?.id
    ].filter(Boolean) as string[];

    preloadReels(idsToPreload);

    for (const id of idsToPreload) {
      if (!preloadedThumbnailCache.has(id)) {
        preloadedThumbnailCache.add(id);
        const img = new Image();
        img.src = `https://lh3.googleusercontent.com/d/${id}`;
      }
    }
  }, [historyIndex, currentReel?.id, nextReel1?.id, nextReel2?.id, nextReel3?.id]);

  const prevVideoElementRef = useRef<HTMLVideoElement | null>(null);
  const [activeVideoUrl, setActiveVideoUrl] = useState<string>(() => {
    const session = getStartingReelsFeed(initialReelId, initialFilterMode);
    const firstReel = session.feed[session.index];
    if (firstReel?.id) {
      const syncUrl = reelMediaCache.getSynchronousObjectUrl(firstReel.id);
      return syncUrl || `https://drive.usercontent.google.com/download?id=${firstReel.id}&export=download&confirm=t`;
    }
    return '';
  });

  // Keep activeVideoUrl in sync with currentReel and real-time cache updates
  useEffect(() => {
    if (!currentReel?.id) {
      setActiveVideoUrl('');
      return;
    }
    const syncUrl = reelMediaCache.getSynchronousObjectUrl(currentReel.id);
    const directUrl = `https://drive.usercontent.google.com/download?id=${currentReel.id}&export=download&confirm=t`;
    setActiveVideoUrl(syncUrl || directUrl);

    if (!syncUrl) {
      reelMediaCache.preloadReel(currentReel.id, 'high').then(objUrl => {
        if (objUrl && feedHistoryRef.current[historyIndexRef.current]?.id === currentReel.id) {
          setActiveVideoUrl(objUrl);
        }
      }).catch(() => {});
    }
  }, [currentReel?.id]);

  // Real-time listener for in-memory / storage cache completion
  useEffect(() => {
    const unsubscribe = reelMediaCache.subscribe(({ reelId, objectUrl }) => {
      const activeId = feedHistoryRef.current[historyIndexRef.current]?.id;
      if (activeId === reelId && objectUrl) {
        setActiveVideoUrl(objectUrl);
      }
    });
    return unsubscribe;
  }, []);

  const playVideoSafely = useCallback((videoEl?: HTMLVideoElement | null) => {
    const v = videoEl || getActiveVideo();
    if (!v || isManuallyPausedRef.current) return;

    const performPlay = (muted: boolean) => {
      v.muted = muted;
      if (!muted) v.volume = 1.0;
      v.playbackRate = is2xSpeedRef.current ? 2.0 : 1.0;
      const p = v.play();
      if (p !== undefined) {
        return p.then(() => {
          setIsPlaying(true);
          setIsBuffering(false);
          setIsFrameRendered(true);
        });
      }
      setIsPlaying(true);
      return Promise.resolve();
    };

    if (hasUnlockedAudioRef.current) {
      performPlay(false).catch(() => {
        performPlay(true).catch(() => {});
      });
    } else {
      // First attempt unmuted; if autoplay policy blocks before gesture, fallback immediately to muted!
      performPlay(false).catch((err) => {
        performPlay(true).catch(() => {});
      });
    }
  }, [getActiveVideo]);

  const setVideoElementRef = useCallback((el: HTMLVideoElement | null) => {
    if (el) {
      if (prevVideoElementRef.current && prevVideoElementRef.current !== el) {
        try {
          prevVideoElementRef.current.pause();
          prevVideoElementRef.current.removeAttribute('src');
          prevVideoElementRef.current.load();
        } catch {}
      }
      prevVideoElementRef.current = el;
      videoRef.current = el;
      playVideoSafely(el);
    }
  }, [playVideoSafely]);

  // Smoothly update video playback rate on 2x hold/release without resetting playback time!
  useEffect(() => {
    is2xSpeedRef.current = is2xSpeed;
    const v = getActiveVideo();
    if (v) {
      v.playbackRate = is2xSpeed ? 2.0 : 1.0;
    }
  }, [is2xSpeed, getActiveVideo]);

  useEffect(() => {
    setIsFrameRendered(false);
    setIs2xSpeed(false);
    was2xHoldingRef.current = false;
  }, [currentReel?.id, historyIndex]);

  useEffect(() => {
    isManuallyPausedRef.current = false;
    const video = getActiveVideo();
    if (!video || !currentReel) return;

    video.playbackRate = is2xSpeedRef.current ? 2.0 : 1.0;
    video.currentTime = 0;
    setProgress(0);
    setCurrentTime(0);

    playVideoSafely(video);
  }, [historyIndex, currentReel?.id, getActiveVideo, playVideoSafely]);

  // Robust Watchdog / Playback Keeper: Auto-resumes and self-heals stalled network streams
  useEffect(() => {
    let lastRecordedTime = 0;
    let freezeTicks = 0;

    const interval = setInterval(() => {
      const v = getActiveVideo();
      if (!v || isManuallyPausedRef.current || !currentReel) {
        freezeTicks = 0;
        return;
      }

      // 1. If video is paused but user wants it playing and buffer has enough data
      if (v.paused && !v.ended && v.readyState >= 2) {
        playVideoSafely(v);
      }

      // 2. Detect mid-stream stall / network freeze
      if (!v.paused && !v.ended) {
        if (v.currentTime > 0 && Math.abs(v.currentTime - lastRecordedTime) < 0.05) {
          freezeTicks++;
          if (freezeTicks >= 3) {
            // Frozen for > 1.2 seconds
            setIsBuffering(true);
            const cachedObj = reelMediaCache.getSynchronousObjectUrl(currentReel.id);
            if (cachedObj && v.src !== cachedObj) {
              const savedPos = v.currentTime;
              v.src = cachedObj;
              v.currentTime = savedPos;
              playVideoSafely(v);
              freezeTicks = 0;
            } else if (freezeTicks >= 6) {
              // Frozen for > 2.4 seconds, trigger reload & resume
              const savedPos = v.currentTime;
              v.load();
              v.currentTime = savedPos;
              playVideoSafely(v);
              freezeTicks = 0;
            }
          }
        } else {
          freezeTicks = 0;
          lastRecordedTime = v.currentTime;
          if (isBuffering && v.readyState >= 3) {
            setIsBuffering(false);
          }
          if (!isFrameRendered && (v.currentTime > 0 || v.readyState >= 2)) {
            setIsFrameRendered(true);
          }
        }
      } else if (v.paused && !isManuallyPausedRef.current && v.readyState >= 1) {
        // Not paused by user, but paused by browser buffer underrun: auto kickstart!
        playVideoSafely(v);
      }
    }, 400);

    return () => clearInterval(interval);
  }, [getActiveVideo, playVideoSafely, currentReel, isBuffering, isFrameRendered]);

  useEffect(() => {
    const unlockAudio = () => {
      hasUnlockedAudioRef.current = true;
      const v = getActiveVideo();
      if (v) {
        v.muted = false;
        v.volume = 1.0;
        if (v.paused && !isManuallyPausedRef.current) {
          v.play()
            .then(() => {
              setIsPlaying(true);
            })
            .catch(() => {});
        }
      }
      cleanup();
    };

    const cleanup = () => {
      window.removeEventListener('click', unlockAudio);
      window.removeEventListener('touchstart', unlockAudio);
      window.removeEventListener('touchend', unlockAudio);
      window.removeEventListener('pointerdown', unlockAudio);
      window.removeEventListener('keydown', unlockAudio);
    };

    window.addEventListener('click', unlockAudio, { passive: true, once: true });
    window.addEventListener('touchstart', unlockAudio, { passive: true, once: true });
    window.addEventListener('touchend', unlockAudio, { passive: true, once: true });
    window.addEventListener('pointerdown', unlockAudio, { passive: true, once: true });
    window.addEventListener('keydown', unlockAudio, { passive: true, once: true });

    return cleanup;
  }, [getActiveVideo]);

  const goToNext = useCallback(() => {
    if (currentPool.length === 0) return;
    isManuallyPausedRef.current = false;
    setIsPlaying(true);
    setSlideDirection(1);
    setDragOffsetY(0);
    setIsDragging(false);

    if (filterMode === 'saved') {
      if (historyIndex < feedHistory.length - 1) {
        setHistoryIndex(prev => prev + 1);
      } else if (feedHistory.length > 1) {
        setHistoryIndex(0);
      }
      return;
    }

    if (historyIndex < feedHistory.length - 1) {
      setHistoryIndex(prev => prev + 1);
    } else {
      const exclude = feedHistory.slice(-20).map(r => r.id);
      const nextRandom = pickRandomReel(currentPool, exclude);
      if (nextRandom) {
        setFeedHistory(prev => [...prev, nextRandom]);
        setHistoryIndex(prev => prev + 1);
      }
    }
  }, [currentPool, feedHistory, historyIndex, filterMode, pickRandomReel]);

  const goToPrev = useCallback(() => {
    isManuallyPausedRef.current = false;
    setIsPlaying(true);
    if (filterMode === 'saved') {
      if (historyIndex > 0) {
        setSlideDirection(-1);
        setDragOffsetY(0);
        setIsDragging(false);
        setHistoryIndex(prev => prev - 1);
      } else if (feedHistory.length > 1) {
        setSlideDirection(-1);
        setDragOffsetY(0);
        setIsDragging(false);
        setHistoryIndex(feedHistory.length - 1);
      } else {
        setDragOffsetY(0);
        setIsDragging(false);
      }
      return;
    }

    if (historyIndex > 0) {
      setSlideDirection(-1);
      setDragOffsetY(0);
      setIsDragging(false);
      setHistoryIndex(prev => prev - 1);
    } else {
      setDragOffsetY(0);
      setIsDragging(false);
    }
  }, [historyIndex, filterMode, feedHistory.length]);

  const shuffleReel = useCallback(() => {
    if (currentPool.length <= 1) return;
    isManuallyPausedRef.current = false;
    setSlideDirection(1);
    if (filterMode === 'saved') {
      const otherIndices = feedHistory.map((_, i) => i).filter(i => i !== historyIndex);
      if (otherIndices.length > 0) {
        const nextIdx = otherIndices[Math.floor(Math.random() * otherIndices.length)];
        setHistoryIndex(nextIdx);
        saveStoredReelsSession({
          feedHistory,
          historyIndex: nextIdx,
          lastWatchedReelId: feedHistory[nextIdx]?.id,
          filterMode: 'saved',
        });
      }
      return;
    }
    reelDeckManager.ensureDeck(currentPool, true);
    const newQueue = reelDeckManager.drawNextReels(currentPool, 4, [currentReel?.id || '']);
    if (newQueue.length > 0) {
      setFeedHistory(newQueue);
      setHistoryIndex(0);
      setDragOffsetY(0);
      setIsPlaying(true);
      preloadReels(newQueue.map(r => r.id));
      reelMediaCache.preloadReel(newQueue[0].id, 'high');
      saveStoredReelsSession({
        feedHistory: newQueue,
        historyIndex: 0,
        lastWatchedReelId: newQueue[0].id,
        filterMode: 'all',
      });
    }
  }, [currentPool, currentReel?.id, filterMode, feedHistory, historyIndex]);

  const prevRefreshTriggerRef = useRef(refreshTrigger);
  useEffect(() => {
    if (refreshTrigger !== undefined && prevRefreshTriggerRef.current !== undefined && refreshTrigger !== prevRefreshTriggerRef.current) {
      prevRefreshTriggerRef.current = refreshTrigger;
      shuffleReel();
    } else if (refreshTrigger !== undefined) {
      prevRefreshTriggerRef.current = refreshTrigger;
    }
  }, [refreshTrigger, shuffleReel]);

  const togglePlay = useCallback(() => {
    const video = getActiveVideo();
    if (!video) return;

    video.muted = false;
    video.volume = 1.0;

    if (video.paused || isManuallyPausedRef.current) {
      isManuallyPausedRef.current = false;
      const p = video.play();
      if (p !== undefined) {
        p.then(() => {
          setIsPlaying(true);
          setShowPlayPauseFeedback('play');
          setTimeout(() => setShowPlayPauseFeedback(null), 650);
        }).catch(() => {});
      } else {
        setIsPlaying(true);
        setShowPlayPauseFeedback('play');
        setTimeout(() => setShowPlayPauseFeedback(null), 650);
      }
    } else {
      isManuallyPausedRef.current = true;
      video.pause();
      setIsPlaying(false);
      setShowPlayPauseFeedback('pause');
      setTimeout(() => setShowPlayPauseFeedback(null), 650);
    }
  }, [getActiveVideo]);

  const handleToggleSave = useCallback((targetReel?: AnimeReel) => {
    const target = targetReel || currentReel;
    if (!target || !target.id) return;

    const isCurrentlySaved = Boolean(savedStatus[target.id]);
    const isNowSaved = !isCurrentlySaved;

    setSavedStatus(prev => {
      const nextMap = { ...prev };
      if (isNowSaved) {
        nextMap[target.id] = true;
      } else {
        delete nextMap[target.id];
      }
      return nextMap;
    });

    toggleSaveReel(target);

    if (isNowSaved) {
      setShowHeartBurst(true);
      setTimeout(() => setShowHeartBurst(false), 900);
    }
  }, [currentReel, savedStatus]);

  const handleCanvasInteraction = useCallback((clientX?: number, clientY?: number) => {
    const video = getActiveVideo();
    if (video) {
      video.muted = false;
      video.volume = 1.0;
    }

    const now = Date.now();
    const DOUBLE_TAP_GAP = 280;

    if (tapTimerRef.current && (now - lastTapTimeRef.current < DOUBLE_TAP_GAP)) {
      clearTimeout(tapTimerRef.current);
      tapTimerRef.current = null;
      lastTapTimeRef.current = 0;

      if (typeof clientX === 'number' && typeof clientY === 'number') {
        setHeartBurstPos({ x: clientX, y: clientY });
      } else {
        setHeartBurstPos(null);
      }

      handleToggleSave();
    } else {
      lastTapTimeRef.current = now;
      if (tapTimerRef.current) clearTimeout(tapTimerRef.current);
      tapTimerRef.current = setTimeout(() => {
        tapTimerRef.current = null;
        lastTapTimeRef.current = 0;
        togglePlay();
      }, DOUBLE_TAP_GAP);
    }
  }, [handleToggleSave, togglePlay, getActiveVideo]);

  const handleTouchStart = (e: React.TouchEvent) => {
    lastTouchTimeRef.current = Date.now();
    if ((e.target as HTMLElement).closest('button, a, input, [data-interactive]')) {
      if (holdTimerRef.current) clearTimeout(holdTimerRef.current);
      return;
    }
    const touch = e.touches[0];
    touchStartYRef.current = touch.clientY;
    touchStartXRef.current = touch.clientX;
    touchStartTimeRef.current = Date.now();
    hasMovedSignificantRef.current = false;
    was2xHoldingRef.current = false;
    setIsDragging(true);

    if (holdTimerRef.current) clearTimeout(holdTimerRef.current);
    holdTimerRef.current = setTimeout(() => {
      const v = getActiveVideo();
      if (v) {
        v.playbackRate = 2.0;
        setIs2xSpeed(true);
        was2xHoldingRef.current = true;
      }
    }, 250);
  };

  const handleTouchMove = (e: React.TouchEvent) => {
    lastTouchTimeRef.current = Date.now();
    if (touchStartYRef.current === null) return;
    const touch = e.touches[0];
    const diffY = touch.clientY - touchStartYRef.current;
    const diffX = touch.clientX - (touchStartXRef.current || touch.clientX);

    if (Math.abs(diffY) > 20 || Math.abs(diffX) > 20) {
      hasMovedSignificantRef.current = true;
      if (holdTimerRef.current) {
        clearTimeout(holdTimerRef.current);
        holdTimerRef.current = null;
      }
      if (was2xHoldingRef.current) {
        const v = getActiveVideo();
        if (v) v.playbackRate = 1.0;
        setIs2xSpeed(false);
        was2xHoldingRef.current = false;
      }
    }

    if (Math.abs(diffY) > 12) {
      if (historyIndex === 0 && diffY > 0) {
        setDragOffsetY(diffY * 0.3);
      } else {
        setDragOffsetY(diffY);
      }
    }
  };

  const handleTouchEnd = (e: React.TouchEvent) => {
    if (holdTimerRef.current) {
      clearTimeout(holdTimerRef.current);
      holdTimerRef.current = null;
    }

    if ((e.target as HTMLElement).closest('button, a, input, [data-interactive]')) {
      if (was2xHoldingRef.current) {
        was2xHoldingRef.current = false;
        const v = getActiveVideo();
        if (v) v.playbackRate = 1.0;
        setIs2xSpeed(false);
      }
      setIsDragging(false);
      setDragOffsetY(0);
      touchStartYRef.current = null;
      touchStartXRef.current = null;
      return;
    }

    if (was2xHoldingRef.current) {
      was2xHoldingRef.current = false;
      const v = getActiveVideo();
      if (v) {
        v.playbackRate = 1.0;
        if (v.paused && !isManuallyPausedRef.current) {
          v.play().catch(() => {});
        }
      }
      setIs2xSpeed(false);
      setIsDragging(false);
      setDragOffsetY(0);
      touchStartYRef.current = null;
      touchStartXRef.current = null;
      return;
    }

    lastTouchTimeRef.current = Date.now();
    setIsDragging(false);
    if (touchStartYRef.current === null) return;

    const diffY = e.changedTouches[0].clientY - touchStartYRef.current;
    const diffX = e.changedTouches[0].clientX - (touchStartXRef.current || e.changedTouches[0].clientX);
    const timeDiff = Date.now() - touchStartTimeRef.current;
    const totalDistance = Math.hypot(diffX, diffY);

    const touchX = e.changedTouches[0].clientX;
    const touchY = e.changedTouches[0].clientY;

    touchStartYRef.current = null;
    touchStartXRef.current = null;

    const DRAG_THRESHOLD = 50;
    const isQuickFlick = timeDiff < 280 && Math.abs(diffY) > 30;

    if (diffY < -DRAG_THRESHOLD || (isQuickFlick && diffY < 0)) {
      goToNext();
    } else if (diffY > DRAG_THRESHOLD || (isQuickFlick && diffY > 0)) {
      goToPrev();
    } else {
      setDragOffsetY(0);
      if (!hasMovedSignificantRef.current || totalDistance < 25) {
        handleCanvasInteraction(touchX, touchY);
      }
    }
  };

  const handleMouseDown = (e: React.MouseEvent) => {
    if (Date.now() - lastTouchTimeRef.current < 800) return;
    if ((e.target as HTMLElement).closest('button, a, input, [data-interactive]')) {
      if (holdTimerRef.current) clearTimeout(holdTimerRef.current);
      return;
    }
    touchStartYRef.current = e.clientY;
    touchStartXRef.current = e.clientX;
    touchStartTimeRef.current = Date.now();
    hasMovedSignificantRef.current = false;
    was2xHoldingRef.current = false;
    setIsDragging(true);

    if (holdTimerRef.current) clearTimeout(holdTimerRef.current);
    holdTimerRef.current = setTimeout(() => {
      const v = getActiveVideo();
      if (v) {
        v.playbackRate = 2.0;
        setIs2xSpeed(true);
        was2xHoldingRef.current = true;
      }
    }, 250);
  };

  const handleMouseMove = (e: React.MouseEvent) => {
    if (Date.now() - lastTouchTimeRef.current < 800) return;
    if (touchStartYRef.current === null) return;
    const diffY = e.clientY - touchStartYRef.current;
    const diffX = e.clientX - (touchStartXRef.current || e.clientX);

    if (Math.abs(diffY) > 20 || Math.abs(diffX) > 20) {
      hasMovedSignificantRef.current = true;
      if (holdTimerRef.current) {
        clearTimeout(holdTimerRef.current);
        holdTimerRef.current = null;
      }
      if (was2xHoldingRef.current) {
        const v = getActiveVideo();
        if (v) v.playbackRate = 1.0;
        setIs2xSpeed(false);
        was2xHoldingRef.current = false;
      }
    }

    if (Math.abs(diffY) > 10) {
      if (historyIndex === 0 && diffY > 0) {
        setDragOffsetY(diffY * 0.3);
      } else {
        setDragOffsetY(diffY);
      }
    }
  };

  const handleMouseUp = (e: React.MouseEvent) => {
    if (holdTimerRef.current) {
      clearTimeout(holdTimerRef.current);
      holdTimerRef.current = null;
    }

    if ((e.target as HTMLElement).closest('button, a, input, [data-interactive]')) {
      if (was2xHoldingRef.current) {
        was2xHoldingRef.current = false;
        const v = getActiveVideo();
        if (v) v.playbackRate = 1.0;
        setIs2xSpeed(false);
      }
      setIsDragging(false);
      setDragOffsetY(0);
      touchStartYRef.current = null;
      touchStartXRef.current = null;
      return;
    }

    if (was2xHoldingRef.current) {
      was2xHoldingRef.current = false;
      const v = getActiveVideo();
      if (v) {
        v.playbackRate = 1.0;
        if (v.paused && !isManuallyPausedRef.current) {
          v.play().catch(() => {});
        }
      }
      setIs2xSpeed(false);
      setIsDragging(false);
      setDragOffsetY(0);
      touchStartYRef.current = null;
      touchStartXRef.current = null;
      return;
    }

    if (Date.now() - lastTouchTimeRef.current < 800) return;
    setIsDragging(false);
    if (touchStartYRef.current === null) return;

    const diffY = e.clientY - touchStartYRef.current;
    const diffX = e.clientX - (touchStartXRef.current || e.clientX);
    const timeDiff = Date.now() - touchStartTimeRef.current;
    const totalDistance = Math.hypot(diffX, diffY);

    const mouseX = e.clientX;
    const mouseY = e.clientY;

    touchStartYRef.current = null;
    touchStartXRef.current = null;

    const DRAG_THRESHOLD = 50;
    const isQuickFlick = timeDiff < 280 && Math.abs(diffY) > 30;

    if (diffY < -DRAG_THRESHOLD || (isQuickFlick && diffY < 0)) {
      goToNext();
    } else if (diffY > DRAG_THRESHOLD || (isQuickFlick && diffY > 0)) {
      goToPrev();
    } else {
      setDragOffsetY(0);
      if (!hasMovedSignificantRef.current || totalDistance < 25) {
        handleCanvasInteraction(mouseX, mouseY);
      }
    }
  };

  const handleMouseLeave = () => {
    if (holdTimerRef.current) {
      clearTimeout(holdTimerRef.current);
      holdTimerRef.current = null;
    }
    if (was2xHoldingRef.current) {
      was2xHoldingRef.current = false;
      const v = getActiveVideo();
      if (v) v.playbackRate = 1.0;
      setIs2xSpeed(false);
    }
    if (isDragging) {
      setIsDragging(false);
      setDragOffsetY(0);
      touchStartYRef.current = null;
    }
  };

  const handleWheel = (e: React.WheelEvent) => {
    const now = Date.now();
    const WHEEL_COOLDOWN = 380;
    if (now - lastWheelTimeRef.current < WHEEL_COOLDOWN) return;

    if (Math.abs(e.deltaY) > 25) {
      lastWheelTimeRef.current = now;
      if (e.deltaY > 0) {
        goToNext();
      } else {
        goToPrev();
      }
    }
  };

  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (['INPUT', 'TEXTAREA', 'SELECT'].includes((e.target as HTMLElement)?.tagName)) return;

      if (e.key === 'ArrowDown' || e.key === 'j' || e.key === 'J') {
        e.preventDefault();
        goToNext();
      } else if (e.key === 'ArrowUp' || e.key === 'k' || e.key === 'K') {
        e.preventDefault();
        goToPrev();
      } else if (e.key === ' ' || e.key === 'Spacebar') {
        e.preventDefault();
        togglePlay();
      } else if (e.key === 's' || e.key === 'S') {
        e.preventDefault();
        handleToggleSave();
      } else if (e.key === 'r' || e.key === 'R') {
        e.preventDefault();
        shuffleReel();
      } else if (e.key === 'Escape' && onBack) {
        e.preventDefault();
        onBack();
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [goToNext, goToPrev, togglePlay, handleToggleSave, shuffleReel, onBack]);

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

    let copied = false;
    if (navigator.clipboard && window.isSecureContext) {
      try {
        await navigator.clipboard.writeText(shareUrl);
        copied = true;
      } catch {
        // fallback
      }
    }
    if (!copied) {
      try {
        const textArea = document.createElement('textarea');
        textArea.value = shareUrl;
        textArea.style.position = 'fixed';
        textArea.style.left = '-9999px';
        textArea.style.top = '-9999px';
        document.body.appendChild(textArea);
        textArea.focus();
        textArea.select();
        copied = document.execCommand('copy');
        document.body.removeChild(textArea);
      } catch {
        // silent
      }
    }

    if (copied) {
      setCopiedLink(true);
      setTimeout(() => setCopiedLink(false), 2000);
      onShowToast('info', 'Reel link copied to clipboard!', 'Link Copied');
    } else {
      onShowToast('info', shareUrl, 'Share Link');
    }
  };

  const handleDownloadReel = () => {
    if (!currentReel) return;
    const downloadUrl = `https://drive.usercontent.google.com/download?id=${currentReel.id}&export=download&confirm=t`;

    if (onShowToast) {
      onShowToast('success', `Downloading ${currentReel.cleanTitle || 'Reel'}...`, 'Reel Download');
    }

    if (Capacitor.isNativePlatform()) {
      try {
        DownloadPlugin.startDownload({
          item: {
            id: `reel_${currentReel.id}`,
            anilistId: 0,
            animeTitle: currentReel.cleanTitle || 'Anime Edit',
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
            thumbnail: `https://lh3.googleusercontent.com/d/${currentReel.id}`,
            title: currentReel.cleanTitle || 'Anime Edit',
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
      a.download = `${currentReel.cleanTitle || 'AnimeReel'}.mp4`;
      a.target = '_blank';
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
    }
  };

  const handleSeekbarScrub = (clientX: number) => {
    const video = getActiveVideo();
    if (!video || !seekbarRef.current || !duration) return;

    const rect = seekbarRef.current.getBoundingClientRect();
    const clickPos = Math.max(0, Math.min(clientX - rect.left, rect.width));
    const targetPercentage = clickPos / rect.width;
    const newTime = targetPercentage * duration;

    video.currentTime = newTime;
    setCurrentTime(newTime);
    setProgress(targetPercentage * 100);
  };

  const handleSeekbarStart = (e: React.MouseEvent<HTMLDivElement> | React.TouchEvent<HTMLDivElement>) => {
    e.stopPropagation();
    setIsScrubbing(true);
    const clientX = 'touches' in e ? e.touches[0].clientX : e.clientX;
    handleSeekbarScrub(clientX);
  };

  const handleSeekbarMove = (e: React.MouseEvent<HTMLDivElement> | React.TouchEvent<HTMLDivElement>) => {
    if (!isScrubbing) return;
    e.stopPropagation();
    const clientX = 'touches' in e ? e.touches[0].clientX : e.clientX;
    handleSeekbarScrub(clientX);
  };

  const handleSeekbarEnd = (e: React.MouseEvent<HTMLDivElement> | React.TouchEvent<HTMLDivElement>) => {
    if (isScrubbing) {
      e.stopPropagation();
      setIsScrubbing(false);
    }
  };

  const formatTime = (secs: number) => {
    if (isNaN(secs) || secs < 0) return '0:00';
    const m = Math.floor(secs / 60);
    const s = Math.floor(secs % 60);
    return `${m}:${s < 10 ? '0' : ''}${s}`;
  };

  const isLandscape = videoAspectRatio > 1.15;

  const slideVariants = {
    enter: (direction: number) => ({
      y: direction > 0 ? '100%' : '-100%',
    }),
    center: {
      y: 0,
      transition: {
        y: { type: 'tween', ease: [0.22, 1, 0.36, 1], duration: 0.28 },
      }
    },
    exit: (direction: number) => ({
      y: direction > 0 ? '-100%' : '100%',
      transition: {
        y: { type: 'tween', ease: [0.22, 1, 0.36, 1], duration: 0.28 },
      }
    })
  };

  return (
    <div
      ref={containerRef}
      id="anime-reels-container"
      onWheel={handleWheel}
      className="fixed inset-0 z-40 w-full h-[100dvh] bg-black text-white flex flex-col items-center justify-center select-none overflow-hidden touch-none"
    >
      <div className="absolute inset-0 overflow-hidden pointer-events-none -z-10">
        <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[700px] h-[700px] bg-gradient-to-tr from-pink-600/10 via-purple-600/10 to-indigo-600/10 rounded-full blur-[160px]" />
      </div>

      {/* Floating Top Header Bar */}
      <div className="absolute top-2 lg:top-18 inset-x-0 z-40 px-3 sm:px-6 py-2 flex items-center justify-between pointer-events-none">
        <div className="pointer-events-auto flex items-center gap-2">
          {onBack && (
            <button
              onClick={onBack}
              title={filterMode === 'saved' ? 'Return to Library' : 'Return to AniLove Home'}
              className="flex items-center gap-1.5 px-3.5 py-2 rounded-2xl bg-black/60 hover:bg-black/80 backdrop-blur-xl border border-white/15 text-slate-200 hover:text-white font-bold text-xs shadow-2xl transition active:scale-95 cursor-pointer"
            >
              <ChevronLeft className="w-4 h-4 text-pink-400" />
              <span className="hidden sm:inline">{filterMode === 'saved' ? 'Library' : 'Back'}</span>
            </button>
          )}
        </div>

        {filterMode === 'saved' ? (
          <div className="pointer-events-none flex items-center gap-1.5 px-3.5 py-1.5 rounded-2xl bg-black/60 backdrop-blur-xl border border-white/15 text-xs font-bold text-pink-300 shadow-2xl">
            <Bookmark className="w-3.5 h-3.5 fill-current text-pink-400" />
            <span>Saved Reels ({historyIndex + 1}/{feedHistory.length || Object.keys(savedStatus).length})</span>
          </div>
        ) : (
          <div />
        )}

        <div />
      </div>

      {/* 2x Speed White Text Badge Indicator */}
      <AnimatePresence>
        {is2xSpeed && (
          <motion.div
            initial={{ opacity: 0, y: -15, scale: 0.9 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: -15, scale: 0.9 }}
            className="absolute top-16 left-1/2 -translate-x-1/2 z-40 px-3.5 py-1 rounded-full bg-black/60 text-white font-extrabold text-xs backdrop-blur-md border border-white/20 shadow-xl flex items-center gap-1.5 pointer-events-none"
          >
            <span>2x Speed</span>
          </motion.div>
        )}
      </AnimatePresence>

      <div
        onMouseDown={handleMouseDown}
        onMouseMove={handleMouseMove}
        onMouseUp={handleMouseUp}
        onMouseLeave={handleMouseLeave}
        onTouchStart={handleTouchStart}
        onTouchMove={handleTouchMove}
        onTouchEnd={handleTouchEnd}
        className="relative w-full h-full flex items-center justify-center overflow-hidden select-none cursor-grab active:cursor-grabbing p-0"
      >
        {isLoading ? (
          <div className="flex flex-col items-center justify-center space-y-3 text-slate-400">
            <div className="w-12 h-12 rounded-full border-3 border-pink-500 border-t-transparent animate-spin" />
            <p className="text-sm font-bold text-slate-300">Loading Anime Reels...</p>
          </div>
        ) : !currentReel ? (
          <div className="text-center p-8 space-y-4 max-w-sm">
            <Film className="w-14 h-14 text-slate-600 mx-auto" />
            <h3 className="text-lg font-bold text-white">No Reels Found</h3>
            <p className="text-xs text-slate-400 leading-relaxed">
              {filterMode === 'saved'
                ? 'You have not saved any reels yet. Double-tap any video or tap the bookmark button to save.'
                : 'Tap the refresh button above or explore all reels.'}
            </p>
            {filterMode === 'saved' && (
              <button
                onClick={() => {
                  if (onBack) onBack();
                }}
                className="px-5 py-2.5 rounded-2xl bg-gradient-to-r from-pink-500 to-violet-600 text-white text-xs font-bold transition cursor-pointer shadow-lg shadow-pink-500/25"
              >
                Return to Library
              </button>
            )}
          </div>
        ) : (
          <div className="relative w-full h-full flex items-center justify-center overflow-hidden">
            <AnimatePresence initial={false} custom={slideDirection} mode="popLayout">
              <motion.div
                key={`${currentReel.id}-${historyIndex}`}
                custom={slideDirection}
                variants={slideVariants}
                initial="enter"
                animate="center"
                exit="exit"
                style={{
                  y: dragOffsetY,
                }}
                className="absolute inset-0 w-full h-full flex items-center justify-center overflow-hidden will-change-transform"
              >
                <div
                  className={`absolute inset-0 w-full h-full flex items-center justify-center pointer-events-none transition-opacity duration-200 z-10 ${
                    isFrameRendered ? 'opacity-0' : 'opacity-100'
                  }`}
                >
                  <div className="absolute inset-0 bg-slate-950/90" />
                  <img
                    src={`https://lh3.googleusercontent.com/d/${currentReel.id}`}
                    alt={currentReel.cleanTitle || 'Anime Reel'}
                    loading="eager"
                    decoding="sync"
                    // @ts-ignore
                    fetchPriority="high"
                    className={`relative z-10 w-full h-full ${
                      aspectFitMode === 'cover' ? 'object-cover w-full h-full' : 'object-contain w-full h-full'
                    }`}
                  />
                  {isBuffering && (
                    <div className="absolute inset-0 flex items-center justify-center bg-black/30 z-20">
                      <div className="w-10 h-10 rounded-full border-3 border-pink-500 border-t-transparent animate-spin" />
                    </div>
                  )}
                </div>

                {(isLandscape || aspectFitMode === 'contain') && (
                  <div className="absolute inset-0 overflow-hidden pointer-events-none -z-10">
                    <img
                      src={`https://lh3.googleusercontent.com/d/${currentReel.id}`}
                      alt=""
                      className="w-full h-full object-cover blur-3xl scale-125 opacity-40 brightness-75 transition-opacity duration-300"
                    />
                    <div className="absolute inset-0 bg-black/40" />
                  </div>
                )}

                <video
                  id="active-reel-video"
                  key={currentReel.id}
                  ref={setVideoElementRef}
                  src={activeVideoUrl}
                  poster={`https://lh3.googleusercontent.com/d/${currentReel.id}`}
                  autoPlay
                  playsInline
                  loop
                  muted={false}
                  preload="auto"
                  onPlay={(e) => {
                    e.currentTarget.playbackRate = is2xSpeed ? 2.0 : 1.0;
                    setIsPlaying(true);
                    setIsBuffering(false);
                    setIsFrameRendered(true);
                  }}
                  onPause={(e) => {
                    if (isManuallyPausedRef.current) {
                      setIsPlaying(false);
                    } else {
                      playVideoSafely(e.currentTarget);
                    }
                  }}
                  onCanPlay={(e) => {
                    setIsBuffering(false);
                    setIsFrameRendered(true);
                    if (!isManuallyPausedRef.current) {
                      playVideoSafely(e.currentTarget);
                    }
                  }}
                  onLoadedData={(e) => {
                    setIsBuffering(false);
                    setIsFrameRendered(true);
                    if (!isManuallyPausedRef.current) {
                      playVideoSafely(e.currentTarget);
                    }
                  }}
                  onCanPlayThrough={(e) => {
                    setIsBuffering(false);
                    setIsFrameRendered(true);
                    if (!isManuallyPausedRef.current) {
                      playVideoSafely(e.currentTarget);
                    }
                  }}
                  onLoadedMetadata={e => {
                    const target = e.currentTarget;
                    setDuration(target.duration || 0);
                    if (target.videoWidth && target.videoHeight) {
                      setVideoAspectRatio(target.videoWidth / target.videoHeight);
                    }
                    target.playbackRate = is2xSpeed ? 2.0 : 1.0;
                    setIsBuffering(false);
                    if (!isManuallyPausedRef.current) {
                      playVideoSafely(target);
                    }
                  }}
                  onTimeUpdate={e => {
                    const v = e.currentTarget;
                    if (v && v.duration) {
                      if (!isFrameRendered && (v.currentTime > 0 || v.readyState >= 2)) {
                        setIsFrameRendered(true);
                      }
                      setCurrentTime(v.currentTime);
                      setProgress((v.currentTime / v.duration) * 100);
                      setDuration(v.duration);
                    }
                  }}
                  onWaiting={() => setIsBuffering(true)}
                  onPlaying={() => {
                    setIsPlaying(true);
                    setIsBuffering(false);
                    setIsFrameRendered(true);
                  }}
                  onStalled={(e) => {
                    const v = e.currentTarget;
                    if (v.readyState >= 3) {
                      setIsBuffering(false);
                    } else {
                      setIsBuffering(true);
                      if (!isManuallyPausedRef.current) {
                        playVideoSafely(v);
                      }
                    }
                  }}
                  onError={(e) => {
                    setIsBuffering(false);
                    const v = e.currentTarget;
                    const cached = reelMediaCache.getSynchronousObjectUrl(currentReel.id);
                    if (cached && v.src !== cached) {
                      v.src = cached;
                      playVideoSafely(v);
                    } else {
                      const directUrl = `https://drive.usercontent.google.com/download?id=${currentReel.id}&export=download&confirm=t`;
                      if (v.src !== directUrl) {
                        v.src = directUrl;
                        v.load();
                        playVideoSafely(v);
                      }
                    }
                  }}
                  onEnded={e => {
                    const v = e.currentTarget;
                    if (v) {
                      v.currentTime = 0;
                      playVideoSafely(v);
                    }
                  }}
                  className={`w-full h-full ${
                    aspectFitMode === 'cover' ? 'object-cover w-full h-full' : 'object-contain max-w-[420px] md:max-w-[540px] max-h-[92vh]'
                  } bg-transparent`}
                />
              </motion.div>
            </AnimatePresence>

            <div className="absolute inset-0 bg-gradient-to-b from-black/60 via-transparent to-black/85 pointer-events-none z-10" />

            <AnimatePresence>
              {showPlayPauseFeedback && (
                <motion.div
                  initial={{ scale: 0.7, opacity: 0 }}
                  animate={{ scale: 1.1, opacity: 1 }}
                  exit={{ scale: 1.4, opacity: 0 }}
                  transition={{ duration: 0.4 }}
                  className="absolute inset-0 flex items-center justify-center pointer-events-none z-30"
                >
                  <div className="w-18 h-18 rounded-full bg-black/75 backdrop-blur-xl text-white flex items-center justify-center border border-white/25 shadow-2xl">
                    {showPlayPauseFeedback === 'play' ? (
                      <Play className="w-9 h-9 ml-1 fill-white" />
                    ) : (
                      <Pause className="w-9 h-9 fill-white" />
                    )}
                  </div>
                </motion.div>
              )}
            </AnimatePresence>

            {!isPlaying && !isBuffering && !showPlayPauseFeedback && (
              <div className="absolute inset-0 flex items-center justify-center pointer-events-none z-20">
                <div className="w-16 h-16 rounded-full bg-black/70 backdrop-blur-xl text-white flex items-center justify-center border border-white/25 shadow-2xl scale-110">
                  <Play className="w-8 h-8 ml-1 fill-white" />
                </div>
              </div>
            )}

            {/* Refined Double Tap Heart Pop Animation (Mirrored Exit Scale 0 & Opacity 0) */}
            <AnimatePresence>
              {showHeartBurst && (
                <motion.div
                  initial={{ scale: 0, opacity: 0 }}
                  animate={{ scale: 1.15, opacity: 1 }}
                  exit={{ scale: 0, opacity: 0 }}
                  transition={{ duration: 0.45, ease: 'easeInOut' }}
                  style={{
                    position: 'absolute',
                    left: heartBurstPos ? `${heartBurstPos.x}px` : '50%',
                    top: heartBurstPos ? `${heartBurstPos.y}px` : '50%',
                    transform: 'translate(-50%, -50%)',
                    zIndex: 50,
                    pointerEvents: 'none'
                  }}
                  className="pointer-events-none z-30"
                >
                  <Heart className="w-22 h-22 fill-pink-500 text-pink-500 drop-shadow-[0_0_25px_rgba(236,72,153,0.9)]" />
                </motion.div>
              )}
            </AnimatePresence>

            <div className="absolute right-3 sm:right-4 bottom-24 lg:bottom-20 flex flex-col items-center gap-4 sm:gap-5 z-30 pointer-events-auto">
              <button
                data-interactive="true"
                onTouchStart={(e) => e.stopPropagation()}
                onTouchEnd={(e) => {
                  e.stopPropagation();
                  e.preventDefault();
                  handleShare();
                }}
                onClick={(e) => {
                  e.stopPropagation();
                  e.preventDefault();
                  handleShare();
                }}
                title="Share Reel"
                className="p-1.5 text-white/90 hover:text-white transition-all duration-200 active:scale-75 cursor-pointer drop-shadow-[0_2px_8px_rgba(0,0,0,0.8)]"
              >
                {copiedLink ? (
                  <Check className="w-7 h-7 text-emerald-400 stroke-[2.2]" />
                ) : (
                  <Send className="w-7 h-7 stroke-[2.2] -rotate-12" />
                )}
              </button>

              <button
                data-interactive="true"
                onTouchStart={(e) => e.stopPropagation()}
                onTouchEnd={(e) => {
                  e.stopPropagation();
                  e.preventDefault();
                  handleToggleSave();
                }}
                onClick={(e) => {
                  e.stopPropagation();
                  e.preventDefault();
                  handleToggleSave();
                }}
                title={savedStatus[currentReel.id] ? 'Bookmarked (Tap to Unsave)' : 'Save Reel (S)'}
                className="p-1.5 text-white/90 hover:text-white transition-all duration-200 active:scale-75 cursor-pointer drop-shadow-[0_2px_8px_rgba(0,0,0,0.8)]"
              >
                <Bookmark
                  className={`w-7 h-7 stroke-[2.2] ${
                    savedStatus[currentReel.id] ? 'fill-white text-white' : ''
                  }`}
                />
              </button>

              <button
                data-interactive="true"
                onTouchStart={(e) => e.stopPropagation()}
                onTouchEnd={(e) => {
                  e.stopPropagation();
                  e.preventDefault();
                  handleDownloadReel();
                }}
                onClick={(e) => {
                  e.stopPropagation();
                  e.preventDefault();
                  handleDownloadReel();
                }}
                title="Download MP4 Video"
                className="p-1.5 text-white/90 hover:text-white transition-all duration-200 active:scale-75 cursor-pointer drop-shadow-[0_2px_8px_rgba(0,0,0,0.8)]"
              >
                <Download className="w-7 h-7 stroke-[2.2]" />
              </button>

              {/* Crop / Aspect Ratio Toggle (Cover Full Screen vs Fit Screen) */}
              <button
                data-interactive="true"
                onTouchStart={(e) => e.stopPropagation()}
                onTouchEnd={(e) => {
                  e.stopPropagation();
                  e.preventDefault();
                  const nextMode = aspectFitMode === 'contain' ? 'cover' : 'contain';
                  setAspectFitMode(nextMode);
                  if (onShowToast) {
                    onShowToast('info', nextMode === 'cover' ? 'Full Screen Cover' : 'Original Reel Fit (Full View)', 'Aspect Ratio');
                  }
                }}
                onClick={(e) => {
                  e.stopPropagation();
                  e.preventDefault();
                  const nextMode = aspectFitMode === 'contain' ? 'cover' : 'contain';
                  setAspectFitMode(nextMode);
                  if (onShowToast) {
                    onShowToast('info', nextMode === 'cover' ? 'Full Screen Cover' : 'Original Reel Fit (Full View)', 'Aspect Ratio');
                  }
                }}
                title={aspectFitMode === 'contain' ? 'Cover Full Screen' : 'Fit Entire Original Reel'}
                className={`p-1.5 transition-all duration-200 active:scale-75 cursor-pointer drop-shadow-[0_2px_8px_rgba(0,0,0,0.8)] ${
                  aspectFitMode === 'cover' ? 'text-pink-400' : 'text-white/90 hover:text-white'
                }`}
              >
                <Crop className="w-7 h-7 stroke-[2.2]" />
              </button>

              <div className="flex flex-col gap-3 pt-2">
                <button
                  data-interactive="true"
                  onTouchStart={(e) => e.stopPropagation()}
                  onTouchEnd={(e) => {
                    e.stopPropagation();
                    e.preventDefault();
                    goToPrev();
                  }}
                  onClick={(e) => {
                    e.stopPropagation();
                    e.preventDefault();
                    goToPrev();
                  }}
                  disabled={historyIndex === 0}
                  title="Previous Reel (Up Arrow / Scroll Up)"
                  className={`p-3 -m-1.5 transition-all duration-200 active:scale-75 drop-shadow-[0_2px_8px_rgba(0,0,0,0.8)] ${
                    historyIndex === 0
                      ? 'opacity-20 cursor-not-allowed text-white/30'
                      : 'text-white/90 hover:text-white cursor-pointer'
                  }`}
                >
                  <ChevronUp className="w-8 h-8 stroke-[2.5]" />
                </button>
                <button
                  data-interactive="true"
                  onTouchStart={(e) => e.stopPropagation()}
                  onTouchEnd={(e) => {
                    e.stopPropagation();
                    e.preventDefault();
                    goToNext();
                  }}
                  onClick={(e) => {
                    e.stopPropagation();
                    e.preventDefault();
                    goToNext();
                  }}
                  title="Next Reel (Down Arrow / Scroll Down / Swipe Up)"
                  className="p-3 -m-1.5 text-white/90 hover:text-white transition-all duration-200 active:scale-75 cursor-pointer drop-shadow-[0_2px_8px_rgba(0,0,0,0.8)]"
                >
                  <ChevronDown className="w-8 h-8 stroke-[2.5]" />
                </button>
              </div>
            </div>

            {/* Bottom Metadata & Scrubber Progress Bar */}
            <div className="absolute bottom-4 sm:bottom-6 inset-x-4 sm:inset-x-6 z-20 space-y-2 pointer-events-auto">
              <div className="pr-16 space-y-1">
                <h2 className="text-sm sm:text-base font-bold text-white line-clamp-2 drop-shadow-md">
                  {renderTitleWithPinkNumber(currentReel.cleanTitle)}
                </h2>
                <div className="flex flex-wrap items-center gap-2 text-[11px] font-semibold text-slate-300">
                  <span className="px-2 py-0.5 rounded-md bg-white/15 backdrop-blur-md border border-white/10 text-slate-200">
                    {currentReel.size || 'HD Video'}
                  </span>
                </div>
              </div>

              {/* Video Progress Scrubber Bar with Timestamps Visible ONLY During Dragging */}
              <div className="flex items-center gap-2.5 w-full">
                <span className={`text-[11px] font-bold text-slate-300 min-w-[28px] text-right font-mono drop-shadow transition-opacity duration-200 ${
                  isScrubbing ? 'opacity-100' : 'opacity-0 pointer-events-none'
                }`}>
                  {formatTime(currentTime)}
                </span>

                <div
                  ref={seekbarRef}
                  data-interactive="true"
                  onMouseDown={handleSeekbarStart}
                  onMouseMove={handleSeekbarMove}
                  onMouseUp={handleSeekbarEnd}
                  onTouchStart={handleSeekbarStart}
                  onTouchMove={handleSeekbarMove}
                  onTouchEnd={handleSeekbarEnd}
                  className="flex-1 h-3 group cursor-pointer flex items-center relative"
                >
                  <div className="w-full h-1.5 group-hover:h-2 rounded-full bg-white/20 relative overflow-hidden transition-all duration-150">
                    <div
                      className="h-full bg-gradient-to-r from-pink-500 via-purple-500 to-indigo-500 rounded-full transition-all duration-100 relative"
                      style={{ width: `${progress}%` }}
                    />
                  </div>
                </div>

                <span className={`text-[11px] font-bold text-slate-300 min-w-[28px] text-left font-mono drop-shadow transition-opacity duration-200 ${
                  isScrubbing ? 'opacity-100' : 'opacity-0 pointer-events-none'
                }`}>
                  {formatTime(duration)}
                </span>
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
};
