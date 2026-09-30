async function testBlakiteApi() {
  console.log('--- Testing blakiteapi /api/get.php ---');
  try {
    const res = await fetch('https://blakiteapi.xyz/api/get.php?id=1-1&tmdbId=1', {
      headers: {
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36',
        'Referer': 'https://blakiteapi.xyz/embed/1/1-1'
      }
    });
    console.log('Blakite API status:', res.status);
    const json = await res.json();
    console.log('Blakite API json:\n', JSON.stringify(json, null, 2));
  } catch (e) {
    console.error('Error:', e);
  }
}

testBlakiteApi();
