async function testVidlinkPage() {
  console.log('--- Testing VidLink Embed Page ---');
  try {
    const res = await fetch('https://vidlink.pro/anime/21/1', {
      headers: {
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36',
        'Referer': 'https://vidlink.pro/'
      }
    });
    console.log('Vidlink Page Status:', res.status);
    const text = await res.text();
    console.log('Vidlink Page Response length:', text.length);
    const scripts = text.match(/src="(\/_next\/static\/chunks\/[^"]+)"/g) || [];
    console.log('Next scripts:', scripts);
  } catch (e) {
    console.error('Vidlink error:', e);
  }
}

testVidlinkPage();
