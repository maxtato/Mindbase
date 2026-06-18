// Moteur « Focus / Aujourd'hui » — agrège, tous projets confondus, ce qui
// réclame l'attention MAINTENANT : les actions prioritaires du jour et les
// projets qui dérivent. 100 % déterministe (réutilise project-health +
// project-insights), donc instantané, gratuit et fiable.

import type { Project, Task } from "@/lib/mock-data";
import type { StandaloneTask } from "@/lib/standalone-tasks-store";
import { workspaceTheme, type Workspace } from "@/lib/workspace";
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
  /** Renseigné pour une tâche libre : permet d'ouvrir la tâche en place. */
  standaloneId?: string;
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

function buildActions(
  projects: Project[],
  workspace: Workspace,
  t: Translate,
  now: Date,
  standaloneTasks: StandaloneTask[] = [],
): FocusAction[] {
  const actions: FocusAction[] = [];

  // Calcule le « descriptor » (tag/ton/poids) d'une tâche selon son échéance et
  // sa priorité. Commun aux tâches de projet et aux tâches libres.
  function describe(task: Task): { descriptor: { tag: string; tone: FocusTone; weight: number }; weight: number } | null {
    const daysUntil = task.dueDate ? daysFromToday(task.dueDate, now) : null;
    const overdue = isTaskOverdue(task, now);
    const highPriority = deriveTaskDisplayPriority(task, now) === "high";

    let descriptor: { tag: string; tone: FocusTone; weight: number } | null = null;
    if (overdue && task.dueDate) {
      descriptor = { tag: t("focus.tag.overdue"), tone: "danger", weight: 1000 + (daysUntil !== null ? -daysUntil : 0) };
    } else if (daysUntil !== null) {
      descriptor = dueTag(daysUntil, t);
    }
    if (!descriptor && highPriority) {
      descriptor = { tag: t("focus.tag.priority"), tone: "info", weight: 300 };
    }
    if (!descriptor) return null;
    return { descriptor, weight: descriptor.weight + (highPriority ? 50 : 0) };
  }

  for (const project of projects) {
    const color = resolveProjectSubcategoryDisplay(project).color;
    for (const entry of flattenProjectTasks(project)) {
      const task = entry.task;
      if (deriveTaskStatus(task) === "done") continue;
      const result = describe(task);
      if (!result) continue;
      actions.push({
        key: `${project.id}-${task.id}`,
        title: task.title,
        projectName: project.name,
        projectColor: color,
        href: `/dashboard/projects/${project.id}?workspace=${workspace}&taskId=${task.id}`,
        tag: result.descriptor.tag,
        tone: result.descriptor.tone,
        weight: result.weight,
      });
    }
  }

  // Tâches libres (hors projet) : mêmes règles de priorisation.
  for (const task of standaloneTasks) {
    if (deriveTaskStatus(task) === "done") continue;
    const result = describe(task);
    if (!result) continue;
    actions.push({
      key: `standalone-${task.id}`,
      title: task.title,
      projectName: t("tasks.freeBadge"),
      projectColor: workspaceTheme[task.workspace]?.accent ?? workspaceTheme[workspace].accent,
      href: `/dashboard/tasks?workspace=${task.workspace}`,
      tag: result.descriptor.tag,
      tone: result.descriptor.tone,
      weight: result.weight,
      standaloneId: task.id,
    });
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

function countToday(projects: Project[], standaloneTasks: StandaloneTask[], now: Date) {
  const today = todayKey(now);
  let dueToday = 0;
  let overdue = 0;
  const tally = (task: Task) => {
    if (deriveTaskStatus(task) === "done") return;
    if (isTaskOverdue(task, now)) {
      overdue += 1;
      return;
    }
    if (task.dueDate === today) dueToday += 1;
  };
  for (const project of projects) {
    for (const entry of flattenProjectTasks(project)) tally(entry.task);
  }
  for (const task of standaloneTasks) tally(task);
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

export function buildDailyFocus(
  projects: Project[],
  workspace: Workspace,
  t: Translate,
  standaloneTasks: StandaloneTask[] = [],
  now = new Date(),
): DailyFocus {
  const open = projects.filter((project) => project.status !== "completed");
  const openStandalone = standaloneTasks.filter((task) => deriveTaskStatus(task) !== "done");
  const actions = buildActions(open, workspace, t, now, openStandalone);
  const { list: attention, total: attentionTotal } = buildAttention(open, t, now);
  const { dueToday, overdue } = countToday(open, openStandalone, now);
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
