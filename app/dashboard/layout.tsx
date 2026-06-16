import { AppShell } from "@/components/layout/app-shell";
import { AccountProvider } from "@/components/account/account-context";
import { getProfile } from "@/lib/account-store";

export default async function DashboardLayout({ children }: { children: React.ReactNode }) {
  const profile = await getProfile();
  return (
    <AccountProvider value={{ name: profile.name, email: profile.email, plan: profile.plan }}>
      <AppShell accountName={profile.name}>{children}</AppShell>
    </AccountProvider>
  );
}
