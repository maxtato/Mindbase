// Aide IA pour générer la checklist d'une tâche.
// L'IA reçoit le contexte projet COMPLET (toutes les étapes, toutes les tâches)
// et la tâche ciblée explicitement marquée — pour proposer des sous-actions
// cohérentes avec le projet et qui ne doublonnent pas avec d'autres tâches.

import { getOpenAIClient, AI_MODEL } from "./client";
import type { Project, Step, Task } from "@/lib/mock-data";
import { buildProjectContextSnapshot } from "./project-context";

interface GenerateChecklistInput {
  project: Project;
  step: Step;
  task: Task;
}

const SYSTEM_PROMPT = `Tu génères la checklist d'une tâche : les sous-actions concrètes encore nécessaires.

BUT ULTIME — FAIRE AVANCER LE PROJET :
- Pars TOUJOURS du principe que l'objectif final est de faire PROGRESSER le projet vers son but.
- Chaque sous-action proposée doit être celle qui fait avancer le plus concrètement cette tâche — et donc le projet — vers cet objectif.
- Priorise les actions à FORT IMPACT et celles qui DÉBLOQUENT la suite (décisions, livrables, dépendances), pas le travail cosmétique ou administratif.
- Demande-toi pour chaque item : « est-ce que faire ça rapproche réellement le projet de son objectif ? » Si non, ne le propose pas.

AVANT DE RÉPONDRE, lis ATTENTIVEMENT :
1. La tâche : titre, attendu, réalisation déjà rédigée.
2. L'étape qui la contient : titre et description.
3. L'objectif et le contexte du projet (plan complet) — pour viser ce qui le fait avancer et repérer ce qui est déjà couvert ailleurs.

PHILOSOPHIE — concision et pertinence stricte :
- Mieux vaut 2 items vraiment utiles (qui font avancer le projet) que 5 vagues. Vise minimal, concret et à impact.
- Chaque item doit être une action que l'utilisateur DOIT faire pour finir la tâche, pas une étape théorique.
- Ne propose une action que si elle est NÉCESSAIRE, SPÉCIFIQUE à cette tâche et NON déjà couverte ailleurs.
- Si la tâche est triviale, simple ou presque finie, propose 0 ou 1 item — il est légitime de renvoyer une liste vide.

REJETER systématiquement (ne JAMAIS proposer) :
- Toute action vague : "réfléchir", "se renseigner", "faire un point", "préparer", "organiser", "planifier" sans complément concret.
- Toute action qui correspond à une autre tâche du plan ou à l'objectif d'une autre étape.
- Toute action évidente déjà couverte par l'attendu ou la réalisation rédigée.
- Tout doublon ou reformulation d'un item de la checklist actuelle.
- Toute étape "méta" type "valider la tâche", "marquer comme terminée", "documenter".

RÈGLES DE FORMAT :
- 0 à 4 items, en français
- Chaque item = verbe à l'infinitif + complément concret et mesurable (ex : "Contacter le prestataire X pour un devis")
- Items courts (≤ 12 mots), ordonnés logiquement
- Réponds en JSON strict : {"items": ["…", "…"]}  (peut être [])`;

const SCHEMA = {
  type: "object",
  properties: {
    items: {
      type: "array",
      items: { type: "string" },
    },
  },
  required: ["items"],
  additionalProperties: false,
} as const;

export async function generateTaskChecklist(input: GenerateChecklistInput): Promise<string[]> {
  const client = getOpenAIClient();
  const snapshot = buildProjectContextSnapshot(input.project, { highlightTaskId: input.task.id });
  const taskExpected = input.task.expected?.trim() || input.task.description?.trim() || "";
  const taskRealization = input.task.realization?.trim() || input.task.completionDetails?.trim() || "";
  const existingChecklist = (input.task.checklist ?? [])
    .map((item) => `  ${item.done ? "[✓]" : "[ ]"} ${item.label}`)
    .join("\n");
  const stepDescription = input.step.description?.trim() ?? "";
  const stepTaskTitles = (input.step.tasks ?? [])
    .filter((task) => task.id !== input.task.id)
    .map((task) => `  • ${task.title}`)
    .join("\n");

  const userMessage = [
    "=== PLAN COMPLET DU PROJET (la tâche ciblée est marquée ★) ===",
    "",
    snapshot,
    "",
    "=== ÉTAPE QUI CONTIENT LA TÂCHE ===",
    `Titre : ${input.step.title}`,
    stepDescription ? `Description : ${stepDescription}` : "Pas de description d'étape.",
    stepTaskTitles
      ? `Autres tâches de la même étape :\n${stepTaskTitles}`
      : "C'est la seule tâche de l'étape.",
    "",
    "=== TÂCHE CIBLÉE (★) — DÉTAILS COMPLETS ===",
    `Titre : ${input.task.title}`,
    taskExpected ? `Attendu (résultat visé) :\n${taskExpected}` : "Attendu : non encore renseigné.",
    taskRealization
      ? `Réalisation déjà rédigée (état actuel des avancées) :\n${taskRealization}`
      : "Réalisation : aucune avancée saisie pour le moment.",
    existingChecklist
      ? `Checklist actuelle (à compléter ou remplacer) :\n${existingChecklist}`
      : "Checklist actuelle : vide.",
    "",
    "=== TA MISSION ===",
    "Propose UNIQUEMENT les sous-actions concrètes restantes pour cette tâche, en gardant comme cap de FAIRE AVANCER LE PROJET vers son objectif : choisis les plus pertinentes et à plus fort impact, en cohérence avec le projet et l'étape, sans empiéter sur d'autres tâches du plan. Privilégie la pertinence et l'impact à la quantité.",
  ].join("\n");

  const response = await client.chat.completions.create({
    model: AI_MODEL,
    response_format: {
      type: "json_schema",
      json_schema: {
        name: "task_checklist",
        strict: true,
        schema: SCHEMA,
      },
    },
    messages: [
      { role: "system", content: SYSTEM_PROMPT },
      { role: "user", content: userMessage },
    ],
  });

  const content = response.choices[0]?.message?.content;
  if (!content) throw new Error("Réponse IA vide.");
  try {
    const parsed = JSON.parse(content) as { items: string[] };
    return parsed.items.map((item) => item.trim()).filter(Boolean);
  } catch {
    throw new Error("L'IA n'a pas renvoyé de JSON valide.");
  }
}
