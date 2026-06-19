// Génère toutes les icônes Flatmind (favicon, apple-touch, PWA) à partir du
// mark vectoriel violet `public/flatmind-logo.svg`. Source SVG → rendu haute
// résolution + fond transparent. L'icône « maskable » reçoit un fond violet
// plein cadre (les launchers Android peuvent rogner la zone transparente).
//
// Lancer : node scripts/generate-icons.mjs

import sharp from "sharp";
import { mkdir } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";

const here = path.dirname(fileURLToPath(import.meta.url));
const root = path.resolve(here, "..");
const SOURCE = path.join(root, "public", "flatmind-logo.svg");

const TRANSPARENT = { r: 0, g: 0, b: 0, alpha: 0 };

// Rend le mark SVG à `markSize` (densité élevée pour des bords nets), centré
// dans une canvas carrée `size`. `background` : couleur unie ({r,g,b,alpha})
// OU un Buffer image plein cadre (ex. dégradé violet pour le maskable).
async function buildIcon({ size, output, markRatio = 0.82, background = TRANSPARENT }) {
  const markSize = Math.round(size * markRatio);
  const mark = await sharp(SOURCE, { density: 384 })
    .resize(markSize, markSize, { fit: "contain", background: TRANSPARENT })
    .toBuffer();

  const base = Buffer.isBuffer(background)
    ? sharp(background)
    : sharp({ create: { width: size, height: size, channels: 4, background } });

  await base
    .composite([{ input: mark, gravity: "center" }])
    .png({ compressionLevel: 9 })
    .toFile(output);
}

// Tuile violette premium plein cadre (dégradé) pour les icônes installées.
async function violetTile(size) {
  const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="${size}" height="${size}">
    <defs><linearGradient id="b" x1="0" y1="0" x2="${size}" y2="${size}" gradientUnits="userSpaceOnUse">
      <stop offset="0" stop-color="#7C3AED"/><stop offset="1" stop-color="#5B21B6"/>
    </linearGradient></defs>
    <rect width="${size}" height="${size}" fill="url(#b)"/>
  </svg>`;
  return sharp(Buffer.from(svg)).png().toBuffer();
}

async function main() {
  await mkdir(path.join(root, "public", "icons"), { recursive: true });

  // Favicon PNG (fallback du favicon SVG) : mark violet sur fond transparent.
  await buildIcon({ size: 512, output: path.join(root, "app", "icon.png"), markRatio: 0.82 });
  console.log("✓ app/icon.png (512px, transparent)");

  // Icônes installées (apple-touch + PWA) : mark sur tuile violette premium.
  // Une tuile transparente apparaîtrait sur fond noir sur iOS → on pose le
  // dégradé violet plein cadre (iOS/Android arrondissent les coins).
  const tileTasks = [
    { size: 180, output: path.join(root, "app", "apple-icon.png"), markRatio: 0.7 },
    { size: 192, output: path.join(root, "public", "icons", "icon-192.png"), markRatio: 0.7 },
    { size: 512, output: path.join(root, "public", "icons", "icon-512.png"), markRatio: 0.7 },
    // Maskable : safe zone resserrée (les launchers Android peuvent rogner).
    { size: 512, output: path.join(root, "public", "icons", "icon-maskable-512.png"), markRatio: 0.58 },
  ];
  for (const task of tileTasks) {
    await buildIcon({ ...task, background: await violetTile(task.size) });
    console.log(`✓ ${path.relative(root, task.output)} (${task.size}px, tuile violette)`);
  }
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
