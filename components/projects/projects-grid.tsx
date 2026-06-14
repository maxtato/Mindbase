"use client";

import { useState } from "react";
import Link from "next/link";
import { Badge, statusLabels } from "@/components/ui/badge";
import { ProgressBar } from "@/components/ui/progress-bar";
import type { Project } from "@/lib/mock-data";
import type { Workspace } from "@/lib/workspace";
import { workspaceTheme } from "@/lib/workspace";
import { surface, text, error, statusColor } from "@/lib/design-tokens";
import {
  ProjectMetaRow,
} from "@/components/projects/project-taxonomy-ui";
import { ProjectIdentityEditor } from "@/components/projects/project-identity-editor";
import { resolveProjectSubcategoryDisplay } from "@/lib/project-taxonomy";
import { isProjectInactive, projectHasBlockedTask, projectHasOverdueTask, projectPendingTaskCount } from "@/lib/project-insights";
import { calculateProjectIndicators } from "@/lib/project-plan";
import {
  FilterPill,
  FilterPillGroup,
  FilterToggleChip,
  type FilterPillOption,
} from "@/components/ui/filter-pill";

type FilterKey = "all" | "preparing" | "active" | "paused" | "completed" | "archived";
type PriorityFilter = "all" | "high" | "medium" | "low";

interface ProjectsGridProps {
  projects: Project[];
  workspace: Workspace;
  qs: string;
}

export function ProjectsGrid({ projects, workspace, qs }: ProjectsGridProps) {
  const [activeFilter, setActiveFilter] = useState<FilterKey>("all");
  const [priorityFilter, setPriorityFilter] = useState<PriorityFilter>("all");
  const [showBlockedOnly, setShowBlockedOnly] = useState(false);
  const [showInactiveOnly, setShowInactiveOnly] = useState(false);
  const [showOverdueOnly, setShowOverdueOnly] = useState(false);
  const theme = workspaceTheme[workspace];

  const nonArchived = projects.filter((p) => p.status !== "archived");
  const statusFiltered =
    activeFilter === "archived"
      ? projects.filter((p) => p.status === "archived")
      : activeFilter === "all"
        ? nonArchived
        : nonArchived.filter((p) => p.status === activeFilter);
  const filtered = statusFiltered
    .filter((project) => priorityFilter === "all" || project.priority === priorityFilter)
    .filter((project) => !showBlockedOnly || projectHasBlockedTask(project) || project.blockers.some((blocker) => blocker.status === "open"))
    .filter((project) => !showInactiveOnly || isProjectInactive(project))
    .filter((project) => !showOverdueOnly || projectHasOverdueTask(project));

  const archivedCount = projects.filter((p) => p.status === "archived").length;

  const statusOptions: FilterPillOption<FilterKey>[] = [
    { value: "all", label: "Tous les statuts" },
    { value: "preparing", label: "À préparer", dot: "var(--mb-status-gray-text)" },
    { value: "active", label: "En cours", dot: "var(--mb-status-green-text)" },
    { value: "paused", label: "En pause", dot: "var(--mb-status-yellow-text)" },
    { value: "completed", label: "Terminé", dot: "var(--mb-status-blue-text)" },
    { value: "archived", label: archivedCount > 0 ? `Archivé (${archivedCount})` : "Archivé", dot: "var(--mb-text-ghost)" },
  ];

  const priorityOptions: FilterPillOption<PriorityFilter>[] = [
    { value: "all", label: "Toutes priorités" },
    { value: "high", label: "Haute", dot: "var(--mb-status-red-text)" },
    { value: "medium", label: "Moyenne", dot: "var(--mb-status-blue-text)" },
    { value: "low", label: "Basse", dot: "var(--mb-status-gray-text)" },
  ];

  return (
    <>
      <div className="flex items-center justify-between mb-5 gap-3 flex-wrap">
        <p className="text-sm shrink-0" style={{ color: text.secondary }}>
          {filtered.length} projet{filtered.length !== 1 ? "s" : ""}
          {activeFilter === "all" && ` · ${nonArchived.filter((p) => p.status === "active").length} en cours`}
          {activeFilter === "archived" && <span className="ml-1.5 text-xs" style={{ color: text.muted }}>archivés</span>}
        </p>

        <FilterPillGroup
          trailing={
            <>
              <FilterToggleChip
                label="Bloqués"
                active={showBlockedOnly}
                onToggle={() => setShowBlockedOnly((v) => !v)}
                accentColor={theme.accent}
                dot="var(--mb-status-red-text)"
              />
              <FilterToggleChip
                label="Inactifs"
                active={showInactiveOnly}
                onToggle={() => setShowInactiveOnly((v) => !v)}
                accentColor={theme.accent}
                dot="var(--mb-status-gray-text)"
              />
              <FilterToggleChip
                label="En retard"
                active={showOverdueOnly}
                onToggle={() => setShowOverdueOnly((v) => !v)}
                accentColor={theme.accent}
                dot="var(--mb-status-orange-text)"
              />
            </>
          }
        >
          <FilterPill
            label="Statut"
            value={activeFilter}
            options={statusOptions}
            onChange={setActiveFilter}
            active={activeFilter !== "all"}
            accentColor={theme.accent}
          />
          <FilterPill
            label="Priorité"
            value={priorityFilter}
            options={priorityOptions}
            onChange={setPriorityFilter}
            active={priorityFilter !== "all"}
            accentColor={theme.accent}
          />
        </FilterPillGroup>
      </div>

      {filtered.length === 0 ? (
        <div className="flex flex-col items-center justify-center py-20">
          <div className="w-12 h-12 rounded-2xl flex items-center justify-center mb-3" style={{ background: surface.s1 }}>
            <svg width="22" height="22" viewBox="0 0 16 16" fill="none">
              <path
                d="M2 4.5C2 3.12 3.12 2 4.5 2h2.086a1.5 1.5 0 0 1 1.06.44l.915.913a1.5 1.5 0 0 0 1.061.44H11.5C12.88 3.793 14 4.92 14 6.3v5.2A2.5 2.5 0 0 1 11.5 14h-7A2.5 2.5 0 0 1 2 11.5v-7Z"
                stroke={text.dim}
                strokeWidth="1.5"
                strokeLinejoin="round"
              />
            </svg>
          </div>
          <p className="text-sm font-medium" style={{ color: text.secondary }}>
            Aucun projet dans cette catégorie
          </p>
          <p className="text-xs mt-1" style={{ color: text.muted }}>
            Créez un projet dans cet espace ou changez le filtre.
          </p>
        </div>
      ) : (
        <div className="mb-projects-grid mb-stagger">
          {filtered.map((project) => {
            const pendingActions = projectPendingTaskCount(project);
            const openBlockers = project.blockers.filter((blocker) => blocker.status === "open");
            const pendingDecisions = project.decisions.filter((decision) => decision.status === "pending");
            const subcategoryDisplay = resolveProjectSubcategoryDisplay(project);
            const inactive = isProjectInactive(project);
            const overdue = projectHasOverdueTask(project);
            const blocked = projectHasBlockedTask(project) || openBlockers.length > 0;
            const indicators = calculateProjectIndicators(project);

            return (
              <Link key={project.id} href={`/dashboard/projects/${project.id}?${qs}`} className="block group h-full">
                <div
                  className="mb-card-premium mb-card-hover overflow-hidden h-full rounded-[26px]"
                  style={{
                    background: surface.s1,
                    border: `1px solid ${surface.border}`,
                  }}
                >
                  {/* Solid colored header band — paddings réduits en mobile
                      pour laisser plus de place au contenu et que les cartes
                      tiennent confortablement dans l'écran iPhone. */}
                  <div
                    className="p-3.5 sm:p-5"
                    style={{
                      background: subcategoryDisplay.color,
                      borderBottom: `1px solid ${surface.borderSubtle}`,
                    }}
                  >
                    <div className="flex items-start justify-between gap-2 sm:gap-3">
                      <div className="flex items-start gap-2 sm:gap-3 min-w-0">
                        <ProjectIdentityEditor
                          key={`${project.id}-${project.subcategory}`}
                          projectId={project.id}
                          workspace={project.workspace}
                          subcategory={project.subcategory}
                          subcategoryColor={project.subcategoryColor}
                          isCustomSubcategory={project.isCustomSubcategory}
                          customSubcategoryLabel={project.customSubcategoryLabel}
                          customSubcategoryColor={project.customSubcategoryColor}
                          size="md"
                          onColor
                        />
                        <div className="min-w-0">
                          <p
                            className="text-[16px] sm:text-[19px] font-bold leading-tight line-clamp-2"
                            style={{ color: surface.onColor, overflowWrap: "anywhere" }}
                          >
                            {project.name}
                          </p>
                        </div>
                      </div>

                      <span className="shrink-0">
                        <Badge variant="onColor" statusKey={project.status}>
                          {statusLabels[project.status]}
                        </Badge>
                      </span>
                    </div>
                  </div>

                  <div className="p-3.5 sm:p-5" style={{ background: surface.s1 }}>
                    <div className="mb-3">
                      <ProjectMetaRow project={project} compact />
                    </div>

                    <div
                      className="mb-3"
                      style={{
                        paddingLeft: "0.75rem",
                        borderLeft: `3px solid ${project.subcategoryColor}`,
                      }}
                    >
                      <p className="text-[10px] font-semibold uppercase tracking-widest mb-1" style={{ color: project.subcategoryColor }}>
                        Objectif
                      </p>
                      <p className="text-sm line-clamp-3" style={{ color: text.primary, fontWeight: 500, lineHeight: 1.55 }}>
                        {project.objective}
                      </p>
                    </div>

                    <div className="flex items-center gap-3 mb-3">
                      <ProgressBar value={project.progress} color={project.subcategoryColor} />
                      <span className="text-xs shrink-0 tabular-nums font-semibold" style={{ color: project.subcategoryColor }}>
                        {project.progress}%
                      </span>
                    </div>

                    <div className="flex items-center justify-between gap-3 flex-wrap">
                      <div className="flex items-center gap-3 flex-wrap text-xs">
                        {blocked && (
                          <span className="flex items-center gap-1.5" style={{ color: error.text }}>
                            <span className="w-1.5 h-1.5 rounded-full" style={{ background: error.dot }} />
                            Blocage
                          </span>
                        )}
                        {overdue && (
                          <span style={{ color: statusColor.yellow.text }}>
                            Échéance en retard
                          </span>
                        )}
                        {pendingDecisions.length > 0 && (
                          <span style={{ color: statusColor.yellow.text }}>
                            {pendingDecisions.length} décision{pendingDecisions.length > 1 ? "s" : ""} en attente
                          </span>
                        )}
                        {inactive && (
                          <span style={{ color: text.muted }}>
                            Inactif
                          </span>
                        )}
                        {indicators.isAtRisk && (
                          <span style={{ color: error.text }}>
                            À risque
                          </span>
                        )}
                        {indicators.dueSoonCount > 0 && (
                          <span style={{ color: statusColor.yellow.text }}>
                            {indicators.dueSoonCount} proche{indicators.dueSoonCount > 1 ? "s" : ""}
                          </span>
                        )}
                      </div>
                      <div className="flex items-center gap-2 text-xs" style={{ color: text.muted }}>
                        <span>{pendingActions} tâches</span>
                      </div>
                    </div>
                  </div>
                </div>
              </Link>
            );
          })}
        </div>
      )}
    </>
  );
}
