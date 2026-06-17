import { CustomProjectForm } from "@/components/projects/custom-project-form";
import { getWorkspace } from "@/lib/workspace";

export default async function NewProjectPage({
  searchParams,
}: {
  searchParams: Promise<{ workspace?: string }>;
}) {
  const sp = await searchParams;
  // On passe l'espace courant tel quel, y compris « Tous » : dans ce cas le
  // formulaire affiche un sélecteur d'environnement pour choisir où ranger le
  // projet (Perso / Pro / personnalisé).
  const workspace = getWorkspace(sp.workspace);
  return <CustomProjectForm workspace={workspace} />;
}
