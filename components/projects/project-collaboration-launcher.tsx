"use client";

import { useState, useTransition, type FormEvent, type ReactNode } from "react";
import { useRouter } from "next/navigation";
import {
  addProjectPersonAction,
  addProjectTeamAction,
  updateProjectTeamAction,
} from "@/app/dashboard/projects/[id]/actions";
import type { ProjectPerson, ProjectTeam } from "@/lib/mock-data";
import { surface, text } from "@/lib/design-tokens";
import { workspaceTheme, type Workspace } from "@/lib/workspace";

interface ProjectCollaborationLauncherProps {
  projectId: string;
  workspace: Workspace;
  people?: ProjectPerson[];
  teams?: ProjectTeam[];
  accentColor: string;
  onColor?: boolean;
}

export function ProjectCollaborationLauncher({
  projectId,
  workspace,
  people = [],
  teams = [],
  accentColor,
  onColor = false,
}: ProjectCollaborationLauncherProps) {
  const router = useRouter();
  const theme = workspaceTheme[workspace];
  const [isOpen, setIsOpen] = useState(false);
  const [isPending, startTransition] = useTransition();
  const [personName, setPersonName] = useState("");
  const [personEmail, setPersonEmail] = useState("");
  const [personRole, setPersonRole] = useState("");
  const [teamName, setTeamName] = useState("");
  const [teamColor, setTeamColor] = useState(accentColor || theme.accent);
  const [teamMemberIds, setTeamMemberIds] = useState<string[]>([]);
  const [editedTeamId, setEditedTeamId] = useState<string>(teams[0]?.id ?? "");
  const editedTeam = teams.find((team) => team.id === editedTeamId);
  const [editedTeamName, setEditedTeamName] = useState(editedTeam?.name ?? "");
  const [editedTeamColor, setEditedTeamColor] = useState(editedTeam?.color ?? accentColor ?? theme.accent);
  const [editedTeamMemberIds, setEditedTeamMemberIds] = useState<string[]>(editedTeam?.memberIds ?? []);

  function submitPerson(event: FormEvent) {
    event.preventDefault();
    const name = personName.trim();
    if (!name) return;
    startTransition(async () => {
      await addProjectPersonAction(projectId, {
        name,
        email: personEmail.trim() || undefined,
        role: personRole.trim() || undefined,
      });
      setPersonName("");
      setPersonEmail("");
      setPersonRole("");
      router.refresh();
    });
  }

  function submitTeam(event: FormEvent) {
    event.preventDefault();
    const name = teamName.trim();
    if (!name) return;
    startTransition(async () => {
      await addProjectTeamAction(projectId, {
        name,
        color: teamColor,
        memberIds: teamMemberIds,
      });
      setTeamName("");
      setTeamMemberIds([]);
      router.refresh();
    });
  }

  function submitTeamUpdate(event: FormEvent) {
    event.preventDefault();
    if (!editedTeamId || !editedTeamName.trim()) return;
    startTransition(async () => {
      await updateProjectTeamAction(projectId, editedTeamId, {
        name: editedTeamName.trim(),
        color: editedTeamColor,
        memberIds: editedTeamMemberIds,
      });
      router.refresh();
    });
  }

  function selectTeam(team: ProjectTeam) {
    setEditedTeamId(team.id);
    setEditedTeamName(team.name);
    setEditedTeamColor(team.color ?? accentColor ?? theme.accent);
    setEditedTeamMemberIds(team.memberIds ?? []);
  }

  function toggleNewTeamMember(personId: string) {
    setTeamMemberIds((current) =>
      current.includes(personId) ? current.filter((id) => id !== personId) : [...current, personId],
    );
  }

  function toggleEditedTeamMember(personId: string) {
    setEditedTeamMemberIds((current) =>
      current.includes(personId) ? current.filter((id) => id !== personId) : [...current, personId],
    );
  }

  return (
    <>
      <button
        type="button"
        onClick={() => setIsOpen(true)}
        className="mb-project-top-action"
        style={{
          background: onColor ? "#FFFFFF" : accentColor,
          color: onColor ? accentColor : "#FFFFFF",
          border: "none",
        }}
      >
        <CollaborationIcon />
        Collaborer
      </button>

      {isOpen && (
        <div className="mb-modal-backdrop fixed inset-0 z-50 flex items-center justify-center px-4 py-5">
          <section
            className="mb-modal-surface w-full max-w-[920px] rounded-[28px]"
            style={{ color: text.primary }}
            role="dialog"
            aria-modal="true"
            aria-label="Collaborer sur le projet"
          >
            <header className="flex items-start justify-between gap-4 px-5 py-4" style={{ background: surface.s2 }}>
              <div>
                <p className="text-[11px] font-semibold uppercase tracking-[0.18em]" style={{ color: accentColor }}>
                  Collaboration projet
                </p>
                <h2 className="mt-1 text-lg font-bold">Personnes & équipes</h2>
                <p className="mt-1 text-xs" style={{ color: text.muted }}>
                  Ajoute les personnes au projet, puis compose des équipes réutilisables dans les tâches.
                </p>
              </div>
              <button
                type="button"
                onClick={() => setIsOpen(false)}
                className="rounded-xl p-2"
                style={{ background: surface.s1, color: text.secondary, border: "none" }}
                aria-label="Fermer"
              >
                <svg width="15" height="15" viewBox="0 0 16 16" fill="none">
                  <path d="m4 4 8 8M12 4l-8 8" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" />
                </svg>
              </button>
            </header>

            <div className="grid gap-3 p-4 lg:grid-cols-[minmax(0,0.9fr)_minmax(0,1.1fr)]">
              <div className="grid gap-3">
                <Panel title="Personnes associées" meta={`${people.length} personne${people.length > 1 ? "s" : ""}`}>
                  {people.length === 0 ? (
                    <p className="rounded-xl px-3 py-2 text-xs" style={{ background: surface.s2, color: text.muted }}>
                      Aucune personne ajoutée pour l’instant.
                    </p>
                  ) : (
                    <div className="flex flex-wrap gap-1.5">
                      {people.map((person) => (
                        <span key={person.id} className="rounded-full px-2.5 py-1 text-[11px] font-semibold" style={{ background: surface.s2, color: text.secondary }}>
                          {person.name}{person.role ? ` · ${person.role}` : ""}
                        </span>
                      ))}
                    </div>
                  )}
                </Panel>

                <Panel title="Ajouter une personne">
                  <form onSubmit={submitPerson} className="grid gap-2">
                    <input value={personName} onChange={(event) => setPersonName(event.target.value)} placeholder="Nom de la personne" style={fieldStyle()} />
                    <div className="grid gap-2 sm:grid-cols-2">
                      <input value={personEmail} onChange={(event) => setPersonEmail(event.target.value)} placeholder="Email optionnel" style={fieldStyle()} />
                      <input value={personRole} onChange={(event) => setPersonRole(event.target.value)} placeholder="Rôle optionnel" style={fieldStyle()} />
                    </div>
                    <button type="submit" disabled={isPending} className="rounded-xl px-3 py-2 text-xs font-semibold" style={{ background: accentColor, color: "#FFFFFF", border: "none" }}>
                      Associer au projet
                    </button>
                  </form>
                </Panel>
              </div>

              <div className="grid gap-3">
                <Panel title="Équipes du projet" meta={`${teams.length} équipe${teams.length > 1 ? "s" : ""}`}>
                  {teams.length === 0 ? (
                    <p className="rounded-xl px-3 py-2 text-xs" style={{ background: surface.s2, color: text.muted }}>
                      Crée une équipe pour associer plusieurs personnes à une tâche en un clic.
                    </p>
                  ) : (
                    <div className="flex flex-wrap gap-1.5">
                      {teams.map((team) => {
                        const selected = team.id === editedTeamId;
                        return (
                          <button
                            key={team.id}
                            type="button"
                            onClick={() => selectTeam(team)}
                            className="rounded-full px-2.5 py-1 text-[11px] font-semibold"
                            style={{
                              background: selected ? team.color ?? accentColor : surface.s2,
                              color: selected ? "#FFFFFF" : team.color ?? text.secondary,
                              border: "none",
                            }}
                          >
                            {team.name}
                          </button>
                        );
                      })}
                    </div>
                  )}
                </Panel>

                <Panel title="Paramètres équipes">
                  <form onSubmit={submitTeam} className="mb-3 grid gap-2 rounded-2xl p-3" style={{ background: surface.s2 }}>
                    <p className="text-[11px] font-semibold uppercase tracking-[0.14em]" style={{ color: text.muted }}>
                      Créer une équipe
                    </p>
                    <input value={teamName} onChange={(event) => setTeamName(event.target.value)} placeholder="Nom de l’équipe" style={fieldStyle(surface.s1)} />
                    <MemberPicker people={people} selectedIds={teamMemberIds} color={teamColor} onToggle={toggleNewTeamMember} />
                    <div className="flex items-center gap-2">
                      <input type="color" value={teamColor} onChange={(event) => setTeamColor(event.target.value)} className="h-8 w-11 rounded-lg" style={{ background: surface.s1, border: "none" }} />
                      <button type="submit" disabled={isPending} className="flex-1 rounded-xl px-3 py-2 text-xs font-semibold" style={{ background: accentColor, color: "#FFFFFF", border: "none" }}>
                        Créer l’équipe
                      </button>
                    </div>
                  </form>

                  {editedTeam && (
                    <form onSubmit={submitTeamUpdate} className="grid gap-2 rounded-2xl p-3" style={{ background: surface.s2 }}>
                      <p className="text-[11px] font-semibold uppercase tracking-[0.14em]" style={{ color: text.muted }}>
                        Modifier l’équipe sélectionnée
                      </p>
                      <input value={editedTeamName} onChange={(event) => setEditedTeamName(event.target.value)} placeholder="Nom de l’équipe" style={fieldStyle(surface.s1)} />
                      <MemberPicker people={people} selectedIds={editedTeamMemberIds} color={editedTeamColor} onToggle={toggleEditedTeamMember} />
                      <div className="flex items-center gap-2">
                        <input type="color" value={editedTeamColor} onChange={(event) => setEditedTeamColor(event.target.value)} className="h-8 w-11 rounded-lg" style={{ background: surface.s1, border: "none" }} />
                        <button type="submit" disabled={isPending} className="flex-1 rounded-xl px-3 py-2 text-xs font-semibold" style={{ background: editedTeamColor, color: "#FFFFFF", border: "none" }}>
                          Enregistrer l’équipe
                        </button>
                      </div>
                    </form>
                  )}
                </Panel>
              </div>
            </div>
          </section>
        </div>
      )}
    </>
  );
}

function Panel({ title, meta, children }: { title: string; meta?: string; children: ReactNode }) {
  return (
    <section className="rounded-2xl p-3" style={{ background: surface.s1 }}>
      <div className="mb-2 flex items-center justify-between gap-2">
        <h3 className="text-xs font-semibold" style={{ color: text.primary }}>{title}</h3>
        {meta && <span className="rounded-full px-2 py-0.5 text-[11px] font-semibold" style={{ background: surface.s2, color: text.muted }}>{meta}</span>}
      </div>
      {children}
    </section>
  );
}

function MemberPicker({
  people,
  selectedIds,
  color,
  onToggle,
}: {
  people: ProjectPerson[];
  selectedIds: string[];
  color: string;
  onToggle: (personId: string) => void;
}) {
  if (people.length === 0) {
    return <p className="text-[11px]" style={{ color: text.muted }}>Ajoute d’abord une personne pour composer une équipe.</p>;
  }

  return (
    <div className="flex flex-wrap gap-1.5">
      {people.map((person) => {
        const selected = selectedIds.includes(person.id);
        return (
          <button
            key={person.id}
            type="button"
            onClick={() => onToggle(person.id)}
            className="rounded-full px-2 py-1 text-[11px] font-semibold"
            style={{
              background: selected ? color : surface.s1,
              color: selected ? "#FFFFFF" : text.secondary,
              border: "none",
            }}
          >
            {person.name}
          </button>
        );
      })}
    </div>
  );
}

function CollaborationIcon() {
  return (
    <svg width="14" height="14" viewBox="0 0 16 16" fill="none" aria-hidden="true">
      <path d="M6.5 7.2a2.2 2.2 0 1 0 0-4.4 2.2 2.2 0 0 0 0 4.4ZM2.5 13c.45-2 1.8-3.3 4-3.3s3.55 1.3 4 3.3M11.2 7.4a1.8 1.8 0 1 0 0-3.6M10.6 9.7c1.45.25 2.35 1.25 2.75 2.8" stroke="currentColor" strokeWidth="1.4" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  );
}

function fieldStyle(background: string = surface.s2) {
  return {
    width: "100%",
    borderRadius: "0.8rem",
    border: "none",
    background,
    color: text.primary,
    fontSize: "0.78rem",
    padding: "0.62rem 0.75rem",
    outline: "none",
  };
}
