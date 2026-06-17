import { redirect } from "next/navigation";
import { AppShell } from "@/components/layout/app-shell";
import { AccountProvider } from "@/components/account/account-context";
import { getProfile, saveProfile } from "@/lib/account-store";
import { getAuthUser } from "@/utils/supabase/auth";
import { ACTIVE_ACCOUNT_NAME } from "@/lib/current-account";

export default async function DashboardLayout({ children }: { children: React.ReactNode }) {
  // Étape 1 — accès protégé : si Supabase est configuré et qu'aucun utilisateur
  // n'est connecté, on renvoie vers la connexion. (Si Supabase n'est pas
  // configuré en preview/dev, on laisse passer → comportement mono-compte.)
  const { user, configured } = await getAuthUser();
  if (configured && !user) {
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
  if (configured && user && !customizedProfileName && supabaseName && supabaseName !== profile.name) {
    await saveProfile({ name: supabaseName });
  }

  const name = customizedProfileName ? profile.name : supabaseName || profile.name;
  const email = user?.email || profile.email;

  return (
    <AccountProvider value={{ name, email, plan: profile.plan }}>
      <AppShell accountName={name}>{children}</AppShell>
    </AccountProvider>
  );
}
