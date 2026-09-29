async function testDrive() {
  const reelId = '1CDJj8fh3IXdf93zlXnsFuKKL4uk5CkwR';
  const urls = [
    `https://drive.google.com/uc?export=download&id=${reelId}&confirm=t`,
    `https://drive.usercontent.google.com/download?id=${reelId}&export=download&confirm=t`,
    `https://drive.google.com/uc?export=view&id=${reelId}`
  ];

  for (const url of urls) {
    try {
      const res = await fetch(url, { redirect: 'manual' });
      console.log('URL:', url);
      console.log('Status:', res.status);
      console.log('Location header:', res.headers.get('location'));
      console.log('Content-Type:', res.headers.get('content-type'));
      console.log('-----------------------------------');
    } catch (e) {
      console.error('Error for URL:', url, e.message);
    }
  }
}

testDrive();
