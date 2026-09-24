import urllib.request as req
import json

headers = {
    'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
    'Referer': 'https://piratexplay.cc/'
}

for test_url in [
    'https://abyssplayer.com/ea9pH6q2i',
    'https://play.abyssplayer.com/ea9pH6q2i',
    'https://short.icu/ea9pH6q2i'
]:
    try:
        r = req.Request(test_url, headers=headers)
        resp = req.urlopen(r, timeout=10)
        print(f"URL: {test_url} -> Status: {resp.status}, Final URL: {resp.geturl()}, Length: {len(resp.read())}")
    except Exception as e:
        print(f"URL: {test_url} -> Error: {e}")
