"use client";

// Gestion de l'équipe (collaboration, phase 1) — affichée dans les Paramètres.
// L'admin invite des personnes (nom + email), les voit en « Invité » puis les
// passe « Actif » quand elles rejoignent. Les membres actifs deviennent des
// collaborateurs disponibles sur les projets.

import { useState, useTransition, type FormEvent } from "react";
import { surface, text } from "@/lib/design-tokens";
import {
  inviteTeamMemberAction,
  removeTeamMemberAction,
  setTeamMemberRoleAction,
  setTeamMemberStatusAction,
} from "@/app/dashboard/team-actions";
import type { TeamMember } from "@/lib/team-store";
import { useIsPaidPlan } from "@/components/account/account-context";

const ACCENT = "var(--mb-personal-accent)";

export function TeamManager({
  initialMembers,
  accountName,
}: {
  initialMembers: TeamMember[];
  accountName: string;
}) {
  const isPaid = useIsPaidPlan();
  const [members, setMembers] = useState<TeamMember[]>(initialMembers);
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();

  function invite(event: FormEvent) {
    event.preventDefault();
    const cleaned = name.trim();
    if (!cleaned) {
      setError("Indique au moins un nom.");
      return;
    }
    setError(null);
    startTransition(async () => {
      try {
        const next = await inviteTeamMemberAction({ name: cleaned, email: email.trim() });
        setMembers(next);
        setName("");
        setEmail("");
      } catch (err) {
        setError(err instanceof Error ? err.message : "Invitation impossible.");
      }
    });
  }

  function run(action: () => Promise<TeamMember[]>) {
    startTransition(async () => {
      try {
        setMembers(await action());
      } catch (err) {
        setError(err instanceof Error ? err.message : "Action impossible.");
      }
    });
  }

  return (
    <div className="flex flex-col gap-4">
      <div>
        <p className="text-xs font-semibold uppercase tracking-[0.14em]" style={{ color: text.muted }}>
          Équipe & collaboration
        </p>
        <h2 className="mt-1 text-lg font-bold" style={{ color: text.primary }}>
          Mon équipe
        </h2>
        <p className="mt-1 text-xs leading-relaxed" style={{ color: text.secondary }}>
          En tant qu'admin, invite des personnes à rejoindre ton équipe. Une fois actives, elles deviennent
          disponibles comme collaborateurs sur tes projets et tes tâches.
        </p>
      </div>

      {/* Toi = admin */}
      <div
        className="flex items-center gap-3 rounded-xl px-3 py-2.5"
        style={{ background: `color-mix(in srgb, ${ACCENT} 10%, transparent)`, border: `1px solid color-mix(in srgb, ${ACCENT} 35%, transparent)` }}
      >
        <span
          className="inline-flex h-7 w-7 items-center justify-center rounded-full text-[11px] font-bold text-white"
          style={{ background: ACCENT }}
        >
          {(accountName.trim().charAt(0) || "M").toUpperCase()}
        </span>
        <div className="min-w-0 flex-1">
          <p className="text-sm font-semibold leading-tight" style={{ color: text.primary }}>
            {accountName.trim() || "Moi"}
          </p>
          <p className="text-[11px]" style={{ color: text.muted }}>Toi · administrateur</p>
        </div>
        <span
          className="rounded-full px-2 py-0.5 text-[10px] font-bold"
          style={{ background: ACCENT, color: "#fff" }}
        >
          Admin
        </span>
      </div>

      {/* Inviter — réservé au plan Pro. */}
      {!isPaid ? (
        <div className="rounded-2xl p-3 text-xs leading-relaxed" style={{ background: surface.s2, color: text.secondary }}>
          Inviter des collaborateurs fait partie du plan <strong style={{ color: text.primary }}>Pro</strong>. Passe au
          plan Pro (section « Mon plan ») pour constituer ton équipe.
        </div>
      ) : (
      <form onSubmit={invite} className="grid gap-2 rounded-2xl p-3" style={{ background: surface.s2 }}>
        <p className="text-[11px] font-semibold uppercase tracking-[0.14em]" style={{ color: text.muted }}>
          Inviter une personne
        </p>
        <div className="grid gap-2 sm:grid-cols-2">
          <input
            value={name}
            onChange={(e) => setName(e.target.value)}
            placeholder="Nom"
            className="rounded-lg px-3 py-2 text-xs outline-none"
            style={{ background: surface.s1, color: text.primary, border: `1px solid ${surface.border}` }}
          />
          <input
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            placeholder="Email (optionnel)"
            className="rounded-lg px-3 py-2 text-xs outline-none"
            style={{ background: surface.s1, color: text.primary, border: `1px solid ${surface.border}` }}
          />
        </div>
        <button
          type="submit"
          disabled={pending || !name.trim()}
          className="justify-self-start rounded-xl px-3 py-2 text-xs font-semibold"
          style={{ background: ACCENT, color: "#fff", border: "none", cursor: pending || !name.trim() ? "not-allowed" : "pointer", opacity: pending || !name.trim() ? 0.6 : 1 }}
        >
          {pending ? "…" : "Inviter"}
        </button>
        {error && <p className="text-[11px]" style={{ color: "var(--mb-status-red-text)" }}>{error}</p>}
      </form>
      )}

      {/* Membres */}
      {members.length > 0 && (
        <div className="flex flex-col gap-1.5">
          {members.map((m) => {
            const active = m.status === "active";
            return (
              <div
                key={m.id}
                className="flex items-center gap-3 rounded-xl px-3 py-2.5"
                style={{ background: surface.s2, border: `1px solid ${surface.borderSubtle}` }}
              >
                <span
                  className="inline-flex h-7 w-7 shrink-0 items-center justify-center rounded-full text-[11px] font-bold"
                  style={{ background: active ? ACCENT : surface.s3, color: active ? "#fff" : text.secondary }}
                >
                  {(m.name.trim().charAt(0) || "?").toUpperCase()}
                </span>
                <div className="min-w-0 flex-1">
                  <p className="truncate text-sm font-semibold leading-tight" style={{ color: text.primary }}>
                    {m.name}
                  </p>
                  <p className="truncate text-[11px]" style={{ color: text.muted }}>
                    {m.email || "—"} · {m.role === "admin" ? "Admin" : "Membre"}
                  </p>
                </div>

                <span
                  className="shrink-0 rounded-full px-2 py-0.5 text-[10px] font-semibold"
                  style={
                    active
                      ? { background: `color-mix(in srgb, ${ACCENT} 16%, transparent)`, color: ACCENT }
                      : { background: surface.s3, color: text.muted }
                  }
                >
                  {active ? "Actif" : "Invité"}
                </span>

                {/* Actions */}
                {!active && (
                  <button
                    type="button"
                    disabled={pending}
                    onClick={() => run(() => setTeamMemberStatusAction(m.id, "active"))}
                    className="shrink-0 rounded-lg px-2.5 py-1.5 text-[11px] font-semibold"
                    style={{ background: ACCENT, color: "#fff", border: "none", cursor: "pointer" }}
                    title="Marquer comme ayant rejoint l'équipe"
                  >
                    Activer
                  </button>
                )}
                <button
                  type="button"
                  disabled={pending}
                  onClick={() => run(() => setTeamMemberRoleAction(m.id, m.role === "admin" ? "member" : "admin"))}
                  className="shrink-0 rounded-lg px-2 py-1.5 text-[11px] font-medium"
                  style={{ background: surface.s1, color: text.secondary, border: `1px solid ${surface.borderSubtle}`, cursor: "pointer" }}
                  title={m.role === "admin" ? "Repasser en membre" : "Promouvoir admin"}
                >
                  {m.role === "admin" ? "Membre" : "Admin"}
                </button>
                <button
                  type="button"
                  disabled={pending}
                  onClick={() => run(() => removeTeamMemberAction(m.id))}
                  aria-label={`Retirer ${m.name}`}
                  className="shrink-0 rounded-lg p-1.5"
                  style={{ background: "transparent", color: text.muted, border: "none", cursor: "pointer" }}
                >
                  <svg width="14" height="14" viewBox="0 0 16 16" fill="none" aria-hidden="true">
                    <path d="M3 4.5h10M6.5 4V3h3v1M5 4.5l.5 8h5l.5-8" stroke="currentColor" strokeWidth="1.4" strokeLinecap="round" strokeLinejoin="round" />
                  </svg>
                </button>
              </div>
            );
          })}
        </div>
      )}

      <p className="text-[11px]" style={{ color: text.muted }}>
        Les comptes sans abonnement payant peuvent rejoindre une équipe, accéder aux tâches partagées et les
        faire évoluer, et créer leurs propres projets (sans IA ni collaboration).
      </p>
    </div>
  );
}
