import { Manga, MangaChapter, MangaPage } from '../types';

/**
 * Direct Client-Side Service for Comix.to API
 * Executes network requests directly from the user's mobile device (native IP)
 */

const HEADERS: Record<string, string> = {
  'User-Agent':
    'Mozilla/5.0 (Linux; Android 14; Mobile) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/122.0.0.0 Mobile Safari/537.36',
  'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,image/avif,image/webp,*/*;q=0.8',
  'Accept-Language': 'en-US,en;q=0.9',
  'Referer': 'https://comix.to/',
};

/**
 * Fetch HTML directly from Comix.to
 */
export async function fetchHtmlNative(targetUrl: string): Promise<string> {
  const res = await fetch(targetUrl, {
    method: 'GET',
    headers: HEADERS,
  });

  if (!res.ok) {
    throw new Error(`Failed to fetch Comix source page (${res.status}): ${res.statusText}`);
  }
  return await res.text();
}

/**
 * Helper: Parse embedded initial-data JSON from Comix.to HTML
 */
export function parseInitialData(html: string): any | null {
  const match =
    html.match(/<script[^>]*id=["']initial-data["'][^>]*>(.*?)<\/script>/s) ||
    html.match(/<script[^>]*>(\{"page":.*?)</s);

  if (match) {
    try {
      return JSON.parse(match[1]);
    } catch (e) {
      console.error('[comixService] JSON parse error:', e);
    }
  }
  return null;
}

/**
 * Helper: Extract chapter pages / image URLs from HTML or script payload
 */
export function extractChapterImages(html: string): { pageNumber: number; url: string }[] {
  const pages: { pageNumber: number; url: string }[] = [];

  // 1. Check embedded initial-data read object
  const initData = parseInitialData(html);
  if (initData && initData.read) {
    const readInfo = initData.read;
    const pagesData = readInfo.pages || readInfo.images || readInfo.items;

    if (Array.isArray(pagesData)) {
      pagesData.forEach((img: any, i: number) => {
        const imgUrl = typeof img === 'string' ? img : img.url || img.src || img.path;
        if (imgUrl) {
          pages.push({
            pageNumber: i + 1,
            url: imgUrl.startsWith('http') ? imgUrl : `https://static.comix.to${imgUrl.startsWith('/') ? '' : '/'}${imgUrl}`,
          });
        }
      });
      if (pages.length > 0) return pages;
    } else if (pagesData && typeof pagesData === 'object' && Array.isArray(pagesData.items)) {
      const baseUrl = pagesData.baseUrl || 'https://static.comix.to/';
      pagesData.items.forEach((item: any, i: number) => {
        const urlPart = item.url || item.path || item.src;
        if (urlPart) {
          pages.push({
            pageNumber: i + 1,
            url: urlPart.startsWith('http') ? urlPart : `${baseUrl.replace(/\/$/, '')}/${urlPart.replace(/^\//, '')}`,
          });
        }
      });
      if (pages.length > 0) return pages;
    }
  }

  // 2. Look for "images": [...] in any script tag
  const jsonMatches = html.match(/"images":\s*(\[[^\]]+\])/);
  if (jsonMatches) {
    try {
      const parsed = JSON.parse(jsonMatches[1]);
      parsed.forEach((img: any, i: number) => {
        const imgUrl = typeof img === 'string' ? img : img.url || img.src;
        if (imgUrl) {
          pages.push({
            pageNumber: i + 1,
            url: imgUrl.startsWith('http') ? imgUrl : `https://static.comix.to${imgUrl}`,
          });
        }
      });
      if (pages.length > 0) return pages;
    } catch (e) {}
  }

  // 3. Look for static.comix.to image URLs in HTML
  const imgMatches = html.match(/https:\/\/static\.comix\.to\/[^\s"'<>]+\.(?:jpg|jpeg|png|webp)/gi);
  if (imgMatches && imgMatches.length > 0) {
    const uniqueImgs = [...new Set(imgMatches)].filter(
      (img) => !img.includes('@280') && !img.includes('avatar') && !img.includes('poster')
    );
    uniqueImgs.forEach((url, i) => {
      pages.push({
        pageNumber: i + 1,
        url: url,
      });
    });
  }

  return pages;
}

// ==========================================
// DATA TYPES & INTERFACES
// ==========================================

export interface ComixMangaItem {
  id: string;
  hid: string;
  title: string;
  slug?: string;
  poster: string | null;
  type?: string;
  latestChapter?: string;
  status?: string;
  score?: number;
  synopsis?: string;
  genres?: string[];
  altTitles?: string[];
}

export interface ComixHomeSections {
  trending: ComixMangaItem[];
  mostFollowed: ComixMangaItem[];
  hotUpdates: ComixMangaItem[];
  newAdditions: ComixMangaItem[];
  collections: any[];
  topUploaders: any[];
}

export interface ComixFilterOptions {
  genres: { id: number; label: string; slug: string }[];
  types: { id: string; label: string }[];
  statuses: { id: string; label: string }[];
  sorts: { id: string; label: string }[];
}

// ==========================================
// ENDPOINT 1: HOMEPAGE SECTIONS (/api/home)
// ==========================================

export async function fetchComixHomeFeed(): Promise<ComixHomeSections> {
  try {
    const html = await fetchHtmlNative('https://comix.to/');
    const initData = parseInitialData(html);
    if (!initData) throw new Error('Failed to parse Comix home payload');

    const queries = initData.queries || {};
    let trendingRaw: any[] = [];
    let mostFollowedRaw: any[] = [];
    let hotUpdatesRaw: any[] = [];
    let newAdditionsRaw: any[] = [];

    for (const [k, v] of Object.entries(queries)) {
      if (k.includes('"trending"')) trendingRaw = Array.isArray(v) ? v : [];
      else if (k.includes('"follows"')) mostFollowedRaw = Array.isArray(v) ? v : [];
      else if (k.includes('"scope":"hot"')) hotUpdatesRaw = Array.isArray(v) ? v : (v as any)?.items || [];
      else if (k.includes('"created_at":"desc"')) newAdditionsRaw = Array.isArray(v) ? v : (v as any)?.items || [];
    }

    const mapItem = (item: any): ComixMangaItem => {
      const hid = item.hid || item.hash_id || '';
      const slug = item.slug || '';
      const id = item.url ? item.url.replace('/title/', '') : `${hid}-${slug}`;
      return {
        id,
        hid,
        title: item.title || 'Untitled',
        slug,
        poster: item.poster?.large || item.poster?.medium || null,
        type: item.type,
        latestChapter: item.latestChapter !== undefined ? `Ch.${item.latestChapter}` : undefined,
        status: item.status,
        score: item.ratedAvg || item.rated_avg,
        synopsis: item.synopsis,
        genres: Array.isArray(item.genres) ? item.genres.map((g: any) => g.title || g.label) : [],
      };
    };

    return {
      trending: trendingRaw.map(mapItem),
      mostFollowed: mostFollowedRaw.map(mapItem),
      hotUpdates: hotUpdatesRaw.map(mapItem),
      newAdditions: newAdditionsRaw.map(mapItem),
      collections: queries['["collections","list",{"sort":"newest","limit":10}]']?.items || [],
      topUploaders: queries['["users","topUploaders"]'] || [],
    };
  } catch (err) {
    console.error('[comixService] Home feed error:', err);
    return {
      trending: [],
      mostFollowed: [],
      hotUpdates: [],
      newAdditions: [],
      collections: [],
      topUploaders: [],
    };
  }
}

// ==========================================
// ENDPOINT 2: GENRES & FILTERS (/api/genres)
// ==========================================

export async function fetchComixGenresAndFilters(): Promise<ComixFilterOptions> {
  try {
    const html = await fetchHtmlNative('https://comix.to/browse');
    const initData = parseInitialData(html);
    const options = initData?.list?.options;

    if (options && options.genres) {
      return options;
    }
  } catch (err) {
    console.warn('[comixService] Filter options fallback:', err);
  }

  return {
    genres: [
      { id: 6, label: 'Action', slug: 'action' },
      { id: 7, label: 'Adventure', slug: 'adventure' },
      { id: 9, label: 'Comedy', slug: 'comedy' },
      { id: 11, label: 'Drama', slug: 'drama' },
      { id: 12, label: 'Fantasy', slug: 'fantasy' },
      { id: 16, label: 'Isekai', slug: 'isekai' },
      { id: 19, label: 'Martial Arts', slug: 'martial-arts' },
      { id: 22, label: 'Mystery', slug: 'mystery' },
      { id: 25, label: 'Romance', slug: 'romance' },
      { id: 28, label: 'Sci-Fi', slug: 'sci-fi' },
      { id: 31, label: 'Shounen', slug: 'shounen' },
      { id: 34, label: 'Slice of Life', slug: 'slice-of-life' },
      { id: 37, label: 'Supernatural', slug: 'supernatural' },
    ],
    types: [
      { id: 'manga', label: 'Manga' },
      { id: 'manhwa', label: 'Manhwa' },
      { id: 'manhua', label: 'Manhua' },
      { id: 'other', label: 'Other' },
    ],
    statuses: [
      { id: 'releasing', label: 'Releasing' },
      { id: 'finished', label: 'Finished' },
      { id: 'on_hiatus', label: 'On Hiatus' },
    ],
    sorts: [
      { id: 'relevance:desc', label: 'Relevance' },
      { id: 'chapter_updated_at:desc', label: 'Latest Updated' },
      { id: 'created_at:desc', label: 'Newest Added' },
      { id: 'follows:desc', label: 'Most Followed' },
    ],
  };
}

// ==========================================
// ENDPOINT 3: SEARCH & BROWSE (/api/search)
// ==========================================

export async function searchComix(
  query: string = '',
  options?: { genres?: string; sort?: string; page?: number }
): Promise<ComixMangaItem[]> {
  try {
    const page = options?.page || 1;
    let targetUrl = `https://comix.to/browse?page=${page}`;
    if (query) targetUrl += `&keyword=${encodeURIComponent(query)}`;
    if (options?.genres) targetUrl += `&genres=${encodeURIComponent(options.genres)}`;
    if (options?.sort) targetUrl += `&sort=${encodeURIComponent(options.sort)}`;

    const html = await fetchHtmlNative(targetUrl);
    const initData = parseInitialData(html);

    const queries = initData?.queries || {};
    let items: any[] = [];

    for (const [_, v] of Object.entries(queries)) {
      if (v && typeof v === 'object' && Array.isArray((v as any).items)) {
        items = (v as any).items;
        break;
      }
    }

    if (items.length === 0 && !query) {
      const homeFeed = await fetchComixHomeFeed();
      return homeFeed.trending;
    }

    return items.map((item: any) => {
      const hid = item.hid || item.hash_id || '';
      const slug = item.slug || '';
      const id = item.url ? item.url.replace('/title/', '') : `${hid}-${slug}`;

      return {
        id,
        hid,
        title: item.title || 'Untitled',
        slug,
        poster: item.poster?.large || item.poster?.medium || null,
        type: item.type,
        latestChapter: item.latestChapter !== undefined ? `Ch.${item.latestChapter}` : undefined,
        status: item.status,
        score: item.ratedAvg || item.rated_avg,
        synopsis: item.synopsis,
        genres: Array.isArray(item.genres) ? item.genres.map((g: any) => g.title || g.label) : [],
      };
    });
  } catch (err) {
    console.error('[comixService] Search error:', err);
    return [];
  }
}

// ==========================================
// ENDPOINT 4: TITLE DETAILS (/api/title/:id)
// ==========================================

export async function fetchComixTitleDetails(titleId: string): Promise<any | null> {
  try {
    const targetUrl = titleId.startsWith('http') ? titleId : `https://comix.to/title/${titleId}`;
    const html = await fetchHtmlNative(targetUrl);
    const initData = parseInitialData(html);

    if (!initData) return null;

    const queries = initData.queries || {};
    let mangaDetail = initData.manga || null;
    let recommended = [];

    for (const [k, v] of Object.entries(queries)) {
      if (k.includes('"detail"')) mangaDetail = v;
      else if (k.includes('"recommended"')) recommended = (v as any).items || v;
    }

    if (!mangaDetail) return null;

    return {
      ...mangaDetail,
      recommended,
    };
  } catch (err) {
    console.error('[comixService] Title details error:', err);
    return null;
  }
}

// ==========================================
// ENDPOINT 5: CHAPTERS LIST (/api/title/:id/chapters)
// ==========================================

export async function fetchComixChapters(comixIdOrHash: string, page: number = 1): Promise<MangaChapter[]> {
  const cleanId = comixIdOrHash.startsWith('comix_') ? comixIdOrHash.replace('comix_', '') : comixIdOrHash;
  let titleSlug = cleanId;

  if (/^\d+$/.test(cleanId)) {
    const hid = await getComixHidForManga({ id: cleanId } as any);
    if (hid) titleSlug = hid;
  }

  try {
    const targetUrl = `https://comix.to/title/${titleSlug}?page=${page}`;
    const html = await fetchHtmlNative(targetUrl);
    const initData = parseInitialData(html);

    const queries = initData?.queries || {};
    let chaptersList: any[] = [];

    for (const [k, v] of Object.entries(queries)) {
      if (k.includes('"chapters"')) {
        chaptersList = Array.isArray(v) ? v : (v as any)?.items || [];
        break;
      }
    }

    // Fallback: Parse chapter links from raw HTML using regex
    if (chaptersList.length === 0) {
      const linkMatches = Array.from(html.matchAll(/href=["'](\/title\/[^"']+\/(\d+)-chapter-([^"']+))["']/gi));
      const uniqueMap = new Map();
      linkMatches.forEach((m) => {
        const fullPath = m[1];
        const chapterId = m[2];
        const chapterNum = m[3];
        if (!uniqueMap.has(chapterId)) {
          uniqueMap.set(chapterId, {
            id: chapterId,
            number: chapterNum,
            title: `Chapter ${chapterNum}`,
            url: fullPath,
          });
        }
      });
      chaptersList = Array.from(uniqueMap.values());
    }

    return chaptersList.map((item: any) => {
      const chNum = String(item.number || item.chapter || item.chap || '1');
      const chTitle = item.title ? String(item.title).trim() : '';
      const slugPart = item.url ? item.url.split('/').pop() : `${item.id || item.hid || 'ch'}-chapter-${chNum}`;

      return {
        id: `comix_${titleSlug}___${slugPart}`,
        chapterNumber: chNum,
        title: chTitle ? `Chapter ${chNum}: ${chTitle}` : `Chapter ${chNum}`,
        volume: item.vol ? String(item.vol) : undefined,
        language: 'en',
        scanlationGroup: item.group?.name || item.group_name || 'Comix Group',
        publishAt: item.created_at || item.createdAt || item.updated_at,
        pagesCount: typeof item.total_pages === 'number' ? item.total_pages : undefined,
      };
    });
  } catch (err) {
    console.error('[comixService] Error fetching Comix chapters:', err);
    return [];
  }
}

// ==========================================
// ENDPOINT 6: CHAPTER READER PAGES (/api/chapter/...)
// ==========================================

export async function fetchComixChapterPages(chapterId: string): Promise<MangaPage[]> {
  try {
    let cleanId = chapterId.startsWith('comix_') ? chapterId.replace('comix_', '') : chapterId;

    let targetUrl = `https://comix.to/title/${cleanId}`;
    if (cleanId.includes('___')) {
      const [titleSlug, chapSlug] = cleanId.split('___');
      targetUrl = `https://comix.to/title/${titleSlug}/${chapSlug}`;
    } else if (cleanId.includes('_')) {
      const parts = cleanId.split('_');
      targetUrl = `https://comix.to/title/${parts[0]}/${parts[1]}`;
    }

    const html = await fetchHtmlNative(targetUrl);
    const pages = extractChapterImages(html);

    return pages.map((p) => ({
      pageNumber: p.pageNumber,
      url: p.url,
    }));
  } catch (err) {
    console.error('[comixService] Error fetching Comix chapter pages:', err);
    return [];
  }
}

// ==========================================
// MAPPER: COMIX TO APP MANGA MODEL
// ==========================================

export function mapComixToManga(comixItem: ComixMangaItem): Manga {
  return {
    id: comixItem.id,
    title: {
      userPreferred: comixItem.title,
      english: comixItem.title,
      romaji: comixItem.title,
    },
    coverImage: {
      extraLarge: comixItem.poster || '',
      large: comixItem.poster || '',
      medium: comixItem.poster || '',
    },
    bannerImage: comixItem.poster || '',
    description: comixItem.synopsis || `Read ${comixItem.title} on Comix.to`,
    status: comixItem.status || 'RELEASING',
    genres: comixItem.genres || [],
    averageScore: comixItem.score ? Math.round(comixItem.score * 10) : 80,
    format: (comixItem.type || 'MANGA').toUpperCase(),
    chapters: comixItem.latestChapter ? parseInt(comixItem.latestChapter.replace(/\D/g, '')) || 100 : 100,
  };
}

/**
 * Converts a ComixMangaItem into the standard Anime model used across MangaLove
 */
export function comixToAnime(item: ComixMangaItem, idx?: number): any {
  const strId = item.id || item.hid || item.title;
  let hash = 0;
  for (let i = 0; i < strId.length; i++) {
    hash = (hash << 5) - hash + strId.charCodeAt(i);
    hash |= 0;
  }
  const numericId = Math.abs(hash) || (idx ? idx + 900000 : 900001);

  return {
    id: numericId,
    hid: item.id || item.hid,
    slug: item.id || item.hid,
    title: {
      userPreferred: item.title,
      english: item.title,
      romaji: item.title,
    },
    coverImage: {
      extraLarge: item.poster || '',
      large: item.poster || '',
      medium: item.poster || '',
    },
    bannerImage: item.poster || '',
    description: item.synopsis || `Read ${item.title} on Comix.to`,
    status: item.status?.toUpperCase() || 'RELEASING',
    genres: item.genres && item.genres.length > 0 ? item.genres : ['Manga'],
    averageScore: item.score ? Math.round(item.score * 10) : 85,
    format: (item.type || 'MANGA').toUpperCase(),
    chapters: item.latestChapter ? parseInt(item.latestChapter.replace(/\D/g, '')) || 100 : 100,
  };
}

/**
 * Fetches Comix Home Feed structured into MangaLove's Home Feed lists
 */
export async function fetchComixCatalogForHome(): Promise<{
  trending: any[];
  popular: any[];
  topRated: any[];
  newest: any[];
  upcoming: any[];
  movies: any[];
  action: any[];
  fantasy: any[];
  romcom: any[];
}> {
  const comixFeed = await fetchComixHomeFeed();

  const trending = comixFeed.trending.map((item, idx) => comixToAnime(item, idx));
  const popular = comixFeed.mostFollowed.map((item, idx) => comixToAnime(item, idx));
  const newest = comixFeed.newestAdditions.map((item, idx) => comixToAnime(item, idx));
  const hot = comixFeed.hotUpdates.map((item, idx) => comixToAnime(item, idx));

  const action = trending.filter((a) => a.genres.some((g: string) => /action|martial/i.test(g)));
  const fantasy = trending.filter((a) => a.genres.some((g: string) => /fantasy|isekai/i.test(g)));
  const romcom = trending.filter((a) => a.genres.some((g: string) => /romance|comedy/i.test(g)));

  return {
    trending: trending.length > 0 ? trending : hot,
    popular: popular.length > 0 ? popular : trending,
    topRated: popular,
    newest: newest.length > 0 ? newest : hot,
    upcoming: hot,
    movies: newest,
    action: action.length > 0 ? action : trending.slice(0, 10),
    fantasy: fantasy.length > 0 ? fantasy : trending.slice(5, 15),
    romcom: romcom.length > 0 ? romcom : trending.slice(10, 20),
  };
}

/**
 * Convenience helper to resolve Comix HID for any Manga
 */
export async function getComixHidForManga(manga: Manga): Promise<string | null> {
  if (!manga) return null;
  if ((manga as any).hid) return (manga as any).hid;
  if (typeof manga.id === 'string' && manga.id.includes('-')) return manga.id;

  const titleStr = (manga.title?.english || manga.title?.romaji || manga.title?.userPreferred || '').trim();
  if (!titleStr) return null;

  const results = await searchComix(titleStr);
  if (results.length > 0) {
    return results[0].id;
  }
  return null;
}
