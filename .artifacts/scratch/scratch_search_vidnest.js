async function searchVidnest() {
  const res = await fetch('https://vidnest.fun/anime/21/1/sub', {
    headers: {
      'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36'
    }
  });
  const html = await res.text();
  const scripts = html.match(/src="(\/_next\/static\/chunks\/[^"]+)"/g) || [];

  for (const s of scripts) {
    const src = s.replace('src="', '').replace('"', '');
    const sRes = await fetch('https://vidnest.fun' + src);
    const code = await sRes.text();
    const matches = code.match(/https?:\/\/[^\s"'\`\}]+/g) || [];
    const filtered = matches.filter(m => m.includes('api') || m.includes('stream') || m.includes('m3u8') || m.includes('anime'));
    if (filtered.length > 0) {
      console.log('Found endpoints in', src, ':\n', [...new Set(filtered)]);
    }
  }
}

searchVidnest();
