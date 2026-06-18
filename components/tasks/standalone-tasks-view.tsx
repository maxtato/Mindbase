"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import type { StandaloneTask } from "@/lib/standalone-tasks-store";
import type { Workspace } from "@/lib/workspace";
import { workspaceTheme, listEnvironmentOptions } from "@/lib/workspace";
import { useEnvironments } from "@/components/environments/environments-provider";
import { surface, text, statusColor, error as errorTokens } from "@/lib/design-tokens";
import { priorityVisuals } from "@/lib/project-taxonomy";
import { deriveTaskStatus } from "@/lib/project-plan";
import { formatTaskScheduleDate } from "@/lib/date-format";
import { useIsPaidPlan } from "@/components/account/account-context";
import { useT } from "@/components/i18n/locale-provider";
import { useStatusLabel, usePriorityLabel } from "@/components/i18n/labels";
import { FilterPill, FilterPillGroup, type FilterPillOption } from "@/components/ui/filter-pill";
import { TaskExpandedPreview } from "@/components/projects/task-expanded-preview";
import {
  createStandaloneTaskAction,
  deleteStandaloneTaskAction,
  generateStandaloneTaskAction,
  toggleStandaloneTaskDoneAction,
  updateStandaloneTaskAction,
} from "@/app/dashboard/tasks/actions";

export function StandaloneTasksView({ tasks, workspace }: { tasks: StandaloneTask[]; workspace: Workspace }) {
  const router = useRouter();
  const t = useT();
  const isPaid = useIsPaidPlan();
  const accent = workspaceTheme[workspace].accent;
  const [, startTransition] = useTransition();
  const [busy, setBusy] = useState(false);
  const [aiOpen, setAiOpen] = useState(false);
  const [title, setTitle] = useState("");
  const [aiText, setAiText] = useState("");
  const [expandedId, setExpandedId] = useState<string | null>(null);
  const [statusFilter, setStatusFilter] = useState<string>("all");
  const [priorityFilter, setPriorityFilter] = useState<string>("all");
  // Environnement auquel associer la tâche créée (obligatoire : une tâche
  // appartient à un environnement). Par défaut l'environnement courant, ou le
  // premier disponible en vue « Tous ».
  const environments = useEnvironments();
  const envOptions = listEnvironmentOptions(environments);
  const [targetWorkspace, setTargetWorkspace] = useState<string>(
    workspace !== "all" ? workspace : envOptions[0]?.value ?? "personal",
  );

  function refresh() {
    startTransition(() => router.refresh());
  }

  async function createManual() {
    const clean = title.trim();
    if (!clean || busy) return;
    setBusy(true);
    try {
      await createStandaloneTaskAction({ title: clean, workspace: targetWorkspace });
      setTitle("");
      router.refresh();
    } finally {
      setBusy(false);
    }
  }

  async function createWithAI() {
    const clean = aiText.trim();
    if (!clean || busy) return;
    setBusy(true);
    try {
      await generateStandaloneTaskAction({ description: clean, workspace: targetWorkspace });
      setAiText("");
      router.refresh();
    } finally {
      setBusy(false);
    }
  }

  // Filtres de la vue (statut / priorité), façon liste de tâches.
  const statusOptions: FilterPillOption<string>[] = [
    { value: "all", label: t("filter.taskStatus.all") },
    { value: "open", label: t("filter.taskStatus.open") },
    { value: "todo", label: t("filter.taskStatus.todo"), dot: "var(--mb-status-gray-text)" },
    { value: "in_progress", label: t("filter.taskStatus.inProgress"), dot: "var(--mb-status-yellow-text)" },
    { value: "waiting", label: t("filter.taskStatus.waiting"), dot: "var(--mb-status-blue-text)" },
    { value: "blocked", label: t("filter.taskStatus.blocked"), dot: "var(--mb-status-red-text)" },
    { value: "done", label: t("filter.taskStatus.done"), dot: "var(--mb-status-green-text)" },
  ];
  const priorityOptions: FilterPillOption<string>[] = [
    { value: "all", label: t("filter.priority.all") },
    { value: "high", label: t("filter.priority.high"), dot: "var(--mb-status-red-text)" },
    { value: "medium", label: t("filter.priority.medium"), dot: "var(--mb-status-yellow-text)" },
    { value: "low", label: t("filter.priority.low"), dot: "var(--mb-status-gray-text)" },
  ];

  const visibleTasks = tasks.filter((task) => {
    const status = deriveTaskStatus(task);
    const statusOk =
      statusFilter === "all" ? true : statusFilter === "open" ? status !== "done" : status === statusFilter;
    const priorityOk = priorityFilter === "all" || (task.priority ?? "medium") === priorityFilter;
    return statusOk && priorityOk;
  });

  return (
    <div className="mx-auto flex w-full max-w-[840px] flex-col gap-4">
      {/* Création : manuelle par défaut, + un bouton « Créer avec l'IA » violet. */}
      <section className="rounded-[20px] p-4" style={{ background: surface.s1, border: `1px solid ${surface.border}` }}>
        <p className="text-[12.5px] font-bold uppercase tracking-[0.1em]" style={{ color: text.primary }}>
          {t("tasks.newTask")}
        </p>
        <p className="mb-3 mt-1 text-[11px]" style={{ color: text.muted }}>
          {t("tasks.subtitle")}
        </p>

        <div className="mb-2 flex items-center gap-2">
          <span className="text-[11px] font-semibold" style={{ color: text.muted }}>
            {t("filter.environment")}
          </span>
          <select
            value={targetWorkspace}
            onChange={(event) => setTargetWorkspace(event.target.value)}
            className="rounded-lg px-2.5 py-1.5 text-xs outline-none"
            style={{ background: surface.s2, color: text.primary, border: `1px solid ${surface.border}` }}
          >
            {envOptions.map((option) => (
              <option key={option.value} value={option.value}>
                {option.label}
              </option>
            ))}
          </select>
        </div>
        <div className="flex items-center gap-2">
          <input
            type="text"
            value={title}
            onChange={(event) => setTitle(event.target.value)}
            onKeyDown={(event) => {
              if (event.key === "Enter") {
                event.preventDefault();
                createManual();
              }
            }}
            placeholder={t("tasks.title.placeholder")}
            className="min-w-0 flex-1 rounded-xl px-3 py-2.5 text-sm outline-none"
            style={{ background: surface.s2, color: text.primary, border: `1px solid ${surface.border}` }}
          />
          <button
            type="button"
            onClick={createManual}
            disabled={!title.trim() || busy}
            className="rounded-xl px-4 py-2.5 text-sm font-semibold"
            style={{ background: accent, color: "#FFFFFF", border: "none", cursor: title.trim() && !busy ? "pointer" : "not-allowed", opacity: title.trim() && !busy ? 1 : 0.6 }}
          >
            {t("tasks.create")}
          </button>
        </div>

        {/* Bouton « Créer avec l'IA » (violet, comme les autres entrées IA). */}
        <div className="mt-2.5">
          <button
            type="button"
            onClick={() => setAiOpen((current) => !current)}
            className="inline-flex items-center gap-1.5 rounded-full px-3.5 py-2 text-[13px] font-bold"
            style={{ background: accent, color: "#FFFFFF", border: "none", cursor: "pointer", boxShadow: "0 2px 8px -2px rgba(16, 24, 40, 0.16)", opacity: aiOpen ? 0.9 : 1 }}
          >
            <SparkleIcon />
            {t("tasks.ai.generate")}
          </button>
        </div>

        {aiOpen && (
          <div className="mt-3 flex flex-col gap-2 rounded-xl p-3" style={{ background: surface.s2, border: `1px solid ${surface.borderSubtle}` }}>
            <textarea
              value={aiText}
              onChange={(event) => setAiText(event.target.value)}
              placeholder={t("tasks.ai.placeholder")}
              rows={3}
              className="w-full resize-none rounded-xl px-3 py-2.5 text-sm outline-none"
              style={{ background: surface.s1, color: text.primary, border: `1px solid ${surface.border}` }}
            />
            <div className="flex items-center justify-between gap-2">
              {!isPaid && (
                <span className="text-[11px]" style={{ color: text.muted }}>
                  IA réservée au plan Pro.
                </span>
              )}
              <button
                type="button"
                onClick={createWithAI}
                disabled={!aiText.trim() || busy || !isPaid}
                className="ml-auto inline-flex items-center gap-1.5 rounded-xl px-4 py-2.5 text-sm font-semibold"
                style={{ background: accent, color: "#FFFFFF", border: "none", cursor: aiText.trim() && !busy && isPaid ? "pointer" : "not-allowed", opacity: aiText.trim() && !busy && isPaid ? 1 : 0.6 }}
              >
                <SparkleIcon />
                {busy ? t("tasks.ai.generating") : t("tasks.ai.generate")}
              </button>
            </div>
          </div>
        )}
      </section>

      {/* Filtres statut / priorité */}
      {tasks.length > 0 && (
        <FilterPillGroup>
          <FilterPill
            label={t("filter.status")}
            value={statusFilter}
            options={statusOptions}
            onChange={setStatusFilter}
            active={statusFilter !== "all"}
            accentColor={accent}
          />
          <FilterPill
            label={t("filter.priority")}
            value={priorityFilter}
            options={priorityOptions}
            onChange={setPriorityFilter}
            active={priorityFilter !== "all"}
            accentColor={accent}
          />
        </FilterPillGroup>
      )}

      {visibleTasks.length === 0 ? (
        <p className="px-1 py-10 text-center text-sm" style={{ color: text.muted }}>
          {t("tasks.empty")}
        </p>
      ) : (
        <div className="flex flex-col gap-2.5">
          {visibleTasks.map((task) => (
            <StandaloneTaskCard
              key={task.id}
              task={task}
              workspace={workspace}
              accent={accent}
              expanded={expandedId === task.id}
              onToggleExpand={() => setExpandedId((current) => (current === task.id ? null : task.id))}
              onAfterMutation={refresh}
            />
          ))}
        </div>
      )}
    </div>
  );
}

function StandaloneTaskCard({
  task,
  workspace,
  accent,
  expanded,
  onToggleExpand,
  onAfterMutation,
}: {
  task: StandaloneTask;
  workspace: Workspace;
  accent: string;
  expanded: boolean;
  onToggleExpand: () => void;
  onAfterMutation: () => void;
}) {
  const t = useT();
  const statusLabel = useStatusLabel();
  const priorityLabel = usePriorityLabel();
  const [, startTransition] = useTransition();
  const status = deriveTaskStatus(task);
  const isDone = status === "done";
  const priority = task.priority ?? "medium";
  const priorityVisual = priorityVisuals[priority];

  function toggleDone() {
    startTransition(async () => {
      await toggleStandaloneTaskDoneAction(task.id);
      onAfterMutation();
    });
  }

  function update(input: Parameters<typeof updateStandaloneTaskAction>[1]) {
    startTransition(async () => {
      await updateStandaloneTaskAction(task.id, input);
      onAfterMutation();
    });
  }

  function remove() {
    startTransition(async () => {
      await deleteStandaloneTaskAction(task.id);
      onAfterMutation();
    });
  }

  return (
    <div
      className="rounded-[14px]"
      style={{ background: surface.s1, border: `1px solid ${surface.borderSubtle}`, boxShadow: "var(--mb-shadow-card)", overflow: "hidden" }}
    >
      <div className="flex items-center gap-2.5 p-3">
        <button
          type="button"
          onClick={toggleDone}
          className="flex h-[20px] w-[20px] shrink-0 items-center justify-center rounded-full"
          style={{ background: isDone ? accent : "transparent", border: isDone ? "none" : `1.5px solid ${accent}`, cursor: "pointer" }}
          title={isDone ? "Marquer comme à faire" : "Marquer comme terminée"}
        >
          {isDone && (
            <svg width="10" height="10" viewBox="0 0 12 12" fill="none">
              <path d="M2 6l3 3 5-5" stroke="white" strokeWidth="1.9" strokeLinecap="round" strokeLinejoin="round" />
            </svg>
          )}
        </button>

        <button type="button" onClick={onToggleExpand} className="flex min-w-0 flex-1 items-center gap-2.5 text-left" style={{ background: "transparent", border: "none", cursor: "pointer" }}>
          <span className="min-w-0 flex-1">
            <span
              className="block truncate text-[13px] font-semibold"
              style={{ color: isDone ? text.ghost : text.primary, textDecoration: isDone ? "line-through" : "none" }}
            >
              {task.title}
            </span>
            <span className="mt-1 flex flex-wrap items-center gap-x-2.5 gap-y-1 text-[10px]" style={{ color: text.muted }}>
              {/* Marqueur « tâche libre » (pas de projet) + environnement. */}
              <span
                className="rounded-full px-1.5 py-0.5 font-semibold"
                style={{ background: `color-mix(in srgb, ${accent} 14%, transparent)`, color: accent }}
              >
                {t("tasks.freeBadge")}
              </span>
              {!isDone && (
                <span className="inline-flex items-center gap-1 font-semibold" style={{ color: priorityVisual.text }}>
                  <span aria-hidden style={{ width: 6, height: 6, borderRadius: "50%", background: priorityVisual.text }} />
                  {priorityLabel(priority, priorityVisual.label)}
                </span>
              )}
              {task.dueDate && (
                <span className="inline-flex items-center gap-1" style={{ color: text.muted }}>
                  <svg width="11" height="11" viewBox="0 0 16 16" fill="none" aria-hidden="true">
                    <path d="M4.5 2.7v2M11.5 2.7v2M3 6.2h10M4.4 3.7h7.2A1.7 1.7 0 0 1 13.3 5.4v6.2a1.7 1.7 0 0 1-1.7 1.7H4.4a1.7 1.7 0 0 1-1.7-1.7V5.4a1.7 1.7 0 0 1 1.7-1.7Z" stroke="currentColor" strokeWidth="1.35" strokeLinecap="round" strokeLinejoin="round" />
                  </svg>
                  {formatTaskScheduleDate(task.dueDate, task.dueTime)}
                </span>
              )}
            </span>
          </span>
          <span
            className="shrink-0 rounded-full px-2 py-0.5 text-[10px] font-semibold"
            style={{ background: isDone ? statusColor.green.bg : surface.s2, color: isDone ? statusColor.green.text : text.secondary }}
          >
            {statusLabel(status)}
          </span>
        </button>
      </div>

      {expanded && (
        <div className="border-t p-3" style={{ borderColor: surface.borderSubtle, background: surface.s2 }}>
          <TaskExpandedPreview
            task={task}
            accentColor={accent}
            workspace={workspace}
            onUpdate={(input) => update(input)}
            onChecklistMutated={(checklist) => update({ checklist })}
          />
          <div className="mt-2 flex justify-end">
            <button
              type="button"
              onClick={remove}
              className="inline-flex items-center gap-1.5 rounded-lg px-3 py-1.5 text-[11px] font-semibold"
              style={{ background: surface.s1, color: errorTokens.text, border: `1px solid ${errorTokens.border}`, cursor: "pointer" }}
            >
              {t("tasks.delete")}
            </button>
          </div>
        </div>
      )}
    </div>
  );
}

function SparkleIcon() {
  return (
    <svg width="14" height="14" viewBox="0 0 16 16" fill="none" aria-hidden="true">
      <path d="M8 2.5v3M8 10.5v3M2.5 8h3M10.5 8h3M4.5 4.5l1.5 1.5M10 10l1.5 1.5M4.5 11.5L6 10M10 6l1.5-1.5" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" />
    </svg>
  );
}
