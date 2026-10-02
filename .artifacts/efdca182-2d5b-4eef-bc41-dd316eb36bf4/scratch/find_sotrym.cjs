const fs = require('fs');
const js = fs.readFileSync("C:/Users/sanya/StudioProjects/AniLove2/.artifacts/efdca182-2d5b-4eef-bc41-dd316eb36bf4/scratch/lite.bundle.js", "utf-8");

const idx = js.indexOf("SoTrym");
console.log("SoTrym index:", idx);
if (idx !== -1) {
  console.log("Context around SoTrym:\n", js.substring(Math.max(0, idx - 200), Math.min(js.length, idx + 800)));
} else {
  console.log("Searching for window.");
  const wMatches = js.match(/window\.[a-zA-Z0-9_$]+/g);
  console.log("window exports:", wMatches);
}
