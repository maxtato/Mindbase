// Dashboard simplifié — layout 2x2 :
//   ┌──────────────────┬───────────────────┐
//   │ Répartition      │ Tâches à venir    │
//   │ (donut)          │ (planning 7 j)    │
//   ├──────────────────┼───────────────────┤
//   │ Projets ouverts  │ Activité récente  │
//   └──────────────────┴───────────────────┘
// Sur mobile : tout passe en une seule colonne.

import Link from "next/link";
import type { ReactNode } from "react";
import { Topbar } from "@/components/layout/topbar";
import { getProjectsForWorkspace } from "@/lib/project-store";
import { getWorkspace, workspaceTheme } from "@/lib/workspace";
import { flattenProjectTasks, type FlattenedProjectTask } from "@/lib/project-insights";
import { deriveTaskStatus } from "@/lib/project-plan";
import { surface, text } from "@/lib/design-tokens";
import type { Project, Task, TaskStatus } from "@/lib/mock-data";
import { StatusStackedBar } from "@/components/dashboard/status-stacked-bar";
import { WeekPlanningPanel, buildPlannedTasks } from "@/components/dashboard/week-planning-panel";
import { ActivityFeedPanel, buildActivityFeed } from "@/components/dashboard/activity-feed-panel";
import { ActiveProjectCard } from "@/components/dashboard/active-project-card";

type DashboardTask = {
  project: Project;
  entry: FlattenedProjectTask;
};

export default async function DashboardPage({
  searchParams,
}: {
  searchParams: Promise<{ workspace?: string }>;
}) {
  const sp = await searchParams;
  const workspace = getWorkspace(sp.workspace);
  const theme = workspaceTheme[workspace];
  const qs = `workspace=${workspace}`;

  const projects = (await getProjectsForWorkspace(workspace)).filter(
    (project) => project.status !== "archived" && !project.deleted,
  );

  // Projets actifs (non terminés)
  const openProjects = projects.filter((project) => project.status !== "completed");

  // Liste plate de toutes les tâches
  const allTasks: DashboardTask[] = projects.flatMap((project) =>
    flattenProjectTasks(project).map((entry) => ({ project, entry })),
  );

  // Répartition par statut (pour le donut)
  const breakdown = computeStatusBreakdown(allTasks.map(({ entry }) => entry.task));
  const totalTasks = Object.values(breakdown).reduce((sum, n) => sum + n, 0);

  // Tâches à venir (en retard + 7 jours)
  const openTasks = allTasks.filter(
    ({ entry }) => deriveTaskStatus(entry.task) !== "done",
  );
  const plannedTasks = buildPlannedTasks(openTasks);

  // Activité récente (dérivée du state des projets)
  const activityFeed = buildActivityFeed(projects);

  return (
    <div className="flex h-full flex-col overflow-hidden">
      <Topbar title="Dashboard" workspace={workspace} />

      <main className="mb-page-scroll mb-mobile-scroll flex-1 overflow-y-auto px-4 py-5 lg:px-6">
        <div className="mx-auto flex w-full max-w-[1480px] flex-col gap-4">
          {/* Bandeau d'accroche minimaliste : juste un CTA pour créer un projet. */}
          <section
            className="flex flex-col gap-3 rounded-[20px] px-5 py-4 sm:flex-row sm:items-center sm:justify-between"
            style={{
              background: surface.s1,
              border: `1px solid ${surface.borderSubtle}`,
              boxShadow: "var(--mb-shadow-xs)",
            }}
          >
            <div className="min-w-0">
              <p
                className="text-[10px] font-semibold uppercase tracking-[0.14em]"
                style={{ color: theme.accent }}
              >
                Cockpit · {theme.label}
              </p>
              <h1 className="mt-1 text-[1.15rem] font-bold leading-snug" style={{ color: text.primary }}>
                Vue d'ensemble
              </h1>
            </div>
            <Link
              href={`/dashboard/projects/new?${qs}`}
              className="inline-flex items-center justify-center gap-1.5 rounded-full px-4 py-2 text-[12px] font-semibold whitespace-nowrap"
              style={{ background: theme.accent, color: "#FFFFFF", border: "none" }}
            >
              <span aria-hidden style={{ fontSize: 14, lineHeight: 1 }}>
                +
              </span>
              Créer un projet
            </Link>
          </section>

          {/* Grid 2×2 — desktop. Sur mobile, tout passe en une colonne. */}
          <div className="grid gap-4 lg:grid-cols-2">
            <Card
              title="Répartition des tâches"
              meta={totalTasks > 0 ? `${totalTasks} tâche${totalTasks > 1 ? "s" : ""}` : undefined}
              accent={theme.accent}
            >
              <StatusStackedBar breakdown={breakdown} />
            </Card>

            <Card
              title="Tâches à venir"
              meta={plannedTasks.length > 0 ? `${plannedTasks.length}` : undefined}
              accent={theme.accent}
            >
              <WeekPlanningPanel tasks={plannedTasks} workspace={workspace} />
            </Card>

            <Card
              title="Projets ouverts"
              meta={`${openProjects.length} projet${openProjects.length > 1 ? "s" : ""}`}
              accent={theme.accent}
              action={
                openProjects.length > 0 ? (
                  <Link
                    href={`/dashboard/projects?${qs}`}
                    className="text-[11px] font-semibold"
                    style={{ color: theme.accent }}
                  >
                    Voir tous →
                  </Link>
                ) : undefined
              }
            >
              {openProjects.length === 0 ? (
                <EmptyState label="Aucun projet ouvert dans cet espace." />
              ) : (
                <div className="grid gap-3">
                  {openProjects.slice(0, 4).map((project) => (
                    <ActiveProjectCard key={project.id} project={project} workspace={workspace} />
                  ))}
                </div>
              )}
            </Card>

            <Card
              title="Activité récente"
              meta={activityFeed.length > 0 ? `${activityFeed.length}` : undefined}
              accent={theme.accent}
            >
              <ActivityFeedPanel entries={activityFeed} workspace={workspace} />
            </Card>
          </div>
        </div>
      </main>
    </div>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// UI primitives — locales au dashboard pour rester homogène sans dépendances
// supplémentaires.
// ─────────────────────────────────────────────────────────────────────────────

interface CardProps {
  title: string;
  meta?: string;
  accent: string;
  action?: ReactNode;
  children: ReactNode;
}

function Card({ title, meta, accent, action, children }: CardProps) {
  return (
    <section
      className="flex min-w-0 flex-col gap-3 rounded-[20px] p-4 lg:p-5"
      style={{
        background: surface.s1,
        border: `1px solid ${surface.borderSubtle}`,
        boxShadow: "var(--mb-shadow-xs)",
      }}
    >
      <header className="flex items-center justify-between gap-3">
        <div className="flex min-w-0 items-center gap-2">
          <span
            aria-hidden
            className="inline-block h-2 w-2 rounded-full"
            style={{ background: accent }}
          />
          <h2 className="truncate text-[12.5px] font-bold uppercase tracking-[0.1em]" style={{ color: text.primary }}>
            {title}
          </h2>
          {meta && (
            <span className="shrink-0 text-[11px] font-semibold" style={{ color: text.muted }}>
              · {meta}
            </span>
          )}
        </div>
        {action}
      </header>
      <div className="min-w-0">{children}</div>
    </section>
  );
}

function EmptyState({ label }: { label: string }) {
  return (
    <p className="py-2 text-[12px]" style={{ color: text.muted }}>
      {label}
    </p>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// Helpers
// ─────────────────────────────────────────────────────────────────────────────

function computeStatusBreakdown(tasks: Task[]): Record<TaskStatus, number> {
  const breakdown: Record<TaskStatus, number> = {
    todo: 0,
    in_progress: 0,
    waiting: 0,
    blocked: 0,
    done: 0,
  };
  for (const task of tasks) {
    const status = deriveTaskStatus(task);
    breakdown[status] += 1;
  }
  return breakdown;
}
