// Carte projet "À surveiller" pour le dashboard.
// Visuel sobre et premium : bande verticale colorée à gauche, badge de niveau,
// cause courte, mini-indicateurs, action recommandée avec bouton.

import Link from "next/link";
import type { Project } from "@/lib/mock-data";
import { computeProjectHealth, getHealthVisual } from "@/lib/project-health";
import { surface, text } from "@/lib/design-tokens";

interface ProjectHealthCardProps {
  project: Project;
  workspace: string;
}

export function ProjectHealthCard({ project, workspace }: ProjectHealthCardProps) {
  const health = computeProjectHealth(project);
  const visual = getHealthVisual(health.level);
  const projectHref = `/dashboard/projects/${project.id}?workspace=${workspace}`;

  return (
    <article
      className="relative overflow-hidden rounded-2xl"
      style={{
        background: surface.s1,
        border: `1px solid ${surface.borderSubtle}`,
        boxShadow: "var(--mb-shadow-card)",
        paddingLeft: 14,
      }}
    >
      {/* Bande verticale colorée à gauche — guide l'œil sans saturer */}
      <span
        aria-hidden
        style={{
          position: "absolute",
          insetBlock: 0,
          left: 0,
          width: 4,
          background: visual.rail,
          opacity: 0.85,
        }}
      />

      <div className="flex flex-col gap-2 p-4 pl-3">
        {/* Ligne 1 : nom du projet + badge niveau */}
        <div className="flex items-start justify-between gap-3">
          <Link
            href={projectHref}
            className="min-w-0 truncate text-[14px] font-semibold leading-snug"
            style={{ color: text.primary, letterSpacing: "-0.005em" }}
          >
            {project.name}
          </Link>
          <span
            className="inline-flex shrink-0 items-center gap-1.5 rounded-full px-2.5 py-1 text-[10.5px] font-semibold"
            style={{
              background: visual.bg,
              color: visual.text,
              border: `1px solid ${visual.text}`,
            }}
          >
            <span
              aria-hidden
              style={{ width: 6, height: 6, borderRadius: "50%", background: visual.text }}
            />
            {visual.label}
          </span>
        </div>

        {/* Ligne 2 : cause courte */}
        <p className="text-[12px] leading-snug" style={{ color: text.secondary }}>
          {health.causeShort}
        </p>

        {/* Ligne 3 : mini indicateurs */}
        <div className="flex flex-wrap items-center gap-1.5">
          {health.metrics.blockedCount > 0 && (
            <Metric label="Bloquées" value={health.metrics.blockedCount} tone="critical" icon="block" />
          )}
          {health.metrics.overdueCount > 0 && (
            <Metric label="En retard" value={health.metrics.overdueCount} tone="warn" icon="late" />
          )}
          {health.metrics.dueLabel && (
            <Metric label="Échéance" value={health.metrics.dueLabel} tone="info" icon="cal" />
          )}
          {health.metrics.inactivityDays !== undefined && (
            <Metric
              label="Inactif"
              value={`${health.metrics.inactivityDays} j`}
              tone="muted"
              icon="pause"
            />
          )}
          <Metric label="Avancement" value={`${health.metrics.progress}%`} tone="muted" icon="progress" />
        </div>

        {/* Barre d'avancement fine */}
        <div
          aria-hidden
          style={{
            height: 4,
            background: surface.s2,
            borderRadius: 999,
            overflow: "hidden",
          }}
        >
          <span
            style={{
              display: "block",
              height: "100%",
              width: `${Math.min(100, Math.max(0, health.metrics.progress))}%`,
              background: visual.rail,
              borderRadius: 999,
            }}
          />
        </div>

        {/* Ligne 4 : prochaine action + bouton */}
        <div
          className="mt-1 flex items-center justify-between gap-2 rounded-xl px-3 py-2"
          style={{ background: surface.s2, border: `1px solid ${surface.borderSubtle}` }}
        >
          <div className="min-w-0">
            <p
              className="text-[10px] font-semibold uppercase tracking-[0.1em]"
              style={{ color: text.muted }}
            >
              Prochaine action
            </p>
            <p
              className="mt-0.5 truncate text-[12px] font-semibold"
              style={{ color: text.primary }}
            >
              {health.nextAction.label}
            </p>
          </div>
          <Link
            href={health.nextAction.href ?? projectHref}
            className="shrink-0 rounded-lg px-3 py-1.5 text-[11px] font-semibold"
            style={{
              background: visual.rail,
              color: "#FFFFFF",
              border: "none",
            }}
          >
            Ouvrir
          </Link>
        </div>
      </div>
    </article>
  );
}

function Metric({
  label,
  value,
  tone,
  icon,
}: {
  label: string;
  value: string | number;
  tone: "critical" | "warn" | "info" | "muted";
  icon: "block" | "late" | "cal" | "pause" | "progress";
}) {
  const palette: Record<typeof tone, { bg: string; color: string }> = {
    critical: { bg: "var(--mb-status-red-bg)", color: "var(--mb-status-red-text)" },
    warn: { bg: "var(--mb-status-orange-bg)", color: "var(--mb-status-orange-text)" },
    info: { bg: "var(--mb-status-blue-bg)", color: "var(--mb-status-blue-text)" },
    muted: { bg: surface.s2, color: text.muted },
  };
  const { bg, color } = palette[tone];
  return (
    <span
      className="inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-[10.5px] font-semibold"
      style={{ background: bg, color }}
    >
      <MetricIcon icon={icon} />
      <span>
        {label} : {value}
      </span>
    </span>
  );
}

function MetricIcon({ icon }: { icon: "block" | "late" | "cal" | "pause" | "progress" }) {
  if (icon === "block") {
    return (
      <svg width="9" height="9" viewBox="0 0 16 16" fill="none" aria-hidden="true">
        <circle cx="8" cy="8" r="5.5" stroke="currentColor" strokeWidth="1.5" />
        <path d="M4 4l8 8" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" />
      </svg>
    );
  }
  if (icon === "late") {
    return (
      <svg width="9" height="9" viewBox="0 0 16 16" fill="none" aria-hidden="true">
        <circle cx="8" cy="8" r="5.5" stroke="currentColor" strokeWidth="1.5" />
        <path d="M8 5v3l2 1.2" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" />
      </svg>
    );
  }
  if (icon === "cal") {
    return (
      <svg width="9" height="9" viewBox="0 0 16 16" fill="none" aria-hidden="true">
        <rect x="2.5" y="3.5" width="11" height="10" rx="1.4" stroke="currentColor" strokeWidth="1.4" />
        <path d="M2.5 6.5h11M5.5 2.5v2M10.5 2.5v2" stroke="currentColor" strokeWidth="1.4" strokeLinecap="round" />
      </svg>
    );
  }
  if (icon === "pause") {
    return (
      <svg width="9" height="9" viewBox="0 0 16 16" fill="none" aria-hidden="true">
        <rect x="5" y="3.5" width="2" height="9" rx="0.5" fill="currentColor" />
        <rect x="9" y="3.5" width="2" height="9" rx="0.5" fill="currentColor" />
      </svg>
    );
  }
  return (
    <svg width="9" height="9" viewBox="0 0 16 16" fill="none" aria-hidden="true">
      <path d="M2 12h12" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" />
      <path d="M2 12V4" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" />
    </svg>
  );
}
