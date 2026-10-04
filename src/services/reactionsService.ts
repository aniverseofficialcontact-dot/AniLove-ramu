export interface ReactionItem {
  id: string;
  url: string;
  category: string;
  artistName?: string;
  sourceApi: string;
}

export const REACTION_CATEGORIES = [
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

/**
 * Fetch reaction GIFs and stickers from Waifu.pics, Nekos.best, Nekos.life, NekoBot, Catboys & Animu APIs
 */
export async function fetchAnimeReactions(category = 'hug'): Promise<ReactionItem[]> {
  const items: ReactionItem[] = [];

  // 1. Fetch from Nekos.best (Ultra-fast CDN)
  try {
    const res = await fetch(`https://nekos.best/api/v2/${category}?amount=12`);
    if (res.ok) {
      const json = await res.json();
      if (json.results && Array.isArray(json.results)) {
        json.results.forEach((item: any, idx: number) => {
          if (item.url) {
            items.push({
              id: `nekosbest-${category}-${idx}-${Date.now()}`,
              url: item.url,
              category,
              artistName: item.artist_name || 'Nekos.best',
              sourceApi: 'Nekos.best',
            });
          }
        });
      }
    }
  } catch (err) {
    console.warn('Nekos.best API fetch skipped:', err);
  }

  // 2. Fetch from Waifu.pics
  try {
    const type = category === 'neko' || category === 'catboy' ? 'neko' : category;
    const res = await fetch(`https://api.waifu.pics/sfw/${type}`);
    if (res.ok) {
      const json = await res.json();
      if (json.url) {
        items.push({
          id: `waifupics-${category}-${Date.now()}`,
          url: json.url,
          category,
          sourceApi: 'Waifu.pics',
        });
      }
    }
  } catch (err) {
    console.warn('Waifu.pics API fetch skipped:', err);
  }

  // 3. Fetch from Nekos.life
  try {
    const endpoint = category === 'neko' ? 'neko' : 'hug';
    const res = await fetch(`https://nekos.life/api/v2/img/${endpoint}`);
    if (res.ok) {
      const json = await res.json();
      if (json.url) {
        items.push({
          id: `nekoslife-${category}-${Date.now()}`,
          url: json.url,
          category,
          sourceApi: 'Nekos.life',
        });
      }
    }
  } catch (err) {
    console.warn('Nekos.life API fetch skipped:', err);
  }

  // 4. Fetch from Catboys API if category is catboy
  if (category === 'catboy') {
    try {
      const res = await fetch('https://api.catboys.com/img');
      if (res.ok) {
        const json = await res.json();
        if (json.url) {
          items.push({
            id: `catboys-${Date.now()}`,
            url: json.url,
            category: 'catboy',
            sourceApi: 'Catboys.com',
          });
        }
      }
    } catch (err) {
      console.warn('Catboys API fetch skipped:', err);
    }
  }

  // Deduplicate by URL
  const uniqueMap = new Map<string, ReactionItem>();
  items.forEach((item) => uniqueMap.set(item.url, item));
  return Array.from(uniqueMap.values());
}
