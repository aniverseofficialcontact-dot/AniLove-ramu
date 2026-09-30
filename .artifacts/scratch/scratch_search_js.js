import fs from 'fs';

async function searchJs() {
  const pageRes = await fetch('https://tryembed.us.cc/embed/anime/21/1/sub', {
    headers: {
      'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36'
    }
  });
  const html = await pageRes.text();
  const scriptMatch = html.match(/src="(\/player\.js[^"]+)"/);
  const jsRes = await fetch('https://tryembed.us.cc' + scriptMatch[1]);
  const jsCode = await jsRes.text();

  // Find occurrences of /s/
  let pos = 0;
  while ((pos = jsCode.indexOf('/s/', pos)) !== -1) {
    console.log('--- /s/ snippet at pos', pos, '---');
    console.log(jsCode.substring(Math.max(0, pos - 100), Math.min(jsCode.length, pos + 200)));
    pos += 3;
  }

  // Find occurrences of embedNonce
  pos = 0;
  while ((pos = jsCode.indexOf('EMBED_NONCE', pos)) !== -1) {
    console.log('--- EMBED_NONCE snippet at pos', pos, '---');
    console.log(jsCode.substring(Math.max(0, pos - 100), Math.min(jsCode.length, pos + 200)));
    pos += 11;
  }
}

searchJs();
