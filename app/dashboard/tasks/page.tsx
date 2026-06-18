import { Topbar } from "@/components/layout/topbar";
import { StandaloneTasksView } from "@/components/tasks/standalone-tasks-view";
import { getStandaloneTasksForWorkspace } from "@/lib/standalone-tasks-store";
import { getWorkspace } from "@/lib/workspace";
import { syncEnvironmentThemes } from "@/lib/environment-store";
import { getServerT } from "@/lib/i18n/server";

export default async function TasksPage({
  searchParams,
}: {
  searchParams: Promise<{ workspace?: string }>;
}) {
  const sp = await searchParams;
  await syncEnvironmentThemes();
  const workspace = getWorkspace(sp.workspace);
  const { t } = await getServerT();
  // Tri : à faire d'abord (par date d'échéance puis création), terminées en bas.
  const tasks = (await getStandaloneTasksForWorkspace(workspace)).slice().sort((a, b) => {
    if (a.done !== b.done) return a.done ? 1 : -1;
    const da = a.dueDate ?? "9999-12-31";
    const db = b.dueDate ?? "9999-12-31";
    if (da !== db) return da.localeCompare(db);
    return b.createdAt.localeCompare(a.createdAt);
  });

  return (
    <div className="flex h-full flex-col overflow-hidden">
      <Topbar title={t("nav.tasks")} workspace={workspace} subtitle={t("tasks.subtitle")} />

      <main className="mb-page-scroll mb-mobile-scroll flex-1 overflow-y-auto px-4 py-6 lg:px-6">
        <StandaloneTasksView tasks={tasks} workspace={workspace} />
      </main>
    </div>
  );
}
