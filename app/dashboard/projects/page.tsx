import Link from "next/link";
import { Topbar } from "@/components/layout/topbar";
import { ProjectsGrid } from "@/components/projects/projects-grid";
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
          <Link
            href={`/dashboard/projects/new?${qs}`}
            aria-label={t("common.newProject")}
            className="flex items-center gap-1.5 rounded-xl text-xs font-bold whitespace-nowrap px-2 py-2 sm:px-3.5"
            style={{ background: theme.accent, color: "#fff" }}
          >
            <svg width="12" height="12" viewBox="0 0 16 16" fill="none">
              <path d="M8 3v10M3 8h10" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" />
            </svg>
            <span className="hidden sm:inline">{t("common.newProject")}</span>
          </Link>
        }
      />

      <div className="mb-page-scroll mb-mobile-scroll flex-1 overflow-y-auto px-8 py-6 max-w-[1100px] mx-auto w-full">
        <ProjectsGrid projects={projects} workspace={workspace} qs={qs} />
      </div>
    </div>
  );
}
