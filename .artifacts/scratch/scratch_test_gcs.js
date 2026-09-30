async function testGcs() {
  const gcsUrl = 'https://storage.googleapis.com/mediastorage/1790784663127/ut6xcuxtc9o/124399029.mp4#mp4/chunk/1/124399029/2097152/360p/h264?maxChunkSize=5242880';
  console.log('Testing GCS URL:', gcsUrl);

  // Test 1: With Referer = https://piratexplay.cc/
  try {
    const res1 = await fetch(gcsUrl, {
      headers: {
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36',
        'Referer': 'https://piratexplay.cc/'
      }
    });
    console.log('Test 1 (Referer = https://piratexplay.cc/): Status =', res1.status);
  } catch (e) {
    console.log('Test 1 Error:', e.message);
  }

  // Test 2: Without Referer
  try {
    const res2 = await fetch(gcsUrl, {
      headers: {
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36'
      }
    });
    console.log('Test 2 (No Referer): Status =', res2.status);
  } catch (e) {
    console.log('Test 2 Error:', e.message);
  }
}

testGcs();
