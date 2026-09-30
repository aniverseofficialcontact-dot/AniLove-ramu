async function testEmbedHosts() {
  const urls = [
    'https://rubystm.com/e/doazaju7imw2.html',
    'https://abyssplayer.com/y0_GBU0uL',
    'https://pro.iqsmartgames.com/embed/eeribh5'
  ];

  for (const u of urls) {
    console.log(`\n--- Testing ${u} ---`);
    try {
      const res = await fetch(u, {
        headers: {
          'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36',
          'Referer': u.includes('rubystm') ? 'https://rubystm.com/' : u.includes('iqsmart') ? 'https://pro.iqsmartgames.com/' : 'https://piratexplay.cc/'
        }
      });
      console.log(`Status: ${res.status}`);
      const text = await res.text();
      console.log(`HTML Snippet (300 chars):\n`, text.substring(0, 300));
    } catch (e) {
      console.error('Error:', e.message);
    }
  }
}

testEmbedHosts();
