// Moteur « Focus / Aujourd'hui » — agrège, tous projets confondus, ce qui
// réclame l'attention MAINTENANT : les actions prioritaires du jour et les
// projets qui dérivent. 100 % déterministe (réutilise project-health +
// project-insights), donc instantané, gratuit et fiable.

import type { Project, Task } from "@/lib/mock-data";
import type { Workspace } from "@/lib/workspace";
import { flattenProjectTasks, isTaskOverdue } from "@/lib/project-insights";
import { deriveTaskDisplayPriority, deriveTaskStatus } from "@/lib/project-plan";
import { computeProjectHealth, type HealthLevel } from "@/lib/project-health";
import { resolveProjectSubcategoryDisplay } from "@/lib/project-taxonomy";
import { daysFromToday, todayKey } from "@/lib/timezone";

export type FocusTone = "danger" | "warn" | "info" | "neutral";

export interface FocusAction {
  key: string;
  title: string;
  projectName: string;
  projectColor: string;
  href: string;
  /** Étiquette courte : « En retard », « Aujourd'hui »… */
  tag: string;
  tone: FocusTone;
  /** Score interne de tri (plus haut = plus urgent). */
  weight: number;
}

export interface FocusAttentionProject {
  key: string;
  name: string;
  color: string;
  level: HealthLevel;
  causeShort: string;
  actionLabel: string;
  href: string;
}

export interface DailyFocus {
  /** Phrase d'accroche résumant la journée. */
  brief: string;
  actions: FocusAction[];
  attention: FocusAttentionProject[];
  counts: { dueToday: number; overdue: number; attention: number };
  /** true quand rien ne réclame d'attention (état « tout est sous contrôle »). */
  allClear: boolean;
}

function dueTag(daysUntil: number): { tag: string; tone: FocusTone; weight: number } | null {
  if (daysUntil < 0) return { tag: "En retard", tone: "danger", weight: 1000 - daysUntil };
  if (daysUntil === 0) return { tag: "Aujourd'hui", tone: "warn", weight: 800 };
  if (daysUntil === 1) return { tag: "Demain", tone: "warn", weight: 600 };
  if (daysUntil <= 3) return { tag: `Dans ${daysUntil} j`, tone: "info", weight: 400 - daysUntil };
  return null;
}

function buildActions(projects: Project[], workspace: Workspace, now: Date): FocusAction[] {
  const actions: FocusAction[] = [];

  for (const project of projects) {
    const color = resolveProjectSubcategoryDisplay(project).color;
    for (const entry of flattenProjectTasks(project)) {
      const task = entry.task;
      const status = deriveTaskStatus(task);
      if (status === "done") continue;

      const daysUntil = task.dueDate ? daysFromToday(task.dueDate, now) : null;
      const overdue = isTaskOverdue(task, now);
      const highPriority = deriveTaskDisplayPriority(task, now) === "high";

      let descriptor: { tag: string; tone: FocusTone; weight: number } | null = null;
      if (overdue && task.dueDate) {
        descriptor = { tag: "En retard", tone: "danger", weight: 1000 + (daysUntil !== null ? -daysUntil : 0) };
      } else if (daysUntil !== null) {
        descriptor = dueTag(daysUntil);
      }
      // Tâche prioritaire sans échéance imminente → on la remonte quand même.
      if (!descriptor && highPriority) {
        descriptor = { tag: "Prioritaire", tone: "info", weight: 300 };
      }
      if (!descriptor) continue;

      // Bonus de priorité haute pour départager.
      const weight = descriptor.weight + (highPriority ? 50 : 0);

      actions.push({
        key: `${project.id}-${task.id}`,
        title: task.title,
        projectName: project.name,
        projectColor: color,
        href: `/dashboard/projects/${project.id}?workspace=${workspace}&taskId=${task.id}`,
        tag: descriptor.tag,
        tone: descriptor.tone,
        weight,
      });
    }
  }

  actions.sort((a, b) => b.weight - a.weight);
  return actions.slice(0, 5);
}

function buildAttention(projects: Project[], now: Date): { list: FocusAttentionProject[]; total: number } {
  const scored = projects
    .map((project) => ({ project, health: computeProjectHealth(project, now) }))
    .filter(({ health }) => health.level === "risk" || health.level === "critical")
    .sort((a, b) => b.health.score - a.health.score);

  const list = scored.slice(0, 3).map(({ project, health }) => ({
    key: project.id,
    name: project.name,
    color: resolveProjectSubcategoryDisplay(project).color,
    level: health.level,
    causeShort: health.causeShort,
    actionLabel: health.nextAction.label,
    href: health.nextAction.href ?? `/dashboard/projects/${project.id}?workspace=${project.workspace}`,
  }));

  return { list, total: scored.length };
}

function countToday(projects: Project[], now: Date) {
  const today = todayKey(now);
  let dueToday = 0;
  let overdue = 0;
  for (const project of projects) {
    for (const entry of flattenProjectTasks(project)) {
      const task: Task = entry.task;
      if (deriveTaskStatus(task) === "done") continue;
      if (isTaskOverdue(task, now)) {
        overdue += 1;
        continue;
      }
      if (task.dueDate === today) dueToday += 1;
    }
  }
  return { dueToday, overdue };
}

function buildBrief(counts: { dueToday: number; overdue: number; attention: number }): string {
  const parts: string[] = [];
  if (counts.overdue > 0) parts.push(`${counts.overdue} en retard`);
  if (counts.dueToday > 0) parts.push(`${counts.dueToday} pour aujourd'hui`);
  if (counts.attention > 0) parts.push(`${counts.attention} projet${counts.attention > 1 ? "s" : ""} à surveiller`);

  if (parts.length === 0) return "Tout est sous contrôle — rien d'urgent aujourd'hui.";
  if (parts.length === 1) return `Aujourd'hui : ${parts[0]}.`;
  return `Aujourd'hui : ${parts.slice(0, -1).join(", ")} et ${parts[parts.length - 1]}.`;
}

export function buildDailyFocus(projects: Project[], workspace: Workspace, now = new Date()): DailyFocus {
  const open = projects.filter((project) => project.status !== "completed");
  const actions = buildActions(open, workspace, now);
  const { list: attention, total: attentionTotal } = buildAttention(open, now);
  const { dueToday, overdue } = countToday(open, now);
  const counts = { dueToday, overdue, attention: attentionTotal };

  return {
    brief: buildBrief(counts),
    actions,
    attention,
    counts,
    allClear: actions.length === 0 && attention.length === 0,
  };
}

export function formatFocusDate(now = new Date()): string {
  const formatted = now.toLocaleDateString("fr-FR", { weekday: "long", day: "numeric", month: "long" });
  return formatted.charAt(0).toUpperCase() + formatted.slice(1);
}
