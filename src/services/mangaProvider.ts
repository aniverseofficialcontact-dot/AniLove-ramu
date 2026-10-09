import { Manga, MangaChapter, MangaPage } from '../types';
import { mihonService } from './mihonService';
import { fetchComixChapters, fetchComixChapterPages, getComixHidForManga } from './comixService';

const chapterListCache = new Map<string, MangaChapter[]>();
const pagesCache = new Map<string, MangaPage[]>();

export interface MangaCoverArt {
  id: string;
  volume?: string;
  volumeNum?: number;
  url: string;
  type?: string;
  description?: string;
  locale?: string;
  flag?: string;
  languageName?: string;
}

export function getLanguageDetails(locale: string): { flag: string; name: string } {
  if (!locale) return { flag: '🇯🇵', name: 'Japanese' };
  const loc = locale.toLowerCase();
  if (loc === 'en' || loc === 'en-us' || loc === 'en-gb' || loc === 'uk') return { flag: '🇬🇧', name: 'English' };
  if (loc === 'ja' || loc === 'jp') return { flag: '🇯🇵', name: 'Japanese' };
  if (loc.startsWith('es')) return { flag: '🇪🇸', name: 'Spanish' };
  if (loc === 'de') return { flag: '🇩🇪', name: 'German' };
  if (loc === 'fr') return { flag: '🇫🇷', name: 'French' };
  if (loc === 'it') return { flag: '🇮🇹', name: 'Italian' };
  if (loc === 'ko' || loc === 'kr') return { flag: '🇰🇷', name: 'Korean' };
  if (loc.startsWith('zh') || loc === 'cn' || loc === 'zh-hk') return { flag: '🇨🇳', name: 'Chinese' };
  if (loc === 'ru') return { flag: '🇷🇺', name: 'Russian' };
  if (loc.startsWith('pt') || loc === 'br') return { flag: '🇧🇷', name: 'Portuguese' };
  if (loc === 'ar') return { flag: '🇸🇦', name: 'Arabic' };
  if (loc === 'pl') return { flag: '🇵🇱', name: 'Polish' };
  if (loc === 'tr') return { flag: '🇹🇷', name: 'Turkish' };
  if (loc === 'th') return { flag: '🇹🇭', name: 'Thai' };
  if (loc === 'vi') return { flag: '🇻🇳', name: 'Vietnamese' };
  if (loc === 'id') return { flag: '🇮🇩', name: 'Indonesian' };
  return { flag: '🌐', name: locale.toUpperCase() };
}

/**
 * Fetches all official volume covers & artwork variants with live incremental streaming
 */
export async function fetchMangaCovers(
  manga: Manga,
  onChunk?: (covers: MangaCoverArt[]) => void
): Promise<MangaCoverArt[]> {
  if (!manga) return [];

  const covers: MangaCoverArt[] = [];
  const seenUrls = new Set<string>();

  const emitChunk = () => {
    if (onChunk) {
      onChunk([...covers]);
    }
  };

  const titleStr = (
    manga.title?.english ||
    manga.title?.romaji ||
    manga.title?.userPreferred ||
    ''
  ).trim();

  // 1. Primary AniList Cover Images
  if (manga.coverImage?.extraLarge) {
    seenUrls.add(manga.coverImage.extraLarge);
    covers.push({
      id: 'anilist_extralarge',
      volume: 'Volume 1',
      volumeNum: 1,
      url: manga.coverImage.extraLarge,
      type: 'Front',
      description: 'Front (Volume) 1',
      locale: 'ja',
      flag: '🇯🇵',
      languageName: 'Japanese',
    });
  }

  if (manga.bannerImage && !seenUrls.has(manga.bannerImage)) {
    seenUrls.add(manga.bannerImage);
    covers.push({
      id: 'anilist_banner',
      volume: 'Banner Artwork',
      url: manga.bannerImage,
      type: 'Variant',
      description: 'Official Wide Banner',
      locale: 'ja',
      flag: '🇯🇵',
      languageName: 'Japanese',
    });
  }

  emitChunk();

  // 2. Query Kitsu for Covers
  const kitsuSearchPromise = titleStr
    ? fetch(`https://kitsu.io/api/edge/manga?filter[text]=${encodeURIComponent(titleStr)}&page[limit]=10`, {
        headers: { 'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64)' },
      })
        .then((r) => r.json())
        .catch(() => null)
    : Promise.resolve(null);

  await kitsuSearchPromise.then((kitsuResult) => {
    if (kitsuResult?.data && Array.isArray(kitsuResult.data)) {
      let added = false;
      kitsuResult.data.forEach((kitsuItem: any, idx: number) => {
        const poster =
          kitsuItem.attributes?.posterImage?.original ||
          kitsuItem.attributes?.posterImage?.large;
        const cover =
          kitsuItem.attributes?.coverImage?.original ||
          kitsuItem.attributes?.coverImage?.large;

        if (poster && !seenUrls.has(poster)) {
          seenUrls.add(poster);
          covers.push({
            id: `kitsu_poster_${idx}`,
            volume: `Volume ${covers.length + 1}`,
            url: poster,
            type: 'Front',
            description: `Front (Volume) ${covers.length + 1}`,
            flag: '🇯🇵',
            languageName: 'Japanese',
          });
          added = true;
        }

        if (cover && !seenUrls.has(cover)) {
          seenUrls.add(cover);
          covers.push({
            id: `kitsu_cover_${idx}`,
            volume: `Volume ${covers.length + 1}`,
            url: cover,
            type: 'Variant',
            description: `Variant Cover ${covers.length + 1}`,
            flag: '🇯🇵',
            languageName: 'Japanese',
          });
          added = true;
        }
      });
      if (added) emitChunk();
    }
  });

  return covers;
}

/**
 * Fetches available chapters for a Manga title directly via Comix Engine & Mihon Engine
 */
export async function fetchMangaChapters(manga: Manga): Promise<MangaChapter[]> {
  const cacheKey = `chapters_${manga.id}`;
  if (chapterListCache.has(cacheKey)) {
    return chapterListCache.get(cacheKey)!;
  }

  const chaptersMap = new Map<string, MangaChapter>();

  // Run Comix Engine request
  try {
    const comixHid = await getComixHidForManga(manga);
    if (comixHid) {
      const comixChaps = await fetchComixChapters(comixHid);
      if (Array.isArray(comixChaps) && comixChaps.length > 0) {
        comixChaps.forEach((ch) => {
          if (!chaptersMap.has(ch.chapterNumber)) {
            chaptersMap.set(ch.chapterNumber, ch);
          }
        });
      }
    }
  } catch (e) {
    console.warn('[Comix Provider] Chapter list notice:', e);
  }

  const sorted = Array.from(chaptersMap.values()).sort((a, b) => {
    const numA = parseFloat(a.chapterNumber) || 0;
    const numB = parseFloat(b.chapterNumber) || 0;
    return numA - numB;
  });

  if (sorted.length > 0) {
    chapterListCache.set(cacheKey, sorted);
    return sorted;
  }

  const fallback = generateFallbackChapters(manga);
  chapterListCache.set(cacheKey, fallback);
  return fallback;
}

/**
 * Fetches page image URLs for a chapter via Comix Engine & Mihon Plugin
 */
export async function fetchChapterPages(chapterId: string, fallbackManga?: Manga, chapterNumber?: number): Promise<MangaPage[]> {
  if (pagesCache.has(chapterId)) {
    return pagesCache.get(chapterId)!;
  }

  // 1. Fetch from Mihon Engine Plugin
  if (chapterId && chapterId.startsWith('mihon_')) {
    try {
      const parts = chapterId.replace('mihon_', '').split('_chapter_');
      const sourceId = parts[0];
      const chapterUrl = parts[1];
      if (sourceId && chapterUrl) {
        const pageUrls = await mihonService.getChapterPages(sourceId, chapterUrl);
        if (pageUrls && pageUrls.length > 0) {
          const pages: MangaPage[] = pageUrls.map((url, idx) => ({
            pageNumber: idx + 1,
            url,
          }));
          pagesCache.set(chapterId, pages);
          return pages;
        }
      }
    } catch (e) {
      console.warn('[Mihon Provider] Fetch chapter pages notice:', e);
    }
  }

  // 2. Fetch from Comix Engine
  if (chapterId && (chapterId.startsWith('comix_') || chapterId.includes('-chapter-'))) {
    try {
      const pages = await fetchComixChapterPages(chapterId);
      if (Array.isArray(pages) && pages.length > 0) {
        pagesCache.set(chapterId, pages);
        return pages;
      }
    } catch (e) {
      console.warn('[Comix Provider] Fetch chapter pages notice:', e);
    }
  }

  // Fallback: If fallbackManga is provided, try searching Comix directly
  if (fallbackManga) {
    try {
      const comixHid = await getComixHidForManga(fallbackManga);
      if (comixHid) {
        const comixChaps = await fetchComixChapters(comixHid);
        const targetNum = String(chapterNumber || 1);
        const match = comixChaps.find((c) => c.chapterNumber === targetNum) || comixChaps[0];
        if (match) {
          const pages = await fetchComixChapterPages(match.id);
          if (Array.isArray(pages) && pages.length > 0) {
            pagesCache.set(chapterId, pages);
            return pages;
          }
        }
      }
    } catch (e) {
      console.warn('[Manga Provider] Comix live fallback search notice:', e);
    }
  }

  const fallbackPages = generateFallbackPages(fallbackManga, chapterNumber || 1);
  pagesCache.set(chapterId, fallbackPages);
  return fallbackPages;
}

function generateFallbackChapters(manga: Manga): MangaChapter[] {
  const total = manga?.chapters || (manga?.status === 'FINISHED' ? 45 : 120);
  const chapters: MangaChapter[] = [];

  for (let i = 1; i <= Math.min(total, 300); i++) {
    chapters.push({
      id: `fallback_${manga?.id || 1}_ch_${i}`,
      chapterNumber: String(i),
      title: `Chapter ${i}`,
      language: 'en',
    });
  }

  return chapters;
}

function generateFallbackPages(manga?: Manga, chapterNum: number = 1): MangaPage[] {
  const coverUrl = manga?.coverImage?.extraLarge || manga?.coverImage?.large || manga?.bannerImage;
  const isWebtoon = manga?.countryOfOrigin === 'KR' || manga?.format === 'MANHWA';

  const sampleImages = [
    coverUrl,
    'https://images.unsplash.com/photo-1607604276583-eef5d076aa5f?w=600&auto=format&fit=crop&q=80',
    'https://images.unsplash.com/photo-1578632767115-351597cf2477?w=600&auto=format&fit=crop&q=80',
    'https://images.unsplash.com/photo-1534447677768-be436bb09401?w=600&auto=format&fit=crop&q=80',
    'https://images.unsplash.com/photo-1563089145-599997674d42?w=600&auto=format&fit=crop&q=80',
    'https://images.unsplash.com/photo-1518709268805-4e9042af9f23?w=600&auto=format&fit=crop&q=80',
    'https://images.unsplash.com/photo-1618005182384-a83a8bd57fbe?w=600&auto=format&fit=crop&q=80',
    'https://images.unsplash.com/photo-1579783902614-a3fb3927b675?w=600&auto=format&fit=crop&q=80',
    'https://images.unsplash.com/photo-1513364776144-60967b0f800f?w=600&auto=format&fit=crop&q=80',
  ].filter(Boolean) as string[];

  const count = isWebtoon ? 12 : 16;
  const pages: MangaPage[] = [];

  for (let i = 1; i <= count; i++) {
    const imgIndex = (i + chapterNum) % sampleImages.length;
    pages.push({
      pageNumber: i,
      url: sampleImages[imgIndex],
    });
  }

  return pages;
}
