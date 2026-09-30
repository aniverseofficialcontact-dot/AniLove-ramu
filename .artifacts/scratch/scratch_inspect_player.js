async function inspectPlayerJs() {
  const pageRes = await fetch('https://tryembed.us.cc/embed/anime/21/1/sub', {
    headers: {
      'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36'
    }
  });
  const html = await pageRes.text();
  const scriptMatch = html.match(/src="(\/player\.js[^"]+)"/);
  if (!scriptMatch) {
    console.log('No player.js found');
    return;
  }
  const jsPath = scriptMatch[1];
  console.log('Fetching JS:', jsPath);

  const jsRes = await fetch('https://tryembed.us.cc' + jsPath, {
    headers: {
      'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36'
    }
  });

  const jsCode = await jsRes.text();
  console.log('JS Length:', jsCode.length);

  // Search for fetch, /s/, m3u8, bootstrap, token, embedNonce, etc in jsCode
  const matches = jsCode.match(/(\/s\/|\/api\/|m3u8|token|nonce|bootstrap|X-TryEmbed-[a-zA-Z0-9-]+)/gi);
  console.log('Matches summary:', [...new Set(matches)].slice(0, 30));

  // Find fetch calls or headers in jsCode
  const fetchMatches = jsCode.match(/fetch\([^)]+\)/gi) || [];
  console.log('Fetch calls:', fetchMatches.slice(0, 10));

  // Look for header names
  const headerMatches = jsCode.match(/["']X-TryEmbed-[^"']+["']/gi) || [];
  console.log('TryEmbed Headers:', headerMatches);
}

inspectPlayerJs();
