"use client";

import { useState, useTransition } from "react";
import {
  analyzeProjectEvolutionAction,
  applyProjectEvolutionAction,
  type EvolutionPlanItem,
} from "@/app/dashboard/projects/ai-actions";
import { surface, text } from "@/lib/design-tokens";

interface ProjectEvolutionLauncherProps {
  projectId: string;
  accentColor: string;
}

const KIND_BADGE: Record<string, { label: string; bg: string; fg: string }> = {
  add_step: { label: "Étape", bg: "var(--mb-status-blue-bg)", fg: "var(--mb-status-blue-text)" },
  add_task: { label: "Tâche", bg: "var(--mb-status-green-bg)", fg: "var(--mb-status-green-text)" },
  update_task: { label: "Maj", bg: "var(--mb-status-yellow-bg)", fg: "var(--mb-status-yellow-text)" },
};

export function ProjectEvolutionLauncher({ projectId, accentColor }: ProjectEvolutionLauncherProps) {
  const [open, setOpen] = useState(false);
  const [note, setNote] = useState("");
  const [items, setItems] = useState<EvolutionPlanItem[] | null>(null);
  const [summary, setSummary] = useState("");
  const [selected, setSelected] = useState<Set<number>>(new Set());
  const [error, setError] = useState<string | null>(null);
  const [doneMsg, setDoneMsg] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();

  function reset() {
    setNote("");
    setItems(null);
    setSummary("");
    setSelected(new Set());
    setError(null);
    setDoneMsg(null);
  }

  function close() {
    setOpen(false);
    reset();
  }

  function analyze() {
    setError(null);
    setDoneMsg(null);
    startTransition(async () => {
      try {
        const result = await analyzeProjectEvolutionAction({ projectId, text: note });
        setSummary(result.summary);
        setItems(result.items);
        setSelected(new Set(result.items.map((_, index) => index)));
      } catch (err) {
        setError(err instanceof Error ? err.message : "Erreur IA inconnue.");
      }
    });
  }

  function apply() {
    if (!items) return;
    const operations = items.filter((_, index) => selected.has(index)).map((item) => item.op);
    if (operations.length === 0) return;
    setError(null);
    startTransition(async () => {
      try {
        const { applied } = await applyProjectEvolutionAction({ projectId, operations });
        setItems(null);
        setSummary("");
        setSelected(new Set());
        setNote("");
        setDoneMsg(`${applied} changement${applied > 1 ? "s" : ""} appliqué${applied > 1 ? "s" : ""} au projet.`);
      } catch (err) {
        setError(err instanceof Error ? err.message : "Application impossible.");
      }
    });
  }

  function toggle(index: number) {
    setSelected((prev) => {
      const next = new Set(prev);
      if (next.has(index)) next.delete(index);
      else next.add(index);
      return next;
    });
  }

  const selectedCount = selected.size;

  return (
    <>
      <button
        type="button"
        onClick={() => setOpen(true)}
        className="inline-flex items-center justify-center gap-2 rounded-full px-4 py-2.5 text-[13px] font-bold"
        style={{
          background: accentColor,
          color: "#FFFFFF",
          border: "none",
          cursor: "pointer",
          boxShadow: `0 8px 20px -8px ${accentColor}`,
          whiteSpace: "nowrap",
        }}
        title="Coller une note / un compte-rendu pour faire évoluer le projet avec l'IA"
      >
        <SparkleIcon />
        Assistant IA
      </button>

      {open && (
        <div
          className="mb-modal-backdrop"
          onClick={close}
          style={{
            position: "fixed",
            inset: 0,
            zIndex: 80,
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            padding:
              "calc(env(safe-area-inset-top, 0px) + 16px) calc(env(safe-area-inset-right, 0px) + 16px) calc(env(safe-area-inset-bottom, 0px) + 16px) calc(env(safe-area-inset-left, 0px) + 16px)",
          }}
        >
          <div
            role="dialog"
            aria-modal="true"
            aria-label="Faire évoluer le projet à partir d'une note"
            className="mb-modal-surface"
            onClick={(event) => event.stopPropagation()}
            style={{
              width: "min(580px, 100%)",
              maxHeight: "100%",
              display: "flex",
              flexDirection: "column",
              borderRadius: "20px",
              overflow: "hidden",
            }}
          >
            {/* Header */}
            <div
              className="flex items-start justify-between gap-3 px-5 py-4"
              style={{ borderBottom: `1px solid ${surface.borderSubtle}` }}
            >
              <div className="min-w-0">
                <p className="text-sm font-semibold" style={{ color: text.primary }}>
                  Faire évoluer le projet
                </p>
                <p className="mt-0.5 text-[11px]" style={{ color: text.muted }}>
                  Colle une note, un compte-rendu ou un mail. L&apos;IA propose les changements
                  (étapes, tâches, statuts, dates, personnes).
                </p>
              </div>
              <button
                type="button"
                onClick={close}
                aria-label="Fermer"
                className="shrink-0 rounded-full p-1.5"
                style={{ background: surface.s2, color: text.muted, border: `1px solid ${surface.border}` }}
              >
                <CloseIcon />
              </button>
            </div>

            {/* Body */}
            <div className="min-h-0 flex-1 overflow-y-auto px-5 py-4" style={{ background: surface.s2 }}>
              {!items ? (
                <textarea
                  value={note}
                  onChange={(event) => setNote(event.target.value)}
                  placeholder="Ex. : « RDV client OK, la maquette est validée. Paul prend le dev du paiement pour vendredi prochain. Le volet juridique est bloqué tant qu'on n'a pas le retour de l'avocat. »"
                  rows={7}
                  className="mb-input w-full rounded-xl px-3 py-3 text-sm outline-none"
                  style={{ background: surface.s1, color: text.primary, border: `1px solid ${surface.border}`, resize: "vertical" }}
                  autoFocus
                />
              ) : (
                <div className="flex flex-col gap-3">
                  {summary && (
                    <div
                      className="rounded-xl px-3 py-2.5 text-[12px] leading-relaxed"
                      style={{ background: surface.s1, color: text.secondary, border: `1px solid ${surface.borderSubtle}` }}
                    >
                      {summary}
                    </div>
                  )}

                  {items.length === 0 ? (
                    <p className="text-[12px]" style={{ color: text.muted }}>
                      L&apos;IA n&apos;a proposé aucun changement à partir de ce texte.
                    </p>
                  ) : (
                    <ul className="flex flex-col gap-2">
                      {items.map((item, index) => {
                        const badge = KIND_BADGE[item.op.type] ?? KIND_BADGE.update_task;
                        const isSelected = selected.has(index);
                        return (
                          <li key={index}>
                            <button
                              type="button"
                              onClick={() => toggle(index)}
                              className="flex w-full items-start gap-2.5 rounded-xl px-3 py-2.5 text-left"
                              style={{
                                background: surface.s1,
                                border: `1px solid ${isSelected ? accentColor : surface.borderSubtle}`,
                                opacity: isSelected ? 1 : 0.55,
                                cursor: "pointer",
                              }}
                            >
                              <span
                                aria-hidden="true"
                                className="mt-0.5 flex h-4 w-4 shrink-0 items-center justify-center rounded-md text-[10px]"
                                style={{
                                  background: isSelected ? accentColor : "transparent",
                                  border: `1.5px solid ${isSelected ? accentColor : surface.borderHover}`,
                                  color: "#FFFFFF",
                                }}
                              >
                                {isSelected ? "✓" : ""}
                              </span>
                              <span className="min-w-0 flex-1">
                                <span className="flex items-center gap-2">
                                  <span
                                    className="rounded-full px-1.5 py-0.5 text-[9.5px] font-semibold uppercase tracking-wide"
                                    style={{ background: badge.bg, color: badge.fg }}
                                  >
                                    {badge.label}
                                  </span>
                                  <span className="truncate text-[12.5px] font-semibold" style={{ color: text.primary }}>
                                    {item.title}
                                  </span>
                                </span>
                                {item.detail && (
                                  <span className="mt-1 block text-[11px] leading-snug" style={{ color: text.muted }}>
                                    {item.detail}
                                  </span>
                                )}
                              </span>
                            </button>
                          </li>
                        );
                      })}
                    </ul>
                  )}
                </div>
              )}

              {error && (
                <p className="mt-3 text-[11px]" style={{ color: "var(--mb-status-red-text)" }}>
                  {error}
                </p>
              )}
              {doneMsg && (
                <p className="mt-3 text-[11px] font-semibold" style={{ color: "var(--mb-status-green-text)" }}>
                  ✓ {doneMsg}
                </p>
              )}
            </div>

            {/* Footer */}
            <div
              className="flex items-center justify-end gap-2 px-5 py-3"
              style={{ borderTop: `1px solid ${surface.borderSubtle}` }}
            >
              {!items ? (
                <>
                  <button
                    type="button"
                    onClick={close}
                    className="rounded-lg px-3 py-2 text-xs font-semibold"
                    style={{ background: surface.s2, color: text.secondary, border: `1px solid ${surface.border}`, cursor: "pointer" }}
                  >
                    Annuler
                  </button>
                  <button
                    type="button"
                    onClick={analyze}
                    disabled={pending || !note.trim()}
                    className="rounded-lg px-3 py-2 text-xs font-semibold"
                    style={{
                      background: accentColor,
                      color: "#FFFFFF",
                      border: "none",
                      cursor: pending || !note.trim() ? "not-allowed" : "pointer",
                      opacity: pending || !note.trim() ? 0.6 : 1,
                    }}
                  >
                    {pending ? "Analyse…" : "Analyser"}
                  </button>
                </>
              ) : (
                <>
                  <button
                    type="button"
                    onClick={reset}
                    disabled={pending}
                    className="rounded-lg px-3 py-2 text-xs font-semibold"
                    style={{ background: surface.s2, color: text.secondary, border: `1px solid ${surface.border}`, cursor: "pointer" }}
                  >
                    Recommencer
                  </button>
                  <button
                    type="button"
                    onClick={apply}
                    disabled={pending || selectedCount === 0}
                    className="rounded-lg px-3 py-2 text-xs font-semibold"
                    style={{
                      background: accentColor,
                      color: "#FFFFFF",
                      border: "none",
                      cursor: pending || selectedCount === 0 ? "not-allowed" : "pointer",
                      opacity: pending || selectedCount === 0 ? 0.6 : 1,
                    }}
                  >
                    {pending ? "Application…" : `Appliquer (${selectedCount})`}
                  </button>
                </>
              )}
            </div>
          </div>
        </div>
      )}
    </>
  );
}

function SparkleIcon() {
  return (
    <svg width="14" height="14" viewBox="0 0 16 16" fill="none" aria-hidden="true">
      <path
        d="M8 1.5l1.4 3.6L13 6.5l-3.6 1.4L8 11.5 6.6 7.9 3 6.5l3.6-1.4L8 1.5z"
        fill="currentColor"
      />
      <path d="M12.5 10.5l.7 1.8 1.8.7-1.8.7-.7 1.8-.7-1.8-1.8-.7 1.8-.7.7-1.8z" fill="currentColor" opacity="0.85" />
    </svg>
  );
}

function CloseIcon() {
  return (
    <svg width="13" height="13" viewBox="0 0 16 16" fill="none" aria-hidden="true">
      <path d="M4 4l8 8M12 4l-8 8" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" />
    </svg>
  );
}
