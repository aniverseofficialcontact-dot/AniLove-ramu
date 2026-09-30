async function printBlakiteHtml() {
  const res = await fetch('https://blakiteapi.xyz/embed/1/1-1', {
    headers: {
      'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36',
      'Referer': 'https://blakiteapi.xyz/'
    }
  });
  const html = await res.text();
  console.log('Full HTML:\n', html);
}

printBlakiteHtml();
