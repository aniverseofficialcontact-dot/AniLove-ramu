async function verifyReferer() {
  console.log('--- Testing Referer Requirement for tryembed ---');
  const pageRes = await fetch('https://tryembed.us.cc/embed/anime/21/1/sub', {
    headers: {
      'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36'
    }
  });
  const cookies = pageRes.headers.getSetCookie ? pageRes.headers.getSetCookie() : [];
  const html = await pageRes.text();
  const ticketMatch = html.match(/BOOTSTRAP_TICKET="([^"]+)"/);
  const ticket = ticketMatch[1];
  const cookieHeader = cookies.map(c => c.split(';')[0]).join('; ');

  const apiRes = await fetch('https://tryembed.us.cc/api/bootstrap', {
    method: 'POST',
    headers: {
      'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36',
      'Referer': 'https://tryembed.us.cc/embed/anime/21/1/sub',
      'Origin': 'https://tryembed.us.cc',
      'X-TryEmbed-Bootstrap': ticket,
      'Cookie': cookieHeader
    }
  });

  const data = await apiRes.json();
  const selected = data.selectedProvider || data.providers[0];
  const token = selected.qualities[0].token;
  const nonce = data.embedNonce;

  const m3u8Url = `https://tryembed.us.cc/s/${token}.m3u8?nonce=${nonce}`;

  // Test 1: Referer = baseHost ("https://tryembed.us.cc/")
  const res1 = await fetch(m3u8Url, {
    headers: {
      'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36',
      'Referer': 'https://tryembed.us.cc/',
      'Cookie': cookieHeader
    }
  });
  console.log('Test 1 (Referer = https://tryembed.us.cc/): Status =', res1.status);

  // Test 2: Referer = exact embed URL ("https://tryembed.us.cc/embed/anime/21/1/sub")
  const res2 = await fetch(m3u8Url, {
    headers: {
      'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36',
      'Referer': 'https://tryembed.us.cc/embed/anime/21/1/sub',
      'Cookie': cookieHeader
    }
  });
  console.log('Test 2 (Referer = https://tryembed.us.cc/embed/anime/21/1/sub): Status =', res2.status);
  const text2 = await res2.text();
  console.log('Test 2 Body snippet:\n', text2.substring(0, 300));
}

verifyReferer();
