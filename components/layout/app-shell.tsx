import { cookies } from "next/headers";
import { Sidebar } from "./sidebar";
import { MobileBottomNav } from "./mobile-bottom-nav";
import { CommandPalette } from "@/components/search/command-palette";
import { EnvironmentsProvider } from "@/components/environments/environments-provider";
import { ViewportLock } from "@/components/layout/viewport-lock";
import { surface } from "@/lib/design-tokens";
import { getSidebarStatsByWorkspace } from "@/lib/project-store";
import { getCustomEnvironments } from "@/lib/environment-store";
import { getWorkspace, registerCustomEnvironments } from "@/lib/workspace";

// Padding-bottom mobile retiré du wrapper : la bottom nav (position:fixed)
// flotte au-dessus du contenu. Les pages s'auto-padent via une règle CSS
// globale pour ne pas masquer leurs derniers items derrière la nav.
// IMPORTANT : Sidebar et MobileBottomNav lisent le workspace via
// window.location au lieu de useSearchParams — ainsi aucun Suspense boundary
// n'est introduit au niveau du shell (qui, en streaming SSR + iOS Safari,
// rendait tout le contenu de la page dans un <div hidden>). Pour que la
// couleur active soit correcte AU PREMIER RENDU (et pas après hydration),
// on injecte le workspace lu via le cookie côté server.

interface AppShellProps {
  children: React.ReactNode;
  accountName?: string;
}

export async function AppShell({ children, accountName }: AppShellProps) {
  const environments = await getCustomEnvironments();
  // Enregistre les thèmes custom côté serveur AVANT le rendu des enfants
  // (sinon les pages serveur résoudraient un thème par défaut pour un env
  // personnalisé → flash + mismatch d'hydratation).
  registerCustomEnvironments(environments);
  const sidebarStats = await getSidebarStatsByWorkspace(environments.map((e) => e.id));
  const cookieStore = await cookies();
  const initialWorkspace = getWorkspace(cookieStore.get("mindbase-workspace")?.value);

  return (
    <EnvironmentsProvider initial={environments}>
    <ViewportLock />
    <div
      className="flex overflow-hidden"
      style={{
        background: surface.bg,
        // position:fixed + inset:0 SANS height explicite : l'élément s'étire de
        // top:0 à bottom:0 = toute la zone visible (PWA iPhone), donc la bottom
        // nav touche vraiment le bas. (Mettre height:100dvh annulait bottom:0 et
        // laissait une marge sous la barre.)
        position: "fixed",
        inset: 0,
      }}
    >
      {/* Sidebar — masquée < sm via Tailwind, plus de Suspense boundary.
          On lui passe initialWorkspace pour que les liens SSR pointent
          déjà vers le bon workspace, sans dépendre de l'hydratation. */}
      <Sidebar stats={sidebarStats} initialWorkspace={initialWorkspace} accountName={accountName} />

      {/* Main area — on réserve la safe-area haute de l'iPhone (horloge /
          batterie / Dynamic Island) UNE seule fois ici, pour toutes les pages
          de l'app : aucun contenu ne démarre sous le bandeau d'état iOS. */}
      <div
        className="flex flex-col flex-1 min-w-0 overflow-hidden"
        style={{ paddingTop: "env(safe-area-inset-top, 0px)" }}
      >
        <div className="flex flex-1 min-h-0 flex-col overflow-hidden">{children}</div>

        {/* Bottom nav mobile — DANS le flux (et non position:fixed) : elle est
            le dernier enfant de la colonne haute de 100dvh, donc toujours
            collée au bas de la zone visible. Cela évite le bug iOS où une nav
            `position:fixed; bottom:0` se cale au-dessus de la barre du
            navigateur au chargement puis « saute » en bas au premier scroll. */}
        <MobileBottomNav initialWorkspace={initialWorkspace} />
      </div>

      {/* Palette de recherche globale (⌘K ou bouton loupe topbar). Rendue une
          fois au niveau du shell → disponible sur toutes les pages. */}
      <CommandPalette initialWorkspace={initialWorkspace} />
    </div>
    </EnvironmentsProvider>
  );
}
