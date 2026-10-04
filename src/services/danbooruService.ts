export interface DanbooruPost {
  id: number;
  created_at: string;
  score: number;
  rating: 'g' | 's' | 'q' | 'e'; // g=general, s=sensitive, q=questionable, e=explicit
  tag_string: string;
  tag_string_character: string;
  tag_string_copyright: string;
  tag_string_artist: string;
  file_url?: string;
  large_file_url?: string;
  preview_file_url?: string;
  image_width: number;
  image_height: number;
  file_ext: string;
}

/**
 * Fetch Danbooru fan arts with strict SFW / 18+ filtering
 */
export function cleanTagTitle(tags: string, characterTags?: string, copyrightTags?: string): string {
  if (characterTags && characterTags.trim()) {
    const chars = characterTags.split(/\s+/).map(c => c.replace(/_/g, ' ')).filter(c => c.length > 2);
    if (chars.length > 0) {
      const charName = chars[0].replace(/\b\w/g, l => l.toUpperCase());
      if (copyrightTags && copyrightTags.trim()) {
        const series = copyrightTags.split(/\s+/)[0].replace(/_/g, ' ').replace(/\b\w/g, l => l.toUpperCase());
        return `${charName} (${series})`;
      }
      return charName;
    }
  }

  if (!tags) return 'Anime Fan Art';
  const tagList = tags.split(/\s+/);
  const cleanList = tagList
    .map(t => t.replace(/_/g, ' '))
    .filter(t => !/^\d+(girl|boy|girls|boys)/i.test(t))
    .filter(t => !['looking_at_viewer', 'solo', 'highres', 'absurdres', 'long_hair', 'short_hair', 'simple_background', 'white_background'].includes(t.toLowerCase()))
    .filter(t => t.length >= 3);

  if (cleanList.length > 0) {
    return cleanList.slice(0, 3).map(w => w.replace(/\b\w/g, l => l.toUpperCase())).join(' ');
  }

  return 'Anime Fan Art';
}

/**
 * Fetch Danbooru fan arts with strict SFW / 18+ filtering
 */
export async function fetchDanbooruFanArts(
  query = '',
  page = 1,
  allowNsfw = false
): Promise<DanbooruPost[]> {
  const posts: DanbooruPost[] = [];
  const cleanTag = query.trim().toLowerCase().replace(/\s+/g, '_');
  const INVALID_EXTS = new Set(['zip', 'webm', 'mp4', 'gif', 'swf', 'ugoira', 'rar', '7z']);

  // 1. SFW Provider: Safebooru (100% SFW Danbooru-compatible API - Zero 403 blocks)
  try {
    const safebooruTag = cleanTag ? `${cleanTag}*` : 'rating:safe';
    const safebooruUrl = `https://safebooru.org/index.php?page=dapi&s=post&q=index&json=1&limit=30&pid=${page - 1}&tags=${encodeURIComponent(safebooruTag)}`;
    const safeRes = await fetch(safebooruUrl);
    if (safeRes.ok) {
      const safeData = await safeRes.json();
      if (Array.isArray(safeData)) {
        safeData.forEach((item: any) => {
          if (item.image && item.directory) {
            const ext = item.image.split('.').pop()?.toLowerCase() || 'jpg';
            if (INVALID_EXTS.has(ext)) return;

            const fileUrl = `https://safebooru.org/images/${item.directory}/${item.image}`;
            const sampleUrl = item.sample
              ? `https://safebooru.org/samples/${item.directory}/sample_${item.image}`
              : fileUrl;
            posts.push({
              id: item.id || Math.floor(Math.random() * 1000000),
              created_at: String(item.change || Date.now()),
              score: item.score || 0,
              rating: 'g',
              tag_string: item.tags || '',
              tag_string_character: item.tags || '',
              tag_string_copyright: '',
              tag_string_artist: 'Artist',
              file_url: fileUrl,
              large_file_url: sampleUrl,
              preview_file_url: sampleUrl,
              image_width: item.width || 1200,
              image_height: item.height || 1600,
              file_ext: ext,
            });
          }
        });
      }
    }
  } catch (err) {
    console.warn('[Safebooru] FanArts fetch warning:', err);
  }

  // 2. 18+ NSFW Provider: Gelbooru & Yandere (Active when allowNsfw is true)
  if (allowNsfw) {
    try {
      const nsfwTag = cleanTag ? `${cleanTag}*` : 'rating:explicit';
      const gelbooruUrl = `https://gelbooru.com/index.php?page=dapi&s=post&q=index&json=1&limit=30&pid=${page - 1}&tags=${encodeURIComponent(nsfwTag)}`;
      const gelRes = await fetch(gelbooruUrl);
      if (gelRes.ok) {
        const gelData = await gelRes.json();
        const items = Array.isArray(gelData) ? gelData : (gelData && Array.isArray(gelData.post) ? gelData.post : []);
        if (Array.isArray(items)) {
          items.forEach((item: any) => {
            if (item.file_url) {
              const ext = (item.file_url.split('.').pop() || 'jpg').toLowerCase();
              if (INVALID_EXTS.has(ext)) return;
              posts.push({
                id: item.id || Math.floor(Math.random() * 1000000),
                created_at: String(item.change || Date.now()),
                score: item.score || 0,
                rating: 'e',
                tag_string: item.tags || '',
                tag_string_character: item.tags || '',
                tag_string_copyright: '',
                tag_string_artist: 'Artist',
                file_url: item.file_url,
                large_file_url: item.sample_url || item.file_url,
                preview_file_url: item.preview_url || item.sample_url || item.file_url,
                image_width: item.width || 1200,
                image_height: item.height || 1600,
                file_ext: ext,
              });
            }
          });
        }
      }
    } catch (e) {
      console.warn('[Gelbooru 18+] FanArts fetch warning:', e);
    }
  }

  // 2. Secondary: Danbooru API (with fallback if 403 occurs)
  try {
    let resolvedTag = cleanTag ? `${cleanTag}*` : 'order:score';

    if (cleanTag) {
      try {
        const tagRes = await fetch(`https://danbooru.donmai.us/tags.json?search[name_matches]=*${encodeURIComponent(cleanTag)}*&search[order]=count&limit=10`);
        if (tagRes.ok) {
          const tagList = await tagRes.json();
          if (Array.isArray(tagList) && tagList.length > 0) {
            const topCharTag = tagList
              .filter((t: any) => t.category === 4 || t.category === 3 || t.category === 0)
              .sort((a: any, b: any) => (b.post_count || 0) - (a.post_count || 0))[0];
            if (topCharTag && topCharTag.name) {
              resolvedTag = topCharTag.name;
            }
          }
        }
      } catch (e) {
        console.warn('[Danbooru] Tag autocomplete warning:', e);
      }
    }

    let tagsParam = `limit=30&page=${page}&tags=${encodeURIComponent(resolvedTag)}`;
    if (!allowNsfw) {
      tagsParam += '+rating:g';
    }

    const res = await fetch(`https://danbooru.donmai.us/posts.json?${tagsParam}`);
    if (res.ok) {
      const data: DanbooruPost[] = await res.json();
      if (Array.isArray(data)) {
        data.forEach((post) => {
          const img = post.large_file_url || post.file_url || post.preview_file_url;
          const ext = (post.file_ext || '').toLowerCase();
          if (img && !INVALID_EXTS.has(ext)) {
            if (!allowNsfw && (post.rating === 'e' || post.rating === 'q')) return;
            posts.push(post);
          }
        });
      }
    }
  } catch (err) {
    console.warn('[Danbooru] FanArts fetch fallback:', err);
  }

  // Filter & deduplicate posts
  const uniqueMap = new Map<string, DanbooruPost>();
  posts.forEach((p) => {
    const url = p.large_file_url || p.file_url || p.preview_file_url;
    if (url) uniqueMap.set(url, p);
  });

  return Array.from(uniqueMap.values());
}
