async function test2BAnd2C() {
  console.log('--- Testing Server 2-B SUB (tryembed.us.cc) ---');
  let pageRes = await fetch('https://tryembed.us.cc/embed/anime/21/1/sub', {
    headers: {
      'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36'
    }
  });
  let cookies = pageRes.headers.getSetCookie ? pageRes.headers.getSetCookie() : [];
  let html = await pageRes.text();
  let ticketMatch = html.match(/BOOTSTRAP_TICKET="([^"]+)"/);
  console.log('2-B SUB Ticket found:', !!ticketMatch);

  if (ticketMatch) {
    let ticket = ticketMatch[1];
    let cookieHeader = cookies.map(c => c.split(';')[0]).join('; ');
    let apiRes = await fetch('https://tryembed.us.cc/api/bootstrap', {
      method: 'POST',
      headers: {
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36',
        'Referer': 'https://tryembed.us.cc/embed/anime/21/1/sub',
        'Origin': 'https://tryembed.us.cc',
        'X-TryEmbed-Bootstrap': ticket,
        'Cookie': cookieHeader
      }
    });
    console.log('2-B SUB Bootstrap Status:', apiRes.status);
    let data = await apiRes.json();
    console.log('2-B SUB Provider count:', data.providers?.length);
    let sel = data.selectedProvider || data.providers?.[0];
    console.log('2-B SUB Qualities:', sel?.qualities?.map(q => q.name));
  }

  console.log('\n--- Testing Server 2-C SUB (vidnest.fun/animepahe) ---');
  let pageRes2C = await fetch('https://vidnest.fun/animepahe/21/1/sub', {
    headers: {
      'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36'
    }
  });
  console.log('2-C SUB Page Status:', pageRes2C.status);
  let html2C = await pageRes2C.text();
  console.log('2-C SUB HTML snippet (500 chars):\n', html2C.substring(0, 500));
}

test2BAnd2C();
