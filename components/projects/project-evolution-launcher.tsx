"use client";

import { useRef, useState, useTransition, useEffect } from "react";
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

type ChatMessage = { role: "user" | "assistant"; content: string };

const KIND_BADGE: Record<string, { label: string; bg: string; fg: string }> = {
  add_step: { label: "Étape", bg: "var(--mb-status-blue-bg)", fg: "var(--mb-status-blue-text)" },
  add_task: { label: "Tâche", bg: "var(--mb-status-green-bg)", fg: "var(--mb-status-green-text)" },
  update_task: { label: "Maj", bg: "var(--mb-status-yellow-bg)", fg: "var(--mb-status-yellow-text)" },
};

export function ProjectEvolutionLauncher({ projectId, accentColor }: ProjectEvolutionLauncherProps) {
  const [open, setOpen] = useState(false);
  const [draft, setDraft] = useState("");
  const [transcript, setTranscript] = useState<ChatMessage[]>([]);
  const [items, setItems] = useState<EvolutionPlanItem[] | null>(null);
  const [selected, setSelected] = useState<Set<number>>(new Set());
  const [error, setError] = useState<string | null>(null);
  const [doneMsg, setDoneMsg] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();
  const scrollRef = useRef<HTMLDivElement>(null);

  // Auto-scroll en bas du fil à chaque nouveau message / proposition.
  useEffect(() => {
    if (scrollRef.current) scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
  }, [transcript, items]);

  const started = transcript.length > 0;
  // Tant qu'on n'a pas de plan, on est en mode conversation.
  const conversing = items === null;
  const lastIsQuestion = transcript[transcript.length - 1]?.role === "assistant";

  function reset() {
    setDraft("");
    setTranscript([]);
    setItems(null);
    setSelected(new Set());
    setError(null);
    setDoneMsg(null);
  }

  function close() {
    setOpen(false);
    reset();
  }

  function send() {
    const content = draft.trim();
    if (!content) return;
    const nextTranscript: ChatMessage[] = [...transcript, { role: "user", content }];
    setTranscript(nextTranscript);
    setDraft("");
    setError(null);
    setDoneMsg(null);

    startTransition(async () => {
      try {
        const result = await analyzeProjectEvolutionAction({ projectId, messages: nextTranscript });
        if (result.mode === "question" && result.question) {
          setTranscript((current) => [...current, { role: "assistant", content: result.question! }]);
          setItems(null);
        } else {
          if (result.summary) {
            setTranscript((current) => [...current, { role: "assistant", content: result.summary }]);
          }
          setItems(result.items);
          setSelected(new Set(result.items.map((_, index) => index)));
        }
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
        reset();
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

  function onInputKeyDown(event: React.KeyboardEvent<HTMLTextAreaElement>) {
    // Entrée = envoyer ; Maj+Entrée = nouvelle ligne.
    if (event.key === "Enter" && !event.shiftKey) {
      event.preventDefault();
      if (!pending && draft.trim()) send();
    }
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
        title="Discuter avec Léa pour faire évoluer le projet"
      >
        <SparkleIcon />
        Léa
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
            aria-label="Léa — faire évoluer le projet"
            className="mb-modal-surface"
            onClick={(event) => event.stopPropagation()}
            style={{
              width: "min(600px, 100%)",
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
                <p className="flex items-center gap-1.5 text-sm font-semibold" style={{ color: text.primary }}>
                  <span style={{ color: accentColor }}><SparkleIcon /></span>
                  Léa
                </p>
                <p className="mt-0.5 text-[11px]" style={{ color: text.muted }}>
                  Demande-lui des idées, une liste d&apos;options, ou décris ton avancement.
                  Léa dialogue avec toi puis propose une évolution du projet à valider.
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

            {/* Conversation + plan */}
            <div ref={scrollRef} className="min-h-0 flex-1 overflow-y-auto px-5 py-4" style={{ background: surface.s2 }}>
              {!started && (
                <p className="text-[12px] leading-relaxed" style={{ color: text.muted }}>
                  Ex. : « Liste-moi les parcs nationaux de l&apos;Ouest américain » ou « On a validé
                  la maquette, Paul prend le paiement ». Léa te répond, te demande lesquels retenir
                  / des précisions, puis propose les étapes et tâches à appliquer.
                </p>
              )}

              {/* Fil de discussion */}
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
                    Léa réfléchit…
                  </div>
                )}
              </div>

              {/* Plan proposé */}
              {items && items.length > 0 && (
                <div className="mt-4">
                  <p className="mb-2 text-[10.5px] font-semibold uppercase tracking-wide" style={{ color: text.muted }}>
                    Changements proposés — décoche ce que tu ne veux pas
                  </p>
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
                </div>
              )}

              {items && items.length === 0 && (
                <p className="mt-3 text-[12px]" style={{ color: text.muted }}>
                  L&apos;IA n&apos;a proposé aucun changement.
                </p>
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

            {/* Zone de saisie / actions */}
            <div className="px-5 py-3" style={{ borderTop: `1px solid ${surface.borderSubtle}` }}>
              {conversing ? (
                <div className="flex items-end gap-2">
                  <textarea
                    value={draft}
                    onChange={(event) => setDraft(event.target.value)}
                    onKeyDown={onInputKeyDown}
                    placeholder={lastIsQuestion ? "Ta réponse à Léa…" : "Demande à Léa : une idée, une liste, un avancement…"}
                    rows={lastIsQuestion ? 2 : 3}
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
                    {pending ? "…" : lastIsQuestion ? "Répondre" : "Envoyer"}
                  </button>
                </div>
              ) : (
                <div className="flex items-center justify-end gap-2">
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
                </div>
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
