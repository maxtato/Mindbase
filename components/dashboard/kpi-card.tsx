"use client";

// Carte KPI sobre — chiffre prééminent, libellé court, dot coloré optionnel.
// Utilisée dans la rangée du haut du dashboard. Pas de gradient, pas de bling.
// Quand `tasks` est fourni, la carte devient cliquable et ouvre un popover
// listant les tâches concernées.

import Link from "next/link";
import { useEffect, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { surface, text } from "@/lib/design-tokens";
import { useT } from "@/components/i18n/locale-provider";
import { useOpenStandalone } from "@/components/dashboard/standalone-open-provider";

export type KpiTone = "neutral" | "info" | "success" | "warn" | "danger" | "critical";

export interface KpiTask {
  key: string;
  title: string;
  projectName: string;
  projectColor: string;
  href: string;
  meta?: string;
  metaTone?: "default" | "danger" | "warn" | "success";
  /** Si défini, l'élément ouvre la tâche libre correspondante (drawer) au lieu
   *  de naviguer vers `href`. */
  standaloneId?: string;
}

interface KpiCardProps {
  label: string;
  value: number | string;
  /** Texte secondaire (ex : "+2 cette semaine"). Optionnel. */
  hint?: string;
  tone?: KpiTone;
  href?: string;
  /** Si fourni, la carte ouvre un popover listant les tâches concernées. */
  tasks?: KpiTask[];
  /** Texte affiché si tasks est vide (et qu'on clique pour ouvrir). */
  emptyLabel?: string;
}

const TONE_PALETTE: Record<KpiTone, { dot: string; ring: string }> = {
  neutral: { dot: "var(--mb-text-muted)", ring: "var(--mb-border-subtle)" },
  info: { dot: "var(--mb-status-blue-text)", ring: "color-mix(in srgb, var(--mb-status-blue-text) 28%, transparent)" },
  success: { dot: "var(--mb-status-green-text)", ring: "color-mix(in srgb, var(--mb-status-green-text) 28%, transparent)" },
  warn: { dot: "var(--mb-status-yellow-text)", ring: "color-mix(in srgb, var(--mb-status-yellow-text) 28%, transparent)" },
  danger: { dot: "var(--mb-status-orange-text)", ring: "color-mix(in srgb, var(--mb-status-orange-text) 28%, transparent)" },
  critical: { dot: "var(--mb-status-red-text)", ring: "color-mix(in srgb, var(--mb-status-red-text) 35%, transparent)" },
};

const META_TONE_COLOR: Record<NonNullable<KpiTask["metaTone"]>, string> = {
  default: "var(--mb-text-muted)",
  danger: "var(--mb-error-text)",
  warn: "var(--mb-status-yellow-text)",
  success: "var(--mb-status-green-text)",
};

export function KpiCard({ label, value, hint, tone = "neutral", href, tasks, emptyLabel }: KpiCardProps) {
  const t = useT();
  const palette = TONE_PALETTE[tone];
  const showPopover = Array.isArray(tasks);
  const [open, setOpen] = useState(false);
  const [triggerRect, setTriggerRect] = useState<DOMRect | null>(null);
  const triggerRef = useRef<HTMLButtonElement | HTMLAnchorElement | HTMLDivElement | null>(null);
  const popoverRef = useRef<HTMLDivElement | null>(null);

  useEffect(() => {
    if (!open) return;
    function handleClick(event: MouseEvent) {
      const target = event.target as Node;
      if (triggerRef.current?.contains(target)) return;
      if (popoverRef.current?.contains(target)) return;
      setOpen(false);
    }
    function handleScroll(event: Event) {
      // Ne PAS fermer si c'est la liste du popover elle-même qu'on scrolle —
      // seul un scroll de la PAGE (qui désaligne le popover ancré) le ferme.
      const node = event.target as Node | null;
      if (node && popoverRef.current?.contains(node)) return;
      setOpen(false);
    }
    function handleKey(event: KeyboardEvent) {
      if (event.key === "Escape") setOpen(false);
    }
    document.addEventListener("mousedown", handleClick);
    window.addEventListener("scroll", handleScroll, true);
    window.addEventListener("resize", handleScroll);
    document.addEventListener("keydown", handleKey);
    return () => {
      document.removeEventListener("mousedown", handleClick);
      window.removeEventListener("scroll", handleScroll, true);
      window.removeEventListener("resize", handleScroll);
      document.removeEventListener("keydown", handleKey);
    };
  }, [open]);

  function toggle() {
    if (open) {
      setOpen(false);
      return;
    }
    const rect = triggerRef.current?.getBoundingClientRect();
    if (!rect) return;
    setTriggerRect(rect);
    setOpen(true);
  }

  const cardStyle = {
    background: surface.s1,
    border: `1px solid ${surface.borderSubtle}`,
    boxShadow: "var(--mb-shadow-card)",
    textDecoration: "none",
  } as const;

  const cardClass = "block rounded-2xl px-4 py-3.5 transition-colors";

  const inner = (
    <>
      <div className="flex items-center justify-between gap-2">
        <p className="text-[11px] font-semibold uppercase tracking-[0.14em]" style={{ color: text.muted }}>
          {label}
        </p>
        <span
          aria-hidden
          className="block shrink-0 rounded-full"
          style={{ width: 6, height: 6, aspectRatio: "1 / 1", background: palette.dot, boxShadow: `0 0 0 3px ${palette.ring}` }}
        />
      </div>
      <p
        className="mt-2 text-[26px] font-bold leading-none"
        style={{ color: text.primary, fontVariantNumeric: "tabular-nums", letterSpacing: "-0.01em" }}
      >
        {value}
      </p>
      {hint && (
        <p className="mt-1 text-[11px]" style={{ color: text.muted }}>
          {hint}
        </p>
      )}
    </>
  );

  if (showPopover) {
    return (
      <>
        <button
          ref={triggerRef as React.RefObject<HTMLButtonElement>}
          type="button"
          onClick={toggle}
          aria-haspopup="dialog"
          aria-expanded={open}
          className={`${cardClass} text-left`}
          style={{ ...cardStyle, cursor: "pointer", width: "100%" }}
        >
          {inner}
        </button>
        {open && triggerRect && typeof document !== "undefined"
          ? createPortal(
              <KpiPopover
                ref={popoverRef}
                anchor={triggerRect}
                title={label}
                tasks={tasks ?? []}
                emptyLabel={emptyLabel ?? t("dashboard.kpi.emptyDefault")}
                onClose={() => setOpen(false)}
              />,
              document.body,
            )
          : null}
      </>
    );
  }

  if (href) {
    return (
      <Link href={href} className={cardClass} style={cardStyle}>
        {inner}
      </Link>
    );
  }

  return (
    <div className={cardClass} style={cardStyle}>
      {inner}
    </div>
  );
}

interface KpiPopoverProps {
  anchor: DOMRect;
  title: string;
  tasks: KpiTask[];
  emptyLabel: string;
  onClose: () => void;
}

const KpiPopover = function KpiPopover({
  ref,
  anchor,
  title,
  tasks,
  emptyLabel,
  onClose,
}: KpiPopoverProps & { ref: React.RefObject<HTMLDivElement | null> }) {
  // Calcul de la position : aligné sur la carte, sous elle, avec une marge.
  const margin = 8;
  const width = Math.max(280, Math.min(360, anchor.width * 1.6));
  const top = anchor.bottom + margin;
  // Aligne à droite de la carte si on est trop près du bord droit de la fenêtre.
  const wantedLeft = anchor.left;
  const overflowRight = wantedLeft + width - (window.innerWidth - 12);
  const left = overflowRight > 0 ? Math.max(12, wantedLeft - overflowRight) : wantedLeft;

  return (
    <div
      ref={ref}
      role="dialog"
      aria-label={title}
      style={{
        position: "fixed",
        top,
        left,
        width,
        maxHeight: "min(60vh, 480px)",
        overflowY: "auto",
        overscrollBehavior: "contain",
        WebkitOverflowScrolling: "touch",
        zIndex: 9999,
        background: surface.s1,
        border: `1px solid ${surface.border}`,
        borderRadius: 14,
        boxShadow: "var(--mb-shadow-md)",
        padding: 8,
      }}
    >
      <div className="flex items-center justify-between gap-2 px-2 pt-1 pb-2">
        <p
          style={{
            fontSize: 11,
            fontWeight: 700,
            color: text.muted,
            textTransform: "uppercase",
            letterSpacing: "0.1em",
            margin: 0,
          }}
        >
          {title}
        </p>
        <span
          style={{
            fontSize: 11,
            fontWeight: 600,
            color: text.muted,
            fontVariantNumeric: "tabular-nums",
          }}
        >
          {tasks.length}
        </span>
      </div>
      {tasks.length === 0 ? (
        <p
          style={{
            margin: 0,
            padding: "10px 8px 12px",
            fontSize: 11.5,
            color: text.muted,
            fontStyle: "italic",
          }}
        >
          {emptyLabel}
        </p>
      ) : (
        <ul style={{ display: "flex", flexDirection: "column", gap: 2, margin: 0, padding: 0, listStyle: "none" }}>
          {tasks.map((task) => (
            <li key={task.key}>
              <KpiTaskRow task={task} onClose={onClose} />
            </li>
          ))}
        </ul>
      )}
    </div>
  );
};

const ROW_STYLE = {
  display: "block",
  padding: "8px 10px",
  background: "transparent",
  color: text.primary,
  textDecoration: "none",
  border: "1px solid transparent",
  transition: "background-color 120ms var(--mb-ease), border-color 120ms var(--mb-ease)",
} as const;

function hoverOn(event: React.MouseEvent<HTMLElement>) {
  event.currentTarget.style.background = surface.s2;
  event.currentTarget.style.borderColor = surface.borderSubtle;
}
function hoverOff(event: React.MouseEvent<HTMLElement>) {
  event.currentTarget.style.background = "transparent";
  event.currentTarget.style.borderColor = "transparent";
}

function KpiTaskRow({ task, onClose }: { task: KpiTask; onClose: () => void }) {
  const openStandalone = useOpenStandalone();
  const content = (
    <div className="flex min-w-0 items-start gap-2">
      <span
        aria-hidden
        style={{ width: 7, height: 7, borderRadius: "50%", background: task.projectColor, flexShrink: 0, marginTop: 5 }}
      />
      <div style={{ flex: 1, minWidth: 0 }}>
        <p
          className="mb-task-title"
          style={{ margin: 0, fontSize: 12, fontWeight: 600, color: text.primary, lineHeight: 1.3, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}
        >
          {task.title}
        </p>
        <p
          style={{ margin: "2px 0 0", fontSize: 10.5, color: text.muted, lineHeight: 1.3, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}
        >
          {task.projectName}
        </p>
      </div>
      {task.meta && (
        <span style={{ fontSize: 10.5, fontWeight: 600, color: META_TONE_COLOR[task.metaTone ?? "default"], flexShrink: 0, whiteSpace: "nowrap" }}>
          {task.meta}
        </span>
      )}
    </div>
  );

  // Tâche libre : on ouvre la tâche en place (drawer) plutôt que de naviguer
  // vers l'onglet Tâches.
  if (task.standaloneId) {
    return (
      <button
        type="button"
        onClick={() => {
          onClose();
          openStandalone(task.standaloneId!);
        }}
        className="block min-w-0 rounded-lg"
        style={{ ...ROW_STYLE, width: "100%", textAlign: "left", cursor: "pointer" }}
        onMouseEnter={hoverOn}
        onMouseLeave={hoverOff}
      >
        {content}
      </button>
    );
  }

  return (
    <Link
      href={task.href}
      onClick={onClose}
      className="block min-w-0 rounded-lg"
      style={ROW_STYLE}
      onMouseEnter={hoverOn}
      onMouseLeave={hoverOff}
    >
      {content}
    </Link>
  );
}
