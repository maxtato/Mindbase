import { BoardFilterControls } from "@/components/tasks/board-filter-controls";
import { BoardFilterPersistence } from "@/components/tasks/board-filter-persistence";
import { TasksKanbanBoard } from "@/components/tasks/tasks-kanban-board";
import { Topbar } from "@/components/layout/topbar";
import { surface, text } from "@/lib/design-tokens";
import type { TaskStatus } from "@/lib/mock-data";
import { flattenProjectTasks } from "@/lib/project-insights";
import { getProjectsForWorkspace } from "@/lib/project-store";
import { getDisplayStepTitle } from "@/lib/project-display";
import { deriveTaskStatus } from "@/lib/project-plan";
import { getWorkspace, listEnvironmentOptions } from "@/lib/workspace";
import { getCustomEnvironments } from "@/lib/environment-store";
import { getProfile } from "@/lib/account-store";
import { getStandaloneTasksForWorkspace } from "@/lib/standalone-tasks-store";
import { standaloneToBoardItem } from "@/lib/standalone-board";
import { getTeamMembers } from "@/lib/team-store";
import { getServerT } from "@/lib/i18n/server";
import {
  collectAssignablePeople,
  isProjectCreator,
  taskVisibleToViewer,
  PERSON_FILTER_ALL,
  PERSON_FILTER_ME,
} from "@/lib/project-access";

type StatusFilter = "open" | "all" | TaskStatus;

export default async function KanbanPage({
  searchParams,
}: {
  searchParams: Promise<{ workspace?: string; env?: string; project?: string; step?: string; status?: string; person?: string }>;
}) {
  const sp = await searchParams;
  const workspace = getWorkspace(sp.workspace);
  const statusFilter = parseStatusFilter(sp.status);
  const me = (await getProfile()).name;
  const { t } = await getServerT();
  const environmentOptions = listEnvironmentOptions(await getCustomEnvironments());
  const envFilter =
    typeof sp.env === "string" && environmentOptions.some((option) => option.value === sp.env)
      ? sp.env
      : "all";
  const allProjects = (await getProjectsForWorkspace(workspace)).filter(
    (project) => project.status !== "archived" && !project.deleted,
  );
  // Restriction à l'environnement choisi (le filtre projet/étape, les
  // personnes et les tâches en découlent).
  const projects =
    envFilter === "all" ? allProjects : allProjects.filter((project) => project.workspace === envFilter);

  const selectedProjectId =
    sp.project === "standalone"
      ? "standalone"
      : typeof sp.project === "string" && projects.some((project) => project.id === sp.project)
        ? sp.project
        : "all";
  const selectedProject = projects.find((project) => project.id === selectedProjectId);
  const projectSteps = selectedProject?.steps ?? [];
  const selectedStepId =
    typeof sp.step === "string" && projectSteps.some((step) => step.id === sp.step)
      ? sp.step
      : "all";

  // Filtre « Personne » : réservé au créateur des projets en vue. On agrège
  // les collaborateurs des projets dont je suis le créateur (selon le projet
  // sélectionné), et on valide la valeur reçue.
  const peopleScopeProjects = (selectedProject ? [selectedProject] : projects).filter((project) =>
    isProjectCreator(project, me),
  );
  const people = collectAssignablePeople(peopleScopeProjects, me);
  const showPerson = peopleScopeProjects.length > 0;
  const personFilter = parsePersonFilter(sp.person, people, showPerson);

  const allTasks = projects.flatMap((project) =>
    flattenProjectTasks(project).map((entry) => ({ project, entry })),
  );
  const scopedTasks = allTasks
    .filter(({ project }) => selectedProjectId === "all" || project.id === selectedProjectId)
    .filter(({ entry }) => selectedStepId === "all" || entry.stepId === selectedStepId)
    .filter(({ entry }) => matchStatusFilter(deriveTaskStatus(entry.task), statusFilter))
    .filter(({ project, entry }) => taskVisibleToViewer(project, entry.task, me, personFilter));

  // Tâches autonomes (hors projet) : affichées seulement en vue « tous les
  // projets » (et tant qu'aucune étape précise n'est filtrée), avec le même
  // filtre d'environnement et de statut.
  const standaloneItems =
    (selectedProjectId === "all" || selectedProjectId === "standalone") && selectedStepId === "all" && personFilter !== PERSON_FILTER_ME
      ? (await getStandaloneTasksForWorkspace(workspace))
          .filter((task) => envFilter === "all" || task.workspace === envFilter)
          .map(standaloneToBoardItem)
          .filter(({ entry }) => matchStatusFilter(deriveTaskStatus(entry.task), statusFilter))
      : [];
  const boardTasks = [...scopedTasks, ...standaloneItems];

  // Vivier d'assignation des tâches libres : membres actifs de l'équipe.
  const standalonePeople = (await getTeamMembers())
    .filter((member) => member.status === "active")
    .map((member) => ({ id: member.id, name: member.name }));

  return (
    <div className="flex h-full flex-col overflow-hidden">
      <Topbar title={t("nav.kanban")} workspace={workspace} />

      <main className="mb-page-scroll mb-mobile-scroll flex-1 overflow-y-auto px-3 py-5 lg:px-4">
        <div className="flex w-full flex-col gap-4">
          <BoardFilterPersistence
            storageKey="mb-filters-kanban"
            basePath="/dashboard/kanban"
            workspace={workspace}
            signature={`${envFilter}|${selectedProjectId}|${selectedStepId}|${statusFilter}|${personFilter}`}
          />
          <BoardFilterControls
            basePath="/dashboard/kanban"
            workspace={workspace}
            envFilter={envFilter}
            environments={environmentOptions}
            projects={projects.map((project) => ({ id: project.id, name: project.name }))}
            steps={projectSteps.map((step) => ({ id: step.id, title: getDisplayStepTitle(step.title) }))}
            projectId={selectedProjectId}
            stepId={selectedStepId}
            statusFilter={statusFilter}
            showStatus
            personFilter={personFilter}
            showPerson={showPerson}
            people={people}
          />

          {boardTasks.length === 0 ? (
            <EmptyState title={t("board.empty.title")} hint={t("board.empty.kanban")} />
          ) : (
            <TasksKanbanBoard tasks={boardTasks} workspace={workspace} standalonePeople={standalonePeople} />
          )}
        </div>
      </main>
    </div>
  );
}

function EmptyState({ title, hint }: { title: string; hint: string }) {
  return (
    <section className="mb-soft-shadow rounded-[26px] p-10 text-center" style={{ background: surface.s1 }}>
      <p className="text-sm font-semibold" style={{ color: text.primary }}>
        {title}
      </p>
      <p className="mt-1 text-xs" style={{ color: text.muted }}>
        {hint}
      </p>
    </section>
  );
}

function parsePersonFilter(value: string | undefined, people: string[], showPerson: boolean): string {
  if (!showPerson || typeof value !== "string") return PERSON_FILTER_ALL;
  if (value === PERSON_FILTER_ALL || value === PERSON_FILTER_ME) return value;
  return people.some((name) => name.toLowerCase() === value.toLowerCase()) ? value : PERSON_FILTER_ALL;
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
