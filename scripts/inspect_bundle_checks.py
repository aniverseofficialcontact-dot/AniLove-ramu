with open('c:/temp/lite_bundle.js', 'r', encoding='utf-8') as f:
    js = f.read()

import re
# Find all occurrences of nativecode or toString or window.open or replace
for match in re.finditer(r'(?:nativecode|replace|toString|top|location|iframe)', js):
    start = max(0, match.start() - 150)
    end = min(len(js), match.end() + 150)
    print(f"[{match.group(0)}]:\n{js[start:end]}\n" + "="*40)
