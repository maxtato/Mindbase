// Activité récente — flux discret des dernières modifications projet.
// Reconstruit côté serveur à partir de project.updatedAt + tâches done +
// risques signalés. Pas d'historique de log : on déduit du state.

import Link from "next/link";
import type { Project, Task } from "@/lib/mock-data";
import { formatShortDate } from "@/lib/date-format";
import { surface, text } from "@/lib/design-tokens";

export interface ActivityEntry {
  id: string;
  date: Date;
  kind: "task-done" | "risk-added" | "project-updated" | "project-created";
  projectId: string;
  projectName: string;
  text: string;
}

interface ActivityFeedPanelProps {
  entries: ActivityEntry[];
  workspace: string;
}

export function ActivityFeedPanel({ entries, workspace }: ActivityFeedPanelProps) {
  if (entries.length === 0) {
    return (
      <p className="text-xs" style={{ color: text.muted }}>
        Aucune activité récente détectée.
      </p>
    );
  }
  return (
    <ul className="flex flex-col gap-1.5">
      {entries.slice(0, 8).map((entry) => (
        <li key={entry.id}>
          <Link
            href={`/dashboard/projects/${entry.projectId}?workspace=${workspace}`}
            className="flex items-start gap-2.5 rounded-xl px-3 py-2 text-[12px]"
            style={{
              background: surface.s1,
              border: `1px solid ${surface.borderSubtle}`,
            }}
          >
            <ActivityIcon kind={entry.kind} />
            <div className="min-w-0 flex-1">
              <p className="truncate" style={{ color: text.primary }}>
                {entry.text}
              </p>
              <p className="mt-0.5 truncate text-[10.5px]" style={{ color: text.muted }}>
                {entry.projectName} · {formatRelative(entry.date)}
              </p>
            </div>
          </Link>
        </li>
      ))}
    </ul>
  );
}

function ActivityIcon({ kind }: { kind: ActivityEntry["kind"] }) {
  const palette: Record<ActivityEntry["kind"], { bg: string; color: string }> = {
    "task-done": { bg: "var(--mb-status-green-bg)", color: "var(--mb-status-green-text)" },
    "risk-added": { bg: "var(--mb-status-red-bg)", color: "var(--mb-status-red-text)" },
    "project-updated": { bg: "var(--mb-status-blue-bg)", color: "var(--mb-status-blue-text)" },
    "project-created": { bg: surface.s2, color: text.muted },
  };
  const { bg, color } = palette[kind];
  return (
    <span
      aria-hidden
      className="mt-0.5 inline-flex h-6 w-6 shrink-0 items-center justify-center rounded-lg"
      style={{ background: bg, color }}
    >
      {kind === "task-done" && (
        <svg width="11" height="11" viewBox="0 0 16 16" fill="none">
          <path d="M3 8.4l3.2 3.2L13 5" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round" />
        </svg>
      )}
      {kind === "risk-added" && (
        <svg width="11" height="11" viewBox="0 0 16 16" fill="none">
          <path d="M8 2.5l6.5 11h-13Z" stroke="currentColor" strokeWidth="1.5" strokeLinejoin="round" />
          <path d="M8 7v3" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" />
          <circle cx="8" cy="11.7" r="0.7" fill="currentColor" />
        </svg>
      )}
      {kind === "project-updated" && (
        <svg width="11" height="11" viewBox="0 0 16 16" fill="none">
          <path d="M3 8a5 5 0 0 1 9-3M13 8a5 5 0 0 1-9 3" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" />
          <path d="M12 2v3h-3M4 14v-3h3" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
        </svg>
      )}
      {kind === "project-created" && (
        <svg width="11" height="11" viewBox="0 0 16 16" fill="none">
          <path d="M8 3v10M3 8h10" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" />
        </svg>
      )}
    </span>
  );
}

function formatRelative(date: Date): string {
  const now = Date.now();
  const diff = now - date.getTime();
  const minutes = Math.floor(diff / 60000);
  if (minutes < 1) return "à l'instant";
  if (minutes < 60) return `il y a ${minutes} min`;
  const hours = Math.floor(minutes / 60);
  if (hours < 24) return `il y a ${hours} h`;
  const days = Math.floor(hours / 24);
  if (days < 7) return `il y a ${days} j`;
  return formatShortDate(date);
}

// Construit le flux d'activité à partir des projets.
// Heuristique : on prend le updatedAt projet, les tâches récemment terminées,
// et les risques ouverts les plus récents.
export function buildActivityFeed(projects: Project[]): ActivityEntry[] {
  const entries: ActivityEntry[] = [];
  const horizon = Date.now() - 1000 * 60 * 60 * 24 * 30;

  for (const project of projects) {
    // Update du projet lui-même
    const updatedAt = new Date(project.updatedAt);
    if (!Number.isNaN(updatedAt.getTime()) && updatedAt.getTime() > horizon) {
      entries.push({
        id: `proj-${project.id}-updated`,
        date: updatedAt,
        kind: "project-updated",
        projectId: project.id,
        projectName: project.name,
        text: "Projet mis à jour",
      });
    }

    // Tâches récemment terminées
    for (const step of project.steps ?? []) {
      for (const task of step.tasks) {
        const completedAt = (task as Task).completedAt;
        if (!completedAt) continue;
        const date = new Date(completedAt);
        if (Number.isNaN(date.getTime()) || date.getTime() < horizon) continue;
        entries.push({
          id: `task-done-${project.id}-${task.id}`,
          date,
          kind: "task-done",
          projectId: project.id,
          projectName: project.name,
          text: `Tâche terminée : ${task.title}`,
        });
      }
    }

    // Risques ouverts (proxy : pas de timestamp réel, on les rattache au projet
    // updatedAt mais avec un titre risque pour différencier le label)
    const openRisks = (project.risks ?? []).filter((risk) => risk.status === "open");
    if (openRisks.length > 0 && !Number.isNaN(updatedAt.getTime()) && updatedAt.getTime() > horizon) {
      const top = openRisks[0];
      entries.push({
        id: `risk-${project.id}-${top.id}`,
        date: updatedAt,
        kind: "risk-added",
        projectId: project.id,
        projectName: project.name,
        text: `Risque ouvert : ${top.title}`,
      });
    }
  }

  return entries.sort((a, b) => b.date.getTime() - a.date.getTime());
}
