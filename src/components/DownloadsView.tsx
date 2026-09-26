import React, { useState, useEffect, useMemo } from 'react';
import {
  Download,
  Play,
  Pause,
  RotateCcw,
  Trash2,
  CheckCircle2,
  AlertCircle,
  Film,
  HardDrive,
  ArrowLeft,
  WifiOff,
  Search,
  ChevronRight,
  FolderDown,
  Sparkles,
  ListFilter,
} from 'lucide-react';
import {
  DownloadItemInfo,
  subscribeToDownloads,
  pauseDownload,
  resumeDownload,
  cancelDownload,
  playOfflineEpisode,
  refreshDownloadsList,
  exportDownloadToPublicStorage,
} from '../services/downloadManager';

interface DownloadsViewProps {
  onBack?: () => void;
  onOpenAnimeDetails?: (anilistId: number) => void;
}

export const DownloadsView: React.FC<DownloadsViewProps> = ({ onBack, onOpenAnimeDetails }) => {
  const [downloads, setDownloads] = useState<DownloadItemInfo[]>([]);
  const [filter, setFilter] = useState<'all' | 'active' | 'completed'>('all');
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedAnimeTitle, setSelectedAnimeTitle] = useState<string | null>(null);
  const [exportMessage, setExportMessage] = useState<string | null>(null);

  useEffect(() => {
    refreshDownloadsList();
    const unsubscribe = subscribeToDownloads(updated => {
      setDownloads(updated);
    });
    return () => unsubscribe();
  }, []);

  const handleExport = async (item: DownloadItemInfo) => {
    try {
      setExportMessage(`Exporting EP ${item.episodeNumber} to Downloads/AniLove...`);
      const res = await exportDownloadToPublicStorage(item);
      setExportMessage(`Exported to Storage/Downloads/AniLove/${res.fileName}!`);
      setTimeout(() => setExportMessage(null), 4000);
    } catch (err: any) {
      alert(`Export failed: ${err?.message || 'Error exporting file'}`);
      setExportMessage(null);
    }
  };

  // Format bytes to human readable format (MB / GB)
  const formatBytes = (bytes: number): string => {
    if (!bytes || bytes <= 0) return '0 MB';
    const mb = bytes / (1024 * 1024);
    if (mb < 1000) {
      return `${mb.toFixed(1)} MB`;
    }
    const gb = mb / 1024;
    return `${gb.toFixed(2)} GB`;
  };

  // Compute total storage consumed across all downloads
  const totalStorageBytes = useMemo(() => {
    return downloads.reduce((acc, item) => {
      if (item.status === 'COMPLETED' && item.totalBytes > 0) {
        return acc + item.totalBytes;
      }
      return acc + (item.bytesDownloaded || 0);
    }, 0);
  }, [downloads]);

  const activeDownloads = useMemo(() => {
    return downloads.filter(
      d =>
        d.status === 'DOWNLOADING' ||
        d.status === 'QUEUED' ||
        d.status === 'PAUSED' ||
        d.status === 'ERROR'
    );
  }, [downloads]);

  const completedDownloads = useMemo(() => {
    return downloads.filter(d => d.status === 'COMPLETED');
  }, [downloads]);

  // Group downloads by Anime Title
  const animeGroups = useMemo(() => {
    const map = new Map<
      string,
      {
        anilistId: number;
        animeTitle: string;
        thumbnail: string;
        episodes: DownloadItemInfo[];
        completedCount: number;
        activeCount: number;
        totalBytes: number;
      }
    >();

    downloads.forEach(item => {
      const existing = map.get(item.animeTitle) || {
        anilistId: item.anilistId,
        animeTitle: item.animeTitle,
        thumbnail: item.thumbnail || '',
        episodes: [],
        completedCount: 0,
        activeCount: 0,
        totalBytes: 0,
      };

      existing.episodes.push(item);
      if (item.status === 'COMPLETED') {
        existing.completedCount++;
        existing.totalBytes += item.totalBytes || 0;
      } else {
        existing.activeCount++;
        existing.totalBytes += item.bytesDownloaded || 0;
      }

      if (!existing.thumbnail && item.thumbnail) {
        existing.thumbnail = item.thumbnail;
      }

      map.set(item.animeTitle, existing);
    });

    let list = Array.from(map.values());

    if (searchQuery.trim()) {
      const q = searchQuery.toLowerCase();
      list = list.filter(g => g.animeTitle.toLowerCase().includes(q));
    }

    if (filter === 'completed') {
      list = list.filter(g => g.completedCount > 0);
    } else if (filter === 'active') {
      list = list.filter(g => g.activeCount > 0);
    }

    return list;
  }, [downloads, searchQuery, filter]);

  const selectedGroup = useMemo(() => {
    if (!selectedAnimeTitle) return null;
    return animeGroups.find(g => g.animeTitle === selectedAnimeTitle) || null;
  }, [animeGroups, selectedAnimeTitle]);

  const handlePlay = async (item: DownloadItemInfo) => {
    try {
      await playOfflineEpisode(item);
    } catch (err: any) {
      alert(`Could not launch offline player: ${err?.message || 'File missing'}`);
    }
  };

  const handleDeleteGroup = async (groupEpisodes: DownloadItemInfo[]) => {
    if (!confirm(`Are you sure you want to delete all downloaded episodes for "${groupEpisodes[0]?.animeTitle}"?`)) {
      return;
    }
    for (const ep of groupEpisodes) {
      await cancelDownload(ep.id);
    }
    setSelectedAnimeTitle(null);
  };

  return (
    <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-6 sm:py-8 space-y-6 sm:space-y-8 animate-fadeIn">
      {/* Top Header Bar */}
      <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
        <div className="flex items-center gap-3">
          {(selectedAnimeTitle || onBack) && (
            <button
              onClick={() => {
                if (selectedAnimeTitle) setSelectedAnimeTitle(null);
                else if (onBack) onBack();
              }}
              className="p-2.5 rounded-xl bg-slate-900/90 border border-slate-800 text-slate-300 hover:text-white hover:bg-slate-800 transition cursor-pointer shadow-lg"
              title="Go Back"
            >
              <ArrowLeft className="w-5 h-5" />
            </button>
          )}
          <div>
            <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-violet-500/20 text-violet-300 text-xs font-semibold border border-violet-500/30 mb-1.5">
              <WifiOff className="w-3.5 h-3.5" />
              <span>Offline Library</span>
            </div>
            <h1 className="text-2xl sm:text-3xl font-black text-white tracking-tight flex items-center gap-3">
              <span>{selectedAnimeTitle ? selectedAnimeTitle : 'Downloads'}</span>
              {!selectedAnimeTitle && downloads.length > 0 && (
                <span className="text-sm font-bold px-2.5 py-0.5 rounded-full bg-slate-800 border border-slate-700 text-slate-300">
                  {animeGroups.length} {animeGroups.length === 1 ? 'Anime' : 'Animes'}
                </span>
              )}
            </h1>
            <p className="text-xs sm:text-sm text-slate-400 mt-0.5">
              {selectedAnimeTitle
                ? `Manage downloaded episodes and files for ${selectedAnimeTitle}`
                : 'Watch downloaded anime episodes anywhere, anytime without an internet connection.'}
            </p>
          </div>
        </div>

        {/* Device Storage Usage Pill */}
        <div className="flex items-center gap-3 px-4 py-2.5 rounded-2xl bg-slate-900/90 border border-slate-800/90 shadow-xl backdrop-blur-md shrink-0">
          <div className="w-9 h-9 rounded-xl bg-violet-500/20 text-violet-400 flex items-center justify-center border border-violet-500/30">
            <HardDrive className="w-5 h-5" />
          </div>
          <div>
            <div className="text-[10px] uppercase font-bold text-slate-400 tracking-wider">
              Offline Storage
            </div>
            <div className="text-sm font-black text-white">{formatBytes(totalStorageBytes)}</div>
          </div>
        </div>
      </div>

      {/* FILTER & SEARCH BAR (Only shown on main card view) */}
      {!selectedAnimeTitle && downloads.length > 0 && (
        <div className="flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-3">
          <div className="flex items-center gap-1.5 bg-slate-900/90 border border-slate-800 p-1.5 rounded-2xl">
            <button
              onClick={() => setFilter('all')}
              className={`px-4 py-2 rounded-xl text-xs font-bold transition cursor-pointer ${
                filter === 'all'
                  ? 'bg-violet-600 text-white shadow-md shadow-violet-600/30'
                  : 'text-slate-400 hover:text-white'
              }`}
            >
              All Anime ({animeGroups.length})
            </button>
            <button
              onClick={() => setFilter('active')}
              className={`px-4 py-2 rounded-xl text-xs font-bold transition cursor-pointer flex items-center gap-1.5 ${
                filter === 'active'
                  ? 'bg-violet-600 text-white shadow-md shadow-violet-600/30'
                  : 'text-slate-400 hover:text-white'
              }`}
            >
              <span>Downloading</span>
              {activeDownloads.length > 0 && (
                <span className="w-2 h-2 rounded-full bg-pink-400 animate-ping" />
              )}
              <span>({activeDownloads.length})</span>
            </button>
            <button
              onClick={() => setFilter('completed')}
              className={`px-4 py-2 rounded-xl text-xs font-bold transition cursor-pointer ${
                filter === 'completed'
                  ? 'bg-violet-600 text-white shadow-md shadow-violet-600/30'
                  : 'text-slate-400 hover:text-white'
              }`}
            >
              Completed ({completedDownloads.length})
            </button>
          </div>

          {/* Search Bar */}
          <div className="relative flex-1 sm:max-w-xs">
            <Search className="w-4 h-4 text-slate-400 absolute left-3.5 top-1/2 -translate-y-1/2" />
            <input
              type="text"
              placeholder="Search downloaded anime..."
              value={searchQuery}
              onChange={e => setSearchQuery(e.target.value)}
              className="w-full pl-10 pr-4 py-2.5 rounded-2xl bg-slate-900/90 border border-slate-800 text-xs text-white placeholder-slate-500 focus:outline-none focus:border-violet-500 transition shadow-inner"
            />
          </div>
        </div>
      )}

      {/* EMPTY STATE */}
      {downloads.length === 0 && (
        <div className="text-center py-20 px-6 rounded-3xl bg-slate-900/40 border border-dashed border-slate-800 space-y-4">
          <div className="w-16 h-16 rounded-3xl bg-violet-500/10 text-violet-400 flex items-center justify-center mx-auto border border-violet-500/20 shadow-xl">
            <Download className="w-8 h-8" />
          </div>
          <div className="max-w-md mx-auto space-y-1.5">
            <h3 className="text-lg font-bold text-white">No Offline Downloads</h3>
            <p className="text-xs sm:text-sm text-slate-400">
              When watching any anime episode, tap the <strong>Download</strong> button to save episodes for offline viewing.
            </p>
          </div>
        </div>
      )}

      {/* ACTIVE DOWNLOADS BANNER (Summary progress if downloads are currently active) */}
      {!selectedAnimeTitle && activeDownloads.length > 0 && (
        <div className="p-4 sm:p-5 rounded-3xl bg-gradient-to-r from-violet-950/60 via-slate-900/90 to-slate-900/90 border border-violet-500/30 shadow-2xl space-y-3">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2.5">
              <span className="relative flex h-3 w-3">
                <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-pink-400 opacity-75" />
                <span className="relative inline-flex rounded-full h-3 w-3 bg-pink-500" />
              </span>
              <h3 className="font-black text-sm text-white uppercase tracking-wider">
                Downloading ({activeDownloads.length} {activeDownloads.length === 1 ? 'Episode' : 'Episodes'})
              </h3>
            </div>
            <span className="text-xs font-bold text-pink-400 font-mono">
              {activeDownloads[0]?.speed || 'In Progress...'}
            </span>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
            {activeDownloads.map(item => (
              <div
                key={item.id}
                className="flex items-center justify-between gap-3 p-3 rounded-2xl bg-slate-950/80 border border-slate-800/80 shadow-md"
              >
                <div className="flex items-center gap-3 min-w-0">
                  <div className="relative w-12 aspect-video rounded-lg overflow-hidden bg-slate-900 shrink-0 border border-slate-800">
                    {item.thumbnail ? (
                      <img src={item.thumbnail} alt="" className="w-full h-full object-cover" />
                    ) : (
                      <div className="w-full h-full flex items-center justify-center text-slate-600">
                        <Film className="w-4 h-4" />
                      </div>
                    )}
                  </div>
                  <div className="min-w-0">
                    <div className="font-bold text-xs text-white truncate">
                      {item.animeTitle} - EP {item.episodeNumber}
                    </div>
                    <div className="text-[11px] text-slate-400 mt-0.5 flex items-center gap-2">
                      <span className="text-pink-400 font-bold">{Math.round(item.progress || 0)}%</span>
                      <span>•</span>
                      <span className="font-mono">{formatBytes(item.bytesDownloaded)} / {formatBytes(item.totalBytes)}</span>
                    </div>
                  </div>
                </div>

                <div className="flex items-center gap-1 shrink-0">
                  {item.status === 'DOWNLOADING' && (
                    <button
                      onClick={() => pauseDownload(item.id)}
                      className="p-1.5 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-300 transition"
                      title="Pause"
                    >
                      <Pause className="w-3.5 h-3.5" />
                    </button>
                  )}
                  {item.status === 'PAUSED' && (
                    <button
                      onClick={() => resumeDownload(item.id)}
                      className="p-1.5 rounded-lg bg-violet-600 hover:bg-violet-500 text-white transition"
                      title="Resume"
                    >
                      <Play className="w-3.5 h-3.5 fill-white" />
                    </button>
                  )}
                  <button
                    onClick={() => cancelDownload(item.id)}
                    className="p-1.5 rounded-lg bg-slate-800 hover:bg-red-500/20 hover:text-red-400 text-slate-400 transition"
                    title="Cancel"
                  >
                    <Trash2 className="w-3.5 h-3.5" />
                  </button>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* MAIN VIEW: ANIME CARDS GRID */}
      {!selectedAnimeTitle && animeGroups.length > 0 && (
        <div className="space-y-4">
          <div className="flex items-center justify-between">
            <h2 className="text-xs font-black text-slate-400 uppercase tracking-wider">
              Downloaded Anime Series ({animeGroups.length})
            </h2>
          </div>

          <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 gap-4 sm:gap-6">
            {animeGroups.map(group => {
              const completedEps = group.episodes.filter(e => e.status === 'COMPLETED');
              const latestEp = completedEps[0] || group.episodes[0];

              return (
                <div
                  key={group.animeTitle}
                  onClick={() => setSelectedAnimeTitle(group.animeTitle)}
                  className="group relative bg-slate-900/90 border border-slate-800/80 rounded-2xl overflow-hidden shadow-xl hover:border-violet-500/50 hover:shadow-violet-500/10 transition-all duration-300 cursor-pointer flex flex-col active:scale-98"
                >
                  {/* Poster / Cover Image */}
                  <div className="relative aspect-[3/4] w-full bg-slate-950 overflow-hidden">
                    {group.thumbnail ? (
                      <img
                        src={group.thumbnail}
                        alt={group.animeTitle}
                        className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-500"
                      />
                    ) : (
                      <div className="w-full h-full flex items-center justify-center text-slate-700 bg-slate-900">
                        <Film className="w-12 h-12" />
                      </div>
                    )}

                    {/* Gradient Overlay */}
                    <div className="absolute inset-0 bg-gradient-to-t from-[#090b10] via-[#090b10]/20 to-transparent" />

                    {/* Top Badges */}
                    <div className="absolute top-2.5 left-2.5 right-2.5 flex items-center justify-between pointer-events-none">
                      <span className="px-2 py-0.5 rounded-lg bg-black/75 backdrop-blur-md text-white font-bold text-[10px] border border-white/10 shadow-md">
                        {group.completedCount} {group.completedCount === 1 ? 'EP' : 'EPs'}
                      </span>
                      <span className="px-2 py-0.5 rounded-lg bg-violet-600/90 text-white font-black text-[10px] shadow-md shadow-violet-600/30">
                        {formatBytes(group.totalBytes)}
                      </span>
                    </div>

                    {/* Play Hover Overlay */}
                    <div className="absolute inset-0 flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity bg-black/40 backdrop-blur-[2px]">
                      <div className="w-12 h-12 rounded-full bg-violet-600 text-white flex items-center justify-center shadow-2xl scale-90 group-hover:scale-100 transition-transform">
                        <Play className="w-6 h-6 fill-white ml-0.5" />
                      </div>
                    </div>
                  </div>

                  {/* Card Bottom Details */}
                  <div className="p-3.5 flex-1 flex flex-col justify-between bg-slate-900/90">
                    <div>
                      <h3 className="font-bold text-xs sm:text-sm text-white line-clamp-2 leading-snug group-hover:text-violet-300 transition-colors">
                        {group.animeTitle}
                      </h3>
                    </div>

                    <div className="mt-2.5 pt-2 border-t border-slate-800/80 flex items-center justify-between text-[11px] text-slate-400">
                      <span className="font-semibold text-slate-300">
                        {group.completedCount} Downloaded
                      </span>
                      <ChevronRight className="w-4 h-4 text-slate-500 group-hover:text-white group-hover:translate-x-0.5 transition-all" />
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      )}

      {/* SUB-VIEW: INDIVIDUAL ANIME DOWNLOADED EPISODES */}
      {selectedGroup && (
        <div className="space-y-6 animate-fadeIn">
          {/* Group Header Card */}
          {exportMessage && (
            <div className="p-3 rounded-2xl bg-violet-950/80 border border-violet-500/50 text-violet-200 text-xs font-bold text-center animate-fadeIn shadow-lg">
              {exportMessage}
            </div>
          )}

          <div className="p-5 sm:p-6 rounded-3xl bg-slate-900/90 border border-slate-800 shadow-2xl flex flex-col sm:flex-row items-start sm:items-center justify-between gap-5">
            <div className="flex items-center gap-4 min-w-0">
              <div className="w-16 h-20 sm:w-20 sm:h-28 rounded-2xl overflow-hidden bg-slate-950 shrink-0 border border-slate-800 shadow-md">
                {selectedGroup.thumbnail ? (
                  <img src={selectedGroup.thumbnail} alt="" className="w-full h-full object-cover" />
                ) : (
                  <div className="w-full h-full flex items-center justify-center text-slate-700">
                    <Film className="w-8 h-8" />
                  </div>
                )}
              </div>
              <div className="min-w-0">
                <h2 className="text-lg sm:text-2xl font-black text-white tracking-tight truncate">
                  {selectedGroup.animeTitle}
                </h2>
                <div className="flex flex-wrap items-center gap-2 mt-2 text-xs">
                  <span className="px-2.5 py-1 rounded-xl bg-violet-500/20 text-violet-300 font-bold border border-violet-500/30">
                    {selectedGroup.completedCount} Downloaded Episodes
                  </span>
                  <span className="px-2.5 py-1 rounded-xl bg-slate-800 text-slate-300 font-bold border border-slate-700">
                    Total Storage: {formatBytes(selectedGroup.totalBytes)}
                  </span>
                </div>
              </div>
            </div>

            <div className="flex items-center gap-2 shrink-0 self-end sm:self-auto">
              {onOpenAnimeDetails && (
                <button
                  onClick={() => onOpenAnimeDetails(selectedGroup.anilistId)}
                  className="px-4 py-2.5 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-200 text-xs font-bold transition cursor-pointer flex items-center gap-1.5"
                >
                  <span>Series Details</span>
                </button>
              )}
              <button
                onClick={() => handleDeleteGroup(selectedGroup.episodes)}
                className="px-4 py-2.5 rounded-xl bg-red-500/10 hover:bg-red-500/20 text-red-400 border border-red-500/20 text-xs font-bold transition cursor-pointer flex items-center gap-1.5"
              >
                <Trash2 className="w-4 h-4" />
                <span>Delete All ({selectedGroup.episodes.length})</span>
              </button>
            </div>
          </div>

          {/* Episode List for Selected Anime */}
          <div className="space-y-3">
            <h3 className="text-xs font-black text-slate-400 uppercase tracking-wider px-1">
              Episodes List ({selectedGroup.episodes.length})
            </h3>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              {selectedGroup.episodes.map(item => {
                const isCompleted = item.status === 'COMPLETED';
                const isError = item.status === 'ERROR';
                const isDownloading = item.status === 'DOWNLOADING';
                const isPaused = item.status === 'PAUSED';

                // Display file size in MB / GB
                const fileSizeStr = formatBytes(item.totalBytes || item.bytesDownloaded);

                return (
                  <div
                    key={item.id}
                    className="p-4 rounded-2xl bg-slate-900/90 border border-slate-800/90 hover:border-violet-500/40 shadow-xl transition space-y-3"
                  >
                    <div className="flex items-start gap-3">
                      {/* Episode Thumbnail */}
                      <div
                        onClick={() => isCompleted && handlePlay(item)}
                        className={`relative w-28 aspect-video rounded-xl overflow-hidden bg-slate-950 shrink-0 border border-slate-800 ${
                          isCompleted ? 'cursor-pointer group' : ''
                        }`}
                      >
                        {item.thumbnail ? (
                          <img src={item.thumbnail} alt="" className="w-full h-full object-cover" />
                        ) : (
                          <div className="w-full h-full flex items-center justify-center text-slate-700">
                            <Film className="w-6 h-6" />
                          </div>
                        )}
                        {isCompleted && (
                          <div className="absolute inset-0 bg-black/40 group-hover:bg-black/20 flex items-center justify-center transition">
                            <Play className="w-5 h-5 text-white fill-white" />
                          </div>
                        )}
                        <div className="absolute bottom-1 right-1 px-1.5 py-0.5 rounded bg-black/80 text-[10px] font-black text-white">
                          EP {item.episodeNumber}
                        </div>
                      </div>

                      {/* Episode Metadata */}
                      <div className="flex-1 min-w-0">
                        <div className="font-bold text-sm text-white truncate">
                          Episode {item.episodeNumber}
                        </div>
                        <div className="flex items-center gap-2 mt-1">
                          <span className="px-2 py-0.5 rounded-md text-[10px] font-black bg-pink-500/20 text-pink-300 border border-pink-500/30">
                            {item.audio}
                          </span>
                          <span className="px-2 py-0.5 rounded-md text-[10px] font-black bg-slate-800 text-slate-300 border border-slate-700">
                            {item.quality}
                          </span>
                        </div>

                        {/* DISPLAY EXACT MB TAKEN BY THIS EPISODE */}
                        <div className="mt-2 text-xs font-mono font-bold text-violet-400 flex items-center gap-1.5">
                          <HardDrive className="w-3.5 h-3.5 text-slate-500" />
                          <span>Size: {fileSizeStr}</span>
                        </div>
                      </div>

                      {/* Actions */}
                      <div className="flex items-center gap-1.5 shrink-0">
                        {isCompleted && (
                          <>
                            <button
                              onClick={() => handlePlay(item)}
                              className="px-3 py-2 rounded-xl bg-violet-600 hover:bg-violet-500 text-white text-xs font-bold flex items-center gap-1.5 shadow-lg shadow-violet-600/30 transition cursor-pointer"
                            >
                              <Play className="w-3.5 h-3.5 fill-white" />
                              <span>Play</span>
                            </button>
                            <button
                              onClick={() => handleExport(item)}
                              className="px-2.5 py-2 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-200 text-xs font-semibold flex items-center gap-1.5 transition cursor-pointer border border-slate-700/80"
                              title="Export to Gallery / Public Downloads folder"
                            >
                              <FolderDown className="w-4 h-4 text-violet-400" />
                              <span className="hidden sm:inline">Export</span>
                            </button>
                          </>
                        )}
                        {isDownloading && (
                          <button
                            onClick={() => pauseDownload(item.id)}
                            className="p-2 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-300 transition cursor-pointer"
                            title="Pause"
                          >
                            <Pause className="w-4 h-4" />
                          </button>
                        )}
                        {isPaused && (
                          <button
                            onClick={() => resumeDownload(item.id)}
                            className="p-2 rounded-xl bg-violet-600 hover:bg-violet-500 text-white transition cursor-pointer"
                            title="Resume"
                          >
                            <Play className="w-4 h-4 fill-white" />
                          </button>
                        )}
                        <button
                          onClick={() => cancelDownload(item.id)}
                          className="p-2 rounded-xl text-slate-500 hover:text-red-400 hover:bg-red-500/10 transition cursor-pointer"
                          title="Delete episode"
                        >
                          <Trash2 className="w-4 h-4" />
                        </button>
                      </div>
                    </div>

                    {/* Active Download Progress Bar (if in progress) */}
                    {!isCompleted && (
                      <div className="space-y-1 pt-1">
                        <div className="w-full h-2 rounded-full bg-slate-800 overflow-hidden">
                          <div
                            className={`h-full rounded-full transition-all duration-300 ${
                              isError
                                ? 'bg-red-500'
                                : isPaused
                                ? 'bg-amber-500'
                                : 'bg-gradient-to-r from-pink-500 to-violet-600'
                            }`}
                            style={{ width: `${Math.max(2, item.progress || 0)}%` }}
                          />
                        </div>
                        <div className="flex items-center justify-between text-[11px] text-slate-400 font-mono">
                          <span>{item.speed || item.status}</span>
                          <span>{Math.round(item.progress || 0)}%</span>
                        </div>
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
