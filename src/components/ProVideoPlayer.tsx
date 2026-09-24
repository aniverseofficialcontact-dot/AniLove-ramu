import React, { useState, useEffect, useRef, useCallback } from 'react';
import {
  RefreshCw,
  AlertCircle,
  Server,
  Play,
  Pause,
  RotateCcw,
  RotateCw,
  FastForward,
  Maximize,
  Minimize,
  Settings,
  Subtitles,
  Check,
  ChevronDown,
  Globe,
  Sliders,
  X,
  Volume2,
} from 'lucide-react';
import { Anime, ThumbnailAppearance, StreamServerId, UserSettings } from '../types';
import { recordWatchProgress, getStoredSettings } from '../services/storage';
import {
  STREAM_PROVIDERS,
  DEFAULT_STREAM_PROVIDER_ID,
  isStreamProviderId,
  resolveEpisodeSource,
  StreamLanguage,
  StreamResolution,
  StreamSource,
  SUPPORTED_LANGUAGES,
} from '../services/streamingProviders';
import { Capacitor } from '@capacitor/core';

interface EpisodeItem {
  number: number;
  title: string;
  thumbnail: string;
  synopsis?: string;
  duration?: string;
  filler?: boolean;
}

interface ProVideoPlayerProps {
  anime: Anime;
  episodeNumber: number;
  episodeTitle?: string;
  seasonTitle?: string;
  episodesList?: EpisodeItem[];
  initialTime?: number;
  currentServer?: StreamServerId;
  selectedSubServer?: string;
  onServerChange?: (server: StreamServerId) => void;
  onSubServerChange?: (subServerName: string) => void;
  currentAudioLanguage?: StreamLanguage;
  onAudioLanguageChange?: (lang: StreamLanguage) => void;
  onEpisodeChange?: (episodeNumber: number) => void;
  onClosePlayer?: () => void;
  onThumbnailStyleChange?: (style: ThumbnailAppearance) => void;
  onProgressUpdate?: (anime: Anime, progress: number) => void;
  initialThumbnailStyle?: ThumbnailAppearance;
  settings?: UserSettings;
}

const AVAILABLE_QUALITIES: { label: string; value: StreamResolution }[] = [
  { label: 'Auto (Best)', value: 'auto' },
  { label: '1080p HD', value: '1080p' },
  { label: '720p', value: '720p' },
  { label: '480p', value: '480p' },
];

const AVAILABLE_SPEEDS = [0.5, 0.75, 1.0, 1.25, 1.5, 2.0];

const SUBTITLE_LANGUAGES = [
  { code: 'en', label: 'English' },
  { code: 'hi', label: 'Hindi (हिन्दी)' },
  { code: 'ja', label: 'Japanese (日本語)' },
  { code: 'es', label: 'Spanish (Español)' },
  { code: 'fr', label: 'French (Français)' },
  { code: 'de', label: 'German (Deutsch)' },
  { code: 'pt', label: 'Portuguese (Português)' },
  { code: 'ar', label: 'Arabic (العربية)' },
];

export const ProVideoPlayer: React.FC<ProVideoPlayerProps> = ({
  anime,
  episodeNumber,
  episodeTitle,
  seasonTitle,
  episodesList = [],
  initialTime = 0,
  currentServer,
  selectedSubServer,
  onServerChange,
  onSubServerChange,
  currentAudioLanguage,
  onAudioLanguageChange,
  onEpisodeChange,
  onThumbnailStyleChange,
  onProgressUpdate,
  initialThumbnailStyle = 'snapshot',
  settings,
}) => {
  // Player state
  const [isPlaying, setIsPlaying] = useState<boolean>(true);
  const [currentTime, setCurrentTime] = useState<number>(initialTime);
  const [duration, setDuration] = useState<number>((anime.duration || 24) * 60);
  const [isFullscreen, setIsFullscreen] = useState<boolean>(false);
  const [activeServer, setActiveServer] = useState<StreamServerId>(currentServer || DEFAULT_STREAM_PROVIDER_ID);
  const [selectedSubServerName, setSelectedSubServerName] = useState<string | undefined>(selectedSubServer || 'Server 1');
  const [audioMode, setAudioMode] = useState<StreamLanguage>(currentAudioLanguage || 'DUB');
  const [selectedQuality, setSelectedQuality] = useState<StreamResolution>('1080p');
  const [playbackSpeed, setPlaybackSpeed] = useState<number>(1.0);
  const [refreshKey, setRefreshKey] = useState<number>(0);

  // Subtitles state
  const [subtitlesEnabled, setSubtitlesEnabled] = useState<boolean>(true);
  const [selectedSubtitleLang, setSelectedSubtitleLang] = useState<string>('en');
  const [subtitleSize, setSubtitleSize] = useState<'normal' | 'large' | 'small'>('normal');

  // Controls overlay state
  const [showControls, setShowControls] = useState<boolean>(true);
  const [activeModal, setActiveModal] = useState<'none' | 'settings' | 'quality' | 'audio' | 'captions' | 'speed'>('none');
  const [seekFeedback, setSeekFeedback] = useState<'rewind' | 'forward' | null>(null);

  // Stream connection state
  const [streamSource, setStreamSource] = useState<StreamSource | null>(null);
  const [streamStatus, setStreamStatus] = useState<'loading' | 'ready' | 'error'>('loading');
  const [streamMessage, setStreamMessage] = useState<string>('Connecting to stream...');
  const [thumbnailStyle] = useState<ThumbnailAppearance>(initialThumbnailStyle);

  // Refs
  const playerContainerRef = useRef<HTMLDivElement>(null);
  const iframeRef = useRef<HTMLIFrameElement>(null);
  const controlsTimeoutRef = useRef<NodeJS.Timeout | null>(null);
  const lastTapTimeRef = useRef<number>(0);

  // Synchronize incoming props
  useEffect(() => {
    if (currentServer && currentServer !== activeServer) {
      setActiveServer(currentServer);
    }
  }, [currentServer]);

  useEffect(() => {
    if (selectedSubServer && selectedSubServer !== selectedSubServerName) {
      setSelectedSubServerName(selectedSubServer);
    }
  }, [selectedSubServer]);

  useEffect(() => {
    if (currentAudioLanguage && currentAudioLanguage !== audioMode) {
      setAudioMode(currentAudioLanguage);
    }
  }, [currentAudioLanguage]);

  // Synchronize preferences on mount
  useEffect(() => {
    try {
      const s = getStoredSettings();
      if (!currentServer) {
        const preferredServer = s.preferredServers?.[0];
        if (preferredServer && isStreamProviderId(preferredServer)) {
          setActiveServer(preferredServer);
        }
      }
      if (!currentAudioLanguage) {
        if (s.preferredLanguages && s.preferredLanguages.length > 0) {
          const pref = s.preferredLanguages[0];
          if (pref === 'SUB') setAudioMode('SUB');
          else setAudioMode('DUB');
        } else if (s.preferredAudio) {
          setAudioMode(s.preferredAudio === 'sub' ? 'SUB' : 'DUB');
        }
      }
    } catch (err) {
      console.error('Error syncing player preferences:', err);
    }
  }, []);

  // Sync fullscreen change events
  useEffect(() => {
    const handleFullscreenChange = () => {
      const isNowFullscreen = Boolean(
        document.fullscreenElement || (document as any).webkitFullscreenElement
      );
      setIsFullscreen(isNowFullscreen);
      if (!isNowFullscreen) {
        try {
          if (window.screen?.orientation && 'unlock' in window.screen.orientation) {
            (window.screen.orientation as any).unlock();
          }
        } catch {}
      }
    };

    document.addEventListener('fullscreenchange', handleFullscreenChange);
    document.addEventListener('webkitfullscreenchange', handleFullscreenChange);
    return () => {
      document.removeEventListener('fullscreenchange', handleFullscreenChange);
      document.removeEventListener('webkitfullscreenchange', handleFullscreenChange);
    };
  }, []);

  // Periodic watch progress recorder
  useEffect(() => {
    const interval = setInterval(() => {
      if (currentTime > 5 && streamStatus === 'ready') {
        recordWatchProgress({
          anime,
          episodeNumber,
          episodeTitle,
          seasonTitle,
          currentTime,
          duration,
          thumbnailStyle,
        });
        if (onProgressUpdate) onProgressUpdate(anime, episodeNumber);
      }
    }, 5000);
    return () => clearInterval(interval);
  }, [anime, episodeNumber, episodeTitle, seasonTitle, currentTime, duration, thumbnailStyle, streamStatus, onProgressUpdate]);

  // Auto-hide controls timer
  const resetControlsTimer = useCallback(() => {
    setShowControls(true);
    if (controlsTimeoutRef.current) {
      clearTimeout(controlsTimeoutRef.current);
    }
    controlsTimeoutRef.current = setTimeout(() => {
      if (activeModal === 'none') {
        setShowControls(false);
      }
    }, 4000);
  }, [activeModal]);

  useEffect(() => {
    resetControlsTimer();
    return () => {
      if (controlsTimeoutRef.current) clearTimeout(controlsTimeoutRef.current);
    };
  }, [resetControlsTimer]);

  // PostMessage command sender to iframe player
  const sendIframeCommand = useCallback((command: string, value?: any) => {
    try {
      if (iframeRef.current && iframeRef.current.contentWindow) {
        const targetWindow = iframeRef.current.contentWindow;

        const rawObjects: any[] = [
          { event: command, value, command, time: value },
          { event: 'command', func: command, args: [value] },
          { type: command, value, time: value },
          { method: command, arg: value, args: [value] },
          { action: command, seek: value, time: value },
          { api: 'player', func: command, args: [value] },
        ];

        if (command === 'seek' || command === 'seekTo' || command === 'currentTime') {
          const numTime = Number(value) || 0;
          rawObjects.push(
            { event: 'seek', time: numTime },
            { event: 'seekTo', time: numTime },
            { event: 'currentTime', currentTime: numTime },
            { type: 'seek', value: numTime },
            { type: 'currentTime', value: numTime },
            { action: 'seek', value: numTime, time: numTime },
            { target: 'video', command: 'seek', value: numTime },
            { method: 'setCurrentTime', value: numTime }
          );
        }

        if (command === 'speed' || command === 'playbackRate') {
          const numSpeed = Number(value) || 1.0;
          rawObjects.push(
            { event: 'setPlaybackRate', rate: numSpeed },
            { type: 'speed', value: numSpeed },
            { action: 'speed', speed: numSpeed },
            { method: 'setPlaybackRate', value: numSpeed }
          );
        }

        rawObjects.forEach(obj => {
          try {
            targetWindow.postMessage(obj, '*');
            targetWindow.postMessage(JSON.stringify(obj), '*');
          } catch {}
        });

        try {
          const doc = iframeRef.current.contentDocument || iframeRef.current.contentWindow.document;
          if (doc) {
            const videos = doc.querySelectorAll('video');
            videos.forEach(v => {
              if (['seek', 'seekTo', 'currentTime'].includes(command)) {
                v.currentTime = Number(value) || 0;
              } else if (command === 'play') {
                v.play().catch(() => {});
              } else if (command === 'pause') {
                v.pause();
              } else if (command === 'speed' || command === 'playbackRate') {
                v.playbackRate = Number(value) || 1.0;
              }
            });
          }
        } catch {}
      }
    } catch {}
  }, []);

  // Seek helper
  const seekDelta = (amount: number) => {
    const newTime = amount > 0 ? Math.min(duration, currentTime + amount) : Math.max(0, currentTime + amount);
    setCurrentTime(newTime);
    sendIframeCommand('seek', newTime);
    sendIframeCommand('seekTo', newTime);

    setSeekFeedback(amount > 0 ? 'forward' : 'rewind');
    setTimeout(() => setSeekFeedback(null), 700);
    resetControlsTimer();
  };

  // Skip Intro (+85s)
  const handleSkipIntro = () => {
    seekDelta(85);
  };

  // Toggle Play / Pause
  const togglePlayPause = () => {
    if (isPlaying) {
      sendIframeCommand('pause');
      setIsPlaying(false);
    } else {
      sendIframeCommand('play');
      setIsPlaying(true);
    }
    resetControlsTimer();
  };

  // Handle Playback Speed change
  const handleSpeedChange = (speed: number) => {
    setPlaybackSpeed(speed);
    sendIframeCommand('speed', speed);
    sendIframeCommand('playbackRate', speed);
    setActiveModal('none');
    resetControlsTimer();
  };

  // Handle Audio Language change
  const handleAudioChange = (lang: StreamLanguage) => {
    setAudioMode(lang);
    if (onAudioLanguageChange) onAudioLanguageChange(lang);
    setActiveModal('none');
    resetControlsTimer();
  };

  // Handle Quality change
  const handleQualityChange = (q: StreamResolution) => {
    setSelectedQuality(q);
    setActiveModal('none');
    handleReloadStream();
    resetControlsTimer();
  };

  // Fullscreen toggle
  const toggleFullscreen = () => {
    if (!playerContainerRef.current) return;
    const isCurrentlyFull = Boolean(document.fullscreenElement || (document as any).webkitFullscreenElement);

    if (!isCurrentlyFull) {
      if (playerContainerRef.current.requestFullscreen) {
        playerContainerRef.current.requestFullscreen().catch(() => {});
      } else if ((playerContainerRef.current as any).webkitRequestFullscreen) {
        (playerContainerRef.current as any).webkitRequestFullscreen();
      }
      setIsFullscreen(true);
      try {
        if (window.screen?.orientation && 'lock' in window.screen.orientation) {
          (window.screen.orientation as any).lock('landscape').catch(() => {});
        }
      } catch {}
    } else {
      if (document.exitFullscreen) {
        document.exitFullscreen().catch(() => {});
      } else if ((document as any).webkitExitFullscreen) {
        (document as any).webkitExitFullscreen();
      }
      setIsFullscreen(false);
      try {
        if (window.screen?.orientation && 'unlock' in window.screen.orientation) {
          (window.screen.orientation as any).unlock();
        }
      } catch {}
    }
    resetControlsTimer();
  };

  // Canvas Tap Handling (Single tap toggles controls, double tap seeks)
  const handleCanvasTap = (e: React.MouseEvent<HTMLDivElement>) => {
    const now = Date.now();
    const target = e.currentTarget;
    const rect = target.getBoundingClientRect();
    const clickX = e.clientX - rect.left;
    const isRightSide = clickX > rect.width / 2;

    if (now - lastTapTimeRef.current < 300) {
      // Double tap detected
      seekDelta(isRightSide ? 10 : -10);
      lastTapTimeRef.current = 0;
      return;
    }

    lastTapTimeRef.current = now;
    if (activeModal !== 'none') {
      setActiveModal('none');
      return;
    }
    setShowControls(prev => !prev);
    resetControlsTimer();
  };

  // Sync real video progress via iframe postMessage events
  useEffect(() => {
    const handlePlayerMessage = (e: MessageEvent) => {
      try {
        let data = e.data;
        if (!data) return;

        if (typeof data === 'string') {
          try {
            data = JSON.parse(data);
          } catch {
            return;
          }
        }

        if (typeof data !== 'object') return;

        if (
          data.type === 'vidlink_timeupdate' ||
          data.event === 'timeupdate' ||
          data.type === 'PLAYER_EVENT' ||
          data.event === 'PLAYER_TIMEUPDATE' ||
          data.event === 'time_update'
        ) {
          const t = Number(data.currentTime || data.data?.currentTime || data.time || data.currentTimeSeconds);
          const d = Number(data.duration || data.data?.duration || data.durationSeconds);
          if (!isNaN(t) && t >= 0) {
            setCurrentTime(t);
            setStreamStatus('ready');
          }
          if (!isNaN(d) && d > 30) {
            setDuration(d);
          }
        } else if (data.event === 'play' || data.type === 'play' || data.event === 'PLAYER_PLAY') {
          setIsPlaying(true);
          setStreamStatus('ready');
        } else if (data.event === 'pause' || data.type === 'pause' || data.event === 'PLAYER_PAUSE') {
          setIsPlaying(false);
        } else if (data.event === 'ended' || data.type === 'ended' || data.event === 'PLAYER_ENDED') {
          if (episodesList.length > 0 && onEpisodeChange && episodeNumber < episodesList.length) {
            const settings = getStoredSettings();
            if (settings.autoPlayNextEpisode) {
              onEpisodeChange(episodeNumber + 1);
            }
          }
        }
      } catch {}
    };

    window.addEventListener('message', handlePlayerMessage);
    return () => window.removeEventListener('message', handlePlayerMessage);
  }, [episodesList, episodeNumber, onEpisodeChange]);

  // Main stream resolution effect
  useEffect(() => {
    let cancelled = false;
    setStreamSource(null);
    setStreamStatus('loading');
    setStreamMessage(`Connecting to ${activeServer}...`);

    resolveEpisodeSource({
      anime,
      episodeNumber,
      providerId: activeServer,
      language: audioMode,
      resolution: selectedQuality,
      serverName: selectedSubServerName,
    })
      .then(result => {
        if (cancelled) return;

        if (result.status === 'available' && result.source) {
          setStreamSource(result.source);
          setStreamStatus('ready');
          setStreamMessage('');
          return;
        }

        setStreamSource(null);
        setStreamStatus('error');
        setStreamMessage(result.message || 'Server connection timed out. Please select another server or language.');
      })
      .catch(() => {
        if (cancelled) return;
        setStreamStatus('error');
        setStreamMessage('Failed to connect to streaming server. Try switching server.');
      });

    return () => {
      cancelled = true;
    };
  }, [anime, episodeNumber, activeServer, audioMode, selectedQuality, selectedSubServerName]);

  // Reload current stream
  const handleReloadStream = () => {
    setStreamStatus('loading');
    setStreamMessage(`Refreshing current server stream...`);
    setRefreshKey(prev => prev + 1);
    resolveEpisodeSource({
      anime,
      episodeNumber,
      providerId: activeServer,
      language: audioMode,
      resolution: selectedQuality,
      serverName: selectedSubServerName,
    }).then(res => {
      if (res.source) {
        setStreamSource(res.source);
        setStreamStatus('ready');
      } else {
        setStreamStatus('error');
        setStreamMessage(res.message || 'Stream refresh failed. Please try switching servers.');
      }
    });
  };

  // Next Server Failover Helper
  const handleSwitchToNextServer = () => {
    const currentIndex = STREAM_PROVIDERS.findIndex(p => p.id === activeServer);
    const nextIndex = (currentIndex + 1) % STREAM_PROVIDERS.length;
    const nextServer = STREAM_PROVIDERS[nextIndex];
    setActiveServer(nextServer.id);
    setSelectedSubServerName(undefined);
    if (onServerChange) onServerChange(nextServer.id);
  };

  const formatTime = (seconds: number) => {
    const s = Math.max(0, Math.floor(seconds));
    const mins = Math.floor(s / 60);
    const secs = s % 60;
    return `${mins.toString().padStart(2, '0')}:${secs.toString().padStart(2, '0')}`;
  };

  const displayTitle = anime.title?.english || anime.title?.romaji || anime.title?.userPreferred || 'Anime';
  const coverUrl = anime.coverImage?.extraLarge || anime.coverImage?.large || anime.coverImage?.medium || undefined;

  return (
    <div
      ref={playerContainerRef}
      className={`relative select-none overflow-hidden bg-black font-sans text-white ${
        isFullscreen
          ? 'fixed inset-0 z-[9999] w-screen h-screen m-0 p-0 border-0 rounded-none bg-black flex flex-col'
          : 'w-full rounded-2xl sm:rounded-3xl border border-slate-800/80 shadow-2xl flex flex-col'
      }`}
    >
      {/* 1. Video Player Container Slot */}
      <div
        className={`relative w-full bg-black overflow-hidden touch-manipulation flex-1 ${
          isFullscreen ? 'h-full flex items-center justify-center' : 'aspect-video'
        }`}
      >
        {streamSource?.url && streamStatus !== 'error' ? (
          <div className="relative w-full h-full">
            {/* The Actual Video Stream Iframe */}
            <iframe
              key={`${streamSource.url}-${refreshKey}`}
              ref={iframeRef}
              src={streamSource.url}
              title={`${displayTitle} - Episode ${episodeNumber}`}
              className="w-full h-full border-0 pointer-events-auto block bg-black"
              allowFullScreen
              allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture"
              onLoad={() => setStreamStatus('ready')}
            />

            {/* Invisible Touch Shield for Full Canvas Tap & Double Tap Handling */}
            <div
              onClick={handleCanvasTap}
              className="absolute inset-0 z-20 cursor-pointer pointer-events-auto"
            />

            {/* Double Tap Seek Feedback Indicators */}
            {seekFeedback && (
              <div className="absolute inset-0 z-30 pointer-events-none flex items-center justify-around">
                {seekFeedback === 'rewind' && (
                  <div className="flex flex-col items-center gap-1.5 p-4 rounded-2xl bg-black/75 backdrop-blur-md border border-white/20 animate-pulse">
                    <RotateCcw className="w-8 h-8 text-white" />
                    <span className="text-xs font-bold text-white">-10 sec</span>
                  </div>
                )}
                {seekFeedback === 'forward' && (
                  <div className="flex flex-col items-center gap-1.5 p-4 rounded-2xl bg-black/75 backdrop-blur-md border border-white/20 animate-pulse">
                    <RotateCw className="w-8 h-8 text-white" />
                    <span className="text-xs font-bold text-white">+10 sec</span>
                  </div>
                )}
              </div>
            )}

            {/* Comprehensive Controls Overlay */}
            <div
              className={`absolute inset-0 z-30 flex flex-col justify-between p-3 sm:p-5 bg-gradient-to-t from-black/85 via-black/30 to-black/75 transition-opacity duration-300 pointer-events-none ${
                showControls ? 'opacity-100' : 'opacity-0'
              }`}
            >
              {/* TOP BAR: Episode info & Top Action Badges (Quality, Captions, Audio, Settings, Fullscreen) */}
              <div className="flex items-center justify-between gap-2 pointer-events-auto">
                <div className="flex items-center gap-2.5 min-w-0">
                  <span className="px-2.5 py-1 rounded-lg bg-indigo-600/90 text-[11px] sm:text-xs font-bold text-white shrink-0 shadow-md">
                    EP {episodeNumber}
                  </span>
                  <h3 className="text-xs sm:text-sm font-bold text-white truncate max-w-[200px] sm:max-w-md drop-shadow">
                    {episodeTitle || `${displayTitle} - Episode ${episodeNumber}`}
                  </h3>
                </div>

                <div className="flex items-center gap-1.5 shrink-0">
                  {/* Quality Button */}
                  <button
                    onClick={e => {
                      e.stopPropagation();
                      setActiveModal(prev => (prev === 'quality' ? 'none' : 'quality'));
                    }}
                    className="px-2.5 py-1 rounded-lg bg-black/60 hover:bg-black/90 active:bg-neutral-800 text-[11px] font-bold text-indigo-300 border border-indigo-500/40 backdrop-blur-md transition cursor-pointer flex items-center gap-1"
                    title="Change Video Quality"
                  >
                    <span>{selectedQuality.toUpperCase()}</span>
                    <ChevronDown className="w-3 h-3" />
                  </button>

                  {/* Captions / CC Button */}
                  <button
                    onClick={e => {
                      e.stopPropagation();
                      setActiveModal(prev => (prev === 'captions' ? 'none' : 'captions'));
                    }}
                    className={`p-1.5 rounded-lg border backdrop-blur-md transition cursor-pointer flex items-center justify-center ${
                      subtitlesEnabled
                        ? 'bg-indigo-600/80 text-white border-indigo-400/60'
                        : 'bg-black/60 text-neutral-300 border-white/20 hover:bg-black/90'
                    }`}
                    title="Captions / Subtitles"
                  >
                    <Subtitles className="w-3.5 h-3.5" />
                  </button>

                  {/* Audio Language Button */}
                  <button
                    onClick={e => {
                      e.stopPropagation();
                      setActiveModal(prev => (prev === 'audio' ? 'none' : 'audio'));
                    }}
                    className="px-2.5 py-1 rounded-lg bg-black/60 hover:bg-black/90 active:bg-neutral-800 text-[11px] font-bold text-amber-300 border border-amber-500/40 backdrop-blur-md transition cursor-pointer flex items-center gap-1"
                    title="Change Audio Language"
                  >
                    <Globe className="w-3 h-3" />
                    <span>{audioMode}</span>
                  </button>

                  {/* Settings Gear Menu */}
                  <button
                    onClick={e => {
                      e.stopPropagation();
                      setActiveModal(prev => (prev === 'settings' ? 'none' : 'settings'));
                    }}
                    className="p-1.5 rounded-lg bg-black/60 hover:bg-black/90 active:bg-neutral-800 text-neutral-200 border border-white/20 backdrop-blur-md transition cursor-pointer"
                    title="Player Settings"
                  >
                    <Settings className="w-3.5 h-3.5" />
                  </button>

                  {/* Fullscreen Button */}
                  <button
                    onClick={e => {
                      e.stopPropagation();
                      toggleFullscreen();
                    }}
                    className="p-1.5 rounded-lg bg-black/60 hover:bg-black/90 active:bg-neutral-800 text-neutral-200 border border-white/20 backdrop-blur-md transition cursor-pointer"
                    title="Toggle Fullscreen"
                  >
                    {isFullscreen ? <Minimize className="w-3.5 h-3.5" /> : <Maximize className="w-3.5 h-3.5" />}
                  </button>
                </div>
              </div>

              {/* CENTER CONTROLS: Rewind 10s, Play/Pause, Forward 10s */}
              <div className="flex items-center justify-center gap-6 sm:gap-10 pointer-events-auto my-auto">
                <button
                  onClick={e => {
                    e.stopPropagation();
                    seekDelta(-10);
                  }}
                  className="p-3 rounded-full bg-black/60 hover:bg-black/80 active:scale-95 text-white/90 hover:text-white border border-white/20 backdrop-blur-md transition cursor-pointer"
                  title="Rewind 10s"
                >
                  <RotateCcw className="w-5 h-5 sm:w-6 sm:h-6" />
                </button>

                <button
                  onClick={e => {
                    e.stopPropagation();
                    togglePlayPause();
                  }}
                  className="p-4 sm:p-5 rounded-full bg-indigo-600 hover:bg-indigo-500 active:scale-95 text-white shadow-xl shadow-indigo-600/40 border border-indigo-400 transition cursor-pointer"
                  title={isPlaying ? 'Pause' : 'Play'}
                >
                  {isPlaying ? (
                    <Pause className="w-6 h-6 sm:w-8 sm:h-8 fill-current" />
                  ) : (
                    <Play className="w-6 h-6 sm:w-8 sm:h-8 fill-current ml-0.5" />
                  )}
                </button>

                <button
                  onClick={e => {
                    e.stopPropagation();
                    seekDelta(10);
                  }}
                  className="p-3 rounded-full bg-black/60 hover:bg-black/80 active:scale-95 text-white/90 hover:text-white border border-white/20 backdrop-blur-md transition cursor-pointer"
                  title="Forward 10s"
                >
                  <RotateCw className="w-5 h-5 sm:w-6 sm:h-6" />
                </button>
              </div>

              {/* BOTTOM BAR: Skip Intro (+85s), Progress bar & Scrubber, Time display */}
              <div className="space-y-2 pointer-events-auto">
                <div className="flex items-center justify-between gap-2">
                  <div className="flex items-center gap-2 text-[11px] sm:text-xs text-neutral-300 font-semibold drop-shadow">
                    <span>{formatTime(currentTime)}</span>
                    <span className="text-neutral-500">/</span>
                    <span className="text-neutral-400">{formatTime(duration)}</span>
                  </div>

                  {/* +85s Skip Intro Button */}
                  <button
                    onClick={e => {
                      e.stopPropagation();
                      handleSkipIntro();
                    }}
                    className="px-3 py-1 rounded-full bg-white/10 hover:bg-white/20 active:scale-95 text-[11px] font-bold text-white border border-white/20 backdrop-blur-md transition cursor-pointer flex items-center gap-1 shadow-md"
                    title="Skip 85s Intro"
                  >
                    <FastForward className="w-3 h-3 text-indigo-400" />
                    <span>+85s [Skip Intro]</span>
                  </button>
                </div>

                {/* Progress bar Scrubber */}
                <div className="relative w-full flex items-center group/scrubber">
                  <input
                    type="range"
                    min={0}
                    max={duration || 100}
                    value={currentTime}
                    onChange={e => {
                      const newTime = Number(e.target.value);
                      setCurrentTime(newTime);
                      sendIframeCommand('seek', newTime);
                      sendIframeCommand('seekTo', newTime);
                    }}
                    className="w-full h-1.5 bg-white/20 rounded-lg appearance-none cursor-pointer accent-indigo-500 focus:outline-none transition-all group-hover/scrubber:h-2.5"
                  />
                </div>
              </div>
            </div>

            {/* POPUP MODAL: Video Quality Selector */}
            {activeModal === 'quality' && (
              <div
                onClick={e => e.stopPropagation()}
                className="absolute top-12 right-3 z-40 w-52 rounded-2xl bg-neutral-950/95 backdrop-blur-2xl border border-neutral-800 p-3 shadow-2xl space-y-1.5 animate-in fade-in zoom-in-95 duration-150"
              >
                <div className="flex items-center justify-between pb-1.5 border-b border-neutral-800 text-xs font-bold text-neutral-300">
                  <span>Video Quality</span>
                  <button onClick={() => setActiveModal('none')} className="text-neutral-500 hover:text-white">
                    <X className="w-3.5 h-3.5" />
                  </button>
                </div>
                {AVAILABLE_QUALITIES.map(q => (
                  <button
                    key={q.value}
                    onClick={() => handleQualityChange(q.value)}
                    className={`w-full flex items-center justify-between px-3 py-2 rounded-xl text-xs font-semibold transition cursor-pointer ${
                      selectedQuality === q.value
                        ? 'bg-indigo-600 text-white font-bold'
                        : 'text-neutral-300 hover:bg-neutral-800'
                    }`}
                  >
                    <span>{q.label}</span>
                    {selectedQuality === q.value && <Check className="w-3.5 h-3.5" />}
                  </button>
                ))}
              </div>
            )}

            {/* POPUP MODAL: Captions & Subtitles Selector */}
            {activeModal === 'captions' && (
              <div
                onClick={e => e.stopPropagation()}
                className="absolute top-12 right-3 z-40 w-64 max-h-80 overflow-y-auto rounded-2xl bg-neutral-950/95 backdrop-blur-2xl border border-neutral-800 p-3.5 shadow-2xl space-y-3 animate-in fade-in zoom-in-95 duration-150 scrollbar-thin"
              >
                <div className="flex items-center justify-between pb-2 border-b border-neutral-800 text-xs font-bold text-neutral-300">
                  <span className="flex items-center gap-1.5">
                    <Subtitles className="w-3.5 h-3.5 text-indigo-400" />
                    <span>Subtitles & Captions</span>
                  </span>
                  <button onClick={() => setActiveModal('none')} className="text-neutral-500 hover:text-white">
                    <X className="w-3.5 h-3.5" />
                  </button>
                </div>

                {/* Subtitles Toggle */}
                <div className="flex items-center justify-between px-1">
                  <span className="text-xs text-neutral-300">Show Subtitles</span>
                  <button
                    onClick={() => setSubtitlesEnabled(!subtitlesEnabled)}
                    className={`w-10 h-6 rounded-full transition relative ${
                      subtitlesEnabled ? 'bg-indigo-600' : 'bg-neutral-800'
                    }`}
                  >
                    <span
                      className={`block w-4 h-4 rounded-full bg-white transition-transform ${
                        subtitlesEnabled ? 'translate-x-5' : 'translate-x-1'
                      }`}
                    />
                  </button>
                </div>

                {/* Language list */}
                {subtitlesEnabled && (
                  <div className="space-y-1 pt-1">
                    <div className="text-[11px] font-bold text-neutral-400 uppercase tracking-wider">Language</div>
                    {SUBTITLE_LANGUAGES.map(lang => (
                      <button
                        key={lang.code}
                        onClick={() => {
                          setSelectedSubtitleLang(lang.code);
                          setActiveModal('none');
                        }}
                        className={`w-full flex items-center justify-between px-2.5 py-1.5 rounded-lg text-xs transition cursor-pointer ${
                          selectedSubtitleLang === lang.code
                            ? 'bg-indigo-600/80 text-white font-bold'
                            : 'text-neutral-300 hover:bg-neutral-800'
                        }`}
                      >
                        <span>{lang.label}</span>
                        {selectedSubtitleLang === lang.code && <Check className="w-3 h-3" />}
                      </button>
                    ))}
                  </div>
                )}
              </div>
            )}

            {/* POPUP MODAL: Audio Language Selector */}
            {activeModal === 'audio' && (
              <div
                onClick={e => e.stopPropagation()}
                className="absolute top-12 right-3 z-40 w-60 max-h-80 overflow-y-auto rounded-2xl bg-neutral-950/95 backdrop-blur-2xl border border-neutral-800 p-3 shadow-2xl space-y-1.5 animate-in fade-in zoom-in-95 duration-150 scrollbar-thin"
              >
                <div className="flex items-center justify-between pb-1.5 border-b border-neutral-800 text-xs font-bold text-neutral-300">
                  <span className="flex items-center gap-1.5">
                    <Globe className="w-3.5 h-3.5 text-amber-400" />
                    <span>Audio & Language</span>
                  </span>
                  <button onClick={() => setActiveModal('none')} className="text-neutral-500 hover:text-white">
                    <X className="w-3.5 h-3.5" />
                  </button>
                </div>
                {SUPPORTED_LANGUAGES.map(lang => (
                  <button
                    key={lang.code}
                    onClick={() => handleAudioChange(lang.code)}
                    className={`w-full flex items-center justify-between px-3 py-2 rounded-xl text-xs font-semibold transition cursor-pointer ${
                      audioMode === lang.code
                        ? 'bg-amber-500 text-slate-950 font-bold'
                        : 'text-neutral-300 hover:bg-neutral-800'
                    }`}
                  >
                    <span className="flex items-center gap-2">
                      <span>{lang.flag}</span>
                      <span>{lang.label}</span>
                    </span>
                    {audioMode === lang.code && <Check className="w-3.5 h-3.5" />}
                  </button>
                ))}
              </div>
            )}

            {/* POPUP MODAL: Unified Settings Menu */}
            {activeModal === 'settings' && (
              <div
                onClick={e => e.stopPropagation()}
                className="absolute top-12 right-3 z-40 w-64 rounded-2xl bg-neutral-950/95 backdrop-blur-2xl border border-neutral-800 p-3.5 shadow-2xl space-y-3 animate-in fade-in zoom-in-95 duration-150"
              >
                <div className="flex items-center justify-between pb-2 border-b border-neutral-800 text-xs font-bold text-neutral-300">
                  <span className="flex items-center gap-1.5">
                    <Sliders className="w-3.5 h-3.5 text-indigo-400" />
                    <span>Playback Settings</span>
                  </span>
                  <button onClick={() => setActiveModal('none')} className="text-neutral-500 hover:text-white">
                    <X className="w-3.5 h-3.5" />
                  </button>
                </div>

                {/* Speed selector row */}
                <div className="space-y-1.5">
                  <span className="text-[11px] font-bold text-neutral-400 uppercase tracking-wider">Playback Speed</span>
                  <div className="grid grid-cols-3 gap-1.5">
                    {AVAILABLE_SPEEDS.map(s => (
                      <button
                        key={s}
                        onClick={() => handleSpeedChange(s)}
                        className={`py-1 rounded-lg text-xs font-bold transition cursor-pointer ${
                          playbackSpeed === s
                            ? 'bg-indigo-600 text-white'
                            : 'bg-neutral-900 border border-neutral-800 text-neutral-300 hover:border-neutral-700'
                        }`}
                      >
                        {s}x
                      </button>
                    ))}
                  </div>
                </div>

                {/* Submenu triggers */}
                <div className="space-y-1 pt-1">
                  <button
                    onClick={() => setActiveModal('quality')}
                    className="w-full flex items-center justify-between px-3 py-2 rounded-xl bg-neutral-900/80 border border-neutral-800 hover:border-neutral-700 text-xs text-neutral-200 transition cursor-pointer"
                  >
                    <span>Quality</span>
                    <span className="text-indigo-400 font-bold">{selectedQuality.toUpperCase()}</span>
                  </button>

                  <button
                    onClick={() => setActiveModal('audio')}
                    className="w-full flex items-center justify-between px-3 py-2 rounded-xl bg-neutral-900/80 border border-neutral-800 hover:border-neutral-700 text-xs text-neutral-200 transition cursor-pointer"
                  >
                    <span>Audio Language</span>
                    <span className="text-amber-400 font-bold">{audioMode}</span>
                  </button>

                  <button
                    onClick={() => setActiveModal('captions')}
                    className="w-full flex items-center justify-between px-3 py-2 rounded-xl bg-neutral-900/80 border border-neutral-800 hover:border-neutral-700 text-xs text-neutral-200 transition cursor-pointer"
                  >
                    <span>Captions & Subtitles</span>
                    <span className="text-indigo-400 font-bold">{subtitlesEnabled ? 'ON' : 'OFF'}</span>
                  </button>
                </div>
              </div>
            )}
          </div>
        ) : (
          <div className="w-full h-full flex flex-col items-center justify-center bg-black/90 p-4 text-center">
            {streamStatus === 'loading' ? (
              <>
                <div className="w-12 h-12 border-4 border-indigo-500/20 border-t-indigo-500 rounded-full animate-spin mb-3" />
                <div className="text-sm font-bold text-white mb-1">Loading Episode Stream...</div>
                <div className="text-xs text-neutral-400">Connecting to {activeServer}...</div>
              </>
            ) : (
              <div className="p-6 max-w-md mx-auto space-y-3">
                <div className="w-12 h-12 rounded-2xl bg-amber-500/10 border border-amber-500/30 text-amber-400 mx-auto flex items-center justify-center">
                  <AlertCircle className="w-6 h-6" />
                </div>
                <h3 className="text-base sm:text-lg font-bold text-white">Stream Not Available</h3>
                <p className="text-xs sm:text-sm text-neutral-400 leading-relaxed">
                  {streamMessage || `Streaming is not yet available for Episode ${episodeNumber} in ${audioMode}. Please switch server or audio language.`}
                </p>
                <div className="flex flex-wrap items-center justify-center gap-2 pt-2">
                  <button
                    onClick={e => {
                      e.stopPropagation();
                      handleReloadStream();
                    }}
                    className="px-4 py-2 rounded-xl bg-neutral-800 hover:bg-neutral-700 text-xs font-bold text-neutral-200 border border-neutral-700 flex items-center gap-1.5 transition active:scale-95 cursor-pointer"
                  >
                    <RefreshCw className="w-3.5 h-3.5" />
                    <span>Retry</span>
                  </button>
                  <button
                    onClick={e => {
                      e.stopPropagation();
                      handleSwitchToNextServer();
                    }}
                    className="px-4 py-2 rounded-xl bg-indigo-600 hover:bg-indigo-500 text-xs font-bold text-white shadow-lg shadow-indigo-600/30 flex items-center gap-1.5 transition active:scale-95 cursor-pointer"
                  >
                    <RefreshCw className="w-3.5 h-3.5" />
                    <span>Switch Server</span>
                  </button>
                </div>
              </div>
            )}
          </div>
        )}
      </div>

      {/* 2. Responsive Bottom Control Bar (Server 1 / Server 2 / Server 3 Selector & Refresh) */}
      {!isFullscreen && (
        <div className="px-3.5 py-3 sm:px-4 sm:py-3.5 bg-[#0a0a0e] border-t border-neutral-800/80 flex items-center justify-between gap-3">
          {/* Left: Playing Anime Thumbnail avatar & Title */}
          <div className="flex items-center gap-3 min-w-0">
            <div className="relative w-10 h-10 sm:w-11 sm:h-11 rounded-full overflow-hidden shrink-0 border border-neutral-700/80 bg-neutral-900 shadow-md">
              {coverUrl ? (
                <img
                  src={coverUrl}
                  alt={displayTitle}
                  className="w-full h-full object-cover"
                  referrerPolicy="no-referrer"
                />
              ) : (
                <div className="w-full h-full flex items-center justify-center bg-neutral-800 text-xs font-bold text-white">
                  {displayTitle.charAt(0)}
                </div>
              )}
            </div>
            <div className="flex flex-col min-w-0">
              <h4 className="font-bold text-xs sm:text-sm text-white truncate leading-tight">
                {displayTitle}
              </h4>
              <p className="text-[11px] sm:text-xs text-neutral-400 font-medium mt-0.5">
                Episode {episodeNumber} • {audioMode}
              </p>
            </div>
          </div>

          {/* Right: Server 1 / Server 2 / Server 3 Buttons & Refresh Button */}
          <div className="flex items-center gap-2 shrink-0 overflow-x-auto">
            {(streamSource?.availableServers || []).map((srv, idx) => {
              const activeName = selectedSubServerName || streamSource?.selectedServerName || 'Server 1';
              const isSelected = activeName.toLowerCase() === srv.name.toLowerCase();
              return (
                <button
                  key={`pvp-srv-${idx}`}
                  type="button"
                  onClick={() => setSelectedSubServerName(srv.name)}
                  className={`px-3 py-1.5 rounded-xl text-xs font-bold transition cursor-pointer flex items-center gap-1 ${
                    isSelected
                      ? 'bg-indigo-600 text-white shadow-md shadow-indigo-600/30 border border-indigo-400'
                      : 'bg-neutral-900 text-neutral-300 hover:text-white border border-neutral-700/80 hover:bg-neutral-800'
                  }`}
                >
                  <Server className="w-3 h-3" />
                  <span>{srv.name}</span>
                </button>
              );
            })}

            <button
              type="button"
              onClick={handleReloadStream}
              className="p-2.5 rounded-xl bg-neutral-900 hover:bg-neutral-800 active:bg-neutral-700 text-neutral-300 hover:text-white border border-neutral-700/80 transition active:scale-95 cursor-pointer shadow-md flex items-center justify-center"
              title="Refresh Current Server"
            >
              <RefreshCw className={`w-4 h-4 ${streamStatus === 'loading' ? 'animate-spin text-indigo-400' : ''}`} />
            </button>
          </div>
        </div>
      )}
    </div>
  );
};
