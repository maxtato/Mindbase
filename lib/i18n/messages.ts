import type { Locale } from "@/lib/i18n/config";

// Dictionnaire de traductions (clé plate → texte). Importable côté serveur ET
// client (données pures). On ajoute les clés par lots au fil de la traduction
// des écrans. Toute clé absente retombe sur la clé elle-même (visible → à
// traduire).
type Dict = Record<string, string>;

const fr: Dict = {
  // Navigation
  "nav.dashboard": "Dashboard",
  "nav.home": "Accueil",
  "nav.projects": "Projets",
  "nav.kanban": "Kanban",
  "nav.calendar": "Calendrier",
  "nav.settings": "Réglages",
  "nav.settingsFull": "Paramètres",

  // Réglages
  "settings.title": "Préférences de l'espace {space}",
  "settings.intro":
    "Cette page reste volontairement légère pour l'instant : elle sert de base aux réglages globaux comme le thème, la langue et les préférences générales.",
  "settings.theme": "Thème",
  "settings.theme.desc": "Clair, sombre ou automatique.",
  "settings.language": "Langue",
  "settings.language.desc": "Choisis la langue de l'interface.",
  "settings.agenda": "Agenda",
  "settings.agenda.desc": "La connexion calendrier sera centralisée ici plus tard.",
  "settings.prefs": "Préférences",
  "settings.prefs.desc": "Les réglages avancés pourront être pilotés depuis cet espace.",
  "settings.account": "Compte",
  "settings.account.desc": "Se déconnecter de ce compte sur cet appareil.",
  "settings.signout": "Se déconnecter",
};

const en: Dict = {
  // Navigation
  "nav.dashboard": "Dashboard",
  "nav.home": "Home",
  "nav.projects": "Projects",
  "nav.kanban": "Kanban",
  "nav.calendar": "Calendar",
  "nav.settings": "Settings",
  "nav.settingsFull": "Settings",

  // Settings
  "settings.title": "{space} space preferences",
  "settings.intro":
    "This page stays intentionally light for now: it's the base for global settings like theme, language and general preferences.",
  "settings.theme": "Theme",
  "settings.theme.desc": "Light, dark or automatic.",
  "settings.language": "Language",
  "settings.language.desc": "Choose the interface language.",
  "settings.agenda": "Calendar sync",
  "settings.agenda.desc": "Calendar connection will be centralized here later.",
  "settings.prefs": "Preferences",
  "settings.prefs.desc": "Advanced settings will be managed from this space.",
  "settings.account": "Account",
  "settings.account.desc": "Sign out of this account on this device.",
  "settings.signout": "Sign out",
};

export const MESSAGES: Record<Locale, Dict> = { fr, en };

// Interpole les variables {nom} dans une chaîne traduite.
export function interpolate(template: string, vars?: Record<string, string | number>): string {
  if (!vars) return template;
  return template.replace(/\{(\w+)\}/g, (_match, key: string) =>
    key in vars ? String(vars[key]) : `{${key}}`,
  );
}

export function translate(locale: Locale, key: string, vars?: Record<string, string | number>): string {
  const dict = MESSAGES[locale] ?? MESSAGES.fr;
  const template = dict[key] ?? MESSAGES.fr[key] ?? key;
  return interpolate(template, vars);
}
