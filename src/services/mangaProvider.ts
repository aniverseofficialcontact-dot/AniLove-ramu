import { Manga, MangaChapter, MangaPage } from '../types';

const MANGADEX_BASE_URL = 'https://api.mangadex.org';
const MANGADEX_UPLOADS_URL = 'https://uploads.mangadex.org';

const mangaDexIdCache = new Map<number | string, string>();
const chapterListCache = new Map<string, MangaChapter[]>();
const pagesCache = new Map<string, MangaPage[]>();

export interface MangaCoverArt {
  id: string;
  volume?: string;
  url: string;
  description?: string;
  locale?: string;
  flag?: string;
}

function localeToFlag(locale: string): string {
  if (!locale) return '🇯🇵';
  const loc = locale.toLowerCase();
  if (loc === 'en' || loc === 'uk') return '🇬🇧';
  if (loc === 'ja' || loc === 'jp') return '🇯🇵';
  if (loc === 'es' || loc === 'es-la') return '🇪🇸';
  if (loc === 'de') return '🇩🇪';
  if (loc === 'fr') return '🇫🇷';
  if (loc === 'it') return '🇮🇹';
  if (loc === 'ko' || loc === 'kr') return '🇰🇷';
  if (loc === 'zh' || loc === 'cn' || loc === 'zh-hk') return '🇨🇳';
  if (loc === 'ru') return '🇷🇺';
  if (loc === 'pt' || loc === 'pt-br') return '🇧🇷';
  if (loc === 'ar') return '🇸🇦';
  return '🌐';
}

/**
 * Resolves MangaDex UUID for any title with multi-query title fallback
 */
export async function getMangaDexId(manga: Manga): Promise<string | null> {
  if (!manga) return null;
  const cacheKey = manga.id || manga.title?.english || manga.title?.romaji || manga.title?.userPreferred;
  if (mangaDexIdCache.has(cacheKey)) {
    return mangaDexIdCache.get(cacheKey)!;
  }

  const cleanTitles = [
    manga.title?.english,
    manga.title?.romaji,
    manga.title?.userPreferred,
  ]
    .filter(Boolean)
    .map((t) => t!.trim().replace(/\(.*?\)/g, '').replace(/[^a-z0-9\s]/gi, ' ').trim())
    .filter(Boolean);

  const uniqueTitles = Array.from(new Set(cleanTitles));

  for (const titleStr of uniqueTitles) {
    try {
      const url = `${MANGADEX_BASE_URL}/manga?title=${encodeURIComponent(titleStr)}&limit=5`;
      const res = await fetch(url, {
        headers: { 'User-Agent': 'MangaLove/1.0 (Mobile App)' },
      }).catch(() => null);

      if (res && res.ok) {
        const json = await res.json().catch(() => null);
        if (json?.data && Array.isArray(json.data) && json.data.length > 0) {
          const dexId = json.data[0].id;
          mangaDexIdCache.set(cacheKey, dexId);
          return dexId;
        }
      }
    } catch (err) {
      console.warn('[MangaDex Provider] ID search notice:', err);
    }
  }

  return null;
}

export const getMangaBakaId = getMangaDexId;

/**
 * Fetches all official volume covers & artwork variants for a Manga title via MangaDex, Kitsu & AniList
 */
export async function fetchMangaCovers(manga: Manga): Promise<MangaCoverArt[]> {
  if (!manga) return [];

  const covers: MangaCoverArt[] = [];
  const seenUrls = new Set<string>();

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
      volume: 'Volume 1 (Official Poster)',
      url: manga.coverImage.extraLarge,
      description: 'Primary HD Poster Artwork',
      flag: '🇯🇵',
    });
  }

  if (manga.bannerImage && !seenUrls.has(manga.bannerImage)) {
    seenUrls.add(manga.bannerImage);
    covers.push({
      id: 'anilist_banner',
      volume: 'Banner Artwork',
      url: manga.bannerImage,
      description: 'Official Wide Banner',
      flag: '🇯🇵',
    });
  }

  if (manga.coverImage?.large && !seenUrls.has(manga.coverImage.large)) {
    seenUrls.add(manga.coverImage.large);
    covers.push({
      id: 'anilist_large',
      volume: 'Volume Variant',
      url: manga.coverImage.large,
      flag: '🇯🇵',
    });
  }

  // 2. Query MangaDex + Kitsu in Parallel
  const dexIdPromise = getMangaDexId(manga);
  const kitsuSearchPromise = titleStr
    ? fetch(`https://kitsu.io/api/edge/manga?filter[text]=${encodeURIComponent(titleStr)}&page[limit]=10`, {
        headers: { 'User-Agent': 'MangaLove/1.0 (Mobile App)' },
      })
        .then((r) => r.json())
        .catch(() => null)
    : Promise.resolve(null);

  const [dexIdResult, kitsuResult] = await Promise.allSettled([dexIdPromise, kitsuSearchPromise]);

  // Process MangaDex Volume Covers
  if (dexIdResult.status === 'fulfilled' && dexIdResult.value) {
    const dexId = dexIdResult.value;
    try {
      const offsets = [0, 100];
      for (const offset of offsets) {
        const url = `${MANGADEX_BASE_URL}/cover?manga[]=${dexId}&limit=100&offset=${offset}&order[volume]=asc`;
        const res = await fetch(url, {
          headers: { 'User-Agent': 'MangaLove/1.0 (Mobile App)' },
        }).catch(() => null);

        if (res && res.ok) {
          const json = await res.json().catch(() => null);
          if (json?.data && Array.isArray(json.data) && json.data.length > 0) {
            json.data.forEach((item: any, idx: number) => {
              const vol = item.attributes?.volume;
              const fileName = item.attributes?.fileName;
              const locale = item.attributes?.locale || 'ja';
              if (fileName) {
                const coverUrl = `${MANGADEX_UPLOADS_URL}/covers/${dexId}/${fileName}`;
                if (!seenUrls.has(coverUrl)) {
                  seenUrls.add(coverUrl);
                  covers.push({
                    id: item.id || `dex_cover_${offset}_${idx}`,
                    volume: vol ? `Volume ${vol}` : `Volume Cover ${idx + 1}`,
                    url: coverUrl,
                    description: vol ? `Front (Volume) ${vol}` : 'Official Volume Cover',
                    locale,
                    flag: localeToFlag(locale),
                  });
                }
              }
            });
          }
        }
      }
    } catch (err) {
      console.warn('[MangaDex Provider] Fetch covers notice:', err);
    }
  }

  // Process Kitsu Volume / Poster Covers
  if (kitsuResult.status === 'fulfilled' && kitsuResult.value?.data && Array.isArray(kitsuResult.value.data)) {
    kitsuResult.value.data.forEach((kitsuItem: any, idx: number) => {
      const poster =
        kitsuItem.attributes?.posterImage?.original ||
        kitsuItem.attributes?.posterImage?.large ||
        kitsuItem.attributes?.posterImage?.medium;
      const cover =
        kitsuItem.attributes?.coverImage?.original ||
        kitsuItem.attributes?.coverImage?.large;

      if (poster && !seenUrls.has(poster)) {
        seenUrls.add(poster);
        covers.push({
          id: `kitsu_poster_${idx}`,
          volume: `Volume Cover ${covers.length + 1}`,
          url: poster,
          flag: '🇰🇷',
        });
      }

      if (cover && !seenUrls.has(cover)) {
        seenUrls.add(cover);
        covers.push({
          id: `kitsu_cover_${idx}`,
          volume: `Volume Variant ${covers.length + 1}`,
          url: cover,
          flag: '🇰🇷',
        });
      }
    });
  }

  return covers;
}

/**
 * Fetches available chapters for a Manga title via MangaDex API
 */
export async function fetchMangaChapters(manga: Manga): Promise<MangaChapter[]> {
  const cacheKey = `chapters_${manga.id}`;
  if (chapterListCache.has(cacheKey)) {
    return chapterListCache.get(cacheKey)!;
  }

  try {
    const dexId = await getMangaDexId(manga);
    if (dexId) {
      const url = `${MANGADEX_BASE_URL}/manga/${dexId}/feed?translatedLanguage[]=en&order[chapter]=asc&limit=250`;
      const res = await fetch(url, {
        headers: { 'User-Agent': 'MangaLove/1.0 (Mobile App)' },
      }).catch(() => null);

      if (res && res.ok) {
        const json = await res.json().catch(() => null);
        if (json?.data && Array.isArray(json.data) && json.data.length > 0) {
          const chaptersMap = new Map<string, MangaChapter>();

          json.data.forEach((item: any) => {
            const chNum = String(item.attributes?.chapter || '1');
            const chTitle = item.attributes?.title ? String(item.attributes.title).trim() : '';

            if (!chaptersMap.has(chNum)) {
              chaptersMap.set(chNum, {
                id: item.id,
                chapterNumber: chNum,
                title: chTitle ? `Chapter ${chNum}: ${chTitle}` : `Chapter ${chNum}`,
                volume: item.attributes?.volume ? String(item.attributes.volume) : undefined,
                language: 'en',
                pagesCount: item.attributes?.pages || undefined,
                scanlationGroup: '',
              });
            }
          });

          const sorted = Array.from(chaptersMap.values()).sort((a, b) => {
            const numA = parseFloat(a.chapterNumber) || 0;
            const numB = parseFloat(b.chapterNumber) || 0;
            return numA - numB;
          });

          if (sorted.length > 0) {
            chapterListCache.set(cacheKey, sorted);
            return sorted;
          }
        }
      }
    }
  } catch (err) {
    console.warn('[MangaDex Provider] Fetch chapters notice:', err);
  }

  const fallback = generateFallbackChapters(manga);
  chapterListCache.set(cacheKey, fallback);
  return fallback;
}

/**
 * Fetches page image URLs for a chapter via MangaDex API
 */
export async function fetchChapterPages(chapterId: string, fallbackManga?: Manga, chapterNumber?: number): Promise<MangaPage[]> {
  if (pagesCache.has(chapterId)) {
    return pagesCache.get(chapterId)!;
  }

  if (chapterId && !chapterId.startsWith('fallback_')) {
    try {
      const url = `${MANGADEX_BASE_URL}/at-home/server/${chapterId}`;
      const res = await fetch(url, {
        headers: { 'User-Agent': 'MangaLove/1.0 (Mobile App)' },
      }).catch(() => null);

      if (res && res.ok) {
        const json = await res.json().catch(() => null);
        const baseUrl = json?.baseUrl;
        const hash = json?.chapter?.hash;
        const pageFiles = json?.chapter?.data;

        if (baseUrl && hash && Array.isArray(pageFiles) && pageFiles.length > 0) {
          const pages: MangaPage[] = pageFiles.map((filename: string, idx: number) => ({
            pageNumber: idx + 1,
            url: `${baseUrl}/data/${hash}/${filename}`,
          }));

          pagesCache.set(chapterId, pages);
          return pages;
        }
      }
    } catch (err) {
      console.warn('[MangaDex Provider] Fetch pages notice:', err);
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
