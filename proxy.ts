import { NextResponse, type NextRequest } from "next/server";

// Edge middleware minimal :
// - normalise /dashboard* sans ?workspace= vers la vue agrégée « Tous »
// - n'exécute aucune logique Supabase ici (cf. utils/supabase/middleware
//   qui peut crasher dans le runtime Edge de Vercel sur certaines versions).
export function proxy(request: NextRequest) {
  const { pathname, searchParams } = request.nextUrl;
  if (pathname.startsWith("/dashboard") && !searchParams.has("workspace")) {
    // Plus de « mode espace » : on affiche toujours la vue agrégée « Tous »
    // (tous espaces confondus). Les espaces ne servent plus que d'étiquette.
    const redirectUrl = request.nextUrl.clone();
    redirectUrl.searchParams.set("workspace", "all");
    return NextResponse.redirect(redirectUrl);
  }
  return NextResponse.next();
}

export const config = {
  matcher: [
    "/((?!_next/static|_next/image|favicon.ico|.*\\.(?:svg|png|jpg|jpeg|gif|webp)$).*)",
  ],
};