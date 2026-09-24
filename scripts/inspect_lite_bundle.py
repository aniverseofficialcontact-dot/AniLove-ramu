import urllib.request as req

headers = {
    'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36',
    'Referer': 'https://abyssplayer.com/'
}

r = req.Request('https://iamcdn.net/player-v2/lite.bundle.js', headers=headers)
resp = req.urlopen(r, timeout=10)
js = resp.read().decode('utf-8', errors='replace')

print("lite.bundle.js length:", len(js))
with open('c:/temp/lite_bundle.js', 'w', encoding='utf-8') as f:
    f.write(js)

# Find SoTrym
idx = js.find('SoTrym')
if idx >= 0:
    print("Found SoTrym at index:", idx)
    print(js[idx:idx+1500])
else:
    print("SoTrym not found")
