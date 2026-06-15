import { mkdir, readFile, writeFile } from "node:fs/promises";
import path from "node:path";
import { cache } from "react";
import { createClient, type RedisClientType } from "redis";
import type { Workspace } from "@/lib/workspace";
import { projects as projectSeeds, type Action, type ChecklistItem, type Decision, type Project, type ProjectActivityItem, type ProjectFile, type ProjectMode, type ProjectPerson, type ProjectStatus, type ProjectStatusSettings, type ProjectTeam, type ProjectTeamMessage, type Risk, type Step, type StepStatus, type Task, type TaskDiscussionMessage, type TaskStatus } from "@/lib/mock-data";
import {
  buildInitialCurrentPriority,
  buildInitialNextStep,
  getSubcategoryOption,
  inferPriorityFromLegacyProject,
  inferSubcategoryFromLegacyProject,
  inferWorkspaceFromLegacyProject,
  isCustomSubcategorySelection,
  normalizeHexColor,
  type ProjectPriority,
  type ProjectType,
} from "@/lib/project-taxonomy";
import {
  calculateProgressFromSteps,
  deriveProjectStatusFromSteps,
  deriveStepStatus,
  normalizeProjectStatus,
  normalizePlanPriority,
  normalizeStoredSteps,
  stepStatusLabels,
  taskStatusLabels,
} from "@/lib/project-plan";
import { guessProjectFileExt } from "@/lib/project-files";
import { getProjectTemplateByKey } from "@/lib/project-templates";
import { getActiveAccountName } from "@/lib/current-account";
import { getProfile } from "@/lib/account-store";

const PROJECTS_FILE_PATH = path.join(process.cwd(), "data", "projects.json");
const STORE_VERSION = 1;
const TASK_STATUS_COLORS: Record<TaskStatus, string> = {
  todo: "#64748B",
  in_progress: "#F59E0B",
  waiting: "#3B82F6",
  blocked: "#EF4444",
  done: "#22C55E",
};
const STEP_STATUS_COLORS: Record<StepStatus, string> = {
  todo: "#64748B",
  in_progress: "#F59E0B",
  waiting: "#3B82F6",
  done: "#22C55E",
};
const CLEARED_ASSISTANT_SUMMARY = "Mémoire IA supprimée pour ce projet.";
const CLEARED_ASSISTANT_NEXT_ACTION = "Aucune action IA active.";

interface ProjectStoreFile {
  version: number;
  projects: Project[];
}

let writeChain = Promise.resolve();

function cloneSeedProjects() {
  return projectSeeds.map((project) => ({ ...project }));
}

function sanitizeText(value: string | null | undefined) {
  return value?.trim() ?? "";
}

function sanitizeTextBlock(value: string | null | undefined) {
  return value
    ?.replace(/\r\n/g, "\n")
    .replace(/[ \t]+\n/g, "\n")
    .replace(/\n{4,}/g, "\n\n\n")
    .trim() ?? "";
}

function sanitizeGeneratedDocumentFileName(value: string | null | undefined) {
  const base = sanitizeText(value)
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[^a-zA-Z0-9._-]+/g, "-")
    .replace(/-{2,}/g, "-")
    .replace(/(^-|-$)/g, "")
    .slice(0, 80) || "document-mindbase";
  return /\.[a-z0-9]{2,5}$/i.test(base) ? base : `${base}.md`;
}

function normalizeTaskMatchText(value: string) {
  return value
    .trim()
    .toLocaleLowerCase("fr-FR")
    .normalize("NFD")
    .replace(/\p{Diacritic}/gu, "")
    .replace(/[^\p{Letter}\p{Number}]+/gu, " ")
    .replace(/\s+/g, " ")
    .trim();
}

function appendTaskRealization(
  existing: string | undefined,
  detail: string | undefined,
) {
  const cleanedDetail = sanitizeText(detail);
  if (!cleanedDetail) return sanitizeText(existing) || undefined;

  const cleanedExisting = sanitizeText(existing);
  if (cleanedExisting && cleanedExisting.split(/\n+/).some((entry) => entry.trim() === cleanedDetail)) {
    return cleanedExisting;
  }
  if (!cleanedExisting) return cleanedDetail;
  return `${cleanedExisting}\n${cleanedDetail}`;
}

function isChecklistComplete(checklist: ChecklistItem[] | undefined) {
  return !checklist || checklist.length === 0 || checklist.every((item) => item.done);
}

function hasIncompleteChecklist(checklist: ChecklistItem[] | undefined) {
  return Boolean(checklist?.length) && !isChecklistComplete(checklist);
}

type RiskComparable = Pick<Risk, "title"> & Partial<Pick<Risk, "description" | "mitigation" | "severity" | "status">>;

export function risksLookRelated(left: RiskComparable, right: RiskComparable) {
  const leftTitle = normalizeTaskMatchText(left.title);
  const rightTitle = normalizeTaskMatchText(right.title);
  if (!leftTitle || !rightTitle) return false;
  if (leftTitle === rightTitle || leftTitle.includes(rightTitle) || rightTitle.includes(leftTitle)) return true;

  const leftText = riskSearchText(left);
  const rightText = riskSearchText(right);
  const titleOverlap = Math.max(
    riskTokenOverlapScore(leftTitle, rightText),
    riskTokenOverlapScore(rightTitle, leftText),
  );
  const bodyOverlap = Math.max(
    riskTokenOverlapScore(leftText, rightText),
    riskTokenOverlapScore(rightText, leftText),
  );

  return titleOverlap >= 0.62 || (titleOverlap >= 0.42 && bodyOverlap >= 0.58);
}

function riskSearchText(risk: RiskComparable) {
  return normalizeTaskMatchText([risk.title, risk.description, risk.mitigation].filter(Boolean).join(" "));
}

function riskTokenOverlapScore(left: string, right: string) {
  const leftTokens = riskComparableTokens(left);
  const rightTokens = new Set(riskComparableTokens(right));
  if (leftTokens.length === 0 || rightTokens.size === 0) return 0;
  return leftTokens.filter((token) => rightTokens.has(token)).length / leftTokens.length;
}

function riskComparableTokens(value: string) {
  const stopwords = new Set([
    "avec",
    "dans",
    "pour",
    "faire",
    "mettre",
    "ajouter",
    "creer",
    "risque",
    "risques",
    "projet",
    "action",
    "surveiller",
    "clarifier",
    "possible",
    "pourrait",
    "etre",
    "sera",
    "reste",
    "restent",
    "le",
    "la",
    "les",
    "des",
    "une",
    "un",
    "du",
    "de",
    "et",
  ]);
  return normalizeTaskMatchText(value)
    .split(" ")
    .map((token) => (token.length > 4 && token.endsWith("s") ? token.slice(0, -1) : token))
    .filter((token) => token.length >= 4 && !stopwords.has(token));
}

function dedupeProjectRisks(risks: Risk[] | undefined) {
  const merged: Risk[] = [];

  for (const risk of risks ?? []) {
    const title = sanitizeText(risk.title);
    if (!title) continue;
    const normalizedRisk: Risk = {
      id: sanitizeText(risk.id) || `r_${crypto.randomUUID().slice(0, 8)}`,
      title,
      description: sanitizeText(risk.description) || undefined,
      severity: risk.severity === "high" || risk.severity === "low" ? risk.severity : "medium",
      mitigation: sanitizeText(risk.mitigation) || "À surveiller et clarifier dans le suivi du projet.",
      status: risk.status === "mitigated" ? "mitigated" : "open",
    };

    const existingIndex = merged.findIndex((existing) => risksLookRelated(existing, normalizedRisk));
    if (existingIndex === -1) {
      merged.push(normalizedRisk);
      continue;
    }

    merged[existingIndex] = mergeRiskEntries(merged[existingIndex], normalizedRisk);
  }

  return merged;
}

function resolveRiskStatusesFromTasks(risks: Risk[], steps: Step[]) {
  const tasks = steps.flatMap((step) => step.tasks);
  if (tasks.length === 0) return risks;

  return risks.map((risk) => {
    if (risk.status !== "open" || !isRiskResolvedByCompletedTasks(risk, tasks)) {
      return risk;
    }

    return {
      ...risk,
      status: "mitigated" as const,
      mitigation: mergeRiskText(
        risk.mitigation,
        "Risque atténué : les tâches directement liées à ce point sont maintenant terminées.",
      ) ?? risk.mitigation,
    };
  });
}

function isRiskResolvedByCompletedTasks(risk: Risk, tasks: Task[]) {
  const riskText = riskSearchText(risk);
  if (!riskText) return false;

  const scoredTasks = tasks
    .map((task) => ({
      task,
      score: scoreRiskTaskMatch(riskText, task),
    }))
    .filter((candidate) => candidate.score >= 0.35)
    .sort((left, right) => right.score - left.score);

  const completedMatch = scoredTasks.find((candidate) => candidate.task.done || candidate.task.status === "done");
  if (!completedMatch || completedMatch.score < 0.55) return false;

  const openMatch = scoredTasks.find((candidate) => !candidate.task.done && candidate.task.status !== "done");
  return !openMatch || completedMatch.score >= openMatch.score + 0.18;
}

function scoreRiskTaskMatch(riskText: string, task: Task) {
  const taskText = normalizeTaskMatchText([
    task.title,
    task.description,
    task.expected,
    task.realization,
    task.completionDetails,
    task.comments?.join(" "),
    task.checklist?.map((item) => item.label).join(" "),
    task.files?.map((file) => file.name).join(" "),
    task.owner,
    task.assignees?.join(" "),
  ].filter(Boolean).join(" "));
  const taskTitle = normalizeTaskMatchText(task.title);
  const riskTargetsAvailability = /\b(?:disponibilite|disponible|reservation|reserve|reserver|stock|livraison)\b/.test(riskText);
  const taskHandlesAvailability = /\b(?:confirmer|reservation|reserve|reserver|commande|commander|acheter|valider)\b/.test(taskText);
  const riskTargetsBudget = /\b(?:budget|cout|couts|prix|tarif|depense|depenses)\b/.test(riskText);
  const taskIsBudgetOnly = /\b(?:budget|cout|couts|prix|tarif|depense|depenses|calculer|estimer)\b/.test(taskTitle);

  const baseScore = Math.max(
    riskTokenOverlapScore(taskTitle, riskText),
    riskTokenOverlapScore(riskText, taskText),
  );
  const availabilityBoost = riskTargetsAvailability && taskHandlesAvailability ? 0.18 : 0;
  const budgetPenalty = !riskTargetsBudget && taskIsBudgetOnly ? 0.18 : 0;

  return Math.max(0, baseScore + availabilityBoost - budgetPenalty);
}

function mergeRiskEntries(existing: Risk, incoming: Risk): Risk {
  return {
    ...existing,
    title: chooseMoreCompleteRiskText(existing.title, incoming.title),
    description: mergeRiskText(existing.description, incoming.description),
    severity: strongerRiskSeverity(existing.severity, incoming.severity),
    mitigation: mergeRiskText(existing.mitigation, incoming.mitigation) || existing.mitigation,
    status: existing.status === "open" || incoming.status === "open" ? "open" : "mitigated",
  };
}

function chooseMoreCompleteRiskText(existing: string, incoming: string) {
  const existingTokens = riskComparableTokens(existing);
  const incomingTokens = riskComparableTokens(incoming);
  if (incomingTokens.length > existingTokens.length) return incoming;
  if (incomingTokens.length === existingTokens.length && incoming.length > existing.length) return incoming;
  return existing;
}

function mergeRiskText(existing: string | undefined, incoming: string | undefined) {
  const current = sanitizeText(existing);
  const addition = sanitizeText(incoming);
  if (!addition) return current || undefined;
  if (!current) return addition;

  const normalizedCurrent = normalizeTaskMatchText(current);
  const normalizedAddition = normalizeTaskMatchText(addition);
  if (normalizedCurrent === normalizedAddition || normalizedCurrent.includes(normalizedAddition)) return current;
  if (normalizedAddition.includes(normalizedCurrent)) return addition;
  return `${current} ${addition}`;
}

function strongerRiskSeverity(left: Risk["severity"], right: Risk["severity"]) {
  const rank: Record<Risk["severity"], number> = { low: 1, medium: 2, high: 3 };
  return rank[right] > rank[left] ? right : left;
}

function buildProjectNarrativeFallback(raw: Partial<Project>, field: "description" | "objective" | "context") {
  const name = sanitizeText(raw.name) || "ce projet";
  const description = sanitizeText(raw.description);
  const objective = sanitizeText(raw.objective);
  const context = sanitizeText(raw.context);

  if (field === "description") {
    return description || context || objective || `Projet "${name}" à structurer avec Flatmind.`;
  }

  if (field === "objective") {
    return objective || description || context || `Faire avancer "${name}" avec un objectif clair, des étapes et des tâches pilotables.`;
  }

  return context || description || objective || `Contexte initial à enrichir pour le projet "${name}".`;
}

function isProjectType(value: string | null | undefined): value is ProjectType {
  return value === "ponctuel" || value === "recurrent" || value === "exploration" || value === "decision" || value === "execution";
}

function isProjectPriority(value: string | null | undefined): value is ProjectPriority {
  return value === "low" || value === "medium" || value === "high";
}

function isTaskStatus(value: string | null | undefined): value is TaskStatus {
  return value === "todo" || value === "in_progress" || value === "waiting" || value === "blocked" || value === "done";
}

function isStepStatus(value: string | null | undefined): value is StepStatus {
  return value === "todo" || value === "in_progress" || value === "waiting" || value === "done";
}

function normalizeProject(raw: Partial<Project> & Pick<Project, "id" | "name" | "description" | "objective" | "status" | "progress" | "context" | "currentPriority" | "nextStep" | "decisions" | "risks" | "blockers" | "actions" | "updatedAt" | "color">): Project {
  // On accepte les deux environnements intégrés ET les environnements
  // personnalisés (id "env_*"). Les projets hérités sans workspace valide
  // retombent sur une inférence par mots-clés.
  const rawWorkspace = typeof raw.workspace === "string" ? raw.workspace.trim() : "";
  const workspace: Workspace =
    rawWorkspace === "personal" || rawWorkspace === "professional" || rawWorkspace.startsWith("env_")
      ? rawWorkspace
      : inferWorkspaceFromLegacyProject(raw.name, raw.description);

  const mode: ProjectMode = raw.mode === "assisted" ? "assisted" : "custom";

  const inferredSubcategory = inferSubcategoryFromLegacyProject(workspace, raw.name, raw.description);
  const hasOpenBlockers = raw.blockers?.some((blocker) => blocker.status === "open") ?? false;
  const hasHighPriorityActions = raw.actions?.some((action) => !action.done && action.priority === "high") ?? false;
  const priority = isProjectPriority(raw.priority)
    ? raw.priority
    : inferPriorityFromLegacyProject(hasOpenBlockers, hasHighPriorityActions);
  const projectType = isProjectType(raw.projectType) ? raw.projectType : "execution";
  const isCustomSubcategory = Boolean(raw.isCustomSubcategory);

  const standardOption = getSubcategoryOption(
    workspace,
    typeof raw.subcategory === "string" && !isCustomSubcategory ? raw.subcategory : inferredSubcategory,
  ) ?? getSubcategoryOption(workspace, inferredSubcategory)!;

  const customSubcategoryLabel = sanitizeText(raw.customSubcategoryLabel);
  const customSubcategoryColor = normalizeHexColor(raw.customSubcategoryColor, standardOption.color);
  const subcategory = isCustomSubcategory
    ? "other"
    : typeof raw.subcategory === "string"
      ? raw.subcategory
      : standardOption.key;
  const subcategoryColor = normalizeHexColor(
    raw.subcategoryColor,
    isCustomSubcategory ? customSubcategoryColor : standardOption.color,
  );

  const normalizedSteps = normalizeStoredSteps(Array.isArray(raw.steps) ? raw.steps : [], raw.actions ?? []);
  const normalizedRisks = resolveRiskStatusesFromTasks(
    dedupeProjectRisks(Array.isArray(raw.risks) ? raw.risks : []),
    normalizedSteps,
  );
  const hasBlockedTasks = normalizedSteps.some((step) =>
    step.tasks.some((task) => task.blocked && !task.done),
  );
  const rawBlockers = Array.isArray(raw.blockers) ? raw.blockers : [];
  const hasOpenRawBlocker = rawBlockers.some((blocker) => blocker.status === "open");
  const normalizedBlockers = rawBlockers.map((blocker, index) => {
    if (hasBlockedTasks) {
      if (hasOpenRawBlocker) return blocker;
      return index === 0 ? { ...blocker, status: "open" as const } : blocker;
    }

    return blocker.status === "open" ? { ...blocker, status: "resolved" as const } : blocker;
  });
  const hasPlanTasks = normalizedSteps.some((step) => step.tasks.length > 0);
  const progress = hasPlanTasks
    ? calculateProgressFromSteps(normalizedSteps)
    : Number.isFinite(raw.progress)
      ? Math.max(0, Math.min(100, Math.round(raw.progress)))
      : 0;
  const rawStatus = normalizeProjectStatus(raw.status);
  const statusMode = raw.statusMode === "manual" || rawStatus === "archived" ? "manual" : "auto";
  const status = statusMode === "manual" ? rawStatus : deriveProjectStatusFromSteps(rawStatus, normalizedSteps);

  return {
    ...raw,
    workspace,
    mode,
    projectType,
    subcategory,
    subcategoryColor,
    priority,
    isCustomSubcategory,
    customSubcategoryLabel: isCustomSubcategory ? customSubcategoryLabel : undefined,
    customSubcategoryColor: isCustomSubcategory ? customSubcategoryColor : undefined,
    color: normalizeHexColor(raw.color, subcategoryColor),
    status,
    statusMode,
    progress,
    description: buildProjectNarrativeFallback(raw, "description"),
    objective: buildProjectNarrativeFallback(raw, "objective"),
    context: buildProjectNarrativeFallback(raw, "context"),
    currentPriority: sanitizeText(raw.currentPriority) || buildInitialCurrentPriority(priority, projectType),
    nextStep: sanitizeText(raw.nextStep) || buildInitialNextStep(projectType),
    risks: normalizedRisks,
    blockers: normalizedBlockers,
    files: Array.isArray(raw.files) ? raw.files.map(normalizeProjectFile) : [],
    people: Array.isArray(raw.people) ? raw.people.map(normalizeProjectPerson).filter((person) => person.name) : [],
    teams: Array.isArray(raw.teams) ? raw.teams.map(normalizeProjectTeam).filter((team) => team.name) : [],
    teamMessages: Array.isArray(raw.teamMessages) ? raw.teamMessages.map(normalizeProjectTeamMessage).filter((message) => message.content) : [],
    statusSettings: normalizeProjectStatusSettings(raw.statusSettings),
    steps: normalizedSteps,
  } as Project;
}

function normalizeProjectFile(file: Partial<ProjectFile>, index: number): ProjectFile {
  const name = sanitizeText(file.name) || `Fichier ${index + 1}`;
  const ext = file.ext === "pdf" || file.ext === "doc" || file.ext === "xls" || file.ext === "img" || file.ext === "link" || file.ext === "other"
    ? file.ext
    : guessProjectFileExt(name);

  return {
    id: sanitizeText(file.id) || `file_${index + 1}`,
    name,
    ext,
    size: sanitizeText(file.size) || undefined,
    addedAt: sanitizeText(file.addedAt) || new Date().toISOString().slice(0, 10),
    url: sanitizeText(file.url) || undefined,
    mimeType: sanitizeText(file.mimeType) || undefined,
    storagePath: sanitizeText(file.storagePath) || undefined,
    source: file.source === "upload" || file.source === "link" || file.source === "generated" ? file.source : "mock",
    generatedContent: sanitizeTextBlock(file.generatedContent) || undefined,
    linkedTo: file.linkedTo === "task" ? "task" : "project",
    stepId: sanitizeText(file.stepId) || undefined,
    stepTitle: sanitizeText(file.stepTitle) || undefined,
    taskId: sanitizeText(file.taskId) || undefined,
    taskTitle: sanitizeText(file.taskTitle) || undefined,
  };
}

function normalizeProjectPerson(person: Partial<ProjectPerson>, index: number): ProjectPerson {
  return {
    id: sanitizeText(person.id) || `person_${index + 1}`,
    name: sanitizeText(person.name),
    email: sanitizeText(person.email) || undefined,
    role: sanitizeText(person.role) || undefined,
    teamIds: sanitizeIdList(person.teamIds),
    createdAt: sanitizeText(person.createdAt) || new Date().toISOString(),
  };
}

function normalizeProjectTeam(team: Partial<ProjectTeam>, index: number): ProjectTeam {
  return {
    id: sanitizeText(team.id) || `team_${index + 1}`,
    name: sanitizeText(team.name),
    color: normalizeHexColor(team.color, "#64748B"),
    memberIds: sanitizeIdList(team.memberIds),
    createdAt: sanitizeText(team.createdAt) || new Date().toISOString(),
  };
}

function normalizeProjectTeamMessage(message: Partial<ProjectTeamMessage>, index: number): ProjectTeamMessage {
  return {
    id: sanitizeText(message.id) || `team_msg_${index + 1}`,
    authorName: sanitizeText(message.authorName) || getActiveAccountName(),
    authorPersonId: sanitizeText(message.authorPersonId) || undefined,
    content: sanitizeText(message.content),
    createdAt: sanitizeText(message.createdAt) || new Date().toISOString(),
  };
}

function normalizeProjectStatusSettings(settings: ProjectStatusSettings | undefined): ProjectStatusSettings | undefined {
  if (!settings?.task && !settings?.step && !settings?.customTask && !settings?.customStep) return settings;

  const normalizedTaskSettings = settings?.task ? Object.fromEntries(
    Object.entries(settings.task)
      .filter(([status]) => isTaskStatus(status))
      .map(([status, setting]) => {
        const systemStatus = status as TaskStatus;
        return [
          systemStatus,
          {
            systemStatus,
            label: sanitizeText(setting?.label) || taskStatusLabels[systemStatus],
            color: normalizeHexColor(setting?.color, TASK_STATUS_COLORS[systemStatus]),
            enabled: setting?.enabled !== false,
          },
        ];
      }),
  ) as ProjectStatusSettings["task"] : undefined;

  const normalizedStepSettings = settings?.step ? Object.fromEntries(
    Object.entries(settings.step)
      .filter(([status]) => isStepStatus(status))
      .map(([status, setting]) => {
        const systemStatus = status as StepStatus;
        return [
          systemStatus,
          {
            systemStatus,
            label: sanitizeText(setting?.label) || stepStatusLabels[systemStatus],
            color: normalizeHexColor(setting?.color, STEP_STATUS_COLORS[systemStatus]),
            enabled: setting?.enabled !== false,
          },
        ];
      }),
  ) as ProjectStatusSettings["step"] : undefined;

  const normalizedCustomTaskSettings = Array.isArray(settings.customTask)
    ? settings.customTask
        .filter((setting) => isTaskStatus(setting.systemStatus))
        .map((setting, index) => {
          const systemStatus = setting.systemStatus as TaskStatus;
          return {
            id: sanitizeText(setting.id) || `custom-task-${index + 1}`,
            systemStatus,
            label: sanitizeText(setting.label) || taskStatusLabels[systemStatus],
            color: normalizeHexColor(setting.color, TASK_STATUS_COLORS[systemStatus]),
            enabled: setting.enabled !== false,
          };
        })
    : undefined;

  const normalizedCustomStepSettings = Array.isArray(settings.customStep)
    ? settings.customStep
        .filter((setting) => isStepStatus(setting.systemStatus))
        .map((setting, index) => {
          const systemStatus = setting.systemStatus as StepStatus;
          return {
            id: sanitizeText(setting.id) || `custom-step-${index + 1}`,
            systemStatus,
            label: sanitizeText(setting.label) || stepStatusLabels[systemStatus],
            color: normalizeHexColor(setting.color, STEP_STATUS_COLORS[systemStatus]),
            enabled: setting.enabled !== false,
          };
        })
    : undefined;

  return {
    ...settings,
    task: normalizedTaskSettings,
    step: normalizedStepSettings,
    customTask: normalizedCustomTaskSettings,
    customStep: normalizedCustomStepSettings,
  };
}

function sanitizeIdList(ids: string[] | undefined) {
  const next = ids?.map((id) => sanitizeText(id)).filter(Boolean) ?? [];
  return next.length > 0 ? Array.from(new Set(next)) : undefined;
}

// Sur Vercel/Lambda les fonctions tournent dans un FS en lecture seule
// (sauf /tmp). On détecte ça pour swallow les erreurs d'écriture plutôt
// que crasher les Server Components avec un EROFS.
const IS_READONLY_FS = Boolean(process.env.VERCEL) || process.env.NODE_ENV === "production";

// Redis (via le store Vercel Marketplace) — source de vérité partagée
// entre toutes les instances serverless. Sans ça, chaque instance avait
// son propre cache mémoire, ce qui causait des 404 aléatoires quand
// l'utilisateur naviguait sur une instance qui n'avait jamais vu la
// création/mutation. On lit REDIS_URL injecté par Vercel.
const REDIS_URL = process.env.REDIS_URL;
const REDIS_AVAILABLE = Boolean(REDIS_URL);
const REDIS_KEY = "mindbase:projects";

interface RedisStore {
  version: number;
  projects: Project[];
}

// Connexion Redis paresseuse, mémoïsée à l'échelle de l'instance
// serverless pour ne pas se reconnecter à chaque requête. Vercel garde
// les instances warm un certain temps, donc la même connexion TCP est
// réutilisée. Les erreurs sont loggées et n'arrêtent pas le rendu.
type RedisClient = RedisClientType<Record<string, never>, Record<string, never>, Record<string, never>>;
let redisClientPromise: Promise<RedisClient> | null = null;

function getRedisClient(): Promise<RedisClient> {
  if (!REDIS_URL) {
    return Promise.reject(new Error("REDIS_URL is not set"));
  }
  if (!redisClientPromise) {
    const client = createClient({ url: REDIS_URL }) as RedisClient;
    client.on("error", (err) => {
      console.error("[project-store] redis error:", err);
    });
    redisClientPromise = client.connect().then(() => client).catch((err) => {
      // Reset pour qu'une prochaine tentative refasse un connect plutôt
      // que de garder une promesse rejetée à vie.
      redisClientPromise = null;
      throw err;
    });
  }
  return redisClientPromise;
}

async function ensureProjectStore() {
  // Priorité 1 : Redis (Vercel Marketplace via REDIS_URL).
  if (REDIS_AVAILABLE) {
    try {
      const client = await getRedisClient();
      const raw = await client.get(REDIS_KEY);
      if (raw) {
        const parsed = JSON.parse(raw) as Partial<RedisStore>;
        if (Array.isArray(parsed.projects) && parsed.projects.length > 0) {
          return parsed.projects.map((project) => normalizeProject(project as Project));
        }
      }
      // Pas encore initialisé → on hydrate avec les seeds.
      const seeds = cloneSeedProjects().map((project) => normalizeProject(project));
      try {
        await client.set(
          REDIS_KEY,
          JSON.stringify({ version: STORE_VERSION, projects: seeds } satisfies RedisStore),
        );
      } catch (error) {
        console.error("[project-store] redis seed write failed:", error);
      }
      return seeds;
    } catch (error) {
      console.error("[project-store] redis read failed, falling back to seeds:", error);
      return cloneSeedProjects().map((project) => normalizeProject(project));
    }
  }

  // Priorité 2 : filesystem local (dev). Garde large : si la lecture
  // échoue pour une raison quelconque (FS, JSON parse…), on retombe sur
  // les seeds plutôt que faire crasher tout le rendu serveur.
  try {
    const content = await readFile(PROJECTS_FILE_PATH, "utf8");
    const parsed = JSON.parse(content) as Partial<ProjectStoreFile>;
    const projectList = Array.isArray(parsed.projects) ? parsed.projects : [];
    const normalized = projectList.map((project) => normalizeProject(project as Project));

    if (parsed.version !== STORE_VERSION || normalized.length !== projectList.length) {
      try {
        await persistProjects(normalized);
      } catch {
        // ignore : version-bump persist est best-effort
      }
    }
    return normalized;
  } catch (error) {
    const isMissingFile =
      typeof error === "object" &&
      error !== null &&
      "code" in error &&
      (error as { code?: string }).code === "ENOENT";

    if (!isMissingFile && !IS_READONLY_FS) {
      throw error;
    }
    if (!isMissingFile) {
      console.error("[project-store] read failed, falling back to seeds:", error);
    }
    return cloneSeedProjects().map((project) => normalizeProject(project));
  }
}

async function persistProjects(projects: Project[]) {
  // Priorité 1 : Redis. Source de vérité partagée pour Vercel.
  if (REDIS_AVAILABLE) {
    try {
      const client = await getRedisClient();
      await client.set(
        REDIS_KEY,
        JSON.stringify({ version: STORE_VERSION, projects } satisfies RedisStore),
      );
    } catch (error) {
      console.error("[project-store] redis write failed:", error);
    }
    return;
  }

  // Priorité 2 : FS local en dev.
  if (IS_READONLY_FS) {
    return; // hébergeur read-only sans Redis → on n'a nulle part où écrire
  }
  const payload: ProjectStoreFile = {
    version: STORE_VERSION,
    projects,
  };

  try {
    await mkdir(path.dirname(PROJECTS_FILE_PATH), { recursive: true });
    await writeFile(PROJECTS_FILE_PATH, `${JSON.stringify(payload, null, 2)}\n`, "utf8");
  } catch (error) {
    console.error("[project-store] persist failed, ignoring:", error);
  }
}

async function queueWrite<T>(operation: () => Promise<T>) {
  const next = writeChain.then(operation, operation);
  writeChain = next.then(() => undefined, () => undefined);
  return next;
}

// Lecture du store mémoïsée à l'échelle d'UNE requête (React.cache) : le
// dashboard, la recherche (2 espaces) et le cron évitent ainsi de relire et
// re-normaliser Redis plusieurs fois pour le même rendu. Les mutations passent
// par ensureProjectStore() directement (non mémoïsé) → toujours frais.
const readProjectsForRequest = cache(async () => ensureProjectStore());

export async function getAllProjects() {
  const projects = await readProjectsForRequest();
  return projects
    .filter((project) => !project.deleted)
    .sort((left, right) => right.updatedAt.localeCompare(left.updatedAt));
}

export async function deleteProject(id: string) {
  return queueWrite(async () => {
    const projects = await ensureProjectStore();
    const target = projects.find((project) => project.id === id);
    if (!target) return;
    // Soft delete : on marque deleted: true plutôt que de filter le projet
    // hors de la liste. Comme ça la mutation peut être enregistrée dans
    // le cache mémoire (via persistProjects) et survivre à la requête
    // suivante en environnement serverless en lecture seule.
    // getAllProjects() filtre déjà les projets `deleted` à la lecture.
    const nextProjects = projects.map((project) =>
      project.id === id
        ? { ...project, deleted: true, updatedAt: new Date().toISOString() }
        : project,
    );
    await persistProjects(nextProjects);
  });
}

export async function cleanupInactiveProjectStorage() {
  return queueWrite(async () => {
    const projects = await ensureProjectStore();
    const archivedProjectIds = projects
      .filter((project) => !project.deleted && project.status === "archived")
      .map((project) => project.id);
    const deletedProjectIds = projects
      .filter((project) => project.deleted)
      .map((project) => project.id);
    const activeProjectIds = projects
      .filter((project) => !project.deleted && project.status !== "archived")
      .map((project) => project.id);
    const compactedProjects = projects.filter((project) => !project.deleted);

    if (compactedProjects.length !== projects.length) {
      await persistProjects(compactedProjects);
    }

    return {
      archivedProjectIds,
      deletedProjectIds,
      activeProjectIds,
      removedProjectIds: deletedProjectIds,
    };
  });
}

export async function getProjectsForWorkspace(workspace: Workspace) {
  const projects = await getAllProjects();
  // Vue agrégée "all" : tous les environnements confondus.
  if (workspace === "all") return projects;
  return projects.filter((project) => project.workspace === workspace);
}

export async function getProjectById(id: string) {
  const projects = await getAllProjects();
  return projects.find((project) => project.id === id);
}

export async function getSidebarStatsByWorkspace(extraWorkspaces: string[] = []) {
  const projects = await getAllProjects();

  const stats: Record<string, ReturnType<typeof buildWorkspaceSidebarStats>> = {
    personal: buildWorkspaceSidebarStats(projects, "personal"),
    professional: buildWorkspaceSidebarStats(projects, "professional"),
  };
  for (const workspace of extraWorkspaces) {
    stats[workspace] = buildWorkspaceSidebarStats(projects, workspace);
  }
  return stats;
}

function buildWorkspaceSidebarStats(projects: Project[], workspace: Workspace) {
  const scopedProjects = projects.filter((project) => project.workspace === workspace && project.status !== "archived");
  return {
    projectCount: scopedProjects.length,
    pendingActionsCount: scopedProjects.reduce((total, project) => {
      const stepsTasksPending = (project.steps ?? []).flatMap((step) => step.tasks).filter((task) => !task.done).length;
      const legacyPending = stepsTasksPending === 0
        ? project.actions.filter((action) => !action.done).length
        : 0;
      return total + stepsTasksPending + legacyPending;
    }, 0),
    openBlockersCount: scopedProjects.flatMap((project) => project.blockers).filter((blocker) => blocker.status === "open").length,
  };
}

export interface CreateProjectInput {
  workspace: Workspace;
  mode: ProjectMode;
  name: string;
  description: string;
  objective: string;
  context: string;
  status: ProjectStatus;
  projectType: ProjectType;
  subcategory: string;
  priority: ProjectPriority;
  customSubcategoryLabel?: string;
  customSubcategoryColor?: string;
  templateKey?: string;
  statusSettings?: ProjectStatusSettings;
}

export async function createProject(input: CreateProjectInput) {
  const standardOption = getSubcategoryOption(input.workspace, input.subcategory) ?? getSubcategoryOption(input.workspace, "other")!;
  const isCustomSubcategory = isCustomSubcategorySelection(input.subcategory);
  const customLabel = sanitizeText(input.customSubcategoryLabel);
  const customColor = normalizeHexColor(input.customSubcategoryColor, standardOption.color);
  const subcategoryColor = isCustomSubcategory ? customColor : normalizeHexColor(standardOption.color, standardOption.color);
  const now = new Date().toISOString();
  // Le compte courant devient le créateur du projet (droits de filtrage par
  // personne dans Kanban/Calendrier).
  const createdBy = (await getProfile().catch(() => null))?.name?.trim() || getActiveAccountName();
  const template = getProjectTemplateByKey(input.templateKey);
  const templateSteps = template && template.workspace === input.workspace ? buildTemplateSteps(template.key, now) : [];
  const templateActivity = template && template.workspace === input.workspace
    ? [
        {
          id: `act_${crypto.randomUUID().slice(0, 8)}`,
          date: now,
          title: "Projet initialisé depuis un template",
          detail: template.label,
          tone: "neutral" as const,
        },
      ]
    : [];

  const project: Project = normalizeProject({
    id: `p_${crypto.randomUUID().slice(0, 8)}`,
    workspace: input.workspace,
    mode: input.mode,
    name: sanitizeText(input.name),
    description: sanitizeText(input.description),
    objective: sanitizeText(input.objective),
    context: sanitizeText(input.context),
    status: input.status,
    progress: 0,
    currentPriority: template?.currentPriority || buildInitialCurrentPriority(input.priority, input.projectType),
    nextStep: template?.nextStep || buildInitialNextStep(input.projectType),
    decisions: [],
    risks: [],
    blockers: [],
    actions: [],
    steps: templateSteps,
    activity: templateActivity,
    updatedAt: now,
    color: subcategoryColor,
    projectType: input.projectType,
    subcategory: isCustomSubcategory ? "other" : standardOption.key,
    subcategoryColor,
    priority: input.priority,
    isCustomSubcategory,
    customSubcategoryLabel: isCustomSubcategory ? customLabel : undefined,
    customSubcategoryColor: isCustomSubcategory ? customColor : undefined,
    templateKey: template?.workspace === input.workspace ? template.key : undefined,
    statusSettings: input.statusSettings,
    createdBy,
  });

  await queueWrite(async () => {
    const projects = await ensureProjectStore();
    const nextProjects = [project, ...projects];
    await persistProjects(nextProjects);
  });

  return project;
}

export async function addFileToProject(
  projectId: string,
  file: ProjectFile,
): Promise<Project | undefined> {
  return queueWrite(async () => {
    const projects = await ensureProjectStore();
    const projectIndex = projects.findIndex((project) => project.id === projectId);
    if (projectIndex === -1) return undefined;

    const current = projects[projectIndex];
    const normalizedFile = normalizeProjectFile(file, current.files?.length ?? 0);
    const withoutDuplicate = (current.files ?? []).filter((existing) => existing.id !== normalizedFile.id);
    const now = new Date().toISOString();
    const newActivityItem: ProjectActivityItem = {
      id: `act_${crypto.randomUUID().slice(0, 8)}`,
      date: now,
      title: "Fichier ajouté au projet",
      detail: normalizedFile.name,
      tone: "neutral",
    };

    const updated = normalizeProject({
      ...current,
      files: [normalizedFile, ...withoutDuplicate],
      activity: [newActivityItem, ...(current.activity ?? [])].slice(0, 50),
      updatedAt: now,
    });

    const nextProjects = [...projects];
    nextProjects[projectIndex] = updated;
    await persistProjects(nextProjects);
    return updated;
  });
}

export async function removeFileFromProject(
  projectId: string,
  fileId: string,
): Promise<Project | undefined> {
  return queueWrite(async () => {
    const projects = await ensureProjectStore();
    const projectIndex = projects.findIndex((project) => project.id === projectId);
    if (projectIndex === -1) return undefined;

    const current = projects[projectIndex];
    const removedFile = (current.files ?? []).find((file) => file.id === fileId);
    const updatedFiles = (current.files ?? []).filter((file) => file.id !== fileId);
    const updatedSteps = removeFileFromSteps(current.steps ?? [], fileId);
    const now = new Date().toISOString();
    const activity = removedFile
      ? [
          {
            id: `act_${crypto.randomUUID().slice(0, 8)}`,
            date: now,
            title: "Fichier retiré du projet",
            detail: removedFile.name,
            tone: "neutral" as const,
          },
          ...(current.activity ?? []),
        ].slice(0, 50)
      : current.activity;

    const updated = normalizeProject({
      ...current,
      files: updatedFiles,
      steps: updatedSteps,
      activity,
      updatedAt: now,
    });

    const nextProjects = [...projects];
    nextProjects[projectIndex] = updated;
    await persistProjects(nextProjects);
    return updated;
  });
}

function removeFileFromSteps(steps: Step[], fileId: string) {
  return steps.map((step) => ({
    ...step,
    tasks: step.tasks.map((task) => ({
      ...task,
      files: task.files?.filter((file) => file.id !== fileId),
    })),
  }));
}

export async function addTaskFileToProject(
  projectId: string,
  stepId: string,
  taskId: string,
  file: ProjectFile,
): Promise<Project | undefined> {
  return queueWrite(async () => {
    const projects = await ensureProjectStore();
    const projectIndex = projects.findIndex((project) => project.id === projectId);
    if (projectIndex === -1) return undefined;

    const current = projects[projectIndex];
    const steps = current.steps ?? [];
    const stepIndex = steps.findIndex((step) => step.id === stepId);
    if (stepIndex === -1) return current;

    const step = steps[stepIndex];
    const taskIndex = step.tasks.findIndex((task) => task.id === taskId);
    if (taskIndex === -1) return current;

    const task = step.tasks[taskIndex];
    const normalizedFile = normalizeProjectFile(
      {
        ...file,
        linkedTo: "task",
        stepId,
        stepTitle: step.title,
        taskId,
        taskTitle: task.title,
      },
      current.files?.length ?? 0,
    );
    const taskFiles = [normalizedFile, ...(task.files ?? []).filter((existing) => existing.id !== normalizedFile.id)];
    const updatedTask: Task = {
      ...task,
      files: taskFiles,
    };
    const updatedTasks = [...step.tasks];
    updatedTasks[taskIndex] = updatedTask;
    const updatedStep: Step = {
      ...step,
      tasks: updatedTasks,
    };
    const updatedSteps = [...steps];
    updatedSteps[stepIndex] = updatedStep;
    const projectFiles = [normalizedFile, ...(current.files ?? []).filter((existing) => existing.id !== normalizedFile.id)];
    const now = new Date().toISOString();
    const activityItem: ProjectActivityItem = {
      id: `act_${crypto.randomUUID().slice(0, 8)}`,
      date: now,
      title: "Fichier ajouté à une tâche",
      detail: `${normalizedFile.name} · ${task.title}`,
      tone: "neutral",
    };

    const updated = normalizeProject({
      ...current,
      files: projectFiles,
      steps: updatedSteps,
      activity: [activityItem, ...(current.activity ?? [])].slice(0, 50),
      updatedAt: now,
    });

    const nextProjects = [...projects];
    nextProjects[projectIndex] = updated;
    await persistProjects(nextProjects);
    return updated;
  });
}

export async function removeTaskFileFromProject(
  projectId: string,
  stepId: string,
  taskId: string,
  fileId: string,
): Promise<Project | undefined> {
  return queueWrite(async () => {
    const projects = await ensureProjectStore();
    const projectIndex = projects.findIndex((project) => project.id === projectId);
    if (projectIndex === -1) return undefined;

    const current = projects[projectIndex];
    const removedFile = (current.files ?? []).find((file) => file.id === fileId);
    const updatedFiles = (current.files ?? []).filter((file) => file.id !== fileId);
    const steps = current.steps ?? [];
    const stepIndex = steps.findIndex((step) => step.id === stepId);
    const updatedSteps = stepIndex === -1
      ? removeFileFromSteps(steps, fileId)
      : steps.map((step) => {
          if (step.id !== stepId) return step;
          return {
            ...step,
            tasks: step.tasks.map((task) =>
              task.id === taskId ? { ...task, files: task.files?.filter((file) => file.id !== fileId) } : task,
            ),
          };
        });
    const now = new Date().toISOString();
    const activity = removedFile
      ? [
          {
            id: `act_${crypto.randomUUID().slice(0, 8)}`,
            date: now,
            title: "Fichier retiré d'une tâche",
            detail: `${removedFile.name}${removedFile.taskTitle ? ` · ${removedFile.taskTitle}` : ""}`,
            tone: "neutral" as const,
          },
          ...(current.activity ?? []),
        ].slice(0, 50)
      : current.activity;

    const updated = normalizeProject({
      ...current,
      files: updatedFiles,
      steps: updatedSteps,
      activity,
      updatedAt: now,
    });

    const nextProjects = [...projects];
    nextProjects[projectIndex] = updated;
    await persistProjects(nextProjects);
    return updated;
  });
}

export async function appendTaskDiscussionMessage(
  projectId: string,
  stepId: string,
  taskId: string,
  input: Pick<TaskDiscussionMessage, "authorName" | "content"> & Partial<Pick<TaskDiscussionMessage, "authorPersonId">>,
): Promise<Project | undefined> {
  return queueWrite(async () => {
    const authorName = sanitizeText(input.authorName) || getActiveAccountName();
    const content = sanitizeText(input.content);
    if (!content) return undefined;

    const projects = await ensureProjectStore();
    const projectIndex = projects.findIndex((project) => project.id === projectId);
    if (projectIndex === -1) return undefined;

    const current = projects[projectIndex];
    const steps = current.steps ?? [];
    const stepIndex = steps.findIndex((step) => step.id === stepId);
    if (stepIndex === -1) return current;

    const step = steps[stepIndex];
    const taskIndex = step.tasks.findIndex((task) => task.id === taskId);
    if (taskIndex === -1) return current;

    const task = step.tasks[taskIndex];
    const now = new Date().toISOString();
    const message: TaskDiscussionMessage = {
      id: `msg_${crypto.randomUUID().slice(0, 8)}`,
      authorName,
      authorPersonId: sanitizeText(input.authorPersonId) || undefined,
      content,
      createdAt: now,
    };
    const updatedTask: Task = {
      ...task,
      discussion: [...(task.discussion ?? []), message],
    };
    const updatedTasks = [...step.tasks];
    updatedTasks[taskIndex] = updatedTask;
    const updatedSteps = [...steps];
    updatedSteps[stepIndex] = { ...step, tasks: updatedTasks };
    const activityItem: ProjectActivityItem = {
      id: `act_${crypto.randomUUID().slice(0, 8)}`,
      date: now,
      title: "Discussion de tâche mise à jour",
      detail: `${task.title} · ${authorName}`,
      tone: "neutral",
    };

    const updated = normalizeProject({
      ...current,
      steps: updatedSteps,
      activity: [activityItem, ...(current.activity ?? [])].slice(0, 50),
      updatedAt: now,
    });

    const nextProjects = [...projects];
    nextProjects[projectIndex] = updated;
    await persistProjects(nextProjects);
    return updated;
  });
}

export async function addProjectPerson(
  projectId: string,
  input: Pick<ProjectPerson, "name"> & Partial<Pick<ProjectPerson, "email" | "role">>,
): Promise<Project | undefined> {
  return queueWrite(async () => {
    const name = sanitizeText(input.name);
    if (!name) return undefined;

    const projects = await ensureProjectStore();
    const projectIndex = projects.findIndex((project) => project.id === projectId);
    if (projectIndex === -1) return undefined;

    const current = projects[projectIndex];
    const normalizedName = name.toLocaleLowerCase("fr-FR");
    const alreadyExists = (current.people ?? []).some((person) => person.name.toLocaleLowerCase("fr-FR") === normalizedName);
    if (alreadyExists) return current;

    const now = new Date().toISOString();
    const person: ProjectPerson = {
      id: `person_${crypto.randomUUID().slice(0, 8)}`,
      name,
      email: sanitizeText(input.email) || undefined,
      role: sanitizeText(input.role) || undefined,
      createdAt: now,
    };
    const activityItem: ProjectActivityItem = {
      id: `act_${crypto.randomUUID().slice(0, 8)}`,
      date: now,
      title: "Personne ajoutée au projet",
      detail: person.name,
      tone: "neutral",
    };

    const updated = normalizeProject({
      ...current,
      people: [person, ...(current.people ?? [])],
      activity: [activityItem, ...(current.activity ?? [])].slice(0, 50),
      updatedAt: now,
    });

    const nextProjects = [...projects];
    nextProjects[projectIndex] = updated;
    await persistProjects(nextProjects);
    return updated;
  });
}

export async function addProjectTeam(
  projectId: string,
  input: Pick<ProjectTeam, "name"> & Partial<Pick<ProjectTeam, "color" | "memberIds">>,
): Promise<Project | undefined> {
  return queueWrite(async () => {
    const name = sanitizeText(input.name);
    if (!name) return undefined;

    const projects = await ensureProjectStore();
    const projectIndex = projects.findIndex((project) => project.id === projectId);
    if (projectIndex === -1) return undefined;

    const current = projects[projectIndex];
    const normalizedName = name.toLocaleLowerCase("fr-FR");
    const alreadyExists = (current.teams ?? []).some((team) => team.name.toLocaleLowerCase("fr-FR") === normalizedName);
    if (alreadyExists) return current;

    const now = new Date().toISOString();
    const team: ProjectTeam = {
      id: `team_${crypto.randomUUID().slice(0, 8)}`,
      name,
      color: normalizeHexColor(input.color, "#64748B"),
      memberIds: sanitizeIdList(input.memberIds),
      createdAt: now,
    };
    const activityItem: ProjectActivityItem = {
      id: `act_${crypto.randomUUID().slice(0, 8)}`,
      date: now,
      title: "Équipe ajoutée au projet",
      detail: team.name,
      tone: "neutral",
    };

    const updated = normalizeProject({
      ...current,
      teams: [team, ...(current.teams ?? [])],
      activity: [activityItem, ...(current.activity ?? [])].slice(0, 50),
      updatedAt: now,
    });

    const nextProjects = [...projects];
    nextProjects[projectIndex] = updated;
    await persistProjects(nextProjects);
    return updated;
  });
}

export async function updateProjectTeam(
  projectId: string,
  teamId: string,
  input: Partial<Pick<ProjectTeam, "name" | "color" | "memberIds">>,
): Promise<Project | undefined> {
  return queueWrite(async () => {
    const projects = await ensureProjectStore();
    const projectIndex = projects.findIndex((project) => project.id === projectId);
    if (projectIndex === -1) return undefined;

    const current = projects[projectIndex];
    const teams = current.teams ?? [];
    const teamIndex = teams.findIndex((team) => team.id === teamId);
    if (teamIndex === -1) return current;

    const currentTeam = teams[teamIndex];
    const nextName = input.name !== undefined ? sanitizeText(input.name) : currentTeam.name;
    if (!nextName) return current;

    const updatedTeam: ProjectTeam = {
      ...currentTeam,
      name: nextName,
      color: input.color !== undefined ? normalizeHexColor(input.color, currentTeam.color ?? "#64748B") : currentTeam.color,
      memberIds: input.memberIds !== undefined ? sanitizeIdList(input.memberIds) : currentTeam.memberIds,
    };
    const now = new Date().toISOString();
    const activityItem: ProjectActivityItem = {
      id: `act_${crypto.randomUUID().slice(0, 8)}`,
      date: now,
      title: "Équipe mise à jour",
      detail: updatedTeam.name,
      tone: "neutral",
    };

    const updatedTeams = [...teams];
    updatedTeams[teamIndex] = updatedTeam;

    const updated = normalizeProject({
      ...current,
      teams: updatedTeams,
      activity: [activityItem, ...(current.activity ?? [])].slice(0, 50),
      updatedAt: now,
    });

    const nextProjects = [...projects];
    nextProjects[projectIndex] = updated;
    await persistProjects(nextProjects);
    return updated;
  });
}

export async function appendProjectTeamMessage(
  projectId: string,
  input: Pick<ProjectTeamMessage, "authorName" | "content"> & Partial<Pick<ProjectTeamMessage, "authorPersonId">>,
): Promise<Project | undefined> {
  return queueWrite(async () => {
    const authorName = sanitizeText(input.authorName) || getActiveAccountName();
    const content = sanitizeText(input.content);
    if (!content) return undefined;

    const projects = await ensureProjectStore();
    const projectIndex = projects.findIndex((project) => project.id === projectId);
    if (projectIndex === -1) return undefined;

    const current = projects[projectIndex];
    const now = new Date().toISOString();
    const message: ProjectTeamMessage = {
      id: `team_msg_${crypto.randomUUID().slice(0, 8)}`,
      authorName,
      authorPersonId: sanitizeText(input.authorPersonId) || undefined,
      content,
      createdAt: now,
    };
    const activityItem: ProjectActivityItem = {
      id: `act_${crypto.randomUUID().slice(0, 8)}`,
      date: now,
      title: "Message équipe ajouté",
      detail: `${authorName} · ${content}`,
      tone: "neutral",
    };

    const updated = normalizeProject({
      ...current,
      teamMessages: [...(current.teamMessages ?? []), message],
      activity: [activityItem, ...(current.activity ?? [])].slice(0, 50),
      updatedAt: now,
    });

    const nextProjects = [...projects];
    nextProjects[projectIndex] = updated;
    await persistProjects(nextProjects);
    return updated;
  });
}

export async function updateTaskStatusSetting(
  projectId: string,
  status: TaskStatus,
  input: { label?: string; color?: string },
): Promise<Project | undefined> {
  return queueWrite(async () => {
    const projects = await ensureProjectStore();
    const projectIndex = projects.findIndex((project) => project.id === projectId);
    if (projectIndex === -1) return undefined;

    const current = projects[projectIndex];
    const currentSettings = current.statusSettings?.task ?? {};
    const currentStatusSetting = currentSettings[status];
    const nextLabel = sanitizeText(input.label) || currentStatusSetting?.label || taskStatusLabels[status];
    const nextColor = normalizeHexColor(input.color, currentStatusSetting?.color ?? TASK_STATUS_COLORS[status]);

    const updated = normalizeProject({
      ...current,
      statusSettings: {
        ...(current.statusSettings ?? {}),
        task: {
          ...currentSettings,
          [status]: {
            systemStatus: status,
            label: nextLabel,
            color: nextColor,
          },
        },
      },
      updatedAt: new Date().toISOString(),
    });

    const nextProjects = [...projects];
    nextProjects[projectIndex] = updated;
    await persistProjects(nextProjects);
    return updated;
  });
}

export async function updateStepStatusSetting(
  projectId: string,
  status: StepStatus,
  input: { label?: string; color?: string },
): Promise<Project | undefined> {
  return queueWrite(async () => {
    const projects = await ensureProjectStore();
    const projectIndex = projects.findIndex((project) => project.id === projectId);
    if (projectIndex === -1) return undefined;

    const current = projects[projectIndex];
    const currentSettings = current.statusSettings?.step ?? {};
    const currentStatusSetting = currentSettings[status];
    const nextLabel = sanitizeText(input.label) || currentStatusSetting?.label || stepStatusLabels[status];
    const nextColor = normalizeHexColor(input.color, currentStatusSetting?.color ?? STEP_STATUS_COLORS[status]);

    const updated = normalizeProject({
      ...current,
      statusSettings: {
        ...(current.statusSettings ?? {}),
        step: {
          ...currentSettings,
          [status]: {
            systemStatus: status,
            label: nextLabel,
            color: nextColor,
          },
        },
      },
      updatedAt: new Date().toISOString(),
    });

    const nextProjects = [...projects];
    nextProjects[projectIndex] = updated;
    await persistProjects(nextProjects);
    return updated;
  });
}

export interface UpdateProjectInput extends Partial<Omit<CreateProjectInput, "workspace">> {
  workspace?: Workspace;
  progress?: number;
  currentPriority?: string;
  nextStep?: string;
  statusMode?: Project["statusMode"];
  risks?: Project["risks"];
  /** Permet de purger / réinitialiser l'historique d'activité (ex: archivage). */
  activity?: Project["activity"];
}

function buildTemplateSteps(templateKey: string, now: string): Step[] {
  const template = getProjectTemplateByKey(templateKey);
  if (!template) return [];

  return template.steps.map((step, stepIndex) => ({
    id: `s_${crypto.randomUUID().slice(0, 8)}`,
    title: step.title,
    description: step.description,
    status: "todo",
    order: stepIndex + 1,
    priority: normalizePlanPriority(step.priority),
    tasks: step.tasks.map((task, taskIndex) => ({
      id: `t_${crypto.randomUUID().slice(0, 8)}`,
      title: task.title,
      description: task.description,
      done: false,
      status: "todo",
      owner: task.owner,
      dueDate: typeof task.dueOffsetDays === "number" ? buildDateFromOffset(now, task.dueOffsetDays) : undefined,
      priority: normalizePlanPriority(task.priority),
      order: taskIndex + 1,
      guidance: task.guidance,
      source: "imported",
    })),
  }));
}

function buildDateFromOffset(reference: string, offsetDays: number) {
  const date = new Date(reference);
  date.setDate(date.getDate() + offsetDays);
  return date.toISOString().slice(0, 10);
}

export interface UpdateStepInput {
  title?: string;
  description?: string;
  priority?: ProjectPriority;
}

export interface UpdateTaskInput {
  title?: string;
  description?: string;
  owner?: string;
  assignees?: string[];
  teamIds?: string[];
  dueDate?: string;
  dueTime?: string;
  priority?: ProjectPriority;
  status?: TaskStatus;
  done?: boolean;
  blocked?: boolean;
  statusNote?: string;
  expected?: string;
  realization?: string;
  comments?: string[];
  checklist?: ChecklistItem[];
}

export interface CompleteTaskInput {
  details: string;
}

export async function completeTaskWithRealization(
  projectId: string,
  stepId: string,
  taskId: string,
  input: CompleteTaskInput,
): Promise<Project | undefined> {
  return queueWrite(async () => {
    const details = sanitizeText(input.details);
    if (!details) {
      throw new Error("Des détails sont requis pour terminer cette tâche.");
    }

    const projects = await ensureProjectStore();
    const projectIndex = projects.findIndex((project) => project.id === projectId);
    if (projectIndex === -1) return undefined;

    const current = projects[projectIndex];
    const steps = current.steps ?? [];
    const stepIndex = steps.findIndex((step) => step.id === stepId);
    if (stepIndex === -1) return current;

    const currentStep = steps[stepIndex];
    const taskIndex = currentStep.tasks.findIndex((task) => task.id === taskId);
    if (taskIndex === -1) return current;

    const task = currentStep.tasks[taskIndex];
    const now = new Date().toISOString();
    const canComplete = isChecklistComplete(task.checklist);

    const updatedTask: Task = {
      ...task,
      done: canComplete,
      status: canComplete ? "done" : "in_progress",
      blocked: canComplete ? false : task.blocked === true ? false : task.blocked,
      completedAt: canComplete ? now : undefined,
      completionDetails: canComplete ? details : undefined,
      completionDecisionId: undefined,
      completionDecisionTitle: undefined,
      completionSource: canComplete ? "manual" : undefined,
      realization: appendTaskRealization(task.realization ?? task.completionDetails, details),
    };

    const updatedTasks = [...currentStep.tasks];
    updatedTasks[taskIndex] = updatedTask;

    const updatedStep: Step = {
      ...currentStep,
      tasks: updatedTasks,
      status: deriveStepStatus(updatedTasks),
    };

    const updatedSteps = [...steps];
    updatedSteps[stepIndex] = updatedStep;
    const newProgress = calculateProgressFromSteps(updatedSteps);

    const legacyActionId = updatedTask.id.startsWith("t_from_") ? updatedTask.id.slice("t_from_".length) : null;
    const updatedActions = legacyActionId
      ? current.actions.map((action) =>
          action.id === legacyActionId ? { ...action, done: canComplete } : action,
        )
      : current.actions;

    const activityItem: ProjectActivityItem = {
      id: `act_${crypto.randomUUID().slice(0, 8)}`,
      date: now,
      title: canComplete ? "Tâche terminée" : "Tâche avancée",
      detail: canComplete
        ? `${updatedTask.title} · ${details}`
        : `${updatedTask.title} · ${details} · Checklist encore incomplète`,
      tone: canComplete ? "success" : "neutral",
    };

    const updated = normalizeProject({
      ...current,
      actions: updatedActions,
      steps: updatedSteps,
      progress: newProgress,
      status: deriveProjectStatusForMutation(current, updatedSteps),
      activity: [activityItem, ...(current.activity ?? [])].slice(0, 50),
      updatedAt: now,
    });

    const nextProjects = [...projects];
    nextProjects[projectIndex] = updated;
    await persistProjects(nextProjects);
    return updated;
  });
}

export async function updateProject(id: string, input: UpdateProjectInput) {
  return queueWrite(async () => {
    const projects = await ensureProjectStore();
    const projectIndex = projects.findIndex((project) => project.id === id);

    if (projectIndex === -1) {
      return undefined;
    }

    const current = projects[projectIndex];
    const workspace = input.workspace ?? current.workspace;
    const subcategory = input.subcategory ?? current.subcategory;
    const nextPriority = input.priority ?? current.priority;
    const nextProjectType = input.projectType ?? current.projectType;
    const standardOption = getSubcategoryOption(workspace, subcategory) ?? getSubcategoryOption(workspace, "other")!;
    const isCustomSubcategory =
      typeof input.subcategory === "string"
        ? isCustomSubcategorySelection(input.subcategory)
        : current.isCustomSubcategory;
    const customSubcategoryColor = normalizeHexColor(
      input.customSubcategoryColor ?? current.customSubcategoryColor,
      standardOption.color,
    );
    // Une sous-catégorie standard porte toujours sa couleur de référence (cohérence
    // visuelle garantie : changer le pictogramme change automatiquement la couleur du
    // projet partout où elle est utilisée). Seules les sous-catégories custom gardent
    // leur couleur personnalisée.
    const subcategoryColor = isCustomSubcategory ? customSubcategoryColor : standardOption.color;

    const updated = normalizeProject({
      ...current,
      ...input,
      workspace,
      statusMode: input.status ? "manual" : input.statusMode ?? current.statusMode,
      // Important : on aligne explicitement isCustomSubcategory sinon le spread de
      // `current` réintroduit l'ancienne valeur et `normalizeProject` re-bascule en
      // mode custom (bug visible : changer de pictogramme depuis un projet custom
      // gardait la couleur personnalisée et le picto fallback "asterisk").
      isCustomSubcategory,
      subcategory: isCustomSubcategory ? "other" : subcategory,
      subcategoryColor,
      customSubcategoryLabel: isCustomSubcategory
        ? sanitizeText(input.customSubcategoryLabel ?? current.customSubcategoryLabel)
        : undefined,
      customSubcategoryColor: isCustomSubcategory ? customSubcategoryColor : undefined,
      color: subcategoryColor,
      updatedAt: new Date().toISOString(),
      priority: nextPriority,
      projectType: nextProjectType,
      currentPriority:
        sanitizeText(input.currentPriority ?? current.currentPriority) ||
        buildInitialCurrentPriority(nextPriority, nextProjectType),
    });

    const nextProjects = [...projects];
    nextProjects[projectIndex] = updated;
    await persistProjects(nextProjects);
    return updated;
  });
}

export async function addActionToProject(
  projectId: string,
  action: Omit<Action, "id">,
): Promise<Project | undefined> {
  return queueWrite(async () => {
    const projects = await ensureProjectStore();
    const projectIndex = projects.findIndex((project) => project.id === projectId);

    if (projectIndex === -1) {
      return undefined;
    }

    const current = projects[projectIndex];
    const normalizedTitle = normalizeComparableText(action.title);
    const alreadyExists = current.actions.some((existingAction) =>
      normalizeComparableText(existingAction.title) === normalizedTitle,
    ) || (current.steps ?? []).some((step) =>
      step.tasks.some((task) => normalizeComparableText(task.title) === normalizedTitle),
    );

    if (alreadyExists) {
      return current;
    }

    const nextAction: Action = {
      ...action,
      id: `a_${crypto.randomUUID().slice(0, 8)}`,
      done: false,
    };
    const steps = current.steps ?? [];
    const { index: resolvedIndex, createTitle } = resolveStepForAction(steps, action.stepGroup);
    const targetStepIndex = resolvedIndex;
    const targetStep: Step = steps[targetStepIndex] ?? {
      id: `s_${crypto.randomUUID().slice(0, 8)}`,
      title: createTitle ?? "Actions importées",
      description: createTitle ? undefined : "Tâches ajoutées depuis le suivi du projet.",
      status: "todo",
      priority: normalizePlanPriority(action.priority),
      order: steps.length + 1,
      tasks: [],
    };
    const nextTask: Task = {
      id: `t_${crypto.randomUUID().slice(0, 8)}`,
      title: action.title,
      description: action.description,
      done: false,
      status: "todo",
      priority: normalizePlanPriority(action.priority),
      order: targetStep.tasks.length + 1,
      owner: sanitizeText(action.owner) || undefined,
      dueDate: action.due,
      blocked: action.blocked,
      source: "imported",
      guidance: action.description ? [action.description] : undefined,
    };
    const updatedTargetStep: Step = {
      ...targetStep,
      tasks: [...targetStep.tasks, nextTask],
    };
    updatedTargetStep.status = deriveStepStatus(updatedTargetStep.tasks);

    const nextSteps = steps.length > 0 ? [...steps] : [];
    nextSteps[targetStepIndex >= 0 ? targetStepIndex : nextSteps.length] = updatedTargetStep;
    const nextProgress = calculateProgressFromSteps(nextSteps);

    const updated = normalizeProject({
      ...current,
      actions: [nextAction, ...current.actions],
      steps: nextSteps,
      progress: nextProgress,
      status: deriveProjectStatusForMutation(current, nextSteps),
      updatedAt: new Date().toISOString(),
    });

    const nextProjects = [...projects];
    nextProjects[projectIndex] = updated;
    await persistProjects(nextProjects);
    return updated;
  });
}

function normalizeComparableText(value: string) {
  return value.trim().toLocaleLowerCase("fr-FR");
}

function findTargetStepIndex(steps: Step[]) {
  if (steps.length === 0) return -1;
  const inProgressIndex = steps.findIndex((step) => step.status === "in_progress");
  if (inProgressIndex !== -1) return inProgressIndex;
  const todoIndex = steps.findIndex((step) => step.status === "todo");
  return todoIndex !== -1 ? todoIndex : steps.length - 1;
}

/**
 * Finds an existing step whose title matches the action's stepGroup (case-insensitive).
 * Returns { index: number, createTitle?: string }:
 *   - index >= 0  → use existing step at that index
 *   - index === -1 && createTitle  → create a new step with that title
 *   - index === -1 && !createTitle → fall back to findTargetStepIndex
 */
function resolveStepForAction(
  steps: Step[],
  stepGroup: string | undefined,
): { index: number; createTitle?: string } {
  if (stepGroup) {
    const normalized = stepGroup.trim().toLowerCase();
    const existingIndex = steps.findIndex(
      (step) => step.title.trim().toLowerCase() === normalized,
    );
    if (existingIndex !== -1) return { index: existingIndex };
    return { index: -1, createTitle: stepGroup.trim() };
  }
  return { index: findTargetStepIndex(steps) };
}

function reorderSteps(steps: Step[]) {
  return steps
    .slice()
    .sort((left, right) => left.order - right.order)
    .map((step, index) => ({ ...step, order: index + 1 }));
}

function reorderTasks(tasks: Task[]) {
  return tasks
    .slice()
    .sort((left, right) => (left.order ?? 999) - (right.order ?? 999))
    .map((task, index) => ({ ...task, order: index + 1 }));
}

function deriveProjectStatusForMutation(current: Project, steps: Step[]) {
  const currentStatus = normalizeProjectStatus(current.status);
  if (currentStatus === "archived" || current.statusMode === "manual") return currentStatus;
  return deriveProjectStatusFromSteps(currentStatus, steps);
}

export async function toggleTaskDone(
  projectId: string,
  stepId: string,
  taskId: string,
): Promise<Project | undefined> {
  return queueWrite(async () => {
    const projects = await ensureProjectStore();
    const projectIndex = projects.findIndex((p) => p.id === projectId);
    if (projectIndex === -1) return undefined;

    const current = projects[projectIndex];
    const steps = current.steps ?? [];
    const stepIndex = steps.findIndex((s) => s.id === stepId);
    if (stepIndex === -1) return current;

    const step = steps[stepIndex];
    const taskIndex = step.tasks.findIndex((t) => t.id === taskId);
    if (taskIndex === -1) return current;

    const currentTask = step.tasks[taskIndex];
    const isReopening = currentTask.done;
    const updatedTask: Task = isReopening
      ? {
          ...currentTask,
          done: false,
          status: "todo",
          completedAt: undefined,
          completionDetails: undefined,
          completionDecisionId: undefined,
          completionDecisionTitle: undefined,
          completionSource: undefined,
        }
      : { ...currentTask, done: true, status: "done" };
    const updatedTasks = [...step.tasks];
    updatedTasks[taskIndex] = updatedTask;

    const updatedStep: Step = {
      ...step,
      tasks: updatedTasks,
      status: deriveStepStatus(updatedTasks),
    };

    const updatedSteps = [...steps];
    updatedSteps[stepIndex] = updatedStep;

    const newProgress = calculateProgressFromSteps(updatedSteps);

    const legacyActionId = updatedTask.id.startsWith("t_from_") ? updatedTask.id.slice("t_from_".length) : null;
    const updatedActions = legacyActionId
      ? current.actions.map((action) =>
          action.id === legacyActionId ? { ...action, done: updatedTask.done } : action,
        )
      : current.actions;

    const now = new Date().toISOString();
    const newActivityItem: ProjectActivityItem = {
      id: `act_${crypto.randomUUID().slice(0, 8)}`,
      date: now,
      title: updatedTask.done ? "Tâche terminée" : "Tâche rouverte",
      detail: `${updatedTask.title}${step.title ? ` · ${step.title}` : ""}`,
      tone: updatedTask.done ? "success" : "neutral",
    };

    const updated = normalizeProject({
      ...current,
      actions: updatedActions,
      steps: updatedSteps,
      progress: newProgress,
      status: deriveProjectStatusForMutation(current, updatedSteps),
      activity: [newActivityItem, ...(current.activity ?? [])].slice(0, 50),
      updatedAt: now,
    });

    const nextProjects = [...projects];
    nextProjects[projectIndex] = updated;
    await persistProjects(nextProjects);
    return updated;
  });
}

export async function addStepToProject(
  projectId: string,
  step: Pick<Step, "title"> & Partial<Pick<Step, "description" | "priority">>,
): Promise<Project | undefined> {
  return queueWrite(async () => {
    const projects = await ensureProjectStore();
    const projectIndex = projects.findIndex((p) => p.id === projectId);
    if (projectIndex === -1) return undefined;

    const current = projects[projectIndex];
    const steps = current.steps ?? [];
    const newStep: Step = {
      id: `s_${crypto.randomUUID().slice(0, 8)}`,
      title: step.title.trim(),
      description: sanitizeText(step.description),
      status: "todo",
      order: steps.length + 1,
      priority: normalizePlanPriority(step.priority),
      tasks: [],
    };
    const nextSteps = [...steps, newStep];
    const nextProgress = calculateProgressFromSteps(nextSteps);

    const updated = normalizeProject({
      ...current,
      steps: nextSteps,
      progress: nextProgress,
      status: deriveProjectStatusForMutation(current, nextSteps),
      updatedAt: new Date().toISOString(),
    });

    const nextProjects = [...projects];
    nextProjects[projectIndex] = updated;
    await persistProjects(nextProjects);
    return updated;
  });
}

export async function updateStepInProject(
  projectId: string,
  stepId: string,
  input: UpdateStepInput,
): Promise<Project | undefined> {
  return queueWrite(async () => {
    const projects = await ensureProjectStore();
    const projectIndex = projects.findIndex((p) => p.id === projectId);
    if (projectIndex === -1) return undefined;

    const current = projects[projectIndex];
    const steps = current.steps ?? [];
    const stepIndex = steps.findIndex((s) => s.id === stepId);
    if (stepIndex === -1) return current;

    const currentStep = steps[stepIndex];
    const nextTitle = sanitizeText(input.title);
    const updatedStep: Step = {
      ...currentStep,
      title: nextTitle || currentStep.title,
      description: input.description !== undefined ? sanitizeText(input.description) || undefined : currentStep.description,
      priority: input.priority ? normalizePlanPriority(input.priority) : currentStep.priority,
    };

    const updatedSteps = [...steps];
    updatedSteps[stepIndex] = updatedStep;
    const nextSteps = reorderSteps(updatedSteps);
    const nextProgress = calculateProgressFromSteps(nextSteps);

    const updated = normalizeProject({
      ...current,
      steps: nextSteps,
      progress: nextProgress,
      status: deriveProjectStatusForMutation(current, nextSteps),
      updatedAt: new Date().toISOString(),
    });

    const nextProjects = [...projects];
    nextProjects[projectIndex] = updated;
    await persistProjects(nextProjects);
    return updated;
  });
}

export async function deleteStepFromProject(
  projectId: string,
  stepId: string,
): Promise<Project | undefined> {
  return queueWrite(async () => {
    const projects = await ensureProjectStore();
    const projectIndex = projects.findIndex((p) => p.id === projectId);
    if (projectIndex === -1) return undefined;

    const current = projects[projectIndex];
    const steps = current.steps ?? [];
    const updatedSteps = reorderSteps(steps.filter((step) => step.id !== stepId));
    const nextProgress = calculateProgressFromSteps(updatedSteps);

    const updated = normalizeProject({
      ...current,
      steps: updatedSteps,
      progress: nextProgress,
      status: deriveProjectStatusForMutation(current, updatedSteps),
      updatedAt: new Date().toISOString(),
    });

    const nextProjects = [...projects];
    nextProjects[projectIndex] = updated;
    await persistProjects(nextProjects);
    return updated;
  });
}

export async function addTaskToStep(
  projectId: string,
  stepId: string,
  task: Omit<Task, "id" | "done" | "status" | "order">,
): Promise<Project | undefined> {
  return queueWrite(async () => {
    const projects = await ensureProjectStore();
    const projectIndex = projects.findIndex((p) => p.id === projectId);
    if (projectIndex === -1) return undefined;

    const current = projects[projectIndex];
    const steps = current.steps ?? [];
    const stepIndex = steps.findIndex((s) => s.id === stepId);
    if (stepIndex === -1) return current;

    const sanitizedDescription = sanitizeText(task.description);
    const sanitizedGuidance = (task.guidance ?? []).map((tip) => sanitizeText(tip)).filter(Boolean);
    const source = task.source ?? "manual";
    const newTask: Task = {
      ...task,
      id: `t_${crypto.randomUUID().slice(0, 8)}`,
      title: task.title.trim(),
      description: sanitizedDescription,
      done: false,
      status: "todo",
      priority: normalizePlanPriority(task.priority),
      order: steps[stepIndex].tasks.length + 1,
      dueTime: sanitizeText(task.dueTime) || undefined,
      source,
      guidance: sanitizedGuidance.length > 0 ? sanitizedGuidance : undefined,
    };

    const updatedStep: Step = {
      ...steps[stepIndex],
      tasks: [...steps[stepIndex].tasks, newTask],
    };
    updatedStep.status = deriveStepStatus(updatedStep.tasks);

    const updatedSteps = [...steps];
    updatedSteps[stepIndex] = updatedStep;
    const nextProgress = calculateProgressFromSteps(updatedSteps);

    const updated = normalizeProject({
      ...current,
      steps: updatedSteps,
      progress: nextProgress,
      status: deriveProjectStatusForMutation(current, updatedSteps),
      updatedAt: new Date().toISOString(),
    });

    const nextProjects = [...projects];
    nextProjects[projectIndex] = updated;
    await persistProjects(nextProjects);
    return updated;
  });
}

export async function updateTaskInStep(
  projectId: string,
  stepId: string,
  taskId: string,
  input: UpdateTaskInput,
): Promise<Project | undefined> {
  return queueWrite(async () => {
    const projects = await ensureProjectStore();
    const projectIndex = projects.findIndex((p) => p.id === projectId);
    if (projectIndex === -1) return undefined;

    const current = projects[projectIndex];
    const steps = current.steps ?? [];
    const stepIndex = steps.findIndex((s) => s.id === stepId);
    if (stepIndex === -1) return current;

    const currentStep = steps[stepIndex];
    const taskIndex = currentStep.tasks.findIndex((t) => t.id === taskId);
    if (taskIndex === -1) return current;

    const currentTask = currentStep.tasks[taskIndex];
    const nextTitle = sanitizeText(input.title);
    const nextComments = input.comments?.map((comment) => sanitizeText(comment)).filter(Boolean);
    const nextChecklist = input.checklist?.map((item) => ({
      id: sanitizeText(item.id) || `cl_${crypto.randomUUID().slice(0, 8)}`,
      label: sanitizeText(item.label),
      done: Boolean(item.done),
    })).filter((item) => item.label);
    const effectiveChecklist = input.checklist !== undefined
      ? (nextChecklist && nextChecklist.length > 0 ? nextChecklist : undefined)
      : currentTask.checklist;
    let nextStatus: TaskStatus = input.status ?? currentTask.status ?? (currentTask.done ? "done" : "todo");
    let nextDone = input.done ?? (nextStatus === "done" ? true : currentTask.done);
    let nextBlocked = input.blocked ?? (nextStatus === "blocked" ? true : nextStatus === "done" ? false : currentTask.blocked);
    if ((nextStatus === "done" || nextDone) && hasIncompleteChecklist(effectiveChecklist)) {
      nextStatus = "in_progress";
      nextDone = false;
      nextBlocked = false;
    }
    const updatedTask: Task = {
      ...currentTask,
      title: nextTitle || currentTask.title,
      description: input.description !== undefined ? sanitizeText(input.description) || undefined : currentTask.description,
      owner: input.owner !== undefined ? sanitizeText(input.owner) || undefined : currentTask.owner,
      assignees: input.assignees !== undefined
        ? input.assignees.map((name) => sanitizeText(name)).filter(Boolean)
        : currentTask.assignees,
      teamIds: input.teamIds !== undefined ? sanitizeIdList(input.teamIds) : currentTask.teamIds,
      dueDate: input.dueDate !== undefined ? sanitizeText(input.dueDate) || undefined : currentTask.dueDate,
      dueTime: input.dueTime !== undefined ? sanitizeText(input.dueTime) || undefined : currentTask.dueTime,
      priority: input.priority ? normalizePlanPriority(input.priority) : currentTask.priority,
      status: nextStatus,
      done: nextDone,
      blocked: nextBlocked,
      statusNote: input.statusNote !== undefined ? sanitizeText(input.statusNote) || undefined : currentTask.statusNote,
      expected: input.expected !== undefined ? sanitizeText(input.expected) || undefined : currentTask.expected,
      realization: input.realization !== undefined ? sanitizeText(input.realization) || undefined : currentTask.realization,
      comments: input.comments !== undefined ? (nextComments && nextComments.length > 0 ? nextComments : undefined) : currentTask.comments,
      checklist: effectiveChecklist,
      ...(nextStatus === "done"
        ? {
            completedAt: currentTask.completedAt ?? new Date().toISOString(),
            completionSource: currentTask.completionSource ?? "manual",
          }
        : {}),
      ...(nextStatus !== "done" && currentTask.done
        ? {
            completedAt: undefined,
            completionDetails: undefined,
            completionDecisionId: undefined,
            completionDecisionTitle: undefined,
            completionSource: undefined,
          }
        : {}),
    };

    const updatedTasks = [...currentStep.tasks];
    updatedTasks[taskIndex] = updatedTask;

    const updatedStep: Step = {
      ...currentStep,
      tasks: reorderTasks(updatedTasks),
    };
    updatedStep.status = deriveStepStatus(updatedStep.tasks);

    const updatedSteps = [...steps];
    updatedSteps[stepIndex] = updatedStep;
    const nextProgress = calculateProgressFromSteps(updatedSteps);

    const updated = normalizeProject({
      ...current,
      steps: updatedSteps,
      progress: nextProgress,
      status: deriveProjectStatusForMutation(current, updatedSteps),
      updatedAt: new Date().toISOString(),
    });

    const nextProjects = [...projects];
    nextProjects[projectIndex] = updated;
    await persistProjects(nextProjects);
    return updated;
  });
}

export async function deleteTaskFromStep(
  projectId: string,
  stepId: string,
  taskId: string,
): Promise<Project | undefined> {
  return queueWrite(async () => {
    const projects = await ensureProjectStore();
    const projectIndex = projects.findIndex((p) => p.id === projectId);
    if (projectIndex === -1) return undefined;

    const current = projects[projectIndex];
    const steps = current.steps ?? [];
    const stepIndex = steps.findIndex((s) => s.id === stepId);
    if (stepIndex === -1) return current;

    const currentStep = steps[stepIndex];
    const updatedTasks = reorderTasks(currentStep.tasks.filter((task) => task.id !== taskId));
    const updatedStep: Step = {
      ...currentStep,
      tasks: updatedTasks,
      status: deriveStepStatus(updatedTasks),
    };

    const updatedSteps = [...steps];
    updatedSteps[stepIndex] = updatedStep;
    const nextProgress = calculateProgressFromSteps(updatedSteps);

    const updated = normalizeProject({
      ...current,
      steps: updatedSteps,
      progress: nextProgress,
      status: deriveProjectStatusForMutation(current, updatedSteps),
      updatedAt: new Date().toISOString(),
    });

    const nextProjects = [...projects];
    nextProjects[projectIndex] = updated;
    await persistProjects(nextProjects);
    return updated;
  });
}

export async function reorderStepsInProject(
  projectId: string,
  orderedStepIds: string[],
): Promise<Project | undefined> {
  return queueWrite(async () => {
    const projects = await ensureProjectStore();
    const projectIndex = projects.findIndex((p) => p.id === projectId);
    if (projectIndex === -1) return undefined;

    const current = projects[projectIndex];
    const steps = reorderSteps(current.steps ?? []);
    const uniqueStepIds = Array.from(new Set(orderedStepIds.map(sanitizeText).filter(Boolean)));
    const stepById = new Map(steps.map((step) => [step.id, step]));
    const requestedSteps = uniqueStepIds
      .map((stepId) => stepById.get(stepId))
      .filter((step): step is Step => Boolean(step));

    if (requestedSteps.length === 0) return current;

    const requestedIds = new Set(requestedSteps.map((step) => step.id));
    const remainingSteps = steps.filter((step) => !requestedIds.has(step.id));
    const updatedSteps = [...requestedSteps, ...remainingSteps].map((step, index) => ({
      ...step,
      order: index + 1,
      tasks: reorderTasks(step.tasks),
    }));

    const updated = normalizeProject({
      ...current,
      steps: updatedSteps,
      progress: calculateProgressFromSteps(updatedSteps),
      status: deriveProjectStatusForMutation(current, updatedSteps),
      updatedAt: new Date().toISOString(),
    });

    const nextProjects = [...projects];
    nextProjects[projectIndex] = updated;
    await persistProjects(nextProjects);
    return updated;
  });
}

export async function reorderTasksInStep(
  projectId: string,
  stepId: string,
  orderedTaskIds: string[],
): Promise<Project | undefined> {
  return queueWrite(async () => {
    const projects = await ensureProjectStore();
    const projectIndex = projects.findIndex((p) => p.id === projectId);
    if (projectIndex === -1) return undefined;

    const current = projects[projectIndex];
    const steps = reorderSteps(current.steps ?? []);
    const stepIndex = steps.findIndex((step) => step.id === stepId);
    if (stepIndex === -1) return current;

    const currentStep = steps[stepIndex];
    const tasks: Task[] = reorderTasks(currentStep.tasks);
    const uniqueTaskIds = Array.from(new Set(orderedTaskIds.map(sanitizeText).filter(Boolean)));
    const taskById = new Map(tasks.map((task) => [task.id, task]));
    const requestedTasks: Task[] = uniqueTaskIds.flatMap((taskId) => {
      const task = taskById.get(taskId);
      return task ? [task] : [];
    });

    if (requestedTasks.length === 0) return current;

    const requestedIds = new Set(requestedTasks.map((task) => task.id));
    const remainingTasks = tasks.filter((task) => !requestedIds.has(task.id));
    const updatedTasks: Task[] = [...requestedTasks, ...remainingTasks].map((task, index) => ({
      ...task,
      order: index + 1,
    }));

    const updatedStep: Step = {
      ...currentStep,
      tasks: updatedTasks,
      status: deriveStepStatus(updatedTasks),
    };
    const updatedSteps = [...steps];
    updatedSteps[stepIndex] = updatedStep;

    const updated = normalizeProject({
      ...current,
      steps: updatedSteps,
      progress: calculateProgressFromSteps(updatedSteps),
      status: deriveProjectStatusForMutation(current, updatedSteps),
      updatedAt: new Date().toISOString(),
    });

    const nextProjects = [...projects];
    nextProjects[projectIndex] = updated;
    await persistProjects(nextProjects);
    return updated;
  });
}

export async function addDecisionToProject(
  projectId: string,
  decision: Omit<Decision, "id">,
): Promise<Project | undefined> {
  return queueWrite(async () => {
    const projects = await ensureProjectStore();
    const projectIndex = projects.findIndex((p) => p.id === projectId);
    if (projectIndex === -1) return undefined;

    const current = projects[projectIndex];
    const normalizedTitle = normalizeComparableText(decision.title);
    const alreadyExists = current.decisions.some(
      (d) => normalizeComparableText(d.title) === normalizedTitle,
    );
    if (alreadyExists) return current;

    const now = new Date().toISOString();
    const newDecision: Decision = {
      ...decision,
      id: `d_${crypto.randomUUID().slice(0, 8)}`,
    };
    const newActivityItem: ProjectActivityItem = {
      id: `act_${crypto.randomUUID().slice(0, 8)}`,
      date: now,
      title: decision.status === "decided" ? "Décision ajoutée au projet" : "Décision en attente ajoutée",
      detail: decision.title,
      tone: decision.status === "decided" ? "success" : "warning",
    };

    const updated = normalizeProject({
      ...current,
      decisions: [newDecision, ...current.decisions],
      activity: [newActivityItem, ...(current.activity ?? [])].slice(0, 50),
      updatedAt: now,
    });

    const nextProjects = [...projects];
    nextProjects[projectIndex] = updated;
    await persistProjects(nextProjects);
    return updated;
  });
}

export async function addRiskToProject(
  projectId: string,
  risk: Omit<Risk, "id" | "status"> & Partial<Pick<Risk, "status">>,
): Promise<Project | undefined> {
  return queueWrite(async () => {
    const projects = await ensureProjectStore();
    const projectIndex = projects.findIndex((p) => p.id === projectId);
    if (projectIndex === -1) return undefined;

    const current = projects[projectIndex];
    const now = new Date().toISOString();
    const newRisk: Risk = {
      id: `r_${crypto.randomUUID().slice(0, 8)}`,
      title: sanitizeText(risk.title),
      description: sanitizeText(risk.description) || undefined,
      severity: risk.severity === "high" || risk.severity === "low" ? risk.severity : "medium",
      mitigation: sanitizeText(risk.mitigation) || "À surveiller et clarifier dans le suivi du projet.",
      status: risk.status === "mitigated" ? "mitigated" : "open",
    };
    if (!newRisk.title) return current;

    const relatedRiskIndex = current.risks.findIndex((existingRisk) => risksLookRelated(existingRisk, newRisk));
    if (relatedRiskIndex !== -1) {
      const mergedRisk = mergeRiskEntries(current.risks[relatedRiskIndex], newRisk);
      const riskAlreadyCovered = JSON.stringify(mergedRisk) === JSON.stringify(current.risks[relatedRiskIndex]);
      if (riskAlreadyCovered) return current;

      const nextRisks = current.risks.map((existingRisk, index) =>
        index === relatedRiskIndex ? mergedRisk : existingRisk,
      );
      const newActivityItem: ProjectActivityItem = {
        id: `act_${crypto.randomUUID().slice(0, 8)}`,
        date: now,
        title: "Risque enrichi",
        detail: mergedRisk.title,
        tone: mergedRisk.severity === "high" ? "danger" : "warning",
      };

      const updated = normalizeProject({
        ...current,
        risks: dedupeProjectRisks(nextRisks),
        activity: [newActivityItem, ...(current.activity ?? [])].slice(0, 50),
        updatedAt: now,
      });

      const nextProjects = [...projects];
      nextProjects[projectIndex] = updated;
      await persistProjects(nextProjects);
      return updated;
    }

    const newActivityItem: ProjectActivityItem = {
      id: `act_${crypto.randomUUID().slice(0, 8)}`,
      date: now,
      title: "Risque ajouté au projet",
      detail: newRisk.title,
      tone: newRisk.severity === "high" ? "danger" : "warning",
    };

    const updated = normalizeProject({
      ...current,
      risks: [newRisk, ...current.risks],
      activity: [newActivityItem, ...(current.activity ?? [])].slice(0, 50),
      updatedAt: now,
    });

    const nextProjects = [...projects];
    nextProjects[projectIndex] = updated;
    await persistProjects(nextProjects);
    return updated;
  });
}

function mergeChecklistLabels(existing: ChecklistItem[] | undefined, labels: string[] | undefined) {
  const checklist = existing ? [...existing] : [];
  const known = new Set(checklist.map((item) => normalizeTaskMatchText(item.label)));

  for (const label of labels ?? []) {
    const cleaned = sanitizeText(label);
    const normalized = normalizeTaskMatchText(cleaned);
    if (!cleaned || known.has(normalized)) continue;
    known.add(normalized);
    checklist.push({ id: `cl_${crypto.randomUUID().slice(0, 8)}`, label: cleaned, done: false });
  }

  return checklist.length > 0 ? checklist : undefined;
}

function checkChecklistLabels(existing: ChecklistItem[] | undefined, labels: string[] | undefined, ids: string[] | undefined) {
  const idSet = new Set((ids ?? []).map(sanitizeText).filter(Boolean));
  const normalizedLabels = (labels ?? []).map(normalizeTaskMatchText).filter(Boolean);
  if (!existing?.length) return existing;

  return existing.map((item) => {
    if (idSet.has(item.id)) return { ...item, done: true };
    const itemLabel = normalizeTaskMatchText(item.label);
    const shouldCheck = normalizedLabels.some((label) =>
      itemLabel === label || itemLabel.includes(label) || label.includes(itemLabel),
    );
    return shouldCheck ? { ...item, done: true } : item;
  });
}

export interface UpdateTaskBoardStatusInput {
  /** New task status (excluding "done" — use completeTaskWithRealization for completed tasks with details) */
  status: TaskStatus;
  done: boolean;
  blocked: boolean;
  /** Optional contextual note (e.g. reason for blocking, or context for in-progress) */
  statusNote?: string;
}

export async function updateTaskBoardStatus(
  projectId: string,
  stepId: string,
  taskId: string,
  input: UpdateTaskBoardStatusInput,
): Promise<Project | undefined> {
  return queueWrite(async () => {
    const projects = await ensureProjectStore();
    const projectIndex = projects.findIndex((p) => p.id === projectId);
    if (projectIndex === -1) return undefined;

    const current = projects[projectIndex];
    const steps = current.steps ?? [];
    const stepIndex = steps.findIndex((s) => s.id === stepId);
    if (stepIndex === -1) return current;

    const step = steps[stepIndex];
    const taskIndex = step.tasks.findIndex((t) => t.id === taskId);
    if (taskIndex === -1) return current;

    const currentTask = step.tasks[taskIndex];
    const now = new Date().toISOString();
    const statusNote = sanitizeText(input.statusNote);
    const nextRealization = statusNote
      ? appendTaskRealization(currentTask.realization ?? currentTask.completionDetails, statusNote)
      : currentTask.realization;
    const checklistBlocksCompletion = (input.status === "done" || input.done) && hasIncompleteChecklist(currentTask.checklist);
    const nextStatus: TaskStatus = checklistBlocksCompletion ? "in_progress" : input.status;
    const nextDone = checklistBlocksCompletion ? false : input.done;
    const nextBlocked = checklistBlocksCompletion ? false : input.blocked;

    const updatedTask: Task = {
      ...currentTask,
      done: nextDone,
      status: nextStatus,
      blocked: nextBlocked,
      statusNote: statusNote || undefined,
      realization: nextRealization,
      statusChangedAt: now,
      // Clear completion fields when re-opening a done task
      ...(currentTask.done && !nextDone
        ? {
            completedAt: undefined,
            completionDetails: undefined,
            completionDecisionId: undefined,
            completionDecisionTitle: undefined,
            completionSource: undefined,
          }
        : {}),
    };

    const updatedTasks = [...step.tasks];
    updatedTasks[taskIndex] = updatedTask;

    const updatedStep: Step = {
      ...step,
      tasks: updatedTasks,
      status: deriveStepStatus(updatedTasks),
    };

    const updatedSteps = [...steps];
    updatedSteps[stepIndex] = updatedStep;
    const newProgress = calculateProgressFromSteps(updatedSteps);

    const newLabel = taskStatusLabels[nextStatus];

    const newActivityItem: ProjectActivityItem = {
      id: `act_${crypto.randomUUID().slice(0, 8)}`,
      date: now,
      title: `Tâche déplacée — ${newLabel}`,
      detail: checklistBlocksCompletion
        ? `${updatedTask.title}${updatedTask.statusNote ? ` · ${updatedTask.statusNote}` : ""} · Checklist encore incomplète`
        : `${updatedTask.title}${updatedTask.statusNote ? ` · ${updatedTask.statusNote}` : ""}`,
      tone: nextBlocked ? "danger" : nextStatus === "in_progress" ? "neutral" : "neutral",
    };

    const legacyActionId = updatedTask.id.startsWith("t_from_") ? updatedTask.id.slice("t_from_".length) : null;
    const updatedActions = legacyActionId
      ? current.actions.map((action) =>
          action.id === legacyActionId ? { ...action, done: nextDone } : action,
        )
      : current.actions;

    const updated = normalizeProject({
      ...current,
      actions: updatedActions,
      steps: updatedSteps,
      progress: newProgress,
      status: deriveProjectStatusForMutation(current, updatedSteps),
      activity: [newActivityItem, ...(current.activity ?? [])].slice(0, 50),
      updatedAt: now,
    });

    const nextProjects = [...projects];
    nextProjects[projectIndex] = updated;
    await persistProjects(nextProjects);
    return updated;
  });
}

async function mutateTaskChecklist(
  projectId: string,
  stepId: string,
  taskId: string,
  transform: (checklist: ChecklistItem[]) => ChecklistItem[],
): Promise<Project | undefined> {
  return queueWrite(async () => {
    const projects = await ensureProjectStore();
    const projectIndex = projects.findIndex((p) => p.id === projectId);
    if (projectIndex === -1) return undefined;

    const current = projects[projectIndex];
    const steps = current.steps ?? [];
    const stepIndex = steps.findIndex((s) => s.id === stepId);
    if (stepIndex === -1) return current;

    const step = steps[stepIndex];
    const taskIndex = step.tasks.findIndex((t) => t.id === taskId);
    if (taskIndex === -1) return current;

    const task = step.tasks[taskIndex];
    const nextChecklist = transform(task.checklist ?? []);
    const shouldReopen = (task.done || task.status === "done") && hasIncompleteChecklist(nextChecklist);
    const updatedTask: Task = {
      ...task,
      checklist: nextChecklist.length > 0 ? nextChecklist : undefined,
      ...(shouldReopen
        ? {
            done: false,
            status: "in_progress",
            completedAt: undefined,
            completionDetails: undefined,
            completionDecisionId: undefined,
            completionDecisionTitle: undefined,
            completionSource: undefined,
          }
        : {}),
    };
    const updatedTasks = [...step.tasks];
    updatedTasks[taskIndex] = updatedTask;

    const updatedStep: Step = { ...step, tasks: updatedTasks };
    const updatedSteps = [...steps];
    updatedSteps[stepIndex] = updatedStep;

    const updated = normalizeProject({
      ...current,
      steps: updatedSteps,
      updatedAt: new Date().toISOString(),
    });

    const nextProjects = [...projects];
    nextProjects[projectIndex] = updated;
    await persistProjects(nextProjects);
    return updated;
  });
}

export async function addTaskChecklistItem(
  projectId: string,
  stepId: string,
  taskId: string,
  label: string,
  itemId?: string,
): Promise<Project | undefined> {
  const cleaned = sanitizeText(label);
  if (!cleaned) return undefined;
  return mutateTaskChecklist(projectId, stepId, taskId, (checklist) => [
    ...checklist,
    { id: itemId ?? `cl_${crypto.randomUUID().slice(0, 8)}`, label: cleaned, done: false },
  ]);
}

export async function updateTaskChecklistItem(
  projectId: string,
  stepId: string,
  taskId: string,
  itemId: string,
  label: string,
): Promise<Project | undefined> {
  const cleaned = sanitizeText(label);
  if (!cleaned) return deleteTaskChecklistItem(projectId, stepId, taskId, itemId);

  return mutateTaskChecklist(projectId, stepId, taskId, (checklist) =>
    checklist.map((item) => (item.id === itemId ? { ...item, label: cleaned } : item)),
  );
}

export async function toggleTaskChecklistItem(
  projectId: string,
  stepId: string,
  taskId: string,
  itemId: string,
): Promise<Project | undefined> {
  return mutateTaskChecklist(projectId, stepId, taskId, (checklist) =>
    checklist.map((item) => (item.id === itemId ? { ...item, done: !item.done } : item)),
  );
}

export async function deleteTaskChecklistItem(
  projectId: string,
  stepId: string,
  taskId: string,
  itemId: string,
): Promise<Project | undefined> {
  return mutateTaskChecklist(projectId, stepId, taskId, (checklist) =>
    checklist.filter((item) => item.id !== itemId),
  );
}
