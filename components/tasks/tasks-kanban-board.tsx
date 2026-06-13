"use client";

import { useEffect, useRef, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { TaskCompletionDialog } from "@/components/projects/task-completion-dialog";
import { TaskDetailLauncher } from "@/components/projects/task-detail-launcher";
import { TaskChangeDetailDialog } from "@/components/tasks/task-change-detail-dialog";
import { priorityVisuals } from "@/lib/project-taxonomy";
import { useIsTouchDevice } from "@/lib/use-touch-device";
import {
  completeTaskAction,
  updateTaskBoardStatusAction,
} from "@/app/dashboard/projects/[id]/actions";
import { statusColor, surface, text, error as errorTokens } from "@/lib/design-tokens";
import { useCardDrag, DragGhost } from "@/lib/use-card-drag";
import type { Project, TaskStatus } from "@/lib/mock-data";
import { formatDueLabel, isTaskOverdue, type FlattenedProjectTask } from "@/lib/project-insights";
import { deriveTaskDisplayPriority, deriveTaskStatus, taskStatusLabels } from "@/lib/project-plan";
import { getDisplayStepTitle } from "@/lib/project-display";
import type { Workspace } from "@/lib/workspace";

type TaskItem = { project: Project; entry: FlattenedProjectTask };
type VisibleTaskItem = TaskItem & { status: TaskStatus };

const kanbanColumns: TaskStatus[] = ["todo", "in_progress", "waiting", "blocked", "done"];

const defaultStatusColor: Record<TaskStatus, { bg: string; text: string; border: string }> = {
  todo: { bg: statusColor.gray.bg, text: statusColor.gray.text, border: statusColor.gray.text },
  in_progress: { bg: statusColor.yellow.bg, text: statusColor.yellow.text, border: statusColor.yellow.text },
  waiting: { bg: statusColor.blue.bg, text: statusColor.blue.text, border: statusColor.blue.text },
  blocked: { bg: errorTokens.bg, text: errorTokens.text, border: errorTokens.border },
  done: { bg: statusColor.green.bg, text: statusColor.green.text, border: statusColor.green.text },
};

export function TasksKanbanBoard({ tasks, workspace }: { tasks: TaskItem[]; workspace: Workspace }) {
  const router = useRouter();
  const [, startTransition] = useTransition();
  const [draggingId, setDraggingId] = useState<string | null>(null);
  const [dragOverStatus, setDragOverStatus] = useState<TaskStatus | null>(null);
  const [statusOverrides, setStatusOverrides] = useState<Record<string, TaskStatus>>({});
  const [pendingCompletion, setPendingCompletion] = useState<TaskItem | null>(null);
  const [pendingStatusChange, setPendingStatusChange] = useState<{ item: TaskItem; status: TaskStatus } | null>(null);
  const [blockedDoneAlert, setBlockedDoneAlert] = useState<string | null>(null);
  // Drag tactile (iPhone) : HTML5 DnD ne marche pas au doigt → drag custom.
  const gridRef = useRef<HTMLElement>(null);

  const visibleTasks = tasks.map((item) => ({
    ...item,
    status: statusOverrides[getTaskKey(item)] ?? deriveTaskStatus(item.entry.task),
  }));

  function moveTaskToStatus(item: VisibleTaskItem, targetStatus: TaskStatus) {
    if (item.status === targetStatus) return;

    if (targetStatus === "done") {
      // Garde-fou : checklist incomplète bloque le passage en terminée.
      const checklist = item.entry.task.checklist ?? [];
      const checklistIncomplete = checklist.length > 0 && !checklist.every((c) => c.done);
      if (checklistIncomplete) {
        setBlockedDoneAlert(item.entry.task.title);
        return;
      }
      setPendingCompletion(item);
      return;
    }

    setPendingStatusChange({ item, status: targetStatus });
  }

  function handleDrop(targetStatus: TaskStatus) {
    if (!draggingId) return;

    const item = visibleTasks.find((candidate) => getTaskKey(candidate) === draggingId);
    setDraggingId(null);
    setDragOverStatus(null);

    if (item) moveTaskToStatus(item, targetStatus);
  }

  // Drag tactile (poignée) : aperçu flottant qui suit le doigt + surlignage de
  // la colonne + auto-scroll horizontal. Le drag souris reste natif (desktop).
  const { ghost, draggingKey: touchDraggingKey, begin } = useCardDrag({
    dropAttr: "data-kanban-status",
    scrollContainer: () => gridRef.current,
    onOverTarget: (target) => setDragOverStatus(target as TaskStatus | null),
    onDrop: (key, target) => {
      const item = visibleTasks.find((candidate) => getTaskKey(candidate) === key);
      if (item) moveTaskToStatus(item, target as TaskStatus);
    },
  });

  function handleStatusChangeConfirm(details: string) {
    if (!pendingStatusChange) return;
    const { item, status } = pendingStatusChange;
    const taskKey = getTaskKey(item);

    setStatusOverrides((current) => ({ ...current, [taskKey]: status }));
    setPendingStatusChange(null);

    startTransition(async () => {
      await updateTaskBoardStatusAction(item.project.id, item.entry.stepId, item.entry.task.id, {
        status,
        done: false,
        blocked: status === "blocked",
        statusNote: details,
      });
      router.refresh();
    });
  }

  function handleCompletionConfirm(input: { details: string }) {
    if (!pendingCompletion) return;
    const item = pendingCompletion;
    const taskKey = getTaskKey(item);

    setStatusOverrides((current) => ({ ...current, [taskKey]: "done" }));
    setPendingCompletion(null);

    startTransition(async () => {
      await completeTaskAction(item.project.id, item.entry.stepId, item.entry.task.id, input);
      router.refresh();
    });
  }

  return (
    <>
      {pendingCompletion && (
        <TaskCompletionDialog
          workspace={workspace}
          projectId={pendingCompletion.project.id}
          taskTitle={pendingCompletion.entry.task.title}
          taskDescription={pendingCompletion.entry.task.description}
          stepTitle={pendingCompletion.entry.stepTitle}
          onClose={() => setPendingCompletion(null)}
          onConfirm={handleCompletionConfirm}
        />
      )}

      {pendingStatusChange && (
        <TaskChangeDetailDialog
          workspace={workspace}
          title={`Passer en ${getTaskStatusLabel(pendingStatusChange.item.project, pendingStatusChange.status)}`}
          subtitle={pendingStatusChange.item.entry.task.title}
          optional
          optionalPrompt="Voulez-vous donner une explication sur ce changement de statut ?"
          description="Si vous ajoutez une note, elle sera enregistrée comme commentaire sur la tâche."
          label="Note"
          placeholder="Exemple : attente du retour fournisseur, démarrage de la préparation, blocage budget..."
          confirmLabel="Enregistrer la note"
          onClose={() => setPendingStatusChange(null)}
          onConfirm={handleStatusChangeConfirm}
        />
      )}

      {blockedDoneAlert && (
        <div
          className="mb-modal-backdrop fixed inset-0 z-50 flex items-center justify-center px-4"
          onClick={() => setBlockedDoneAlert(null)}
        >
          <div
            className="mb-modal-surface rounded-2xl overflow-hidden"
            style={{ width: "min(440px, 100%)" }}
            onClick={(event) => event.stopPropagation()}
          >
            <div className="p-5">
              <p className="text-[10px] font-semibold uppercase tracking-[0.16em]" style={{ color: errorTokens.text }}>
                Checklist incomplète
              </p>
              <h3 className="mt-1 text-base font-semibold leading-tight" style={{ color: text.primary }}>
                Impossible de marquer cette tâche comme terminée
              </h3>
              <p className="mt-3 text-xs leading-relaxed" style={{ color: text.secondary }}>
                « {blockedDoneAlert} » a encore des sous-actions non cochées. Termine la checklist avant de passer en terminée.
              </p>
              <div className="mt-4 flex items-center justify-end">
                <button
                  type="button"
                  onClick={() => setBlockedDoneAlert(null)}
                  className="rounded-xl px-4 py-2.5 text-xs font-semibold"
                  style={{ background: surface.s2, color: text.primary, border: `1px solid ${surface.border}`, cursor: "pointer" }}
                >
                  J'ai compris
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      <section ref={gridRef} className="mb-kanban-grid min-w-0">
        {kanbanColumns.map((status) => {
          const columnTasks = visibleTasks.filter((item) => item.status === status);
          const statusTone = defaultStatusColor[status];
          const isOver = dragOverStatus === status;

          return (
            <div
              key={status}
              data-kanban-status={status}
              className="min-w-0 rounded-[22px] p-2.5"
              style={{
                background: isOver ? statusTone.bg : surface.s3,
                border: `1px solid ${isOver ? statusTone.border : surface.borderSubtle}`,
                boxShadow: "var(--mb-shadow-card)",
                minHeight: 160,
                transition: "background 0.14s ease, border-color 0.14s ease",
              }}
              onDragOver={(event) => {
                event.preventDefault();
                setDragOverStatus(status);
              }}
              onDragLeave={(event) => {
                if (!event.currentTarget.contains(event.relatedTarget as Node)) {
                  setDragOverStatus(null);
                }
              }}
              onDrop={(event) => {
                event.preventDefault();
                handleDrop(status);
              }}
            >
              <div className="mb-3 flex items-center justify-between gap-2 px-1">
                <p className="text-xs font-bold" style={{ color: statusTone.text }}>
                  {taskStatusLabels[status]}
                </p>
                <span className="rounded-full px-2 py-1 text-[11px] font-semibold tabular-nums" style={{ background: statusTone.bg, color: statusTone.text }}>
                  {columnTasks.length}
                </span>
              </div>

              <div className="grid gap-2">
                {columnTasks.length > 0 ? (
                  columnTasks.map((item) => (
                    <KanbanTaskCard
                      key={getTaskKey(item)}
                      item={item}
                      workspace={workspace}
                      status={item.status}
                      isDragging={draggingId === getTaskKey(item) || touchDraggingKey === getTaskKey(item)}
                      onDragStart={() => setDraggingId(getTaskKey(item))}
                      onDragEnd={() => {
                        setDraggingId(null);
                        setDragOverStatus(null);
                      }}
                      onTouchDragStart={(event) => begin(getTaskKey(item), item.entry.task.title, event)}
                    />
                  ))
                ) : (
                  <div
                    className="rounded-[16px] p-3 text-[11px]"
                    style={{
                      background: surface.s1,
                      color: isOver ? statusTone.text : text.muted,
                      border: `1px dashed ${isOver ? statusTone.border : surface.borderSubtle}`,
                    }}
                  >
                    {isOver ? "Déposer ici" : "Aucune tâche"}
                  </div>
                )}
              </div>
            </div>
          );
        })}
      </section>

      <DragGhost ghost={ghost} />
    </>
  );
}

function KanbanTaskCard({
  item,
  workspace,
  status,
  isDragging,
  onDragStart,
  onDragEnd,
  onTouchDragStart,
}: {
  item: TaskItem;
  workspace: Workspace;
  status: TaskStatus;
  isDragging: boolean;
  onDragStart: () => void;
  onDragEnd: () => void;
  onTouchDragStart: (event: React.PointerEvent) => void;
}) {
  const { project, entry } = item;
  const task = entry.task;
  const step = project.steps?.find((projectStep) => projectStep.id === entry.stepId);
  const dragStartedRef = useRef(false);
  const isTouch = useIsTouchDevice();
  const touchStartRef = useRef<{ x: number; y: number } | null>(null);
  const suppressNextClickRef = useRef(false);
  // overdue + displayedPriority dépendent de `new Date()` → divergent SSR/client
  // sur Safari iOS et cassent l'hydratation. On les calcule après mount.
  const [hydrated, setHydrated] = useState(false);
  useEffect(() => setHydrated(true), []);
  const overdue = hydrated && isTaskOverdue(task);

  const isDone = task.done || status === "done";
  const displayedPriority = hydrated ? deriveTaskDisplayPriority(task) : task.priority ?? "medium";
  const displayedPriorityVisual = priorityVisuals[displayedPriority];

  return (
    <TaskDetailLauncher
      projectId={project.id}
      workspace={workspace}
      stepId={entry.stepId}
      stepTitle={entry.stepTitle}
      stepDescription={step?.description}
      task={task}
      accentColor={project.subcategoryColor}
      projectPeople={project.people ?? []}
      projectTeams={project.teams ?? []}
      statusSettings={project.statusSettings}
      trigger={({ open }) => (
        <article
          data-drag-card
          draggable={!isTouch}
          role="button"
          tabIndex={0}
          onClick={() => {
            if (suppressNextClickRef.current) {
              suppressNextClickRef.current = false;
              return;
            }
            if (!dragStartedRef.current) open();
          }}
          onTouchStart={(event) => {
            const touch = event.touches[0];
            if (!touch) return;
            touchStartRef.current = { x: touch.clientX, y: touch.clientY };
          }}
          onTouchEnd={(event) => {
            const touch = event.changedTouches[0];
            const start = touchStartRef.current;
            touchStartRef.current = null;
            if (!touch || !start) return;

            const moved = Math.hypot(touch.clientX - start.x, touch.clientY - start.y);
            if (moved > 10) return;

            event.preventDefault();
            suppressNextClickRef.current = true;
            open();
            window.setTimeout(() => {
              suppressNextClickRef.current = false;
            }, 350);
          }}
          onKeyDown={(event) => {
            if (event.key === "Enter" || event.key === " ") {
              event.preventDefault();
              open();
            }
          }}
          onDragStart={() => {
            dragStartedRef.current = true;
            onDragStart();
          }}
          onDragEnd={() => {
            onDragEnd();
            window.setTimeout(() => {
              dragStartedRef.current = false;
            }, 0);
          }}
          className="relative min-w-0 rounded-[18px]"
          style={{
            background: overdue ? errorTokens.bg : surface.s1,
            border: `1px solid ${overdue ? errorTokens.border : surface.borderSubtle}`,
            boxShadow: "var(--mb-shadow-card)",
            cursor: isDragging ? "grabbing" : "pointer",
            opacity: isDragging ? 0.72 : 1,
            userSelect: "none",
            padding: "0.625rem 0.625rem 0.625rem 0.875rem",
            overflow: "hidden",
          }}
          title="Cliquer pour ouvrir, glisser pour déplacer"
        >
          {!isDone && (
            <span
              aria-hidden
              title={`Priorité : ${displayedPriorityVisual.label.toLowerCase()}`}
              style={{
                position: "absolute",
                left: 0,
                top: 0,
                bottom: 0,
                width: 4,
                background: displayedPriorityVisual.text,
                pointerEvents: "none",
              }}
            />
          )}
          {isTouch && (
            <span
              role="button"
              aria-label="Déplacer la tâche"
              data-mobile-tap-ignore="true"
              onPointerDown={onTouchDragStart}
              onTouchStart={(event) => event.stopPropagation()}
              onClick={(event) => event.stopPropagation()}
              style={{
                position: "absolute",
                top: 5,
                right: 5,
                zIndex: 2,
                display: "inline-flex",
                alignItems: "center",
                justifyContent: "center",
                width: 28,
                height: 28,
                borderRadius: 8,
                color: text.muted,
                background: surface.s2,
                border: `1px solid ${surface.borderSubtle}`,
                touchAction: "none",
                cursor: "grab",
              }}
            >
              <GripIcon />
            </span>
          )}
          <div className="min-w-0" style={{ paddingRight: isTouch ? 38 : 16 }}>
            <p className="mb-board-task-title line-clamp-2 text-[11px] font-semibold leading-snug" style={{ color: text.primary }}>
              {task.title}
            </p>
            <p className="mt-1 truncate text-[10px]" style={{ color: text.muted }}>
              {project.name} · {getDisplayStepTitle(entry.stepTitle)}
            </p>
          </div>

          <div className="mt-2.5 flex flex-wrap items-center gap-1.5 pr-4">
            <span className="text-[10px] font-semibold" style={{ color: overdue ? errorTokens.text : text.secondary }}>
              {formatDueLabel(task)}
            </span>
          </div>
        </article>
      )}
    />
  );
}

function getTaskKey(item: TaskItem) {
  return `${item.project.id}:${item.entry.stepId}:${item.entry.task.id}`;
}

function getTaskStatusLabel(project: Project, status: TaskStatus) {
  return project.statusSettings?.task?.[status]?.label ?? taskStatusLabels[status];
}

function GripIcon() {
  return (
    <svg width="14" height="14" viewBox="0 0 16 16" fill="currentColor" aria-hidden="true">
      <circle cx="6" cy="4" r="1.3" />
      <circle cx="10" cy="4" r="1.3" />
      <circle cx="6" cy="8" r="1.3" />
      <circle cx="10" cy="8" r="1.3" />
      <circle cx="6" cy="12" r="1.3" />
      <circle cx="10" cy="12" r="1.3" />
    </svg>
  );
}
