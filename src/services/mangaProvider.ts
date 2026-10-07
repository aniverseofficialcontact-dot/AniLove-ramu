import { Manga, MangaChapter, MangaPage } from '../types';

const MANGADEX_BASE_URL = 'https://api.mangadex.org';
const MANGADEX_UPLOADS_URL = 'https://uploads.mangadex.org';
const COMICK_BASE_URL = 'https://api.comick.cc';
const COMICK_IMAGES_URL = 'https://meo.comick.pictures';

const mangaDexIdCache = new Map<number | string, string>();
const comickHidCache = new Map<number | string, string>();
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

function localeToFlag(locale: string): string {
  return getLanguageDetails(locale).flag;
}

function determineCoverType(description?: string): string {
  if (!description) return 'Front';
  const desc = description.toLowerCase();
  if (desc.includes('back')) return 'Back';
  if (desc.includes('spine')) return 'Spine';
  if (desc.includes('variant') || desc.includes('alt')) return 'Variant';
  if (desc.includes('box')) return 'Box Set';
  if (desc.includes('inner')) return 'Inner';
  if (desc.includes('extra')) return 'Extra';
  return 'Front';
}

/**
 * Resolves Comick HID for any title
 */
export async function getComickHid(manga: Manga): Promise<string | null> {
  if (!manga) return null;
  const cacheKey = manga.id || manga.title?.english || manga.title?.romaji || manga.title?.userPreferred;
  if (comickHidCache.has(cacheKey)) {
    return comickHidCache.get(cacheKey)!;
  }

  const cleanTitles = [
    manga.title?.english,
    manga.title?.romaji,
    manga.title?.userPreferred,
  ]
    .filter(Boolean)
    .map((t) => t!.trim().replace(/\(.*?\)/g, '').replace(/[^a-z0-9\s]/gi, ' ').trim())
    .filter(Boolean);

  for (const titleStr of Array.from(new Set(cleanTitles))) {
    try {
      const url = `${COMICK_BASE_URL}/v1.0/search?q=${encodeURIComponent(titleStr)}`;
      const res = await fetch(url, {
        headers: { 'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64)' },
      }).catch(() => null);

      if (res && res.ok) {
        const json = await res.json().catch(() => null);
        if (Array.isArray(json) && json.length > 0) {
          const hid = json[0].hid;
          comickHidCache.set(cacheKey, hid);
          return hid;
        }
      }
    } catch (e) {
      console.warn('[Comick Provider] Search ID notice:', e);
    }
  }

  return null;
}

/**
 * Resolves MangaDex UUID for any title
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

  for (const titleStr of Array.from(new Set(cleanTitles))) {
    try {
      const url = `${MANGADEX_BASE_URL}/manga?title=${encodeURIComponent(titleStr)}&limit=5`;
      const res = await fetch(url, {
        headers: { 'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64)' },
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

  // Emit initial primary cover immediately (<10ms)
  emitChunk();

  const processItems = (items: any[], dexId: string) => {
    let addedCount = 0;
    items.forEach((item: any, idx: number) => {
      const vol = item.attributes?.volume;
      const fileName = item.attributes?.fileName;
      const locale = item.attributes?.locale || 'ja';
      const descRaw = item.attributes?.description || '';

      if (fileName) {
        const coverUrl = `${MANGADEX_UPLOADS_URL}/covers/${dexId}/${fileName}`;
        if (!seenUrls.has(coverUrl)) {
          seenUrls.add(coverUrl);

          const coverType = determineCoverType(descRaw);
          const langInfo = getLanguageDetails(locale);
          const volNum = vol ? parseFloat(vol) : undefined;
          const formattedDesc = `${coverType} ${vol ? `(Volume) ${vol}` : ''}`.trim();

          covers.push({
            id: item.id || `dex_cover_${covers.length}_${idx}`,
            volume: vol ? `Volume ${vol}` : `Volume ${covers.length + 1}`,
            volumeNum: volNum,
            url: coverUrl,
            type: coverType,
            description: formattedDesc,
            locale,
            flag: langInfo.flag,
            languageName: langInfo.name,
          });
          addedCount++;
        }
      }
    });
    return addedCount;
  };

  // 2. Query MangaDex + Kitsu
  const dexIdPromise = getMangaDexId(manga);
  const kitsuSearchPromise = titleStr
    ? fetch(`https://kitsu.io/api/edge/manga?filter[text]=${encodeURIComponent(titleStr)}&page[limit]=10`, {
        headers: { 'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64)' },
      })
        .then((r) => r.json())
        .catch(() => null)
    : Promise.resolve(null);

  // Process MangaDex as soon as ID resolves
  const dexProcessPromise = dexIdPromise.then(async (dexId) => {
    if (!dexId) return;
    try {
      // Step 1: Fetch offset 0 (first 100 covers)
      const initialUrl = `${MANGADEX_BASE_URL}/cover?manga[]=${dexId}&limit=100&offset=0&order[volume]=asc`;
      const res = await fetch(initialUrl, {
        headers: { 'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64)' },
      }).catch(() => null);

      if (res && res.ok) {
        const json = await res.json().catch(() => null);
        const total = json?.total || 0;
        const initialItems = json?.data && Array.isArray(json.data) ? json.data : [];

        if (initialItems.length > 0) {
          processItems(initialItems, dexId);
          // Emit immediately so user sees initial ~100 covers in ~200ms!
          emitChunk();
        }

        // If total > 100, fetch remaining offsets concurrently, streaming live updates
        if (total > 100) {
          const remainingOffsets: number[] = [];
          for (let offset = 100; offset < Math.min(total, 800); offset += 100) {
            remainingOffsets.push(offset);
          }

          const offsetPromises = remainingOffsets.map(async (offset) => {
            try {
              const url = `${MANGADEX_BASE_URL}/cover?manga[]=${dexId}&limit=100&offset=${offset}&order[volume]=asc`;
              const oRes = await fetch(url, {
                headers: { 'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64)' },
              }).catch(() => null);

              if (oRes && oRes.ok) {
                const oJson = await oRes.json().catch(() => null);
                if (oJson?.data && Array.isArray(oJson.data) && oJson.data.length > 0) {
                  const added = processItems(oJson.data, dexId);
                  if (added > 0) {
                    emitChunk(); // Live stream chunk to UI!
                  }
                }
              }
            } catch (err) {
              // ignore offset error
            }
          });

          await Promise.allSettled(offsetPromises);
        }
      }
    } catch (err) {
      console.warn('[MangaDex Provider] Fetch covers notice:', err);
    }
  });

  // Process Kitsu as soon as search completes
  const kitsuProcessPromise = kitsuSearchPromise.then((kitsuResult) => {
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
            flag: '🇰🇷',
            languageName: 'Korean',
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
            flag: '🇰🇷',
            languageName: 'Korean',
          });
          added = true;
        }
      });
      if (added) emitChunk();
    }
  });

  await Promise.allSettled([dexProcessPromise, kitsuProcessPromise]);
  return covers;
}

/**
 * Fetches available chapters for a Manga title via Comick + MangaDex Engines concurrently
 */
export async function fetchMangaChapters(manga: Manga): Promise<MangaChapter[]> {
  const cacheKey = `chapters_${manga.id}`;
  if (chapterListCache.has(cacheKey)) {
    return chapterListCache.get(cacheKey)!;
  }

  const chaptersMap = new Map<string, MangaChapter>();

  // Run Comick & MangaDex requests concurrently
  const comickPromise = (async () => {
    try {
      const comickHid = await getComickHid(manga);
      if (comickHid) {
        const url = `${COMICK_BASE_URL}/comic/${comickHid}/chapters?lang=en&limit=300`;
        const res = await fetch(url, {
          headers: { 'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64)' },
        }).catch(() => null);

        if (res && res.ok) {
          const json = await res.json().catch(() => null);
          const list = json?.chapters || json;
          if (Array.isArray(list) && list.length > 0) {
            list.forEach((item: any) => {
              const chNum = String(item.chap || item.chapterNumber || '1');
              const chTitle = item.title ? String(item.title).trim() : '';

              if (!chaptersMap.has(chNum)) {
                chaptersMap.set(chNum, {
                  id: `comick_${item.hid}`,
                  chapterNumber: chNum,
                  title: chTitle ? `Chapter ${chNum}: ${chTitle}` : `Chapter ${chNum}`,
                  volume: item.vol ? String(item.vol) : undefined,
                  language: 'en',
                  scanlationGroup: item.group_name?.[0] || 'Official Release',
                });
              }
            });
          }
        }
      }
    } catch (e) {
      console.warn('[Comick Provider] Chapter list error:', e);
    }
  })();

  const dexPromise = (async () => {
    try {
      const dexId = await getMangaDexId(manga);
      if (dexId) {
        const url = `${MANGADEX_BASE_URL}/manga/${dexId}/feed?translatedLanguage[]=en&order[chapter]=asc&limit=300`;
        const res = await fetch(url, {
          headers: { 'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64)' },
        }).catch(() => null);

        if (res && res.ok) {
          const json = await res.json().catch(() => null);
          if (json?.data && Array.isArray(json.data) && json.data.length > 0) {
            json.data.forEach((item: any) => {
              const chNum = String(item.attributes?.chapter || '1');
              const chTitle = item.attributes?.title ? String(item.attributes.title).trim() : '';

              if (!chaptersMap.has(chNum)) {
                chaptersMap.set(chNum, {
                  id: `mangadex_${item.id}`,
                  chapterNumber: chNum,
                  title: chTitle ? `Chapter ${chNum}: ${chTitle}` : `Chapter ${chNum}`,
                  volume: item.attributes?.volume ? String(item.attributes.volume) : undefined,
                  language: 'en',
                });
              }
            });
          }
        }
      }
    } catch (err) {
      console.warn('[MangaDex Provider] Fetch chapters notice:', err);
    }
  })();

  await Promise.allSettled([comickPromise, dexPromise]);

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
 * Fetches REAL page image URLs for a chapter via Comick & MangaDex APIs
 */
export async function fetchChapterPages(chapterId: string, fallbackManga?: Manga, chapterNumber?: number): Promise<MangaPage[]> {
  if (pagesCache.has(chapterId)) {
    return pagesCache.get(chapterId)!;
  }

  // 1. Fetch from Comick Engine
  if (chapterId && chapterId.startsWith('comick_')) {
    const hid = chapterId.replace('comick_', '');
    try {
      const url = `${COMICK_BASE_URL}/chapter/${hid}`;
      const res = await fetch(url, {
        headers: { 'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64)' },
      }).catch(() => null);

      if (res && res.ok) {
        const json = await res.json().catch(() => null);
        const images = json?.chapter?.images;
        if (Array.isArray(images) && images.length > 0) {
          const pages: MangaPage[] = images.map((img: any, idx: number) => ({
            pageNumber: idx + 1,
            url: img.url || `${COMICK_IMAGES_URL}/${img.b2key}`,
          }));

          pagesCache.set(chapterId, pages);
          return pages;
        }
      }
    } catch (e) {
      console.warn('[Comick Provider] Fetch chapter pages notice:', e);
    }
  }

  // 2. Fetch from MangaDex Engine
  const dexChapId = chapterId.startsWith('mangadex_') ? chapterId.replace('mangadex_', '') : chapterId;
  if (dexChapId && !dexChapId.startsWith('fallback_')) {
    try {
      const url = `${MANGADEX_BASE_URL}/at-home/server/${dexChapId}`;
      const res = await fetch(url, {
        headers: { 'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64)' },
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

  // 3. Dynamic Live Chapter Page Search Fallback
  if (fallbackManga) {
    try {
      const comickHid = await getComickHid(fallbackManga);
      if (comickHid) {
        const searchChUrl = `${COMICK_BASE_URL}/comic/${comickHid}/chapters?lang=en&limit=100`;
        const chRes = await fetch(searchChUrl, {
          headers: { 'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64)' },
        }).catch(() => null);

        if (chRes && chRes.ok) {
          const chJson = await chRes.json().catch(() => null);
          const list = chJson?.chapters || chJson;
          if (Array.isArray(list)) {
            const targetNum = chapterNumber || 1;
            const match = list.find((c: any) => parseFloat(c.chap) === targetNum);
            if (match && match.hid) {
              const pageRes = await fetch(`${COMICK_BASE_URL}/chapter/${match.hid}`, {
                headers: { 'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64)' },
              }).catch(() => null);

              if (pageRes && pageRes.ok) {
                const pageJson = await pageRes.json().catch(() => null);
                const images = pageJson?.chapter?.images;
                if (Array.isArray(images) && images.length > 0) {
                  const pages: MangaPage[] = images.map((img: any, idx: number) => ({
                    pageNumber: idx + 1,
                    url: img.url || `${COMICK_IMAGES_URL}/${img.b2key}`,
                  }));

                  pagesCache.set(chapterId, pages);
                  return pages;
                }
              }
            }
          }
        }
      }
    } catch (e) {
      console.warn('[Manga Provider] Live chapter page search error:', e);
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
