"use client";

// Assistant IA conversationnel pour le champ « Attendu » d'une tâche : on
// dialogue avec l'IA (questions/précisions) et elle propose une formulation
// d'attendu qu'on peut appliquer au champ.

import { useEffect, useRef, useState, useTransition } from "react";
import { createPortal } from "react-dom";
import { refineTaskExpectedAction } from "@/app/dashboard/projects/ai-actions";
import { surface, text } from "@/lib/design-tokens";

type ChatMessage = { role: "user" | "assistant"; content: string };

interface ExpectedAssistantProps {
  projectId: string;
  stepId: string;
  taskId: string;
  currentExpected: string;
  accentColor: string;
  onApply: (expected: string) => void;
  onClose: () => void;
}

export function ExpectedAssistant({
  projectId,
  stepId,
  taskId,
  currentExpected,
  accentColor,
  onApply,
  onClose,
}: ExpectedAssistantProps) {
  const [draft, setDraft] = useState("");
  const [transcript, setTranscript] = useState<ChatMessage[]>([]);
  const [proposed, setProposed] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();
  const [mounted, setMounted] = useState(false);
  const scrollRef = useRef<HTMLDivElement>(null);

  useEffect(() => setMounted(true), []);

  useEffect(() => {
    if (scrollRef.current) scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
  }, [transcript, proposed, pending]);

  function send() {
    const content = draft.trim();
    if (!content) return;
    const next: ChatMessage[] = [...transcript, { role: "user", content }];
    setTranscript(next);
    setDraft("");
    setError(null);
    startTransition(async () => {
      try {
        const result = await refineTaskExpectedAction({ projectId, stepId, taskId, messages: next });
        setTranscript((current) => [...current, { role: "assistant", content: result.reply }]);
        setProposed(result.mode === "proposal" ? result.expected : null);
      } catch (err) {
        setError(err instanceof Error ? err.message : "Erreur IA.");
      }
    });
  }

  function onKeyDown(event: React.KeyboardEvent<HTMLTextAreaElement>) {
    if (event.key === "Enter" && !event.shiftKey) {
      event.preventDefault();
      if (!pending && draft.trim()) send();
    }
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
        aria-label="Assistant IA — Attendu"
        className="mb-modal-surface"
        onClick={(event) => event.stopPropagation()}
        style={{
          width: "min(560px, 100%)",
          maxHeight: "calc(100dvh - env(safe-area-inset-top, 0px) - env(safe-area-inset-bottom, 0px) - 32px)",
          display: "flex",
          flexDirection: "column",
          borderRadius: 20,
          overflow: "hidden",
        }}
      >
        <div className="flex items-start justify-between gap-3 px-5 py-4" style={{ borderBottom: `1px solid ${surface.borderSubtle}` }}>
          <div className="min-w-0">
            <p className="text-sm font-semibold" style={{ color: text.primary }}>
              Assistant IA — Attendu
            </p>
            <p className="mt-0.5 text-[11px]" style={{ color: text.muted }}>
              Dialogue pour préciser ce qui est attendu ; l&apos;IA propose une formulation à appliquer.
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
          ref={scrollRef}
          className="min-h-0 flex-1 overflow-y-auto px-5 py-4"
          style={{ background: surface.s2, WebkitOverflowScrolling: "touch", overscrollBehavior: "contain" }}
        >
          {transcript.length === 0 && (
            <p className="text-[12px] leading-relaxed" style={{ color: text.muted }}>
              {currentExpected
                ? `Attendu actuel : « ${currentExpected} ». Dis ce que tu veux clarifier ou améliorer.`
                : "Décris l'objectif de la tâche : l'IA te proposera une formulation claire de l'attendu."}
            </p>
          )}

          <div className="flex flex-col gap-2.5">
            {transcript.map((message, index) => (
              <div
                key={index}
                className="max-w-[88%] rounded-2xl px-3 py-2 text-[12.5px] leading-relaxed"
                style={
                  message.role === "user"
                    ? { alignSelf: "flex-end", background: accentColor, color: "#FFFFFF", borderBottomRightRadius: 6 }
                    : { alignSelf: "flex-start", background: surface.s1, color: text.primary, border: `1px solid ${surface.borderSubtle}`, borderBottomLeftRadius: 6 }
                }
              >
                {message.content}
              </div>
            ))}
            {pending && (
              <div
                className="max-w-[88%] rounded-2xl px-3 py-2 text-[12px] italic"
                style={{ alignSelf: "flex-start", background: surface.s1, color: text.muted, border: `1px solid ${surface.borderSubtle}` }}
              >
                L&apos;assistant réfléchit…
              </div>
            )}
          </div>

          {proposed && (
            <div className="mt-3 rounded-xl p-3" style={{ background: surface.s1, border: `1px solid ${accentColor}` }}>
              <p className="text-[10px] font-semibold uppercase tracking-wide" style={{ color: text.muted }}>
                Attendu proposé
              </p>
              <p className="mt-1 text-[13px] leading-relaxed" style={{ color: text.primary }}>
                {proposed}
              </p>
              <button
                type="button"
                onClick={() => onApply(proposed)}
                className="mt-2.5 rounded-lg px-3 py-2 text-xs font-semibold"
                style={{ background: accentColor, color: "#FFFFFF", border: "none", cursor: "pointer" }}
              >
                Utiliser ce texte
              </button>
            </div>
          )}

          {error && (
            <p className="mt-3 text-[11px]" style={{ color: "var(--mb-status-red-text)" }}>
              {error}
            </p>
          )}
        </div>

        <div className="px-5 py-3" style={{ borderTop: `1px solid ${surface.borderSubtle}` }}>
          <div className="flex items-end gap-2">
            <textarea
              value={draft}
              onChange={(event) => setDraft(event.target.value)}
              onKeyDown={onKeyDown}
              placeholder={proposed ? "Demande un ajustement…" : "Ex : insiste sur le livrable, ajoute une contrainte de budget…"}
              rows={2}
              className="mb-input min-w-0 flex-1 rounded-xl px-3 py-2.5 text-sm outline-none"
              style={{ background: surface.s1, color: text.primary, border: `1px solid ${surface.border}`, resize: "none" }}
              autoFocus
            />
            <button
              type="button"
              onClick={send}
              disabled={pending || !draft.trim()}
              className="shrink-0 rounded-xl px-3.5 py-2.5 text-xs font-semibold"
              style={{
                background: accentColor,
                color: "#FFFFFF",
                border: "none",
                cursor: pending || !draft.trim() ? "not-allowed" : "pointer",
                opacity: pending || !draft.trim() ? 0.6 : 1,
              }}
            >
              {pending ? "…" : "Envoyer"}
            </button>
          </div>
        </div>
      </div>
    </div>,
    document.body,
  );
}
