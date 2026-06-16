import type { CSSProperties } from "react";

// Logo Flatmind rendu via masque CSS : l'image (alpha) sert de masque et la
// forme est peinte avec `currentColor`. Résultat : monochrome, net à toute
// densité, et qui suit le thème — sombre en mode clair, blanc en mode sombre
// (quand `color` pointe sur une variable de texte qui s'inverse).
const ASPECT = 1; // logo carré (cadre quasi carré)

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
        WebkitMaskImage: "url(/flatmind-logo.png?v=3)",
        maskImage: "url(/flatmind-logo.png?v=3)",
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
