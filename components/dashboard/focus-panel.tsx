import Link from "next/link";
import { surface, text, error as errorTokens, statusColor } from "@/lib/design-tokens";
import { getHealthVisual } from "@/lib/project-health";
import type { DailyFocus, FocusAction, FocusAttentionProject, FocusTone } from "@/lib/project-focus";

interface FocusPanelProps {
  focus: DailyFocus;
  dateLabel: string;
  accent: string;
  workspaceLabel: string;
}

const TONE: Record<FocusTone, { bg: string; fg: string }> = {
  danger: { bg: errorTokens.bg, fg: errorTokens.text },
  warn: { bg: statusColor.yellow.bg, fg: statusColor.yellow.text },
  info: { bg: statusColor.blue.bg, fg: statusColor.blue.text },
  neutral: { bg: statusColor.gray.bg, fg: statusColor.gray.text },
};

// Bloc « Focus / Aujourd'hui » : la première chose qu'on voit en arrivant.
// Répond à « qu'est-ce que je fais maintenant et qu'est-ce qui dérive ? ».
export function FocusPanel({ focus, dateLabel, accent, workspaceLabel }: FocusPanelProps) {
  return (
    <section
      className="relative flex flex-col gap-4 rounded-[22px] p-5 lg:p-6"
      style={{
        background: `linear-gradient(180deg, color-mix(in srgb, ${accent} 7%, ${surface.s1}) 0%, ${surface.s1} 60%)`,
        border: `1px solid ${surface.borderSubtle}`,
        boxShadow: "var(--mb-shadow-xs)",
      }}
    >
      <div className="min-w-0">
        <p className="text-[10px] font-semibold uppercase tracking-[0.16em]" style={{ color: accent }}>
          Focus · {workspaceLabel} · {dateLabel}
        </p>
        <h1
          className="mt-1.5 text-[1.5rem] font-bold leading-tight sm:text-[1.95rem]"
          style={{ color: text.primary, letterSpacing: "-0.02em" }}
        >
          {focus.brief}
        </h1>
      </div>

      {focus.allClear ? (
        <AllClear />
      ) : (
        <div className="grid gap-4 lg:grid-cols-2">
          <FocusColumn title="À faire en priorité" count={focus.actions.length}>
            {focus.actions.length === 0 ? (
              <Muted label="Aucune action urgente. Profite-en pour préparer la suite." />
            ) : (
              focus.actions.map((action) => <ActionRow key={action.key} action={action} />)
            )}
          </FocusColumn>

          <FocusColumn title="Projets à surveiller" count={focus.counts.attention}>
            {focus.attention.length === 0 ? (
              <Muted label="Aucun projet en dérive. Tout avance sereinement." />
            ) : (
              focus.attention.map((project) => <AttentionRow key={project.key} project={project} />)
            )}
          </FocusColumn>
        </div>
      )}
    </section>
  );
}

function FocusColumn({ title, count, children }: { title: string; count: number; children: React.ReactNode }) {
  return (
    <div className="flex min-w-0 flex-col gap-2">
      <div className="flex items-center gap-2 px-0.5">
        <h2 className="text-[11px] font-bold uppercase tracking-[0.1em]" style={{ color: text.muted }}>
          {title}
        </h2>
        {count > 0 && (
          <span className="text-[11px] font-semibold" style={{ color: text.ghost }}>
            · {count}
          </span>
        )}
      </div>
      <div className="flex flex-col gap-1.5">{children}</div>
    </div>
  );
}

function ActionRow({ action }: { action: FocusAction }) {
  const tone = TONE[action.tone];
  return (
    <Link
      href={action.href}
      className="flex min-w-0 items-center gap-2.5 rounded-xl px-3 py-2.5"
      style={{ background: surface.s2, border: `1px solid ${surface.borderSubtle}` }}
    >
      <span
        className="shrink-0 rounded-full px-2 py-0.5 text-[10px] font-bold"
        style={{ background: tone.bg, color: tone.fg }}
      >
        {action.tag}
      </span>
      <span className="flex min-w-0 flex-1 flex-col">
        <span className="truncate text-[12.5px] font-semibold" style={{ color: text.primary }}>
          {action.title}
        </span>
        <span className="flex min-w-0 items-center gap-1.5">
          <span aria-hidden className="inline-block h-1.5 w-1.5 shrink-0 rounded-full" style={{ background: action.projectColor }} />
          <span className="truncate text-[10.5px]" style={{ color: text.muted }}>
            {action.projectName}
          </span>
        </span>
      </span>
      <Chevron />
    </Link>
  );
}

function AttentionRow({ project }: { project: FocusAttentionProject }) {
  const visual = getHealthVisual(project.level);
  return (
    <Link
      href={project.href}
      className="flex min-w-0 flex-col gap-1 rounded-xl px-3 py-2.5"
      style={{ background: surface.s2, border: `1px solid ${surface.borderSubtle}`, borderLeft: `3px solid ${visual.rail}` }}
    >
      <span className="flex min-w-0 items-center gap-2">
        <span className="truncate text-[12.5px] font-semibold" style={{ color: text.primary }}>
          {project.name}
        </span>
        <span
          className="shrink-0 rounded-full px-1.5 py-0.5 text-[9.5px] font-bold uppercase tracking-[0.06em]"
          style={{ background: visual.bg, color: visual.text }}
        >
          {visual.label}
        </span>
      </span>
      <span className="text-[11px] leading-snug" style={{ color: text.muted }}>
        {project.causeShort}
      </span>
      <span className="mt-0.5 inline-flex items-center gap-1 text-[11px] font-semibold" style={{ color: visual.text }}>
        {project.actionLabel}
        <Chevron color={visual.text} />
      </span>
    </Link>
  );
}

function AllClear() {
  return (
    <div
      className="flex items-center gap-3 rounded-xl px-4 py-4"
      style={{ background: statusColor.green.bg, border: `1px solid ${surface.borderSubtle}` }}
    >
      <span aria-hidden style={{ fontSize: 18 }}>
        ✓
      </span>
      <p className="text-[12.5px] font-medium" style={{ color: statusColor.green.text }}>
        Rien ne réclame ton attention pour l'instant. Tout est planifié et sous contrôle.
      </p>
    </div>
  );
}

function Muted({ label }: { label: string }) {
  return (
    <p className="rounded-xl px-3 py-3 text-[11.5px]" style={{ background: surface.s2, color: text.muted, border: `1px solid ${surface.borderSubtle}` }}>
      {label}
    </p>
  );
}

function Chevron({ color }: { color?: string }) {
  return (
    <svg width="13" height="13" viewBox="0 0 16 16" fill="none" aria-hidden className="shrink-0" style={{ opacity: 0.6 }}>
      <path d="M6 4l4 4-4 4" stroke={color ?? "currentColor"} strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  );
}
