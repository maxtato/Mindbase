import { CustomProjectForm } from "@/components/projects/custom-project-form";
import { getWorkspace, ALL_WORKSPACE } from "@/lib/workspace";

export default async function NewProjectPage({
  searchParams,
}: {
  searchParams: Promise<{ workspace?: string }>;
}) {
  const sp = await searchParams;
  const ws = getWorkspace(sp.workspace);
  // Un projet doit appartenir à un espace concret : si on crée depuis la vue
  // agrégée « Tous », on rattache par défaut à « Personnel » (modifiable
  // ensuite). Le choix explicite de l'espace à la création viendra en phase 2.
  const workspace = ws === ALL_WORKSPACE ? "personal" : ws;
  return <CustomProjectForm workspace={workspace} />;
}
