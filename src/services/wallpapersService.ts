export interface WallpaperPost {
  id: number;
  tags: string;
  created_at: number;
  author: string;
  score: number;
  rating: 's' | 'q' | 'e'; // s=safe, q=questionable, e=explicit
  file_url: string;
  jpeg_url?: string;
  sample_url?: string;
  preview_url: string;
  width: number;
  height: number;
  source_site: 'yandere' | 'konachan';
}

/**
 * Fetch high-resolution 4K anime wallpapers from Yandere and Konachan with strict SFW / 18+ rating filter
 */
export async function fetchAnimeWallpapers(
  query = '',
  page = 1,
  allowNsfw = false,
  aspectRatioFilter: 'all' | 'mobile' | 'desktop' = 'all'
): Promise<WallpaperPost[]> {
  const posts: WallpaperPost[] = [];

  // Helper for ratings tag
  const ratingTag = allowNsfw ? '' : ' rating:safe';

  let cleanQuery = query.trim().toLowerCase().replace(/\s+/g, '_');
  let tagQuery = '';

  // Smart Tag Resolution for Yandere / Konachan (e.g. "gojo" -> "gojou_satoru", "rimuru" -> "rimuru_tempest")
  if (cleanQuery) {
    let bestTag = `${cleanQuery}*`;
    try {
      const tagRes = await fetch(`https://yande.re/tag.json?name=*${encodeURIComponent(cleanQuery)}*&order=count&limit=10`);
      if (tagRes.ok) {
        const tagList = await tagRes.json();
        if (Array.isArray(tagList) && tagList.length > 0) {
          const topMatch = tagList.sort((a: any, b: any) => (b.count || 0) - (a.count || 0))[0];
          if (topMatch && topMatch.name) {
            bestTag = topMatch.name;
          }
        }
      }
    } catch (e) {
      console.warn('[Yandere] Tag autocomplete warning:', e);
    }
    tagQuery = `${bestTag}${ratingTag}`;
  } else {
    tagQuery = ratingTag.trim() || 'order:score';
  }

  // 1. Fetch from Yandere
  try {
    const yandereUrl = `https://yande.re/post.json?limit=25&page=${page}&tags=${encodeURIComponent(tagQuery)}`;
    const res = await fetch(yandereUrl);
    if (res.ok) {
      const data = await res.json();
      if (Array.isArray(data)) {
        data.forEach((item: any) => {
          if (item.file_url || item.sample_url || item.jpeg_url) {
            posts.push({
              id: item.id,
              tags: item.tags || '',
              created_at: item.created_at || Date.now(),
              author: item.author || 'Artist',
              score: item.score || 0,
              rating: item.rating || 's',
              file_url: item.jpeg_url || item.file_url || item.sample_url,
              jpeg_url: item.jpeg_url,
              sample_url: item.sample_url,
              preview_url: item.preview_url || item.sample_url || item.file_url,
              width: item.width || 1920,
              height: item.height || 1080,
              source_site: 'yandere',
            });
          }
        });
      }
    }
  } catch (err) {
    console.warn('Error fetching Yandere wallpapers:', err);
  }

  // 2. Fetch from Konachan
  try {
    const konachanUrl = `https://konachan.com/post.json?limit=25&page=${page}&tags=${encodeURIComponent(tagQuery)}`;
    const res = await fetch(konachanUrl);
    if (res.ok) {
      const data = await res.json();
      if (Array.isArray(data)) {
        data.forEach((item: any) => {
          if (item.file_url || item.sample_url || item.jpeg_url) {
            posts.push({
              id: item.id + 1000000,
              tags: item.tags || '',
              created_at: item.created_at || Date.now(),
              author: item.author || 'Artist',
              score: item.score || 0,
              rating: item.rating || 's',
              file_url: item.jpeg_url || item.file_url || item.sample_url,
              jpeg_url: item.jpeg_url,
              sample_url: item.sample_url,
              preview_url: item.preview_url || item.sample_url || item.file_url,
              width: item.width || 1920,
              height: item.height || 1080,
              source_site: 'konachan',
            });
          }
        });
      }
    }
  } catch (err) {
    console.warn('Error fetching Konachan wallpapers:', err);
  }

  // Filter out explicit / questionable ratings if allowNsfw is false
  let filtered = posts.filter((p) => {
    if (!p.file_url) return false;

    if (!allowNsfw) {
      if (p.rating === 'e' || p.rating === 'q') return false;

      const tags = (p.tags || '').toLowerCase();
      if (
        tags.includes('nude') ||
        tags.includes('hentai') ||
        tags.includes('explicit') ||
        tags.includes('pussy') ||
        tags.includes('penis') ||
        tags.includes('sex')
      ) {
        return false;
      }
    }

    // Aspect ratio filtering (mobile = portrait, desktop = landscape)
    if (aspectRatioFilter === 'mobile') {
      return p.height >= p.width; // Portrait
    } else if (aspectRatioFilter === 'desktop') {
      return p.width > p.height; // Landscape
    }

    return true;
  });

  // Deduplicate by file_url
  const uniqueMap = new Map<string, WallpaperPost>();
  filtered.forEach((item) => uniqueMap.set(item.file_url, item));
  return Array.from(uniqueMap.values());
}
