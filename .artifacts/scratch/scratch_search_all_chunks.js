async function searchAllChunks() {
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

    const terms = ['/api/', 'stream', 'm3u8', 'sources', 'hls'];
    for (const term of terms) {
      let pos = 0;
      while ((pos = code.indexOf(term, pos)) !== -1) {
        // Only log if looks like API or URL
        const snippet = code.substring(Math.max(0, pos - 80), Math.min(code.length, pos + 150));
        if (snippet.includes('fetch') || snippet.includes('http') || snippet.includes('/api/')) {
          console.log(`Snippet for [${term}] in [${src}]:\n  ${snippet.replace(/\s+/g, ' ')}`);
        }
        pos += term.length + 100;
      }
    }
  }
}

searchAllChunks();
