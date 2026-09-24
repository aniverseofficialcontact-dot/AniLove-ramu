import urllib.request as req
import json

headers = {
    'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64)',
    'Accept': 'application/json'
}

# Smoking Behind the Supermarket with You anilist ID or search for it
# Let's search AniList or query with anilistId
url = 'https://animeworld-india-api-njtl.onrender.com/api/anime-world-india/v1/stream.php?id=smoking-behind-the-supermarket-with-you-season-1-1x1'
try:
    r = req.Request(url, headers=headers)
    resp = req.urlopen(r, timeout=15)
    data = json.loads(resp.read().decode('utf-8'))
    print("Direct id query success!")
    print(json.dumps(data, indent=2)[:2000])
except Exception as e:
    print('Query error:', e)
