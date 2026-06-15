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
      <span className="mb-wordmark-mind" style={{ fontWeight: 800, letterSpacing: "-0.02em", fontSize }}>
        Mind
      </span>
      <span
        style={{
          position: "relative",
          display: "inline-block",
          marginLeft: fontSize * 0.06,
          paddingRight: fontSize * 0.18,
          color: LAY_COLOR,
        }}
      >
        {/* « lay » un peu plus grand que « Mind ». */}
        <span className="mb-script" style={{ fontSize: fontSize * 1.35, lineHeight: 1 }}>
          lay
        </span>
        {/* Trait « brush » sous le mot (même violet), abaissé. */}
        <svg
          aria-hidden
          viewBox="0 0 120 18"
          preserveAspectRatio="none"
          style={{
            position: "absolute",
            left: "-4%",
            bottom: -fontSize * 0.3,
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
