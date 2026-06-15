import type { CSSProperties } from "react";

// Wordmark « MindLay » : « Mind » en League Spartan + « lay » en brush-script
// Yellowtail, légèrement plus grand, avec un trait souligné effilé. Monochrome :
// tout hérite de `color` (donc même teinte que « Mind » / le contexte).
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
      <span className="mb-wordmark-mind" style={{ fontWeight: 700, letterSpacing: "-0.02em", fontSize }}>
        Mind
      </span>
      {/* « lay » est un sibling inline avec alignItems:baseline sur le parent →
          sa ligne de base s'aligne sur celle de « Mind » (pas de décalage
          manuel, qui désalignait). */}
      <span
        style={{
          position: "relative",
          display: "inline-block",
          marginLeft: fontSize * 0.06,
          paddingRight: fontSize * 0.16,
        }}
      >
        {/* « lay » à la même échelle que « Mind » (légèrement réduit). */}
        <span className="mb-script" style={{ fontSize: fontSize * 1.0, lineHeight: 1 }}>
          lay
        </span>
        {/* Trait « brush » sous le mot (même teinte que le texte). */}
        <svg
          aria-hidden
          viewBox="0 0 120 18"
          preserveAspectRatio="none"
          style={{
            position: "absolute",
            left: "-4%",
            bottom: -fontSize * 0.16,
            width: "112%",
            height: fontSize * 0.36,
            overflow: "visible",
          }}
        >
          <path d="M3 10 C 40 2, 84 3, 117 7 C 82 10, 44 11, 6 15 Z" fill="currentColor" />
        </svg>
      </span>
    </span>
  );
}
