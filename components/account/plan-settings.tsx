"use client";

// Indicateur de plan (gratuit / payant) — sans paiement réel pour l'instant.
// Le plan Pro débloque l'IA (création, assistant, synthèse) et la collaboration
// (inviter, ajouter des collaborateurs). Le plan gratuit garde la création
// manuelle en solo, l'accès aux tâches partagées et la communication.

import { useState, useTransition } from "react";
import { surface, text } from "@/lib/design-tokens";
import { savePlanAction } from "@/app/dashboard/settings/actions";
import type { AccountPlan } from "@/lib/account-store";

const ACCENT = "var(--mb-personal-accent)";

export function PlanSettings({ initialPlan }: { initialPlan: AccountPlan }) {
  const [plan, setPlan] = useState<AccountPlan>(initialPlan);
  const [pending, startTransition] = useTransition();

  function choose(next: AccountPlan) {
    if (next === plan) return;
    setPlan(next);
    startTransition(async () => {
      await savePlanAction(next);
    });
  }

  return (
    <div className="flex flex-col gap-4">
      <div>
        <p className="text-xs font-semibold uppercase tracking-[0.16em]" style={{ color: text.muted }}>
          Abonnement
        </p>
        <h2 className="mt-1 text-lg font-bold" style={{ color: text.primary }}>
          Mon plan
        </h2>
        <p className="mt-1 text-xs leading-relaxed" style={{ color: text.secondary }}>
          Le plan Pro débloque l'IA (création & assistant) et la collaboration (inviter, partager). Le plan
          gratuit permet de créer ses propres projets manuellement, d'accéder aux tâches partagées et de communiquer.
        </p>
      </div>

      <div className="grid gap-2 sm:grid-cols-2">
        {([
          { key: "free" as const, title: "Gratuit", desc: "Projets manuels en solo · tâches partagées · communication" },
          { key: "pro" as const, title: "Pro", desc: "IA (création, assistant, synthèse) · collaboration & invitations" },
        ]).map((option) => {
          const active = plan === option.key;
          return (
            <button
              key={option.key}
              type="button"
              disabled={pending}
              onClick={() => choose(option.key)}
              className="rounded-2xl p-3 text-left"
              style={{
                background: active ? `color-mix(in srgb, ${ACCENT} 10%, transparent)` : surface.s2,
                border: `1.5px solid ${active ? ACCENT : surface.borderSubtle}`,
                cursor: pending ? "wait" : "pointer",
              }}
            >
              <div className="flex items-center justify-between gap-2">
                <span className="text-sm font-bold" style={{ color: text.primary }}>{option.title}</span>
                {active && (
                  <span className="rounded-full px-2 py-0.5 text-[10px] font-bold" style={{ background: ACCENT, color: "#fff" }}>
                    Actif
                  </span>
                )}
              </div>
              <p className="mt-1 text-[11px] leading-snug" style={{ color: text.secondary }}>{option.desc}</p>
            </button>
          );
        })}
      </div>
      <p className="text-[11px]" style={{ color: text.muted }}>
        Démo : pas de paiement réel pour l'instant, ce sélecteur sert à tester les accès.
      </p>
    </div>
  );
}
