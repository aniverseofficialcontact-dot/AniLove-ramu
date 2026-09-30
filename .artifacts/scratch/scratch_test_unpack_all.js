function unpackServerUrl(rawUrl, language = 'DUB') {
  if (!rawUrl) return rawUrl;
  if (rawUrl.includes('short.icu/')) {
    return rawUrl.replace('short.icu/', 'abyssplayer.com/');
  }
  if (rawUrl.includes('/public/player/') && rawUrl.includes('id=')) {
    try {
      const match = rawUrl.match(/[?&]id=([^&]+)/);
      if (match && match[1]) {
        return `https://pro.iqsmartgames.com/embed/${match[1]}`;
      }
    } catch {
      // fallback
    }
  }
  if (rawUrl.includes('multi.php?data=') || rawUrl.includes('data=')) {
    try {
      const match = rawUrl.match(/[?&]data=([^&]+)/);
      if (match && match[1]) {
        const decoded = Buffer.from(decodeURIComponent(match[1]), 'base64').toString('utf8');
        const list = JSON.parse(decoded);
        if (Array.isArray(list) && list.length > 0) {
          const reqLang = (language || '').toLowerCase();
          let target = list[0];

          const found = list.find((item) => {
            const l = (item.language || '').toLowerCase();
            if (reqLang === 'sub' || reqLang.includes('jap') || reqLang.includes('sub')) {
              return l.includes('jap') || l.includes('sub') || l.includes('japanese');
            }
            return l.includes('eng') || l.includes('dub') || l.includes('english');
          });

          if (found) target = found;

          if (target && target.link) {
            const slug = target.link.split('/').filter(Boolean).pop();
            if (slug) {
              return `https://abyssplayer.com/${slug}`;
            }
            return target.link.replace('short.icu', 'abyssplayer.com');
          }
        }
      }
    } catch (e) {
      // fallback
    }
  }
  return rawUrl;
}

async function testUnpack() {
  const url = 'https://animeworld-india-api-njtl.onrender.com/api/anime-world-india/v1/stream.php?anilistId=113415&ep=4';
  const res = await fetch(url);
  const data = await res.json();
  const rawServers = data.stream.servers;

  console.log('--- Unpacked Servers for JJK Ep 4 ---');
  rawServers.slice(0, 6).forEach((s, idx) => {
    const unpacked = unpackServerUrl(s.url, 'SUB');
    console.log(`[${s.name}] -> Unpacked (${idx === 0 ? 'Server 1' : idx === 1 ? 'Server 1-B' : 'Server 1-C'}):`, unpacked);
  });
}

testUnpack();
