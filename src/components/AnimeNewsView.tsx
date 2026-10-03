import React, { useState, useEffect, useRef, useCallback } from 'react';
import {
  Newspaper,
  Search,
  RefreshCw,
  ExternalLink,
  Sparkles,
  Bookmark,
  Calendar,
  User,
  ArrowRight,
  Flame,
  X,
  Tv,
  ChevronDown
} from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';
import { Anime } from '../types';
import {
  fetchGlobalAnimeNews,
  fetchUserWatchlistNews,
  getSafeNewsThumbnail,
  NewsItem
} from '../services/animeNews';

interface AnimeNewsViewProps {
  library: Anime[];
  onOpenDetails: (anime: Anime) => void;
  onShowToast?: (msg: string) => void;
}

export const AnimeNewsView: React.FC<AnimeNewsViewProps> = ({
  library,
  onOpenDetails,
  onShowToast,
}) => {
  const [newsList, setNewsList] = useState<NewsItem[]>([]);
  const [watchlistNews, setWatchlistNews] = useState<NewsItem[]>([]);
  const [activeCategory, setActiveCategory] = useState<'all' | 'watchlist' | 'announcements'>('all');
  const [searchQuery, setSearchQuery] = useState('');
  const [isLoading, setIsLoading] = useState(true);
  const [isLoadingMore, setIsLoadingMore] = useState(false);
  const [page, setPage] = useState(1);
  const [hasMore, setHasMore] = useState(true);
  const [selectedArticle, setSelectedArticle] = useState<NewsItem | null>(null);

  // Load initial news on mount or library update
  useEffect(() => {
    loadInitialNews();
  }, [library]);

  const loadInitialNews = async () => {
    setIsLoading(true);
    setPage(1);
    try {
      const [globalNews, userNews] = await Promise.all([
        fetchGlobalAnimeNews(1),
        fetchUserWatchlistNews(library),
      ]);
      setNewsList(globalNews);
      setWatchlistNews(userNews);
    } catch (err) {
      console.error('Error loading initial anime news:', err);
    } finally {
      setIsLoading(false);
    }
  };

  // Load next page of news for infinite scroll
  const loadMoreNews = useCallback(async () => {
    if (isLoadingMore || !hasMore) return;
    setIsLoadingMore(true);
    const nextPage = page + 1;
    try {
      const moreNews = await fetchGlobalAnimeNews(nextPage);
      if (moreNews.length === 0) {
        setHasMore(false);
      } else {
        setNewsList((prev) => {
          const merged = [...prev, ...moreNews];
          const uniqueMap = new Map<string, NewsItem>();
          merged.forEach((item) => uniqueMap.set(item.title, item));
          return Array.from(uniqueMap.values());
        });
        setPage(nextPage);
      }
    } catch (err) {
      console.error('Error loading more news:', err);
    } finally {
      setIsLoadingMore(false);
    }
  }, [page, isLoadingMore, hasMore]);

  // Infinite Scroll Listener
  useEffect(() => {
    const handleScroll = () => {
      if (
        window.innerHeight + window.scrollY >= document.body.offsetHeight - 500 &&
        !isLoadingMore &&
        !isLoading &&
        hasMore
      ) {
        loadMoreNews();
      }
    };
    window.addEventListener('scroll', handleScroll, { passive: true });
    return () => window.removeEventListener('scroll', handleScroll);
  }, [loadMoreNews, isLoadingMore, isLoading, hasMore]);

  // Combine and deduplicate news
  let displayedNews = [...watchlistNews, ...newsList];
  const uniqueMap = new Map<string, NewsItem>();
  displayedNews.forEach((item) => uniqueMap.set(item.title, item));
  displayedNews = Array.from(uniqueMap.values());

  // Filter by category
  if (activeCategory === 'watchlist') {
    displayedNews = displayedNews.filter((item) => {
      if (item.category === 'Watchlist' || item.source === 'Watchlist News') return true;
      if (item.animeId && library.some((a) => a.id === item.animeId)) return true;
      // Match title with library items
      if (library.length > 0) {
        return library.some((a) => {
          const t1 = a.title?.userPreferred?.toLowerCase() || '';
          const t2 = a.title?.english?.toLowerCase() || '';
          const it = item.title.toLowerCase();
          return (t1 && it.includes(t1)) || (t2 && it.includes(t2));
        });
      }
      return false;
    });

    // Fallback if watchlist items exist in library but filter yielded 0 items
    if (displayedNews.length === 0 && library.length > 0) {
      displayedNews = watchlistNews;
    }
  } else if (activeCategory === 'announcements') {
    displayedNews = displayedNews.filter(
      (item) => item.category === 'Announcement' || item.source === 'Official Announcement'
    );
  }

  // Filter by search query
  if (searchQuery.trim()) {
    const q = searchQuery.toLowerCase().trim();
    displayedNews = displayedNews.filter(
      (item) =>
        item.title.toLowerCase().includes(q) ||
        item.summary.toLowerCase().includes(q) ||
        (item.animeTitle && item.animeTitle.toLowerCase().includes(q))
    );
  }

  const featuredArticle = displayedNews.length > 0 ? displayedNews[0] : null;
  const remainingArticles = displayedNews.length > 1 ? displayedNews.slice(1) : [];

  const handleOpenAnimeFromNews = (newsItem: NewsItem) => {
    if (newsItem.animeId) {
      const matchedAnime = library.find((a) => a.id === newsItem.animeId);
      if (matchedAnime) {
        onOpenDetails(matchedAnime);
      } else {
        onOpenDetails({
          id: newsItem.animeId,
          title: { userPreferred: newsItem.animeTitle || newsItem.title },
          coverImage: newsItem.imageUrl,
          bannerImage: newsItem.imageUrl,
          episodes: 12,
          status: 'RELEASING',
          format: 'TV',
          description: newsItem.summary,
        } as Anime);
      }
    }
  };

  return (
    <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-6 space-y-6 select-none">
      {/* Minimal Top Header Row */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <div className="flex items-center gap-2.5">
            <Newspaper className="w-6 h-6 text-pink-500" />
            <h1 className="text-2xl font-black text-white tracking-tight">
              Anime <span className="text-pink-400">News & Trends</span>
            </h1>
            <span className="px-2.5 py-0.5 rounded-full text-[10px] font-extrabold bg-pink-500/20 text-pink-300 border border-pink-500/30">
              LIVE UPDATES
            </span>
          </div>
          <p className="text-xs text-slate-400 mt-1">
            Industry announcements, trailers, & updates on your watchlist
          </p>
        </div>

        {/* Action Controls: Search & Refresh */}
        <div className="flex items-center gap-2.5 w-full sm:w-auto">
          <div className="relative flex-1 sm:w-64">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
            <input
              type="text"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder="Search news..."
              className="w-full pl-9 pr-4 py-2 bg-black/40 border border-white/15 rounded-xl text-xs text-white placeholder-slate-400 focus:outline-none focus:border-pink-500 transition"
            />
          </div>

          <button
            onClick={loadInitialNews}
            disabled={isLoading}
            className="p-2.5 rounded-xl bg-white/10 hover:bg-white/20 text-slate-200 hover:text-white border border-white/15 transition active:scale-95 cursor-pointer disabled:opacity-50 shrink-0"
            title="Refresh News Feed"
          >
            <RefreshCw className={`w-4 h-4 ${isLoading ? 'animate-spin' : ''}`} />
          </button>
        </div>
      </div>

      {/* Category Filter Tabs (Total number removed from All News button as requested) */}
      <div className="flex items-center gap-2 border-b border-white/10 pb-3 overflow-x-auto custom-scrollbar">
        <button
          onClick={() => setActiveCategory('all')}
          className={`flex items-center gap-2 px-4 py-2 rounded-xl text-xs font-bold transition cursor-pointer shrink-0 ${
            activeCategory === 'all'
              ? 'bg-gradient-to-r from-pink-500 to-purple-600 text-white shadow-md'
              : 'bg-white/5 hover:bg-white/10 text-slate-300 hover:text-white border border-white/10'
          }`}
        >
          <Newspaper className="w-4 h-4" />
          <span>All News</span>
        </button>

        <button
          onClick={() => setActiveCategory('watchlist')}
          className={`flex items-center gap-2 px-4 py-2 rounded-xl text-xs font-bold transition cursor-pointer shrink-0 relative ${
            activeCategory === 'watchlist'
              ? 'bg-gradient-to-r from-pink-500 to-purple-600 text-white shadow-md'
              : 'bg-white/5 hover:bg-white/10 text-slate-300 hover:text-white border border-white/10'
          }`}
        >
          <Bookmark className="w-4 h-4 text-amber-400" />
          <span>My Watchlist News</span>
          {watchlistNews.length > 0 && (
            <span className="px-1.5 py-0.2 rounded-full bg-pink-500 text-white text-[9px] font-black">
              {watchlistNews.length}
            </span>
          )}
        </button>

        <button
          onClick={() => setActiveCategory('announcements')}
          className={`flex items-center gap-2 px-4 py-2 rounded-xl text-xs font-bold transition cursor-pointer shrink-0 ${
            activeCategory === 'announcements'
              ? 'bg-gradient-to-r from-pink-500 to-purple-600 text-white shadow-md'
              : 'bg-white/5 hover:bg-white/10 text-slate-300 hover:text-white border border-white/10'
          }`}
        >
          <Flame className="w-4 h-4 text-pink-400" />
          <span>Announcements & Trailers</span>
        </button>
      </div>

      {/* Loading Skeleton State */}
      {isLoading ? (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          {[1, 2, 3, 4, 5, 6].map((i) => (
            <div key={i} className="h-64 rounded-3xl bg-white/5 animate-pulse border border-white/10" />
          ))}
        </div>
      ) : displayedNews.length === 0 ? (
        <div className="p-12 text-center rounded-3xl bg-white/5 border border-white/10 max-w-lg mx-auto space-y-3">
          <Newspaper className="w-12 h-12 text-slate-500 mx-auto" />
          <h3 className="text-lg font-bold text-white">No Articles Found</h3>
          <p className="text-xs text-slate-400">
            No articles match your current search or filter. Try clearing filters or refreshing.
          </p>
          <button
            onClick={() => {
              setSearchQuery('');
              setActiveCategory('all');
            }}
            className="px-4 py-2 rounded-xl bg-pink-500 hover:bg-pink-600 text-white text-xs font-bold transition cursor-pointer mt-2"
          >
            Clear Filters
          </button>
        </div>
      ) : (
        <div className="space-y-8">
          {/* FEATURED HEADLINE BANNER */}
          {featuredArticle && !searchQuery && (
            <div
              onClick={() => setSelectedArticle(featuredArticle)}
              className="group relative rounded-3xl overflow-hidden border border-white/15 bg-gradient-to-t from-slate-950 via-slate-900 to-transparent shadow-2xl cursor-pointer"
            >
              <div className="h-72 sm:h-96 w-full relative">
                <img
                  src={featuredArticle.imageUrl}
                  alt={featuredArticle.title}
                  onError={(e) => {
                    e.currentTarget.src = getSafeNewsThumbnail('', 0);
                  }}
                  className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-700 filter brightness-90"
                />
                <div className="absolute inset-0 bg-gradient-to-t from-slate-950 via-slate-950/60 to-transparent" />

                {/* Top Badges */}
                <div className="absolute top-4 left-4 right-4 flex items-center justify-between">
                  <span className="px-3 py-1 rounded-full text-xs font-black tracking-wider bg-pink-500 text-white shadow-lg">
                    {featuredArticle.source}
                  </span>

                  <span className="px-3 py-1 rounded-full text-xs font-bold bg-black/60 text-slate-200 backdrop-blur-md border border-white/10">
                    FEATURED STORY
                  </span>
                </div>

                {/* Bottom Overlay Info */}
                <div className="absolute bottom-0 left-0 right-0 p-6 sm:p-8 space-y-3">
                  <div className="flex items-center gap-3 text-xs text-slate-300 font-semibold">
                    <span className="flex items-center gap-1">
                      <User className="w-3.5 h-3.5 text-pink-400" />
                      {featuredArticle.author}
                    </span>
                    <span>•</span>
                    <span className="flex items-center gap-1">
                      <Calendar className="w-3.5 h-3.5 text-slate-400" />
                      {featuredArticle.date}
                    </span>
                  </div>

                  <h2 className="text-xl sm:text-3xl font-black text-white group-hover:text-pink-300 transition-colors leading-tight">
                    {featuredArticle.title}
                  </h2>

                  <p className="text-xs sm:text-sm text-slate-300 line-clamp-2 max-w-3xl">
                    {featuredArticle.summary}
                  </p>

                  <div className="pt-2 flex items-center gap-2 text-xs font-extrabold text-pink-400 group-hover:text-pink-300">
                    <span>Read Full Article</span>
                    <ArrowRight className="w-4 h-4 group-hover:translate-x-1 transition-transform" />
                  </div>
                </div>
              </div>
            </div>
          )}

          {/* MAIN NEWS CARDS GRID */}
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-6">
            {(searchQuery ? displayedNews : remainingArticles).map((article, idx) => {
              const isWatchlist = library.some(
                (a) =>
                  a.id === article.animeId ||
                  (a.title?.userPreferred &&
                    article.title.toLowerCase().includes(a.title.userPreferred.toLowerCase()))
              );

              return (
                <div
                  key={article.id}
                  onClick={() => setSelectedArticle(article)}
                  className="group relative rounded-2xl bg-white/5 hover:bg-white/10 border border-white/10 hover:border-pink-500/40 shadow-lg overflow-hidden flex flex-col justify-between transition-all duration-300 cursor-pointer"
                >
                  <div>
                    {/* Article Thumbnail */}
                    <div className="h-44 w-full relative overflow-hidden bg-slate-900">
                      <img
                        src={article.imageUrl}
                        alt={article.title}
                        onError={(e) => {
                          e.currentTarget.src = getSafeNewsThumbnail('', idx + 1);
                        }}
                        className="w-full h-full object-cover group-hover:scale-110 transition-transform duration-500"
                      />
                      <div className="absolute inset-0 bg-gradient-to-t from-slate-950 via-transparent to-transparent opacity-80" />

                      {/* Source Badge */}
                      <span className="absolute top-3 left-3 px-2.5 py-0.5 rounded-full text-[10px] font-extrabold tracking-wider bg-purple-600/90 text-white shadow-md">
                        {article.source}
                      </span>

                      {/* Watchlist Tag */}
                      {isWatchlist && (
                        <span className="absolute top-3 right-3 px-2 py-0.5 rounded-full bg-amber-500/90 text-slate-950 text-[10px] font-black flex items-center gap-1 shadow-md">
                          <Bookmark className="w-3 h-3 fill-slate-950" />
                          IN LIBRARY
                        </span>
                      )}
                    </div>

                    {/* Content Body */}
                    <div className="p-4 space-y-2">
                      <div className="flex items-center justify-between text-[11px] text-slate-400 font-semibold">
                        <span>{article.author}</span>
                        <span>{article.date}</span>
                      </div>

                      <h3 className="text-sm font-bold text-white group-hover:text-pink-300 transition-colors line-clamp-2 leading-snug">
                        {article.title}
                      </h3>

                      <p className="text-xs text-slate-400 line-clamp-2">
                        {article.summary}
                      </p>
                    </div>
                  </div>

                  {/* Footer Card Row */}
                  <div className="p-4 pt-0 flex items-center justify-between text-xs font-bold text-pink-400 group-hover:text-pink-300 border-t border-white/5 mt-3">
                    <span className="flex items-center gap-1">
                      Read Story
                      <ArrowRight className="w-3.5 h-3.5 group-hover:translate-x-1 transition-transform" />
                    </span>

                    {article.animeId && (
                      <button
                        onClick={(e) => {
                          e.stopPropagation();
                          handleOpenAnimeFromNews(article);
                        }}
                        className="px-2.5 py-1 rounded-lg bg-pink-500/20 hover:bg-pink-500 text-pink-300 hover:text-white text-[10px] font-bold border border-pink-500/30 transition cursor-pointer"
                        title="View Anime Details"
                      >
                        View Anime
                      </button>
                    )}
                  </div>
                </div>
              );
            })}
          </div>

          {/* INFINITE SCROLL / LOAD MORE BUTTON */}
          <div className="pt-6 flex flex-col items-center justify-center gap-3">
            {hasMore ? (
              <button
                onClick={loadMoreNews}
                disabled={isLoadingMore}
                className="px-6 py-3 rounded-2xl bg-white/10 hover:bg-white/20 border border-white/15 text-white font-bold text-xs shadow-lg flex items-center gap-2 transition active:scale-95 cursor-pointer disabled:opacity-50"
              >
                {isLoadingMore ? (
                  <>
                    <RefreshCw className="w-4 h-4 animate-spin text-pink-400" />
                    <span>Fetching More Articles...</span>
                  </>
                ) : (
                  <>
                    <span>Load More News Articles</span>
                    <ChevronDown className="w-4 h-4 text-pink-400" />
                  </>
                )}
              </button>
            ) : (
              <p className="text-xs text-slate-500 font-medium">You have reached the end of the news feed.</p>
            )}
          </div>
        </div>
      )}

      {/* ARTICLE READER MODAL (Refactored for flawless mobile & desktop viewing) */}
      <AnimatePresence>
        {selectedArticle && (
          <div className="fixed inset-0 z-[110] flex items-center justify-center p-3 sm:p-5 overflow-hidden">
            {/* Dark Backdrop */}
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              onClick={() => setSelectedArticle(null)}
              className="fixed inset-0 bg-black/85 backdrop-blur-xl"
            />

            {/* Modal Container */}
            <motion.div
              initial={{ opacity: 0, scale: 0.94, y: 20 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.94, y: 20 }}
              transition={{ type: 'spring', damping: 26, stiffness: 320 }}
              className="relative w-full max-w-2xl bg-slate-950 border border-white/20 rounded-3xl shadow-2xl overflow-hidden z-10 my-auto flex flex-col max-h-[88vh]"
            >
              {/* Top Banner Image with Close Button Header */}
              <div className="h-52 sm:h-64 w-full relative shrink-0 bg-slate-900">
                <img
                  src={selectedArticle.imageUrl}
                  alt={selectedArticle.title}
                  onError={(e) => {
                    e.currentTarget.src = getSafeNewsThumbnail('', 0);
                  }}
                  className="w-full h-full object-cover"
                />
                <div className="absolute inset-0 bg-gradient-to-t from-slate-950 via-slate-950/40 to-transparent" />

                {/* Prominent Close Button */}
                <button
                  onClick={() => setSelectedArticle(null)}
                  className="absolute top-4 right-4 w-9 h-9 rounded-full bg-black/80 hover:bg-rose-500 text-white flex items-center justify-center border border-white/20 shadow-lg transition active:scale-95 cursor-pointer z-20"
                  title="Close Article (Esc)"
                >
                  <X className="w-5 h-5" />
                </button>

                {/* Title Overlay */}
                <div className="absolute bottom-4 left-5 right-5 space-y-1">
                  <span className="px-2.5 py-0.5 rounded-full text-[10px] font-black bg-pink-500 text-white shadow-md inline-block">
                    {selectedArticle.source}
                  </span>
                  <h2 className="text-base sm:text-xl font-black text-white leading-tight line-clamp-2">
                    {selectedArticle.title}
                  </h2>
                </div>
              </div>

              {/* Scrollable Main Body */}
              <div className="p-5 sm:p-6 space-y-4 overflow-y-auto custom-scrollbar flex-1 text-slate-200 text-xs sm:text-sm leading-relaxed">
                <div className="flex items-center justify-between text-xs text-slate-400 border-b border-white/10 pb-3 font-semibold">
                  <span className="flex items-center gap-1.5">
                    <User className="w-3.5 h-3.5 text-pink-400" />
                    {selectedArticle.author}
                  </span>
                  <span className="flex items-center gap-1.5">
                    <Calendar className="w-3.5 h-3.5 text-slate-400" />
                    {selectedArticle.date}
                  </span>
                </div>

                <div className="space-y-3">
                  <p className="text-slate-200 leading-relaxed font-normal sm:text-base">
                    {selectedArticle.summary}
                  </p>
                </div>

                <div className="p-4 rounded-2xl bg-white/5 border border-white/10 space-y-1.5 mt-4">
                  <div className="flex items-center gap-2 text-xs font-bold text-pink-400">
                    <Sparkles className="w-4 h-4" />
                    <span>Official Coverage Story</span>
                  </div>
                  <p className="text-xs text-slate-400">
                    This article contains verified anime industry updates and broadcast announcements.
                  </p>
                </div>
              </div>

              {/* Action Modal Footer */}
              <div className="p-4 border-t border-white/10 bg-black/60 flex flex-wrap items-center justify-between gap-3 shrink-0">
                {selectedArticle.animeId ? (
                  <button
                    onClick={() => {
                      handleOpenAnimeFromNews(selectedArticle);
                      setSelectedArticle(null);
                    }}
                    className="px-4 py-2.5 rounded-xl bg-gradient-to-r from-pink-500 to-purple-600 hover:from-pink-400 hover:to-purple-500 text-white text-xs font-bold shadow-md flex items-center gap-2 transition active:scale-95 cursor-pointer"
                  >
                    <Tv className="w-4 h-4" />
                    <span>View Anime Details</span>
                  </button>
                ) : <div />}

                {selectedArticle.url && selectedArticle.url !== '#' && (
                  <a
                    href={selectedArticle.url}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="px-4 py-2.5 rounded-xl bg-white/10 hover:bg-white/20 text-white text-xs font-bold border border-white/15 flex items-center gap-2 transition active:scale-95 cursor-pointer"
                  >
                    <span>Open Web Source</span>
                    <ExternalLink className="w-4 h-4" />
                  </a>
                )}
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>
    </div>
  );
};
