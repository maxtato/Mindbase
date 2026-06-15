import Link from "next/link";
import { FlatmindLogo } from "@/components/branding/mindlay-logo";
import {
  FieldLabel,
  SurfaceCard,
  TextInput,
} from "@/components/ui/app-primitives";
import {
  cx,
  getButtonToneClass,
  getButtonToneStyle,
  getSurfaceToneStyle,
  textStyles,
} from "@/components/ui/theme";
import { signIn } from "../actions";

export default function LoginPage() {
  return (
    <main className="flex min-h-screen items-center justify-center px-6 py-10">
      <div className="grid w-full max-w-5xl gap-6 lg:grid-cols-[1.1fr_0.9fr]">
        <SurfaceCard className="hidden p-10 lg:block">
          <FlatmindLogo showTagline />

          <p className="mt-10 max-w-xl text-lg leading-8" style={textStyles.muted}>
            Flatmind aide à relier projets, tâches, fichiers et décisions
            dans deux environnements distincts: perso et pro.
          </p>

          <div className="mt-10 grid gap-4 sm:grid-cols-2">
            <div
              className="rounded-[24px] p-5"
              style={getSurfaceToneStyle("secondary")}
            >
              <p
                className="text-xs uppercase tracking-[0.18em]"
                style={textStyles.soft}
              >
                Perso
              </p>
              <p className="mt-3 text-sm leading-7" style={textStyles.muted}>
                Explore, clarifie, structure.
              </p>
            </div>
            <div
              className="rounded-[24px] p-5"
              style={getSurfaceToneStyle("secondary")}
            >
              <p
                className="text-xs uppercase tracking-[0.18em]"
                style={textStyles.soft}
              >
                Pro
              </p>
              <p className="mt-3 text-sm leading-7" style={textStyles.muted}>
                Cadre les décisions, le delivery et les priorités.
              </p>
            </div>
          </div>
        </SurfaceCard>

        <SurfaceCard className="p-8 sm:p-10">
          <p
            className="text-xs uppercase tracking-[0.24em]"
            style={textStyles.accent}
          >
            Connexion
          </p>
          <h1 className="mt-4 text-4xl font-semibold tracking-tight" style={textStyles.strong}>
            Accéder à Flatmind
          </h1>
          <p className="mt-4 text-base leading-7" style={textStyles.muted}>
            Connecte-toi à ton espace personnel ou professionnel.
          </p>

          <form action={signIn} className="mt-8 space-y-5">
            <div>
              <FieldLabel htmlFor="email">Email</FieldLabel>
              <TextInput
                id="email"
                name="email"
                type="email"
                required
                placeholder="ton@email.com"
              />
            </div>

            <div>
              <FieldLabel htmlFor="password">Mot de passe</FieldLabel>
              <TextInput
                id="password"
                name="password"
                type="password"
                required
                placeholder="••••••••"
              />
            </div>

            <button
              type="submit"
              className={cx(
                "w-full rounded-full px-6 py-3 text-sm font-medium transition hover:opacity-95",
                getButtonToneClass("accent")
              )}
              style={getButtonToneStyle("accent")}
            >
              Se connecter
            </button>
          </form>

          <p className="mt-6 text-sm" style={textStyles.muted}>
            Pas encore de compte ?{" "}
            <Link
              href="/auth/signup"
              className="underline underline-offset-4" style={{ color: "#7c3aed" }}
            >
              Créer un compte
            </Link>
          </p>
        </SurfaceCard>
      </div>
    </main>
  );
}
