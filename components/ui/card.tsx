// Card unifiée — 1 padding standard, 1 radius standard, 1 shadow standard.
// Variantes minimales : level (surface) + padding scale + interactive (hover state).

import type { CSSProperties, ReactNode } from "react";
import { fontWeight, radius, shadow, surface, text } from "@/lib/design-tokens";

type CardLevel = "s1" | "s2" | "s3" | "s4";
type CardPadding = "none" | "sm" | "md" | "lg";

interface CardProps {
  children: ReactNode;
  className?: string;
  level?: CardLevel;
  padding?: CardPadding;
  /** Accent ligne haute (subtile) pour donner du volume sans shadow agressive. */
  highlight?: boolean;
  /** Card cliquable : hover state + cursor. */
  interactive?: boolean;
  /** Retire le shadow xs par défaut. */
  flat?: boolean;
  onClick?: () => void;
  style?: CSSProperties;
}

const PADDINGS: Record<CardPadding, string> = {
  none: "0",
  sm: "12px",
  md: "16px",
  lg: "20px",
};

export function Card({
  children,
  className = "",
  level = "s1",
  padding = "md",
  highlight = false,
  interactive = false,
  flat = false,
  onClick,
  style,
}: CardProps) {
  return (
    <div
      onClick={onClick}
      className={`mb-card ${interactive ? "mb-card-interactive" : ""} ${className}`.trim()}
      style={{
        background: surface[level],
        border: `1px solid ${surface.borderSubtle}`,
        borderRadius: radius.lg,
        padding: PADDINGS[padding],
        boxShadow: flat ? "none" : shadow.xs,
        cursor: interactive || onClick ? "pointer" : undefined,
        position: "relative",
        ...(highlight && {
          borderTopColor: surface.topHighlight,
        }),
        ...style,
      }}
    >
      {children}
    </div>
  );
}

interface CardHeaderProps {
  title: string;
  description?: string;
  action?: ReactNode;
  /** Décale le header vers le haut pour une carte sans padding (header collé). */
  inset?: boolean;
}

export function CardHeader({ title, description, action, inset = false }: CardHeaderProps) {
  return (
    <div
      className="mb-card-header"
      style={{
        display: "flex",
        alignItems: description ? "flex-start" : "center",
        justifyContent: "space-between",
        gap: 12,
        marginBottom: inset ? 0 : 12,
      }}
    >
      <div style={{ minWidth: 0 }}>
        <h3
          style={{
            fontSize: "13px",
            fontWeight: fontWeight.semibold,
            color: text.primary,
            margin: 0,
            lineHeight: 1.3,
          }}
        >
          {title}
        </h3>
        {description ? (
          <p
            style={{
              fontSize: "11px",
              color: text.muted,
              margin: "2px 0 0",
              lineHeight: 1.4,
            }}
          >
            {description}
          </p>
        ) : null}
      </div>
      {action ? <div style={{ flexShrink: 0 }}>{action}</div> : null}
    </div>
  );
}
