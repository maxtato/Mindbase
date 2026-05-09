export function getDisplayStepTitle(title: string) {
  return title
    .replace(/^Étape\s*\d+\s*[,.:—–-]\s*/i, "")
    .trim();
}
