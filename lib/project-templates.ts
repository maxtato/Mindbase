import type { Workspace } from "@/lib/workspace";
import type { ProjectCategoryIconKey, ProjectPriority, ProjectType } from "@/lib/project-taxonomy";

export interface ProjectTemplateTaskBlueprint {
  title: string;
  description?: string;
  owner?: string;
  priority?: ProjectPriority;
  dueOffsetDays?: number;
  guidance?: string[];
}

export interface ProjectTemplateStepBlueprint {
  title: string;
  description?: string;
  priority?: ProjectPriority;
  tasks: ProjectTemplateTaskBlueprint[];
}

export interface ProjectTemplateDefinition {
  key: string;
  workspace: Workspace;
  label: string;
  description: string;
  helper: string;
  icon: ProjectCategoryIconKey;
  suggestedName: string;
  projectType: ProjectType;
  subcategory: string;
  priority: ProjectPriority;
  objective: string;
  context: string;
  currentPriority: string;
  nextStep: string;
  steps: ProjectTemplateStepBlueprint[];
}

const PROJECT_TEMPLATES: ProjectTemplateDefinition[] = [
  {
    key: "product-launch",
    workspace: "professional",
    label: "Lancement produit",
    description: "Cadrer, préparer et lancer une offre ou une nouvelle version.",
    helper: "Parfait pour articuler réflexion produit, marketing et exécution terrain.",
    icon: "layers",
    suggestedName: "Lancement produit",
    projectType: "execution",
    subcategory: "produit",
    priority: "high",
    objective: "Aligner l'équipe, sécuriser les livrables critiques et lancer avec des signaux clairs.",
    context: "Le projet implique plusieurs parties prenantes, des dépendances transverses et une forte exigence de lisibilité.",
    currentPriority: "Clarifier les livrables bloquants et sécuriser la fenêtre de lancement.",
    nextStep: "Lister les étapes de cadrage, de préparation et de lancement puis définir les tâches critiques.",
    steps: [
      {
        title: "Cadrage",
        description: "Définir l'objectif réel du lancement, la cible et les critères de réussite.",
        priority: "high",
        tasks: [
          { title: "Formuler la promesse du lancement", priority: "high", dueOffsetDays: 2 },
          { title: "Définir les KPIs de succès", priority: "medium", dueOffsetDays: 3 },
          { title: "Identifier les dépendances bloquantes", priority: "high", dueOffsetDays: 3, guidance: ["Repérer les validations externes et les assets manquants."] },
        ],
      },
      {
        title: "Préparation",
        description: "Structurer les livrables, les contenus et le plan d'activation.",
        priority: "medium",
        tasks: [
          { title: "Préparer le plan de communication", priority: "medium", dueOffsetDays: 6 },
          { title: "Sécuriser les assets de lancement", priority: "high", dueOffsetDays: 7 },
          { title: "Relire le parcours utilisateur final", priority: "medium", dueOffsetDays: 8 },
        ],
      },
      {
        title: "Lancement & suivi",
        description: "Suivre les signaux terrain, les décisions et les ajustements post-lancement.",
        priority: "medium",
        tasks: [
          { title: "Planifier le suivi J+1 / J+7", priority: "medium", dueOffsetDays: 10 },
          { title: "Préparer la boucle de feedback", priority: "medium", dueOffsetDays: 11 },
        ],
      },
    ],
  },
  {
    key: "strategic-decision",
    workspace: "professional",
    label: "Décision stratégique",
    description: "Explorer, comparer puis décider sans perdre le fil de la réflexion.",
    helper: "Très utile pour transformer des options floues en décision structurée.",
    icon: "target",
    suggestedName: "Décision stratégique",
    projectType: "decision",
    subcategory: "strategie",
    priority: "high",
    objective: "Réduire l'incertitude, clarifier les scénarios et aboutir à une décision exploitable.",
    context: "Le projet doit garder trace des hypothèses, des arbitrages et des critères de décision.",
    currentPriority: "Organiser les options, les critères et les risques avant toute décision finale.",
    nextStep: "Faire émerger 2 à 3 scénarios comparables et cadrer les critères d'arbitrage.",
    steps: [
      {
        title: "Explorer les options",
        description: "Poser les scénarios crédibles et les hypothèses associées.",
        priority: "high",
        tasks: [
          { title: "Lister les scénarios possibles", priority: "high", dueOffsetDays: 2 },
          { title: "Identifier les hypothèses clés", priority: "medium", dueOffsetDays: 3 },
        ],
      },
      {
        title: "Comparer",
        description: "Évaluer coûts, risques, impacts et réversibilité.",
        priority: "medium",
        tasks: [
          { title: "Comparer les impacts attendus", priority: "medium", dueOffsetDays: 5 },
          { title: "Qualifier les risques majeurs", priority: "high", dueOffsetDays: 6 },
        ],
      },
      {
        title: "Décider & formaliser",
        description: "Arrêter une direction et la transformer en suite de tâches.",
        priority: "medium",
        tasks: [
          { title: "Formuler la décision retenue", priority: "high", dueOffsetDays: 8 },
          { title: "Définir les 3 premières tâches", priority: "medium", dueOffsetDays: 9 },
        ],
      },
    ],
  },
  {
    key: "profitability-study",
    workspace: "professional",
    label: "Étude de rentabilité",
    description: "Mesurer viabilité, hypothèses économiques et seuils de décision.",
    helper: "Adapté aux projets qui doivent synthétiser chiffres, risques et arbitrages.",
    icon: "wallet",
    suggestedName: "Étude de rentabilité",
    projectType: "exploration",
    subcategory: "finance",
    priority: "medium",
    objective: "Valider si l'opportunité mérite d'être poursuivie, ajustée ou abandonnée.",
    context: "L'important est d'objectiver les hypothèses, les coûts et les marges avant de s'engager.",
    currentPriority: "Poser les hypothèses économiques et identifier les données manquantes.",
    nextStep: "Rassembler les coûts, revenus potentiels et scénarios pessimiste / réaliste / ambitieux.",
    steps: [
      {
        title: "Hypothèses de base",
        description: "Clarifier les variables qui pilotent la rentabilité.",
        priority: "medium",
        tasks: [
          { title: "Lister les postes de coûts", dueOffsetDays: 2 },
          { title: "Définir les hypothèses de revenus", dueOffsetDays: 3, priority: "high" },
        ],
      },
      {
        title: "Scénarios",
        description: "Construire plusieurs lectures chiffrées de la viabilité.",
        priority: "medium",
        tasks: [
          { title: "Monter les scénarios de rentabilité", dueOffsetDays: 5 },
          { title: "Identifier le seuil de bascule", dueOffsetDays: 6 },
        ],
      },
      {
        title: "Décision",
        description: "Conclure et recommander une direction.",
        priority: "medium",
        tasks: [
          { title: "Synthétiser les conclusions", dueOffsetDays: 8, priority: "high" },
          { title: "Préparer la recommandation finale", dueOffsetDays: 9 },
        ],
      },
    ],
  },
  {
    key: "creative-project",
    workspace: "personal",
    label: "Projet créatif",
    description: "Faire émerger une idée, la structurer et la faire avancer sans rigidité excessive.",
    helper: "Aide à transformer une intention créative en étapes concrètes sans casser l'élan.",
    icon: "palette",
    suggestedName: "Projet créatif",
    projectType: "exploration",
    subcategory: "creatif",
    priority: "medium",
    objective: "Clarifier une intention créative puis la transformer en production régulière.",
    context: "Le projet doit rester inspirant tout en donnant des repères concrets à suivre dans le temps.",
    currentPriority: "Passer de l'envie à une structure légère mais actionnable.",
    nextStep: "Définir l'intention, le format et la première série de livrables.",
    steps: [
      {
        title: "Intention",
        description: "Nommer le thème, le ton et la direction du projet.",
        priority: "medium",
        tasks: [
          { title: "Décrire l'intention créative", dueOffsetDays: 2 },
          { title: "Choisir un format de départ", dueOffsetDays: 3 },
        ],
      },
      {
        title: "Production",
        description: "Créer les premiers livrables et installer un rythme réaliste.",
        priority: "medium",
        tasks: [
          { title: "Produire un premier brouillon", dueOffsetDays: 5, priority: "high" },
          { title: "Définir le prochain créneau de travail", dueOffsetDays: 6 },
        ],
      },
      {
        title: "Itération",
        description: "Réviser, améliorer et documenter les apprentissages.",
        priority: "low",
        tasks: [
          { title: "Relire avec un regard critique", dueOffsetDays: 8 },
          { title: "Lister 3 pistes d'amélioration", dueOffsetDays: 9 },
        ],
      },
    ],
  },
  {
    key: "personal-routine",
    workspace: "personal",
    label: "Projet personnel",
    description: "Avancer sur un sujet perso important avec un cadre simple et motivant.",
    helper: "Utile pour maison, santé, organisation perso ou tout projet de fond à faire vivre.",
    icon: "house",
    suggestedName: "Projet personnel",
    projectType: "execution",
    subcategory: "maison",
    priority: "medium",
    objective: "Faire avancer un sujet personnel important sans le laisser retomber.",
    context: "Le projet doit aider à garder une direction claire, peu de friction et une exécution régulière.",
    currentPriority: "Transformer le sujet en quelques étapes simples et visibles.",
    nextStep: "Définir le résultat attendu puis les 3 premières tâches réalistes.",
    steps: [
      {
        title: "Clarifier",
        description: "Poser le résultat attendu et les contraintes concrètes.",
        priority: "medium",
        tasks: [
          { title: "Décrire le résultat concret recherché", dueOffsetDays: 2 },
          { title: "Identifier les contraintes du quotidien", dueOffsetDays: 3 },
        ],
      },
      {
        title: "Mettre en mouvement",
        description: "Créer un premier momentum d'exécution.",
        priority: "medium",
        tasks: [
          { title: "Planifier une première tâche simple", dueOffsetDays: 4, priority: "high" },
          { title: "Préparer le matériel ou les ressources utiles", dueOffsetDays: 5 },
        ],
      },
      {
        title: "Suivre",
        description: "Installer une logique de revue et d'ajustement.",
        priority: "low",
        tasks: [
          { title: "Prévoir un point de revue", dueOffsetDays: 8 },
          { title: "Noter ce qui bloque ou aide vraiment", dueOffsetDays: 9 },
        ],
      },
    ],
  },
];

export function getProjectTemplatesForWorkspace(workspace: Workspace) {
  return PROJECT_TEMPLATES.filter((template) => template.workspace === workspace);
}

/** Tous les modèles (pour la galerie de création). */
export function getAllProjectTemplates(): ProjectTemplateDefinition[] {
  return PROJECT_TEMPLATES;
}

export function getProjectTemplateByKey(templateKey: string | undefined | null) {
  if (!templateKey) return undefined;
  return PROJECT_TEMPLATES.find((template) => template.key === templateKey);
}
