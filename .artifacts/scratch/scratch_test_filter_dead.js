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
        const decodedStr = decodeURIComponent(match[1]);
        const jsonText = Buffer.from(decodedStr, 'base64').toString('utf8');
        const list = JSON.parse(jsonText);
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

async function testFilterDead() {
  const url = 'https://animeworld-india-api-njtl.onrender.com/api/anime-world-india/v1/stream.php?anilistId=113415&ep=2';
  const res = await fetch(url);
  const data = await res.json();
  const rawServers = data.stream.servers;

  const deadDomains = ['rubystm.com', 'blakiteapi.xyz'];
  const processedServers = [];

  for (let i = 0; i < rawServers.length; i++) {
    const s = rawServers[i];
    let unpackedUrl = unpackServerUrl(s.url, 'SUB');

    const isDead = deadDomains.some(d => unpackedUrl && unpackedUrl.includes(d));
    if (isDead) {
      continue; // Skip dead servers!
    }

    processedServers.push({
      originalName: s.name,
      url: unpackedUrl
    });
  }

  console.log('--- Working Filtered Servers ---');
  processedServers.forEach((s, idx) => {
    let label = `Server 1`;
    if (idx === 1) label = `Server 1-B`;
    else if (idx === 2) label = `Server 1-C`;
    else if (idx > 2) label = `Server 1-${String.fromCharCode(65 + idx)}`;
    console.log(`${label} (${s.originalName}): ${s.url}`);
  });
}

testFilterDead();
