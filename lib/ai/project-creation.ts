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
  return `Tu es Léa, cheffe de projet senior. Tu conçois des plans de projet MÉTICULEUX, ultra-professionnels et parfaitement structurés à partir d'une description libre.

AVANT de structurer, ANALYSE le projet comme une véritable chef de projet — c'est l'étape la plus importante :
- Finalité & périmètre : le résultat concret visé, ce qui est dans le périmètre et ce qui en est exclu.
- Parties prenantes : qui est concerné (client/bénéficiaire, équipe, fournisseurs, partenaires, instances officielles).
- Contraintes : budget, délais, ressources, dépendances externes, saisonnalité.
- NORMES & EXIGENCES du domaine à respecter impérativement : règles légales, réglementaires, fiscales, de sécurité, d'hygiène, techniques, qualité, autorisations… propres au sujet réel du projet. Intègre-les explicitement dans le plan.
- Livrables clés, jalons de validation et risques principaux à anticiper.

PUIS traduis cette analyse en un plan qui couvre TOUT le cycle de vie du projet, dans l'ordre logique :
cadrage / préparation → planification → exécution → suivi & contrôle qualité → clôture / livraison.

Réponds en JSON strict, en français.

Règles de structuration :
- Étapes : autant que nécessaire pour couvrir le cycle de vie (en général 4 à 7), ordonnées logiquement, chacune représentant une phase ou un lot cohérent. La "description" explique le but de l'étape et ce qui la conclut (livrable / jalon).
- Tâches : 3 à 6 par étape, concrètes, bien séquencées, sans trou ni doublon. Pense aux tâches souvent oubliées mais essentielles : cadrage du besoin, vérification des normes/conformité, budget, autorisations, communication, contrôle qualité, points de décision, validation finale.
- "expected" de chaque tâche : décrit précisément le livrable / résultat attendu et, quand c'est utile, le critère de réussite — jamais une formulation vague. Toujours actionnable (verbe d'action concret), jamais "réfléchir à", "voir si", "réviser".
- Nom du projet : court (5 mots max). Objectif : une seule phrase claire et, si possible, mesurable. Contexte : 2 phrases sur ce qui pilote le projet (enjeux, contraintes clés).
- Le champ "subcategory" doit être l'une de ces clés exactes : ${validKeys}
  Choisis la plus pertinente selon la description. Exemples :
  - ${SUBCATEGORY_EXAMPLES[workspace as "personal" | "professional"] ?? SUBCATEGORY_EXAMPLES.personal}
  Si vraiment rien ne colle, utilise "other".

Exigence de qualité : agis comme un chef de projet professionnel rigoureux. Chaque étape et chaque tâche doit apporter une réelle valeur pour mener le projet à bien proprement — qualité et exhaustivité utile avant remplissage.`;
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
