// Création de projet assistée — bouton "Créer avec l'IA" sur la page de création.
// L'utilisateur décrit son projet → l'IA propose objectif + étapes + tâches.
// Chaque tâche a un champ "Attendu" expliquant clairement ce qu'il faut faire.

import { getOpenAIClient, AI_MODEL } from "./client";

export interface AIProjectSuggestion {
  name: string;
  objective: string;
  context: string;
  steps: Array<{
    title: string;
    description: string;
    tasks: Array<{
      title: string;
      expected: string;
    }>;
  }>;
}

const SYSTEM_PROMPT = `Tu aides à structurer un projet à partir d'une description libre.
Réponds en JSON strict, en français.
Règles :
- 3 à 5 étapes maximum, ordonnées logiquement
- Chaque étape contient 2 à 4 tâches concrètes
- Le champ "expected" de chaque tâche doit décrire précisément ce qu'il faut faire (livrable, action, résultat attendu) — jamais une formulation vague
- Pas de tâche du genre "réfléchir à", "réviser" — toujours quelque chose d'actionnable
- Le titre du projet est court (5 mots max) ; l'objectif tient en une phrase
- Le contexte explique en 2 phrases ce qui pilote le projet`;

const SCHEMA = {
  type: "object",
  properties: {
    name: { type: "string" },
    objective: { type: "string" },
    context: { type: "string" },
    steps: {
      type: "array",
      items: {
        type: "object",
        properties: {
          title: { type: "string" },
          description: { type: "string" },
          tasks: {
            type: "array",
            items: {
              type: "object",
              properties: {
                title: { type: "string" },
                expected: { type: "string" },
              },
              required: ["title", "expected"],
              additionalProperties: false,
            },
          },
        },
        required: ["title", "description", "tasks"],
        additionalProperties: false,
      },
    },
  },
  required: ["name", "objective", "context", "steps"],
  additionalProperties: false,
} as const;

export async function generateProjectSuggestion(description: string): Promise<AIProjectSuggestion> {
  const client = getOpenAIClient();
  const response = await client.chat.completions.create({
    model: AI_MODEL,
    response_format: {
      type: "json_schema",
      json_schema: {
        name: "project_suggestion",
        strict: true,
        schema: SCHEMA,
      },
    },
    messages: [
      { role: "system", content: SYSTEM_PROMPT },
      {
        role: "user",
        content: `Voici la description du projet :\n\n${description.trim()}\n\nPropose une structure complète : nom, objectif, contexte, étapes avec leurs tâches.`,
      },
    ],
  });

  const content = response.choices[0]?.message?.content;
  if (!content) throw new Error("Réponse IA vide.");
  try {
    return JSON.parse(content) as AIProjectSuggestion;
  } catch {
    throw new Error("L'IA n'a pas renvoyé de JSON valide.");
  }
}
