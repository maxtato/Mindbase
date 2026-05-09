"use client";

// Filtres pour les vues Kanban / Calendrier transversales.
// Trois pills : Projet, Étape (visible seulement quand un projet est sélectionné),
// Statut (optionnel — masqué pour le calendrier).

import { useRouter } from "next/navigation";
import type { TaskStatus } from "@/lib/mock-data";
import type { ProjectPriority } from "@/lib/project-taxonomy";
import { workspaceTheme, type Workspace } from "@/lib/workspace";
import { FilterPill, FilterPillGroup, type FilterPillOption } from "@/components/ui/filter-pill";

type StatusFilter = "open" | "all" | TaskStatus;
type PriorityFilter = "all" | ProjectPriority;

interface ProjectOption {
  id: string;
  name: string;
}

interface StepOption {
  id: string;
  title: string;
}

interface BoardFilterControlsProps {
  basePath: "/dashboard/kanban" | "/dashboard/calendar";
  workspace: Workspace;
  projects: ProjectOption[];
  steps: StepOption[];
  projectId: string;
  stepId: string;
  statusFilter?: StatusFilter;
  /** Si fourni, le pill Statut est affiché. */
  showStatus?: boolean;
  priorityFilter?: PriorityFilter;
  showPriority?: boolean;
  month?: string;
}

const STATUS_FILTERS: FilterPillOption<StatusFilter>[] = [
  { value: "open", label: "Ouvertes" },
  { value: "todo", label: "À faire", dot: "var(--mb-status-gray-text)" },
  { value: "in_progress", label: "En cours", dot: "var(--mb-status-yellow-text)" },
  { value: "waiting", label: "En attente", dot: "var(--mb-status-blue-text)" },
  { value: "blocked", label: "Bloquées", dot: "var(--mb-status-red-text)" },
  { value: "done", label: "Terminées", dot: "var(--mb-status-green-text)" },
  { value: "all", label: "Toutes" },
];

const PRIORITY_FILTERS: FilterPillOption<PriorityFilter>[] = [
  { value: "all", label: "Toutes" },
  { value: "high", label: "Haute", dot: "var(--mb-status-red-text)" },
  { value: "medium", label: "Moyenne", dot: "var(--mb-status-yellow-text)" },
  { value: "low", label: "Basse", dot: "var(--mb-status-green-text)" },
];

export function BoardFilterControls({
  basePath,
  workspace,
  projects,
  steps,
  projectId,
  stepId,
  statusFilter = "open",
  showStatus = false,
  priorityFilter = "all",
  showPriority = false,
  month,
}: BoardFilterControlsProps) {
  const router = useRouter();
  const theme = workspaceTheme[workspace];

  const projectOptions: FilterPillOption<string>[] = [
    { value: "all", label: "Tous les projets" },
    ...projects.map((project) => ({ value: project.id, label: project.name })),
  ];

  const stepOptions: FilterPillOption<string>[] = [
    { value: "all", label: "Toutes les étapes" },
    ...steps.map((step) => ({ value: step.id, label: step.title })),
  ];

  function navigate(next: { projectId?: string; stepId?: string; statusFilter?: StatusFilter; priorityFilter?: PriorityFilter }) {
    const nextProjectId = next.projectId ?? projectId;
    const nextStepId = nextProjectId !== projectId ? "all" : next.stepId ?? stepId;
    const nextStatus = next.statusFilter ?? statusFilter;
    const nextPriority = next.priorityFilter ?? priorityFilter;

    const params = new URLSearchParams({ workspace });
    if (nextProjectId !== "all") params.set("project", nextProjectId);
    if (nextStepId !== "all") params.set("step", nextStepId);
    if (showStatus && nextStatus !== "open") params.set("status", nextStatus);
    if (showPriority && nextPriority !== "all") params.set("priority", nextPriority);
    if (month) params.set("month", month);
    router.push(`${basePath}?${params.toString()}`);
  }

  return (
    <FilterPillGroup>
      <FilterPill
        label="Projet"
        value={projectId}
        options={projectOptions}
        onChange={(nextProjectId) => navigate({ projectId: nextProjectId })}
        accentColor={theme.accent}
        active={projectId !== "all"}
        minWidth={180}
      />
      {projectId !== "all" && steps.length > 0 && (
        <FilterPill
          label="Étape"
          value={stepId}
          options={stepOptions}
          onChange={(nextStepId) => navigate({ stepId: nextStepId })}
          accentColor={theme.accent}
          active={stepId !== "all"}
          minWidth={170}
        />
      )}
      {showStatus && (
        <FilterPill
          label="Statut"
          value={statusFilter}
          options={STATUS_FILTERS}
          onChange={(nextStatus) => navigate({ statusFilter: nextStatus })}
          accentColor={theme.accent}
          active={statusFilter !== "open"}
        />
      )}
      {showPriority && (
        <FilterPill
          label="Priorité"
          value={priorityFilter}
          options={PRIORITY_FILTERS}
          onChange={(nextPriority) => navigate({ priorityFilter: nextPriority })}
          accentColor={theme.accent}
          active={priorityFilter !== "all"}
          minWidth={142}
        />
      )}
    </FilterPillGroup>
  );
}
