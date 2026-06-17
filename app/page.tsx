import { redirect } from "next/navigation";

// Point d'entrée : redirige vers le dashboard sur la vue agrégée « Tous »
// (tous espaces confondus). Plus de « mode espace » ni de cookie : les
// espaces ne servent plus que d'étiquette/filtre.
export default function RootPage() {
  redirect("/dashboard?workspace=all");
}
