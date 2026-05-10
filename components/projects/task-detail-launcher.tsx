"use client";

import { useEffect, useState, useTransition, type ReactNode } from "react";
import { createPortal } from "react-dom";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { updateTaskAction } from "@/app/dashboard/projects/[id]/actions";
import { TaskExpandedPreview } from "@/components/projects/task-expanded-preview";
import type { ChecklistItem, ProjectPerson, ProjectStatusSettings, ProjectTeam, Task } from "@/lib/mock-data";
import { surface, text } from "@/lib/design-tokens";
import type { Workspace } from "@/lib/workspace";

type TaskUpdateInput = Partial<Pick<Task, "title" | "description" | "owner" | "assignees" | "teamIds" | "dueDate" | "dueTime" | "status" | "priority" | "expected" | "realization" | "comments" | "checklist">> & {
  manualNote?: string;
};

interface TaskDetailLauncherProps {
  projectId: string;
  workspace: Workspace;
  stepId: string;
  stepTitle: string;
  stepDescription?: string;
  task: Task;
  accentColor: string;
  projectPeople?: ProjectPerson[];
  projectTeams?: ProjectTeam[];
  statusSettings?: ProjectStatusSettings;
  label?: string;
  compact?: boolean;
  trigger?: (input: { open: () => void }) => ReactNode;
  /** Notification optimiste vers le parent (ex : StepsPanel qui maintient
   *  son propre state des tâches). Si fourni, on ne déclenche PAS un
   *  router.refresh — le parent prend la main pour propager la mise à jour
   *  sans recharger l'arbre RSC, ce qui évite que la modal saute / la page
   *  reset son scroll quand on coche un item de checklist. */
  onChecklistChange?: (next: ChecklistItem[]) => void;
  onTaskChange?: (input: TaskUpdateInput) => void;
}

// Lance un modal qui réutilise EXACTEMENT le visuel et les codes de la
// vue dépliée d'une tâche dans la liste Étapes & Tâches du projet.
// Sert pour les vues transversales (Kanban / Calendrier) où il n'y a pas
// d'expansion inline.
export function TaskDetailLauncher({
  projectId,
  workspace,
  stepId,
  stepTitle,
  stepDescription,
  task,
  accentColor,
  projectPeople = [],
  projectTeams = [],
  statusSettings,
  label = "Modifier",
  compact = false,
  trigger,
  onChecklistChange,
  onTaskChange,
}: TaskDetailLauncherProps) {
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const [open, setOpen] = useState(false);
  const [draftTask, setDraftTask] = useState(task);
  const [, startTransition] = useTransition();

  // Auto-ouvrir le drawer si l'URL contient taskId qui correspond à cette
  // tâche. Permet d'arriver depuis le dashboard ou kanban directement sur
  // une tâche ouverte. La fermeture nettoie le paramètre pour rester sur
  // la page projet sans drawer.
  const urlTaskId = searchParams?.get("taskId");
  useEffect(() => {
    if (urlTaskId === task.id) setOpen(true);
  }, [urlTaskId, task.id]);

  function clearTaskIdFromUrl() {
    if (!urlTaskId) return;
    const next = new URLSearchParams(searchParams?.toString() ?? "");
    next.delete("taskId");
    const qs = next.toString();
    router.replace(qs ? `${pathname}?${qs}` : pathname, { scroll: false });
  }

  // Resync local quand la prop tâche change (ex: hot reload, refresh server).
  useEffect(() => {
    if (!open) setDraftTask(task);
  }, [task, open]);

  function handleUpdate(input: TaskUpdateInput) {
    setDraftTask((current) => ({ ...current, ...input }));
    if (onTaskChange) {
      // Propagation optimiste vers le parent — pas besoin de refresh RSC.
      onTaskChange(input);
      startTransition(async () => {
        await updateTaskAction(projectId, stepId, task.id, input);
      });
      return;
    }
    startTransition(async () => {
      await updateTaskAction(projectId, stepId, task.id, input);
      router.refresh();
    });
  }

  function handleChecklistMutated(nextChecklist: ChecklistItem[]) {
    setDraftTask((current) => ({ ...current, checklist: nextChecklist }));
    if (onChecklistChange) {
      // Optimisme côté parent → pas de router.refresh qui ferait sauter la
      // modal / scroller la page sous l'utilisateur.
      onChecklistChange(nextChecklist);
      startTransition(async () => {
        await updateTaskAction(projectId, stepId, task.id, { checklist: nextChecklist });
      });
      return;
    }
    startTransition(async () => {
      await updateTaskAction(projectId, stepId, task.id, { checklist: nextChecklist });
      router.refresh();
    });
  }

  function openTask() {
    setDraftTask(task);
    setOpen(true);
  }

  return (
    <>
      {trigger ? (
        trigger({ open: openTask })
      ) : (
        <button
          type="button"
          onClick={openTask}
          onMouseDown={(event) => event.stopPropagation()}
          className={compact ? "inline-flex h-6 w-6 shrink-0 items-center justify-center overflow-hidden rounded-full p-0" : "inline-flex items-center gap-1.5 rounded-xl px-2.5 py-1.5 text-[10px] font-semibold"}
          style={{
            background: compact ? accentColor : surface.s2,
            color: compact ? "#FFFFFF" : text.secondary,
            border: compact ? `1px solid ${accentColor}` : `1px solid ${surface.border}`,
            boxShadow: compact ? `0 0 0 2px ${surface.s1}` : "none",
            cursor: "pointer",
            flex: compact ? "0 0 1.5rem" : undefined,
            minWidth: compact ? "1.5rem" : undefined,
            maxWidth: compact ? "1.5rem" : undefined,
          }}
          title="Modifier la tâche"
          aria-label="Modifier la tâche"
        >
          {compact ? (
            <svg width="10.5" height="10.5" viewBox="0 0 16 16" fill="none" aria-hidden="true">
              <path d="M9.9 3.3 12.7 6.1M3.4 12.6l2.8-.6 6.4-6.4a1.9 1.9 0 0 0-2.7-2.7L3.5 9.3l-.6 2.8a.5.5 0 0 0 .5.5Z" stroke="currentColor" strokeWidth="1.45" strokeLinecap="round" strokeLinejoin="round" />
            </svg>
          ) : (
            <>
              {label}
              <svg width="10" height="10" viewBox="0 0 16 16" fill="none" aria-hidden="true">
                <path d="M6 3l5 5-5 5" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round" />
              </svg>
            </>
          )}
        </button>
      )}

      {open && (
        <TaskDetailModal
          task={draftTask}
          stepTitle={stepTitle}
          stepDescription={stepDescription}
          accentColor={accentColor}
          workspace={workspace}
          projectId={projectId}
          stepId={stepId}
          projectPeople={projectPeople}
          projectTeams={projectTeams}
          statusSettings={statusSettings}
          onClose={() => {
            setOpen(false);
            clearTaskIdFromUrl();
          }}
          onUpdate={handleUpdate}
          onChecklistMutated={handleChecklistMutated}
        />
      )}
    </>
  );
}

interface TaskDetailModalProps {
  task: Task;
  stepTitle: string;
  stepDescription?: string;
  accentColor: string;
  workspace: Workspace;
  projectId: string;
  stepId: string;
  projectPeople: ProjectPerson[];
  projectTeams: ProjectTeam[];
  statusSettings?: ProjectStatusSettings;
  onClose: () => void;
  onUpdate: (input: TaskUpdateInput) => void;
  onChecklistMutated: (next: ChecklistItem[]) => void;
}

function TaskDetailModal({
  task,
  stepTitle,
  stepDescription,
  accentColor,
  workspace,
  projectId,
  stepId,
  projectPeople,
  projectTeams,
  statusSettings,
  onClose,
  onUpdate,
  onChecklistMutated,
}: TaskDetailModalProps) {
  // Fermeture au Escape
  useEffect(() => {
    function handleKey(event: KeyboardEvent) {
      if (event.key === "Escape") onClose();
    }
    window.addEventListener("keydown", handleKey);
    return () => window.removeEventListener("keydown", handleKey);
  }, [onClose]);

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
        aria-label={task.title}
        className="mb-modal-surface mb-task-drawer rounded-[20px] overflow-hidden"
        style={{
          display: "flex",
          flexDirection: "column",
          zIndex: 80,
        }}
      >
        <header
          className="flex items-start justify-between gap-4 px-5 py-4"
          style={{
            background: surface.s1,
            borderBottom: `1px solid ${surface.borderSubtle}`,
            position: "relative",
          }}
        >
          {/* Filet d'accent fin pour rappeler le code visuel projet */}
          <span
            aria-hidden
            style={{
              position: "absolute",
              insetInline: 0,
              top: 0,
              height: 3,
              background: accentColor,
            }}
          />
          <div className="min-w-0 flex-1">
            <p
              className="text-[10.5px] font-semibold uppercase tracking-[0.12em]"
              style={{ color: text.muted }}
            >
              Tâche · {stepTitle}
            </p>
            <h2
              className="mb-task-title mt-1 truncate text-base font-bold"
              style={{ color: text.primary, letterSpacing: "-0.005em" }}
            >
              {task.title}
            </h2>
            {stepDescription && (
              <p className="mt-0.5 truncate text-[11.5px]" style={{ color: text.muted }}>
                {stepDescription}
              </p>
            )}
          </div>
          <button
            type="button"
            onClick={onClose}
            className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl"
            style={{
              background: surface.s2,
              color: text.secondary,
              border: `1px solid ${surface.borderSubtle}`,
              cursor: "pointer",
            }}
            title="Fermer"
            aria-label="Fermer"
          >
            <svg width="13" height="13" viewBox="0 0 16 16" fill="none" aria-hidden="true">
              <path d="m4 4 8 8M12 4l-8 8" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" />
            </svg>
          </button>
        </header>

        <div
          className="min-w-0 flex-1 overflow-y-auto overflow-x-hidden"
          style={{ background: surface.s1, padding: 12 }}
        >
          {/* Même composant que la vue dépliée du projet → mêmes codes visuels,
              mêmes panneaux, même boutons IA, mêmes pictos interactifs. */}
          <TaskExpandedPreview
            task={task}
            accentColor={accentColor}
            workspace={workspace}
            projectId={projectId}
            stepId={stepId}
            projectTeams={projectTeams}
            projectPeople={projectPeople.map((person) => ({ id: person.id, name: person.name }))}
            statusSettings={statusSettings}
            onUpdate={onUpdate}
            onChecklistMutated={onChecklistMutated}
          />
        </div>
      </div>
    </>,
    document.body,
  );
}
