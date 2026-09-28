import React, { useState, useEffect, useTransition } from 'react';
import { Search, Filter, X, Sparkles, RefreshCw, Layers, SlidersHorizontal, Check, Camera } from 'lucide-react';
import { Anime, UserMediaListItem, MediaListStatus } from '../types';
import { AnimeCard } from './AnimeCard';
import { searchAnimeAdvanced, fetchAnimeByStudio, fetchAnimeDetails } from '../services/anilist';
import { AnimeSceneFinderModal } from './AnimeSceneFinderModal';

interface SearchViewProps {
  initialStudio?: string | null;
  onClearStudio?: () => void;
  userLibrary: UserMediaListItem[];
  onOpenDetails: (anime: Anime) => void;
  onPlayStream: (anime: Anime) => void;
  onUpdateStatus: (anime: Anime, status: MediaListStatus) => void;
  onUpdateProgress: (anime: Anime, progress: number) => void;
  onSelectGenre: (genre: string) => void;
  onSelectStudio: (studio: string) => void;
  onInspect3DCard?: (anime: Anime) => void;
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

export const SearchView: React.FC<SearchViewProps> = ({
  initialStudio,
  onClearStudio,
  userLibrary,
  onOpenDetails,
  onPlayStream,
  onUpdateStatus,
  onUpdateProgress,
  onSelectGenre,
  onSelectStudio,
  onInspect3DCard,
}) => {
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedGenres, setSelectedGenres] = useState<string[]>([]);
  const [selectedStatus, setSelectedStatus] = useState<string>('');
  const [selectedFormat, setSelectedFormat] = useState<string>('');
  const [selectedYear, setSelectedYear] = useState<string>('');
  const [selectedSort, setSelectedSort] = useState<string>('POPULARITY_DESC');
  const [activeStudio, setActiveStudio] = useState<string | null>(initialStudio || null);

  const [results, setResults] = useState<Anime[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [showFiltersPanel, setShowFiltersPanel] = useState(false);
  const [isPending, startTransition] = useTransition();

  const [isSceneFinderOpen, setIsSceneFinderOpen] = useState(false);

  useEffect(() => {
    setActiveStudio(initialStudio || null);
  }, [initialStudio]);

  const toggleGenre = (genre: string) => {
    setSelectedGenres(prev =>
      prev.includes(genre) ? prev.filter(g => g !== genre) : [...prev, genre]
    );
  };

  const handleResetFilters = () => {
    setSearchQuery('');
    setSelectedGenres([]);
    setSelectedStatus('');
    setSelectedFormat('');
    setSelectedYear('');
    setSelectedSort('POPULARITY_DESC');
    setActiveStudio(null);
    if (onClearStudio) onClearStudio();
  };

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
          if (activeStudio && !searchQuery.trim() && selectedGenres.length === 0) {
            const studioData = await fetchAnimeByStudio(activeStudio);
            setResults(studioData);
          } else {
            const searchData = await searchAnimeAdvanced({
              search: searchQuery.trim() || undefined,
              genres: selectedGenres.length > 0 ? selectedGenres : undefined,
              status: selectedStatus || undefined,
              format: selectedFormat || undefined,
              year: selectedYear ? parseInt(selectedYear, 10) : undefined,
              sort: [selectedSort],
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
  }, [searchQuery, selectedGenres, selectedStatus, selectedFormat, selectedYear, selectedSort, activeStudio]);

  return (
    <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-6 space-y-6">
      {/* Search Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div className="space-y-1">
          <h1 className="text-2xl sm:text-3xl font-black text-white tracking-tight flex items-center gap-2.5">
            <Search className="w-6 h-6 text-pink-400" />
            <span>Anime Search & Discovery</span>
          </h1>
          <p className="text-xs sm:text-sm text-slate-400">
            Find anime by keywords, scene screenshots, or filter across genres and release formats.
          </p>
        </div>

        {/* Scene Finder Header Button */}
        <button
          onClick={() => setIsSceneFinderOpen(true)}
          className="px-4 py-2.5 bg-gradient-to-r from-pink-600 to-indigo-600 hover:from-pink-500 hover:to-indigo-500 text-white font-bold text-xs sm:text-sm rounded-2xl shadow-xl flex items-center gap-2 self-start sm:self-auto transition-all"
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
              placeholder={activeStudio ? `Search anime produced by ${activeStudio}...` : "Search by title, character, or keyword..."}
              value={searchQuery}
              onChange={e => setSearchQuery(e.target.value)}
              className="w-full pl-12 pr-10 py-3.5 rounded-2xl bg-slate-900/60 border border-white/10 text-sm sm:text-base text-slate-100 placeholder-slate-400 focus:outline-none focus:border-pink-500 transition shadow-inner backdrop-blur-md"
            />
            {searchQuery && (
              <button
                type="button"
                onClick={() => setSearchQuery('')}
                className="absolute right-3.5 top-1/2 -translate-y-1/2 p-1 text-slate-400 hover:text-white transition"
              >
                <X className="w-4 h-4" />
              </button>
            )}
          </div>

          <button
            type="button"
            onClick={() => setShowFiltersPanel(!showFiltersPanel)}
            className={`flex items-center gap-2 px-4 py-3.5 rounded-2xl text-xs sm:text-sm font-bold border transition shrink-0 backdrop-blur-md ${
              showFiltersPanel
                ? 'bg-gradient-to-r from-pink-500 to-violet-600 border-pink-400/50 text-white shadow-lg shadow-pink-500/25'
                : 'bg-white/10 border-white/15 text-slate-200 hover:text-white hover:bg-white/15'
            }`}
          >
            <SlidersHorizontal className="w-4 h-4" />
            <span className="hidden sm:inline">Filters</span>
          </button>
        </div>

        {/* Filter Panel */}
        {showFiltersPanel && (
          <div className="pt-4 border-t border-white/10 space-y-4 animate-fadeIn">
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
                      className={`px-3 py-1.5 rounded-xl text-xs font-medium border transition ${
                        isSelected
                          ? 'bg-pink-600 text-white border-pink-500 shadow-sm'
                          : 'bg-slate-900/40 text-slate-300 border-white/10 hover:bg-slate-800'
                      }`}
                    >
                      {genre}
                    </button>
                  );
                })}
              </div>
            </div>

            <div className="flex justify-end pt-2">
              <button
                type="button"
                onClick={handleResetFilters}
                className="text-xs font-semibold text-pink-400 hover:text-pink-300 underline"
              >
                Reset All Filters
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
              userLibrary={userLibrary}
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
