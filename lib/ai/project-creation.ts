// Création de projet assistée — bouton "Créer avec l'IA" sur la page de création.
// L'utilisateur décrit son projet → l'IA propose objectif + étapes + tâches +
// suggère également la sous-catégorie ("thème") la plus pertinente.

import { getOpenAIClient, AI_MODEL } from "./client";
import { subcategoriesByWorkspace } from "@/lib/project-taxonomy";
import type { Workspace } from "@/lib/workspace";

export interface AIProjectSuggestion {
  name: string;
  objective: string;
  context: string;
  subcategory: string;
  steps: Array<{
    title: string;
    description: string;
    tasks: Array<{
      title: string;
      expected: string;
    }>;
  }>;
}

const SUBCATEGORY_EXAMPLES: Record<Workspace, string> = {
  personal: [
    "voyage : vacances, road trip, itinéraire, week-end à l'étranger",
    "loisirs : paintball, sport, hobby, sortie, événement perso",
    "maison : travaux, déménagement, ameublement, jardin",
    "finances : budget, épargne, impôts, investissement",
    "sante : rendez-vous médicaux, suivi sportif, alimentation",
    "famille : organisation familiale, enfants, vie de couple",
    "vehicules : achat voiture, entretien, assurance auto",
    "creatif : projet artistique, écriture, design perso",
    "administratif : papiers, démarches, abonnements",
    "other : aucune catégorie ne convient vraiment",
  ].join("\n  - "),
  professional: [
    "strategie : positionnement, pricing, vision, roadmap",
    "commercial : vente, prospection, closing, partenariats",
    "marketing : campagne, acquisition, contenu, SEO",
    "operations : process interne, infra, outillage",
    "finance : budget pro, comptabilité, levée de fonds",
    "produit : fonctionnalité, onboarding, UX",
    "rh : recrutement, onboarding employé, formation",
    "administratif : juridique, démarches, conformité",
    "other : aucune catégorie ne convient vraiment",
  ].join("\n  - "),
};

function buildSystemPrompt(workspace: Workspace) {
  const validKeys = subcategoriesByWorkspace[workspace].map((option) => option.key).join(", ");
  return `Tu aides à structurer un projet à partir d'une description libre.
Réponds en JSON strict, en français.
Règles :
- 3 à 5 étapes maximum, ordonnées logiquement
- Chaque étape contient 2 à 4 tâches concrètes
- Le champ "expected" de chaque tâche doit décrire précisément ce qu'il faut faire (livrable, action, résultat attendu) — jamais une formulation vague
- Pas de tâche du genre "réfléchir à", "réviser" — toujours quelque chose d'actionnable
- Le titre du projet est court (5 mots max) ; l'objectif tient en une phrase
- Le contexte explique en 2 phrases ce qui pilote le projet
- Le champ "subcategory" doit être l'une de ces clés exactes : ${validKeys}
  Choisis la plus pertinente selon la description. Exemples :
  - ${SUBCATEGORY_EXAMPLES[workspace]}
  Si vraiment rien ne colle, utilise "other".`;
}

const SCHEMA = {
  type: "object",
  properties: {
    name: { type: "string" },
    objective: { type: "string" },
    context: { type: "string" },
    subcategory: { type: "string" },
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
  required: ["name", "objective", "context", "subcategory", "steps"],
  additionalProperties: false,
} as const;

export async function generateProjectSuggestion(
  description: string,
  workspace: Workspace,
): Promise<AIProjectSuggestion> {
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
      { role: "system", content: buildSystemPrompt(workspace) },
      {
        role: "user",
        content: `Voici la description du projet :\n\n${description.trim()}\n\nPropose une structure complète : nom, objectif, contexte, sous-catégorie (thème) et étapes avec leurs tâches.`,
      },
    ],
  });

  const content = response.choices[0]?.message?.content;
  if (!content) throw new Error("Réponse IA vide.");
  try {
    const parsed = JSON.parse(content) as AIProjectSuggestion;
    // Garde-fou : si l'IA renvoie une clé inconnue, on retombe sur "other".
    const validKeys = new Set<string>(subcategoriesByWorkspace[workspace].map((option) => option.key));
    if (!validKeys.has(parsed.subcategory)) {
      parsed.subcategory = "other";
    }
    return parsed;
  } catch {
    throw new Error("L'IA n'a pas renvoyé de JSON valide.");
  }
}
