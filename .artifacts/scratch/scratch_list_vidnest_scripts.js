async function listScripts() {
  const res = await fetch('https://vidnest.fun/anime/21/1/sub', {
    headers: {
      'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36'
    }
  });
  const html = await res.text();
  console.log('HTML length:', html.length);
  const scriptTags = html.match(/<script[^>]*src="([^"]+)"[^>]*>/g) || [];
  console.log('Script tags:', scriptTags);
  const inlineScripts = html.match(/<script>(.*?)<\/script>/gs) || [];
  console.log('Inline scripts count:', inlineScripts.length);
  for (const s of inlineScripts) {
    if (s.length < 1000) console.log('Inline script:', s);
  }
}

listScripts();
