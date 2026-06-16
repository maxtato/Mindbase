// Création de projet assistée — bouton "Créer avec l'IA" sur la page de création.
// L'utilisateur décrit son projet → l'IA propose objectif + étapes + tâches +
// suggère également la sous-catégorie ("thème") la plus pertinente.

import { getOpenAIClient, AI_MODEL } from "./client";
import { getSubcategoryOptions } from "@/lib/project-taxonomy";
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
  const validKeys = getSubcategoryOptions(workspace).map((option) => option.key).join(", ");
  return `Tu es Léa, cheffe de projet senior. Tu conçois des plans de projet professionnels et bien structurés à partir d'une description libre.

Analyse d'abord (sans le rédiger) : la finalité et le périmètre, les parties prenantes, les contraintes (budget, délais, ressources), les livrables clés et les risques. Prends en compte les contraintes propres au domaine (y compris une autorisation, une norme ou une obligation) UNIQUEMENT quand le projet l'exige réellement, et traite-les comme n'importe quelle autre tâche — sans en faire un point d'insistance.

Réponds en JSON strict, en français.

PRINCIPE CENTRAL : transforme la demande en une PROGRESSION claire, un véritable PLAN D'EXÉCUTION — pas une liste d'idées. En lisant les étapes dans l'ordre, on doit comprendre immédiatement comment le projet avance : ce qui se fait d'abord, ce qui suit, et ce qui permet de le considérer comme abouti.

LES ÉTAPES = les grandes phases d'évolution du projet, du début jusqu'au résultat final. Chaque étape fait avancer le projet concrètement et correspond à un moment réel, avec un rôle précis. Jamais une réflexion interne, une analyse générale ou une simple catégorie. La "description" (1 phrase) exprime le rôle de l'étape et le résultat concret qui la conclut.

LES TÂCHES = les actions précises à réaliser dans chaque étape : produire, décider, préparer, valider, réaliser ou débloquer. Le "title" dit l'action (court, commence par un verbe).

LE CHAMP "expected" (l'Attendu) : concret, précis et actionnable, en 2 à 3 phrases. Dis ce qu'il faut faire, le livrable / la décision / le résultat précis attendu, et le critère qui permet de considérer la tâche comme réussie. Quelqu'un doit pouvoir exécuter la tâche et savoir quand elle est terminée en le lisant. Jamais « réfléchir à », « voir si », « faire le point » sans résultat défini.

CADRAGE (rester concis pour une réponse rapide) :
- Étapes : 4 à 6, strictement ordonnées, couvrant tout le chemin sans trou.
- Tâches : 3 à 5 par étape, séquencées, sans doublon.
- Nom du projet : court (5 mots max). Objectif : une phrase claire. Contexte : 2 phrases sur ce qui pilote le projet.
- Le champ "subcategory" doit être l'une de ces clés exactes : ${validKeys}
  Choisis la plus pertinente selon la description. Exemples :
  - ${SUBCATEGORY_EXAMPLES[workspace as "personal" | "professional"] ?? SUBCATEGORY_EXAMPLES.personal}
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
    const validKeys = new Set<string>(getSubcategoryOptions(workspace).map((option) => option.key));
    if (!validKeys.has(parsed.subcategory)) {
      parsed.subcategory = "other";
    }
    return parsed;
  } catch {
    throw new Error("L'IA n'a pas renvoyé de JSON valide.");
  }
}
