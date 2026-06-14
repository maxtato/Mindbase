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
import { flattenProjectTasks, isTaskOverdue, type FlattenedProjectTask } from "@/lib/project-insights";
import { deriveTaskStatus } from "@/lib/project-plan";
import { surface, text, error as errorTokens, statusColor } from "@/lib/design-tokens";
import type { Project, Task, TaskStatus } from "@/lib/mock-data";
import { StatusStackedBar } from "@/components/dashboard/status-stacked-bar";
import { WeekPlanningPanel, buildPlannedTasks } from "@/components/dashboard/week-planning-panel";
import { ActivityFeedPanel, buildActivityFeed } from "@/components/dashboard/activity-feed-panel";
import { KpiCard, type KpiTask } from "@/components/dashboard/kpi-card";
import { FocusPanel } from "@/components/dashboard/focus-panel";
import { buildDailyFocus, formatFocusDate } from "@/lib/project-focus";
import { resolveProjectSubcategoryDisplay } from "@/lib/project-taxonomy";

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

  // KPI principaux affichés en haut du dashboard. Les listes sont ensuite
  // injectées dans le popover de chaque KpiCard pour permettre à l'utilisateur
  // de drill-down sur les tâches concernées.
  const kpiProjects = openProjects.length;
  const overdueTasks = openTasks.filter(({ entry }) => isTaskOverdue(entry.task));
  const kpiTasks = openTasks.length;
  const kpiOverdue = overdueTasks.length;

  const taskHref = (item: DashboardTask) =>
    `/dashboard/projects/${item.project.id}?workspace=${workspace}&taskId=${item.entry.task.id}`;
  const toKpiTask = (item: DashboardTask, meta?: KpiTask["meta"], metaTone?: KpiTask["metaTone"]): KpiTask => ({
    key: `${item.project.id}-${item.entry.task.id}`,
    title: item.entry.task.title,
    projectName: item.project.name,
    projectColor: resolveProjectSubcategoryDisplay(item.project).color,
    href: taskHref(item),
    meta,
    metaTone,
  });

  const openTasksKpi = openTasks.map((item) => toKpiTask(item));
  const overdueTasksKpi = overdueTasks.map((item) => toKpiTask(item, "En retard", "danger"));

  // Bloc « Focus / Aujourd'hui » : actions prioritaires + projets qui dérivent.
  const focus = buildDailyFocus(projects, workspace);
  const focusDate = formatFocusDate();

  return (
    <div className="flex h-full flex-col overflow-hidden">
      <Topbar title="Dashboard" workspace={workspace} />

      <main className="mb-page-scroll mb-mobile-scroll flex-1 overflow-y-auto px-4 py-5 lg:px-6">
        <div className="mx-auto flex w-full max-w-[1480px] flex-col gap-4">
          {/* Bouton « Créer un projet » tout en haut du dashboard. */}
          <div className="mb-rise flex justify-end">
            <Link
              href={`/dashboard/projects/new?${qs}`}
              className="inline-flex items-center justify-center gap-1.5 rounded-full px-4 py-2.5 text-[13px] font-semibold whitespace-nowrap"
              style={{ background: theme.accent, color: "#FFFFFF", border: "none", boxShadow: `0 6px 16px -8px ${theme.accent}` }}
            >
              <span aria-hidden style={{ fontSize: 15, lineHeight: 1 }}>
                +
              </span>
              Créer un projet
            </Link>
          </div>

          {/* Focus proactif : la première chose visible — quoi faire maintenant
              et quels projets surveiller (réutilise project-health + insights). */}
          <div className="mb-rise" style={{ animationDelay: "60ms" }}>
            <FocusPanel
              focus={focus}
              dateLabel={focusDate}
              accent={theme.accent}
              workspaceLabel={theme.label}
            />
          </div>

          {/* KPI principaux — rangée de 3 chiffres. Les KPI tâches ouvrent
              un popover listant les tâches concernées (clic sur une tâche
              du popover → navigation vers la page projet + drawer auto-
              ouvert). KPI projets reste un lien vers la liste des projets. */}
          <section className="mb-rise grid grid-cols-3 gap-3" style={{ animationDelay: "70ms" }}>
            <KpiCard
              label="Projets"
              value={kpiProjects}
              tone="info"
              href={`/dashboard/projects?${qs}`}
            />
            <KpiCard
              label="Tâches ouvertes"
              value={kpiTasks}
              tone={kpiTasks > 0 ? "warn" : "neutral"}
              tasks={openTasksKpi}
              emptyLabel="Aucune tâche ouverte."
            />
            <KpiCard
              label="En retard"
              value={kpiOverdue}
              tone={kpiOverdue > 0 ? "critical" : "neutral"}
              tasks={overdueTasksKpi}
              emptyLabel="Aucune tâche en retard."
            />
          </section>

          {/* Grid 2×2 — desktop. Sur mobile, tout passe en une colonne.
              Chaque carte est cliquable et mène à la liste pertinente. */}
          <div className="mb-rise grid gap-4 lg:grid-cols-2" style={{ animationDelay: "140ms" }}>
            <Card
              title="Répartition des tâches"
              meta={totalTasks > 0 ? `${totalTasks} tâche${totalTasks > 1 ? "s" : ""}` : undefined}
              accent={theme.accent}
              href={`/dashboard/kanban?${qs}`}
            >
              <StatusStackedBar breakdown={breakdown} />
            </Card>

            <Card
              title="Tâches à venir"
              meta={plannedTasks.length > 0 ? `${plannedTasks.length}` : undefined}
              accent={theme.accent}
            >
              <WeekPlanningPanel
                tasks={plannedTasks}
                workspace={workspace}
                limit={6}
                seeMoreHref={`/dashboard/calendar?${qs}`}
              />
            </Card>

            <Card
              title="Projets ouverts"
              meta={`${openProjects.length} projet${openProjects.length > 1 ? "s" : ""}`}
              accent={theme.accent}
            >
              {openProjects.length === 0 ? (
                <EmptyState label="Aucun projet ouvert dans cet espace." />
              ) : (
                <div className="flex flex-col gap-2">
                  {openProjects.slice(0, 3).map((project) => (
                    <CompactProjectRow key={project.id} project={project} workspace={workspace} />
                  ))}
                  {openProjects.length > 3 && (
                    <Link
                      href={`/dashboard/projects?${qs}`}
                      className="self-start text-[11px] font-semibold"
                      style={{ color: text.muted }}
                    >
                      Voir plus ({openProjects.length - 3}) →
                    </Link>
                  )}
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
  href?: string;
  children: ReactNode;
}

function Card({ title, meta, accent, action, href, children }: CardProps) {
  return (
    <section
      className="relative flex min-w-0 flex-col gap-3 rounded-[20px] p-4 lg:p-5"
      style={{
        background: surface.s1,
        border: `1px solid ${surface.borderSubtle}`,
        boxShadow: "var(--mb-shadow-xs)",
      }}
    >
      {/* Overlay-link en arrière-plan : la carte entière est cliquable mais
          les liens/boutons à l'intérieur (z-10) restent prioritaires. Évite
          d'imbriquer un <a> dans un <a>, ce qui est invalide en HTML. */}
      {href && (
        <Link
          href={href}
          aria-label={title}
          className="absolute inset-0 rounded-[20px]"
          style={{ zIndex: 0 }}
        />
      )}
      <header className="relative flex items-center justify-between gap-3" style={{ zIndex: 1 }}>
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
      <div className="relative min-w-0" style={{ zIndex: 1 }}>
        {children}
      </div>
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

// Carte projet compacte pour le dashboard : juste titre + barre d'avancement
// + une ligne d'infos utiles (statut + % + nombre de tâches restantes).
// Tient sur ~3 lignes, pour qu'on puisse en aligner 3 dans la carte.
function CompactProjectRow({ project, workspace }: { project: Project; workspace: string }) {
  const display = resolveProjectSubcategoryDisplay(project);
  const href = `/dashboard/projects/${project.id}?workspace=${workspace}`;
  const allTasks = flattenProjectTasks(project);
  const remainingTasks = allTasks.filter((entry) => deriveTaskStatus(entry.task) !== "done").length;
  const progress = Math.max(0, Math.min(100, Math.round(project.progress ?? 0)));
  return (
    <Link
      href={href}
      className="flex min-w-0 flex-col gap-2 rounded-xl px-3 py-2.5"
      style={{
        background: surface.s2,
        border: `1px solid ${surface.borderSubtle}`,
      }}
    >
      <div className="flex min-w-0 items-center gap-2">
        <span
          aria-hidden
          className="inline-block h-2 w-2 shrink-0 rounded-full"
          style={{ background: display.color }}
        />
        <p
          className="min-w-0 flex-1 truncate text-[12.5px] font-semibold"
          style={{ color: text.primary }}
        >
          {project.name}
        </p>
        <span
          className="shrink-0 text-[10.5px] font-bold tabular-nums"
          style={{ color: text.muted }}
        >
          {progress}%
        </span>
      </div>
      <div
        className="relative h-1 w-full overflow-hidden rounded-full"
        style={{ background: surface.s3 }}
      >
        <span
          aria-hidden
          className="absolute inset-y-0 left-0 rounded-full"
          style={{ width: `${progress}%`, background: display.color }}
        />
      </div>
      <p className="text-[10.5px]" style={{ color: text.muted }}>
        {remainingTasks} tâche{remainingTasks > 1 ? "s" : ""} restante{remainingTasks > 1 ? "s" : ""}
      </p>
    </Link>
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
