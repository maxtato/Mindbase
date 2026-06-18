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

  // Commun
  "common.newProject": "Nouveau projet",
  "common.all": "Tous",
  "common.allF": "Toutes",

  // Dashboard
  "dashboard.kpi.projects": "Projets",
  "dashboard.kpi.openTasks": "Tâches ouvertes",
  "dashboard.kpi.overdue": "En retard",
  "dashboard.kpi.empty.projects": "Aucun projet ouvert.",
  "dashboard.kpi.empty.openTasks": "Aucune tâche ouverte.",
  "dashboard.kpi.empty.overdue": "Aucune tâche en retard.",
  "dashboard.card.distribution": "Répartition des tâches",
  "dashboard.card.activity": "Activité récente",
  "dashboard.overdueTag": "En retard",

  // Projets (liste)
  "projects.countOne": "{count} projet",
  "projects.countOther": "{count} projets",
  "projects.activeSuffix": "{count} en cours",
  "projects.archivedSuffix": "archivés",
  "projects.empty.title": "Aucun projet dans cette catégorie",
  "projects.empty.hint": "Créez un projet dans cet espace ou changez le filtre.",
  "projects.tasksCount": "{count} tâches",
  "filter.environment": "Environnement",
  "filter.status": "Statut",
  "filter.priority": "Priorité",
  "filter.status.all": "Tous",
  "filter.status.preparing": "À préparer",
  "filter.status.active": "En cours",
  "filter.status.paused": "En pause",
  "filter.status.completed": "Terminé",
  "filter.status.archived": "Archivé",
  "filter.priority.all": "Toutes",
  "filter.priority.high": "Haute",
  "filter.priority.medium": "Moyenne",
  "filter.priority.low": "Basse",
  "card.blocked": "Blocage",
  "card.overdue": "Échéance en retard",
  "card.inactive": "Inactif",
  "card.atRisk": "À risque",
  "card.decisionsOne": "{count} décision en attente",
  "card.decisionsOther": "{count} décisions en attente",
  "card.dueSoonOne": "{count} proche",
  "card.dueSoonOther": "{count} proches",

  // Vues Kanban / Calendrier
  "board.empty.title": "Aucune tâche dans ce périmètre",
  "board.empty.kanban": "Élargis le filtre projet ou étape pour voir des tâches.",
  "board.empty.calendar": "Élargis le filtre projet ou étape pour voir des échéances.",
  "filter.project": "Projet",
  "filter.step": "Étape",
  "filter.person": "Personne",
  "filter.tasks": "Tâches",
  "filter.project.all": "Tous",
  "filter.step.all": "Toutes",
  "filter.person.all": "Toutes",
  "filter.person.me": "Moi",
  "filter.taskStatus.open": "Ouvertes",
  "filter.taskStatus.todo": "À faire",
  "filter.taskStatus.inProgress": "En cours",
  "filter.taskStatus.waiting": "En attente",
  "filter.taskStatus.blocked": "Bloquées",
  "filter.taskStatus.done": "Terminées",
  "filter.taskStatus.all": "Toutes",
  "filter.owner.all": "Toutes",
  "filter.owner.mine": "Mes tâches",
  "calendar.prevMonth": "Mois précédent",
  "calendar.nextMonth": "Mois suivant",

  // Détail projet (rail de synthèse)
  "project.synthesis": "Synthèse",
  "project.objective": "Objectif",
  "project.summary": "Résumé du projet",
  "project.currentState": "État actuel",
  "project.risks": "Risques identifiés",
  "project.nextActions": "Prochaines actions",
  "project.progress": "Avancement",
  "project.seeMoreOne": "Voir {count} autre",
  "project.seeMoreOther": "Voir {count} autres",

  // Étapes & tâches
  "steps.firstTask": "Ajoutez une première tâche pour commencer le pilotage.",
  "steps.tasksDone": "{done} / {total} tâches terminées",
  "steps.overdue": "{count} en retard",
  "steps.dueSoonOne": "{count} échéance proche",
  "steps.dueSoonOther": "{count} échéances proches",
  "steps.empty.title": "Aucune étape définie",
  "steps.empty.hint": "Ajoute une étape manuellement pour structurer le projet.",
  "steps.taskCountOne": "{count} tâche",
  "steps.taskCountOther": "{count} tâches",
  "steps.noTask": "Aucune tâche dans cette étape, utilise le bouton ci-dessous pour en ajouter.",
  "steps.addTask": "Ajouter une tâche",
  "steps.addStep": "Ajouter une étape",
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

  // Common
  "common.newProject": "New project",
  "common.all": "All",
  "common.allF": "All",

  // Dashboard
  "dashboard.kpi.projects": "Projects",
  "dashboard.kpi.openTasks": "Open tasks",
  "dashboard.kpi.overdue": "Overdue",
  "dashboard.kpi.empty.projects": "No open project.",
  "dashboard.kpi.empty.openTasks": "No open task.",
  "dashboard.kpi.empty.overdue": "No overdue task.",
  "dashboard.card.distribution": "Task distribution",
  "dashboard.card.activity": "Recent activity",
  "dashboard.overdueTag": "Overdue",

  // Projects (list)
  "projects.countOne": "{count} project",
  "projects.countOther": "{count} projects",
  "projects.activeSuffix": "{count} in progress",
  "projects.archivedSuffix": "archived",
  "projects.empty.title": "No project in this category",
  "projects.empty.hint": "Create a project in this space or change the filter.",
  "projects.tasksCount": "{count} tasks",
  "filter.environment": "Environment",
  "filter.status": "Status",
  "filter.priority": "Priority",
  "filter.status.all": "All",
  "filter.status.preparing": "To prepare",
  "filter.status.active": "In progress",
  "filter.status.paused": "Paused",
  "filter.status.completed": "Completed",
  "filter.status.archived": "Archived",
  "filter.priority.all": "All",
  "filter.priority.high": "High",
  "filter.priority.medium": "Medium",
  "filter.priority.low": "Low",
  "card.blocked": "Blocked",
  "card.overdue": "Overdue",
  "card.inactive": "Inactive",
  "card.atRisk": "At risk",
  "card.decisionsOne": "{count} pending decision",
  "card.decisionsOther": "{count} pending decisions",
  "card.dueSoonOne": "{count} due soon",
  "card.dueSoonOther": "{count} due soon",

  // Kanban / Calendar views
  "board.empty.title": "No task in this scope",
  "board.empty.kanban": "Widen the project or step filter to see tasks.",
  "board.empty.calendar": "Widen the project or step filter to see due dates.",
  "filter.project": "Project",
  "filter.step": "Step",
  "filter.person": "Person",
  "filter.tasks": "Tasks",
  "filter.project.all": "All",
  "filter.step.all": "All",
  "filter.person.all": "All",
  "filter.person.me": "Me",
  "filter.taskStatus.open": "Open",
  "filter.taskStatus.todo": "To do",
  "filter.taskStatus.inProgress": "In progress",
  "filter.taskStatus.waiting": "Waiting",
  "filter.taskStatus.blocked": "Blocked",
  "filter.taskStatus.done": "Done",
  "filter.taskStatus.all": "All",
  "filter.owner.all": "All",
  "filter.owner.mine": "My tasks",
  "calendar.prevMonth": "Previous month",
  "calendar.nextMonth": "Next month",

  // Project detail (synthesis rail)
  "project.synthesis": "Synthesis",
  "project.objective": "Objective",
  "project.summary": "Project summary",
  "project.currentState": "Current state",
  "project.risks": "Identified risks",
  "project.nextActions": "Next actions",
  "project.progress": "Progress",
  "project.seeMoreOne": "See {count} more",
  "project.seeMoreOther": "See {count} more",

  // Steps & tasks
  "steps.firstTask": "Add a first task to start managing.",
  "steps.tasksDone": "{done} / {total} tasks done",
  "steps.overdue": "{count} overdue",
  "steps.dueSoonOne": "{count} due soon",
  "steps.dueSoonOther": "{count} due soon",
  "steps.empty.title": "No step defined",
  "steps.empty.hint": "Add a step manually to structure the project.",
  "steps.taskCountOne": "{count} task",
  "steps.taskCountOther": "{count} tasks",
  "steps.noTask": "No task in this step, use the button below to add one.",
  "steps.addTask": "Add a task",
  "steps.addStep": "Add a step",
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
