import { BoardFilterControls } from "@/components/tasks/board-filter-controls";
import { TasksKanbanBoard } from "@/components/tasks/tasks-kanban-board";
import { Topbar } from "@/components/layout/topbar";
import { surface, text } from "@/lib/design-tokens";
import type { Task, TaskStatus } from "@/lib/mock-data";
import { flattenProjectTasks } from "@/lib/project-insights";
import { getProjectsForWorkspace } from "@/lib/project-store";
import { getDisplayStepTitle } from "@/lib/project-display";
import { deriveTaskStatus } from "@/lib/project-plan";
import { getWorkspace } from "@/lib/workspace";
import { getProfile } from "@/lib/account-store";

type StatusFilter = "open" | "all" | TaskStatus;
type OwnerFilter = "all" | "mine";

export default async function KanbanPage({
  searchParams,
}: {
  searchParams: Promise<{ workspace?: string; project?: string; step?: string; status?: string; owner?: string }>;
}) {
  const sp = await searchParams;
  const workspace = getWorkspace(sp.workspace);
  const statusFilter = parseStatusFilter(sp.status);
  const ownerFilter: OwnerFilter = sp.owner === "mine" ? "mine" : "all";
  const me = (await getProfile()).name;
  const projects = (await getProjectsForWorkspace(workspace)).filter(
    (project) => project.status !== "archived" && !project.deleted,
  );

  const selectedProjectId =
    typeof sp.project === "string" && projects.some((project) => project.id === sp.project)
      ? sp.project
      : "all";
  const selectedProject = projects.find((project) => project.id === selectedProjectId);
  const projectSteps = selectedProject?.steps ?? [];
  const selectedStepId =
    typeof sp.step === "string" && projectSteps.some((step) => step.id === sp.step)
      ? sp.step
      : "all";

  const allTasks = projects.flatMap((project) =>
    flattenProjectTasks(project).map((entry) => ({ project, entry })),
  );
  const scopedTasks = allTasks
    .filter(({ project }) => selectedProjectId === "all" || project.id === selectedProjectId)
    .filter(({ entry }) => selectedStepId === "all" || entry.stepId === selectedStepId)
    .filter(({ entry }) => matchStatusFilter(deriveTaskStatus(entry.task), statusFilter))
    .filter(({ entry }) => ownerFilter === "all" || taskBelongsToUser(entry.task, me));

  return (
    <div className="flex h-full flex-col overflow-hidden">
      <Topbar title="Kanban" workspace={workspace} />

      <main className="mb-page-scroll mb-mobile-scroll flex-1 overflow-y-auto px-3 py-5 lg:px-4">
        <div className="flex w-full flex-col gap-4">
          <BoardFilterControls
            basePath="/dashboard/kanban"
            workspace={workspace}
            projects={projects.map((project) => ({ id: project.id, name: project.name }))}
            steps={projectSteps.map((step) => ({ id: step.id, title: getDisplayStepTitle(step.title) }))}
            projectId={selectedProjectId}
            stepId={selectedStepId}
            statusFilter={statusFilter}
            showStatus
            ownerFilter={ownerFilter}
            showOwner
          />

          {scopedTasks.length === 0 ? (
            <EmptyState />
          ) : (
            <TasksKanbanBoard tasks={scopedTasks} workspace={workspace} />
          )}
        </div>
      </main>
    </div>
  );
}

function EmptyState() {
  return (
    <section className="mb-soft-shadow rounded-[26px] p-10 text-center" style={{ background: surface.s1 }}>
      <p className="text-sm font-semibold" style={{ color: text.primary }}>
        Aucune tâche dans ce périmètre
      </p>
      <p className="mt-1 text-xs" style={{ color: text.muted }}>
        Élargis le filtre projet ou étape pour voir des tâches.
      </p>
    </section>
  );
}

function parseStatusFilter(value: string | undefined): StatusFilter {
  if (
    value === "all" ||
    value === "todo" ||
    value === "in_progress" ||
    value === "waiting" ||
    value === "blocked" ||
    value === "done"
  ) {
    return value;
  }
  return "open";
}

function matchStatusFilter(status: TaskStatus, filter: StatusFilter) {
  if (filter === "all") return true;
  if (filter === "open") return status !== "done";
  return status === filter;
}

// Match "mes tâches" : owner direct ou présent dans assignees.
// Comparaison sur le prénom pour tolérer "Maxime T." vs "Maxime".
function taskBelongsToUser(task: Task, me: string) {
  const meKey = me.trim().toLowerCase().split(" ")[0];
  if (!meKey) return false;
  const matches = (name: string | undefined) => {
    if (!name) return false;
    const key = name.trim().toLowerCase();
    return key === me.toLowerCase() || key.split(" ")[0] === meKey;
  };
  if (matches(task.owner)) return true;
  return (task.assignees ?? []).some((name) => matches(name));
}
