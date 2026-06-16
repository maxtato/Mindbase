import type { CSSProperties } from "react";

// Logo Flatmind rendu via un masque CSS unique : toute la forme est peinte avec
// `currentColor` (suit le thème : noir en clair, blanc en sombre). Fond
// transparent. L'icône PWA, elle, a son propre fond violet (cf. /public/icons).
const ASPECT = 613 / 460; // ratio natif de l'asset
const LOGO_URL = "/flatmind-logo.png?v=7";

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
    <span
      aria-hidden="true"
      className={className}
      style={{
        display: "inline-block",
        height,
        width: height * ASPECT,
        backgroundColor: "currentColor",
        WebkitMaskImage: `url(${LOGO_URL})`,
        maskImage: `url(${LOGO_URL})`,
        WebkitMaskRepeat: "no-repeat",
        maskRepeat: "no-repeat",
        WebkitMaskPosition: "center",
        maskPosition: "center",
        WebkitMaskSize: "contain",
        maskSize: "contain",
        ...style,
      }}
    />
  );
}
