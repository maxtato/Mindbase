// Évolution de projet assistée — l'utilisateur colle un texte libre (compte-rendu
// de réunion, note d'avancement, mail, etc.). L'IA l'analyse au regard de l'état
// actuel du projet et propose un plan d'opérations : créer des étapes/tâches,
// faire avancer des tâches (statut), poser des échéances, assigner des personnes.
//
// Aucune mutation n'est faite ici : la fonction renvoie un PLAN que l'utilisateur
// valide ensuite côté UI avant application (cf. applyProjectEvolutionAction).

import { getOpenAIClient, AI_MODEL } from "./client";
import type { Project, Task } from "@/lib/mock-data";

export type EvolutionOpType = "add_step" | "add_task" | "update_task" | "remove_task";
export type EvolutionTaskStatus = "todo" | "in_progress" | "waiting" | "blocked" | "done";
export type EvolutionPriority = "low" | "medium" | "high";

// Une opération « à plat » (compatible json_schema strict d'OpenAI : tous les
// champs sont requis, les facultatifs sont nullable).
export interface EvolutionOperation {
  type: EvolutionOpType;
  /** add_step : titre de la nouvelle étape. */
  stepTitle: string | null;
  /** add_step : description courte de la nouvelle étape. */
  stepDescription: string | null;
  /** add_task : id d'une étape EXISTANTE où ajouter la tâche (sinon null). */
  targetStepId: string | null;
  /** add_task : titre d'une nouvelle étape (de ce même lot) où ranger la tâche. */
  newStepTitle: string | null;
  /** add_task : titre de la tâche à créer. */
  taskTitle: string | null;
  /** add_task : attendu / livrable de la tâche. */
  taskExpected: string | null;
  /** update_task : id de la tâche EXISTANTE à mettre à jour. */
  taskId: string | null;
  /** update_task : nouveau statut. */
  newStatus: EvolutionTaskStatus | null;
  /** add_task & update_task : échéance AAAA-MM-JJ. */
  dueDate: string | null;
  /** add_task & update_task : personne responsable. */
  owner: string | null;
  /** add_task & update_task : priorité. */
  priority: EvolutionPriority | null;
  /** update_task : ce qui a été réalisé / note d'avancement issue du texte. */
  note: string | null;
  /** Justification courte (affichée à l'utilisateur). */
  reason: string;
}

export interface EvolutionPlan {
  /** "question" : l'IA a besoin de précisions → dialogue. "plan" : prête à proposer. */
  mode: "question" | "plan";
  /** Question de clarification quand mode="question" (sinon null). */
  question: string | null;
  /** Résumé en 1-2 phrases de la compréhension actuelle. */
  summary: string;
  operations: EvolutionOperation[];
}

/** Un tour de dialogue avec l'assistant d'évolution. */
export interface EvolutionMessage {
  role: "user" | "assistant";
  content: string;
}

const STATUS_LABEL_FR: Record<string, string> = {
  todo: "À faire",
  in_progress: "En cours",
  waiting: "En attente",
  blocked: "Bloqué",
  done: "Terminé",
};

function currentStatus(task: Task): EvolutionTaskStatus {
  if (task.done || task.status === "done") return "done";
  if (task.blocked || task.status === "blocked") return "blocked";
  if (task.status === "waiting") return "waiting";
  if (task.status === "in_progress") return "in_progress";
  return "todo";
}

function clamp(value: string | undefined, max: number) {
  if (!value) return "";
  const cleaned = value.trim().replace(/\s+/g, " ");
  return cleaned.length <= max ? cleaned : `${cleaned.slice(0, max - 1).trim()}…`;
}

// Snapshot AVEC identifiants : l'IA doit pouvoir référencer les étapes/tâches
// existantes par leur id pour proposer des mises à jour ciblées.
function buildSnapshotWithIds(project: Project): string {
  const lines: string[] = [
    `Projet : ${project.name}`,
    `Objectif : ${project.objective || "(non renseigné)"}`,
    project.context ? `Contexte : ${clamp(project.context, 240)}` : "",
    `Avancement : ${project.progress}%`,
    "",
    "Étapes et tâches existantes (avec leurs identifiants) :",
  ].filter(Boolean);

  const steps = project.steps ?? [];
  if (steps.length === 0) {
    lines.push("(aucune étape pour l'instant)");
  }

  for (const step of steps) {
    lines.push(`▸ ÉTAPE [stepId=${step.id}] « ${step.title} »`);
    if (step.tasks.length === 0) {
      lines.push("    (aucune tâche)");
    }
    for (const task of step.tasks) {
      const status = STATUS_LABEL_FR[currentStatus(task)];
      const due = task.dueDate ? ` · échéance ${task.dueDate}` : "";
      const owner = task.owner?.trim() ? ` · resp. ${task.owner.trim()}` : "";
      const expected = task.expected ? ` — ${clamp(task.expected, 90)}` : "";
      lines.push(
        `    • TÂCHE [taskId=${task.id}] « ${task.title} » (statut: ${status}${due}${owner})${expected}`,
      );
    }
  }

  const people = (project.people ?? []).map((p) => p.name).filter(Boolean);
  if (people.length > 0) {
    lines.push("", `Personnes connues du projet : ${people.join(", ")}.`);
  }

  return lines.join("\n");
}

function buildSystemPrompt(today: string): string {
  return `Tu es l'assistant IA de projet de Mindbase. Tu aides l'utilisateur à FAIRE ÉVOLUER son projet en dialoguant avec lui : tu peux proposer des idées, générer des listes d'options (lieux, parcs, étapes, tâches, fournisseurs…) à partir de tes connaissances générales, brainstormer, puis structurer tout ça en étapes et tâches concrètes une fois qu'il a choisi.

Ton ton est clair, concret et serviable. Tu t'adresses à l'utilisateur en français.

Tu reçois l'état actuel du projet avec les identifiants (stepId, taskId) de chaque étape et tâche.

Tu réponds UNIQUEMENT en JSON strict, selon DEUX MODES possibles :

• mode="question" — pour DIALOGUER : quand tu as besoin d'une précision, OU quand tu proposes des idées / une liste d'options et que tu demandes à l'utilisateur lesquelles retenir, OU pour confirmer avant d'agir. Mets ta réponse (la liste proposée, tes suggestions, ta question) dans le champ "question" (texte libre, tu peux énumérer avec des tirets), et operations = liste vide. Exemple : l'utilisateur demande « liste-moi les parcs nationaux de l'Ouest américain » → tu réponds en mode="question" avec la liste des parcs et « Lesquels veux-tu intégrer au projet ? ». Continue le dialogue tour par tour jusqu'à ce que le périmètre soit validé ensemble.

• mode="plan" — quand l'utilisateur a validé ce qu'il veut. Tu mets "question" à null et tu traduis les éléments retenus en opérations concrètes (champ "operations") : étapes, tâches (avec attendu), dates, responsables. Ne passe en mode="plan" que lorsque le contenu a été choisi/validé dans le dialogue (ou si la demande initiale est déjà parfaitement claire et actionnable).

En mode="plan", chaque opération est l'une de :

1. "add_step" — créer une nouvelle étape. Renseigne stepTitle (court) et stepDescription. Laisse les autres champs à null.
2. "add_task" — créer une nouvelle tâche. Renseigne taskTitle et taskExpected (livrable concret). Pour la rattacher :
   - soit à une étape EXISTANTE → renseigne targetStepId avec son stepId exact, newStepTitle = null
   - soit à une nouvelle étape de ce lot → renseigne newStepTitle (identique au stepTitle d'un add_step), targetStepId = null
   Tu peux aussi remplir dueDate, owner, priority si le texte le précise.
3. "update_task" — faire évoluer une tâche EXISTANTE. Renseigne taskId (exact). Puis selon le texte :
   - newStatus pour faire avancer la tâche (ex: "todo"→"in_progress"→"done", ou "blocked")
   - dueDate (AAAA-MM-JJ) si une échéance est donnée
   - owner si une personne est désignée
   - priority si l'urgence change
   - note : ce qui a été réalisé / l'info d'avancement tirée du texte (sinon null)
   Pour CLÔTURER une tâche déjà traitée ou qui n'a plus à être faite mais qu'on veut garder dans l'historique, utilise newStatus="done" (avec une note expliquant pourquoi).
4. "remove_task" — SUPPRIMER / ANNULER une tâche qui n'a plus lieu d'être (ex: le projet change d'orientation et certaines tâches deviennent caduques). Renseigne taskId (exact) ; les autres champs restent null. Utilise-la pour nettoyer les tâches obsolètes plutôt que de les laisser traîner.

Règles importantes :
- N'invente RIEN qui ne soit pas étayé par le texte. Si le texte ne justifie aucun changement, renvoie une liste vide.
- Pour faire avancer une tâche déjà existante, utilise update_task avec son taskId — NE crée PAS de doublon.
- En revanche, si le texte évoque un travail, une action ou un livrable PERTINENT qui ne correspond à AUCUNE tâche existante, NE L'IGNORE PAS : crée une nouvelle tâche (add_task). Rattache-la à l'étape existante la plus pertinente (targetStepId), ou crée une nouvelle étape (add_step) si aucune ne convient et range-la dedans (newStepTitle). Le fait qu'un point ne fasse pas avancer une tâche actuelle n'est pas une raison de l'écarter.
- CHANGEMENT D'ORIENTATION : quand la direction du projet change, ne te contente pas d'ajouter. Regarde les tâches existantes devenues caduques et propose de les ANNULER (remove_task) ou de les CLÔTURER (update_task newStatus="done") avec une note. L'objectif est que le plan reste cohérent, pas qu'il accumule des tâches sans objet.
- Ne supprime/ne clôture une tâche que si le texte ou le dialogue le justifie clairement (orientation changée, doublon, abandon explicite). Dans le doute, demande en mode="question".
- Ne repasse pas une tâche à un statut antérieur sans raison explicite dans le texte.
- Les dates sont au format AAAA-MM-JJ. La date du jour est ${today}. Convertis les dates relatives ("vendredi prochain", "dans deux semaines") en dates absolues.
- Pour owner, réutilise les noms de personnes déjà connus du projet quand c'est la même personne.
- "reason" : une phrase courte citant l'élément du texte qui justifie l'opération.
- Chaque champ non pertinent pour le type d'opération doit valoir null (sauf "reason" qui est toujours rempli).`;
}

const OPERATION_SCHEMA = {
  type: "object",
  properties: {
    mode: { type: "string", enum: ["question", "plan"] },
    question: { type: ["string", "null"] },
    summary: { type: "string" },
    operations: {
      type: "array",
      items: {
        type: "object",
        properties: {
          type: { type: "string", enum: ["add_step", "add_task", "update_task", "remove_task"] },
          stepTitle: { type: ["string", "null"] },
          stepDescription: { type: ["string", "null"] },
          targetStepId: { type: ["string", "null"] },
          newStepTitle: { type: ["string", "null"] },
          taskTitle: { type: ["string", "null"] },
          taskExpected: { type: ["string", "null"] },
          taskId: { type: ["string", "null"] },
          newStatus: {
            type: ["string", "null"],
            enum: ["todo", "in_progress", "waiting", "blocked", "done", null],
          },
          dueDate: { type: ["string", "null"] },
          owner: { type: ["string", "null"] },
          priority: { type: ["string", "null"], enum: ["low", "medium", "high", null] },
          note: { type: ["string", "null"] },
          reason: { type: "string" },
        },
        required: [
          "type",
          "stepTitle",
          "stepDescription",
          "targetStepId",
          "newStepTitle",
          "taskTitle",
          "taskExpected",
          "taskId",
          "newStatus",
          "dueDate",
          "owner",
          "priority",
          "note",
          "reason",
        ],
        additionalProperties: false,
      },
    },
  },
  required: ["mode", "question", "summary", "operations"],
  additionalProperties: false,
} as const;

export async function analyzeProjectEvolution(
  project: Project,
  messages: EvolutionMessage[],
): Promise<EvolutionPlan> {
  const dialogue = (messages ?? []).filter((message) => message.content.trim());
  if (dialogue.length === 0) throw new Error("Le texte à analyser est vide.");

  const today = new Date().toISOString().slice(0, 10);
  const client = getOpenAIClient();
  const response = await client.chat.completions.create({
    model: AI_MODEL,
    response_format: {
      type: "json_schema",
      json_schema: {
        name: "project_evolution",
        strict: true,
        schema: OPERATION_SCHEMA,
      },
    },
    messages: [
      { role: "system", content: buildSystemPrompt(today) },
      {
        role: "user",
        content: `État actuel du projet :\n\n${buildSnapshotWithIds(project)}\n\n---\n\nCi-dessous, la note initiale de l'utilisateur puis votre dialogue. Si tu as assez d'éléments, produis le plan (mode="plan") ; sinon pose UNE question (mode="question").`,
      },
      ...dialogue.map((message) => ({ role: message.role, content: message.content })),
    ],
  });

  const content = response.choices[0]?.message?.content;
  if (!content) throw new Error("Réponse IA vide.");

  try {
    const parsed = JSON.parse(content) as EvolutionPlan;
    parsed.operations = Array.isArray(parsed.operations) ? parsed.operations : [];
    parsed.mode = parsed.mode === "question" ? "question" : "plan";
    if (parsed.mode === "question") parsed.operations = [];
    else parsed.question = null;
    return parsed;
  } catch {
    throw new Error("L'IA n'a pas renvoyé de JSON valide.");
  }
}

// ─── Helpers d'affichage (utilisés par l'action serveur pour enrichir le plan) ──

export function describeOperation(
  op: EvolutionOperation,
  project: Project,
): { title: string; detail: string } {
  const findTask = (taskId: string) => {
    for (const step of project.steps ?? []) {
      const task = step.tasks.find((t) => t.id === taskId);
      if (task) return { step, task };
    }
    return null;
  };
  const findStep = (stepId: string) => (project.steps ?? []).find((s) => s.id === stepId);

  const bits: string[] = [];
  if (op.newStatus) bits.push(`statut → ${STATUS_LABEL_FR[op.newStatus] ?? op.newStatus}`);
  if (op.dueDate) bits.push(`échéance ${op.dueDate}`);
  if (op.owner) bits.push(`assignée à ${op.owner}`);
  if (op.priority) bits.push(`priorité ${op.priority}`);

  if (op.type === "add_step") {
    return {
      title: `Nouvelle étape : ${op.stepTitle ?? "(sans titre)"}`,
      detail: op.stepDescription?.trim() || op.reason,
    };
  }

  if (op.type === "add_task") {
    const where = op.targetStepId
      ? `dans « ${findStep(op.targetStepId)?.title ?? "étape"} »`
      : op.newStepTitle
        ? `dans la nouvelle étape « ${op.newStepTitle} »`
        : "";
    return {
      title: `Nouvelle tâche : ${op.taskTitle ?? "(sans titre)"}`,
      detail: [where, ...bits].filter(Boolean).join(" · ") || op.reason,
    };
  }

  if (op.type === "remove_task") {
    const removed = op.taskId ? findTask(op.taskId) : null;
    return {
      title: removed ? `Annuler : ${removed.task.title}` : "Annuler une tâche",
      detail: op.reason,
    };
  }

  // update_task
  const found = op.taskId ? findTask(op.taskId) : null;
  return {
    title: found ? `Mettre à jour : ${found.task.title}` : "Mettre à jour une tâche",
    detail: [...bits, op.note ? `note : ${clamp(op.note, 80)}` : ""].filter(Boolean).join(" · ") || op.reason,
  };
}
