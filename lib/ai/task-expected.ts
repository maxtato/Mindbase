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
