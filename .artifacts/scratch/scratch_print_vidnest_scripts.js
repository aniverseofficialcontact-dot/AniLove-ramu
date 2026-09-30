async function printVidnestScripts() {
  const res = await fetch('https://vidnest.fun/anime/21/1/sub', {
    headers: {
      'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36'
    }
  });
  const html = await res.text();
  const inline = html.match(/<script>(.*?)<\/script>/gs) || [];
  for (let i = 0; i < inline.length; i++) {
    console.log(`--- Script ${i} ---`);
    console.log(inline[i]);
  }
}

printVidnestScripts();
