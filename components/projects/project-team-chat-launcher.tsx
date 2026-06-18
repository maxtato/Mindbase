"use client";

import { useEffect, useMemo, useRef, useState, useTransition, type FormEvent } from "react";
import { useRouter } from "next/navigation";
import { appendProjectTeamMessageAction } from "@/app/dashboard/projects/[id]/actions";
import type { ProjectPerson, ProjectTeamMessage } from "@/lib/mock-data";
import { statusColor, surface, text } from "@/lib/design-tokens";
import { getActiveAccountPersonId } from "@/lib/current-account";
import { useAccountName } from "@/components/account/account-context";

interface ProjectTeamChatLauncherProps {
  projectId: string;
  people?: ProjectPerson[];
  messages?: ProjectTeamMessage[];
  accentColor: string;
}

// Détecte un jeton « @partiel » juste avant le curseur (début de chaîne ou
// espace, puis lettres/chiffres accentués) → filtre les collaborateurs.
function findMentionToken(value: string, caret: number): { start: number; query: string } | null {
  const upto = value.slice(0, caret);
  const match = /(^|\s)@([\p{L}\p{N}._-]*)$/u.exec(upto);
  if (!match) return null;
  return { start: match.index + match[1].length, query: match[2] };
}

function normalizeName(value: string) {
  return value.normalize("NFD").replace(new RegExp("[\\u0300-\\u036f]", "g"), "").toLowerCase();
}

export function ProjectTeamChatLauncher({
  projectId,
  people = [],
  messages = [],
  accentColor,
}: ProjectTeamChatLauncherProps) {
  const router = useRouter();
  const accountName = useAccountName();
  const [isOpen, setIsOpen] = useState(false);
  const [content, setContent] = useState("");
  const [isPending, startTransition] = useTransition();
  const [pending, setPending] = useState<ProjectTeamMessage[]>([]);
  // Suivi « lu » local : on retient (sur l'appareil) la date de dernière
  // ouverture du chat pour ce projet → la pastille ne compte que les messages
  // des AUTRES arrivés depuis, jamais les miens.
  const seenKey = `mb-chat-seen-${projectId}`;
  const [seenAt, setSeenAt] = useState<string | null>(null);
  const [mounted, setMounted] = useState(false);
  useEffect(() => {
    setMounted(true);
    try {
      setSeenAt(window.localStorage.getItem(seenKey));
    } catch {
      /* stockage indisponible */
    }
  }, [seenKey]);

  // Mentions @ pilotées par la frappe.
  const [mention, setMention] = useState<{ start: number; query: string } | null>(null);
  const [mentionActive, setMentionActive] = useState(0);
  const textareaRef = useRef<HTMLTextAreaElement | null>(null);
  const mentionsRef = useRef<HTMLDivElement | null>(null);

  const isMine = (message: ProjectTeamMessage) =>
    normalizeName(message.authorName) === normalizeName(accountName);

  // Nombre de messages NON LUS des autres (jamais les miens). 0 avant montage
  // pour ne pas diverger entre SSR et hydratation.
  const unreadCount = mounted
    ? messages.filter((m) => !isMine(m) && (!seenAt || m.createdAt > seenAt)).length
    : 0;

  function markChatSeen() {
    const now = new Date().toISOString();
    setSeenAt(now);
    try {
      window.localStorage.setItem(seenKey, now);
    } catch {
      /* stockage indisponible */
    }
  }

  function openChat() {
    markChatSeen();
    setIsOpen(true);
  }

  // Messages en ordre chronologique (anciens en haut, récents en bas) + envois
  // optimistes locaux non encore renvoyés par le serveur (dédupe author|content).
  const chronological = useMemo(() => {
    const persistedKeys = new Set(messages.map((m) => `${m.authorName}|${m.content}`));
    const stillPending = pending.filter((m) => !persistedKeys.has(`${m.authorName}|${m.content}`));
    return [...messages, ...stillPending];
  }, [messages, pending]);

  const mentionMatches = useMemo(() => {
    if (!mention || !mention.query) return people;
    const q = normalizeName(mention.query);
    return people.filter((person) => normalizeName(person.name).includes(q));
  }, [mention, people]);
  const pickerOpen = mention != null && mentionMatches.length > 0;

  useEffect(() => {
    if (!mention) return;
    function handleClickOutside(event: MouseEvent) {
      if (mentionsRef.current && !mentionsRef.current.contains(event.target as Node)) {
        setMention(null);
      }
    }
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, [mention]);

  function handleContentChange(event: React.ChangeEvent<HTMLTextAreaElement>) {
    const value = event.target.value;
    const caret = event.target.selectionStart ?? value.length;
    setContent(value);
    setMention(findMentionToken(value, caret));
    setMentionActive(0);
  }

  function insertMention(name: string) {
    if (mention) {
      const before = content.slice(0, mention.start);
      const after = content.slice(mention.start + 1 + mention.query.length);
      setContent(`${before}@${name} ${after.replace(/^\s+/, "")}`);
      setMention(null);
    }
    setMentionActive(0);
    textareaRef.current?.focus();
  }

  function submitMessage(event: FormEvent) {
    event.preventDefault();
    const cleaned = content.trim();
    if (!cleaned) return;
    const optimistic: ProjectTeamMessage = {
      id: `local_${Date.now()}`,
      authorName: accountName,
      authorPersonId: getActiveAccountPersonId(people, accountName),
      content: cleaned,
      createdAt: new Date().toISOString(),
    };
    setPending((current) => [...current, optimistic]);
    setContent("");
    setMention(null);

    startTransition(async () => {
      try {
        await appendProjectTeamMessageAction(projectId, {
          authorName: accountName,
          authorPersonId: getActiveAccountPersonId(people, accountName),
          content: cleaned,
        });
        router.refresh();
      } catch (error) {
        console.error("[team_chat] send failed", error);
        setPending((current) => current.filter((m) => m.id !== optimistic.id));
        setContent(cleaned);
      }
    });
  }

  return (
    <>
      <button
        type="button"
        onClick={openChat}
        className="mb-project-top-action mb-project-icon-action"
        style={{
          background: surface.s1,
          color: messages.length > 0 ? accentColor : text.secondary,
          borderColor: messages.length > 0 ? accentColor : surface.border,
        }}
        title={`Chat projet${unreadCount > 0 ? ` · ${unreadCount} non lu${unreadCount > 1 ? "s" : ""}` : ""}`}
        aria-label="Chat projet"
      >
        <TeamChatIcon />
        {/* Pastille = uniquement les messages NON LUS des autres. */}
        {unreadCount > 0 && (
          <span className="mb-project-action-dot" style={{ background: accentColor }} aria-hidden="true">
            {unreadCount > 9 ? "9+" : unreadCount}
          </span>
        )}
      </button>

      {isOpen && (
        <div className="mb-modal-backdrop fixed inset-0 z-[90] flex items-center justify-center px-4 py-6">
          <div className="mb-modal-surface w-full max-w-2xl rounded-[22px] p-5" style={{ color: text.primary }}>
            <div className="mb-4 flex items-start justify-between gap-3">
              <div>
                <p className="text-[11px] font-semibold uppercase tracking-[0.14em]" style={{ color: text.dim }}>
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
              {/* Fil de discussion : mes messages à GAUCHE, ceux des autres à
                  DROITE (dans une couleur différente) — comme dans une tâche. */}
              <div className="max-h-[360px] overflow-y-auto rounded-2xl p-3" style={{ background: surface.s1 }}>
                {chronological.length === 0 ? (
                  <p className="text-sm" style={{ color: text.muted }}>
                    Aucun message pour l’instant. Ajoute une première note d’équipe.
                  </p>
                ) : (
                  <div className="flex flex-col gap-1.5">
                    {chronological.map((message) => (
                      <TeamChatBubble
                        key={message.id}
                        message={message}
                        mine={isMine(message)}
                        accentColor={accentColor}
                      />
                    ))}
                  </div>
                )}
              </div>

              <form onSubmit={submitMessage} className="grid gap-2 rounded-2xl p-3" style={{ background: surface.s1 }}>
                <div className="rounded-xl px-3 py-2 text-xs" style={{ background: surface.s2, color: text.muted }}>
                  Envoyé comme <strong style={{ color: text.secondary }}>{accountName}</strong>
                </div>
                <div ref={mentionsRef} style={{ position: "relative" }}>
                  <textarea
                    ref={textareaRef}
                    value={content}
                    onChange={handleContentChange}
                    onKeyDown={(event) => {
                      if (mention && mentionMatches.length > 0) {
                        if (event.key === "ArrowDown") {
                          event.preventDefault();
                          setMentionActive((prev) => Math.min(prev + 1, mentionMatches.length - 1));
                          return;
                        }
                        if (event.key === "ArrowUp") {
                          event.preventDefault();
                          setMentionActive((prev) => Math.max(prev - 1, 0));
                          return;
                        }
                        if (event.key === "Enter") {
                          event.preventDefault();
                          insertMention((mentionMatches[mentionActive] ?? mentionMatches[0]).name);
                          return;
                        }
                        if (event.key === "Escape") {
                          event.preventDefault();
                          setMention(null);
                          return;
                        }
                      }
                    }}
                    placeholder="Écrire un message d’équipe… (@ pour mentionner)"
                    rows={3}
                    className="w-full resize-none rounded-xl px-3 py-2 text-sm outline-none"
                    style={{ background: surface.s2, color: text.primary }}
                  />

                  {pickerOpen && (
                    <div
                      role="listbox"
                      style={{
                        position: "absolute",
                        bottom: "calc(100% + 6px)",
                        left: 0,
                        zIndex: 10,
                        minWidth: 220,
                        maxHeight: 220,
                        overflowY: "auto",
                        padding: 6,
                        background: surface.s1,
                        border: `1px solid ${surface.borderSubtle}`,
                        borderRadius: 12,
                        boxShadow: "var(--mb-shadow-md)",
                        display: "flex",
                        flexDirection: "column",
                        gap: 1,
                      }}
                    >
                      <p style={{ fontSize: 9.5, fontWeight: 600, color: text.muted, margin: "4px 8px", textTransform: "uppercase", letterSpacing: "0.08em" }}>
                        {mention?.query ? `Résultats pour « ${mention.query} »` : "Collaborateurs du projet"}
                      </p>
                      {mentionMatches.map((person, index) => (
                        <button
                          key={person.id}
                          type="button"
                          onMouseEnter={() => setMentionActive(index)}
                          onClick={() => insertMention(person.name)}
                          className="flex items-center gap-2 rounded-lg px-2 py-1.5 text-left"
                          style={{
                            background: index === mentionActive ? surface.s2 : "transparent",
                            border: "none",
                            color: text.secondary,
                            fontSize: 12,
                            cursor: "pointer",
                          }}
                        >
                          <span
                            aria-hidden
                            className="inline-flex h-6 w-6 items-center justify-center rounded-full text-[10px] font-bold text-white"
                            style={{ background: accentColor }}
                          >
                            {person.name.slice(0, 1).toUpperCase()}
                          </span>
                          <span style={{ fontWeight: 500 }}>@{person.name}</span>
                        </button>
                      ))}
                    </div>
                  )}
                </div>
                <button
                  type="submit"
                  disabled={isPending || !content.trim()}
                  className="h-10 rounded-xl px-4 text-sm font-semibold"
                  style={{ background: accentColor, color: "#FFFFFF" }}
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

function TeamChatBubble({
  message,
  mine,
  accentColor,
}: {
  message: ProjectTeamMessage;
  mine: boolean;
  accentColor: string;
}) {
  return (
    <div className={`flex ${mine ? "justify-start" : "justify-end"}`}>
      <div
        className="max-w-[82%] px-3 py-2"
        style={{
          background: mine ? surface.s2 : `color-mix(in srgb, ${accentColor} 16%, transparent)`,
          color: text.primary,
          borderRadius: 14,
          borderTopLeftRadius: mine ? 5 : 14,
          borderTopRightRadius: mine ? 14 : 5,
          border: mine ? `1px solid ${surface.borderSubtle}` : `1px solid color-mix(in srgb, ${accentColor} 32%, transparent)`,
        }}
      >
        <div className="mb-0.5 flex items-center justify-between gap-2">
          <span className="truncate text-[10px] font-semibold" style={{ color: mine ? text.muted : accentColor }}>
            {mine ? "Moi" : message.authorName}
          </span>
          <span className="shrink-0 text-[9px]" style={{ color: text.dim }}>
            {new Date(message.createdAt).toLocaleString("fr-FR", { day: "2-digit", month: "short", hour: "2-digit", minute: "2-digit" })}
          </span>
        </div>
        <p className="text-[12.5px] leading-relaxed" style={{ color: text.secondary }}>
          {message.content}
        </p>
      </div>
    </div>
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
