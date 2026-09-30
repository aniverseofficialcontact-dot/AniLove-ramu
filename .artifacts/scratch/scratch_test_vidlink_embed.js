async function testVidlinkEmbed() {
  console.log('--- Testing VidLink /embed/anime/21/1 ---');
  try {
    const res = await fetch('https://vidlink.pro/embed/anime/21/1', {
      headers: {
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36',
        'Referer': 'https://vidlink.pro/'
      }
    });
    console.log('Vidlink /embed/anime Status:', res.status);
    const text = await res.text();
    console.log('Response length:', text.length);
  } catch (e) {
    console.error('Vidlink error:', e);
  }
}

testVidlinkEmbed();
