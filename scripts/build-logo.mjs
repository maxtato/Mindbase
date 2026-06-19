// Construit le logo Flatmind haute définition à partir de l'artwork fourni
// (barres + bulle, noir sur blanc) : scripts/assets/flatmind-logo-source.jpg.
//
// Pipeline (sharp) :
//   1. trim du fond blanc → bbox serrée de l'artwork
//   2. upscale haute définition (lanczos)
//   3. masque alpha dérivé de la luminance (le noir devient opaque,
//      le blanc transparent) → détourage
//   4. remplissage par un dégradé violet premium (diagonal) + reflet glossy
//
// Sortie : public/flatmind-logo.png (violet, transparent, HD).
// Lancer : node scripts/build-logo.mjs

import sharp from "sharp";
import path from "node:path";
import { fileURLToPath } from "node:url";

const here = path.dirname(fileURLToPath(import.meta.url));
const root = path.resolve(here, "..");
const SOURCE = path.join(root, "scripts", "assets", "flatmind-logo-source.jpg");
const OUTPUT = path.join(root, "public", "flatmind-logo.png");

// Facteur d'upscale pour la haute définition (l'artwork source est ~900px).
const SCALE = 2.6;

function gradientSvg(width, height) {
  // Pas de reflet lumineux : une fine trame satinée (micro-stries diagonales
  // claires + sombres à très basse opacité) donne une brillance « matière »
  // discrète sans halo de lumière. Période ~width/120 pour rester fine en HD.
  const step = Math.max(6, Math.round(width / 120));
  return `<svg xmlns="http://www.w3.org/2000/svg" width="${width}" height="${height}">
    <defs>
      <linearGradient id="g" gradientUnits="userSpaceOnUse" x1="${width * 0.08}" y1="0" x2="${width * 0.92}" y2="${height}">
        <stop offset="0" stop-color="#8B5CF6"/>
        <stop offset="0.56" stop-color="#7C3AED"/>
        <stop offset="1" stop-color="#6D28D9"/>
      </linearGradient>
      <pattern id="satin" width="${step}" height="${step}" patternTransform="rotate(35)" patternUnits="userSpaceOnUse">
        <rect width="${step}" height="${step}" fill="none"/>
        <rect width="${step / 2}" height="${step}" fill="#FFFFFF" fill-opacity="0.05"/>
        <rect x="${step / 2}" width="${step / 2}" height="${step}" fill="#000000" fill-opacity="0.04"/>
      </pattern>
    </defs>
    <rect width="${width}" height="${height}" fill="url(#g)"/>
    <rect width="${width}" height="${height}" fill="url(#satin)"/>
  </svg>`;
}

async function main() {
  // 1+2 : trim du blanc puis upscale. On passe par un buffer intermédiaire
  // pour connaître les dimensions réelles après trim.
  const trimmed = await sharp(SOURCE).flatten({ background: "#ffffff" }).trim({ threshold: 20 }).toBuffer();
  const meta = await sharp(trimmed).metadata();
  const W = Math.round(meta.width * SCALE);
  const H = Math.round(meta.height * SCALE);

  // 3 : masque alpha (noir → opaque). grayscale + negate + contraste pour des
  // bords nets tout en conservant l'anti-aliasing. b-w force 1 canal.
  const alphaRaw = await sharp(trimmed)
    .resize(W, H, { kernel: "lanczos3" })
    .grayscale()
    .negate()
    .linear(1.5, -40)
    .toColourspace("b-w")
    .raw()
    .toBuffer();

  // 4 : remplissage violet premium aplati (RGB) masqué par l'alpha.
  const fillRaw = await sharp(Buffer.from(gradientSvg(W, H)))
    .resize(W, H)
    .removeAlpha()
    .raw()
    .toBuffer();

  await sharp(fillRaw, { raw: { width: W, height: H, channels: 3 } })
    .joinChannel(alphaRaw, { raw: { width: W, height: H, channels: 1 } })
    .png({ compressionLevel: 9 })
    .toFile(OUTPUT);

  console.log(`✓ ${path.relative(root, OUTPUT)} (${W}x${H}, violet HD, transparent)`);
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
