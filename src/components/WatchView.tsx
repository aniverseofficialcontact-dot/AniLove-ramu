import React, { useState, useEffect, useMemo } from 'react';
import { Capacitor } from '@capacitor/core';
import {
  ArrowLeft,
  ChevronLeft,
  ChevronRight,
  ChevronDown,
  Play,
  CheckCircle2,
  List,
  LayoutGrid,
  Search,
  X,
  Tv,
  Star,
  Film,
  Eye,
  Info,
  Radio,
  ArrowUpDown,
  Compass,
  Layers,
  Download,
  Server,
  Globe,
  Home,
  Maximize2,
  RotateCw,
  Hash,
} from 'lucide-react';
import { Anime, AnimeDetail, UserMediaListItem, MediaListStatus, ThumbnailAppearance, StreamServerId, UserSettings, FranchiseWatchOrder } from '../types';
import { fetchAnimeDetails, sanitizeDescription } from '../services/anilist';
import { NativePlayer } from '../services/nativePlayer';
import { STREAM_PROVIDERS, DEFAULT_STREAM_PROVIDER_ID, SUPPORTED_LANGUAGES, StreamLanguage } from '../services/streamingProviders';
import { NativePlayer, launchNativePlayer } from '../services/nativePlayer';
import { ProVideoPlayer } from './ProVideoPlayer';
import { computeTotalEpisodes, generateEpisodeRanges } from '../services/episodeHelper';
import { getAnimeReleaseStatus, isFreshAiredEpisodeWithin7Days } from '../services/releaseHelper';
import { fetchFranchiseWatchOrder } from '../services/watchOrderService';
import {
  fetchExtendedEpisodesFromJikanOrKitsu,
  getCanonicalEpisodeArtwork,
  getArcOrFormattedTitle,
  checkIsFillerEpisode,
  ExtendedEpisodeInfo,
} from '../services/episodeMetadataService';
import { BatchDownloadModal } from './BatchDownloadModal';
import { isEpisodeDownloaded } from '../services/downloadManager';

interface EpisodeItem {
  number: number;
  title: string;
  thumbnail: string;
  synopsis?: string;
  filler?: boolean;
}

interface WatchViewProps {
  anime: Anime;
  episodeNumber: number;
  initialTime?: number;
  onBack: () => void;
  onEpisodeChange: (episodeNumber: number) => void;
  onUpdateStatus: (anime: Anime, status: MediaListStatus) => void;
  onUpdateProgress: (anime: Anime, newProgress: number) => void;
  onOpenDetails: (anime: Anime) => void;
  onNavigateToAnime?: (anime: Anime) => void;
  userItem?: UserMediaListItem;
  isTwoWaySyncActive?: boolean;
  settings?: UserSettings;
  onOpenDownloadsView?: () => void;
}

export const WatchView: React.FC<WatchViewProps> = ({
  anime,
  episodeNumber,
  initialTime = 0,
  onBack,
  onEpisodeChange,
  onUpdateProgress,
  onOpenDetails,
  onNavigateToAnime,
  userItem,
  isTwoWaySyncActive = false,
  settings,
  onOpenDownloadsView,
}) => {
  const [details, setDetails] = useState<AnimeDetail | null>(null);
  const [loading, setLoading] = useState<boolean>(true);
  const [watchOrderData, setWatchOrderData] = useState<FranchiseWatchOrder | null>(null);
  const [episodeSearchQuery, setEpisodeSearchQuery] = useState<string>('');
  const [selectedEpisodeRange, setSelectedEpisodeRange] = useState<string>('all');
  const initialLayout = settings?.preferredEpisodeLayout || 'grid';
  const [episodeViewMode, setEpisodeViewMode] = useState<'grid' | 'list' | 'compact'>('list');
  const [sortAsc, setSortAsc] = useState<boolean>(true);
  const [showFullSynopsis, setShowFullSynopsis] = useState<boolean>(false);
  const [thumbnailStyle, setThumbnailStyle] = useState<ThumbnailAppearance>('snapshot');
  const [extraEpisodeData, setExtraEpisodeData] = useState<Record<number, ExtendedEpisodeInfo>>({});
  const [showDownloadModal, setShowDownloadModal] = useState<boolean>(false);

  // Background fetcher for extended metadata for long anime (syncing thumbnails & titles with details modal)
  useEffect(() => {
    if (!anime) return;
    let isMounted = true;
    const targetEp = episodeNumber || currentProgress || 1;
    const page = Math.floor((targetEp - 1) / 25) + 1;

    fetchExtendedEpisodesFromJikanOrKitsu(anime, page).then(data => {
      if (isMounted && data && Object.keys(data).length > 0) {
        setExtraEpisodeData(prev => ({ ...prev, ...data }));
      }
    });

    if (page !== 1) {
      fetchExtendedEpisodesFromJikanOrKitsu(anime, 1).then(data => {
        if (isMounted && data && Object.keys(data).length > 0) {
          setExtraEpisodeData(prev => ({ ...prev, ...data }));
        }
      });
    }

    return () => {
      isMounted = false;
    };
  }, [anime?.id, anime?.idMal, episodeNumber, selectedEpisodeRange]);

  const is18PlusActive = useMemo(() => {
    return Boolean(settings?.is18PlusMode || (anime as any)?.is18Plus || (anime as any)?.slug || anime?.isAdult);
  }, [settings?.is18PlusMode, anime]);

  // Dual Dropdown Sources & Servers Configuration
  const SOURCE_CONFIG = useMemo(() => {
    if (is18PlusActive) {
      return {
        HentaiOcean: {
          label: 'HentaiOcean Engine',
          servers: [
            { displayName: 'HentaiOcean Engine', internalCode: 'HentaiOcean-Server-1' },
          ],
        },
      };
    }
    return {
      'Multi-Lang': {
        label: 'Multi-Lang',
        servers: [
          { displayName: 'Server 1', internalCode: 'Multi-Lang-Server-1' },
        ],
      },
      AnimeDekho: {
        label: 'AnimeDekho',
        servers: [
          { displayName: 'Server 1', internalCode: 'AnimeDekho-Server-1' },
          { displayName: 'Server 2', internalCode: 'AnimeDekho-Server-2' },
          { displayName: 'Server 3', internalCode: 'AnimeDekho-Server-3' },
          { displayName: 'Server 4', internalCode: 'AnimeDekho-Server-4' },
          { displayName: 'Server 5', internalCode: 'AnimeDekho-Server-5' },
        ],
      },
      HiAnime: {
        label: 'HiAnime',
        servers: [
          { displayName: 'Server 1', internalCode: 'HiAnime-Server-1' },
          { displayName: 'Server 2', internalCode: 'HiAnime-Server-2' },
          { displayName: 'Server 3', internalCode: 'HiAnime-Server-3' },
        ],
      },
    };
  }, [is18PlusActive]);

  type StreamSourceId = 'Multi-Lang' | 'HiAnime' | 'HentaiOcean';

  const availableSources = useMemo<StreamSourceId[]>(() => {
    return is18PlusActive ? ['HentaiOcean'] : ['Multi-Lang', 'HiAnime'];
  }, [is18PlusActive]);

  const [playerEngineMode, setPlayerEngineMode] = useState<'exo' | 'web'>(is18PlusActive ? 'web' : 'exo');

  useEffect(() => {
    if (is18PlusActive) {
      setPlayerEngineMode('web');
      if (Capacitor.isNativePlatform()) {
        NativePlayer.switchEngine({ mode: 'web' }).catch(() => {});
      }
    }
  }, [anime.id, is18PlusActive]);

  const handleToggleEngine = () => {
    const nextEngine = playerEngineMode === 'exo' ? 'web' : 'exo';
    setPlayerEngineMode(nextEngine);
    if (Capacitor.isNativePlatform()) {
      NativePlayer.switchEngine({ mode: nextEngine }).catch(() => {});
    }
  };

  // Strict 7-Day Airing Check for HiAnime Auto-Priority
  const isFreshEpisode = useMemo(() => {
    return isFreshAiredEpisodeWithin7Days(anime, details, episodeNumber);
  }, [anime, details, episodeNumber]);

  const isSpecialOrOvaOrOna = useMemo(() => {
    const fmt = (anime.format || anime.type || details?.format || details?.type || '').toUpperCase();
    return fmt === 'SPECIAL' || fmt === 'OVA' || fmt === 'ONA';
  }, [anime.format, anime.type, details?.format, details?.type]);

  const configuredDefaultSource = (settings?.preferredSource || 'Multi-Lang') as StreamSourceId;
  const effectiveDefaultSource: StreamSourceId = is18PlusActive
    ? 'HentaiOcean'
    : (isSpecialOrOvaOrOna || isFreshEpisode)
    ? 'HiAnime'
    : configuredDefaultSource;

  const [selectedSource, setSelectedSource] = useState<StreamSourceId>(effectiveDefaultSource);

  useEffect(() => {
    setSelectedSource(effectiveDefaultSource);
    setSelectedServerDisplay(is18PlusActive ? 'HentaiOcean Engine' : 'Server 1');
  }, [anime.id, effectiveDefaultSource, is18PlusActive]);

  const [selectedServerDisplay, setSelectedServerDisplay] = useState<string>('Server 1');
  const [isSourceMenuOpen, setIsSourceMenuOpen] = useState<boolean>(false);
  const [isServerMenuOpen, setIsServerMenuOpen] = useState<boolean>(false);

  const initialServer = settings?.preferredServers?.[0] || DEFAULT_STREAM_PROVIDER_ID;
  const [selectedServer, setSelectedServer] = useState<StreamServerId>(initialServer);
  const [selectedSubServer, setSelectedSubServer] = useState<string>('Server 1');

  const handleServerSwitchDirect = async (srvName: string) => {
    if (!Capacitor.isNativePlatform()) return;

    const ep = episodeNumber || 1;
    const isDub = srvName.toLowerCase().includes('dub') || selectedAudio === 'DUB';

    console.log(`[WatchView] Direct Native Server Switch -> ${srvName}`);

    try {
      await launchNativePlayer({
        anime,
        episodeNumber: ep,
        audio: isDub ? 'DUB' : selectedAudio || 'SUB',
        serverName: srvName,
        totalEpisodes: episodeList.length,
      });
    } catch (e) {
      console.warn('Direct server switch error:', e);
    }
  };

  const [refreshKey, setRefreshKey] = useState<number>(0);

  const handleRefreshPlayer = () => {
    setRefreshKey(prev => prev + 1);
    const firstServer = SOURCE_CONFIG[selectedSource]?.servers[0];
    if (firstServer) {
      setSelectedServerDisplay(firstServer.displayName);
      setSelectedSubServer(firstServer.displayName);
    }
  };

  const handleSourceChange = (newSource: StreamSourceId) => {
    setSelectedSource(newSource);
    setIsSourceMenuOpen(false);
    handleRefreshPlayer();
  };

  // Automatically trigger handleRefreshPlayer whenever episodeNumber changes
  useEffect(() => {
    handleRefreshPlayer();
  }, [episodeNumber]);

  const handleServerDisplayChange = (serverItem: { displayName: string; internalCode: string }) => {
    setSelectedServerDisplay(serverItem.displayName);
    setSelectedSubServer(serverItem.displayName);
    setIsServerMenuOpen(false);
  };

  // Derive initial audio preference from Primary / Secondary settings hierarchy
  const initialAudio: StreamLanguage = useMemo(() => {
    if (settings?.preferredPrimaryLanguage) {
      return settings.preferredPrimaryLanguage;
    }
    if (settings?.preferredLanguages && settings.preferredLanguages.length > 0) {
      const topLang = String(settings.preferredLanguages[0]).toUpperCase();
      if (topLang === 'SUB') return 'SUB';
      if (topLang === 'DUB') return 'DUB';
      if (topLang === 'HIN') return 'HIN';
    }
    return 'DUB'; // Default English Dub
  }, [settings?.preferredPrimaryLanguage, settings?.preferredLanguages]);

  const [selectedAudio, setSelectedAudio] = useState<StreamLanguage>(initialAudio);

  // Sync if settings update
  useEffect(() => {
    if (settings?.preferredServers?.[0]) {
      setSelectedServer(settings.preferredServers[0]);
    }
  }, [settings?.preferredServers]);

  useEffect(() => {
    setSelectedAudio(initialAudio);
  }, [initialAudio]);

  const title = anime.title?.english || anime.title?.romaji || anime.title?.userPreferred || 'Anime';
  const coverUrl = anime.coverImage?.extraLarge || anime.coverImage?.large || anime.coverImage?.medium;
  const currentProgress = userItem?.progress || 0;
  const relStatus = useMemo(() => getAnimeReleaseStatus(anime, details), [anime, details]);
  const episodesTotal = computeTotalEpisodes(anime, details);
  const score = details?.averageScore || anime.averageScore || details?.meanScore || anime.meanScore;

  // Scroll to top on mount / episode change — skip on native Android (player is an overlay)
  useEffect(() => {
    if (Capacitor.isNativePlatform()) {
      // Lock overscroll so the WebView never rubber-band jumps to top
      document.documentElement.style.overscrollBehavior = 'none';
      document.body.style.overscrollBehavior = 'none';
      return () => {
        document.documentElement.style.overscrollBehavior = '';
        document.body.style.overscrollBehavior = '';
      };
    }
    window.scrollTo({ top: 0, behavior: 'instant' });
  }, [anime.id, episodeNumber]);

  // Load detailed AniList metadata
  useEffect(() => {
    let isMounted = true;
    setLoading(true);

    fetchAnimeDetails(anime.id)
      .then(data => {
        if (isMounted) {
          setDetails(data);
          setLoading(false);
        }
      })
      .catch(() => {
        if (isMounted) setLoading(false);
      });

    return () => {
      isMounted = false;
    };
  }, [anime.id]);

  // Load Franchise Watch Order
  useEffect(() => {
    let isMounted = true;
    fetchFranchiseWatchOrder(anime, details)
      .then(data => {
        if (isMounted) {
          setWatchOrderData(data);
        }
      })
      .catch(err => {
        console.warn('Failed to load watch order in WatchView:', err);
      });

    return () => {
      isMounted = false;
    };
  }, [anime.id, details]);

  // Franchise watch order (includes TV seasons, Movies, OVAs & ONAs in chronological release order)
  const mainStoryWatchOrder = useMemo(() => {
    if (!watchOrderData) return [];
    const rawList = watchOrderData.releaseOrder?.length
      ? watchOrderData.releaseOrder
      : watchOrderData.recommendedOrder || [];

    const filtered = rawList.filter(item => {
      const format = (item.format || '').toUpperCase();
      return format !== 'MUSIC';
    });

    return filtered.length > 0 ? filtered : rawList;
  }, [watchOrderData]);

  // Memoize cleaned synopsis once to avoid 1000+ regex sanitizations on every render
  const cleanSynopsis = useMemo(() => {
    return details?.description ? sanitizeDescription(details.description) : '';
  }, [details?.description]);

  // Generate complete episodes catalog synchronized with AniList and extended metadata
  const episodeList = useMemo<EpisodeItem[]>(() => {
    const rawStreaming = details?.streamingEpisodes || (anime as any).streamingEpisodes || [];
    const total = computeTotalEpisodes(anime, details);
    const banner = anime.bannerImage || anime.coverImage?.extraLarge || coverUrl;

    const titleLower = (title || '').toLowerCase();
    const isSequel =
      titleLower.includes('season 2') ||
      titleLower.includes('2nd season') ||
      titleLower.includes('season 3') ||
      titleLower.includes('3rd season') ||
      titleLower.includes('season 4') ||
      titleLower.includes('final season') ||
      titleLower.includes('part 2') ||
      (total < rawStreaming.length && rawStreaming.length >= total + 10);

    const offset = isSequel && rawStreaming.length > total ? rawStreaming.length - total : 0;
    const seasonStreaming = isSequel && offset > 0 ? rawStreaming.slice(offset) : rawStreaming;

    // Quick lookup map for rawStreaming by title/number to avoid O(N^2) scans
    const streamMap = new Map<number, any>();
    if (rawStreaming && rawStreaming.length > 0) {
      rawStreaming.forEach((s: any) => {
        if (s?.title) {
          const match = s.title.match(/(?:episode|ep|ep\.)\s*(\d+)/i) || s.title.match(/^(\d+)[\.\s]/);
          if (match) {
            const parsed = parseInt(match[1], 10);
            if (!isNaN(parsed) && !streamMap.has(parsed)) {
              streamMap.set(parsed, s);
            }
          }
        }
      });
    }

    const maxCount = Math.max(1, total);
    const list: EpisodeItem[] = new Array(maxCount);

    for (let i = 0; i < maxCount; i++) {
      const epNum = i + 1;
      const absoluteEpNum = epNum + offset;

      // Direct index in slice or map lookup
      let streamInfo = seasonStreaming[i] || streamMap.get(epNum) || streamMap.get(absoluteEpNum);
      const extra = extraEpisodeData[epNum];

      let rawTitle = streamInfo?.title;
      if (rawTitle) {
        rawTitle = rawTitle
          .replace(/^Episode\s*\d+\s*[-:]\s*/i, '')
          .replace(/^EP\s*\d+\s*[-:]\s*/i, '')
          .replace(/^\d+\.\s*/i, '')
          .trim();
      }

      const epTitle = extra?.title || getArcOrFormattedTitle(title, epNum, rawTitle);
      const epThumb = extra?.thumbnail || streamInfo?.thumbnail || getCanonicalEpisodeArtwork(title, epNum, anime) || banner || coverUrl;
      const isFiller = extra?.filler !== undefined ? extra.filler : checkIsFillerEpisode(title, epNum);
      const epSynopsis = extra?.synopsis || (cleanSynopsis ? `Episode ${epNum}. ${cleanSynopsis.slice(0, 140)}...` : `Episode ${epNum} of ${title}.`);

      list[i] = {
        number: epNum,
        title: epTitle,
        thumbnail: epThumb,
        synopsis: epSynopsis,
        filler: isFiller,
      };
    }

    return list;
  }, [anime, anime.bannerImage, coverUrl, title, cleanSynopsis, details?.streamingEpisodes, details?.episodes, (anime as any).episodes, (anime as any).streamingEpisodes, extraEpisodeData]);

  // Episode chunk ranges for long anime (e.g. One Piece, Naruto, Bleach)
  const episodeRanges = useMemo(() => {
    return generateEpisodeRanges(episodeList.length);
  }, [episodeList.length]);

  // Auto-sync active chunk range with currently playing episode (e.g. Ep 251 -> range "251–300")
  useEffect(() => {
    if (episodeList.length > 50) {
      const start = Math.floor((episodeNumber - 1) / 50) * 50 + 1;
      const end = Math.min(start + 49, episodeList.length);
      const expectedRange = `${start}–${end}`;
      setSelectedEpisodeRange(expectedRange);
    } else {
      setSelectedEpisodeRange('all');
    }
  }, [episodeNumber, episodeList.length]);

  // Reset range and query when anime changes
  useEffect(() => {
    setSelectedEpisodeRange('all');
    setEpisodeSearchQuery('');
  }, [anime?.id]);

  // Filter episodes by search query, range chunks, and sort order
  const filteredEpisodes = useMemo(() => {
    let list = episodeList;

    const rawQ = episodeSearchQuery.trim();
    if (rawQ) {
      const parsedNum = parseInt(rawQ.replace(/\D/g, ''), 10);
      const textQ = rawQ.toLowerCase();

      list = list.filter(ep => {
        if (!isNaN(parsedNum) && ep.number === parsedNum) {
          return true;
        }
        if (ep.title && ep.title.toLowerCase().includes(textQ)) {
          return true;
        }
        if (ep.synopsis && ep.synopsis.toLowerCase().includes(textQ)) {
          return true;
        }
        if (`${ep.number}`.includes(rawQ)) {
          return true;
        }
        return false;
      });
    } else if (selectedEpisodeRange !== 'all' && episodeRanges.length > 0) {
      const parts = selectedEpisodeRange.split(/[–\-]/).map(Number);
      if (parts.length === 2 && !isNaN(parts[0]) && !isNaN(parts[1])) {
        const [start, end] = parts;
        const ranged = list.slice(start - 1, end);
        if (ranged.length > 0) {
          list = ranged;
        }
      }
    }

    if (!sortAsc) {
      return [...list].reverse();
    }
    return list;
  }, [episodeList, episodeSearchQuery, selectedEpisodeRange, episodeRanges, sortAsc]);

  const currentEpisodeData = episodeList.find(e => e.number === episodeNumber) || {
    number: episodeNumber,
    title: `Episode ${episodeNumber}`,
    synopsis: details?.description ? sanitizeDescription(details.description) : undefined,
  };
  const synopsis = details?.description || anime.description
    ? sanitizeDescription(details?.description || anime.description || '')
    : currentEpisodeData?.synopsis || 'Synopsis details are not available for this episode yet.';

  const hasNextEpisode = episodeNumber < episodeList.length;
  const hasPrevEpisode = episodeNumber > 1;

  const handleNextEpisode = () => {
    if (hasNextEpisode) {
      onEpisodeChange(episodeNumber + 1);
      onUpdateProgress(anime, episodeNumber);
    }
  };

  const handlePrevEpisode = () => {
    if (hasPrevEpisode) {
      onEpisodeChange(episodeNumber - 1);
    }
  };

  return (
    <div className="bg-black text-white selection:bg-indigo-500 selection:text-white pb-6 sm:pb-8">
      {/* Target: Image 2 - Header removed for ultra-clean fixed player view */}

      {/* Main Watch Page Container - Positioned at very top */}
      <main className="w-full max-w-[1920px] mx-auto px-0 pt-0 space-y-5 sm:space-y-6">
        {!relStatus.isReleased ? (
          <div className="p-8 sm:p-12 rounded-3xl bg-slate-900/90 border border-slate-800 text-center space-y-4 max-w-lg mx-auto my-12 shadow-2xl">
            <div className="w-16 h-16 rounded-2xl bg-amber-500/10 border border-amber-500/30 text-amber-400 mx-auto flex items-center justify-center shadow-lg">
              <Calendar className="w-8 h-8" />
            </div>
            <h3 className="text-xl font-bold text-white">Not Released Yet</h3>
            <p className="text-sm text-slate-300 leading-relaxed">
              {relStatus.releaseDateText
                ? `This anime is officially scheduled for release on ${relStatus.releaseDateText}. Episodes will become available as they air.`
                : 'This title has not been officially uploaded or released yet. Episodes will become available once broadcasts begin.'}
            </p>
            <div className="inline-flex items-center gap-2 px-6 py-3 rounded-xl bg-amber-500/20 text-amber-300 font-bold text-sm border border-amber-500/40">
              <span>{relStatus.buttonLabel}</span>
            </div>
          </div>
        ) : (
          /* Theatrical Video Player Component - Fixed at Top */
          <div className="w-full rounded-none overflow-hidden bg-black aspect-video">
            <ProVideoPlayer
              anime={anime}
              episodeNumber={episodeNumber}
              episodeTitle={currentEpisodeData.title}
              episodesList={episodeList}
              initialTime={initialTime}
              currentServer={selectedServer}
              selectedSource={selectedSource}
              selectedSubServer={selectedSubServer}
              refreshTrigger={refreshKey}
              onServerChange={setSelectedServer}
              onSubServerChange={setSelectedSubServer}
              currentAudioLanguage={selectedAudio}
              onAudioLanguageChange={setSelectedAudio}
              onEpisodeChange={ep => {
                onEpisodeChange(ep);
                onUpdateProgress(anime, Math.max(currentProgress, ep - 1));
              }}
              onClosePlayer={onBack}
              onThumbnailStyleChange={style => setThumbnailStyle(style)}
              onProgressUpdate={onUpdateProgress}
              initialThumbnailStyle={thumbnailStyle}
              settings={settings}
            />
          </div>
        )}

        {/* Compact Right-Aligned Expandable Dual Selector Dropdowns: LANDSCAPE (18+ only), SOURCES, SERVERS */}
        <div className="flex items-center justify-end gap-3 px-3 sm:px-0 mt-5 mb-2">
          {/* LANDSCAPE FULL VIEW Button (ONLY IN 18+ PROFILE at Top Right) */}
          {is18PlusActive && (
            <div className="relative flex flex-col items-end">
              <span className="text-[10px] uppercase font-bold tracking-wider text-neutral-400 block pr-1 mb-0.5">
                FULL VIEW
              </span>
              <button
                type="button"
                onClick={() => {
                  if (Capacitor.isNativePlatform()) {
                    NativePlayer.toggleLandscape().catch(() => {});
                  } else {
                    window.dispatchEvent(new CustomEvent('toggleWebFullscreen'));
                  }
                }}
                title="Rotate Screen & Watch in Landscape Full View"
                className="bg-indigo-950/80 border border-indigo-500/50 hover:bg-indigo-900/80 text-indigo-300 rounded-xl px-3 py-1.5 text-xs font-black flex items-center gap-1.5 cursor-pointer shadow-lg backdrop-blur-md transition-all active:scale-95"
              >
                <Maximize2 className="w-3.5 h-3.5 text-indigo-400" />
                <span>Landscape</span>
              </button>
            </div>
          )}

          {/* REFRESH PLAYER Button */}
          <div className="relative flex flex-col items-end">
            <span className="text-[10px] uppercase font-bold tracking-wider text-neutral-400 block pr-1 mb-0.5">
              REFRESH
            </span>
            <button
              type="button"
              onClick={() => handleRefreshPlayer()}
              title="Refresh Stream Player"
              className="bg-neutral-900/90 border border-neutral-800 hover:border-emerald-500/50 hover:bg-emerald-500/10 text-white rounded-xl px-3 py-1.5 text-xs font-semibold flex items-center gap-1.5 cursor-pointer shadow-lg backdrop-blur-md transition-all active:scale-95 group"
            >
              <RotateCw className="w-3.5 h-3.5 text-emerald-400 group-hover:rotate-180 transition-transform duration-500" />
              <span className="text-emerald-300">Refresh</span>
            </button>
          </div>

          {/* SOURCES Dropdown */}
          <div className="relative flex flex-col items-end">
            <span className="text-[10px] uppercase font-bold tracking-wider text-neutral-400 block pr-1 mb-0.5">
              SOURCES
            </span>
            <div className="relative">
              <button
                onClick={() => {
                  setIsSourceMenuOpen(!isSourceMenuOpen);
                  setIsServerMenuOpen(false);
                }}
                className="bg-neutral-900/90 border border-neutral-800 hover:border-neutral-600 text-white rounded-xl px-3.5 py-1.5 text-xs font-semibold flex items-center gap-2 cursor-pointer shadow-lg backdrop-blur-md transition-all active:scale-95"
              >
                <Globe className="w-3.5 h-3.5 text-emerald-400" />
                <span>{selectedSource}</span>
                <ChevronDown className={`w-3.5 h-3.5 text-neutral-400 transition-transform duration-200 ${isSourceMenuOpen ? 'rotate-180' : ''}`} />
              </button>

              {isSourceMenuOpen && (
                <div className="absolute right-0 top-full mt-1.5 w-44 rounded-xl bg-[#121218]/95 border border-neutral-800 shadow-2xl backdrop-blur-xl z-50 py-1 divide-y divide-neutral-800/50 animate-in fade-in zoom-in-95 duration-150">
                  {availableSources.map((src) => {
                    const isSelected = selectedSource === src;
                    return (
                      <button
                        key={src}
                        onClick={() => handleSourceChange(src)}
                        className={`w-full text-left px-3.5 py-2 text-xs font-medium flex items-center justify-between transition-colors cursor-pointer ${
                          isSelected
                            ? 'bg-emerald-600/20 text-emerald-300 font-bold'
                            : 'text-neutral-300 hover:bg-white/5 hover:text-white'
                        }`}
                      >
                        <span>{src}</span>
                        {isSelected && <span className="w-1.5 h-1.5 rounded-full bg-emerald-400" />}
                      </button>
                    );
                  })}
                </div>
              )}
            </div>
          </div>

          {/* SERVERS Dropdown */}
          <div className="relative flex flex-col items-end">
            <span className="text-[10px] uppercase font-bold tracking-wider text-neutral-400 block pr-1 mb-0.5">
              SERVERS
            </span>
            <div className="relative">
              <button
                onClick={() => {
                  setIsServerMenuOpen(!isServerMenuOpen);
                  setIsSourceMenuOpen(false);
                }}
                className="bg-neutral-900/90 border border-neutral-800 hover:border-neutral-600 text-white rounded-xl px-3.5 py-1.5 text-xs font-semibold flex items-center gap-2 cursor-pointer shadow-lg backdrop-blur-md transition-all active:scale-95"
              >
                <Server className="w-3.5 h-3.5 text-indigo-400" />
                <span>{selectedServerDisplay}</span>
                <ChevronDown className={`w-3.5 h-3.5 text-neutral-400 transition-transform duration-200 ${isServerMenuOpen ? 'rotate-180' : ''}`} />
              </button>

              {isServerMenuOpen && (
                <div className="absolute right-0 top-full mt-1.5 w-44 max-h-64 overflow-y-auto rounded-xl bg-[#121218]/95 border border-neutral-800 shadow-2xl backdrop-blur-xl z-50 py-1 divide-y divide-neutral-800/50 animate-in fade-in zoom-in-95 duration-150">
                  {SOURCE_CONFIG[selectedSource]?.servers.map((srvItem) => {
                    const isSelected = selectedServerDisplay === srvItem.displayName;
                    return (
                      <button
                        key={srvItem.displayName}
                        onClick={() => handleServerDisplayChange(srvItem)}
                        className={`w-full text-left px-3.5 py-2 text-xs font-medium flex items-center justify-between transition-colors cursor-pointer ${
                          isSelected
                            ? 'bg-indigo-600/20 text-indigo-300 font-bold'
                            : 'text-neutral-300 hover:bg-white/5 hover:text-white'
                        }`}
                      >
                        <span>{srvItem.displayName}</span>
                        {isSelected && <span className="w-1.5 h-1.5 rounded-full bg-indigo-400" />}
                      </button>
                    );
                  })}
                </div>
              )}
            </div>
          </div>
        </div>

        {/* Episode metadata & Description with Background Banner Image */}
        <section className="relative mx-3 sm:mx-0 rounded-3xl overflow-hidden border border-neutral-800/80 shadow-2xl bg-[#08080b]">
          {/* Full Background Banner Image using Episode Thumbnail */}
          {(currentEpisodeData.thumbnail || anime.bannerImage || coverUrl) && (
            <img
              src={currentEpisodeData.thumbnail || anime.bannerImage || coverUrl}
              alt={`${currentEpisodeData.title || title} background`}
              className="absolute inset-0 w-full h-full object-cover object-center pointer-events-none opacity-45 scale-105"
            />
          )}
          {/* Dark Gradient Overlay for perfect readability */}
          <div className="absolute inset-0 bg-gradient-to-r from-[#08080b]/95 via-[#08080b]/85 to-[#08080b]/50 sm:from-[#08080b]/90 sm:via-[#08080b]/75 sm:to-[#08080b]/30" />

          {/* Foreground Content */}
          <div className="relative z-10 p-4 sm:p-6 w-full min-w-0">
            <div className="flex items-center gap-2 text-[11px] font-black uppercase tracking-[0.18em] text-blue-400">
              <Film className="w-3.5 h-3.5" />
              <span>{title} • Episode {currentEpisodeData.number}</span>
            </div>

            {/* Episode Title as Main Heading */}
            <h2 className="mt-1 text-2xl sm:text-3xl font-black leading-tight text-white drop-shadow-md">
              {currentEpisodeData.title || `Episode ${currentEpisodeData.number}`}
            </h2>

            <div className="mt-2.5 flex flex-wrap items-center gap-2 text-xs font-bold text-neutral-200">
              <span className="inline-flex items-center gap-1 rounded-full bg-yellow-500/20 px-2.5 py-1 text-yellow-300 border border-yellow-500/30 backdrop-blur-md">
                <Star className="w-3.5 h-3.5 fill-yellow-300" />
                {score ? `${score}%` : 'N/A'}
              </span>
              {anime.format && (
                <span className="rounded-full bg-black/60 px-3 py-1 border border-white/10 backdrop-blur-md text-white">{anime.format}</span>
              )}
              {currentEpisodeData.filler && (
                <span className="rounded-full bg-amber-500/90 text-black font-black px-2.5 py-0.5 text-[10px] tracking-wider uppercase shadow-md">FILLER</span>
              )}
            </div>

            {/* Episode Synopsis as Description */}
            <p className={`mt-3 text-xs sm:text-sm leading-relaxed text-neutral-300 drop-shadow ${showFullSynopsis ? '' : 'line-clamp-3'}`}>
              {currentEpisodeData.synopsis || synopsis}
            </p>
            {((currentEpisodeData.synopsis || synopsis).length > 180) && (
              <button
                type="button"
                onClick={() => setShowFullSynopsis(value => !value)}
                className="mt-2 text-xs font-bold text-blue-400 hover:text-blue-300 cursor-pointer"
              >
                {showFullSynopsis ? 'Show less' : 'Read more'}
              </button>
            )}
          </div>
        </section>

        {/* Episode Quick Switch Navigation (Borderless) */}
        <div className="mx-3 sm:mx-0 flex items-center gap-2.5 pt-1 pb-1">
          <button
            disabled={!hasPrevEpisode}
            onClick={handlePrevEpisode}
            className="flex items-center gap-1.5 px-4 py-2.5 rounded-2xl bg-[#0d101a] hover:bg-[#141926] text-neutral-200 text-xs font-bold border border-white/10 disabled:opacity-40 disabled:pointer-events-none transition active:scale-95 cursor-pointer shadow-md"
          >
            <ChevronLeft className="w-4 h-4" />
            <span>Prev Ep</span>
          </button>

          <button
            disabled={!hasNextEpisode}
            onClick={handleNextEpisode}
            className="flex items-center gap-1.5 px-4 py-2.5 rounded-2xl bg-red-600 hover:bg-red-500 text-white text-xs font-bold shadow-lg shadow-red-950/40 border border-red-500/50 disabled:opacity-40 disabled:pointer-events-none transition active:scale-95 cursor-pointer"
          >
            <span>Next Ep</span>
            <ChevronRight className="w-4 h-4" />
          </button>
        </div>

        {/* Episode Catalog Browser (Seamless Borderless Design) */}
        <div className="w-full text-left px-3 sm:px-0 space-y-4">
          {/* Unified Action Bar: Episodes Title & Count on Left, Control Buttons on Right */}
          <div className="flex items-center justify-between gap-3">
            {/* Left: Episodes Text & Total Count Badge */}
            <div className="flex items-center gap-2.5 shrink-0">
              <h3 className="font-black text-base sm:text-lg text-white tracking-tight">
                Episodes
              </h3>
              <span className="px-2.5 py-0.5 rounded-full bg-[#111422] border border-white/10 text-neutral-300 text-xs font-bold shadow-sm">
                {episodeList.length}
              </span>
            </div>

            {/* Right: Download, Sort Order & Layout Switcher */}
            <div className="flex items-center gap-2 sm:gap-3 shrink-0">
              {/* Download Episodes Modal Trigger */}
              <button
                type="button"
                onClick={() => setShowDownloadModal(true)}
                className="px-3.5 py-2.5 rounded-2xl bg-gradient-to-r from-pink-500 to-violet-600 hover:from-pink-600 hover:to-violet-700 text-white font-bold text-xs flex items-center gap-1.5 shadow-lg shadow-pink-500/20 transition cursor-pointer shrink-0 active:scale-95"
                title="Download episodes for offline viewing"
              >
                <Download className="w-4 h-4" />
                <span className="hidden sm:inline">Download</span>
              </button>

              {/* Sort Asc/Desc Button (Boxless Minimal Icon) */}
              <button
                type="button"
                onClick={() => setSortAsc(prev => !prev)}
                className="p-2 text-neutral-300 hover:text-white transition active:scale-95 cursor-pointer shrink-0"
                title={sortAsc ? 'Sort Descending (Newest first)' : 'Sort Ascending (Oldest first)'}
              >
                <ArrowUpDown className="w-4 h-4 text-indigo-400" />
              </button>

              {/* Single Cycling Layout Toggle Button (Boxless Minimal Icon) */}
              <button
                type="button"
                onClick={() => {
                  setEpisodeViewMode(prev => {
                    if (prev === 'list') return 'grid';
                    if (prev === 'grid') return 'compact';
                    return 'list';
                  });
                }}
                className="p-2 text-neutral-300 hover:text-white transition active:scale-95 cursor-pointer shrink-0"
                title={`Layout: ${episodeViewMode.toUpperCase()} (Click to toggle)`}
              >
                {episodeViewMode === 'list' && <List className="w-4 h-4 text-indigo-400" />}
                {episodeViewMode === 'grid' && <LayoutGrid className="w-4 h-4 text-indigo-400" />}
                {episodeViewMode === 'compact' && <Hash className="w-4 h-4 text-indigo-400" />}
              </button>
            </div>

            {/* Episode Range Chunks for Long Series */}
            {episodeRanges.length > 0 && !episodeSearchQuery && (
              <div className="flex items-center gap-1.5 overflow-x-auto pb-1 scrollbar-none text-xs">
                <button
                  type="button"
                  onClick={() => setSelectedEpisodeRange('all')}
                  className={`px-3.5 py-1.5 rounded-xl font-bold transition shrink-0 cursor-pointer ${
                    selectedEpisodeRange === 'all'
                      ? 'bg-indigo-600 text-white shadow-md shadow-indigo-600/30'
                      : 'bg-[#0d101a] text-neutral-400 hover:text-neutral-200 border border-white/10'
                  }`}
                >
                  All ({episodeList.length})
                </button>
                {episodeRanges.map(r => (
                  <button
                    key={r.label}
                    type="button"
                    onClick={() => setSelectedEpisodeRange(r.label)}
                    className={`px-3.5 py-1.5 rounded-xl font-bold transition shrink-0 cursor-pointer ${
                      selectedEpisodeRange === r.label
                        ? 'bg-indigo-600 text-white shadow-md shadow-indigo-600/30'
                        : 'bg-[#0d101a] text-neutral-400 hover:text-neutral-200 border border-white/10'
                    }`}
                  >
                    {r.label}
                  </button>
                ))}
              </div>
            )}
          </div>

          {/* Episode Display: Grid, List, or Compact Numbers Grid */}
          {episodeViewMode === 'compact' ? (
            <div className="grid grid-cols-3 sm:grid-cols-4 md:grid-cols-6 lg:grid-cols-8 gap-2 sm:gap-2.5 max-h-[600px] overflow-y-auto pr-1">
              {filteredEpisodes.map(ep => {
                const isCurrent = ep.number === episodeNumber;
                const isWatched = ep.number <= currentProgress;

                return (
                  <button
                    key={ep.number}
                    onClick={() => {
                      onEpisodeChange(ep.number);
                      onUpdateProgress(anime, Math.max(currentProgress, ep.number - 1));
                      handleSourceChange(selectedSource);
                    }}
                    className={`group relative py-2.5 px-3 rounded-xl font-bold text-xs sm:text-sm flex items-center justify-center gap-1.5 transition-all duration-200 border cursor-pointer select-none ${
                      isCurrent
                        ? 'bg-pink-600 text-white border-pink-500 shadow-lg shadow-pink-600/30 ring-2 ring-pink-400'
                        : isWatched
                        ? 'bg-[#0b1418] text-emerald-400 border-emerald-500/30 hover:border-emerald-500/60'
                        : 'bg-[#0d101a] text-slate-200 border-white/10 hover:bg-[#141828] hover:border-indigo-500/50 hover:text-white'
                    }`}
                  >
                    <Play className={`w-3 h-3 ${isCurrent ? 'fill-white' : isWatched ? 'fill-emerald-400' : 'fill-slate-400 group-hover:fill-indigo-400'}`} />
                    <span>{ep.number}</span>
                  </button>
                );
              })}
            </div>
          ) : episodeViewMode === 'grid' ? (
            <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-6 gap-3 max-h-[600px] overflow-y-auto pr-1">
              {filteredEpisodes.map(ep => {
                const isCurrent = ep.number === episodeNumber;
                const isWatched = ep.number <= currentProgress;

                return (
                  <button
                    key={ep.number}
                    onClick={() => {
                      onEpisodeChange(ep.number);
                      onUpdateProgress(anime, Math.max(currentProgress, ep.number - 1));
                      handleSourceChange(selectedSource);
                    }}
                    className={`group relative overflow-hidden rounded-2xl text-left transition-all duration-300 border cursor-pointer ${
                      isCurrent
                        ? 'bg-[#151228] border-pink-500/80 shadow-xl shadow-pink-500/10 ring-2 ring-pink-500/60'
                        : isWatched
                        ? 'bg-[#0a1215] border-emerald-500/30 hover:border-emerald-500/60'
                        : 'bg-[#0e111a] hover:bg-[#141926] border-white/10 hover:border-indigo-500/40'
                    }`}
                  >
                    <div className="relative aspect-video w-full overflow-hidden bg-neutral-900">
                      {ep.thumbnail ? (
                        <img
                          src={ep.thumbnail}
                          alt={ep.title}
                          className="w-full h-full object-cover group-hover:scale-110 transition duration-500"
                          referrerPolicy="no-referrer"
                          loading="lazy"
                        />
                      ) : (
                        <div className="w-full h-full flex items-center justify-center text-neutral-600 bg-neutral-900">
                          <Film className="w-6 h-6" />
                        </div>
                      )}
                      <div className="absolute inset-0 bg-gradient-to-t from-black/90 via-black/30 to-transparent" />

                      {/* Live Playing Indicator */}
                      {isCurrent && (
                        <div className="absolute top-2 left-2 flex items-center gap-1.5 px-2 py-0.5 rounded-full bg-red-600/90 text-white font-black text-[9px] shadow-lg backdrop-blur-md">
                          <span className="w-1.5 h-1.5 rounded-full bg-white animate-pulse" />
                          <span>PLAYING</span>
                        </div>
                      )}

                      {/* EP Number Badge */}
                      <div className="absolute bottom-1.5 right-1.5 px-2 py-0.5 rounded-lg bg-black/85 backdrop-blur-md text-white font-black text-[11px] border border-white/10">
                        EP {ep.number}
                      </div>
                    </div>

                    <div className="p-2.5">
                      <h4 className={`font-bold text-xs truncate leading-snug ${isCurrent ? 'text-pink-400' : 'text-neutral-200 group-hover:text-white'}`}>
                        {ep.title}
                      </h4>
                      <div className="flex items-center justify-between mt-1 text-[10px]">
                        {isCurrent ? (
                          <span className="text-pink-400 font-extrabold">Now Playing</span>
                        ) : isWatched ? (
                          <span className="text-emerald-400 font-bold flex items-center gap-1">
                            <CheckCircle2 className="w-3 h-3" /> Watched
                          </span>
                        ) : (
                          <span className="text-neutral-500">Episode {ep.number}</span>
                        )}
                      </div>
                    </div>
                  </button>
                );
              })}
            </div>
          ) : (
            <div className="space-y-2 max-h-[650px] overflow-y-auto pr-1">
              {filteredEpisodes.map(ep => {
                const isCurrent = ep.number === episodeNumber;

                return (
                  <div
                    key={ep.number}
                    onClick={() => {
                      onEpisodeChange(ep.number);
                      onUpdateProgress(anime, Math.max(currentProgress, ep.number - 1));
                      handleSourceChange(selectedSource);
                    }}
                    className={`group flex items-center gap-4 p-3 rounded-2xl transition-all duration-200 cursor-pointer select-none ${
                      isCurrent
                        ? 'bg-[#141226] border border-indigo-500/40 shadow-xl'
                        : 'bg-transparent hover:bg-white/5 border border-transparent'
                    }`}
                  >
                    {/* 16:9 Thumbnail Image with EP Badge */}
                    <div className="relative w-36 sm:w-44 aspect-video rounded-xl overflow-hidden bg-neutral-900 shrink-0 border border-white/10 shadow-md">
                      {ep.thumbnail ? (
                        <img
                          src={ep.thumbnail}
                          alt={ep.title}
                          className="w-full h-full object-cover group-hover:scale-105 transition duration-300"
                          referrerPolicy="no-referrer"
                          loading="lazy"
                        />
                      ) : (
                        <div className="w-full h-full flex items-center justify-center text-neutral-600 bg-neutral-900">
                          <Film className="w-6 h-6" />
                        </div>
                      )}

                      {/* EP Number Badge in bottom right of thumbnail */}
                      <div className="absolute bottom-1.5 right-1.5 px-2 py-0.5 rounded-md bg-black/85 backdrop-blur-sm text-white font-black text-[10px] border border-white/10 tracking-tight">
                        EP {ep.number}
                      </div>

                      {/* Hover Play Button Overlay */}
                      {!isCurrent && (
                        <div className="absolute inset-0 bg-black/30 opacity-0 group-hover:opacity-100 flex items-center justify-center transition">
                          <div className="w-7 h-7 rounded-full bg-indigo-600 flex items-center justify-center text-white shadow-lg">
                            <Play className="w-3.5 h-3.5 fill-white translate-x-0.5" />
                          </div>
                        </div>
                      )}
                    </div>

                    {/* Right Details */}
                    <div className="flex-1 min-w-0">
                      <h4
                        className={`font-black text-sm sm:text-base leading-snug truncate ${
                          isCurrent
                            ? 'text-white'
                            : 'text-neutral-100 group-hover:text-white'
                        }`}
                      >
                        {ep.title}
                      </h4>

                      <p className={`text-xs sm:text-sm font-semibold mt-1 ${isCurrent ? 'text-indigo-400 font-extrabold' : 'text-neutral-400'}`}>
                        {isCurrent ? 'Now playing' : `Episode ${ep.number}`}
                      </p>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>

        {/* Franchise Watch Order (Main Story Chronological Order - Borderless Design) */}
        {mainStoryWatchOrder && mainStoryWatchOrder.length > 0 && (
          <section className="mx-3 sm:mx-0 space-y-4 pt-2">
            <div className="flex items-center justify-between flex-wrap gap-2">
              <div className="flex items-center gap-2.5">
                <div className="p-2 rounded-xl bg-indigo-600/20 text-indigo-400 border border-indigo-500/30">
                  <Compass className="w-5 h-5" />
                </div>
                <div>
                  <h3 className="text-base sm:text-lg font-black text-white tracking-tight flex items-center gap-2">
                    <span>Watch Order</span>
                    <span className="text-xs font-semibold text-neutral-400">
                      (Main Story Only)
                    </span>
                  </h3>
                  <p className="text-xs text-neutral-400 mt-0.5">
                    Official sequential release timeline for TV seasons & main storyline
                  </p>
                </div>
              </div>

              <span className="text-xs font-bold px-3 py-1 rounded-full bg-neutral-900 border border-neutral-700 text-neutral-300">
                {mainStoryWatchOrder.length} {mainStoryWatchOrder.length === 1 ? 'Season' : 'Seasons / Parts'}
              </span>
            </div>

            {/* Horizontal Left-to-Right Scrollable Deck */}
            <div className="flex items-stretch gap-3.5 sm:gap-4 overflow-x-auto pb-3 pt-1 scrollbar-thin">
              {mainStoryWatchOrder.map((item, idx) => {
                const isCurrentAnime = item.id === anime.id;
                const stepNum = idx + 1;
                const poster = item.coverImage || coverUrl || '';
                const itemYear = item.releaseYear;
                const itemFormat = item.format || 'TV';
                const epLabel = typeof item.episodesCount === 'number' ? `${item.episodesCount} eps` : item.episodesCount || 'TV Series';

                return (
                  <div
                    key={item.id || idx}
                    onClick={() => {
                      if (isCurrentAnime) return;
                      if (onNavigateToAnime && item.animeObj) {
                        onNavigateToAnime(item.animeObj);
                      } else if (onOpenDetails && item.animeObj) {
                        onOpenDetails(item.animeObj);
                      } else if (item.id) {
                        const syntheticAnime = {
                          ...anime,
                          id: item.id,
                          title: {
                            romaji: item.romajiTitle || item.title,
                            english: item.title,
                            userPreferred: item.title,
                          },
                          coverImage: item.coverImage ? { extraLarge: item.coverImage, large: item.coverImage, medium: item.coverImage } : anime.coverImage,
                        };
                        if (onNavigateToAnime) onNavigateToAnime(syntheticAnime as Anime);
                        else if (onOpenDetails) onOpenDetails(syntheticAnime as Anime);
                      }
                    }}
                    className={`group relative w-44 sm:w-52 shrink-0 rounded-2xl overflow-hidden bg-neutral-900 border transition cursor-pointer flex flex-col select-none ${
                      isCurrentAnime
                        ? 'border-indigo-500/80 ring-2 ring-indigo-500/40 shadow-xl shadow-indigo-500/10'
                        : 'border-neutral-800 hover:border-neutral-600 hover:shadow-lg'
                    }`}
                  >
                    {/* Poster Image */}
                    <div className="relative aspect-[2/3] w-full bg-neutral-950 overflow-hidden">
                      {poster ? (
                        <img
                          src={poster}
                          alt={item.title}
                          className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-300"
                          referrerPolicy="no-referrer"
                          loading="lazy"
                        />
                      ) : (
                        <div className="w-full h-full flex items-center justify-center text-neutral-600">
                          <Tv className="w-8 h-8" />
                        </div>
                      )}

                      <div className="absolute inset-0 bg-gradient-to-t from-neutral-950 via-neutral-950/20 to-transparent" />

                      {/* Step Number Badge */}
                      <div className="absolute top-2 left-2 px-2 py-0.5 rounded-lg bg-black/80 backdrop-blur-md text-[11px] font-black text-white border border-white/10 shadow-sm flex items-center gap-1">
                        <span>Step {stepNum}</span>
                      </div>

                      {/* Currently Playing Badge */}
                      {isCurrentAnime && (
                        <div className="absolute top-2 right-2 px-2 py-0.5 rounded-lg bg-red-600/90 text-[10px] font-black text-white uppercase tracking-wider shadow-lg animate-pulse flex items-center gap-1">
                          <span className="w-1.5 h-1.5 rounded-full bg-white animate-ping" />
                          <span>Now Playing</span>
                        </div>
                      )}

                      {/* Bottom Image Badges */}
                      <div className="absolute bottom-2 left-2 right-2 flex items-center justify-between text-[10px] font-bold text-neutral-300">
                        <span className="px-1.5 py-0.5 rounded bg-black/70 backdrop-blur-sm border border-white/10">
                          {itemFormat}
                        </span>
                        {itemYear && (
                          <span className="px-1.5 py-0.5 rounded bg-black/70 backdrop-blur-sm border border-white/10">
                            {itemYear}
                          </span>
                        )}
                      </div>
                    </div>

                    {/* Meta info below poster */}
                    <div className="p-3 flex-1 flex flex-col justify-between space-y-2">
                      <div>
                        <h4 className={`font-bold text-xs sm:text-sm line-clamp-2 leading-snug transition ${
                          isCurrentAnime ? 'text-indigo-300' : 'text-neutral-100 group-hover:text-white'
                        }`}>
                          {item.title}
                        </h4>
                        <p className="text-[11px] text-neutral-400 mt-1">
                          {epLabel}
                        </p>
                      </div>

                      {!isCurrentAnime && (
                        <div className="pt-1">
                          <span className="inline-flex items-center gap-1 text-[11px] font-bold text-indigo-400 group-hover:text-indigo-300">
                            <span>Watch Season</span>
                            <ChevronRight className="w-3 h-3 group-hover:translate-x-0.5 transition-transform" />
                          </span>
                        </div>
                      )}
                    </div>
                  </div>
                );
              })}
            </div>
          </section>
        )}
      </main>

      {/* Batch Download Modal for Offline Viewing */}
      {showDownloadModal && (
        <BatchDownloadModal
          anime={anime}
          episodes={episodeList.map(ep => ({
            number: ep.number,
            title: ep.title,
            thumbnail: ep.thumbnail,
            synopsis: ep.synopsis,
            filler: ep.filler,
          }))}
          currentEpisodeNumber={episodeNumber}
          initialAudio={selectedAudio}
          initialServer={STREAM_PROVIDERS.find(p => p.id === selectedServer)?.label || 'None'}
          onClose={() => setShowDownloadModal(false)}
          onOpenDownloadsView={onOpenDownloadsView}
        />
      )}
    </div>
  );
};
