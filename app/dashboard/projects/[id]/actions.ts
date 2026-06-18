"use server";

import { mkdir, unlink, writeFile } from "node:fs/promises";
import path from "node:path";
import { refresh, revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { assertPaidPlan } from "@/lib/account-plan";
import {
  addProjectPerson,
  removeProjectPerson,
  addProjectTeam,
  addFileToProject,
  addStepToProject,
  addTaskFileToProject,
  addTaskChecklistItem,
  addTaskToStep,
  appendProjectTeamMessage,
  appendTaskDiscussionMessage,
  completeTaskWithRealization,
  deleteStepFromProject,
  deleteTaskChecklistItem,
  deleteTaskFromStep,
  deleteProject,
  duplicateProject,
  getProjectById,
  removeFileFromProject,
  removeTaskFileFromProject,
  reorderStepsInProject,
  reorderTasksInStep,
  toggleTaskChecklistItem,
  toggleTaskDone,
  updateTaskStatusSetting,
  updateProject,
  updateStepInProject,
  updateStepStatusSetting,
  updateTaskChecklistItem,
  updateTaskInStep,
  updateTaskBoardStatus,
  updateProjectTeam,
} from "@/lib/project-store";
import type { ChecklistItem, ProjectFile, ProjectStatus, ProjectStatusSettings, Step, StepStatus, TaskStatus } from "@/lib/mock-data";
import type { ProjectPriority } from "@/lib/project-taxonomy";
import { deriveStepStatus, deriveTaskStatus, normalizePlanPriority } from "@/lib/project-plan";
import { formatProjectFileSize, guessProjectFileExt, sanitizeProjectFileName } from "@/lib/project-files";
import { getActiveAccountName } from "@/lib/current-account";

interface StepUpdateActionInput {
  title?: string;
  description?: string;
  priority?: ProjectPriority;
}

interface TaskUpdateActionInput {
  title?: string;
  description?: string;
  owner?: string;
  assignees?: string[];
  teamIds?: string[];
  dueDate?: string;
  dueTime?: string;
  status?: TaskStatus;
  priority?: ProjectPriority;
  expected?: string;
  realization?: string;
  comments?: string[];
  checklist?: ChecklistItem[];
  manualNote?: string;
}

interface CompleteTaskActionInput {
  details: string;
}

interface CompleteTaskActionResult {
  realization?: string;
  completedAt?: string;
}

type UploadProjectFilesResult =
  | { ok: true; files?: ProjectFile[] }
  | { ok: false; error: string };

function isUploadedFile(value: FormDataEntryValue): value is File {
  if (typeof value !== "object" || value === null) return false;

  const candidate = value as Partial<File>;
  return (
    typeof candidate.name === "string" &&
    typeof candidate.size === "number" &&
    candidate.size > 0 &&
    typeof candidate.arrayBuffer === "function"
  );
}

function revalidateProjectViews(projectId: string) {
  revalidatePath(`/dashboard/projects/${projectId}`);
  revalidatePath("/dashboard/projects");
  revalidatePath("/dashboard/tasks");
  revalidatePath("/dashboard");
  refresh();
}

async function finalizeProjectMutation(projectId: string, _changeDetail?: string) {
  revalidateProjectViews(projectId);
}

// Règles statut tâche :
// - Une tâche "à faire" (todo) bascule automatiquement en "en cours"
//   dès qu'au moins une checklist est cochée OU qu'un texte est saisi
//   dans Réalisation.
// - Une tâche ne peut PAS passer en "terminée" tant que tous les items
//   de sa checklist ne sont pas cochés. Erreur explicite renvoyée à l'UI.

const CHECKLIST_INCOMPLETE_ERROR =
  "Tous les items de la checklist doivent être cochés avant de marquer cette tâche comme terminée.";

function isChecklistFullyComplete(checklist: ChecklistItem[] | undefined): boolean {
  const items = checklist ?? [];
  if (items.length === 0) return true;
  return items.every((item) => item.done);
}

async function maybeAutoTransitionToInProgress(
  projectId: string,
  stepId: string,
  taskId: string,
) {
  const project = await getProjectById(projectId);
  const task = project?.steps?.find((s) => s.id === stepId)?.tasks.find((t) => t.id === taskId);
  if (!task) return;
  // Ne s'applique que sur les tâches encore "à faire" (jamais sur done/blocked/etc.)
  if (task.done || task.status !== "todo") return;
  const hasCheckedItem = (task.checklist ?? []).some((item) => item.done);
  const hasRealization =
    (task.realization ?? task.completionDetails ?? "").trim().length > 0;
  if (!hasCheckedItem && !hasRealization) return;
  await updateTaskInStep(projectId, stepId, taskId, {
    status: "in_progress",
    done: false,
    blocked: false,
  });
}

function cleanActionText(value: string | null | undefined) {
  return value?.trim() ?? "";
}

function cleanExpectedText(value: string | undefined) {
  const cleaned = value?.replace(/\s+/g, " ").trim();
  if (!cleaned) return undefined;
  return cleaned.length > 600 ? `${cleaned.slice(0, 597).trim()}...` : cleaned;
}

async function generateExpectedForNewTask(input: {
  taskTitle: string;
  taskDescription?: string;
  providedExpected?: string;
}) {
  const provided = cleanExpectedText(input.providedExpected);
  if (provided) return provided;
  return cleanExpectedText(input.taskDescription);
}

export async function updateProjectStatusAction(id: string, status: ProjectStatus) {
  await updateProject(id, { status });
  await finalizeProjectMutation(id, `statut du projet modifié en ${status}.`);
}

export async function updateProjectPriorityAction(id: string, priority: ProjectPriority) {
  await updateProject(id, { priority });
  await finalizeProjectMutation(id, `priorité du projet modifiée en ${priority}.`);
}

export async function archiveProjectAction(id: string, workspace: string) {
  // Archivage = "geler" le projet :
  //   - status -> archived (filtré du dashboard, accessible via le filtre)
  //   - activity[] -> vidé : c'est la seule donnée non affichée mais
  //     accumulée pour servir à l'évolution du projet. Tout le reste
  //     (tâches, fichiers, discussions, décisions, risques…) reste
  //     visible quand on rouvre le projet archivé.
  await updateProject(id, { status: "archived", activity: [] });
  // Invalide TOUT le router cache (layout + toutes les pages enfants)
  // — sinon le user voit l'ancien projet quand il revient en arrière
  // depuis kanban/calendrier/etc., car ces pages restent cachées.
  revalidatePath("/", "layout");
  redirect(`/dashboard/projects?workspace=${workspace}`);
}

export async function duplicateProjectAction(id: string, workspace: string) {
  const copy = await duplicateProject(id);
  // Flush du cache layout pour que la copie apparaisse dans toutes les vues.
  revalidatePath("/", "layout");
  redirect(copy ? `/dashboard/projects/${copy.id}?workspace=${workspace}` : `/dashboard/projects?workspace=${workspace}`);
}

export async function deleteProjectAction(id: string, workspace: string) {
  await deleteProject(id);
  // Idem : on flush tout le cache layout pour que le projet supprimé
  // disparaisse de toutes les vues (dashboard, projets, kanban, calendrier).
  revalidatePath("/", "layout");
  redirect(`/dashboard/projects?workspace=${workspace}`);
}

export async function toggleTaskDoneAction(projectId: string, stepId: string, taskId: string) {
  // Si on est sur le point de marquer la tâche comme terminée, on vérifie
  // d'abord que la checklist est complètement cochée.
  const project = await getProjectById(projectId);
  const task = project?.steps?.find((s) => s.id === stepId)?.tasks.find((t) => t.id === taskId);
  if (task && !task.done && !isChecklistFullyComplete(task.checklist)) {
    throw new Error(CHECKLIST_INCOMPLETE_ERROR);
  }
  await toggleTaskDone(projectId, stepId, taskId);
  await finalizeProjectMutation(projectId, `état de la tâche ${taskId} modifié manuellement.`);
}

export async function completeTaskAction(
  projectId: string,
  stepId: string,
  taskId: string,
  input: CompleteTaskActionInput,
): Promise<CompleteTaskActionResult> {
  const details = cleanActionText(input.details);

  const project = await getProjectById(projectId);
  const task = project?.steps?.find((s) => s.id === stepId)?.tasks.find((t) => t.id === taskId);
  if (!isChecklistFullyComplete(task?.checklist)) {
    throw new Error(CHECKLIST_INCOMPLETE_ERROR);
  }

  const updatedProject = await completeTaskWithRealization(projectId, stepId, taskId, {
    ...input,
    details,
  });
  await finalizeProjectMutation(projectId, `tâche ${taskId} terminée manuellement : ${details}.`);

  const updatedTask = updatedProject?.steps
    ?.find((step) => step.id === stepId)
    ?.tasks.find((task) => task.id === taskId);

  return {
    realization: updatedTask?.realization ?? updatedTask?.completionDetails,
    completedAt: updatedTask?.completedAt,
  };
}

export async function updateStepAction(projectId: string, stepId: string, input: StepUpdateActionInput) {
  await updateStepInProject(projectId, stepId, {
    title: input.title,
    description: input.description,
    priority: input.priority ? normalizePlanPriority(input.priority) : undefined,
  });
  await finalizeProjectMutation(projectId, `étape ${stepId} modifiée manuellement.`);
}

export async function deleteStepAction(projectId: string, stepId: string) {
  await deleteStepFromProject(projectId, stepId);
  await finalizeProjectMutation(projectId, `étape ${stepId} supprimée manuellement.`);
}

export async function updateTaskAction(projectId: string, stepId: string, taskId: string, input: TaskUpdateActionInput) {
  // Garde "terminée" : si on tente de passer en done, la checklist doit être
  // intégralement cochée (en tenant compte de la checklist mise à jour si
  // input.checklist est fourni).
  if (input.status === "done") {
    const project = await getProjectById(projectId);
    const task = project?.steps?.find((s) => s.id === stepId)?.tasks.find((t) => t.id === taskId);
    const finalChecklist = input.checklist ?? task?.checklist;
    if (!isChecklistFullyComplete(finalChecklist)) {
      throw new Error(CHECKLIST_INCOMPLETE_ERROR);
    }
  }

  const statusPatch = input.status
    ? {
        status: input.status,
        done: input.status === "done",
        blocked: input.status === "blocked",
      }
    : {};

  // Si une manualNote est fournie (ex : explication d'un changement de date
  // depuis le calendrier), on l'ajoute aux commentaires existants de la tâche.
  let nextComments = input.comments;
  const manualNote = input.manualNote?.trim();
  if (manualNote) {
    const project = await getProjectById(projectId);
    const step = project?.steps?.find((s) => s.id === stepId);
    const task = step?.tasks.find((t) => t.id === taskId);
    const previous = input.comments ?? task?.comments ?? [];
    nextComments = [...previous, manualNote];
  }

  await updateTaskInStep(projectId, stepId, taskId, {
    title: input.title,
    description: input.description,
    owner: input.owner,
    assignees: input.assignees,
    teamIds: input.teamIds,
    dueDate: input.dueDate,
    dueTime: input.dueTime,
    ...statusPatch,
    priority: input.priority ? normalizePlanPriority(input.priority) : undefined,
    expected: input.expected,
    realization: input.realization,
    comments: nextComments,
    checklist: input.checklist,
  });

  // Auto-transition todo → in_progress si réalisation/checklist activée et
  // qu'aucun statut explicite n'a été imposé par l'appel.
  if (!input.status) {
    await maybeAutoTransitionToInProgress(projectId, stepId, taskId);
  }

  // PAS de finalizeProjectMutation (revalidatePath + refresh) ici : ça
  // re-render la page et démonte le drawer / la fenêtre ouverte (l'utilisateur
  // perd sa place en enregistrant une date ou une checklist). Les appelants
  // gèrent la mise à jour côté client de façon optimiste (steps-panel, drawer)
  // ou rafraîchissent eux-mêmes quand c'est voulu (calendrier → router.refresh).
}

export async function addTaskChecklistItemAction(
  projectId: string,
  stepId: string,
  taskId: string,
  label: string,
  itemId?: string,
) {
  await addTaskChecklistItem(projectId, stepId, taskId, label, itemId);
  await finalizeProjectMutation(projectId, `checklist de la tâche ${taskId} enrichie : ${label}.`);
}

export async function updateTaskChecklistItemAction(
  projectId: string,
  stepId: string,
  taskId: string,
  itemId: string,
  label: string,
) {
  await updateTaskChecklistItem(projectId, stepId, taskId, itemId, label);
  await finalizeProjectMutation(projectId, `élément de checklist modifié sur la tâche ${taskId}.`);
}

export async function toggleTaskChecklistItemAction(
  projectId: string,
  stepId: string,
  taskId: string,
  itemId: string,
) {
  await toggleTaskChecklistItem(projectId, stepId, taskId, itemId);
  // Cocher une case peut déclencher l'auto-transition todo → in_progress.
  await maybeAutoTransitionToInProgress(projectId, stepId, taskId);
  await finalizeProjectMutation(projectId, `élément de checklist coché ou décoché sur la tâche ${taskId}.`);
}

export async function deleteTaskChecklistItemAction(
  projectId: string,
  stepId: string,
  taskId: string,
  itemId: string,
) {
  await deleteTaskChecklistItem(projectId, stepId, taskId, itemId);
  await finalizeProjectMutation(projectId, `élément de checklist supprimé sur la tâche ${taskId}.`);
}

export async function deleteTaskAction(projectId: string, stepId: string, taskId: string) {
  await deleteTaskFromStep(projectId, stepId, taskId);
  await finalizeProjectMutation(projectId, `tâche ${taskId} supprimée manuellement.`);
}

export async function reorderProjectStepsAction(projectId: string, orderedStepIds: string[]) {
  await reorderStepsInProject(projectId, orderedStepIds);
  await finalizeProjectMutation(projectId, "ordre des étapes ajusté manuellement.");
}

export async function reorderStepTasksAction(projectId: string, stepId: string, orderedTaskIds: string[]) {
  await reorderTasksInStep(projectId, stepId, orderedTaskIds);
  await finalizeProjectMutation(projectId, `ordre des tâches ajusté manuellement dans l'étape ${stepId}.`);
}

export async function updateTaskBoardStatusAction(
  projectId: string,
  stepId: string,
  taskId: string,
  input: { status: TaskStatus; done: boolean; blocked: boolean; statusNote?: string },
) {
  const project = await getProjectById(projectId);
  const step = project?.steps?.find((candidate) => candidate.id === stepId);
  const task = step?.tasks.find((candidate) => candidate.id === taskId);
  if ((input.status === "done" || input.done) && !isChecklistFullyComplete(task?.checklist)) {
    throw new Error(CHECKLIST_INCOMPLETE_ERROR);
  }
  const statusLabel = project?.statusSettings?.task?.[input.status]?.label ?? input.status;
  const taskTitle = task?.title ?? taskId;
  await updateTaskBoardStatus(projectId, stepId, taskId, input);
  await finalizeProjectMutation(
    projectId,
    `tâche « ${taskTitle} » déplacée manuellement vers le statut « ${statusLabel} »${step?.title ? ` dans l'étape « ${step.title} »` : ""}${input.statusNote ? ` : ${input.statusNote}` : ""}.`,
  );
}

export async function addStepToProjectAction(formData: FormData) {
  const projectId = String(formData.get("projectId") ?? "");
  const workspace = String(formData.get("workspace") ?? "personal");
  const title = String(formData.get("title") ?? "").trim();
  const description = String(formData.get("description") ?? "").trim();
  const priority = normalizePlanPriority(String(formData.get("priority") ?? "medium"));

  if (projectId && title) {
    await addStepToProject(projectId, { title, description, priority });
    await finalizeProjectMutation(projectId, `étape ajoutée manuellement : ${title}.`);
  } else {
    revalidateProjectViews(projectId);
  }

  redirect(`/dashboard/projects/${projectId}?workspace=${workspace}`);
}

export async function addTaskToStepAction(formData: FormData) {
  const projectId = String(formData.get("projectId") ?? "");
  const workspace = String(formData.get("workspace") ?? "personal");
  const stepId = String(formData.get("stepId") ?? "");
  const title = String(formData.get("title") ?? "").trim();
  const description = String(formData.get("description") ?? "").trim();
  const owner = String(formData.get("owner") ?? "").trim() || undefined;
  const dueDate = String(formData.get("dueDate") ?? "").trim() || undefined;
  const dueTime = String(formData.get("dueTime") ?? "").trim() || undefined;
  const expectedInput = String(formData.get("expected") ?? "").trim() || undefined;
  const realization = String(formData.get("realization") ?? "").trim() || undefined;
  const comments = String(formData.get("commentsText") ?? "")
    .split(/\r?\n/)
    .map((comment) => comment.trim())
    .filter(Boolean);
  const checklist = String(formData.get("checklistText") ?? "")
    .split(/\r?\n/)
    .map((label) => label.trim())
    .filter(Boolean)
    .map((label) => ({
      id: `cl_${crypto.randomUUID().slice(0, 8)}`,
      label,
      done: false,
    }));
  const priority = normalizePlanPriority(String(formData.get("priority") ?? "medium"));

  if (projectId && stepId && title) {
    const expected = await generateExpectedForNewTask({
      taskTitle: title,
      taskDescription: description || undefined,
      providedExpected: expectedInput,
    });

    await addTaskToStep(projectId, stepId, {
      title,
      description,
      owner,
      dueDate,
      dueTime,
      priority,
      expected,
      realization,
      comments: comments.length > 0 ? comments : undefined,
      checklist: checklist.length > 0 ? checklist : undefined,
      source: "manual",
    });
    await finalizeProjectMutation(projectId, `tâche ajoutée manuellement : ${title}.`);
  } else {
    revalidateProjectViews(projectId);
  }

  redirect(`/dashboard/projects/${projectId}?workspace=${workspace}`);
}

export async function uploadProjectFilesAction(formData: FormData): Promise<UploadProjectFilesResult> {
  const projectId = String(formData.get("projectId") ?? "");
  const workspace = String(formData.get("workspace") ?? "personal");
  const files = formData
    .getAll("files")
    .filter(isUploadedFile);

  if (!projectId) {
    return { ok: false, error: "Projet introuvable." };
  }

  if (files.length === 0) {
    return { ok: false, error: "Aucun fichier valide à ajouter." };
  }

  const uploadDir = path.join(process.cwd(), "public", "uploads", "projects", projectId);

  try {
    await mkdir(uploadDir, { recursive: true });

    for (const file of files) {
      const fileId = `file_${crypto.randomUUID().slice(0, 8)}`;
      const safeName = sanitizeProjectFileName(file.name);
      const storedName = `${fileId}-${safeName}`;
      const storagePath = path.join(uploadDir, storedName);
      const publicUrl = `/uploads/projects/${projectId}/${storedName}`;

      await writeFile(storagePath, Buffer.from(await file.arrayBuffer()));
      await addFileToProject(projectId, {
        id: fileId,
        name: file.name,
        ext: guessProjectFileExt(file.name),
        size: formatProjectFileSize(file.size),
        addedAt: new Date().toISOString().slice(0, 10),
        url: publicUrl,
        mimeType: file.type || undefined,
        storagePath: publicUrl,
        source: "upload",
      });
    }
  } catch (error) {
    console.error("[upload_project_files]", error);
    return { ok: false, error: "Impossible d'ajouter le fichier pour le moment." };
  }

  await finalizeProjectMutation(projectId, `${files.length} fichier${files.length > 1 ? "s" : ""} ajouté${files.length > 1 ? "s" : ""} au projet.`);
  revalidatePath(`/dashboard/projects/${projectId}?workspace=${workspace}`);
  return { ok: true };
}

export async function deleteProjectFileAction(projectId: string, fileId: string) {
  const project = await getProjectById(projectId);
  const file = project?.files?.find((candidate) => candidate.id === fileId);

  if (file?.url?.startsWith("/uploads/")) {
    const publicRoot = path.join(process.cwd(), "public");
    const filePath = path.normalize(path.join(publicRoot, file.url));
    if (filePath.startsWith(publicRoot)) {
      await unlink(filePath).catch(() => undefined);
    }
  }

  await removeFileFromProject(projectId, fileId);
  await finalizeProjectMutation(projectId, `fichier supprimé du projet : ${file?.name ?? fileId}.`);
}

export async function uploadTaskFilesAction(formData: FormData): Promise<UploadProjectFilesResult> {
  const projectId = String(formData.get("projectId") ?? "");
  const workspace = String(formData.get("workspace") ?? "personal");
  const stepId = String(formData.get("stepId") ?? "");
  const taskId = String(formData.get("taskId") ?? "");
  const files = formData
    .getAll("files")
    .filter(isUploadedFile);

  if (!projectId || !stepId || !taskId) {
    return { ok: false, error: "Tâche introuvable." };
  }

  if (files.length === 0) {
    return { ok: false, error: "Aucun fichier valide à ajouter." };
  }

  const uploadDir = path.join(process.cwd(), "public", "uploads", "projects", projectId, "tasks", taskId);
  let updatedProject = await getProjectById(projectId);

  try {
    await mkdir(uploadDir, { recursive: true });

    for (const file of files) {
      const fileId = `file_${crypto.randomUUID().slice(0, 8)}`;
      const safeName = sanitizeProjectFileName(file.name);
      const storedName = `${fileId}-${safeName}`;
      const storagePath = path.join(uploadDir, storedName);
      const publicUrl = `/uploads/projects/${projectId}/tasks/${taskId}/${storedName}`;

      await writeFile(storagePath, Buffer.from(await file.arrayBuffer()));
      updatedProject = await addTaskFileToProject(projectId, stepId, taskId, {
        id: fileId,
        name: file.name,
        ext: guessProjectFileExt(file.name),
        size: formatProjectFileSize(file.size),
        addedAt: new Date().toISOString().slice(0, 10),
        url: publicUrl,
        mimeType: file.type || undefined,
        storagePath: publicUrl,
        source: "upload",
        linkedTo: "task",
        stepId,
        taskId,
      });
    }
  } catch (error) {
    console.error("[upload_task_files]", error);
    return { ok: false, error: "Impossible d'ajouter le fichier à cette tâche pour le moment." };
  }

  await finalizeProjectMutation(projectId, `${files.length} fichier${files.length > 1 ? "s" : ""} ajouté${files.length > 1 ? "s" : ""} à la tâche ${taskId}.`);
  revalidatePath(`/dashboard/projects/${projectId}?workspace=${workspace}`);

  const taskFiles = updatedProject?.steps
    ?.find((step) => step.id === stepId)
    ?.tasks.find((task) => task.id === taskId)
    ?.files;

  return { ok: true, files: taskFiles };
}

export async function deleteTaskFileAction(projectId: string, stepId: string, taskId: string, fileId: string) {
  const project = await getProjectById(projectId);
  const file = project?.files?.find((candidate) => candidate.id === fileId);

  if (file?.url?.startsWith("/uploads/")) {
    const publicRoot = path.join(process.cwd(), "public");
    const filePath = path.normalize(path.join(publicRoot, file.url));
    if (filePath.startsWith(publicRoot)) {
      await unlink(filePath).catch(() => undefined);
    }
  }

  await removeTaskFileFromProject(projectId, stepId, taskId, fileId);
  await finalizeProjectMutation(projectId, `fichier supprimé de la tâche ${taskId} : ${file?.name ?? fileId}.`);
}

export async function addTaskDiscussionMessageAction(
  projectId: string,
  stepId: string,
  taskId: string,
  input: { authorName: string; authorPersonId?: string; content: string },
) {
  const content = cleanActionText(input.content);
  if (!content) return;

  await appendTaskDiscussionMessage(projectId, stepId, taskId, {
    authorName: input.authorName,
    authorPersonId: input.authorPersonId,
    content,
  });
  await finalizeProjectMutation(projectId, `discussion de la tâche ${taskId} enrichie : ${content}.`);
}

export async function addProjectPersonAction(projectId: string, input: { name: string; email?: string; role?: string }) {
  await assertPaidPlan("La collaboration");
  await addProjectPerson(projectId, input);
  await finalizeProjectMutation(projectId, `personne ajoutée au projet : ${input.name}.`);
}

export async function removeProjectPersonAction(projectId: string, personId: string) {
  await assertPaidPlan("La collaboration");
  await removeProjectPerson(projectId, personId);
  await finalizeProjectMutation(projectId, `personne retirée du projet : ${personId}.`);
}

export async function addProjectTeamAction(projectId: string, input: { name: string; color?: string; memberIds?: string[] }) {
  await assertPaidPlan("La collaboration");
  await addProjectTeam(projectId, input);
  await finalizeProjectMutation(projectId, `équipe ajoutée au projet : ${input.name}.`);
}

export async function updateProjectTeamAction(projectId: string, teamId: string, input: { name?: string; color?: string; memberIds?: string[] }) {
  await assertPaidPlan("La collaboration");
  await updateProjectTeam(projectId, teamId, input);
  await finalizeProjectMutation(projectId, `équipe ${teamId} mise à jour.`);
}

export async function appendProjectTeamMessageAction(
  projectId: string,
  input: { authorName?: string; authorPersonId?: string; content: string },
) {
  const content = cleanActionText(input.content);
  if (!content) return;

  await appendProjectTeamMessage(projectId, {
    authorName: input.authorName || getActiveAccountName(),
    authorPersonId: input.authorPersonId,
    content,
  });
  await finalizeProjectMutation(projectId, `chat collaborateurs enrichi : ${content}.`);
}

export async function updateTaskStatusSettingAction(
  projectId: string,
  status: TaskStatus,
  input: { label?: string; color?: string },
) {
  await updateTaskStatusSetting(projectId, status, input);
  await finalizeProjectMutation(projectId, `libellé du statut ${status} personnalisé.`);
}

export async function updateStepStatusSettingAction(
  projectId: string,
  status: StepStatus,
  input: { label?: string; color?: string },
) {
  await updateStepStatusSetting(projectId, status, input);
  await finalizeProjectMutation(projectId, `libellé du statut d'étape ${status} personnalisé.`);
}

export async function updateProjectStatusSettingsAction(
  projectId: string,
  statusSettings: ProjectStatusSettings,
) {
  const project = await getProjectById(projectId);
  if (!project) {
    return { ok: false, error: "Projet introuvable." };
  }

  const taskDeletionError = validateDeletedTaskStatuses(project.steps ?? [], statusSettings);
  if (taskDeletionError) return { ok: false, error: taskDeletionError };

  const stepDeletionError = validateDeletedStepStatuses(project.steps ?? [], statusSettings);
  if (stepDeletionError) return { ok: false, error: stepDeletionError };

  await updateProject(projectId, { statusSettings });
  await finalizeProjectMutation(projectId, "personnalisation des statuts mise à jour.");
  return { ok: true };
}

const TASK_STATUS_VALUES: TaskStatus[] = ["todo", "in_progress", "waiting", "blocked", "done"];
const STEP_STATUS_VALUES: StepStatus[] = ["todo", "in_progress", "waiting", "done"];

function validateDeletedTaskStatuses(steps: Step[], statusSettings: ProjectStatusSettings) {
  for (const status of TASK_STATUS_VALUES) {
    if (statusSettings.task?.[status]?.enabled !== false) continue;
    const count = steps.flatMap((step) => step.tasks).filter((task) => deriveTaskStatus(task) === status).length;
    if (count > 0) {
      return `Impossible de supprimer ce statut : ${count} tâche${count > 1 ? "s utilisent" : " utilise"} encore ce statut.`;
    }
  }
  return null;
}

function validateDeletedStepStatuses(steps: Step[], statusSettings: ProjectStatusSettings) {
  for (const status of STEP_STATUS_VALUES) {
    if (statusSettings.step?.[status]?.enabled !== false) continue;
    const count = steps.filter((step) => deriveStepStatus(step.tasks) === status).length;
    if (count > 0) {
      return `Impossible de supprimer ce statut : ${count} étape${count > 1 ? "s utilisent" : " utilise"} encore ce statut.`;
    }
  }
  return null;
}
