async function testJjkEp2() {
  const url = 'https://animeworld-india-api-njtl.onrender.com/api/anime-world-india/v1/stream.php?anilistId=113415&ep=2';
  console.log('Fetching:', url);
  const res = await fetch(url);
  const data = await res.json();
  const servers = data.stream.servers;
  console.log(`Total Servers from API: ${servers.length}`);
  servers.forEach((s, idx) => {
    console.log(`Server ${idx + 1} [${s.name}]: ${s.url.substring(0, 80)}`);
  });
}

testJjkEp2();
