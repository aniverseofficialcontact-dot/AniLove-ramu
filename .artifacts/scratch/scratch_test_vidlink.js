async function testVidlink() {
  console.log('--- Testing VidLink API ---');
  try {
    const res = await fetch('https://vidlink.pro/api/b/anime/21/1?dub=false', {
      headers: {
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36',
        'Referer': 'https://vidlink.pro/'
      }
    });
    console.log('Vidlink API Status:', res.status);
    const text = await res.text();
    console.log('Vidlink API Response:', text.substring(0, 500));
  } catch (e) {
    console.error('Vidlink error:', e);
  }
}

testVidlink();
