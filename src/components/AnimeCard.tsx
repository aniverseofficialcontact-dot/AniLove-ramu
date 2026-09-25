import React, { useState, useRef, useEffect } from 'react';
import { Plus, Minus, Check, Star, Edit3 } from 'lucide-react';
import confetti from 'canvas-confetti';
import { Anime, UserMediaListItem, MediaListStatus } from '../types';

interface AnimeCardProps {
  anime: Anime;
  userItem?: UserMediaListItem;
  showEpisodeStepper?: boolean;
  onOpenDetails: (anime: Anime) => void;
  onPlayStream: (anime: Anime) => void;
  onUpdateStatus: (anime: Anime, status: MediaListStatus) => void;
  onUpdateProgress: (anime: Anime, newProgress: number) => void;
  onSelectGenre?: (genre: string) => void;
  onSelectStudio?: (studio: string) => void;
  onInspect3DCard?: (anime: Anime) => void;
}

const AnimeCardComponent: React.FC<AnimeCardProps> = ({
  anime,
  userItem,
  showEpisodeStepper = false,
  onOpenDetails,
  onPlayStream,
  onUpdateStatus,
  onUpdateProgress,
  onInspect3DCard,
}) => {
  const [isEditingProgress, setIsEditingProgress] = useState(false);
  const [inlineProgressInput, setInlineProgressInput] = useState<string>('0');
  const inlineInputRef = useRef<HTMLInputElement>(null);

  const currentProgress = userItem?.progress ?? 0;
  const currentStatus = userItem?.status;

  useEffect(() => {
    setInlineProgressInput(String(currentProgress));
  }, [currentProgress]);

  const title = anime.title?.english || anime.title?.romaji || anime.title?.userPreferred || 'Unknown Title';
  const coverUrl = anime.coverImage?.extraLarge || anime.coverImage?.large || anime.coverImage?.medium || undefined;
  const score = anime.averageScore ? (anime.averageScore / 10).toFixed(1) : null;
  const episodesTotal = typeof anime.episodes === 'number' ? anime.episodes : '?';

  const handleCardClick = (e: React.MouseEvent) => {
    if (isEditingProgress) return;
    if (onInspect3DCard) {
      onInspect3DCard(anime);
    } else {
      onOpenDetails(anime);
    }
  };

  const handleStepProgress = (e: React.MouseEvent, delta: number) => {
    e.stopPropagation();
    e.preventDefault();
    const max = typeof anime.episodes === 'number' && anime.episodes > 0 ? anime.episodes : 9999;
    const nextVal = Math.max(0, Math.min(max, currentProgress + delta));
    
    if (nextVal !== currentProgress) {
      if (typeof anime.episodes === 'number' && nextVal >= anime.episodes) {
        confetti({ particleCount: 50, spread: 60, origin: { y: 0.7 } });
        onUpdateStatus(anime, 'COMPLETED');
      } else if (nextVal > 0 && (!currentStatus || currentStatus === 'PLANNING' || currentStatus === 'COMPLETED')) {
        onUpdateStatus(anime, 'CURRENT');
      }
      onUpdateProgress(anime, nextVal);
    }
  };

  const handleCommitDirectProgress = (valStr: string) => {
    setIsEditingProgress(false);
    const parsed = parseInt(valStr, 10);
    if (isNaN(parsed)) {
      setInlineProgressInput(String(currentProgress));
      return;
    }
    const max = typeof anime.episodes === 'number' && anime.episodes > 0 ? anime.episodes : 9999;
    const clamped = Math.max(0, Math.min(max, parsed));
    
    if (clamped !== currentProgress) {
      if (typeof anime.episodes === 'number' && clamped >= anime.episodes) {
        confetti({ particleCount: 50, spread: 60, origin: { y: 0.7 } });
        onUpdateStatus(anime, 'COMPLETED');
      } else if (clamped > 0 && (!currentStatus || currentStatus === 'PLANNING' || currentStatus === 'COMPLETED')) {
        onUpdateStatus(anime, 'CURRENT');
      }
      onUpdateProgress(anime, clamped);
    }
    setInlineProgressInput(String(clamped));
  };

  const getStatusBadge = () => {
    if (!currentStatus) return null;
    switch (currentStatus) {
      case 'CURRENT':
        return <span className="px-2 py-0.5 rounded-md text-[10px] font-bold bg-indigo-600 text-white">WATCHING</span>;
      case 'COMPLETED':
        return <span className="px-2 py-0.5 rounded-md text-[10px] font-bold bg-emerald-600 text-white">COMPLETED</span>;
      case 'PLANNING':
        return <span className="px-2 py-0.5 rounded-md text-[10px] font-bold bg-amber-600 text-white">PLANNING</span>;
      case 'PAUSED':
        return <span className="px-2 py-0.5 rounded-md text-[10px] font-bold bg-purple-600 text-white">PAUSED</span>;
      case 'DROPPED':
        return <span className="px-2 py-0.5 rounded-md text-[10px] font-bold bg-red-600 text-white">DROPPED</span>;
      default:
        return null;
    }
  };

  const isFullyCompleted = typeof anime.episodes === 'number' && anime.episodes > 0 && currentProgress >= anime.episodes;
  const progressPercent = typeof anime.episodes === 'number' && anime.episodes > 0
    ? Math.min(100, Math.round((currentProgress / anime.episodes) * 100))
    : currentProgress > 0 ? 100 : 0;

  return (
    <div
      id={`anime-card-${anime.id}`}
      draggable={false}
      onContextMenu={e => { e.preventDefault(); e.stopPropagation(); }}
      className="anime-card group relative flex flex-col select-none cursor-pointer no-callout active:scale-98 transition-transform duration-150"
      onClick={handleCardClick}
    >
      {/* Poster Image Container */}
      <div className="relative aspect-[2/3] w-full overflow-hidden rounded-2xl bg-[#0d101f] border border-white/10 select-none pointer-events-auto">
        {coverUrl ? (
          <img
            src={coverUrl}
            alt={title}
            loading="lazy"
            decoding="async"
            draggable={false}
            referrerPolicy="no-referrer"
            className="h-full w-full object-cover transition-transform duration-300 group-hover:scale-105 pointer-events-none select-none no-callout"
          />
        ) : (
          <div className="h-full w-full flex items-center justify-center bg-[#0d101f] text-slate-400 font-bold text-sm p-4 text-center select-none">
            {title}
          </div>
        )}

        {/* Top-Left Score Badge */}
        {score && (
          <div className="absolute top-2.5 left-2.5 z-10 flex items-center gap-1 px-2 py-0.5 rounded-lg bg-slate-900/90 text-white text-xs font-bold border border-white/15 pointer-events-none">
            <Star className="w-3 h-3 fill-amber-400 text-amber-400" />
            <span>{score}</span>
          </div>
        )}
      </div>

      {/* Content Bottom Title & Metadata */}
      <div className="pt-2 px-0.5 space-y-1 text-left">
        <h4
          className="font-bold text-xs sm:text-sm text-slate-100 line-clamp-1 leading-snug group-hover:text-pink-400 transition"
          title={title}
        >
          {title}
        </h4>

        <div className="text-[11px] sm:text-xs text-slate-400 font-medium flex items-center justify-between gap-1.5">
          <div className="flex items-center gap-1.5 truncate">
            <span>{anime.format?.replace('_', ' ') || 'TV'}</span>
            <span>·</span>
            <span>{anime.seasonYear || anime.startDate?.year || '2026'}</span>
          </div>
          {getStatusBadge()}
        </div>

        {/* Episode Progress & Quick Step Bar (Only visible in My Library view) */}
        {userItem && showEpisodeStepper && (
          <div className="mt-1.5 pt-1.5 border-t border-white/10 flex flex-col gap-1" onClick={e => e.stopPropagation()}>
            <div className="flex items-center justify-between gap-1 text-[11px]">
              <button
                type="button"
                disabled={currentProgress <= 0}
                onClick={e => handleStepProgress(e, -1)}
                className="w-5 h-5 flex items-center justify-center rounded-md bg-white/10 hover:bg-white/20 text-slate-300 hover:text-white disabled:opacity-30 disabled:pointer-events-none transition cursor-pointer shrink-0"
              >
                <Minus className="w-3 h-3" />
              </button>

              {isEditingProgress ? (
                <div className="flex items-center justify-center gap-1 flex-1 min-w-0">
                  <span className="text-[10px] text-slate-400 font-semibold">Ep:</span>
                  <input
                    ref={inlineInputRef}
                    type="number"
                    min={0}
                    max={typeof anime.episodes === 'number' ? anime.episodes : 9999}
                    value={inlineProgressInput}
                    autoFocus
                    onChange={e => {
                      const val = e.target.value;
                      const num = parseInt(val, 10);
                      const max = typeof anime.episodes === 'number' ? anime.episodes : 9999;
                      if (!isNaN(num) && num > max) setInlineProgressInput(String(max));
                      else setInlineProgressInput(val);
                    }}
                    onKeyDown={e => {
                      if (e.key === 'Enter') handleCommitDirectProgress(inlineProgressInput);
                      else if (e.key === 'Escape') { setIsEditingProgress(false); setInlineProgressInput(String(currentProgress)); }
                    }}
                    onBlur={() => handleCommitDirectProgress(inlineProgressInput)}
                    onClick={e => e.stopPropagation()}
                    className="w-12 px-1 py-0.5 rounded bg-slate-900 border border-indigo-500 text-indigo-300 font-black text-center text-xs outline-none"
                  />
                  <span className="text-[10px] text-slate-400 truncate">/ {episodesTotal}</span>
                </div>
              ) : (
                <button
                  type="button"
                  onClick={e => {
                    e.stopPropagation();
                    setIsEditingProgress(true);
                    setTimeout(() => inlineInputRef.current?.select(), 50);
                  }}
                  className="group/ep flex items-center justify-center gap-1 px-1.5 py-0.5 rounded-md hover:bg-white/10 transition cursor-pointer flex-1 min-w-0"
                >
                  <span className="font-bold text-slate-300 group-hover/ep:text-indigo-400 truncate text-[11px]">
                    Ep {currentProgress} <span className="text-slate-500 font-normal">/ {episodesTotal}</span>
                  </span>
                  {isFullyCompleted ? (
                    <Check className="w-3 h-3 text-emerald-400 shrink-0" />
                  ) : (
                    <Edit3 className="w-2.5 h-2.5 text-slate-500 opacity-0 group-hover/ep:opacity-100 transition shrink-0" />
                  )}
                </button>
              )}

              <button
                type="button"
                disabled={typeof anime.episodes === 'number' && anime.episodes > 0 && currentProgress >= anime.episodes}
                onClick={e => handleStepProgress(e, 1)}
                className={`w-5 h-5 flex items-center justify-center rounded-md text-white transition cursor-pointer shrink-0 ${
                  typeof anime.episodes === 'number' && anime.episodes > 0 && currentProgress >= anime.episodes
                    ? 'bg-emerald-600/40 opacity-40 cursor-not-allowed text-emerald-300'
                    : 'bg-indigo-600 hover:bg-indigo-500'
                }`}
              >
                <Plus className="w-3 h-3" />
              </button>
            </div>

            <div className="w-full h-1 rounded-full bg-white/10 overflow-hidden">
              <div
                className={`h-full transition-all duration-300 rounded-full ${
                  isFullyCompleted ? 'bg-emerald-400' : 'bg-gradient-to-r from-indigo-500 to-pink-500'
                }`}
                style={{ width: `${progressPercent}%` }}
              />
            </div>
          </div>
        )}
      </div>
    </div>
  );
};

export const AnimeCard = React.memo(AnimeCardComponent);
