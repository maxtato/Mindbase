export type Workspace = "personal" | "professional";

export const workspaceTheme = {
  personal: {
    accent: "var(--mb-personal-accent)",
    accentHover: "var(--mb-personal-accent-hover)",
    accentBg: "var(--mb-personal-accent-bg)",
    accentText: "var(--mb-personal-accent-text)",
    accentSoft: "var(--mb-personal-accent-soft)",
    accentBorder: "var(--mb-personal-accent-border)",
    // Couleurs solides pour les éléments à l'intérieur des blocs colorés
    solidDark: "var(--mb-personal-solid-dark)",
    solidMid: "var(--mb-personal-solid-mid)",
    label: "Personnel",
    initial: "P",
    gradient: "var(--mb-personal-gradient)",
  },
  professional: {
    accent: "var(--mb-professional-accent)",
    accentHover: "var(--mb-professional-accent-hover)",
    accentBg: "var(--mb-professional-accent-bg)",
    accentText: "var(--mb-professional-accent-text)",
    accentSoft: "var(--mb-professional-accent-soft)",
    accentBorder: "var(--mb-professional-accent-border)",
    solidDark: "var(--mb-professional-solid-dark)",
    solidMid: "var(--mb-professional-solid-mid)",
    label: "Pro",
    initial: "W",
    gradient: "var(--mb-professional-gradient)",
  },
} as const;

export function getWorkspace(param?: string | null): Workspace {
  return param === "professional" ? "professional" : "personal";
}

export function buildWorkspaceUrl(
  pathname: string,
  workspace: Workspace,
  params?: Record<string, string>
): string {
  const sp = new URLSearchParams({ workspace, ...params });
  return `${pathname}?${sp.toString()}`;
}
