import urllib.request as req

headers = {
    'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36',
    'Referer': 'https://abyssplayer.com/'
}

r = req.Request('https://iamcdn.net/player-v2/lite.bundle.js', headers=headers)
resp = req.urlopen(r, timeout=10)
js = resp.read().decode('utf-8', errors='replace')

# Test replacements
js_patched = js
if "!_0x3c817d&&!_0x53cb62" in js_patched:
    js_patched = js_patched.replace("!_0x3c817d&&!_0x53cb62", "false")
    print("Patch 1 success: replaced !_0x3c817d&&!_0x53cb62")
else:
    print("Patch 1 NOT found")

if "_0x3c817d=top[" in js_patched:
    js_patched = js_patched.replace("_0x3c817d=top[", "_0x3c817d=true;top[")
    print("Patch 2 success: replaced _0x3c817d=top[")
else:
    print("Patch 2 NOT found")

if "_0x53cb62='localhost'==" in js_patched:
    js_patched = js_patched.replace("_0x53cb62='localhost'==", "_0x53cb62=true;'localhost'==")
    print("Patch 3 success: replaced _0x53cb62='localhost'==")
else:
    print("Patch 3 NOT found")
