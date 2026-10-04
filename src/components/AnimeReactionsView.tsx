import React, { useState, useEffect } from 'react';
import {
  Sparkles,
  Download,
  Share2,
  X,
  RefreshCw,
  Heart,
  Smile,
  Copy,
  Check
} from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';
import { fetchAnimeReactions, REACTION_CATEGORIES, ReactionItem } from '../services/reactionsService';

interface AnimeReactionsViewProps {
  onShowToast?: (msg: string) => void;
}

export const AnimeReactionsView: React.FC<AnimeReactionsViewProps> = ({ onShowToast }) => {
  const [activeCategory, setActiveCategory] = useState('hug');
  const [reactions, setReactions] = useState<ReactionItem[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [copiedUrl, setCopiedUrl] = useState<string | null>(null);

  useEffect(() => {
    loadReactions(activeCategory);
  }, [activeCategory]);

  const loadReactions = async (cat: string) => {
    setIsLoading(true);
    try {
      const data = await fetchAnimeReactions(cat);
      setReactions(data);
    } catch (err) {
      console.error('Error loading anime reactions:', err);
    } finally {
      setIsLoading(false);
    }
  };

  const handleCopyLink = (url: string) => {
    if (navigator.clipboard) {
      navigator.clipboard.writeText(url);
      setCopiedUrl(url);
      setTimeout(() => setCopiedUrl(null), 2000);
      if (onShowToast) onShowToast('Reaction GIF link copied to clipboard!');
    }
  };

  const handleDownload = (url: string) => {
    window.open(url, '_blank');
    if (onShowToast) onShowToast('Opening reaction GIF download...');
  };

  return (
    <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-6 space-y-6 select-none">
      {/* Top Header Row */}
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
            Animated reaction GIFs, chibi expressions, & stickers from Nekos.best, Waifu.pics, Catboys, & NekoBot
          </p>
        </div>

        <button
          onClick={() => loadReactions(activeCategory)}
          disabled={isLoading}
          className="p-2.5 rounded-xl bg-white/10 hover:bg-white/20 text-slate-200 hover:text-white border border-white/15 transition active:scale-95 cursor-pointer disabled:opacity-50 shrink-0 self-start sm:self-auto"
          title="Refresh Reactions"
        >
          <RefreshCw className={`w-4 h-4 ${isLoading ? 'animate-spin' : ''}`} />
        </button>
      </div>

      {/* Category Pills Bar */}
      <div className="flex items-center gap-2 overflow-x-auto pb-3 custom-scrollbar border-b border-white/10">
        {REACTION_CATEGORIES.map((cat) => (
          <button
            key={cat.id}
            onClick={() => setActiveCategory(cat.id)}
            className={`flex items-center gap-1.5 px-4 py-2 rounded-xl text-xs font-bold shrink-0 transition cursor-pointer ${
              activeCategory === cat.id
                ? 'bg-gradient-to-r from-pink-500 to-purple-600 text-white shadow-lg shadow-pink-500/20'
                : 'bg-white/5 hover:bg-white/10 text-slate-300 hover:text-white border border-white/10'
            }`}
          >
            <span>{cat.emoji}</span>
            <span>{cat.label}</span>
          </button>
        ))}
      </div>

      {/* Reaction GIFs Grid */}
      {isLoading ? (
        <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 gap-4">
          {[1, 2, 3, 4, 5, 6, 7, 8, 9, 10].map((i) => (
            <div key={i} className="h-56 rounded-2xl bg-white/5 animate-pulse border border-white/10" />
          ))}
        </div>
      ) : reactions.length === 0 ? (
        <div className="p-12 text-center rounded-3xl bg-white/5 border border-white/10 max-w-lg mx-auto space-y-3">
          <Smile className="w-12 h-12 text-slate-500 mx-auto" />
          <h3 className="text-lg font-bold text-white">No Reactions Available</h3>
          <p className="text-xs text-slate-400">
            Could not fetch reaction GIFs for this category. Tap below to reload.
          </p>
          <button
            onClick={() => loadReactions(activeCategory)}
            className="px-4 py-2 rounded-xl bg-pink-500 text-white text-xs font-bold transition cursor-pointer mt-2"
          >
            Reload Reactions
          </button>
        </div>
      ) : (
        <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 gap-4">
          {reactions.map((item) => (
            <div
              key={item.id}
              className="group relative rounded-2xl bg-slate-900 border border-white/10 hover:border-pink-500/50 overflow-hidden shadow-xl transition-all duration-300 flex flex-col justify-between"
            >
              <div className="h-48 w-full relative overflow-hidden bg-black/40">
                <img
                  src={item.url}
                  alt="Reaction GIF"
                  className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-500"
                />
                <div className="absolute inset-0 bg-gradient-to-t from-slate-950 via-transparent to-transparent opacity-70" />

                {/* Source API Badge */}
                <span className="absolute top-2.5 left-2.5 px-2 py-0.5 rounded-full text-[9px] font-extrabold bg-black/60 text-pink-300 border border-white/15 backdrop-blur-md">
                  {item.sourceApi}
                </span>
              </div>

              {/* Action Buttons Row */}
              <div className="p-2.5 bg-slate-950 border-t border-white/5 flex items-center justify-between gap-2">
                <button
                  onClick={() => handleCopyLink(item.url)}
                  className="flex-1 py-1.5 rounded-xl bg-white/10 hover:bg-white/20 text-white text-[11px] font-bold flex items-center justify-center gap-1 transition cursor-pointer"
                >
                  {copiedUrl === item.url ? (
                    <>
                      <Check className="w-3.5 h-3.5 text-emerald-400" />
                      <span className="text-emerald-400">Copied</span>
                    </>
                  ) : (
                    <>
                      <Copy className="w-3.5 h-3.5" />
                      <span>Copy Link</span>
                    </>
                  )}
                </button>

                <button
                  onClick={() => handleDownload(item.url)}
                  className="p-1.5 rounded-xl bg-pink-500/20 hover:bg-pink-500 text-pink-300 hover:text-white transition cursor-pointer"
                  title="Download GIF"
                >
                  <Download className="w-4 h-4" />
                </button>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
};
