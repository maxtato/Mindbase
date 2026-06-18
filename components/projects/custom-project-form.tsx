"use client";

import { useActionState, useEffect, useState, type CSSProperties, type ReactNode } from "react";
import { useRouter } from "next/navigation";
import { createProjectAction } from "@/app/dashboard/projects/actions";
import { initialCreateProjectFormState } from "@/app/dashboard/projects/form-state";
import { error, surface, text } from "@/lib/design-tokens";
import {
  CUSTOM_SUBCATEGORY_DEFAULT_COLOR,
  PROJECT_PRIORITY_OPTIONS,
  getSubcategoryOption,
  getSubcategoryOptions,
  normalizeHexColor,
  type ProjectPriority,
} from "@/lib/project-taxonomy";
import { workspaceTheme, BUILTIN_WORKSPACES, ALL_WORKSPACE, type Workspace } from "@/lib/workspace";
import { stepStatusLabels, taskStatusLabels } from "@/lib/project-plan";
import type { StepStatus, TaskStatus } from "@/lib/mock-data";
import { ProjectCategoryIcon } from "@/components/projects/project-taxonomy-ui";
import { AIProjectCreator, AIProjectCreatorTrigger } from "@/components/projects/ai-project-creator";
import { useEnvironments } from "@/components/environments/environments-provider";

const TASK_STATUS_ORDER: TaskStatus[] = ["todo", "in_progress", "waiting", "blocked", "done"];
const STEP_STATUS_ORDER: StepStatus[] = ["todo", "in_progress", "waiting", "done"];

const TASK_STATUS_DEFAULT_COLORS: Record<TaskStatus, string> = {
  todo: "#64748B",
  in_progress: "#F59E0B",
  waiting: "#3B82F6",
  blocked: "#EF4444",
  done: "#22C55E",
};

const STEP_STATUS_DEFAULT_COLORS: Record<StepStatus, string> = {
  todo: "#64748B",
  in_progress: "#F59E0B",
  waiting: "#3B82F6",
  done: "#22C55E",
};

type EditableStatus<TStatus extends string> = {
  id: string;
  systemStatus: TStatus;
  label: string;
  color: string;
  base: boolean;
};

interface CustomProjectFormProps {
  workspace: Workspace;
}

export function CustomProjectForm({ workspace }: CustomProjectFormProps) {
  const router = useRouter();
  const environments = useEnvironments();
  const isAll = workspace === ALL_WORKSPACE;
  // En vue « Tous », on demande dans quel environnement créer le projet.
  const [targetWorkspace, setTargetWorkspace] = useState<Workspace>(isAll ? "personal" : workspace);
  // L'environnement est toujours modifiable à la création (même si on arrive
  // depuis un environnement précis).
  const effectiveWorkspace = targetWorkspace;
  const theme = workspaceTheme[effectiveWorkspace];
  const [state, formAction, pending] = useActionState(createProjectAction, initialCreateProjectFormState);
  const [subcategory, setSubcategory] = useState<string>(getSubcategoryOptions(effectiveWorkspace)[0]?.key ?? "other");
  // Quand on change d'environnement (vue « Tous »), la sous-catégorie courante
  // peut ne pas exister pour le nouvel espace (ex. « maison » en Perso → invalide
  // en Pro). On la réinitialise alors sur la première option valide pour éviter
  // un rejet à la création.
  useEffect(() => {
    const keys = getSubcategoryOptions(effectiveWorkspace).map((option) => String(option.key));
    if (!keys.includes(subcategory)) {
      setSubcategory(keys[0] ?? "other");
    }
  }, [effectiveWorkspace, subcategory]);
  const [priority, setPriority] = useState<ProjectPriority>("medium");
  const [customSubcategoryLabel, setCustomSubcategoryLabel] = useState("");
  const [customSubcategoryColor, setCustomSubcategoryColor] = useState<string>(
    getSubcategoryOption(effectiveWorkspace, "other")?.color ?? CUSTOM_SUBCATEGORY_DEFAULT_COLOR,
  );
  const [taskStatuses, setTaskStatuses] = useState<Array<EditableStatus<TaskStatus>>>(() =>
    TASK_STATUS_ORDER.map((status) => ({
      id: `task-${status}`,
      systemStatus: status,
      label: taskStatusLabels[status],
      color: TASK_STATUS_DEFAULT_COLORS[status],
      base: true,
    })),
  );
  const [stepStatuses, setStepStatuses] = useState<Array<EditableStatus<StepStatus>>>(() =>
    STEP_STATUS_ORDER.map((status) => ({
      id: `step-${status}`,
      systemStatus: status,
      label: stepStatusLabels[status],
      color: STEP_STATUS_DEFAULT_COLORS[status],
      base: true,
    })),
  );
  const isCustomSubcategory = subcategory === "other";
  const resolvedCustomColor = normalizeHexColor(customSubcategoryColor, CUSTOM_SUBCATEGORY_DEFAULT_COLOR);
  const [aiOpen, setAiOpen] = useState(false);

  const fieldStyle: CSSProperties = {
    width: "100%",
    border: `1px solid ${surface.borderSubtle}`,
    borderRadius: "1rem",
    background: surface.s2,
    color: text.primary,
    fontSize: "0.86rem",
    outline: "none",
    padding: "0.82rem 0.92rem",
  };

  function chooseSubcategory(next: string) {
    setSubcategory(next);
    const option = getSubcategoryOption(workspace, next);
    if (option) setCustomSubcategoryColor(option.color);
  }

  return (
    <div className="flex h-full flex-col overflow-hidden" style={{ background: surface.bg, color: text.primary }}>
      <header className="flex h-16 shrink-0 items-center justify-between px-6" style={{ background: surface.s1, borderBottom: `1px solid ${surface.borderSubtle}` }}>
        <div className="flex items-center gap-3">
          <button
            type="button"
            onClick={() => router.back()}
            className="text-sm font-semibold"
            style={{ color: text.muted }}
          >
            ← Retour
          </button>
          <AIProjectCreatorTrigger
            workspace={effectiveWorkspace}
            active={aiOpen}
            onToggle={() => setAiOpen((current) => !current)}
          />
        </div>
        <span className="rounded-full px-3 py-1 text-xs font-semibold" style={{ background: theme.accentBg, color: theme.accentText }}>
          {theme.label}
        </span>
      </header>

      <main className="mb-mobile-scroll flex-1 overflow-y-auto px-3 sm:px-6 py-4 sm:py-7">
        {aiOpen && (
          <div className="mx-auto mb-5 w-full max-w-[1480px]">
            <AIProjectCreator workspace={effectiveWorkspace} open={aiOpen} onOpenChange={setAiOpen} />
          </div>
        )}
        <form action={formAction} className="mx-auto grid w-full max-w-[1480px] gap-5 xl:grid-cols-[minmax(0,1.05fr)_minmax(320px,0.82fr)_minmax(340px,0.9fr)]">
          <input type="hidden" name="workspace" value={effectiveWorkspace} />
          {(
            <div className="xl:col-span-3" style={{ display: "flex", flexDirection: "column", gap: 6 }}>
              <label className="text-[11px] font-semibold uppercase tracking-[0.14em]" style={{ color: text.muted }}>
                Environnement
              </label>
              <select
                value={targetWorkspace}
                onChange={(event) => setTargetWorkspace(event.target.value)}
                className="rounded-xl px-3 py-2.5 text-sm outline-none"
                style={{ background: surface.s2, color: text.primary, border: `1px solid ${surface.border}`, maxWidth: 320 }}
              >
                {BUILTIN_WORKSPACES.map((ws) => (
                  <option key={ws} value={ws}>{workspaceTheme[ws].label}</option>
                ))}
                {environments.map((env) => (
                  <option key={env.id} value={env.id}>{env.name}</option>
                ))}
              </select>
            </div>
          )}
          <input type="hidden" name="mode" value="custom" />
          <input type="hidden" name="status" value="preparing" />
          <input type="hidden" name="projectType" value="execution" />
          <input type="hidden" name="subcategory" value={subcategory} />
          <input type="hidden" name="priority" value={priority} />
          <input type="hidden" name="templateKey" value="" />
          <StatusHiddenInputs
            scope="task"
            baseOrder={TASK_STATUS_ORDER}
            rows={taskStatuses}
            labels={taskStatusLabels}
            colors={TASK_STATUS_DEFAULT_COLORS}
          />
          <StatusHiddenInputs
            scope="step"
            baseOrder={STEP_STATUS_ORDER}
            rows={stepStatuses}
            labels={stepStatusLabels}
            colors={STEP_STATUS_DEFAULT_COLORS}
          />
          {!isCustomSubcategory && <input type="hidden" name="customSubcategoryLabel" value="" />}
          {!isCustomSubcategory && <input type="hidden" name="customSubcategoryColor" value="" />}

          <section className="mb-card-premium rounded-[30px] p-6" style={{ background: surface.s1 }}>
            <p className="text-xs font-bold uppercase tracking-[0.16em]" style={{ color: theme.accent }}>
              Projet personnalisé
            </p>
            <h1 className="mt-2 text-2xl font-bold" style={{ color: text.primary }}>
              Créer un projet
            </h1>
            <p className="mt-2 text-sm leading-relaxed" style={{ color: text.muted }}>
              Pose les bases du projet. Les étapes et les tâches seront ajoutées ensuite depuis la fiche projet.
            </p>

            <div className="mt-6 grid gap-4">
              <Field label="Nom du projet" required errorMessage={state.errors?.name}>
                <input name="name" placeholder="Ex: Agrandissement maison" style={fieldStyle} autoComplete="off" />
              </Field>

              <Field label="Description courte">
                <input name="description" placeholder="Une phrase pour résumer le projet." style={fieldStyle} />
              </Field>

              <Field label="Objectif">
                <textarea
                  name="objective"
                  placeholder="Quel résultat concret veux-tu obtenir ?"
                  rows={5}
                  style={{ ...fieldStyle, resize: "vertical", lineHeight: 1.5 }}
                />
              </Field>

              <Field label="Contexte">
                <textarea
                  name="context"
                  placeholder="Contraintes, informations utiles, éléments déjà connus."
                  rows={5}
                  style={{ ...fieldStyle, resize: "vertical", lineHeight: 1.5 }}
                />
              </Field>
            </div>
          </section>

          <section className="mb-card-premium rounded-[30px] p-6" style={{ background: surface.s1 }}>
            <h2 className="text-sm font-bold" style={{ color: text.primary }}>
              Thème du projet
            </h2>
            <p className="mt-1 text-xs leading-relaxed" style={{ color: text.muted }}>
              Le thème donne la couleur principale du projet dans les listes, le dashboard et la page projet.
            </p>

            <div className="mt-5 grid gap-4">
              <Field label="Catégorie" errorMessage={state.errors?.subcategory}>
                <div className="grid grid-cols-2 gap-2">
                  {getSubcategoryOptions(effectiveWorkspace).map((option) => {
                    const selected = subcategory === option.key;
                    return (
                      <button
                        key={option.key}
                        type="button"
                        onClick={() => chooseSubcategory(option.key)}
                        className="mb-card-hover rounded-2xl p-3 text-left"
                        style={{
                          background: selected ? surface.s2 : surface.s3,
                          color: text.primary,
                          border: `1px solid ${selected ? option.color : surface.borderSubtle}`,
                          cursor: "pointer",
                        }}
                      >
                        <span
                          className="mb-2 flex h-9 w-9 items-center justify-center rounded-xl"
                          style={{ background: option.color, color: "#FFFFFF" }}
                        >
                          <ProjectCategoryIcon icon={option.icon} color="#FFFFFF" size={21} />
                        </span>
                        <span className="block text-xs font-bold">{option.label}</span>
                        {selected && (
                          <span className="mt-1 block text-[10px] font-semibold" style={{ color: option.color }}>
                            Sélectionné
                          </span>
                        )}
                      </button>
                    );
                  })}
                </div>
              </Field>

              {isCustomSubcategory && (
                <div className="rounded-2xl p-3" style={{ background: surface.s3, border: `1px solid ${surface.borderSubtle}` }}>
                  <div className="grid gap-3">
                    <Field label="Nom de la catégorie" errorMessage={state.errors?.customSubcategoryLabel}>
                      <input
                        name="customSubcategoryLabel"
                        value={customSubcategoryLabel}
                        onChange={(event) => setCustomSubcategoryLabel(event.target.value)}
                        placeholder="Ex: Jardin"
                        style={fieldStyle}
                      />
                    </Field>
                    <Field label="Couleur personnalisée" errorMessage={state.errors?.customSubcategoryColor}>
                      <div className="flex items-center gap-2">
                        <input
                          type="color"
                          value={resolvedCustomColor}
                          onChange={(event) => setCustomSubcategoryColor(event.target.value)}
                          className="h-11 w-12 rounded-xl"
                          style={{ border: "none", background: surface.s2, cursor: "pointer" }}
                          aria-label="Couleur personnalisée"
                        />
                        <input
                          name="customSubcategoryColor"
                          value={resolvedCustomColor}
                          onChange={(event) => setCustomSubcategoryColor(event.target.value)}
                          style={fieldStyle}
                        />
                      </div>
                    </Field>
                  </div>
                </div>
              )}

              <Field label="Priorité" errorMessage={state.errors?.priority}>
                <select
                  value={priority}
                  onChange={(event) => setPriority(event.target.value as ProjectPriority)}
                  style={fieldStyle}
                >
                  {PROJECT_PRIORITY_OPTIONS.map((option) => (
                    <option key={option.value} value={option.value}>
                      {option.label}
                    </option>
                  ))}
                </select>
              </Field>
            </div>
          </section>

          <aside className="mb-card-premium grid content-start gap-4 rounded-[30px] p-6" style={{ background: surface.s1 }}>
            <div>
              <h2 className="text-sm font-bold" style={{ color: text.primary }}>
                Personnalisation des statuts
              </h2>
              <p className="mt-1 text-xs leading-relaxed" style={{ color: text.muted }}>
                Renomme et recolorise les statuts pour qu'ils correspondent à ton vocabulaire.
              </p>
            </div>

            <CreationStatusEditor
              title="Tâches"
              rows={taskStatuses}
              accentColor={theme.accent}
              onChange={setTaskStatuses}
              statusOrder={TASK_STATUS_ORDER}
              defaultLabels={taskStatusLabels}
              defaultColors={TASK_STATUS_DEFAULT_COLORS}
              scope="task"
            />
            <CreationStatusEditor
              title="Étapes"
              rows={stepStatuses}
              accentColor={theme.accent}
              onChange={setStepStatuses}
              statusOrder={STEP_STATUS_ORDER}
              defaultLabels={stepStatusLabels}
              defaultColors={STEP_STATUS_DEFAULT_COLORS}
              scope="step"
            />

            {state.message && (
              <p className="rounded-2xl px-4 py-3 text-xs" style={{ background: error.bg, color: error.text }}>
                {state.message}
              </p>
            )}

            <button
              type="submit"
              disabled={pending}
              className="rounded-2xl px-5 py-3 text-sm font-bold"
              style={{ background: pending ? surface.s3 : theme.accent, color: pending ? text.muted : "#FFFFFF", cursor: pending ? "wait" : "pointer" }}
            >
              {pending ? "Création..." : "Créer le projet"}
            </button>
          </aside>
        </form>
      </main>
    </div>
  );
}

function StatusHiddenInputs<TStatus extends string>({
  scope,
  baseOrder,
  rows,
  labels,
  colors,
}: {
  scope: "task" | "step";
  baseOrder: TStatus[];
  rows: Array<EditableStatus<TStatus>>;
  labels: Record<TStatus, string>;
  colors: Record<TStatus, string>;
}) {
  const basePrefix = scope === "task" ? "taskStatus" : "stepStatus";
  const extraPrefix = scope === "task" ? "taskStatusExtra" : "stepStatusExtra";

  return (
    <>
      {baseOrder.map((status) => {
        const row = rows.find((item) => item.base && item.systemStatus === status);
        return (
          <span key={`${scope}-${status}`} hidden>
            <input type="hidden" name={`${basePrefix}Enabled:${status}`} value={row ? "true" : "false"} />
            <input type="hidden" name={`${basePrefix}Label:${status}`} value={row?.label ?? labels[status]} />
            <input type="hidden" name={`${basePrefix}Color:${status}`} value={row?.color ?? colors[status]} />
          </span>
        );
      })}
      {rows.filter((row) => !row.base).map((row) => (
        <span key={row.id} hidden>
          <input type="hidden" name={`${extraPrefix}Label`} value={row.label} />
          <input type="hidden" name={`${extraPrefix}Color`} value={row.color} />
          <input type="hidden" name={`${extraPrefix}SystemStatus`} value={row.systemStatus} />
        </span>
      ))}
    </>
  );
}

function CreationStatusEditor<TStatus extends string>({
  title,
  rows,
  accentColor,
  onChange,
  statusOrder,
  defaultLabels,
  defaultColors,
  scope,
}: {
  title: string;
  rows: Array<EditableStatus<TStatus>>;
  accentColor: string;
  onChange: (rows: Array<EditableStatus<TStatus>>) => void;
  statusOrder: TStatus[];
  defaultLabels: Record<TStatus, string>;
  defaultColors: Record<TStatus, string>;
  scope: "task" | "step";
}) {
  function updateRow(id: string, patch: Partial<EditableStatus<TStatus>>) {
    onChange(rows.map((row) => (row.id === id ? { ...row, ...patch } : row)));
  }

  function removeRow(id: string) {
    if (rows.length <= 1) return;
    onChange(rows.filter((row) => row.id !== id));
  }

  function addCustomStatus() {
    const fallback = statusOrder[0];
    onChange([
      ...rows,
      {
        id: `${scope}-custom-${Date.now()}-${Math.random().toString(16).slice(2)}`,
        systemStatus: fallback,
        label: "Nouveau statut",
        color: defaultColors[fallback],
        base: false,
      },
    ]);
  }

  function restoreBaseStatus(status: TStatus) {
    onChange([
      ...rows,
      {
        id: `${scope}-${status}`,
        systemStatus: status,
        label: defaultLabels[status],
        color: defaultColors[status],
        base: true,
      },
    ]);
  }

  const hiddenBaseStatuses = statusOrder.filter(
    (status) => !rows.some((row) => row.base && row.systemStatus === status),
  );

  return (
    <div className="rounded-2xl p-4" style={{ background: surface.s3, border: `1px solid ${surface.borderSubtle}` }}>
      <div className="mb-3 flex items-center justify-between gap-2">
        <p className="text-xs font-bold" style={{ color: text.primary }}>
          {title}
        </p>
        <button
          type="button"
          onClick={addCustomStatus}
          className="shrink-0 rounded-xl px-3 py-1.5 text-[11px] font-semibold"
          style={{ background: accentColor, color: "#FFFFFF", border: "none", cursor: "pointer" }}
        >
          + Ajouter
        </button>
      </div>

      <div className="flex flex-col gap-2">
        {rows.map((row) => (
          <div
            key={row.id}
            className="rounded-xl p-2.5"
            style={{ background: surface.s1, border: `1px solid ${surface.borderSubtle}` }}
          >
            <div
              className="grid items-center gap-2"
              style={{ gridTemplateColumns: row.base ? "36px minmax(0, 1fr) 32px" : "36px minmax(0, 1fr) minmax(96px, 0.6fr) 32px" }}
            >
              <label
                className="relative inline-flex h-9 w-9 shrink-0 items-center justify-center rounded-lg"
                style={{ background: row.color, cursor: "pointer", overflow: "hidden" }}
                aria-label={`Couleur ${row.label}`}
              >
                <input
                  type="color"
                  value={row.color}
                  onChange={(event) => updateRow(row.id, { color: event.target.value })}
                  className="absolute inset-0 h-full w-full cursor-pointer opacity-0"
                />
              </label>
              <input
                value={row.label}
                onChange={(event) => updateRow(row.id, { label: event.target.value })}
                placeholder="Nom du statut"
                className="h-9 min-w-0 rounded-lg px-3 text-[13px] font-medium outline-none"
                style={{ background: surface.s2, color: text.primary, border: `1px solid ${surface.borderSubtle}` }}
                aria-label={`Nom du statut ${row.label}`}
              />
              {!row.base && (
                <select
                  value={row.systemStatus}
                  onChange={(event) => updateRow(row.id, { systemStatus: event.target.value as TStatus })}
                  className="h-9 min-w-0 rounded-lg px-2 text-[11px] font-semibold outline-none"
                  style={{ background: surface.s2, color: text.secondary, border: `1px solid ${surface.borderSubtle}` }}
                  aria-label="Catégorie système"
                >
                  {statusOrder.map((status) => (
                    <option key={status} value={status}>
                      {defaultLabels[status]}
                    </option>
                  ))}
                </select>
              )}
              <button
                type="button"
                onClick={() => removeRow(row.id)}
                disabled={rows.length <= 1}
                className="flex h-9 w-9 items-center justify-center rounded-lg"
                style={{
                  background: rows.length <= 1 ? surface.s2 : "var(--mb-delete-bg)",
                  color: rows.length <= 1 ? text.ghost : "var(--mb-delete-text)",
                  border: `1px solid ${rows.length <= 1 ? surface.borderSubtle : "var(--mb-delete-border)"}`,
                  cursor: rows.length <= 1 ? "not-allowed" : "pointer",
                }}
                title="Supprimer le statut"
                aria-label="Supprimer le statut"
              >
                <svg width="12" height="12" viewBox="0 0 16 16" fill="none" aria-hidden="true">
                  <path d="m4 4 8 8M12 4l-8 8" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" />
                </svg>
              </button>
            </div>
            {row.base && (
              <p className="mt-1 pl-[44px] text-[10px] leading-snug" style={{ color: text.muted }}>
                Catégorie système : {defaultLabels[row.systemStatus]}
              </p>
            )}
          </div>
        ))}
      </div>

      {hiddenBaseStatuses.length > 0 && (
        <div className="mt-3 rounded-xl p-2.5" style={{ background: surface.s1, border: `1px dashed ${surface.borderSubtle}` }}>
          <p className="text-[10px] font-semibold uppercase tracking-[0.12em]" style={{ color: text.muted }}>
            Statuts masqués
          </p>
          <div className="mt-1.5 flex flex-wrap gap-1.5">
            {hiddenBaseStatuses.map((status) => (
              <button
                key={status}
                type="button"
                onClick={() => restoreBaseStatus(status)}
                className="rounded-full px-2.5 py-1 text-[11px] font-semibold"
                style={{ background: surface.s2, color: text.secondary, border: `1px solid ${surface.borderSubtle}`, cursor: "pointer" }}
              >
                Restaurer {defaultLabels[status]}
              </button>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}

function Field({
  label,
  required,
  errorMessage,
  children,
}: {
  label: string;
  required?: boolean;
  errorMessage?: string;
  children: ReactNode;
}) {
  return (
    <label className="block">
      <span className="mb-2 block text-xs font-bold uppercase tracking-[0.11em]" style={{ color: text.muted }}>
        {label}
        {required ? <span style={{ color: error.text }}> *</span> : null}
      </span>
      {children}
      {errorMessage && (
        <span className="mt-1.5 block text-xs" style={{ color: error.text }}>
          {errorMessage}
        </span>
      )}
    </label>
  );
}

