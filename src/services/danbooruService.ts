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
  try {
    let resolvedTag = '';

    if (query.trim()) {
      const cleanTag = query.trim().toLowerCase().replace(/\s+/g, '_');
      resolvedTag = cleanTag;

      // Smart Tag Resolution: Autocomplete short queries (e.g. "rimuru" -> "rimuru_tempest")
      try {
        const tagRes = await fetch(`https://danbooru.donmai.us/tags.json?search[name_matches]=*${encodeURIComponent(cleanTag)}*&search[order]=count&limit=5`);
        if (tagRes.ok) {
          const tagList = await tagRes.json();
          if (Array.isArray(tagList) && tagList.length > 0) {
            // Find top character or copyright tag matching the query
            const bestMatch = tagList.find((t: any) => t.category === 4 || t.category === 3 || t.category === 0) || tagList[0];
            if (bestMatch && bestMatch.name) {
              resolvedTag = bestMatch.name;
            }
          }
        }
      } catch (e) {
        console.warn('[Danbooru] Tag autocomplete warning:', e);
      }
    }

    let tagsParam = 'limit=30';
    if (resolvedTag) {
      tagsParam += `&tags=${encodeURIComponent(resolvedTag)}`;
    } else {
      tagsParam += '&tags=order:score';
    }

    if (!allowNsfw) {
      tagsParam += '+rating:g';
    }

    tagsParam += `&page=${page}`;

    const res = await fetch(`https://danbooru.donmai.us/posts.json?${tagsParam}`);
    if (!res.ok) throw new Error(`Danbooru API error ${res.status}`);

    const data: DanbooruPost[] = await res.json();
    if (!Array.isArray(data)) return [];

    // Filter out posts without valid image URLs or explicit ratings when allowNsfw is false
    return data.filter((post) => {
      const img = post.large_file_url || post.file_url || post.preview_file_url;
      if (!img) return false;

      if (!allowNsfw) {
        // Exclude explicit 'e' or questionable 'q' ratings
        if (post.rating === 'e' || post.rating === 'q') return false;

        // Exclude explicit tags
        const tags = (post.tag_string || '').toLowerCase();
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

      return true;
    });
  } catch (err) {
    console.error('Error fetching Danbooru posts:', err);
    return [];
  }
}
