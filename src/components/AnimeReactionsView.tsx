import React, { useState, useEffect, useCallback, useRef } from 'react';
import {
  Sparkles,
  Heart,
  Smile,
  Copy,
  Check,
  Share2
} from 'lucide-react';
import { fetchAnimeReactions, REACTION_CATEGORIES, ReactionItem } from '../services/reactionsService';

interface AnimeReactionsViewProps {
  onShowToast?: (msg: string) => void;
}

const FAVORITES_STORAGE_KEY = 'anilove_favorite_gifs_v1';

export const AnimeReactionsView: React.FC<AnimeReactionsViewProps> = ({ onShowToast }) => {
  const [activeCategory, setActiveCategory] = useState('hug');
  const [reactions, setReactions] = useState<ReactionItem[]>([]);
  const [favorites, setFavorites] = useState<ReactionItem[]>([]);
  const [page, setPage] = useState(1);
  const [isLoading, setIsLoading] = useState(true);
  const [isFetchingMore, setIsFetchingMore] = useState(false);
  const [hasMore, setHasMore] = useState(true);
  const [copiedUrl, setCopiedUrl] = useState<string | null>(null);

  const observerTarget = useRef<HTMLDivElement | null>(null);

  // Load saved favorites from LocalStorage
  useEffect(() => {
    try {
      const saved = localStorage.getItem(FAVORITES_STORAGE_KEY);
      if (saved) {
        setFavorites(JSON.parse(saved));
      }
    } catch (e) {
      console.error('Error reading saved favorites:', e);
    }
  }, []);

  // Save favorites to LocalStorage
  const saveFavoritesToStorage = (updated: ReactionItem[]) => {
    setFavorites(updated);
    try {
      localStorage.setItem(FAVORITES_STORAGE_KEY, JSON.stringify(updated));
    } catch (e) {
      console.error('Error saving favorites:', e);
    }
  };

  const isFavorited = (url: string) => favorites.some((item) => item.url === url);

  const toggleFavorite = (item: ReactionItem, e: React.MouseEvent) => {
    e.stopPropagation();
    if (isFavorited(item.url)) {
      const updated = favorites.filter((f) => f.url !== item.url);
      saveFavoritesToStorage(updated);
      if (onShowToast) onShowToast('Removed from Favorites ❤️');
    } else {
      const updated = [item, ...favorites];
      saveFavoritesToStorage(updated);
      if (onShowToast) onShowToast('Saved to Favorites! ❤️');
    }
  };

  // Initial Load per category
  const loadInitialReactions = useCallback(async (category: string) => {
    setIsLoading(true);
    setPage(1);
    setHasMore(true);

    if (category === 'favorites') {
      setReactions(favorites);
      setIsLoading(false);
      return;
    }

    try {
      const data = await fetchAnimeReactions(category, 1);
      setReactions(data);
      if (data.length === 0) setHasMore(false);
    } catch (err) {
      console.error('Error loading initial reactions:', err);
    } finally {
      setIsLoading(false);
    }
  }, [favorites]);

  useEffect(() => {
    loadInitialReactions(activeCategory);
  }, [activeCategory]);

  // Seamless Infinite Scrolling via IntersectionObserver (Silent, No Loading Text)
  useEffect(() => {
    if (!observerTarget.current || activeCategory === 'favorites') return;

    const observer = new IntersectionObserver(
      (entries) => {
        if (entries[0].isIntersecting && !isLoading && !isFetchingMore && hasMore) {
          loadMoreReactions();
        }
      },
      { threshold: 0.1, rootMargin: '400px' }
    );

    const currentTarget = observerTarget.current;
    observer.observe(currentTarget);

    return () => {
      if (currentTarget) observer.unobserve(currentTarget);
    };
  }, [isLoading, isFetchingMore, hasMore, page, activeCategory]);

  const loadMoreReactions = async () => {
    if (isFetchingMore || !hasMore || activeCategory === 'favorites') return;
    setIsFetchingMore(true);
    const nextPage = page + 1;
    try {
      const moreData = await fetchAnimeReactions(activeCategory, nextPage);
      if (moreData.length === 0) {
        setHasMore(false);
      } else {
        setReactions((prev) => {
          const merged = [...prev, ...moreData];
          const uniqueMap = new Map<string, ReactionItem>();
          merged.forEach((item) => uniqueMap.set(item.url, item));
          return Array.from(uniqueMap.values());
        });
        setPage(nextPage);
      }
    } catch (err) {
      console.error('Error loading more reactions:', err);
    } finally {
      setIsFetchingMore(false);
    }
  };

  // Copy GIF image / share for Keyboard & Chat app pasting
  const handleCopyGif = async (url: string) => {
    setCopiedUrl(url);
    setTimeout(() => setCopiedUrl(null), 2500);

    try {
      const response = await fetch(url);
      const blob = await response.blob();

      // Native Web Share API if supported
      if (navigator.share && navigator.canShare) {
        const file = new File([blob], 'reaction.gif', { type: 'image/gif' });
        if (navigator.canShare({ files: [file] })) {
          await navigator.share({
            files: [file],
            title: 'AniLove GIF',
          });
          if (onShowToast) onShowToast('Shared GIF to app/keyboard!');
          return;
        }
      }

      // Copy Blob to Clipboard
      if (typeof ClipboardItem !== 'undefined' && navigator.clipboard && navigator.clipboard.write) {
        try {
          await navigator.clipboard.write([
            new ClipboardItem({ [blob.type || 'image/gif']: blob })
          ]);
          if (onShowToast) onShowToast('GIF copied! Paste directly into Gboard, WhatsApp, or chat apps!');
          return;
        } catch (clipErr) {
          console.warn('ClipboardItem blob copy error:', clipErr);
        }
      }

      // Fallback: Copy URL
      if (navigator.clipboard) {
        await navigator.clipboard.writeText(url);
        if (onShowToast) onShowToast('GIF link copied! Ready to paste into keyboard or chat.');
      }
    } catch (e) {
      console.error('Error copying GIF:', e);
      if (navigator.clipboard) {
        navigator.clipboard.writeText(url);
        if (onShowToast) onShowToast('GIF link copied to clipboard!');
      }
    }
  };

  return (
    <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-6 space-y-6 select-none">
      {/* Top Header Row (No refresh button, clean title & description) */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <div className="flex items-center gap-2.5">
            <Smile className="w-6 h-6 text-pink-500" />
            <h1 className="text-2xl font-black text-white tracking-tight">
              Anime <span className="text-pink-400">Reactions & Express</span>
            </h1>
            <span className="px-2.5 py-0.5 rounded-full text-[10px] font-extrabold bg-pink-500/20 text-pink-300 border border-pink-500/30">
              GIFS & STICKERS
            </span>
          </div>
          <p className="text-xs text-slate-400 mt-1">
            Animated reaction GIFs, chibi expressions, & stickers for instant keyboard sharing and saving
          </p>
        </div>
      </div>

      {/* Category Pills Bar */}
      <div className="flex items-center gap-2 overflow-x-auto pb-3 custom-scrollbar border-b border-white/10">
        {REACTION_CATEGORIES.map((cat) => {
          const isActive = activeCategory === cat.id;
          return (
            <button
              key={cat.id}
              onClick={() => setActiveCategory(cat.id)}
              className={`flex items-center gap-1.5 px-4 py-2 rounded-xl text-xs font-bold shrink-0 transition cursor-pointer ${
                isActive
                  ? 'bg-gradient-to-r from-pink-500 to-purple-600 text-white shadow-lg shadow-pink-500/20'
                  : 'bg-white/5 hover:bg-white/10 text-slate-300 hover:text-white border border-white/10'
              }`}
            >
              <span>{cat.emoji}</span>
              <span>{cat.label}</span>
              {cat.id === 'favorites' && favorites.length > 0 && (
                <span className="ml-1 px-1.5 py-0.2 rounded-full text-[9px] bg-pink-500/40 text-white">
                  {favorites.length}
                </span>
              )}
            </button>
          );
        })}
      </div>

      {/* Reaction GIFs Grid */}
      {isLoading ? (
        <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 gap-4">
          {[1, 2, 3, 4, 5, 6, 7, 8, 9, 10].map((i) => (
            <div key={i} className="h-56 rounded-2xl bg-white/5 animate-pulse border border-white/10" />
          ))}
        </div>
      ) : activeCategory === 'favorites' && favorites.length === 0 ? (
        <div className="p-12 text-center rounded-3xl bg-white/5 border border-white/10 max-w-lg mx-auto space-y-3">
          <Heart className="w-12 h-12 text-pink-500/50 mx-auto" />
          <h3 className="text-lg font-bold text-white">No Favorite GIFs Saved Yet</h3>
          <p className="text-xs text-slate-400">
            Tap the ❤️ Heart icon on any GIF in Express to save it here for quick access!
          </p>
        </div>
      ) : reactions.length === 0 ? (
        <div className="p-12 text-center rounded-3xl bg-white/5 border border-white/10 max-w-lg mx-auto space-y-3">
          <Smile className="w-12 h-12 text-slate-500 mx-auto" />
          <h3 className="text-lg font-bold text-white">No Reactions Available</h3>
          <p className="text-xs text-slate-400">
            Select another category to explore GIFs.
          </p>
        </div>
      ) : (
        <>
          <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 gap-4">
            {reactions.map((item) => {
              const fav = isFavorited(item.url);
              return (
                <div
                  key={item.id}
                  className="group relative rounded-2xl bg-slate-900 border border-white/10 hover:border-pink-500/50 overflow-hidden shadow-xl transition-all duration-300 flex flex-col justify-between"
                >
                  <div className="h-48 w-full relative overflow-hidden bg-black/40">
                    <img
                      src={item.url}
                      alt="Reaction GIF"
                      loading="lazy"
                      className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-500"
                    />
                    <div className="absolute inset-0 bg-gradient-to-t from-slate-950 via-transparent to-transparent opacity-70" />

                    {/* Favorite Heart Toggle Button */}
                    <button
                      onClick={(e) => toggleFavorite(item, e)}
                      className={`absolute top-2.5 right-2.5 p-2 rounded-full backdrop-blur-md border transition cursor-pointer active:scale-90 ${
                        fav
                          ? 'bg-pink-500 text-white border-pink-400 shadow-md shadow-pink-500/50'
                          : 'bg-black/60 hover:bg-black/80 text-white/70 hover:text-white border-white/20'
                      }`}
                      title={fav ? 'Remove from Favorites' : 'Save to Favorites'}
                    >
                      <Heart className={`w-4 h-4 ${fav ? 'fill-white' : ''}`} />
                    </button>
                  </div>

                  {/* Single Action Button: Copy GIF for Keyboard / Share */}
                  <div className="p-2.5 bg-slate-950 border-t border-white/5 flex items-center justify-between gap-2">
                    <button
                      onClick={() => handleCopyGif(item.url)}
                      className="w-full py-2 rounded-xl bg-pink-500/20 hover:bg-pink-500 text-pink-300 hover:text-white text-xs font-bold flex items-center justify-center gap-1.5 transition cursor-pointer active:scale-95"
                      title="Copy or share GIF for Keyboard"
                    >
                      {copiedUrl === item.url ? (
                        <>
                          <Check className="w-3.5 h-3.5 text-emerald-400" />
                          <span className="text-emerald-400">Copied!</span>
                        </>
                      ) : (
                        <>
                          <Copy className="w-3.5 h-3.5" />
                          <span>Copy GIF</span>
                        </>
                      )}
                    </button>
                  </div>
                </div>
              );
            })}
          </div>

          {/* Silent Bottom Sentinel for Seamless Infinite Scrolling */}
          {activeCategory !== 'favorites' && (
            <div ref={observerTarget} className="h-12 w-full my-4" />
          )}
        </>
      )}
    </div>
  );
};
