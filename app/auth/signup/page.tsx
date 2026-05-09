import Link from "next/link";
import { MindbaseLogo } from "@/components/branding/mindbase-logo";
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
import { signUp } from "../actions";

export default function SignupPage() {
  return (
    <main className="flex min-h-screen items-center justify-center px-6 py-10">
      <div className="grid w-full max-w-5xl gap-6 lg:grid-cols-[1.1fr_0.9fr]">
        <SurfaceCard className="hidden p-10 lg:block">
          <MindbaseLogo showTagline />

          <p className="mt-10 max-w-xl text-lg leading-8" style={textStyles.muted}>
            Crée ton espace Mindbase pour faire travailler ensemble tes idées,
            tes projets et les actions que tu veux cadrer.
          </p>

          <div
            className="mt-10 rounded-[28px] p-6"
            style={getSurfaceToneStyle("secondary")}
          >
            <p
              className="text-xs uppercase tracking-[0.18em]"
              style={textStyles.soft}
            >
              Flow
            </p>
            <p className="mt-3 text-sm leading-7 text-white/90">
              Think. Structure. Create. Un même flux, deux environnements,
              zéro friction visuelle.
            </p>
          </div>
        </SurfaceCard>

        <SurfaceCard className="p-8 sm:p-10">
          <p
            className="text-xs uppercase tracking-[0.24em]"
            style={textStyles.accent}
          >
            Inscription
          </p>
          <h1 className="mt-4 text-4xl font-semibold tracking-tight text-white">
            Créer un compte Mindbase
          </h1>
          <p className="mt-4 text-base leading-7" style={textStyles.muted}>
            Ouvre ton espace pour retrouver un environnement perso et un
            environnement pro dès la première connexion.
          </p>

          <form action={signUp} className="mt-8 space-y-5">
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
                placeholder="Choisis un mot de passe"
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
              Créer mon compte
            </button>
          </form>

          <p className="mt-6 text-sm" style={textStyles.muted}>
            Tu as déjà un compte ?{" "}
            <Link
              href="/auth/login"
              className="text-white underline underline-offset-4"
            >
              Se connecter
            </Link>
          </p>
        </SurfaceCard>
      </div>
    </main>
  );
}
