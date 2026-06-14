import type { Project, Task, TaskStatus } from "@/lib/mock-data";
import { formatTaskScheduleDate } from "@/lib/date-format";
import { deriveTaskStatus } from "@/lib/project-plan";
import { nowTimeKey, todayKey } from "@/lib/timezone";

export type ProjectDetailView = "steps";
export type ProjectBoardStatus = TaskStatus;

export interface FlattenedProjectTask {
  id: string;
  stepId: string;
  stepTitle: string;
  stepOrder: number;
  taskOrder: number;
  task: Task;
  boardStatus: ProjectBoardStatus;
}

export interface ProjectActivityItem {
  id: string;
  date: string;
  title: string;
  detail: string;
  tone?: "neutral" | "success" | "warning" | "danger";
}

export function isProjectDetailView(value: string | undefined): value is ProjectDetailView {
  return value === "steps";
}

export function flattenProjectTasks(project: Project): FlattenedProjectTask[] {
  return (project.steps ?? [])
    .slice()
    .sort((left, right) => left.order - right.order)
    .flatMap((step) =>
      step.tasks
        .slice()
        .sort((left, right) => (left.order ?? 999) - (right.order ?? 999))
        .map((task, index) => ({
          id: `${step.id}_${task.id}`,
          stepId: step.id,
          stepTitle: step.title,
          stepOrder: step.order,
          taskOrder: task.order ?? index + 1,
          task,
          boardStatus: getBoardStatus(task),
        })),
    );
}

export function getBoardStatus(task: Task): ProjectBoardStatus {
  return deriveTaskStatus(task);
}

export function isTaskOverdue(task: Task, now = new Date()) {
  if (deriveTaskStatus(task) === "done" || !task.dueDate) return false;
  // Comparaison ancrée sur Europe/Paris (cf. lib/timezone) : un jour passé =
  // en retard ; le jour même, en retard seulement après l'heure d'échéance.
  const today = todayKey(now);
  if (task.dueDate < today) return true;
  if (task.dueDate > today) return false;
  if (task.dueTime) return nowTimeKey(now) > task.dueTime;
  return false;
}

export function projectHasOverdueTask(project: Project, now = new Date()) {
  return flattenProjectTasks(project).some((entry) => isTaskOverdue(entry.task, now));
}

export function projectHasBlockedTask(project: Project) {
  return flattenProjectTasks(project).some((entry) => entry.boardStatus === "blocked");
}

export function projectPendingTaskCount(project: Project) {
  const flattened = flattenProjectTasks(project);
  if (flattened.length > 0) {
    return flattened.filter((entry) => entry.boardStatus !== "done").length;
  }
  return project.actions.filter((action) => !action.done).length;
}

export function getProjectInactiveDays(project: Project, now = new Date()) {
  const updatedAt = new Date(project.updatedAt);
  const diff = now.getTime() - updatedAt.getTime();
  return Math.max(0, Math.floor(diff / (1000 * 60 * 60 * 24)));
}

export function isProjectInactive(project: Project, days = 4, now = new Date()) {
  return getProjectInactiveDays(project, now) >= days;
}

export function deriveProjectActivity(project: Project): ProjectActivityItem[] {
  if (project.activity && project.activity.length > 0) {
    return project.activity
      .slice()
      .sort((left, right) => right.date.localeCompare(left.date));
  }

  const items: ProjectActivityItem[] = [
    {
      id: `${project.id}_updated`,
      date: project.updatedAt,
      title: "Dernière mise à jour",
      detail: `Le projet a bougé pour la dernière fois le ${project.updatedAt.slice(0, 10)}.`,
      tone: "neutral",
    },
  ];

  project.blockers
    .filter((blocker) => blocker.status === "open")
    .slice(0, 1)
    .forEach((blocker) => {
      items.push({
        id: `${project.id}_blocker_${blocker.id}`,
        date: project.updatedAt,
        title: "Blocage détecté",
        detail: blocker.label,
        tone: "danger",
      });
    });

  return items.sort((left, right) => right.date.localeCompare(left.date)).slice(0, 5);
}

export function formatDueLabel(task: Task) {
  if (!task.dueDate) return "Sans échéance";
  return formatTaskScheduleDate(task.dueDate, task.dueTime);
}
