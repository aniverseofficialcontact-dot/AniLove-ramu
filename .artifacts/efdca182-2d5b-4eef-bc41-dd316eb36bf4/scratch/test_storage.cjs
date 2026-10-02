const https = require('https');

const rawUrl = "https://storage.googleapis.com/mediastorage/1790800091337/gxemjuuppd9/167963102.mp4#mp4/chunk/2/167963102/2097152/360p/h264?maxChunkSize=5242880";

function testReq(targetUrl, referer, userAgent) {
  console.log("\nTesting targetUrl:", targetUrl);
  console.log("Referer:", referer);

  const options = {
    headers: {
      'User-Agent': userAgent || 'Mozilla/5.0 (Linux; Android 10; K) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Mobile Safari/537.36',
      'Referer': referer,
      'Origin': referer ? referer.replace(/\/$/, '') : 'https://abyssplayer.com'
    }
  };

  https.get(targetUrl, options, (res) => {
    console.log("Response Status:", res.statusCode, res.statusMessage);
    console.log("Content-Type:", res.headers['content-type']);
    console.log("Content-Length:", res.headers['content-length']);
  }).on('error', (e) => {
    console.error("Error:", e.message);
  });
}

// 1. Raw URL with fragment
testReq(rawUrl, "https://abyssplayer.com/");

// 2. Cleaned URL (fragment moved/stripped, query param preserved)
// URL: https://storage.googleapis.com/mediastorage/1790800091337/gxemjuuppd9/167963102.mp4?maxChunkSize=5242880
const cleanUrl = rawUrl.split('#')[0];
testReq(cleanUrl, "https://abyssplayer.com/");

// 3. Cleaned URL without referer (or with google / empty referer)
testReq(cleanUrl, "");
