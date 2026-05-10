import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import { getWorkspace } from "@/lib/workspace";

// Point d'entrée : redirige vers le dashboard. Conserve le dernier
// workspace choisi via le cookie posé par le WorkspaceSwitcher pour ne
// pas réinitialiser sur "personal" à chaque visite ou clic sur le logo.
export default async function RootPage() {
  const store = await cookies();
  const workspace = getWorkspace(store.get("mindbase-workspace")?.value);
  redirect(`/dashboard?workspace=${workspace}`);
}
