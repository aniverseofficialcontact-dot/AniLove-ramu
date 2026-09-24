import urllib.request as req
import json
import base64

headers = {
    'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64)',
    'Referer': 'https://animeworldindia.org/'
}

url = 'https://blakiteapi.xyz/api/stream.php?id=296286&ep=1'
r = req.Request(url, headers=headers)
resp = req.urlopen(r, timeout=10)
data = json.loads(resp.read().decode('utf-8'))

print("Servers count:", len(data.get('stream', {}).get('servers', [])))
for i, s in enumerate(data.get('stream', {}).get('servers', [])):
    print(f"[{i+1}] Name: {s.get('name')}")
    print(f"    URL: {s.get('url')[:120]}...")

