"use client";

import Link from "next/link";
import { useEffect, useRef, useState, useTransition } from "react";
import { createPortal } from "react-dom";
import { useRouter } from "next/navigation";
import { updateTaskAction } from "@/app/dashboard/projects/[id]/actions";
import { TaskDetailLauncher } from "@/components/projects/task-detail-launcher";
import { TaskChangeDetailDialog } from "@/components/tasks/task-change-detail-dialog";
import { formatShortDate } from "@/lib/date-format";
import { statusColor, surface, text, error as errorTokens } from "@/lib/design-tokens";
import type { Project, TaskStatus } from "@/lib/mock-data";
import type { FlattenedProjectTask } from "@/lib/project-insights";
import { deriveTaskDisplayPriority, deriveTaskStatus } from "@/lib/project-plan";
import { priorityVisuals, type ProjectPriority } from "@/lib/project-taxonomy";
import { useIsTouchDevice } from "@/lib/use-touch-device";
import { useCardDrag, DragGhost, useLongPressDrag } from "@/lib/use-card-drag";
import { workspaceTheme, type Workspace } from "@/lib/workspace";

type TaskSort = "due" | "priority";
type TaskStatusFilter = "open" | "all" | TaskStatus;
type PriorityFilter = "all" | ProjectPriority;
type TasksView = "list" | "kanban" | "calendar";
type TaskItem = { project: Project; entry: FlattenedProjectTask };

const defaultStatusColor: Record<TaskStatus, { bg: string; text: string }> = {
  todo: { bg: statusColor.gray.bg, text: statusColor.gray.text },
  in_progress: { bg: statusColor.yellow.bg, text: statusColor.yellow.text },
  waiting: { bg: statusColor.blue.bg, text: statusColor.blue.text },
  blocked: { bg: errorTokens.bg, text: errorTokens.text },
  done: { bg: statusColor.green.bg, text: statusColor.green.text },
};

export function TasksCalendarBoard({
  tasks,
  workspace,
  view,
  sort,
  statusFilter,
  priorityFilter = "all",
  month,
  projectId,
  stepId = "all",
  basePath = "/dashboard/calendar",
}: {
  tasks: TaskItem[];
  workspace: Workspace;
  view: TasksView;
  sort: TaskSort;
  statusFilter: TaskStatusFilter;
  priorityFilter?: PriorityFilter;
  month: string;
  projectId: string;
  stepId?: string;
  /** Base URL for prev/next month navigation links. Defaults to /dashboard/calendar. */
  basePath?: string;
}) {
  const router = useRouter();
  const [, startTransition] = useTransition();
  const [draggingKey, setDraggingKey] = useState<string | null>(null);
  const [dragOverDate, setDragOverDate] = useState<string | null>(null);
  // Quand une cellule a plusieurs tâches : un premier tap sur la carte
  // preview "éclate" toutes les tâches du jour pour qu'on puisse choisir.
  const [expandedDate, setExpandedDate] = useState<string | null>(null);
  // Tâche actuellement ouverte dans un drawer contrôlé. On lifte le state ici
  // (plutôt que dans chaque CalendarTaskCard) pour qu'une tâche cliquée
  // depuis la modal "liste du jour" survive à la fermeture de cette modal —
  // sinon le portail React du drawer serait démonté avec sa source.
  const [openTaskItem, setOpenTaskItem] = useState<TaskItem | null>(null);
  const [dateOverrides, setDateOverrides] = useState<Record<string, string>>({});
  const [pendingDateChange, setPendingDateChange] = useState<{ item: TaskItem; date: string } | null>(null);
  const monthStart = parseMonth(month);
  const cells = buildCalendarCells(monthStart);
  const previousMonth = addMonths(monthStart, -1);
  const nextMonth = addMonths(monthStart, 1);
  const todayKey = formatDateKey(new Date());
  const workspaceAccent = workspaceTheme[workspace].accent;

  const visibleTasks = tasks.map((item) => ({
    ...item,
    dueDate: dateOverrides[getTaskKey(item)] ?? item.entry.task.dueDate,
  }));

  const tasksByDate = visibleTasks.reduce<Record<string, Array<TaskItem & { dueDate?: string }>>>((acc, item) => {
    if (!item.dueDate) return acc;
    acc[item.dueDate] = [...(acc[item.dueDate] ?? []), item];
    return acc;
  }, {});
  const unplannedTasks = visibleTasks
    .filter((item) => !item.dueDate)
    .sort(sortUnplannedTasks);

  const monthPaneRef = useRef<HTMLDivElement>(null);

  function handleDrop(targetDate: string) {
    if (!draggingKey) return;
    const item = visibleTasks.find((candidate) => getTaskKey(candidate) === draggingKey);
    setDraggingKey(null);
    setDragOverDate(null);
    if (!item || item.dueDate === targetDate) return;
    setPendingDateChange({ item, date: targetDate });
  }

  // Drag tactile (poignée) : aperçu flottant qui suit le doigt + surlignage du
  // jour survolé + auto-scroll de la grille. Le drag souris reste natif (desktop).
  const { ghost, draggingKey: touchDraggingKey, begin } = useCardDrag({
    dropAttr: "data-calendar-date",
    // Horizontal : la grille du mois (scroll latéral sur iPhone) ; vertical :
    // la page elle-même (pour remonter/descendre vers la bonne semaine).
    horizontalScroll: () => monthPaneRef.current,
    verticalScroll: () => (monthPaneRef.current?.closest(".mb-mobile-scroll") as HTMLElement | null) ?? null,
    onOverTarget: (target) => setDragOverDate(target),
    onDrop: (key, target) => {
      const item = visibleTasks.find((candidate) => getTaskKey(candidate) === key);
      if (item && item.dueDate !== target) setPendingDateChange({ item, date: target });
    },
  });

  function handleDateChangeConfirm(details: string) {
    if (!pendingDateChange) return;
    const { item, date } = pendingDateChange;
    const taskKey = getTaskKey(item);

    setDateOverrides((current) => ({ ...current, [taskKey]: date }));
    setPendingDateChange(null);

    startTransition(async () => {
      await updateTaskAction(item.project.id, item.entry.stepId, item.entry.task.id, {
        dueDate: date,
        dueTime: item.entry.task.dueTime,
        manualNote: details,
      });
      router.refresh();
    });
  }

  return (
    <>
      {pendingDateChange && (
        <TaskChangeDetailDialog
          workspace={workspace}
          title={`Planifier au ${formatHumanDate(pendingDateChange.date)}`}
          subtitle={pendingDateChange.item.entry.task.title}
          optional
          optionalPrompt="Voulez-vous donner une explication sur ce changement de date ?"
          description="Si vous ajoutez une note, elle sera enregistrée comme commentaire sur la tâche."
          label="Note"
          placeholder="Exemple : nouvelle date validée avec le fournisseur, priorité avancée, report volontaire..."
          confirmLabel="Enregistrer la note"
          onClose={() => setPendingDateChange(null)}
          onConfirm={handleDateChangeConfirm}
        />
      )}

      <section className="mb-soft-shadow min-w-0 rounded-[26px] p-3 xl:flex xl:min-h-0 xl:flex-1 xl:flex-col xl:overflow-hidden" style={{ background: surface.s1 }}>
        <div className="mb-3 flex items-center justify-between gap-3 xl:shrink-0">
          <Link
            href={buildBoardHref({ basePath, workspace, view, sort, status: statusFilter, priority: priorityFilter, projectId, stepId, month: previousMonth })}
            className="rounded-full px-3 py-2 text-[11px] font-semibold"
            style={{ background: surface.s3, color: text.secondary, border: `1px solid ${surface.borderSubtle}` }}
          >
            Mois précédent
          </Link>
          <p className="text-[0.82rem] font-bold capitalize" style={{ color: text.primary }}>
            {monthStart.toLocaleDateString("fr-FR", { month: "long", year: "numeric" })}
          </p>
          <Link
            href={buildBoardHref({ basePath, workspace, view, sort, status: statusFilter, priority: priorityFilter, projectId, stepId, month: nextMonth })}
            className="rounded-full px-3 py-2 text-[11px] font-semibold"
            style={{ background: surface.s3, color: text.secondary, border: `1px solid ${surface.borderSubtle}` }}
          >
            Mois suivant
          </Link>
        </div>

        <div className="grid min-w-0 gap-3 xl:min-h-0 xl:flex-1 xl:grid-cols-[minmax(0,1fr)_282px]">
          <div ref={monthPaneRef} className="mb-calendar-month-pane min-w-0 xl:flex xl:min-h-0 xl:flex-col">
            <div className="mb-calendar-weekdays grid grid-cols-7 gap-1 text-center text-[10px] font-bold uppercase tracking-[0.12em] xl:shrink-0" style={{ color: text.muted }}>
              {["Lun", "Mar", "Mer", "Jeu", "Ven", "Sam", "Dim"].map((day) => (
                <span key={day} className="py-1.5">
                  {day}
                </span>
              ))}
            </div>
            <div className="mb-calendar-month-cells grid grid-cols-7 gap-1 xl:min-h-0 xl:flex-1 xl:grid-rows-6">
              {cells.map((cell) => {
                const key = formatDateKey(cell.date);
                const dayTasks = tasksByDate[key] ?? [];
                const isOver = dragOverDate === key;
                const isToday = key === todayKey;
                return (
                  <div
                    key={key}
                    data-calendar-date={key}
                    className="mb-soft-shadow min-h-[92px] min-w-0 rounded-[16px] px-0.5 pt-0 pb-1 xl:min-h-0 xl:overflow-hidden"
                    style={{
                      background: isOver
                        ? surface.s4
                        : isToday
                          ? `color-mix(in srgb, ${workspaceAccent} 14%, ${cell.inMonth ? surface.s2 : surface.s1} 86%)`
                          : cell.inMonth
                            ? surface.s2
                            : surface.s1,
                      color: cell.inMonth ? text.primary : text.ghost,
                      outline: isOver ? `2px solid ${workspaceAccent}` : isToday ? `1px solid ${workspaceAccent}` : "none",
                      outlineOffset: -1,
                      position: "relative",
                    }}
                    onDragOver={(event) => {
                      event.preventDefault();
                      setDragOverDate(key);
                    }}
                    onDragLeave={(event) => {
                      if (!event.currentTarget.contains(event.relatedTarget as Node)) setDragOverDate(null);
                    }}
                    onDrop={(event) => {
                      event.preventDefault();
                      handleDrop(key);
                    }}
                  >
                    <p
                      className="mb-0 inline-flex h-4 min-w-4 items-center justify-center rounded-full px-1 text-[9.5px] font-semibold leading-none"
                      style={{
                        background: isToday ? workspaceAccent : "transparent",
                        color: isToday ? "#FFFFFF" : undefined,
                      }}
                    >
                      {cell.date.getDate()}
                    </p>
                    {dayTasks.length <= 1 ? (
                      <div className="grid gap-1 pb-1.5 xl:overflow-hidden">
                        {dayTasks.map((item) => (
                          <CalendarTaskCard
                            key={`${item.project.id}-${item.entry.id}`}
                            item={item}
                            workspace={workspace}
                            isDragging={draggingKey === getTaskKey(item) || touchDraggingKey === getTaskKey(item)}
                            onLongPressEngage={(x, y, element) => begin(getTaskKey(item), item.entry.task.title, x, y, element)}
                            onDragStart={() => setDraggingKey(getTaskKey(item))}
                            onDragEnd={() => {
                              setDraggingKey(null);
                              setDragOverDate(null);
                            }}
                          />
                        ))}
                      </div>
                    ) : (
                      // Plusieurs tâches le même jour. La carte preview reste
                      // visible (pour ne pas changer la grille). Au clic →
                      // popover floating au-dessus de la cellule contenant
                      // toutes les cartes empilées verticalement, chacune
                      // ouvrant sa propre modal. Popover en absolute + z-index
                      // élevé pour ne JAMAIS être clippé par les overflow
                      // hidden des cellules / lignes du calendrier.
                      <div className="relative">
                        {(() => {
                          const total = dayTasks.length;
                          const extraCount = total - 1;
                          const firstItem = dayTasks[0];
                          const isExpanded = expandedDate === key;
                          return (
                            <>
                              <div
                                role="button"
                                tabIndex={0}
                                style={{ position: "relative" }}
                                onClick={(event) => {
                                  event.preventDefault();
                                  event.stopPropagation();
                                  setExpandedDate(key);
                                }}
                                onTouchEnd={(event) => {
                                  event.preventDefault();
                                  event.stopPropagation();
                                  setExpandedDate(key);
                                }}
                                onKeyDown={(event) => {
                                  if (event.key === "Enter" || event.key === " ") {
                                    event.preventDefault();
                                    setExpandedDate(key);
                                  }
                                }}
                                aria-label={`${total} tâches le ${cell.date.getDate()}, voir la liste`}
                              >
                                <div style={{ pointerEvents: "none" }}>
                                  <CalendarTaskCard
                                    item={firstItem}
                                    workspace={workspace}
                                    isDragging={false}
                                    onDragStart={() => {}}
                                    onDragEnd={() => {}}
                                  />
                                </div>
                                <span
                                  aria-label={`${extraCount} tâche${extraCount > 1 ? "s" : ""} supplémentaire${extraCount > 1 ? "s" : ""}`}
                                  style={{
                                    position: "absolute",
                                    top: 4,
                                    right: 4,
                                    minWidth: 20,
                                    height: 18,
                                    padding: "0 6px",
                                    borderRadius: 999,
                                    background: text.primary,
                                    color: surface.s1,
                                    fontSize: 10,
                                    fontWeight: 700,
                                    display: "inline-flex",
                                    alignItems: "center",
                                    justifyContent: "center",
                                    lineHeight: 1,
                                    boxShadow: "var(--mb-shadow-xs)",
                                    zIndex: 20,
                                    pointerEvents: "none",
                                  }}
                                >
                                  +{extraCount}
                                </span>
                              </div>

                              {/* Modal portal'é vers body : centré sur le
                                  viewport, dimensionné par rapport à l'écran
                                  → indépendant du scroll horizontal du
                                  calendrier sur mobile et jamais clippé. */}
                              {isExpanded && typeof document !== "undefined" && createPortal(
                                <>
                                  <button
                                    type="button"
                                    onClick={() => setExpandedDate(null)}
                                    aria-label="Fermer"
                                    style={{
                                      position: "fixed",
                                      inset: 0,
                                      zIndex: 90,
                                      background: "rgba(0,0,0,0.42)",
                                      border: "none",
                                      cursor: "default",
                                    }}
                                  />
                                  <div
                                    role="dialog"
                                    aria-modal="true"
                                    aria-label={`Tâches du ${cell.date.getDate()}`}
                                    style={{
                                      position: "fixed",
                                      top: "50%",
                                      left: "50%",
                                      transform: "translate(-50%, -50%)",
                                      width: "min(540px, calc(100vw - 16px))",
                                      maxHeight: "min(78vh, 620px)",
                                      zIndex: 100,
                                      background: surface.s1,
                                      border: `1px solid ${surface.border}`,
                                      borderRadius: 16,
                                      boxShadow: "var(--mb-shadow-lg)",
                                      display: "flex",
                                      flexDirection: "column",
                                      overflow: "hidden",
                                    }}
                                    onClick={(event) => event.stopPropagation()}
                                  >
                                    <div
                                      className="flex items-center justify-between"
                                      style={{
                                        background: surface.s1,
                                        padding: "12px 14px",
                                        borderBottom: `1px solid ${surface.borderSubtle}`,
                                        flexShrink: 0,
                                      }}
                                    >
                                      <span className="text-[11px] font-bold uppercase tracking-[0.12em]" style={{ color: text.muted }}>
                                        {total} tâches · {cell.date.toLocaleDateString("fr-FR", { day: "numeric", month: "short" })}
                                      </span>
                                      <button
                                        type="button"
                                        onClick={() => setExpandedDate(null)}
                                        className="rounded-full p-1.5"
                                        style={{
                                          background: surface.s2,
                                          color: text.muted,
                                          border: `1px solid ${surface.borderSubtle}`,
                                          cursor: "pointer",
                                          lineHeight: 0,
                                        }}
                                        aria-label="Fermer la liste"
                                      >
                                        <svg width="14" height="14" viewBox="0 0 16 16" fill="none">
                                          <path d="m4 4 8 8M12 4l-8 8" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" />
                                        </svg>
                                      </button>
                                    </div>
                                    <div style={{ display: "grid", gap: 6, padding: 6, overflowY: "auto" }}>
                                      {dayTasks.map((item) => (
                                        <CalendarTaskCard
                                          key={`${item.project.id}-${item.entry.id}`}
                                          item={item}
                                          workspace={workspace}
                                          isDragging={draggingKey === getTaskKey(item) || touchDraggingKey === getTaskKey(item)}
                                          onLongPressEngage={(x, y, element) => begin(getTaskKey(item), item.entry.task.title, x, y, element)}
                                          onDragStart={() => setDraggingKey(getTaskKey(item))}
                                          onDragEnd={() => {
                                            setDraggingKey(null);
                                            setDragOverDate(null);
                                          }}
                                          // On ferme la modal liste ET on ouvre le drawer
                                          // contrôlé au niveau du calendrier. Le drawer est
                                          // rendu plus bas (pas dans cette modal) donc il
                                          // survit à la fermeture de la liste. À la fermeture
                                          // du drawer, on revient au calendrier.
                                          onClickOverride={() => {
                                            setExpandedDate(null);
                                            setOpenTaskItem(item);
                                          }}
                                        />
                                      ))}
                                    </div>
                                  </div>
                                </>,
                                document.body,
                              )}
                            </>
                          );
                        })()}
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          </div>

          <aside
            className="mb-soft-shadow min-h-[180px] rounded-[20px] p-2.5 xl:min-h-0 xl:overflow-y-auto"
            style={{ background: surface.s2 }}
          >
            <div className="mb-2 flex items-start justify-between gap-2 px-1">
              <div>
                <p className="text-xs font-bold" style={{ color: text.primary }}>
                  Non planifiées
                </p>
                <p className="mt-0.5 text-[10px] leading-snug" style={{ color: text.muted }}>
                  Glisse une tâche sur un jour.
                </p>
              </div>
              <span className="rounded-full px-2 py-1 text-[10px] font-bold tabular-nums" style={{ background: surface.s1, color: text.secondary }}>
                {unplannedTasks.length}
              </span>
            </div>

            {unplannedTasks.length > 0 ? (
              <div className="grid gap-2">
                {unplannedTasks.map((item) => (
                  <CalendarTaskCard
                    key={getTaskKey(item)}
                    item={item}
                    workspace={workspace}
                    isDragging={draggingKey === getTaskKey(item) || touchDraggingKey === getTaskKey(item)}
                    onLongPressEngage={(x, y, element) => begin(getTaskKey(item), item.entry.task.title, x, y, element)}
                    onDragStart={() => setDraggingKey(getTaskKey(item))}
                    onDragEnd={() => {
                      setDraggingKey(null);
                      setDragOverDate(null);
                    }}
                  />
                ))}
              </div>
            ) : (
              <div className="rounded-[16px] p-3 text-[11px] leading-relaxed" style={{ background: surface.s1, color: text.muted }}>
                Toutes les tâches visibles avec ces filtres sont déjà planifiées.
              </div>
            )}
          </aside>
        </div>
      </section>
      {/* Drawer de tâche contrôlé par le calendrier. Vit hors de la modal
          "liste du jour" → ne se démonte pas quand cette modal se ferme.
          La key force un remount quand l'utilisateur passe d'une tâche à
          l'autre (sinon le drawer garderait l'ancien draftTask). */}
      {openTaskItem && (
        <TaskDetailLauncher
          key={`${openTaskItem.project.id}-${openTaskItem.entry.task.id}`}
          projectId={openTaskItem.project.id}
          workspace={workspace}
          stepId={openTaskItem.entry.stepId}
          stepTitle={openTaskItem.entry.stepTitle}
          stepDescription={
            openTaskItem.project.steps?.find((s) => s.id === openTaskItem.entry.stepId)?.description
          }
          task={openTaskItem.entry.task}
          accentColor={openTaskItem.project.subcategoryColor}
          projectPeople={openTaskItem.project.people ?? []}
          projectTeams={openTaskItem.project.teams ?? []}
          statusSettings={openTaskItem.project.statusSettings}
          controlledOpen
          onControlledOpenChange={(next) => {
            if (!next) setOpenTaskItem(null);
          }}
          // Pas de trigger : le drawer s'ouvre automatiquement (controlledOpen
          // = true), aucun bouton n'est rendu.
          trigger={() => null}
        />
      )}

      <DragGhost ghost={ghost} />
    </>
  );
}

function CalendarTaskCard({
  item,
  workspace,
  isDragging,
  onDragStart,
  onDragEnd,
  onClickOverride,
  onLongPressEngage,
}: {
  item: TaskItem;
  workspace: Workspace;
  isDragging: boolean;
  onDragStart: () => void;
  onDragEnd: () => void;
  onLongPressEngage?: (x: number, y: number, element: HTMLElement) => void;
  /** Si fourni, remplace l'ouverture de la modal par ce handler. Utilisé
   *  pour la vue "preview" d'une journée à plusieurs tâches : un tap sur la
   *  carte aperçu doit éclater la pile, pas ouvrir directement la première.
   *  Aussi utilisé dans la modal "liste de tâches du jour" pour naviguer
   *  vers la page projet (qui auto-ouvre le drawer via le param taskId)
   *  plutôt que d'ouvrir un drawer en place — la fermeture de la liste
   *  démonterait sinon le portal du drawer. */
  onClickOverride?: () => void;
}) {
  const { project, entry } = item;
  const status = deriveTaskStatus(entry.task);
  const statusTone = getStatusTone(project, status);
  const step = project.steps?.find((projectStep) => projectStep.id === entry.stepId);
  const isDone = entry.task.done || status === "done";
  // displayedPriority dépend de `new Date()` → différé après hydratation
  // pour éviter la divergence SSR/client iPhone.
  const [hydrated, setHydrated] = useState(false);
  useEffect(() => setHydrated(true), []);
  const displayedPriority = hydrated ? deriveTaskDisplayPriority(entry.task) : entry.task.priority ?? "medium";
  const displayedPriorityVisual = priorityVisuals[displayedPriority];
  const dragStartedRef = useRef(false);
  const isTouch = useIsTouchDevice();
  const touchStartRef = useRef<{ x: number; y: number } | null>(null);
  const suppressNextClickRef = useRef(false);
  const longPress = useLongPressDrag(({ x, y, element }) => {
    dragStartedRef.current = true;
    onLongPressEngage?.(x, y, element);
    window.setTimeout(() => {
      dragStartedRef.current = false;
    }, 700);
  });

  return (
    <TaskDetailLauncher
      projectId={project.id}
      workspace={workspace}
      stepId={entry.stepId}
      stepTitle={entry.stepTitle}
      stepDescription={step?.description}
      task={entry.task}
      accentColor={project.subcategoryColor}
      projectPeople={project.people ?? []}
      projectTeams={project.teams ?? []}
      statusSettings={project.statusSettings}
      trigger={({ open }) => (
        <div
          data-drag-card
          draggable={!isTouch}
          role="button"
          tabIndex={0}
          onClick={() => {
            if (suppressNextClickRef.current) {
              suppressNextClickRef.current = false;
              return;
            }
            if (dragStartedRef.current) return;
            if (onClickOverride) onClickOverride();
            else open();
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
            if (dragStartedRef.current) return;
            if (!touch || !start) return;

            const moved = Math.hypot(touch.clientX - start.x, touch.clientY - start.y);
            if (moved > 10) return;

            event.preventDefault();
            suppressNextClickRef.current = true;
            if (onClickOverride) onClickOverride();
            else open();
            window.setTimeout(() => {
              suppressNextClickRef.current = false;
            }, 350);
          }}
          onKeyDown={(event) => {
            if (event.key === "Enter" || event.key === " ") {
              event.preventDefault();
              if (onClickOverride) onClickOverride();
              else open();
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
          onPointerDown={(event) => {
            if (!onLongPressEngage) return;
            const target = event.target as HTMLElement;
            if (
              target.closest(
                "button, a, input, textarea, select, [role='button'], [data-mobile-tap-ignore='true']",
              )
            )
              return;
            longPress.onPointerDown(event);
          }}
          onPointerMove={longPress.onPointerMove}
          onPointerUp={longPress.onPointerUp}
          onPointerCancel={longPress.onPointerCancel}
          className="mb-soft-shadow relative min-w-0 rounded-xl text-left"
          style={{
            background: surface.s1,
            cursor: isDragging ? "grabbing" : "pointer",
            opacity: isDragging ? 0.72 : 1,
            userSelect: "none",
            WebkitUserSelect: "none",
            WebkitTouchCallout: "none",
            padding: "0.65rem 0.7rem 0.6rem 0.65rem",
            overflow: "hidden",
            width: "100%",
            minHeight: 60,
          }}
          title="Cliquer pour ouvrir, glisser pour planifier"
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
                width: 3,
                background: displayedPriorityVisual.text,
                pointerEvents: "none",
              }}
            />
          )}
          <p
            className="mb-board-task-title line-clamp-2 text-[11px] font-semibold leading-snug"
            style={{ color: text.primary }}
          >
            {entry.task.title}
          </p>
          <p className="mt-1 truncate text-[10px]" style={{ color: text.muted }}>
            {project.name}
          </p>
          <span
            aria-hidden
            title={`Statut : ${getTaskStatusLabel(project, status)}`}
            className="absolute bottom-0 right-0"
            style={{
              width: 0,
              height: 0,
              borderStyle: "solid",
              borderWidth: "0 0 18px 18px",
              borderColor: `transparent transparent ${statusTone.text} transparent`,
              pointerEvents: "none",
            }}
          />
        </div>
      )}
    />
  );
}

function getStatusTone(project: Project, status: TaskStatus) {
  const custom = project.statusSettings?.task?.[status];
  if (!custom) return defaultStatusColor[status];
  return { bg: surface.s2, text: custom.color };
}

function getTaskStatusLabel(project: Project, status: TaskStatus) {
  return project.statusSettings?.task?.[status]?.label ?? status;
}

function getTaskKey(item: TaskItem) {
  return `${item.project.id}:${item.entry.stepId}:${item.entry.task.id}`;
}

function buildBoardHref(input: {
  basePath: string;
  workspace: Workspace;
  view: TasksView;
  sort: TaskSort;
  status: TaskStatusFilter;
  priority: PriorityFilter;
  projectId: string;
  stepId?: string;
  month?: Date;
}) {
  const params = new URLSearchParams({ workspace: input.workspace });
  if (input.view !== "list" && input.basePath === "/dashboard/tasks") params.set("view", input.view);
  if (input.sort !== "due") params.set("sort", input.sort);
  if (input.status !== "open") params.set("status", input.status);
  if (input.priority !== "all") params.set("priority", input.priority);
  if (input.projectId !== "all") params.set("project", input.projectId);
  if (input.stepId && input.stepId !== "all") params.set("step", input.stepId);
  if (input.month) params.set("month", formatMonthParam(input.month));
  return `${input.basePath}?${params.toString()}`;
}

function parseMonth(value: string) {
  if (!/^\d{4}-\d{2}$/.test(value)) return startOfMonth(new Date());
  const [year, month] = value.split("-").map(Number);
  if (!year || !month || month < 1 || month > 12) return startOfMonth(new Date());
  return new Date(year, month - 1, 1);
}

function startOfMonth(date: Date) {
  return new Date(date.getFullYear(), date.getMonth(), 1);
}

function addMonths(date: Date, amount: number) {
  return new Date(date.getFullYear(), date.getMonth() + amount, 1);
}

function formatMonthParam(date: Date) {
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, "0")}`;
}

function formatDateKey(date: Date) {
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, "0")}-${String(date.getDate()).padStart(2, "0")}`;
}

function formatHumanDate(value: string) {
  return formatShortDate(value);
}

function sortUnplannedTasks(left: TaskItem & { dueDate?: string }, right: TaskItem & { dueDate?: string }) {
  const priorityDiff = priorityRank(deriveTaskDisplayPriority(right.entry.task)) - priorityRank(deriveTaskDisplayPriority(left.entry.task));
  if (priorityDiff !== 0) return priorityDiff;
  const projectDiff = left.project.name.localeCompare(right.project.name, "fr");
  if (projectDiff !== 0) return projectDiff;
  return left.entry.task.title.localeCompare(right.entry.task.title, "fr");
}

function priorityRank(priority: ProjectPriority | undefined) {
  if (priority === "high") return 3;
  if (priority === "low") return 1;
  return 2;
}

function buildCalendarCells(monthStart: Date) {
  const firstDay = monthStart.getDay() === 0 ? 6 : monthStart.getDay() - 1;
  const start = new Date(monthStart);
  start.setDate(monthStart.getDate() - firstDay);

  return Array.from({ length: 42 }, (_, index) => {
    const date = new Date(start);
    date.setDate(start.getDate() + index);
    return { date, inMonth: date.getMonth() === monthStart.getMonth() };
  });
}
