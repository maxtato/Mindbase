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

type Translate = (key: string, vars?: Record<string, string | number>) => string;

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

function dueTag(daysUntil: number, t: Translate): { tag: string; tone: FocusTone; weight: number } | null {
  if (daysUntil < 0) return { tag: t("focus.tag.overdue"), tone: "danger", weight: 1000 - daysUntil };
  if (daysUntil === 0) return { tag: t("focus.tag.today"), tone: "warn", weight: 800 };
  if (daysUntil === 1) return { tag: t("focus.tag.tomorrow"), tone: "warn", weight: 600 };
  if (daysUntil <= 3) return { tag: t("focus.tag.inDays", { count: daysUntil }), tone: "info", weight: 400 - daysUntil };
  return null;
}

function buildActions(projects: Project[], workspace: Workspace, t: Translate, now: Date): FocusAction[] {
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
        descriptor = { tag: t("focus.tag.overdue"), tone: "danger", weight: 1000 + (daysUntil !== null ? -daysUntil : 0) };
      } else if (daysUntil !== null) {
        descriptor = dueTag(daysUntil, t);
      }
      // Tâche prioritaire sans échéance imminente → on la remonte quand même.
      if (!descriptor && highPriority) {
        descriptor = { tag: t("focus.tag.priority"), tone: "info", weight: 300 };
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

function buildAttention(projects: Project[], t: Translate, now: Date): { list: FocusAttentionProject[]; total: number } {
  const scored = projects
    .map((project) => ({ project, health: computeProjectHealth(project, t, now) }))
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

function buildBrief(counts: { dueToday: number; overdue: number; attention: number }, t: Translate): string {
  const parts: string[] = [];
  if (counts.overdue > 0) parts.push(t(counts.overdue > 1 ? "focus.brief.overdueOther" : "focus.brief.overdueOne", { count: counts.overdue }));
  if (counts.dueToday > 0) parts.push(t(counts.dueToday > 1 ? "focus.brief.todayOther" : "focus.brief.todayOne", { count: counts.dueToday }));
  if (counts.attention > 0) parts.push(t(counts.attention > 1 ? "focus.brief.attentionOther" : "focus.brief.attentionOne", { count: counts.attention }));

  if (parts.length === 0) return t("focus.brief.allClear");
  if (parts.length === 1) return `${parts[0]}.`;
  return `${parts.slice(0, -1).join(", ")} ${t("focus.join.and")} ${parts[parts.length - 1]}.`;
}

export function buildDailyFocus(projects: Project[], workspace: Workspace, t: Translate, now = new Date()): DailyFocus {
  const open = projects.filter((project) => project.status !== "completed");
  const actions = buildActions(open, workspace, t, now);
  const { list: attention, total: attentionTotal } = buildAttention(open, t, now);
  const { dueToday, overdue } = countToday(open, now);
  const counts = { dueToday, overdue, attention: attentionTotal };

  return {
    brief: buildBrief(counts, t),
    actions,
    attention,
    counts,
    allClear: actions.length === 0 && attention.length === 0,
  };
}

export function formatFocusDate(locale = "fr", now = new Date()): string {
  const intlLocale = locale === "en" ? "en-US" : "fr-FR";
  const formatted = now.toLocaleDateString(intlLocale, { weekday: "long", day: "numeric", month: "long" });
  return formatted.charAt(0).toUpperCase() + formatted.slice(1);
}
