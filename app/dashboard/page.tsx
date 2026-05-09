import Link from "next/link";
import type { ReactNode } from "react";
import { Topbar } from "@/components/layout/topbar";
import { ProgressBar } from "@/components/ui/progress-bar";
import { ProjectIdentityEditor } from "@/components/projects/project-identity-editor";
import { formatShortDate } from "@/lib/date-format";
import { getProjectsForWorkspace } from "@/lib/project-store";
import { getWorkspace, workspaceTheme } from "@/lib/workspace";
import { formatDueLabel, flattenProjectTasks, isTaskOverdue, type FlattenedProjectTask } from "@/lib/project-insights";
import { calculateProjectIndicators, deriveTaskDisplayPriority, deriveTaskStatus, taskStatusLabels } from "@/lib/project-plan";
import { priorityVisuals, resolveProjectSubcategoryDisplay } from "@/lib/project-taxonomy";
import { surface, text, error as errorTokens, statusColor } from "@/lib/design-tokens";
import type { Project, ProjectTeamMessage, Task, TaskDiscussionMessage, TaskStatus } from "@/lib/mock-data";
import { computeProjectHealth } from "@/lib/project-health";
import { ProjectHealthCard } from "@/components/dashboard/project-health-card";
import { KpiCard } from "@/components/dashboard/kpi-card";
import { StatusStackedBar } from "@/components/dashboard/status-stacked-bar";
import { WeekPlanningPanel, buildPlannedTasks } from "@/components/dashboard/week-planning-panel";
import { ActivityFeedPanel, buildActivityFeed } from "@/components/dashboard/activity-feed-panel";
import { ActiveProjectCard } from "@/components/dashboard/active-project-card";
import { PeriodFilter } from "@/components/dashboard/period-filter";
import { getDashboardPeriod } from "@/lib/dashboard-period";

type DashboardTask = {
  project: Project;
  entry: FlattenedProjectTask;
};

type MentionNotification = {
  id: string;
  project: Project;
  source: "Projet" | "Tâche";
  title: string;
  content: string;
  authorName: string;
  createdAt: string;
};

export default async function DashboardPage({
  searchParams,
}: {
  searchParams: Promise<{ workspace?: string; period?: string }>;
}) {
  const sp = await searchParams;
  const workspace = getWorkspace(sp.workspace);
  const theme = workspaceTheme[workspace];
  const period = getDashboardPeriod(sp.period);
  const qs = `workspace=${workspace}`;
  const projects = (await getProjectsForWorkspace(workspace)).filter(
    (project) => project.status !== "archived" && !project.deleted,
  );
  const openProjects = projects.filter((project) => project.status !== "completed");
  const openTasks = projects
    .flatMap((project) => flattenProjectTasks(project).map((entry) => ({ project, entry })))
    .filter(({ entry }) => deriveTaskStatus(entry.task) !== "done")
    .sort(sortDashboardTasks);
  const mentions = buildMentionNotifications(projects).slice(0, 5);
  const overdueCount = openTasks.filter(({ entry }) => isTaskOverdue(entry.task)).length;
  const visibleOpenTasks = openTasks.slice(0, 4);
  const extraOpenTasksCount = Math.max(0, openTasks.length - visibleOpenTasks.length);
  const todayKey = formatDateKey(new Date());
  const dueTodayCount = openTasks.filter(({ entry }) => entry.task.dueDate === todayKey).length;

  // ── Vue pilotage ─────────────────────────────────────────────────────────
  // Santé projet calculée par règles déterministes (lib/project-health.ts).
  // 4 niveaux : healthy / watch / risk / critical. La carte explique toujours
  // les causes et propose une action recommandée.
  const projectHealthList = openProjects
    .map((project) => ({ project, health: computeProjectHealth(project) }))
    .filter(({ health }) => health.level !== "healthy")
    .sort((left, right) => right.health.score - left.health.score);
  const projectsAtRisk = openProjects
    .map((project) => ({ project, indicators: calculateProjectIndicators(project) }))
    .filter(({ indicators }) => indicators.isAtRisk);
  const overdueTasks = openTasks.filter(({ entry }) => isTaskOverdue(entry.task));
  const completedThisWeek = collectCompletedTasksThisWeek(projects);
  const statusBreakdown = countTasksByStatus(projects);
  const totalTrackedTasks = (Object.values(statusBreakdown) as number[]).reduce((sum, count) => sum + count, 0);
  const aiPriorityActions = collectAiPriorityActions(openProjects).slice(0, 5);
  const upcomingDueTasks = openTasks
    .filter(({ entry }) => entry.task.dueDate && !isTaskOverdue(entry.task))
    .slice(0, 4);
  const pendingSuggestionsTotal = 0;
  // Actions prioritaires dérivées de la santé : 1 par projet à surveiller,
  // les plus critiques en haut. Sert au panneau "À traiter maintenant".
  const healthDerivedActions = projectHealthList.slice(0, 5).map(({ project, health }) => ({
    id: `health-${project.id}`,
    projectId: project.id,
    projectName: project.name,
    projectAccent: project.subcategoryColor,
    actionLabel: health.nextAction.label,
    actionReason: health.causeShort,
    href: health.nextAction.href ?? `/dashboard/projects/${project.id}?workspace=${workspace}`,
    level: health.level,
  }));
  const focusTaskCandidates = openTasks.filter(({ entry }) => {
    const status = deriveTaskStatus(entry.task);
    return (
      status === "blocked" ||
      isTaskOverdue(entry.task) ||
      entry.task.dueDate === todayKey ||
      deriveTaskDisplayPriority(entry.task) === "high"
    );
  });
  const focusTasks = focusTaskCandidates.slice(0, 6);
  const hiddenFocusCount = Math.max(0, focusTaskCandidates.length - focusTasks.length);
  const averageProgress =
    openProjects.length === 0
      ? 0
      : Math.round(openProjects.reduce((sum, project) => sum + project.progress, 0) / openProjects.length);

  // ── Filtrage par période ────────────────────────────────────────────────
  const periodHorizonMs = period === "today" ? DAY_MS : period === "30d" ? DAY_MS * 30 : DAY_MS * 7;
  // eslint-disable-next-line react-hooks/rules-of-hooks
  const periodCutoff = new Date(Date.now() - periodHorizonMs);
  const completedThisPeriod = collectCompletedTasksThisPeriod(projects, periodCutoff);
  const activityFeed = buildActivityFeed(projects).filter((entry) => entry.date >= periodCutoff);

  // ── Planning 7 jours (toujours 7 jours, indépendant du filtre) ──────────
  const plannedTasks = buildPlannedTasks(openTasks);

  // ── KPI (sans IA) ───────────────────────────────────────────────────────
  const dueTodayTasks = openTasks.filter(({ entry }) => entry.task.dueDate === todayKey);
  const blockedTasks = openTasks.filter(({ entry }) => deriveTaskStatus(entry.task) === "blocked");
  const focusToHandleTasks = focusTaskCandidates;

  const kpiActiveProjects = openProjects.length;
  const kpiActionsToHandle = focusToHandleTasks.length;
  const kpiOverdue = overdueTasks.length;
  const kpiBlocked = blockedTasks.length;
  const kpiToWatch = projectHealthList.length;
  const kpiCriticalProjects = projectHealthList.filter(({ health }) => health.level === "critical").length;
  const kpiCompleted = completedThisPeriod.length;

  // Adapte un DashboardTask vers le format léger consommé par le popover KPI.
  function toKpiTask(item: DashboardTask, options?: { meta?: string; metaTone?: "default" | "danger" | "warn" | "success" }) {
    return {
      key: `${item.project.id}-${item.entry.id}`,
      title: item.entry.task.title,
      projectName: item.project.name,
      projectColor: item.project.subcategoryColor,
      href: `/dashboard/projects/${item.project.id}?${qs}`,
      meta: options?.meta,
      metaTone: options?.metaTone,
    };
  }

  const focusKpiTasks = focusToHandleTasks.slice(0, 12).map((item) => {
    if (isTaskOverdue(item.entry.task)) {
      return toKpiTask(item, { meta: "En retard", metaTone: "danger" });
    }
    if (item.entry.task.dueDate === todayKey) {
      return toKpiTask(item, { meta: "Aujourd'hui", metaTone: "warn" });
    }
    return toKpiTask(item, { meta: priorityVisuals[deriveTaskDisplayPriority(item.entry.task)].label });
  });
  const dueTodayKpiTasks = dueTodayTasks.slice(0, 12).map((item) => toKpiTask(item, { meta: formatShortDate(item.entry.task.dueDate ?? "") }));
  const overdueKpiTasks = overdueTasks.slice(0, 12).map((item) => toKpiTask(item, { meta: formatShortDate(item.entry.task.dueDate ?? ""), metaTone: "danger" }));
  const blockedKpiTasks = blockedTasks.slice(0, 12).map((item) => toKpiTask(item, { meta: "Bloquée", metaTone: "danger" }));
  const completedKpiTasks = completedThisPeriod.slice(0, 12).map((item) => ({
    key: `${item.project.id}-${item.task.id}`,
    title: item.task.title,
    projectName: item.project.name,
    projectColor: item.project.subcategoryColor,
    href: `/dashboard/projects/${item.project.id}?${qs}`,
    meta: formatShortDate(item.completedAt),
    metaTone: "success" as const,
  }));

  // Phrase de résumé pour le bandeau haut
  const heroSummary = buildHeroSummary({
    actionsToHandle: kpiActionsToHandle,
    toWatch: kpiToWatch,
    critical: kpiCriticalProjects,
  });

  return (
    <div className="flex h-full flex-col overflow-hidden">
      <Topbar title="Dashboard" workspace={workspace} />

      <main className="mb-page-scroll mb-mobile-scroll flex-1 overflow-y-auto px-4 py-5 lg:px-6">
        <div className="mx-auto flex w-full max-w-[1480px] flex-col gap-4">
          <section
            className="overflow-hidden rounded-[20px]"
            style={{
              background: surface.s1,
              border: `1px solid ${surface.borderSubtle}`,
              boxShadow: "var(--mb-shadow-xs)",
            }}
          >
            <span aria-hidden style={{ display: "block", height: 3, background: theme.gradient }} />
            <div className="flex flex-col gap-4 px-5 py-4 lg:flex-row lg:items-center lg:justify-between lg:gap-6">
              <div className="min-w-0">
                <p className="text-[10px] font-semibold uppercase tracking-[0.14em]" style={{ color: theme.accent }}>
                  Cockpit · {theme.label}
                </p>
                <h1 className="mt-1 text-[1.25rem] font-bold leading-snug" style={{ color: text.primary }}>
                  {heroSummary}
                </h1>
              </div>
              <div className="flex flex-wrap items-center gap-2 lg:shrink-0 lg:flex-nowrap">
                <PeriodFilter value={period} accentColor={theme.accent} />
                <Link
                  href={`/dashboard/projects/new?${qs}`}
                  className="inline-flex items-center gap-1.5 rounded-full px-3.5 py-2 text-[11.5px] font-semibold whitespace-nowrap"
                  style={{ background: theme.accent, color: "#FFFFFF", border: "none" }}
                >
                  <span aria-hidden style={{ fontSize: 14, lineHeight: 1 }}>+</span>
                  Créer un projet
                </Link>
              </div>
            </div>
          </section>

          <section className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-6">
            <KpiCard label="Projets actifs" value={kpiActiveProjects} tone="info" href={`/dashboard/projects?${qs}`} />
            <KpiCard
              label="À traiter"
              value={kpiActionsToHandle}
              tone={kpiActionsToHandle > 0 ? "warn" : "neutral"}
              tasks={focusKpiTasks}
              emptyLabel="Rien à traiter pour le moment."
            />
            <KpiCard
              label="Aujourd'hui"
              value={dueTodayCount}
              tone={dueTodayCount > 0 ? "info" : "neutral"}
              tasks={dueTodayKpiTasks}
              emptyLabel="Aucune échéance aujourd'hui."
            />
            <KpiCard
              label="En retard"
              value={kpiOverdue}
              tone={kpiOverdue > 0 ? "danger" : "neutral"}
              tasks={overdueKpiTasks}
              emptyLabel="Aucune tâche en retard."
            />
            <KpiCard
              label="Bloquées"
              value={kpiBlocked}
              tone={kpiBlocked > 0 ? "critical" : "neutral"}
              tasks={blockedKpiTasks}
              emptyLabel="Aucune tâche bloquée."
            />
            <KpiCard
              label={period === "today" ? "Terminées" : period === "30d" ? "Faites 30 j" : "Faites 7 j"}
              value={kpiCompleted}
              tone="success"
              tasks={completedKpiTasks}
              emptyLabel="Aucune tâche terminée sur la période."
            />
          </section>

          <PilotPanel title="Mentions" meta={mentions.length > 0 ? `${mentions.length}` : undefined} accentColor={statusColor.blue.text}>
            {mentions.length === 0 ? (
              <EmptyState label="Aucune mention récente." />
            ) : (
              <div className="grid gap-2">
                {mentions.slice(0, 3).map((mention) => (
                  <MentionRow key={mention.id} mention={mention} qs={qs} />
                ))}
              </div>
            )}
          </PilotPanel>

          <PilotPanel
            title="Projets actifs"
            meta={`${openProjects.length} projet${openProjects.length > 1 ? "s" : ""}`}
            accentColor={theme.accent}
            action={
              <Link href={`/dashboard/projects?${qs}`} className="text-[11px] font-semibold" style={{ color: theme.accent }}>
                Voir tous →
              </Link>
            }
          >
            {openProjects.length === 0 ? (
              <EmptyState label="Aucun projet ouvert dans cet espace." />
            ) : (
              <div className="grid gap-3 lg:grid-cols-2 xl:grid-cols-3">
                {openProjects.slice(0, 6).map((project) => (
                  <ActiveProjectCard key={project.id} project={project} workspace={workspace} />
                ))}
              </div>
            )}
          </PilotPanel>

          <section className="grid gap-4 lg:grid-cols-[minmax(0,0.72fr)_minmax(0,1.28fr)]">
            <PilotPanel title="Répartition" meta={`${totalTrackedTasks} tâches`} accentColor={theme.accent}>
              <StatusStackedBar breakdown={statusBreakdown} />
            </PilotPanel>

            <PilotPanel title="Planning 7 jours" meta={plannedTasks.length > 0 ? `${plannedTasks.length}` : undefined} accentColor={statusColor.yellow.text}>
              <WeekPlanningPanel tasks={plannedTasks} workspace={workspace} />
            </PilotPanel>
          </section>

          <PilotPanel title="Activité récente" meta={activityFeed.length > 0 ? `${activityFeed.length}` : undefined} accentColor={text.muted}>
            <ActivityFeedPanel entries={activityFeed} workspace={workspace} />
          </PilotPanel>
        </div>
      </main>
    </div>
  );
}

function buildHeroSummary({ actionsToHandle, toWatch, critical }: { actionsToHandle: number; toWatch: number; critical: number }) {
  if (critical > 0) {
    return `${critical} projet${critical > 1 ? "s" : ""} critique${critical > 1 ? "s" : ""} et ${actionsToHandle} action${actionsToHandle > 1 ? "s" : ""} à traiter aujourd'hui.`;
  }
  if (toWatch > 0) {
    return `${toWatch} projet${toWatch > 1 ? "s" : ""} demande${toWatch > 1 ? "nt" : ""} ton attention. ${actionsToHandle} action${actionsToHandle > 1 ? "s" : ""} prioritaire${actionsToHandle > 1 ? "s" : ""}.`;
  }
  if (actionsToHandle > 0) {
    return `${actionsToHandle} action${actionsToHandle > 1 ? "s" : ""} à traiter, aucun projet en alerte.`;
  }
  return "Tout est sous contrôle. Bon pilotage.";
}

function HeroSignal({ label, value, accent }: { label: string; value: string | number; accent: string }) {
  return (
    <div
      className="rounded-[16px] px-3 py-2.5"
      style={{
        background: surface.s2,
        border: `1px solid ${surface.borderSubtle}`,
      }}
    >
      <p className="text-[10px] font-semibold uppercase tracking-[0.12em]" style={{ color: text.muted }}>
        {label}
      </p>
      <p className="mt-1 text-[1.15rem] font-bold leading-none" style={{ color: accent, fontVariantNumeric: "tabular-nums" }}>
        {value}
      </p>
    </div>
  );
}

const DAY_MS = 1000 * 60 * 60 * 24;

function collectCompletedTasksThisPeriod(projects: Project[], cutoff: Date) {
  const result: Array<{ project: Project; task: Task; stepTitle: string; completedAt: string }> = [];
  for (const project of projects) {
    for (const step of project.steps ?? []) {
      for (const task of step.tasks) {
        const at = task.completedAt;
        if (!at) continue;
        const date = new Date(at);
        if (Number.isNaN(date.getTime()) || date < cutoff) continue;
        result.push({ project, task, stepTitle: step.title, completedAt: at });
      }
    }
  }
  return result;
}

// Bloc dédié "Projets à surveiller" : affiche uniquement les projets dont la
// santé n'est pas "healthy", triés par criticité décroissante. Mise en grille
// 2 colonnes au-delà de lg pour rester lisible. Vide → état rassurant.
function ProjectsToWatchSection({
  projects,
  workspace,
}: {
  projects: Array<{ project: Project; health: ReturnType<typeof computeProjectHealth> }>;
  workspace: string;
}) {
  return (
    <PilotPanel
      title="Projets à surveiller"
      meta={
        projects.length > 0
          ? `${projects.length} projet${projects.length > 1 ? "s" : ""} nécessite${projects.length > 1 ? "nt" : ""} une attention`
          : undefined
      }
      accentColor="var(--mb-status-orange-text)"
    >
      {projects.length === 0 ? (
        <EmptyState label="Tous les projets sont sains. Bon pilotage." />
      ) : (
        <div className="grid gap-2 lg:grid-cols-2">
          {projects.map(({ project }) => (
            <ProjectHealthCard key={project.id} project={project} workspace={workspace} />
          ))}
        </div>
      )}
    </PilotPanel>
  );
}

// Ligne d'action prioritaire dérivée de la santé d'un projet. Lien direct vers
// la tâche/projet à débloquer.
function HealthActionRow({
  action,
}: {
  action: {
    id: string;
    projectName: string;
    projectAccent: string;
    actionLabel: string;
    href: string;
    level: "watch" | "risk" | "critical" | "healthy";
  };
}) {
  const tonePalette: Record<typeof action.level, string> = {
    healthy: "var(--mb-status-green-text)",
    watch: "var(--mb-status-yellow-text)",
    risk: "var(--mb-status-orange-text)",
    critical: "var(--mb-status-red-text)",
  };
  const railColor = tonePalette[action.level] ?? action.projectAccent;
  return (
    <Link
      href={action.href}
      className="relative flex items-center justify-between gap-3 rounded-2xl px-3 py-2.5 text-xs font-semibold"
      style={{
        background: surface.s2,
        border: `1px solid ${surface.borderSubtle}`,
        color: text.primary,
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
      <span className="min-w-0 flex-1 pl-2">
        <span className="block truncate text-[10px] font-bold uppercase tracking-[0.1em]" style={{ color: text.muted }}>
          {action.projectName}
        </span>
        <span className="mt-0.5 block truncate text-[12px]" style={{ color: text.primary }}>
          {action.actionLabel}
        </span>
      </span>
      <span className="shrink-0 text-[11px]" style={{ color: railColor }}>
        Ouvrir →
      </span>
    </Link>
  );
}

function HeroMetric({ label, value, tone }: { label: string; value: number; tone?: "danger" }) {
  const background = tone === "danger" ? "rgba(248,113,113,0.28)" : "rgba(255,255,255,0.12)";
  const border = tone === "danger" ? "rgba(248,113,113,0.45)" : "rgba(255,255,255,0.22)";
  return (
    <div
      className="text-right"
      style={{
        background,
        border: `1px solid ${border}`,
        borderRadius: 14,
        padding: "10px 12px",
      }}
    >
      <p style={{ fontSize: 22, fontWeight: 700, lineHeight: 1, margin: 0, fontVariantNumeric: "tabular-nums" }}>{value}</p>
      <p
        style={{
          fontSize: 10,
          fontWeight: 600,
          textTransform: "uppercase",
          letterSpacing: "0.08em",
          color: "rgba(255,255,255,0.78)",
          margin: "4px 0 0",
        }}
      >
        {label}
      </p>
    </div>
  );
}

function PilotPanel({
  title,
  meta,
  accentColor,
  action,
  children,
}: {
  title: string;
  meta?: string;
  accentColor?: string;
  action?: ReactNode;
  children: ReactNode;
}) {
  return (
    <section
      className="min-w-0"
      style={{
        background: surface.s1,
        border: `1px solid ${surface.borderSubtle}`,
        borderRadius: 16,
        padding: 16,
        boxShadow: "var(--mb-shadow-xs)",
      }}
    >
      <div className="mb-3 flex items-center justify-between gap-2">
        <div className="flex items-center gap-2 min-w-0">
          {accentColor && <span className="h-2 w-2 shrink-0 rounded-full" style={{ background: accentColor }} />}
          <h2 style={{ fontSize: 13, fontWeight: 600, color: text.primary, margin: 0, lineHeight: 1.3 }} className="truncate">
            {title}
          </h2>
        </div>
        <div className="flex items-center gap-2">
          {meta && (
            <span
              className="shrink-0"
              style={{
                fontSize: 11,
                fontWeight: 500,
                padding: "2px 8px",
                borderRadius: 999,
                background: surface.s2,
                color: text.secondary,
              }}
            >
              {meta}
            </span>
          )}
          {action}
        </div>
      </div>
      {children}
    </section>
  );
}

type AiPriorityAction = {
  id: string;
  project: Project;
  title: string;
  detail: string;
};

function PriorityActionRow({ action, qs }: { action: AiPriorityAction; qs: string }) {
  return (
    <Link
      href={`/dashboard/projects/${action.project.id}?${qs}`}
      className="mb-card mb-card-interactive block min-w-0"
      style={{
        background: surface.s2,
        border: `1px solid ${surface.borderSubtle}`,
        borderRadius: 10,
        padding: 10,
        color: text.primary,
      }}
    >
      <div className="flex min-w-0 items-start gap-2">
        <span className="mt-1 h-2 w-2 shrink-0 rounded-full" style={{ background: action.project.subcategoryColor }} />
        <div className="min-w-0">
          <p className="mb-task-title truncate" style={{ fontSize: 12, fontWeight: 600, color: text.primary, margin: 0, lineHeight: 1.3 }}>
            {action.title}
          </p>
          <p className="truncate" style={{ fontSize: 11, color: text.muted, margin: "2px 0 0" }}>
            {action.project.name} · {action.detail}
          </p>
        </div>
      </div>
    </Link>
  );
}

function PriorityTaskRow({ item, qs }: { item: DashboardTask; qs: string }) {
  const overdue = isTaskOverdue(item.entry.task);
  const priority = priorityVisuals[deriveTaskDisplayPriority(item.entry.task)];
  return (
    <Link
      href={`/dashboard/projects/${item.project.id}?${qs}`}
      className="mb-card mb-card-interactive block min-w-0"
      style={{
        background: surface.s2,
        border: `1px solid ${surface.borderSubtle}`,
        borderRadius: 10,
        padding: 10,
        color: text.primary,
      }}
    >
      <div className="flex min-w-0 flex-wrap items-center gap-2">
        <span className="h-2 w-2 shrink-0 rounded-full" style={{ background: item.project.subcategoryColor }} />
        <div className="min-w-0 flex-1">
          <p className="mb-task-title truncate" style={{ fontSize: 12, fontWeight: 600, color: text.primary, margin: 0, lineHeight: 1.3 }}>
            {item.entry.task.title}
          </p>
          <p className="truncate" style={{ fontSize: 11, color: text.muted, margin: "2px 0 0" }}>
            {item.project.name} · {item.entry.stepTitle}
          </p>
        </div>
        <span
          className="shrink-0"
          style={{
            fontSize: 10,
            fontWeight: 500,
            padding: "2px 7px",
            borderRadius: 999,
            background: priority.bg,
            color: priority.text,
          }}
        >
          {priority.label}
        </span>
        <span
          className="shrink-0"
          style={{
            fontSize: 10,
            fontWeight: 500,
            padding: "2px 7px",
            borderRadius: 999,
            background: overdue ? errorTokens.bg : surface.s1,
            color: overdue ? errorTokens.text : text.secondary,
          }}
        >
          {formatDueLabel(item.entry.task)}
        </span>
      </div>
    </Link>
  );
}

function RiskProjectRow({
  project,
  indicators,
  qs,
}: {
  project: Project;
  indicators: ReturnType<typeof calculateProjectIndicators>;
  qs: string;
}) {
  const accent = project.subcategoryColor;
  return (
    <Link
      href={`/dashboard/projects/${project.id}?${qs}`}
      className="mb-card mb-card-interactive block min-w-0"
      style={{
        background: surface.s2,
        border: `1px solid ${surface.borderSubtle}`,
        borderRadius: 12,
        padding: "10px 12px",
        color: text.primary,
        position: "relative",
        overflow: "hidden",
      }}
    >
      <span aria-hidden style={{ position: "absolute", insetBlock: 0, left: 0, width: 3, background: accent }} />
      <div style={{ paddingLeft: 6 }}>
        <div className="flex min-w-0 items-center justify-between gap-2">
          <p className="truncate" style={{ fontSize: 13, fontWeight: 600, color: text.primary, margin: 0 }}>
            {project.name}
          </p>
          <span
            className="shrink-0"
            style={{
              fontSize: 10,
              fontWeight: 600,
              padding: "2px 8px",
              borderRadius: 999,
              background: errorTokens.bg,
              color: errorTokens.text,
            }}
          >
            À risque
          </span>
        </div>
        <div className="mt-1.5 flex flex-wrap items-center gap-1.5">
          {indicators.indicators
            .filter((indicator) => indicator.key !== "at_risk")
            .slice(0, 4)
            .map((indicator) => (
              <span
                key={indicator.key}
                style={{
                  fontSize: 10,
                  fontWeight: 500,
                  padding: "2px 7px",
                  borderRadius: 999,
                  background: indicator.tone === "danger" ? errorTokens.bg : surface.s1,
                  color: indicator.tone === "danger" ? errorTokens.text : text.secondary,
                }}
              >
                {indicator.label}
              </span>
            ))}
          {indicators.pendingDecisionCount > 0 && (
            <span
              style={{
                fontSize: 10,
                fontWeight: 500,
                padding: "2px 7px",
                borderRadius: 999,
                background: statusColor.yellow.bg,
                color: statusColor.yellow.text,
              }}
            >
              {indicators.pendingDecisionCount} décision{indicators.pendingDecisionCount > 1 ? "s" : ""} en attente
            </span>
          )}
        </div>
        <div style={{ marginTop: 8 }}>
          <ProgressBar value={indicators.progress} color={accent} height={3} />
        </div>
      </div>
    </Link>
  );
}

function CompletedTaskRow({
  item,
  qs,
}: {
  item: { project: Project; task: Task; stepTitle: string; completedAt: string };
  qs: string;
}) {
  const completed = formatRelativeDate(item.completedAt);
  return (
    <Link
      href={`/dashboard/projects/${item.project.id}?${qs}`}
      className="mb-card mb-card-interactive block min-w-0"
      style={{
        background: surface.s2,
        border: `1px solid ${surface.borderSubtle}`,
        borderRadius: 10,
        padding: 10,
        color: text.primary,
      }}
    >
      <div className="flex min-w-0 items-start gap-2">
        <span
          className="mt-0.5 inline-flex h-4 w-4 shrink-0 items-center justify-center rounded-full"
          style={{ background: statusColor.green.text, color: "#FFFFFF" }}
        >
          <svg width="9" height="9" viewBox="0 0 12 12" fill="none" aria-hidden="true">
            <path d="M2.5 6.5l2.4 2.4L9.5 3.5" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
          </svg>
        </span>
        <div className="min-w-0 flex-1">
          <p className="mb-task-title truncate" style={{ fontSize: 12, fontWeight: 600, color: text.primary, margin: 0, lineHeight: 1.3 }}>
            {item.task.title}
          </p>
          <p className="truncate" style={{ fontSize: 11, color: text.muted, margin: "2px 0 0" }}>
            {item.project.name} · {item.stepTitle}
          </p>
        </div>
        <span className="shrink-0" style={{ fontSize: 10, color: text.muted }}>{completed}</span>
      </div>
    </Link>
  );
}

const STATUS_COLORS: Record<TaskStatus, string> = {
  todo: statusColor.gray.text,
  in_progress: statusColor.green.text,
  waiting: statusColor.yellow.text,
  blocked: statusColor.red.text,
  done: statusColor.blue.text,
};

const STATUS_ORDER: TaskStatus[] = ["in_progress", "todo", "waiting", "blocked", "done"];

function StatusBreakdownChart({ breakdown, total }: { breakdown: Record<TaskStatus, number>; total: number }) {
  return (
    <div className="grid gap-2">
      <div className="flex h-2.5 w-full overflow-hidden rounded-full" style={{ background: surface.s2 }}>
        {STATUS_ORDER.map((status) => {
          const count = breakdown[status] ?? 0;
          if (count === 0) return null;
          const width = `${(count / total) * 100}%`;
          return <span key={status} style={{ width, background: STATUS_COLORS[status] }} />;
        })}
      </div>
      <div className="grid grid-cols-2 gap-1.5 sm:grid-cols-3">
        {STATUS_ORDER.map((status) => {
          const count = breakdown[status] ?? 0;
          return (
            <div key={status} className="flex items-center gap-1.5 rounded-xl px-2 py-1" style={{ background: surface.s2 }}>
              <span className="h-2 w-2 shrink-0 rounded-full" style={{ background: STATUS_COLORS[status] }} />
              <span className="text-[11px] font-semibold" style={{ color: text.secondary }}>{taskStatusLabels[status]}</span>
              <span className="ml-auto text-[11px] font-bold" style={{ color: text.primary }}>{count}</span>
            </div>
          );
        })}
      </div>
    </div>
  );
}

function DashboardPanel({
  title,
  meta,
  action,
  children,
}: {
  title: string;
  meta?: string;
  action?: ReactNode;
  children: ReactNode;
}) {
  return (
    <section
      className="min-w-0"
      style={{
        background: surface.s1,
        border: `1px solid ${surface.borderSubtle}`,
        borderRadius: 16,
        padding: 16,
        boxShadow: "var(--mb-shadow-xs)",
      }}
    >
      <div className="mb-3 flex items-center justify-between gap-3">
        <div className="flex items-center gap-2 min-w-0">
          <h2 style={{ fontSize: 13, fontWeight: 600, color: text.primary, margin: 0, lineHeight: 1.3 }} className="truncate">
            {title}
          </h2>
          {meta && (
            <span
              style={{
                fontSize: 11,
                fontWeight: 500,
                padding: "2px 8px",
                borderRadius: 999,
                background: surface.s2,
                color: text.muted,
              }}
            >
              {meta}
            </span>
          )}
        </div>
        {action && <div className="shrink-0" style={{ fontSize: 12, fontWeight: 600 }}>{action}</div>}
      </div>
      {children}
    </section>
  );
}

function ProjectRow({ project, qs }: { project: Project; qs: string }) {
  const openTaskCount = flattenProjectTasks(project).filter((entry) => deriveTaskStatus(entry.task) !== "done").length;
  const subcategoryDisplay = resolveProjectSubcategoryDisplay(project);
  const projectAccent = subcategoryDisplay.color;

  // Variante calme : pas de bandeau plein coloré. Filet d'accent à gauche, header neutre.
  return (
    <Link
      href={`/dashboard/projects/${project.id}?${qs}`}
      className="mb-card mb-card-interactive block min-w-0"
      style={{
        background: surface.s1,
        border: `1px solid ${surface.borderSubtle}`,
        borderRadius: 12,
        padding: 12,
        color: text.primary,
        position: "relative",
        overflow: "hidden",
      }}
    >
      {/* Filet d'accent latéral */}
      <span aria-hidden style={{ position: "absolute", insetBlock: 0, left: 0, width: 3, background: projectAccent }} />
      <div className="flex min-w-0 items-center gap-3" style={{ paddingLeft: 6 }}>
        <ProjectIdentityEditor
          projectId={project.id}
          workspace={project.workspace}
          subcategory={project.subcategory}
          subcategoryColor={project.subcategoryColor}
          isCustomSubcategory={project.isCustomSubcategory}
          customSubcategoryLabel={project.customSubcategoryLabel}
          customSubcategoryColor={project.customSubcategoryColor}
          size="sm"
        />
        <div className="min-w-0 flex-1">
          <p className="truncate" style={{ fontSize: 13, fontWeight: 600, color: text.primary, margin: 0, lineHeight: 1.3 }}>
            {project.name}
          </p>
          <p className="truncate" style={{ fontSize: 11, color: text.muted, margin: "2px 0 0", lineHeight: 1.4 }}>
            {subcategoryDisplay.label} · {project.objective}
          </p>
        </div>
        <span
          className="shrink-0"
          style={{
            fontSize: 11,
            fontWeight: 700,
            padding: "3px 8px",
            borderRadius: 999,
            background: `color-mix(in srgb, ${projectAccent} 14%, transparent)`,
            color: projectAccent,
            fontVariantNumeric: "tabular-nums",
          }}
        >
          {project.progress}%
        </span>
      </div>
      <div className="mt-2.5 flex items-center gap-3" style={{ paddingLeft: 6 }}>
        <ProgressBar value={project.progress} color={projectAccent} height={4} />
        <span className="shrink-0" style={{ fontSize: 11, fontWeight: 500, color: text.muted }}>
          {openTaskCount} tâche{openTaskCount > 1 ? "s" : ""}
        </span>
      </div>
    </Link>
  );
}

function TaskRow({ item }: { item: DashboardTask }) {
  const task = item.entry.task;
  const priority = priorityVisuals[deriveTaskDisplayPriority(task)];
  const overdue = isTaskOverdue(task);

  return (
    <Link
      href={`/dashboard/projects/${item.project.id}?workspace=${item.project.workspace}`}
      className="mb-card mb-card-interactive block min-w-0"
      style={{
        background: surface.s1,
        border: `1px solid ${surface.borderSubtle}`,
        borderRadius: 10,
        padding: 10,
        color: text.primary,
      }}
    >
      <div className="flex min-w-0 flex-wrap items-center gap-2">
        <span className="h-2 w-2 shrink-0 rounded-full" style={{ background: item.project.subcategoryColor }} />
        <div className="min-w-0 flex-1">
          <p className="mb-task-title truncate" style={{ fontSize: 13, fontWeight: 500, color: text.primary, margin: 0, lineHeight: 1.3 }}>
            {task.title}
          </p>
          <p className="truncate" style={{ fontSize: 11, color: text.muted, margin: "2px 0 0", lineHeight: 1.4 }}>
            {item.project.name} · {item.entry.stepTitle}
          </p>
        </div>
        <span
          className="shrink-0"
          style={{
            fontSize: 10,
            fontWeight: 500,
            padding: "2px 7px",
            borderRadius: 999,
            background: priority.bg,
            color: priority.text,
          }}
        >
          {priority.label}
        </span>
        <span
          className="shrink-0"
          style={{
            fontSize: 10,
            fontWeight: 500,
            padding: "2px 7px",
            borderRadius: 999,
            background: overdue ? errorTokens.bg : surface.s2,
            color: overdue ? errorTokens.text : text.secondary,
          }}
        >
          {formatDueLabel(task)}
        </span>
      </div>
    </Link>
  );
}

function DashboardAction({
  href,
  title,
  description,
  accentColor,
}: {
  href: string;
  title: string;
  description: string;
  accentColor: string;
}) {
  return (
    <Link
      href={href}
      className="mb-card mb-card-interactive block min-w-0"
      style={{
        background: surface.s2,
        border: `1px solid ${surface.borderSubtle}`,
        borderRadius: 12,
        padding: 12,
        color: text.primary,
      }}
    >
      <div className="flex min-w-0 items-center gap-3">
        <span
          className="inline-flex h-9 w-9 shrink-0 items-center justify-center"
          style={{ background: accentColor, color: "#FFFFFF", borderRadius: 10 }}
        >
          <ProjectIcon />
        </span>
        <div className="min-w-0">
          <p className="truncate" style={{ fontSize: 13, fontWeight: 600, color: text.primary, margin: 0, lineHeight: 1.3 }}>
            {title}
          </p>
          <p style={{ fontSize: 11, color: text.muted, margin: "2px 0 0", lineHeight: 1.5 }}>
            {description}
          </p>
        </div>
      </div>
    </Link>
  );
}

function MentionRow({ mention, qs }: { mention: MentionNotification; qs: string }) {
  return (
    <Link
      href={`/dashboard/projects/${mention.project.id}?${qs}`}
      className="mb-card mb-card-interactive block"
      style={{
        background: surface.s2,
        border: `1px solid ${surface.borderSubtle}`,
        borderRadius: 10,
        padding: 10,
        color: text.primary,
      }}
    >
      <div className="flex items-start gap-2">
        <span className="mt-1 h-2 w-2 shrink-0 rounded-full" style={{ background: statusColor.blue.text }} />
        <div className="min-w-0">
          <p style={{ fontSize: 11, fontWeight: 500, color: text.muted, margin: 0, letterSpacing: "0.04em", textTransform: "uppercase" }}>
            {mention.source} · {mention.title}
          </p>
          <p className="line-clamp-2" style={{ fontSize: 12, color: text.secondary, margin: "4px 0 0", lineHeight: 1.5 }}>
            {mention.content}
          </p>
          <p style={{ fontSize: 11, color: text.muted, margin: "4px 0 0" }}>
            {mention.authorName} · {mention.project.name}
          </p>
        </div>
      </div>
    </Link>
  );
}

function EmptyState({ label }: { label: string }) {
  return (
    <p
      className="text-center"
      style={{
        background: surface.s2,
        border: `1px dashed ${surface.borderSubtle}`,
        borderRadius: 10,
        padding: "16px 12px",
        fontSize: 12,
        color: text.muted,
        margin: 0,
      }}
    >
      {label}
    </p>
  );
}

function buildMentionNotifications(projects: Project[], name = "Maxime"): MentionNotification[] {
  const needle = name.toLocaleLowerCase("fr-FR");
  const notifications: MentionNotification[] = [];

  projects.forEach((project) => {
    (project.teamMessages ?? []).forEach((message) => {
      if (!messageMentionsName(message, needle)) return;
      notifications.push({
        id: `${project.id}-team-${message.id}`,
        project,
        source: "Projet",
        title: "Chat projet",
        content: message.content,
        authorName: message.authorName,
        createdAt: message.createdAt,
      });
    });

    (project.steps ?? []).forEach((step) => {
      step.tasks.forEach((task) => {
        (task.discussion ?? []).forEach((message) => {
          if (!messageMentionsName(message, needle)) return;
          notifications.push({
            id: `${project.id}-${task.id}-${message.id}`,
            project,
            source: "Tâche",
            title: task.title,
            content: message.content,
            authorName: message.authorName,
            createdAt: message.createdAt,
          });
        });
      });
    });
  });

  return notifications.sort((left, right) => right.createdAt.localeCompare(left.createdAt));
}

function messageMentionsName(message: ProjectTeamMessage | TaskDiscussionMessage, normalizedName: string) {
  return message.content.toLocaleLowerCase("fr-FR").includes(normalizedName);
}

function sortDashboardTasks(left: DashboardTask, right: DashboardTask) {
  const leftOverdue = isTaskOverdue(left.entry.task) ? 0 : 1;
  const rightOverdue = isTaskOverdue(right.entry.task) ? 0 : 1;
  if (leftOverdue !== rightOverdue) return leftOverdue - rightOverdue;

  const leftDue = left.entry.task.dueDate ?? "9999-12-31";
  const rightDue = right.entry.task.dueDate ?? "9999-12-31";
  if (leftDue !== rightDue) return leftDue.localeCompare(rightDue);

  const rank = { high: 0, medium: 1, low: 2 } as const;
  return rank[deriveTaskDisplayPriority(left.entry.task)] - rank[deriveTaskDisplayPriority(right.entry.task)];
}

function ProjectIcon() {
  return (
    <svg width="17" height="17" viewBox="0 0 16 16" fill="none" aria-hidden="true">
      <path d="M2.5 4.5h4l1 1h6v6.5a1.5 1.5 0 0 1-1.5 1.5h-9A1.5 1.5 0 0 1 1.5 12V6A1.5 1.5 0 0 1 3 4.5Z" stroke="currentColor" strokeWidth="1.4" strokeLinejoin="round" />
    </svg>
  );
}

function collectCompletedTasksThisWeek(projects: Project[]): Array<{ project: Project; task: Task; stepTitle: string; completedAt: string }> {
  const now = Date.now();
  const sevenDaysAgo = now - 7 * 24 * 60 * 60 * 1000;
  const items: Array<{ project: Project; task: Task; stepTitle: string; completedAt: string }> = [];
  projects.forEach((project) => {
    (project.steps ?? []).forEach((step) => {
      step.tasks.forEach((task) => {
        if (!task.completedAt) return;
        const ts = new Date(task.completedAt).getTime();
        if (Number.isNaN(ts) || ts < sevenDaysAgo || ts > now + 24 * 60 * 60 * 1000) return;
        items.push({ project, task, stepTitle: step.title, completedAt: task.completedAt });
      });
    });
  });
  return items.sort((left, right) => right.completedAt.localeCompare(left.completedAt));
}

function countTasksByStatus(projects: Project[]): Record<TaskStatus, number> {
  const counts: Record<TaskStatus, number> = { todo: 0, in_progress: 0, waiting: 0, blocked: 0, done: 0 };
  projects.forEach((project) => {
    (project.steps ?? []).forEach((step) => {
      step.tasks.forEach((task) => {
        const status = deriveTaskStatus(task);
        counts[status] = (counts[status] ?? 0) + 1;
      });
    });
  });
  return counts;
}

function collectAiPriorityActions(_projects: Project[]): AiPriorityAction[] {
  // IA désactivée : pas de prochaine action recommandée par l'IA.
  return [];
}

function formatRelativeDate(value: string) {
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "";
  const diffMs = Date.now() - date.getTime();
  const diffDays = Math.floor(diffMs / (24 * 60 * 60 * 1000));
  if (diffDays <= 0) return "aujourd'hui";
  if (diffDays === 1) return "hier";
  if (diffDays < 7) return `il y a ${diffDays} j`;
  return formatShortDate(date);
}

function formatDateKey(date: Date) {
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, "0")}-${String(date.getDate()).padStart(2, "0")}`;
}
