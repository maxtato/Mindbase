// Génère toutes les icônes Flatmind (favicon, apple-touch, PWA) à partir du
// logo violet HD `public/flatmind-logo.png` (produit par scripts/build-logo.mjs).
// Le favicon reste transparent ; les icônes installées (apple-touch + PWA)
// reçoivent une tuile BLANCHE (une tuile transparente passerait en noir sur
// iOS) → logo violet sur fond blanc sur l'écran d'accueil.
//
// Lancer : node scripts/generate-icons.mjs

import sharp from "sharp";
import { mkdir } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";

const here = path.dirname(fileURLToPath(import.meta.url));
const root = path.resolve(here, "..");
const SOURCE = path.join(root, "public", "flatmind-logo.png");

const TRANSPARENT = { r: 0, g: 0, b: 0, alpha: 0 };

// Rend le mark à `markSize`, centré dans une canvas carrée `size`.
// `background` : couleur unie ({r,g,b,alpha}) OU un Buffer image plein cadre
// (ex. dégradé violet pour les tuiles installées).
async function buildIcon({ size, output, markRatio = 0.82, background = TRANSPARENT }) {
  const markSize = Math.round(size * markRatio);
  const mark = await sharp(SOURCE)
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

// Tuile blanche plein cadre pour les icônes installées (logo violet dessus).
async function whiteTile(size) {
  return sharp({
    create: { width: size, height: size, channels: 4, background: { r: 255, g: 255, b: 255, alpha: 1 } },
  })
    .png()
    .toBuffer();
}

async function main() {
  await mkdir(path.join(root, "public", "icons"), { recursive: true });

  // Favicon PNG (fallback du favicon SVG) : mark violet sur fond transparent.
  await buildIcon({ size: 512, output: path.join(root, "app", "icon.png"), markRatio: 0.82 });
  console.log("✓ app/icon.png (512px, transparent)");

  // Icônes installées (apple-touch + PWA) : mark violet sur tuile blanche.
  // Une tuile transparente apparaîtrait sur fond noir sur iOS → on pose un
  // fond blanc plein cadre (iOS/Android arrondissent les coins).
  const tileTasks = [
    { size: 180, output: path.join(root, "app", "apple-icon.png"), markRatio: 0.7 },
    { size: 192, output: path.join(root, "public", "icons", "icon-192.png"), markRatio: 0.7 },
    { size: 512, output: path.join(root, "public", "icons", "icon-512.png"), markRatio: 0.7 },
    // Maskable : safe zone resserrée (les launchers Android peuvent rogner).
    { size: 512, output: path.join(root, "public", "icons", "icon-maskable-512.png"), markRatio: 0.58 },
  ];
  for (const task of tileTasks) {
    await buildIcon({ ...task, background: await whiteTile(task.size) });
    console.log(`✓ ${path.relative(root, task.output)} (${task.size}px, tuile blanche)`);
  }
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
