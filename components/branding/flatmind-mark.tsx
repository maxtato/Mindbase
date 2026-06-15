import type { CSSProperties } from "react";

// Logo Flatmind : un « cerveau » fait de boucles dans un cadre arrondi, avec un
// petit tronc en bas — recréation SVG monochrome (hérite de `color`) du logo
// fourni. Pour un rendu pixel-perfect, déposer le PNG dans /public et l'utiliser
// à la place.
export function FlatmindMark({
  size = 40,
  className,
  style,
  strokeWidth = 3.4,
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
      viewBox="0 0 64 64"
      fill="none"
      stroke="currentColor"
      strokeWidth={strokeWidth}
      strokeLinecap="round"
      strokeLinejoin="round"
      className={className}
      style={style}
      aria-hidden="true"
    >
      {/* Cadre arrondi */}
      <rect x="7" y="11" width="50" height="42" rx="9" />
      {/* Cerveau en boucles : trois lobes (boucles) qui se chevauchent */}
      <circle cx="24" cy="31" r="7.2" />
      <circle cx="40" cy="31" r="7.2" />
      <circle cx="32" cy="26.5" r="6.4" />
      {/* Tronc qui descend vers le bas du cadre */}
      <path d="M32 38.5 L32 45 Q32 47 34 47 L41 47" />
    </svg>
  );
}
