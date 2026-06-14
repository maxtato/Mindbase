// Calculs de dates ancrés sur le fuseau de l'utilisateur (Europe/Paris) plutôt
// que sur l'UTC du serveur (Vercel). Sans ça, « aujourd'hui / en retard /
// échéance » se décalaient autour de minuit. On compare des clés AAAA-MM-JJ
// (insensibles au fuseau) calculées DANS le fuseau cible.

const TZ = "Europe/Paris";
const DAY_MS = 86_400_000;

const dateKeyFormatter = new Intl.DateTimeFormat("en-CA", {
  timeZone: TZ,
  year: "numeric",
  month: "2-digit",
  day: "2-digit",
});

const timeKeyFormatter = new Intl.DateTimeFormat("en-GB", {
  timeZone: TZ,
  hour: "2-digit",
  minute: "2-digit",
  hour12: false,
});

/** Clé AAAA-MM-JJ du jour courant dans le fuseau cible. */
export function todayKey(now: Date = new Date()): string {
  return dateKeyFormatter.format(now);
}

/** Heure « HH:MM » courante dans le fuseau cible (comparable en chaîne). */
export function nowTimeKey(now: Date = new Date()): string {
  return timeKeyFormatter.format(now);
}

function keyToUtcMidnight(key: string): number {
  return Date.parse(`${key}T00:00:00Z`);
}

/** Nombre de jours entiers entre aujourd'hui et une échéance AAAA-MM-JJ
 *  (négatif = passé, 0 = aujourd'hui, 1 = demain…). */
export function daysFromToday(dueKey: string, now: Date = new Date()): number {
  return Math.round((keyToUtcMidnight(dueKey) - keyToUtcMidnight(todayKey(now))) / DAY_MS);
}
