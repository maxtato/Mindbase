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
import { getWorkspace, workspaceTheme, listEnvironmentOptions, ALL_WORKSPACE } from "@/lib/workspace";
import { syncEnvironmentThemes, getCustomEnvironments } from "@/lib/environment-store";
import { getStandaloneTasks, getStandaloneTasksForWorkspace } from "@/lib/standalone-tasks-store";
import { standaloneToBoardItem, isStandaloneProjectId } from "@/lib/standalone-board";
import { getTeamMembers } from "@/lib/team-store";
import { StandaloneOpenProvider } from "@/components/dashboard/standalone-open-provider";
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
import { getServerT } from "@/lib/i18n/server";

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
  const { t, locale } = await getServerT();

  const projects = (await getProjectsForWorkspace(workspace)).filter(
    (project) => project.status !== "archived" && !project.deleted,
  );

  // Projets actifs (non terminés)
  const openProjects = projects.filter((project) => project.status !== "completed");

  // Tâches libres (hors projet) de l'environnement courant : elles doivent
  // aussi compter dans le dashboard (KPI, répartition, focus). On les adapte au
  // même format {project, entry} via un pseudo-projet (cf. Kanban/Calendrier).
  const standaloneTasks = await getStandaloneTasksForWorkspace(workspace);
  const standaloneItems: DashboardTask[] = standaloneTasks.map(standaloneToBoardItem);
  // Vivier d'assignation des tâches libres (membres actifs de l'équipe) pour le
  // drawer ouvert depuis le dashboard.
  const standalonePeople = (await getTeamMembers())
    .filter((member) => member.status === "active")
    .map((member) => ({ id: member.id, name: member.name }));

  // Liste plate de toutes les tâches (projets + tâches libres)
  const allTasks: DashboardTask[] = [
    ...projects.flatMap((project) => flattenProjectTasks(project).map((entry) => ({ project, entry }))),
    ...standaloneItems,
  ];

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
    isStandaloneProjectId(item.project.id)
      ? `/dashboard/tasks?workspace=${workspace}`
      : `/dashboard/projects/${item.project.id}?workspace=${workspace}&taskId=${item.entry.task.id}`;
  const toKpiTask = (item: DashboardTask, meta?: KpiTask["meta"], metaTone?: KpiTask["metaTone"]): KpiTask => {
    const standalone = isStandaloneProjectId(item.project.id);
    return {
      key: `${item.project.id}-${item.entry.task.id}`,
      title: item.entry.task.title,
      projectName: standalone ? t("tasks.freeBadge") : item.project.name,
      projectColor: standalone ? item.project.subcategoryColor : resolveProjectSubcategoryDisplay(item.project).color,
      href: taskHref(item),
      meta,
      metaTone,
      // Tâche libre : ouverte directement (drawer) depuis le popover KPI.
      standaloneId: standalone ? item.entry.task.id : undefined,
    };
  };

  const openTasksKpi = openTasks.map((item) => toKpiTask(item));
  const overdueTasksKpi = overdueTasks.map((item) => toKpiTask(item, t("dashboard.overdueTag"), "danger"));

  // Liste des projets ouverts pour le popover du KPI « Projets » : on peut
  // scroller et cliquer sur un projet pour l'ouvrir (comme les tâches).
  const projectsKpi: KpiTask[] = openProjects.map((project) => {
    const remaining = flattenProjectTasks(project).filter((entry) => deriveTaskStatus(entry.task) !== "done").length;
    return {
      key: project.id,
      title: project.name,
      projectName: t(remaining > 1 ? "dashboard.projectRemainingOther" : "dashboard.projectRemainingOne", { count: remaining }),
      projectColor: resolveProjectSubcategoryDisplay(project).color,
      href: `/dashboard/projects/${project.id}?workspace=${workspace}`,
      meta: `${Math.max(0, Math.min(100, Math.round(project.progress ?? 0)))}%`,
    };
  });

  // Bloc « Focus / Aujourd'hui » : actions prioritaires + projets qui dérivent.
  // Les tâches libres entrent aussi dans les actions prioritaires.
  const focus = buildDailyFocus(projects, workspace, t, standaloneTasks);
  const focusDate = formatFocusDate(locale);

  // Répartition par environnement (tableau de bord commun) : on agrège TOUS
  // les environnements, indépendamment du filtre courant, pour donner une vue
  // « ce qu'il y a en Perso / Pro / autre ».
  const allEnvProjects = (await getProjectsForWorkspace(ALL_WORKSPACE)).filter(
    (project) => project.status !== "archived" && !project.deleted,
  );
  const allStandaloneTasks = await getStandaloneTasks();
  const envBreakdown = listEnvironmentOptions(await getCustomEnvironments())
    .map((option) => {
      const envProjects = allEnvProjects.filter((project) => project.workspace === option.value);
      const openProjectCount = envProjects.filter((project) => project.status !== "completed").length;
      const openTaskCount =
        envProjects
          .flatMap((project) => flattenProjectTasks(project))
          .filter((entry) => deriveTaskStatus(entry.task) !== "done").length +
        allStandaloneTasks.filter(
          (task) => task.workspace === option.value && deriveTaskStatus(task) !== "done",
        ).length;
      return {
        value: option.value,
        label: option.label,
        accent: workspaceTheme[option.value]?.accent ?? theme.accent,
        openProjects: openProjectCount,
        openTasks: openTaskCount,
      };
    })
    .filter((row) => row.openProjects > 0 || row.openTasks > 0);

  return (
    <div className="flex h-full flex-col overflow-hidden">
      <Topbar
        title={t("nav.dashboard")}
        workspace={workspace}
        action={
          <Link
            href={`/dashboard/projects/new?${qs}`}
            aria-label={t("common.newProject")}
            className="flex items-center gap-1.5 rounded-xl text-xs font-bold whitespace-nowrap px-2 py-2 sm:px-3.5"
            style={{ background: theme.accent, color: "#fff" }}
          >
            <svg width="12" height="12" viewBox="0 0 16 16" fill="none">
              <path d="M8 3v10M3 8h10" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" />
            </svg>
            <span className="hidden sm:inline">{t("common.newProject")}</span>
          </Link>
        }
      />

      <main className="mb-page-scroll mb-mobile-scroll flex-1 overflow-y-auto px-4 py-6 lg:px-8">
        <StandaloneOpenProvider tasks={standaloneTasks} people={standalonePeople} workspace={workspace}>
        <div className="mx-auto flex w-full max-w-[1480px] flex-col gap-4">
          {/* Focus proactif : la première chose visible — quoi faire maintenant
              et quels projets surveiller (réutilise project-health + insights). */}
          <div className="mb-rise" style={{ animationDelay: "60ms" }}>
            <FocusPanel
              focus={focus}
              dateLabel={focusDate}
              accent={theme.accent}
              t={t}
            />
          </div>

          {/* KPI principaux — rangée de 3 chiffres. Les KPI tâches ouvrent
              un popover listant les tâches concernées (clic sur une tâche
              du popover → navigation vers la page projet + drawer auto-
              ouvert). KPI projets reste un lien vers la liste des projets. */}
          <section className="mb-rise grid grid-cols-3 gap-3" style={{ animationDelay: "70ms" }}>
            <KpiCard
              label={t("dashboard.kpi.projects")}
              value={kpiProjects}
              tone="info"
              tasks={projectsKpi}
              emptyLabel={t("dashboard.kpi.empty.projects")}
            />
            <KpiCard
              label={t("dashboard.kpi.openTasks")}
              value={kpiTasks}
              tone={kpiTasks > 0 ? "warn" : "neutral"}
              tasks={openTasksKpi}
              emptyLabel={t("dashboard.kpi.empty.openTasks")}
            />
            <KpiCard
              label={t("dashboard.kpi.overdue")}
              value={kpiOverdue}
              tone={kpiOverdue > 0 ? "critical" : "neutral"}
              tasks={overdueTasksKpi}
              emptyLabel={t("dashboard.kpi.empty.overdue")}
            />
          </section>

          {/* Bas du dashboard — uniquement du COMPLÉMENTAIRE au bloc Focus
              (pas de doublon avec « À faire en priorité » / « Projets à
              surveiller ») : la répartition globale par statut + le journal
              d'activité. Le détail des tâches/projets se consulte via le Focus
              et les popovers KPI. */}
          <div className="mb-rise grid gap-4 lg:grid-cols-2" style={{ animationDelay: "140ms" }}>
            <Card
              title={t("dashboard.card.distribution")}
              meta={totalTasks > 0 ? t("projects.tasksCount", { count: totalTasks }) : undefined}
              accent={theme.accent}
              href={`/dashboard/kanban?${qs}`}
            >
              <StatusStackedBar breakdown={breakdown} t={t} />
            </Card>

            <Card
              title={t("dashboard.card.activity")}
              meta={activityFeed.length > 0 ? `${activityFeed.length}` : undefined}
              accent={theme.accent}
            >
              <ActivityFeedPanel entries={activityFeed} workspace={workspace} t={t} />
            </Card>
          </div>

          {/* Répartition par environnement — tableau de bord commun. */}
          {envBreakdown.length > 0 && (
            <div className="mb-rise" style={{ animationDelay: "160ms" }}>
              <Card title={t("dashboard.card.byEnvironment")} accent={theme.accent}>
                <EnvironmentBreakdown
                  rows={envBreakdown}
                  projectsLabel={t("dashboard.kpi.projects")}
                  tasksLabel={t("dashboard.kpi.openTasks")}
                />
              </Card>
            </div>
          )}
        </div>
        </StandaloneOpenProvider>
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
      className="relative flex min-w-0 flex-col gap-3 rounded-[22px] p-4 lg:p-5"
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
          className="absolute inset-0 rounded-[22px]"
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
          <h2 className="truncate text-[12.5px] font-bold uppercase tracking-[0.14em]" style={{ color: text.primary }}>
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

interface EnvBreakdownRow {
  value: string;
  label: string;
  accent: string;
  openProjects: number;
  openTasks: number;
}

// Petit graphique « par environnement » : une barre proportionnelle aux tâches
// ouvertes de chaque environnement + les compteurs projets/tâches.
function EnvironmentBreakdown({
  rows,
  projectsLabel,
  tasksLabel,
}: {
  rows: EnvBreakdownRow[];
  projectsLabel: string;
  tasksLabel: string;
}) {
  const maxTasks = Math.max(1, ...rows.map((row) => row.openTasks));
  return (
    <ul className="flex flex-col gap-3">
      {rows.map((row) => (
        <li key={row.value} className="flex flex-col gap-1.5">
          <div className="flex items-center justify-between gap-3">
            <span className="flex min-w-0 items-center gap-2">
              <span className="truncate text-[12.5px] font-semibold" style={{ color: text.primary }}>
                {row.label}
              </span>
            </span>
            <span className="shrink-0 text-[11px] font-semibold tabular-nums" style={{ color: text.muted }}>
              {row.openProjects} {projectsLabel.toLowerCase()} · {row.openTasks} {tasksLabel.toLowerCase()}
            </span>
          </div>
          <div className="h-2 w-full overflow-hidden rounded-full" style={{ background: surface.s2 }}>
            <div
              className="h-full rounded-full"
              style={{ width: `${Math.round((row.openTasks / maxTasks) * 100)}%`, background: row.accent, minWidth: row.openTasks > 0 ? 6 : 0 }}
            />
          </div>
        </li>
      ))}
    </ul>
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
