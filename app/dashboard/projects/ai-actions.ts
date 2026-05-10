"use server";

// Server actions IA — chaque action correspond à un bouton précis dans l'UI.
// Aucune ne tourne en arrière-plan, aucune ne modifie le projet sans appel explicite.

import { refresh, revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { generateProjectSuggestion, type AIProjectSuggestion } from "@/lib/ai/project-creation";
import { improveTaskExpected } from "@/lib/ai/task-expected";
import { generateTaskChecklist } from "@/lib/ai/task-checklist";
import { generateProjectSynthesis, type AIProjectSynthesis } from "@/lib/ai/project-synthesis";
import {
  addStepToProject,
  addTaskToStep,
  createProject,
  getProjectById,
  updateProject,
  updateTaskInStep,
} from "@/lib/project-store";
import { getDisplayStepTitle } from "@/lib/project-display";
import { getWorkspace, type Workspace } from "@/lib/workspace";
import type { ProjectPriority } from "@/lib/project-taxonomy";
import type { ChecklistItem } from "@/lib/mock-data";

// 1a) Création de projet assistée — étape 1 : génération de la proposition
export async function suggestProjectFromDescriptionAction(
  description: string,
  workspace: string,
): Promise<AIProjectSuggestion> {
  const cleaned = description.trim();
  if (!cleaned) throw new Error("Décris le projet avant de demander une suggestion.");
  return generateProjectSuggestion(cleaned, getWorkspace(workspace));
}

// 1b) Création de projet assistée — étape 2 : matérialisation de la proposition
// (le projet, ses étapes et ses tâches sont créés dans le store puis on
// redirige vers la page projet). L'utilisateur a validé la proposition côté UI.
export async function createProjectFromAISuggestionAction(input: {
  workspace: string;
  subcategory: string;
  priority: ProjectPriority;
  suggestion: AIProjectSuggestion;
}): Promise<void> {
  const workspace: Workspace = getWorkspace(input.workspace);
  const suggestion = input.suggestion;
  if (!suggestion?.name || !suggestion?.steps?.length) {
    throw new Error("Suggestion IA invalide.");
  }

  const project = await createProject({
    name: suggestion.name,
    description: suggestion.objective.slice(0, 280),
    objective: suggestion.objective,
    context: suggestion.context,
    workspace,
    mode: "custom",
    projectType: "execution",
    priority: input.priority,
    subcategory: input.subcategory,
    customSubcategoryLabel: undefined,
    customSubcategoryColor: undefined,
    status: "preparing",
    statusSettings: undefined,
  });

  if (!project) throw new Error("Création du projet échouée.");

  // Crée les étapes + tâches dans l'ordre proposé
  for (const step of suggestion.steps) {
    const updated = await addStepToProject(project.id, {
      title: step.title,
      description: step.description,
      priority: input.priority,
    });
    if (!updated) continue;
    const newStep = updated.steps?.[updated.steps.length - 1];
    if (!newStep) continue;
    for (const task of step.tasks) {
      await addTaskToStep(project.id, newStep.id, {
        title: task.title,
        description: task.expected,
        expected: task.expected,
        priority: "medium",
        owner: "",
        assignees: [],
        teamIds: [],
        source: "ai",
      });
    }
  }

  revalidatePath("/", "layout");
  redirect(`/dashboard/projects/${project.id}?workspace=${workspace}`);
}

// 2) Suggestion IA pour le champ Attendu d'une tâche
// L'IA reçoit le projet entier (toutes les étapes / toutes les tâches) pour
// produire une formulation cohérente avec le plan global.
export async function suggestTaskExpectedAction(input: {
  projectId: string;
  stepId: string;
  taskId: string;
}): Promise<{ expected: string }> {
  const project = await getProjectById(input.projectId);
  if (!project) throw new Error("Projet introuvable.");
  const step = (project.steps ?? []).find((s) => s.id === input.stepId);
  if (!step) throw new Error("Étape introuvable.");
  const task = step.tasks.find((t) => t.id === input.taskId);
  if (!task) throw new Error("Tâche introuvable.");

  // On normalise le titre d'étape pour l'affichage avant de passer à l'IA.
  const normalizedStep = { ...step, title: getDisplayStepTitle(step.title) };
  const expected = await improveTaskExpected({ project, step: normalizedStep, task });

  return { expected };
}

// 3) Génération de checklist pour une tâche
// L'IA reçoit le projet entier pour proposer des sous-actions cohérentes et
// éviter de doublonner avec d'autres tâches existantes.
export async function suggestTaskChecklistAction(input: {
  projectId: string;
  stepId: string;
  taskId: string;
}): Promise<{ items: string[] }> {
  const project = await getProjectById(input.projectId);
  if (!project) throw new Error("Projet introuvable.");
  const step = (project.steps ?? []).find((s) => s.id === input.stepId);
  if (!step) throw new Error("Étape introuvable.");
  const task = step.tasks.find((t) => t.id === input.taskId);
  if (!task) throw new Error("Tâche introuvable.");

  const normalizedStep = { ...step, title: getDisplayStepTitle(step.title) };
  const items = await generateTaskChecklist({ project, step: normalizedStep, task });

  return { items };
}

// 4) Mise à jour de la synthèse projet — toutes les cartes du rail sont
// régénérées : Objectif, Contexte, État actuel, Résumé, Prochaines étapes,
// Risques. Les tâches, statuts, dates et checklists restent intacts.
export async function refreshProjectSynthesisAction(projectId: string): Promise<AIProjectSynthesis> {
  const project = await getProjectById(projectId);
  if (!project) throw new Error("Projet introuvable.");

  const synthesis = await generateProjectSynthesis(project);

  // Risques : on conserve les risques résolus historiques, on remplace les
  // ouverts par la nouvelle lecture IA. Chaque nouveau risque est créé en
  // statut "open" — l'utilisateur peut ensuite les marquer comme atténués.
  const resolvedRisks = (project.risks ?? []).filter((risk) => risk.status !== "open");
  const aiRisks = synthesis.risks.map((risk, index) => ({
    id: `risk_ai_${Date.now()}_${index}`,
    title: risk.title.trim(),
    severity: risk.severity,
    mitigation: risk.mitigation.trim(),
    status: "open" as const,
  }));
  const nextRisks = [...aiRisks, ...resolvedRisks];

  // Mapping des champs de synthèse aux champs du projet :
  //   objective       → carte "Objectif" (finalité du projet réel)
  //   context         → carte "Contexte" (contraintes du projet réel, hors app)
  //   description     → carte "Résumé du projet" (vision globale)
  //   currentPriority → carte "État actuel" (avancement / dynamique)
  //   nextStep        → carte "Prochaines actions" (axes stratégiques)
  //   risks           → puces "Risques identifiés" sous l'état actuel
  await updateProject(projectId, {
    objective: synthesis.objective,
    context: synthesis.context,
    description: synthesis.summary,
    currentPriority: synthesis.currentState,
    nextStep: synthesis.nextSteps.join("\n"),
    risks: nextRisks,
  });

  revalidatePath(`/dashboard/projects/${projectId}`);
  refresh();

  return synthesis;
}

// Helper used uniquement par 3) après confirmation de l'utilisateur côté UI.
// Permet d'appliquer la checklist proposée à la tâche en une seule fois.
export async function applyAIChecklistAction(input: {
  projectId: string;
  stepId: string;
  taskId: string;
  items: string[];
  mode: "replace" | "append";
}): Promise<{ checklist: ChecklistItem[] }> {
  const project = await getProjectById(input.projectId);
  if (!project) throw new Error("Projet introuvable.");
  const step = (project.steps ?? []).find((s) => s.id === input.stepId);
  if (!step) throw new Error("Étape introuvable.");
  const task = step.tasks.find((t) => t.id === input.taskId);
  if (!task) throw new Error("Tâche introuvable.");

  const cleaned = input.items.map((item) => item.trim()).filter(Boolean);
  const newItems: ChecklistItem[] = cleaned.map((label, index) => ({
    id: `cl_${Date.now()}_${index}`,
    label,
    done: false,
  }));

  const nextChecklist: ChecklistItem[] =
    input.mode === "replace" ? newItems : [...(task.checklist ?? []), ...newItems];

  await updateTaskInStep(input.projectId, input.stepId, input.taskId, {
    checklist: nextChecklist,
  });

  // PAS de revalidatePath/refresh ici : ça remonterait le drawer ouvert
  // de l'utilisateur. La nouvelle checklist est retournée au client qui
  // va l'injecter dans son state local via onChecklistMutated.
  return { checklist: nextChecklist };
}
