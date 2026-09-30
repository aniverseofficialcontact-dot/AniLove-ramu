async function testVidlinkVariants() {
  console.log('--- Testing Vidlink Variants ---');
  const urls = [
    'https://vidlink.pro/anime/21/1',
    'https://vidlink.pro/anime/21/1?dub=false',
    'https://vidlink.pro/movie/21',
    'https://vidlink.pro/tv/21/1/1',
    'https://vidsrc.cc/v2/embed/anime/21/1',
    'https://vidsrc.pro/embed/anime/21/1',
    'https://autoembed.cc/embed/anime/21/1',
    'https://piratexplay.cc/embed/21/1'
  ];

  for (const u of urls) {
    try {
      const res = await fetch(u, {
        headers: {
          'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36',
          'Referer': 'https://google.com/'
        }
      });
      console.log(`[${res.status}] ${u}`);
    } catch (e) {
      console.log(`[ERR] ${u}: ${e.message}`);
    }
  }
}

testVidlinkVariants();
