const http = require('https');

async function testAbyss() {
  const url = "https://abyssplayer.com/iad_ESo-2";
  http.get(url, {
    headers: {
      'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36',
      'Referer': 'https://abyssplayer.com/'
    }
  }, (res) => {
    let html = '';
    res.on('data', chunk => html += chunk);
    res.on('end', () => {
      const match = html.match(/datas\s*=\s*"([^"]+)"/);
      if (match) {
        const b64 = match[1];
        const jsonStr = Buffer.from(b64, 'base64').toString('utf-8');
        console.log("Decoded JSON:", jsonStr.substring(0, 300));
        try {
          const parsed = JSON.parse(jsonStr);
          console.log("Parsed keys:", Object.keys(parsed));
          console.log("Slug:", parsed.slug);
          console.log("Media snippet:", parsed.media ? parsed.media.substring(0, 100) : "no media");
        } catch (e) {
          console.error("JSON parse error:", e);
        }
      } else {
        console.log("No datas match found");
      }
    });
  });
}

testAbyss();
