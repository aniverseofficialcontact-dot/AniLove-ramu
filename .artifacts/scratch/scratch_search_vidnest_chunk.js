async function searchChunk() {
  const sRes = await fetch('https://vidnest.fun/_next/static/chunks/1b2f12c8038b9c75.js');
  const code = await sRes.text();

  let pos = 0;
  while ((pos = code.indexOf('fetch', pos)) !== -1) {
    console.log('--- fetch at pos', pos, '---');
    console.log(code.substring(Math.max(0, pos - 100), Math.min(code.length, pos + 250)));
    pos += 5;
  }
}

searchChunk();
