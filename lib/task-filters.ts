import type { Task } from "@/lib/mock-data";

// Filtre « mes tâches » : la tâche m'appartient si je suis le responsable
// (owner) ou présent dans assignees. Comparaison sur le prénom pour tolérer
// « Maxime T. » vs « Maxime ». Partagé entre les vues kanban et calendrier.
export function taskBelongsToUser(task: Task, me: string): boolean {
  const meKey = me.trim().toLowerCase().split(" ")[0];
  if (!meKey) return false;
  const matches = (name: string | undefined) => {
    if (!name) return false;
    const key = name.trim().toLowerCase();
    return key === me.toLowerCase() || key.split(" ")[0] === meKey;
  };
  if (matches(task.owner)) return true;
  return (task.assignees ?? []).some((name) => matches(name));
}
