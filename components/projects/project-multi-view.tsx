import type { Project } from "@/lib/mock-data";
import { workspaceTheme, type Workspace } from "@/lib/workspace";
import { StepsPanel } from "@/components/projects/steps-panel";

interface ProjectMultiViewProps {
  project: Project;
  workspace: Workspace;
}

// La page projet ne propose plus qu'une vue : Étapes & Tâches.
// Les vues Kanban et Calendrier sont accessibles depuis la sidebar (transverses).
export function ProjectMultiView({ project, workspace }: ProjectMultiViewProps) {
  const steps = project.steps ?? [];

  return (
    <StepsPanel
      key={`${project.id}-${project.updatedAt}`}
      projectId={project.id}
      projectName={project.name}
      workspace={workspace}
      initialSteps={steps}
      // Les accents (boutons, progression, coches…) suivent la couleur de
      // l'ENVIRONNEMENT. La pastille de numéro d'étape et le pictogramme du
      // projet gardent la couleur de THÈME du projet (subcategoryColor).
      accentColor={workspaceTheme[workspace].accent}
      projectColor={project.subcategoryColor}
      projectPeople={project.people ?? []}
      projectTeams={project.teams ?? []}
      statusSettings={project.statusSettings}
    />
  );
}
