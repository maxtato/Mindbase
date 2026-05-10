import { cookies } from "next/headers";
import { Sidebar } from "./sidebar";
import { MobileBottomNav } from "./mobile-bottom-nav";
import { surface } from "@/lib/design-tokens";
import { getSidebarStatsByWorkspace } from "@/lib/project-store";
import { getWorkspace } from "@/lib/workspace";

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
}

export async function AppShell({ children }: AppShellProps) {
  const sidebarStats = await getSidebarStatsByWorkspace();
  const cookieStore = await cookies();
  const initialWorkspace = getWorkspace(cookieStore.get("mindbase-workspace")?.value);

  return (
    <div className="flex h-full overflow-hidden" style={{ background: surface.bg }}>
      {/* Sidebar — masquée < sm via Tailwind, plus de Suspense boundary.
          On lui passe initialWorkspace pour que les liens SSR pointent
          déjà vers le bon workspace, sans dépendre de l'hydratation. */}
      <Sidebar stats={sidebarStats} initialWorkspace={initialWorkspace} />

      {/* Main area */}
      <div className="flex flex-col flex-1 min-w-0 overflow-hidden">
        {children}
      </div>

      {/* Bottom nav mobile — rendu direct sans Suspense pour assurer la
          présence de tous les handlers tactiles dès le premier paint.
          On lui donne le workspace initial pour que la couleur active
          soit correcte dès le SSR (sinon flash violet→bleu en pro). */}
      <MobileBottomNav initialWorkspace={initialWorkspace} />
    </div>
  );
}
