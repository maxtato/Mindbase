import type { CSSProperties } from "react";

// Wordmark « Flatmind » : « Flat » en League Spartan + « mind » en script
// Pacifico, avec un trait souligné effilé sous « mind ». Monochrome : tout
// hérite de `color` (donc même teinte que le contexte).
export function FlatmindWordmark({
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
        Flat
      </span>
      {/* « mind » : script Pacifico, aligné sur la ligne de base de « Flat ».
          Marge négative pour compenser l'approche gauche de Pacifico : l'espace
          « t » → « m » devient équivalent à l'espace entre les lettres. */}
      <span
        style={{
          position: "relative",
          display: "inline-block",
          marginLeft: fontSize * -0.05,
          paddingRight: fontSize * 0.16,
          // Descend « mind » de quelques pixels (proportionnel à la taille).
          top: fontSize * 0.08,
        }}
      >
        <span className="mb-script" style={{ fontSize: fontSize * 0.93, lineHeight: 1 }}>
          mind
        </span>
        {/* Trait « brush » sous « mind » (même teinte) : fin et détaché. */}
        <svg
          aria-hidden
          viewBox="0 0 120 18"
          preserveAspectRatio="none"
          style={{
            position: "absolute",
            left: "-3%",
            bottom: -fontSize * 0.28,
            width: "110%",
            height: fontSize * 0.2,
            overflow: "visible",
          }}
        >
          <path d="M3 10 C 40 2, 84 3, 117 7 C 82 10, 44 11, 6 15 Z" fill="currentColor" />
        </svg>
      </span>
    </span>
  );
}
