import React, { useState, useEffect } from 'react';
import {
  Bookmark,
  Play,
  Send,
  Trash2,
  ExternalLink,
  ChevronLeft,
  Search,
  Check,
  History,
  Sparkles,
  RotateCcw,
} from 'lucide-react';
import { AnimeReel } from '../types';
import {
  getStoredSavedReels,
  removeSavedReel,
  getStoredReelsHistory,
  clearReelsHistory,
} from '../services/reelsService';

interface SavedReelsGalleryProps {
  onOpenReel: (reel: AnimeReel) => void;
  onClose?: () => void;
}

const ReelCoverMedia: React.FC<{ reel: AnimeReel }> = ({ reel }) => {
  const [thumbStage, setThumbStage] = useState<number>(0);
  const [imgLoaded, setImgLoaded] = useState(false);
  const [videoFrameReady, setVideoFrameReady] = useState(false);
  const videoRef = React.useRef<HTMLVideoElement>(null);

  const thumbnailSources = [
    reel.thumbnailUrl || `/api/reels/thumbnail/${reel.id}`,
    `https://lh3.googleusercontent.com/d/${reel.id}=w600-h900`,
    `https://drive.google.com/thumbnail?id=${reel.id}&sz=w600`,
    `https://lh3.googleusercontent.com/d/${reel.id}`
  ];

  const currentThumbUrl = thumbnailSources[thumbStage];

  const handleImageError = () => {
    if (thumbStage < thumbnailSources.length - 1) {
      setThumbStage(prev => prev + 1);
    }
  };

  const handleVideoMetadata = (e: React.SyntheticEvent<HTMLVideoElement>) => {
    const video = e.currentTarget;
    try {
      const targetTime = video.duration && video.duration > 3 ? 1.5 : 0.8;
      video.currentTime = targetTime;
    } catch {
      // Ignore
    }
  };

  const handleVideoSeeked = () => {
    setVideoFrameReady(true);
  };

  return (
    <div className="absolute inset-0 w-full h-full overflow-hidden bg-[#0e1220]">
      <div className="absolute inset-0 bg-gradient-to-tr from-pink-950/40 via-purple-950/30 to-indigo-950/40 flex items-center justify-center pointer-events-none">
        <div className="w-12 h-12 rounded-full bg-pink-500/10 border border-pink-500/20 flex items-center justify-center text-pink-400/50">
          <Play className="w-5 h-5 ml-0.5" />
        </div>
      </div>

      <video
        ref={videoRef}
        src={reel.url}
        preload="metadata"
        muted
        playsInline
        onLoadedMetadata={handleVideoMetadata}
        onSeeked={handleVideoSeeked}
        onLoadedData={() => setVideoFrameReady(true)}
        className={`absolute inset-0 w-full h-full object-cover group-hover:scale-105 transition-transform duration-500 pointer-events-none ${
          videoFrameReady ? 'opacity-100' : 'opacity-0'
        }`}
      />

      {thumbStage < thumbnailSources.length && (
        <img
          key={currentThumbUrl}
          src={currentThumbUrl}
          alt={reel.cleanTitle || reel.title}
          loading="lazy"
          referrerPolicy="no-referrer"
          onLoad={() => setImgLoaded(true)}
          onError={handleImageError}
          className={`absolute inset-0 w-full h-full object-cover group-hover:scale-105 transition-all duration-500 ${
            imgLoaded ? 'opacity-100' : 'opacity-0'
          }`}
        />
      )}
    </div>
  );
};

export const SavedReelsGallery: React.FC<SavedReelsGalleryProps> = ({
  onOpenReel,
  onClose
}) => {
  const [activeTab, setActiveTab] = useState<'saved' | 'history'>('saved');
  const [reels, setReels] = useState<AnimeReel[]>([]);
  const [searchQuery, setSearchQuery] = useState('');
  const [copiedId, setCopiedId] = useState<string | null>(null);

  const loadReels = () => {
    if (activeTab === 'saved') {
      setReels(getStoredSavedReels());
    } else {
      setReels(getStoredReelsHistory());
    }
  };

  useEffect(() => {
    loadReels();
    window.addEventListener('anilove-saved-reels-updated', loadReels);
    window.addEventListener('anilove-reels-history-updated', loadReels);
    return () => {
      window.removeEventListener('anilove-saved-reels-updated', loadReels);
      window.removeEventListener('anilove-reels-history-updated', loadReels);
    };
  }, [activeTab]);

  const handleRemove = (e: React.MouseEvent, reelId: string) => {
    e.stopPropagation();
    if (activeTab === 'saved') {
      const updated = removeSavedReel(reelId);
      setReels(updated);
    }
  };

  const handleClearHistory = () => {
    if (confirm('Clear last 50 watched reels history?')) {
      clearReelsHistory();
      setReels([]);
    }
  };

  const handleShare = async (e: React.MouseEvent, reel: AnimeReel) => {
    e.stopPropagation();
    const shareUrl = `${window.location.origin}${window.location.pathname}?tab=reels&reel=${encodeURIComponent(reel.id)}`;
    const title = reel.cleanTitle || reel.title || 'Anime Edit Reel';
    const text = `Check out this anime reel on AniLove: ${title}`;

    if (navigator.share) {
      try {
        await navigator.share({
          title,
          text,
          url: shareUrl
        });
        return;
      } catch (err: any) {
        if (err.name === 'AbortError') return;
      }
    }
    if (navigator.clipboard) {
      navigator.clipboard.writeText(shareUrl);
      setCopiedId(reel.id);
      setTimeout(() => setCopiedId(null), 2000);
    }
  };

  const filteredReels = reels.filter(r => {
    const title = (r.cleanTitle || r.title || '').toLowerCase();
    const q = searchQuery.toLowerCase().trim();
    return !q || title.includes(q);
  });

  return (
    <div className="space-y-6 animate-in fade-in duration-300">
      {/* Top Bar Header */}
      <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4 p-4 rounded-2xl bg-[#121626] border border-slate-800 shadow-xl">
        <div className="flex items-center gap-3">
          {onClose && (
            <button
              onClick={onClose}
              className="p-2 rounded-xl bg-slate-900 hover:bg-slate-800 text-slate-300 hover:text-white border border-slate-800 transition cursor-pointer"
              title="Back to My Library"
            >
              <ChevronLeft className="w-5 h-5" />
            </button>
          )}
          <div>
            <div className="inline-flex items-center gap-2 px-2.5 py-0.5 rounded-full bg-pink-500/20 text-pink-300 text-xs font-semibold border border-pink-500/30 mb-1">
              <Sparkles className="w-3.5 h-3.5 text-pink-400" />
              <span>Anime Reels Gallery</span>
            </div>
            <h3 className="text-xl sm:text-2xl font-black text-white">
              {activeTab === 'saved' ? `Saved Reels (${reels.length})` : `Watch History (${reels.length}/50)`}
            </h3>
          </div>
        </div>

        {/* Tab Switcher & Search Bar */}
        <div className="flex flex-col sm:flex-row items-stretch sm:items-center gap-3 w-full sm:w-auto">
          <div className="flex items-center gap-1.5 p-1 rounded-xl bg-slate-900 border border-slate-800">
            <button
              onClick={() => setActiveTab('saved')}
              className={`px-3.5 py-1.5 rounded-lg text-xs font-bold transition flex items-center gap-1.5 cursor-pointer ${
                activeTab === 'saved'
                  ? 'bg-pink-600 text-white shadow-md shadow-pink-600/30'
                  : 'text-slate-400 hover:text-white'
              }`}
            >
              <Bookmark className="w-3.5 h-3.5" />
              <span>Saved</span>
            </button>
            <button
              onClick={() => setActiveTab('history')}
              className={`px-3.5 py-1.5 rounded-lg text-xs font-bold transition flex items-center gap-1.5 cursor-pointer ${
                activeTab === 'history'
                  ? 'bg-pink-600 text-white shadow-md shadow-pink-600/30'
                  : 'text-slate-400 hover:text-white'
              }`}
            >
              <History className="w-3.5 h-3.5" />
              <span>Last 50 Seen</span>
            </button>
          </div>

          {activeTab === 'history' && reels.length > 0 && (
            <button
              onClick={handleClearHistory}
              className="px-3 py-1.5 rounded-xl bg-red-500/10 hover:bg-red-500/20 text-red-400 border border-red-500/20 text-xs font-bold transition cursor-pointer flex items-center gap-1"
              title="Clear watch history"
            >
              <RotateCcw className="w-3.5 h-3.5" />
              <span>Clear</span>
            </button>
          )}

          {reels.length > 0 && (
            <div className="relative w-full sm:w-48">
              <Search className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
              <input
                type="text"
                value={searchQuery}
                onChange={e => setSearchQuery(e.target.value)}
                placeholder="Search reels..."
                className="w-full pl-9 pr-3 py-1.5 rounded-xl bg-slate-900 border border-slate-800 text-xs text-white placeholder-slate-500 focus:outline-none focus:border-pink-500"
              />
            </div>
          )}
        </div>
      </div>

      {/* Grid of Reels */}
      {filteredReels.length === 0 ? (
        <div className="py-20 text-center rounded-3xl bg-slate-900/40 border border-slate-800/80 p-8 space-y-4">
          <div className="w-16 h-16 rounded-full bg-pink-500/10 text-pink-400 flex items-center justify-center mx-auto border border-pink-500/20">
            {activeTab === 'saved' ? <Bookmark className="w-8 h-8" /> : <History className="w-8 h-8" />}
          </div>
          <div className="space-y-1">
            <h4 className="text-lg font-bold text-white">
              {activeTab === 'saved' ? 'No Saved Reels Yet' : 'No Watch History Yet'}
            </h4>
            <p className="text-xs sm:text-sm text-slate-400 max-w-sm mx-auto">
              {activeTab === 'saved'
                ? 'Double-tap any anime edit reel or tap Bookmark to save clips here.'
                : 'Watch reels in the Reels tab to build your last 50 seen history.'}
            </p>
          </div>
        </div>
      ) : (
        <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 gap-3 sm:gap-4">
          {filteredReels.map((reel) => (
            <div
              key={reel.id}
              onClick={() => onOpenReel(reel)}
              className="group relative aspect-[9/16] rounded-2xl overflow-hidden bg-slate-950 border border-slate-800/80 hover:border-pink-500/50 transition-all duration-300 shadow-lg hover:shadow-pink-500/20 cursor-pointer"
            >
              <ReelCoverMedia reel={reel} />

              <div className="absolute top-2.5 right-2.5 z-10 w-7 h-7 rounded-full bg-black/60 backdrop-blur-md border border-white/20 flex items-center justify-center text-white">
                <Play className="w-3.5 h-3.5 fill-white ml-0.5" />
              </div>

              <div className="absolute inset-0 bg-gradient-to-t from-black/90 via-black/20 to-black/30 opacity-80 group-hover:opacity-95 transition-opacity" />

              <div className="absolute inset-x-0 bottom-0 p-3 flex flex-col justify-end space-y-2 z-10">
                <p className="text-xs font-bold text-white line-clamp-2 leading-tight drop-shadow">
                  {reel.cleanTitle || reel.title}
                </p>

                <div className="flex items-center justify-between pt-1 opacity-90 sm:opacity-0 group-hover:opacity-100 transition-opacity">
                  <div className="flex items-center gap-1.5">
                    <button
                      onClick={(e) => handleShare(e, reel)}
                      title="Share via Apps on Device"
                      className="p-1.5 rounded-lg bg-black/70 hover:bg-pink-600 text-white border border-white/20 transition cursor-pointer"
                    >
                      {copiedId === reel.id ? (
                        <Check className="w-3.5 h-3.5 text-emerald-400" />
                      ) : (
                        <Send className="w-3.5 h-3.5" />
                      )}
                    </button>
                    {activeTab === 'saved' && (
                      <button
                        onClick={(e) => handleRemove(e, reel.id)}
                        title="Remove from Saved"
                        className="p-1.5 rounded-lg bg-black/70 hover:bg-rose-600 text-rose-300 hover:text-white border border-white/20 transition cursor-pointer"
                      >
                        <Trash2 className="w-3.5 h-3.5" />
                      </button>
                    )}
                  </div>

                  <div className="flex items-center gap-1 text-[11px] font-bold text-pink-400">
                    <span>Watch</span>
                    <ExternalLink className="w-3 h-3" />
                  </div>
                </div>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
};
