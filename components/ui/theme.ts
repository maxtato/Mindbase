import type { CSSProperties } from "react";
import type { Workspace as WorkspaceType } from "@/lib/workspace";

export type SurfaceTone = "primary" | "secondary" | "accent";
export type FieldTone = "dark" | "light" | "accent";
export type ButtonTone = "workspace" | "accent" | "inverse" | "surface";

export const designTokens = {
  colors: {
    canvas: "#f4efe6",
    header: "#fbf7f0",
    sidebar: "#fbf7f1",
    surface: "#ffffff",
    surfaceSecondary: "#faf5ec",
    surfaceHover: "#f3ecdf",
    borderSubtle: "#ece3d4",
    borderStrong: "#d9cdb9",
    textStrong: "#2c2622",
    textMuted: "#6b5f52",
    textSoft: "#978876",
    textInverse: "#ffffff",
    accentSoft: "#8b5cf6",
    personalStrong: "#8b5cf6",
    personalEnd: "#7c3aed",
    personalSoft: "#6d28d9",
    personalBorder: "#cbb6f7",
    professionalStrong: "#3b82f6",
    professionalEnd: "#2563eb",
    professionalSoft: "#1d4ed8",
    professionalBorder: "#aacbf8",
    dangerBg: "#fdeef0",
    dangerText: "#be123c",
    dangerBorder: "#f6cdd4",
  },
  radii: {
    panel: "32px",
    inner: "24px",
    pill: "999px",
  },
  shadows: {
    surface: "0 14px 34px rgba(60, 45, 95, 0.10)",
    inner: "0 6px 18px rgba(60, 45, 95, 0.06)",
    accent: "0 16px 30px rgba(124, 58, 237, 0.18)",
    panel: "0 16px 36px rgba(60, 45, 95, 0.12)",
    button: "0 8px 20px rgba(124, 58, 237, 0.20)",
  },
} as const;

const workspaceThemes = {
  personal: {
    label: "Perso",
    panelClassName: "mb-workspace-panel mb-workspace-panel--personal",
    buttonClassName: "mb-button mb-theme-button--personal",
    pillClassName: "mb-pill mb-theme-pill--personal",
    softTextClassName: "mb-theme-text--personal",
    panelStyle: {
      background: designTokens.colors.surface,
      border: `1px solid ${designTokens.colors.personalBorder}`,
      boxShadow: designTokens.shadows.surface,
      color: designTokens.colors.textStrong,
    } satisfies CSSProperties,
    buttonStyle: {
      background: designTokens.colors.personalStrong,
      color: "#ffffff",
      border: `1px solid ${designTokens.colors.personalBorder}`,
      boxShadow: designTokens.shadows.button,
    } satisfies CSSProperties,
    pillStyle: {
      background: "#f0e9ff",
      color: "#6d28d9",
      border: `1px solid ${designTokens.colors.personalBorder}`,
    } satisfies CSSProperties,
    softTextStyle: {
      color: "#7c3aed",
    } satisfies CSSProperties,
    ruleStyle: {
      background: `linear-gradient(135deg, ${designTokens.colors.accentSoft} 0%, ${designTokens.colors.personalStrong} 100%)`,
    } satisfies CSSProperties,
    navStyle: {
      background: designTokens.colors.surfaceSecondary,
      color: designTokens.colors.textStrong,
      border: `1px solid ${designTokens.colors.personalBorder}`,
      boxShadow: designTokens.shadows.inner,
    } satisfies CSSProperties,
    navDotStyle: {
      background: designTokens.colors.personalStrong,
    } satisfies CSSProperties,
  },
  professional: {
    label: "Pro",
    panelClassName: "mb-workspace-panel mb-workspace-panel--professional",
    buttonClassName: "mb-button mb-theme-button--professional",
    pillClassName: "mb-pill mb-theme-pill--professional",
    softTextClassName: "mb-theme-text--professional",
    panelStyle: {
      background: designTokens.colors.surface,
      border: `1px solid ${designTokens.colors.professionalBorder}`,
      boxShadow: designTokens.shadows.surface,
      color: designTokens.colors.textStrong,
    } satisfies CSSProperties,
    buttonStyle: {
      background: designTokens.colors.professionalStrong,
      color: "#ffffff",
      border: `1px solid ${designTokens.colors.professionalBorder}`,
      boxShadow: designTokens.shadows.button,
    } satisfies CSSProperties,
    pillStyle: {
      background: "#e6f0ff",
      color: "#1d4ed8",
      border: `1px solid ${designTokens.colors.professionalBorder}`,
    } satisfies CSSProperties,
    softTextStyle: {
      color: "#2563eb",
    } satisfies CSSProperties,
    ruleStyle: {
      background: `linear-gradient(135deg, ${designTokens.colors.accentSoft} 0%, ${designTokens.colors.professionalStrong} 100%)`,
    } satisfies CSSProperties,
    navStyle: {
      background: designTokens.colors.surfaceSecondary,
      color: designTokens.colors.textStrong,
      border: `1px solid ${designTokens.colors.professionalBorder}`,
      boxShadow: designTokens.shadows.inner,
    } satisfies CSSProperties,
    navDotStyle: {
      background: designTokens.colors.professionalStrong,
    } satisfies CSSProperties,
  },
} satisfies Record<
  WorkspaceType,
  {
    label: string;
    panelClassName: string;
    buttonClassName: string;
    pillClassName: string;
    softTextClassName: string;
    panelStyle: CSSProperties;
    buttonStyle: CSSProperties;
    pillStyle: CSSProperties;
    softTextStyle: CSSProperties;
    ruleStyle: CSSProperties;
    navStyle: CSSProperties;
    navDotStyle: CSSProperties;
  }
>;

const surfaceToneClasses: Record<SurfaceTone, string> = {
  primary: "mb-surface",
  secondary: "mb-surface-secondary",
  accent: "mb-accent-surface",
};

const fieldToneClasses: Record<FieldTone, string> = {
  dark: "mb-input mb-input--dark",
  light: "mb-input mb-input--light",
  accent: "mb-input mb-input--accent",
};

const buttonToneClasses: Record<Exclude<ButtonTone, "workspace">, string> = {
  accent: "mb-button mb-button--accent",
  inverse: "mb-button mb-button--inverse",
  surface: "mb-button mb-button--surface",
};

const surfaceToneStyles: Record<SurfaceTone, CSSProperties> = {
  primary: {
    background: designTokens.colors.surface,
    border: `1px solid ${designTokens.colors.borderSubtle}`,
    boxShadow: designTokens.shadows.surface,
  },
  secondary: {
    background: designTokens.colors.surfaceSecondary,
    border: `1px solid ${designTokens.colors.borderSubtle}`,
    boxShadow: designTokens.shadows.inner,
  },
  accent: {
    background: designTokens.colors.accentSoft,
    color: designTokens.colors.textInverse,
    border: "1px solid #A869F0",
    boxShadow: designTokens.shadows.accent,
  },
};

const fieldToneStyles: Record<FieldTone, CSSProperties> = {
  dark: {
    background: designTokens.colors.surfaceSecondary,
    color: designTokens.colors.textStrong,
    border: `1px solid ${designTokens.colors.borderSubtle}`,
  },
  light: {
    background: "#fffdf8",
    color: designTokens.colors.textStrong,
    border: `1px solid ${designTokens.colors.borderSubtle}`,
  },
  accent: {
    background: designTokens.colors.accentSoft,
    color: designTokens.colors.textInverse,
    border: `1px solid ${designTokens.colors.borderSubtle}`,
  },
};

const buttonToneStyles: Record<Exclude<ButtonTone, "workspace">, CSSProperties> = {
  accent: {
    background: designTokens.colors.accentSoft,
    color: designTokens.colors.textInverse,
    border: "1px solid #A869F0",
    boxShadow: designTokens.shadows.button,
  },
  inverse: {
    background: designTokens.colors.header,
    color: designTokens.colors.textStrong,
    border: `1px solid ${designTokens.colors.borderSubtle}`,
    boxShadow: designTokens.shadows.button,
  },
  surface: {
    background: designTokens.colors.surfaceSecondary,
    color: designTokens.colors.textStrong,
    border: `1px solid ${designTokens.colors.borderSubtle}`,
    boxShadow: designTokens.shadows.button,
  },
};

export const textStyles = {
  strong: { color: designTokens.colors.textStrong } satisfies CSSProperties,
  muted: { color: designTokens.colors.textMuted } satisfies CSSProperties,
  soft: { color: designTokens.colors.textSoft } satisfies CSSProperties,
  inverse: { color: designTokens.colors.textInverse } satisfies CSSProperties,
  accent: { color: designTokens.colors.accentSoft } satisfies CSSProperties,
};

export const decorativeStyles = {
  gradientText: {
    background: `linear-gradient(135deg, ${designTokens.colors.personalStrong} 0%, ${designTokens.colors.professionalStrong} 100%)`,
    WebkitBackgroundClip: "text",
    backgroundClip: "text",
    color: "transparent",
  } satisfies CSSProperties,
  gradientRule: {
    background: `linear-gradient(135deg, ${designTokens.colors.personalStrong} 0%, ${designTokens.colors.professionalStrong} 100%)`,
  } satisfies CSSProperties,
};

export const chromeStyles = {
  header: {
    background: designTokens.colors.header,
    borderBottom: `1px solid ${designTokens.colors.borderSubtle}`,
  } satisfies CSSProperties,
  sidebar: {
    background: designTokens.colors.sidebar,
    borderRight: `1px solid ${designTokens.colors.borderSubtle}`,
  } satisfies CSSProperties,
};

export type WorkspaceTheme = (typeof workspaceThemes)[WorkspaceType];

export function cx(...values: Array<string | false | null | undefined>) {
  return values.filter(Boolean).join(" ");
}

export function mergeStyles(
  ...styles: Array<CSSProperties | undefined | null | false>
) {
  return Object.assign({}, ...styles.filter(Boolean));
}

export function getWorkspaceTheme(workspace: WorkspaceType): WorkspaceTheme {
  return workspaceThemes[workspace];
}

export function getSurfaceToneClass(tone: SurfaceTone) {
  return surfaceToneClasses[tone];
}

export function getSurfaceToneStyle(tone: SurfaceTone) {
  return surfaceToneStyles[tone];
}

export function getFieldToneClass(tone: FieldTone) {
  return fieldToneClasses[tone];
}

export function getFieldToneStyle(tone: FieldTone) {
  return fieldToneStyles[tone];
}

export function getButtonToneClass(
  tone: ButtonTone,
  workspace: WorkspaceType = "personal"
) {
  if (tone === "workspace") {
    return workspaceThemes[workspace].buttonClassName;
  }

  return buttonToneClasses[tone];
}

export function getButtonToneStyle(
  tone: ButtonTone,
  workspace: WorkspaceType = "personal"
) {
  if (tone === "workspace") {
    return workspaceThemes[workspace].buttonStyle;
  }

  return buttonToneStyles[tone];
}
