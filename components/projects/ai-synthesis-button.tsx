"use client";

import { useState, useTransition } from "react";
import { refreshProjectSynthesisAction } from "@/app/dashboard/projects/ai-actions";
import { useIsPaidPlan } from "@/components/account/account-context";

interface AISynthesisButtonProps {
  projectId: string;
  accentColor: string;
}

export function AISynthesisButton({ projectId, accentColor }: AISynthesisButtonProps) {
  const isPaid = useIsPaidPlan();
  const [pending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);

  function handleClick() {
    setError(null);
    startTransition(async () => {
      try {
        await refreshProjectSynthesisAction(projectId);
      } catch (err) {
        setError(err instanceof Error ? err.message : "Erreur IA inconnue.");
      }
    });
  }

  if (!isPaid) return null;

  return (
    <div className="flex flex-col gap-1">
      <button
        type="button"
        onClick={handleClick}
        disabled={pending}
        className="inline-flex items-center justify-center gap-1.5 rounded-full px-3 py-1.5 text-[11px] font-semibold transition-opacity"
        style={{
          background: accentColor,
          color: "#FFFFFF",
          border: "none",
          cursor: pending ? "wait" : "pointer",
          opacity: pending ? 0.7 : 1,
        }}
        title="Demander à l'IA de relire le projet et mettre à jour la synthèse"
      >
        <SparkleIcon />
        {pending ? "Mise à jour…" : "Mettre à jour"}
      </button>
      {error && (
        <p className="text-[10.5px]" style={{ color: "var(--mb-status-red-text)" }}>
          {error}
        </p>
      )}
    </div>
  );
}

function SparkleIcon() {
  return (
    <svg width="11" height="11" viewBox="0 0 16 16" fill="none" aria-hidden="true">
      <path
        d="M8 2.5v3M8 10.5v3M2.5 8h3M10.5 8h3M4.5 4.5l1.5 1.5M10 10l1.5 1.5M4.5 11.5L6 10M10 6l1.5-1.5"
        stroke="currentColor"
        strokeWidth="1.5"
        strokeLinecap="round"
      />
    </svg>
  );
}
