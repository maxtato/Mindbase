// Génère toutes les icônes Mindbase (favicon, apple-touch, PWA) à partir du
// mark `public/mindbase-mark.png`. Compose le brain sur un fond sombre/violet
// qui reprend l'identité de l'app, puis exporte aux tailles standard iOS/PWA.
//
// Lancer : node scripts/generate-icons.mjs

import sharp from "sharp";
import { mkdir } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";

const here = path.dirname(fileURLToPath(import.meta.url));
const root = path.resolve(here, "..");
const SOURCE = path.join(root, "public", "mindbase-mark.png");

// Fond : gradient diagonal sombre → violet profond (cohérent avec le thème
// dark de l'app et la couleur accent #7C3AED).
function backgroundSvg(size) {
  return Buffer.from(`
    <svg width="${size}" height="${size}" viewBox="0 0 ${size} ${size}" xmlns="http://www.w3.org/2000/svg">
      <defs>
        <linearGradient id="g" x1="0%" y1="0%" x2="100%" y2="100%">
          <stop offset="0%" stop-color="#1A0F2E"/>
          <stop offset="55%" stop-color="#2B1755"/>
          <stop offset="100%" stop-color="#4C1D95"/>
        </linearGradient>
        <radialGradient id="glow" cx="50%" cy="42%" r="55%">
          <stop offset="0%" stop-color="#A855F7" stop-opacity="0.35"/>
          <stop offset="60%" stop-color="#7C3AED" stop-opacity="0.08"/>
          <stop offset="100%" stop-color="#000000" stop-opacity="0"/>
        </radialGradient>
      </defs>
      <rect width="${size}" height="${size}" fill="url(#g)"/>
      <rect width="${size}" height="${size}" fill="url(#glow)"/>
    </svg>
  `);
}

// Compose le mark Mindbase au centre, à `markRatio` de la canvas (laisse une
// marge de respiration autour). Pour les icônes maskables PWA on réduit le
// ratio pour respecter la safe zone iOS/Android.
async function buildIcon({ size, output, markRatio = 0.68 }) {
  const markSize = Math.round(size * markRatio);
  const mark = await sharp(SOURCE)
    .resize(markSize, markSize, { fit: "contain", background: { r: 0, g: 0, b: 0, alpha: 0 } })
    .toBuffer();

  await sharp(backgroundSvg(size))
    .composite([{ input: mark, gravity: "center" }])
    .png({ compressionLevel: 9 })
    .toFile(output);
}

async function main() {
  await mkdir(path.join(root, "public", "icons"), { recursive: true });

  const tasks = [
    // App Router file-based metadata : Next sert ces fichiers directement.
    { size: 180, output: path.join(root, "app", "apple-icon.png"), markRatio: 0.72 },
    { size: 512, output: path.join(root, "app", "icon.png"), markRatio: 0.68 },

    // PWA manifest icons (référencés par app/manifest.ts).
    { size: 192, output: path.join(root, "public", "icons", "icon-192.png"), markRatio: 0.68 },
    { size: 512, output: path.join(root, "public", "icons", "icon-512.png"), markRatio: 0.68 },

    // Maskable : safe zone à ~80% (les launchers Android/iOS peuvent rogner).
    { size: 512, output: path.join(root, "public", "icons", "icon-maskable-512.png"), markRatio: 0.56 },
  ];

  for (const task of tasks) {
    await buildIcon(task);
    console.log(`✓ ${path.relative(root, task.output)} (${task.size}px)`);
  }
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
