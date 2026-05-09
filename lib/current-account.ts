import type { ProjectPerson } from "@/lib/mock-data";

export const ACTIVE_ACCOUNT_NAME = "Maxime T.";

function normalizeName(value: string) {
  return value
    .trim()
    .toLocaleLowerCase("fr-FR")
    .replace(/\s+/g, " ");
}

export function getActiveAccountName() {
  return ACTIVE_ACCOUNT_NAME;
}

export function getActiveAccountPersonId(people: ProjectPerson[] = []) {
  const activeName = normalizeName(ACTIVE_ACCOUNT_NAME);
  const activeFirstName = activeName.split(" ")[0];

  return people.find((person) => {
    const personName = normalizeName(person.name);
    return personName === activeName || personName.split(" ")[0] === activeFirstName;
  })?.id;
}
