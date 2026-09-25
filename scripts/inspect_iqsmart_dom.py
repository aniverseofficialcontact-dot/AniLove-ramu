with open('c:/temp/iqsmart_scripts.txt', 'r', encoding='utf-8', errors='replace') as f:
    text = f.read()

# Let's inspect the HTML of IQSmart embed
import urllib.request as req
headers = {
    'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
    'Referer': 'https://piratexplay.cc/'
}
r = req.Request('https://pro.iqsmartgames.com/embed/mqm50p1', headers=headers)
resp = req.urlopen(r, timeout=10)
html = resp.read().decode('utf-8', errors='replace')

with open('c:/temp/iqsmart_embed.html', 'w', encoding='utf-8') as f:
    f.write(html)

print("Saved IQSmart HTML, length:", len(html))

# Let's find all divs, iframes, and players in iqsmart_embed.html
import re
print("Elements:")
for line in html.splitlines():
    if any(k in line.lower() for k in ['id=', 'class=', 'player', 'iframe', 'video', 'controls', 'menu', 'button']):
        if len(line.strip()) < 150:
            print(" ", line.strip())
