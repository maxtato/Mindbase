"use client";

import { useEffect, useMemo, useRef, useState, useTransition, type CSSProperties, type DragEvent, type FormEvent, type ReactNode } from "react";
import { useRouter } from "next/navigation";
import { createPortal } from "react-dom";
import {
  addStepToProjectAction,
  addTaskToStepAction,
  completeTaskAction,
  deleteStepAction,
  deleteTaskAction,
  reorderProjectStepsAction,
  reorderStepTasksAction,
  toggleTaskDoneAction,
  updateStepAction,
  updateTaskAction,
} from "@/app/dashboard/projects/[id]/actions";
import { TaskCompletionDialog } from "@/components/projects/task-completion-dialog";
import { TaskDetailLauncher } from "@/components/projects/task-detail-launcher";
import type { Step, Task, ChecklistItem, ProjectPerson, ProjectStatusSettings, ProjectTeam, TaskStatus } from "@/lib/mock-data";
import { PROJECT_PRIORITY_OPTIONS, priorityVisuals, type ProjectPriority } from "@/lib/project-taxonomy";
import { useIsTouchDevice } from "@/lib/use-touch-device";
import { DragGhost, useLongPressDrag, findScrollParent, type CardDragGhost } from "@/lib/use-card-drag";
import {
  calculateProgressFromSteps,
  calculateStepIndicators,
  deriveTaskDisplayPriority,
  deriveStepStatus,
  deriveTaskStatus,
  isTaskDueSoon,
  isTaskOverdue,
  sortSteps,
  sortTasks,
  stepStatusLabels,
  taskStatusLabels,
} from "@/lib/project-plan";
import { surface, text, error as errorTokens, statusColor } from "@/lib/design-tokens";
import { formatTaskScheduleDate } from "@/lib/date-format";
import { workspaceTheme, type Workspace } from "@/lib/workspace";
import { getVisibleTaskOwner } from "@/lib/task-people";
import { getDisplayStepTitle } from "@/lib/project-display";
import { deleteTone, TrashIcon } from "@/components/ui/trash-icon";

interface StepsPanelProps {
  projectId: string;
  projectName: string;
  workspace: Workspace;
  initialSteps: Step[];
  accentColor: string;
  projectPeople?: ProjectPerson[];
  projectTeams?: ProjectTeam[];
  statusSettings?: ProjectStatusSettings;
}

type StepUpdateInput = Partial<Pick<Step, "title" | "description" | "priority">>;
type TaskUpdateInput = Partial<Pick<Task, "title" | "description" | "owner" | "assignees" | "teamIds" | "dueDate" | "dueTime" | "status" | "priority" | "expected" | "realization" | "comments" | "checklist">> & {
  manualNote?: string;
};
type CompletionPromptState = {
  stepId: string;
  taskId: string;
  taskTitle: string;
  taskDescription?: string;
  stepTitle: string;
  stepDescription?: string;
};
type DropPosition = "before" | "after";
type DragState =
  | { type: "step"; stepId: string }
  | { type: "task"; stepId: string; taskId: string };
type StepDropTarget = { stepId: string; position: DropPosition };
type TaskDropTarget = { stepId: string; taskId: string; position: DropPosition };

function renumberSteps(steps: Step[]) {
  return steps.map((step, index) => ({ ...step, order: index + 1 }));
}

function renumberTasks(tasks: Task[]) {
  return tasks.map((task, index) => ({ ...task, order: index + 1 }));
}

function reorderItemsByDrop<T extends { id: string }>(
  items: T[],
  draggedId: string,
  targetId: string,
  position: DropPosition,
) {
  if (draggedId === targetId) return items;

  const sourceIndex = items.findIndex((item) => item.id === draggedId);
  const targetIndex = items.findIndex((item) => item.id === targetId);
  if (sourceIndex === -1 || targetIndex === -1) return items;

  const nextItems = items.slice();
  const [draggedItem] = nextItems.splice(sourceIndex, 1);
  const nextTargetIndex = nextItems.findIndex((item) => item.id === targetId);
  const insertionIndex = position === "after" ? nextTargetIndex + 1 : nextTargetIndex;
  nextItems.splice(insertionIndex, 0, draggedItem);
  return nextItems;
}

function getDropPosition(event: DragEvent<HTMLElement>): DropPosition {
  const rect = event.currentTarget.getBoundingClientRect();
  return event.clientY > rect.top + rect.height / 2 ? "after" : "before";
}

function isInteractiveDragTarget(target: EventTarget | null) {
  return target instanceof Element && Boolean(target.closest("button, a, input, textarea, select, label, [data-no-drag='true']"));
}

function sameOrder(left: Array<{ id: string }>, right: Array<{ id: string }>) {
  return left.length === right.length && left.every((item, index) => item.id === right[index]?.id);
}

function cleanOptionalText(value: string | undefined) {
  if (value === undefined) return undefined;
  return value.trim() || undefined;
}

function appendRealization(existing: string | undefined, detail: string) {
  const cleaned = detail.trim();
  if (!cleaned) return existing;
  const previous = existing?.trim();
  if (!previous) return cleaned;
  if (previous.split(/\n+/).some((entry) => entry.trim() === cleaned)) return previous;
  return `${previous}\n${cleaned}`;
}

export function StepsPanel({ projectId, projectName, workspace, initialSteps, accentColor, projectPeople = [], projectTeams = [], statusSettings }: StepsPanelProps) {
  const router = useRouter();
  const orderedSteps = useMemo(() => sortSteps(initialSteps), [initialSteps]);
  const [steps, setSteps] = useState<Step[]>(orderedSteps);
  const [showCompletionCelebration, setShowCompletionCelebration] = useState(false);
  const [completionPrompt, setCompletionPrompt] = useState<CompletionPromptState | null>(null);
  const [mutationError, setMutationError] = useState<string | null>(null);
  const [dragState, setDragState] = useState<DragState | null>(null);
  const [stepDropTarget, setStepDropTarget] = useState<StepDropTarget | null>(null);
  const [taskDropTarget, setTaskDropTarget] = useState<TaskDropTarget | null>(null);
  // Drag tactile (iPhone) pour réordonner étapes et tâches (le HTML5 DnD ne
  // marche pas au doigt). Aperçu de la carte qui suit le doigt + indicateur
  // d'insertion (réutilise stepDropTarget/taskDropTarget).
  const [touchGhost, setTouchGhost] = useState<CardDragGhost | null>(null);
  const touchReorderRef = useRef<
    | { kind: "step"; stepId: string }
    | { kind: "task"; stepId: string; taskId: string }
    | null
  >(null);
  const touchDropRef = useRef<{ targetId: string; position: DropPosition } | null>(null);

  const [, startTransition] = useTransition();

  const allTasks = steps.flatMap((step) => step.tasks);
  const totalTasks = allTasks.length;
  const doneTasks = allTasks.filter((task) => deriveTaskStatus(task) === "done").length;
  const overdueTasks = allTasks.filter((task) => isTaskOverdue(task)).length;
  const dueSoonTasks = allTasks.filter((task) => isTaskDueSoon(task)).length;

  function handleToggle(stepId: string, taskId: string) {
    const targetStep = steps.find((step) => step.id === stepId);
    const targetTask = targetStep?.tasks.find((task) => task.id === taskId);
    if (!targetTask || !targetStep) return;

    if (!targetTask.done) {
      // La garde "checklist incomplète" est gérée localement sur la tâche
      // (popup neutre avec bouton OK) avant d'arriver ici. Si on entre dans
      // ce bloc, la checklist est valide → on ouvre le prompt de complétion.
      setMutationError(null);
      setCompletionPrompt({
        stepId,
        taskId,
        taskTitle: targetTask.title,
        taskDescription: targetTask.description,
        stepTitle: targetStep.title,
        stepDescription: targetStep.description,
      });
      return;
    }

    const previousProgress = calculateProgressFromSteps(steps);
    const nextSteps = steps.map((step) => {
      if (step.id !== stepId) return step;
      const updatedTasks = step.tasks.map((task) =>
        task.id === taskId
          ? {
              ...task,
              done: false,
              status: "todo" as const,
              completedAt: undefined,
              completionDetails: undefined,
              completionDecisionId: undefined,
              completionDecisionTitle: undefined,
              completionSource: undefined,
            }
          : task,
      );
      return { ...step, tasks: updatedTasks, status: deriveStepStatus(updatedTasks) };
    });
    const nextProgress = calculateProgressFromSteps(nextSteps);

    setSteps(nextSteps);
    setMutationError(null);

    if (previousProgress < 100 && nextProgress === 100 && nextSteps.flatMap((step) => step.tasks).length > 0) {
      setShowCompletionCelebration(true);
    } else if (nextProgress < 100) {
      setShowCompletionCelebration(false);
    }

    startTransition(async () => {
      try {
        await toggleTaskDoneAction(projectId, stepId, taskId);
      } catch (error) {
        console.error("[toggle_task]", error);
        setMutationError("Impossible de mettre à jour cette tâche pour le moment.");
      }
    });
  }

  function handleTaskCompletion(input: { stepId: string; taskId: string; details: string }) {
    const details = input.details.trim();

    if (!details) return;

    const previousProgress = calculateProgressFromSteps(steps);
    const now = new Date().toISOString();

    const nextSteps = steps.map((step) => {
      if (step.id !== input.stepId) return step;
      const updatedTasks = step.tasks.map((task) =>
        task.id === input.taskId
          ? {
              ...task,
              done: true,
              status: "done" as const,
              completedAt: now,
              completionDetails: details,
              completionDecisionId: undefined,
              completionDecisionTitle: undefined,
              completionSource: "manual" as const,
              realization: appendRealization(task.realization ?? task.completionDetails, details),
            }
          : task,
      );
      return { ...step, tasks: updatedTasks, status: deriveStepStatus(updatedTasks) };
    });
    const nextProgress = calculateProgressFromSteps(nextSteps);

    setSteps(nextSteps);
    setMutationError(null);
    setCompletionPrompt(null);

    if (previousProgress < 100 && nextProgress === 100 && nextSteps.flatMap((step) => step.tasks).length > 0) {
      setShowCompletionCelebration(true);
    }

    startTransition(async () => {
      try {
        await completeTaskAction(projectId, input.stepId, input.taskId, {
          details,
        });
        router.refresh();
      } catch (error) {
        // Pas de message d'erreur intrusif : on log et on revient à l'état
        // précédent (le serveur n'a pas validé). L'UI restera cohérente
        // au prochain refresh.
        console.error("[complete_task]", error);
      }
    });
  }

  function handleStepUpdate(stepId: string, input: StepUpdateInput) {
    const nextSteps = steps.map((step) => {
      if (step.id !== stepId) return step;
      const title = input.title?.trim();
      return {
        ...step,
        title: title || step.title,
        description: input.description !== undefined ? cleanOptionalText(input.description) : step.description,
        priority: input.priority ?? step.priority,
      };
    });

    setSteps(nextSteps);
    setMutationError(null);
    startTransition(async () => {
      try {
        await updateStepAction(projectId, stepId, input);
      } catch (error) {
        console.error("[update_step]", error);
        setMutationError("Impossible de mettre à jour cette étape pour le moment.");
      }
    });
  }

  function handleStepDelete(stepId: string) {
    const nextSteps = renumberSteps(steps.filter((step) => step.id !== stepId));
    setSteps(nextSteps);
    if (calculateProgressFromSteps(nextSteps) < 100) setShowCompletionCelebration(false);
    setMutationError(null);
    startTransition(async () => {
      try {
        await deleteStepAction(projectId, stepId);
      } catch (error) {
        console.error("[delete_step]", error);
        setMutationError("Impossible de supprimer cette étape pour le moment.");
      }
    });
  }

  function handleTaskUpdate(stepId: string, taskId: string, input: TaskUpdateInput) {
    const nextSteps = steps.map((step) => {
      if (step.id !== stepId) return step;
      const updatedTasks = step.tasks.map((task) => {
        if (task.id !== taskId) return task;
        const title = input.title?.trim();
        return {
          ...task,
          title: title || task.title,
          description: input.description !== undefined ? cleanOptionalText(input.description) : task.description,
          owner: input.owner !== undefined ? cleanOptionalText(input.owner) : task.owner,
          assignees: input.assignees !== undefined ? input.assignees : task.assignees,
          teamIds: input.teamIds !== undefined ? input.teamIds : task.teamIds,
          dueDate: input.dueDate !== undefined ? cleanOptionalText(input.dueDate) : task.dueDate,
          dueTime: input.dueTime !== undefined ? cleanOptionalText(input.dueTime) : task.dueTime,
          priority: input.priority ?? task.priority,
          status: input.status ?? task.status,
          done: input.status ? input.status === "done" : task.done,
          blocked: input.status ? input.status === "blocked" : task.blocked,
          expected: input.expected !== undefined ? cleanOptionalText(input.expected) : task.expected,
          realization: input.realization !== undefined ? cleanOptionalText(input.realization) : task.realization,
          comments: input.comments !== undefined ? input.comments.map((comment) => comment.trim()).filter(Boolean) : task.comments,
          checklist: input.checklist !== undefined ? input.checklist : task.checklist,
        };
      });
      return { ...step, tasks: updatedTasks, status: deriveStepStatus(updatedTasks) };
    });

    setSteps(nextSteps);
    setMutationError(null);
    startTransition(async () => {
      try {
        await updateTaskAction(projectId, stepId, taskId, input);
      } catch (error) {
        console.error("[update_task]", error);
        const message = error instanceof Error ? error.message : "Impossible de planifier ou modifier cette tâche pour le moment.";
        setMutationError(message);
      }
    });
  }

  function handleChecklistMutated(stepId: string, taskId: string, nextChecklist: ChecklistItem[]) {
    setSteps((current) =>
      current.map((step) => {
        if (step.id !== stepId) return step;
        return {
          ...step,
          tasks: step.tasks.map((task) =>
            task.id === taskId ? { ...task, checklist: nextChecklist } : task,
          ),
        };
      }),
    );
  }

  function handleTaskDelete(stepId: string, taskId: string) {
    const nextSteps = steps.map((step) => {
      if (step.id !== stepId) return step;
      const updatedTasks = renumberTasks(step.tasks.filter((task) => task.id !== taskId));
      return { ...step, tasks: updatedTasks, status: deriveStepStatus(updatedTasks) };
    });

    setSteps(nextSteps);
    if (calculateProgressFromSteps(nextSteps) < 100) setShowCompletionCelebration(false);
    setMutationError(null);
    startTransition(async () => {
      try {
        await deleteTaskAction(projectId, stepId, taskId);
      } catch (error) {
        console.error("[delete_task]", error);
        setMutationError("Impossible de supprimer cette tâche pour le moment.");
      }
    });
  }

  function resetDragState() {
    setDragState(null);
    setStepDropTarget(null);
    setTaskDropTarget(null);
  }

  function handleStepDragStart(event: DragEvent<HTMLElement>, stepId: string) {
    if (isInteractiveDragTarget(event.target)) {
      event.preventDefault();
      return;
    }

    event.dataTransfer.effectAllowed = "move";
    event.dataTransfer.setData("text/plain", `step:${stepId}`);
    setDragState({ type: "step", stepId });
  }

  function handleStepDragOver(event: DragEvent<HTMLElement>, targetStepId: string) {
    if (dragState?.type !== "step") return;
    event.preventDefault();
    setStepDropTarget({ stepId: targetStepId, position: getDropPosition(event) });
  }

  function handleStepDrop(event: DragEvent<HTMLElement>, targetStepId: string) {
    event.preventDefault();
    const transferred = event.dataTransfer.getData("text/plain");
    const draggedStepId = dragState?.type === "step"
      ? dragState.stepId
      : transferred.startsWith("step:")
        ? transferred.slice("step:".length)
        : "";
    if (!draggedStepId) {
      resetDragState();
      return;
    }

    const currentSteps = sortSteps(steps);
    const position = stepDropTarget?.stepId === targetStepId ? stepDropTarget.position : getDropPosition(event);
    const reorderedSteps = renumberSteps(reorderItemsByDrop(currentSteps, draggedStepId, targetStepId, position));
    resetDragState();

    if (sameOrder(currentSteps, reorderedSteps)) return;

    setSteps(reorderedSteps);
    setMutationError(null);
    startTransition(async () => {
      try {
        await reorderProjectStepsAction(projectId, reorderedSteps.map((step) => step.id));
      } catch (error) {
        console.error("[reorder_steps]", error);
        setMutationError("Impossible de modifier l'ordre des étapes pour le moment.");
      }
    });
  }

  function handleTaskDragStart(event: DragEvent<HTMLElement>, stepId: string, taskId: string) {
    event.stopPropagation();
    if (isInteractiveDragTarget(event.target)) {
      event.preventDefault();
      return;
    }

    event.dataTransfer.effectAllowed = "move";
    event.dataTransfer.setData("text/plain", `task:${stepId}:${taskId}`);
    setDragState({ type: "task", stepId, taskId });
  }

  function handleTaskDragOver(event: DragEvent<HTMLElement>, targetStepId: string, targetTaskId: string) {
    if (dragState?.type !== "task" || dragState.stepId !== targetStepId) return;
    event.preventDefault();
    event.stopPropagation();
    setTaskDropTarget({ stepId: targetStepId, taskId: targetTaskId, position: getDropPosition(event) });
  }

  function handleTaskDrop(event: DragEvent<HTMLElement>, targetStepId: string, targetTaskId: string) {
    event.preventDefault();
    event.stopPropagation();
    const transferred = event.dataTransfer.getData("text/plain");
    const [, transferredStepId, transferredTaskId] = transferred.split(":");
    const sourceStepId = dragState?.type === "task" ? dragState.stepId : transferredStepId;
    const sourceTaskId = dragState?.type === "task" ? dragState.taskId : transferredTaskId;

    if (!sourceStepId || !sourceTaskId || sourceStepId !== targetStepId) {
      resetDragState();
      return;
    }

    const currentStep = steps.find((step) => step.id === targetStepId);
    if (!currentStep) {
      resetDragState();
      return;
    }

    const currentTasks = sortTasks(currentStep.tasks);
    const position = taskDropTarget?.stepId === targetStepId && taskDropTarget.taskId === targetTaskId
      ? taskDropTarget.position
      : getDropPosition(event);
    const reorderedTasks = renumberTasks(reorderItemsByDrop(currentTasks, sourceTaskId, targetTaskId, position));
    resetDragState();

    if (sameOrder(currentTasks, reorderedTasks)) return;

    const nextSteps = steps.map((step) =>
      step.id === targetStepId
        ? { ...step, tasks: reorderedTasks, status: deriveStepStatus(reorderedTasks) }
        : step,
    );

    setSteps(nextSteps);
    setMutationError(null);
    startTransition(async () => {
      try {
        await reorderStepTasksAction(projectId, targetStepId, reorderedTasks.map((task) => task.id));
      } catch (error) {
        console.error("[reorder_tasks]", error);
        setMutationError("Impossible de modifier l'ordre des tâches pour le moment.");
      }
    });
  }

  function commitStepReorder(draggedStepId: string, targetStepId: string, position: DropPosition) {
    const currentSteps = sortSteps(steps);
    const reorderedSteps = renumberSteps(reorderItemsByDrop(currentSteps, draggedStepId, targetStepId, position));
    if (sameOrder(currentSteps, reorderedSteps)) return;
    setSteps(reorderedSteps);
    setMutationError(null);
    startTransition(async () => {
      try {
        await reorderProjectStepsAction(projectId, reorderedSteps.map((step) => step.id));
      } catch (error) {
        console.error("[reorder_steps]", error);
        setMutationError("Impossible de modifier l'ordre des étapes pour le moment.");
      }
    });
  }

  function commitTaskReorder(stepId: string, draggedTaskId: string, targetTaskId: string, position: DropPosition) {
    const currentStep = steps.find((step) => step.id === stepId);
    if (!currentStep) return;
    const currentTasks = sortTasks(currentStep.tasks);
    const reorderedTasks = renumberTasks(reorderItemsByDrop(currentTasks, draggedTaskId, targetTaskId, position));
    if (sameOrder(currentTasks, reorderedTasks)) return;
    const nextSteps = steps.map((step) =>
      step.id === stepId ? { ...step, tasks: reorderedTasks, status: deriveStepStatus(reorderedTasks) } : step,
    );
    setSteps(nextSteps);
    setMutationError(null);
    startTransition(async () => {
      try {
        await reorderStepTasksAction(projectId, stepId, reorderedTasks.map((task) => task.id));
      } catch (error) {
        console.error("[reorder_tasks]", error);
        setMutationError("Impossible de modifier l'ordre des tâches pour le moment.");
      }
    });
  }

  // Engage un drag tactile (étape ou tâche) APRÈS un appui long : la carte
  // « décolle » (aperçu qui suit le doigt), la cible se surligne (avant/après
  // via le milieu), et on réordonne au relâchement. Pas de poignée.
  function engageTouchReorder(
    payload: { kind: "step"; stepId: string } | { kind: "task"; stepId: string; taskId: string },
    startX: number,
    startY: number,
    element: HTMLElement,
  ) {
    const cardEl = element.closest("[data-drag-card]") as HTMLElement | null;
    touchReorderRef.current = payload;
    touchDropRef.current = null;
    // Retour haptique : l'élément est « attrapé ».
    navigator.vibrate?.(12);
    setDragState(
      payload.kind === "step"
        ? { type: "step", stepId: payload.stepId }
        : { type: "task", stepId: payload.stepId, taskId: payload.taskId },
    );
    setTouchGhost({
      label: "",
      x: startX,
      y: startY,
      html: cardEl?.outerHTML,
      width: cardEl?.getBoundingClientRect().width,
    });

    // Auto-scroll vertical de la PAGE : quand le doigt approche du haut/bas de
    // l'écran, on fait défiler le conteneur scrollable de la fiche projet
    // (`.mb-project-detail-frame` sur mobile) pour pouvoir déposer une
    // étape/tâche plus haut ou plus bas que la zone visible.
    const scrollContainer = findScrollParent(cardEl);
    const pointerPos = { x: startX, y: startY };
    let rafId: number | null = null;
    const tick = () => {
      const speed = 18;
      if (scrollContainer) {
        // Bords VISIBLES du conteneur (et non du viewport brut). Marge haute
        // large → ça commence à défiler dès qu'on approche du panneau du haut
        // (réglages / assistant), pas seulement tout en haut de l'écran.
        const r = scrollContainer.getBoundingClientRect();
        const topTrigger = Math.max(r.top, 0) + 120;
        const bottomTrigger = Math.min(r.bottom, window.innerHeight) - 96;
        if (pointerPos.y < topTrigger) scrollContainer.scrollTop -= speed;
        else if (pointerPos.y > bottomTrigger) scrollContainer.scrollTop += speed;
      }
      rafId = requestAnimationFrame(tick);
    };
    rafId = requestAnimationFrame(tick);

    const onMove = (ev: TouchEvent) => {
      const touch = ev.touches[0];
      if (!touch) return;
      ev.preventDefault();
      const x = touch.clientX;
      const y = touch.clientY;
      pointerPos.x = x;
      pointerPos.y = y;
      setTouchGhost((ghost) => (ghost ? { ...ghost, x, y } : ghost));
      const el = document.elementFromPoint(x, y);
      if (!(el instanceof Element)) return;

      if (payload.kind === "step") {
        const stepEl = el.closest<HTMLElement>("[data-reorder-step]");
        const targetId = stepEl?.getAttribute("data-reorder-step");
        if (!stepEl || !targetId) return;
        const rect = stepEl.getBoundingClientRect();
        const position: DropPosition = y > rect.top + rect.height / 2 ? "after" : "before";
        touchDropRef.current = { targetId, position };
        setStepDropTarget({ stepId: targetId, position });
      } else {
        const taskEl = el.closest<HTMLElement>("[data-reorder-task]");
        const targetId = taskEl?.getAttribute("data-reorder-task");
        const targetStepId = taskEl?.getAttribute("data-reorder-step-id");
        if (!taskEl || !targetId || targetStepId !== payload.stepId) return;
        const rect = taskEl.getBoundingClientRect();
        const position: DropPosition = y > rect.top + rect.height / 2 ? "after" : "before";
        touchDropRef.current = { targetId, position };
        setTaskDropTarget({ stepId: payload.stepId, taskId: targetId, position });
      }
    };

    const onUp = () => {
      window.removeEventListener("touchmove", onMove);
      window.removeEventListener("touchend", onUp);
      window.removeEventListener("touchcancel", onUp);
      if (rafId !== null) cancelAnimationFrame(rafId);
      // Supprime le clic synthétique qui suit le drag (sinon ouverture de la
      // tâche au relâchement).
      const suppressClick = (clickEvent: MouseEvent) => {
        clickEvent.preventDefault();
        clickEvent.stopPropagation();
        document.removeEventListener("click", suppressClick, true);
      };
      document.addEventListener("click", suppressClick, true);
      window.setTimeout(() => document.removeEventListener("click", suppressClick, true), 400);

      const drag = touchReorderRef.current;
      const drop = touchDropRef.current;
      touchReorderRef.current = null;
      touchDropRef.current = null;
      setTouchGhost(null);
      if (drag && drop && drop.targetId !== (drag.kind === "task" ? drag.taskId : drag.stepId)) {
        if (drag.kind === "step") commitStepReorder(drag.stepId, drop.targetId, drop.position);
        else commitTaskReorder(drag.stepId, drag.taskId, drop.targetId, drop.position);
      }
      resetDragState();
    };

    window.addEventListener("touchmove", onMove, { passive: false });
    window.addEventListener("touchend", onUp);
    window.addEventListener("touchcancel", onUp);
  }

  useEffect(() => {
    if (!showCompletionCelebration) return;

    function handleKeyDown(event: KeyboardEvent) {
      if (event.key === "Escape") setShowCompletionCelebration(false);
    }

    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [showCompletionCelebration]);

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 14 }}>
      {showCompletionCelebration && (
        <ProjectCompletionCelebration
          projectName={projectName}
          workspace={workspace}
          onClose={() => setShowCompletionCelebration(false)}
        />
      )}

      {completionPrompt && (
        <TaskCompletionDialog
          workspace={workspace}
          projectId={projectId}
          taskTitle={completionPrompt.taskTitle}
          taskDescription={completionPrompt.taskDescription}
          stepTitle={completionPrompt.stepTitle}
          stepDescription={completionPrompt.stepDescription}
          onClose={() => setCompletionPrompt(null)}
          onConfirm={(input) =>
            handleTaskCompletion({
              stepId: completionPrompt.stepId,
              taskId: completionPrompt.taskId,
              details: input.details,
            })
          }
        />
      )}

      <div className="flex items-center justify-between gap-3 flex-wrap">
        {totalTasks > 0 ? (
          <>
            <span className="text-xs" style={{ color: text.muted }}>
              {doneTasks} / {totalTasks} tâches terminées
            </span>
            <div className="flex items-center gap-2">
              {overdueTasks > 0 && (
                <span className="text-[11px] px-2 py-0.5 rounded-full font-semibold" style={{ background: errorTokens.bg, color: errorTokens.text, border: `1px solid ${errorTokens.border}` }}>
                  {overdueTasks} en retard
                </span>
              )}
              {dueSoonTasks > 0 && (
                <span className="text-[11px] px-2 py-0.5 rounded-full font-semibold" style={{ background: statusColor.yellow.bg, color: statusColor.yellow.text, border: `1px solid ${statusColor.yellow.text}` }}>
                  {dueSoonTasks} échéance{dueSoonTasks > 1 ? "s" : ""} proche{dueSoonTasks > 1 ? "s" : ""}
                </span>
              )}
            </div>
          </>
        ) : (
          <span className="text-xs" style={{ color: text.muted }}>
            Ajoutez une première tâche pour commencer le pilotage.
          </span>
        )}
      </div>

      {mutationError && (
        <div
          className="rounded-xl px-3 py-2 text-xs font-medium"
          style={{ background: errorTokens.bg, color: errorTokens.text, border: `1px solid ${errorTokens.border}` }}
        >
          {mutationError}
        </div>
      )}

      {steps.length === 0 ? (
        <EmptySteps />
      ) : (
        steps.map((step) => {
          return (
            <StepCard
              key={step.id}
              projectId={projectId}
              workspace={workspace}
              step={step}
              accentColor={accentColor}
              isDragging={dragState?.type === "step" && dragState.stepId === step.id}
              dropPosition={stepDropTarget?.stepId === step.id ? stepDropTarget.position : null}
              onStepDragStart={(event) => handleStepDragStart(event, step.id)}
              onStepDragOver={(event) => handleStepDragOver(event, step.id)}
              onStepDrop={(event) => handleStepDrop(event, step.id)}
              onDragEnd={resetDragState}
              onToggleTask={handleToggle}
              onUpdateStep={(input) => handleStepUpdate(step.id, input)}
              onDeleteStep={() => handleStepDelete(step.id)}
              onUpdateTask={(taskId, input) => handleTaskUpdate(step.id, taskId, input)}
              onDeleteTask={(taskId) => handleTaskDelete(step.id, taskId)}
              onTaskChecklistMutated={(taskId, nextChecklist) => handleChecklistMutated(step.id, taskId, nextChecklist)}
              draggingTaskId={dragState?.type === "task" && dragState.stepId === step.id ? dragState.taskId : null}
              taskDropTarget={taskDropTarget?.stepId === step.id ? taskDropTarget : null}
              onTaskDragStart={(event, taskId) => handleTaskDragStart(event, step.id, taskId)}
              onTaskDragOver={(event, taskId) => handleTaskDragOver(event, step.id, taskId)}
              onTaskDrop={(event, taskId) => handleTaskDrop(event, step.id, taskId)}
              onTaskDragEnd={resetDragState}
              onStepReorderEngage={(x, y, element) => engageTouchReorder({ kind: "step", stepId: step.id }, x, y, element)}
              onTaskReorderEngage={(taskId, x, y, element) => engageTouchReorder({ kind: "task", stepId: step.id, taskId }, x, y, element)}
              projectPeople={projectPeople}
              projectTeams={projectTeams}
              statusSettings={statusSettings}
            />
          );
        })
      )}

      <AddStepForm projectId={projectId} workspace={workspace} />
      <DragGhost ghost={touchGhost} />
    </div>
  );
}

function ProjectCompletionCelebration({
  projectName,
  workspace,
  onClose,
}: {
  projectName: string;
  workspace: Workspace;
  onClose: () => void;
}) {
  const theme = workspaceTheme[workspace];

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center px-4"
      style={{ pointerEvents: "none" }}
      aria-live="polite"
    >
      <div
        role="dialog"
        aria-label="Projet terminé"
        className="mb-completion-pop rounded-2xl overflow-hidden"
        style={{
          width: "min(430px, 100%)",
          background: surface.s1,
          border: `1px solid ${surface.border}`,
          pointerEvents: "auto",
        }}
      >
        <div className="h-1.5" style={{ background: theme.gradient }} />
        <div className="p-5">
          <div className="flex items-start gap-4">
            <div
              className="w-12 h-12 rounded-2xl flex items-center justify-center shrink-0"
              style={{ background: theme.accent, color: "#FFFFFF" }}
            >
              <svg width="24" height="24" viewBox="0 0 24 24" fill="none">
                <path d="M20 6 9 17l-5-5" stroke="currentColor" strokeWidth="2.3" strokeLinecap="round" strokeLinejoin="round" />
              </svg>
            </div>
            <div className="min-w-0 flex-1">
              <p className="text-xs font-semibold uppercase tracking-[0.18em] mb-1" style={{ color: theme.accentText }}>
                Projet terminé
              </p>
              <h3 className="text-lg font-bold leading-tight" style={{ color: text.primary }}>
                Bravo, {projectName} est à 100%.
              </h3>
              <p className="text-sm mt-2 leading-relaxed" style={{ color: text.secondary }}>
                Toutes les tâches sont cochées. MindLay peut maintenant t&apos;aider à faire le résumé final, capitaliser les décisions ou préparer la suite.
              </p>
            </div>
          </div>

          <div className="mt-4 flex items-center justify-between gap-3">
            <span
              className="text-xs font-semibold px-3 py-1.5 rounded-full"
              style={{ background: theme.accentBg, color: theme.accentText, border: `1px solid ${surface.borderSubtle}` }}
            >
              100% complété
            </span>
            <button
              type="button"
              onClick={onClose}
              className="rounded-lg px-3 py-2 text-xs font-semibold"
              style={{ background: theme.accent, color: "#FFFFFF", border: "none" }}
            >
              Parfait
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}

function EmptySteps() {
  return (
    <div
      className="rounded-xl p-5 text-center"
      style={{ background: surface.s2, border: `1px solid ${surface.border}` }}
    >
      <p className="text-sm font-medium mb-1" style={{ color: text.secondary }}>
        Aucune étape définie
      </p>
      <p className="text-xs" style={{ color: text.dim }}>
        Ajoute une étape manuellement pour structurer le projet.
      </p>
    </div>
  );
}

function StepCard({
  projectId,
  workspace,
  step,
  accentColor,
  isDragging,
  dropPosition,
  onStepDragStart,
  onStepDragOver,
  onStepDrop,
  onDragEnd,
  onToggleTask,
  onUpdateStep,
  onDeleteStep,
  onUpdateTask,
  onDeleteTask,
  onTaskChecklistMutated,
  draggingTaskId,
  taskDropTarget,
  onTaskDragStart,
  onTaskDragOver,
  onTaskDrop,
  onTaskDragEnd,
  onStepReorderEngage,
  onTaskReorderEngage,
  projectPeople,
  projectTeams,
  statusSettings,
}: {
  projectId: string;
  workspace: Workspace;
  step: Step;
  accentColor: string;
  isDragging: boolean;
  dropPosition: DropPosition | null;
  onStepDragStart: (event: DragEvent<HTMLElement>) => void;
  onStepDragOver: (event: DragEvent<HTMLElement>) => void;
  onStepDrop: (event: DragEvent<HTMLElement>) => void;
  onDragEnd: () => void;
  onToggleTask: (stepId: string, taskId: string) => void;
  onUpdateStep: (input: StepUpdateInput) => void;
  onDeleteStep: () => void;
  onUpdateTask: (taskId: string, input: TaskUpdateInput) => void;
  onDeleteTask: (taskId: string) => void;
  onTaskChecklistMutated: (taskId: string, nextChecklist: ChecklistItem[]) => void;
  draggingTaskId: string | null;
  taskDropTarget: TaskDropTarget | null;
  onTaskDragStart: (event: DragEvent<HTMLElement>, taskId: string) => void;
  onTaskDragOver: (event: DragEvent<HTMLElement>, taskId: string) => void;
  onTaskDrop: (event: DragEvent<HTMLElement>, taskId: string) => void;
  onTaskDragEnd: () => void;
  onStepReorderEngage: (x: number, y: number, element: HTMLElement) => void;
  onTaskReorderEngage: (taskId: string, x: number, y: number, element: HTMLElement) => void;
  projectPeople: ProjectPerson[];
  projectTeams: ProjectTeam[];
  statusSettings?: ProjectStatusSettings;
}) {
  const tasks = sortTasks(step.tasks);
  const computedStatus = deriveStepStatus(tasks);
  // Indicators date-dépendants (overdue, due-soon, derived priority bumps...)
  // calculés UNIQUEMENT après hydratation. SSR + premier render client
  // utilisent un set vide → match parfait → React ne divague pas. useEffect
  // post-mount swap au vrai calcul. Sans ça, `new Date()` divergeait entre
  // serveur et client iPhone et faisait échouer l'hydratation au refresh.
  const indicatorsBase = calculateStepIndicators({ ...step, tasks, status: computedStatus }, new Date(0));
  const [hydrated, setHydrated] = useState(false);
  // eslint-disable-next-line react-hooks/exhaustive-deps
  useEffect(() => setHydrated(true), []);
  const indicators = hydrated
    ? calculateStepIndicators({ ...step, tasks, status: computedStatus })
    : indicatorsBase;
  const doneTasks = indicators.doneTasks;
  const completion = indicators.progress;
  const [isEditing, setIsEditing] = useState(false);
  const [confirmDelete, setConfirmDelete] = useState(false);
  const displayTitle = getDisplayStepTitle(step.title);
  const isTouch = useIsTouchDevice();
  const stepLongPress = useLongPressDrag(({ x, y, element }) => onStepReorderEngage(x, y, element));

  return (
    <div
      data-drag-card
      data-reorder-step={step.id}
      draggable={!isTouch}
      onDragStart={onStepDragStart}
      onDragOver={onStepDragOver}
      onDrop={onStepDrop}
      onDragEnd={onDragEnd}
      onTouchStart={(event) => {
        // Appui long sur l'EN-TÊTE de l'étape pour la déplacer. On ignore les
        // pressions sur une tâche ou un bouton (elles ont leur propre geste).
        if ((event.target as Element).closest("[data-reorder-task], button, a, input, textarea, select, summary, [data-no-drag='true']")) return;
        stepLongPress.onTouchStart(event);
      }}
      onTouchMove={stepLongPress.onTouchMove}
      onTouchEnd={stepLongPress.onTouchEnd}
      onTouchCancel={stepLongPress.onTouchCancel}
      className="mb-step-card"
      style={{
        position: "relative",
        WebkitUserSelect: "none",
        userSelect: "none",
        WebkitTouchCallout: "none",
        cursor: isDragging ? "grabbing" : "grab",
        opacity: isDragging ? 0.72 : 1,
        boxShadow: dropPosition
          ? `inset 0 ${dropPosition === "before" ? "3px" : "-3px"} 0 ${accentColor}`
          : undefined,
        transition: "box-shadow 180ms var(--mb-ease), opacity 120ms var(--mb-ease)",
      }}
    >
      {/* Identité projet = uniquement le numéro d'étape coloré (plus d'arête
          latérale, jugée superflue). */}
      <div
        className="mb-step-header w-full flex items-center justify-between gap-3"
        style={{
          padding: "11px 16px 10px",
        }}
      >
        <div className="flex items-center gap-2.5 min-w-0 flex-1">
          <span
            aria-hidden
            className="w-6 h-6 rounded-full flex items-center justify-center text-[10px] font-bold shrink-0"
            style={{
              background: accentColor,
              color: "#FFFFFF",
              border: "none",
            }}
          >
            {step.order}
          </span>
          <div className="min-w-0 flex-1">
            <p
              className="truncate"
              style={{ color: text.primary, fontSize: 15.5, fontWeight: 700, letterSpacing: "-0.01em", lineHeight: 1.2 }}
            >
              {displayTitle}
            </p>
            {step.description && (
              <p className="text-[11px] mt-0.5 truncate" style={{ color: text.muted }}>
                {step.description}
              </p>
            )}
          </div>
        </div>

        {/* suppressHydrationWarning : `indicators` dépend de `new Date()` —
            sa valeur peut différer entre le SSR et l'hydratation client si
            une tâche bascule "due soon → overdue" entre les deux moments.
            Sans cette directive, React 19 abandonne l'hydratation de tout
            ce sous-arbre et casse les onClick en cascade. */}
        <div className="flex items-center gap-2 shrink-0 flex-wrap justify-end" suppressHydrationWarning>
          <StepMetaTag
            label={statusSettings?.step?.[computedStatus]?.label ?? stepStatusLabels[computedStatus]}
            status={computedStatus}
            customColor={statusSettings?.step?.[computedStatus]?.color}
          />
          <StepTaskCountTag count={tasks.length} />
          {indicators.indicators.map((indicator) => (
            <AttentionTag key={indicator.key} label={indicator.label} tone={indicator.tone} />
          ))}

          {tasks.length > 0 && (
            <div className="flex items-center gap-1.5" title={`${doneTasks}/${tasks.length} tâches terminées`}>
              <div
                style={{
                  width: 64,
                  height: 5,
                  background: surface.s3,
                  borderRadius: 999,
                  overflow: "hidden",
                  border: `1px solid ${surface.border}`,
                }}
              >
                <div
                  style={{
                    height: "100%",
                    width: `${completion}%`,
                    background: accentColor,
                    borderRadius: 999,
                    transition: "width 0.3s",
                  }}
                />
              </div>
              <span className="text-[11px] font-semibold tabular-nums" style={{ color: completion === 100 ? accentColor : text.secondary }}>
                {completion}%
              </span>
            </div>
          )}

          {confirmDelete ? (
            <InlineDeleteConfirm onConfirm={onDeleteStep} onCancel={() => setConfirmDelete(false)} />
          ) : (
            <RowSettingsMenu
              ariaLabel="Actions sur l'étape"
              items={[
                {
                  label: "Renommer / modifier",
                  icon: "pencil",
                  onClick: () => {
                    setIsEditing(true);
                    setConfirmDelete(false);
                  },
                },
                {
                  label: "Supprimer l'étape",
                  icon: "trash",
                  tone: "danger",
                  onClick: () => {
                    setConfirmDelete(true);
                    setIsEditing(false);
                  },
                },
              ]}
            />
          )}

        </div>
      </div>

      {isEditing && (
        <div className="rounded-xl px-3 py-3 mb-2" style={{ background: surface.s2, border: `1px solid ${surface.borderSubtle}` }}>
          <StepEditForm
            step={step}
            workspace={workspace}
            onCancel={() => setIsEditing(false)}
            onSave={(input) => {
              onUpdateStep(input);
              setIsEditing(false);
            }}
          />
        </div>
      )}

      <div className="mb-step-task-list" style={{ display: "flex", flexDirection: "column", gap: 8 }}>
        {tasks.length === 0 ? (
          <p
            style={{
              fontSize: 12,
              color: text.muted,
              margin: "8px 4px",
              fontStyle: "italic",
            }}
          >
            Aucune tâche dans cette étape — utilise le bouton ci-dessous pour en ajouter.
          </p>
        ) : (
          <>
            <TaskTableHeader />
            {tasks.map((task) => (
              <TaskCard
                key={task.id}
                projectId={projectId}
                workspace={workspace}
                stepId={step.id}
                stepTitle={displayTitle}
                stepDescription={step.description}
                task={task}
                accentColor={accentColor}
                isDragging={draggingTaskId === task.id}
                dropPosition={taskDropTarget?.taskId === task.id ? taskDropTarget.position : null}
                projectPeople={projectPeople}
                projectTeams={projectTeams}
                statusSettings={statusSettings}
                onDragStart={(event) => onTaskDragStart(event, task.id)}
                onDragOver={(event) => onTaskDragOver(event, task.id)}
                onDrop={(event) => onTaskDrop(event, task.id)}
                onDragEnd={onTaskDragEnd}
                onToggle={() => onToggleTask(step.id, task.id)}
                onUpdate={(input) => onUpdateTask(task.id, input)}
                onDelete={() => onDeleteTask(task.id)}
                onChecklistMutated={(nextChecklist) => onTaskChecklistMutated(task.id, nextChecklist)}
                onReorderEngage={(x, y, element) => onTaskReorderEngage(task.id, x, y, element)}
              />
            ))}
          </>
        )}

        <AddTaskForm projectId={projectId} workspace={workspace} stepId={step.id} />
      </div>

    </div>
  );
}

function StepTaskCountTag({ count }: { count: number }) {
  return (
    <span
      style={{
        background: surface.s2,
        color: text.secondary,
        fontSize: 10.5,
        fontWeight: 500,
        padding: "2px 8px",
        borderRadius: 999,
        lineHeight: 1.2,
        fontVariantNumeric: "tabular-nums",
      }}
    >
      {count} tâche{count > 1 ? "s" : ""}
    </span>
  );
}

function StepEditForm({
  step,
  workspace,
  onCancel,
  onSave,
}: {
  step: Step;
  workspace: Workspace;
  onCancel: () => void;
  onSave: (input: StepUpdateInput) => void;
}) {
  const theme = workspaceTheme[workspace];
  const [title, setTitle] = useState(step.title);
  const [description, setDescription] = useState(step.description ?? "");

  function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!title.trim()) return;
    // La priorité de l'étape n'est plus saisissable : elle est calculée
    // automatiquement à partir de la moyenne des priorités des tâches.
    onSave({ title, description });
  }

  return (
    <form
      onSubmit={handleSubmit}
      className="mb-card-premium mb-card-subtle rounded-2xl p-3"
      style={{ background: surface.s3, border: `1px dashed ${surface.border}` }}
    >
      <input
        value={title}
        onChange={(event) => setTitle(event.target.value)}
        required
        placeholder="Nom de l'étape"
        className="w-full rounded-lg px-3 py-2 text-xs outline-none"
        style={{ background: surface.s1, color: text.primary, border: `1px solid ${surface.border}` }}
      />
      <textarea
        value={description}
        onChange={(event) => setDescription(event.target.value)}
        placeholder="Détail optionnel"
        rows={2}
        className="mt-2 w-full rounded-lg px-3 py-2 text-xs outline-none resize-none"
        style={{ background: surface.s1, color: text.primary, border: `1px solid ${surface.border}` }}
      />
      <p
        style={{
          marginTop: 8,
          fontSize: 10.5,
          color: text.muted,
          lineHeight: 1.4,
        }}
      >
        La priorité de l'étape est calculée automatiquement comme la moyenne des priorités des tâches qu'elle contient.
      </p>
      <div className="mt-2 flex items-center gap-2 justify-end">
        <button type="button" onClick={onCancel} className="rounded-lg px-3 py-2 text-xs font-medium" style={{ background: surface.s1, color: text.muted, border: `1px solid ${surface.border}` }}>
          Annuler
        </button>
        <button type="submit" className="rounded-lg px-3 py-2 text-xs font-semibold" style={{ background: theme.accent, color: "#FFFFFF", border: "none" }}>
          Enregistrer
        </button>
      </div>
    </form>
  );
}

function TaskTableHeader() {
  // Texte calé verticalement par padding équilibré : on laisse line-height à
  // la valeur par défaut et on encadre la baseline par 8px de respiration en
  // haut et en bas. Plus simple/robuste que des flex-stretch en grid.
  return (
    <div
      className="mb-task-table-header mb-task-row hidden gap-2 md:grid"
      style={{
        fontSize: 9.5,
        fontWeight: 700,
        textTransform: "uppercase",
        letterSpacing: "0.14em",
        lineHeight: 1,
        padding: "14px 12px 8px",
        alignItems: "center",
      }}
    >
      <span />
      <span>Tâche</span>
      <span>Statut</span>
      <span>Échéance</span>
      <span>Assigné</span>
      <span />
      <span />
    </div>
  );
}

function TaskCard({
  projectId,
  workspace,
  stepId,
  stepTitle,
  stepDescription,
  task,
  accentColor,
  isDragging,
  dropPosition,
  projectPeople,
  projectTeams,
  statusSettings,
  onDragStart,
  onDragOver,
  onDrop,
  onDragEnd,
  onToggle,
  onUpdate,
  onDelete,
  onChecklistMutated,
  onReorderEngage,
}: {
  projectId: string;
  workspace: Workspace;
  stepId: string;
  stepTitle: string;
  stepDescription?: string;
  task: Task;
  accentColor: string;
  isDragging: boolean;
  dropPosition: DropPosition | null;
  projectPeople: ProjectPerson[];
  projectTeams: ProjectTeam[];
  statusSettings?: ProjectStatusSettings;
  onDragStart: (event: DragEvent<HTMLElement>) => void;
  onDragOver: (event: DragEvent<HTMLElement>) => void;
  onDrop: (event: DragEvent<HTMLElement>) => void;
  onDragEnd: () => void;
  onToggle: () => void;
  onUpdate: (input: TaskUpdateInput) => void;
  onDelete: () => void;
  onChecklistMutated: (nextChecklist: ChecklistItem[]) => void;
  onReorderEngage: (x: number, y: number, element: HTMLElement) => void;
}) {
  const [showCompletionBlocked, setShowCompletionBlocked] = useState(false);
  const [renaming, setRenaming] = useState(false);
  const [renameDraft, setRenameDraft] = useState(task.title);
  const isTouch = useIsTouchDevice();
  const taskLongPress = useLongPressDrag(({ x, y, element }) => onReorderEngage(x, y, element));
  const taskStatus = deriveTaskStatus(task);
  // overdue/dueSoon dépendent de `new Date()` → pas calculés tant qu'on
  // n'a pas hydraté, sinon SSR vs client iPhone divergent.
  const [hydratedTask, setHydratedTask] = useState(false);
  useEffect(() => setHydratedTask(true), []);
  const overdue = hydratedTask && isTaskOverdue(task);
  const dueSoon = hydratedTask && isTaskDueSoon(task);
  const statusMeta = getTaskStatusMeta(taskStatus, statusSettings);
  const statusLabel = statusSettings?.task?.[taskStatus]?.label ?? taskStatusLabels[taskStatus];

  useEffect(() => {
    if (!renaming) setRenameDraft(task.title);
  }, [task.title, renaming]);

  function commitRename() {
    const next = renameDraft.trim();
    setRenaming(false);
    if (next && next !== task.title) onUpdate({ title: next });
    else setRenameDraft(task.title);
  }

  // Garde locale "passer en terminée" : si la checklist n'est pas
  // intégralement cochée, on affiche un popup d'info (neutre, non agressif)
  // sur la tâche au lieu de déclencher la complétion.
  function attemptCompletion() {
    const checklist = task.checklist ?? [];
    const incomplete = checklist.length > 0 && !checklist.every((item) => item.done);
    if (incomplete) {
      setShowCompletionBlocked(true);
      return;
    }
    onToggle();
  }
  const theme = workspaceTheme[workspace];
  const [confirmDelete, setConfirmDelete] = useState(false);
  const checklistTotal = task.checklist?.length ?? 0;
  const checklistDone = task.checklist?.filter((item) => item.done).length ?? 0;
  const linkedTeams = projectTeams.filter((team) => task.teamIds?.includes(team.id));
  const displayOwner = getVisibleTaskOwner(task.owner);
  const comments = (task.comments ?? []).map((comment) => comment.trim()).filter(Boolean);
  const fileCount = task.files?.length ?? 0;
  const discussionCount = task.discussion?.length ?? 0;
  const participantNames = buildTaskParticipantNames(task, displayOwner, linkedTeams);
  const guidance = (task.guidance ?? []).map((tip) => tip.trim()).find(Boolean) ?? "";
  const expected = task.expected?.trim() ?? "";
  const description = task.description?.trim() ?? "";
  const realization = task.realization?.trim() || task.completionDetails?.trim() || "";
  // Toute tâche est déployable — qu'elle ait du contenu pré-rempli (créée IA,
  // template) ou qu'elle soit créée manuellement (titre seul). La vue dépliée
  // permet justement de saisir attendu / réalisation / checklist / discussion.
  const hasPreviewSignals = Boolean(expected || description || guidance || realization) || checklistTotal > 0 || comments.length > 0 || fileCount > 0 || discussionCount > 0;
  void hasPreviewSignals;
  const assigneeLabel = displayOwner || task.assignees?.[0] || linkedTeams[0]?.name || "—";
  // Priorité affichée : `deriveTaskDisplayPriority` peut bumper à high si
  // overdue/due-today (donc `new Date()`-dépendant). On utilise la priorité
  // brute jusqu'à hydratation pour garantir le match SSR/client.
  const displayedPriority: ProjectPriority = hydratedTask
    ? deriveTaskDisplayPriority(task)
    : task.priority ?? "medium";
  const displayedPriorityVisual = priorityVisuals[displayedPriority];

  return (
    <TaskDetailLauncher
      projectId={projectId}
      workspace={workspace}
      stepId={stepId}
      stepTitle={stepTitle}
      stepDescription={stepDescription}
      task={task}
      accentColor={accentColor}
      projectPeople={projectPeople}
      projectTeams={projectTeams}
      statusSettings={statusSettings}
      onChecklistChange={onChecklistMutated}
      onTaskChange={onUpdate}
      trigger={({ open }) => (
    <div
      data-drag-card
      data-reorder-task={task.id}
      data-reorder-step-id={stepId}
      draggable={!isTouch}
      onClick={(event) => {
        // Si le tap atterrit sur un bouton/élément interactif intérieur,
        // on laisse le handler natif faire son travail. Sinon → ouvre la modal.
        const interactive = (event.target as HTMLElement).closest(
          "button,a,input,select,textarea,[role='button'],[data-no-task-expand='true']",
        );
        if (interactive) return;
        open();
      }}
      onDragStart={onDragStart}
      onDragOver={onDragOver}
      onDrop={onDrop}
      onDragEnd={onDragEnd}
      onTouchStart={(event) => {
        // Appui long sur la tâche pour la déplacer ; on ignore les boutons /
        // champs (case à cocher, menu, pickers…) qui ont leur propre action.
        if ((event.target as Element).closest("button, a, input, textarea, select, [role='button'], [data-no-task-expand='true'], [data-no-drag='true']")) return;
        taskLongPress.onTouchStart(event);
      }}
      onTouchMove={taskLongPress.onTouchMove}
      onTouchEnd={taskLongPress.onTouchEnd}
      onTouchCancel={taskLongPress.onTouchCancel}
      className="mb-task-card"
      style={{
        position: "relative",
        WebkitUserSelect: "none",
        userSelect: "none",
        WebkitTouchCallout: "none",
        background: overdue ? errorTokens.bg : surface.s1,
        border: `1px solid ${overdue ? errorTokens.border : surface.borderSubtle}`,
        borderRadius: 10,
        padding: "9px 12px 9px 16px",
        overflow: "hidden",
        cursor: isDragging ? "grabbing" : "pointer",
        opacity: isDragging ? 0.65 : 1,
        boxShadow: dropPosition
          ? `inset 0 ${dropPosition === "before" ? "2px" : "-2px"} 0 ${accentColor}`
          : "var(--mb-shadow-card)",
        transition: "background-color 120ms var(--mb-ease), border-color 120ms var(--mb-ease), box-shadow 180ms var(--mb-ease), transform 120ms var(--mb-ease)",
      }}
    >
      {/* La priorité n'est PLUS une barre à gauche (réservée désormais à l'arête
          d'identité projet de l'étape) → on l'affiche par une petite pastille
          colorée devant le titre (cf. plus bas). */}
      <div className="mb-task-row grid items-center gap-2">
        <button
          type="button"
          onClick={taskStatus === "done" ? onToggle : attemptCompletion}
          className="w-[18px] h-[18px] rounded-full shrink-0 flex items-center justify-center"
          style={{
            // Cocher la tâche = remplir en couleur projet. Sinon : contour fin en couleur
            // projet (sauf si en retard → contour rouge d'alerte). La couleur projet est
            // ainsi toujours présente sur la coche.
            background: taskStatus === "done" ? accentColor : "transparent",
            border:
              taskStatus === "done"
                ? "none"
                : `1.5px solid ${overdue ? errorTokens.text : accentColor}`,
            transition: "background-color 180ms var(--mb-ease), border-color 180ms var(--mb-ease)",
          }}
          title={taskStatus === "done" ? "Marquer comme à faire" : "Marquer comme terminée"}
        >
          {taskStatus === "done" && (
            <svg width="9" height="9" viewBox="0 0 12 12" fill="none">
              <path d="M2 6l3 3 5-5" stroke="white" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" />
            </svg>
          )}
        </button>

        <div className="min-w-0 flex items-center gap-2 overflow-hidden">
          {taskStatus !== "done" && (
            <span
              aria-hidden
              title={`Priorité : ${displayedPriorityVisual.label.toLowerCase()}`}
              className="shrink-0"
              style={{ width: 7, height: 7, borderRadius: "50%", background: displayedPriorityVisual.text }}
            />
          )}
          <div className="min-w-0 flex-1 overflow-hidden">
            {renaming ? (
              <input
                type="text"
                autoFocus
                value={renameDraft}
                data-no-task-expand="true"
                onChange={(event) => setRenameDraft(event.target.value)}
                onClick={(event) => event.stopPropagation()}
                onKeyDown={(event) => {
                  if (event.key === "Enter") {
                    event.preventDefault();
                    commitRename();
                  } else if (event.key === "Escape") {
                    setRenaming(false);
                    setRenameDraft(task.title);
                  }
                }}
                onBlur={commitRename}
                style={{
                  width: "100%",
                  background: surface.s2,
                  border: `1px solid ${accentColor}`,
                  borderRadius: 6,
                  padding: "2px 8px",
                  fontSize: 11.5,
                  fontWeight: 600,
                  color: text.primary,
                  outline: "none",
                }}
              />
            ) : (
              <p
                className="mb-task-title truncate text-[11.5px] font-semibold leading-tight"
                style={{
                  color: taskStatus === "done" ? text.ghost : text.primary,
                }}
              >
                {task.title}
              </p>
            )}
            <TaskNameInsights
              participantNames={participantNames}
              fileCount={fileCount}
              discussionCount={discussionCount}
              checklistDone={checklistDone}
              checklistTotal={checklistTotal}
              accentColor={accentColor}
            />
          </div>
        </div>

        <span className="mb-task-status min-w-0">
          <TaskStatusInlinePicker
            task={task}
            statusSettings={statusSettings}
            onPickStatus={(nextStatus) => {
              if (nextStatus === taskStatus) return;
              if (nextStatus === "done") {
                attemptCompletion();
                return;
              }
              onUpdate({ status: nextStatus });
            }}
          />
        </span>

        <span
          className="mb-task-date inline-flex items-center gap-1 text-[10px] font-medium"
          style={{
            // L'urgence d'échéance est portée directement par la date :
            // ambre si proche (≤ 3j), rouge si dépassée. Plus de dot
            // séparé dans une colonne dédiée pour éviter la duplication.
            color: !task.dueDate
              ? text.ghost
              : overdue
                ? errorTokens.text
                : dueSoon
                  ? statusColor.yellow.text
                  : text.secondary,
            fontWeight: task.dueDate && (overdue || dueSoon) ? 600 : 500,
          }}
          title={overdue ? "Échéance dépassée" : dueSoon ? "Échéance proche" : undefined}
        >
          <CalendarMiniIcon />
          {task.dueDate ? formatTaskScheduleLabel(task) : "Ajouter"}
        </span>

        <span className="mb-task-assignee inline-flex min-w-0 items-center gap-1.5 text-[10px] font-semibold" style={{ color: text.secondary }}>
          <TaskAssigneePill label={assigneeLabel === "—" ? "Ajouter" : assigneeLabel} color={accentColor} muted={assigneeLabel === "—"} />
        </span>

        <div className="mb-task-actions relative flex items-center justify-end gap-1">
          {confirmDelete ? (
            <InlineDeleteConfirm onConfirm={onDelete} onCancel={() => setConfirmDelete(false)} compact />
          ) : (
            <RowSettingsMenu
              ariaLabel="Actions sur la tâche"
              items={[
                {
                  label: "Renommer",
                  icon: "pencil",
                  onClick: () => {
                    setRenaming(true);
                    setRenameDraft(task.title);
                  },
                },
                {
                  label: "Supprimer la tâche",
                  icon: "trash",
                  tone: "danger",
                  onClick: () => setConfirmDelete(true),
                },
              ]}
            />
          )}
        </div>

      </div>

      {showCompletionBlocked && (
        <CompletionBlockedPopover
          checklistTotal={task.checklist?.length ?? 0}
          checklistDone={task.checklist?.filter((item) => item.done).length ?? 0}
          onClose={() => setShowCompletionBlocked(false)}
        />
      )}
    </div>
      )}
    />
  );
}

function CompletionBlockedPopover({
  checklistTotal,
  checklistDone,
  onClose,
}: {
  checklistTotal: number;
  checklistDone: number;
  onClose: () => void;
}) {
  // Modal centré rendu via Portal pour échapper à l'overflow:hidden des
  // cartes (sinon le popup est clippé quand la tâche est repliée).
  if (typeof document === "undefined") return null;
  return createPortal(
    <div
      onClick={onClose}
      style={{
        position: "fixed",
        inset: 0,
        zIndex: 9999,
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        padding: 16,
        background: "rgba(15, 23, 42, 0.32)",
      }}
    >
      <div
        data-no-task-expand="true"
        role="dialog"
        aria-modal="true"
        onClick={(event) => event.stopPropagation()}
        style={{
          width: 320,
          maxWidth: "100%",
          padding: 14,
          background: surface.s1,
          border: `1px solid ${surface.borderSubtle}`,
        borderRadius: 12,
        boxShadow: "var(--mb-shadow-md)",
        display: "flex",
        flexDirection: "column",
        gap: 10,
      }}
    >
      <div className="flex items-start gap-2">
        <span
          aria-hidden
          style={{
            width: 22,
            height: 22,
            borderRadius: "50%",
            background: surface.s2,
            color: text.secondary,
            display: "inline-flex",
            alignItems: "center",
            justifyContent: "center",
            flexShrink: 0,
          }}
        >
          <svg width="13" height="13" viewBox="0 0 16 16" fill="none" aria-hidden="true">
            <circle cx="8" cy="8" r="6.5" stroke="currentColor" strokeWidth="1.4" />
            <path d="M8 7v3.4M8 5h.01" stroke="currentColor" strokeWidth="1.55" strokeLinecap="round" />
          </svg>
        </span>
        <div style={{ flex: 1, minWidth: 0 }}>
          <p style={{ fontSize: 12, fontWeight: 600, color: text.primary, margin: 0, lineHeight: 1.4 }}>
            Checklist à terminer
          </p>
          <p style={{ fontSize: 11.5, color: text.secondary, margin: "2px 0 0", lineHeight: 1.45 }}>
            Coche les {checklistTotal - checklistDone} sous-action{checklistTotal - checklistDone > 1 ? "s" : ""} restante
            {checklistTotal - checklistDone > 1 ? "s" : ""} avant de marquer cette tâche comme terminée.
          </p>
        </div>
      </div>
      <div className="flex items-center justify-end">
        <button
          type="button"
          onClick={onClose}
          style={{
            padding: "5px 14px",
            fontSize: 11.5,
            fontWeight: 600,
            color: text.primary,
            background: surface.s2,
            border: `1px solid ${surface.border}`,
            borderRadius: 8,
            cursor: "pointer",
          }}
        >
          OK
        </button>
      </div>
      </div>
    </div>,
    document.body,
  );
}

function CalendarMiniIcon() {
  return (
    <svg width="11" height="11" viewBox="0 0 16 16" fill="none" aria-hidden="true">
      <path d="M4.5 2.7v2M11.5 2.7v2M3 6.2h10M4.4 3.7h7.2A1.7 1.7 0 0 1 13.3 5.4v6.2a1.7 1.7 0 0 1-1.7 1.7H4.4a1.7 1.7 0 0 1-1.7-1.7V5.4a1.7 1.7 0 0 1 1.7-1.7Z" stroke="currentColor" strokeWidth="1.35" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  );
}

function TaskAssigneePill({ label, color, muted }: { label: string; color: string; muted?: boolean }) {
  const initials = label
    .split(/\s+/)
    .map((part) => part[0])
    .join("")
    .slice(0, 2)
    .toLocaleUpperCase("fr-FR");

  if (muted) {
    return <span style={{ color: text.ghost }}>{label}</span>;
  }

  return (
    <>
      <span
        className="inline-flex h-6 w-6 items-center justify-center rounded-full text-[9px] font-bold"
        style={{ background: color, color: "#FFFFFF" }}
      >
        {initials || "MB"}
      </span>
      <span className="truncate">{label}</span>
    </>
  );
}

function TaskNameInsights({
  participantNames,
  fileCount,
  discussionCount,
  checklistDone,
  checklistTotal,
  accentColor,
}: {
  participantNames: string[];
  fileCount: number;
  discussionCount: number;
  checklistDone: number;
  checklistTotal: number;
  accentColor: string;
}) {
  if (participantNames.length === 0 && fileCount === 0 && discussionCount === 0 && checklistTotal === 0) return null;

  return (
    <div className="mt-1 flex min-w-0 max-w-full flex-wrap items-center gap-1.5 overflow-hidden" style={{ color: text.muted }}>
      {participantNames.length > 0 && (
        <span className="mb-task-participants inline-flex items-center gap-1" title={`${participantNames.length} participant${participantNames.length > 1 ? "s" : ""}`}>
          <span className="flex items-center">
            {participantNames.slice(0, 3).map((name, index) => (
              <span
                key={`${name}-${index}`}
                className="inline-flex h-5 w-5 items-center justify-center rounded-full text-[8px] font-bold"
                style={{
                  marginLeft: index === 0 ? 0 : -6,
                  background: index === 0 ? accentColor : surface.s3,
                  color: index === 0 ? "#FFFFFF" : text.secondary,
                  border: `1.5px solid ${surface.s1}`,
                }}
              >
                {getInitials(name)}
              </span>
            ))}
          </span>
          <span className="text-[10px] font-semibold">{participantNames.length}</span>
        </span>
      )}
      {discussionCount > 0 && <TaskTinyCounter icon="comment" value={discussionCount} />}
      {fileCount > 0 && <TaskTinyCounter icon="file" value={fileCount} />}
      {checklistTotal > 0 && <TaskTinyCounter icon="check" value={`${checklistDone}/${checklistTotal}`} />}
    </div>
  );
}

function buildTaskParticipantNames(task: Task, owner: string | undefined, teams: ProjectTeam[]) {
  const seen = new Set<string>();
  const names: string[] = [];

  [...(owner ? [owner] : []), ...(task.assignees ?? []), ...teams.map((team) => team.name)]
    .map((name) => name.trim())
    .filter(Boolean)
    .forEach((name) => {
      const key = name.toLocaleLowerCase("fr-FR");
      if (seen.has(key)) return;
      seen.add(key);
      names.push(name);
    });

  return names;
}

function getInitials(label: string) {
  return (
    label
      .split(/\s+/)
      .map((part) => part[0])
      .join("")
      .slice(0, 2)
      .toLocaleUpperCase("fr-FR") || "MB"
  );
}

function TaskTinyCounter({ icon, value }: { icon: "comment" | "file" | "check"; value: number | string }) {
  return (
    <span className="inline-flex items-center gap-1 text-[11px] font-semibold">
      {icon === "comment" && (
        <svg width="12" height="12" viewBox="0 0 16 16" fill="none" aria-hidden="true">
          <path d="M3 4.6A2.1 2.1 0 0 1 5.1 2.5h5.8A2.1 2.1 0 0 1 13 4.6v3.2a2.1 2.1 0 0 1-2.1 2.1H8.3L5 12.7V9.9A2.1 2.1 0 0 1 3 7.8V4.6Z" stroke="currentColor" strokeWidth="1.35" strokeLinejoin="round" />
        </svg>
      )}
      {icon === "file" && (
        <svg width="12" height="12" viewBox="0 0 16 16" fill="none" aria-hidden="true">
          <path d="M4.6 2.6h4.1l2.7 2.8v8H4.6V2.6Z" stroke="currentColor" strokeWidth="1.35" strokeLinejoin="round" />
          <path d="M8.7 2.8v2.7h2.5" stroke="currentColor" strokeWidth="1.35" strokeLinecap="round" strokeLinejoin="round" />
        </svg>
      )}
      {icon === "check" && (
        <svg width="12" height="12" viewBox="0 0 16 16" fill="none" aria-hidden="true">
          <path d="M3.5 8.2 6.4 11l6-6" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round" />
        </svg>
      )}
      {value}
    </span>
  );
}

// Bouton "réglages" avec menu déroulant (rendu via portal pour éviter
// les problèmes de stacking-context). Utilisé sur les étapes et les
// tâches pour grouper les actions profondes : renommer, supprimer, etc.
interface RowSettingsMenuItem {
  label: string;
  icon?: "pencil" | "trash" | "info";
  tone?: "default" | "danger";
  onClick: () => void;
}

function RowSettingsMenu({
  items,
  align = "right",
  ariaLabel = "Plus d'options",
}: {
  items: RowSettingsMenuItem[];
  align?: "right" | "left";
  ariaLabel?: string;
}) {
  const { open, triggerRect, triggerRef, menuRef, toggle, close } = useInlinePickerMenu();
  return (
    <>
      <button
        ref={triggerRef}
        type="button"
        data-no-task-expand="true"
        onClick={(event) => {
          event.stopPropagation();
          toggle();
        }}
        className="inline-flex h-6 w-6 items-center justify-center rounded-full"
        style={{
          background: surface.s2,
          color: text.muted,
          border: `1px solid ${surface.borderSubtle}`,
          cursor: "pointer",
        }}
        title={ariaLabel}
        aria-label={ariaLabel}
      >
        <svg width="13" height="13" viewBox="0 0 16 16" fill="none" aria-hidden="true">
          <circle cx="3.5" cy="8" r="1.4" fill="currentColor" />
          <circle cx="8" cy="8" r="1.4" fill="currentColor" />
          <circle cx="12.5" cy="8" r="1.4" fill="currentColor" />
        </svg>
      </button>
      {open && triggerRect && typeof document !== "undefined"
        ? createPortal(
            <div
              ref={menuRef}
              role="menu"
              data-no-task-expand="true"
              onClick={(event) => event.stopPropagation()}
              style={{
                position: "fixed",
                top: triggerRect.bottom + 4,
                ...(align === "right"
                  ? { left: Math.max(8, triggerRect.right - 200) }
                  : { left: triggerRect.left }),
                zIndex: 9999,
                minWidth: 200,
                padding: 6,
                background: surface.s1,
                border: `1px solid ${surface.border}`,
                borderRadius: 12,
                boxShadow: "var(--mb-shadow-md)",
                display: "flex",
                flexDirection: "column",
                gap: 1,
              }}
            >
              {items.map((item, index) => (
                <button
                  key={index}
                  type="button"
                  role="menuitem"
                  onClick={(event) => {
                    event.stopPropagation();
                    close();
                    item.onClick();
                  }}
                  className="flex items-center gap-2 rounded-lg px-2.5 py-2 text-left"
                  style={{
                    background: "transparent",
                    border: "none",
                    color: item.tone === "danger" ? errorTokens.text : text.secondary,
                    fontSize: 12,
                    fontWeight: 500,
                    cursor: "pointer",
                  }}
                >
                  {item.icon === "pencil" && (
                    <svg width="13" height="13" viewBox="0 0 16 16" fill="none" aria-hidden="true">
                      <path d="M11.5 2.5l2 2-7.5 7.5H4v-2l7.5-7.5z" stroke="currentColor" strokeWidth="1.4" strokeLinejoin="round" />
                    </svg>
                  )}
                  {item.icon === "trash" && (
                    <svg width="13" height="13" viewBox="0 0 16 16" fill="none" aria-hidden="true">
                      <path d="M3.5 5h9M6 5V3.5h4V5M5 5l.7 8h4.6L11 5" stroke="currentColor" strokeWidth="1.4" strokeLinecap="round" strokeLinejoin="round" />
                    </svg>
                  )}
                  {item.icon === "info" && (
                    <svg width="13" height="13" viewBox="0 0 16 16" fill="none" aria-hidden="true">
                      <circle cx="8" cy="8" r="6" stroke="currentColor" strokeWidth="1.4" />
                      <path d="M8 7v4M8 5h.01" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" />
                    </svg>
                  )}
                  <span style={{ flex: 1 }}>{item.label}</span>
                </button>
              ))}
            </div>,
            document.body,
          )
        : null}
    </>
  );
}

// Petit dot de priorité (cliquable pour ouvrir le picker priorité).
// Il reflète la priorité affichée : priorité manuelle, ou priorité haute
// automatiquement si l'échéance est aujourd'hui ou dépassée.
function TaskPriorityDot({
  task,
  onPickPriority,
}: {
  task: Task;
  onPickPriority: (priority: ProjectPriority) => void;
}) {
  const { open, triggerRect, triggerRef, menuRef, toggle, close } = useInlinePickerMenu();
  const manual = task.priority ?? "medium";
  const displayed = deriveTaskDisplayPriority(task);
  const visual = priorityVisuals[displayed];
  const isAutoEscalated = displayed !== manual;

  return (
    <>
      <button
        ref={triggerRef}
        type="button"
        data-no-task-expand="true"
        onClick={(event) => {
          event.stopPropagation();
          toggle();
        }}
        title={
          isAutoEscalated
            ? `Priorité : ${visual.label.toLowerCase()} automatiquement, échéance aujourd'hui ou dépassée — clic pour changer la valeur manuelle`
            : `Priorité : ${visual.label.toLowerCase()} — clic pour changer`
        }
        aria-label="Changer la priorité"
        className="inline-flex shrink-0 items-center justify-center"
        style={{
          width: 14,
          height: 14,
          padding: 0,
          background: "transparent",
          border: "none",
          cursor: "pointer",
        }}
      >
        <span
          aria-hidden
          style={{
            width: 9,
            height: 9,
            borderRadius: "50%",
            background: visual.text,
            display: "inline-block",
          }}
        />
      </button>
      {open && triggerRect && typeof document !== "undefined"
        ? createPortal(
            <div
              ref={menuRef}
              role="listbox"
              data-no-task-expand="true"
              onClick={(event) => event.stopPropagation()}
              style={{
                position: "fixed",
                top: triggerRect.bottom + 4,
                left: Math.max(8, triggerRect.left - 80),
                zIndex: 9999,
                minWidth: 180,
                padding: 6,
                background: surface.s1,
                border: `1px solid ${surface.border}`,
                borderRadius: 12,
                boxShadow: "var(--mb-shadow-md)",
                display: "flex",
                flexDirection: "column",
                gap: 1,
              }}
            >
              <p
                style={{
                  margin: "2px 4px 4px",
                  fontSize: 9.5,
                  fontWeight: 600,
                  color: text.muted,
                  textTransform: "uppercase",
                  letterSpacing: "0.1em",
                }}
              >
                Priorité
              </p>
              {TASK_PRIORITY_OPTIONS.map((option) => {
                const v = priorityVisuals[option];
                const selected = option === manual;
                return (
                  <button
                    key={option}
                    type="button"
                    onClick={(event) => {
                      event.stopPropagation();
                      close();
                      if (option !== manual) onPickPriority(option);
                    }}
                    className="flex items-center gap-2 rounded-lg px-2 py-1.5 text-left"
                    style={{
                      background: selected ? surface.s2 : "transparent",
                      border: "none",
                      color: text.secondary,
                      fontSize: 11.5,
                      fontWeight: 500,
                      cursor: "pointer",
                    }}
                  >
                    <span aria-hidden style={{ width: 8, height: 8, borderRadius: "50%", background: v.text, flexShrink: 0 }} />
                    <span style={{ flex: 1 }}>{v.label}</span>
                    {selected && (
                      <svg width="11" height="11" viewBox="0 0 12 12" fill="none" aria-hidden="true">
                        <path d="M2 6.4 4.5 8.8 10 3.6" stroke={v.text} strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round" />
                      </svg>
                    )}
                  </button>
                );
              })}
            </div>,
            document.body,
          )
        : null}
    </>
  );
}

function TaskMetaTag({
  label,
  color = text.muted,
  background = surface.s2,
  border,
  strong = false,
  withDot = false,
}: {
  label: string;
  color?: string;
  background?: string;
  border?: string;
  strong?: boolean;
  withDot?: boolean;
}) {
  // Pill moderne : pas de bordure par défaut, padding tight, font-weight medium.
  return (
    <span
      className="inline-flex items-center gap-1"
      style={{
        color,
        background,
        border: border ? `1px solid ${border}40` : "1px solid transparent",
        fontSize: 10.5,
        fontWeight: strong ? 600 : 500,
        padding: "2px 8px",
        borderRadius: 999,
        lineHeight: 1.2,
        whiteSpace: "nowrap",
      }}
    >
      {withDot && (
        <span
          aria-hidden
          style={{
            width: 6,
            height: 6,
            borderRadius: "50%",
            background: color,
            display: "inline-block",
          }}
        />
      )}
      {label}
    </span>
  );
}

function StepMetaTag({ label, status, customColor }: { label: string; status: Step["status"]; customColor?: string }) {
  // Pill sobre : fond gris neutre, texte sobre, et un dot coloré qui
  // indique le statut. Cohérent avec TaskStatusInlinePicker.
  const dotColor =
    customColor ??
    (status === "done"
      ? statusColor.green.text
      : status === "in_progress"
        ? statusColor.yellow.text
        : status === "waiting"
          ? statusColor.blue.text
          : statusColor.gray.text);

  return (
    <span
      className="inline-flex items-center"
      style={{
        gap: 6,
        color: text.secondary,
        background: surface.s2,
        border: `1px solid ${surface.borderSubtle}`,
        fontSize: 10.5,
        fontWeight: 500,
        padding: "2px 9px",
        borderRadius: 999,
        lineHeight: 1.2,
        whiteSpace: "nowrap",
      }}
    >
      <span aria-hidden style={{ width: 7, height: 7, borderRadius: "50%", background: dotColor, flexShrink: 0 }} />
      {label}
    </span>
  );
}

function AttentionTag({ label, tone }: { label: string; tone: "neutral" | "warning" | "danger" }) {
  const meta =
    tone === "danger"
      ? { color: errorTokens.text, background: errorTokens.bg }
      : tone === "warning"
        ? { color: statusColor.yellow.text, background: statusColor.yellow.bg }
        : { color: text.muted, background: surface.s2 };

  return <TaskMetaTag label={label} color={meta.color} background={meta.background} />;
}

function getTaskStatusMeta(status: TaskStatus, statusSettings?: ProjectStatusSettings) {
  const customColor = statusSettings?.task?.[status]?.color;
  if (customColor) return { color: customColor, background: surface.s2, border: customColor };
  if (status === "done") return { color: statusColor.green.text, background: statusColor.green.bg, border: statusColor.green.text };
  if (status === "in_progress") return { color: statusColor.yellow.text, background: statusColor.yellow.bg, border: statusColor.yellow.text };
  if (status === "waiting") return { color: statusColor.blue.text, background: statusColor.blue.bg, border: statusColor.blue.text };
  if (status === "blocked") return { color: errorTokens.text, background: errorTokens.bg, border: errorTokens.border };
  return { color: statusColor.gray.text, background: statusColor.gray.bg, border: surface.borderSubtle };
}

const TASK_STATUS_OPTIONS: TaskStatus[] = ["todo", "in_progress", "waiting", "blocked", "done"];
const TASK_PRIORITY_OPTIONS: ProjectPriority[] = ["high", "medium", "low"];

// Hook commun aux pickers inline : gère l'ouverture, la position du menu
// (rendu via Portal au document.body pour éviter tout problème de
// stacking-context avec le panel déplié de la tâche), et le click-outside.
function useInlinePickerMenu() {
  const [open, setOpen] = useState(false);
  const [triggerRect, setTriggerRect] = useState<DOMRect | null>(null);
  const triggerRef = useRef<HTMLButtonElement>(null);
  const menuRef = useRef<HTMLDivElement>(null);

  function toggle() {
    if (open) {
      setOpen(false);
      return;
    }
    const rect = triggerRef.current?.getBoundingClientRect();
    if (!rect) return;
    setTriggerRect(rect);
    setOpen(true);
  }

  function close() {
    setOpen(false);
  }

  useEffect(() => {
    if (!open) return;
    function handlePointer(event: MouseEvent) {
      const target = event.target as Node;
      if (triggerRef.current?.contains(target)) return;
      if (menuRef.current?.contains(target)) return;
      setOpen(false);
    }
    function handleScroll() {
      // Repositionne ou ferme à chaque scroll pour éviter un menu orphelin.
      setOpen(false);
    }
    document.addEventListener("mousedown", handlePointer);
    window.addEventListener("scroll", handleScroll, true);
    window.addEventListener("resize", handleScroll);
    return () => {
      document.removeEventListener("mousedown", handlePointer);
      window.removeEventListener("scroll", handleScroll, true);
      window.removeEventListener("resize", handleScroll);
    };
  }, [open]);

  return { open, triggerRect, triggerRef, menuRef, toggle, close };
}

function TaskStatusInlinePicker({
  task,
  statusSettings,
  onPickStatus,
}: {
  task: Task;
  statusSettings?: ProjectStatusSettings;
  onPickStatus: (status: TaskStatus) => void;
}) {
  const { open, triggerRect, triggerRef, menuRef, toggle, close } = useInlinePickerMenu();
  const currentStatus = deriveTaskStatus(task);
  const currentMeta = getTaskStatusMeta(currentStatus, statusSettings);
  const currentLabel = statusSettings?.task?.[currentStatus]?.label ?? taskStatusLabels[currentStatus];

  return (
    <>
      <button
        ref={triggerRef}
        type="button"
        data-no-task-expand="true"
        onClick={(event) => {
          event.stopPropagation();
          toggle();
        }}
        title="Changer le statut"
        className="mb-badge"
        style={{
          display: "inline-flex",
          alignItems: "center",
          gap: 6,
          height: 22,
          padding: "0 9px",
          borderRadius: 999,
          fontSize: 10.5,
          fontWeight: 500,
          color: text.secondary,
          background: surface.s2,
          border: `1px solid ${surface.borderSubtle}`,
          cursor: "pointer",
          letterSpacing: 0,
        }}
      >
        <span aria-hidden style={{ width: 7, height: 7, borderRadius: "50%", background: currentMeta.color, flexShrink: 0 }} />
        <span style={{ whiteSpace: "nowrap" }}>{currentLabel}</span>
        <svg width="9" height="9" viewBox="0 0 12 12" fill="none" aria-hidden="true" style={{ opacity: 0.55 }}>
          <path d="M3 4.5 6 7.5 9 4.5" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round" />
        </svg>
      </button>
      {open && triggerRect && typeof document !== "undefined"
        ? createPortal(
            <div
              ref={menuRef}
              role="listbox"
              data-no-task-expand="true"
              onClick={(event) => event.stopPropagation()}
              style={{
                position: "fixed",
                top: triggerRect.bottom + 4,
                left: Math.max(8, triggerRect.right - 180),
                zIndex: 9999,
                minWidth: 180,
                padding: 6,
                background: surface.s1,
                border: `1px solid ${surface.border}`,
                borderRadius: 12,
                boxShadow: "var(--mb-shadow-md)",
                display: "flex",
                flexDirection: "column",
                gap: 1,
              }}
            >
              {TASK_STATUS_OPTIONS.map((option) => {
                const meta = getTaskStatusMeta(option, statusSettings);
                const label = statusSettings?.task?.[option]?.label ?? taskStatusLabels[option];
                const selected = option === currentStatus;
                return (
                  <button
                    key={option}
                    type="button"
                    onClick={(event) => {
                      event.stopPropagation();
                      close();
                      onPickStatus(option);
                    }}
                    className="flex items-center gap-2 rounded-lg px-2 py-1.5 text-left"
                    style={{
                      background: selected ? surface.s2 : "transparent",
                      border: "none",
                      color: text.secondary,
                      fontSize: 11.5,
                      fontWeight: 500,
                      cursor: "pointer",
                    }}
                  >
                    <span aria-hidden style={{ width: 8, height: 8, borderRadius: "50%", background: meta.color, flexShrink: 0 }} />
                    <span style={{ flex: 1 }}>{label}</span>
                    {selected && (
                      <svg width="11" height="11" viewBox="0 0 12 12" fill="none" aria-hidden="true">
                        <path d="M2 6.4 4.5 8.8 10 3.6" stroke={meta.color} strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round" />
                      </svg>
                    )}
                  </button>
                );
              })}
            </div>,
            document.body,
          )
        : null}
    </>
  );
}

// Picker de priorité manuel. La priorité affichée peut être haussée
// automatiquement à "haute" lorsque l'échéance est aujourd'hui ou dépassée,
// via deriveTaskDisplayPriority — la
// valeur "manuelle" stockée dans task.priority reste celle choisie par
// l'utilisateur, ce qui permet de revenir à la priorité initiale dès
// que l'urgence retombe.
function TaskPriorityInlinePicker({
  task,
  onPickPriority,
}: {
  task: Task;
  onPickPriority: (priority: ProjectPriority) => void;
}) {
  const { open, triggerRect, triggerRef, menuRef, toggle, close } = useInlinePickerMenu();
  const manual = task.priority ?? "medium";
  const displayed = deriveTaskDisplayPriority(task);
  const visual = priorityVisuals[displayed];
  const isAutoEscalated = displayed !== manual;

  return (
    <>
      <button
        ref={triggerRef}
        type="button"
        data-no-task-expand="true"
        onClick={(event) => {
          event.stopPropagation();
          toggle();
        }}
        title={
          isAutoEscalated
            ? `Priorité haussée automatiquement (manuelle : ${priorityVisuals[manual].label}). Échéance aujourd'hui ou dépassée.`
            : "Changer la priorité"
        }
        className="mb-badge"
        style={{
          display: "inline-flex",
          alignItems: "center",
          gap: 6,
          height: 22,
          padding: "0 9px",
          borderRadius: 999,
          fontSize: 10.5,
          fontWeight: 500,
          color: text.secondary,
          background: surface.s2,
          border: `1px solid ${surface.borderSubtle}`,
          cursor: "pointer",
          letterSpacing: 0,
        }}
      >
        <span aria-hidden style={{ width: 7, height: 7, borderRadius: "50%", background: visual.text, flexShrink: 0 }} />
        <span style={{ whiteSpace: "nowrap" }}>{visual.label}</span>
        {isAutoEscalated && (
          <span
            aria-hidden
            title="Bump auto échéance"
            style={{ fontSize: 9, opacity: 0.7 }}
          >
            ⚡
          </span>
        )}
        <svg width="9" height="9" viewBox="0 0 12 12" fill="none" aria-hidden="true" style={{ opacity: 0.55 }}>
          <path d="M3 4.5 6 7.5 9 4.5" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round" />
        </svg>
      </button>
      {open && triggerRect && typeof document !== "undefined"
        ? createPortal(
            <div
              ref={menuRef}
              role="listbox"
              data-no-task-expand="true"
              onClick={(event) => event.stopPropagation()}
              style={{
                position: "fixed",
                top: triggerRect.bottom + 4,
                left: Math.max(8, triggerRect.right - 180),
                zIndex: 9999,
                minWidth: 180,
                padding: 6,
                background: surface.s1,
                border: `1px solid ${surface.border}`,
                borderRadius: 12,
                boxShadow: "var(--mb-shadow-md)",
                display: "flex",
                flexDirection: "column",
                gap: 1,
              }}
            >
              {TASK_PRIORITY_OPTIONS.map((option) => {
                const v = priorityVisuals[option];
                const selected = option === manual;
                return (
                  <button
                    key={option}
                    type="button"
                    onClick={(event) => {
                      event.stopPropagation();
                      close();
                      onPickPriority(option);
                    }}
                    className="flex items-center gap-2 rounded-lg px-2 py-1.5 text-left"
                    style={{
                      background: selected ? surface.s2 : "transparent",
                      border: "none",
                      color: text.secondary,
                      fontSize: 11.5,
                      fontWeight: 500,
                      cursor: "pointer",
                    }}
                  >
                    <span aria-hidden style={{ width: 8, height: 8, borderRadius: "50%", background: v.text, flexShrink: 0 }} />
                    <span style={{ flex: 1 }}>{v.label}</span>
                    {selected && (
                      <svg width="11" height="11" viewBox="0 0 12 12" fill="none" aria-hidden="true">
                        <path d="M2 6.4 4.5 8.8 10 3.6" stroke={v.text} strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round" />
                      </svg>
                    )}
                  </button>
                );
              })}
              {isAutoEscalated && (
                <p
                  style={{
                    margin: "6px 4px 2px",
                    fontSize: 10,
                    color: text.muted,
                    lineHeight: 1.4,
                  }}
                >
                  L'échéance est aujourd'hui ou dépassée : la priorité est automatiquement haussée. La valeur manuelle reste {priorityVisuals[manual].label.toLowerCase()}.
                </p>
              )}
            </div>,
            document.body,
          )
        : null}
    </>
  );
}

function formatTaskScheduleLabel(task: Task) {
  if (!task.dueDate) return "Planifier";
  return formatScheduleParts(task.dueDate, task.dueTime);
}

function formatScheduleParts(dueDate: string, dueTime?: string) {
  return formatTaskScheduleDate(dueDate, dueTime);
}

function PriorityControl({
  value,
  onChange,
  label,
  compact = false,
  dotOnly = false,
}: {
  value: ProjectPriority;
  onChange: (priority: ProjectPriority) => void;
  label: string;
  compact?: boolean;
  dotOnly?: boolean;
}) {
  const [isOpen, setIsOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);
  const triggerRef = useRef<HTMLButtonElement>(null);
  const panelRef = useRef<HTMLDivElement>(null);
  const [panelPosition, setPanelPosition] = useState<{ top: number; left: number } | null>(null);
  const visual = priorityVisuals[value];
  const panelWidth = 148;

  function updatePanelPosition() {
    const rect = triggerRef.current?.getBoundingClientRect();
    if (!rect) return;

    const left = Math.min(Math.max(12, rect.right - panelWidth), window.innerWidth - panelWidth - 12);
    setPanelPosition({ top: rect.bottom + 8, left });
  }

  useEffect(() => {
    function handleClick(event: MouseEvent) {
      const target = event.target as Node;
      const insideTrigger = triggerRef.current?.contains(target);
      const insidePanel = panelRef.current?.contains(target);
      if (ref.current && !ref.current.contains(target) && !insideTrigger && !insidePanel) {
        setIsOpen(false);
      }
    }

    document.addEventListener("mousedown", handleClick);
    return () => document.removeEventListener("mousedown", handleClick);
  }, []);

  useEffect(() => {
    if (!isOpen) return;

    updatePanelPosition();
    window.addEventListener("resize", updatePanelPosition);
    window.addEventListener("scroll", updatePanelPosition, true);

    return () => {
      window.removeEventListener("resize", updatePanelPosition);
      window.removeEventListener("scroll", updatePanelPosition, true);
    };
  }, [isOpen]);

  return (
    <div ref={ref} style={{ position: "relative" }}>
      {dotOnly ? (
        <button
          ref={triggerRef}
          type="button"
          onClick={() =>
            setIsOpen((current) => {
              const next = !current;
              if (next) requestAnimationFrame(updatePanelPosition);
              return next;
            })
          }
          className="flex items-center justify-center rounded-full"
          style={{ width: 10, height: 10, background: visual.text, flexShrink: 0 }}
          title={`${label} · ${visual.label}`}
        />
      ) : (
      <button
        ref={triggerRef}
        type="button"
        onClick={() =>
          setIsOpen((current) => {
            const next = !current;
            if (next) requestAnimationFrame(updatePanelPosition);
            return next;
          })
        }
        className="flex items-center gap-1.5 rounded-lg font-medium"
        style={{
          padding: compact ? "0.2rem 0.4rem" : "0.35rem 0.55rem",
          fontSize: compact ? 10 : 11,
          lineHeight: 1,
          background: visual.bg,
          color: visual.text,
          border: `1px solid ${visual.text}`,
        }}
        title={label}
      >
        <span
          style={{
            width: compact ? 6 : 7,
            height: compact ? 6 : 7,
            borderRadius: "50%",
            background: visual.text,
            flexShrink: 0,
            display: "inline-block",
          }}
        />
        {visual.label}
        <svg width="8" height="8" viewBox="0 0 16 16" fill="none">
          <path d="M4 6l4 4 4-4" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round" />
        </svg>
      </button>
      )}
      {isOpen && panelPosition && typeof document !== "undefined" && createPortal(
        <div
          ref={panelRef}
          className="rounded-xl overflow-hidden"
          style={{
            position: "fixed",
            top: panelPosition.top,
            left: panelPosition.left,
            zIndex: 1000,
            background: surface.s1,
            border: `1px solid ${surface.border}`,
            minWidth: panelWidth,
            boxShadow: `0 18px 0 -17px ${surface.borderHover}`,
          }}
        >
          {PROJECT_PRIORITY_OPTIONS.map((option) => {
            const optionVisual = priorityVisuals[option.value];
            const selected = option.value === value;

            return (
              <button
                key={option.value}
                type="button"
                onClick={() => {
                  setIsOpen(false);
                  onChange(option.value);
                }}
                className="w-full flex items-center gap-2.5 px-3 py-2.5 text-xs text-left"
                style={{
                  color: selected ? optionVisual.text : text.secondary,
                  background: selected ? optionVisual.bg : surface.s1,
                  fontWeight: selected ? 600 : 400,
                }}
              >
                <span className="w-1.5 h-1.5 rounded-full shrink-0" style={{ background: optionVisual.text }} />
                {option.label}
                {selected && (
                  <svg width="10" height="10" viewBox="0 0 16 16" fill="none" style={{ marginLeft: "auto" }}>
                    <path d="M3 8l4 4 6-6" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" />
                  </svg>
                )}
              </button>
            );
          })}
        </div>
      , document.body)}
    </div>
  );
}

function InlineActionButton({
  label,
  onClick,
  tone = "default",
  compact = false,
}: {
  label: string;
  onClick: () => void;
  tone?: "default" | "danger";
  compact?: boolean;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className="rounded-lg font-medium flex items-center justify-center"
      aria-label={label}
      title={label}
      style={{
        width: compact ? 24 : 28,
        height: compact ? 22 : 26,
        padding: 0,
        fontSize: compact ? 10 : 11,
        lineHeight: 1,
        background: surface.s1,
        color: tone === "danger" ? errorTokens.text : text.muted,
        border: `1px solid ${tone === "danger" ? errorTokens.border : surface.border}`,
      }}
    >
      {tone === "danger" ? (
        <svg width={compact ? "11" : "12"} height={compact ? "11" : "12"} viewBox="0 0 16 16" fill="none" aria-hidden="true">
          <path d="M3 5h10M6 5V3.5A.5.5 0 0 1 6.5 3h3a.5.5 0 0 1 .5.5V5M6.5 7.5v4M9.5 7.5v4" stroke="currentColor" strokeWidth="1.4" strokeLinecap="round" strokeLinejoin="round" />
          <path d="M4.5 5.5 5 13h6l.5-7.5" stroke="currentColor" strokeWidth="1.4" strokeLinecap="round" strokeLinejoin="round" />
        </svg>
      ) : (
        <svg width={compact ? "11" : "12"} height={compact ? "11" : "12"} viewBox="0 0 16 16" fill="none" aria-hidden="true">
          <path d="M9.8 3.2 12.8 6.2M3.5 12.5l2.7-.6 6.1-6.1a1.4 1.4 0 0 0-2-2L4.2 9.9l-.7 2.6Z" stroke="currentColor" strokeWidth="1.4" strokeLinecap="round" strokeLinejoin="round" />
        </svg>
      )}
    </button>
  );
}

function InlineDeleteConfirm({
  onConfirm,
  onCancel,
  compact = false,
}: {
  onConfirm: () => void;
  onCancel: () => void;
  compact?: boolean;
}) {
  return (
    <div
      className={`flex items-center rounded-lg overflow-hidden whitespace-nowrap ${compact ? "absolute right-0 top-1/2 z-30 -translate-y-1/2" : ""}`}
      data-no-task-expand="true"
      onClick={(event) => event.stopPropagation()}
      onMouseDown={(event) => event.stopPropagation()}
      style={{
        background: surface.s1,
        border: `1px solid ${errorTokens.border}`,
        boxShadow: compact ? "var(--mb-shadow-card)" : "none",
      }}
    >
      <span
        className="font-medium shrink-0"
        style={{
          padding: compact ? "0 0.5rem" : "0 0.55rem",
          fontSize: compact ? 9.5 : 11,
          color: errorTokens.text,
        }}
      >
        Confirmer ?
      </span>
      <button
        type="button"
        onClick={onConfirm}
        className="font-semibold"
        style={{
          padding: compact ? "0.32rem 0.5rem" : "0.4rem 0.55rem",
          fontSize: compact ? 9.5 : 11,
          background: errorTokens.text,
          color: "#FFFFFF",
        }}
      >
        Oui
      </button>
      <button
        type="button"
        onClick={onCancel}
        style={{
          padding: compact ? "0.32rem 0.5rem" : "0.4rem 0.55rem",
          fontSize: compact ? 9.5 : 11,
          background: surface.s1,
          color: text.muted,
        }}
      >
        Non
      </button>
    </div>
  );
}

function AddStepForm({ projectId, workspace }: { projectId: string; workspace: Workspace }) {
  const [isOpen, setIsOpen] = useState(false);
  const theme = workspaceTheme[workspace];

  if (!isOpen) {
    return (
      <button
        type="button"
        onClick={() => setIsOpen(true)}
        className="self-start rounded-xl px-3.5 py-2 text-[11.5px] font-semibold flex items-center justify-center gap-1.5"
        style={{
          background: theme.accent,
          color: "#FFFFFF",
          border: "none",
          cursor: "pointer",
          boxShadow: `0 6px 16px -10px ${theme.accent}`,
        }}
      >
        <svg width="10" height="10" viewBox="0 0 16 16" fill="none">
          <path d="M8 3.5v9M3.5 8h9" stroke="currentColor" strokeWidth="1.9" strokeLinecap="round" />
        </svg>
        Ajouter une étape
      </button>
    );
  }

  return (
    <form
      action={addStepToProjectAction}
      className="rounded-xl p-3"
      style={{ background: surface.s2, border: `1px dashed ${surface.border}` }}
    >
      <input type="hidden" name="projectId" value={projectId} />
      <input type="hidden" name="workspace" value={workspace} />
      <div className="flex items-center justify-between gap-3 mb-2">
        <p className="text-xs font-semibold" style={{ color: text.primary }}>
          Nouvelle étape
        </p>
        <button
          type="button"
          onClick={() => setIsOpen(false)}
          className="text-[11px] font-medium"
          style={{ color: text.dim }}
        >
          Annuler
        </button>
      </div>
      <div className="grid gap-2" style={{ gridTemplateColumns: "minmax(0, 1.4fr) minmax(0, 0.8fr)" }}>
        <input name="title" required placeholder="Nom de l'étape" className="rounded-lg px-3 py-2 text-xs outline-none" style={{ background: surface.s1, color: text.primary, border: `1px solid ${surface.border}` }} />
        <select name="priority" defaultValue="medium" className="rounded-lg px-3 py-2 text-xs outline-none" style={{ background: surface.s1, color: text.primary, border: `1px solid ${surface.border}` }}>
          <option value="low">Priorité faible</option>
          <option value="medium">Priorité moyenne</option>
          <option value="high">Priorité haute</option>
        </select>
      </div>
      <textarea name="description" placeholder="Détail optionnel" rows={2} className="mt-2 w-full rounded-lg px-3 py-2 text-xs outline-none resize-none" style={{ background: surface.s1, color: text.primary, border: `1px solid ${surface.border}` }} />
      <button type="submit" className="mt-2 rounded-lg px-3 py-2 text-xs font-semibold" style={{ background: theme.accent, color: "#FFFFFF", border: "none" }}>
        Créer l&apos;étape
      </button>
    </form>
  );
}

function AddTaskForm({ projectId, workspace, stepId }: { projectId: string; workspace: Workspace; stepId: string }) {
  const [isOpen, setIsOpen] = useState(false);
  const theme = workspaceTheme[workspace];

  return (
    <>
      <button
        type="button"
        onClick={() => setIsOpen(true)}
        className="self-start rounded-lg px-3 py-1.5 text-[11px] font-semibold flex items-center justify-center gap-1.5"
        style={{
          background: theme.accent,
          color: "#FFFFFF",
          border: "none",
          cursor: "pointer",
          boxShadow: `0 5px 14px -10px ${theme.accent}`,
        }}
      >
        <svg width="9" height="9" viewBox="0 0 16 16" fill="none">
          <path d="M8 3.5v9M3.5 8h9" stroke="currentColor" strokeWidth="1.9" strokeLinecap="round" />
        </svg>
        Ajouter une tâche
      </button>
      {isOpen && (
        <CreateTaskDrawer
          open={isOpen}
          onClose={() => setIsOpen(false)}
          projectId={projectId}
          workspace={workspace}
          stepId={stepId}
        />
      )}
    </>
  );
}

function CreateTaskDrawer({
  open,
  onClose,
  projectId,
  workspace,
  stepId,
}: {
  open: boolean;
  onClose: () => void;
  projectId: string;
  workspace: Workspace;
  stepId: string;
}) {
  const theme = workspaceTheme[workspace];
  const [activePanel, setActivePanel] = useState<"checklist" | "date" | "person" | "files" | "note" | null>(null);
  const [dueDate, setDueDate] = useState("");
  const [dueTime, setDueTime] = useState("");
  const [owner, setOwner] = useState("");
  const [checklistText, setChecklistText] = useState("");
  const [commentsText, setCommentsText] = useState("");
  const [draftChecklistLabel, setDraftChecklistLabel] = useState("");

  if (!open || typeof document === "undefined") return null;

  const checklistItems = checklistText.split(/\r?\n/).map((item) => item.trim()).filter(Boolean);
  const notes = commentsText.split(/\r?\n/).map((item) => item.trim()).filter(Boolean);
  const checklistCount = checklistItems.length;
  const noteCount = notes.length;

  function updateChecklistItems(nextItems: string[]) {
    setChecklistText(nextItems.map((item) => item.trim()).filter(Boolean).join("\n"));
  }

  function addCreateChecklistItem(event: FormEvent) {
    event.preventDefault();
    const cleaned = draftChecklistLabel.trim();
    if (!cleaned) return;
    updateChecklistItems([...checklistItems, cleaned]);
    setDraftChecklistLabel("");
    setActivePanel(null);
  }

  function updateCreateChecklistItem(index: number, value: string) {
    const cleaned = value.trim();
    if (!cleaned) {
      deleteCreateChecklistItem(index);
      return;
    }
    updateChecklistItems(checklistItems.map((item, itemIndex) => (itemIndex === index ? cleaned : item)));
  }

  function deleteCreateChecklistItem(index: number) {
    updateChecklistItems(checklistItems.filter((_, itemIndex) => itemIndex !== index));
  }

  function clearCreateSchedule() {
    setDueDate("");
    setDueTime("");
  }

  function clearCreateOwner() {
    setOwner("");
  }

  function clearCreateComments() {
    setCommentsText("");
  }

  return createPortal(
    <>
      <div
        onClick={onClose}
        className="mb-modal-backdrop"
        style={{
          position: "fixed",
          inset: 0,
          zIndex: 40,
        }}
      />
      <aside
        role="dialog"
        aria-modal="true"
        aria-label="Créer une tâche"
        className="mb-modal-surface mb-edge-drawer"
        style={{
          position: "fixed",
          top: 0,
          right: 0,
          height: "100dvh",
          width: "min(560px, 100vw)",
          zIndex: 50,
          display: "flex",
          flexDirection: "column",
        }}
      >
        <form action={addTaskToStepAction} className="flex h-full flex-col">
          <input type="hidden" name="projectId" value={projectId} />
          <input type="hidden" name="workspace" value={workspace} />
          <input type="hidden" name="stepId" value={stepId} />
          <input type="hidden" name="dueDate" value={dueDate} />
          <input type="hidden" name="dueTime" value={dueTime} />
          <input type="hidden" name="owner" value={owner} />
          <input type="hidden" name="checklistText" value={checklistText} />
          <input type="hidden" name="commentsText" value={commentsText} />

          <header
            className="flex items-start justify-between gap-3 px-5 py-4"
            style={{ background: surface.s1, borderBottom: `1px solid ${surface.borderSubtle}` }}
          >
            <div className="min-w-0 flex-1">
              <p className="text-[10px] font-semibold uppercase tracking-[0.16em]" style={{ color: text.muted }}>
                Nouvelle tâche
              </p>
              <textarea
                name="title"
                required
                placeholder="Titre de la tâche"
                rows={2}
                onKeyDown={(event) => {
                  if (event.key === "Enter") event.preventDefault();
                }}
                className="mt-1 w-full resize-none overflow-hidden bg-transparent text-base font-semibold leading-snug outline-none"
                style={{
                  color: text.primary,
                  border: "none",
                  minHeight: "3.25rem",
                  whiteSpace: "pre-wrap",
                }}
              />
              <div className="mt-2 flex flex-wrap gap-1.5">
                <select
                  name="priority"
                  defaultValue="medium"
                  className="rounded-full px-2 py-0.5 text-[10px] font-semibold outline-none"
                  style={{ background: surface.s2, color: text.secondary, border: `1px solid ${surface.borderSubtle}` }}
                >
                  {PROJECT_PRIORITY_OPTIONS.map((option) => (
                    <option key={option.value} value={option.value}>
                      Priorité {option.label.toLowerCase()}
                    </option>
                  ))}
                </select>
                {dueDate && <TaskMetaTag label={`Date prévue · ${formatScheduleParts(dueDate, dueTime)}`} />}
                {owner.trim() && <TaskMetaTag label={owner.trim()} />}
              </div>
            </div>
            <button
              type="button"
              onClick={onClose}
              className="rounded-lg p-2 shrink-0"
              style={{ background: surface.s2, color: text.secondary, border: `1px solid ${surface.border}`, cursor: "pointer" }}
              title="Fermer"
            >
              <svg width="14" height="14" viewBox="0 0 16 16" fill="none">
                <path d="m4 4 8 8M12 4l-8 8" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" />
              </svg>
            </button>
          </header>

          <div className="flex-1 overflow-y-auto px-5 py-5 space-y-3">
            <CreateTaskSection title="Attendu" description="L'action concrète à mener pour faire avancer la tâche.">
              <textarea
                name="expected"
                rows={3}
                placeholder="Ex : faire réviser le véhicule, comparer les devis, réserver l'hébergement..."
                style={{ ...drawerFieldStyle(), resize: "vertical" }}
              />
            </CreateTaskSection>

            <CreateTaskSection title="Réalisation" description="Ce qui a réellement été fait ou validé.">
              <textarea
                name="realization"
                rows={4}
                placeholder="Ce qui a été fait concrètement."
                style={{ ...drawerFieldStyle(), resize: "vertical" }}
              />
            </CreateTaskSection>

            <div className="rounded-2xl p-3" style={{ background: surface.s1, border: `1px solid ${surface.borderSubtle}` }}>
              <p className="text-[11px] font-semibold uppercase tracking-[0.14em] mb-2" style={{ color: text.muted }}>
                Actions secondaires
              </p>
              <div className="grid grid-cols-2 gap-2 sm:grid-cols-3">
                <CreateTaskSecondaryAction
                  label={checklistCount === 0 ? "Ajouter checklist" : `Checklist ${checklistCount}`}
                  active={activePanel === "checklist"}
                  onClick={() => setActivePanel(activePanel === "checklist" ? null : "checklist")}
                  accentColor={theme.accent}
                />
                <CreateTaskSecondaryAction
                  label={dueDate ? formatScheduleParts(dueDate, dueTime) : "Date prévue"}
                  active={activePanel === "date"}
                  onClick={() => setActivePanel(activePanel === "date" ? null : "date")}
                  accentColor={theme.accent}
                />
                <CreateTaskSecondaryAction
                  label={owner.trim() || "Associer à une personne"}
                  active={activePanel === "person"}
                  onClick={() => setActivePanel(activePanel === "person" ? null : "person")}
                  accentColor={theme.accent}
                />
                <CreateTaskSecondaryAction
                  label="Fichiers"
                  active={activePanel === "files"}
                  onClick={() => setActivePanel(activePanel === "files" ? null : "files")}
                  accentColor={theme.accent}
                />
                <CreateTaskSecondaryAction
                  label={noteCount > 0 ? `Note ${noteCount}` : "Note"}
                  active={activePanel === "note"}
                  onClick={() => setActivePanel(activePanel === "note" ? null : "note")}
                  accentColor={theme.accent}
                />
              </div>

              {(checklistCount > 0 || dueDate || owner.trim() || noteCount > 0) && (
                <div className="mt-3 space-y-2">
                  {checklistCount > 0 && (
                    <CreateTaskSecondaryField title={`Checklist (${checklistCount})`}>
                      <div className="space-y-1.5">
                        {checklistItems.map((item, index) => (
                          <div
                            key={`${item}-${index}`}
                            className="grid gap-2 rounded-xl px-2.5 py-2 sm:grid-cols-[1fr_auto]"
                            style={{ background: surface.s2, border: `1px solid ${surface.borderSubtle}` }}
                          >
                            <input
                              defaultValue={item}
                              onBlur={(event) => updateCreateChecklistItem(index, event.target.value)}
                              className="min-w-0 bg-transparent text-[12px] outline-none"
                              style={{ color: text.primary, border: "none" }}
                            />
                            <CreateTaskIconButton title="Supprimer l'élément" onClick={() => deleteCreateChecklistItem(index)} />
                          </div>
                        ))}
                      </div>
                    </CreateTaskSecondaryField>
                  )}

                  {dueDate && (
                    <CreateTaskSecondaryField title="Date prévue">
                      <div className="grid gap-2 sm:grid-cols-[1fr_0.7fr_auto]">
                        <input
                          type="date"
                          value={dueDate}
                          onChange={(event) => setDueDate(event.target.value)}
                          style={{ ...drawerFieldStyle(), padding: "0.55rem 0.75rem", fontSize: "0.8rem" }}
                        />
                        <input
                          type="time"
                          value={dueTime}
                          onChange={(event) => setDueTime(event.target.value)}
                          style={{ ...drawerFieldStyle(), padding: "0.55rem 0.75rem", fontSize: "0.8rem" }}
                        />
                        <CreateTaskIconButton title="Supprimer la date" onClick={clearCreateSchedule} />
                      </div>
                    </CreateTaskSecondaryField>
                  )}

                  {owner.trim() && (
                    <CreateTaskSecondaryField title="Personne associée">
                      <div className="grid gap-2 sm:grid-cols-[1fr_auto]">
                        <input
                          value={owner}
                          onChange={(event) => setOwner(event.target.value)}
                          style={{ ...drawerFieldStyle(), padding: "0.55rem 0.75rem", fontSize: "0.8rem" }}
                        />
                        <CreateTaskIconButton title="Supprimer la personne associée" onClick={clearCreateOwner} />
                      </div>
                    </CreateTaskSecondaryField>
                  )}

                  {noteCount > 0 && (
                    <CreateTaskSecondaryField title="Note">
                      <div className="grid gap-2 sm:grid-cols-[1fr_auto]">
                        <textarea
                          value={commentsText}
                          onChange={(event) => setCommentsText(event.target.value)}
                          rows={Math.min(4, Math.max(2, noteCount))}
                          style={{ ...drawerFieldStyle(), padding: "0.65rem 0.75rem", fontSize: "0.8rem", resize: "vertical" }}
                        />
                        <CreateTaskIconButton title="Supprimer la note" onClick={clearCreateComments} />
                      </div>
                    </CreateTaskSecondaryField>
                  )}
                </div>
              )}

              {activePanel === "checklist" && (
                <CreateTaskPanel title="Checklist" description="Une ligne par élément à valider.">
                  <form onSubmit={addCreateChecklistItem} className="mt-2 flex items-center gap-2">
                    <input
                      value={draftChecklistLabel}
                      onChange={(event) => setDraftChecklistLabel(event.target.value)}
                      placeholder="Nouvel élément de checklist"
                      style={drawerFieldStyle()}
                    />
                    <button
                      type="submit"
                      className="shrink-0 rounded-lg px-3 py-2 text-[11px] font-semibold"
                      style={{ background: theme.accent, color: "#FFFFFF", border: "none", cursor: "pointer" }}
                    >
                      Valider
                    </button>
                  </form>
                </CreateTaskPanel>
              )}

              {activePanel === "date" && (
                <CreateTaskPanel title="Date prévue" description="Planifie l'échéance directement dans la tâche.">
                  <div className="grid gap-2 sm:grid-cols-[1fr_0.7fr]">
                    <input type="date" value={dueDate} onChange={(event) => setDueDate(event.target.value)} style={drawerFieldStyle()} />
                    <input type="time" value={dueTime} onChange={(event) => setDueTime(event.target.value)} style={drawerFieldStyle()} />
                  </div>
                  <div className="mt-2 flex justify-end">
                    <button
                      type="button"
                      onClick={() => setActivePanel(null)}
                      className="rounded-lg px-3 py-2 text-[11px] font-semibold"
                      style={{ background: theme.accent, color: "#FFFFFF", border: "none", cursor: "pointer" }}
                    >
                      Valider
                    </button>
                  </div>
                </CreateTaskPanel>
              )}

              {activePanel === "person" && (
                <CreateTaskPanel title="Personne associée" description="Renseigne un responsable uniquement si c'est utile.">
                  <input
                    value={owner}
                    onChange={(event) => setOwner(event.target.value)}
                    placeholder="Associer à une personne"
                    style={drawerFieldStyle()}
                  />
                  <div className="mt-2 flex justify-end">
                    <button
                      type="button"
                      onClick={() => setActivePanel(null)}
                      className="rounded-lg px-3 py-2 text-[11px] font-semibold"
                      style={{ background: theme.accent, color: "#FFFFFF", border: "none", cursor: "pointer" }}
                    >
                      Valider
                    </button>
                  </div>
                </CreateTaskPanel>
              )}

              {activePanel === "files" && (
                <CreateTaskPanel title="Fichiers" description="Les pièces liées à la tâche seront affichées ici.">
                  <p className="text-[12px]" style={{ color: text.muted }}>
                    L&apos;ajout de fichiers directement sur une tâche sera relié au stockage projet.
                  </p>
                </CreateTaskPanel>
              )}

              {activePanel === "note" && (
                <CreateTaskPanel title="Note" description="Une ligne par note à conserver avec la tâche.">
                  <textarea
                    value={commentsText}
                    onChange={(event) => setCommentsText(event.target.value)}
                    rows={3}
                    placeholder="Note utile, précision, trace de décision..."
                    style={{ ...drawerFieldStyle(), resize: "vertical" }}
                  />
                  <div className="mt-2 flex justify-end">
                    <button
                      type="button"
                      onClick={() => setActivePanel(null)}
                      className="rounded-lg px-3 py-2 text-[11px] font-semibold"
                      style={{ background: theme.accent, color: "#FFFFFF", border: "none", cursor: "pointer" }}
                    >
                      Valider
                    </button>
                  </div>
                </CreateTaskPanel>
              )}
            </div>
          </div>

          <footer className="px-5 py-4 flex items-center justify-end gap-2" style={{ background: surface.s1, borderTop: `1px solid ${surface.borderSubtle}` }}>
            <button type="button" onClick={onClose} className="rounded-lg px-3 py-2 text-xs font-semibold" style={{ background: surface.s2, color: text.muted, border: `1px solid ${surface.border}`, cursor: "pointer" }}>
              Annuler
            </button>
            <button type="submit" className="rounded-lg px-3 py-2 text-xs font-semibold" style={{ background: theme.accent, color: "#FFFFFF", border: "none", cursor: "pointer" }}>
              Créer la tâche
            </button>
          </footer>
        </form>
      </aside>
    </>,
    document.body,
  );
}

function CreateTaskSection({
  title,
  description,
  children,
}: {
  title: string;
  description: string;
  children: ReactNode;
}) {
  return (
    <section className="rounded-2xl p-4" style={{ background: surface.s1, border: `1px solid ${surface.borderSubtle}` }}>
      <p className="text-[11px] font-semibold uppercase tracking-[0.14em]" style={{ color: text.muted }}>
        {title}
      </p>
      <p className="text-[11px] mt-0.5 mb-2" style={{ color: text.dim }}>
        {description}
      </p>
      {children}
    </section>
  );
}

function CreateTaskSecondaryAction({
  label,
  active,
  accentColor,
  onClick,
}: {
  label: string;
  active: boolean;
  accentColor: string;
  onClick: () => void;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className="min-h-[50px] min-w-0 rounded-xl px-2.5 py-2 text-center text-[11px] font-semibold leading-tight inline-flex items-center justify-center"
      style={{
        background: active ? accentColor : surface.s2,
        color: active ? "#FFFFFF" : text.secondary,
        border: `1px solid ${surface.borderSubtle}`,
        cursor: "pointer",
      }}
    >
      <span className="min-w-0 whitespace-normal break-words leading-tight">{label}</span>
    </button>
  );
}

function CreateTaskSecondaryField({ title, children }: { title: string; children: ReactNode }) {
  return (
    <div className="rounded-xl p-2.5" style={{ background: surface.s2, border: `1px solid ${surface.borderSubtle}` }}>
      <p className="mb-1.5 text-[10px] font-semibold uppercase tracking-[0.12em]" style={{ color: text.muted }}>
        {title}
      </p>
      {children}
    </div>
  );
}

function CreateTaskIconButton({ title, onClick }: { title: string; onClick: () => void }) {
  return (
    <button
      type="button"
      title={title}
      onClick={onClick}
      className="flex h-8 w-8 items-center justify-center rounded-lg"
      style={{
        background: surface.s1,
        color: deleteTone.text,
        border: `1px solid ${deleteTone.border}`,
        cursor: "pointer",
      }}
    >
      <TrashIcon size={13} />
    </button>
  );
}

function CreateTaskPanel({
  title,
  description,
  children,
}: {
  title: string;
  description: string;
  children: ReactNode;
}) {
  return (
    <div className="mt-3 rounded-xl p-3" style={{ background: surface.s2, border: `1px solid ${surface.borderSubtle}` }}>
      <p className="text-[12px] font-semibold" style={{ color: text.primary }}>
        {title}
      </p>
      <p className="text-[11px] mt-0.5 mb-2" style={{ color: text.dim }}>
        {description}
      </p>
      {children}
    </div>
  );
}

function drawerFieldStyle(): CSSProperties {
  return {
    width: "100%",
    borderRadius: "0.8rem",
    border: `1px solid ${surface.borderSubtle}`,
    background: surface.s2,
    color: text.primary,
    fontSize: "0.82rem",
    padding: "0.7rem 0.8rem",
    outline: "none",
  };
}
