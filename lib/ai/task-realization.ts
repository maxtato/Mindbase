// Organisation IA du champ « Réalisation » d'une tâche.
// L'utilisateur a souvent saisi tout ce qui a été fait en un seul bloc.
// Cette fonction sépare ce texte en ACTIONS distinctes — une par ligne — sans
// rien inventer ni perdre d'information. Le champ Réalisation affiche ensuite
// chaque ligne comme une puce.

import { getOpenAIClient, AI_MODEL } from "./client";

const SYSTEM_PROMPT = `Tu reçois le texte de "Réalisation" d'une tâche : ce qui a été concrètement fait, livré, décidé ou validé — souvent rédigé en un seul bloc.
Ta mission : séparer ce texte en ACTIONS distinctes, UNE PAR LIGNE.
Règles :
- Une seule action réalisée par ligne (un fait concret).
- Reformule légèrement chaque ligne pour qu'elle soit claire et autoportante (commence par un verbe au participe passé, ex : "Comparé trois fournisseurs", "Validé le budget transport").
- N'invente RIEN et ne supprime aucune information présente dans le texte.
- Ne fusionne pas deux actions différentes ; ne découpe pas artificiellement une action unique.
- Pas de puces, pas de numérotation, pas de guillemets : juste le texte de l'action.
- Conserve la langue d'origine (français).
Réponds en JSON strict.`;

const SCHEMA = {
  type: "object",
  properties: {
    lines: { type: "array", items: { type: "string" } },
  },
  required: ["lines"],
  additionalProperties: false,
} as const;

export async function splitTaskRealization(text: string): Promise<string[]> {
  const cleaned = text.trim();
  if (!cleaned) return [];

  const client = getOpenAIClient();
  const response = await client.chat.completions.create({
    model: AI_MODEL,
    response_format: {
      type: "json_schema",
      json_schema: { name: "realization_lines", strict: true, schema: SCHEMA },
    },
    messages: [
      { role: "system", content: SYSTEM_PROMPT },
      {
        role: "user",
        content: `Voici le texte de la réalisation à séparer en actions distinctes :\n\n${cleaned}`,
      },
    ],
  });

  const content = response.choices[0]?.message?.content;
  if (!content) throw new Error("Réponse IA vide.");
  try {
    const parsed = JSON.parse(content) as { lines?: unknown };
    const lines = Array.isArray(parsed.lines) ? parsed.lines : [];
    return lines
      .filter((line): line is string => typeof line === "string")
      .map((line) => line.replace(/^[-•\s]+/, "").trim())
      .filter(Boolean);
  } catch {
    throw new Error("L'IA n'a pas renvoyé de JSON valide.");
  }
}
