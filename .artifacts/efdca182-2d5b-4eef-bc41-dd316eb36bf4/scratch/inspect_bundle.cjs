const https = require('https');
const fs = require('fs');

https.get("https://iamcdn.net/player-v2/lite.bundle.js", res => {
  let js = '';
  res.on('data', chunk => js += chunk);
  res.on('end', () => {
    fs.writeFileSync("C:/Users/sanya/StudioProjects/AniLove2/.artifacts/efdca182-2d5b-4eef-bc41-dd316eb36bf4/scratch/lite.bundle.js", js);
    console.log("Saved lite.bundle.js, length:", js.length);

    // Search for fetch / xhr / m3u8 / mp4 / decrypt patterns
    const matches = js.match(/function\s+[a-zA-Z0-9_$]+\s*\([^)]*\)\s*\{[^}]*m3u8[^}]*\}/g);
    console.log("Matches for m3u8 in bundle:", matches ? matches.length : 0);
  });
});
