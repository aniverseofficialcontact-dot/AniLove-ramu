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

const FANART_CACHE_PREFIX = 'anilove_fanart_cache_v2_';
const CACHE_TTL_MS = 12 * 60 * 60 * 1000; // 12 Hours in milliseconds

interface CachedFanArtPayload {
  timestamp: number;
  data: DanbooruPost[];
}

function getCachedFanArts(query: string, page: number, allowNsfw: boolean): DanbooruPost[] | null {
  try {
    const key = `${FANART_CACHE_PREFIX}${query.toLowerCase().trim()}_p${page}_nsfw${allowNsfw ? 1 : 0}`;
    const raw = localStorage.getItem(key);
    if (!raw) return null;

    const parsed: CachedFanArtPayload = JSON.parse(raw);
    const now = Date.now();
    if (now - parsed.timestamp > CACHE_TTL_MS) {
      localStorage.removeItem(key);
      return null;
    }

    if (Array.isArray(parsed.data) && parsed.data.length > 0) {
      return parsed.data;
    }
  } catch (e) {
    console.warn('[FanArt Cache] Read error:', e);
  }
  return null;
}

function setCachedFanArts(query: string, page: number, allowNsfw: boolean, data: DanbooruPost[]) {
  if (!data || data.length === 0) return;
  try {
    const key = `${FANART_CACHE_PREFIX}${query.toLowerCase().trim()}_p${page}_nsfw${allowNsfw ? 1 : 0}`;
    const payload: CachedFanArtPayload = {
      timestamp: Date.now(),
      data,
    };
    localStorage.setItem(key, JSON.stringify(payload));
  } catch (e) {
    console.warn('[FanArt Cache] Write error:', e);
  }
}

/**
 * Clean booru tag string into human readable title
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
 * Expanded English Anime & Character Title to Official Booru Tag Mapping
 */
const TAG_ALIAS_MAP: Record<string, string> = {
  // Anime Series Aliases
  'attack_on_titan': 'shingeki_no_kyojin',
  'demon_slayer': 'kimetsu_no_yaiba',
  'jujutsu_kaisen': 'jujutsu_kaisen',
  'my_hero_academia': 'boku_no_hero_academia',
  'one_piece': 'one_piece',
  'naruto': 'naruto',
  'bleach': 'bleach',
  'dragon_ball': 'dragon_ball',
  'solo_leveling': 'solo_leveling',
  'chainsaw_man': 'chainsaw_man',
  'spy_x_family': 'spy_x_family',
  'hunter_x_hunter': 'hunter_x_hunter',
  'tokyo_ghoul': 'tokyo_ghoul',
  're:zero': 're:zero_kara_hajimeru_isekai_seikatsu',
  'rezero': 're:zero_kara_hajimeru_isekai_seikatsu',
  'sword_art_online': 'sword_art_online',
  'fullmetal_alchemist': 'fullmetal_alchemist',
  'death_note': 'death_note',
  'code_geass': 'code_geass',
  'black_clover': 'black_clover',
  'blue_lock': 'blue_lock',
  'mushoku_tensei': 'mushoku_tensei',
  'cyberpunk': 'cyberpunk:_edgerunners',
  'bocchi_the_rock': 'bocchi_the_rock!',
  'oshi_no_ko': 'oshi_no_ko',
  'classroom_of_the_elite': 'youkoso_jitsuryoku_shijou_shugi_no_kyoushitsu_e',
  'frieren': 'frieren',
  'dr_stone': 'dr._stone',
  'vinland_saga': 'vinland_saga',
  'jojo': 'jojo_no_kimyou_na_bouken',

  // Character Name Aliases (English Order -> Japanese Booru Order)
  'goku': 'son_goku',
  'son_goku': 'son_goku',
  'megumi_fushiguro': 'fushiguro_megumi',
  'megumi': 'fushiguro_megumi',
  'fushiguro_megumi': 'fushiguro_megumi',
  'satoru_gojo': 'gojo_satoru',
  'gojo': 'gojo_satoru',
  'gojo_satoru': 'gojo_satoru',
  'mikasa_ackerman': 'ackerman_mikasa',
  'mikasa': 'ackerman_mikasa',
  'anya_forger': 'forger_anya',
  'anya': 'forger_anya',
  'tanjiro_kamado': 'kamado_tanjiro',
  'tanjiro': 'kamado_tanjiro',
  'nezuko_kamado': 'kamado_nezuko',
  'nezuko': 'kamado_nezuko',
  'eren_yeager': 'eren_yeager',
  'eren_jaeger': 'eren_yeager',
  'eren': 'eren_yeager',
  'levi_ackerman': 'ackerman_levi',
  'levi': 'ackerman_levi',
  'sung_jinwoo': 'sung_jin-woo',
  'sung_jin_woo': 'sung_jin-woo',
  'jinwoo': 'sung_jin-woo',
  'naruto_uzumaki': 'uzumaki_naruto',
  'sasuke_uchiha': 'uchiha_sasuke',
  'sasuke': 'uchiha_sasuke',
  'ichigo_kurosaki': 'kurosaki_ichigo',
  'ichigo': 'kurosaki_ichigo',
  'luffy': 'monkey_d._luffy',
  'monkey_d_luffy': 'monkey_d._luffy',
  'zoro': 'roronoa_zoro',
  'roronoa_zoro': 'roronoa_zoro',
  'sanji': 'sanji_(one_piece)',
  'vegeta': 'vegeta',
  'saitama': 'saitama_(one-punch_man)',
  'light_yagami': 'yagami_light',
  'killua': 'killua_zoldyck',
  'killua_zoldyck': 'killua_zoldyck',
  'gon': 'gon_freecss',
  'gon_freecss': 'gon_freecss',
};

function resolveTagAlias(rawTag: string): string {
  if (!rawTag) return '';
  const lower = rawTag.toLowerCase().replace(/\s+/g, '_');
  if (TAG_ALIAS_MAP[lower]) {
    return TAG_ALIAS_MAP[lower];
  }

  // Reverse 2-word name order check (e.g., "megumi fushiguro" -> "fushiguro_megumi")
  const parts = lower.split('_');
  if (parts.length === 2) {
    const reversed = `${parts[1]}_${parts[0]}`;
    if (TAG_ALIAS_MAP[reversed]) {
      return TAG_ALIAS_MAP[reversed];
    }
  }

  return rawTag;
}

/**
 * Fetch Danbooru fan arts with strict SFW / 18+ filtering and 12-hour local caching
 */
export async function fetchDanbooruFanArts(
  query = '',
  page = 1,
  allowNsfw = false
): Promise<DanbooruPost[]> {
  // Check 12-hour local cache first
  const cached = getCachedFanArts(query, page, allowNsfw);
  if (cached) {
    return cached;
  }

  const posts: DanbooruPost[] = [];
  const rawTag = query.trim().toLowerCase().replace(/\s+/g, '_');
  const cleanTag = resolveTagAlias(rawTag);
  const INVALID_EXTS = new Set(['zip', 'webm', 'mp4', 'gif', 'swf', 'ugoira', 'rar', '7z']);

  // Check if reversed 2-word variant exists
  const parts = rawTag.split('_');
  const reversedTag = parts.length === 2 ? `${parts[1]}_${parts[0]}` : '';

  // Fetch Safebooru, Gelbooru (if NSFW allowed), and Danbooru concurrently
  const fetchSafebooru = async () => {
    try {
      const searchTag = cleanTag ? `${cleanTag}*` : 'rating:safe';
      const safebooruUrl = `https://safebooru.org/index.php?page=dapi&s=post&q=index&json=1&limit=30&pid=${page - 1}&tags=${encodeURIComponent(searchTag)}`;
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

      // If reversed tag exists and returned 0 posts, try secondary search with reversed tag
      if (posts.length === 0 && reversedTag) {
        const revUrl = `https://safebooru.org/index.php?page=dapi&s=post&q=index&json=1&limit=30&pid=${page - 1}&tags=${encodeURIComponent(reversedTag + '*')}`;
        const revRes = await fetch(revUrl);
        if (revRes.ok) {
          const revData = await revRes.json();
          if (Array.isArray(revData)) {
            revData.forEach((item: any) => {
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
      }
    } catch (err) {
      console.warn('[Safebooru] FanArts fetch warning:', err);
    }
  };

  const fetchGelbooru = async () => {
    if (!allowNsfw) return;
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
  };

  const fetchDanbooru = async () => {
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
  };

  await Promise.allSettled([fetchSafebooru(), fetchGelbooru(), fetchDanbooru()]);

  // Filter & deduplicate posts
  const uniqueMap = new Map<string, DanbooruPost>();
  posts.forEach((p) => {
    const url = p.large_file_url || p.file_url || p.preview_file_url;
    if (url) uniqueMap.set(url, p);
  });

  const finalResults = Array.from(uniqueMap.values());

  // Save to 12-hour local cache
  if (finalResults.length > 0) {
    setCachedFanArts(query, page, allowNsfw, finalResults);
  }

  return finalResults;
}
