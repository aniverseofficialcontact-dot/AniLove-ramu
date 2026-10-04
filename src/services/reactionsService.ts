export interface ReactionItem {
  id: string;
  url: string;
  category: string;
  artistName?: string;
}

export const REACTION_CATEGORIES = [
  { id: 'favorites', label: 'Favorites', emoji: '❤️' },
  { id: 'hug', label: 'Hug', emoji: '🫂' },
  { id: 'pat', label: 'Pat', emoji: '👋' },
  { id: 'dance', label: 'Dance', emoji: '💃' },
  { id: 'smile', label: 'Smile', emoji: '😊' },
  { id: 'wink', label: 'Wink', emoji: '😉' },
  { id: 'cry', label: 'Cry', emoji: '😭' },
  { id: 'blush', label: 'Blush', emoji: '😳' },
  { id: 'cuddle', label: 'Cuddle', emoji: '👩‍❤️‍👨' },
  { id: 'slap', label: 'Slap', emoji: '✋' },
  { id: 'bite', label: 'Bite', emoji: '😬' },
  { id: 'poke', label: 'Poke', emoji: '👉' },
  { id: 'neko', label: 'Neko Catgirl', emoji: '🐾' },
  { id: 'catboy', label: 'Catboy', emoji: '🐱' },
  { id: 'chibi', label: 'Chibi & Chars', emoji: '🧸' },
];

// Category endpoint mapping for Nekos.best
const NEKOS_BEST_MAP: Record<string, string> = {
  hug: 'hug',
  pat: 'pat',
  dance: 'dance',
  smile: 'smile',
  wink: 'wink',
  cry: 'pout',
  blush: 'blush',
  cuddle: 'hug',
  slap: 'slap',
  bite: 'biteme',
  poke: 'wave',
  neko: 'neko',
  catboy: 'neko',
  chibi: 'happy',
};

// Category endpoint mapping for Waifu.pics
const WAIFU_PICS_MAP: Record<string, string> = {
  hug: 'hug',
  pat: 'pat',
  dance: 'dance',
  smile: 'smile',
  wink: 'wink',
  cry: 'cry',
  blush: 'blush',
  cuddle: 'cuddle',
  slap: 'slap',
  bite: 'bite',
  poke: 'poke',
  neko: 'neko',
  catboy: 'neko',
  chibi: 'happy',
};

/**
 * Fetch reaction GIFs and stickers with multi-page support for seamless scrolling.
 */
export async function fetchAnimeReactions(category = 'hug', page = 1): Promise<ReactionItem[]> {
  if (category === 'favorites') return [];

  const items: ReactionItem[] = [];
  const nekosCategory = NEKOS_BEST_MAP[category] || 'hug';
  const waifuCategory = WAIFU_PICS_MAP[category] || 'hug';

  // 1. Fetch batch from Nekos.best (20 items)
  try {
    const res = await fetch(`https://nekos.best/api/v2/${nekosCategory}?amount=20`);
    if (res.ok) {
      const json = await res.json();
      if (json.results && Array.isArray(json.results)) {
        json.results.forEach((item: any, idx: number) => {
          if (item.url) {
            items.push({
              id: `gif-${category}-nb-${page}-${idx}-${Math.random().toString(36).substring(2, 7)}`,
              url: item.url,
              category,
              artistName: item.artist_name || undefined,
            });
          }
        });
      }
    }
  } catch (err) {
    // Silent failover
  }

  // 2. Fetch parallel batch from Waifu.pics to enrich variety
  try {
    const waifuPromises = Array.from({ length: 6 }).map(() =>
      fetch(`https://api.waifu.pics/sfw/${waifuCategory}`)
        ? fetch(`https://api.waifu.pics/sfw/${waifuCategory}`)
            .then((r) => r.json())
            .then((j) => j.url)
            .catch(() => null)
        : null
    );

    const waifuUrls = await Promise.all(waifuPromises);
    waifuUrls.forEach((url, idx) => {
      if (url && typeof url === 'string') {
        items.push({
          id: `gif-${category}-wp-${page}-${idx}-${Math.random().toString(36).substring(2, 7)}`,
          url,
          category,
        });
      }
    });
  } catch (err) {
    // Silent failover
  }

  // 3. Fetch from Nekos.life if category is neko or hug
  if (category === 'neko' || category === 'hug') {
    try {
      const res = await fetch(`https://nekos.life/api/v2/img/${category === 'neko' ? 'neko' : 'hug'}`);
      if (res.ok) {
        const json = await res.json();
        if (json.url) {
          items.push({
            id: `gif-${category}-nl-${page}-${Math.random().toString(36).substring(2, 7)}`,
            url: json.url,
            category,
          });
        }
      }
    } catch (err) {
      // Silent failover
    }
  }

  // Deduplicate by URL
  const uniqueMap = new Map<string, ReactionItem>();
  items.forEach((item) => uniqueMap.set(item.url, item));
  return Array.from(uniqueMap.values());
}
