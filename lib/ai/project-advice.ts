// Génération des « Tips du conseiller » à la CRÉATION d'un projet (le projet
// démarre, sans étapes/tâches encore) : on s'appuie sur le nom, l'objectif, le
// contexte et le type pour proposer 3 à 5 conseils concrets sur le COMMENT bien
// mener ce projet. Réutilisé tel quel par la synthèse (qui régénère ensuite).

import { getOpenAIClient, AI_MODEL } from "./client";
import { aiLocaleDirective } from "./locale";
import type { Project } from "@/lib/mock-data";

const SYSTEM_PROMPT = `Tu es un conseiller senior. À partir de la description d'un projet qui DÉMARRE (objectif, contexte, type), donne 3 à 5 TIPS concrets et priorisés pour le mener à bien : le COMMENT bien le conduire (posture à adopter, bon séquencement, points de levier à fort impact, pièges classiques à éviter, ce qu'il faut sécuriser/décider en premier). Ce ne sont NI des tâches à cocher NI des risques.
Chaque tip : une formule "Titre fort : explication concrète en une phrase" (≤ 22 mots au total), spécifique à CE projet — jamais de banalités type "reste organisé" ou "communique bien". Ordonne du plus important au moins important.
Réponds en JSON strict : {"advice": ["…", "…"]}.`;

const SCHEMA = {
  type: "object",
  properties: {
    advice: { type: "array", items: { type: "string" } },
  },
  required: ["advice"],
  additionalProperties: false,
} as const;

export async function generateProjectAdvice(project: Project): Promise<string[]> {
  const client = getOpenAIClient();
  const lines = [
    `Nom : ${project.name}`,
    `Objectif : ${project.objective || "(non renseigné)"}`,
    `Contexte : ${project.context || "(non renseigné)"}`,
    `Type : ${project.projectType} · Priorité : ${project.priority}`,
  ].join("\n");

  const response = await client.chat.completions.create({
    model: AI_MODEL,
    response_format: {
      type: "json_schema",
      json_schema: { name: "project_advice", strict: true, schema: SCHEMA },
    },
    messages: [
      { role: "system", content: SYSTEM_PROMPT + (await aiLocaleDirective()) },
      { role: "user", content: `Projet qui démarre :\n\n${lines}\n\nDonne les tips du conseiller pour bien le mener.` },
    ],
  });

  const content = response.choices[0]?.message?.content;
  if (!content) return [];
  try {
    return (JSON.parse(content) as { advice: string[] }).advice.map((tip) => tip.trim()).filter(Boolean);
  } catch {
    return [];
  }
}
