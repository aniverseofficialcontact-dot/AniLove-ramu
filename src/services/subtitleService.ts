/**
 * Unified Subtitle Service for AniLove
 * Fetches, caches (3-day expiry), anonymizes, sorts, and validates multi-language subtitles from
 * https://subtitles-l8cm.onrender.com/subtitles.php
 */

export interface RawSubtitleTrack {
  id: string;
  provider: string; // "HiAnime" | "SubtitleCat" | etc.
  language: string; // e.g. "English", "Spanish", "Arabic"
  code: string;     // e.g. "en", "es", "ar"
  isDefault?: boolean;
  url: string;
}

export interface FormattedSubtitleTrack {
  id: string;
  displayLabel: string; // e.g. "English", "English 2", "Spanish"
  language: string;
  code: string;
  url: string;
  isDefault: boolean;
}

export interface SubtitleApiResponse {
  success: boolean;
  provider?: string;
  anilistId: number;
  episode: string | number;
  totalTracks: number;
  subtitles: RawSubtitleTrack[];
}

const CACHE_PREFIX = 'anilove_subtitle_cache_';
const CACHE_TTL_MS = 72 * 60 * 60 * 1000; // 72 Hours (3 Days)

/**
 * Reads local cached subtitle payload if valid and under 3 days old
 */
export function getCachedSubtitles(anilistId: number, epNum: number): RawSubtitleTrack[] | null {
  try {
    const key = `${CACHE_PREFIX}${anilistId}_${epNum}`;
    const raw = localStorage.getItem(key);
    if (!raw) return null;
    const parsed = JSON.parse(raw);
    if (!parsed || !parsed.timestamp || !parsed.tracks) return null;

    if (Date.now() - parsed.timestamp > CACHE_TTL_MS) {
      localStorage.removeItem(key);
      return null;
    }
    return parsed.tracks as RawSubtitleTrack[];
  } catch (e) {
    console.error('Error reading subtitle cache:', e);
    return null;
  }
}

/**
 * Saves subtitle tracks to 3-day local cache
 */
export function saveCachedSubtitles(anilistId: number, epNum: number, tracks: RawSubtitleTrack[]): void {
  try {
    const key = `${CACHE_PREFIX}${anilistId}_${epNum}`;
    const data = {
      timestamp: Date.now(),
      tracks: tracks
    };
    localStorage.setItem(key, JSON.stringify(data));
  } catch (e) {
    console.error('Error saving subtitle cache:', e);
  }
}

/**
 * Evicts local subtitle cache for a specific episode (e.g. when marked completed or removed from history)
 */
export function evictSubtitleCache(anilistId: number, epNum: number): void {
  try {
    const key = `${CACHE_PREFIX}${anilistId}_${epNum}`;
    localStorage.removeItem(key);
  } catch (e) {
    console.error('Error evicting subtitle cache:', e);
  }
}

/**
 * Fetches subtitles from https://subtitles-l8cm.onrender.com/subtitles.php with 3-day caching
 */
export async function fetchUnifiedSubtitles(anilistId: number, epNum: number): Promise<RawSubtitleTrack[]> {
  if (!anilistId || !epNum) return [];

  // Check 3-day local cache first
  const cached = getCachedSubtitles(anilistId, epNum);
  if (cached && cached.length > 0) {
    return cached;
  }

  try {
    const apiUrl = `https://subtitles-l8cm.onrender.com/subtitles.php?anilistId=${anilistId}&ep=${epNum}`;
    const res = await fetch(apiUrl);
    if (!res.ok) throw new Error(`Subtitle API HTTP ${res.status}`);
    const data: SubtitleApiResponse = await res.json();

    if (data && data.success && Array.isArray(data.subtitles) && data.subtitles.length > 0) {
      saveCachedSubtitles(anilistId, epNum, data.subtitles);
      return data.subtitles;
    }
  } catch (err) {
    console.warn(`[SubtitleService] Failed to fetch subtitles for AniList ${anilistId} Ep ${epNum}:`, err);
  }
  return [];
}

/**
 * Anonymizes provider names (hides "HiAnime" / "SubtitleCat") and applies strict priority sorting
 */
export function anonymizeAndSortSubtitleTracks(
  rawTracks: RawSubtitleTrack[],
  primaryPref: string = 'English',
  secondaryPref: string = 'English 2'
): FormattedSubtitleTrack[] {
  if (!rawTracks || rawTracks.length === 0) return [];

  // 1. Anonymize provider names into clean display labels
  const langCounts: Record<string, number> = {};
  const formattedList: FormattedSubtitleTrack[] = rawTracks.map(t => {
    const baseLang = t.language || 'English';
    const count = (langCounts[baseLang] || 0) + 1;
    langCounts[baseLang] = count;

    // Display Label: "English", "English 2", "Spanish", "Spanish 2"
    const displayLabel = count === 1 ? baseLang : `${baseLang} ${count}`;

    return {
      id: t.id || `${baseLang.toLowerCase()}_${count}`,
      displayLabel: displayLabel,
      language: baseLang,
      code: t.code || 'en',
      url: t.url,
      isDefault: t.isDefault || false
    };
  });

  // 2. Strict Priority Sorting
  return formattedList.sort((a, b) => {
    const getPriorityRank = (track: FormattedSubtitleTrack): number => {
      const lbl = track.displayLabel.toLowerCase().trim();
      const code = track.code.toLowerCase().trim();
      const lang = track.language.toLowerCase().trim();

      if (lbl === primaryPref.toLowerCase().trim() || lang === primaryPref.toLowerCase().trim()) return 10;
      if (lbl === secondaryPref.toLowerCase().trim() || lang === secondaryPref.toLowerCase().trim()) return 20;

      if (lang === 'spanish' || code === 'es' || code === 'spa') return 30;
      if (lang === 'german' || code === 'de' || code === 'ger') return 40;
      if (lang === 'russian' || code === 'ru' || code === 'rus') return 50;
      if (lang === 'arabic' || code === 'ar' || code === 'ara') return 60;
      if (lang === 'french' || code === 'fr' || code === 'fra') return 70;
      if (lang === 'italian' || code === 'it' || code === 'ita') return 80;
      if (lang === 'portuguese' || code === 'pt' || code === 'por') return 90;

      return 100; // All other languages
    };

    const rankA = getPriorityRank(a);
    const rankB = getPriorityRank(b);

    if (rankA !== rankB) return rankA - rankB;
    return a.displayLabel.localeCompare(b.displayLabel);
  });
}

/**
 * Validates batch download subtitle availability across multiple episodes.
 * Returns valid: true if all episodes have target language, or invalid details if missing.
 */
export async function verifyBatchSubtitleAvailability(
  anilistId: number,
  epNumbers: number[],
  targetLangNameOrCode: string
): Promise<{ valid: boolean; missingEpisode?: number; missingLangName?: string }> {
  if (!anilistId || !epNumbers || epNumbers.length === 0) return { valid: true };

  const targetClean = targetLangNameOrCode.toLowerCase().trim();

  for (const ep of epNumbers) {
    const tracks = await fetchUnifiedSubtitles(anilistId, ep);
    const hasLang = tracks.some(t => {
      const langName = (t.language || '').toLowerCase().trim();
      const code = (t.code || '').toLowerCase().trim();
      return langName === targetClean || code === targetClean || targetClean.includes(langName) || targetClean.includes(code);
    });

    if (!hasLang) {
      return {
        valid: false,
        missingEpisode: ep,
        missingLangName: targetLangNameOrCode
      };
    }
  }

  return { valid: true };
}
