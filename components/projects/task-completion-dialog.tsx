"use client";

import { useEffect, useRef, useState, type FormEvent } from "react";
import { surface, text } from "@/lib/design-tokens";
import { workspaceTheme, type Workspace } from "@/lib/workspace";

export interface TaskCompletionDialogProps {
  workspace: Workspace;
  projectId: string;
  taskTitle: string;
  taskDescription?: string;
  stepTitle: string;
  stepDescription?: string;
  onClose: () => void;
  onConfirm: (input: { details: string }) => void;
}

export function TaskCompletionDialog({
  workspace,
  taskTitle,
  stepTitle,
  onClose,
  onConfirm,
}: TaskCompletionDialogProps) {
  const theme = workspaceTheme[workspace];
  const [details, setDetails] = useState("");
  const textareaRef = useRef<HTMLTextAreaElement>(null);
  const canSubmit = details.trim().length > 0;

  useEffect(() => {
    const id = window.setTimeout(() => textareaRef.current?.focus(), 30);
    return () => window.clearTimeout(id);
  }, []);

  function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!canSubmit) return;
    onConfirm({ details });
  }

  return (
    <div
      className="mb-modal-backdrop fixed inset-0 z-50 flex items-center justify-center px-4"
    >
      <form
        onSubmit={handleSubmit}
        className="mb-modal-surface rounded-2xl overflow-hidden"
        style={{
          width: "min(580px, 100%)",
        }}
      >
        {/* Header */}
        <div
          className="px-5 py-4"
          style={{ background: theme.solidDark, borderBottom: `1px solid ${theme.solidMid}` }}
        >
          <div className="flex items-start justify-between gap-3">
            <div className="min-w-0 flex-1">
              <p
                className="text-xs font-semibold uppercase tracking-[0.16em]"
                style={{ color: theme.accentText }}
              >
                Tâche terminée
              </p>
              <h3
                className="text-base font-semibold mt-1 leading-tight"
                style={{ color: text.primary }}
              >
                {taskTitle}
              </h3>
              <p className="text-[11px] mt-0.5" style={{ color: text.secondary }}>
                {stepTitle}
              </p>

            </div>
          </div>
        </div>

        <div className="p-5" style={{ display: "flex", flexDirection: "column", gap: "0.9rem" }}>
          {/* Details textarea — always empty, user fills */}
          <div>
            <label
              className="text-[11px] font-semibold uppercase tracking-[0.14em]"
              style={{ color: text.muted }}
            >
              Ce qui a été réalisé
            </label>
            <textarea
              ref={textareaRef}
              value={details}
              onChange={(event) => setDetails(event.target.value)}
              placeholder="Décrivez ce qui a été accompli concrètement…"
              rows={4}
              className="mt-2 w-full rounded-xl px-3 py-3 text-sm outline-none resize-none"
              style={{
                background: surface.s2,
                color: text.primary,
                border: `1px solid ${surface.border}`,
              }}
              required
            />
          </div>

          <div
            className="rounded-xl px-3 py-2.5 text-xs leading-relaxed"
            style={{ background: surface.s2, color: text.secondary, border: `1px solid ${surface.border}` }}
          >
            Ce détail sera enregistré dans le champ Réalisation de la tâche. Les décisions projet restent séparées et sont ajoutées seulement quand un vrai arbitrage important est identifié dans une discussion.
          </div>

          <div className="flex items-center justify-end gap-2">
            <button
              type="button"
              onClick={onClose}
              className="rounded-xl px-4 py-2.5 text-xs font-medium"
              style={{
                background: surface.s2,
                color: text.secondary,
                border: `1px solid ${surface.border}`,
              }}
            >
              Annuler
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
              Valider la tâche
            </button>
          </div>
        </div>
      </form>
    </div>
  );
}
