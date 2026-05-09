"use client";

import { useState, useTransition, type FormEvent } from "react";
import { useRouter } from "next/navigation";
import { appendProjectTeamMessageAction } from "@/app/dashboard/projects/[id]/actions";
import type { ProjectPerson, ProjectTeamMessage } from "@/lib/mock-data";
import { surface, text } from "@/lib/design-tokens";
import { getActiveAccountName, getActiveAccountPersonId } from "@/lib/current-account";

interface ProjectTeamChatLauncherProps {
  projectId: string;
  people?: ProjectPerson[];
  messages?: ProjectTeamMessage[];
  accentColor: string;
}

export function ProjectTeamChatLauncher({
  projectId,
  people = [],
  messages = [],
  accentColor,
}: ProjectTeamChatLauncherProps) {
  const router = useRouter();
  const [isOpen, setIsOpen] = useState(false);
  const [content, setContent] = useState("");
  const [isPending, startTransition] = useTransition();
  const latestMessages = messages.slice(-8).reverse();

  function submitMessage(event: FormEvent) {
    event.preventDefault();
    const cleaned = content.trim();
    if (!cleaned) return;

    startTransition(async () => {
      await appendProjectTeamMessageAction(projectId, {
        authorName: getActiveAccountName(),
        authorPersonId: getActiveAccountPersonId(people),
        content: cleaned,
      });
      setContent("");
      router.refresh();
    });
  }

  return (
    <>
      <button
        type="button"
        onClick={() => setIsOpen(true)}
        className="mb-project-top-action mb-project-icon-action"
        style={{
          background: surface.s1,
          color: messages.length > 0 ? accentColor : text.secondary,
          borderColor: messages.length > 0 ? accentColor : surface.border,
        }}
        title={`Chat projet${messages.length > 0 ? ` · ${messages.length} message${messages.length > 1 ? "s" : ""}` : ""}`}
        aria-label="Chat projet"
      >
        <TeamChatIcon />
        {messages.length > 0 && (
          <span className="mb-project-action-dot" style={{ background: accentColor }} aria-hidden="true">
            {messages.length > 9 ? "9+" : messages.length}
          </span>
        )}
      </button>

      {isOpen && (
        <div className="mb-modal-backdrop fixed inset-0 z-[90] flex items-center justify-center px-4 py-6">
          <div className="mb-modal-surface w-full max-w-2xl rounded-[28px] p-5" style={{ color: text.primary }}>
            <div className="mb-4 flex items-start justify-between gap-3">
              <div>
                <p className="text-[11px] font-semibold uppercase tracking-[0.16em]" style={{ color: text.dim }}>
                  Collaboration
                </p>
                <h2 className="mt-1 text-lg font-bold">Chat collaborateurs</h2>
                <p className="mt-1 text-xs" style={{ color: text.secondary }}>
                  Échanges humains liés au projet.
                </p>
              </div>
              <button
                type="button"
                onClick={() => setIsOpen(false)}
                className="h-9 rounded-xl px-3 text-xs font-semibold"
                style={{ background: surface.s2, color: text.secondary }}
              >
                Fermer
              </button>
            </div>

            <div className="grid gap-3">
              <div className="max-h-[320px] overflow-y-auto rounded-2xl p-3" style={{ background: surface.s1 }}>
                {latestMessages.length === 0 ? (
                  <p className="text-sm" style={{ color: text.muted }}>
                    Aucun message pour l’instant. Ajoute une première note d’équipe.
                  </p>
                ) : (
                  <div className="grid gap-2">
                    {latestMessages.map((message) => (
                      <article key={message.id} className="rounded-2xl p-3" style={{ background: surface.s2 }}>
                        <div className="mb-1 flex items-center justify-between gap-2">
                          <strong className="text-xs" style={{ color: text.primary }}>
                            {message.authorName}
                          </strong>
                          <span className="text-[11px]" style={{ color: text.dim }}>
                            {new Date(message.createdAt).toLocaleString("fr-FR", { day: "2-digit", month: "short", hour: "2-digit", minute: "2-digit" })}
                          </span>
                        </div>
                        <p className="text-sm leading-relaxed" style={{ color: text.secondary }}>
                          {message.content}
                        </p>
                      </article>
                    ))}
                  </div>
                )}
              </div>

              <form onSubmit={submitMessage} className="grid gap-2 rounded-2xl p-3" style={{ background: surface.s1 }}>
                <div className="rounded-xl px-3 py-2 text-xs" style={{ background: surface.s2, color: text.muted }}>
                  Envoyé comme <strong style={{ color: text.secondary }}>{getActiveAccountName()}</strong>
                </div>
                <textarea
                  value={content}
                  onChange={(event) => setContent(event.target.value)}
                  placeholder="Écrire un message d’équipe..."
                  rows={3}
                  className="resize-none rounded-xl px-3 py-2 text-sm outline-none"
                  style={{ background: surface.s2, color: text.primary }}
                />
                <button
                  type="submit"
                  disabled={isPending || !content.trim()}
                  className="h-10 rounded-xl px-4 text-sm font-semibold"
                  style={{ background: surface.s3, color: text.primary }}
                >
                  Envoyer
                </button>
              </form>
            </div>
          </div>
        </div>
      )}
    </>
  );
}

function TeamChatIcon() {
  return (
    <svg width="14" height="14" viewBox="0 0 16 16" fill="none" aria-hidden="true">
      <path d="M3 4.5A2.5 2.5 0 0 1 5.5 2h5A2.5 2.5 0 0 1 13 4.5v2.8A2.5 2.5 0 0 1 10.5 9.8H8.2L5 12.7V9.8A2.5 2.5 0 0 1 3 7.3V4.5Z" stroke="currentColor" strokeWidth="1.35" strokeLinejoin="round" />
      <path d="M6 5.5h4M6 7.4h2.6" stroke="currentColor" strokeWidth="1.35" strokeLinecap="round" />
    </svg>
  );
}
