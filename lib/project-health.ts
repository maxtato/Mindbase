// Moteur de détection de santé projet — règles déterministes, sans IA.
// Calcule un score à partir de signaux factuels (tâches, dates, statuts,
// risques manuels, activité) puis convertit le score en niveau et produit
// une explication courte + une action recommandée pour le dashboard.

import type { Project, Task, Step } from "@/lib/mock-data";
import { formatShortDate } from "@/lib/date-format";
import { calculateProjectIndicators, deriveTaskDisplayPriority, deriveTaskStatus } from "@/lib/project-plan";
import { flattenProjectTasks, isTaskOverdue, type FlattenedProjectTask } from "@/lib/project-insights";
import { daysFromToday } from "@/lib/timezone";

export type HealthLevel = "healthy" | "watch" | "risk" | "critical";

export interface ProjectHealth {
  level: HealthLevel;
  score: number;
  causes: string[];
  /** Phrase courte (1-2 causes les plus saillantes). */
  causeShort: string;
  metrics: {
    blockedCount: number;
    overdueCount: number;
    progress: number;
    /** "dans 5 j" / "aujourd'hui" / "le 15 mai" / undefined si rien à venir. */
    dueLabel?: string;
    /** Nombre de jours depuis la dernière mise à jour du projet, undefined si récent. */
    inactivityDays?: number;
  };
  nextAction: {
    label: string;
    /** URL deep-link vers la tâche concernée si pertinent (sinon vers la page projet). */
    href?: string;
  };
  /** Identifiant de la tâche prioritaire derrière la nextAction si applicable. */
  focusTaskId?: string;
}

interface HealthVisual {
  label: string;
  /** Couleur "fond" douce du badge. */
  bg: string;
  /** Couleur du texte du badge / accent. */
  text: string;
  /** Couleur de la bande verticale latérale de la carte. */
  rail: string;
}

const VISUALS: Record<HealthLevel, HealthVisual> = {
  healthy: {
    label: "Sain",
    bg: "var(--mb-status-green-bg)",
    text: "var(--mb-status-green-text)",
    rail: "var(--mb-status-green-text)",
  },
  watch: {
    label: "À surveiller",
    bg: "var(--mb-status-yellow-bg)",
    text: "var(--mb-status-yellow-text)",
    rail: "var(--mb-status-yellow-text)",
  },
  risk: {
    label: "À risque",
    bg: "var(--mb-status-orange-bg)",
    text: "var(--mb-status-orange-text)",
    rail: "var(--mb-status-orange-text)",
  },
  critical: {
    label: "Critique",
    bg: "var(--mb-status-red-bg)",
    text: "var(--mb-status-red-text)",
    rail: "var(--mb-status-red-text)",
  },
};

export function getHealthVisual(level: HealthLevel): HealthVisual {
  return VISUALS[level];
}

const DAY_MS = 1000 * 60 * 60 * 24;

function daysBetween(from: Date, to: Date) {
  return Math.floor((to.getTime() - from.getTime()) / DAY_MS);
}

function isHighPriorityTask(task: Task) {
  return deriveTaskDisplayPriority(task) === "high";
}

/** Trouve la prochaine échéance ouverte (la plus proche dans le futur ou
 *  aujourd'hui). Ancré sur Europe/Paris via `daysFromToday`. */
function findSoonestDue(tasks: FlattenedProjectTask[], now: Date): { daysUntil: number; entry: FlattenedProjectTask } | null {
  let best: { daysUntil: number; entry: FlattenedProjectTask } | null = null;
  for (const entry of tasks) {
    const status = deriveTaskStatus(entry.task);
    if (status === "done") continue;
    if (!entry.task.dueDate) continue;
    const daysUntil = daysFromToday(entry.task.dueDate, now);
    if (daysUntil < 0 && status !== "blocked") continue; // les retards sont déjà gérés ailleurs
    if (!best || daysUntil < best.daysUntil) best = { daysUntil, entry };
  }
  return best;
}

function formatDueLabel(daysUntil: number, dueKey: string): string {
  if (daysUntil <= 0) return "aujourd'hui";
  if (daysUntil === 1) return "demain";
  if (daysUntil < 7) return `dans ${daysUntil} j`;
  return formatShortDate(new Date(`${dueKey}T12:00:00`));
}

export function computeProjectHealth(project: Project, now = new Date()): ProjectHealth {
  const indicators = calculateProjectIndicators(project);
  const allEntries = flattenProjectTasks(project);
  const openEntries = allEntries.filter((entry) => deriveTaskStatus(entry.task) !== "done");
  const totalTasks = indicators.totalTasks;
  const overdueEntries = openEntries.filter((entry) => isTaskOverdue(entry.task));
  const blockedEntries = openEntries.filter((entry) => deriveTaskStatus(entry.task) === "blocked");
  const inProgressEntries = openEntries.filter((entry) => deriveTaskStatus(entry.task) === "in_progress");
  const waitingOrBlockedCount = openEntries.filter((entry) => {
    const s = deriveTaskStatus(entry.task);
    return s === "waiting" || s === "blocked";
  }).length;

  const updatedAt = new Date(project.updatedAt);
  const inactivityDays = Number.isNaN(updatedAt.getTime()) ? 0 : Math.max(0, daysBetween(updatedAt, now));
  const openManualRisks = (project.risks ?? []).filter((risk) => risk.status === "open");
  const highManualRisks = openManualRisks.filter((risk) => risk.severity === "high").length;
  const mediumManualRisks = openManualRisks.filter((risk) => risk.severity === "medium").length;

  const soonest = findSoonestDue(openEntries, now);
  const soonestIsClose = soonest ? soonest.daysUntil <= 7 : false;
  const lowProgress = project.progress < 70;

  const blockedSteps = (project.steps ?? []).filter((step: Step) => {
    if (step.tasks.length === 0) return false;
    return step.tasks.every((task) => deriveTaskStatus(task) === "blocked");
  }).length;

  // ─── Score ──────────────────────────────────────────────────────────────
  let score = 0;
  const causes: string[] = [];

  // Tâches : on ne compte chaque tâche qu'une seule fois (priorité haute > bloqué > retard)
  let highPriorityHotCount = 0;
  let plainBlockedCount = 0;
  let plainOverdueCount = 0;
  for (const entry of openEntries) {
    const blocked = deriveTaskStatus(entry.task) === "blocked";
    const overdue = isTaskOverdue(entry.task);
    if (!blocked && !overdue) continue;
    if (isHighPriorityTask(entry.task)) {
      highPriorityHotCount += 1;
      score += 5;
    } else if (blocked) {
      plainBlockedCount += 1;
      score += 4;
    } else if (overdue) {
      plainOverdueCount += 1;
      score += 3;
    }
  }
  if (highPriorityHotCount > 0) {
    causes.push(`${highPriorityHotCount} tâche${highPriorityHotCount > 1 ? "s" : ""} prioritaire${highPriorityHotCount > 1 ? "s" : ""} bloquée${highPriorityHotCount > 1 ? "s" : ""} ou en retard`);
  }
  if (plainBlockedCount > 0) {
    causes.push(`${plainBlockedCount} tâche${plainBlockedCount > 1 ? "s" : ""} bloquée${plainBlockedCount > 1 ? "s" : ""}`);
  }
  if (plainOverdueCount > 0) {
    causes.push(`${plainOverdueCount} tâche${plainOverdueCount > 1 ? "s" : ""} en retard`);
  }

  // Inactivité projet
  if (inactivityDays >= 30) {
    score += 5;
    causes.push(`Aucune activité depuis ${inactivityDays} jours`);
  } else if (inactivityDays >= 14) {
    score += 2;
    causes.push(`Aucune activité depuis ${inactivityDays} jours`);
  }

  // Aucune prochaine tâche active
  const hasActiveNext = inProgressEntries.length > 0 || soonest !== null;
  if (!hasActiveNext && openEntries.length > 0) {
    score += 3;
    causes.push("Aucune prochaine tâche planifiée");
  }

  // Échéance proche + faible avancement
  if (soonestIsClose && lowProgress && project.progress < 70) {
    score += 4;
    causes.push("Échéance proche avec un avancement encore faible");
  }

  // Risques manuels
  if (highManualRisks > 0) {
    score += highManualRisks * 4;
    causes.push(`${highManualRisks} risque${highManualRisks > 1 ? "s" : ""} signalé${highManualRisks > 1 ? "s" : ""} (sévérité élevée)`);
  }
  if (mediumManualRisks > 0) {
    score += mediumManualRisks * 2;
    causes.push(`${mediumManualRisks} risque${mediumManualRisks > 1 ? "s" : ""} signalé${mediumManualRisks > 1 ? "s" : ""} (sévérité moyenne)`);
  }

  // Beaucoup de tâches en attente / bloquées
  if (totalTasks > 0 && waitingOrBlockedCount / totalTasks > 0.4) {
    score += 4;
    const pct = Math.round((waitingOrBlockedCount / totalTasks) * 100);
    causes.push(`${pct}% des tâches sont en attente ou bloquées`);
  }

  // Étapes entièrement bloquées
  if (blockedSteps > 0) {
    score += blockedSteps * 4;
    causes.push(`${blockedSteps} étape${blockedSteps > 1 ? "s" : ""} entièrement bloquée${blockedSteps > 1 ? "s" : ""}`);
  }

  // ─── Niveau ─────────────────────────────────────────────────────────────
  const level: HealthLevel =
    score <= 2 ? "healthy" : score <= 6 ? "watch" : score <= 11 ? "risk" : "critical";

  // ─── Cause principale courte ───────────────────────────────────────────
  const causeShort = formatCauseShort(level, causes);

  // ─── Action recommandée ────────────────────────────────────────────────
  const nextAction = pickNextAction({
    project,
    highPriorityHotEntry: openEntries.find(
      (entry) => isHighPriorityTask(entry.task) && (deriveTaskStatus(entry.task) === "blocked" || isTaskOverdue(entry.task)),
    ),
    blockedEntry: blockedEntries[0],
    overdueEntry: overdueEntries[0],
    hasActiveNext,
    soonestEntry: soonest?.entry,
    soonestIsClose,
    lowProgress,
    highManualRisks: openManualRisks.find((risk) => risk.severity === "high"),
  });

  return {
    level,
    score,
    causes,
    causeShort,
    metrics: {
      blockedCount: blockedEntries.length,
      overdueCount: overdueEntries.length,
      progress: project.progress,
      dueLabel: soonest && soonest.entry.task.dueDate ? formatDueLabel(soonest.daysUntil, soonest.entry.task.dueDate) : undefined,
      inactivityDays: inactivityDays >= 14 ? inactivityDays : undefined,
    },
    nextAction,
    focusTaskId: nextAction.href?.includes("?task=") ? nextAction.href.split("task=")[1]?.split("&")[0] : undefined,
  };
}

function formatCauseShort(level: HealthLevel, causes: string[]): string {
  if (causes.length === 0) {
    return "Le projet avance sans signal d'alerte.";
  }
  const top = causes.slice(0, 2);
  const prefix = level === "critical" ? "Critique car" : level === "risk" ? "À risque car" : level === "watch" ? "À surveiller :" : "OK :";
  if (top.length === 1) return `${prefix} ${lowerFirst(top[0])}.`;
  return `${prefix} ${lowerFirst(top[0])} et ${lowerFirst(top[1])}.`;
}

function lowerFirst(value: string) {
  if (!value) return value;
  return value.charAt(0).toLocaleLowerCase("fr-FR") + value.slice(1);
}

function pickNextAction(input: {
  project: Project;
  highPriorityHotEntry?: FlattenedProjectTask;
  blockedEntry?: FlattenedProjectTask;
  overdueEntry?: FlattenedProjectTask;
  hasActiveNext: boolean;
  soonestEntry?: FlattenedProjectTask;
  soonestIsClose: boolean;
  lowProgress: boolean;
  highManualRisks?: { id: string; title: string };
}): ProjectHealth["nextAction"] {
  const projectHref = `/dashboard/projects/${input.project.id}?workspace=${input.project.workspace}`;

  if (input.highPriorityHotEntry) {
    return {
      label: `Débloquer : ${truncate(input.highPriorityHotEntry.task.title, 60)}`,
      href: projectHref,
    };
  }
  if (input.blockedEntry) {
    return {
      label: `Débloquer la tâche : ${truncate(input.blockedEntry.task.title, 60)}`,
      href: projectHref,
    };
  }
  if (input.overdueEntry) {
    return {
      label: `Replanifier : ${truncate(input.overdueEntry.task.title, 60)}`,
      href: projectHref,
    };
  }
  if (!input.hasActiveNext) {
    return {
      label: "Définir la prochaine action",
      href: projectHref,
    };
  }
  if (input.soonestIsClose && input.lowProgress) {
    return {
      label: "Revoir les priorités avant l'échéance",
      href: projectHref,
    };
  }
  if (input.highManualRisks) {
    return {
      label: `Traiter le risque : ${truncate(input.highManualRisks.title, 60)}`,
      href: projectHref,
    };
  }
  return {
    label: "Ouvrir le projet",
    href: projectHref,
  };
}

function truncate(value: string, max: number) {
  if (value.length <= max) return value;
  return `${value.slice(0, max - 1).trim()}…`;
}
