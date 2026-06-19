"use server";

import { cookies } from "next/headers";
import { ENV_COOKIE, getCustomEnvironments, normalizeEnvColor } from "@/lib/environment-store";

const WORKSPACE_COOKIE = "mindbase-workspace";
const ONE_YEAR = 60 * 60 * 24 * 365;

// Crée un nouvel environnement personnalisé (nom + couleur). On NE bascule PAS
// dessus : il est vide, l'utilisateur garde sa vue (et ses projets) actuelle.
export async function createEnvironmentAction(input: { name: string; color: string }): Promise<{ id: string }> {
  const name = (input.name ?? "").trim().slice(0, 40);
  const color = normalizeEnvColor(input.color);
  if (!name) throw new Error("Le nom de l'environnement est requis.");

  const existing = await getCustomEnvironments();
  const id = `env_${crypto.randomUUID().slice(0, 8)}`;
  const next = [...existing, { id, name, color }];

  const store = await cookies();
  store.set(ENV_COOKIE, JSON.stringify(next), { path: "/", maxAge: ONE_YEAR, sameSite: "lax" });
  // Volontairement, on ne touche PAS au cookie WORKSPACE_COOKIE : l'environnement
  // actif reste celui sur lequel l'utilisateur était (ses projets restent
  // visibles). Le nouvel environnement est juste disponible dans le sélecteur.

  return { id };
}

// Renomme et/ou recolore un environnement personnalisé.
export async function updateEnvironmentAction(input: { id: string; name?: string; color?: string }): Promise<void> {
  if (!input.id.startsWith("env_")) return;
  const existing = await getCustomEnvironments();
  const next = existing.map((e) =>
    e.id === input.id
      ? {
          ...e,
          name: input.name !== undefined ? (input.name.trim().slice(0, 40) || e.name) : e.name,
          color: input.color !== undefined ? normalizeEnvColor(input.color) : e.color,
        }
      : e,
  );
  const store = await cookies();
  store.set(ENV_COOKIE, JSON.stringify(next), { path: "/", maxAge: ONE_YEAR, sameSite: "lax" });
}

// Supprime un environnement personnalisé. (Les projets qui y étaient rattachés
// ne sont pas supprimés ; ils restent accessibles via la vue « Tous ».)
export async function deleteEnvironmentAction(id: string): Promise<void> {
  if (!id.startsWith("env_")) return;
  const existing = await getCustomEnvironments();
  const next = existing.filter((e) => e.id !== id);
  const store = await cookies();
  store.set(ENV_COOKIE, JSON.stringify(next), { path: "/", maxAge: ONE_YEAR, sameSite: "lax" });
  // Si on supprime l'environnement courant, on revient sur "personal".
  if (store.get(WORKSPACE_COOKIE)?.value === id) {
    store.set(WORKSPACE_COOKIE, "personal", { path: "/", maxAge: ONE_YEAR, sameSite: "lax" });
  }
}
