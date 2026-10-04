import React, { useState, useEffect, useMemo, useCallback } from 'react';
import { Search, X, SlidersHorizontal, Camera, RotateCcw } from 'lucide-react';
import { Anime, UserMediaListItem, MediaListStatus } from '../types';
import { AnimeCard } from './AnimeCard';
import { searchAnimeAdvanced, fetchAnimeDetails } from '../services/anilist';
import { searchHentaiOcean } from '../services/hentaioceanService';
import { AnimeSceneFinderModal } from './AnimeSceneFinderModal';

interface SearchViewProps {
  userLibrary: UserMediaListItem[];
  onOpenDetails: (anime: Anime) => void;
  onPlayStream: (anime: Anime) => void;
  onUpdateStatus: (anime: Anime, status: MediaListStatus) => void;
  onUpdateProgress: (anime: Anime, progress: number) => void;
  onInspect3DCard?: (anime: Anime) => void;
  is18PlusMode?: boolean;
}

const ALL_GENRES = [
  'Action',
  'Adventure',
  'Comedy',
  'Drama',
  'Fantasy',
  'Horror',
  'Mahou Shoujo',
  'Mecha',
  'Music',
  'Mystery',
  'Psychological',
  'Romance',
  'Sci-Fi',
  'Slice of Life',
  'Sports',
  'Supernatural',
  'Thriller',
];

const FORMAT_OPTIONS = [
  { label: 'All Formats', value: '' },
  { label: 'TV Series', value: 'TV' },
  { label: 'TV Short', value: 'TV_SHORT' },
  { label: 'Movie', value: 'MOVIE' },
  { label: 'Special', value: 'SPECIAL' },
  { label: 'OVA', value: 'OVA' },
  { label: 'ONA (Web)', value: 'ONA' },
  { label: 'Music Video', value: 'MUSIC' },
];

const STATUS_OPTIONS = [
  { label: 'All Statuses', value: '' },
  { label: 'Airing / Releasing', value: 'RELEASING' },
  { label: 'Finished Airing', value: 'FINISHED' },
  { label: 'Not Yet Aired', value: 'NOT_YET_RELEASED' },
  { label: 'Cancelled', value: 'CANCELLED' },
  { label: 'On Hiatus', value: 'HIATUS' },
];

const SORT_OPTIONS = [
  { label: 'Most Popular', value: 'POPULARITY_DESC' },
  { label: 'Highest Rated', value: 'SCORE_DESC' },
  { label: 'Trending Now', value: 'TRENDING_DESC' },
  { label: 'Newest Released', value: 'START_DATE_DESC' },
  { label: 'Title (A-Z)', value: 'TITLE_ROMAJI' },
];

const YEARS_LIST = Array.from({ length: 27 }, (_, i) => 2026 - i); // 2026 down to 2000

export const SearchView: React.FC<SearchViewProps> = ({
  userLibrary,
  onOpenDetails,
  onPlayStream,
  onUpdateStatus,
  onUpdateProgress,
  onInspect3DCard,
  is18PlusMode = false,
}) => {
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedGenres, setSelectedGenres] = useState<string[]>([]);
  const [selectedStatus, setSelectedStatus] = useState<string>('');
  const [selectedFormat, setSelectedFormat] = useState<string>('');
  const [selectedYear, setSelectedYear] = useState<string>('');
  const [selectedSort, setSelectedSort] = useState<string>('POPULARITY_DESC');

  const [results, setResults] = useState<Anime[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [showFiltersPanel, setShowFiltersPanel] = useState(false);

  const [isSceneFinderOpen, setIsSceneFinderOpen] = useState(false);

  // Pre-compute O(1) user library lookup map
  const userLibraryMap = useMemo(() => {
    const map = new Map<number, UserMediaListItem>();
    userLibrary.forEach(item => map.set(item.mediaId, item));
    return map;
  }, [userLibrary]);

  const toggleGenre = useCallback((genre: string) => {
    setSelectedGenres(prev =>
      prev.includes(genre) ? prev.filter(g => g !== genre) : [...prev, genre]
    );
  }, []);

  const handleResetFilters = useCallback(() => {
    setSearchQuery('');
    setSelectedGenres([]);
    setSelectedStatus('');
    setSelectedFormat('');
    setSelectedYear('');
    setSelectedSort('POPULARITY_DESC');
  }, []);

  const activeFiltersCount = useMemo(() => {
    let count = selectedGenres.length;
    if (selectedStatus) count++;
    if (selectedFormat) count++;
    if (selectedYear) count++;
    if (selectedSort !== 'POPULARITY_DESC') count++;
    return count;
  }, [selectedGenres.length, selectedStatus, selectedFormat, selectedYear, selectedSort]);

  const handleSelectAnimeFromSceneFinder = async (anilistId: number) => {
    try {
      setIsLoading(true);
      const animeData = await fetchAnimeDetails(anilistId);
      if (animeData) {
        onOpenDetails(animeData);
      }
    } catch {
      // fallback
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    const timer = setTimeout(() => {
      const executeSearch = async () => {
        setIsLoading(true);
        try {
          if (is18PlusMode) {
            const searchData = await searchHentaiOcean(searchQuery.trim() || 'all');
            setResults(searchData);
          } else {
            const searchData = await searchAnimeAdvanced({
              search: searchQuery.trim() || undefined,
              genres: selectedGenres.length > 0 ? selectedGenres : undefined,
              status: selectedStatus || undefined,
              format: selectedFormat || undefined,
              seasonYear: selectedYear ? parseInt(selectedYear, 10) : undefined,
              sort: selectedSort,
            });
            setResults(searchData);
          }
        } catch (err) {
          console.error('Error fetching search results:', err);
        } finally {
          setIsLoading(false);
        }
      };

      executeSearch();
    }, 350);

    return () => {
      clearTimeout(timer);
    };
  }, [searchQuery, selectedGenres, selectedStatus, selectedFormat, selectedYear, selectedSort, is18PlusMode]);

  return (
    <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-6 space-y-6">
      {/* Search Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div className="space-y-1 text-left">
          <h1 className="text-2xl sm:text-3xl font-black text-white tracking-tight flex items-center gap-2.5">
            <Search className="w-6 h-6 text-pink-400" />
            <span>Anime Search & Discovery</span>
          </h1>
          <p className="text-xs sm:text-sm text-slate-400">
            Find anime by keywords, scene screenshots, or filter across genres, format, status, and release year.
          </p>
        </div>

        {/* Scene Finder Header Button */}
        <button
          type="button"
          onClick={() => setIsSceneFinderOpen(true)}
          className="px-4 py-2.5 bg-gradient-to-r from-pink-600 to-indigo-600 hover:from-pink-500 hover:to-indigo-500 text-white font-bold text-xs sm:text-sm rounded-2xl shadow-xl flex items-center gap-2 self-start sm:self-auto transition-all cursor-pointer active:scale-95"
        >
          <Camera className="w-4 h-4" />
          <span>Identify Anime Scene</span>
        </button>
      </div>

      {/* Primary Search Bar Container */}
      <div className="p-4 sm:p-5 rounded-3xl bg-white/5 border border-white/10 backdrop-blur-xl shadow-2xl space-y-4">
        <div className="flex items-center gap-3">
          <div className="relative flex-1">
            <Search className="w-5 h-5 text-slate-400 absolute left-4 top-1/2 -translate-y-1/2" />
            <input
              type="text"
              placeholder="Search by title, character, or keyword..."
              value={searchQuery}
              onChange={e => setSearchQuery(e.target.value)}
              className="w-full pl-12 pr-10 py-3.5 rounded-2xl bg-slate-900/60 border border-white/10 text-sm sm:text-base text-slate-100 placeholder-slate-400 focus:outline-none focus:border-pink-500 transition shadow-inner backdrop-blur-md"
            />
            {searchQuery && (
              <button
                type="button"
                onClick={() => setSearchQuery('')}
                className="absolute right-3.5 top-1/2 -translate-y-1/2 p-1 text-slate-400 hover:text-white transition cursor-pointer"
              >
                <X className="w-4 h-4" />
              </button>
            )}
          </div>

          <button
            type="button"
            onClick={() => setShowFiltersPanel(!showFiltersPanel)}
            className={`flex items-center gap-2 px-4 py-3.5 rounded-2xl text-xs sm:text-sm font-bold border transition shrink-0 backdrop-blur-md cursor-pointer ${
              showFiltersPanel || activeFiltersCount > 0
                ? 'bg-gradient-to-r from-pink-500 to-violet-600 border-pink-400/50 text-white shadow-lg shadow-pink-500/25'
                : 'bg-white/10 border-white/15 text-slate-200 hover:text-white hover:bg-white/15'
            }`}
          >
            <SlidersHorizontal className="w-4 h-4" />
            <span className="hidden sm:inline">Filters</span>
            {activeFiltersCount > 0 && (
              <span className="w-5 h-5 rounded-full bg-white text-pink-600 text-[11px] font-black flex items-center justify-center shadow-sm">
                {activeFiltersCount}
              </span>
            )}
          </button>
        </div>

        {/* Filter Panel */}
        {showFiltersPanel && (
          <div className="pt-4 border-t border-white/10 space-y-5 animate-fadeIn text-left">
            {/* Dropdowns Row: Format, Status, Release Year, Sort By */}
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
              {/* Format Select */}
              <div className="space-y-1.5">
                <label className="text-xs font-bold text-slate-300 block">Format</label>
                <select
                  value={selectedFormat}
                  onChange={e => setSelectedFormat(e.target.value)}
                  className="w-full px-3 py-2.5 rounded-xl bg-slate-900/80 border border-white/10 text-xs text-slate-200 font-medium outline-none focus:border-pink-500 transition cursor-pointer"
                >
                  {FORMAT_OPTIONS.map(opt => (
                    <option key={opt.value} value={opt.value} className="bg-slate-900 text-slate-100">
                      {opt.label}
                    </option>
                  ))}
                </select>
              </div>

              {/* Status Select */}
              <div className="space-y-1.5">
                <label className="text-xs font-bold text-slate-300 block">Status</label>
                <select
                  value={selectedStatus}
                  onChange={e => setSelectedStatus(e.target.value)}
                  className="w-full px-3 py-2.5 rounded-xl bg-slate-900/80 border border-white/10 text-xs text-slate-200 font-medium outline-none focus:border-pink-500 transition cursor-pointer"
                >
                  {STATUS_OPTIONS.map(opt => (
                    <option key={opt.value} value={opt.value} className="bg-slate-900 text-slate-100">
                      {opt.label}
                    </option>
                  ))}
                </select>
              </div>

              {/* Release Year Select */}
              <div className="space-y-1.5">
                <label className="text-xs font-bold text-slate-300 block">Release Year</label>
                <select
                  value={selectedYear}
                  onChange={e => setSelectedYear(e.target.value)}
                  className="w-full px-3 py-2.5 rounded-xl bg-slate-900/80 border border-white/10 text-xs text-slate-200 font-medium outline-none focus:border-pink-500 transition cursor-pointer"
                >
                  <option value="" className="bg-slate-900 text-slate-100">All Years</option>
                  {YEARS_LIST.map(y => (
                    <option key={y} value={y} className="bg-slate-900 text-slate-100">
                      {y}
                    </option>
                  ))}
                </select>
              </div>

              {/* Sort Order Select */}
              <div className="space-y-1.5">
                <label className="text-xs font-bold text-slate-300 block">Sort By</label>
                <select
                  value={selectedSort}
                  onChange={e => setSelectedSort(e.target.value)}
                  className="w-full px-3 py-2.5 rounded-xl bg-slate-900/80 border border-white/10 text-xs text-slate-200 font-medium outline-none focus:border-pink-500 transition cursor-pointer"
                >
                  {SORT_OPTIONS.map(opt => (
                    <option key={opt.value} value={opt.value} className="bg-slate-900 text-slate-100">
                      {opt.label}
                    </option>
                  ))}
                </select>
              </div>
            </div>

            {/* Genres Tag Cloud */}
            <div>
              <span className="text-xs font-bold text-slate-300 block mb-2">Genres</span>
              <div className="flex flex-wrap gap-1.5">
                {ALL_GENRES.map(genre => {
                  const isSelected = selectedGenres.includes(genre);
                  return (
                    <button
                      key={genre}
                      type="button"
                      onClick={() => toggleGenre(genre)}
                      className={`px-3 py-1.5 rounded-xl text-xs font-medium border transition cursor-pointer ${
                        isSelected
                          ? 'bg-pink-600 text-white border-pink-500 shadow-sm font-bold'
                          : 'bg-slate-900/40 text-slate-300 border-white/10 hover:bg-slate-800'
                      }`}
                    >
                      {genre}
                    </button>
                  );
                })}
              </div>
            </div>

            {/* Reset Filters Footer */}
            <div className="flex justify-between items-center pt-2 border-t border-white/10">
              <span className="text-xs text-slate-400">
                {activeFiltersCount > 0 ? `${activeFiltersCount} filter(s) active` : 'No extra filters active'}
              </span>
              <button
                type="button"
                onClick={handleResetFilters}
                className="flex items-center gap-1.5 text-xs font-semibold text-pink-400 hover:text-pink-300 transition cursor-pointer"
              >
                <RotateCcw className="w-3.5 h-3.5" />
                <span>Reset All Filters</span>
              </button>
            </div>
          </div>
        )}
      </div>

      {/* Results Section */}
      {isLoading ? (
        <div className="p-12 text-center text-slate-400">
          <div className="w-8 h-8 border-2 border-pink-500 border-t-transparent rounded-full animate-spin mx-auto mb-3" />
          <p className="text-sm">Searching anime catalog...</p>
        </div>
      ) : results.length > 0 ? (
        <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 xl:grid-cols-6 gap-4">
          {results.map(anime => (
            <AnimeCard
              key={anime.id}
              anime={anime}
              userItem={userLibraryMap.get(anime.id)}
              onOpenDetails={onOpenDetails}
              onPlayStream={onPlayStream}
              onUpdateStatus={onUpdateStatus}
              onUpdateProgress={onUpdateProgress}
              onInspect3DCard={onInspect3DCard}
            />
          ))}
        </div>
      ) : (
        <div className="p-12 text-center text-slate-400 bg-white/5 rounded-3xl border border-white/10">
          <p className="text-sm">No anime found matching your criteria.</p>
        </div>
      )}

      {/* Trace.moe Scene Finder Modal */}
      <AnimeSceneFinderModal
        isOpen={isSceneFinderOpen}
        onClose={() => setIsSceneFinderOpen(false)}
        onSelectAnime={handleSelectAnimeFromSceneFinder}
      />
    </div>
  );
};
