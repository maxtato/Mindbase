import Link from "next/link";
import { FlatmindLogo } from "@/components/branding/flatmind-logo";
import {
  FieldLabel,
  SurfaceCard,
  TextInput,
} from "@/components/ui/app-primitives";
import {
  cx,
  getButtonToneClass,
  getButtonToneStyle,
  textStyles,
} from "@/components/ui/theme";
import { signIn } from "../actions";

export default function LoginPage() {
  return (
    <main className="flex min-h-screen items-center justify-center px-6 py-10">
      <SurfaceCard className="w-full max-w-md p-8 sm:p-10">
        <div className="flex flex-col items-center text-center">
          <FlatmindLogo />
          <p className="mt-5 text-sm leading-6" style={textStyles.muted}>
            Relie tes projets, tâches, fichiers et décisions en un seul endroit.
          </p>
        </div>

        <form action={signIn} className="mt-8 space-y-4">
          <div>
            <FieldLabel htmlFor="email">Email</FieldLabel>
            <TextInput id="email" name="email" type="email" required placeholder="ton@email.com" />
          </div>

          <div>
            <FieldLabel htmlFor="password">Mot de passe</FieldLabel>
            <TextInput id="password" name="password" type="password" required placeholder="••••••••" />
          </div>

          <button
            type="submit"
            className={cx(
              "w-full rounded-full px-6 py-3 text-sm font-medium transition hover:opacity-95",
              getButtonToneClass("accent"),
            )}
            style={getButtonToneStyle("accent")}
          >
            Se connecter
          </button>
        </form>

        <p className="mt-6 text-center text-sm" style={textStyles.muted}>
          Pas encore de compte ?{" "}
          <Link href="/auth/signup" className="underline underline-offset-4" style={{ color: "#7c3aed" }}>
            Créer un compte
          </Link>
        </p>
      </SurfaceCard>
    </main>
  );
}
