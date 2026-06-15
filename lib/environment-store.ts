import { cookies } from "next/headers";
import type { CustomEnvironment } from "@/lib/workspace";
import { registerCustomEnvironments } from "@/lib/workspace";

// Les environnements personnalisés sont stockés dans un cookie (appli
// mono-compte, lecture synchrone côté serveur ET client). Format : JSON
// [{ id, name, color }].
export const ENV_COOKIE = "mindbase-envs";

export function normalizeEnvColor(value: string | undefined | null): string {
  const v = (value ?? "").trim();
  return /^#[0-9a-fA-F]{6}$/.test(v) ? v.toLowerCase() : "#5e17eb";
}

export function parseEnvironments(raw: string | undefined | null): CustomEnvironment[] {
  if (!raw) return [];
  try {
    const parsed = JSON.parse(raw);
    if (!Array.isArray(parsed)) return [];
    return parsed
      .filter((e) => e && typeof e.id === "string" && typeof e.color === "string")
      .map((e) => ({
        id: String(e.id),
        name: String(e.name ?? "Environnement").slice(0, 40),
        color: normalizeEnvColor(e.color),
      }));
  } catch {
    return [];
  }
}

export async function getCustomEnvironments(): Promise<CustomEnvironment[]> {
  const store = await cookies();
  return parseEnvironments(store.get(ENV_COOKIE)?.value);
}

// À appeler AU DÉBUT de chaque page serveur qui lit `workspaceTheme[workspace]`.
// Enregistre les thèmes custom de façon synchrone dans le rendu de la page,
// AVANT la lecture du thème — fiable même avec le streaming/rendu parallèle de
// Next (où l'enregistrement d'un layout parent ne précède pas toujours la
// lecture par la page enfant → repli violet « Personnel »).
export async function syncEnvironmentThemes(): Promise<CustomEnvironment[]> {
  const envs = await getCustomEnvironments();
  registerCustomEnvironments(envs);
  return envs;
}
