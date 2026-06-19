import Link from "next/link";
import { Topbar } from "@/components/layout/topbar";
import { ProjectsGrid } from "@/components/projects/projects-grid";
import { NewProjectFab } from "@/components/projects/new-project-fab";
import { getProjectsForWorkspace } from "@/lib/project-store";
import { getWorkspace, workspaceTheme } from "@/lib/workspace";
import { syncEnvironmentThemes } from "@/lib/environment-store";
import { getServerT } from "@/lib/i18n/server";

export default async function ProjectsPage({
  searchParams,
}: {
  searchParams: Promise<{ workspace?: string }>;
}) {
  const sp = await searchParams;
  await syncEnvironmentThemes();
  const workspace = getWorkspace(sp.workspace);
  const theme = workspaceTheme[workspace];
  const qs = `workspace=${workspace}`;
  const projects = await getProjectsForWorkspace(workspace);
  const { t } = await getServerT();

  return (
    <div className="flex flex-col h-full overflow-hidden">
      <Topbar
        title={t("nav.projects")}
        workspace={workspace}
        action={
          // Desktop seulement : bouton texte dans le topbar. Sur mobile, le
          // « + » est rendu en FAB fixe (coin bas-droit) plus bas, pour ne plus
          // être collé au logo au centre de la barre.
          <Link
            href={`/dashboard/projects/new?${qs}`}
            aria-label={t("common.newProject")}
            className="hidden items-center gap-1.5 rounded-xl text-xs font-bold whitespace-nowrap sm:flex sm:px-3.5 sm:py-2"
            style={{ background: theme.accent, color: "#fff" }}
          >
            <svg width="12" height="12" viewBox="0 0 16 16" fill="none">
              <path d="M8 3v10M3 8h10" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" />
            </svg>
            <span>{t("common.newProject")}</span>
          </Link>
        }
      />

      <div className="mb-page-scroll mb-mobile-scroll mx-auto w-full max-w-[1100px] flex-1 overflow-y-auto px-4 py-6 lg:px-8">
        <ProjectsGrid projects={projects} workspace={workspace} qs={qs} />
      </div>

      {/* Mobile : bouton flottant « Nouveau projet », coin bas-droit. */}
      <NewProjectFab
        href={`/dashboard/projects/new?${qs}`}
        label={t("common.newProject")}
        accent={theme.accent}
      />
    </div>
  );
}
