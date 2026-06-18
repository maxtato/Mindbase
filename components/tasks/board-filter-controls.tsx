"use client";

// Filtres pour les vues Kanban / Calendrier transversales.
// Trois pills : Projet, Étape (visible seulement quand un projet est sélectionné),
// Statut (optionnel — masqué pour le calendrier).

import { useRouter } from "next/navigation";
import type { TaskStatus } from "@/lib/mock-data";
import type { ProjectPriority } from "@/lib/project-taxonomy";
import { workspaceTheme, type Workspace } from "@/lib/workspace";
import { FilterPill, FilterPillGroup, type FilterPillOption } from "@/components/ui/filter-pill";
import { PERSON_FILTER_ALL, PERSON_FILTER_ME } from "@/lib/project-access";
import { useT } from "@/components/i18n/locale-provider";

type StatusFilter = "open" | "all" | TaskStatus;
type PriorityFilter = "all" | ProjectPriority;
type OwnerFilter = "all" | "mine";

interface ProjectOption {
  id: string;
  name: string;
}

interface StepOption {
  id: string;
  title: string;
}

interface EnvironmentFilterOption {
  value: string;
  label: string;
}

interface BoardFilterControlsProps {
  basePath: "/dashboard/kanban" | "/dashboard/calendar";
  workspace: Workspace;
  projects: ProjectOption[];
  steps: StepOption[];
  projectId: string;
  stepId: string;
  /** Filtre « Environnement » : restreint les tâches à un environnement.
   *  Options = Personnel / Pro / environnements personnalisés. */
  envFilter?: string;
  environments?: EnvironmentFilterOption[];
  statusFilter?: StatusFilter;
  /** Si fourni, le pill Statut est affiché. */
  showStatus?: boolean;
  priorityFilter?: PriorityFilter;
  showPriority?: boolean;
  ownerFilter?: OwnerFilter;
  showOwner?: boolean;
  /** Filtre « Personne » (réservé au créateur du projet). Valeur = "all",
   *  "__me", ou un nom de personne. `people` liste les collaborateurs
   *  disponibles. Affiché seulement si showPerson. */
  personFilter?: string;
  showPerson?: boolean;
  people?: string[];
  month?: string;
}

export function BoardFilterControls({
  basePath,
  workspace,
  projects,
  steps,
  projectId,
  stepId,
  envFilter = "all",
  environments = [],
  statusFilter = "open",
  showStatus = false,
  priorityFilter = "all",
  showPriority = false,
  ownerFilter = "all",
  showOwner = false,
  personFilter = PERSON_FILTER_ALL,
  showPerson = false,
  people = [],
  month,
}: BoardFilterControlsProps) {
  const router = useRouter();
  const theme = workspaceTheme[workspace];
  const t = useT();

  const STATUS_FILTERS: FilterPillOption<StatusFilter>[] = [
    { value: "open", label: t("filter.taskStatus.open") },
    { value: "todo", label: t("filter.taskStatus.todo"), dot: "var(--mb-status-gray-text)" },
    { value: "in_progress", label: t("filter.taskStatus.inProgress"), dot: "var(--mb-status-yellow-text)" },
    { value: "waiting", label: t("filter.taskStatus.waiting"), dot: "var(--mb-status-blue-text)" },
    { value: "blocked", label: t("filter.taskStatus.blocked"), dot: "var(--mb-status-red-text)" },
    { value: "done", label: t("filter.taskStatus.done"), dot: "var(--mb-status-green-text)" },
    { value: "all", label: t("filter.taskStatus.all") },
  ];
  const PRIORITY_FILTERS: FilterPillOption<PriorityFilter>[] = [
    { value: "all", label: t("filter.priority.all") },
    { value: "high", label: t("filter.priority.high"), dot: "var(--mb-status-red-text)" },
    { value: "medium", label: t("filter.priority.medium"), dot: "var(--mb-status-yellow-text)" },
    { value: "low", label: t("filter.priority.low"), dot: "var(--mb-status-green-text)" },
  ];
  const OWNER_FILTERS: FilterPillOption<OwnerFilter>[] = [
    { value: "all", label: t("filter.owner.all") },
    { value: "mine", label: t("filter.owner.mine") },
  ];

  const personOptions: FilterPillOption<string>[] = [
    { value: PERSON_FILTER_ALL, label: t("filter.person.all") },
    { value: PERSON_FILTER_ME, label: t("filter.person.me") },
    ...people.map((name) => ({ value: name, label: name })),
  ];

  const projectOptions: FilterPillOption<string>[] = [
    { value: "all", label: t("filter.project.all") },
    { value: "standalone", label: t("filter.project.standalone") },
    ...projects.map((project) => ({ value: project.id, label: project.name })),
  ];

  const envOptions: FilterPillOption<string>[] = [
    { value: "all", label: t("filter.project.all") },
    ...environments.map((env) => ({ value: env.value, label: env.label, dot: theme.accent })),
  ];

  const stepOptions: FilterPillOption<string>[] = [
    { value: "all", label: t("filter.step.all") },
    ...steps.map((step) => ({ value: step.id, label: step.title })),
  ];

  function urlFor(next: { envFilter?: string; projectId?: string; stepId?: string; statusFilter?: StatusFilter; priorityFilter?: PriorityFilter; ownerFilter?: OwnerFilter; personFilter?: string }) {
    const nextEnv = next.envFilter ?? envFilter;
    // Changer d'environnement réinitialise le projet/l'étape sélectionnés :
    // ils peuvent ne pas appartenir au nouvel environnement.
    const envChanged = nextEnv !== envFilter;
    const nextProjectId = envChanged ? "all" : next.projectId ?? projectId;
    const nextStepId = envChanged || nextProjectId !== projectId ? "all" : next.stepId ?? stepId;
    const nextStatus = next.statusFilter ?? statusFilter;
    const nextPriority = next.priorityFilter ?? priorityFilter;
    const nextOwner = next.ownerFilter ?? ownerFilter;
    const nextPerson = next.personFilter ?? personFilter;

    const params = new URLSearchParams({ workspace });
    if (nextEnv !== "all") params.set("env", nextEnv);
    if (nextProjectId !== "all") params.set("project", nextProjectId);
    if (nextStepId !== "all") params.set("step", nextStepId);
    if (showStatus && nextStatus !== "open") params.set("status", nextStatus);
    if (showPriority && nextPriority !== "all") params.set("priority", nextPriority);
    if (showOwner && nextOwner !== "all") params.set("owner", nextOwner);
    if (showPerson && nextPerson !== PERSON_FILTER_ALL) params.set("person", nextPerson);
    if (month) params.set("month", month);
    return `${basePath}?${params.toString()}`;
  }

  // Fallback (desktop / sans Link) : navigation programmée. Les pills passent
  // surtout par `buildHref` (ancres natives, fiables sur iOS).
  function navigate(next: Parameters<typeof urlFor>[0]) {
    router.push(urlFor(next));
    router.refresh();
  }

  return (
    <FilterPillGroup>
      {environments.length > 0 && (
        <FilterPill
          label={t("filter.environment")}
          value={envFilter}
          options={envOptions}
          onChange={(nextEnv) => navigate({ envFilter: nextEnv })}
          buildHref={(nextEnv) => urlFor({ envFilter: nextEnv })}
          accentColor={theme.accent}
          active={envFilter !== "all"}
          minWidth={190}
        />
      )}
      <FilterPill
        label={t("filter.project")}
        value={projectId}
        options={projectOptions}
        onChange={(nextProjectId) => navigate({ projectId: nextProjectId })}
        buildHref={(nextProjectId) => urlFor({ projectId: nextProjectId })}
        accentColor={theme.accent}
        active={projectId !== "all"}
        minWidth={180}
      />
      {projectId !== "all" && steps.length > 0 && (
        <FilterPill
          label={t("filter.step")}
          value={stepId}
          options={stepOptions}
          onChange={(nextStepId) => navigate({ stepId: nextStepId })}
          buildHref={(nextStepId) => urlFor({ stepId: nextStepId })}
          accentColor={theme.accent}
          active={stepId !== "all"}
          minWidth={170}
        />
      )}
      {showStatus && (
        <FilterPill
          label={t("filter.status")}
          value={statusFilter}
          options={STATUS_FILTERS}
          onChange={(nextStatus) => navigate({ statusFilter: nextStatus })}
          buildHref={(nextStatus) => urlFor({ statusFilter: nextStatus })}
          accentColor={theme.accent}
          active={statusFilter !== "open"}
        />
      )}
      {showPriority && (
        <FilterPill
          label={t("filter.priority")}
          value={priorityFilter}
          options={PRIORITY_FILTERS}
          onChange={(nextPriority) => navigate({ priorityFilter: nextPriority })}
          buildHref={(nextPriority) => urlFor({ priorityFilter: nextPriority })}
          accentColor={theme.accent}
          active={priorityFilter !== "all"}
          minWidth={142}
        />
      )}
      {/* Filtre Personne (créateur du projet) : prend la place du simple
          « Mes tâches » et permet de cibler n'importe quel collaborateur. */}
      {showPerson ? (
        <FilterPill
          label={t("filter.person")}
          value={personFilter}
          options={personOptions}
          onChange={(nextPerson) => navigate({ personFilter: nextPerson })}
          buildHref={(nextPerson) => urlFor({ personFilter: nextPerson })}
          accentColor={theme.accent}
          active={personFilter !== PERSON_FILTER_ALL}
          minWidth={170}
        />
      ) : (
        showOwner && (
          <FilterPill
            label={t("filter.tasks")}
            value={ownerFilter}
            options={OWNER_FILTERS}
            onChange={(nextOwner) => navigate({ ownerFilter: nextOwner })}
            buildHref={(nextOwner) => urlFor({ ownerFilter: nextOwner })}
            accentColor={theme.accent}
            active={ownerFilter !== "all"}
            minWidth={142}
          />
        )
      )}
    </FilterPillGroup>
  );
}
