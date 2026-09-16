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
  Clock,
  WifiOff,
  Search,
  ExternalLink,
} from 'lucide-react';
import {
  DownloadItemInfo,
  subscribeToDownloads,
  pauseDownload,
  resumeDownload,
  cancelDownload,
  playOfflineEpisode,
  refreshDownloadsList,
} from '../services/downloadManager';

interface DownloadsViewProps {
  onBack?: () => void;
  onOpenAnimeDetails?: (anilistId: number) => void;
}

export const DownloadsView: React.FC<DownloadsViewProps> = ({ onBack }) => {
  const [downloads, setDownloads] = useState<DownloadItemInfo[]>([]);
  const [filter, setFilter] = useState<'all' | 'active' | 'completed'>('all');
  const [searchQuery, setSearchQuery] = useState('');

  useEffect(() => {
    refreshDownloadsList();
    const unsubscribe = subscribeToDownloads(updated => {
      setDownloads(updated);
    });
    return () => unsubscribe();
  }, []);

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

  // Compute total storage consumed
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

  const filteredDownloads = useMemo(() => {
    let list = downloads;
    if (filter === 'active') {
      list = activeDownloads;
    } else if (filter === 'completed') {
      list = completedDownloads;
    }

    if (searchQuery.trim()) {
      const q = searchQuery.toLowerCase();
      list = list.filter(
        d =>
          d.animeTitle.toLowerCase().includes(q) ||
          `ep ${d.episodeNumber}`.toLowerCase().includes(q)
      );
    }
    return list;
  }, [downloads, filter, activeDownloads, completedDownloads, searchQuery]);

  // Group completed downloads by anime title
  const groupedCompleted = useMemo(() => {
    const map = new Map<string, DownloadItemInfo[]>();
    completedDownloads.forEach(item => {
      const group = map.get(item.animeTitle) || [];
      group.push(item);
      map.set(item.animeTitle, group);
    });
    return Array.from(map.entries());
  }, [completedDownloads]);

  const handlePlay = async (item: DownloadItemInfo) => {
    try {
      await playOfflineEpisode(item);
    } catch (err: any) {
      alert(`Could not launch offline player: ${err?.message || 'File missing'}`);
    }
  };

  return (
    <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8 space-y-8">
      {/* Top Header */}
      <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
        <div className="flex items-center gap-3">
          {onBack && (
            <button
              onClick={onBack}
              className="p-2.5 rounded-xl bg-slate-900/90 border border-slate-800 text-slate-300 hover:text-white transition cursor-pointer"
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
              <span>Downloads</span>
              {downloads.length > 0 && (
                <span className="text-sm font-bold px-2.5 py-0.5 rounded-full bg-slate-800 border border-slate-700 text-slate-300">
                  {downloads.length}
                </span>
              )}
            </h1>
            <p className="text-xs sm:text-sm text-slate-400 mt-1">
              Watch downloaded anime episodes anywhere, anytime without an internet connection.
            </p>
          </div>
        </div>

        {/* Total Storage Used Badge */}
        <div className="flex items-center gap-3 px-4 py-2.5 rounded-2xl bg-slate-900/90 border border-slate-800 shadow-lg">
          <div className="w-9 h-9 rounded-xl bg-violet-500/20 text-violet-400 flex items-center justify-center border border-violet-500/30">
            <HardDrive className="w-5 h-5" />
          </div>
          <div>
            <div className="text-[10px] uppercase font-bold text-slate-400 tracking-wider">Device Storage</div>
            <div className="text-sm font-black text-white">{formatBytes(totalStorageBytes)}</div>
          </div>
        </div>
      </div>

      {/* Filter Tabs & Search Bar */}
      <div className="flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-3">
        <div className="flex items-center gap-1.5 bg-slate-900/90 border border-slate-800 p-1.5 rounded-2xl">
          <button
            onClick={() => setFilter('all')}
            className={`px-4 py-2 rounded-xl text-xs font-bold transition cursor-pointer ${
              filter === 'all'
                ? 'bg-violet-600 text-white shadow-md'
                : 'text-slate-400 hover:text-white'
            }`}
          >
            All ({downloads.length})
          </button>
          <button
            onClick={() => setFilter('active')}
            className={`px-4 py-2 rounded-xl text-xs font-bold transition cursor-pointer flex items-center gap-1.5 ${
              filter === 'active'
                ? 'bg-violet-600 text-white shadow-md'
                : 'text-slate-400 hover:text-white'
            }`}
          >
            <span>Active</span>
            {activeDownloads.length > 0 && (
              <span className="w-2 h-2 rounded-full bg-pink-400 animate-ping" />
            )}
            <span>({activeDownloads.length})</span>
          </button>
          <button
            onClick={() => setFilter('completed')}
            className={`px-4 py-2 rounded-xl text-xs font-bold transition cursor-pointer ${
              filter === 'completed'
                ? 'bg-violet-600 text-white shadow-md'
                : 'text-slate-400 hover:text-white'
            }`}
          >
            Completed ({completedDownloads.length})
          </button>
        </div>

        {/* Search */}
        <div className="relative flex-1 sm:max-w-xs">
          <Search className="w-4 h-4 text-slate-400 absolute left-3.5 top-1/2 -translate-y-1/2" />
          <input
            type="text"
            placeholder="Search downloads..."
            value={searchQuery}
            onChange={e => setSearchQuery(e.target.value)}
            className="w-full pl-10 pr-4 py-2.5 rounded-xl bg-slate-900/90 border border-slate-800 text-xs text-white placeholder-slate-500 focus:outline-none focus:border-violet-500 transition"
          />
        </div>
      </div>

      {/* Empty State */}
      {downloads.length === 0 && (
        <div className="text-center py-20 px-6 rounded-3xl bg-slate-900/40 border border-dashed border-slate-800 space-y-4">
          <div className="w-16 h-16 rounded-3xl bg-violet-500/10 text-violet-400 flex items-center justify-center mx-auto border border-violet-500/20">
            <Download className="w-8 h-8" />
          </div>
          <div className="max-w-md mx-auto space-y-1.5">
            <h3 className="text-lg font-bold text-white">No Downloads Yet</h3>
            <p className="text-xs sm:text-sm text-slate-400">
              When watching any anime, tap the <strong>Download</strong> button next to the episodes list to save single or multiple episodes for offline viewing.
            </p>
          </div>
        </div>
      )}

      {/* ACTIVE DOWNLOADS SECTION (if any and filter includes active) */}
      {activeDownloads.length > 0 && (filter === 'all' || filter === 'active') && (
        <div className="space-y-4">
          <div className="flex items-center gap-2">
            <div className="w-2.5 h-2.5 rounded-full bg-pink-500 animate-pulse" />
            <h2 className="text-sm font-black text-white uppercase tracking-wider">
              In Progress ({activeDownloads.length})
            </h2>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {activeDownloads.map(item => {
              const isPaused = item.status === 'PAUSED';
              const isDownloading = item.status === 'DOWNLOADING';
              const isQueued = item.status === 'QUEUED';
              const isError = item.status === 'ERROR';

              return (
                <div
                  key={item.id}
                  className={`p-4 rounded-2xl border space-y-3 shadow-xl backdrop-blur-sm transition ${
                    isError
                      ? 'bg-red-950/20 border-red-500/40'
                      : 'bg-slate-900/80 border-slate-800/90'
                  }`}
                >
                  <div className="flex items-start gap-3">
                    {/* Thumbnail */}
                    <div className="relative w-24 aspect-video rounded-xl overflow-hidden bg-slate-950 shrink-0 border border-slate-800">
                      {item.thumbnail ? (
                        <img
                          src={item.thumbnail}
                          alt={item.animeTitle}
                          className="w-full h-full object-cover"
                        />
                      ) : (
                        <div className="w-full h-full flex items-center justify-center text-slate-600">
                          <Film className="w-6 h-6" />
                        </div>
                      )}
                      <div className="absolute bottom-1 right-1 px-1.5 py-0.5 rounded bg-black/80 text-[10px] font-black text-white">
                        EP {item.episodeNumber}
                      </div>
                    </div>

                    {/* Metadata */}
                    <div className="flex-1 min-w-0">
                      <h4 className="font-bold text-sm text-white truncate">{item.animeTitle}</h4>
                      <div className="flex items-center gap-2 mt-1">
                        <span className="text-xs text-slate-300 font-semibold">
                          Episode {item.episodeNumber}
                        </span>
                        <span className="px-1.5 py-0.2 rounded text-[10px] font-black bg-pink-500/20 text-pink-300 border border-pink-500/30">
                          {item.audio}
                        </span>
                        {isError && (
                          <span className="px-1.5 py-0.2 rounded text-[10px] font-black bg-red-500/20 text-red-400 border border-red-500/30">
                            FAILED
                          </span>
                        )}
                        <span className="text-[11px] text-slate-400">{item.quality}</span>
                      </div>
                      <div className="text-[11px] mt-1 flex items-center gap-2 truncate">
                        {isError ? (
                          <span className="text-red-400 flex items-center gap-1 truncate" title={item.error}>
                            <AlertCircle className="w-3 h-3 shrink-0 text-red-400" />
                            <span className="truncate">{item.error || 'Extraction failed. Tap retry.'}</span>
                          </span>
                        ) : (
                          <>
                            <span className="text-slate-400">
                              {item.speed || (isPaused ? 'Paused' : isQueued ? 'Queued' : 'Connecting...')}
                            </span>
                            {item.totalBytes > 0 && (
                              <span className="text-slate-500">
                                • {formatBytes(item.bytesDownloaded)} / {formatBytes(item.totalBytes)}
                              </span>
                            )}
                          </>
                        )}
                      </div>
                    </div>

                    {/* Action buttons */}
                    <div className="flex items-center gap-1">
                      {isDownloading && (
                        <button
                          onClick={() => pauseDownload(item.id)}
                          className="p-2 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-200 transition cursor-pointer"
                          title="Pause Download"
                        >
                          <Pause className="w-4 h-4" />
                        </button>
                      )}
                      {isPaused && (
                        <button
                          onClick={() => resumeDownload(item.id)}
                          className="p-2 rounded-xl bg-violet-600 hover:bg-violet-500 text-white transition cursor-pointer"
                          title="Resume Download"
                        >
                          <Play className="w-4 h-4 fill-white" />
                        </button>
                      )}
                      {isError && (
                        <button
                          onClick={() => resumeDownload(item.id)}
                          className="p-2 rounded-xl bg-violet-600 hover:bg-violet-500 text-white transition cursor-pointer shadow-lg shadow-violet-600/30"
                          title="Retry Download"
                        >
                          <RotateCcw className="w-4 h-4" />
                        </button>
                      )}
                      <button
                        onClick={() => cancelDownload(item.id)}
                        className="p-2 rounded-xl bg-slate-800 hover:bg-red-500/20 hover:text-red-400 text-slate-400 transition cursor-pointer"
                        title="Remove"
                      >
                        <Trash2 className="w-4 h-4" />
                      </button>
                    </div>
                  </div>

                  {/* Progress bar */}
                  <div className="space-y-1">
                    <div className="w-full h-2 rounded-full bg-slate-800 overflow-hidden">
                      <div
                        className={`h-full rounded-full transition-all duration-300 ${
                          isError
                            ? 'bg-red-500'
                            : isPaused
                            ? 'bg-amber-500'
                            : 'bg-gradient-to-r from-pink-500 to-violet-600'
                        }`}
                        style={{ width: `${Math.max(2, item.progress || (isError ? 100 : 0))}%` }}
                      />
                    </div>
                    <div className="flex items-center justify-between text-[11px] text-slate-400">
                      <span className={isError ? 'text-red-400 font-semibold' : ''}>
                        {isError ? 'Failed — Tap retry or check server' : item.status}
                      </span>
                      <span className="font-bold text-white">
                        {isError ? '!' : `${Math.round(item.progress || 0)}%`}
                      </span>
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      )}

      {/* COMPLETED DOWNLOADS SECTION */}
      {completedDownloads.length > 0 && (filter === 'all' || filter === 'completed') && (
        <div className="space-y-4">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <CheckCircle2 className="w-4 h-4 text-emerald-400" />
              <h2 className="text-sm font-black text-white uppercase tracking-wider">
                Downloaded Episodes ({completedDownloads.length})
              </h2>
            </div>
          </div>

          <div className="space-y-6">
            {groupedCompleted.map(([animeTitle, episodes]) => (
              <div
                key={animeTitle}
                className="p-4 sm:p-6 rounded-2xl bg-slate-900/60 border border-slate-800/80 space-y-4"
              >
                <div className="flex items-center justify-between border-b border-slate-800/80 pb-3">
                  <div className="flex items-center gap-3">
                    <Film className="w-5 h-5 text-violet-400" />
                    <div>
                      <h3 className="font-black text-base text-white tracking-tight">{animeTitle}</h3>
                      <p className="text-xs text-slate-400">
                        {episodes.length} {episodes.length === 1 ? 'episode' : 'episodes'} ready for offline viewing
                      </p>
                    </div>
                  </div>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3">
                  {episodes.map(ep => (
                    <div
                      key={ep.id}
                      className="group flex items-center justify-between gap-3 p-3 rounded-xl bg-slate-950/70 border border-slate-800/70 hover:border-violet-500/50 transition"
                    >
                      <div className="flex items-center gap-3 min-w-0">
                        {/* Thumbnail or Play Icon */}
                        <div
                          onClick={() => handlePlay(ep)}
                          className="relative w-16 aspect-video rounded-lg overflow-hidden bg-slate-900 shrink-0 cursor-pointer group-hover:ring-2 ring-violet-500/50 transition"
                        >
                          {ep.thumbnail ? (
                            <img src={ep.thumbnail} alt="" className="w-full h-full object-cover" />
                          ) : (
                            <div className="w-full h-full flex items-center justify-center text-slate-600">
                              <Film className="w-4 h-4" />
                            </div>
                          )}
                          <div className="absolute inset-0 bg-black/40 group-hover:bg-black/20 flex items-center justify-center transition">
                            <Play className="w-4 h-4 text-white fill-white" />
                          </div>
                        </div>

                        <div className="min-w-0">
                          <div className="font-bold text-xs sm:text-sm text-white truncate">
                            Episode {ep.episodeNumber}
                          </div>
                          <div className="flex items-center gap-1.5 text-[11px] text-slate-400 mt-0.5">
                            <span className="px-1 py-0.2 rounded text-[9px] font-black bg-pink-500/20 text-pink-300">
                              {ep.audio}
                            </span>
                            <span>•</span>
                            <span>{formatBytes(ep.totalBytes)}</span>
                          </div>
                        </div>
                      </div>

                      <div className="flex items-center gap-1.5 shrink-0">
                        <button
                          onClick={() => handlePlay(ep)}
                          className="px-3 py-1.5 rounded-xl bg-violet-600 hover:bg-violet-500 text-white text-xs font-bold flex items-center gap-1 shadow-md shadow-violet-600/30 transition cursor-pointer"
                        >
                          <Play className="w-3.5 h-3.5 fill-white" />
                          <span>Play</span>
                        </button>
                        <button
                          onClick={() => cancelDownload(ep.id)}
                          className="p-1.5 rounded-xl text-slate-500 hover:text-red-400 hover:bg-red-500/10 transition cursor-pointer"
                          title="Delete from device"
                        >
                          <Trash2 className="w-4 h-4" />
                        </button>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
};
