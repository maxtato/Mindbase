import { createServerClient } from "@supabase/ssr";
import { NextResponse, type NextRequest } from "next/server";

export function updateSession(request: NextRequest) {
  let response = NextResponse.next({
    request,
  });

  const supabase = createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY!,
    {
      cookies: {
        getAll() {
          return request.cookies.getAll();
        },
        setAll(cookiesToSet) {
          cookiesToSet.forEach(({ name, value }) =>
            request.cookies.set(name, value)
          );

          response = NextResponse.next({
            request,
          });

          cookiesToSet.forEach(({ name, value, options }) =>
            response.cookies.set(name, value, options)
          );
        },
      },
    }
  );

  supabase.auth.getUser();

  // Empêche Safari iOS de mettre les pages HTML dans son back-forward cache.
  // Sans ça, un refresh restaure la page figée depuis le bfcache et React
  // n'hydrate pas re- → tous les onClick deviennent inactifs jusqu'à ce que
  // l'utilisateur vide le cache. `no-store` est la directive qui désactive
  // le bfcache sur Safari (https://web.dev/bfcache/#never-use-no-store).
  response.headers.set("Cache-Control", "no-store, must-revalidate");

  return response;
}