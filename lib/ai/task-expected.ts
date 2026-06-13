// Suggestion IA pour le champ "Attendu" d'une tâche.
// L'IA reçoit le contexte projet COMPLET (toutes les étapes, toutes les tâches)
// et la tâche ciblée explicitement marquée — pour proposer un attendu cohérent
// avec le reste du projet et non isolé.

import { getOpenAIClient, AI_MODEL } from "./client";
import type { Project, Task, Step } from "@/lib/mock-data";
import { buildProjectContextSnapshot } from "./project-context";

interface ImproveTaskExpectedInput {
  project: Project;
  step: Step;
  task: Task;
}

const SYSTEM_PROMPT = `Tu reformules le champ "Attendu" d'une tâche pour qu'il soit clair et actionnable, en cohérence avec l'ensemble du projet.
Avant de répondre, lis attentivement TOUT le plan (objectif, contexte, étapes, autres tâches) pour t'assurer que la formulation s'inscrit dans la suite logique du projet et n'entre pas en doublon avec une autre tâche.
Règles :
- Une seule phrase, en français, 20 à 40 mots
- Décrit précisément ce qu'il faut faire dans CETTE tâche : quel livrable, quelle décision, quel résultat
- Pas de "réfléchir à", "voir si", "discuter" — toujours une action concrète
- Évite de répéter ce qui est déjà fait dans une autre tâche du projet
- Réponds avec uniquement le texte de l'attendu, sans guillemets, sans préambule`;

export async function improveTaskExpected(input: ImproveTaskExpectedInput): Promise<string> {
  const client = getOpenAIClient();
  const snapshot = buildProjectContextSnapshot(input.project, { highlightTaskId: input.task.id });
  const currentExpected = input.task.expected?.trim() || input.task.description?.trim() || "";

  const userMessage = [
    "Voici le plan complet du projet (la tâche ciblée est marquée ★) :",
    "",
    snapshot,
    "",
    `Étape concernée : ${input.step.title}`,
    `Titre de la tâche ciblée : ${input.task.title}`,
    currentExpected
      ? `Formulation actuelle de l'attendu (à améliorer) : ${currentExpected}`
      : "Pas encore de formulation pour l'attendu de cette tâche.",
    "",
    "Propose une formulation claire de l'attendu pour cette tâche, en cohérence avec le reste du projet.",
  ].join("\n");

  const response = await client.chat.completions.create({
    model: AI_MODEL,
    messages: [
      { role: "system", content: SYSTEM_PROMPT },
      { role: "user", content: userMessage },
    ],
  });

  const content = response.choices[0]?.message?.content?.trim();
  if (!content) throw new Error("Réponse IA vide.");
  return content;
}

// ─── Assistant conversationnel pour l'« Attendu » ──────────────────────────────
// L'utilisateur dialogue avec l'assistant pour réécrire l'attendu d'une tâche :
// l'assistant pose une question si besoin, sinon propose une formulation.

export interface ExpectedMessage {
  role: "user" | "assistant";
  content: string;
}

export interface ExpectedRefineResult {
  /** "question" : l'assistant a besoin d'une précision. "proposal" : il propose un attendu. */
  mode: "question" | "proposal";
  /** Message de l'assistant (sa question, ou un mot sur la proposition). */
  reply: string;
  /** Texte d'attendu proposé quand mode="proposal" (sinon null). */
  expected: string | null;
}

const REFINE_SCHEMA = {
  type: "object",
  properties: {
    mode: { type: "string", enum: ["question", "proposal"] },
    reply: { type: "string" },
    expected: { type: ["string", "null"] },
  },
  required: ["mode", "reply", "expected"],
  additionalProperties: false,
} as const;

const REFINE_SYSTEM_PROMPT = `Tu es l'assistant IA de Mindbase. Tu aides l'utilisateur à rédiger / réécrire le champ "Attendu" d'une tâche (ce qu'il faut concrètement accomplir), en cohérence avec l'ensemble du projet, EN DIALOGUANT avec lui.

Tu réponds UNIQUEMENT en JSON strict, en français, selon deux modes :
• mode="question" — si tu as besoin d'une précision pour bien cerner l'attendu (objectif, livrable, périmètre, contrainte). Mets ta question dans "reply", expected=null.
• mode="proposal" — quand tu peux proposer une formulation. Mets dans "expected" le texte de l'attendu (1 à 2 phrases, action concrète, livrable/résultat clair, sans "réfléchir à"/"voir si"), et dans "reply" une courte phrase d'accompagnement. L'utilisateur peut ensuite te demander d'ajuster : tu reproposes un "expected" affiné.

Règles : reste cohérent avec le plan du projet, évite les doublons avec d'autres tâches, sois concret. Tiens compte de tout l'historique du dialogue.`;

export async function refineTaskExpected(input: {
  project: Project;
  step: Step;
  task: Task;
  messages: ExpectedMessage[];
}): Promise<ExpectedRefineResult> {
  const client = getOpenAIClient();
  const snapshot = buildProjectContextSnapshot(input.project, { highlightTaskId: input.task.id });
  const currentExpected = input.task.expected?.trim() || input.task.description?.trim() || "";

  const context = [
    "Plan complet du projet (tâche ciblée marquée ★) :",
    "",
    snapshot,
    "",
    `Étape : ${input.step.title}`,
    `Tâche ciblée : ${input.task.title}`,
    currentExpected ? `Attendu actuel : ${currentExpected}` : "Pas encore d'attendu pour cette tâche.",
  ].join("\n");

  const dialogue = (input.messages ?? []).filter((message) => message.content.trim());

  const response = await client.chat.completions.create({
    model: AI_MODEL,
    response_format: {
      type: "json_schema",
      json_schema: { name: "expected_refine", strict: true, schema: REFINE_SCHEMA },
    },
    messages: [
      { role: "system", content: REFINE_SYSTEM_PROMPT },
      { role: "user", content: context },
      ...dialogue.map((message) => ({ role: message.role, content: message.content })),
    ],
  });

  const content = response.choices[0]?.message?.content;
  if (!content) throw new Error("Réponse IA vide.");
  try {
    const parsed = JSON.parse(content) as ExpectedRefineResult;
    parsed.mode = parsed.mode === "proposal" ? "proposal" : "question";
    if (parsed.mode === "question") parsed.expected = null;
    return parsed;
  } catch {
    throw new Error("L'IA n'a pas renvoyé de JSON valide.");
  }
}
