import urllib.request as req
import re

headers = {
    'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
    'Referer': 'https://piratexplay.cc/'
}

# Fetch the abyssplayer page
r = req.Request('https://abyssplayer.com/ea9pH6q2i', headers=headers)
resp = req.urlopen(r, timeout=15)
html = resp.read().decode('utf-8', errors='replace')

print(f'Total length: {len(html)}')

# Find all scripts
scripts = re.findall(r'<script[^>]*>(.*?)</script>', html, re.DOTALL)
for i, s in enumerate(scripts):
    if len(s.strip()) > 30:
        print(f'\n--- Script {i} (len={len(s)}) ---')
        print(s[:800])
