import type { CSSProperties } from "react";

// Logo Flatmind : un « cerveau » fait de boucles, posé dans un cadre arrondi
// paysage dont le bord inférieur est ouvert — le tronc du cerveau descend et
// se fond dans le bord du cadre. Recréation SVG monochrome (hérite de `color`)
// du logo fourni. Pour un rendu pixel-perfect, déposer le PNG dans /public.
export function FlatmindMark({
  size = 40,
  className,
  style,
  strokeWidth = 6.5,
}: {
  size?: number;
  className?: string;
  style?: CSSProperties;
  strokeWidth?: number;
}) {
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 120 120"
      fill="none"
      stroke="currentColor"
      strokeWidth={strokeWidth}
      strokeLinecap="round"
      strokeLinejoin="round"
      className={className}
      style={style}
      aria-hidden="true"
    >
      {/* Cadre arrondi paysage + tronc : un seul trait. Le bord bas est ouvert
          (extrémité libre à gauche) et le bord bas-droit remonte en tronc vers
          le centre du cerveau. */}
      <path d="M50 84 L33 84 Q20 84 20 71 L20 43 Q20 30 33 30 L87 30 Q100 30 100 43 L100 71 Q100 84 87 84 L66 84 Q60 84 60 78 L60 66" />

      {/* Silhouette du cerveau : deux lobes bombés avec une fente centrale,
          base plate raccordée au tronc. */}
      <path d="M60 66 L43 66 Q32 65 32 53 Q32 37 45 36 Q54 35 57 44 Q60 35 69 36 Q82 37 82 53 Q82 65 71 66 Z" />

      {/* Boucles internes (replis du cerveau) : une boucle verticale au centre,
          deux boucles inclinées de part et d'autre. */}
      <ellipse cx="57" cy="49" rx="4.6" ry="7" />
      <ellipse cx="45" cy="54" rx="8" ry="5" transform="rotate(-18 45 54)" />
      <ellipse cx="69" cy="54" rx="8" ry="5" transform="rotate(18 69 54)" />
    </svg>
  );
}
