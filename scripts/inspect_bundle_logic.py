with open('c:/temp/lite_bundle.js', 'r', encoding='utf-8') as f:
    js = f.read()

import re

# Find error messages or conditions in lite.bundle.js
for match in re.finditer(r'(?:throw|error|remove|sandbox|interfer|adblock)', js, re.I):
    start = max(0, match.start() - 100)
    end = min(len(js), match.end() + 150)
    # print small sample
    print(f"[{match.group(0)}]: {js[start:end]}\n---")
    if start > 5000:
        break
