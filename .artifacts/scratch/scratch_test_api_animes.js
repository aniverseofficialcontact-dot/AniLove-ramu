async function testApiAnimes() {
  const ids = [
    'solo-leveling-season-1-1x1',
    'jujutsu-kaisen-season-1-1x1',
    'demon-slayer-kimetsu-no-yaiba-season-1-1x1',
    'attack-on-titan-season-1-1x1',
    'naruto-season-1-1x1'
  ];

  for (const id of ids) {
    console.log(`\n================ ID: ${id} ================`);
    try {
      const url = `https://animeworld-india-api-njtl.onrender.com/api/anime-world-india/v1/stream.php?id=${id}`;
      const res = await fetch(url);
      const data = await res.json();
      if (data && data.success && data.stream) {
        console.log('Stream Link:', data.stream.streamLink);
        console.log('Servers:', JSON.stringify(data.stream.servers, null, 2));
      } else {
        console.log('API returned success=false:', data);
      }
    } catch (e) {
      console.error('Error fetching:', e.message);
    }
  }
}

testApiAnimes();
