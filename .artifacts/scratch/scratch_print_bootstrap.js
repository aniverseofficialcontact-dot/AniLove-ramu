async function printBootstrap() {
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
  console.log(JSON.stringify(data, null, 2));
}

printBootstrap();
