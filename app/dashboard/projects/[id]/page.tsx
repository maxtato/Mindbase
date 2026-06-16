import type { ReactNode } from "react";
import { notFound } from "next/navigation";
import { severityLabels } from "@/components/ui/badge";
import { ProgressBar } from "@/components/ui/progress-bar";
import { getProjectById } from "@/lib/project-store";
import { getActiveTeamMemberNames } from "@/lib/team-store";
import { formatShortDate } from "@/lib/date-format";
import { getWorkspace, workspaceTheme } from "@/lib/workspace";
import { syncEnvironmentThemes } from "@/lib/environment-store";
import { surface, text, severity } from "@/lib/design-tokens";
import { ProjectIdentityEditor } from "@/components/projects/project-identity-editor";
import { AISynthesisButton } from "@/components/projects/ai-synthesis-button";
import { ProjectEvolutionLauncher } from "@/components/projects/project-evolution-launcher";
import { ProjectCollaborationLauncher } from "@/components/projects/project-collaboration-launcher";
import { ProjectControls, ProjectSettingsMenu } from "@/components/projects/project-controls";
import { ProjectFilesLauncher } from "@/components/projects/project-files-launcher";
import { ProjectTeamChatLauncher } from "@/components/projects/project-team-chat-launcher";
import { ProjectMultiView } from "@/components/projects/project-multi-view";
import { ProjectRailDetails } from "@/components/projects/project-rail-details";
import { ExpandableText } from "@/components/projects/expandable-text";
import { resolveProjectSubcategoryDisplay } from "@/lib/project-taxonomy";
import {
  flattenProjectTasks,
  isTaskOverdue,
  projectPendingTaskCount,
} from "@/lib/project-insights";
import type { Project, Risk } from "@/lib/mock-data";
import { calculateProjectIndicators, deriveTaskDisplayPriority } from "@/lib/project-plan";

export default async function ProjectDetailPage({
  params,
  searchParams,
}: {
  params: Promise<{ id: string }>;
  searchParams: Promise<{ workspace?: string }>;
}) {
  const [{ id }, sp] = await Promise.all([params, searchParams]);
  await syncEnvironmentThemes();
  const project = await getProjectById(id);
  if (!project) notFound();

  // Membres d'équipe actifs → proposés en ajout rapide comme collaborateurs.
  const teamMemberNames = await getActiveTeamMemberNames();

  const workspace = getWorkspace(sp.workspace ?? project.workspace);
  const theme = workspaceTheme[workspace];
  const openBlockers = project.blockers.filter((blocker) => blocker.status === "open");
  const steps = project.steps ?? [];
  const hasSteps = steps.length > 0;
  const overdueTaskCount = flattenProjectTasks(project).filter((entry) => isTaskOverdue(entry.task)).length;
  const pendingTaskCount = projectPendingTaskCount(project);
  const projectIndicators = calculateProjectIndicators(project);
  const visibleRisks = buildVisibleRisks(project.risks, {
    openBlockers,
    overdueTaskCount,
  });
  const visibleRiskItems = visibleRisks.slice(0, 2);
  const hiddenRiskItems = visibleRisks.slice(2);
  const railSynthesis = buildProjectRailSynthesis(project, {
    totalTasks: projectIndicators.totalTasks,
    doneTasks: projectIndicators.doneTasks,
    pendingTaskCount,
    openBlockerCount: openBlockers.length,
    overdueTaskCount,
    blockedTaskCount: projectIndicators.blockedCount,
    dueSoonCount: projectIndicators.dueSoonCount,
  });
  const nextActionItems = railSynthesis.nextActions;
  // Legacy actions (projects without steps)
  const pendingLegacyActions = project.actions.filter((a) => !a.done);

  return (
    <div className="flex flex-col h-full overflow-hidden">
      <ProjectPilotHeader project={project} workspace={workspace} teamMemberNames={teamMemberNames} />

      <div className="mb-project-detail-frame flex-1 min-h-0 overflow-hidden">
        <div className="mb-project-detail-shell mb-mobile-scroll px-5 py-3">
          <div className="mb-project-command-grid">
            <main className="mb-project-main-scroll min-w-0">
              <section id="project-workspace">
                <ProjectMultiView project={project} workspace={workspace} />
              </section>
            </main>

            <aside className="mb-project-rail mb-project-rail-scroll">
              <ProjectRailDetails>
                <summary className="mb-project-rail-toggle" aria-label="Afficher ou replier la synthèse">
                  <svg width="12" height="12" viewBox="0 0 16 16" fill="none" aria-hidden="true">
                    <path d="M6 3l5 5-5 5" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" />
                  </svg>
                </summary>
                <div className="mb-project-rail-content flex flex-col gap-3">
                  <div className="flex items-center justify-between gap-2">
                    <p className="mb-project-rail-title">Synthèse</p>
                    <AISynthesisButton projectId={project.id} accentColor={theme.accent} />
                  </div>
                  <ProjectRailCard title="Objectif" accentColor={theme.accent} icon="target">
                    <ExpandableText className="text-xs leading-relaxed" style={{ color: text.secondary }}>
                      {railSynthesis.objective}
                    </ExpandableText>
                  </ProjectRailCard>

                  <ProjectRailCard title="Résumé du projet">
                    <ExpandableText className="text-xs leading-relaxed" style={{ color: text.secondary }}>
                      {railSynthesis.projectSummary}
                    </ExpandableText>
                  </ProjectRailCard>

                  {/* Avancement + Risques fusionnés : ce qui a été fait + risques en puces */}
                  <ProjectRailCard title="État actuel" accentColor="#F59E0B" icon="pulse">
                    <ExpandableText className="text-xs leading-relaxed" style={{ color: text.secondary }}>
                      {railSynthesis.currentState}
                    </ExpandableText>
                    {visibleRisks.length > 0 && (
                      <div className="mt-3 pt-3" style={{ borderTop: `1px solid ${surface.borderSubtle}` }}>
                        <p className="text-[10px] font-semibold uppercase tracking-[0.12em] mb-1.5" style={{ color: text.muted }}>
                          Risques identifiés
                        </p>
                        <ul className="grid gap-1.5">
                          {visibleRiskItems.map((risk) => (
                            <RiskBullet key={risk.id} risk={risk} />
                          ))}
                        </ul>
                        {hiddenRiskItems.length > 0 && (
                          <details className="mt-2">
                            <summary className="cursor-pointer text-[11px] font-semibold" style={{ color: text.muted }}>
                              Voir {hiddenRiskItems.length} autre{hiddenRiskItems.length > 1 ? "s" : ""}
                            </summary>
                            <ul className="mt-1.5 grid gap-1.5">
                              {hiddenRiskItems.map((risk) => (
                                <RiskBullet key={risk.id} risk={risk} />
                              ))}
                            </ul>
                          </details>
                        )}
                      </div>
                    )}
                  </ProjectRailCard>

                  <ProjectRailCard title="Prochaines actions" actionLabel={nextActionItems.length > 0 ? `${nextActionItems.length}` : undefined}>
                    {nextActionItems.length === 0 ? (
                      <p className="text-xs leading-relaxed" style={{ color: text.muted }}>
                        {project.nextStep}
                      </p>
                    ) : (
                      <div style={{ display: "grid", gap: "0.55rem" }}>
                        {nextActionItems.map((item) => (
                          <NextActionItem key={item.id} item={item} accentColor={theme.accent} />
                        ))}
                      </div>
                    )}
                  </ProjectRailCard>
                </div>
              </ProjectRailDetails>
            </aside>
          </div>
        </div>
      </div>
    </div>
  );
}

function ProjectPilotHeader({
  project,
  workspace,
  teamMemberNames,
}: {
  project: Project;
  workspace: Project["workspace"];
  teamMemberNames: string[];
}) {
  const theme = workspaceTheme[workspace];
  // Seul le pictogramme du projet garde la couleur de thème (sous-catégorie).
  // Tout le reste (filet, boutons d'action, vue étapes…) suit l'ENVIRONNEMENT.
  const envAccent = theme.accent;

  // Top bar premium calm : surface neutre + filet de couleur fin (4px) signant
  // l'identité projet, plutôt qu'un grand bandeau plein. Plus aéré, plus calme.
  return (
    <header
      className="mb-project-pilotbar shrink-0"
      style={{
        background: surface.s1,
        borderBottom: `1px solid ${surface.borderSubtle}`,
        color: text.primary,
        position: "relative",
      }}
    >
      {/* Filet d'accent fin = signature visuelle du projet sans agressivité */}
      <span
        aria-hidden="true"
        style={{
          position: "absolute",
          insetInline: 0,
          top: 0,
          height: 3,
          background: envAccent,
        }}
      />
      <div className="mb-project-pilotbar-inner" style={{ padding: "8px 20px" }}>
        <div className="mb-project-pilotbar-identity min-w-0" style={{ gap: 12 }}>
          <ProjectIdentityEditor
            key={`${project.id}-${project.subcategory}-pilot`}
            projectId={project.id}
            workspace={project.workspace}
            subcategory={project.subcategory}
            subcategoryColor={project.subcategoryColor}
            isCustomSubcategory={project.isCustomSubcategory}
            customSubcategoryLabel={project.customSubcategoryLabel}
            customSubcategoryColor={project.customSubcategoryColor}
            size="lg"
          />
          <div className="min-w-0">
            <h1 style={{ color: text.primary, fontSize: 18, fontWeight: 600, lineHeight: 1.25, margin: 0 }}>
              {project.name}
            </h1>
            <p
              className="truncate"
              style={{ color: text.muted, fontSize: 11, lineHeight: 1.35, margin: "2px 0 0" }}
            >
              {project.objective}
            </p>
          </div>
        </div>

        <div className="mb-project-pilotbar-actions-secondary" style={{ display: "flex", alignItems: "center", gap: 6 }}>
          {/* Boutons IA = couleur de l'ENVIRONNEMENT (Pro/Perso), pas du thème. */}
          <ProjectEvolutionLauncher projectId={project.id} accentColor={theme.accent} />
          <ProjectCollaborationLauncher
            projectId={project.id}
            workspace={workspace}
            people={project.people ?? []}
            teams={project.teams ?? []}
            teamMemberNames={teamMemberNames}
            accentColor={envAccent}
          />
          <ProjectFilesLauncher projectId={project.id} workspace={workspace} files={project.files ?? []} accentColor={envAccent} />
          <ProjectTeamChatLauncher
            projectId={project.id}
            people={project.people ?? []}
            messages={project.teamMessages ?? []}
            accentColor={envAccent}
          />
          <ProjectSettingsMenu
            projectId={project.id}
            workspace={workspace}
            currentStatus={project.status}
            statusSettings={project.statusSettings}
            accentColor={envAccent}
            steps={project.steps ?? []}
          />
        </div>

        <div className="mb-project-pilotbar-metrics">
          <div className="flex items-center gap-2.5 min-w-0 flex-nowrap justify-end">
            <span
              style={{
                color: text.muted,
                fontSize: 10.5,
                fontWeight: 600,
                letterSpacing: 0.04,
                textTransform: "uppercase",
                whiteSpace: "nowrap",
                flexShrink: 0,
              }}
            >
              Avancement
            </span>
            <div style={{ width: 90, flexShrink: 0 }}>
              <ProgressBar
                value={project.progress}
                color={envAccent}
                height={6}
                trackColor={surface.s2}
                borderColor={surface.borderSubtle}
              />
            </div>
            <span
              style={{
                color: text.primary,
                fontSize: 12,
                fontWeight: 700,
                fontVariantNumeric: "tabular-nums",
                whiteSpace: "nowrap",
                flexShrink: 0,
              }}
            >
              {project.progress}%
            </span>
            <ProjectControls
              projectId={project.id}
              workspace={workspace}
              currentStatus={project.status}
              currentStatusMode={project.statusMode}
              currentPriority={project.priority}
              hideDestructive
              compact
            />
          </div>
        </div>
      </div>
    </header>
  );
}

function ProjectBriefIcon({ icon }: { icon: "target" | "context" | "pulse" }) {
  if (icon === "context") {
    return (
      <svg width="15" height="15" viewBox="0 0 16 16" fill="none" aria-hidden="true">
        <path d="M5 3h6.5A1.5 1.5 0 0 1 13 4.5v7A1.5 1.5 0 0 1 11.5 13h-7A1.5 1.5 0 0 1 3 11.5V5" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" />
        <path d="M5.5 2.5v5h5" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
      </svg>
    );
  }

  if (icon === "pulse") {
    return (
      <svg width="15" height="15" viewBox="0 0 16 16" fill="none" aria-hidden="true">
        <path d="M2 8h2.5l1.2-3.5 2.2 7 1.4-4H14" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
      </svg>
    );
  }

  return (
    <svg width="15" height="15" viewBox="0 0 16 16" fill="none" aria-hidden="true">
      <circle cx="8" cy="8" r="5.5" stroke="currentColor" strokeWidth="1.5" />
      <circle cx="8" cy="8" r="2" stroke="currentColor" strokeWidth="1.5" />
      <path d="M8 2v2M8 12v2M2 8h2M12 8h2" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" />
    </svg>
  );
}

function ProjectRailCard({
  title,
  actionLabel,
  accentColor,
  icon,
  children,
}: {
  title: string;
  actionLabel?: string;
  accentColor?: string;
  icon?: "target" | "context" | "pulse";
  children: ReactNode;
}) {
  return (
    <section className="mb-project-rail-card rounded-[20px] p-3">
      <div className="mb-1.5 flex items-center justify-between gap-2">
        <div className="flex min-w-0 items-center gap-2">
          {icon && accentColor && (
            <span className="inline-flex h-6 w-6 shrink-0 items-center justify-center rounded-lg" style={{ background: accentColor, color: "#FFFFFF" }}>
              <ProjectBriefIcon icon={icon} />
            </span>
          )}
          <h2 className="text-xs font-semibold" style={{ color: text.primary }}>
            {title}
          </h2>
        </div>
        {actionLabel && (
          <span className="rounded-full px-1.5 py-0.5 text-[10px] font-semibold" style={{ background: surface.s2, color: text.muted }}>
            {actionLabel}
          </span>
        )}
      </div>
      {children}
    </section>
  );
}

type ProjectRailNextAction = {
  id: string;
  title: string;
  stepTitle: string;
  dueLabel?: string;
};

function NextActionItem({
  item,
  accentColor,
}: {
  item: ProjectRailNextAction;
  accentColor: string;
}) {
  return (
    <div className="flex items-start gap-2 rounded-xl px-2 py-1.5" style={{ background: surface.s2 }}>
      <span className="mt-1 h-2 w-2 shrink-0 rounded-full" style={{ background: accentColor }} />
      <div className="min-w-0">
        <p className="text-[10.5px] font-semibold leading-snug" style={{ color: text.primary }}>
          {item.title}
        </p>
        <p className="mt-0.5 text-[10.5px]" style={{ color: text.muted }}>
          {item.stepTitle}{item.dueLabel ? ` · ${item.dueLabel}` : ""}
        </p>
      </div>
    </div>
  );
}

function RiskItem({ risk, compact = false }: { risk: Risk; compact?: boolean }) {
  return (
    <div className="rounded-xl p-2" style={{ background: surface.s2, border: `1px solid ${surface.borderSubtle}` }}>
      <div className="flex items-center justify-between gap-2 mb-1">
        <p className={`${compact ? "text-[11px]" : "text-xs"} font-medium leading-snug`} style={{ color: text.primary }}>{risk.title}</p>
        <span className="text-[11px] px-2 py-0.5 rounded-full shrink-0" style={{ background: severity[risk.severity].bg, color: severity[risk.severity].text }}>
          {severityLabels[risk.severity]}
        </span>
      </div>
      {risk.description && <p className="text-[11px] leading-relaxed mb-1" style={{ color: text.secondary }}>{risk.description}</p>}
      <p className="text-[11px] leading-relaxed" style={{ color: text.muted }}>↳ {risk.mitigation}</p>
    </div>
  );
}

// Format puce compact pour l'intégration dans la carte "État actuel"
function RiskBullet({ risk }: { risk: Risk }) {
  return (
    <li className="flex items-start gap-2 text-[11.5px] leading-snug" style={{ color: text.secondary }}>
      <span
        aria-hidden
        className="mt-1.5 inline-block h-1.5 w-1.5 shrink-0 rounded-full"
        style={{ background: severity[risk.severity].text }}
      />
      <span className="min-w-0 flex-1">
        <span style={{ color: text.primary, fontWeight: 600 }}>{risk.title}</span>
        {risk.mitigation ? (
          <span style={{ color: text.muted }}> · {risk.mitigation}</span>
        ) : null}
      </span>
    </li>
  );
}

interface ProjectRailSignals {
  totalTasks: number;
  doneTasks: number;
  pendingTaskCount: number;
  openBlockerCount: number;
  overdueTaskCount: number;
  blockedTaskCount: number;
  dueSoonCount: number;
}

interface ProjectRailSynthesis {
  objective: string;
  projectSummary: string;
  currentState: string;
  nextActions: ProjectRailNextAction[];
}

function buildProjectRailSynthesis(project: Project, signals: ProjectRailSignals): ProjectRailSynthesis {
  const memorySummary = "";

  return {
    objective: buildObjectiveText(project, memorySummary),
    projectSummary: buildProjectSummaryText(project),
    currentState: buildCurrentStateSummary(project, signals, memorySummary),
    nextActions: buildNextActionItems(project),
  };
}

// Le "Résumé du projet" affiche le texte écrit par l'IA dans description quand
// présent. À défaut on retombe sur l'objectif + contexte concaténés pour ne
// jamais laisser la carte vide.
function buildProjectSummaryText(project: Project) {
  const aiText = project.description?.trim();
  if (aiText) return aiText;
  const objective = project.objective?.trim();
  const context = project.context?.trim();
  if (objective && context) return `${objective} ${context}`;
  return objective || context || "Aucun résumé disponible pour le moment.";
}

function buildNextActionItems(project: Project): ProjectRailNextAction[] {
  const priorityRank = { high: 0, medium: 1, low: 2 } as const;
  const items: ProjectRailNextAction[] = [];
  const seen = new Set<string>();

  function pushItem(item: ProjectRailNextAction) {
    const signature = normalizeRailSignature(`${item.title} ${item.stepTitle}`);
    if (!signature || seen.has(signature)) return;
    seen.add(signature);
    items.push(item);
  }

  flattenProjectTasks(project)
    .filter((entry) => entry.boardStatus !== "done")
    .sort((left, right) => {
      const leftOverdue = isTaskOverdue(left.task) ? 0 : 1;
      const rightOverdue = isTaskOverdue(right.task) ? 0 : 1;
      if (leftOverdue !== rightOverdue) return leftOverdue - rightOverdue;
      const leftStatusRank = getNextActionStatusRank(left.boardStatus);
      const rightStatusRank = getNextActionStatusRank(right.boardStatus);
      if (leftStatusRank !== rightStatusRank) return leftStatusRank - rightStatusRank;
      const leftPriority = priorityRank[deriveTaskDisplayPriority(left.task)];
      const rightPriority = priorityRank[deriveTaskDisplayPriority(right.task)];
      if (leftPriority !== rightPriority) return leftPriority - rightPriority;
      const leftDue = left.task.dueDate ?? "9999-12-31";
      const rightDue = right.task.dueDate ?? "9999-12-31";
      if (leftDue !== rightDue) return leftDue.localeCompare(rightDue);
      return left.stepOrder - right.stepOrder || left.taskOrder - right.taskOrder;
    })
    .forEach((entry) => pushItem({
      id: entry.id,
      title: buildNextActionTitle(entry.boardStatus, entry.task.title),
      stepTitle: entry.stepTitle,
      dueLabel: formatTaskDateLabel(entry.task.dueDate),
    }));

  return items.slice(0, 4);
}

function formatTaskDateLabel(dueDate?: string) {
  if (!dueDate) return "";
  return `prévue le ${formatShortDate(dueDate)}`;
}

function buildCurrentStateSummary(project: Project, signals: ProjectRailSignals, _memorySummary: string) {
  // Quand l'IA a écrit une synthèse récente (stockée dans currentPriority),
  // on l'affiche telle quelle — phrases humaines, pas de surcouche robotique.
  const aiText = project.currentPriority?.trim();
  if (aiText) return aiText;

  // Fallback automatique : projet jamais analysé → résumé minimal des signaux.
  const taskProgress = signals.totalTasks > 0
    ? `${signals.doneTasks}/${signals.totalTasks} tâche${signals.totalTasks > 1 ? "s" : ""} terminée${signals.totalTasks > 1 ? "s" : ""}`
    : "aucune tâche structurée";
  const flags = [
    signals.openBlockerCount > 0 ? `${signals.openBlockerCount} blocage${signals.openBlockerCount > 1 ? "s" : ""}` : "",
    signals.overdueTaskCount > 0 ? `${signals.overdueTaskCount} retard${signals.overdueTaskCount > 1 ? "s" : ""}` : "",
  ].filter(Boolean);

  const main = `Avancement : ${project.progress}% — ${taskProgress}.`;
  const tail = flags.length > 0 ? ` À surveiller : ${flags.join(", ")}.` : "";
  return `${main}${tail} Clique sur "Mettre à jour" pour une lecture détaillée.`;
}

function buildObjectiveText(project: Project, _memorySummary: string) {
  return project.objective || project.description || "Objectif à préciser.";
}

function getNextActionStatusRank(status: string) {
  if (status === "blocked") return 0;
  if (status === "waiting") return 1;
  if (status === "in_progress") return 2;
  return 3;
}

function buildNextActionTitle(status: string, title: string) {
  if (status === "blocked") return `Lever le blocage : ${title}`;
  if (status === "waiting") return `Relancer ou clarifier : ${title}`;
  if (status === "in_progress") return `Finaliser : ${title}`;
  return `Démarrer : ${title}`;
}

function normalizeRailSignature(value: string | undefined) {
  return (value ?? "")
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, " ")
    .trim();
}

function buildVisibleRisks(
  projectRisks: Risk[],
  signals: {
    openBlockers: Array<{ id: string; label: string; description: string }>;
    overdueTaskCount: number;
  },
): Risk[] {
  const derived: Risk[] = [];

  signals.openBlockers.forEach((blocker) => {
    derived.push({
      id: `derived_blocker_${blocker.id}`,
      title: `Blocage actif : ${blocker.label}`,
      description: blocker.description,
      severity: "high",
      mitigation: "Lever le blocage ou définir une alternative avant de poursuivre l'exécution.",
      status: "open",
    });
  });

  if (signals.overdueTaskCount > 0) {
    derived.push({
      id: "derived_overdue_tasks",
      title: "Risque de retard d'exécution",
      description: `${signals.overdueTaskCount} tâche${signals.overdueTaskCount > 1 ? "s sont" : " est"} en retard.`,
      severity: "medium",
      mitigation: "Replanifier les tâches concernées ou réduire le périmètre immédiat.",
      status: "open",
    });
  }

  const openProjectRisks = projectRisks.filter((risk) => risk.status === "open");
  const existingTitles = new Set(openProjectRisks.map((risk) => risk.title.trim().toLocaleLowerCase("fr-FR")));
  const uniqueDerived = derived.filter((risk) => !existingTitles.has(risk.title.trim().toLocaleLowerCase("fr-FR")));
  return [...openProjectRisks, ...uniqueDerived];
}
