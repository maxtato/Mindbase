import { NextResponse, type NextRequest } from "next/server";
import { updateSession } from "./utils/supabase/middleware";

const WORKSPACE_COOKIE = "mindbase-workspace";
const VALID_WORKSPACES = new Set(["personal", "professional"]);

export function proxy(request: NextRequest) {
  // Si l'utilisateur arrive sur /dashboard* sans ?workspace=…, on injecte
  // celui mémorisé dans le cookie (ou "personal" par défaut). Ça évite que
  // les redirections internes (signup, projets/page.tsx, /projects/[id])
  // ou un simple bookmark "/dashboard" ne fasse retomber l'utilisateur sur
  // l'environnement personnel alors qu'il était en pro.
  const { pathname, searchParams } = request.nextUrl;
  if (pathname.startsWith("/dashboard") && !searchParams.has("workspace")) {
    const cookie = request.cookies.get(WORKSPACE_COOKIE)?.value;
    const workspace = cookie && VALID_WORKSPACES.has(cookie) ? cookie : "personal";
    const redirectUrl = request.nextUrl.clone();
    redirectUrl.searchParams.set("workspace", workspace);
    return NextResponse.redirect(redirectUrl);
  }
  return updateSession(request);
}

export const config = {
  matcher: [
    "/((?!_next/static|_next/image|favicon.ico|.*\\.(?:svg|png|jpg|jpeg|gif|webp)$).*)",
  ],
};