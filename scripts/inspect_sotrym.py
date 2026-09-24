with open('c:/temp/lite_bundle.js', 'r', encoding='utf-8') as f:
    js = f.read()

idx = js.find('SoTrym')
print(js[idx:idx+2500])
