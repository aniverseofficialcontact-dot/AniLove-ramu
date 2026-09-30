async function testVidnest() {
  console.log('--- Testing vidnest.fun ---');
  const res = await fetch('https://vidnest.fun/anime/21/1/sub', {
    headers: {
      'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36'
    }
  });
  console.log('Vidnest Status:', res.status);
  const html = await res.text();
  console.log('Vidnest HTML snippet (500 chars):\n', html.substring(0, 500));
}

testVidnest();
