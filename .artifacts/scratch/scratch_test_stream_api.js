async function testStreamApi() {
  console.log('--- Testing AnimeWorld Stream API ---');
  const url = 'https://animeworld-india-api-njtl.onrender.com/api/anime-world-india/v1/stream.php?id=one-piece-season-1-1x1';
  try {
    const res = await fetch(url);
    console.log('API Status:', res.status);
    const data = await res.json();
    console.log('API Data:\n', JSON.stringify(data, null, 2));
  } catch (e) {
    console.error('API Error:', e);
  }
}

testStreamApi();
