"use server";

// Server actions IA — chaque action correspond à un bouton précis dans l'UI.
// Aucune ne tourne en arrière-plan, aucune ne modifie le projet sans appel explicite.

import { refresh, revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { generateProjectSuggestion, type AIProjectSuggestion } from "@/lib/ai/project-creation";
import {
  improveTaskExpected,
  refineTaskExpected,
  type ExpectedMessage,
  type ExpectedRefineResult,
} from "@/lib/ai/task-expected";
import { generateTaskChecklist } from "@/lib/ai/task-checklist";
import { generateProjectSynthesis, type AIProjectSynthesis } from "@/lib/ai/project-synthesis";
import {
  analyzeProjectEvolution,
  describeOperation,
  type EvolutionOperation,
  type EvolutionMessage,
} from "@/lib/ai/project-evolution";
import {
  addStepToProject,
  addTaskToStep,
  createProject,
  deleteStepFromProject,
  deleteTaskFromStep,
  getProjectById,
  updateProject,
  updateTaskInStep,
} from "@/lib/project-store";
import type { Project, TaskStatus } from "@/lib/mock-data";
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

// 2b) Assistant IA conversationnel pour le champ Attendu : l'utilisateur
// dialogue avec l'IA qui pose des questions puis propose un attendu affiné.
export async function refineTaskExpectedAction(input: {
  projectId: string;
  stepId: string;
  taskId: string;
  messages: ExpectedMessage[];
}): Promise<ExpectedRefineResult> {
  const project = await getProjectById(input.projectId);
  if (!project) throw new Error("Projet introuvable.");
  const step = (project.steps ?? []).find((s) => s.id === input.stepId);
  if (!step) throw new Error("Étape introuvable.");
  const task = step.tasks.find((t) => t.id === input.taskId);
  if (!task) throw new Error("Tâche introuvable.");

  const normalizedStep = { ...step, title: getDisplayStepTitle(step.title) };
  return refineTaskExpected({ project, step: normalizedStep, task, messages: input.messages });
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

// ─── 5) Faire évoluer un projet à partir d'un texte ────────────────────────────
// L'utilisateur colle une note / un compte-rendu. L'IA propose un plan
// d'opérations (étapes/tâches à créer, tâches à faire avancer, dates, personnes).
// Étape A : analyse (aucune mutation). On enrichit chaque opération d'un libellé
// lisible pour la revue côté UI.

export interface EvolutionPlanItem {
  op: EvolutionOperation;
  title: string;
  detail: string;
}

export interface EvolutionPlanResult {
  /** "question" : l'IA demande une précision ; "plan" : elle propose des opérations. */
  mode: "question" | "plan";
  question: string | null;
  summary: string;
  items: EvolutionPlanItem[];
}

export async function analyzeProjectEvolutionAction(input: {
  projectId: string;
  messages: EvolutionMessage[];
}): Promise<EvolutionPlanResult> {
  const messages = (input.messages ?? []).filter((message) => message.content.trim());
  if (messages.length === 0) throw new Error("Écris un message avant de lancer l'IA.");

  const project = await getProjectById(input.projectId);
  if (!project) throw new Error("Projet introuvable.");

  const plan = await analyzeProjectEvolution(project, messages);
  const items: EvolutionPlanItem[] =
    plan.mode === "plan"
      ? plan.operations.map((op) => ({ op, ...describeOperation(op, project) }))
      : [];

  return { mode: plan.mode, question: plan.question, summary: plan.summary, items };
}

// Étape B : application des opérations sélectionnées par l'utilisateur.
// Ordre : on crée d'abord les étapes, puis les tâches (rattachées aux étapes
// existantes ou nouvellement créées), puis on met à jour les tâches existantes.

const DATE_RE = /^\d{4}-\d{2}-\d{2}$/;

function normTitle(value: string | null | undefined) {
  return (value ?? "").trim().toLocaleLowerCase("fr-FR");
}

function statusUpdate(status: TaskStatus): { status: TaskStatus; done: boolean; blocked: boolean } {
  if (status === "done") return { status, done: true, blocked: false };
  if (status === "blocked") return { status, done: false, blocked: true };
  return { status, done: false, blocked: false };
}

export async function applyProjectEvolutionAction(input: {
  projectId: string;
  operations: EvolutionOperation[];
}): Promise<{ applied: number }> {
  const { projectId } = input;
  const operations = Array.isArray(input.operations) ? input.operations : [];
  if (operations.length === 0) return { applied: 0 };

  const project = await getProjectById(projectId);
  if (!project) throw new Error("Projet introuvable.");

  // Index titre d'étape (normalisé) → stepId, alimenté au fil des créations.
  const stepIdByTitle = new Map<string, string>();
  for (const step of project.steps ?? []) {
    stepIdByTitle.set(normTitle(step.title), step.id);
  }

  let applied = 0;

  const addStep = async (title: string, description: string | null) => {
    const key = normTitle(title);
    const existing = stepIdByTitle.get(key);
    if (existing) return existing;
    const updated = await addStepToProject(projectId, {
      title: title.trim(),
      description: description?.trim() || undefined,
    });
    const newStep = updated?.steps?.[updated.steps.length - 1];
    if (newStep) {
      stepIdByTitle.set(key, newStep.id);
      return newStep.id;
    }
    return undefined;
  };

  // 1) Étapes
  for (const op of operations) {
    if (op.type !== "add_step" || !op.stepTitle?.trim()) continue;
    const id = await addStep(op.stepTitle, op.stepDescription);
    if (id) applied += 1;
  }

  // 2) Tâches à créer
  for (const op of operations) {
    if (op.type !== "add_task" || !op.taskTitle?.trim()) continue;

    let stepId: string | undefined;
    if (op.targetStepId && (project.steps ?? []).some((s) => s.id === op.targetStepId)) {
      stepId = op.targetStepId;
    } else if (op.newStepTitle?.trim()) {
      stepId = stepIdByTitle.get(normTitle(op.newStepTitle)) ?? (await addStep(op.newStepTitle, null));
    }
    // Repli : aucune étape ciblée valide → on rattache à la dernière étape
    // existante, ou on crée une étape « Nouvelles tâches ».
    if (!stepId) {
      const fresh = await getProjectById(projectId);
      const last = fresh?.steps?.[fresh.steps.length - 1];
      stepId = last?.id ?? (await addStep("Nouvelles tâches", null));
    }
    if (!stepId) continue;

    await addTaskToStep(projectId, stepId, {
      title: op.taskTitle.trim(),
      description: op.taskExpected?.trim() || undefined,
      expected: op.taskExpected?.trim() || undefined,
      priority: op.priority ?? "medium",
      owner: op.owner?.trim() || "",
      assignees: op.owner?.trim() ? [op.owner.trim()] : [],
      teamIds: [],
      dueDate: op.dueDate && DATE_RE.test(op.dueDate) ? op.dueDate : undefined,
      source: "ai",
    });
    applied += 1;
  }

  // 3) Mises à jour de tâches existantes
  const locateTask = (proj: Project, taskId: string) => {
    for (const step of proj.steps ?? []) {
      const task = step.tasks.find((t) => t.id === taskId);
      if (task) return { stepId: step.id, task };
    }
    return null;
  };

  for (const op of operations) {
    if (op.type !== "update_task" || !op.taskId) continue;
    const fresh = await getProjectById(projectId);
    if (!fresh) break;
    const located = locateTask(fresh, op.taskId);
    if (!located) continue;

    const update: Parameters<typeof updateTaskInStep>[3] = {};
    if (op.newStatus) Object.assign(update, statusUpdate(op.newStatus));
    if (op.dueDate && DATE_RE.test(op.dueDate)) update.dueDate = op.dueDate;
    if (op.owner?.trim()) {
      update.owner = op.owner.trim();
      update.assignees = [op.owner.trim()];
    }
    if (op.priority) update.priority = op.priority;
    if (op.note?.trim()) {
      const previous = located.task.realization?.trim();
      update.realization = previous ? `${previous}\n${op.note.trim()}` : op.note.trim();
    }
    if (Object.keys(update).length === 0) continue;

    await updateTaskInStep(projectId, located.stepId, op.taskId, update);
    applied += 1;
  }

  // 4) Suppression / annulation des tâches devenues caduques (en dernier).
  const emptiedStepCandidates = new Set<string>();
  for (const op of operations) {
    if (op.type !== "remove_task" || !op.taskId) continue;
    const fresh = await getProjectById(projectId);
    if (!fresh) break;
    const located = locateTask(fresh, op.taskId);
    if (!located) continue;
    await deleteTaskFromStep(projectId, located.stepId, op.taskId);
    emptiedStepCandidates.add(located.stepId);
    applied += 1;
  }

  // 5) Nettoyage : une étape vidée de toutes ses tâches par les annulations
  //    n'a plus d'intérêt → on la supprime aussi.
  if (emptiedStepCandidates.size > 0) {
    const fresh = await getProjectById(projectId);
    for (const stepId of emptiedStepCandidates) {
      const step = fresh?.steps?.find((candidate) => candidate.id === stepId);
      if (step && step.tasks.length === 0) {
        await deleteStepFromProject(projectId, stepId);
      }
    }
  }

  revalidatePath(`/dashboard/projects/${projectId}`);
  refresh();

  return { applied };
}
