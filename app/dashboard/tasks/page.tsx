import { Topbar } from "@/components/layout/topbar";
import { StandaloneTasksView } from "@/components/tasks/standalone-tasks-view";
import { getStandaloneTasksForWorkspace } from "@/lib/standalone-tasks-store";
import { getWorkspace } from "@/lib/workspace";
import { syncEnvironmentThemes } from "@/lib/environment-store";
import { getTeamMembers } from "@/lib/team-store";
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
  // Tri façon liste de tâches : à faire d'abord, classées par échéance (la plus
  // proche en haut, sans date à la fin) puis priorité, puis création ; les
  // tâches terminées en bas (les plus récentes d'abord).
  const priorityRank: Record<string, number> = { high: 0, medium: 1, low: 2 };
  const tasks = (await getStandaloneTasksForWorkspace(workspace)).slice().sort((a, b) => {
    if (a.done !== b.done) return a.done ? 1 : -1;
    if (a.done && b.done) return (b.completedAt ?? b.createdAt).localeCompare(a.completedAt ?? a.createdAt);
    const da = a.dueDate ?? "9999-12-31";
    const db = b.dueDate ?? "9999-12-31";
    if (da !== db) return da.localeCompare(db);
    const pa = priorityRank[a.priority ?? "medium"] ?? 1;
    const pb = priorityRank[b.priority ?? "medium"] ?? 1;
    if (pa !== pb) return pa - pb;
    return b.createdAt.localeCompare(a.createdAt);
  });

  // Vivier d'assignation des tâches libres : membres actifs de l'équipe (il
  // n'y a pas de projet, donc pas de collaborateurs de projet).
  const people = (await getTeamMembers())
    .filter((member) => member.status === "active")
    .map((member) => ({ id: member.id, name: member.name }));

  return (
    <div className="flex h-full flex-col overflow-hidden">
      <Topbar title={t("nav.tasks")} workspace={workspace} />

      <main className="mb-page-scroll mb-mobile-scroll flex-1 overflow-y-auto px-4 py-6 lg:px-6">
        <StandaloneTasksView tasks={tasks} workspace={workspace} people={people} />
      </main>
    </div>
  );
}
