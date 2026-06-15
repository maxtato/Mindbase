import { cookies } from "next/headers";
import { Sidebar } from "./sidebar";
import { MobileBottomNav } from "./mobile-bottom-nav";
import { CommandPalette } from "@/components/search/command-palette";
import { EnvironmentsProvider } from "@/components/environments/environments-provider";
import { surface } from "@/lib/design-tokens";
import { getSidebarStatsByWorkspace } from "@/lib/project-store";
import { getCustomEnvironments } from "@/lib/environment-store";
import { getWorkspace, registerCustomEnvironments } from "@/lib/workspace";

// Padding-bottom mobile retiré du wrapper : la bottom nav (position:fixed)
// flotte au-dessus du contenu. Les pages s'auto-padent via une règle CSS
// globale pour ne pas masquer leurs derniers items derrière la nav.
// IMPORTANT : Sidebar et MobileBottomNav lisent le workspace via
// window.location au lieu de useSearchParams — ainsi aucun Suspense boundary
// n'est introduit au niveau du shell.

interface AppShellProps {
  children: React.ReactNode;
  accountName?: string;
}

export async function AppShell({ children, accountName }: AppShellProps) {
  const environments = await getCustomEnvironments();
  // Enregistre les thèmes custom côté serveur avant le rendu des enfants.
  registerCustomEnvironments(environments);
  const sidebarStats = await getSidebarStatsByWorkspace(environments.map((e) => e.id));
  const cookieStore = await cookies();
  const initialWorkspace = getWorkspace(cookieStore.get("mindbase-workspace")?.value);

  return (
    <EnvironmentsProvider initial={environments}>
      <div
        className="flex overflow-hidden"
        style={{ background: surface.bg, height: "100dvh" }}
      >
        {/* Sidebar — masquée < sm via Tailwind. */}
        <Sidebar stats={sidebarStats} initialWorkspace={initialWorkspace} accountName={accountName} />

        {/* Zone principale — on réserve la safe-area haute (Dynamic Island). */}
        <div
          className="flex flex-col flex-1 min-w-0 overflow-hidden"
          style={{ paddingTop: "env(safe-area-inset-top, 0px)" }}
        >
          {children}
        </div>

        {/* Bottom nav mobile — position:fixed, flotte au-dessus du contenu. */}
        <MobileBottomNav initialWorkspace={initialWorkspace} />

        {/* Palette de recherche globale (⌘K). */}
        <CommandPalette initialWorkspace={initialWorkspace} />
      </div>
    </EnvironmentsProvider>
  );
}
