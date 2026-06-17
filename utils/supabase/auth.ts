import { createClient } from "./server";

// Récupère l'utilisateur Supabase connecté côté serveur, de façon défensive :
// si Supabase n'est pas configuré (env vars absentes en preview/dev) ou en cas
// d'erreur, on renvoie configured:false pour que l'app retombe sur son
// comportement mono-compte sans planter ni rediriger.
export async function getAuthUser(): Promise<{
  user: { id: string; email: string | null; name: string | null } | null;
  configured: boolean;
}> {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY;
  if (!url || !key) return { user: null, configured: false };

  try {
    const supabase = await createClient();
    const { data, error } = await supabase.auth.getUser();
    if (error || !data.user) return { user: null, configured: true };

    const meta = (data.user.user_metadata ?? {}) as Record<string, unknown>;
    const metaName =
      (typeof meta.name === "string" && meta.name) ||
      (typeof meta.full_name === "string" && meta.full_name) ||
      "";
    return {
      user: {
        id: data.user.id,
        email: data.user.email ?? null,
        name: metaName || null,
      },
      configured: true,
    };
  } catch {
    // Supabase EST configuré mais l'appel a échoué (URL/clé invalide, panne
    // SDK/runtime…) → on échoue FERMÉ : configured:true sans utilisateur, pour
    // que le layout redirige vers la connexion plutôt que d'exposer le dashboard.
    return { user: null, configured: true };
  }
}
