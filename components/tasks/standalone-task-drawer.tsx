"use client";

import { useEffect, useState, useTransition } from "react";
import { createPortal } from "react-dom";
import { useRouter } from "next/navigation";
import { TaskExpandedPreview, QuickInfos } from "@/components/projects/task-expanded-preview";
import type { ChecklistItem, Task, TaskDiscussionMessage } from "@/lib/mock-data";
import { error as errorTokens, surface, text } from "@/lib/design-tokens";
import { workspaceTheme, type Workspace } from "@/lib/workspace";
import { useAccountName } from "@/components/account/account-context";
import { useT } from "@/components/i18n/locale-provider";
import {
  deleteStandaloneTaskAction,
  updateStandaloneTaskAction,
} from "@/app/dashboard/tasks/actions";

type StandaloneUpdateInput = Parameters<typeof updateStandaloneTaskAction>[1];

// Drawer d'édition d'une tâche libre (hors projet). Réutilise EXACTEMENT les
// panneaux d'une tâche de projet (TaskExpandedPreview + QuickInfos) mais route
// toutes les écritures vers le store des tâches autonomes. Sert aux vues
// transversales (Kanban / Calendrier) pour ouvrir la tâche sur place, sans
// renvoyer vers l'onglet Tâches.
export function StandaloneTaskDrawer({
  task,
  workspace,
  people = [],
  onClose,
  onDeleted,
}: {
  task: Task;
  /** Environnement du tableau courant (repli pour la couleur d'accent). */
  workspace: Workspace;
  /** Vivier d'assignation : membres de l'équipe (pas de projet ici). */
  people?: Array<{ id: string; name: string }>;
  onClose: () => void;
  onDeleted?: () => void;
}) {
  const router = useRouter();
  const t = useT();
  const accountName = useAccountName();
  const [draftTask, setDraftTask] = useState(task);
  const [, startTransition] = useTransition();

  // L'accent suit l'environnement de la tâche (Perso/Pro/personnalisé), avec
  // repli sur l'environnement du tableau.
  const taskWorkspace = (draftTask as Task & { workspace?: Workspace }).workspace ?? workspace;
  const accent = workspaceTheme[taskWorkspace]?.accent ?? workspaceTheme[workspace].accent;

  useEffect(() => setDraftTask(task), [task]);

  useEffect(() => {
    function handleKey(event: KeyboardEvent) {
      if (event.key === "Escape") onClose();
    }
    window.addEventListener("keydown", handleKey);
    return () => window.removeEventListener("keydown", handleKey);
  }, [onClose]);

  function handleUpdate(input: StandaloneUpdateInput) {
    setDraftTask((current) => ({ ...current, ...input }));
    startTransition(async () => {
      await updateStandaloneTaskAction(task.id, input);
    });
  }

  function handleChecklistMutated(nextChecklist: ChecklistItem[]) {
    setDraftTask((current) => ({ ...current, checklist: nextChecklist }));
    startTransition(async () => {
      await updateStandaloneTaskAction(task.id, { checklist: nextChecklist });
    });
  }

  async function handleSendDiscussionMessage(content: string) {
    const message: TaskDiscussionMessage = {
      id: `st_msg_${Date.now()}`,
      authorName: accountName.trim() || "Moi",
      content,
      createdAt: new Date().toISOString(),
    };
    const nextDiscussion = [...(draftTask.discussion ?? []), message];
    setDraftTask((current) => ({ ...current, discussion: nextDiscussion }));
    await updateStandaloneTaskAction(task.id, { discussion: nextDiscussion });
  }

  function handleDelete() {
    startTransition(async () => {
      await deleteStandaloneTaskAction(task.id);
      onClose();
      onDeleted?.();
      router.refresh();
    });
  }

  if (typeof document === "undefined") return null;

  return createPortal(
    <>
      <button
        type="button"
        onClick={onClose}
        className="mb-modal-backdrop"
        aria-label="Fermer la tâche"
        style={{ position: "fixed", inset: 0, zIndex: 70, border: "none", cursor: "default" }}
      />
      <div
        role="dialog"
        aria-modal="true"
        aria-label={draftTask.title}
        className="mb-modal-surface mb-task-drawer rounded-[20px] overflow-hidden"
        style={{ display: "flex", flexDirection: "column", zIndex: 80 }}
      >
        <header
          className="flex shrink-0 flex-col gap-3 px-5 py-4"
          style={{ background: surface.s1, borderBottom: `1px solid ${surface.borderSubtle}`, position: "relative" }}
        >
          <span aria-hidden style={{ position: "absolute", insetInline: 0, top: 0, height: 3, background: accent }} />
          <div className="flex items-start justify-between gap-4">
            <div className="min-w-0 flex-1">
              <p className="text-[10.5px] font-semibold uppercase tracking-[0.12em]" style={{ color: accent }}>
                {t("tasks.freeBadge")}
              </p>
              <h2
                className="mt-1 text-base font-bold"
                style={{
                  color: text.primary,
                  letterSpacing: "-0.005em",
                  lineHeight: 1.3,
                  overflowWrap: "anywhere",
                  wordBreak: "break-word",
                }}
              >
                {draftTask.title}
              </h2>
            </div>
            <button
              type="button"
              onClick={onClose}
              className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl"
              style={{ background: surface.s2, color: text.secondary, border: `1px solid ${surface.borderSubtle}`, cursor: "pointer" }}
              title="Fermer"
              aria-label="Fermer"
            >
              <svg width="13" height="13" viewBox="0 0 16 16" fill="none" aria-hidden="true">
                <path d="m4 4 8 8M12 4l-8 8" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" />
              </svg>
            </button>
          </div>

          {/* Collaboration : statut · date · personne · fichiers · priorité.
              Le vivier d'assignation est l'équipe (pas de projet ici). */}
          <QuickInfos
            headless
            task={draftTask}
            linkedTeams={[]}
            accentColor={accent}
            projectPeople={people}
            projectTeams={[]}
            onUpdate={handleUpdate}
          />
        </header>

        <div className="min-w-0 flex-1 overflow-y-auto overflow-x-hidden" style={{ background: surface.s1, padding: 12 }}>
          <TaskExpandedPreview
            task={draftTask}
            accentColor={accent}
            workspace={taskWorkspace}
            projectPeople={people}
            onUpdate={handleUpdate}
            onChecklistMutated={handleChecklistMutated}
            onSendDiscussionMessage={handleSendDiscussionMessage}
          />
          <div className="mt-2 flex justify-end">
            <button
              type="button"
              onClick={handleDelete}
              className="inline-flex items-center gap-1.5 rounded-lg px-3 py-1.5 text-[11px] font-semibold"
              style={{ background: surface.s1, color: errorTokens.text, border: `1px solid ${errorTokens.border}`, cursor: "pointer" }}
            >
              {t("tasks.delete")}
            </button>
          </div>
        </div>
      </div>
    </>,
    document.body,
  );
}
