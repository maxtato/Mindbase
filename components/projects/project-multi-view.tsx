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
      // Tout l'intérieur (numéros d'étape, boutons, accents…) suit la couleur de
      // l'ENVIRONNEMENT. Seul le pictogramme du projet garde sa couleur de thème.
      accentColor={workspaceTheme[workspace].accent}
      projectPeople={project.people ?? []}
      projectTeams={project.teams ?? []}
      statusSettings={project.statusSettings}
    />
  );
}
