import { getOpenAIClient, AI_MODEL } from "./client";
import { aiLocaleDirective } from "./locale";
import type { ProjectPriority } from "@/lib/project-taxonomy";

// Génère une tâche autonome à partir d'une description en langage naturel.
// Extrait un titre concis, un « attendu » actionnable, une priorité, et une
// date d'échéance (ISO YYYY-MM-DD) UNIQUEMENT si l'utilisateur la mentionne
// (y compris relative : « demain », « vendredi », « dans 3 jours »).

export interface GeneratedStandaloneTask {
  title: string;
  expected?: string;
  dueDate?: string;
  priority?: ProjectPriority;
}

const SYSTEM_PROMPT = `Tu transformes une demande en langage naturel en UNE tâche claire et actionnable.
Réponds STRICTEMENT en JSON avec ce schéma :
{
  "title": string,            // titre court et concret (impératif), sans détail superflu
  "expected": string | null,  // 1 à 2 phrases : le résultat concret attendu / critère de réussite. null si trivial
  "dueDate": string | null,   // date d'échéance au format YYYY-MM-DD, UNIQUEMENT si une date/délai est mentionné (résous les dates relatives à partir de TODAY). null sinon
  "priority": "high" | "medium" | "low" | null  // déduite si la demande exprime une urgence/importance, sinon null
}
Aucune clé supplémentaire, aucun texte hors du JSON.`;

export async function generateStandaloneTask(description: string, today: string): Promise<GeneratedStandaloneTask> {
  const client = getOpenAIClient();
  const completion = await client.chat.completions.create({
    model: AI_MODEL,
    temperature: 0.3,
    response_format: { type: "json_object" },
    messages: [
      { role: "system", content: SYSTEM_PROMPT + (await aiLocaleDirective()) },
      { role: "user", content: `TODAY = ${today}\n\nDemande :\n${description.trim()}` },
    ],
  });

  const raw = completion.choices[0]?.message?.content ?? "{}";
  let parsed: Record<string, unknown> = {};
  try {
    parsed = JSON.parse(raw) as Record<string, unknown>;
  } catch {
    parsed = {};
  }

  const title = typeof parsed.title === "string" && parsed.title.trim() ? parsed.title.trim() : description.trim().slice(0, 80);
  const expected = typeof parsed.expected === "string" && parsed.expected.trim() ? parsed.expected.trim() : undefined;
  const dueDate =
    typeof parsed.dueDate === "string" && /^\d{4}-\d{2}-\d{2}$/.test(parsed.dueDate) ? parsed.dueDate : undefined;
  const priority =
    parsed.priority === "high" || parsed.priority === "medium" || parsed.priority === "low"
      ? (parsed.priority as ProjectPriority)
      : undefined;

  return { title, expected, dueDate, priority };
}
