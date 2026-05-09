// Badge unifié — pill moderne, padding tight, font-weight medium (pas bold).
// 7 variantes alignées sur les couleurs sémantiques + workspace.
// Compat avec l'ancienne API (variant + statusKey/severityKey/decisionKey).

import type { CSSProperties, ReactNode } from "react";
import { decision, fontWeight, mauve, radius, severity, status, statusColor, surface, text } from "@/lib/design-tokens";
import type { StatusKey } from "@/lib/design-tokens";
import type { Workspace } from "@/lib/workspace";
import { workspaceTheme } from "@/lib/workspace";

type BadgeVariant =
  | "status"
  | "severity"
  | "decision"
  | "mauve"
  | "workspace"
  | "outline"
  | "neutral"
  | "onColor";

type BadgeSize = "xs" | "sm" | "md";

interface BadgeProps {
  children: ReactNode;
  variant?: BadgeVariant;
  size?: BadgeSize;
  statusKey?: StatusKey;
  severityKey?: keyof typeof severity;
  decisionKey?: keyof typeof decision;
  workspace?: Workspace;
  /** Pastille colorée à gauche du label. */
  dot?: boolean;
  /** Couleur custom de la pastille (sinon dérivée de la variante). */
  dotColor?: string;
  className?: string;
  style?: CSSProperties;
}

const SIZES: Record<BadgeSize, { padX: number; padY: number; fontSize: string; dotSize: number }> = {
  xs: { padX: 6, padY: 1, fontSize: "10px", dotSize: 5 },
  sm: { padX: 8, padY: 2, fontSize: "11px", dotSize: 6 },
  md: { padX: 10, padY: 3, fontSize: "12px", dotSize: 7 },
};

export function Badge({
  children,
  variant = "neutral",
  size = "sm",
  statusKey,
  severityKey,
  decisionKey,
  workspace,
  dot = false,
  dotColor,
  className,
  style,
}: BadgeProps) {
  const sz = SIZES[size];
  const palette = resolvePalette(variant, { statusKey, severityKey, decisionKey, workspace });

  const finalStyle: CSSProperties = {
    background: palette.bg,
    color: palette.color,
    border: palette.border ?? "1px solid transparent",
    fontSize: sz.fontSize,
    fontWeight: fontWeight.medium,
    padding: `${sz.padY}px ${sz.padX}px`,
    borderRadius: radius.pill,
    lineHeight: 1.2,
    ...style,
  };

  return (
    <span className={`mb-badge ${className ?? ""}`.trim()} style={finalStyle}>
      {dot ? (
        <span
          aria-hidden="true"
          style={{
            display: "inline-block",
            width: sz.dotSize,
            height: sz.dotSize,
            borderRadius: "50%",
            background: dotColor ?? palette.color,
            flexShrink: 0,
          }}
        />
      ) : null}
      {children}
    </span>
  );
}

interface PaletteCtx {
  statusKey?: StatusKey;
  severityKey?: keyof typeof severity;
  decisionKey?: keyof typeof decision;
  workspace?: Workspace;
}

function resolvePalette(
  variant: BadgeVariant,
  ctx: PaletteCtx,
): { bg: string; color: string; border?: string } {
  if (variant === "status" && ctx.statusKey) {
    return { bg: status[ctx.statusKey].bg, color: status[ctx.statusKey].text };
  }
  if (variant === "severity" && ctx.severityKey) {
    return { bg: severity[ctx.severityKey].bg, color: severity[ctx.severityKey].text };
  }
  if (variant === "decision" && ctx.decisionKey) {
    return { bg: decision[ctx.decisionKey].bg, color: decision[ctx.decisionKey].text };
  }
  if (variant === "mauve") {
    return { bg: mauve.bg, color: mauve.text };
  }
  if (variant === "workspace" && ctx.workspace) {
    const theme = workspaceTheme[ctx.workspace];
    return { bg: theme.accentBg, color: theme.accentText };
  }
  if (variant === "outline") {
    return { bg: "transparent", color: text.muted, border: `1px solid ${surface.border}` };
  }
  if (variant === "onColor") {
    return {
      bg: surface.metricIconBg,
      color: ctx.statusKey ? status[ctx.statusKey].text : surface.metricIconColor,
    };
  }
  // neutral default
  return { bg: statusColor.gray.bg, color: text.secondary };
}

export const statusLabels: Record<StatusKey, string> = {
  preparing: "À préparer",
  active: "En cours",
  paused: "En pause",
  "on-hold": "En pause",
  completed: "Terminé",
  archived: "Archivé",
};

export const severityLabels = {
  high: "Haut",
  medium: "Moyen",
  low: "Faible",
} as const;

export const decisionLabels = {
  decided: "Validée",
  pending: "En attente",
  revisiting: "À revoir",
} as const;
