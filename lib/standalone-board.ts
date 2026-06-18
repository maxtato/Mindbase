import type { Project } from "@/lib/mock-data";
import type { FlattenedProjectTask } from "@/lib/project-insights";
import type { StandaloneTask } from "@/lib/standalone-tasks-store";
import { deriveTaskStatus } from "@/lib/project-plan";
import { workspaceTheme } from "@/lib/workspace";

// Adapte une tâche autonome au format attendu par les tableaux Kanban /
// Calendrier ({ project, entry }), via un « pseudo-projet » reconnaissable à
// son id préfixé. Les cartes détectent ce préfixe pour afficher le marqueur
// « tâche libre » et router les actions vers le store des tâches autonomes.

export const STANDALONE_PREFIX = "standalone:";

export function isStandaloneProjectId(id: string | undefined): boolean {
  return typeof id === "string" && id.startsWith(STANDALONE_PREFIX);
}

export function standaloneToBoardItem(task: StandaloneTask): { project: Project; entry: FlattenedProjectTask } {
  const project = {
    id: `${STANDALONE_PREFIX}${task.id}`,
    name: "",
    workspace: task.workspace,
    subcategoryColor: workspaceTheme[task.workspace].accent,
    steps: [],
    people: [],
    teams: [],
    blockers: [],
    decisions: [],
    risks: [],
    actions: [],
    progress: task.done ? 100 : 0,
  } as unknown as Project;

  const entry: FlattenedProjectTask = {
    id: task.id,
    stepId: STANDALONE_PREFIX,
    stepTitle: "",
    stepOrder: 0,
    taskOrder: task.order ?? 0,
    task,
    boardStatus: deriveTaskStatus(task),
  };

  return { project, entry };
}
