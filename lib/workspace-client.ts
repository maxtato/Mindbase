"use client";

// Diffusion du workspace choisi à toute l'app côté client.
//
// Problème : la sidebar et la bottom nav sont rendues dans le layout (AppShell)
// qui NE re-render PAS lors d'une navigation. Elles suivent donc le workspace
// via un state local. Or changer d'environnement ne modifie que la query
// (?workspace=) sans changer le pathname, et une navigation <Link> ne déclenche
// pas `popstate` → leur state restait bloqué sur l'environnement initial, et
// leurs liens repointaient dessus en changeant de menu.
//
// On évite volontairement `useSearchParams` (qui imposerait un Suspense
// boundary au niveau de l'AppShell et casse les taps sur iOS Safari en SSR
// streaming). À la place, le switcher émet un évènement que la sidebar et la
// bottom nav écoutent pour se resynchroniser immédiatement.

export const WORKSPACE_EVENT = "mb:workspace";

export function broadcastWorkspace(workspace: string) {
  if (typeof window === "undefined") return;
  document.cookie = `mindbase-workspace=${workspace}; path=/; max-age=${60 * 60 * 24 * 365}; SameSite=Lax`;
  window.dispatchEvent(new CustomEvent(WORKSPACE_EVENT, { detail: workspace }));
}
