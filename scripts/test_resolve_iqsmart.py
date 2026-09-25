import urllib.request as req
import json
import base64

def resolve_iqsmart_to_direct_url(sid):
    url = "https://pro.iqsmartgames.com/embedhelper2.php"
    headers = {
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
        'Referer': 'https://piratexplay.cc/',
        'Content-Type': 'application/x-www-form-urlencoded'
    }
    data = f"sid={sid}&UserFavSite=&currentDomain=%5B%5D".encode('utf-8')
    r = req.Request(url, data=data, headers=headers)
    try:
        resp = req.urlopen(r, timeout=5)
        res_json = json.loads(resp.read().decode('utf-8'))
        mresult = res_json.get('mresult')
        if mresult:
            decoded = json.loads(base64.b64decode(mresult).decode('utf-8'))
            abys_slug = decoded.get('abys')
            if abys_slug:
                return f"https://abyssplayer.com/{abys_slug}"
            mxdp_slug = decoded.get('mxdp')
            if mxdp_slug:
                return f"https://mixdrop.ag/e/{mxdp_slug}"
    except Exception as e:
        print("Resolve error:", e)
    return None

print("Resolved mqm50p1 to:", resolve_iqsmart_to_direct_url("mqm50p1"))
