import type { Project } from "@/lib/mock-data";
import { taskBelongsToUser } from "@/lib/task-filters";

// Règles de visibilité des tâches dans les vues transversales (Kanban,
// Calendrier) :
//  • Le CRÉATEUR du projet voit toutes les tâches et peut les filtrer par
//    personne.
//  • Les autres collaborateurs ne voient que leurs propres tâches.
// Les projets historiques sans champ createdBy sont considérés comme
// appartenant au lecteur courant (compat — appli mono-utilisateur jusqu'ici).

function firstName(value: string): string {
  return value.trim().toLowerCase().split(" ")[0] ?? "";
}

export function isProjectCreator(project: Project, viewerName: string): boolean {
  const creator = project.createdBy?.trim();
  if (!creator) return true;
  const v = viewerName.trim().toLowerCase();
  if (!v) return false;
  return creator.toLowerCase() === v || firstName(creator) === firstName(viewerName);
}

// Liste des noms de personnes assignables, agrégés depuis les projets dont le
// lecteur est créateur (personnes du projet + responsables/assignés des
// tâches). Exclut le lecteur lui-même (couvert par l'option « Moi »).
export function collectAssignablePeople(ownedProjects: Project[], viewerName: string): string[] {
  const viewerFirst = firstName(viewerName);
  const byKey = new Map<string, string>();
  const add = (name: string | undefined) => {
    const clean = name?.trim();
    if (!clean) return;
    const key = clean.toLowerCase();
    if (firstName(clean) === viewerFirst) return;
    if (!byKey.has(key)) byKey.set(key, clean);
  };

  for (const project of ownedProjects) {
    for (const person of project.people ?? []) add(person.name);
    for (const step of project.steps ?? []) {
      for (const task of step.tasks ?? []) {
        add(task.owner);
        for (const assignee of task.assignees ?? []) add(assignee);
      }
    }
  }

  return [...byKey.values()].sort((a, b) => a.localeCompare(b, "fr"));
}

// Le viewer voit une tâche s'il en est responsable/assigné OU s'il appartient à
// une équipe assignée à cette tâche (task.teamIds → team.memberIds → personnes).
export function taskBelongsToViewerOrTeam(project: Project, task: Parameters<typeof taskBelongsToUser>[0], viewerName: string): boolean {
  if (taskBelongsToUser(task, viewerName)) return true;
  const taskTeamIds = (task as { teamIds?: string[] }).teamIds ?? [];
  if (taskTeamIds.length === 0) return false;
  const viewerFirst = firstName(viewerName);
  // ids des personnes du projet qui correspondent au viewer (par prénom/nom).
  const viewerPersonIds = (project.people ?? [])
    .filter((p) => firstName(p.name) === viewerFirst || p.name.trim().toLowerCase() === viewerName.trim().toLowerCase())
    .map((p) => p.id);
  if (viewerPersonIds.length === 0) return false;
  const viewerTeamIds = (project.teams ?? [])
    .filter((team) => (team.memberIds ?? []).some((id) => viewerPersonIds.includes(id)))
    .map((team) => team.id);
  return taskTeamIds.some((id) => viewerTeamIds.includes(id));
}

// Valeurs spéciales du filtre « Personne ».
export const PERSON_FILTER_ALL = "all";
export const PERSON_FILTER_ME = "__me";

// Applique la règle d'accès + le filtre personne à une tâche d'un projet donné.
export function taskVisibleToViewer(
  project: Project,
  task: Parameters<typeof taskBelongsToUser>[0],
  viewerName: string,
  personFilter: string,
): boolean {
  if (!isProjectCreator(project, viewerName)) {
    // Collaborateur non créateur : ses propres tâches OU celles d'une équipe
    // dont il fait partie (cohérent avec la vue détaillée du projet).
    return taskBelongsToViewerOrTeam(project, task, viewerName);
  }
  // Créateur : soumis au filtre personne.
  if (personFilter === PERSON_FILTER_ALL) return true;
  if (personFilter === PERSON_FILTER_ME) return taskBelongsToUser(task, viewerName);
  return taskBelongsToUser(task, personFilter);
}
