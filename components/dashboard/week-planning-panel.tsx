// Planning des 7 prochains jours.
// 4 buckets : En retard / Aujourd'hui / Demain / Cette semaine.
// Chaque tâche : titre + projet + statut + date + indicateur retard.
// Ce bloc n'est PAS le calendrier complet — juste un aperçu pour décider.

import Link from "next/link";
import type { Project, Task } from "@/lib/mock-data";
import { formatShortDate } from "@/lib/date-format";
import { surface, text, error as errorTokens, statusColor } from "@/lib/design-tokens";
import { deriveTaskStatus, taskStatusLabels } from "@/lib/project-plan";
import { isTaskOverdue } from "@/lib/project-insights";

interface PlannedTask {
  id: string;
  task: Task;
  project: Project;
  stepTitle: string;
  date: Date;
  isOverdue: boolean;
}

interface WeekPlanningPanelProps {
  tasks: PlannedTask[];
  workspace: string;
  /** Limite globale de tâches affichées avant le bouton "Voir plus".
   *  Réparties selon les buckets dans l'ordre overdue → today → tomorrow → week. */
  limit?: number;
  /** Lien "Voir plus" (vers le calendrier ou une vue plus large). */
  seeMoreHref?: string;
}

export function WeekPlanningPanel({ tasks, workspace, limit = 6, seeMoreHref }: WeekPlanningPanelProps) {
  const buckets = bucketize(tasks);
  const order: Array<keyof typeof buckets> = ["overdue", "today", "tomorrow", "week"];
  const meta: Record<keyof typeof buckets, { label: string; color: string }> = {
    overdue: { label: "En retard", color: errorTokens.text },
    today: { label: "Aujourd'hui", color: statusColor.blue.text },
    tomorrow: { label: "Demain", color: statusColor.yellow.text },
    week: { label: "Cette semaine", color: text.muted },
  };

  if (order.every((key) => buckets[key].length === 0)) {
    return (
      <p className="text-xs" style={{ color: text.muted }}>
        Aucune échéance prévue dans les 7 prochains jours.
      </p>
    );
  }

  // On distribue le `limit` total entre les buckets (priorité du plus urgent
  // au moins urgent). Une fois le quota atteint, on arrête d'afficher.
  let remaining = limit;
  const totalShown = Math.min(limit, tasks.length);
  const totalHidden = tasks.length - totalShown;

  return (
    <div className="flex flex-col gap-3">
      {order.map((key) => {
        const items = buckets[key];
        if (items.length === 0 || remaining <= 0) return null;
        const visible = items.slice(0, remaining);
        remaining -= visible.length;
        return (
          <section key={key} className="flex flex-col gap-1.5">
            <div className="flex items-center justify-between gap-2">
              <p className="text-[10.5px] font-bold uppercase tracking-[0.12em]" style={{ color: meta[key].color }}>
                {meta[key].label}
              </p>
              <span className="text-[10.5px] font-semibold" style={{ color: text.muted }}>
                {items.length}
              </span>
            </div>
            <div className="flex flex-col gap-1.5">
              {visible.map((entry) => (
                <PlannedTaskRow key={entry.id} entry={entry} workspace={workspace} bucket={key} />
              ))}
            </div>
          </section>
        );
      })}
      {totalHidden > 0 && seeMoreHref && (
        <Link
          href={seeMoreHref}
          className="self-start text-[11px] font-semibold"
          style={{ color: text.muted }}
        >
          Voir plus ({totalHidden}) →
        </Link>
      )}
    </div>
  );
}

function PlannedTaskRow({
  entry,
  workspace,
  bucket,
}: {
  entry: PlannedTask;
  workspace: string;
  bucket: "overdue" | "today" | "tomorrow" | "week";
}) {
  const status = deriveTaskStatus(entry.task);
  const dateLabel = bucket === "week" ? formatShortDate(entry.date) : null;
  const railColor =
    bucket === "overdue"
      ? errorTokens.text
      : bucket === "today"
        ? statusColor.blue.text
        : bucket === "tomorrow"
          ? statusColor.yellow.text
          : text.ghost;

  return (
    <Link
      href={`/dashboard/projects/${entry.project.id}?workspace=${workspace}&taskId=${entry.task.id}`}
      className="relative flex items-center justify-between gap-2 rounded-xl px-3 py-2"
      style={{
        background: surface.s1,
        border: `1px solid ${surface.borderSubtle}`,
      }}
    >
      <span
        aria-hidden
        style={{
          position: "absolute",
          insetBlock: 6,
          left: 0,
          width: 3,
          background: railColor,
          borderRadius: 2,
        }}
      />
      <div className="min-w-0 pl-2">
        <p className="mb-task-title truncate text-[12px] font-semibold" style={{ color: text.primary }}>
          {entry.task.title}
        </p>
        <p className="mt-0.5 truncate text-[10.5px]" style={{ color: text.muted }}>
          {entry.project.name} · {taskStatusLabels[status]}
          {dateLabel ? ` · ${dateLabel}` : ""}
        </p>
      </div>
      {entry.isOverdue && (
        <span
          className="shrink-0 rounded-full px-2 py-0.5 text-[10px] font-bold"
          style={{ background: errorTokens.bg, color: errorTokens.text }}
        >
          En retard
        </span>
      )}
    </Link>
  );
}

function bucketize(tasks: PlannedTask[]) {
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  const tomorrow = new Date(today);
  tomorrow.setDate(today.getDate() + 1);
  const weekEnd = new Date(today);
  weekEnd.setDate(today.getDate() + 7);

  const result: { overdue: PlannedTask[]; today: PlannedTask[]; tomorrow: PlannedTask[]; week: PlannedTask[] } = {
    overdue: [],
    today: [],
    tomorrow: [],
    week: [],
  };
  for (const entry of tasks) {
    if (entry.isOverdue) {
      result.overdue.push(entry);
      continue;
    }
    if (sameDay(entry.date, today)) {
      result.today.push(entry);
      continue;
    }
    if (sameDay(entry.date, tomorrow)) {
      result.tomorrow.push(entry);
      continue;
    }
    if (entry.date <= weekEnd) {
      result.week.push(entry);
    }
  }
  return result;
}

function sameDay(a: Date, b: Date) {
  return a.getFullYear() === b.getFullYear() && a.getMonth() === b.getMonth() && a.getDate() === b.getDate();
}

// Helper exporté pour construire la liste à partir de tâches plates.
export function buildPlannedTasks(
  tasks: Array<{ project: Project; entry: { id: string; task: Task; stepTitle: string } }>,
): PlannedTask[] {
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  const horizon = new Date(today);
  horizon.setDate(today.getDate() + 8);

  return tasks
    .filter(({ entry }) => entry.task.dueDate)
    .map(({ project, entry }) => {
      const date = new Date(`${entry.task.dueDate}T12:00:00`);
      if (Number.isNaN(date.getTime())) return null;
      const isOverdue = isTaskOverdue(entry.task);
      // En retard ou dans la fenêtre 7j
      if (!isOverdue && date >= horizon) return null;
      return {
        id: `${project.id}-${entry.id}`,
        task: entry.task,
        project,
        stepTitle: entry.stepTitle,
        date,
        isOverdue,
      } satisfies PlannedTask;
    })
    .filter((entry): entry is PlannedTask => Boolean(entry))
    .sort((a, b) => a.date.getTime() - b.date.getTime());
}
