async function inspectNextPayload() {
  const res = await fetch('https://vidnest.fun/anime/21/1/sub', {
    headers: {
      'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36'
    }
  });
  const html = await res.text();
  const pushes = html.match(/self\.__next_f\.push\(\[1,"[^"]+"\]\)/g) || [];
  console.log('Next payload chunks:', pushes.length);
  for (const p of pushes) {
    console.log('Chunk:', p.substring(0, 300));
  }
}

inspectNextPayload();
