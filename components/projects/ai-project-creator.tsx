"use client";

// Création de projet assistée par l'IA — bouton-trigger + panneau contrôlé.
// Le bouton "Créer avec l'IA" se place à côté de la flèche retour du formulaire.
// Le panneau s'affiche en mode controlled (parent gère open/onOpenChange).

import { useState, useTransition } from "react";
import {
  suggestProjectFromDescriptionAction,
  createProjectFromAISuggestionAction,
} from "@/app/dashboard/projects/ai-actions";
import type { AIProjectSuggestion } from "@/lib/ai/project-creation";
import {
  PROJECT_PRIORITY_OPTIONS,
  getSubcategoryOptions,
  type ProjectPriority,
} from "@/lib/project-taxonomy";
import { surface, text } from "@/lib/design-tokens";
import { workspaceTheme, type Workspace } from "@/lib/workspace";
import { useIsPaidPlan } from "@/components/account/account-context";

interface AIProjectCreatorProps {
  workspace: Workspace;
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

export function AIProjectCreator({ workspace, open, onOpenChange }: AIProjectCreatorProps) {
  const isPaid = useIsPaidPlan();
  const theme = workspaceTheme[workspace];
  const subcategoryOptions = getSubcategoryOptions(workspace);
  const [description, setDescription] = useState("");
  const [pending, setPending] = useState(false);
  const [createPending, startCreate] = useTransition();
  const [error, setError] = useState<string | null>(null);
  const [suggestion, setSuggestion] = useState<AIProjectSuggestion | null>(null);
  const [subcategory, setSubcategory] = useState<string>(subcategoryOptions[0]?.key ?? "other");
  const [priority, setPriority] = useState<ProjectPriority>("medium");

  if (!open || !isPaid) return null;

  async function handleGenerate() {
    setError(null);
    setSuggestion(null);
    setPending(true);
    try {
      const result = await suggestProjectFromDescriptionAction(description, workspace);
      setSuggestion(result);
      // L'IA a suggéré un thème : on pré-sélectionne s'il existe dans le workspace.
      const suggested = subcategoryOptions.find((option) => option.key === result.subcategory);
      if (suggested) setSubcategory(suggested.key);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Erreur IA.");
    } finally {
      setPending(false);
    }
  }

  function handleCreate() {
    if (!suggestion) return;
    setError(null);
    startCreate(async () => {
      try {
        await createProjectFromAISuggestionAction({
          workspace,
          subcategory,
          priority,
          suggestion,
        });
      } catch (err) {
        setError(err instanceof Error ? err.message : "Erreur création.");
      }
    });
  }

  function closeAndReset() {
    onOpenChange(false);
    setDescription("");
    setSuggestion(null);
    setError(null);
  }

  return (
    <section
      className="rounded-[20px] sm:rounded-[28px] p-3.5 sm:p-5"
      style={{
        background: surface.s1,
        border: `1.5px solid ${theme.accent}`,
        boxShadow: `0 14px 30px -18px ${theme.accent}`,
      }}
    >
      <div className="flex items-start justify-between gap-3">
        <div>
          <p className="text-xs font-bold uppercase tracking-[0.16em]" style={{ color: theme.accent }}>
            Création assistée IA
          </p>
          <h2 className="mt-1 text-base font-bold" style={{ color: text.primary }}>
            Décris ton projet, l&apos;IA propose la structure
          </h2>
          <p className="mt-1 text-xs leading-relaxed" style={{ color: text.muted }}>
            L&apos;IA propose un objectif, des étapes et des tâches avec un attendu pour chacune. Tu peux ensuite ajuster.
          </p>
        </div>
        <button
          type="button"
          onClick={closeAndReset}
          className="rounded-xl px-2.5 py-1 text-xs"
          style={{ background: surface.s2, color: text.muted, border: `1px solid ${surface.borderSubtle}`, cursor: "pointer" }}
        >
          Fermer
        </button>
      </div>

      <div className="mt-4">
        <textarea
          value={description}
          onChange={(event) => setDescription(event.target.value)}
          placeholder="Ex : Organiser un road trip aux USA en juillet pour 4 personnes, gérer le budget, l'itinéraire, l'hébergement et l'administratif."
          rows={5}
          className="w-full rounded-2xl px-4 py-3 text-sm outline-none"
          style={{ background: surface.s2, color: text.primary, border: `1px solid ${surface.borderSubtle}`, resize: "vertical", lineHeight: 1.5 }}
          disabled={pending}
        />
      </div>

      <div className="mt-3 flex items-center gap-2">
        <button
          type="button"
          onClick={handleGenerate}
          disabled={pending || !description.trim()}
          className="inline-flex items-center gap-2 rounded-2xl px-4 py-2.5 text-sm font-bold"
          style={{
            background: theme.accent,
            color: "#FFFFFF",
            border: "none",
            cursor: pending || !description.trim() ? "not-allowed" : "pointer",
            opacity: pending || !description.trim() ? 0.6 : 1,
          }}
        >
          <SparkleIcon />
          {pending ? "Génération…" : suggestion ? "Régénérer" : "Générer la proposition"}
        </button>
      </div>

      {error && (
        <p className="mt-3 rounded-xl px-3 py-2 text-xs" style={{ background: "var(--mb-status-red-bg)", color: "var(--mb-status-red-text)" }}>
          {error}
        </p>
      )}

      {suggestion && (
        <div className="mt-5 grid gap-4">
          <div className="rounded-2xl p-3 sm:p-4" style={{ background: surface.s2, border: `1px solid ${surface.borderSubtle}` }}>
            <p className="text-[10px] font-bold uppercase tracking-[0.14em]" style={{ color: text.muted }}>Nom</p>
            <p className="mt-1 text-base font-bold" style={{ color: text.primary }}>{suggestion.name}</p>

            <p className="mt-3 text-[10px] font-bold uppercase tracking-[0.14em]" style={{ color: text.muted }}>Objectif</p>
            <p className="mt-1 text-sm" style={{ color: text.secondary }}>{suggestion.objective}</p>

            <p className="mt-3 text-[10px] font-bold uppercase tracking-[0.14em]" style={{ color: text.muted }}>Contexte</p>
            <p className="mt-1 text-sm" style={{ color: text.secondary }}>{suggestion.context}</p>
          </div>

          <div className="rounded-2xl p-3 sm:p-4" style={{ background: surface.s2, border: `1px solid ${surface.borderSubtle}` }}>
            <p className="text-[10px] font-bold uppercase tracking-[0.14em]" style={{ color: text.muted }}>
              Étapes proposées ({suggestion.steps.length})
            </p>
            <ol className="mt-2 grid gap-3">
              {suggestion.steps.map((step, index) => (
                <li key={index} className="rounded-xl p-2.5 sm:p-3" style={{ background: surface.s1, border: `1px solid ${surface.borderSubtle}` }}>
                  <p className="text-sm font-bold" style={{ color: text.primary }}>
                    {index + 1}. {step.title}
                  </p>
                  {step.description && (
                    <p className="mt-1 text-[11.5px]" style={{ color: text.muted }}>{step.description}</p>
                  )}
                  <ul className="mt-2 grid gap-1.5">
                    {step.tasks.map((task, ti) => (
                      <li key={ti} className="rounded-lg px-2.5 sm:px-3 py-2" style={{ background: surface.s2, border: `1px solid ${surface.borderSubtle}` }}>
                        <p className="mb-task-title text-[12px] font-semibold" style={{ color: text.primary }}>· {task.title}</p>
                        <p className="mt-0.5 text-[11px]" style={{ color: text.muted }}>
                          <span style={{ color: theme.accent, fontWeight: 600 }}>Attendu :</span> {task.expected}
                        </p>
                      </li>
                    ))}
                  </ul>
                </li>
              ))}
            </ol>
          </div>

          <div className="grid gap-3 sm:grid-cols-2">
            <label className="block">
              <span className="mb-1 block text-[10px] font-bold uppercase tracking-[0.14em]" style={{ color: text.muted }}>
                Catégorie
              </span>
              <select
                value={subcategory}
                onChange={(event) => setSubcategory(event.target.value)}
                className="w-full rounded-2xl px-3 py-2.5 text-sm outline-none"
                style={{ background: surface.s2, color: text.primary, border: `1px solid ${surface.borderSubtle}` }}
              >
                {subcategoryOptions.filter((option) => option.key !== "other").map((option) => (
                  <option key={option.key} value={option.key}>{option.label}</option>
                ))}
              </select>
            </label>
            <label className="block">
              <span className="mb-1 block text-[10px] font-bold uppercase tracking-[0.14em]" style={{ color: text.muted }}>
                Priorité
              </span>
              <select
                value={priority}
                onChange={(event) => setPriority(event.target.value as ProjectPriority)}
                className="w-full rounded-2xl px-3 py-2.5 text-sm outline-none"
                style={{ background: surface.s2, color: text.primary, border: `1px solid ${surface.borderSubtle}` }}
              >
                {PROJECT_PRIORITY_OPTIONS.map((option) => (
                  <option key={option.value} value={option.value}>{option.label}</option>
                ))}
              </select>
            </label>
          </div>

          <div className="flex flex-wrap items-center gap-2">
            <button
              type="button"
              onClick={handleCreate}
              disabled={createPending}
              className="inline-flex items-center gap-2 rounded-2xl px-5 py-2.5 text-sm font-bold"
              style={{
                background: theme.accent,
                color: "#FFFFFF",
                border: "none",
                cursor: createPending ? "wait" : "pointer",
                opacity: createPending ? 0.7 : 1,
              }}
            >
              {createPending ? "Création…" : "Créer ce projet"}
            </button>
            <button
              type="button"
              onClick={() => setSuggestion(null)}
              disabled={createPending}
              className="rounded-2xl px-4 py-2.5 text-xs font-semibold"
              style={{ background: surface.s2, color: text.secondary, border: `1px solid ${surface.borderSubtle}`, cursor: "pointer" }}
            >
              Effacer la proposition
            </button>
          </div>
        </div>
      )}
    </section>
  );
}

interface AIProjectCreatorTriggerProps {
  workspace: Workspace;
  active: boolean;
  onToggle: () => void;
}

export function AIProjectCreatorTrigger({ workspace, active, onToggle }: AIProjectCreatorTriggerProps) {
  const theme = workspaceTheme[workspace];
  const isPaid = useIsPaidPlan();
  // Création IA réservée au plan Pro : pas de bouton pour les comptes gratuits.
  if (!isPaid) return null;
  return (
    <button
      type="button"
      onClick={onToggle}
      className="inline-flex items-center gap-1.5 rounded-full px-3 py-1.5 text-[12px] font-bold"
      style={{
        background: theme.accent,
        color: "#FFFFFF",
        border: "none",
        cursor: "pointer",
        boxShadow: active ? "none" : "0 2px 8px -2px rgba(16, 24, 40, 0.16)",
        opacity: active ? 0.85 : 1,
      }}
    >
      <SparkleIcon />
      {active ? "Fermer l'IA" : "Créer avec l'IA"}
    </button>
  );
}

function SparkleIcon() {
  return (
    <svg width="13" height="13" viewBox="0 0 16 16" fill="none" aria-hidden="true">
      <path
        d="M8 2.5v3M8 10.5v3M2.5 8h3M10.5 8h3M4.5 4.5l1.5 1.5M10 10l1.5 1.5M4.5 11.5L6 10M10 6l1.5-1.5"
        stroke="currentColor"
        strokeWidth="1.5"
        strokeLinecap="round"
      />
    </svg>
  );
}
