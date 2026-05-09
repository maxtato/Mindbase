// Snapshot compact de l'intégralité du projet, utilisé comme contexte pour
// les suggestions IA ciblées (Attendu d'une tâche, Checklist d'une tâche).
// Garde la consommation de tokens sous contrôle : titres + attendu courts +
// statut, sans les commentaires/discussions/historique.

import type { Project, Task } from "@/lib/mock-data";
import { calculateProjectIndicators } from "@/lib/project-plan";

interface BuildProjectContextOptions {
  /** Si fourni, la tâche cible est mise en évidence dans la liste. */
  highlightTaskId?: string;
  /** Tronque l'attendu pour les autres tâches (défaut 110 chars). */
  expectedClamp?: number;
}

function clamp(value: string | undefined, max: number) {
  if (!value) return "";
  const cleaned = value.trim().replace(/\s+/g, " ");
  if (cleaned.length <= max) return cleaned;
  return `${cleaned.slice(0, max - 1).trim()}…`;
}

function flagFor(task: Task) {
  if (task.done) return "[✓]";
  if (task.blocked) return "[bloqué]";
  return "[ ]";
}

export function buildProjectContextSnapshot(project: Project, options: BuildProjectContextOptions = {}) {
  const expectedClamp = options.expectedClamp ?? 110;
  const indicators = calculateProjectIndicators(project);

  const lines: string[] = [
    `Projet : ${project.name}`,
    `Objectif global : ${project.objective || "(non renseigné)"}`,
    project.context ? `Contexte : ${clamp(project.context, 220)}` : "",
    `Avancement : ${project.progress}% (${indicators.doneTasks}/${indicators.totalTasks} tâches terminées)`,
    "",
    "Plan complet :",
  ].filter(Boolean);

  for (const step of project.steps ?? []) {
    const stepDone = step.tasks.filter((task) => task.done).length;
    lines.push(
      `▸ ${step.title} (${stepDone}/${step.tasks.length})${
        step.description ? ` — ${clamp(step.description, 140)}` : ""
      }`,
    );
    for (const task of step.tasks) {
      const target = task.id === options.highlightTaskId;
      const marker = target ? "  ★" : "   ";
      const expected = task.expected?.trim() || task.description?.trim();
      const due = task.dueDate ? ` · échéance ${task.dueDate}` : "";
      // La tâche ciblée garde son texte d'attendu intact ; les autres
      // tâches sont tronquées pour limiter la taille du snapshot.
      const expectedText = expected
        ? ` — ${target ? expected : clamp(expected, expectedClamp)}`
        : "";
      lines.push(`${marker} ${flagFor(task)} ${task.title}${due}${expectedText}`);
    }
  }

  if (options.highlightTaskId) {
    lines.push("", "★ = tâche ciblée par la demande IA actuelle.");
  }

  return lines.join("\n");
}
