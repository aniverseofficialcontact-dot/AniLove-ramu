async function inspectVidnest() {
  const res = await fetch('https://vidnest.fun/anime/21/1/sub', {
    headers: {
      'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36'
    }
  });
  const html = await res.text();
  console.log('Includes BOOTSTRAP_TICKET:', html.includes('BOOTSTRAP_TICKET'));
  console.log('Includes stream_data:', html.includes('stream_data'));
  console.log('Includes /api/:', html.includes('/api/'));

  const scripts = html.match(/src="(\/_next\/static\/chunks\/[^"]+)"/g) || [];
  console.log('Found Next.js scripts:', scripts.length);

  for (const s of scripts) {
    const src = s.replace('src="', '').replace('"', '');
    const sRes = await fetch('https://vidnest.fun' + src);
    const code = await sRes.text();
    if (code.includes('api') || code.includes('stream') || code.includes('m3u8')) {
      console.log('Script matches in:', src);
      const matches = code.match(/["'](\/api\/[^"']+)["']/g) || [];
      if (matches.length > 0) console.log('API paths:', [...new Set(matches)]);
    }
  }
}

inspectVidnest();
