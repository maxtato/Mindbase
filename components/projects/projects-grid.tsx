"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { Badge, statusLabels } from "@/components/ui/badge";
import { ProgressBar } from "@/components/ui/progress-bar";
import type { Project } from "@/lib/mock-data";
import type { Workspace } from "@/lib/workspace";
import { workspaceTheme, listEnvironmentOptions } from "@/lib/workspace";
import { useEnvironments } from "@/components/environments/environments-provider";
import { useT } from "@/components/i18n/locale-provider";
import { surface, text, error, statusColor } from "@/lib/design-tokens";
import {
  ProjectPriorityBadge,
} from "@/components/projects/project-taxonomy-ui";
import { ProjectIdentityEditor } from "@/components/projects/project-identity-editor";
import { resolveProjectSubcategoryDisplay } from "@/lib/project-taxonomy";
import { isProjectInactive, projectHasBlockedTask, projectHasOverdueTask, projectPendingTaskCount } from "@/lib/project-insights";
import { calculateProjectIndicators } from "@/lib/project-plan";
import {
  FilterPill,
  FilterPillGroup,
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
  const [envFilter, setEnvFilter] = useState<string>("all");
  const [sortKey, setSortKey] = useState<"recent" | "name" | "progress" | "priority">("recent");
  const theme = workspaceTheme[workspace];
  const t = useT();

  // Filtre « Environnement » : depuis la suppression du sélecteur d'espaces, la
  // vue affiche toujours tous les environnements. Ce filtre permet de se
  // restreindre à un environnement sans perdre la vue agrégée par défaut.
  const environments = useEnvironments();
  const envOptions: FilterPillOption<string>[] = [
    { value: "all", label: t("common.all") },
    ...listEnvironmentOptions(environments).map((option) => ({
      value: option.value,
      label: option.label,
      dot: workspaceTheme[option.value].accent,
    })),
  ];

  // Persistance des filtres de la page Projets (state local) : on restaure au
  // montage et on sauvegarde à chaque changement, pour qu'ils restent actifs
  // après un rechargement ou un changement d'onglet.
  const FILTERS_KEY = "mb-filters-projects";
  useEffect(() => {
    try {
      const raw = localStorage.getItem(FILTERS_KEY);
      if (!raw) return;
      const s = JSON.parse(raw) as Partial<{
        activeFilter: FilterKey;
        priorityFilter: PriorityFilter;
        envFilter: string;
      }>;
      if (s.activeFilter) setActiveFilter(s.activeFilter);
      if (s.priorityFilter) setPriorityFilter(s.priorityFilter);
      if (s.envFilter) setEnvFilter(s.envFilter);
    } catch {
      /* ignore */
    }
  }, []);
  useEffect(() => {
    try {
      localStorage.setItem(
        FILTERS_KEY,
        JSON.stringify({ activeFilter, priorityFilter, envFilter }),
      );
    } catch {
      /* ignore */
    }
  }, [activeFilter, priorityFilter, envFilter]);

  const nonArchived = projects.filter((p) => p.status !== "archived");
  const statusFiltered =
    activeFilter === "archived"
      ? projects.filter((p) => p.status === "archived")
      : activeFilter === "all"
        ? nonArchived
        : nonArchived.filter((p) => p.status === activeFilter);
  const filtered = statusFiltered
    .filter((project) => envFilter === "all" || project.workspace === envFilter)
    .filter((project) => priorityFilter === "all" || project.priority === priorityFilter);

  // Tri (la recherche par nom se fait via la loupe globale en haut, pas ici).
  const PRIORITY_RANK: Record<string, number> = { high: 0, medium: 1, low: 2 };
  const visibleProjects = [...filtered].sort((a, b) => {
    if (sortKey === "name") return a.name.localeCompare(b.name, "fr");
    if (sortKey === "progress") return (b.progress ?? 0) - (a.progress ?? 0);
    if (sortKey === "priority") return (PRIORITY_RANK[a.priority] ?? 1) - (PRIORITY_RANK[b.priority] ?? 1);
    return (b.updatedAt ?? "").localeCompare(a.updatedAt ?? ""); // récents
  });

  const sortOptions: FilterPillOption<"recent" | "name" | "progress" | "priority">[] = [
    { value: "recent", label: t("sort.recent") },
    { value: "name", label: t("sort.name") },
    { value: "progress", label: t("sort.progress") },
    { value: "priority", label: t("sort.priority") },
  ];

  const archivedCount = projects.filter((p) => p.status === "archived").length;

  const statusOptions: FilterPillOption<FilterKey>[] = [
    { value: "all", label: t("filter.status.all") },
    { value: "preparing", label: t("filter.status.preparing"), dot: "var(--mb-status-gray-text)" },
    { value: "active", label: t("filter.status.active"), dot: "var(--mb-status-green-text)" },
    { value: "paused", label: t("filter.status.paused"), dot: "var(--mb-status-yellow-text)" },
    { value: "completed", label: t("filter.status.completed"), dot: "var(--mb-status-blue-text)" },
    { value: "archived", label: archivedCount > 0 ? `${t("filter.status.archived")} (${archivedCount})` : t("filter.status.archived"), dot: "var(--mb-text-ghost)" },
  ];

  const priorityOptions: FilterPillOption<PriorityFilter>[] = [
    { value: "all", label: t("filter.priority.all") },
    { value: "high", label: t("filter.priority.high"), dot: "var(--mb-status-red-text)" },
    { value: "medium", label: t("filter.priority.medium"), dot: "var(--mb-status-blue-text)" },
    { value: "low", label: t("filter.priority.low"), dot: "var(--mb-status-gray-text)" },
  ];

  return (
    <>
      <div className="flex items-center justify-between mb-5 gap-3 flex-wrap">
        <p className="text-sm shrink-0" style={{ color: text.secondary }}>
          {visibleProjects.length === 1 ? t("projects.countOne", { count: visibleProjects.length }) : t("projects.countOther", { count: visibleProjects.length })}
          {activeFilter === "all" && ` · ${t("projects.activeSuffix", { count: nonArchived.filter((p) => p.status === "active").length })}`}
          {activeFilter === "archived" && <span className="ml-1.5 text-xs" style={{ color: text.muted }}>{t("projects.archivedSuffix")}</span>}
        </p>

        <FilterPillGroup>
          <FilterPill
            label={t("filter.environment")}
            value={envFilter}
            options={envOptions}
            onChange={setEnvFilter}
            active={envFilter !== "all"}
            accentColor={theme.accent}
            minWidth={190}
          />
          <FilterPill
            label={t("filter.status")}
            value={activeFilter}
            options={statusOptions}
            onChange={setActiveFilter}
            active={activeFilter !== "all"}
            accentColor={theme.accent}
          />
          <FilterPill
            label={t("filter.priority")}
            value={priorityFilter}
            options={priorityOptions}
            onChange={setPriorityFilter}
            active={priorityFilter !== "all"}
            accentColor={theme.accent}
          />
          <FilterPill
            label={t("filter.sort")}
            value={sortKey}
            options={sortOptions}
            onChange={setSortKey}
            active={sortKey !== "recent"}
            accentColor={theme.accent}
          />
        </FilterPillGroup>
      </div>

      {visibleProjects.length === 0 ? (
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
            {t("projects.empty.title")}
          </p>
          <p className="text-xs mt-1" style={{ color: text.muted }}>
            {t("projects.empty.hint")}
          </p>
        </div>
      ) : (
        <div className="mb-projects-grid mb-stagger">
          {visibleProjects.map((project) => {
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
                  className="mb-card-premium mb-card-hover overflow-hidden h-full rounded-[22px]"
                  style={{
                    background: surface.s1,
                    border: `1px solid ${surface.border}`,
                  }}
                >
                  {/* En-tête GRIS discret (comme l'en-tête d'étape) : la couleur
                      du projet ne sert plus de bandeau plein, juste au
                      pictogramme. Titre en texte sombre lisible. */}
                  <div
                    className="mb-project-card-header p-3.5 sm:p-5"
                    style={{
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
                        />
                        <div className="min-w-0">
                          <p
                            className="text-[16px] sm:text-[19px] font-bold leading-tight line-clamp-2"
                            style={{ color: text.primary, overflowWrap: "anywhere" }}
                          >
                            {project.name}
                          </p>
                          {/* Étiquette d'espace : permet de savoir d'un coup
                              d'œil à quel environnement appartient le projet
                              dans la vue agrégée « Tous ». */}
                          <span className="mt-1 inline-flex items-center gap-1.5">
                            <span
                              aria-hidden
                              style={{ width: 6, height: 6, borderRadius: 999, background: workspaceTheme[project.workspace].accent }}
                            />
                            <span className="text-[11px] font-medium" style={{ color: text.muted }}>
                              {workspaceTheme[project.workspace].label}
                            </span>
                          </span>
                        </div>
                      </div>

                      <span className="shrink-0">
                        <Badge variant="status" statusKey={project.status}>
                          {statusLabels[project.status]}
                        </Badge>
                      </span>
                    </div>
                  </div>

                  <div className="p-3.5 sm:p-5" style={{ background: surface.s1 }}>
                    <div className="mb-3">
                      <ProjectPriorityBadge priority={project.priority} compact />
                    </div>

                    <div
                      className="mb-3"
                      style={{
                        paddingLeft: "0.75rem",
                        borderLeft: `3px solid ${theme.accent}`,
                      }}
                    >
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
                            {t("card.blocked")}
                          </span>
                        )}
                        {overdue && (
                          <span style={{ color: statusColor.yellow.text }}>
                            {t("card.overdue")}
                          </span>
                        )}
                        {pendingDecisions.length > 0 && (
                          <span style={{ color: statusColor.yellow.text }}>
                            {pendingDecisions.length === 1 ? t("card.decisionsOne", { count: pendingDecisions.length }) : t("card.decisionsOther", { count: pendingDecisions.length })}
                          </span>
                        )}
                        {inactive && (
                          <span style={{ color: text.muted }}>
                            {t("card.inactive")}
                          </span>
                        )}
                        {indicators.isAtRisk && (
                          <span style={{ color: error.text }}>
                            {t("card.atRisk")}
                          </span>
                        )}
                        {indicators.dueSoonCount > 0 && (
                          <span style={{ color: statusColor.yellow.text }}>
                            {indicators.dueSoonCount === 1 ? t("card.dueSoonOne", { count: indicators.dueSoonCount }) : t("card.dueSoonOther", { count: indicators.dueSoonCount })}
                          </span>
                        )}
                      </div>
                      <div className="flex items-center gap-2 text-xs" style={{ color: text.muted }}>
                        <span>{t("projects.tasksCount", { count: pendingActions })}</span>
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
