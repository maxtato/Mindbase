// Mise à jour de la synthèse projet — bouton "Mettre à jour la synthèse IA"
// dans le rail droit. Lit tout le projet et renvoie une synthèse complète
// couvrant TOUTES les cartes du rail :
//   • Objectif
//   • Contexte
//   • État actuel (résumé exécutif court)
//   • Résumé du projet
//   • Prochaines étapes clés
//   • Risques identifiés
// Cette action n'écrit que sur les champs synthèse — jamais sur les tâches,
// statuts, dates ou checklists.

import { getOpenAIClient, AI_MODEL } from "./client";
import { aiLocaleDirective } from "./locale";
import type { Project } from "@/lib/mock-data";
import { calculateProjectIndicators } from "@/lib/project-plan";
import { isTaskOverdue, flattenProjectTasks, type FlattenedProjectTask } from "@/lib/project-insights";

export interface AIProjectSynthesis {
  objective: string;
  context: string;
  summary: string;
  currentState: string;
  nextSteps: string[];
  risks: Array<{
    title: string;
    severity: "high" | "medium" | "low";
    mitigation: string;
  }>;
}

const SYSTEM_PROMPT = `Tu rédiges la synthèse d'un projet à partir de son plan complet (objectif, contexte, étapes, tâches, blocages, risques).
Voix humaine, phrases courtes et utiles. Jamais robotique. Pas de "ce projet vise à", pas de "il est à noter que", pas d'énumération de pourcentages bruts.

Distinction très importante :
- Le "contexte" et le "résumé" parlent du PROJET LUI-MÊME (sujet réel, contraintes du monde réel — budget, dates, lieu, parties prenantes, exigences, environnement, dépendances externes, etc.)
- L'"état actuel" et les "prochaines actions" parlent de la GESTION du projet dans Flatmind (avancement, ce qui a été fait, ce qu'il faut faire maintenant)
- Ne mélange jamais les deux : le contexte ne doit JAMAIS parler de "tâches ouvertes", "avancement %", "tableau Kanban" ou "synthèse à mettre à jour".

Règles par champ :
- "objective" (1 phrase, 12-20 mots) : reformule la finalité concrète du projet dans le monde réel. Exemple : "Réserver un voyage en Asie pour 2 personnes avec un budget de 3 000 € en saison optimale."
- "context" (2-3 phrases) : décrit le projet dans la vraie vie — contraintes (budget, durée, lieu), exigences, parties prenantes externes, hypothèses, environnement, ce qu'il faut respecter pour réussir. Pas de mention de la gestion in-app. Exemple : "Voyage prévu pour deux adultes avec un plafond de 3 000 € tout compris. Privilégier la basse saison pour profiter de meilleurs tarifs et éviter les longs vols."
- "summary" (3-5 phrases, paragraphe global) : récit fluide qui décrit le PROJET LUI-MÊME — finalité, contraintes principales (budget, durée, parties prenantes, environnement), enjeux concrets, public visé.
  INTERDIT — la synthèse ne doit JAMAIS parler de la façon dont le projet est suivi, planifié ou managé dans un outil. Aucune mention de :
  · "synthèse IA", "généré par IA", "assistant IA", "via l'IA"
  · "Flatmind", "tableau de bord", "outil", "application", "plateforme"
  · "tâches", "étapes", "checklist", "kanban", "rail", "carte"
  · "avancement", "progression %", "statut", "ce qui reste à faire"
  · toute formule du type "le projet sera structuré/géré/piloté/suivi via…"
  Le résumé doit pouvoir être copié-collé dans une présentation externe sans qu'aucun lecteur ne devine que ce projet est suivi dans un outil. On parle UNIQUEMENT du sujet réel.
- "currentState" (2-4 phrases) : résume où en est concrètement le projet en termes d'exécution. Cite les avancées clés (étapes passées, livrables produits) et la dynamique. Évite les chiffres bruts — préfère "près de la moitié des tâches sont closes" à "11% (1/9 tâches)".
- "nextSteps" (2 à 4 actions stratégiques) : propose les axes les plus importants pour faire avancer le projet efficacement maintenant. Plus stratégique que tactique : pas "Cocher la tâche X", plutôt "Verrouiller le budget transport avant de lancer les réservations". Chaque action en 8-15 mots, verbe à l'infinitif d'abord. Le but est d'aiguiller, pas de micro-manager.
- "risks" (0 à 5 risques) : risques réellement perceptibles (retards, blocages, dépendances fragiles, contraintes externes menacées, etc.). Pour chacun : "title" 6-12 mots, "severity" parmi "high"/"medium"/"low", "mitigation" 8-18 mots concrète. Si rien, renvoie [].

Réponds en JSON strict.`;

const SCHEMA = {
  type: "object",
  properties: {
    objective: { type: "string" },
    context: { type: "string" },
    currentState: { type: "string" },
    summary: { type: "string" },
    nextSteps: { type: "array", items: { type: "string" } },
    risks: {
      type: "array",
      items: {
        type: "object",
        properties: {
          title: { type: "string" },
          severity: { type: "string", enum: ["high", "medium", "low"] },
          mitigation: { type: "string" },
        },
        required: ["title", "severity", "mitigation"],
        additionalProperties: false,
      },
    },
  },
  required: ["objective", "context", "currentState", "summary", "nextSteps", "risks"],
  additionalProperties: false,
} as const;

function buildProjectSnapshot(project: Project): string {
  const indicators = calculateProjectIndicators(project);
  const tasks = flattenProjectTasks(project);
  const overdue = tasks.filter((entry) => isTaskOverdue(entry.task));
  const blocked = tasks.filter((entry) => entry.task.blocked && !entry.task.done);
  const openBlockers = project.blockers.filter((blocker) => blocker.status === "open");

  const lines: string[] = [
    `Nom du projet : ${project.name}`,
    `Objectif déclaré : ${project.objective || "(non renseigné)"}`,
    `Contexte : ${project.context || "(non renseigné)"}`,
    `Avancement : ${project.progress}% (${indicators.doneTasks}/${indicators.totalTasks} tâches terminées)`,
    `Statut : ${project.status} · Priorité : ${project.priority}`,
    `Tâches ouvertes : ${indicators.totalTasks - indicators.doneTasks}`,
    `Tâches en retard : ${overdue.length}`,
    `Tâches bloquées : ${blocked.length}`,
    `Bloqueurs ouverts : ${openBlockers.length}`,
    "",
    "Étapes :",
  ];

  for (const step of project.steps ?? []) {
    const stepTasksDone = step.tasks.filter((task) => task.done).length;
    lines.push(
      `- ${step.title} (${stepTasksDone}/${step.tasks.length} terminées)${
        step.description ? ` — ${step.description}` : ""
      }`,
    );
    for (const task of step.tasks) {
      const flag = task.done ? "[✓]" : task.blocked ? "[bloqué]" : "[ ]";
      const due = task.dueDate ? ` · échéance ${task.dueDate}` : "";
      const expected = task.expected?.trim();
      lines.push(`  ${flag} ${task.title}${due}${expected ? ` — attendu : ${expected}` : ""}`);
    }
  }

  if (overdue.length > 0) {
    lines.push("", "Détail tâches en retard :");
    overdue.slice(0, 8).forEach((entry: FlattenedProjectTask) => {
      lines.push(`- ${entry.task.title} (échéance : ${entry.task.dueDate})`);
    });
  }

  if (openBlockers.length > 0) {
    lines.push("", "Bloqueurs ouverts :");
    openBlockers.forEach((blocker) => {
      lines.push(`- ${blocker.label}${blocker.description ? ` — ${blocker.description}` : ""}`);
    });
  }

  if ((project.risks ?? []).length > 0) {
    lines.push("", "Risques actuellement notés :");
    project.risks.forEach((risk) => {
      lines.push(`- [${risk.severity}] ${risk.title}${risk.mitigation ? ` — atténuation : ${risk.mitigation}` : ""}`);
    });
  }

  return lines.join("\n");
}

export async function generateProjectSynthesis(project: Project): Promise<AIProjectSynthesis> {
  const client = getOpenAIClient();
  const snapshot = buildProjectSnapshot(project);

  const response = await client.chat.completions.create({
    model: AI_MODEL,
    response_format: {
      type: "json_schema",
      json_schema: {
        name: "project_synthesis",
        strict: true,
        schema: SCHEMA,
      },
    },
    messages: [
      { role: "system", content: SYSTEM_PROMPT + (await aiLocaleDirective()) },
      {
        role: "user",
        content: `Voici l'état du projet :\n\n${snapshot}\n\nRédige la synthèse complète couvrant l'objectif, le contexte, l'état actuel, le résumé, les prochaines étapes et les risques.`,
      },
    ],
  });

  const content = response.choices[0]?.message?.content;
  if (!content) throw new Error("Réponse IA vide.");
  try {
    return JSON.parse(content) as AIProjectSynthesis;
  } catch {
    throw new Error("L'IA n'a pas renvoyé de JSON valide.");
  }
}
