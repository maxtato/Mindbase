"use client";

// Carte « Décisions » interactive : registre des arbitrages du projet. On peut
// ajouter une décision, faire évoluer son statut (en attente → décidée → à
// revoir) et la supprimer. Données persistées (Redis) via les server actions.

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import type { Decision } from "@/lib/mock-data";
import { surface, text } from "@/lib/design-tokens";
import { useT } from "@/components/i18n/locale-provider";
import { addDecisionAction, setDecisionStatusAction, deleteDecisionAction } from "@/app/dashboard/projects/[id]/actions";

const TONE: Record<Decision["status"], string> = {
  decided: "var(--mb-status-green-text)",
  pending: "var(--mb-status-yellow-text)",
  revisiting: "var(--mb-status-blue-text)",
};
const NEXT_STATUS: Record<Decision["status"], Decision["status"]> = {
  pending: "decided",
  decided: "revisiting",
  revisiting: "pending",
};

export function ProjectDecisionsCard({ projectId, decisions }: { projectId: string; decisions: Decision[] }) {
  const t = useT();
  const router = useRouter();
  const [, startTransition] = useTransition();
  const [draft, setDraft] = useState("");
  const [rationale, setRationale] = useState("");
  const [busy, setBusy] = useState(false);

  function add() {
    const clean = draft.trim();
    if (!clean || busy) return;
    const cleanRationale = rationale.trim();
    setBusy(true);
    setDraft("");
    setRationale("");
    startTransition(async () => {
      try {
        await addDecisionAction(projectId, clean, cleanRationale || undefined);
      } finally {
        setBusy(false);
      }
    });
  }

  function cycle(decision: Decision) {
    startTransition(() => setDecisionStatusAction(projectId, decision.id, NEXT_STATUS[decision.status]));
  }

  function remove(decisionId: string) {
    startTransition(() => deleteDecisionAction(projectId, decisionId));
  }

  return (
    <section className="mb-project-rail-card rounded-[22px] p-3">
      <div className="mb-1.5 flex items-center justify-between gap-2">
        <h2 className="text-xs font-semibold" style={{ color: text.primary }}>
          {t("project.decisions")}
        </h2>
        {decisions.length > 0 && (
          <span className="rounded-full px-1.5 py-0.5 text-[10px] font-semibold" style={{ background: surface.s2, color: text.muted }}>
            {decisions.length}
          </span>
        )}
      </div>

      {decisions.length > 0 && (
        <ul className="mb-2 grid gap-2">
          {decisions.map((decision) => {
            const tone = TONE[decision.status];
            return (
              <li key={decision.id} className="group flex flex-col gap-0.5 text-[11.5px] leading-snug">
                <span className="flex min-w-0 items-center gap-1.5">
                  <button
                    type="button"
                    onClick={() => cycle(decision)}
                    className="shrink-0 rounded-full px-1.5 py-0.5 text-[9px] font-bold uppercase tracking-[0.08em]"
                    style={{ background: `color-mix(in srgb, ${tone} 16%, transparent)`, color: tone, border: "none", cursor: "pointer" }}
                    title="Changer le statut"
                  >
                    {t(`decision.${decision.status}`)}
                  </button>
                  <span className="min-w-0 flex-1 truncate" style={{ color: text.primary, fontWeight: 600 }}>
                    {decision.title}
                  </span>
                  <button
                    type="button"
                    onClick={() => remove(decision.id)}
                    aria-label={t("tasks.delete")}
                    className="shrink-0 opacity-0 transition-opacity group-hover:opacity-100"
                    style={{ background: "transparent", border: "none", color: text.muted, cursor: "pointer", padding: 2 }}
                  >
                    <svg width="11" height="11" viewBox="0 0 16 16" fill="none"><path d="m4 4 8 8M12 4l-8 8" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" /></svg>
                  </button>
                </span>
                {decision.rationale ? <span style={{ color: text.muted }}>{decision.rationale}</span> : null}
              </li>
            );
          })}
        </ul>
      )}

      <div className="flex flex-col gap-1.5">
        <div className="flex items-center gap-1.5">
          <input
            type="text"
            value={draft}
            onChange={(event) => setDraft(event.target.value)}
            onKeyDown={(event) => {
              if (event.key === "Enter") {
                event.preventDefault();
                add();
              }
            }}
            placeholder={t("decision.addPlaceholder")}
            className="mb-input h-8 min-w-0 flex-1 rounded-lg px-2.5 text-[12px] outline-none"
            style={{ background: surface.s2, color: text.primary, border: `1px solid ${surface.borderSubtle}` }}
          />
          <button
            type="button"
            onClick={add}
            disabled={!draft.trim() || busy}
            className="shrink-0 rounded-lg px-2.5 py-1.5 text-[11px] font-semibold"
            style={{ background: surface.s2, color: text.secondary, border: `1px solid ${surface.border}`, cursor: draft.trim() && !busy ? "pointer" : "not-allowed", opacity: draft.trim() && !busy ? 1 : 0.6 }}
          >
            {t("decision.add")}
          </button>
        </div>
        {/* Le « pourquoi » n'apparaît qu'une fois une décision en cours de saisie,
            pour garder la carte compacte au repos. Optionnel. */}
        {draft.trim() && (
          <input
            type="text"
            value={rationale}
            onChange={(event) => setRationale(event.target.value)}
            onKeyDown={(event) => {
              if (event.key === "Enter") {
                event.preventDefault();
                add();
              }
            }}
            placeholder={t("decision.rationalePlaceholder")}
            className="mb-input h-8 min-w-0 rounded-lg px-2.5 text-[12px] outline-none"
            style={{ background: surface.s2, color: text.primary, border: `1px solid ${surface.borderSubtle}` }}
          />
        )}
      </div>
    </section>
  );
}
