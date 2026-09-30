async function testToken() {
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
  console.log('Testing token:', token);

  // Test GET https://tryembed.us.cc/s/{token}
  const sRes = await fetch(`https://tryembed.us.cc/s/${token}`, {
    headers: {
      'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36',
      'Referer': 'https://tryembed.us.cc/embed/anime/21/1/sub',
      'Cookie': cookieHeader
    },
    redirect: 'manual'
  });

  console.log('s/{token} status:', sRes.status);
  console.log('s/{token} location:', sRes.headers.get('location'));
  const sBody = await sRes.text();
  console.log('s/{token} body:', sBody.substring(0, 300));
}

testToken();
