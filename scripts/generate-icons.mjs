// Génère toutes les icônes Mindbase (favicon, apple-touch, PWA) à partir du
// mark `M` Mindbase utilisé dans l'app (`public/mindbase-iphone.png`). Ce
// fichier est déjà au format icône iOS (M coloré centré, contour blanc), on
// le pose simplement sur un fond noir et on exporte aux tailles standard.
//
// Lancer : node scripts/generate-icons.mjs

import sharp from "sharp";
import { mkdir } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";

const here = path.dirname(fileURLToPath(import.meta.url));
const root = path.resolve(here, "..");
const SOURCE = path.join(root, "public", "mindbase-iphone.png");

// Fond noir solide — assorti au thème dark de l'app (#08080a). iOS arrondit
// automatiquement les coins, donc pas besoin de masque arrondi côté asset.
const BACKGROUND = { r: 8, g: 8, b: 10, alpha: 1 };

// Compose le `M` au centre, à `markRatio` de la canvas. Pour les icônes
// maskables PWA on réduit le ratio pour respecter la safe zone iOS/Android.
async function buildIcon({ size, output, markRatio = 0.88 }) {
  const markSize = Math.round(size * markRatio);
  const mark = await sharp(SOURCE)
    .resize(markSize, markSize, { fit: "contain", background: { r: 0, g: 0, b: 0, alpha: 0 } })
    .toBuffer();

  await sharp({
    create: {
      width: size,
      height: size,
      channels: 4,
      background: BACKGROUND,
    },
  })
    .composite([{ input: mark, gravity: "center" }])
    .png({ compressionLevel: 9 })
    .toFile(output);
}

async function main() {
  await mkdir(path.join(root, "public", "icons"), { recursive: true });

  const tasks = [
    // App Router file-based metadata : Next sert ces fichiers directement.
    { size: 180, output: path.join(root, "app", "apple-icon.png"), markRatio: 0.78 },
    { size: 512, output: path.join(root, "app", "icon.png"), markRatio: 0.74 },

    // PWA manifest icons (référencés par app/manifest.ts).
    { size: 192, output: path.join(root, "public", "icons", "icon-192.png"), markRatio: 0.74 },
    { size: 512, output: path.join(root, "public", "icons", "icon-512.png"), markRatio: 0.74 },

    // Maskable : safe zone resserrée (les launchers Android peuvent rogner).
    { size: 512, output: path.join(root, "public", "icons", "icon-maskable-512.png"), markRatio: 0.6 },
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
