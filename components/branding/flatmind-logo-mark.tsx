import type { CSSProperties } from "react";

// Mark Flatmind — PNG haute définition, violet, détouré (fond transparent) avec
// finitions premium (dégradé + reflet) déjà intégrées dans l'image. Généré par
// `scripts/build-logo.mjs` à partir de l'artwork fourni. On l'affiche tel quel
// (plus de masque CSS monochrome : le dégradé violet doit rester visible).
const ASPECT = 2233 / 1758; // ratio natif de l'asset HD
const LOGO_URL = "/flatmind-logo.png?v=12";

export function FlatmindLogoMark({
  height = 32,
  className,
  style,
}: {
  height?: number;
  className?: string;
  style?: CSSProperties;
}) {
  return (
    // eslint-disable-next-line @next/next/no-img-element
    <img
      src={LOGO_URL}
      alt=""
      aria-hidden="true"
      className={className}
      height={height}
      width={Math.round(height * ASPECT)}
      style={{ height, width: height * ASPECT, objectFit: "contain", ...style }}
    />
  );
}
