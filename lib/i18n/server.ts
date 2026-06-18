import { cookies } from "next/headers";
import { DEFAULT_LOCALE, LOCALE_COOKIE, isLocale, type Locale } from "@/lib/i18n/config";
import { translate } from "@/lib/i18n/messages";

// Lecture de la langue côté serveur (cookie). Utilisée par les composants
// serveur et le layout racine.
export async function getLocale(): Promise<Locale> {
  const store = await cookies();
  const value = store.get(LOCALE_COOKIE)?.value;
  return isLocale(value) ? value : DEFAULT_LOCALE;
}

// Fonction de traduction côté serveur, liée à la langue courante.
export async function getServerT() {
  const locale = await getLocale();
  return {
    locale,
    t: (key: string, vars?: Record<string, string | number>) => translate(locale, key, vars),
  };
}
