"use client";

// Button unifié — un seul composant pour toute l'app, 4 variantes × 3 tailles.
// Inspiration : Linear / Asana — boutons calmes, hover subtil, focus ring net.

import { forwardRef, type ButtonHTMLAttributes, type CSSProperties, type ReactNode } from "react";
import { fontWeight, motion, radius, surface, text, statusColor } from "@/lib/design-tokens";

export type ButtonVariant = "primary" | "secondary" | "ghost" | "destructive";
export type ButtonSize = "sm" | "md" | "lg";

interface ButtonProps extends Omit<ButtonHTMLAttributes<HTMLButtonElement>, "color"> {
  variant?: ButtonVariant;
  size?: ButtonSize;
  /** Couleur d'accent du bouton primaire (sinon utilise text-primary). */
  accentColor?: string;
  /** Icône à gauche du label. */
  leadingIcon?: ReactNode;
  /** Icône à droite du label. */
  trailingIcon?: ReactNode;
  /** Bouton plein largeur. */
  fullWidth?: boolean;
}

const SIZE: Record<ButtonSize, { padX: number; padY: number; fontSize: string; height: number }> = {
  sm: { padX: 10, padY: 5, fontSize: "12px", height: 28 },
  md: { padX: 14, padY: 8, fontSize: "13px", height: 36 },
  lg: { padX: 20, padY: 11, fontSize: "14px", height: 44 },
};

export const Button = forwardRef<HTMLButtonElement, ButtonProps>(function Button(
  {
    variant = "secondary",
    size = "md",
    accentColor,
    leadingIcon,
    trailingIcon,
    fullWidth,
    children,
    className,
    style,
    disabled,
    ...rest
  },
  ref,
) {
  const sz = SIZE[size];

  const baseStyle: CSSProperties = {
    display: "inline-flex",
    alignItems: "center",
    justifyContent: "center",
    gap: "0.5em",
    height: sz.height,
    padding: `${sz.padY}px ${sz.padX}px`,
    fontSize: sz.fontSize,
    fontWeight: fontWeight.semibold,
    lineHeight: 1.2,
    borderRadius: radius.md,
    border: "1px solid transparent",
    cursor: disabled ? "not-allowed" : "pointer",
    width: fullWidth ? "100%" : undefined,
    transition: `background-color ${motion.durationFast} ${motion.ease}, border-color ${motion.durationFast} ${motion.ease}, color ${motion.durationFast} ${motion.ease}, transform ${motion.durationFast} ${motion.ease}`,
    opacity: disabled ? 0.5 : 1,
    whiteSpace: "nowrap",
    userSelect: "none",
    ...style,
  };

  const variantStyle = (() => {
    if (variant === "primary") {
      const accent = accentColor ?? text.primary;
      return {
        // Dégradé vertical très subtil (haut légèrement plus clair) → reflet
        // premium, en complément du gloss/relief CSS de .mb-button-primary.
        background: `linear-gradient(180deg, color-mix(in srgb, ${accent} 90%, #ffffff 10%) 0%, ${accent} 100%)`,
        color: surface.onColor,
        border: `1px solid ${accent}`,
      } satisfies CSSProperties;
    }
    if (variant === "secondary") {
      return {
        background: surface.s2,
        color: text.primary,
        border: `1px solid ${surface.border}`,
      } satisfies CSSProperties;
    }
    if (variant === "ghost") {
      return {
        background: "transparent",
        color: text.secondary,
        border: "1px solid transparent",
      } satisfies CSSProperties;
    }
    // destructive
    return {
      background: statusColor.red.bg,
      color: statusColor.red.text,
      border: `1px solid ${statusColor.red.text}33`,
    } satisfies CSSProperties;
  })();

  return (
    <button
      ref={ref}
      type={rest.type ?? "button"}
      disabled={disabled}
      className={`mb-button mb-button-${variant} ${className ?? ""}`.trim()}
      style={{ ...baseStyle, ...variantStyle }}
      {...rest}
    >
      {leadingIcon ? <span className="mb-button-icon" aria-hidden="true">{leadingIcon}</span> : null}
      {children}
      {trailingIcon ? <span className="mb-button-icon" aria-hidden="true">{trailingIcon}</span> : null}
    </button>
  );
});
