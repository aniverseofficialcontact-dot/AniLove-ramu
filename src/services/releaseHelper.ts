import { Anime } from '../types';

export interface ReleaseStatus {
  isReleased: boolean;
  releasedEpisodeCount: number;
  buttonLabel: string; // e.g. "Watch Episodes", "Coming on Oct 12, 2026", "Coming in 2027", "Coming Soon"
  releaseDateText?: string;
  isUpcoming: boolean;
}

const MONTH_NAMES = [
  'Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun',
  'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'
];

/**
 * Returns complete release status, released episode count, and formatted button text for any anime.
 */
export function getAnimeReleaseStatus(anime?: Anime | null, details?: any): ReleaseStatus {
  if (!anime && !details) {
    return {
      isReleased: true,
      releasedEpisodeCount: 24,
      buttonLabel: 'Watch Episodes',
      isUpcoming: false,
    };
  }

  const target = details || anime;
  const status = (target.status || '').toUpperCase();
  const nextAiringEp = target.nextAiringEpisode || anime?.nextAiringEpisode;

  // 1. Check if anime is explicitly NOT_YET_RELEASED or if 1st episode hasn't aired yet
  const isNotYetReleased = status === 'NOT_YET_RELEASED' || (nextAiringEp && nextAiringEp.episode === 1);

  if (isNotYetReleased) {
    const startDate = target.startDate || anime?.startDate;
    const seasonYear = target.seasonYear || anime?.seasonYear || startDate?.year;
    const season = target.season || anime?.season;

    let buttonLabel = 'Coming Soon';
    let releaseDateText = '';

    if (startDate && startDate.year && startDate.month && startDate.day) {
      const monthStr = MONTH_NAMES[(startDate.month - 1) % 12] || 'Jan';
      releaseDateText = `${monthStr} ${startDate.day}, ${startDate.year}`;
      buttonLabel = `Coming on ${releaseDateText}`;
    } else if (season && seasonYear) {
      const formattedSeason = season.charAt(0).toUpperCase() + season.slice(1).toLowerCase();
      releaseDateText = `${formattedSeason} ${seasonYear}`;
      buttonLabel = `Coming in ${releaseDateText}`;
    } else if (startDate?.year || seasonYear) {
      const yr = startDate?.year || seasonYear;
      releaseDateText = `${yr}`;
      buttonLabel = `Coming in ${yr}`;
    }

    return {
      isReleased: false,
      releasedEpisodeCount: 0,
      buttonLabel,
      releaseDateText,
      isUpcoming: true,
    };
  }

  // 2. Anime is RELEASING (Ongoing Airing)
  if (status === 'RELEASING') {
    let airedCount = 1;
    if (nextAiringEp && typeof nextAiringEp.episode === 'number') {
      airedCount = Math.max(0, nextAiringEp.episode - 1);
    } else if (target.episodes && target.episodes > 0) {
      airedCount = target.episodes;
    } else if (anime?.episodes && anime.episodes > 0) {
      airedCount = anime.episodes;
    }

    if (airedCount === 0) {
      const startDate = target.startDate || anime?.startDate;
      const seasonYear = target.seasonYear || anime?.seasonYear || startDate?.year;
      let buttonLabel = 'Coming Soon';

      if (startDate && startDate.year && startDate.month && startDate.day) {
        const monthStr = MONTH_NAMES[(startDate.month - 1) % 12] || 'Jan';
        buttonLabel = `Coming on ${monthStr} ${startDate.day}, ${startDate.year}`;
      } else if (startDate?.year || seasonYear) {
        const yr = startDate?.year || seasonYear;
        buttonLabel = `Coming in ${yr}`;
      }

      return {
        isReleased: false,
        releasedEpisodeCount: 0,
        buttonLabel,
        isUpcoming: true,
      };
    }

    return {
      isReleased: true,
      releasedEpisodeCount: airedCount,
      buttonLabel: 'Watch Episodes',
      isUpcoming: false,
    };
  }

  // 3. Anime is FINISHED / HIATUS or other
  let totalEp = target.episodes || anime?.episodes || 24;
  if (totalEp <= 0) totalEp = 24;

  return {
    isReleased: true,
    releasedEpisodeCount: totalEp,
    buttonLabel: 'Watch Episodes',
    isUpcoming: false,
  };
}

/**
 * Strict 7-Day Airing Check: Check if an episode aired within the last 7 days (X -> X + 7)
 */
export function isFreshAiredEpisodeWithin7Days(
  anime?: Anime | null,
  details?: any,
  episodeNumber: number = 1
): boolean {
  if (!anime && !details) return false;

  const target = details || anime;
  const nextAiring = target?.nextAiringEpisode || anime?.nextAiringEpisode;

  let episodeAirTimeMs: number | null = null;

  if (nextAiring && typeof nextAiring.episode === 'number' && nextAiring.airingAt) {
    const nextEpNum = nextAiring.episode;
    const nextEpAiringMs = nextAiring.airingAt * 1000;

    if (episodeNumber >= nextEpNum) {
      return false;
    }

    if (episodeNumber < nextEpNum) {
      const diffEps = nextEpNum - episodeNumber;
      episodeAirTimeMs = nextEpAiringMs - diffEps * 7 * 24 * 60 * 60 * 1000;
    }
  }

  // Fallback to startDate if episode 1 and no nextAiring
  if (!episodeAirTimeMs && episodeNumber === 1) {
    const startDate = target?.startDate || anime?.startDate;
    if (startDate?.year && startDate?.month && startDate?.day) {
      episodeAirTimeMs = new Date(
        startDate.year,
        startDate.month - 1,
        startDate.day
      ).getTime();
    }
  }

  if (!episodeAirTimeMs) return false;

  const nowMs = Date.now();
  const diffMs = nowMs - episodeAirTimeMs;
  const sevenDaysMs = 7 * 24 * 60 * 60 * 1000;

  return diffMs >= 0 && diffMs <= sevenDaysMs;
}
