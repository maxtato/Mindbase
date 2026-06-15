import type { CSSProperties } from "react";

// Wordmark « MindLay » : « Mind » en sans-serif gras + « Lay » en écriture
// brush-script avec un trait souligné effilé. Monochrome (hérite de `color`),
// donc s'adapte au thème clair/sombre et au contexte (sidebar, etc.).
export function MindLayWordmark({
  fontSize = 24,
  className,
  style,
}: {
  fontSize?: number;
  className?: string;
  style?: CSSProperties;
}) {
  return (
    <span
      className={className}
      style={{
        display: "inline-flex",
        alignItems: "baseline",
        whiteSpace: "nowrap",
        lineHeight: 1,
        ...style,
      }}
    >
      <span style={{ fontWeight: 800, letterSpacing: "-0.02em", fontSize }}>Mind</span>
      <span
        style={{
          position: "relative",
          display: "inline-block",
          marginLeft: fontSize * 0.05,
          paddingRight: fontSize * 0.12,
        }}
      >
        <span className="mb-script" style={{ fontSize: fontSize * 1.1, lineHeight: 1 }}>
          Lay
        </span>
        {/* Trait « brush » sous le mot, effilé vers la droite. */}
        <svg
          aria-hidden
          viewBox="0 0 120 18"
          preserveAspectRatio="none"
          style={{
            position: "absolute",
            left: "-4%",
            bottom: -fontSize * 0.14,
            width: "112%",
            height: fontSize * 0.4,
            overflow: "visible",
          }}
        >
          <path d="M3 10 C 40 2, 84 3, 117 7 C 82 10, 44 11, 6 15 Z" fill="currentColor" />
        </svg>
      </span>
    </span>
  );
}
