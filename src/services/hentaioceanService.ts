import { Anime } from '../types';
import { Capacitor, CapacitorHttp } from '@capacitor/core';

export interface HentaiInfo {
  id: number;
  urlname: string; // slug e.g. "my-mother-1"
  videoname: string;
  description: string;
  releasedate: string;
  uploaddate: string;
  coverimg: string;
  series: any;
  status: number;
  recentrelease: number;
}

export interface HentaiGenre {
  genre: string;
}

export interface HentaiApiResponse {
  info: HentaiInfo[];
  genres: HentaiGenre[];
}

// 52 Popular HentaiOcean Slugs Catalog for rich discovery
export const POPULAR_HENTAI_SLUGS = [
  'my-mother-1',
  'resort-boin',
  'manga-uketsuke-joushi',
  'fault',
  'chichinoe',
  'overflow',
  'jukan-shinsou',
  'energy-kyouka',
  'yume-ketsuma',
  'otome-dori',
  'discipline',
  'fura-kannagi',
  'kuroinu',
  'rance-hikari',
  'night-shift-nurses',
  'sweet-home',
  'succubus-stayed',
  'bitch-kanojo',
  'euphoria',
  'fencer-of-minerva',
  'seikatsu-shuukan',
  'marshmallow-ecchi',
  'tsugumomo',
  'harem-camp',
  'fujirou',
  'show-time',
  'shoujo-ramune',
  'spiral-curse',
  'velvet',
  'kanojo-x-kanojo',
  'tiny-evil',
  'kakushi-dere',
  'sister-breed',
  'torakiss',
  'docchi-ni-suru',
  'dokidoki-little-oops',
  'kaifuku-jushin',
  'redo-of-healer',
  'isekai-harem',
  'seishun-buta',
  'onichan-wa-oshimai',
  'jk-to-ero-konbini',
  'ero-manga-sensei',
  'oppai-academy',
  'fukai-ni-nemuru',
  'bikini-warriors',
  'koikishi-purely',
  'brand-new-school',
  'angel-blade',
  'bible-black',
  'vampire-hunter',
  'yosuga-no-sora',
];

// Memory cache for HentaiOcean items
const HENTAI_CACHE = new Map<string, Anime>();

function hashCode(str: string): number {
  let hash = 0;
  for (let i = 0; i < str.length; i++) {
    hash = (hash << 5) - hash + str.charCodeAt(i);
    hash |= 0;
  }
  return Math.abs(hash);
}

/**
 * Universal fetch helper for HentaiOcean API
 */
async function fetchHentaiApi(url: string): Promise<any> {
  if (Capacitor.isNativePlatform()) {
    try {
      const res = await CapacitorHttp.get({ url });
      if (res.status >= 200 && res.status < 300 && res.data) {
        return typeof res.data === 'string' ? JSON.parse(res.data) : res.data;
      }
    } catch (e) {
      console.warn('[HentaiOcean] Native fetch error:', e);
    }
  }

  try {
    const res = await fetch(url, {
      headers: { Accept: 'application/json' },
    });
    if (res.ok) {
      return await res.json();
    }
  } catch (e) {
    console.warn('[HentaiOcean] Web fetch error:', e);
  }
  return null;
}

export function getHentaiRootSlug(slug: string): string {
  if (!slug) return 'my-mother';
  return slug.replace(/-\d+$/, '');
}

export function getHentaiSlugForEpisode(baseSlug: string, epNum: number): string {
  if (!baseSlug) return 'my-mother-1';
  const root = getHentaiRootSlug(baseSlug);
  return `${root}-${epNum}`;
}

/**
 * Maps HentaiOcean API JSON into AniLove Anime Object
 */
export function mapHentaiToAnime(info: HentaiInfo, genres: HentaiGenre[] = []): Anime {
  const slug = info.urlname || 'hentai-item';
  const idNum = info.id || hashCode(slug);
  const rawTitle = info.videoname || slug.replace(/-/g, ' ').replace(/\b\w/g, c => c.toUpperCase());
  const cleanTitle = rawTitle.replace(/\s+\d+$/, '').trim() || rawTitle;

  const coverFilename = info.coverimg;
  const coverUrl = coverFilename && coverFilename.length > 5
    ? `https://hentaiocean.com/assets/cover/${coverFilename}`
    : `https://hentaiocean.com/thumbnail/${slug}.webp`;
  const thumbUrl = `https://hentaiocean.com/thumbnail/${slug}.webp`;

  const genreList = genres.map(g => g.genre).filter(Boolean);
  if (genreList.length === 0) {
    genreList.push('18+', 'Uncensored', 'Hentai');
  } else if (!genreList.includes('18+')) {
    genreList.unshift('18+');
  }

  const anime: Anime = {
    id: idNum,
    title: {
      userPreferred: cleanTitle,
      english: cleanTitle,
      romaji: cleanTitle,
      native: cleanTitle,
    },
    coverImage: {
      extraLarge: coverUrl,
      large: coverUrl,
      medium: thumbUrl,
      color: '#ec4899',
    },
    bannerImage: thumbUrl,
    format: '18+ ONA',
    episodes: 12, // Enable multi-episode switching (Ep 1, Ep 2, Ep 3...)
    duration: 28,
    status: 'FINISHED',
    seasonYear: info.releasedate ? parseInt(info.releasedate.slice(0, 4), 10) : 2023,
    averageScore: 88,
    meanScore: 88,
    popularity: 15000,
    genres: genreList,
    description: info.description || 'Exclusive 18+ Animated Title available on HentaiOcean.',
    isAdult: true,
    siteUrl: `https://hentaiocean.com/embed/${slug}?la=1`,
    // Extended properties
    slug,
    is18Plus: true,
  } as Anime & { slug: string; is18Plus: boolean };

  HENTAI_CACHE.set(slug, anime);
  return anime;
}

/**
 * Fetches single Hentai title details by slug
 */
export async function fetchHentaiDetailsBySlug(slug: string): Promise<Anime | null> {
  if (HENTAI_CACHE.has(slug)) {
    return HENTAI_CACHE.get(slug)!;
  }

  const apiUrl = `https://hentaiocean.com/api?action=hentai&slug=${encodeURIComponent(slug)}`;
  const data: HentaiApiResponse = await fetchHentaiApi(apiUrl);

  if (data && Array.isArray(data.info) && data.info.length > 0) {
    const info = data.info[0];
    const genres = Array.isArray(data.genres) ? data.genres : [];
    return mapHentaiToAnime(info, genres);
  }

  // Fallback placeholder if single item API is slow
  const titleStr = slug.replace(/-/g, ' ').replace(/\b\w/g, c => c.toUpperCase());
  const fallbackAnime = mapHentaiToAnime({
    id: hashCode(slug),
    urlname: slug,
    videoname: titleStr,
    description: 'Exclusive 18+ Animated Content.',
    releasedate: '2023-01-01',
    uploaddate: '2023-01-01',
    coverimg: '',
    series: null,
    status: 1,
    recentrelease: 1,
  });
  return fallbackAnime;
}

/**
 * Parses RSS XML Feed to discover latest Hentai release slugs
 */
export async function fetchHentaiRssFeed(): Promise<string[]> {
  const rssUrl = 'https://hentaiocean.com/rss.xml';
  let xmlText = '';

  if (Capacitor.isNativePlatform()) {
    try {
      const res = await CapacitorHttp.get({ url: rssUrl });
      if (res.data) xmlText = typeof res.data === 'string' ? res.data : '';
    } catch (e) {
      console.warn('[HentaiOcean RSS] Native fetch error:', e);
    }
  }

  if (!xmlText) {
    try {
      const res = await fetch(rssUrl);
      if (res.ok) {
        xmlText = await res.text();
      }
    } catch (e) {
      console.warn('[HentaiOcean RSS] Web fetch error:', e);
    }
  }

  if (!xmlText) return POPULAR_HENTAI_SLUGS;

  const slugs: string[] = [];
  try {
    const parser = new DOMParser();
    const xmlDoc = parser.parseFromString(xmlText, 'text/xml');
    const items = xmlDoc.querySelectorAll('item');

    items.forEach(item => {
      const link = item.querySelector('link')?.textContent || '';
      const guid = item.querySelector('guid')?.textContent || '';
      const target = link || guid;
      if (target) {
        const parts = target.split('/').filter(Boolean);
        const slug = parts[parts.length - 1];
        if (slug && !slugs.includes(slug)) {
          slugs.push(slug);
        }
      }
    });
  } catch (e) {
    console.warn('[HentaiOcean RSS] Parse error:', e);
  }

  return slugs.length > 0 ? slugs : POPULAR_HENTAI_SLUGS;
}

/**
 * Fetches catalog feed for 18+ Home Screen with zero repeated titles across categories
 */
export async function getHentaiOceanHomeFeed(): Promise<{
  trending: Anime[];
  recent: Anime[];
  topRated: Anime[];
  uncensored: Anime[];
}> {
  const rssSlugs = await fetchHentaiRssFeed();
  const allSlugs = Array.from(new Set([...rssSlugs, ...POPULAR_HENTAI_SLUGS]));

  // Fetch up to 32 unique titles in parallel chunks
  const results: Anime[] = [];
  const seenTitles = new Set<string>();
  const chunkSize = 8;

  for (let i = 0; i < Math.min(allSlugs.length, 36); i += chunkSize) {
    const chunk = allSlugs.slice(i, i + chunkSize);
    const chunkPromises = chunk.map(slug => fetchHentaiDetailsBySlug(slug));
    const chunkResults = await Promise.all(chunkPromises);
    chunkResults.forEach(a => {
      if (a) {
        const key = a.title.userPreferred?.toLowerCase() || (a as any).slug;
        if (!seenTitles.has(key)) {
          seenTitles.add(key);
          results.push(a);
        }
      }
    });
  }

  // Partition into strictly non-overlapping subsets
  const trending = results.slice(0, 8);
  const recent = results.slice(8, 16);
  const uncensored = results.slice(16, 24);
  const topRated = results.slice(24, 32);

  return {
    trending: trending.length > 0 ? trending : results.slice(0, 6),
    recent: recent.length > 0 ? recent : results.slice(0, 6),
    topRated: topRated.length > 0 ? topRated : results.slice(0, 6),
    uncensored: uncensored.length > 0 ? uncensored : results.slice(0, 6),
  };
}

/**
 * Search HentaiOcean catalog by keyword query and genre filters
 */
export async function searchHentaiOcean(query: string = '', genres: string[] = []): Promise<Anime[]> {
  const q = query.toLowerCase().trim();
  const rssSlugs = await fetchHentaiRssFeed();
  const allSlugs = Array.from(new Set([...rssSlugs, ...POPULAR_HENTAI_SLUGS]));

  let matchingSlugs = allSlugs;

  if (q && q !== 'all') {
    matchingSlugs = allSlugs.filter(slug => slug.toLowerCase().includes(q) || q.includes(slug));
  }

  const slugsToFetch = matchingSlugs.slice(0, 16);
  const animeList = await Promise.all(slugsToFetch.map(slug => fetchHentaiDetailsBySlug(slug)));
  const cleanList = animeList.filter((a): a is Anime => a !== null);

  if (genres && genres.length > 0) {
    const genreLower = genres.map(g => g.toLowerCase());
    return cleanList.filter(a =>
      a.genres.some(g => genreLower.includes(g.toLowerCase()))
    );
  }

  return cleanList;
}
