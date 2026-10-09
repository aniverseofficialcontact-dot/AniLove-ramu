import { Anime, AnimeDetail, AiringScheduleItem, AniListUser, MediaListStatus, UserMediaListItem } from '../types';
import {
  fetchComixHomeFeed,
  fetchComixCatalogForHome,
  searchComix,
  fetchComixTitleDetails,
  comixToAnime,
} from './comixService';

export const ANILIST_API_URL = 'https://comix.to';
export const ANILIST_CLIENT_ID = '49024';

export function getAniListAuthUrl(): string {
  return '#';
}

export const getOAuthLoginUrl = getAniListAuthUrl;

export function parseOAuthTokenFromHash(): string | null {
  return null;
}

export function sanitizeDescription(raw?: string): string {
  if (!raw) return 'No synopsis available for this title.';
  return raw
    .replace(/~!\s*([\s\S]*?)\s*!~/g, '$1')
    .replace(/<br\s*[\/]?>/gi, '\n')
    .replace(/<\/?[^>]+(>|$)/g, '')
    .replace(/\[([^\]]+)\]\([^)]+\)/g, '$1')
    .replace(/__|\*\*|\*|~~/g, '')
    .trim();
}

export function getCurrentSeasonAndYear(): { season: 'WINTER' | 'SPRING' | 'SUMMER' | 'FALL'; year: number } {
  const date = new Date();
  const month = date.getMonth();
  const year = date.getFullYear();

  if (month >= 0 && month <= 2) return { season: 'WINTER', year };
  if (month >= 3 && month <= 5) return { season: 'SPRING', year };
  if (month >= 6 && month <= 8) return { season: 'SUMMER', year };
  return { season: 'FALL', year };
}

export interface HomeFeedData {
  trending: Anime[];
  popular: Anime[];
  topRated: Anime[];
  newest: Anime[];
  upcoming: Anime[];
  movies: Anime[];
  action: Anime[];
  fantasy: Anime[];
  romcom: Anime[];
}

/**
 * 100% Comix.to Driven Home Feed
 */
export async function fetchHomeFeed(perPage: number = 14): Promise<HomeFeedData> {
  const comixFeed = await fetchComixCatalogForHome();
  return {
    trending: comixFeed.trending.slice(0, perPage),
    popular: comixFeed.popular.slice(0, perPage),
    topRated: comixFeed.topRated.slice(0, perPage),
    newest: comixFeed.newest.slice(0, perPage),
    upcoming: comixFeed.upcoming.slice(0, perPage),
    movies: comixFeed.movies.slice(0, perPage),
    action: comixFeed.action.slice(0, perPage),
    fantasy: comixFeed.fantasy.slice(0, perPage),
    romcom: comixFeed.romcom.slice(0, perPage),
  };
}

export async function fetchTrendingAnime(page: number = 1, perPage: number = 18): Promise<Anime[]> {
  const feed = await fetchComixHomeFeed();
  return feed.trending.map((item, idx) => comixToAnime(item, idx)).slice(0, perPage);
}

export async function fetchPopularAnime(page: number = 1, perPage: number = 18): Promise<Anime[]> {
  const feed = await fetchComixHomeFeed();
  return feed.mostFollowed.map((item, idx) => comixToAnime(item, idx)).slice(0, perPage);
}

export const fetchPopularSeason = fetchPopularAnime;

export async function fetchTopRatedAnime(page: number = 1, perPage: number = 18): Promise<Anime[]> {
  return fetchTrendingAnime(page, perPage);
}

export async function fetchNewestAnime(page: number = 1, perPage: number = 18): Promise<Anime[]> {
  const feed = await fetchComixHomeFeed();
  return feed.newestAdditions.map((item, idx) => comixToAnime(item, idx)).slice(0, perPage);
}

export async function fetchUpcomingAnime(page: number = 1, perPage: number = 18): Promise<Anime[]> {
  const feed = await fetchComixHomeFeed();
  return feed.hotUpdates.map((item, idx) => comixToAnime(item, idx)).slice(0, perPage);
}

export async function fetchTopMoviesAnime(page: number = 1, perPage: number = 18): Promise<Anime[]> {
  return fetchNewestAnime(page, perPage);
}

export async function fetchGenreAnime(
  genre: string,
  sort: string = 'POPULARITY_DESC',
  page: number = 1,
  perPage: number = 18
): Promise<Anime[]> {
  const results = await searchComix('', { genres: genre.toLowerCase(), page });
  return results.map((item, idx) => comixToAnime(item, idx)).slice(0, perPage);
}

export async function fetchVastArcadeAnimePool(): Promise<Anime[]> {
  const feed = await fetchComixHomeFeed();
  const all = [...feed.trending, ...feed.mostFollowed, ...feed.newestAdditions].map((item, idx) =>
    comixToAnime(item, idx)
  );
  return all.sort(() => Math.random() - 0.5);
}

export async function fetchRomComAnime(page: number = 1, perPage: number = 18): Promise<Anime[]> {
  return fetchGenreAnime('romance', 'POPULARITY_DESC', page, perPage);
}

export async function fetchSeasonalAnime(
  season: 'WINTER' | 'SPRING' | 'SUMMER' | 'FALL',
  seasonYear: number,
  format?: string,
  sort: string = 'POPULARITY_DESC',
  page: number = 1,
  perPage: number = 36
): Promise<Anime[]> {
  return fetchTrendingAnime(page, perPage);
}

/**
 * 100% Comix.to Search Provider
 */
export async function searchAnimeAdvanced({
  search,
  genres = [],
  status,
  format,
  seasonYear,
  sort = 'POPULARITY_DESC',
  page = 1,
  perPage = 36,
}: {
  search?: string;
  genres?: string[];
  status?: string;
  format?: string;
  seasonYear?: number;
  sort?: string;
  page?: number;
  perPage?: number;
}): Promise<Anime[]> {
  const cleanSearch = search ? search.trim() : '';
  const genreStr = genres.length > 0 && !genres.includes('All') ? genres.join(',').toLowerCase() : undefined;

  const results = await searchComix(cleanSearch, { genres: genreStr, page });
  return results.map((item, idx) => comixToAnime(item, idx)).slice(0, perPage);
}

export async function searchAnime(
  queryOrOptions: string | { search?: string; genre?: string; status?: string; sort?: string; page?: number; perPage?: number },
  page: number = 1,
  perPage: number = 24
): Promise<Anime[]> {
  let searchStr = '';
  if (typeof queryOrOptions === 'string') {
    searchStr = queryOrOptions;
  } else if (queryOrOptions && typeof queryOrOptions === 'object') {
    searchStr = queryOrOptions.search || '';
  }

  const results = await searchComix(searchStr.trim(), { page });
  return results.map((item, idx) => comixToAnime(item, idx)).slice(0, perPage);
}

export async function fetchAiringSchedule(airingAt_greater: number, airingAt_lesser: number): Promise<AiringScheduleItem[]> {
  return [];
}

/**
 * 100% Comix.to Title Details Provider
 */
export async function fetchAnimeDetails(id: number | string): Promise<AnimeDetail> {
  const strId = String(id);

  try {
    const detailData = await fetchComixTitleDetails(strId).catch(() => null);
    if (detailData) {
      const item = {
        id: detailData.hid || detailData.id || strId,
        title: detailData.title || 'Manga Title',
        poster: detailData.poster?.large || detailData.poster?.medium,
        synopsis: detailData.synopsis,
        status: detailData.status,
        score: detailData.ratedAvg,
        type: detailData.type,
        genres: Array.isArray(detailData.genres) ? detailData.genres.map((g: any) => g.title || g.label) : [],
        latestChapter: detailData.latestChapter,
      };

      const animeObj = comixToAnime(item as any);
      return {
        ...animeObj,
        recommendations: {
          nodes: (detailData.recommended || []).map((rec: any, idx: number) => ({
            id: idx,
            mediaRecommendation: comixToAnime(rec, idx),
          })),
        },
      } as AnimeDetail;
    }
  } catch (e) {
    console.warn('[anilist.ts] Comix title details notice:', e);
  }

  // Fallback searchComix
  const searchResults = await searchComix(strId).catch(() => []);
  if (searchResults.length > 0) {
    return comixToAnime(searchResults[0]) as AnimeDetail;
  }

  return comixToAnime({
    id: strId,
    hid: strId,
    title: 'Comix Manga',
    poster: null,
  }) as AnimeDetail;
}

export const fetchMangaDetails = fetchAnimeDetails;

export async function fetchAnimeByStudio(studioName: string, page: number = 1, perPage: number = 40): Promise<Anime[]> {
  return searchAnime(studioName, page, perPage);
}

export async function fetchUserAnimeList(username: string): Promise<UserMediaListItem[]> {
  return [];
}

export async function fetchAniListUserProfile(username: string): Promise<AniListUser> {
  return {
    id: 1,
    name: username,
    avatar: { large: '', medium: '' },
  };
}

export const fetchUserMediaList = fetchUserAnimeList;

export async function fetchAuthenticatedViewer(accessToken: string): Promise<AniListUser> {
  return {
    id: 1,
    name: 'Comix User',
    avatar: { large: '', medium: '' },
  };
}

export const fetchViewerProfile = fetchAuthenticatedViewer;

export async function syncMediaListEntryToAniList(): Promise<any> {
  return { id: 1, status: 'CURRENT', progress: 1, score: 10 };
}

export const saveMediaListEntry = syncMediaListEntryToAniList;

export async function deleteMediaListEntry(): Promise<boolean> {
  return true;
}

export async function executeQuery<T>(): Promise<T> {
  return {} as T;
}
