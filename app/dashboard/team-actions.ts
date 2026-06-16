"use server";

// Actions serveur — gestion de l'équipe (collaboration, phase 1).
// L'admin (compte courant) invite des personnes, gère leur rôle/statut.
// Chaque action renvoie la liste à jour pour mise à jour optimiste côté client.

import {
  addTeamMember,
  removeTeamMember,
  updateTeamMember,
  type TeamMember,
  type TeamMemberRole,
  type TeamMemberStatus,
} from "@/lib/team-store";

export async function inviteTeamMemberAction(input: { name: string; email: string }): Promise<TeamMember[]> {
  const name = (input.name ?? "").trim().slice(0, 60);
  const email = (input.email ?? "").trim().slice(0, 120);
  if (!name) throw new Error("Le nom de la personne est requis.");
  return addTeamMember({ name, email });
}

export async function setTeamMemberStatusAction(id: string, status: TeamMemberStatus): Promise<TeamMember[]> {
  return updateTeamMember(id, { status });
}

export async function setTeamMemberRoleAction(id: string, role: TeamMemberRole): Promise<TeamMember[]> {
  return updateTeamMember(id, { role });
}

export async function removeTeamMemberAction(id: string): Promise<TeamMember[]> {
  return removeTeamMember(id);
}
