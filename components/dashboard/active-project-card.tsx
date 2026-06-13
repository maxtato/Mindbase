// Grande carte projet actif — pour la section "Mes projets actifs".
// Affiche : nom, objectif court, statut, santé, priorité, barre d'avancement,
// prochaine action, échéance proche, bouton Ouvrir.

import Link from "next/link";
import type { Project } from "@/lib/mock-data";
import { computeProjectHealth, getHealthVisual } from "@/lib/project-health";
import { surface, text, statusColor, error as errorTokens } from "@/lib/design-tokens";
import { priorityVisuals } from "@/lib/project-taxonomy";

interface ActiveProjectCardProps {
  project: Project;
  workspace: string;
}

const STATUS_LABELS: Record<Project["status"], string> = {
  preparing: "À préparer",
  active: "En cours",
  paused: "En pause",
  "on-hold": "En pause",
  completed: "Terminé",
  archived: "Archivé",
};

const STATUS_TONES: Record<Project["status"], string> = {
  preparing: statusColor.gray.text,
  active: statusColor.green.text,
  paused: statusColor.yellow.text,
  "on-hold": statusColor.yellow.text,
  completed: statusColor.blue.text,
  archived: statusColor.gray.text,
};

export function ActiveProjectCard({ project, workspace }: ActiveProjectCardProps) {
  const health = computeProjectHealth(project);
  const healthVisual = getHealthVisual(health.level);
  const priority = priorityVisuals[project.priority];
  const projectHref = `/dashboard/projects/${project.id}?workspace=${workspace}`;
  const statusLabel = STATUS_LABELS[project.status];
  const statusTone = STATUS_TONES[project.status];

  return (
    <article
      className="overflow-hidden rounded-2xl"
      style={{
        background: surface.s1,
        border: `1px solid ${surface.borderSubtle}`,
        boxShadow: "var(--mb-shadow-card)",
      }}
    >
      {/* Bande horizontale en haut, couleur projet */}
      <span aria-hidden style={{ display: "block", height: 3, background: "#111114" }} />

      <div className="flex flex-col gap-3 p-4">
        {/* Header : nom + santé */}
        <div className="flex items-start justify-between gap-3">
          <Link
            href={projectHref}
            className="min-w-0 truncate text-[15px] font-bold leading-snug"
            style={{ color: text.primary, letterSpacing: "-0.01em" }}
          >
            {project.name}
          </Link>
          <span
            className="inline-flex shrink-0 items-center gap-1.5 rounded-full px-2 py-0.5 text-[10px] font-semibold"
            style={{ background: healthVisual.bg, color: healthVisual.text, border: `1px solid ${healthVisual.text}` }}
          >
            <span aria-hidden style={{ width: 5, height: 5, borderRadius: "50%", background: healthVisual.text }} />
            {healthVisual.label}
          </span>
        </div>

        {/* Objectif court */}
        {project.objective && (
          <p className="line-clamp-2 text-[12px] leading-snug" style={{ color: text.secondary }}>
            {project.objective}
          </p>
        )}

        {/* Pills statut + priorité */}
        <div className="flex flex-wrap items-center gap-1.5">
          <Pill bg={`color-mix(in srgb, ${statusTone} 14%, transparent)`} color={statusTone}>
            {statusLabel}
          </Pill>
          <Pill bg={priority.bg} color={priority.text}>
            Priorité {priority.label.toLowerCase()}
          </Pill>
          {health.metrics.dueLabel && (
            <Pill bg={statusColor.yellow.bg} color={statusColor.yellow.text}>
              Échéance {health.metrics.dueLabel}
            </Pill>
          )}
          {health.metrics.blockedCount > 0 && (
            <Pill bg={errorTokens.bg} color={errorTokens.text}>
              {health.metrics.blockedCount} bloquée{health.metrics.blockedCount > 1 ? "s" : ""}
            </Pill>
          )}
        </div>

        {/* Barre d'avancement avec % */}
        <div>
          <div className="mb-1 flex items-center justify-between">
            <span className="text-[10.5px] font-semibold uppercase tracking-[0.1em]" style={{ color: text.muted }}>
              Avancement
            </span>
            <span className="text-[12px] font-bold" style={{ color: text.primary, fontVariantNumeric: "tabular-nums" }}>
              {project.progress}%
            </span>
          </div>
          <div
            style={{
              height: 6,
              background: surface.s2,
              borderRadius: 999,
              overflow: "hidden",
              border: `1px solid ${surface.borderSubtle}`,
            }}
          >
            <span
              style={{
                display: "block",
                height: "100%",
                width: `${Math.min(100, Math.max(0, project.progress))}%`,
                background: text.primary,
                borderRadius: 999,
              }}
            />
          </div>
        </div>

        {/* Prochaine action + bouton */}
        <div
          className="flex items-center justify-between gap-2 rounded-xl px-3 py-2"
          style={{ background: surface.s2, border: `1px solid ${surface.borderSubtle}` }}
        >
          <div className="min-w-0">
            <p className="text-[10px] font-semibold uppercase tracking-[0.1em]" style={{ color: text.muted }}>
              Prochaine action
            </p>
            <p className="mt-0.5 truncate text-[12px] font-semibold" style={{ color: text.primary }}>
              {health.nextAction.label}
            </p>
          </div>
          <Link
            href={health.nextAction.href ?? projectHref}
            className="shrink-0 rounded-lg px-3 py-1.5 text-[11px] font-semibold"
            style={{ background: "#111114", color: "#FFFFFF", border: "none" }}
          >
            Ouvrir
          </Link>
        </div>
      </div>
    </article>
  );
}

function Pill({ bg, color, children }: { bg: string; color: string; children: React.ReactNode }) {
  return (
    <span
      className="inline-flex items-center rounded-full px-2 py-0.5 text-[10px] font-semibold"
      style={{ background: bg, color }}
    >
      {children}
    </span>
  );
}
