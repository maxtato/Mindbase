import { getLocale } from "@/lib/i18n/server";

// Directive de langue ajoutée aux prompts système de l'IA : force le modèle à
// répondre dans la langue choisie par l'utilisateur (cookie). Lue côté serveur
// au moment de l'appel (les fonctions IA tournent dans des server actions).
export async function aiLocaleDirective(): Promise<string> {
  const locale = await getLocale();
  if (locale === "en") {
    return "\n\nIMPORTANT: Always respond in English. Every piece of generated text (titles, steps, tasks, expected outcomes, checklists, summaries, questions, replies) must be written in English.";
  }
  return "\n\nIMPORTANT : réponds toujours en français. Tout le texte généré (titres, étapes, tâches, attendus, checklists, résumés, questions, réponses) doit être rédigé en français.";
}
