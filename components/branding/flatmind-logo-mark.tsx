import type { CSSProperties } from "react";

// Mark Flatmind — SVG vectoriel (résolution infinie, fond transparent) en
// violet avec finitions premium : dégradé diagonal, reflet glossy en haut et
// ombre portée douce. Les IDs de defs sont statiques : si plusieurs marks
// coexistent sur la page, les defs sont dupliquées mais STRICTEMENT
// identiques, donc `url(#id)` résout vers une def équivalente (et c'est
// SSR-safe, contrairement à un compteur d'instance).
const ASPECT = 900 / 760; // ratio du viewBox
const grad = "fm-mark-grad";
const sheen = "fm-mark-sheen";
const shadow = "fm-mark-shadow";

export function FlatmindLogoMark({
  height = 32,
  className,
  style,
}: {
  height?: number;
  className?: string;
  style?: CSSProperties;
}) {
  const SHAPES = (
    <>
      <rect x="200" y="38" width="500" height="90" rx="45" />
      <rect x="85" y="150" width="723" height="98" rx="49" />
      <rect x="28" y="270" width="844" height="118" rx="59" />
      <rect x="92" y="408" width="708" height="110" rx="55" />
      <path d="M308 581a46 46 0 0 1 46-46h288a46 46 0 0 1 46 46v0a46 46 0 0 1-46 46h-30l-46 86q-10 18-23 0l-46-86h-103a46 46 0 0 1-46-46Z" />
    </>
  );

  return (
    <svg
      aria-hidden="true"
      focusable="false"
      className={className}
      width={height * ASPECT}
      height={height}
      viewBox="0 0 900 760"
      fill="none"
      style={style}
    >
      <defs>
        <linearGradient id={grad} gradientUnits="userSpaceOnUse" x1="60" y1="40" x2="840" y2="720">
          <stop offset="0" stopColor="#C4B5FD" />
          <stop offset="0.48" stopColor="#8B5CF6" />
          <stop offset="1" stopColor="#6D28D9" />
        </linearGradient>
        <linearGradient id={sheen} gradientUnits="userSpaceOnUse" x1="0" y1="20" x2="0" y2="400">
          <stop offset="0" stopColor="#FFFFFF" stopOpacity="0.32" />
          <stop offset="1" stopColor="#FFFFFF" stopOpacity="0" />
        </linearGradient>
        <filter id={shadow} x="-10%" y="-10%" width="120%" height="125%">
          <feDropShadow dx="0" dy="7" stdDeviation="11" floodColor="#6D28D9" floodOpacity="0.32" />
        </filter>
      </defs>

      <g filter={`url(#${shadow})`}>
        <g fill={`url(#${grad})`}>{SHAPES}</g>
        <g fill={`url(#${sheen})`}>{SHAPES}</g>
      </g>
    </svg>
  );
}
