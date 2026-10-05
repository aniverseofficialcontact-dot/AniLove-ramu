export interface AniZipMapping {
  anilistId: number;
  malId?: number;
  titleEn?: string;
  titleRj?: string;
  episodeOffset: number;
  season: number;
  episodeMap: Record<number, number>;
}

const aniZipCache = new Map<number, AniZipMapping>();

/**
 * Cleans anime title by stripping release tags, years like (2021), (Cour 1, Cour 2, Part 1, Part 2, etc.)
 */
export function cleanAnimeTitleForQuery(title: string): string {
  if (!title) return 'Anime';
  return title
    .replace(/\s*\(\d{4}\)/g, '')
    .replace(/\s*\(.*?\)/g, '')
    .replace(/\s*\[.*?\]/g, '')
    .replace(/(?:\b(Cour|Part|Season|S)\s*\d+\b)/gi, '')
    .replace(/(?:\b(2nd|3rd|4th|5th|6th|7th|8th|9th)\s*Season\b)/gi, '')
    .replace(/:\s*$/, '')
    .replace(/\s+/g, ' ')
    .trim();
}

/**
 * Fetches AniZip mappings for a given AniList ID (cached in memory and localStorage for 0ms access)
 */
export async function getAniZipMapping(anilistId?: number): Promise<AniZipMapping | null> {
  if (!anilistId || anilistId <= 0) return null;

  // 1. In-memory cache
  if (aniZipCache.has(anilistId)) {
    return aniZipCache.get(anilistId)!;
  }

  // 2. LocalStorage cache
  try {
    const local = localStorage.getItem(`anizip_map_${anilistId}`);
    if (local) {
      const parsed = JSON.parse(local);
      if (parsed && typeof parsed === 'object') {
        aniZipCache.set(anilistId, parsed);
        return parsed;
      }
    }
  } catch (ignored) {}

  // 3. Fast network fetch with 1000ms timeout
  try {
    const controller = typeof AbortController !== 'undefined' ? new AbortController() : null;
    const timeoutId = controller ? setTimeout(() => controller.abort(), 1000) : null;

    const res = await fetch(`https://api.ani.zip/mappings?anilist_id=${anilistId}`, {
      headers: { 'Accept': 'application/json' },
      signal: controller?.signal,
    });
    if (timeoutId) clearTimeout(timeoutId);

    if (res.ok) {
      const data = await res.json();
      const episodeMap: Record<number, number> = {};
      if (data.episodes && typeof data.episodes === 'object') {
        Object.entries(data.episodes).forEach(([epKey, epVal]: [string, any]) => {
          const epNum = parseInt(epKey, 10);
          if (!isNaN(epNum) && epVal) {
            const mappedEp = epVal.episodeNumber || epVal.absoluteEpisodeNumber || epVal.tvdbEpisode || epVal.absolute || epNum;
            episodeMap[epNum] = mappedEp;
          }
        });
      }

      const rawTitleEn = data.titles?.en || undefined;
      const rawTitleRj = data.titles?.rj || undefined;
      const cleanTitleEn = rawTitleEn ? cleanAnimeTitleForQuery(rawTitleEn) : undefined;
      const cleanTitleRj = rawTitleRj ? cleanAnimeTitleForQuery(rawTitleRj) : undefined;

      const mapping: AniZipMapping = {
        anilistId,
        malId: data.mappings?.mal_id || data.mappings?.mal || 0,
        titleEn: cleanTitleEn,
        titleRj: cleanTitleRj,
        episodeOffset: typeof data.episodeOffset === 'number' ? data.episodeOffset : 0,
        season: typeof data.season === 'number' ? data.season : 1,
        episodeMap,
      };

      aniZipCache.set(anilistId, mapping);
      try {
        localStorage.setItem(`anizip_map_${anilistId}`, JSON.stringify(mapping));
      } catch (ignored) {}

      return mapping;
    }
  } catch (err) {
    // Timeout or network error fallback
  }

  return null;
}

export function resolveMappedEpisode(mapping: AniZipMapping | null, originalEp: number): number {
  if (!mapping) return originalEp;
  if (mapping.episodeMap && typeof mapping.episodeMap[originalEp] === 'number') {
    return mapping.episodeMap[originalEp];
  }
  if (mapping.episodeOffset > 0) {
    return originalEp + mapping.episodeOffset;
  }
  return originalEp;
}

export function resolveMappedTitle(mapping: AniZipMapping | null, fallbackTitle: string): string {
  if (mapping?.titleEn) return mapping.titleEn;
  if (mapping?.titleRj) return mapping.titleRj;
  return cleanAnimeTitleForQuery(fallbackTitle);
}
