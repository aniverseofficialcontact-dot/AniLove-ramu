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

export function formatComixImageUrl(urlOrObj: any): string | null {
  if (!urlOrObj) return null;
  const raw = typeof urlOrObj === 'string' ? urlOrObj : urlOrObj.large || urlOrObj.medium || urlOrObj.url || urlOrObj.src || urlOrObj.path;
  if (!raw) return null;
  if (raw.startsWith('http')) return raw;
  return `https://static.comix.to${raw.startsWith('/') ? '' : '/'}${raw}`;
}

/**
 * Fetch HTML directly from Comix.to with prominent Logcat logging
 */
export async function fetchHtmlNative(targetUrl: string): Promise<string> {
  console.log('🚀 [COMIX DIRECT REQUEST]', targetUrl);
  try {
    const res = await fetch(targetUrl, {
      method: 'GET',
      headers: HEADERS,
    });
    console.log('📡 [COMIX RESPONSE STATUS]', targetUrl, '-> Status:', res.status, res.statusText);
    if (!res.ok) {
      throw new Error(`Failed to fetch Comix source page (${res.status}): ${res.statusText}`);
    }
    const html = await res.text();
    console.log('📄 [COMIX HTML FETCHED]', targetUrl, '-> Length:', html.length, 'bytes');
    return html;
  } catch (err: any) {
    console.error('❌ [COMIX FETCH ERROR]', targetUrl, err?.message || err);
    throw err;
  }
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
      const parsed = JSON.parse(match[1]);
      console.log('🧩 [COMIX JSON PARSED SUCCESSFULLY] Query keys count:', Object.keys(parsed?.queries || {}).length);
      return parsed;
    } catch (e) {
      console.error('❌ [COMIX JSON PARSE ERROR]:', e);
    }
  } else {
    console.warn('⚠️ [COMIX NO INITIAL DATA TAG MATCHED]');
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
        const imgUrl = formatComixImageUrl(img);
        if (imgUrl) {
          pages.push({
            pageNumber: i + 1,
            url: imgUrl,
          });
        }
      });
      if (pages.length > 0) {
        console.log('🖼️ [COMIX EXTRACTED FROM INIT_DATA READ]', pages.length, 'images found');
        return pages;
      }
    } else if (pagesData && typeof pagesData === 'object' && Array.isArray(pagesData.items)) {
      const baseUrl = pagesData.baseUrl || 'https://static.comix.to/';
      pagesData.items.forEach((item: any, i: number) => {
        const urlPart = item.url || item.path || item.src;
        if (urlPart) {
          const finalUrl = urlPart.startsWith('http') ? urlPart : `${baseUrl.replace(/\/$/, '')}/${urlPart.replace(/^\//, '')}`;
          pages.push({
            pageNumber: i + 1,
            url: finalUrl,
          });
        }
      });
      if (pages.length > 0) {
        console.log('🖼️ [COMIX EXTRACTED FROM INIT_DATA READ ITEMS]', pages.length, 'images found');
        return pages;
      }
    }
  }

  // 1b. Check initData.queries for chapter page data
  if (initData && initData.queries) {
    for (const [k, v] of Object.entries(initData.queries)) {
      const qVal: any = v;
      if (qVal && typeof qVal === 'object') {
        const pList = qVal.pages || qVal.images || qVal.items;
        if (pList && typeof pList === 'object' && Array.isArray(pList.items)) {
          const baseUrl = pList.baseUrl || qVal.baseUrl || 'https://static.comix.to/';
          pList.items.forEach((item: any, i: number) => {
            const urlPart = item.url || item.path || item.src;
            if (urlPart) {
              const finalUrl = urlPart.startsWith('http') ? urlPart : `${baseUrl.replace(/\/$/, '')}/${urlPart.replace(/^\//, '')}`;
              pages.push({
                pageNumber: i + 1,
                url: finalUrl,
              });
            }
          });
          if (pages.length > 0) {
            console.log('🖼️ [COMIX EXTRACTED FROM INIT_DATA QUERIES ITEMS]', pages.length, 'images found');
            return pages;
          }
        } else if (Array.isArray(pList) && pList.length > 0) {
          pList.forEach((img: any, i: number) => {
            const imgUrl = formatComixImageUrl(img);
            if (imgUrl) {
              pages.push({
                pageNumber: i + 1,
                url: imgUrl,
              });
            }
          });
          if (pages.length > 0) {
            console.log('🖼️ [COMIX EXTRACTED FROM INIT_DATA QUERIES ARRAY]', pages.length, 'images found');
            return pages;
          }
        }
      }
    }
  }

  // 2. Look for "images": [...] in any script tag
  const jsonMatches = html.match(/"images":\s*(\[[^\]]+\])/);
  if (jsonMatches) {
    try {
      const parsed = JSON.parse(jsonMatches[1]);
      parsed.forEach((img: any, i: number) => {
        const imgUrl = formatComixImageUrl(img);
        if (imgUrl) {
          pages.push({
            pageNumber: i + 1,
            url: imgUrl,
          });
        }
      });
      if (pages.length > 0) {
        console.log('🖼️ [COMIX EXTRACTED FROM REGEX IMAGES JSON]', pages.length, 'images found');
        return pages;
      }
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
    console.log('🖼️ [COMIX EXTRACTED FROM HTML STATIC IMAGE TAGS]', pages.length, 'images found');
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
  console.log('🏠 [COMIX API] Fetching Home Feed from https://comix.to/...');
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
      if (k.includes('"trending"')) trendingRaw = Array.isArray(v) ? v : (v as any)?.items || [];
      else if (k.includes('"follows"')) mostFollowedRaw = Array.isArray(v) ? v : (v as any)?.items || [];
      else if (k.includes('"scope":"hot"')) hotUpdatesRaw = Array.isArray(v) ? v : (v as any)?.items || [];
      else if (k.includes('"created_at":"desc"')) newAdditionsRaw = Array.isArray(v) ? v : (v as any)?.items || [];
    }

    const mapItem = (item: any): ComixMangaItem => {
      const hid = item.hid || item.hash_id || '';
      const slug = item.slug || '';
      const id = item.url ? item.url.replace('/title/', '') : `${hid}-${slug}`.replace(/^-/, '');
      const posterUrl = formatComixImageUrl(item.poster);

      return {
        id: id || hid,
        hid: hid || id,
        title: item.title || 'Untitled',
        slug,
        poster: posterUrl,
        type: item.type,
        latestChapter: item.latestChapter !== undefined ? `Ch.${item.latestChapter}` : undefined,
        status: item.status,
        score: item.ratedAvg || item.rated_avg,
        synopsis: item.synopsis,
        genres: Array.isArray(item.genres) ? item.genres.map((g: any) => g.title || g.label || g.name || g) : [],
      };
    };

    console.log('✅ [COMIX API HOME FEED PARSED]', {
      trending: trendingRaw.length,
      mostFollowed: mostFollowedRaw.length,
      hotUpdates: hotUpdatesRaw.length,
      newAdditions: newAdditionsRaw.length,
    });

    return {
      trending: trendingRaw.map(mapItem),
      mostFollowed: mostFollowedRaw.map(mapItem),
      hotUpdates: hotUpdatesRaw.map(mapItem),
      newAdditions: newAdditionsRaw.map(mapItem),
      collections: queries['["collections","list",{"sort":"newest","limit":10}]']?.items || [],
      topUploaders: queries['["users","topUploaders"]'] || [],
    };
  } catch (err) {
    console.error('❌ [COMIX API HOME FEED ERROR]:', err);
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
  console.log('🏷️ [COMIX API] Fetching Genres and Filters...');
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
  const page = options?.page || 1;
  const cleanQuery = query ? query.trim() : '';

  console.log('🔍 [COMIX API SEARCH]', { query: cleanQuery, page, options });

  // Method 1: Try Comix REST API Endpoint (/api/v1/manga)
  try {
    let apiUrl = `https://comix.to/api/v1/manga?page=${page}`;
    if (cleanQuery) apiUrl += `&keyword=${encodeURIComponent(cleanQuery)}`;
    if (options?.genres) apiUrl += `&genres=${encodeURIComponent(options.genres)}`;
    if (options?.sort) apiUrl += `&sort=${encodeURIComponent(options.sort)}`;

    console.log('🔍 [COMIX SEARCH API URL]', apiUrl);
    const res = await fetch(apiUrl, { method: 'GET', headers: HEADERS }).catch(() => null);
    if (res && res.ok) {
      const data = await res.json().catch(() => null);
      const items = data?.result?.items || data?.items || data?.result || [];
      if (Array.isArray(items) && items.length > 0) {
        console.log('✅ [COMIX API JSON SEARCH SUCCESS]', items.length, 'manga items found');
        return items.map((item: any) => {
          const hid = item.hid || item.hash_id || '';
          const slug = item.slug || '';
          const id = item.url ? item.url.replace('/title/', '') : `${hid}-${slug}`.replace(/^-/, '');

          return {
            id: id || `${item.id}`,
            hid: hid || `${item.id}`,
            title: item.title || 'Untitled',
            slug,
            poster: formatComixImageUrl(item.poster),
            type: item.type,
            latestChapter: item.latestChapter !== undefined ? `Ch.${item.latestChapter}` : undefined,
            status: item.status,
            score: item.ratedAvg || item.rated_avg,
            synopsis: item.synopsis,
            genres: Array.isArray(item.genres) ? item.genres.map((g: any) => g.title || g.label || g.name || g) : [],
          };
        });
      }
    }
  } catch (err) {
    console.warn('[comixService] JSON search notice, trying HTML browse fallback:', err);
  }

  // Method 2: Fetch HTML from /browse or /manga page with embedded initial-data
  try {
    let targetUrl = `https://comix.to/browse?page=${page}`;
    if (cleanQuery) targetUrl += `&keyword=${encodeURIComponent(cleanQuery)}`;
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

    if (items.length === 0 && !cleanQuery) {
      const homeFeed = await fetchComixHomeFeed();
      return homeFeed.trending;
    }

    console.log('✅ [COMIX API HTML SEARCH SUCCESS]', items.length, 'manga items found');

    return items.map((item: any) => {
      const hid = item.hid || item.hash_id || '';
      const slug = item.slug || '';
      const id = item.url ? item.url.replace('/title/', '') : `${hid}-${slug}`.replace(/^-/, '');

      return {
        id: id || `${item.id}`,
        hid: hid || `${item.id}`,
        title: item.title || 'Untitled',
        slug,
        poster: formatComixImageUrl(item.poster),
        type: item.type,
        latestChapter: item.latestChapter !== undefined ? `Ch.${item.latestChapter}` : undefined,
        status: item.status,
        score: item.ratedAvg || item.rated_avg,
        synopsis: item.synopsis,
        genres: Array.isArray(item.genres) ? item.genres.map((g: any) => g.title || g.label || g.name || g) : [],
      };
    });
  } catch (err) {
    console.error('❌ [COMIX API SEARCH ERROR]:', err);
    return [];
  }
}

// ==========================================
// ENDPOINT 4: TITLE DETAILS (/api/title/:id)
// ==========================================

export async function fetchComixTitleDetails(titleId: string): Promise<any | null> {
  console.log('ℹ️ [COMIX API TITLE DETAILS]', titleId);
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

    console.log('✅ [COMIX API TITLE DETAILS PARSED]', mangaDetail.title || titleId);

    return {
      ...mangaDetail,
      recommended,
    };
  } catch (err) {
    console.error('❌ [COMIX API TITLE DETAILS ERROR]:', err);
    return null;
  }
}

// ==========================================
// ENDPOINT 5: CHAPTERS LIST (/api/title/:id/chapters)
// ==========================================

export async function fetchComixChapters(comixIdOrHash: string, page: number = 1): Promise<MangaChapter[]> {
  console.log('📚 [COMIX API FETCH CHAPTERS]', { comixIdOrHash, page });
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
        chaptersList = Array.isArray(v) ? v : (v as any)?.items || (v as any)?.data || [];
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

    const resultChapters = chaptersList.map((item: any) => {
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

    console.log('✅ [COMIX API CHAPTERS PARSED]', resultChapters.length, 'chapters found for', titleSlug);
    return resultChapters;
  } catch (err) {
    console.error('❌ [COMIX API CHAPTERS ERROR]:', err);
    return [];
  }
}

// ==========================================
// ENDPOINT 6: CHAPTER READER PAGES (/api/chapter/...)
// ==========================================

export async function fetchComixChapterPages(chapterId: string): Promise<MangaPage[]> {
  console.log('📖 [COMIX API FETCH CHAPTER PAGES]', { chapterId });
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

    console.log('📖 [COMIX API TARGET CHAPTER READER URL]', targetUrl);
    const html = await fetchHtmlNative(targetUrl);
    const pages = extractChapterImages(html);

    const resultPages = pages.map((p) => ({
      pageNumber: p.pageNumber,
      url: p.url,
    }));

    console.log('✅ [COMIX API PAGES PARSED]', resultPages.length, 'image pages found for chapter', chapterId, 'URL:', targetUrl);
    return resultPages;
  } catch (err) {
    console.error('❌ [COMIX API CHAPTER PAGES ERROR]:', err);
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
  console.log('🏠 [COMIX API] Fetching Catalog for Home Feed...');
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
  if ((manga as any).slug) return (manga as any).slug;
  if (typeof manga.id === 'string' && (manga.id as string).includes('-')) return manga.id as string;

  const titleStr = (manga.title?.english || manga.title?.romaji || manga.title?.userPreferred || '').trim();
  if (!titleStr) return null;

  const results = await searchComix(titleStr);
  if (results.length > 0) {
    return results[0].id;
  }
  return null;
}
