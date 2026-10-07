import React, { useState, useEffect, useRef, useCallback } from 'react';
import {
  ArrowLeft,
  ChevronLeft,
  ChevronRight,
  List,
  RotateCw,
  Settings,
  X,
  BookOpen,
  Sliders,
  Check,
  Play,
  Pause,
  ArrowUp,
  ArrowDown,
  EyeOff,
  Sparkles,
  Palette,
  ZoomIn,
  ZoomOut,
  Minus,
  Plus,
} from 'lucide-react';
import { Manga, MangaChapter, MangaPage, UserSettings, MediaListStatus } from '../types';
import { fetchMangaChapters, fetchChapterPages } from '../services/mangaProvider';

interface ReaderViewProps {
  manga: Manga;
  initialChapterNumber?: number;
  onBack: () => void;
  onChapterChange?: (chapterNum: number) => void;
  onUpdateProgress?: (manga: Manga, newProgress: number) => void;
  onUpdateStatus?: (manga: Manga, status: MediaListStatus) => void;
  settings?: UserSettings;
}

export type ReadingDirection = 'paged-ltr' | 'paged-rtl' | 'webtoon';
export type ProgressBarPosition = 'bottom' | 'top' | 'left' | 'right' | 'hidden';
export type BgTheme = 'black' | 'white' | 'transparent' | 'dynamic' | 'custom';

export const ReaderView: React.FC<ReaderViewProps> = ({
  manga,
  initialChapterNumber = 1,
  onBack,
  onChapterChange,
  onUpdateProgress,
  onUpdateStatus,
  settings,
}) => {
  const [chapters, setChapters] = useState<MangaChapter[]>([]);
  const [currentChapterIndex, setCurrentChapterIndex] = useState<number>(0);
  const [pages, setPages] = useState<MangaPage[]>([]);
  const [currentPageIndex, setCurrentPageIndex] = useState<number>(0);
  const [loading, setLoading] = useState<boolean>(true);
  const [loadingPages, setLoadingPages] = useState<boolean>(true);
  const [showControls, setShowControls] = useState<boolean>(true);

  // Settings & Customization States (Image 1 & 2 exact features)
  const [readingDirection, setReadingDirection] = useState<ReadingDirection>(
    manga.countryOfOrigin === 'KR' || manga.format === 'MANHWA' ? 'webtoon' : 'paged-rtl'
  );
  const [stripMargin, setStripMargin] = useState<number>(0); // Strip margin in px
  const [zoomLevel, setZoomLevel] = useState<number>(100); // 50% to 100%
  const [bgTheme, setBgTheme] = useState<BgTheme>('black');
  const [customBgColor, setCustomBgColor] = useState<string>('#121620');
  const [keyboardScrollMode, setKeyboardScrollMode] = useState<'fast' | 'smooth'>('smooth');
  const [keyboardScrollStep, setKeyboardScrollStep] = useState<number>(10); // Percent viewport step
  const [autoScrollSpeed, setAutoScrollSpeed] = useState<number>(20); // px/s
  const [isAutoScrolling, setIsAutoScrolling] = useState<boolean>(false);
  const [progressBarPosition, setProgressBarPosition] = useState<ProgressBarPosition>('right');
  const [preloadMode, setPreloadMode] = useState<'some' | 'all'>('some');
  const [hideControlsGesture, setHideControlsGesture] = useState<'single' | 'double'>('double');
  const [isGrayscale, setIsGrayscale] = useState<boolean>(false);
  const [dimPercentage, setDimPercentage] = useState<number>(0); // 0% to 80%

  const [showChapterDrawer, setShowChapterDrawer] = useState<boolean>(false);
  const [showSettingsModal, setShowSettingsModal] = useState<boolean>(false);
  const [chapterSearch, setChapterSearch] = useState<string>('');

  const scrollContainerRef = useRef<HTMLDivElement>(null);
  const lastTapTimeRef = useRef<number>(0);

  // Fetch Chapter List
  useEffect(() => {
    let isMounted = true;
    setLoading(true);

    fetchMangaChapters(manga).then((fetchedChapters) => {
      if (!isMounted) return;
      setChapters(fetchedChapters);

      const targetIdx = fetchedChapters.findIndex(
        (ch) => parseFloat(ch.chapterNumber) === initialChapterNumber
      );
      setCurrentChapterIndex(targetIdx >= 0 ? targetIdx : 0);
      setLoading(false);
    });

    return () => {
      isMounted = false;
    };
  }, [manga, initialChapterNumber]);

  // Load Pages when Current Chapter Changes
  const currentChapter = chapters[currentChapterIndex];

  useEffect(() => {
    if (!currentChapter) return;

    let isMounted = true;
    setLoadingPages(true);
    setCurrentPageIndex(0);

    const chapterNum = parseFloat(currentChapter.chapterNumber) || 1;

    fetchChapterPages(currentChapter.id, manga, chapterNum).then((fetchedPages) => {
      if (!isMounted) return;
      setPages(fetchedPages);
      setLoadingPages(false);

      if (onUpdateProgress) {
        onUpdateProgress(manga, chapterNum);
      }
    });

    return () => {
      isMounted = false;
    };
  }, [currentChapter, manga, onUpdateProgress]);

  // Preload Images in background
  useEffect(() => {
    if (pages.length === 0) return;

    if (preloadMode === 'all') {
      pages.forEach((p) => {
        const img = new Image();
        img.src = p.url;
      });
    } else {
      const nextPages = pages.slice(currentPageIndex + 1, currentPageIndex + 4);
      nextPages.forEach((p) => {
        const img = new Image();
        img.src = p.url;
      });
    }
  }, [pages, currentPageIndex, preloadMode]);

  // Auto-Scrolling Logic
  useEffect(() => {
    if (!isAutoScrolling || autoScrollSpeed <= 0) return;

    const interval = setInterval(() => {
      if (scrollContainerRef.current) {
        scrollContainerRef.current.scrollBy({
          top: autoScrollSpeed / 10,
          behavior: keyboardScrollMode === 'smooth' ? 'smooth' : 'auto',
        });
      }
    }, 100);

    return () => clearInterval(interval);
  }, [isAutoScrolling, autoScrollSpeed, keyboardScrollMode]);

  // Next & Prev Chapter Navigation
  const handlePrevChapter = useCallback(() => {
    setIsAutoScrolling(false);
    if (currentChapterIndex > 0) {
      const nextIdx = currentChapterIndex - 1;
      setCurrentChapterIndex(nextIdx);
      const nextNum = parseFloat(chapters[nextIdx]?.chapterNumber || '1');
      if (onChapterChange) onChapterChange(nextNum);
    }
  }, [currentChapterIndex, chapters, onChapterChange]);

  const handleNextChapter = useCallback(() => {
    setIsAutoScrolling(false);
    if (currentChapterIndex < chapters.length - 1) {
      const nextIdx = currentChapterIndex + 1;
      setCurrentChapterIndex(nextIdx);
      const nextNum = parseFloat(chapters[nextIdx]?.chapterNumber || '1');
      if (onChapterChange) onChapterChange(nextNum);
    }
  }, [currentChapterIndex, chapters, onChapterChange]);

  // Keyboard navigation & step scrolling
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      const stepPx = window.innerHeight * (keyboardScrollStep / 100);

      if (e.key === 'ArrowRight') {
        if (readingDirection === 'paged-rtl') {
          if (currentPageIndex > 0) setCurrentPageIndex((prev) => prev - 1);
        } else {
          if (currentPageIndex < pages.length - 1) setCurrentPageIndex((prev) => prev + 1);
        }
      } else if (e.key === 'ArrowLeft') {
        if (readingDirection === 'paged-rtl') {
          if (currentPageIndex < pages.length - 1) setCurrentPageIndex((prev) => prev + 1);
        } else {
          if (currentPageIndex > 0) setCurrentPageIndex((prev) => prev - 1);
        }
      } else if (e.key === 'w' || e.key === 'W' || e.key === 'ArrowUp') {
        if (scrollContainerRef.current) {
          scrollContainerRef.current.scrollBy({ top: -stepPx, behavior: keyboardScrollMode === 'smooth' ? 'smooth' : 'auto' });
        }
      } else if (e.key === 's' || e.key === 'S' || e.key === 'ArrowDown') {
        if (scrollContainerRef.current) {
          scrollContainerRef.current.scrollBy({ top: stepPx, behavior: keyboardScrollMode === 'smooth' ? 'smooth' : 'auto' });
        }
      } else if (e.key === ' ') {
        setIsAutoScrolling((prev) => !prev);
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [currentPageIndex, pages.length, readingDirection, keyboardScrollStep, keyboardScrollMode]);

  // Container Click/Tap Gesture Handler
  const handleContainerTap = () => {
    const now = Date.now();
    if (hideControlsGesture === 'double') {
      if (now - lastTapTimeRef.current < 300) {
        setShowControls((prev) => !prev);
      }
      lastTapTimeRef.current = now;
    } else {
      setShowControls((prev) => !prev);
    }
  };

  // Scroll spy to update active page index in webtoon mode
  const handleScroll = () => {
    if (readingDirection === 'webtoon' && scrollContainerRef.current) {
      const container = scrollContainerRef.current;
      const children = container.querySelectorAll('.reader-page-img');
      const containerTop = container.scrollTop;

      children.forEach((child, index) => {
        const rect = (child as HTMLElement).offsetTop;
        if (containerTop >= rect - 200) {
          setCurrentPageIndex(index);
        }
      });
    }
  };

  // Compute dynamic background style
  const getContainerBgStyle = () => {
    switch (bgTheme) {
      case 'white':
        return { backgroundColor: '#ffffff', color: '#111827' };
      case 'transparent':
        return { backgroundColor: 'transparent' };
      case 'dynamic':
        return { backgroundColor: '#090d16' };
      case 'custom':
        return { backgroundColor: customBgColor };
      case 'black':
      default:
        return { backgroundColor: '#000000', color: '#ffffff' };
    }
  };

  // Filtered Chapters for Drawer
  const filteredChapters = chapters.filter(
    (ch) =>
      ch.chapterNumber.includes(chapterSearch) ||
      (ch.title && ch.title.toLowerCase().includes(chapterSearch.toLowerCase()))
  );

  return (
    <div
      className="relative w-full h-screen overflow-hidden select-none flex flex-col transition-colors duration-300"
      style={getContainerBgStyle()}
    >
      {/* Dim Overlay */}
      {dimPercentage > 0 && (
        <div
          className="fixed inset-0 pointer-events-none z-20 bg-black transition-opacity"
          style={{ opacity: dimPercentage / 100 }}
        />
      )}

      {/* Top Header Overlay */}
      <div
        className={`absolute top-0 left-0 right-0 z-30 transition-transform duration-300 ease-in-out ${
          showControls ? 'translate-y-0' : '-translate-y-full'
        }`}
      >
        <div className="bg-neutral-900/90 backdrop-blur-md border-b border-white/10 px-4 py-3 flex items-center justify-between shadow-2xl">
          <div className="flex items-center gap-3">
            <button
              onClick={onBack}
              className="p-2 rounded-xl bg-white/5 hover:bg-white/10 text-white transition-all active:scale-95 cursor-pointer"
            >
              <ArrowLeft className="w-5 h-5" />
            </button>
            <div className="max-w-[220px] sm:max-w-xs md:max-w-md truncate text-left">
              <h1 className="text-sm font-bold truncate text-white">
                {manga.title?.english || manga.title?.romaji || 'Manga Title'}
              </h1>
              <p className="text-xs text-neutral-400 truncate">
                {currentChapter ? `Ch. ${currentChapter.chapterNumber} ${currentChapter.title ? '- ' + currentChapter.title : ''}` : 'Loading...'}
              </p>
            </div>
          </div>

          <div className="flex items-center gap-2">
            {/* Auto-Scroll Play/Pause Button */}
            <button
              onClick={() => setIsAutoScrolling((prev) => !prev)}
              className={`p-2 rounded-xl transition-all flex items-center gap-1 text-xs font-bold cursor-pointer ${
                isAutoScrolling
                  ? 'bg-purple-600 text-white shadow-lg shadow-purple-600/40 animate-pulse'
                  : 'bg-white/5 hover:bg-white/10 text-neutral-300'
              }`}
              title="Toggle Auto Scroll"
            >
              {isAutoScrolling ? <Pause className="w-4 h-4 fill-current" /> : <Play className="w-4 h-4 fill-current" />}
              <span className="hidden sm:inline">{isAutoScrolling ? 'Auto Scrolling' : 'Auto Scroll'}</span>
            </button>

            <button
              onClick={() => setShowChapterDrawer(true)}
              className="p-2 rounded-xl bg-white/5 hover:bg-white/10 text-white transition-all flex items-center gap-1.5 text-xs font-medium cursor-pointer"
            >
              <List className="w-4 h-4 text-purple-400" />
              <span className="hidden sm:inline">Chapters</span>
            </button>

            <button
              onClick={() => setShowSettingsModal(true)}
              className="p-2 rounded-xl bg-white/5 hover:bg-white/10 text-white transition-all cursor-pointer"
            >
              <Settings className="w-4 h-4 text-neutral-300" />
            </button>
          </div>
        </div>
      </div>

      {/* Vertical Segmented Progress Bar (Exact Match for Image 1) */}
      {progressBarPosition === 'right' && pages.length > 0 && (
        <div className="fixed right-1 top-1/2 -translate-y-1/2 z-40 flex flex-col items-center gap-0.5 max-h-[80vh] overflow-hidden p-1 rounded-md bg-black/40 backdrop-blur-sm border border-white/5 shadow-2xl">
          {pages.map((_, idx) => {
            const isRead = idx <= currentPageIndex;
            return (
              <button
                key={idx}
                type="button"
                onClick={(e) => {
                  e.stopPropagation();
                  setCurrentPageIndex(idx);
                  if (readingDirection === 'webtoon' && scrollContainerRef.current) {
                    const children = scrollContainerRef.current.querySelectorAll('.reader-page-img');
                    if (children[idx]) {
                      children[idx].scrollIntoView({ behavior: 'smooth' });
                    }
                  }
                }}
                className={`w-2 sm:w-2.5 transition-all duration-200 cursor-pointer rounded-[1px] ${
                  isRead ? 'bg-cyan-400 shadow-sm shadow-cyan-400/50' : 'bg-neutral-800 hover:bg-neutral-600'
                }`}
                style={{ height: `${Math.max(4, Math.min(12, 400 / pages.length))}px` }}
                title={`Page ${idx + 1}`}
              />
            );
          })}
        </div>
      )}

      {/* Main Reader View Container */}
      <div
        className="flex-1 w-full h-full overflow-y-auto relative scrollbar-none"
        ref={scrollContainerRef}
        onScroll={handleScroll}
        onClick={handleContainerTap}
      >
        {loading || loadingPages ? (
          <div className="w-full h-full flex flex-col items-center justify-center gap-3">
            <RotateCw className="w-8 h-8 text-purple-500 animate-spin" />
            <p className="text-sm text-neutral-400 animate-pulse">Loading Chapter Pages...</p>
          </div>
        ) : readingDirection === 'webtoon' ? (
          /* Webtoon Vertical Infinite Scroll */
          <div
            className="mx-auto flex flex-col items-center py-12 px-2 transition-all duration-200"
            style={{
              width: `${zoomLevel}%`,
              maxWidth: zoomLevel === 100 ? '100%' : `${zoomLevel}%`,
              gap: `${stripMargin}px`,
            }}
          >
            {pages.map((page, idx) => (
              <img
                key={page.pageNumber}
                src={page.url}
                alt={`Page ${page.pageNumber}`}
                className="reader-page-img w-full h-auto block rounded-sm object-contain shadow-lg loading-lazy"
                style={{
                  filter: `${isGrayscale ? 'grayscale(100%)' : ''}`,
                }}
                loading="lazy"
              />
            ))}

            {/* End of Chapter Action Card */}
            <div className="w-full max-w-lg my-8 p-6 rounded-2xl bg-neutral-900 border border-white/10 flex flex-col items-center text-center gap-4 shadow-2xl">
              <Sparkles className="w-8 h-8 text-purple-400" />
              <h3 className="text-lg font-bold">End of Chapter {currentChapter?.chapterNumber}</h3>
              <div className="flex items-center gap-3">
                <button
                  disabled={currentChapterIndex === 0}
                  onClick={(e) => {
                    e.stopPropagation();
                    handlePrevChapter();
                  }}
                  className="px-4 py-2 rounded-xl bg-white/5 hover:bg-white/10 disabled:opacity-40 text-sm font-medium cursor-pointer"
                >
                  Previous
                </button>
                <button
                  disabled={currentChapterIndex >= chapters.length - 1}
                  onClick={(e) => {
                    e.stopPropagation();
                    handleNextChapter();
                  }}
                  className="px-5 py-2 rounded-xl bg-purple-600 hover:bg-purple-500 text-white text-sm font-bold shadow-lg shadow-purple-600/30 cursor-pointer"
                >
                  Next Chapter
                </button>
              </div>
            </div>
          </div>
        ) : (
          /* Single Page / Paged Mode (LTR or RTL) */
          <div className="w-full h-full flex items-center justify-center relative p-2">
            {pages[currentPageIndex] && (
              <img
                src={pages[currentPageIndex].url}
                alt={`Page ${currentPageIndex + 1}`}
                className="max-h-full object-contain shadow-2xl transition-all duration-200"
                style={{
                  width: `${zoomLevel}%`,
                  maxWidth: zoomLevel === 100 ? '100%' : `${zoomLevel}%`,
                  filter: `${isGrayscale ? 'grayscale(100%)' : ''}`,
                }}
              />
            )}

            {/* Tap Navigation Zones */}
            <div
              className="absolute left-0 top-0 bottom-0 w-1/3 z-10 cursor-pointer"
              onClick={(e) => {
                e.stopPropagation();
                if (readingDirection === 'paged-rtl') {
                  if (currentPageIndex < pages.length - 1) setCurrentPageIndex((prev) => prev + 1);
                } else {
                  if (currentPageIndex > 0) setCurrentPageIndex((prev) => prev - 1);
                }
              }}
            />
            <div
              className="absolute right-0 top-0 bottom-0 w-1/3 z-10 cursor-pointer"
              onClick={(e) => {
                e.stopPropagation();
                if (readingDirection === 'paged-rtl') {
                  if (currentPageIndex > 0) setCurrentPageIndex((prev) => prev - 1);
                } else {
                  if (currentPageIndex < pages.length - 1) setCurrentPageIndex((prev) => prev + 1);
                }
              }}
            />
          </div>
        )}
      </div>

      {/* Progress Bar Placement */}
      {progressBarPosition === 'bottom' && pages.length > 0 && showControls && (
        <div className="absolute bottom-16 left-4 right-4 z-30 transition-all">
          <div className="bg-neutral-900/90 border border-white/10 rounded-xl p-2 flex items-center gap-3 backdrop-blur-md shadow-xl">
            <span className="text-xs text-neutral-400 min-w-[32px] text-right font-bold">
              {currentPageIndex + 1}
            </span>
            <input
              type="range"
              min={0}
              max={pages.length - 1}
              value={currentPageIndex}
              onChange={(e) => setCurrentPageIndex(parseInt(e.target.value, 10))}
              className="flex-1 accent-purple-500 h-1.5 rounded-lg bg-white/20 cursor-pointer"
            />
            <span className="text-xs text-neutral-400 min-w-[32px] font-bold">{pages.length}</span>
          </div>
        </div>
      )}

      {/* Bottom Controls Overlay */}
      <div
        className={`absolute bottom-0 left-0 right-0 z-30 transition-transform duration-300 ease-in-out ${
          showControls ? 'translate-y-0' : 'translate-y-full'
        }`}
      >
        <div className="bg-neutral-900/90 backdrop-blur-md border-t border-white/10 px-4 py-3 flex items-center justify-between shadow-2xl">
          <button
            disabled={currentChapterIndex === 0}
            onClick={handlePrevChapter}
            className="px-3.5 py-2 rounded-xl bg-white/5 hover:bg-white/10 disabled:opacity-30 text-xs font-semibold flex items-center gap-1 cursor-pointer"
          >
            <ChevronLeft className="w-4 h-4" /> Prev Ch
          </button>

          <div className="flex items-center gap-2">
            <span className="text-xs font-bold text-purple-300 bg-purple-500/10 border border-purple-500/20 px-3 py-1.5 rounded-full">
              Ch. {currentChapter?.chapterNumber || 1} ({currentPageIndex + 1}/{pages.length})
            </span>

            {/* Play/Pause Auto Scroll toggle in bottom bar */}
            <button
              onClick={() => setIsAutoScrolling((prev) => !prev)}
              className={`p-2 rounded-full transition-all cursor-pointer ${
                isAutoScrolling ? 'bg-purple-600 text-white animate-pulse' : 'bg-white/5 text-neutral-400 hover:text-white'
              }`}
              title="Toggle Auto Scroll"
            >
              {isAutoScrolling ? <Pause className="w-4 h-4 fill-current" /> : <Play className="w-4 h-4 fill-current ml-0.5" />}
            </button>
          </div>

          <button
            disabled={currentChapterIndex >= chapters.length - 1}
            onClick={handleNextChapter}
            className="px-3.5 py-2 rounded-xl bg-purple-600 hover:bg-purple-500 text-white disabled:opacity-30 text-xs font-semibold flex items-center gap-1 shadow-md shadow-purple-600/30 cursor-pointer"
          >
            Next Ch <ChevronRight className="w-4 h-4" />
          </button>
        </div>
      </div>

      {/* Chapter Drawer Modal */}
      {showChapterDrawer && (
        <div className="fixed inset-0 z-50 bg-black/80 backdrop-blur-sm flex justify-end">
          <div className="w-full max-w-sm h-full bg-neutral-900 border-l border-white/10 p-4 flex flex-col gap-4 animate-in slide-in-from-right duration-200">
            <div className="flex items-center justify-between border-b border-white/10 pb-3">
              <h2 className="text-base font-bold flex items-center gap-2 text-white">
                <List className="w-5 h-5 text-purple-400" /> All Chapters ({chapters.length})
              </h2>
              <button
                onClick={() => setShowChapterDrawer(false)}
                className="p-1.5 rounded-lg hover:bg-white/10 cursor-pointer"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <input
              type="text"
              placeholder="Search chapter..."
              value={chapterSearch}
              onChange={(e) => setChapterSearch(e.target.value)}
              className="w-full bg-white/5 border border-white/10 rounded-xl px-3 py-2 text-sm text-white focus:outline-none focus:border-purple-500"
            />

            <div className="flex-1 overflow-y-auto flex flex-col gap-1.5 pr-1 text-left">
              {filteredChapters.map((ch) => {
                const isSelected = chapters[currentChapterIndex]?.id === ch.id;
                return (
                  <button
                    key={ch.id}
                    onClick={() => {
                      const realIdx = chapters.findIndex((item) => item.id === ch.id);
                      if (realIdx >= 0) setCurrentChapterIndex(realIdx);
                      setShowChapterDrawer(false);
                    }}
                    className={`w-full text-left p-3 rounded-xl transition-all flex items-center justify-between text-sm cursor-pointer ${
                      isSelected
                        ? 'bg-purple-600/20 border border-purple-500/50 text-purple-300 font-bold'
                        : 'hover:bg-white/5 text-neutral-300'
                    }`}
                  >
                    <span>Ch. {ch.chapterNumber}</span>
                    <span className="text-xs text-neutral-500 truncate max-w-[140px]">
                      {ch.title || ch.scanlationGroup}
                    </span>
                  </button>
                );
              })}
            </div>
          </div>
        </div>
      )}

      {/* Reader Settings Modal (Exact Features from Images 1 & 2) */}
      {showSettingsModal && (
        <div className="fixed inset-0 z-50 bg-black/80 backdrop-blur-sm flex items-center justify-center p-3 sm:p-4 overflow-y-auto">
          <div className="w-full max-w-lg bg-[#121620] border border-white/10 rounded-3xl p-5 sm:p-6 flex flex-col gap-5 my-auto max-h-[90vh] overflow-y-auto shadow-2xl text-left">
            <div className="flex items-center justify-between border-b border-white/10 pb-3">
              <h2 className="text-base font-bold flex items-center gap-2 text-white">
                <Sliders className="w-5 h-5 text-purple-400" /> Reader Settings
              </h2>
              <button
                onClick={() => setShowSettingsModal(false)}
                className="p-1.5 rounded-xl bg-white/5 hover:bg-white/10 text-neutral-400 hover:text-white transition cursor-pointer"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            {/* ZOOM LEVEL STEPPER (Matching Image 2) */}
            <div className="space-y-2">
              <label className="text-xs font-bold text-neutral-400 tracking-wider uppercase block">
                Page Zoom Level
              </label>
              <div className="flex items-center gap-3">
                <div className="flex-1 bg-white/5 border border-white/10 rounded-2xl p-2.5 flex items-center justify-between">
                  <button
                    type="button"
                    onClick={() => setZoomLevel((prev) => Math.max(50, prev - 10))}
                    className="w-8 h-8 rounded-xl bg-white/5 hover:bg-white/10 font-bold text-lg text-white cursor-pointer"
                  >
                    -
                  </button>
                  <span className="text-sm font-black text-teal-400">{zoomLevel}%</span>
                  <button
                    type="button"
                    onClick={() => setZoomLevel((prev) => Math.min(100, prev + 10))}
                    className="w-8 h-8 rounded-xl bg-white/5 hover:bg-white/10 font-bold text-lg text-white cursor-pointer"
                  >
                    +
                  </button>
                </div>
                <button
                  type="button"
                  onClick={() => setZoomLevel(100)}
                  className="px-4 py-2.5 rounded-2xl bg-white/5 hover:bg-white/10 border border-white/10 text-xs font-bold text-neutral-300 cursor-pointer"
                >
                  Full Width
                </button>
              </div>
              <p className="text-[11px] text-neutral-500">
                At 100%, pages fill the full device screen width.
              </p>
            </div>

            {/* BACKGROUND THEMES */}
            <div className="space-y-2">
              <label className="text-xs font-bold text-neutral-400 tracking-wider uppercase block">
                Background Theme
              </label>
              <div className="grid grid-cols-4 gap-2">
                {[
                  { id: 'black', label: 'Black', bg: '#000000' },
                  { id: 'white', label: 'White', bg: '#ffffff' },
                  { id: 'transparent', label: 'Clear', bg: 'transparent' },
                  { id: 'dynamic', label: 'Lively', bg: '#090d16' },
                ].map((t) => (
                  <button
                    key={t.id}
                    type="button"
                    onClick={() => setBgTheme(t.id as BgTheme)}
                    className={`p-2.5 rounded-2xl border text-xs font-bold flex flex-col items-center gap-1 transition cursor-pointer ${
                      bgTheme === t.id
                        ? 'bg-teal-500/20 border-teal-500 text-teal-300'
                        : 'bg-white/5 border-white/10 text-neutral-400 hover:bg-white/10'
                    }`}
                  >
                    <div
                      className="w-5 h-5 rounded-full border border-white/20 shadow-sm"
                      style={{ backgroundColor: t.bg === 'transparent' ? '#1f2937' : t.bg }}
                    />
                    <span>{t.label}</span>
                  </button>
                ))}
              </div>

              {/* Custom Color Selector */}
              <div className="flex items-center gap-3 pt-2">
                <input
                  type="color"
                  value={customBgColor}
                  onChange={(e) => {
                    setCustomBgColor(e.target.value);
                    setBgTheme('custom');
                  }}
                  className="w-10 h-10 rounded-xl bg-transparent border-0 cursor-pointer"
                />
                <span className="text-xs font-bold text-neutral-300">Custom Color: {customBgColor}</span>
              </div>
            </div>

            {/* READING DIRECTION */}
            <div className="space-y-2">
              <label className="text-xs font-bold text-neutral-400 tracking-wider uppercase block">
                Reading Direction
              </label>
              <div className="grid grid-cols-3 gap-2">
                <button
                  type="button"
                  onClick={() => setReadingDirection('paged-ltr')}
                  className={`p-3 rounded-2xl border text-xs font-bold flex items-center justify-center gap-1.5 transition cursor-pointer ${
                    readingDirection === 'paged-ltr'
                      ? 'bg-teal-500/20 border-teal-500 text-teal-300'
                      : 'bg-white/5 border-white/10 text-neutral-400 hover:bg-white/10'
                  }`}
                >
                  <span>→|</span> Left to right
                </button>
                <button
                  type="button"
                  onClick={() => setReadingDirection('paged-rtl')}
                  className={`p-3 rounded-2xl border text-xs font-bold flex items-center justify-center gap-1.5 transition cursor-pointer ${
                    readingDirection === 'paged-rtl'
                      ? 'bg-teal-500/20 border-teal-500 text-teal-300'
                      : 'bg-white/5 border-white/10 text-neutral-400 hover:bg-white/10'
                  }`}
                >
                  <span>|←</span> Right to left
                </button>
                <button
                  type="button"
                  onClick={() => setReadingDirection('webtoon')}
                  className={`p-3 rounded-2xl border text-xs font-bold flex items-center justify-center gap-1.5 transition cursor-pointer ${
                    readingDirection === 'webtoon'
                      ? 'bg-teal-500/20 border-teal-500 text-teal-300'
                      : 'bg-white/5 border-white/10 text-neutral-400 hover:bg-white/10'
                  }`}
                >
                  <span>↓</span> Top to bottom
                </button>
              </div>
            </div>

            {/* STRIP MARGIN */}
            <div className="space-y-2">
              <label className="text-xs font-bold text-neutral-400 tracking-wider uppercase block">
                Strip Margin
              </label>
              <div className="flex items-center gap-3">
                <div className="flex-1 bg-white/5 border border-white/10 rounded-2xl p-2 flex items-center justify-between">
                  <button
                    type="button"
                    onClick={() => setStripMargin((prev) => Math.max(0, prev - 4))}
                    className="w-8 h-8 rounded-xl bg-white/5 hover:bg-white/10 font-bold text-lg text-white cursor-pointer"
                  >
                    -
                  </button>
                  <span className="text-sm font-bold text-white">{stripMargin} px</span>
                  <button
                    type="button"
                    onClick={() => setStripMargin((prev) => Math.min(32, prev + 4))}
                    className="w-8 h-8 rounded-xl bg-white/5 hover:bg-white/10 font-bold text-lg text-white cursor-pointer"
                  >
                    +
                  </button>
                </div>
                <button
                  type="button"
                  onClick={() => setStripMargin(0)}
                  className="px-4 py-2.5 rounded-2xl bg-white/5 hover:bg-white/10 border border-white/10 text-xs font-bold text-neutral-300 cursor-pointer"
                >
                  Reset
                </button>
              </div>
            </div>

            {/* KEYBOARD SCROLLING */}
            <div className="space-y-2">
              <label className="text-xs font-bold text-neutral-400 tracking-wider uppercase block">
                Keyboard Scrolling
              </label>
              <div className="grid grid-cols-2 gap-2 mb-2">
                <button
                  type="button"
                  onClick={() => setKeyboardScrollMode('fast')}
                  className={`p-3 rounded-2xl border text-xs font-bold flex items-center justify-center gap-2 transition cursor-pointer ${
                    keyboardScrollMode === 'fast'
                      ? 'bg-teal-500/20 border-teal-500 text-teal-300'
                      : 'bg-white/5 border-white/10 text-neutral-400 hover:bg-white/10'
                  }`}
                >
                  Scroll fast
                </button>
                <button
                  type="button"
                  onClick={() => setKeyboardScrollMode('smooth')}
                  className={`p-3 rounded-2xl border text-xs font-bold flex items-center justify-center gap-2 transition cursor-pointer ${
                    keyboardScrollMode === 'smooth'
                      ? 'bg-teal-500/20 border-teal-500 text-teal-300'
                      : 'bg-white/5 border-white/10 text-neutral-400 hover:bg-white/10'
                  }`}
                >
                  Scroll smooth
                </button>
              </div>

              <div className="flex items-center gap-3">
                <div className="flex-1 bg-white/5 border border-white/10 rounded-2xl p-2 flex items-center justify-between">
                  <button
                    type="button"
                    onClick={() => setKeyboardScrollStep((prev) => Math.max(5, prev - 5))}
                    className="w-8 h-8 rounded-xl bg-white/5 hover:bg-white/10 font-bold text-lg text-white cursor-pointer"
                  >
                    -
                  </button>
                  <span className="text-sm font-bold text-white">{keyboardScrollStep}%</span>
                  <button
                    type="button"
                    onClick={() => setKeyboardScrollStep((prev) => Math.min(50, prev + 5))}
                    className="w-8 h-8 rounded-xl bg-white/5 hover:bg-white/10 font-bold text-lg text-white cursor-pointer"
                  >
                    +
                  </button>
                </div>
                <button
                  type="button"
                  onClick={() => setKeyboardScrollStep(10)}
                  className="px-4 py-2.5 rounded-2xl bg-white/5 hover:bg-white/10 border border-white/10 text-xs font-bold text-neutral-300 cursor-pointer"
                >
                  Reset
                </button>
              </div>
            </div>

            {/* AUTO-SCROLL SPEED */}
            <div className="space-y-2">
              <div className="flex items-center justify-between">
                <label className="text-xs font-bold text-neutral-400 tracking-wider uppercase block">
                  Auto-Scroll Speed
                </label>
                <span className="text-xs font-bold text-teal-400">{autoScrollSpeed} px/s</span>
              </div>
              <input
                type="range"
                min={5}
                max={100}
                value={autoScrollSpeed}
                onChange={(e) => setAutoScrollSpeed(parseInt(e.target.value, 10))}
                className="w-full accent-teal-400 h-2 rounded-lg bg-white/10 cursor-pointer"
              />
            </div>

            {/* PROGRESS BAR POSITION (Matching Image 1) */}
            <div className="space-y-2">
              <label className="text-xs font-bold text-neutral-400 tracking-wider uppercase block">
                Progress Indicator
              </label>
              <div className="grid grid-cols-3 gap-2">
                <button
                  type="button"
                  onClick={() => setProgressBarPosition('right')}
                  className={`p-3 rounded-2xl border text-xs font-bold flex items-center justify-center gap-1.5 transition cursor-pointer ${
                    progressBarPosition === 'right'
                      ? 'bg-teal-500/20 border-teal-500 text-teal-300'
                      : 'bg-white/5 border-white/10 text-neutral-400 hover:bg-white/10'
                  }`}
                >
                  Vertical Bar (Right)
                </button>
                <button
                  type="button"
                  onClick={() => setProgressBarPosition('bottom')}
                  className={`p-3 rounded-2xl border text-xs font-bold flex items-center justify-center gap-1.5 transition cursor-pointer ${
                    progressBarPosition === 'bottom'
                      ? 'bg-teal-500/20 border-teal-500 text-teal-300'
                      : 'bg-white/5 border-white/10 text-neutral-400 hover:bg-white/10'
                  }`}
                >
                  Bottom Slider
                </button>
                <button
                  type="button"
                  onClick={() => setProgressBarPosition('hidden')}
                  className={`p-3 rounded-2xl border text-xs font-bold flex items-center justify-center gap-1.5 transition cursor-pointer ${
                    progressBarPosition === 'hidden'
                      ? 'bg-teal-500/20 border-teal-500 text-teal-300'
                      : 'bg-white/5 border-white/10 text-neutral-400 hover:bg-white/10'
                  }`}
                >
                  Hidden
                </button>
              </div>
            </div>

            {/* PRELOAD IMAGES */}
            <div className="space-y-2">
              <label className="text-xs font-bold text-neutral-400 tracking-wider uppercase block">
                Preload Images
              </label>
              <div className="grid grid-cols-2 gap-2">
                <button
                  type="button"
                  onClick={() => setPreloadMode('some')}
                  className={`p-3 rounded-2xl border text-xs font-bold transition cursor-pointer ${
                    preloadMode === 'some'
                      ? 'bg-teal-500/20 border-teal-500 text-teal-300'
                      : 'bg-white/5 border-white/10 text-neutral-400 hover:bg-white/10'
                  }`}
                >
                  Preload some
                </button>
                <button
                  type="button"
                  onClick={() => setPreloadMode('all')}
                  className={`p-3 rounded-2xl border text-xs font-bold transition cursor-pointer ${
                    preloadMode === 'all'
                      ? 'bg-teal-500/20 border-teal-500 text-teal-300'
                      : 'bg-white/5 border-white/10 text-neutral-400 hover:bg-white/10'
                  }`}
                >
                  Preload all
                </button>
              </div>
            </div>

            {/* GREYSCALE & DIM */}
            <div className="pt-2 border-t border-white/10 space-y-3">
              <label className="flex items-center gap-3 p-3 rounded-2xl bg-white/5 border border-white/10 cursor-pointer hover:bg-white/10 transition">
                <input
                  type="checkbox"
                  checked={isGrayscale}
                  onChange={(e) => setIsGrayscale(e.target.checked)}
                  className="w-4 h-4 accent-teal-400 rounded cursor-pointer"
                />
                <span className="text-xs font-bold text-white">Greyscale pages</span>
              </label>

              <div className="space-y-1">
                <div className="flex items-center justify-between">
                  <label className="text-xs font-bold text-neutral-400 tracking-wider uppercase block">
                    Dim Pages
                  </label>
                  <span className="text-xs font-bold text-teal-400">{dimPercentage}%</span>
                </div>
                <input
                  type="range"
                  min={0}
                  max={80}
                  value={dimPercentage}
                  onChange={(e) => setDimPercentage(parseInt(e.target.value, 10))}
                  className="w-full accent-teal-400 h-2 rounded-lg bg-white/10 cursor-pointer"
                />
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
