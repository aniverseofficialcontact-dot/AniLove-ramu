with open('c:/temp/lite_bundle.js', 'r', encoding='utf-8') as f:
    js = f.read()

# Let's see what happens if we patch lite.bundle.js
# Look for where _0x3c817d or top!=self or sandbox/adblock check happens
import re

# Find exact substring where top is compared
idx = js.find('top[')
if idx >= 0:
    print("Found top[ at:", idx)
    print(js[idx-100:idx+300])

idx2 = js.find('.abyss.to')
if idx2 >= 0:
    print("\nFound .abyss.to at:", idx2)
    print(js[idx2-100:idx2+300])
