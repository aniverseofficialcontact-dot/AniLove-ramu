import React, { useState, useEffect, useCallback } from 'react';
import {
  Image,
  Search,
  Download,
  Share2,
  X,
  Smartphone,
  Monitor,
  RefreshCw,
  ChevronDown,
  Sparkles,
  Heart
} from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';
import { fetchAnimeWallpapers, WallpaperPost } from '../services/wallpapersService';
import { UserSettings } from '../types';

interface WallpapersViewProps {
  settings: UserSettings;
  onShowToast?: (msg: string) => void;
}

export const WallpapersView: React.FC<WallpapersViewProps> = ({ settings, onShowToast }) => {
  const [wallpapers, setWallpapers] = useState<WallpaperPost[]>([]);
  const [searchQuery, setSearchQuery] = useState('');
  const [aspectFilter, setAspectFilter] = useState<'all' | 'mobile' | 'desktop'>('all');
  const [page, setPage] = useState(1);
  const [isLoading, setIsLoading] = useState(true);
  const [isLoadingMore, setIsLoadingMore] = useState(false);
  const [hasMore, setHasMore] = useState(true);
  const [selectedWallpaper, setSelectedWallpaper] = useState<WallpaperPost | null>(null);

  const allowNsfw = Boolean(settings.allowNsfwContent);

  const popularAnimeTags = [
    'Solo_Leveling',
    'Jujutsu_Kaisen',
    'Demon_Slayer',
    'Chainsaw_Man',
    'Attack_on_Titan',
    'Bleach',
    'Fate_Stay_Night',
  ];

  const loadInitialWallpapers = useCallback(
    async (query = searchQuery, aspect = aspectFilter) => {
      setIsLoading(true);
      setPage(1);
      setHasMore(true);
      try {
        const data = await fetchAnimeWallpapers(query, 1, allowNsfw, aspect);
        setWallpapers(data);
      } catch (err) {
        console.error('Error loading anime wallpapers:', err);
      } finally {
        setIsLoading(false);
      }
    },
    [allowNsfw, searchQuery, aspectFilter]
  );

  useEffect(() => {
    loadInitialWallpapers();
  }, [allowNsfw, aspectFilter]);

  const loadMoreWallpapers = async () => {
    if (isLoadingMore || !hasMore) return;
    setIsLoadingMore(true);
    const nextPage = page + 1;
    try {
      const moreData = await fetchAnimeWallpapers(searchQuery, nextPage, allowNsfw, aspectFilter);
      if (moreData.length === 0) {
        setHasMore(false);
      } else {
        setWallpapers((prev) => {
          const merged = [...prev, ...moreData];
          const uniqueMap = new Map<string, WallpaperPost>();
          merged.forEach((item) => uniqueMap.set(item.file_url, item));
          return Array.from(uniqueMap.values());
        });
        setPage(nextPage);
      }
    } catch (err) {
      console.error('Error loading more wallpapers:', err);
    } finally {
      setIsLoadingMore(false);
    }
  };

  const handleSearchSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    loadInitialWallpapers(searchQuery, aspectFilter);
  };

  const handleDownload = (wp: WallpaperPost) => {
    if (wp.file_url) {
      window.open(wp.file_url, '_blank');
      if (onShowToast) onShowToast('Opening high-res wallpaper download link...');
    }
  };

  const handleShare = (wp: WallpaperPost) => {
    if (wp.file_url && navigator.clipboard) {
      navigator.clipboard.writeText(wp.file_url);
      if (onShowToast) onShowToast('Wallpaper link copied to clipboard!');
    }
  };

  return (
    <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-6 space-y-6 select-none">
      {/* Top Header Row */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <div className="flex items-center gap-2.5">
            <Image className="w-6 h-6 text-purple-400" />
            <h1 className="text-2xl font-black text-white tracking-tight">
              4K Anime <span className="text-purple-400">Wallpapers</span>
            </h1>
            <span className="px-2.5 py-0.5 rounded-full text-[10px] font-extrabold bg-purple-500/20 text-purple-300 border border-purple-500/30">
              YANDERE & KONACHAN
            </span>
          </div>
          <p className="text-xs text-slate-400 mt-1">
            Ultra High-Definition mobile & desktop backgrounds
          </p>
        </div>

        {/* Search Input */}
        <form onSubmit={handleSearchSubmit} className="relative flex-1 sm:w-80 sm:flex-initial">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
          <input
            type="text"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            placeholder="Search anime wallpaper (e.g. Solo Leveling)..."
            className="w-full pl-9 pr-4 py-2 bg-black/40 border border-white/15 rounded-xl text-xs text-white placeholder-slate-400 focus:outline-none focus:border-purple-500 transition"
          />
          {searchQuery && (
            <button
              type="button"
              onClick={() => {
                setSearchQuery('');
                loadInitialWallpapers('');
              }}
              className="absolute right-2.5 top-1/2 -translate-y-1/2 text-slate-400 hover:text-white"
            >
              <X className="w-3.5 h-3.5" />
            </button>
          )}
        </form>
      </div>

      {/* Aspect Ratio Filter Tabs + Quick Tags */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 border-b border-white/10 pb-3">
        {/* Aspect Ratio Buttons */}
        <div className="flex items-center gap-2">
          <button
            onClick={() => setAspectFilter('all')}
            className={`px-3.5 py-1.5 rounded-xl text-xs font-bold transition cursor-pointer ${
              aspectFilter === 'all'
                ? 'bg-purple-600 text-white shadow-md'
                : 'bg-white/5 hover:bg-white/10 text-slate-300 border border-white/10'
            }`}
          >
            All Sizes
          </button>

          <button
            onClick={() => setAspectFilter('mobile')}
            className={`flex items-center gap-1.5 px-3.5 py-1.5 rounded-xl text-xs font-bold transition cursor-pointer ${
              aspectFilter === 'mobile'
                ? 'bg-purple-600 text-white shadow-md'
                : 'bg-white/5 hover:bg-white/10 text-slate-300 border border-white/10'
            }`}
          >
            <Smartphone className="w-3.5 h-3.5 text-pink-400" />
            <span>Mobile (9:16)</span>
          </button>

          <button
            onClick={() => setAspectFilter('desktop')}
            className={`flex items-center gap-1.5 px-3.5 py-1.5 rounded-xl text-xs font-bold transition cursor-pointer ${
              aspectFilter === 'desktop'
                ? 'bg-purple-600 text-white shadow-md'
                : 'bg-white/5 hover:bg-white/10 text-slate-300 border border-white/10'
            }`}
          >
            <Monitor className="w-3.5 h-3.5 text-sky-400" />
            <span>Desktop (16:9)</span>
          </button>
        </div>

        {/* Quick Anime Tags */}
        <div className="flex items-center gap-2 overflow-x-auto custom-scrollbar">
          {popularAnimeTags.map((tag) => (
            <button
              key={tag}
              onClick={() => {
                setSearchQuery(tag);
                loadInitialWallpapers(tag);
              }}
              className="px-2.5 py-1 rounded-full text-[11px] font-semibold bg-white/5 hover:bg-white/10 text-slate-300 border border-white/10 shrink-0 transition cursor-pointer"
            >
              #{tag.replace('_', ' ')}
            </button>
          ))}
        </div>
      </div>

      {/* Grid Content */}
      {isLoading ? (
        <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 gap-4">
          {[1, 2, 3, 4, 5, 6, 7, 8].map((i) => (
            <div key={i} className="h-72 rounded-2xl bg-white/5 animate-pulse border border-white/10" />
          ))}
        </div>
      ) : wallpapers.length === 0 ? (
        <div className="p-12 text-center rounded-3xl bg-white/5 border border-white/10 max-w-lg mx-auto space-y-3">
          <Image className="w-12 h-12 text-slate-500 mx-auto" />
          <h3 className="text-lg font-bold text-white">No Wallpapers Found</h3>
          <p className="text-xs text-slate-400">
            No 4K wallpapers matched your query. Try another search or size filter.
          </p>
          <button
            onClick={() => {
              setSearchQuery('');
              setAspectFilter('all');
              loadInitialWallpapers('');
            }}
            className="px-4 py-2 rounded-xl bg-purple-600 text-white text-xs font-bold transition cursor-pointer mt-2"
          >
            View Popular Wallpapers
          </button>
        </div>
      ) : (
        <div className="space-y-6">
          <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 gap-4">
            {wallpapers.map((wp) => (
              <div
                key={wp.id}
                onClick={() => setSelectedWallpaper(wp)}
                className="group relative rounded-2xl bg-slate-900 border border-white/10 hover:border-purple-500/50 overflow-hidden shadow-xl transition-all duration-300 cursor-pointer"
              >
                <div className="h-64 sm:h-80 w-full relative overflow-hidden bg-black/50">
                  <img
                    src={wp.preview_url || wp.sample_url || wp.file_url}
                    alt="Wallpaper"
                    className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-500"
                  />
                  <div className="absolute inset-0 bg-gradient-to-t from-slate-950 via-transparent to-transparent opacity-80" />

                  {/* Resolution Badge */}
                  <span className="absolute bottom-3 left-3 px-2 py-0.5 rounded-md text-[9px] font-black bg-black/70 text-purple-300 border border-white/15 backdrop-blur-md">
                    {wp.width}×{wp.height}
                  </span>

                  {/* Rating Badge */}
                  <span className="absolute top-3 right-3 px-2 py-0.5 rounded-full text-[9px] font-extrabold bg-purple-600 text-white shadow-md uppercase">
                    {wp.source_site}
                  </span>
                </div>
              </div>
            ))}
          </div>

          {/* Load More Button */}
          {hasMore && (
            <div className="pt-4 flex justify-center">
              <button
                onClick={loadMoreWallpapers}
                disabled={isLoadingMore}
                className="px-6 py-3 rounded-2xl bg-white/10 hover:bg-white/20 text-white text-xs font-bold border border-white/15 shadow-lg flex items-center gap-2 transition active:scale-95 cursor-pointer disabled:opacity-50"
              >
                {isLoadingMore ? (
                  <>
                    <RefreshCw className="w-4 h-4 animate-spin text-purple-400" />
                    <span>Loading More 4K Wallpapers...</span>
                  </>
                ) : (
                  <>
                    <span>Load More Wallpapers</span>
                    <ChevronDown className="w-4 h-4 text-purple-400" />
                  </>
                )}
              </button>
            </div>
          )}
        </div>
      )}

      {/* LIGHTBOX MODAL */}
      <AnimatePresence>
        {selectedWallpaper && (
          <div className="fixed inset-0 z-[110] flex items-center justify-center p-3 sm:p-5 overflow-hidden">
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              onClick={() => setSelectedWallpaper(null)}
              className="fixed inset-0 bg-black/90 backdrop-blur-xl"
            />

            <motion.div
              initial={{ opacity: 0, scale: 0.94 }}
              animate={{ opacity: 1, scale: 1 }}
              exit={{ opacity: 0, scale: 0.94 }}
              className="relative w-full max-w-4xl bg-slate-950 border border-white/20 rounded-3xl shadow-2xl overflow-hidden z-10 my-auto flex flex-col max-h-[90vh]"
            >
              <div className="p-4 border-b border-white/10 flex items-center justify-between bg-black/40">
                <span className="text-xs font-bold text-white uppercase tracking-wider">
                  4K Ultra HD Wallpaper • {selectedWallpaper.source_site}
                </span>
                <button
                  onClick={() => setSelectedWallpaper(null)}
                  className="w-8 h-8 rounded-full bg-white/10 hover:bg-rose-500 text-white flex items-center justify-center transition cursor-pointer"
                >
                  <X className="w-4 h-4" />
                </button>
              </div>

              <div className="p-4 flex-1 overflow-y-auto custom-scrollbar flex items-center justify-center bg-black/80">
                <img
                  src={selectedWallpaper.file_url}
                  alt="Full Wallpaper"
                  className="max-h-[65vh] w-auto object-contain rounded-xl shadow-2xl"
                />
              </div>

              <div className="p-4 border-t border-white/10 bg-black/60 flex items-center justify-between gap-3">
                <span className="text-xs text-slate-400 font-semibold">
                  Resolution: {selectedWallpaper.width} × {selectedWallpaper.height}
                </span>

                <div className="flex items-center gap-2">
                  <button
                    onClick={() => handleShare(selectedWallpaper)}
                    className="px-3 py-2 rounded-xl bg-white/10 hover:bg-white/20 text-white text-xs font-bold border border-white/15 flex items-center gap-1.5 transition cursor-pointer"
                  >
                    <Share2 className="w-4 h-4" />
                    <span>Copy Link</span>
                  </button>

                  <button
                    onClick={() => handleDownload(selectedWallpaper)}
                    className="px-4 py-2 rounded-xl bg-purple-600 hover:bg-purple-500 text-white text-xs font-bold shadow-md flex items-center gap-1.5 transition cursor-pointer"
                  >
                    <Download className="w-4 h-4" />
                    <span>Download 4K Image</span>
                  </button>
                </div>
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>
    </div>
  );
};
