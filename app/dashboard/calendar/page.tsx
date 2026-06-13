import { BoardFilterControls } from "@/components/tasks/board-filter-controls";
import { TasksCalendarBoard } from "@/components/tasks/tasks-calendar-board";
import { Topbar } from "@/components/layout/topbar";
import { surface, text } from "@/lib/design-tokens";
import { flattenProjectTasks } from "@/lib/project-insights";
import { getProjectsForWorkspace } from "@/lib/project-store";
import { getDisplayStepTitle } from "@/lib/project-display";
import { deriveTaskDisplayPriority, deriveTaskStatus } from "@/lib/project-plan";
import type { ProjectPriority } from "@/lib/project-taxonomy";
import type { Task, TaskStatus } from "@/lib/mock-data";
import { getWorkspace } from "@/lib/workspace";
import { getActiveAccountName } from "@/lib/current-account";

type StatusFilter = "open" | "all" | TaskStatus;
type PriorityFilter = "all" | ProjectPriority;
type OwnerFilter = "all" | "mine";

export default async function CalendarPage({
  searchParams,
}: {
  searchParams: Promise<{ workspace?: string; project?: string; step?: string; month?: string; status?: string; priority?: string; owner?: string }>;
}) {
  const sp = await searchParams;
  const workspace = getWorkspace(sp.workspace);
  const monthStart = parseMonth(sp.month);
  const monthParam = formatMonthParam(monthStart);
  const statusFilter = parseStatusFilter(sp.status);
  const priorityFilter = parsePriorityFilter(sp.priority);
  const ownerFilter: OwnerFilter = sp.owner === "mine" ? "mine" : "all";
  const me = getActiveAccountName();

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
    .filter(({ entry }) => priorityFilter === "all" || deriveTaskDisplayPriority(entry.task) === priorityFilter)
    .filter(({ entry }) => ownerFilter === "all" || taskBelongsToUser(entry.task, me));

  return (
    <div className="flex h-full flex-col overflow-hidden">
      <Topbar title="Calendrier" workspace={workspace} />

      <main className="mb-page-scroll mb-mobile-scroll flex-1 overflow-y-auto px-3 py-4 lg:px-4 xl:overflow-hidden">
        <div className="flex w-full flex-col gap-3 xl:h-full xl:min-h-0">
          <BoardFilterControls
            basePath="/dashboard/calendar"
            workspace={workspace}
            projects={projects.map((project) => ({ id: project.id, name: project.name }))}
            steps={projectSteps.map((step) => ({ id: step.id, title: getDisplayStepTitle(step.title) }))}
            projectId={selectedProjectId}
            stepId={selectedStepId}
            statusFilter={statusFilter}
            showStatus
            priorityFilter={priorityFilter}
            showPriority
            ownerFilter={ownerFilter}
            showOwner
            month={monthParam}
          />

          {scopedTasks.length === 0 ? (
            <EmptyState />
          ) : (
            <TasksCalendarBoard
              tasks={scopedTasks}
              workspace={workspace}
              view="calendar"
              sort="due"
              statusFilter={statusFilter}
              priorityFilter={priorityFilter}
              month={monthParam}
              projectId={selectedProjectId}
              stepId={selectedStepId}
              basePath="/dashboard/calendar"
            />
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
        Élargis le filtre projet ou étape pour voir des échéances.
      </p>
    </section>
  );
}

function parseMonth(value: string | undefined) {
  if (!value || !/^\d{4}-\d{2}$/.test(value)) return startOfMonth(new Date());
  const [year, month] = value.split("-").map(Number);
  if (!year || !month || month < 1 || month > 12) return startOfMonth(new Date());
  return new Date(year, month - 1, 1);
}

function startOfMonth(date: Date) {
  return new Date(date.getFullYear(), date.getMonth(), 1);
}

function formatMonthParam(date: Date) {
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, "0")}`;
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

function parsePriorityFilter(value: string | undefined): PriorityFilter {
  if (value === "low" || value === "medium" || value === "high") return value;
  return "all";
}

function matchStatusFilter(status: TaskStatus, filter: StatusFilter) {
  if (filter === "all") return true;
  if (filter === "open") return status !== "done";
  return status === filter;
}

// Match "mes tâches" : owner direct ou présent dans assignees (prénom-base).
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
