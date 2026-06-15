import type { CSSProperties } from "react";

// Couleur de marque MindLay : violet « lay » + trait souligné.
const LAY_COLOR = "#5e17eb";

// Wordmark « MindLay » : « Mind » en League Spartan + « lay » en brush-script
// Yellowtail (violet), légèrement plus grand, avec un trait souligné effilé
// (même violet) abaissé sous le mot.
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
      <span className="mb-wordmark-mind" style={{ fontWeight: 500, letterSpacing: "-0.01em", fontSize }}>
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
          color: LAY_COLOR,
        }}
      >
        {/* « lay » à peine plus grand que « Mind ». */}
        <span className="mb-script" style={{ fontSize: fontSize * 1.06, lineHeight: 1 }}>
          lay
        </span>
        {/* Trait « brush » sous le mot (même violet). */}
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
