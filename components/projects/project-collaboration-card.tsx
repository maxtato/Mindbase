"use client";

import { useState, useTransition, type FormEvent } from "react";
import { useRouter } from "next/navigation";
import {
  addProjectPersonAction,
  addProjectTeamAction,
  updateTaskStatusSettingAction,
} from "@/app/dashboard/projects/[id]/actions";
import type { ProjectPerson, ProjectStatusSettings, ProjectTeam, TaskStatus } from "@/lib/mock-data";
import { statusColor, surface, text } from "@/lib/design-tokens";
import { taskStatusLabels } from "@/lib/project-plan";
import { workspaceTheme, type Workspace } from "@/lib/workspace";

const taskStatusOrder: TaskStatus[] = ["todo", "in_progress", "waiting", "blocked", "done"];
const taskStatusDefaultColors: Record<TaskStatus, string> = {
  todo: "#64748B",
  in_progress: "#F59E0B",
  waiting: "#3B82F6",
  blocked: "#EF4444",
  done: "#22C55E",
};

interface ProjectCollaborationCardProps {
  projectId: string;
  workspace: Workspace;
  people?: ProjectPerson[];
  teams?: ProjectTeam[];
  statusSettings?: ProjectStatusSettings;
}

export function ProjectCollaborationCard({
  projectId,
  workspace,
  people = [],
  teams = [],
  statusSettings,
}: ProjectCollaborationCardProps) {
  const router = useRouter();
  const theme = workspaceTheme[workspace];
  const [isPending, startTransition] = useTransition();
  const [personName, setPersonName] = useState("");
  const [personEmail, setPersonEmail] = useState("");
  const [personRole, setPersonRole] = useState("");
  const [teamName, setTeamName] = useState("");
  const [teamColor, setTeamColor] = useState<string>(theme.accent);
  const [teamMemberIds, setTeamMemberIds] = useState<string[]>([]);
  const [editedStatus, setEditedStatus] = useState<TaskStatus>("todo");
  const selectedStatusSetting = statusSettings?.task?.[editedStatus];
  const [statusLabel, setStatusLabel] = useState(selectedStatusSetting?.label ?? taskStatusLabels[editedStatus]);
  const [statusColorValue, setStatusColorValue] = useState(selectedStatusSetting?.color ?? taskStatusDefaultColors[editedStatus]);

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

  function submitStatus(event: FormEvent) {
    event.preventDefault();
    startTransition(async () => {
      await updateTaskStatusSettingAction(projectId, editedStatus, {
        label: statusLabel,
        color: statusColorValue,
      });
      router.refresh();
    });
  }

  function toggleMember(personId: string) {
    setTeamMemberIds((current) =>
      current.includes(personId) ? current.filter((id) => id !== personId) : [...current, personId],
    );
  }

  function changeEditedStatus(status: TaskStatus) {
    const setting = statusSettings?.task?.[status];
    setEditedStatus(status);
    setStatusLabel(setting?.label ?? taskStatusLabels[status]);
    setStatusColorValue(setting?.color ?? taskStatusDefaultColors[status]);
  }

  return (
    <section className="mb-card-premium mb-card-subtle rounded-2xl p-4" style={{ background: surface.s1 }}>
      <div className="mb-3 flex items-center justify-between gap-3">
        <div>
          <h2 className="text-sm font-semibold" style={{ color: text.primary }}>
            Personnes & équipes
          </h2>
          <p className="mt-0.5 text-[11px]" style={{ color: text.muted }}>
            Collaboration humaine liée au projet.
          </p>
        </div>
        <span className="rounded-full px-2 py-0.5 text-[11px] font-semibold" style={{ background: surface.s2, color: text.muted }}>
          {people.length} pers. · {teams.length} équipes
        </span>
      </div>

      <div className="grid gap-2">
        {people.length === 0 ? (
          <p className="rounded-xl px-3 py-2 text-xs" style={{ background: surface.s2, color: text.muted }}>
            Ajoute une première personne pour pouvoir lier des discussions et responsabilités aux tâches.
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

        {teams.length > 0 && (
          <div className="flex flex-wrap gap-1.5">
            {teams.map((team) => (
              <span key={team.id} className="rounded-full px-2.5 py-1 text-[11px] font-semibold" style={{ background: surface.s2, color: team.color ?? theme.accent, border: `1px solid ${team.color ?? theme.accent}` }}>
                {team.name}
              </span>
            ))}
          </div>
        )}
      </div>

      <details className="mt-3">
        <summary className="cursor-pointer rounded-xl px-3 py-2 text-xs font-semibold" style={{ background: surface.s2, color: text.secondary }}>
          Ajouter une personne
        </summary>
        <form onSubmit={submitPerson} className="mt-2 grid gap-2">
          <input value={personName} onChange={(event) => setPersonName(event.target.value)} placeholder="Nom" style={fieldStyle()} />
          <input value={personEmail} onChange={(event) => setPersonEmail(event.target.value)} placeholder="Email optionnel" style={fieldStyle()} />
          <input value={personRole} onChange={(event) => setPersonRole(event.target.value)} placeholder="Rôle optionnel" style={fieldStyle()} />
          <button type="submit" disabled={isPending} className="rounded-lg px-3 py-2 text-xs font-semibold" style={{ background: theme.accent, color: "#FFFFFF", border: "none", cursor: isPending ? "wait" : "pointer" }}>
            Ajouter
          </button>
        </form>
      </details>

      <details className="mt-2">
        <summary className="cursor-pointer rounded-xl px-3 py-2 text-xs font-semibold" style={{ background: surface.s2, color: text.secondary }}>
          Créer une équipe
        </summary>
        <form onSubmit={submitTeam} className="mt-2 grid gap-2">
          <input value={teamName} onChange={(event) => setTeamName(event.target.value)} placeholder="Nom de l’équipe" style={fieldStyle()} />
          <div className="flex items-center gap-2">
            <input type="color" value={teamColor} onChange={(event) => setTeamColor(event.target.value)} className="h-9 w-12 rounded-lg" style={{ background: surface.s2, border: `1px solid ${surface.border}` }} />
            <span className="text-[11px]" style={{ color: text.muted }}>Couleur d’équipe</span>
          </div>
          {people.length > 0 && (
            <div className="rounded-xl p-2.5" style={{ background: surface.s2 }}>
              <p className="mb-2 text-[10px] font-semibold uppercase tracking-[0.12em]" style={{ color: text.muted }}>
                Membres
              </p>
              <div className="flex flex-wrap gap-1.5">
                {people.map((person) => {
                  const selected = teamMemberIds.includes(person.id);
                  return (
                    <button
                      key={person.id}
                      type="button"
                      onClick={() => toggleMember(person.id)}
                      className="rounded-full px-2 py-1 text-[11px] font-semibold"
                      style={{
                        background: selected ? teamColor : surface.s1,
                        color: selected ? "#FFFFFF" : text.secondary,
                        border: `1px solid ${selected ? teamColor : surface.border}`,
                        cursor: "pointer",
                      }}
                    >
                      {person.name}
                    </button>
                  );
                })}
              </div>
            </div>
          )}
          <button type="submit" disabled={isPending} className="rounded-lg px-3 py-2 text-xs font-semibold" style={{ background: theme.accent, color: "#FFFFFF", border: "none", cursor: isPending ? "wait" : "pointer" }}>
            Créer l’équipe
          </button>
        </form>
      </details>

      <details className="mt-2">
        <summary className="cursor-pointer rounded-xl px-3 py-2 text-xs font-semibold" style={{ background: surface.s2, color: text.secondary }}>
          Statuts personnalisables
        </summary>
        <form onSubmit={submitStatus} className="mt-2 grid gap-2">
          <select value={editedStatus} onChange={(event) => changeEditedStatus(event.target.value as TaskStatus)} style={fieldStyle()}>
            {taskStatusOrder.map((status) => (
              <option key={status} value={status}>
                {taskStatusLabels[status]} · catégorie système
              </option>
            ))}
          </select>
          <input value={statusLabel} onChange={(event) => setStatusLabel(event.target.value)} placeholder="Libellé affiché" style={fieldStyle()} />
          <div className="flex items-center gap-2">
            <input type="color" value={statusColorValue} onChange={(event) => setStatusColorValue(event.target.value)} className="h-9 w-12 rounded-lg" style={{ background: surface.s2, border: `1px solid ${surface.border}` }} />
            <span className="rounded-full px-2 py-0.5 text-[11px] font-semibold" style={{ background: statusColor.gray.bg, color: statusColorValue, border: `1px solid ${statusColorValue}` }}>
              {statusLabel || taskStatusLabels[editedStatus]}
            </span>
          </div>
          <p className="text-[11px] leading-relaxed" style={{ color: text.muted }}>
            Le libellé change pour l’utilisateur, mais la catégorie système reste stable pour le Kanban.
          </p>
          <button type="submit" disabled={isPending} className="rounded-lg px-3 py-2 text-xs font-semibold" style={{ background: theme.accent, color: "#FFFFFF", border: "none", cursor: isPending ? "wait" : "pointer" }}>
            Enregistrer le statut
          </button>
        </form>
      </details>
    </section>
  );
}

function fieldStyle() {
  return {
    width: "100%",
    borderRadius: "0.8rem",
    border: `1px solid ${surface.borderSubtle}`,
    background: surface.s2,
    color: text.primary,
    fontSize: "0.78rem",
    padding: "0.62rem 0.75rem",
    outline: "none",
  };
}
