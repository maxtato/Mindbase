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
import { syncEnvironmentThemes } from "@/lib/environment-store";
import { flattenProjectTasks, isTaskOverdue, type FlattenedProjectTask } from "@/lib/project-insights";
import { deriveTaskStatus } from "@/lib/project-plan";
import { surface, text, error as errorTokens, statusColor } from "@/lib/design-tokens";
import type { Project, Task, TaskStatus } from "@/lib/mock-data";
import { StatusStackedBar } from "@/components/dashboard/status-stacked-bar";
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
  // Enregistre les thèmes des environnements custom AVANT de lire le thème
  // (sinon repli violet « Personnel » pour un env perso).
  await syncEnvironmentThemes();
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

  // Liste des projets ouverts pour le popover du KPI « Projets » : on peut
  // scroller et cliquer sur un projet pour l'ouvrir (comme les tâches).
  const projectsKpi: KpiTask[] = openProjects.map((project) => {
    const remaining = flattenProjectTasks(project).filter((entry) => deriveTaskStatus(entry.task) !== "done").length;
    return {
      key: project.id,
      title: project.name,
      projectName: `${remaining} tâche${remaining > 1 ? "s" : ""} restante${remaining > 1 ? "s" : ""}`,
      projectColor: resolveProjectSubcategoryDisplay(project).color,
      href: `/dashboard/projects/${project.id}?workspace=${workspace}`,
      meta: `${Math.max(0, Math.min(100, Math.round(project.progress ?? 0)))}%`,
    };
  });

  // Bloc « Focus / Aujourd'hui » : actions prioritaires + projets qui dérivent.
  const focus = buildDailyFocus(projects, workspace);
  const focusDate = formatFocusDate();

  return (
    <div className="flex h-full flex-col overflow-hidden">
      <Topbar
        title="Dashboard"
        workspace={workspace}
        action={
          <Link
            href={`/dashboard/projects/new?${qs}`}
            aria-label="Nouveau projet"
            className="flex items-center gap-1.5 rounded-xl text-xs font-bold whitespace-nowrap px-2 py-2 sm:px-3.5"
            style={{ background: theme.accent, color: "#fff" }}
          >
            <svg width="12" height="12" viewBox="0 0 16 16" fill="none">
              <path d="M8 3v10M3 8h10" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" />
            </svg>
            <span className="hidden sm:inline">Nouveau projet</span>
          </Link>
        }
      />

      <main className="mb-page-scroll mb-mobile-scroll flex-1 overflow-y-auto px-4 py-5 lg:px-6">
        <div className="mx-auto flex w-full max-w-[1480px] flex-col gap-4">
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
              tasks={projectsKpi}
              emptyLabel="Aucun projet ouvert."
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

          {/* Bas du dashboard — uniquement du COMPLÉMENTAIRE au bloc Focus
              (pas de doublon avec « À faire en priorité » / « Projets à
              surveiller ») : la répartition globale par statut + le journal
              d'activité. Le détail des tâches/projets se consulte via le Focus
              et les popovers KPI. */}
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
