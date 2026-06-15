"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { surface, text } from "@/lib/design-tokens";
import { useEnvironments } from "@/components/environments/environments-provider";
import { updateEnvironmentAction, deleteEnvironmentAction } from "@/app/dashboard/environment-actions";

const PRESET_COLORS = [
  "#5e17eb", "#7c3aed", "#2563eb", "#0ea5e9", "#0d9488",
  "#16a34a", "#ca8a04", "#ea580c", "#dc2626", "#db2777", "#475569", "#111827",
];

export function EnvironmentsManager() {
  const router = useRouter();
  const environments = useEnvironments();
  const [busyId, setBusyId] = useState<string | null>(null);
  const [confirmDelete, setConfirmDelete] = useState<string | null>(null);

  async function rename(id: string, name: string) {
    setBusyId(id);
    await updateEnvironmentAction({ id, name });
    router.refresh();
    setBusyId(null);
  }
  async function recolor(id: string, color: string) {
    setBusyId(id);
    await updateEnvironmentAction({ id, color });
    router.refresh();
    setBusyId(null);
  }
  async function remove(id: string) {
    setBusyId(id);
    await deleteEnvironmentAction(id);
    setConfirmDelete(null);
    router.refresh();
    setBusyId(null);
  }

  return (
    <div className="flex flex-col gap-2">
      <p className="text-xs font-semibold uppercase tracking-[0.16em]" style={{ color: text.muted }}>
        Environnements personnalisés
      </p>
      {environments.length === 0 ? (
        <p className="text-sm" style={{ color: text.secondary }}>
          Aucun environnement personnalisé. Utilise le « + » dans le sélecteur d'environnement pour en créer un.
        </p>
      ) : (
        <div className="flex flex-col gap-2">
          {environments.map((env) => (
            <div
              key={env.id}
              className="flex items-center gap-3 rounded-xl px-3 py-2.5"
              style={{ background: surface.s2, border: `1px solid ${surface.borderSubtle}` }}
            >
              <label
                className="inline-flex h-7 w-7 shrink-0 items-center justify-center rounded-full"
                style={{ background: env.color, position: "relative", cursor: "pointer" }}
                title="Changer la couleur"
              >
                <input
                  type="color"
                  defaultValue={env.color}
                  onChange={(e) => recolor(env.id, e.target.value)}
                  style={{ position: "absolute", inset: 0, opacity: 0, cursor: "pointer" }}
                />
              </label>
              <input
                type="text"
                defaultValue={env.name}
                disabled={busyId === env.id}
                onBlur={(e) => {
                  const v = e.target.value.trim();
                  if (v && v !== env.name) rename(env.id, v);
                }}
                onKeyDown={(e) => {
                  if (e.key === "Enter") (e.target as HTMLInputElement).blur();
                }}
                className="min-w-0 flex-1 rounded-lg px-2 py-1.5 text-sm outline-none"
                style={{ background: surface.s1, color: text.primary, border: `1px solid ${surface.borderSubtle}` }}
              />
              {confirmDelete === env.id ? (
                <span className="flex items-center gap-1.5">
                  <button
                    type="button"
                    onClick={() => remove(env.id)}
                    className="rounded-lg px-2.5 py-1.5 text-[11px] font-semibold"
                    style={{ background: "var(--mb-status-red-bg)", color: "var(--mb-status-red-text)", border: "none", cursor: "pointer" }}
                  >
                    Supprimer
                  </button>
                  <button
                    type="button"
                    onClick={() => setConfirmDelete(null)}
                    className="rounded-lg px-2.5 py-1.5 text-[11px] font-medium"
                    style={{ background: surface.s1, color: text.secondary, border: `1px solid ${surface.borderSubtle}`, cursor: "pointer" }}
                  >
                    Annuler
                  </button>
                </span>
              ) : (
                <button
                  type="button"
                  onClick={() => setConfirmDelete(env.id)}
                  aria-label="Supprimer l'environnement"
                  className="rounded-lg p-2 shrink-0"
                  style={{ background: "transparent", color: text.muted, border: "none", cursor: "pointer" }}
                >
                  <svg width="14" height="14" viewBox="0 0 16 16" fill="none" aria-hidden="true">
                    <path d="M3 4.5h10M6.5 4V3h3v1M5 4.5l.5 8h5l.5-8" stroke="currentColor" strokeWidth="1.4" strokeLinecap="round" strokeLinejoin="round" />
                  </svg>
                </button>
              )}
            </div>
          ))}
        </div>
      )}
      <p className="mt-1 text-[11px]" style={{ color: text.muted }}>
        Supprimer un environnement ne supprime pas ses projets : ils restent visibles dans la vue « Tous ».
      </p>
    </div>
  );
}
