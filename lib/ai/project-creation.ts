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

PRINCIPE CENTRAL : transforme la demande en une PROGRESSION claire, un véritable PLAN D'EXÉCUTION — pas une simple liste d'idées. En lisant les étapes dans l'ordre, l'utilisateur doit comprendre immédiatement comment le projet avance : ce qui se fait en premier, ce qui vient ensuite, et ce qui permettra de considérer le projet comme abouti.

LES ÉTAPES = les grandes phases d'évolution du projet, du point de départ jusqu'au résultat final. Chaque étape doit faire avancer le projet CONCRÈTEMENT et correspondre à un moment réel du projet, avec un rôle précis dans la progression. Une étape n'est JAMAIS une réflexion interne, une analyse générale ou une simple catégorie. Chaque étape doit pouvoir répondre à : où en est le projet à ce moment-là ? quel objectif atteindre dans cette phase ? qu'est-ce qui doit être terminé avant de passer à la suivante ? quel résultat concret existe à la fin ? La "description" de l'étape exprime son rôle dans la progression et le résultat concret qui la conclut.

LES TÂCHES = les actions précises à réaliser à l'intérieur de chaque étape. Chaque tâche est concrète, utile, et directement liée à l'aboutissement du projet : produire quelque chose, prendre une décision, préparer un élément, valider un point, réaliser une action, ou débloquer la suite. Le "title" dit l'action à faire ; le champ "expected" dit clairement le résultat attendu (le livrable / la décision / la validation) et, si utile, pourquoi c'est utile et le critère de réussite.

À ÉVITER absolument :
- Étapes vagues du type « préparer le projet », « analyser la demande », « suivre l'avancement » — SAUF si elles correspondent à une action concrète avec un résultat défini.
- Tâches génériques du type « faire le point », « réfléchir à la suite », « organiser les idées » — SAUF si le résultat attendu est clairement défini. Jamais de « réfléchir à », « voir si », « réviser » sans livrable.

CADRAGE :
- Étapes : autant que nécessaire pour aller du début à la fin (en général 4 à 7), strictement ordonnées (chaque étape suppose la précédente terminée). Couvre tout le chemin jusqu'au résultat final, sans trou.
- Tâches : 3 à 6 par étape, séquencées, sans doublon. Intègre les actions souvent oubliées mais essentielles quand le domaine l'exige : vérification des normes/conformité, budget, autorisations, contrôle qualité, validation finale.
- Nom du projet : court (5 mots max). Objectif : une seule phrase claire et, si possible, mesurable. Contexte : 2 phrases sur ce qui pilote le projet (enjeux, contraintes clés, normes du domaine).
- Le champ "subcategory" doit être l'une de ces clés exactes : ${validKeys}
  Choisis la plus pertinente selon la description. Exemples :
  - ${SUBCATEGORY_EXAMPLES[workspace as "personal" | "professional"] ?? SUBCATEGORY_EXAMPLES.personal}
  Si vraiment rien ne colle, utilise "other".

Agis comme un chef de projet professionnel rigoureux : le plan doit donner l'impression d'un chemin logique évident, où chaque étape et chaque tâche fait réellement progresser le projet.`;
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
