import { Topbar } from "@/components/layout/topbar";
import { ThemeSwitcher } from "@/components/theme/theme-switcher";
import { PushSettings } from "@/components/notifications/push-settings";
import { ProfileSettings } from "@/components/account/profile-settings";
import { EnvironmentsManager } from "@/components/environments/environments-manager";
import { getProfile } from "@/lib/account-store";
import { surface, text } from "@/lib/design-tokens";
import { getWorkspace, workspaceTheme } from "@/lib/workspace";

export default async function SettingsPage({
  searchParams,
}: {
  searchParams: Promise<{ workspace?: string }>;
}) {
  const sp = await searchParams;
  const workspace = getWorkspace(sp.workspace);
  const theme = workspaceTheme[workspace];
  const profile = await getProfile();

  return (
    <div className="flex h-full flex-col overflow-hidden">
      <Topbar title="Paramètres" workspace={workspace} />

      <main className="mb-page-scroll mb-mobile-scroll mx-auto flex w-full max-w-[980px] flex-1 flex-col gap-5 overflow-y-auto px-8 py-7">
        <section
          className="rounded-[26px] p-7"
          style={{
            background: surface.s1,
            border: `1px solid ${surface.border}`,
          }}
        >
          <p
            className="text-xs font-semibold uppercase tracking-[0.22em]"
            style={{ color: theme.accentText }}
          >
            MindLay
          </p>
          <h1 className="mt-3 text-3xl font-bold tracking-tight" style={{ color: text.primary }}>
            Préférences de l’espace {theme.label.toLowerCase()}
          </h1>
          <p className="mt-3 max-w-2xl text-sm leading-6" style={{ color: text.secondary }}>
            Cette page reste volontairement légère pour l’instant : elle sert de base aux réglages globaux
            comme le thème, l’agenda et les préférences générales.
          </p>
        </section>

        <section
          className="rounded-[22px] p-6"
          style={{ background: surface.s1, border: `1px solid ${surface.border}` }}
        >
          <ProfileSettings workspace={workspace} initialName={profile.name} initialEmail={profile.email} />
        </section>

        <section
          className="rounded-[22px] p-6"
          style={{ background: surface.s1, border: `1px solid ${surface.border}` }}
        >
          <EnvironmentsManager />
        </section>

        <section
          className="rounded-[22px] p-6"
          style={{ background: surface.s1, border: `1px solid ${surface.border}` }}
        >
          <PushSettings workspace={workspace} />
        </section>

        <section className="grid gap-4 md:grid-cols-3">
          <article
            className="rounded-[22px] p-5"
            style={{
              background: surface.s1,
              border: `1px solid ${surface.borderSubtle}`,
              boxShadow: "var(--mb-shadow-card)",
            }}
          >
            <h2 className="text-sm font-semibold" style={{ color: text.primary }}>
              Thème
            </h2>
            <p className="mt-2 text-sm leading-6" style={{ color: text.secondary }}>
              Clair, sombre ou automatique.
            </p>
            <div className="mt-4">
              <ThemeSwitcher />
            </div>
          </article>

          {[
            ["Agenda", "La connexion calendrier sera centralisée ici plus tard."],
            ["Préférences", "Les réglages avancés pourront être pilotés depuis cet espace."],
          ].map(([title, description]) => (
            <article
              key={title}
              className="rounded-[22px] p-5"
              style={{
                background: surface.s2,
                border: `1px solid ${surface.borderSubtle}`,
              }}
            >
              <h2 className="text-sm font-semibold" style={{ color: text.primary }}>
                {title}
              </h2>
              <p className="mt-2 text-sm leading-6" style={{ color: text.secondary }}>
                {description}
              </p>
            </article>
          ))}
        </section>
      </main>
    </div>
  );
}
