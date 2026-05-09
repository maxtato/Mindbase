export function isDefaultTaskOwner(owner: string | undefined) {
  if (!owner) return false;

  const normalized = owner
    .toLocaleLowerCase("fr-FR")
    .normalize("NFD")
    .replace(/\p{Diacritic}/gu, "")
    .replace(/[^\p{Letter}\p{Number}]+/gu, " ")
    .trim();

  return normalized === "maxime";
}

export function getVisibleTaskOwner(owner: string | undefined) {
  const cleaned = owner?.trim();
  if (!cleaned || isDefaultTaskOwner(cleaned)) return undefined;
  return cleaned;
}
