"use client";

import { useEffect, useRef, useState } from "react";
import { surface, text } from "@/lib/design-tokens";
import { createEnvironmentAction } from "@/app/dashboard/environment-actions";

// Tous les environnements partagent la même couleur (violet). On ne propose
// donc plus de sélecteur de couleur : seul le NOM varie.
const ENV_COLOR = "var(--mb-personal-accent)";
const ENV_COLOR_HEX = "#7c3aed";

export function CreateEnvironmentDialog({ onClose }: { onClose: () => void }) {
  const [name, setName] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    const id = window.setTimeout(() => inputRef.current?.focus(), 30);
    return () => window.clearTimeout(id);
  }, []);

  async function handleCreate() {
    const cleaned = name.trim();
    if (!cleaned || busy) {
      if (!cleaned) setError("Donne un nom à l'environnement.");
      return;
    }
    setBusy(true);
    setError(null);
    try {
      await createEnvironmentAction({ name: cleaned, color: ENV_COLOR_HEX });
      // On NE bascule PAS sur le nouvel environnement (il est vide) : l'utilisateur
      // garde sa vue et ses projets actuels. On recharge simplement la page
      // courante (même workspace) pour que le nouvel environnement apparaisse
      // dans le sélecteur — le registre de thèmes étant ré-enregistré côté
      // serveur au chargement.
      window.location.reload();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Création impossible.");
      setBusy(false);
    }
  }

  return (
    <div
      className="mb-modal-backdrop fixed inset-0 z-[200] flex items-center justify-center px-4"
      onClick={onClose}
    >
      <div
        className="mb-modal-surface w-[min(420px,100%)] overflow-hidden rounded-2xl"
        onClick={(event) => event.stopPropagation()}
      >
        <div className="px-5 py-4" style={{ background: surface.s2, borderBottom: `1px solid ${surface.borderSubtle}` }}>
          <p className="text-[10px] font-semibold uppercase tracking-[0.14em]" style={{ color: text.muted }}>
            Nouvel environnement
          </p>
          <h3 className="mt-1 text-base font-semibold leading-tight" style={{ color: text.primary }}>
            Créer un environnement
          </h3>
          <p className="mt-1 text-[11px]" style={{ color: text.secondary }}>
            En plus de Personnel et Pro, pour ranger d'autres projets à part.
          </p>
        </div>

        <div className="flex flex-col gap-4 p-5">
          <div>
            <label className="text-[11px] font-semibold uppercase tracking-[0.14em]" style={{ color: text.muted }}>
              Nom
            </label>
            <input
              ref={inputRef}
              type="text"
              value={name}
              maxLength={40}
              onChange={(event) => setName(event.target.value)}
              onKeyDown={(event) => {
                if (event.key === "Enter") {
                  event.preventDefault();
                  handleCreate();
                }
              }}
              placeholder="Ex : Association, Études, Side-project…"
              className="mt-2 w-full rounded-xl px-3 py-2.5 text-sm outline-none"
              style={{ background: surface.s2, color: text.primary, border: `1px solid ${surface.border}` }}
            />
          </div>

          {/* Aperçu — tous les environnements partagent la couleur violette. */}
          <div
            className="flex items-center gap-2 rounded-xl px-3 py-2.5"
            style={{ background: `color-mix(in srgb, ${ENV_COLOR} 12%, transparent)`, border: `1px solid color-mix(in srgb, ${ENV_COLOR} 38%, transparent)` }}
          >
            <span
              className="inline-flex h-6 w-6 items-center justify-center rounded-full text-[11px] font-bold text-white"
              style={{ background: ENV_COLOR }}
            >
              {(name.trim().charAt(0) || "E").toUpperCase()}
            </span>
            <span className="text-sm font-semibold" style={{ color: text.primary }}>
              {name.trim() || "Aperçu de l'environnement"}
            </span>
          </div>

          {error && <p className="text-xs" style={{ color: "var(--mb-status-red-text)" }}>{error}</p>}

          <div className="flex items-center justify-end gap-2">
            <button
              type="button"
              onClick={onClose}
              className="rounded-xl px-4 py-2.5 text-xs font-medium"
              style={{ background: surface.s2, color: text.secondary, border: `1px solid ${surface.border}`, cursor: "pointer" }}
            >
              Annuler
            </button>
            <button
              type="button"
              onClick={handleCreate}
              disabled={busy || !name.trim()}
              className="rounded-xl px-4 py-2.5 text-xs font-semibold"
              style={{
                background: name.trim() ? ENV_COLOR : surface.s3,
                color: name.trim() ? "#FFFFFF" : text.dim,
                border: "none",
                cursor: busy || !name.trim() ? "not-allowed" : "pointer",
              }}
            >
              {busy ? "Création…" : "Créer"}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
