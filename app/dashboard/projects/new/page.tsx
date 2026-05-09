import { CustomProjectForm } from "@/components/projects/custom-project-form";
import { getWorkspace } from "@/lib/workspace";

export default async function NewProjectPage({
  searchParams,
}: {
  searchParams: Promise<{ workspace?: string }>;
}) {
  const sp = await searchParams;
  const workspace = getWorkspace(sp.workspace);
  return <CustomProjectForm workspace={workspace} />;
}
