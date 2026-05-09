"use client";

import { useRef, useState, type FormEvent } from "react";
import { surface, text } from "@/lib/design-tokens";
import { workspaceTheme, type Workspace } from "@/lib/workspace";

interface TaskChangeDetailDialogProps {
  workspace: Workspace;
  title: string;
  subtitle?: string;
  description: string;
  label: string;
  placeholder: string;
  confirmLabel: string;
  /** Si true, le détail est optionnel : l'utilisateur choisit d'abord
   *  "Oui, j'explique" ou "Non, je valide directement". */
  optional?: boolean;
  /** Question affichée en mode optionnel. */
  optionalPrompt?: string;
  onClose: () => void;
  onConfirm: (details: string) => void;
}

export function TaskChangeDetailDialog({
  workspace,
  title,
  subtitle,
  description,
  label,
  placeholder,
  confirmLabel,
  optional = false,
  optionalPrompt = "Voulez-vous ajouter une explication à ce changement ?",
  onClose,
  onConfirm,
}: TaskChangeDetailDialogProps) {
  const theme = workspaceTheme[workspace];
  const [details, setDetails] = useState("");
  const textareaRef = useRef<HTMLTextAreaElement>(null);
  // En mode optionnel, on commence par la question oui/non.
  // En mode obligatoire (défaut), on affiche directement le formulaire.
  const [step, setStep] = useState<"ask" | "form">(optional ? "ask" : "form");
  const canSubmit = optional ? true : details.trim().length > 0;

  function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!canSubmit) return;
    onConfirm(details.trim());
  }

  return (
    <div className="mb-modal-backdrop fixed inset-0 z-50 flex items-center justify-center px-4">
      <form
        onSubmit={handleSubmit}
        className="mb-modal-surface rounded-2xl overflow-hidden"
        style={{ width: "min(520px, 100%)" }}
      >
        <div className="px-5 py-4" style={{ background: theme.solidDark, borderBottom: `1px solid ${theme.solidMid}` }}>
          <div className="flex items-start justify-between gap-3">
            <div className="min-w-0">
              <p className="text-[10px] font-semibold uppercase tracking-[0.16em]" style={{ color: theme.accentText }}>
                Mise à jour manuelle
              </p>
              <h3 className="mt-1 text-base font-semibold leading-tight" style={{ color: text.primary }}>
                {title}
              </h3>
              {subtitle && (
                <p className="mt-1 text-[11px]" style={{ color: text.secondary }}>
                  {subtitle}
                </p>
              )}
            </div>
            <button
              type="button"
              onClick={onClose}
              className="rounded-lg p-2 shrink-0"
              style={{ background: theme.solidMid, color: theme.accentText, border: "none", cursor: "pointer" }}
              title="Annuler"
            >
              <svg width="13" height="13" viewBox="0 0 16 16" fill="none" aria-hidden="true">
                <path d="m4 4 8 8M12 4l-8 8" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" />
              </svg>
            </button>
          </div>
        </div>

        <div className="p-5">
          {step === "ask" ? (
            <>
              <p className="text-sm leading-relaxed" style={{ color: text.primary }}>
                {optionalPrompt}
              </p>
              <p className="mt-1 text-xs leading-relaxed" style={{ color: text.muted }}>
                {description}
              </p>
              <div className="mt-5 flex items-center justify-end gap-2">
                <button
                  type="button"
                  onClick={() => onConfirm("")}
                  className="rounded-xl px-4 py-2.5 text-xs font-medium"
                  style={{
                    background: surface.s2,
                    color: text.secondary,
                    border: `1px solid ${surface.border}`,
                    cursor: "pointer",
                  }}
                >
                  Non, valider sans note
                </button>
                <button
                  type="button"
                  onClick={() => {
                    setStep("form");
                    requestAnimationFrame(() => textareaRef.current?.focus());
                  }}
                  className="rounded-xl px-4 py-2.5 text-xs font-semibold"
                  style={{ background: theme.accent, color: "#FFFFFF", border: "none", cursor: "pointer" }}
                >
                  Oui, ajouter une note
                </button>
              </div>
            </>
          ) : (
            <>
              <p className="text-xs leading-relaxed" style={{ color: text.secondary }}>
                {description}
              </p>
              <label className="mt-4 block text-[11px] font-semibold uppercase tracking-[0.14em]" style={{ color: text.muted }}>
                {label}
              </label>
              <textarea
                ref={textareaRef}
                value={details}
                onChange={(event) => setDetails(event.target.value)}
                placeholder={placeholder}
                rows={4}
                className="mt-2 w-full rounded-xl px-3 py-3 text-sm outline-none resize-none"
                style={{ background: surface.s2, color: text.primary, border: `1px solid ${surface.border}` }}
                required={!optional}
                autoFocus={!optional}
              />
              <div
                className="mt-3 rounded-xl px-3 py-2.5 text-xs leading-relaxed"
                style={{ background: surface.s2, color: text.secondary, border: `1px solid ${surface.border}` }}
              >
                Ce détail est ajouté à la tâche pour conserver une trace claire de ce qui a changé.
              </div>
              <div className="mt-4 flex items-center justify-end gap-2">
                <button
                  type="button"
                  onClick={optional ? () => setStep("ask") : onClose}
                  className="rounded-xl px-4 py-2.5 text-xs font-medium"
                  style={{ background: surface.s2, color: text.secondary, border: `1px solid ${surface.border}`, cursor: "pointer" }}
                >
                  {optional ? "Retour" : "Annuler"}
                </button>
                <button
                  type="submit"
                  disabled={!canSubmit}
                  className="rounded-xl px-4 py-2.5 text-xs font-semibold"
                  style={{
                    background: canSubmit ? theme.accent : surface.s3,
                    color: canSubmit ? "#FFFFFF" : text.dim,
                    border: "none",
                    cursor: canSubmit ? "pointer" : "not-allowed",
                  }}
                >
                  {confirmLabel}
                </button>
              </div>
            </>
          )}
        </div>
      </form>
    </div>
  );
}
