"use server";

import { refresh, revalidatePath } from "next/cache";
import {
  createStandaloneTask,
  deleteStandaloneTask,
  toggleStandaloneTaskDone,
  updateStandaloneTask,
} from "@/lib/standalone-tasks-store";
import { generateStandaloneTask } from "@/lib/ai/standalone-task";
import { assertPaidPlan } from "@/lib/account-plan";
import { getWorkspace } from "@/lib/workspace";
import type { ChecklistItem, TaskDiscussionMessage, TaskStatus } from "@/lib/mock-data";
import type { ProjectPriority } from "@/lib/project-taxonomy";

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

export async function deleteStandaloneTaskAction(id: string) {
  await deleteStandaloneTask(id);
  revalidateTasks();
}

export async function toggleStandaloneTaskDoneAction(id: string) {
  await toggleStandaloneTaskDone(id);
  revalidateTasks();
}
