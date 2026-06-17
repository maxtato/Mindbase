import { redirect } from "next/navigation";
import { AppShell } from "@/components/layout/app-shell";
import { AccountProvider } from "@/components/account/account-context";
import { getProfile, saveProfile } from "@/lib/account-store";
import { getAuthUser } from "@/utils/supabase/auth";
import { ACTIVE_ACCOUNT_NAME } from "@/lib/current-account";

export default async function DashboardLayout({ children }: { children: React.ReactNode }) {
  // Accès protégé — DÉSACTIVÉ par défaut (la fonctionnalité de connexion reste
  // en arrière-plan tant qu'on ne l'active pas). On ne redirige vers la
  // connexion QUE si AUTH_ENABLED === "true" ET Supabase configuré ET aucun
  // utilisateur. Sinon, on continue à travailler librement (mono-compte).
  const authEnabled = process.env.AUTH_ENABLED === "true";
  const { user, configured } = await getAuthUser();
  if (authEnabled && configured && !user) {
    redirect("/auth/login");
  }

  // Étape 2 — identité réelle : on dérive le compte courant de l'utilisateur
  // Supabase. Le nom saisi dans les Paramètres (profil Redis) reste prioritaire
  // s'il a été personnalisé ; sinon on prend le nom/metadata Supabase ou la
  // partie locale de l'email. L'email affiché est celui du compte Supabase.
  const profile = await getProfile();
  const supabaseName = user?.name || (user?.email ? user.email.split("@")[0] : "");
  const customizedProfileName = Boolean(profile.name) && profile.name !== ACTIVE_ACCOUNT_NAME;

  // Synchronisation de l'identité SERVEUR : tant que le profil n'a pas été
  // personnalisé, on sème le nom Supabase dans le profil (Redis). Ainsi le nom
  // utilisé côté serveur (getProfile().name → filtres « Moi », createdBy,
  // visibilité collaborateur) correspond au compte connecté, et plus au défaut
  // partagé. Une seule écriture : ensuite le nom est « personnalisé ».
  if (authEnabled && configured && user && !customizedProfileName && supabaseName && supabaseName !== profile.name) {
    await saveProfile({ name: supabaseName });
  }

  // Quand l'auth est désactivée, on garde strictement le profil (mono-compte).
  const name = !authEnabled ? profile.name : customizedProfileName ? profile.name : supabaseName || profile.name;
  const email = authEnabled && user?.email ? user.email : profile.email;

  return (
    <AccountProvider value={{ name, email, plan: profile.plan }}>
      <AppShell accountName={name}>{children}</AppShell>
    </AccountProvider>
  );
}
