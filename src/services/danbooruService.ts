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
export async function fetchDanbooruFanArts(
  query = '',
  page = 1,
  allowNsfw = false
): Promise<DanbooruPost[]> {
  const posts: DanbooruPost[] = [];
  const cleanTag = query.trim().toLowerCase().replace(/\s+/g, '_');

  // 1. Primary: Safebooru (100% SFW Danbooru-compatible API - Zero 403 blocks)
  try {
    const safebooruTag = cleanTag ? `${cleanTag}*` : 'rating:safe';
    const safebooruUrl = `https://safebooru.org/index.php?page=dapi&s=post&q=index&json=1&limit=30&pid=${page - 1}&tags=${encodeURIComponent(safebooruTag)}`;
    const safeRes = await fetch(safebooruUrl);
    if (safeRes.ok) {
      const safeData = await safeRes.json();
      if (Array.isArray(safeData)) {
        safeData.forEach((item: any) => {
          if (item.image && item.directory) {
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
              file_ext: item.image.split('.').pop() || 'jpg',
            });
          }
        });
      }
    }
  } catch (err) {
    console.warn('[Safebooru] FanArts fetch warning:', err);
  }

  // 2. Secondary: Danbooru API (with fallback if 403 occurs)
  try {
    let resolvedTag = cleanTag ? `${cleanTag}*` : 'order:score';

    // Autocomplete character tags by post count
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
          if (img) {
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
