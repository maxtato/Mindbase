import type { CSSProperties } from "react";
import type { Workspace as WorkspaceType } from "@/lib/workspace";

export type SurfaceTone = "primary" | "secondary" | "accent";
export type FieldTone = "dark" | "light" | "accent";
export type ButtonTone = "workspace" | "accent" | "inverse" | "surface";

export const designTokens = {
  colors: {
    canvas: "#08080F",
    header: "#10101A",
    sidebar: "#0D0D16",
    surface: "#141420",
    surfaceSecondary: "#1C1C2A",
    surfaceHover: "#242437",
    borderSubtle: "#2A2A3E",
    borderStrong: "#3A3A52",
    textStrong: "#F7F7FB",
    textMuted: "#AEAEC1",
    textSoft: "#808097",
    textInverse: "#111118",
    accentSoft: "#C084FC",
    personalStrong: "#7C3AED",
    personalEnd: "#7C3AED",
    personalSoft: "#D8B4FE",
    personalBorder: "#9A67FF",
    professionalStrong: "#2563EB",
    professionalEnd: "#2563EB",
    professionalSoft: "#BFDBFE",
    professionalBorder: "#5C97FF",
    dangerBg: "#3A1820",
    dangerText: "#FECACA",
    dangerBorder: "#6B2330",
  },
  radii: {
    panel: "32px",
    inner: "24px",
    pill: "999px",
  },
  shadows: {
    surface: "0 14px 30px rgba(0, 0, 0, 0.28)",
    inner: "0 8px 22px rgba(0, 0, 0, 0.18)",
    accent: "0 16px 28px rgba(0, 0, 0, 0.22)",
    panel: "0 16px 32px rgba(0, 0, 0, 0.24)",
    button: "0 8px 18px rgba(0, 0, 0, 0.22)",
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
      color: designTokens.colors.textStrong,
      border: `1px solid ${designTokens.colors.personalBorder}`,
      boxShadow: designTokens.shadows.button,
    } satisfies CSSProperties,
    pillStyle: {
      background: designTokens.colors.surfaceSecondary,
      color: "#F4E7FF",
      border: `1px solid ${designTokens.colors.personalBorder}`,
    } satisfies CSSProperties,
    softTextStyle: {
      color: "#D8B5FF",
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
      color: designTokens.colors.textStrong,
      border: `1px solid ${designTokens.colors.professionalBorder}`,
      boxShadow: designTokens.shadows.button,
    } satisfies CSSProperties,
    pillStyle: {
      background: designTokens.colors.surfaceSecondary,
      color: "#E4F0FF",
      border: `1px solid ${designTokens.colors.professionalBorder}`,
    } satisfies CSSProperties,
    softTextStyle: {
      color: "#B8D8FF",
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
    background: "#F7F7F7",
    color: designTokens.colors.textInverse,
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
