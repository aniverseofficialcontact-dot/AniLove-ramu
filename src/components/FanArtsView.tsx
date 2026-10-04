import React, { useState, useEffect, useCallback } from 'react';
import {
  Palette,
  Search,
  Download,
  Share2,
  X,
  ExternalLink,
  Sparkles,
  ShieldAlert,
  ChevronDown,
  RefreshCw,
  Heart
} from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';
import { fetchDanbooruFanArts, cleanTagTitle, DanbooruPost } from '../services/danbooruService';
import { UserSettings } from '../types';

interface FanArtsViewProps {
  settings: UserSettings;
  onShowToast?: (msg: string) => void;
}

export const FanArtsView: React.FC<FanArtsViewProps> = ({ settings, onShowToast }) => {
  const [posts, setPosts] = useState<DanbooruPost[]>([]);
  const [searchQuery, setSearchQuery] = useState('');
  const [page, setPage] = useState(1);
  const [isLoading, setIsLoading] = useState(true);
  const [isLoadingMore, setIsLoadingMore] = useState(false);
  const [hasMore, setHasMore] = useState(true);
  const [selectedPost, setSelectedPost] = useState<DanbooruPost | null>(null);

  const allowNsfw = Boolean(settings.allowNsfwContent);

  const popularTags = [
    'Gojo_Satoru',
    'Frieren',
    'Nezuko',
    'Sung_Jinwoo',
    'Mikasa_Ackerman',
    'Megumi_Fushiguro',
    'Makima',
    'Anya_Forger',
  ];

  const loadInitialFanArts = useCallback(
    async (query = searchQuery) => {
      setIsLoading(true);
      setPage(1);
      setHasMore(true);
      try {
        const data = await fetchDanbooruFanArts(query, 1, allowNsfw);
        setPosts(data);
      } catch (err) {
        console.error('Error loading Danbooru fan arts:', err);
      } finally {
        setIsLoading(false);
      }
    },
    [allowNsfw, searchQuery]
  );

  useEffect(() => {
    loadInitialFanArts();
  }, [allowNsfw]);

  // Seamless Infinite Scroll Listener
  useEffect(() => {
    const handleScroll = () => {
      if (isLoading || isLoadingMore || !hasMore) return;
      const scrollPosition = window.innerHeight + window.scrollY;
      const threshold = document.documentElement.offsetHeight - 800; // Trigger 800px before bottom
      if (scrollPosition >= threshold) {
        loadMoreFanArts();
      }
    };

    window.addEventListener('scroll', handleScroll, { passive: true });
    return () => window.removeEventListener('scroll', handleScroll);
  }, [isLoading, isLoadingMore, hasMore, page, searchQuery, allowNsfw]);

  const loadMoreFanArts = async () => {
    if (isLoadingMore || !hasMore) return;
    setIsLoadingMore(true);
    const nextPage = page + 1;
    try {
      const moreData = await fetchDanbooruFanArts(searchQuery, nextPage, allowNsfw);
      if (moreData.length === 0) {
        setHasMore(false);
      } else {
        setPosts((prev) => {
          const merged = [...prev, ...moreData];
          const uniqueMap = new Map<number, DanbooruPost>();
          merged.forEach((item) => uniqueMap.set(item.id, item));
          return Array.from(uniqueMap.values());
        });
        setPage(nextPage);
      }
    } catch (err) {
      console.error('Error loading more fan arts:', err);
    } finally {
      setIsLoadingMore(false);
    }
  };

  const handleSearchSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    loadInitialFanArts(searchQuery);
  };

  const handleTagClick = (tag: string) => {
    setSearchQuery(tag);
    loadInitialFanArts(tag);
  };

  const handleDownload = async (post: DanbooruPost) => {
    const url = post.large_file_url || post.file_url;
    if (!url) return;
    if (onShowToast) onShowToast('Downloading Fan Art...');

    try {
      const response = await fetch(url);
      const blob = await response.blob();
      const blobUrl = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = blobUrl;
      a.download = `fanart_${post.id || Date.now()}.${url.split('.').pop()?.split('?')[0] || 'jpg'}`;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      URL.revokeObjectURL(blobUrl);
      if (onShowToast) onShowToast('Fan Art downloaded successfully!');
    } catch (e) {
      window.open(url, '_blank');
    }
  };

  const handleShare = (post: DanbooruPost) => {
    const url = post.large_file_url || post.file_url;
    if (url && navigator.clipboard) {
      navigator.clipboard.writeText(url);
      if (onShowToast) onShowToast('Fan art image link copied to clipboard!');
    }
  };

  return (
    <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-6 space-y-6 select-none">
      {/* Top Header Row */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <div className="flex items-center gap-2.5">
            <Palette className="w-6 h-6 text-pink-500" />
            <h1 className="text-2xl font-black text-white tracking-tight">
              Anime <span className="text-pink-400">Fan Arts</span>
            </h1>
            <span className="px-2.5 py-0.5 rounded-full text-[10px] font-extrabold bg-pink-500/20 text-pink-300 border border-pink-500/30">
              DANBOORU
            </span>
          </div>
          <p className="text-xs text-slate-400 mt-1">
            Explore high-resolution character artwork & illustrations
          </p>
        </div>

        {/* Search Input */}
        <form onSubmit={handleSearchSubmit} className="relative flex-1 sm:w-80 sm:flex-initial">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
          <input
            type="text"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            placeholder="Search character or anime (e.g. Gojo)..."
            className="w-full pl-9 pr-4 py-2 bg-black/40 border border-white/15 rounded-xl text-xs text-white placeholder-slate-400 focus:outline-none focus:border-pink-500 transition"
          />
          {searchQuery && (
            <button
              type="button"
              onClick={() => {
                setSearchQuery('');
                loadInitialFanArts('');
              }}
              className="absolute right-2.5 top-1/2 -translate-y-1/2 text-slate-400 hover:text-white"
            >
              <X className="w-3.5 h-3.5" />
            </button>
          )}
        </form>
      </div>

      {/* Popular Character Quick Tags */}
      <div className="flex items-center gap-2 overflow-x-auto pb-2 custom-scrollbar">
        <span className="text-xs font-bold text-slate-400 shrink-0 mr-1">Quick Search:</span>
        {popularTags.map((tag) => (
          <button
            key={tag}
            onClick={() => handleTagClick(tag)}
            className={`px-3 py-1 rounded-full text-xs font-semibold shrink-0 transition cursor-pointer ${
              searchQuery === tag
                ? 'bg-pink-500 text-white font-bold'
                : 'bg-white/5 hover:bg-white/10 text-slate-300 border border-white/10'
            }`}
          >
            #{tag.replace('_', ' ')}
          </button>
        ))}
      </div>

      {/* Grid Content */}
      {isLoading ? (
        <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 gap-4">
          {[1, 2, 3, 4, 5, 6, 7, 8, 9, 10].map((i) => (
            <div key={i} className="h-64 rounded-2xl bg-white/5 animate-pulse border border-white/10" />
          ))}
        </div>
      ) : posts.length === 0 ? (
        <div className="p-12 text-center rounded-3xl bg-white/5 border border-white/10 max-w-lg mx-auto space-y-3">
          <Palette className="w-12 h-12 text-slate-500 mx-auto" />
          <h3 className="text-lg font-bold text-white">No Fan Arts Found</h3>
          <p className="text-xs text-slate-400">
            No artwork matched your search tag. Try another character or anime name.
          </p>
          <button
            onClick={() => {
              setSearchQuery('');
              loadInitialFanArts('');
            }}
            className="px-4 py-2 rounded-xl bg-pink-500 text-white text-xs font-bold transition cursor-pointer mt-2"
          >
            View Trending Artwork
          </button>
        </div>
      ) : (
        <div className="space-y-6">
          <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 gap-4">
            {posts.map((post) => {
              const imgUrl = post.preview_file_url || post.large_file_url || post.file_url;
              const fallbackUrl = post.file_url || post.large_file_url || post.preview_file_url;
              const title = cleanTagTitle(post.tag_string, post.tag_string_character, post.tag_string_copyright);

              return (
                <div
                  key={post.id}
                  onClick={() => setSelectedPost(post)}
                  className="group relative rounded-2xl bg-slate-900 border border-white/10 hover:border-pink-500/50 overflow-hidden shadow-lg transition-all duration-300 cursor-pointer flex flex-col justify-between"
                >
                  <div className="h-56 sm:h-64 w-full relative overflow-hidden bg-black/40">
                    <img
                      src={imgUrl}
                      alt={title}
                      referrerPolicy="no-referrer"
                      onError={(e) => {
                        const target = e.currentTarget;
                        if (target.src !== fallbackUrl && fallbackUrl) {
                          target.src = fallbackUrl;
                        } else {
                          target.src = 'https://s4.anilist.co/file/anilistcdn/media/anime/cover/medium/bx113415-LHBAeoZDIsnF.jpg';
                        }
                      }}
                      className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-500"
                    />
                    <div className="absolute inset-0 bg-gradient-to-t from-slate-950 via-transparent to-transparent opacity-70" />

                    {/* Score Badge */}
                    <span className="absolute top-2.5 right-2.5 px-2 py-0.5 rounded-full text-[10px] font-extrabold bg-black/60 text-amber-300 border border-white/15 backdrop-blur-md flex items-center gap-1">
                      <Heart className="w-3 h-3 text-amber-400 fill-amber-400" />
                      {post.score}
                    </span>
                  </div>

                  <div className="p-3 bg-slate-950">
                    <h3 className="text-xs font-bold text-white truncate">{title}</h3>
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      )}

      {/* FULL-SCREEN LIGHTBOX MODAL */}
      <AnimatePresence>
        {selectedPost && (
          <div className="fixed inset-0 z-[110] flex items-center justify-center p-3 sm:p-5 overflow-hidden">
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              onClick={() => setSelectedPost(null)}
              className="fixed inset-0 bg-black/90 backdrop-blur-xl"
            />

            <motion.div
              initial={{ opacity: 0, scale: 0.94 }}
              animate={{ opacity: 1, scale: 1 }}
              exit={{ opacity: 0, scale: 0.94 }}
              className="relative w-full max-w-4xl bg-slate-950 border border-white/20 rounded-3xl shadow-2xl overflow-hidden z-10 my-auto flex flex-col max-h-[90vh]"
            >
              <div className="p-4 border-b border-white/10 flex items-center justify-between bg-black/40">
                <span className="text-xs font-bold text-white capitalize">
                  {selectedPost.tag_string_character
                    ? selectedPost.tag_string_character.replace(/_/g, ' ')
                    : 'Danbooru Fan Art'}
                </span>
                <button
                  onClick={() => setSelectedPost(null)}
                  className="w-8 h-8 rounded-full bg-white/10 hover:bg-rose-500 text-white flex items-center justify-center transition cursor-pointer"
                >
                  <X className="w-4 h-4" />
                </button>
              </div>

              <div className="p-4 flex-1 overflow-y-auto custom-scrollbar flex items-center justify-center bg-black/80">
                <img
                  src={selectedPost.large_file_url || selectedPost.file_url}
                  alt="Fan Art Preview"
                  className="max-h-[65vh] w-auto object-contain rounded-xl shadow-2xl"
                />
              </div>

              <div className="p-4 border-t border-white/10 bg-black/60 flex items-center justify-between gap-3">
                <span className="text-xs text-slate-400 font-semibold">
                  Resolution: {selectedPost.image_width} × {selectedPost.image_height}
                </span>

                <div className="flex items-center gap-2">
                  <button
                    onClick={() => handleShare(selectedPost)}
                    className="px-3 py-2 rounded-xl bg-white/10 hover:bg-white/20 text-white text-xs font-bold border border-white/15 flex items-center gap-1.5 transition cursor-pointer"
                  >
                    <Share2 className="w-4 h-4" />
                    <span>Copy Link</span>
                  </button>

                  <button
                    onClick={() => handleDownload(selectedPost)}
                    className="px-4 py-2 rounded-xl bg-pink-500 hover:bg-pink-600 text-white text-xs font-bold shadow-md flex items-center gap-1.5 transition cursor-pointer"
                  >
                    <Download className="w-4 h-4" />
                    <span>Download Image</span>
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
