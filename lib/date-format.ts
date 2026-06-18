export function formatShortDate(value: string | Date | undefined) {
  if (!value) return "";
  const date = value instanceof Date ? value : parseDateValue(value);
  if (!date) return typeof value === "string" ? value : "";
  return new Intl.DateTimeFormat("fr-FR", {
    day: "2-digit",
    month: "2-digit",
    year: "numeric",
  }).format(date);
}

export function formatShortDateTime(value: string | Date | undefined) {
  if (!value) return "";
  const date = value instanceof Date ? value : new Date(value);
  if (Number.isNaN(date.getTime())) return typeof value === "string" ? value : "";
  return `${formatShortDate(date)} · ${new Intl.DateTimeFormat("fr-FR", {
    hour: "2-digit",
    minute: "2-digit",
  }).format(date)}`;
}

export function formatTaskScheduleDate(dueDate: string | undefined, dueTime?: string) {
  if (!dueDate) return "";
  const formatted = formatShortDate(dueDate);
  return dueTime ? `${formatted} · ${dueTime}` : formatted;
}

type RelativeTranslate = (key: string, vars?: Record<string, string | number>) => string;

const RELATIVE_FALLBACK: Record<string, string> = {
  "activity.rel.now": "à l'instant",
  "activity.rel.min": "il y a {count} min",
  "activity.rel.hour": "il y a {count} h",
  "activity.rel.day": "il y a {count} j",
};

// Horodatage relatif (« il y a 5 min », « hier »…). Au-delà de 7 jours on
// retombe sur la date courte. La fonction de traduction est optionnelle :
// fournie, elle gère fr/en via les clés `activity.rel.*` ; sinon repli français.
export function formatRelativeTime(value: string | Date | undefined, t?: RelativeTranslate): string {
  if (!value) return "";
  const date = value instanceof Date ? value : parseDateValue(value);
  if (!date) return typeof value === "string" ? value : "";
  const translate: RelativeTranslate = (key, vars) =>
    t ? t(key, vars) : applyVars(RELATIVE_FALLBACK[key] ?? "", vars);
  const minutes = Math.floor((Date.now() - date.getTime()) / 60000);
  if (minutes < 1) return translate("activity.rel.now");
  if (minutes < 60) return translate("activity.rel.min", { count: minutes });
  const hours = Math.floor(minutes / 60);
  if (hours < 24) return translate("activity.rel.hour", { count: hours });
  const days = Math.floor(hours / 24);
  if (days < 7) return translate("activity.rel.day", { count: days });
  return formatShortDate(date);
}

function applyVars(template: string, vars?: Record<string, string | number>) {
  if (!vars) return template;
  return template.replace(/\{(\w+)\}/g, (_, key) => String(vars[key] ?? ""));
}

function parseDateValue(value: string) {
  const normalizedDate = /^\d{4}-\d{2}-\d{2}$/.test(value) ? `${value}T12:00:00` : value;
  const date = new Date(normalizedDate);
  if (Number.isNaN(date.getTime())) return null;
  return date;
}
