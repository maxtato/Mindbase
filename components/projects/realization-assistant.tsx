"use client";

// Assistant IA pour le champ « Réalisation » d'une tâche : on décrit librement
// ce qui a été fait, l'IA le reformule proprement en actions distinctes (une
// par ligne) qu'on peut appliquer au champ.

import { useEffect, useState, useTransition } from "react";
import { useT } from "@/components/i18n/locale-provider";
import { createPortal } from "react-dom";
import { organizeTaskRealizationAction } from "@/app/dashboard/projects/ai-actions";
import { surface, text } from "@/lib/design-tokens";

interface RealizationAssistantProps {
  currentRealization: string;
  accentColor: string;
  onApply: (lines: string[]) => void;
  onClose: () => void;
}

export function RealizationAssistant({
  currentRealization,
  accentColor,
  onApply,
  onClose,
}: RealizationAssistantProps) {
  const t = useT();
  const [draft, setDraft] = useState(currentRealization);
  const [proposed, setProposed] = useState<string[] | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();
  const [mounted, setMounted] = useState(false);

  useEffect(() => setMounted(true), []);

  function reformulate() {
    const content = draft.trim();
    if (!content) {
      setError("Décris d'abord ce que tu as réalisé.");
      return;
    }
    setError(null);
    startTransition(async () => {
      try {
        const { lines } = await organizeTaskRealizationAction({ text: content });
        setProposed(lines);
      } catch (err) {
        setError(err instanceof Error ? err.message : "Erreur IA.");
      }
    });
  }

  if (!mounted) return null;

  return createPortal(
    <div
      className="mb-modal-backdrop"
      onClick={onClose}
      style={{
        position: "fixed",
        inset: 0,
        height: "100dvh",
        zIndex: 90,
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
        aria-label={t("ai.realization.title")}
        className="mb-modal-surface"
        onClick={(event) => event.stopPropagation()}
        style={{
          width: "min(560px, 100%)",
          maxHeight: "calc(100dvh - env(safe-area-inset-top, 0px) - env(safe-area-inset-bottom, 0px) - 96px)",
          display: "flex",
          flexDirection: "column",
          borderRadius: 20,
          overflow: "hidden",
        }}
      >
        <div className="flex items-start justify-between gap-3 px-5 py-4" style={{ borderBottom: `1px solid ${surface.borderSubtle}` }}>
          <div className="min-w-0">
            <p className="text-sm font-semibold" style={{ color: text.primary }}>
              {t("ai.realization.title")}
            </p>
            <p className="mt-0.5 text-[11px]" style={{ color: text.muted }}>
              Décris ce que tu as fait ; l&apos;IA le reformule en actions claires, une par ligne.
            </p>
          </div>
          <button
            type="button"
            onClick={onClose}
            aria-label="Fermer"
            className="shrink-0 rounded-full p-1.5"
            style={{ background: surface.s2, color: text.muted, border: `1px solid ${surface.border}` }}
          >
            <svg width="13" height="13" viewBox="0 0 16 16" fill="none">
              <path d="M4 4l8 8M12 4l-8 8" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" />
            </svg>
          </button>
        </div>

        <div
          className="min-h-0 flex-1 overflow-y-auto px-5 py-4"
          style={{ background: surface.s2, WebkitOverflowScrolling: "touch", overscrollBehavior: "contain" }}
        >
          <label className="text-[10px] font-semibold uppercase tracking-wide" style={{ color: text.muted }}>
            Ce que tu as réalisé
          </label>
          <textarea
            value={draft}
            onChange={(event) => setDraft(event.target.value)}
            placeholder="Ex : j'ai comparé trois fournisseurs, négocié le prix avec le premier et validé le budget transport avec l'équipe…"
            rows={5}
            className="mb-input mt-1.5 w-full rounded-xl px-3 py-2.5 text-[13px] outline-none"
            style={{ background: surface.s1, color: text.primary, border: `1px solid ${surface.border}`, resize: "vertical", lineHeight: 1.5 }}
            autoFocus
          />

          <button
            type="button"
            onClick={reformulate}
            disabled={pending || !draft.trim()}
            className="mt-2.5 rounded-lg px-3 py-2 text-xs font-semibold"
            style={{
              background: accentColor,
              color: "#FFFFFF",
              border: "none",
              cursor: pending || !draft.trim() ? "not-allowed" : "pointer",
              opacity: pending || !draft.trim() ? 0.6 : 1,
            }}
          >
            {pending ? "Reformulation…" : proposed ? "Reformuler à nouveau" : "Reformuler"}
          </button>

          {proposed && (
            <div className="mt-3 rounded-xl p-3" style={{ background: surface.s1, border: `1px solid ${accentColor}` }}>
              <p className="text-[10px] font-semibold uppercase tracking-wide" style={{ color: text.muted }}>
                Réalisation reformulée
              </p>
              {proposed.length > 0 ? (
                <ul className="mt-1.5 flex flex-col gap-1.5">
                  {proposed.map((line, index) => (
                    <li key={index} className="flex items-start gap-2 text-[13px] leading-relaxed" style={{ color: text.primary }}>
                      <span aria-hidden style={{ marginTop: 6, width: 5, height: 5, borderRadius: 999, background: accentColor, flexShrink: 0 }} />
                      <span className="min-w-0">{line}</span>
                    </li>
                  ))}
                </ul>
              ) : (
                <p className="mt-1 text-[12px]" style={{ color: text.muted }}>
                  Rien à reformuler.
                </p>
              )}
              {proposed.length > 0 && (
                <button
                  type="button"
                  onClick={() => onApply(proposed)}
                  className="mt-2.5 rounded-lg px-3 py-2 text-xs font-semibold"
                  style={{ background: accentColor, color: "#FFFFFF", border: "none", cursor: "pointer" }}
                >
                  Utiliser ce texte
                </button>
              )}
            </div>
          )}

          {error && (
            <p className="mt-3 text-[11px]" style={{ color: "var(--mb-status-red-text)" }}>
              {error}
            </p>
          )}
        </div>
      </div>
    </div>,
    document.body,
  );
}
