import type { CSSProperties } from "react";

// Logo Flatmind rendu via DEUX masques CSS superposés :
//  • les 3 barres du haut → peintes avec `currentColor` (suivent le thème :
//    sombre en clair, blanc en sombre) ;
//  • la couche du bas (avec la queue) → peinte en VIOLET (couleur unique des
//    environnements).
const ASPECT = 613 / 460; // ratio natif de l'asset
const TOP_URL = "/flatmind-logo-top.png?v=6";
const BOTTOM_URL = "/flatmind-logo-bottom.png?v=6";

export function FlatmindLogoMark({
  height = 32,
  className,
  style,
}: {
  height?: number;
  className?: string;
  style?: CSSProperties;
}) {
  const layer: CSSProperties = {
    position: "absolute",
    inset: 0,
    WebkitMaskRepeat: "no-repeat",
    maskRepeat: "no-repeat",
    WebkitMaskPosition: "center",
    maskPosition: "center",
    WebkitMaskSize: "contain",
    maskSize: "contain",
  };
  return (
    <span
      aria-hidden="true"
      className={className}
      style={{
        position: "relative",
        display: "inline-block",
        height,
        width: height * ASPECT,
        ...style,
      }}
    >
      {/* Barres du haut : couleur du thème (héritée de `color`). */}
      <span
        style={{
          ...layer,
          backgroundColor: "currentColor",
          WebkitMaskImage: `url(${TOP_URL})`,
          maskImage: `url(${TOP_URL})`,
        }}
      />
      {/* Couche du bas + queue : violet (couleur d'environnement). */}
      <span
        style={{
          ...layer,
          backgroundColor: "var(--mb-personal-accent)",
          WebkitMaskImage: `url(${BOTTOM_URL})`,
          maskImage: `url(${BOTTOM_URL})`,
        }}
      />
    </span>
  );
}
