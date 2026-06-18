import type { Workspace } from "@/lib/workspace";
import type { ProjectPriority, ProjectType } from "@/lib/project-taxonomy";

export type ProjectStatus = "preparing" | "active" | "paused" | "on-hold" | "completed" | "archived";
export type ProjectStatusMode = "auto" | "manual";

export interface Decision {
  id: string;
  title: string;
  rationale?: string;
  date: string;
  status: "decided" | "pending" | "revisiting";
}

export interface Risk {
  id: string;
  title: string;
  description?: string;
  severity: "high" | "medium" | "low";
  mitigation: string;
  status: "open" | "mitigated";
}

export interface Blocker {
  id: string;
  label: string;
  description: string;
  status: "open" | "resolved";
}

export interface Action {
  id: string;
  title: string;
  description?: string;
  owner: string;
  due: string;
  priority?: "high" | "medium" | "low";
  done: boolean;
  blocked?: boolean;
  /** Suggested step name used to group related actions into the same step */
  stepGroup?: string;
}

export type TaskStatus = "todo" | "in_progress" | "waiting" | "blocked" | "done";
export type StepStatus = "todo" | "in_progress" | "waiting" | "done";

export interface ChecklistItem {
  id: string;
  label: string;
  done: boolean;
}

export interface ProjectPerson {
  id: string;
  name: string;
  email?: string;
  role?: string;
  teamIds?: string[];
  createdAt: string;
}

export interface ProjectTeam {
  id: string;
  name: string;
  color?: string;
  memberIds?: string[];
  createdAt: string;
}

export interface TaskDiscussionMessage {
  id: string;
  authorName: string;
  authorPersonId?: string;
  content: string;
  createdAt: string;
}

export interface StatusCustomization<TSystemStatus extends string = string> {
  id?: string;
  systemStatus: TSystemStatus;
  label: string;
  color: string;
  enabled?: boolean;
}

export interface ProjectStatusSettings {
  task?: Partial<Record<TaskStatus, StatusCustomization<TaskStatus>>>;
  step?: Partial<Record<StepStatus, StatusCustomization<StepStatus>>>;
  project?: Partial<Record<ProjectStatus, StatusCustomization<ProjectStatus>>>;
  customTask?: Array<StatusCustomization<TaskStatus>>;
  customStep?: Array<StatusCustomization<StepStatus>>;
}

export interface Task {
  id: string;
  title: string;
  description?: string;
  done: boolean;
  status?: TaskStatus;
  priority?: ProjectPriority;
  order?: number;
  owner?: string;
  /** Multiple people working on the task (extends `owner` for collaborative tasks). */
  assignees?: string[];
  /** Teams linked to this task. Internal IDs keep team assignment reusable. */
  teamIds?: string[];
  dueDate?: string;
  dueTime?: string;
  blocked?: boolean;
  guidance?: string[];
  calendarUrl?: string;
  files?: ProjectFile[];
  discussion?: TaskDiscussionMessage[];
  source?: "manual" | "imported" | "legacy" | "ai";
  completedAt?: string;
  completionDetails?: string;
  completionDecisionId?: string;
  completionDecisionTitle?: string;
  completionSource?: "manual";
  /** What's expected as the outcome of the task. */
  expected?: string;
  /** What was actually achieved/done — fills as the task progresses. */
  realization?: string;
  /** Lightweight notes/comments kept with the task. */
  comments?: string[];
  /** Sub-tasks / acceptance criteria. */
  checklist?: ChecklistItem[];
  /** Note captured when status was changed via Kanban drag */
  statusNote?: string;
  /** ISO timestamp of last manual status change via Kanban */
  statusChangedAt?: string;
}

export interface Step {
  id: string;
  title: string;
  description?: string;
  /** Derived from tasks completion — stored for quick reads */
  status: StepStatus;
  order: number;
  priority?: ProjectPriority;
  teamIds?: string[];
  tasks: Task[];
}

export interface ProjectFile {
  id: string;
  name: string;
  ext: "pdf" | "doc" | "xls" | "img" | "link" | "other";
  size?: string;
  addedAt: string;
  url?: string;
  mimeType?: string;
  storagePath?: string;
  source?: "mock" | "upload" | "link" | "generated";
  generatedContent?: string;
  linkedTo?: "project" | "task";
  stepId?: string;
  stepTitle?: string;
  taskId?: string;
  taskTitle?: string;
}

export interface ProjectActivityItem {
  id: string;
  date: string;
  title: string;
  detail: string;
  tone?: "neutral" | "success" | "warning" | "danger";
}

export interface ProjectTeamMessage {
  id: string;
  authorName: string;
  authorPersonId?: string;
  content: string;
  createdAt: string;
}

export type ProjectMode = "custom" | "assisted";

export interface Project {
  id: string;
  workspace: Workspace;
  mode?: ProjectMode;
  name: string;
  description: string;
  objective: string;
  status: ProjectStatus;
  statusMode?: ProjectStatusMode;
  progress: number;
  context: string;
  currentPriority: string;
  nextStep: string;
  decisions: Decision[];
  risks: Risk[];
  blockers: Blocker[];
  actions: Action[];
  updatedAt: string;
  color: string;
  projectType: ProjectType;
  subcategory: string;
  subcategoryColor: string;
  priority: ProjectPriority;
  isCustomSubcategory: boolean;
  customSubcategoryLabel?: string;
  customSubcategoryColor?: string;
  templateKey?: string;
  files?: ProjectFile[];
  people?: ProjectPerson[];
  teams?: ProjectTeam[];
  teamMessages?: ProjectTeamMessage[];
  statusSettings?: ProjectStatusSettings;
  steps?: Step[];
  activity?: ProjectActivityItem[];
  deleted?: boolean;
  /** Nom du compte ayant créé le projet. Le créateur voit toutes les tâches
   *  (et peut filtrer par personne dans Kanban/Calendrier) ; les autres
   *  collaborateurs ne voient que les leurs. Optionnel pour compat avec les
   *  projets historiques (traités comme appartenant au lecteur courant). */
  createdBy?: string;
}

export const projects: Project[] = [
  {
    id: "p1",
    workspace: "professional",
    name: "Lancement Produit v2",
    description: "Lancement de la seconde version de la plateforme avec automatisations intégrées",
    objective: "Atteindre 500 utilisateurs actifs en 3 mois post-lancement",
    status: "active",
    progress: 65,
    color: "#6366F1",
    projectType: "execution",
    subcategory: "produit",
    subcategoryColor: "#6366F1",
    priority: "high",
    isCustomSubcategory: false,
    currentPriority: "Débloquer l'intégration analytics pour avoir de la visibilité dès le lancement",
    nextStep: "Créer les accès Mixpanel pour Lucas et finaliser la landing page avant le 28 avril",
    context:
      "La v2 introduit un moteur de structuration automatique des projets. L'équipe technique est prête. Le go-to-market est en cours de finalisation avec l'équipe marketing.",
    decisions: [
      { id: "d1", title: "Lancer en beta fermée d'abord", date: "2026-04-10", status: "decided", rationale: "Limiter les risques d'image et collecter du feedback tôt" },
      { id: "d2", title: "Intégrer GPT-4o ou Claude Sonnet ?", date: "2026-04-18", status: "pending" },
      { id: "d3", title: "Pricing : freemium vs trial 14j", date: "2026-04-15", status: "decided", rationale: "Le freemium maximise l'adoption initiale" },
    ],
    risks: [
      { id: "r1", title: "Délai API fournisseur externe", severity: "high", mitigation: "Contrat SLA négocié, solution de secours prévue", status: "open" },
      { id: "r2", title: "Adoption utilisateur lente", severity: "medium", mitigation: "Programme d'onboarding dédié", status: "open" },
    ],
    blockers: [
      { id: "b1", label: "Accès Mixpanel manquants", description: "Lucas ne peut pas avancer sur l'intégration analytics sans les credentials. Bloque la visibilité post-lancement.", status: "open" },
    ],
    actions: [
      { id: "a1", title: "Finaliser landing page v2", owner: "Maxime", due: "2026-04-28", done: false, priority: "high" },
      { id: "a2", title: "Rédiger email séquence beta", owner: "Sophie", due: "2026-04-25", done: true },
      { id: "a3", title: "Intégrer analytics Mixpanel", owner: "Lucas", due: "2026-04-30", done: false, blocked: true, priority: "high" },
      { id: "a4", title: "Préparer démo investisseurs", owner: "Maxime", due: "2026-05-05", done: false },
    ],
    updatedAt: "2026-04-22T14:30:00Z",
    files: [
      { id: "f1", name: "Roadmap v2.pdf", ext: "pdf", size: "1.2 Mo", addedAt: "2026-04-10" },
      { id: "f2", name: "Specs fonctionnelles.doc", ext: "doc", size: "540 Ko", addedAt: "2026-04-14" },
      { id: "f3", name: "KPIs lancement.xls", ext: "xls", size: "88 Ko", addedAt: "2026-04-18" },
    ],
    steps: [
      {
        id: "s1",
        title: "Cadrage & Stratégie",
        status: "done",
        order: 1,
        tasks: [
          { id: "t1", title: "Valider la stratégie freemium", done: true, owner: "Maxime" },
          { id: "t2", title: "Analyser 8 outils concurrents", done: true, owner: "Maxime" },
          { id: "t3", title: "Définir les 3 différenciateurs clés", done: true, owner: "Maxime" },
        ],
      },
      {
        id: "s2",
        title: "Développement & Intégration",
        status: "done",
        order: 2,
        tasks: [
          { id: "t4", title: "Finaliser le moteur de structuration", done: true, owner: "Lucas" },
          { id: "t5", title: "Tester les performances en beta", done: true, owner: "Lucas" },
          { id: "t6", title: "Corriger les bugs critiques signalés", done: true, owner: "Lucas" },
        ],
      },
      {
        id: "s3",
        title: "Lancement beta & Go-to-market",
        status: "in_progress",
        order: 3,
        tasks: [
          { id: "t7", title: "Rédiger la séquence email beta", done: true, owner: "Sophie" },
          { id: "t8", title: "Finaliser la landing page v2", done: false, owner: "Maxime", dueDate: "2026-04-28" },
          { id: "t9", title: "Intégrer analytics Mixpanel", done: false, owner: "Lucas", dueDate: "2026-04-30", blocked: true },
        ],
      },
      {
        id: "s4",
        title: "Communication & Investisseurs",
        status: "todo",
        order: 4,
        tasks: [
          { id: "t10", title: "Préparer la démo investisseurs", done: false, owner: "Maxime", dueDate: "2026-05-05" },
          { id: "t11", title: "Planifier le lancement Product Hunt", done: false, owner: "Maxime", dueDate: "2026-05-10" },
        ],
      },
    ],
  },
  {
    id: "p2",
    workspace: "professional",
    name: "Migration Infrastructure Cloud",
    description: "Migration de l'infra on-premise vers AWS avec Kubernetes",
    objective: "Réduire les coûts infra de 30% et améliorer la disponibilité à 99.9%",
    status: "active",
    progress: 40,
    color: "#34D399",
    projectType: "execution",
    subcategory: "operations",
    subcategoryColor: "#34D399",
    priority: "high",
    isCustomSubcategory: false,
    currentPriority: "Finaliser la migration du service d'authentification vers EKS",
    nextStep: "Planifier la fenêtre de maintenance pour la migration API (phase 2)",
    context:
      "Migration progressive des services clés. Phase 1 (base de données) terminée. Phase 2 (API) en cours. Phase 3 (frontend) planifiée pour mai.",
    decisions: [
      { id: "d4", title: "Choisir EKS vs ECS", date: "2026-03-20", status: "decided", rationale: "EKS pour la portabilité et la scalabilité à long terme" },
      { id: "d5", title: "Stratégie de backup multi-région", date: "2026-04-05", status: "decided" },
    ],
    risks: [
      { id: "r3", title: "Downtime lors de la migration API", severity: "high", mitigation: "Fenêtre de maintenance 3h en nuit", status: "open" },
      { id: "r4", title: "Dépassement budget AWS", severity: "medium", mitigation: "Alertes de coût configurées à 80%", status: "mitigated" },
    ],
    blockers: [],
    actions: [
      { id: "a5", title: "Migrer service auth vers EKS", owner: "Lucas", due: "2026-04-30", done: false, priority: "high" },
      { id: "a6", title: "Tester failover base de données", owner: "Lucas", due: "2026-04-26", done: true },
      { id: "a7", title: "Documenter architecture cible", owner: "Thomas", due: "2026-05-02", done: false },
    ],
    updatedAt: "2026-04-21T09:15:00Z",
  },
  {
    id: "p3",
    workspace: "professional",
    name: "Campagne Marketing Q2",
    description: "Campagne d'acquisition multi-canal pour le Q2 2026",
    objective: "Générer 1200 leads qualifiés sur avril-juin 2026",
    status: "on-hold",
    progress: 30,
    color: "#A855F7",
    projectType: "recurrent",
    subcategory: "marketing",
    subcategoryColor: "#A855F7",
    priority: "high",
    isCustomSubcategory: false,
    currentPriority: "Débloquer les visuels design pour relancer la production de contenu",
    nextStep: "Relancer l'équipe design sur les visuels LinkedIn, sans ça, la campagne ne peut pas démarrer",
    context:
      "En attente des visuels finaux de l'équipe design. Stratégie contenu validée. Budget alloué : 15k€. Canaux : LinkedIn, Google Ads, newsletter.",
    decisions: [
      { id: "d6", title: "Focus LinkedIn pour B2B", date: "2026-04-01", status: "decided" },
    ],
    risks: [
      { id: "r5", title: "Retard visuels design", severity: "medium", mitigation: "Relance hebdomadaire équipe design", status: "open" },
    ],
    blockers: [
      { id: "b2", label: "Visuels design non livrés", description: "L'équipe design n'a pas encore livré les visuels LinkedIn et bannières Google. Le projet est en pause jusqu'à leur validation.", status: "open" },
    ],
    actions: [
      { id: "a8", title: "Valider visuels LinkedIn", owner: "Sophie", due: "2026-04-27", done: false, blocked: true, priority: "high" },
      { id: "a9", title: "Configurer campagne Google Ads", owner: "Sophie", due: "2026-05-01", done: false },
    ],
    updatedAt: "2026-04-19T16:45:00Z",
  },
  {
    id: "p4",
    workspace: "professional",
    name: "Refonte Onboarding Client",
    description: "Simplifier le parcours d'activation des nouveaux utilisateurs",
    objective: "Atteindre un taux d'activation J7 de 60% (actuellement 38%)",
    status: "active",
    progress: 20,
    color: "#6366F1",
    projectType: "exploration",
    subcategory: "produit",
    subcategoryColor: "#6366F1",
    priority: "medium",
    isCustomSubcategory: false,
    currentPriority: "Comprendre les points de friction dans le funnel actuel avant de concevoir quoi que ce soit",
    nextStep: "Lancer l'analyse du funnel d'activation et planifier les interviews utilisateurs cette semaine",
    context:
      "Analyse des données d'usage en cours. Interviews utilisateurs planifiées. Objectif : réduire le time-to-value de 14j à 3j.",
    decisions: [],
    risks: [
      { id: "r6", title: "Ressources design insuffisantes", severity: "low", mitigation: "Utiliser Figma et des templates", status: "open" },
    ],
    blockers: [],
    actions: [
      { id: "a10", title: "Analyser funnel d'activation", owner: "Maxime", due: "2026-05-03", done: false, priority: "high" },
      { id: "a11", title: "Planifier 5 interviews utilisateurs", owner: "Sophie", due: "2026-04-30", done: false },
    ],
    updatedAt: "2026-04-17T11:00:00Z",
  },
  {
    id: "p5",
    workspace: "personal",
    name: "Coin bureau à la maison",
    description: "Réorganiser l'espace de travail pour le rendre plus calme, fonctionnel et agréable au quotidien",
    objective: "Avoir un bureau complet, rangé et ergonomique avant la mi-mai",
    status: "active",
    progress: 55,
    color: "#8B5CF6",
    projectType: "execution",
    subcategory: "maison",
    subcategoryColor: "#8B5CF6",
    priority: "high",
    isCustomSubcategory: false,
    currentPriority: "Finaliser le plan d'aménagement et verrouiller les achats vraiment utiles avant de commander",
    nextStep: "Choisir le bureau final, valider l'éclairage et bloquer un créneau montage ce week-end",
    context:
      "L'objectif est de mieux séparer le travail de la vie perso. L'espace actuel manque de rangements, de lumière et devient vite encombré quand les projets s'accumulent.",
    decisions: [
      { id: "d7", title: "Garder une palette claire et chaude", date: "2026-04-18", status: "decided", rationale: "Plus apaisant pour travailler plusieurs heures par jour" },
      { id: "d8", title: "Acheter un bureau assis-debout ou non", date: "2026-04-22", status: "pending" },
    ],
    risks: [
      { id: "r7", title: "Budget déco qui dérape", severity: "medium", mitigation: "Limiter les achats à 3 pièces structurantes", status: "open" },
    ],
    blockers: [
      { id: "b3", label: "Lampe de bureau pas choisie", description: "Sans un bon éclairage, l'installation restera inconfortable en fin de journée.", status: "open" },
    ],
    actions: [
      { id: "a12", title: "Comparer 3 modèles de bureau", owner: "Maxime", due: "2026-04-26", done: true },
      { id: "a13", title: "Choisir la lampe et la température de lumière", owner: "Maxime", due: "2026-04-27", done: false, priority: "high" },
      { id: "a14", title: "Commander les rangements muraux", owner: "Maxime", due: "2026-04-29", done: false },
    ],
    updatedAt: "2026-04-23T18:20:00Z",
    steps: [
      {
        id: "s5",
        title: "Plan & Choix",
        status: "done",
        order: 1,
        tasks: [
          { id: "t20", title: "Comparer 3 modèles de bureau", done: true, owner: "Maxime" },
          { id: "t21", title: "Définir la palette de couleurs", done: true, owner: "Maxime" },
          { id: "t22", title: "Mesurer l'espace disponible", done: true, owner: "Maxime" },
        ],
      },
      {
        id: "s6",
        title: "Achats",
        status: "in_progress",
        order: 2,
        tasks: [
          { id: "t23", title: "Commander le bureau principal", done: true, owner: "Maxime" },
          { id: "t24", title: "Choisir la lampe et la température de lumière", done: false, owner: "Maxime", dueDate: "2026-04-27", blocked: true },
          { id: "t25", title: "Commander les rangements muraux", done: false, owner: "Maxime", dueDate: "2026-04-29" },
        ],
      },
      {
        id: "s7",
        title: "Installation",
        status: "todo",
        order: 3,
        tasks: [
          { id: "t26", title: "Monter le bureau et câbler", done: false, owner: "Maxime" },
          { id: "t27", title: "Poser les rangements muraux", done: false, owner: "Maxime" },
        ],
      },
    ],
  },
  {
    id: "p6",
    workspace: "personal",
    name: "Routine énergie printemps",
    description: "Reprendre une routine simple de sport, sommeil et récupération pour retrouver de l'élan",
    objective: "Tenir 4 semaines avec 3 séances de sport par semaine et un sommeil plus régulier",
    status: "active",
    progress: 45,
    color: "#FB7185",
    projectType: "recurrent",
    subcategory: "sante",
    subcategoryColor: "#FB7185",
    priority: "medium",
    isCustomSubcategory: false,
    currentPriority: "Stabiliser l'heure de coucher avant d'ajouter plus d'intensité dans les séances",
    nextStep: "Préparer les créneaux sport de la semaine et poser une heure de fin d'écran fixe",
    context:
      "La motivation est bonne mais la fatigue fait décrocher la routine après quelques jours. Le but est d'avoir un système léger, pas une transformation radicale.",
    decisions: [
      { id: "d9", title: "Privilégier des séances courtes de 30 minutes", date: "2026-04-17", status: "decided", rationale: "Plus réaliste à maintenir dans un agenda chargé" },
    ],
    risks: [
      { id: "r8", title: "Reprise trop ambitieuse", severity: "low", mitigation: "Monter progressivement la charge", status: "open" },
    ],
    blockers: [],
    actions: [
      { id: "a15", title: "Bloquer 3 créneaux sport dans la semaine", owner: "Maxime", due: "2026-04-25", done: true },
      { id: "a16", title: "Préparer une routine du soir simple", owner: "Maxime", due: "2026-04-26", done: false },
      { id: "a17", title: "Suivre le sommeil pendant 10 jours", owner: "Maxime", due: "2026-05-04", done: false },
    ],
    updatedAt: "2026-04-22T21:10:00Z",
  },
  {
    id: "p7",
    workspace: "personal",
    name: "Budget été 2026",
    description: "Préparer le budget des vacances et des grosses dépenses perso des prochains mois",
    objective: "Avoir un budget clair et réaliste avant les réservations de mai",
    status: "active",
    progress: 20,
    color: "#10B981",
    projectType: "decision",
    subcategory: "finances",
    subcategoryColor: "#10B981",
    priority: "high",
    isCustomSubcategory: false,
    currentPriority: "Arbitrer entre confort, marge de sécurité et plaisir sans mettre sous tension les prochains mois",
    nextStep: "Lister toutes les dépenses fixes, estimer le budget vacances et choisir une enveloppe cible",
    context:
      "Il y a plusieurs envies pour l'été, mais aussi quelques dépenses maison à anticiper. Le sujet est autant émotionnel que rationnel.",
    decisions: [
      { id: "d10", title: "Garder une enveloppe sécurité dédiée", date: "2026-04-21", status: "decided", rationale: "Évite de tout aspirer dans le budget vacances" },
      { id: "d11", title: "Partir 10 jours ou fractionner en 2 escapades", date: "2026-04-23", status: "pending" },
    ],
    risks: [
      { id: "r9", title: "Sous-estimer les dépenses annexes", severity: "medium", mitigation: "Ajouter 15% de marge sur les postes variables", status: "open" },
    ],
    blockers: [],
    actions: [
      { id: "a18", title: "Exporter les dépenses des 3 derniers mois", owner: "Maxime", due: "2026-04-26", done: false, priority: "high" },
      { id: "a19", title: "Comparer 2 scénarios vacances", owner: "Maxime", due: "2026-04-28", done: false },
    ],
    updatedAt: "2026-04-24T08:40:00Z",
  },
  {
    id: "p8",
    workspace: "personal",
    name: "Série photo Lisbonne",
    description: "Construire une petite série photo cohérente autour de la lumière, des façades et des détails de rue",
    objective: "Revenir avec une direction visuelle claire et une première sélection éditée",
    status: "active",
    progress: 15,
    color: "#C084FC",
    projectType: "exploration",
    subcategory: "creatif",
    subcategoryColor: "#C084FC",
    priority: "medium",
    isCustomSubcategory: false,
    currentPriority: "Clarifier l'intention artistique avant de penser matériel ou publication",
    nextStep: "Constituer un mini moodboard de références et définir 3 axes de prise de vue",
    context:
      "Le projet est personnel mais pourrait nourrir une future série éditoriale. L'enjeu est de rester léger, exploratoire et joyeux sans se perdre dans la technique.",
    decisions: [],
    risks: [
      { id: "r10", title: "Partir sans angle créatif précis", severity: "low", mitigation: "Préparer 3 intentions simples à l'avance", status: "open" },
    ],
    blockers: [],
    actions: [
      { id: "a20", title: "Assembler 12 références visuelles", owner: "Maxime", due: "2026-04-29", done: false },
      { id: "a21", title: "Faire une sortie test en ville", owner: "Maxime", due: "2026-05-02", done: false },
    ],
    updatedAt: "2026-04-23T09:00:00Z",
  },
];

export function getProject(id: string): Project | undefined {
  return projects.find((p) => p.id === id);
}

export const statusLabels: Record<ProjectStatus, string> = {
  preparing: "À préparer",
  active: "En cours",
  paused: "En pause",
  archived: "Archivé",
  "on-hold": "En pause",
  completed: "Terminé",
};
