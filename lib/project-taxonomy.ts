import type { Workspace } from "@/lib/workspace";

export const PROJECT_TYPE_OPTIONS = [
  {
    value: "ponctuel",
    label: "Ponctuel",
    helper: "Un projet borné avec une fin claire.",
  },
  {
    value: "recurrent",
    label: "Récurrent",
    helper: "Un flux ou rituel à piloter dans le temps.",
  },
  {
    value: "exploration",
    label: "Exploration",
    helper: "Un sujet à clarifier avant décision.",
  },
  {
    value: "decision",
    label: "Décision",
    helper: "Un cadrage pour arbitrer rapidement.",
  },
  {
    value: "execution",
    label: "Exécution",
    helper: "Un chantier à faire avancer concrètement.",
  },
] as const;

export type ProjectType = (typeof PROJECT_TYPE_OPTIONS)[number]["value"];

export const PROJECT_PRIORITY_OPTIONS = [
  { value: "low", label: "Faible" },
  { value: "medium", label: "Moyenne" },
  { value: "high", label: "Haute" },
] as const;

export type ProjectPriority = (typeof PROJECT_PRIORITY_OPTIONS)[number]["value"];

export type ProjectCategoryIconKey =
  | "target"
  | "briefcase"
  | "megaphone"
  | "settings"
  | "gear"
  | "wallet"
  | "layers"
  | "users"
  | "clipboard"
  | "document"
  | "house"
  | "heart"
  | "spark"
  | "music"
  | "gamepad"
  | "plane"
  | "car"
  | "palette"
  | "asterisk";

export interface ProjectSubcategoryOption {
  key: string;
  label: string;
  color: string;
  icon: ProjectCategoryIconKey;
}

export const CUSTOM_SUBCATEGORY_DEFAULT_COLOR = "#9CA3AF";

export const subcategoriesByWorkspace = {
  professional: [
    { key: "strategie", label: "Stratégie", color: "#4C7EFF", icon: "target" },
    { key: "commercial", label: "Commercial", color: "#38BDF8", icon: "briefcase" },
    { key: "marketing", label: "Marketing", color: "#A855F7", icon: "megaphone" },
    { key: "operations", label: "Opérations", color: "#34D399", icon: "gear" },
    { key: "finance", label: "Finance", color: "#F59E0B", icon: "wallet" },
    { key: "produit", label: "Produit", color: "#6366F1", icon: "layers" },
    { key: "rh", label: "RH", color: "#EC4899", icon: "users" },
    { key: "administratif", label: "Administratif", color: "#0D9488", icon: "document" },
    { key: "other", label: "Autre", color: CUSTOM_SUBCATEGORY_DEFAULT_COLOR, icon: "asterisk" },
  ],
  personal: [
    { key: "maison", label: "Maison", color: "#8B5CF6", icon: "house" },
    { key: "finances", label: "Finances", color: "#10B981", icon: "wallet" },
    { key: "sante", label: "Santé", color: "#FB7185", icon: "heart" },
    { key: "famille", label: "Famille", color: "#F472B6", icon: "users" },
    { key: "loisirs", label: "Loisirs", color: "#F97316", icon: "gamepad" },
    { key: "voyage", label: "Voyage", color: "#0EA5E9", icon: "plane" },
    { key: "vehicules", label: "Véhicules", color: "#3B82F6", icon: "car" },
    { key: "creatif", label: "Créatif", color: "#C084FC", icon: "palette" },
    { key: "administratif", label: "Administratif", color: "#0D9488", icon: "document" },
    { key: "other", label: "Autre", color: CUSTOM_SUBCATEGORY_DEFAULT_COLOR, icon: "asterisk" },
  ],
} as const satisfies Record<Workspace, readonly ProjectSubcategoryOption[]>;

export type ProjectSubcategoryKey =
  | (typeof subcategoriesByWorkspace)["professional"][number]["key"]
  | (typeof subcategoriesByWorkspace)["personal"][number]["key"];

export const priorityVisuals = {
  low: {
    label: "Faible",
    bg: "var(--mb-status-gray-bg)",
    border: "var(--mb-status-gray-text)",
    text: "var(--mb-status-gray-text)",
  },
  medium: {
    label: "Moyenne",
    bg: "var(--mb-status-blue-bg)",
    border: "var(--mb-status-blue-text)",
    text: "var(--mb-status-blue-text)",
  },
  high: {
    label: "Haute",
    bg: "var(--mb-status-red-bg)",
    border: "var(--mb-status-red-text)",
    text: "var(--mb-status-red-text)",
  },
} as const satisfies Record<ProjectPriority, { label: string; bg: string; border: string; text: string }>;

const projectTypeLabels = Object.fromEntries(
  PROJECT_TYPE_OPTIONS.map((option) => [option.value, option.label]),
) as Record<ProjectType, string>;

const standardSubcategoryKeys = new Set<string>(
  Object.values(subcategoriesByWorkspace).flatMap((options) => options.map((option) => option.key)),
);

function normalizeHexChannel(value: string) {
  return value.length === 1 ? `${value}${value}` : value;
}

export function normalizeHexColor(value: string | null | undefined, fallback: string) {
  if (typeof value !== "string") {
    return fallback.toUpperCase();
  }

  const trimmed = value.trim();
  const short = trimmed.match(/^#([0-9a-fA-F]{3})$/);
  if (short) {
    const [, channels] = short;
    return `#${channels
      .split("")
      .map((channel) => normalizeHexChannel(channel))
      .join("")
      .toUpperCase()}`;
  }

  const full = trimmed.match(/^#([0-9a-fA-F]{6})$/);
  if (full) {
    return `#${full[1].toUpperCase()}`;
  }

  return fallback.toUpperCase();
}

export function getSubcategoryOptions(workspace: Workspace) {
  // Les environnements personnalisés (et tout id inconnu) réutilisent le jeu de
  // sous-catégories "personal" par défaut.
  return subcategoriesByWorkspace[workspace as "personal" | "professional"] ?? subcategoriesByWorkspace.personal;
}

export function getSubcategoryOption(workspace: Workspace, key: string) {
  return getSubcategoryOptions(workspace).find((option) => option.key === key);
}

export function isCustomSubcategorySelection(value: string | null | undefined) {
  return value === "other";
}

export function isStandardSubcategoryKey(value: string | null | undefined): value is ProjectSubcategoryKey {
  return typeof value === "string" && standardSubcategoryKeys.has(value);
}

export function getProjectTypeLabel(type: ProjectType) {
  return projectTypeLabels[type];
}

export function getProjectPriorityLabel(priority: ProjectPriority) {
  return priorityVisuals[priority].label;
}

export interface ProjectTaxonomyDisplayInput {
  workspace: Workspace;
  subcategory: string;
  subcategoryColor: string;
  isCustomSubcategory?: boolean;
  customSubcategoryLabel?: string | null;
  customSubcategoryColor?: string | null;
}

export function resolveProjectSubcategoryDisplay(input: ProjectTaxonomyDisplayInput) {
  const fallback = getSubcategoryOption(input.workspace, "other") ?? getSubcategoryOptions(input.workspace)[0];

  if (input.isCustomSubcategory) {
    const label = input.customSubcategoryLabel?.trim() || "Autre";
    const color = normalizeHexColor(input.customSubcategoryColor ?? input.subcategoryColor, fallback.color);
    return {
      key: "other",
      label,
      color,
      icon: fallback.icon,
      isCustom: true,
    };
  }

  const option = getSubcategoryOption(input.workspace, input.subcategory) ?? fallback;
  return {
    key: option.key,
    label: option.label,
    color: normalizeHexColor(input.subcategoryColor, option.color),
    icon: option.icon,
    isCustom: false,
  };
}

export function inferWorkspaceFromLegacyProject(name: string, description: string) {
  const haystack = `${name} ${description}`.toLowerCase();
  const personalHints = ["maison", "famille", "santé", "vehicule", "véhicule", "loisir", "voyage", "road trip", "vacances", "créatif", "creatif"];
  return personalHints.some((hint) => haystack.includes(hint)) ? "personal" : "professional";
}

export function inferSubcategoryFromLegacyProject(workspace: Workspace, name: string, description: string) {
  const haystack = `${name} ${description}`.toLowerCase();

  if (workspace === "professional") {
    if (haystack.includes("marketing") || haystack.includes("campagne") || haystack.includes("ads")) return "marketing";
    if (haystack.includes("infra") || haystack.includes("cloud") || haystack.includes("aws") || haystack.includes("migration")) return "operations";
    if (haystack.includes("produit") || haystack.includes("onboarding")) return "produit";
    if (haystack.includes("finance") || haystack.includes("budget")) return "finance";
    if (haystack.includes("vente") || haystack.includes("commercial")) return "commercial";
    if (haystack.includes("recrutement") || haystack.includes("rh")) return "rh";
    if (haystack.includes("stratégie") || haystack.includes("strategie") || haystack.includes("pricing") || haystack.includes("positionnement")) return "strategie";
    return "administratif";
  }

  if (haystack.includes("maison")) return "maison";
  if (haystack.includes("finance")) return "finances";
  if (haystack.includes("santé") || haystack.includes("sante")) return "sante";
  if (haystack.includes("famille")) return "famille";
  if (haystack.includes("voyage") || haystack.includes("road trip") || haystack.includes("vacances") || haystack.includes("itinéraire") || haystack.includes("itineraire")) return "voyage";
  if (haystack.includes("voiture") || haystack.includes("vehicule") || haystack.includes("véhicule")) return "vehicules";
  if (haystack.includes("créatif") || haystack.includes("creatif") || haystack.includes("design")) return "creatif";
  if (haystack.includes("loisir")) return "loisirs";
  return "administratif";
}

export function inferPriorityFromLegacyProject(hasOpenBlockers: boolean, hasHighPriorityActions: boolean): ProjectPriority {
  if (hasOpenBlockers) return "high";
  if (hasHighPriorityActions) return "high";
  return "medium";
}

export function buildInitialCurrentPriority(priority: ProjectPriority, projectType: ProjectType) {
  if (priority === "high") {
    return "Lancer le premier livrable prioritaire et sécuriser les dépendances clés.";
  }

  if (projectType === "decision") {
    return "Clarifier les options, critères et arbitrages avant de trancher.";
  }

  if (projectType === "exploration") {
    return "Structurer les questions à explorer et les hypothèses à valider.";
  }

  return "Définir le prochain pas concret pour enclencher le projet proprement.";
}

export function buildInitialNextStep(projectType: ProjectType) {
  if (projectType === "decision") {
    return "Documenter les options, les critères de choix et la recommandation.";
  }

  if (projectType === "exploration") {
    return "Lister les inconnues, collecter le contexte utile et définir une première action.";
  }

  if (projectType === "recurrent") {
    return "Définir le rythme, le responsable et la première boucle de suivi.";
  }

  if (projectType === "ponctuel") {
    return "Découper le projet en 3 étapes simples et identifier la première tâche à lancer.";
  }

  return "Créer une première étape pour transformer l'objectif en plan d'exécution.";
}
