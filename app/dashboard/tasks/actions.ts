"use server";

import { refresh, revalidatePath } from "next/cache";
import {
  createStandaloneTask,
  deleteStandaloneTask,
  getStandaloneTasks,
  toggleStandaloneTaskDone,
  updateStandaloneTask,
} from "@/lib/standalone-tasks-store";
import { generateStandaloneTask } from "@/lib/ai/standalone-task";
import { refineStandaloneTaskExpected, type ExpectedMessage, type ExpectedRefineResult } from "@/lib/ai/task-expected";
import { generateStandaloneTaskChecklist } from "@/lib/ai/task-checklist";
import { assertPaidPlan } from "@/lib/account-plan";
import { getWorkspace } from "@/lib/workspace";
import type { ChecklistItem, TaskDiscussionMessage, TaskStatus } from "@/lib/mock-data";
import type { ProjectPriority } from "@/lib/project-taxonomy";

async function loadStandaloneTaskOrThrow(id: string) {
  const tasks = await getStandaloneTasks();
  const task = tasks.find((candidate) => candidate.id === id);
  if (!task) throw new Error("Tâche introuvable.");
  return task;
}

function revalidateTasks() {
  // Les tâches autonomes apparaissent sur l'onglet Tâches, le Kanban et le
  // Calendrier → on rafraîchit largement.
  revalidatePath("/", "layout");
  refresh();
}

export async function createStandaloneTaskAction(input: {
  title: string;
  workspace: string;
  expected?: string;
  dueDate?: string;
  dueTime?: string;
  priority?: ProjectPriority;
}) {
  const title = input.title.trim();
  if (!title) return;
  await createStandaloneTask({
    title,
    workspace: getWorkspace(input.workspace),
    expected: input.expected,
    dueDate: input.dueDate,
    dueTime: input.dueTime,
    priority: input.priority,
  });
  revalidateTasks();
}

export async function generateStandaloneTaskAction(input: { description: string; workspace: string }) {
  // Génération assistée par l'IA réservée au plan Pro.
  await assertPaidPlan();
  const description = input.description.trim();
  if (!description) return null;
  const today = new Date().toISOString().slice(0, 10);
  const generated = await generateStandaloneTask(description, today);
  const created = await createStandaloneTask({
    title: generated.title,
    workspace: getWorkspace(input.workspace),
    expected: generated.expected,
    dueDate: generated.dueDate,
    priority: generated.priority,
    source: "ai",
  });
  revalidateTasks();
  return created;
}

export async function updateStandaloneTaskAction(
  id: string,
  input: {
    title?: string;
    expected?: string;
    realization?: string;
    owner?: string;
    assignees?: string[];
    teamIds?: string[];
    dueDate?: string;
    dueTime?: string;
    status?: TaskStatus;
    priority?: ProjectPriority;
    comments?: string[];
    checklist?: ChecklistItem[];
    discussion?: TaskDiscussionMessage[];
  },
) {
  await updateStandaloneTask(id, input);
  revalidateTasks();
}

// ─── Assistant IA pour les tâches LIBRES (attendu + checklist) ──────────────
// Mêmes capacités que sur une tâche de projet, mais sans contexte projet : l'IA
// s'appuie uniquement sur la tâche libre elle-même.

export async function refineStandaloneTaskExpectedAction(input: {
  taskId: string;
  messages: ExpectedMessage[];
}): Promise<ExpectedRefineResult> {
  await assertPaidPlan("L'assistant IA");
  const task = await loadStandaloneTaskOrThrow(input.taskId);
  return refineStandaloneTaskExpected({ task, messages: input.messages });
}

export async function suggestStandaloneTaskChecklistAction(input: {
  taskId: string;
}): Promise<{ items: string[] }> {
  await assertPaidPlan("L'assistant IA");
  const task = await loadStandaloneTaskOrThrow(input.taskId);
  const items = await generateStandaloneTaskChecklist(task);
  return { items };
}

export async function applyStandaloneTaskChecklistAction(input: {
  taskId: string;
  items: string[];
  mode: "replace" | "append";
}): Promise<{ checklist: ChecklistItem[] }> {
  const task = await loadStandaloneTaskOrThrow(input.taskId);
  const cleaned = input.items.map((item) => item.trim()).filter(Boolean);
  const newItems: ChecklistItem[] = cleaned.map((label, index) => ({
    id: `cl_${Date.now()}_${index}`,
    label,
    done: false,
  }));
  const checklist = input.mode === "replace" ? newItems : [...(task.checklist ?? []), ...newItems];
  await updateStandaloneTask(input.taskId, { checklist });
  revalidateTasks();
  return { checklist };
}

export async function deleteStandaloneTaskAction(id: string) {
  await deleteStandaloneTask(id);
  revalidateTasks();
}

export async function toggleStandaloneTaskDoneAction(id: string) {
  await toggleStandaloneTaskDone(id);
  revalidateTasks();
}
