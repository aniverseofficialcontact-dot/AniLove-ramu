async function testRealApi() {
  console.log('--- Testing REAL API URL ---');
  const url = 'https://animeworld-india-api-njtl.onrender.com/api/anime-world-india/v1/stream.php?anilistId=113415&ep=4';
  try {
    const res = await fetch(url);
    console.log('API Status:', res.status);
    const data = await res.json();
    console.log('API Data:\n', JSON.stringify(data, null, 2));
  } catch (e) {
    console.error('Error:', e);
  }
}

testRealApi();
