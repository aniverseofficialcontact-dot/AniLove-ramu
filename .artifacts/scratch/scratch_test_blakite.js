async function testBlakite() {
  console.log('--- Testing blakiteapi.xyz ---');
  try {
    const res = await fetch('https://blakiteapi.xyz/embed/1/1-1', {
      headers: {
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36',
        'Referer': 'https://blakiteapi.xyz/'
      }
    });
    console.log('Blakite Status:', res.status);
    const html = await res.text();
    console.log('Blakite HTML (first 800 chars):\n', html.substring(0, 800));
  } catch (e) {
    console.error('Blakite Error:', e);
  }
}

testBlakite();
