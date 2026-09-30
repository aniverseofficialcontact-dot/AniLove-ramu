async function testRubystm() {
  console.log('--- Testing rubystm embed pages ---');
  const urls = [
    'https://rubystm.com/e/jrq5k2wujucc.html',
    'https://rubystm.com/e/945st55qzsud'
  ];

  for (const u of urls) {
    console.log(`\nTesting: ${u}`);
    try {
      const res = await fetch(u, {
        headers: {
          'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36',
          'Referer': 'https://rubystm.com/'
        }
      });
      console.log(`Status: ${res.status}`);
      const text = await res.text();
      console.log(`Response length: ${text.length}`);
      console.log(`HTML Snippet (300 chars):\n`, text.substring(0, 300));
    } catch (e) {
      console.error(`Error:`, e.message);
    }
  }
}

testRubystm();
