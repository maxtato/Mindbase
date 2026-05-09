import { createClient } from "./supabase/server";

export async function ensureUserSetup() {
  const supabase = await createClient();

  const {
    data: { user },
    error: userError,
  } = await supabase.auth.getUser();

  if (userError || !user) {
    return { user: null };
  }

  const { data: existingProfile } = await supabase
    .from("profiles")
    .select("id")
    .eq("id", user.id)
    .maybeSingle();

  if (!existingProfile) {
    const { error: insertProfileError } = await supabase.from("profiles").insert({
      id: user.id,
      email: user.email ?? null,
    });

    if (insertProfileError) {
      throw insertProfileError;
    }
  }

  const { data: existingWorkspaces } = await supabase
    .from("workspaces")
    .select("id, type")
    .eq("user_id", user.id);

  const workspaceTypes = new Set((existingWorkspaces ?? []).map((w) => w.type));

  const workspacesToCreate: {
    user_id: string;
    type: "personal" | "professional";
    name: string;
    description: string;
  }[] = [];

  if (!workspaceTypes.has("personal")) {
    workspacesToCreate.push({
      user_id: user.id,
      type: "personal",
      name: "Perso",
      description: "Espace personnel",
    });
  }

  if (!workspaceTypes.has("professional")) {
    workspacesToCreate.push({
      user_id: user.id,
      type: "professional",
      name: "Pro",
      description: "Espace professionnel",
    });
  }

  if (workspacesToCreate.length > 0) {
    const { error: insertWorkspaceError } = await supabase
      .from("workspaces")
      .insert(workspacesToCreate);

    if (insertWorkspaceError) {
      throw insertWorkspaceError;
    }
  }

  return { user };
}