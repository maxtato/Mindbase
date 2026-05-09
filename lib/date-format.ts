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

function parseDateValue(value: string) {
  const normalizedDate = /^\d{4}-\d{2}-\d{2}$/.test(value) ? `${value}T12:00:00` : value;
  const date = new Date(normalizedDate);
  if (Number.isNaN(date.getTime())) return null;
  return date;
}
