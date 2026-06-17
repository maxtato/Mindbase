// Environnements ("workspaces"). Deux sont intégrés (personal / professional) ;
// l'utilisateur peut en créer d'autres, personnalisés, avec leur propre couleur.
// `Workspace` est donc un identifiant libre (string) : "personal",
// "professional", ou un id custom "env_xxxx".
export type Workspace = string;

export interface WorkspaceTheme {
  accent: string;
  accentHover: string;
  accentBg: string;
  accentText: string;
  accentSoft: string;
  accentBorder: string;
  solidDark: string;
  solidMid: string;
  label: string;
  initial: string;
  gradient: string;
}

export interface CustomEnvironment {
  id: string;
  name: string;
  color: string;
}

export const BUILTIN_WORKSPACES = ["personal", "professional"] as const;
export type BuiltinWorkspace = (typeof BUILTIN_WORKSPACES)[number];

// Vue agrégée : tous les environnements à la fois.
export const ALL_WORKSPACE = "all";

const builtinTheme: Record<BuiltinWorkspace, WorkspaceTheme> = {
  personal: {
    accent: "var(--mb-personal-accent)",
    accentHover: "var(--mb-personal-accent-hover)",
    accentBg: "var(--mb-personal-accent-bg)",
    accentText: "var(--mb-personal-accent-text)",
    accentSoft: "var(--mb-personal-accent-soft)",
    accentBorder: "var(--mb-personal-accent-border)",
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
};

// Construit un thème complet à partir d'une seule couleur (environnements
// personnalisés). On dérive les variantes via color-mix (supporté iOS 16.2+,
// déjà utilisé ailleurs dans l'app).
export function themeFromColor(color: string, name: string): WorkspaceTheme {
  const c = color;
  return {
    accent: c,
    accentHover: `color-mix(in srgb, ${c} 85%, #000)`,
    accentBg: `color-mix(in srgb, ${c} 12%, transparent)`,
    accentText: `color-mix(in srgb, ${c} 80%, #000)`,
    accentSoft: `color-mix(in srgb, ${c} 16%, transparent)`,
    accentBorder: `color-mix(in srgb, ${c} 38%, transparent)`,
    solidDark: `color-mix(in srgb, ${c} 86%, #000)`,
    solidMid: c,
    label: name,
    initial: (name.trim().charAt(0) || "E").toUpperCase(),
    gradient: `linear-gradient(135deg, ${c}, color-mix(in srgb, ${c} 62%, #000))`,
  };
}

// Couleur UNIQUE des environnements : le violet (thème "personal"). Quel que
// soit l'environnement (Perso, Pro, custom, « Tous »), on garde la même couleur
// violette — seuls le NOM et l'initiale varient. Décision produit : un seul
// accent pour toute l'app, la couleur ne dépend plus de l'environnement.
function violetThemeWith(label: string, initial: string): WorkspaceTheme {
  return { ...builtinTheme.personal, label, initial };
}

// Registre des environnements custom (id -> thème violet + libellé). Alimenté
// au rendu (SSR + client) par EnvironmentsProvider, pour que
// `workspaceTheme[id]` résolve partout.
const customThemes = new Map<string, WorkspaceTheme>();

export function registerCustomEnvironments(envs: CustomEnvironment[]) {
  customThemes.clear();
  for (const e of envs) {
    if (e && typeof e.id === "string") {
      const name = e.name || "Environnement";
      customThemes.set(e.id, violetThemeWith(name, (name.trim().charAt(0) || "E").toUpperCase()));
    }
  }
}

export function resolveWorkspaceTheme(workspace: string): WorkspaceTheme {
  if (workspace === "personal") return builtinTheme.personal;
  if (workspace === "professional") return violetThemeWith("Pro", "W");
  if (workspace === ALL_WORKSPACE) return violetThemeWith("Tous", "T");
  return customThemes.get(workspace) ?? builtinTheme.personal;
}

// Accès dynamique : conserve l'API historique `workspaceTheme[workspace]`
// (utilisée dans ~30 composants) tout en résolvant les environnements custom.
export const workspaceTheme: Record<string, WorkspaceTheme> = new Proxy(
  {} as Record<string, WorkspaceTheme>,
  {
    get: (_target, prop) => resolveWorkspaceTheme(String(prop)),
    has: () => true,
  },
);

export function isBuiltinWorkspace(workspace: string): workspace is BuiltinWorkspace {
  return workspace === "personal" || workspace === "professional";
}

// Liste des environnements assignables/filtrables : les deux intégrés
// (Personnel, Pro) suivis des environnements personnalisés. Sert à la fois au
// filtre « Environnement » des vues et au déplacement d'un projet d'un
// environnement à un autre.
export interface EnvironmentOption {
  value: Workspace;
  label: string;
}

export function listEnvironmentOptions(custom: CustomEnvironment[]): EnvironmentOption[] {
  return [
    { value: "personal", label: "Personnel" },
    { value: "professional", label: "Pro" },
    ...custom
      .filter((env) => env && typeof env.id === "string")
      .map((env) => ({ value: env.id, label: env.name || "Environnement" })),
  ];
}

export function getWorkspace(param?: string | null): Workspace {
  const v = typeof param === "string" ? param.trim() : "";
  return v.length > 0 ? v : "personal";
}

export function buildWorkspaceUrl(
  pathname: string,
  workspace: Workspace,
  params?: Record<string, string>
): string {
  const sp = new URLSearchParams({ workspace, ...params });
  return `${pathname}?${sp.toString()}`;
}
