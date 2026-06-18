"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import type { StandaloneTask } from "@/lib/standalone-tasks-store";
import type { Workspace } from "@/lib/workspace";
import { workspaceTheme } from "@/lib/workspace";
import { surface, text, statusColor, error as errorTokens } from "@/lib/design-tokens";
import { priorityVisuals } from "@/lib/project-taxonomy";
import { deriveTaskStatus } from "@/lib/project-plan";
import { useIsPaidPlan } from "@/components/account/account-context";
import { useT } from "@/components/i18n/locale-provider";
import { useStatusLabel, usePriorityLabel } from "@/components/i18n/labels";
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
  const [mode, setMode] = useState<"manual" | "ai">("manual");
  const [title, setTitle] = useState("");
  const [aiText, setAiText] = useState("");
  const [expandedId, setExpandedId] = useState<string | null>(null);

  function refresh() {
    startTransition(() => router.refresh());
  }

  async function createManual() {
    const clean = title.trim();
    if (!clean || busy) return;
    setBusy(true);
    try {
      await createStandaloneTaskAction({ title: clean, workspace });
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
      await generateStandaloneTaskAction({ description: clean, workspace });
      setAiText("");
      router.refresh();
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="mx-auto flex w-full max-w-[840px] flex-col gap-4">
      {/* Création : Manuel ET Avec l'IA, à parts égales (onglets). */}
      <section className="rounded-[20px] p-4" style={{ background: surface.s1, border: `1px solid ${surface.border}` }}>
        <div className="mb-3 flex items-center gap-2">
          <p className="text-[12.5px] font-bold uppercase tracking-[0.1em]" style={{ color: text.primary }}>
            {t("tasks.newTask")}
          </p>
          <div className="ml-auto inline-flex items-center gap-1 rounded-xl p-1" style={{ background: surface.s2, border: `1px solid ${surface.borderSubtle}` }}>
            <button
              type="button"
              onClick={() => setMode("manual")}
              className="rounded-lg px-3 py-1.5 text-xs font-semibold"
              style={{ background: mode === "manual" ? surface.s1 : "transparent", color: mode === "manual" ? text.primary : text.muted, border: mode === "manual" ? `1px solid ${surface.border}` : "1px solid transparent", cursor: "pointer" }}
            >
              {t("tasks.manual")}
            </button>
            <button
              type="button"
              onClick={() => setMode("ai")}
              className="rounded-lg px-3 py-1.5 text-xs font-semibold"
              style={{ background: mode === "ai" ? surface.s1 : "transparent", color: mode === "ai" ? text.primary : text.muted, border: mode === "ai" ? `1px solid ${surface.border}` : "1px solid transparent", cursor: "pointer" }}
            >
              {t("tasks.withAI")}
            </button>
          </div>
        </div>

        {mode === "manual" ? (
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
        ) : (
          <div className="flex flex-col gap-2">
            <textarea
              value={aiText}
              onChange={(event) => setAiText(event.target.value)}
              placeholder={t("tasks.ai.placeholder")}
              rows={3}
              className="w-full resize-none rounded-xl px-3 py-2.5 text-sm outline-none"
              style={{ background: surface.s2, color: text.primary, border: `1px solid ${surface.border}` }}
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

      {tasks.length === 0 ? (
        <p className="px-1 py-10 text-center text-sm" style={{ color: text.muted }}>
          {t("tasks.empty")}
        </p>
      ) : (
        <div className="flex flex-col gap-2.5">
          {tasks.map((task) => (
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
                <span style={{ color: text.muted }}>⏱ {task.dueDate}</span>
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
