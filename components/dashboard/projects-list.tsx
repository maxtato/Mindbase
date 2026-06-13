"use client";

import { useState } from "react";
import Link from "next/link";
import { Badge, statusLabels } from "@/components/ui/badge";
import { ProgressBar } from "@/components/ui/progress-bar";
import { ProjectIdentityEditor } from "@/components/projects/project-identity-editor";
import { surface, text, error, statusColor } from "@/lib/design-tokens";
import type { Project } from "@/lib/mock-data";
import { calculateProjectIndicators, deriveTaskStatus } from "@/lib/project-plan";

const INITIAL_COUNT = 3;

interface ProjectsListProps {
  projects: Project[];
  qs: string;
}

export function ProjectsList({ projects, qs }: ProjectsListProps) {
  const [expanded, setExpanded] = useState(false);
  const visible = expanded ? projects : projects.slice(0, INITIAL_COUNT);
  const hidden = projects.length - INITIAL_COUNT;

  return (
    <div className="flex flex-col" style={{ gap: "0.75rem" }}>
      {visible.map((project) => {
        const steps = project.steps ?? [];
        const hasSteps = steps.length > 0;
        const allTasks = steps.flatMap((s) => s.tasks);
        const pendingTasksCount = hasSteps
          ? allTasks.filter((t) => deriveTaskStatus(t) !== "done").length
          : project.actions.filter((a) => !a.done).length;
        const openProjectBlockers = project.blockers.filter((b) => b.status === "open");
        const indicators = calculateProjectIndicators(project);

        return (
          <Link key={project.id} href={`/dashboard/projects/${project.id}?${qs}`}>
            <div
              className="mb-card-premium mb-card-hover overflow-hidden"
              style={{ background: surface.s1, border: `1px solid ${surface.border}`, borderRadius: 24 }}
            >
              {/* En-tête noir minimaliste (couleur uniquement dans le picto) */}
              <div
                className="px-5 py-4"
                style={{ background: "#111114", borderBottom: `1px solid ${surface.borderSubtle}` }}
              >
                <div className="flex items-center justify-between gap-3">
                  <div className="flex items-center gap-3 min-w-0">
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
                      <p className="text-[19px] font-bold truncate" style={{ color: "#ffffff" }}>
                        {project.name}
                      </p>
                    </div>
                  </div>
                  <Badge variant="onColor" statusKey={project.status}>
                    {statusLabels[project.status]}
                  </Badge>
                </div>
              </div>

              {/* Card body */}
              <div className="px-5 py-4" style={{ background: surface.s1 }}>
                {/* Objective */}
                <div
                  className="mb-3"
                  style={{ paddingLeft: "0.75rem", borderLeft: `3px solid ${surface.border}` }}
                >
                  <p className="text-[10px] font-semibold uppercase tracking-widest mb-1" style={{ color: text.muted }}>
                    Objectif
                  </p>
                  <p className="text-sm line-clamp-3" style={{ color: text.primary, fontWeight: 500, lineHeight: 1.55 }}>
                    {project.objective}
                  </p>
                </div>

                {/* Progress */}
                <div className="flex items-center gap-3 mb-3">
                  <ProgressBar value={project.progress} color={text.primary} />
                  <span className="text-xs shrink-0 tabular-nums font-semibold" style={{ color: text.secondary }}>
                    {project.progress}%
                  </span>
                </div>

                {/* Footer stats */}
                <div className="flex items-center justify-between gap-3 flex-wrap">
                  <div className="flex items-center gap-3 text-xs flex-wrap">
                    {openProjectBlockers.length > 0 && (
                      <span className="flex items-center gap-1.5" style={{ color: error.text }}>
                        <span className="w-1.5 h-1.5 rounded-full" style={{ background: error.dot }} />
                        {openProjectBlockers.length} bloqué{openProjectBlockers.length > 1 ? "s" : ""}
                      </span>
                    )}
                    {indicators.hasCriticalBlockage && (
                      <span className="flex items-center gap-1.5" style={{ color: error.text }}>
                        Blocage critique
                      </span>
                    )}
                    {indicators.dueSoonCount > 0 && (
                      <span style={{ color: statusColor.yellow.text }}>
                        {indicators.dueSoonCount} échéance{indicators.dueSoonCount > 1 ? "s" : ""} proche{indicators.dueSoonCount > 1 ? "s" : ""}
                      </span>
                    )}
                  </div>
                  <span className="text-xs" style={{ color: text.muted }}>
                    {hasSteps
                      ? `${steps.filter((s) => s.status === "done").length}/${steps.length} étapes · ${pendingTasksCount} tâche${pendingTasksCount !== 1 ? "s" : ""} restante${pendingTasksCount !== 1 ? "s" : ""}`
                      : `${pendingTasksCount} tâche${pendingTasksCount !== 1 ? "s" : ""}`
                    }
                  </span>
                </div>
              </div>
            </div>
          </Link>
        );
      })}

      {!expanded && hidden > 0 && (
        <button
          onClick={() => setExpanded(true)}
          className="mb-card-premium mb-card-subtle mb-card-hover w-full rounded-2xl py-3 text-xs font-semibold"
          style={{ background: surface.s1, border: `1px solid ${surface.border}`, color: text.muted }}
        >
          Voir {hidden} projet{hidden > 1 ? "s" : ""} de plus
        </button>
      )}
      {expanded && projects.length > INITIAL_COUNT && (
        <button
          onClick={() => setExpanded(false)}
          className="mb-card-premium mb-card-subtle mb-card-hover w-full rounded-2xl py-3 text-xs font-semibold"
          style={{ background: surface.s1, border: `1px solid ${surface.border}`, color: text.muted }}
        >
          Réduire
        </button>
      )}
    </div>
  );
}
