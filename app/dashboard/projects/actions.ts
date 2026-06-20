"use server";

import { refresh, revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { createProject, updateProject } from "@/lib/project-store";
import { getWorkspace, ALL_WORKSPACE } from "@/lib/workspace";
import {
  getSubcategoryOption,
  isCustomSubcategorySelection,
  type ProjectPriority,
  type ProjectType,
} from "@/lib/project-taxonomy";
import { stepStatusLabels, taskStatusLabels } from "@/lib/project-plan";
import type { ProjectStatusSettings, StepStatus, TaskStatus } from "@/lib/mock-data";
import type { CreateProjectFormState } from "./form-state";

const TASK_STATUS_ORDER: TaskStatus[] = ["todo", "in_progress", "waiting", "blocked", "done"];
const STEP_STATUS_ORDER: StepStatus[] = ["todo", "in_progress", "waiting", "done"];

const TASK_STATUS_DEFAULT_COLORS: Record<TaskStatus, string> = {
  todo: "#64748B",
  in_progress: "#F59E0B",
  waiting: "#3B82F6",
  blocked: "#EF4444",
  done: "#22C55E",
};

const STEP_STATUS_DEFAULT_COLORS: Record<StepStatus, string> = {
  todo: "#64748B",
  in_progress: "#F59E0B",
  waiting: "#3B82F6",
  done: "#22C55E",
};

function asText(value: FormDataEntryValue | null) {
  return typeof value === "string" ? value.trim() : "";
}

function asTextList(values: FormDataEntryValue[]) {
  return values.map((value) => (typeof value === "string" ? value.trim() : ""));
}

function readEnabled(value: FormDataEntryValue | null) {
  return value !== "false";
}

function buildStatusSettingsFromFormData(formData: FormData): ProjectStatusSettings {
  const taskExtraLabels = asTextList(formData.getAll("taskStatusExtraLabel"));
  const taskExtraColors = asTextList(formData.getAll("taskStatusExtraColor"));
  const taskExtraSystemStatuses = asTextList(formData.getAll("taskStatusExtraSystemStatus"));
  const stepExtraLabels = asTextList(formData.getAll("stepStatusExtraLabel"));
  const stepExtraColors = asTextList(formData.getAll("stepStatusExtraColor"));
  const stepExtraSystemStatuses = asTextList(formData.getAll("stepStatusExtraSystemStatus"));
  const customTask: NonNullable<ProjectStatusSettings["customTask"]> = [];
  const customStep: NonNullable<ProjectStatusSettings["customStep"]> = [];

  taskExtraLabels.forEach((label, index) => {
    const systemStatus = taskExtraSystemStatuses[index];
    if (!label || !TASK_STATUS_ORDER.includes(systemStatus as TaskStatus)) return;
    const status = systemStatus as TaskStatus;
    customTask.push({
      id: `task-extra-${index + 1}`,
      systemStatus: status,
      label,
      color: taskExtraColors[index] || TASK_STATUS_DEFAULT_COLORS[status],
      enabled: true,
    });
  });

  stepExtraLabels.forEach((label, index) => {
    const systemStatus = stepExtraSystemStatuses[index];
    if (!label || !STEP_STATUS_ORDER.includes(systemStatus as StepStatus)) return;
    const status = systemStatus as StepStatus;
    customStep.push({
      id: `step-extra-${index + 1}`,
      systemStatus: status,
      label,
      color: stepExtraColors[index] || STEP_STATUS_DEFAULT_COLORS[status],
      enabled: true,
    });
  });

  return {
    task: Object.fromEntries(
      TASK_STATUS_ORDER.map((status) => [
        status,
        {
          systemStatus: status,
          label: asText(formData.get(`taskStatusLabel:${status}`)) || taskStatusLabels[status],
          color: asText(formData.get(`taskStatusColor:${status}`)) || TASK_STATUS_DEFAULT_COLORS[status],
          enabled: readEnabled(formData.get(`taskStatusEnabled:${status}`)),
        },
      ]),
    ) as ProjectStatusSettings["task"],
    step: Object.fromEntries(
      STEP_STATUS_ORDER.map((status) => [
        status,
        {
          systemStatus: status,
          label: asText(formData.get(`stepStatusLabel:${status}`)) || stepStatusLabels[status],
          color: asText(formData.get(`stepStatusColor:${status}`)) || STEP_STATUS_DEFAULT_COLORS[status],
          enabled: readEnabled(formData.get(`stepStatusEnabled:${status}`)),
        },
      ]),
    ) as ProjectStatusSettings["step"],
    customTask,
    customStep,
  };
}

export async function createProjectAction(
  _previousState: CreateProjectFormState,
  formData: FormData,
): Promise<CreateProjectFormState> {
  const workspace = getWorkspace(asText(formData.get("workspace")));
  const mode = "custom" as const;
  const name = asText(formData.get("name"));
  const description = asText(formData.get("description"));
  const objective = asText(formData.get("objective"));
  const context = asText(formData.get("context"));
  const status = asText(formData.get("status"));
  const projectType = asText(formData.get("projectType"));
  const subcategory = asText(formData.get("subcategory"));
  const priority = asText(formData.get("priority"));
  const customSubcategoryLabel = asText(formData.get("customSubcategoryLabel"));
  const customSubcategoryColor = asText(formData.get("customSubcategoryColor"));
  const templateKey = asText(formData.get("templateKey"));
  const statusSettings = buildStatusSettingsFromFormData(formData);

  const errors: CreateProjectFormState["errors"] = {};

  if (!name) {
    errors.name = "Le nom du projet est requis.";
  }

  if (
    projectType !== "ponctuel" &&
    projectType !== "recurrent" &&
    projectType !== "exploration" &&
    projectType !== "decision" &&
    projectType !== "execution"
  ) {
    errors.projectType = "Sélectionnez un type de projet.";
  }

  const isCustomSubcategory = isCustomSubcategorySelection(subcategory);
  if (!subcategory) {
    errors.subcategory = "Sélectionnez une sous-catégorie.";
  } else if (!isCustomSubcategory && !getSubcategoryOption(workspace, subcategory)) {
    errors.subcategory = "Cette sous-catégorie n'est pas disponible dans cet espace.";
  }

  if (priority !== "low" && priority !== "medium" && priority !== "high") {
    errors.priority = "Sélectionnez un niveau de priorité.";
  }

  if (isCustomSubcategory && !customSubcategoryLabel) {
    errors.customSubcategoryLabel = "Ajoutez un libellé pour cette sous-catégorie.";
  }

  if (isCustomSubcategory && !customSubcategoryColor) {
    errors.customSubcategoryColor = "Choisissez une couleur pour cette sous-catégorie.";
  }

  if (errors && Object.keys(errors).length > 0) {
    return {
      errors,
      message: "Complétez les champs requis pour créer le projet.",
    };
  }

  const validatedProjectType = projectType as ProjectType;
  const validatedPriority = priority as ProjectPriority;

  const project = await createProject({
    workspace,
    mode,
    name,
    description,
    objective,
    context,
    status:
      status === "preparing" || status === "active" || status === "paused" || status === "on-hold" || status === "completed" || status === "archived"
        ? status
        : "preparing",
    projectType: validatedProjectType,
    subcategory,
    priority: validatedPriority,
    customSubcategoryLabel: isCustomSubcategory ? customSubcategoryLabel : undefined,
    customSubcategoryColor: isCustomSubcategory ? customSubcategoryColor : undefined,
    templateKey: templateKey || undefined,
    statusSettings,
  });

  // Layout-level revalidation : invalide aussi le sidebar/topbar/bottom-nav
  // et toutes les vues (dashboard, projets, kanban, calendrier) d'un coup.
  revalidatePath("/", "layout");

  // On NE pingle PAS la vue sur l'environnement du projet : on revient à la vue
  // agrégée « Tous » pour que le dashboard et le reste continuent d'afficher
  // tous les environnements (sinon créer un projet Pro masquait le Perso, etc.).
  // Pour ne voir qu'un environnement, l'utilisateur choisit le filtre dédié.
  redirect(`/dashboard/projects/${project.id}?workspace=${ALL_WORKSPACE}`);
}

export async function updateProjectIdentityAction(input: {
  projectId: string;
  workspace: string;
  subcategory?: string;
  name?: string;
}) {
  const workspace = getWorkspace(input.workspace);
  const name = input.name?.trim();
  await updateProject(input.projectId, {
    workspace,
    // `subcategory` et `name` restent inchangés si non fournis : l'éditeur de
    // picto ne touche qu'à la sous-catégorie, l'éditeur de paramètres qu'au
    // nom + environnement.
    ...(input.subcategory ? { subcategory: input.subcategory } : {}),
    ...(name ? { name } : {}),
  });

  revalidatePath("/", "layout");
  refresh();
}
