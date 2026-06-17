import { NextResponse, type NextRequest } from "next/server";

const WORKSPACE_COOKIE = "mindbase-workspace";
// Environnements valides : les deux intégrés + tout id personnalisé (env_*) ou
// la vue agrégée "all".
function isValidWorkspace(value: string | undefined): value is string {
  return !!value && (value === "personal" || value === "professional" || value === "all" || value.startsWith("env_"));
}

// Edge middleware minimal :
// - normalise /dashboard* sans ?workspace= via le cookie
// - n'exécute aucune logique Supabase ici (cf. utils/supabase/middleware
//   qui peut crasher dans le runtime Edge de Vercel sur certaines
//   versions). Le refresh de session Supabase passera par les
//   server actions au moment où l'on en aura réellement besoin.
export function proxy(request: NextRequest) {
  const { pathname, searchParams } = request.nextUrl;
  if (pathname.startsWith("/dashboard") && !searchParams.has("workspace")) {
    const cookie = request.cookies.get(WORKSPACE_COOKIE)?.value;
    // Atterrissage par défaut : la vue agrégée « Tous » (on voit tout, tous
    // espaces confondus) plutôt qu'un espace cloisonné — on ne rate rien. Les
    // espaces restent disponibles comme filtre via le sélecteur. On respecte
    // le dernier espace choisi (cookie) s'il existe.
    const workspace = isValidWorkspace(cookie) ? cookie : "all";
    const redirectUrl = request.nextUrl.clone();
    redirectUrl.searchParams.set("workspace", workspace);
    return NextResponse.redirect(redirectUrl);
  }
  return NextResponse.next();
}

export const config = {
  matcher: [
    "/((?!_next/static|_next/image|favicon.ico|.*\\.(?:svg|png|jpg|jpeg|gif|webp)$).*)",
  ],
};