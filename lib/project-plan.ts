import type { Action, Project, ProjectStatus, Step, StepStatus, Task, TaskStatus } from "@/lib/mock-data";
import type { ProjectPriority } from "@/lib/project-taxonomy";
import { formatTaskScheduleDate } from "@/lib/date-format";
import { priorityVisuals } from "@/lib/project-taxonomy";
import { getVisibleTaskOwner } from "@/lib/task-people";
import { getActiveAccountName } from "@/lib/current-account";

export const projectStatusLabels: Record<ProjectStatus, string> = {
  preparing: "À préparer",
  active: "En cours",
  paused: "En pause",
  "on-hold": "En pause",
  completed: "Terminé",
  archived: "Archivé",
};

export const stepStatusLabels: Record<StepStatus, string> = {
  todo: "À faire",
  in_progress: "En cours",
  waiting: "En attente",
  done: "Terminée",
};

export const taskStatusLabels: Record<TaskStatus, string> = {
  todo: "À faire",
  in_progress: "En cours",
  waiting: "En attente",
  blocked: "Bloquée",
  done: "Terminée",
};

export type AttentionIndicatorKey =
  | "due_soon"
  | "overdue"
  | "blocked"
  | "critical_blocked"
  | "at_risk";

export interface AttentionIndicator {
  key: AttentionIndicatorKey;
  label: string;
  count?: number;
  tone: "neutral" | "warning" | "danger";
}

export interface StepComputedIndicators {
  progress: number;
  totalTasks: number;
  doneTasks: number;
  dueSoonCount: number;
  overdueCount: number;
  blockedCount: number;
  hasBlockage: boolean;
  hasCriticalBlockage: boolean;
  indicators: AttentionIndicator[];
}

export interface ProjectComputedIndicators extends StepComputedIndicators {
  riskCount: number;
  pendingDecisionCount: number;
  isAtRisk: boolean;
}

export function normalizePlanPriority(value: string | undefined | null): ProjectPriority {
  if (value === "low" || value === "medium" || value === "high") return value;
  return "medium";
}

export function deriveTaskStatus(task: Task): TaskStatus {
  if (task.done) return "done";
  if (task.status === "done") return "done";
  if (task.status === "blocked" || task.blocked) return "blocked";
  if (task.status === "waiting") return "waiting";
  if (task.status === "in_progress") return "in_progress";
  return "todo";
}

export function deriveStepStatus(tasks: Task[]): Step["status"] {
  if (tasks.length === 0) return "todo";
  const statuses = tasks.map(deriveTaskStatus);
  const doneCount = statuses.filter((status) => status === "done").length;
  if (doneCount === tasks.length) return "done";

  const remaining = statuses.filter((status) => status !== "done");
  const hasInProgress = remaining.includes("in_progress");
  if (hasInProgress) return "in_progress";

  const hasStarted = doneCount > 0;
  const allRemainingWaitingOrBlocked = remaining.every((status) => status === "waiting" || status === "blocked");
  if (allRemainingWaitingOrBlocked && (hasStarted || remaining.some((status) => status === "waiting" || status === "blocked"))) {
    return "waiting";
  }

  if (remaining.includes("waiting")) return "waiting";
  if (remaining.includes("blocked")) return "in_progress";
  if (doneCount === 0) return "todo";
  return "in_progress";
}

// La priorité d'une étape est dérivée automatiquement de la moyenne des
// priorités des tâches **encore actives** (les tâches terminées sortent
// du calcul). Renvoie `null` quand aucune tâche n'est active : dans ce
// cas, l'étape n'a plus de priorité affichable (la barre verticale
// disparaît côté UI, au même titre que celle d'une tâche terminée).
export function deriveStepPriority(tasks: Task[]): ProjectPriority | null {
  const active = tasks.filter((task) => !task.done && deriveTaskStatus(task) !== "done");
  if (active.length === 0) return null;
  const score =
    active.reduce((sum, task) => {
      const priority = deriveTaskDisplayPriority(task);
      return sum + (priority === "high" ? 3 : priority === "medium" ? 2 : 1);
    }, 0) / active.length;
  if (score >= 2.5) return "high";
  if (score >= 1.5) return "medium";
  return "low";
}

export function normalizeProjectStatus(value: string | undefined | null): ProjectStatus {
  if (value === "preparing" || value === "active" || value === "paused" || value === "completed" || value === "archived") return value;
  if (value === "on-hold") return "paused";
  return "preparing";
}

export function deriveProjectStatusFromSteps(
  currentStatus: ProjectStatus | undefined,
  steps: Step[],
): ProjectStatus {
  const normalizedStatus = normalizeProjectStatus(currentStatus);
  if (normalizedStatus === "archived") return "archived";

  const statuses = steps.map((step) => step.status);
  if (steps.length === 0) return "preparing";
  if (statuses.every((status) => status === "done")) return "completed";
  if (statuses.some((status) => status === "in_progress")) return "active";
  if (statuses.every((status) => status === "waiting" || status === "done")) return "paused";
  return "preparing";
}

export function sortSteps(steps: Step[]) {
  return steps.slice().sort((left, right) => left.order - right.order);
}

export function sortTasks(tasks: Task[]) {
  return tasks.slice().sort((left, right) => (left.order ?? 999) - (right.order ?? 999));
}

export function normalizeStoredSteps(steps: Step[], actions: Action[] = []): Step[] {
  const sourceSteps = steps.length > 0 ? steps : buildLegacyStepFromActions(actions);

  return sourceSteps.map((step, stepIndex) => {
    const tasks = sortTasks(step.tasks).map((task, taskIndex) => normalizeTask(task, taskIndex));

    return {
      ...step,
      description: step.description?.trim() || undefined,
      order: Number.isFinite(step.order) ? step.order : stepIndex + 1,
      priority: normalizePlanPriority(step.priority),
      tasks,
      status: deriveStepStatus(tasks),
    };
  });
}

export function calculateProgressFromSteps(steps: Step[]): number {
  const allTasks = steps.flatMap((step) => step.tasks);
  if (allTasks.length === 0) return 0;
  const done = allTasks.filter((task) => deriveTaskStatus(task) === "done").length;
  return Math.round((done / allTasks.length) * 100);
}

export function isTaskDueSoon(task: Task, now = new Date()): boolean {
  if (deriveTaskStatus(task) === "done" || !task.dueDate) return false;

  const dueDateTime = buildTaskDueDateTime(task);
  const diffMs = dueDateTime.getTime() - now.getTime();
  return diffMs >= 0 && diffMs <= 3 * 24 * 60 * 60 * 1000;
}

export function isTaskOverdue(task: Task, now = new Date()): boolean {
  if (deriveTaskStatus(task) === "done" || !task.dueDate) return false;

  const dueDateTime = buildTaskDueDateTime(task);
  return dueDateTime.getTime() < now.getTime();
}

export function isTaskDueTodayOrOverdue(task: Task, now = new Date()): boolean {
  if (deriveTaskStatus(task) === "done" || !task.dueDate) return false;
  return task.dueDate <= formatLocalDateKey(now);
}

export function deriveTaskDisplayPriority(task: Task, now = new Date()): ProjectPriority {
  const manual = normalizePlanPriority(task.priority);
  if (manual === "high") return "high";
  return isTaskDueTodayOrOverdue(task, now) ? "high" : manual;
}

export function calculateStepIndicators(step: Step, now = new Date()): StepComputedIndicators {
  const tasks = step.tasks ?? [];
  const totalTasks = tasks.length;
  const doneTasks = tasks.filter((task) => deriveTaskStatus(task) === "done").length;
  const activeTasks = tasks.filter((task) => deriveTaskStatus(task) !== "done");
  const dueSoonCount = tasks.filter((task) => isTaskDueSoon(task, now)).length;
  const overdueCount = tasks.filter((task) => isTaskOverdue(task, now)).length;
  const blockedCount = tasks.filter((task) => deriveTaskStatus(task) === "blocked").length;
  const allRemainingWaitingOrBlocked = activeTasks.length > 0 && activeTasks.every((task) => {
    const status = deriveTaskStatus(task);
    return status === "waiting" || status === "blocked";
  });
  const hasCriticalBlockage = allRemainingWaitingOrBlocked && blockedCount > 0;
  const hasBlockage = blockedCount > 0 && !hasCriticalBlockage;
  const progress = totalTasks === 0 ? 0 : Math.round((doneTasks / totalTasks) * 100);
  const indicators: AttentionIndicator[] = [];

  if (dueSoonCount > 0) {
    indicators.push({
      key: "due_soon",
      label: `${dueSoonCount} échéance${dueSoonCount > 1 ? "s" : ""} proche${dueSoonCount > 1 ? "s" : ""}`,
      count: dueSoonCount,
      tone: "warning",
    });
  }

  if (overdueCount > 0) {
    indicators.push({
      key: "overdue",
      label: `${overdueCount} tâche${overdueCount > 1 ? "s" : ""} en retard`,
      count: overdueCount,
      tone: "danger",
    });
  }

  if (hasCriticalBlockage) {
    indicators.push({ key: "critical_blocked", label: "Blocage critique", count: blockedCount, tone: "danger" });
  } else if (hasBlockage) {
    indicators.push({
      key: "blocked",
      label: `${blockedCount} blocage${blockedCount > 1 ? "s" : ""}`,
      count: blockedCount,
      tone: "warning",
    });
  }

  return {
    progress,
    totalTasks,
    doneTasks,
    dueSoonCount,
    overdueCount,
    blockedCount,
    hasBlockage,
    hasCriticalBlockage,
    indicators,
  };
}

export function calculateProjectIndicators(project: Project, now = new Date()): ProjectComputedIndicators {
  const steps = project.steps ?? [];
  const stepIndicators = steps.map((step) => calculateStepIndicators(step, now));
  const totalTasks = stepIndicators.reduce((total, item) => total + item.totalTasks, 0);
  const doneTasks = stepIndicators.reduce((total, item) => total + item.doneTasks, 0);
  const dueSoonCount = stepIndicators.reduce((total, item) => total + item.dueSoonCount, 0);
  const overdueCount = stepIndicators.reduce((total, item) => total + item.overdueCount, 0);
  const blockedCount = stepIndicators.reduce((total, item) => total + item.blockedCount, 0);
  const hasCriticalBlockage = stepIndicators.some((item) => item.hasCriticalBlockage);
  const hasBlockage = blockedCount > 0 && !hasCriticalBlockage;
  const riskCount = project.risks.filter((risk) => risk.status === "open" && risk.severity === "high").length;
  const pendingDecisionCount = project.decisions.filter((decision) => decision.status === "pending").length;
  const progress = totalTasks === 0 ? 0 : Math.round((doneTasks / totalTasks) * 100);
  const isAtRisk =
    hasCriticalBlockage ||
    overdueCount >= 2 ||
    blockedCount >= 3 ||
    (dueSoonCount > 0 && progress < 35) ||
    pendingDecisionCount > 0 ||
    riskCount > 0;
  const indicators: AttentionIndicator[] = [];

  if (dueSoonCount > 0) {
    indicators.push({
      key: "due_soon",
      label: `${dueSoonCount} échéance${dueSoonCount > 1 ? "s" : ""} proche${dueSoonCount > 1 ? "s" : ""}`,
      count: dueSoonCount,
      tone: "warning",
    });
  }

  if (overdueCount > 0) {
    indicators.push({
      key: "overdue",
      label: `${overdueCount} tâche${overdueCount > 1 ? "s" : ""} en retard`,
      count: overdueCount,
      tone: "danger",
    });
  }

  if (hasCriticalBlockage) {
    indicators.push({ key: "critical_blocked", label: "Blocage critique", count: blockedCount, tone: "danger" });
  } else if (hasBlockage) {
    indicators.push({
      key: "blocked",
      label: `${blockedCount} blocage${blockedCount > 1 ? "s" : ""}`,
      count: blockedCount,
      tone: "warning",
    });
  }

  if (isAtRisk) {
    indicators.push({ key: "at_risk", label: "À risque", tone: "danger" });
  }

  return {
    progress,
    totalTasks,
    doneTasks,
    dueSoonCount,
    overdueCount,
    blockedCount,
    hasBlockage,
    hasCriticalBlockage,
    riskCount,
    pendingDecisionCount,
    isAtRisk,
    indicators,
  };
}

export function formatTaskDue(task: Task) {
  if (!task.dueDate) return "Sans échéance";
  return formatTaskScheduleDate(task.dueDate, task.dueTime);
}

export type TaskDueAlertLevel = "none" | "scheduled" | "soon" | "today" | "just_overdue" | "overdue";

export function getTaskDueAlert(task: Task, now = new Date()): {
  level: TaskDueAlertLevel;
  label: string;
  detail: string;
  tone: "neutral" | "warning" | "danger";
} {
  if (task.done || task.status === "done") {
    return { level: "none", label: "Terminée", detail: formatTaskDue(task), tone: "neutral" };
  }

  if (!task.dueDate) {
    return { level: "none", label: "À planifier", detail: "Sans échéance", tone: "neutral" };
  }

  const dueDateTime = buildTaskDueDateTime(task);
  const diffMs = dueDateTime.getTime() - now.getTime();
  const oneDay = 24 * 60 * 60 * 1000;
  const sameDay = dueDateTime.toDateString() === now.toDateString();

  if (diffMs < 0 && Math.abs(diffMs) <= oneDay) {
    return { level: "just_overdue", label: "Échéance dépassée", detail: formatTaskDue(task), tone: "danger" };
  }

  if (diffMs < 0) {
    return { level: "overdue", label: "En retard", detail: formatTaskDue(task), tone: "danger" };
  }

  if (sameDay) {
    return { level: "today", label: "Aujourd'hui", detail: formatTaskDue(task), tone: "warning" };
  }

  if (diffMs <= 3 * oneDay) {
    return { level: "soon", label: "Échéance proche", detail: formatTaskDue(task), tone: "warning" };
  }

  return { level: "scheduled", label: "Planifiée", detail: formatTaskDue(task), tone: "neutral" };
}

export function buildCalendarUrl(task: Task) {
  if (!task.dueDate) return undefined;

  const start = `${task.dueDate.replaceAll("-", "")}T${(task.dueTime ?? "09:00").replace(":", "")}00`;
  const end = buildCalendarEnd(task.dueDate, task.dueTime ?? "09:00");
  const params = new URLSearchParams({
    action: "TEMPLATE",
    text: task.title,
    dates: `${start}/${end}`,
    details: task.description ?? task.guidance?.join("\n") ?? "",
  });

  return `https://calendar.google.com/calendar/render?${params.toString()}`;
}

export function getPriorityLabel(priority: ProjectPriority | undefined) {
  return priorityVisuals[normalizePlanPriority(priority)].label;
}

function normalizeTask(task: Task, taskIndex: number): Task {
  const status = deriveTaskStatus(task);
  const assignees = task.assignees?.map((name) => name.trim()).filter(Boolean);
  const teamIds = task.teamIds?.map((id) => id.trim()).filter(Boolean);
  const discussion = task.discussion
    ?.map((message) => ({
      ...message,
      authorName: message.authorName?.trim() || getActiveAccountName(),
      content: message.content?.trim() ?? "",
    }))
    .filter((message) => message.content);

  return {
    ...task,
    description: task.description?.trim() || undefined,
    done: status === "done",
    status,
    priority: normalizePlanPriority(task.priority),
    order: Number.isFinite(task.order) ? task.order : taskIndex + 1,
    owner: task.owner?.trim() || undefined,
    assignees: assignees && assignees.length > 0 ? assignees : undefined,
    teamIds: teamIds && teamIds.length > 0 ? teamIds : undefined,
    dueTime: task.dueTime?.trim() || undefined,
    blocked: status === "blocked",
    source: task.source ?? "legacy",
    completionDetails: task.completionDetails?.trim() || undefined,
    completionDecisionTitle: task.completionDecisionTitle?.trim() || undefined,
    completionSource: task.completionSource,
    realization: task.realization?.trim() || undefined,
    comments: task.comments?.map((comment) => comment.trim()).filter(Boolean),
    files: task.files && task.files.length > 0 ? task.files : undefined,
    discussion: discussion && discussion.length > 0 ? discussion : undefined,
  };
}

function buildLegacyStepFromActions(actions: Action[]): Step[] {
  if (actions.length === 0) return [];

  const tasks = actions.map<Task>((action, index) => ({
    id: `t_from_${action.id}`,
    title: action.title,
    description: action.description,
    done: action.done,
    status: action.done ? "done" : action.blocked ? "blocked" : "todo",
    owner: getVisibleTaskOwner(action.owner),
    dueDate: action.due,
    priority: normalizePlanPriority(action.priority),
    order: index + 1,
    blocked: action.blocked,
    source: "legacy",
  }));

  return [
    {
      id: "s_legacy_plan",
      title: "Plan d'exécution",
      description: "Étape créée automatiquement à partir des anciennes tâches du projet.",
      status: deriveStepStatus(tasks),
      priority: "medium",
      order: 1,
      tasks,
    },
  ];
}

function buildCalendarEnd(dueDate: string, dueTime: string) {
  const [year, month, day] = dueDate.split("-");
  const [hour, minute] = dueTime.split(":").map((value) => Number.parseInt(value, 10));
  const end = new Date(Number(year), Number(month) - 1, Number(day), hour + 1, minute, 0);
  const endYear = String(end.getFullYear()).padStart(4, "0");
  const endMonth = String(end.getMonth() + 1).padStart(2, "0");
  const endDay = String(end.getDate()).padStart(2, "0");
  const endHour = String(end.getHours()).padStart(2, "0");
  const endMinute = String(end.getMinutes()).padStart(2, "0");

  return `${endYear}${endMonth}${endDay}T${endHour}${endMinute}00`;
}

function buildTaskDueDateTime(task: Task) {
  return task.dueTime
    ? new Date(`${task.dueDate}T${task.dueTime}:00`)
    : new Date(`${task.dueDate}T23:59:59`);
}

function formatLocalDateKey(date: Date) {
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, "0")}-${String(date.getDate()).padStart(2, "0")}`;
}
