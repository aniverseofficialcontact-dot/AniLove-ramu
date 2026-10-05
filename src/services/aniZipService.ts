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
 * Fetches AniZip mappings for a given AniList ID (cached in memory)
 */
export async function getAniZipMapping(anilistId?: number): Promise<AniZipMapping | null> {
  if (!anilistId || anilistId <= 0) return null;
  if (aniZipCache.has(anilistId)) {
    return aniZipCache.get(anilistId)!;
  }

  try {
    const res = await fetch(`https://api.ani.zip/mappings?anilist_id=${anilistId}`, {
      headers: { 'Accept': 'application/json' },
    });
    if (res.ok) {
      const data = await res.json();
      const episodeMap: Record<number, number> = {};
      if (data.episodes && typeof data.episodes === 'object') {
        Object.entries(data.episodes).forEach(([epKey, epVal]: [string, any]) => {
          const epNum = parseInt(epKey, 10);
          if (!isNaN(epNum) && epVal) {
            episodeMap[epNum] = epVal.tvdbEpisode || epVal.absolute || epNum;
          }
        });
      }

      const mapping: AniZipMapping = {
        anilistId,
        malId: data.mappings?.mal_id || data.mappings?.mal || 0,
        titleEn: data.titles?.en || undefined,
        titleRj: data.titles?.rj || undefined,
        episodeOffset: typeof data.episodeOffset === 'number' ? data.episodeOffset : 0,
        season: typeof data.season === 'number' ? data.season : 1,
        episodeMap,
      };

      aniZipCache.set(anilistId, mapping);
      return mapping;
    }
  } catch (err) {
    console.warn(`[AniZip] Failed fetching mapping for AniList ID ${anilistId}:`, err);
  }

  return null;
}

/**
 * Cleans anime title by stripping common release tags (Cour 1, Cour 2, Part 1, Part 2, etc.)
 */
export function cleanAnimeTitleForQuery(title: string): string {
  if (!title) return 'Anime';
  return title
    .replace(/\s*\(.*?\)/g, '')
    .replace(/\s*\[.*?\]/g, '')
    .replace(/\s*-\s*/g, ' ')
    .replace(/(?:\b(Cour|Part|Season|S)\s*\d+\b)/gi, '')
    .replace(/(?:\b(2nd|3rd|4th|5th|6th|7th|8th|9th)\s*Season\b)/gi, '')
    .replace(/:\s*$/, '')
    .replace(/\s+/g, ' ')
    .trim();
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
