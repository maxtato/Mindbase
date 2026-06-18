// Configuration i18n : langues supportées, langue par défaut, cookie de
// persistance. Le choix de langue est mémorisé dans un cookie pour que le
// rendu serveur (composants serveur) ET le rendu client utilisent la même
// langue dès le premier rendu (pas de flash).
export const LOCALES = ["fr", "en"] as const;
export type Locale = (typeof LOCALES)[number];
export const DEFAULT_LOCALE: Locale = "fr";
export const LOCALE_COOKIE = "mindbase-locale";

export function isLocale(value: string | undefined | null): value is Locale {
  return value === "fr" || value === "en";
}

export const LOCALE_LABELS: Record<Locale, string> = {
  fr: "Français",
  en: "English",
};
