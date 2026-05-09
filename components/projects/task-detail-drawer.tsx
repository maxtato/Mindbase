"use client";

import { useCallback, useEffect, useRef, useState, useTransition, type CSSProperties, type ChangeEvent, type FormEvent, type ReactNode } from "react";
import { createPortal } from "react-dom";
import { useRouter } from "next/navigation";
import {
  addTaskDiscussionMessageAction,
  deleteTaskFileAction,
  uploadTaskFilesAction,
} from "@/app/dashboard/projects/[id]/actions";
import type { Task, ChecklistItem, ProjectFile, ProjectPerson, ProjectStatusSettings, ProjectTeam, TaskDiscussionMessage, TaskStatus } from "@/lib/mock-data";
import { formatShortDateTime, formatTaskScheduleDate } from "@/lib/date-format";
import { error as errorTokens, statusColor, surface, text } from "@/lib/design-tokens";
import { buildProjectFileHref, projectFileTypeMeta } from "@/lib/project-files";
import { deriveTaskDisplayPriority, deriveTaskStatus, getTaskDueAlert, taskStatusLabels } from "@/lib/project-plan";
import { priorityVisuals } from "@/lib/project-taxonomy";
import { getVisibleTaskOwner } from "@/lib/task-people";
import { deleteTone, TrashIcon } from "@/components/ui/trash-icon";
import { workspaceTheme, type Workspace } from "@/lib/workspace";
import { getActiveAccountName, getActiveAccountPersonId } from "@/lib/current-account";

interface TaskDetailDrawerProps {
  open: boolean;
  onClose: () => void;
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
  onUpdate: (input: {
    title?: string;
    description?: string;
    owner?: string;
    dueDate?: string;
    dueTime?: string;
    status?: TaskStatus;
    expected?: string;
    realization?: string;
    assignees?: string[];
    teamIds?: string[];
    comments?: string[];
    checklist?: ChecklistItem[];
    manualNote?: string;
  }) => void;
  onChecklistMutated: (nextChecklist: ChecklistItem[]) => void;
}

export function TaskDetailDrawer(props: TaskDetailDrawerProps) {
  const { open, onClose } = props;

  useEffect(() => {
    if (!open) return;
    const handler = (event: KeyboardEvent) => {
      if (event.key === "Escape") onClose();
    };
    window.addEventListener("keydown", handler);
    return () => window.removeEventListener("keydown", handler);
  }, [open, onClose]);

  if (!open || typeof document === "undefined") return null;

  return createPortal(<TaskDetailDrawerInner {...props} />, document.body);
}

function TaskDetailDrawerInner({
  onClose,
  projectId,
  workspace,
  stepId,
  stepTitle,
  task,
  accentColor,
  projectPeople = [],
  projectTeams = [],
  statusSettings,
  onUpdate,
  onChecklistMutated,
}: Omit<TaskDetailDrawerProps, "open">) {
  const router = useRouter();
  const theme = workspaceTheme[workspace];
  const uiAccent = theme.accent;
  const [title, setTitle] = useState(task.title);
  const [owner, setOwner] = useState(getVisibleTaskOwner(task.owner) ?? "");
  const [selectedTeamIds, setSelectedTeamIds] = useState<string[]>(task.teamIds ?? []);
  const [dueDate, setDueDate] = useState(task.dueDate ?? "");
  const [dueTime, setDueTime] = useState(task.dueTime ?? "");
  const [status, setStatus] = useState<TaskStatus>(deriveTaskStatus(task));
  const [scheduleChangeNote, setScheduleChangeNote] = useState("");
  const [expected, setExpected] = useState(task.expected ?? "");
  const [realization, setRealization] = useState(task.realization ?? task.completionDetails ?? "");
  const [commentsText, setCommentsText] = useState((task.comments ?? []).join("\n"));
  const [checklist, setChecklist] = useState<ChecklistItem[]>(task.checklist ?? []);
  const [taskFiles, setTaskFiles] = useState<ProjectFile[]>(task.files ?? []);
  const [discussion, setDiscussion] = useState<TaskDiscussionMessage[]>(task.discussion ?? []);
  const [newChecklistLabel, setNewChecklistLabel] = useState("");
  const [uploadError, setUploadError] = useState<string | null>(null);
  const [selectedPersonId, setSelectedPersonId] = useState("");
  const [discussionText, setDiscussionText] = useState("");
  const [activePanel, setActivePanel] = useState<"checklist" | "date" | "person" | "files" | "discussion" | "note" | null>(null);
  const [, startTransition] = useTransition();
  const taskIdRef = useRef(task.id);
  const titleTextareaRef = useRef<HTMLTextAreaElement>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const resetDraftFromTask = useCallback((nextTask: Task) => {
    setTitle(nextTask.title);
    setOwner(getVisibleTaskOwner(nextTask.owner) ?? "");
    setSelectedTeamIds(nextTask.teamIds ?? []);
    setDueDate(nextTask.dueDate ?? "");
    setDueTime(nextTask.dueTime ?? "");
    setStatus(deriveTaskStatus(nextTask));
    setScheduleChangeNote("");
    setExpected(nextTask.expected ?? "");
    setRealization(nextTask.realization ?? nextTask.completionDetails ?? "");
    setCommentsText((nextTask.comments ?? []).join("\n"));
    setChecklist(nextTask.checklist ?? []);
    setTaskFiles(nextTask.files ?? []);
    setDiscussion(nextTask.discussion ?? []);
    setSelectedPersonId("");
    setUploadError(null);
    setActivePanel(null);
  }, []);

  useEffect(() => {
    if (taskIdRef.current === task.id) return;
    taskIdRef.current = task.id;
    resetDraftFromTask(task);
  }, [resetDraftFromTask, task]);

  useEffect(() => {
    const textarea = titleTextareaRef.current;
    if (!textarea) return;
    textarea.style.height = "auto";
    textarea.style.height = `${Math.min(textarea.scrollHeight, 76)}px`;
  }, [title]);

  function getNextComments() {
    return commentsText
      .split("\n")
      .map((entry) => entry.trim())
      .filter(Boolean);
  }

  function sameStringArray(left: string[] = [], right: string[] = []) {
    return left.length === right.length && left.every((value, index) => value === right[index]);
  }

  function sameChecklist(left: ChecklistItem[] = [], right: ChecklistItem[] = []) {
    return (
      left.length === right.length &&
      left.every((item, index) => {
        const other = right[index];
        return other && item.id === other.id && item.label.trim() === other.label.trim() && item.done === other.done;
      })
    );
  }

  function buildUpdateInput() {
    const input: Parameters<typeof onUpdate>[0] = {};
    const nextTitle = title.trim();
    const previousTitle = task.title.trim();
    const nextOwner = owner.trim();
    const previousOwner = getVisibleTaskOwner(task.owner) ?? "";
    const previousTeamIds = task.teamIds ?? [];
    const nextComments = getNextComments();
    const previousComments = task.comments ?? [];

    if (nextTitle && nextTitle !== previousTitle) input.title = nextTitle;
    if (nextOwner !== previousOwner) input.owner = nextOwner;
    if (!sameStringArray(selectedTeamIds, previousTeamIds)) input.teamIds = selectedTeamIds;
    if (dueDate !== (task.dueDate ?? "")) input.dueDate = dueDate;
    if (dueTime !== (task.dueTime ?? "")) input.dueTime = dueTime;
    if (status !== deriveTaskStatus(task)) input.status = status;
    if ((input.dueDate !== undefined || input.dueTime !== undefined) && scheduleChangeNote.trim()) {
      input.manualNote = `Changement de date : ${scheduleChangeNote.trim()}`;
    }
    if (expected.trim() !== (task.expected ?? "").trim()) input.expected = expected;
    if (realization.trim() !== (task.realization ?? task.completionDetails ?? "").trim()) input.realization = realization;
    if (!sameStringArray(nextComments, previousComments)) input.comments = nextComments;
    if (!sameChecklist(checklist, task.checklist ?? [])) input.checklist = checklist;

    return input;
  }

  const pendingUpdate = buildUpdateInput();
  const hasUnsavedChanges = Object.keys(pendingUpdate).length > 0;
  const statusOptionMeta = getTaskStatusOptionMeta(status, statusSettings);
  const statusOptions = TASK_STATUS_ORDER.map((option) => getTaskStatusOptionMeta(option, statusSettings));

  function handleCancel() {
    resetDraftFromTask(task);
    onClose();
  }

  function handleSave() {
    if (!title.trim()) {
      setTitle(task.title);
      return;
    }

    if (hasUnsavedChanges) {
      onUpdate(pendingUpdate);
      if (pendingUpdate.checklist) onChecklistMutated(pendingUpdate.checklist);
    }
    onClose();
  }

  function commitSchedule() {
    const scheduleChanged = dueDate !== (task.dueDate ?? "") || dueTime !== (task.dueTime ?? "");
    if (scheduleChanged && !scheduleChangeNote.trim()) return;
    setActivePanel(null);
  }

  function clearSchedule() {
    setDueDate("");
    setDueTime("");
    setScheduleChangeNote("Échéance retirée manuellement.");
    setActivePanel(null);
  }

  function commitComments() {
    setActivePanel(null);
  }

  function clearComments() {
    setCommentsText("");
    setActivePanel(null);
  }

  function commitOwner() {
    setActivePanel(null);
  }

  function clearOwner() {
    setOwner("");
    setSelectedTeamIds([]);
    setActivePanel(null);
  }

  function toggleTeam(teamId: string) {
    setSelectedTeamIds((current) =>
      current.includes(teamId) ? current.filter((id) => id !== teamId) : [...current, teamId],
    );
  }

  function handleTaskFilesChange(event: ChangeEvent<HTMLInputElement>) {
    const picked = Array.from(event.target.files ?? []);
    if (picked.length === 0) return;

    const formData = new FormData();
    formData.set("projectId", projectId);
    formData.set("workspace", workspace);
    formData.set("stepId", stepId);
    formData.set("taskId", task.id);
    picked.forEach((file) => formData.append("files", file));
    setUploadError(null);

    startTransition(async () => {
      try {
        const result = await uploadTaskFilesAction(formData);
        if (!result.ok) {
          setUploadError(result.error);
          return;
        }
        setTaskFiles(result.files ?? []);
        router.refresh();
      } catch (error) {
        console.error("[task_file_upload]", error);
        setUploadError("Impossible d'ajouter ce fichier pour le moment.");
      }
    });

    event.target.value = "";
  }

  function handleTaskFileDelete(fileId: string) {
    const previousFiles = taskFiles;
    setTaskFiles((current) => current.filter((file) => file.id !== fileId));
    setUploadError(null);

    startTransition(async () => {
      try {
        await deleteTaskFileAction(projectId, stepId, task.id, fileId);
        router.refresh();
      } catch (error) {
        console.error("[task_file_delete]", error);
        setTaskFiles(previousFiles);
        setUploadError("Impossible de supprimer ce fichier pour le moment.");
      }
    });
  }

  function addDiscussionMessage(event: FormEvent) {
    event.preventDefault();
    const content = discussionText.trim();
    if (!content) return;
    const authorName = getActiveAccountName();
    const authorPersonId = getActiveAccountPersonId(projectPeople);
    const optimistic: TaskDiscussionMessage = {
      id: `msg_${Math.random().toString(36).slice(2, 10)}`,
      authorName,
      authorPersonId,
      content,
      createdAt: new Date().toISOString(),
    };
    setDiscussion((current) => [...current, optimistic]);
    setDiscussionText("");

    startTransition(async () => {
      try {
        await addTaskDiscussionMessageAction(projectId, stepId, task.id, {
          authorName,
          authorPersonId,
          content,
        });
        router.refresh();
      } catch (error) {
        console.error("[task_discussion]", error);
      }
    });
  }

  function addChecklistItem(event: FormEvent) {
    event.preventDefault();
    const label = newChecklistLabel.trim();
    if (!label) return;
    const itemId = `cl_${Math.random().toString(36).slice(2, 10)}`;
    const optimistic: ChecklistItem = {
      id: itemId,
      label,
      done: false,
    };
    const next = [...checklist, optimistic];
    setChecklist(next);
    setNewChecklistLabel("");
    setActivePanel(null);
  }

  function updateItemLabel(item: ChecklistItem, label: string) {
    const cleaned = label.trim();
    if (!cleaned) {
      deleteItem(item);
      return;
    }
    if (cleaned === item.label) return;

    const next = checklist.map((entry) => (entry.id === item.id ? { ...entry, label: cleaned } : entry));
    setChecklist(next);
  }

  function toggleItem(item: ChecklistItem) {
    const next = checklist.map((entry) => (entry.id === item.id ? { ...entry, done: !entry.done } : entry));
    setChecklist(next);
  }

  function deleteItem(item: ChecklistItem) {
    const next = checklist.filter((entry) => entry.id !== item.id);
    setChecklist(next);
  }

  const completed = checklist.filter((item) => item.done).length;
  const priority = priorityVisuals[deriveTaskDisplayPriority({ ...task, dueDate, dueTime })];
  const dueAlert = getTaskDueAlert({ ...task, dueDate, dueTime });
  const assigneeCount = task.assignees?.length ?? 0;
  const displayOwner = owner.trim();
  const hasSchedule = Boolean(dueDate);
  const selectedTeams = projectTeams.filter((team) => selectedTeamIds.includes(team.id));
  const notes = commentsText
    .split("\n")
    .map((entry) => entry.trim())
    .filter(Boolean);
  const commentCount = notes.length;

  return (
    <>
      <div
        onClick={onClose}
        className="mb-modal-backdrop"
        style={{
          position: "fixed",
          inset: 0,
          zIndex: 50,
        }}
      />
      <aside
        role="dialog"
        aria-modal="true"
        aria-label={`Détails de la tâche ${task.title}`}
        className="mb-modal-surface overflow-hidden"
        style={{
          position: "fixed",
          top: "50%",
          left: "50%",
          transform: "translate(-50%, -50%)",
          height: "min(820px, calc(100dvh - 40px))",
          width: "min(1220px, calc(100vw - 32px))",
          zIndex: 60,
          display: "flex",
          flexDirection: "column",
          borderRadius: 20,
          boxShadow: "var(--mb-shadow-lg)",
          border: `1px solid ${surface.borderSubtle}`,
        }}
      >
        <header
          className="flex items-start justify-between gap-3"
          style={{
            padding: "18px 22px",
            background: surface.s1,
            borderBottom: `1px solid ${surface.borderSubtle}`,
          }}
        >
          <div className="min-w-0 flex-1">
            <p
              style={{
                fontSize: 10.5,
                fontWeight: 600,
                textTransform: "uppercase",
                letterSpacing: "0.12em",
                color: text.muted,
                margin: 0,
              }}
            >
              {stepTitle}
            </p>
            <textarea
              ref={titleTextareaRef}
              value={title}
              onChange={(event) => setTitle(event.target.value)}
              onKeyDown={(event) => {
                if (event.key === "Enter") event.preventDefault();
              }}
              aria-label="Titre de la tâche"
              rows={1}
              className="w-full resize-none overflow-hidden bg-transparent outline-none"
              style={{
                color: text.primary,
                border: "none",
                margin: "4px 0 0",
                minHeight: "2rem",
                fontSize: 18,
                fontWeight: 700,
                lineHeight: 1.25,
                letterSpacing: "-0.01em",
                whiteSpace: "pre-wrap",
              }}
            />
            <div className="mt-2 flex flex-wrap gap-1.5">
              <label
                className="inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-[10px] font-semibold"
                style={{
                  background: statusOptionMeta.background,
                  color: statusOptionMeta.color,
                  border: `1px solid ${statusOptionMeta.border}`,
                }}
              >
                <span style={{ color: text.muted }}>Statut</span>
                <select
                  value={status}
                  onChange={(event) => setStatus(event.target.value as TaskStatus)}
                  className="bg-transparent text-[10px] font-semibold outline-none"
                  style={{ color: statusOptionMeta.color, border: "none", cursor: "pointer" }}
                  aria-label="Statut de la tâche"
                >
                  {statusOptions.map((option) => (
                    <option key={option.status} value={option.status}>
                      {option.label}
                    </option>
                  ))}
                </select>
              </label>
              <DetailTag label={priority.label} dotColor={priority.text} />
              {hasSchedule && (
                <DetailTag
                  label={`Date prévue · ${formatScheduleLabel(dueDate, dueTime)}`}
                  color={dueAlert.tone === "danger" ? errorTokens.text : dueAlert.tone === "warning" ? statusColor.yellow.text : text.secondary}
                  background={dueAlert.tone === "danger" ? errorTokens.bg : dueAlert.tone === "warning" ? statusColor.yellow.bg : surface.s2}
                  border={dueAlert.tone === "danger" ? errorTokens.border : dueAlert.tone === "warning" ? statusColor.yellow.text : surface.borderSubtle}
                  icon={<SecondaryIcon icon="calendar" />}
                />
              )}
              {displayOwner && <DetailTag label={displayOwner} icon={<SecondaryIcon icon="person" />} />}
              {selectedTeams.map((team) => (
                <DetailTag
                  key={team.id}
                  label={team.name}
                  color={team.color ?? accentColor}
                  background={surface.s2}
                  border={surface.borderSubtle}
                />
              ))}
              {taskFiles.length > 0 && (
                <DetailTag
                  label={`${taskFiles.length} fichier${taskFiles.length > 1 ? "s" : ""}`}
                  icon={<SecondaryIcon icon="file" />}
                />
              )}
              {discussion.length > 0 && (
                <DetailTag
                  label={`${discussion.length} message${discussion.length > 1 ? "s" : ""}`}
                  icon={<SecondaryIcon icon="discussion" />}
                />
              )}
              {assigneeCount > 0 && <DetailTag label={`${assigneeCount} personne${assigneeCount > 1 ? "s" : ""}`} />}
            </div>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="shrink-0"
            style={{
              width: 32,
              height: 32,
              display: "inline-flex",
              alignItems: "center",
              justifyContent: "center",
              background: surface.s2,
              color: text.secondary,
              border: `1px solid ${surface.borderSubtle}`,
              borderRadius: 10,
              cursor: "pointer",
              transition: "background-color 120ms var(--mb-ease), color 120ms var(--mb-ease)",
            }}
            title="Fermer"
          >
            <svg width="14" height="14" viewBox="0 0 16 16" fill="none">
              <path d="m4 4 8 8M12 4l-8 8" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" />
            </svg>
          </button>
        </header>

        <div
          className="flex-1 overflow-y-auto px-5 py-5"
          style={{
            display: "grid",
            gridTemplateColumns: "repeat(3, minmax(0, 1fr))",
            gap: "0.85rem",
            alignContent: "start",
          }}
        >
          <div className="grid gap-3">
            <Section
              title="Attendu"
              description="L'action concrète à mener pour faire avancer la tâche."
            >
              <textarea
                value={expected}
                onChange={(event) => setExpected(event.target.value)}
                rows={3}
                placeholder="Ex : faire réviser le véhicule, comparer les devis, réserver l'hébergement..."
                style={{ ...fieldStyle(), minHeight: 210, resize: "vertical" }}
              />
            </Section>

            <section className="rounded-2xl p-3" style={{ background: surface.s2, border: `1px solid ${surface.border}` }}>
              <p className="mb-2 text-[10px] font-semibold uppercase tracking-[0.14em]" style={{ color: text.muted }}>
                Infos pratiques
              </p>
              <div className="grid grid-cols-3 gap-1.5">
              <EditableInfoRow
                icon="calendar"
                label="Date prévue"
                value={hasSchedule ? formatScheduleLabel(dueDate, dueTime) : "Ajouter"}
                empty={!hasSchedule}
                onClick={() => setActivePanel("date")}
                accentColor={uiAccent}
              />
              <EditableInfoRow
                icon="person"
                label="Personne"
                value={displayOwner || selectedTeams.map((team) => team.name).join(", ") || "Ajouter"}
                empty={!displayOwner && selectedTeams.length === 0}
                onClick={() => setActivePanel("person")}
                accentColor={uiAccent}
              />
              <EditableInfoRow
                icon="file"
                label="Fichiers"
                value={taskFiles.length > 0 ? `${taskFiles.length} fichier${taskFiles.length > 1 ? "s" : ""}` : "Ajouter"}
                empty={taskFiles.length === 0}
                onClick={() => setActivePanel("files")}
                accentColor={uiAccent}
              />
              </div>
            </section>
          </div>

          <div className="grid gap-3">
            <Section
              title="Réalisation"
              description="Ce qui a réellement été fait ou validé."
            >
              <textarea
                value={realization}
                onChange={(event) => setRealization(event.target.value)}
                rows={4}
                placeholder="Ce qui a été fait concrètement."
                style={{ ...fieldStyle(), minHeight: 210, resize: "vertical" }}
              />
            </Section>

            <section className="rounded-2xl p-3" style={{ background: surface.s2, border: `1px solid ${surface.border}` }}>
              <button
                type="button"
                onClick={() => setActivePanel("checklist")}
                className="mb-2 flex w-full items-center justify-between gap-3 text-left"
                style={{ color: text.muted, cursor: "pointer" }}
              >
                <span className="text-[11px] font-semibold uppercase tracking-[0.12em]">Checklist</span>
                <span className="text-[11px] font-semibold" style={{ color: checklist.length > 0 ? text.secondary : uiAccent }}>
                  {checklist.length > 0 ? `${completed}/${checklist.length}` : "Ajouter"}
                </span>
              </button>
              {checklist.length > 0 ? (
                <div className="grid gap-[2px]">
                  {checklist.map((item) => (
                    <div
                      key={item.id}
                      className="flex min-w-0 items-center gap-1.5 py-[1px]"
                    >
                      <button
                        type="button"
                        onClick={() => toggleItem(item)}
                        className="flex h-[15px] w-[15px] shrink-0 items-center justify-center rounded-full"
                        style={{
                          background: item.done ? uiAccent : surface.s2,
                          border: item.done ? "none" : `1.5px solid ${surface.borderHover}`,
                          cursor: "pointer",
                        }}
                        aria-label={item.done ? "Marquer comme à faire" : "Marquer comme fait"}
                      >
                        {item.done && (
                          <svg width="9" height="9" viewBox="0 0 12 12" fill="none">
                            <path d="M2 6l3 3 5-5" stroke="white" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" />
                          </svg>
                        )}
                      </button>
                      <input
                        defaultValue={item.label}
                        onBlur={(event) => updateItemLabel(item, event.target.value)}
                        className="min-w-0 flex-1 bg-transparent text-[11px] outline-none"
                        style={{
                          color: item.done ? text.muted : text.primary,
                          textDecoration: item.done ? "line-through" : "none",
                          border: "none",
                        }}
                      />
                      <IconButton title="Supprimer l'élément" onClick={() => deleteItem(item)} />
                    </div>
                  ))}
                </div>
              ) : (
                <button
                  type="button"
                  onClick={() => setActivePanel("checklist")}
                  className="w-full py-2 text-left text-[11px]"
                  style={{ color: uiAccent, cursor: "pointer" }}
                >
                  Aucune checklist. Cliquer pour ajouter un élément.
                </button>
              )}
            </section>
          </div>

          <div
            className="grid gap-3"
          >
            <div>
              <div className="mb-2 flex items-center justify-between gap-2">
                <p className="text-[10px] font-semibold uppercase tracking-[0.14em]" style={{ color: text.muted }}>
                  Note
                </p>
                {commentCount > 0 && (
                  <button
                    type="button"
                    onClick={clearComments}
                    className="rounded-full px-2 py-1 text-[10px] font-semibold"
                    style={{ background: surface.s2, color: deleteTone.text, border: `1px solid ${deleteTone.border}`, cursor: "pointer" }}
                  >
                    Effacer
                  </button>
                )}
              </div>
              <textarea
                value={commentsText}
                onChange={(event) => setCommentsText(event.target.value)}
                rows={4}
                placeholder="Note, précision, point à garder..."
                style={{ ...fieldStyle(), minHeight: 96, resize: "vertical" }}
              />
            </div>

            <div>
              <div className="mb-2 flex items-center justify-between gap-2">
                <p className="text-[10px] font-semibold uppercase tracking-[0.14em]" style={{ color: text.muted }}>
                  Discussion
                </p>
                <button
                  type="button"
                  onClick={() => setActivePanel("discussion")}
                  className="rounded-full px-2 py-1 text-[10px] font-semibold"
                  style={{ background: theme.accentBg, color: theme.accentText, border: `1px solid ${surface.borderSubtle}`, cursor: "pointer" }}
                >
                  Ouvrir
                </button>
              </div>
              <div
                className="rounded-2xl p-2"
                style={{
                  height: 250,
                  background: surface.s2,
                  display: "flex",
                  flexDirection: "column",
                }}
              >
                <div className="min-h-0 flex-1 overflow-y-auto pr-1">
                {discussion.length === 0 ? (
                  <p className="py-2 text-[11px]" style={{ color: text.muted }}>
                    Aucun échange sur cette tâche.
                  </p>
                ) : (
                  <div className="flex flex-col gap-1.5">
                    {discussion.map((message, index) => (
                      <ChatBubble key={message.id} message={message} sent={index % 2 === 1} compact />
                    ))}
                  </div>
                )}
                </div>
                <button
                  type="button"
                  onClick={() => setActivePanel("discussion")}
                  className="mt-2 rounded-full px-3 py-2 text-left text-[11px] font-semibold"
                  style={{ background: surface.s1, color: uiAccent, border: `1px solid ${surface.borderSubtle}`, cursor: "pointer" }}
                >
                  Ajouter un message
                </button>
              </div>
            </div>

            {activePanel === "checklist" && (
              <TaskDetailPanel onClose={() => setActivePanel(null)}>
                <TaskPanelHeading title="Ajouter un élément" description="Valide pour l'ajouter au champ checklist." />
                <form onSubmit={addChecklistItem} className="flex items-center gap-2 mt-2">
                  <input
                    value={newChecklistLabel}
                    onChange={(event) => setNewChecklistLabel(event.target.value)}
                    placeholder="Ajouter un élément à la checklist"
                    style={{ ...fieldStyle(), padding: "0.55rem 0.75rem", fontSize: "0.85rem" }}
                  />
                  <button
                    type="submit"
                    className="px-3 py-2 rounded-lg text-[12px] font-semibold shrink-0"
                    style={{ background: uiAccent, color: "#FFFFFF", border: "none", cursor: "pointer" }}
                  >
                    Valider
                  </button>
                </form>
              </TaskDetailPanel>
            )}

            {activePanel === "date" && (
              <TaskDetailPanel onClose={() => setActivePanel(null)}>
                <TaskPanelHeading title="Date prévue" description="Planifie l'échéance directement dans la tâche." />
                <div className="grid gap-2 sm:grid-cols-[1fr_0.7fr]">
                  <input
                    type="date"
                    value={dueDate}
                    onChange={(event) => setDueDate(event.target.value)}
                    style={fieldStyle()}
                  />
                  <input
                    type="time"
                    value={dueTime}
                    onChange={(event) => setDueTime(event.target.value)}
                    style={fieldStyle()}
                  />
                </div>
                {(dueDate !== (task.dueDate ?? "") || dueTime !== (task.dueTime ?? "")) && (
                  <div className="mt-3">
                    <label className="text-[10px] font-semibold uppercase tracking-[0.14em]" style={{ color: text.muted }}>
                      Pourquoi ce changement ?
                    </label>
                    <textarea
                      value={scheduleChangeNote}
                      onChange={(event) => setScheduleChangeNote(event.target.value)}
                      placeholder="Exemple : échéance recalée avec le fournisseur, report validé, priorité avancée..."
                      rows={3}
                      className="mt-2 w-full rounded-xl px-3 py-2.5 text-xs outline-none resize-none"
                      style={{ background: surface.s1, color: text.primary, border: `1px solid ${surface.border}` }}
                    />
                    <p className="mt-1.5 text-[10px] leading-relaxed" style={{ color: text.muted }}>
                      Ce détail sera conservé dans la tâche au moment de l’enregistrement.
                    </p>
                  </div>
                )}
                <div className="mt-2 flex items-center justify-end gap-2">
                  <button
                    type="button"
                    onClick={clearSchedule}
                    className="rounded-lg px-3 py-2 text-[11px] font-semibold"
                    style={{ background: surface.s2, color: text.muted, border: `1px solid ${surface.border}`, cursor: "pointer" }}
                  >
                    Effacer
                  </button>
                  <button
                    type="button"
                    onClick={commitSchedule}
                    disabled={(dueDate !== (task.dueDate ?? "") || dueTime !== (task.dueTime ?? "")) && !scheduleChangeNote.trim()}
                    className="rounded-lg px-3 py-2 text-[11px] font-semibold"
                    style={{
                      background: (dueDate !== (task.dueDate ?? "") || dueTime !== (task.dueTime ?? "")) && !scheduleChangeNote.trim() ? surface.s3 : uiAccent,
                      color: (dueDate !== (task.dueDate ?? "") || dueTime !== (task.dueTime ?? "")) && !scheduleChangeNote.trim() ? text.dim : "#FFFFFF",
                      border: "none",
                      cursor: (dueDate !== (task.dueDate ?? "") || dueTime !== (task.dueTime ?? "")) && !scheduleChangeNote.trim() ? "not-allowed" : "pointer",
                    }}
                  >
                    Enregistrer
                  </button>
                </div>
              </TaskDetailPanel>
            )}

            {activePanel === "person" && (
              <TaskDetailPanel onClose={() => setActivePanel(null)}>
                <TaskPanelHeading title="Personne et équipes" description="Associe un responsable ou une équipe à cette tâche." />
                <div className="grid gap-2">
                  {projectPeople.length > 0 && (
                    <select
                      value={selectedPersonId}
                      onChange={(event) => {
                        const person = projectPeople.find((candidate) => candidate.id === event.target.value);
                        setSelectedPersonId(event.target.value);
                        if (person) setOwner(person.name);
                      }}
                      style={fieldStyle()}
                    >
                      <option value="">Sélectionner une personne du projet</option>
                      {projectPeople.map((person) => (
                        <option key={person.id} value={person.id}>
                          {person.name}{person.role ? ` · ${person.role}` : ""}
                        </option>
                      ))}
                    </select>
                  )}
                  <input
                    value={owner}
                    onChange={(event) => setOwner(event.target.value)}
                    placeholder="Associer à une personne"
                    style={fieldStyle()}
                  />
                  {projectTeams.length > 0 && (
                    <div className="rounded-xl p-3" style={{ background: surface.s2, border: `1px solid ${surface.borderSubtle}` }}>
                      <p className="mb-2 text-[11px] font-semibold uppercase tracking-[0.12em]" style={{ color: text.muted }}>
                        Équipes liées
                      </p>
                      <div className="flex flex-wrap gap-2">
                        {projectTeams.map((team) => {
                          const selected = selectedTeamIds.includes(team.id);
                          return (
                            <button
                              key={team.id}
                              type="button"
                              onClick={() => toggleTeam(team.id)}
                              className="rounded-full px-2.5 py-1 text-[11px] font-semibold"
                              style={{
                                background: selected ? team.color ?? uiAccent : surface.s1,
                                color: selected ? "#FFFFFF" : text.secondary,
                                border: `1px solid ${selected ? team.color ?? uiAccent : surface.border}`,
                                cursor: "pointer",
                              }}
                            >
                              {team.name}
                            </button>
                          );
                        })}
                      </div>
                    </div>
                  )}
                </div>
                <div className="mt-2 flex items-center justify-end gap-2">
                  <button
                    type="button"
                    onClick={clearOwner}
                    className="rounded-lg px-3 py-2 text-[11px] font-semibold"
                    style={{ background: surface.s2, color: text.muted, border: `1px solid ${surface.border}`, cursor: "pointer" }}
                  >
                    Effacer
                  </button>
                  <button
                    type="button"
                    onClick={commitOwner}
                    className="rounded-lg px-3 py-2 text-[11px] font-semibold"
                    style={{ background: uiAccent, color: "#FFFFFF", border: "none", cursor: "pointer" }}
                  >
                    Valider
                  </button>
                </div>
              </TaskDetailPanel>
            )}

            {activePanel === "files" && (
              <TaskDetailPanel onClose={() => setActivePanel(null)}>
                <TaskPanelHeading title="Fichiers de la tâche" description="Ces fichiers restent accessibles ici et remontent aussi dans les fichiers du projet." />
                <input
                  ref={fileInputRef}
                  type="file"
                  multiple
                  className="hidden"
                  onChange={handleTaskFilesChange}
                />
                <button
                  type="button"
                  onClick={() => fileInputRef.current?.click()}
                  className="mb-3 rounded-xl px-3 py-2 text-[12px] font-semibold"
                  style={{ background: uiAccent, color: "#FFFFFF", border: "none", cursor: "pointer" }}
                >
                  Ajouter un fichier
                </button>
                {uploadError && (
                  <div className="mb-3 rounded-xl px-3 py-2 text-xs font-medium" style={{ background: errorTokens.bg, color: errorTokens.text, border: `1px solid ${errorTokens.border}` }}>
                    {uploadError}
                  </div>
                )}
                {taskFiles.length === 0 ? (
                  <div className="rounded-xl px-3 py-3 text-[12px]" style={{ background: surface.s2, color: text.muted, border: `1px dashed ${surface.border}` }}>
                    Aucun fichier lié à cette tâche.
                  </div>
                ) : (
                  <div className="grid gap-2">
                    {taskFiles.map((file) => {
                      const meta = projectFileTypeMeta[file.ext];
                      return (
                        <div key={file.id} className="rounded-xl p-3" style={{ background: surface.s2, border: `1px solid ${surface.borderSubtle}` }}>
                          <div className="flex items-center gap-2">
                            <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg text-[9px] font-bold" style={{ background: surface.s1, color: meta.color, border: `1px solid ${meta.color}` }}>
                              {meta.label}
                            </span>
                            <div className="min-w-0 flex-1">
                              <p className="truncate text-xs font-semibold" style={{ color: text.primary }}>
                                {file.name}
                              </p>
                              <p className="mt-0.5 text-[11px]" style={{ color: text.muted }}>
                                {[file.size, file.addedAt].filter(Boolean).join(" · ")}
                              </p>
                            </div>
                          </div>
                          <div className="mt-2 flex items-center gap-1.5">
                            <a href={buildProjectFileHref(projectId, file.id)} target="_blank" rel="noreferrer" className="rounded-lg px-2 py-1 text-[10px] font-semibold" style={{ background: surface.s1, color: text.secondary, border: `1px solid ${surface.border}` }}>
                              Ouvrir
                            </a>
                            <a href={buildProjectFileHref(projectId, file.id, "download")} className="rounded-lg px-2 py-1 text-[10px] font-semibold" style={{ background: surface.s1, color: text.secondary, border: `1px solid ${surface.border}` }}>
                              Télécharger
                            </a>
                            <button
                              type="button"
                              onClick={() => handleTaskFileDelete(file.id)}
                              className="ml-auto inline-flex items-center gap-1 rounded-lg px-2 py-1 text-[10px] font-semibold"
                              style={{ background: surface.s1, color: deleteTone.text, border: `1px solid ${deleteTone.border}`, cursor: "pointer" }}
                            >
                              <TrashIcon size={11} />
                              Supprimer
                            </button>
                          </div>
                        </div>
                      );
                    })}
                  </div>
                )}
              </TaskDetailPanel>
            )}

            {activePanel === "discussion" && (
              <TaskDetailPanel onClose={() => setActivePanel(null)} variant="discussion">
                <TaskPanelHeading title="Discussion de tâche" description="Échanges humains liés uniquement à cette tâche, séparés du pilotage global du projet." />
                <div
                  className="mb-3 min-h-0 flex-1 rounded-2xl p-3"
                  style={{
                    background: surface.s2,
                    display: "flex",
                    flexDirection: "column",
                  }}
                >
                  <div className="min-h-0 flex-1 overflow-y-auto pr-1">
                  {discussion.length === 0 ? (
                    <p className="text-[12px]" style={{ color: text.muted }}>
                      Aucun échange sur cette tâche.
                    </p>
                  ) : (
                    <div className="flex flex-col gap-2">
                      {discussion.map((message, index) => (
                        <ChatBubble key={message.id} message={message} sent={index % 2 === 1} />
                      ))}
                    </div>
                  )}
                  </div>
                </div>
                <form onSubmit={addDiscussionMessage} className="grid gap-2">
                  <div className="rounded-xl px-3 py-2 text-[11px]" style={{ background: surface.s2, color: text.muted }}>
                    Envoyé comme <strong style={{ color: text.secondary }}>{getActiveAccountName()}</strong>
                  </div>
                  <textarea
                    value={discussionText}
                    onChange={(event) => setDiscussionText(event.target.value)}
                    rows={3}
                    placeholder="Ajouter un message lié à cette tâche..."
                    style={{ ...fieldStyle(), resize: "vertical" }}
                  />
                  <div className="flex justify-end">
                    <button type="submit" className="rounded-lg px-3 py-2 text-[11px] font-semibold" style={{ background: uiAccent, color: "#FFFFFF", border: "none", cursor: "pointer" }}>
                      Ajouter le message
                    </button>
                  </div>
                </form>
              </TaskDetailPanel>
            )}

            {activePanel === "note" && (
              <TaskDetailPanel onClose={() => setActivePanel(null)}>
                <TaskPanelHeading title="Note" description="Ajoute une précision courte, une trace ou un point à garder." />
                <textarea
                  value={commentsText}
                  onChange={(event) => setCommentsText(event.target.value)}
                  rows={3}
                  placeholder="Une note par ligne : échange, précision, point à garder en tête..."
                  style={{ ...fieldStyle(), resize: "vertical" }}
                />
                <div className="mt-2 flex items-center justify-end gap-2">
                  <button
                    type="button"
                    onClick={clearComments}
                    className="rounded-lg px-3 py-2 text-[11px] font-semibold"
                    style={{ background: surface.s2, color: text.muted, border: `1px solid ${surface.border}`, cursor: "pointer" }}
                  >
                    Effacer
                  </button>
                  <button
                    type="button"
                    onClick={commitComments}
                    className="rounded-lg px-3 py-2 text-[11px] font-semibold"
                    style={{ background: uiAccent, color: "#FFFFFF", border: "none", cursor: "pointer" }}
                  >
                    Valider
                  </button>
                </div>
              </TaskDetailPanel>
            )}
          </div>
        </div>

        <footer
          className="flex shrink-0 items-center justify-between gap-3 px-5 py-3"
          style={{ background: surface.s1, borderTop: `1px solid ${surface.borderSubtle}` }}
        >
          <p className="text-[11px] leading-snug" style={{ color: hasUnsavedChanges ? text.secondary : text.muted }}>
            {hasUnsavedChanges
              ? "Modifications en brouillon. Elles seront appliquées après enregistrement."
              : "Aucune modification en attente."}
          </p>
          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={handleCancel}
              className="rounded-xl px-3.5 py-2 text-[12px] font-semibold"
              style={{ background: surface.s2, color: text.secondary, border: `1px solid ${surface.border}`, cursor: "pointer" }}
            >
              Annuler
            </button>
            <button
              type="button"
              onClick={handleSave}
              disabled={!hasUnsavedChanges}
              className="rounded-xl px-4 py-2 text-[12px] font-semibold"
              style={{
                background: hasUnsavedChanges ? uiAccent : surface.s2,
                color: hasUnsavedChanges ? "#FFFFFF" : text.muted,
                border: `1px solid ${hasUnsavedChanges ? uiAccent : surface.border}`,
                cursor: hasUnsavedChanges ? "pointer" : "default",
              }}
            >
              Enregistrer
            </button>
          </div>
        </footer>
      </aside>
    </>
  );
}

function ChatBubble({
  message,
  sent,
  compact = false,
}: {
  message: TaskDiscussionMessage;
  sent: boolean;
  compact?: boolean;
}) {
  return (
    <div className={`flex ${sent ? "justify-end" : "justify-start"}`}>
      <div
        className={`${compact ? "max-w-[88%] px-2.5 py-1.5" : "max-w-[82%] px-3 py-2"} rounded-2xl`}
        style={{
          background: sent ? statusColor.green.bg : surface.s1,
          color: text.primary,
          borderTopRightRadius: sent ? 6 : 16,
          borderTopLeftRadius: sent ? 16 : 6,
        }}
      >
        <div className="mb-0.5 flex items-center justify-between gap-2">
          <span className="truncate text-[10px] font-semibold" style={{ color: sent ? statusColor.green.text : text.muted }}>
            {message.authorName}
          </span>
          <span className="shrink-0 text-[9px]" style={{ color: text.dim }}>
            {formatShortDateTime(message.createdAt)}
          </span>
        </div>
        <p className={`${compact ? "text-[10px]" : "text-[11px]"} leading-relaxed`} style={{ color: text.secondary }}>
          {message.content}
        </p>
      </div>
    </div>
  );
}

type SecondaryTaskActionIcon = "checklist" | "calendar" | "person" | "file" | "discussion" | "note";
const TASK_STATUS_ORDER: TaskStatus[] = ["todo", "in_progress", "waiting", "blocked", "done"];

const DEFAULT_TASK_STATUS_TONES: Record<TaskStatus, { background: string; color: string; border: string }> = {
  todo: { background: surface.s2, color: text.muted, border: surface.borderSubtle },
  in_progress: { background: statusColor.yellow.bg, color: statusColor.yellow.text, border: statusColor.yellow.text },
  waiting: { background: statusColor.blue.bg, color: statusColor.blue.text, border: statusColor.blue.text },
  blocked: { background: statusColor.red.bg, color: statusColor.red.text, border: statusColor.red.text },
  done: { background: statusColor.green.bg, color: statusColor.green.text, border: statusColor.green.text },
};

function getTaskStatusOptionMeta(status: TaskStatus, settings?: ProjectStatusSettings) {
  const custom = settings?.task?.[status];
  const tone = DEFAULT_TASK_STATUS_TONES[status];
  return {
    status,
    label: custom?.label ?? taskStatusLabels[status],
    background: custom?.color ? `${custom.color}20` : tone.background,
    color: custom?.color ?? tone.color,
    border: custom?.color ?? tone.border,
  };
}

function EditableInfoRow({
  icon,
  label,
  value,
  empty,
  onClick,
  accentColor,
}: {
  icon: SecondaryTaskActionIcon;
  label: string;
  value: string;
  empty?: boolean;
  onClick: () => void;
  accentColor: string;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className="flex min-w-0 items-center gap-1 rounded-xl px-1.5 py-1.5 text-left"
      style={{
        background: surface.s1,
        border: `1px solid ${surface.borderSubtle}`,
        cursor: "pointer",
      }}
    >
      <span className="inline-flex h-4 w-4 shrink-0 items-center justify-center" style={{ color: text.muted }}>
        <SecondaryIcon icon={icon} />
      </span>
      <span className="min-w-0 flex-1">
        <span className="block truncate text-[10px] font-semibold" style={{ color: empty ? accentColor : text.secondary }} title={label}>
          {value}
        </span>
      </span>
    </button>
  );
}

function IconButton({ title, onClick }: { title: string; onClick: () => void }) {
  return (
    <button
      type="button"
      onClick={onClick}
      className="flex h-7 w-7 shrink-0 items-center justify-center rounded-lg"
      style={{
        background: surface.s1,
        color: deleteTone.text,
        border: `1px solid ${deleteTone.border}`,
        cursor: "pointer",
      }}
      title={title}
      aria-label={title}
    >
      <TrashIcon size={13} />
    </button>
  );
}

function TaskDetailPanel({
  children,
  onClose,
  variant = "default",
}: {
  children: ReactNode;
  onClose: () => void;
  variant?: "default" | "discussion";
}) {
  const isDiscussion = variant === "discussion";

  return (
    <>
      <button
        type="button"
        aria-label="Fermer le panneau"
        onClick={onClose}
        className="mb-modal-backdrop"
        style={{
          position: "fixed",
          inset: 0,
          zIndex: 70,
          border: "none",
          cursor: "default",
        }}
      />
      <div
        className="mb-modal-surface rounded-2xl p-4"
        style={{
          position: "fixed",
          top: "50%",
          left: "50%",
          transform: "translate(-50%, -50%)",
          width: isDiscussion ? "min(640px, calc(100vw - 32px))" : "min(520px, calc(100vw - 32px))",
          height: isDiscussion ? "min(620px, calc(100dvh - 64px))" : undefined,
          maxHeight: isDiscussion ? undefined : "min(560px, calc(100dvh - 64px))",
          overflowY: isDiscussion ? "hidden" : "auto",
          zIndex: 80,
          display: isDiscussion ? "flex" : undefined,
          flexDirection: isDiscussion ? "column" : undefined,
        }}
      >
        <button
          type="button"
          onClick={onClose}
          className="absolute right-3 top-3 flex h-8 w-8 items-center justify-center rounded-lg"
          style={{ background: surface.s2, color: text.secondary, border: `1px solid ${surface.border}`, cursor: "pointer" }}
          title="Fermer"
        >
          <svg width="13" height="13" viewBox="0 0 16 16" fill="none" aria-hidden="true">
            <path d="m4 4 8 8M12 4l-8 8" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" />
          </svg>
        </button>
        {children}
      </div>
    </>
  );
}

function TaskPanelHeading({ title, description }: { title: string; description?: string }) {
  return (
    <div className="mb-2">
      <p className="text-[11px] font-semibold" style={{ color: text.primary }}>
        {title}
      </p>
      {description && (
        <p className="text-[10px] mt-0.5" style={{ color: text.dim }}>
          {description}
        </p>
      )}
    </div>
  );
}

function SecondaryIcon({ icon }: { icon: SecondaryTaskActionIcon }) {
  const size = icon === "calendar" || icon === "person" || icon === "file" ? 14 : 12;

  if (icon === "checklist") {
    return (
      <svg width={size} height={size} viewBox="0 0 16 16" fill="none" aria-hidden="true">
        <path d="m3 4 1.2 1.2L6.4 3M8 4.2h5M3 10.8 4.2 12l2.2-2.2M8 11h5" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
      </svg>
    );
  }

  if (icon === "calendar") {
    return (
      <svg width={size} height={size} viewBox="0 0 16 16" fill="none" aria-hidden="true">
        <path d="M4.5 2.5v2M11.5 2.5v2M3 6.25h10M4.25 3.5h7.5A1.75 1.75 0 0 1 13.5 5.25v6.5a1.75 1.75 0 0 1-1.75 1.75h-7.5A1.75 1.75 0 0 1 2.5 11.75v-6.5A1.75 1.75 0 0 1 4.25 3.5Z" stroke="currentColor" strokeWidth="1.4" strokeLinecap="round" strokeLinejoin="round" />
      </svg>
    );
  }

  if (icon === "person") {
    return (
      <svg width={size} height={size} viewBox="0 0 16 16" fill="none" aria-hidden="true">
        <path d="M8 8.2a2.6 2.6 0 1 0 0-5.2 2.6 2.6 0 0 0 0 5.2ZM3.3 13.2c.7-2 2.3-3.1 4.7-3.1s4 1.1 4.7 3.1" stroke="currentColor" strokeWidth="1.4" strokeLinecap="round" />
      </svg>
    );
  }

  if (icon === "file") {
    return (
      <svg width={size} height={size} viewBox="0 0 16 16" fill="none" aria-hidden="true">
        <path d="M5 2.5h4.1L12.8 6v7.5H5A1.8 1.8 0 0 1 3.2 11.7V4.3A1.8 1.8 0 0 1 5 2.5Z" stroke="currentColor" strokeWidth="1.4" strokeLinejoin="round" />
        <path d="M9 2.7V6h3.4" stroke="currentColor" strokeWidth="1.4" strokeLinecap="round" strokeLinejoin="round" />
      </svg>
    );
  }

  if (icon === "discussion") {
    return (
      <svg width={size} height={size} viewBox="0 0 16 16" fill="none" aria-hidden="true">
        <path d="M4.5 3.2h7A1.5 1.5 0 0 1 13 4.7v4.8A1.5 1.5 0 0 1 11.5 11H8.2L5 13.2V11h-.5A1.5 1.5 0 0 1 3 9.5V4.7a1.5 1.5 0 0 1 1.5-1.5Z" stroke="currentColor" strokeWidth="1.4" strokeLinejoin="round" />
        <path d="M6 6.4h4M6 8.5h2.7" stroke="currentColor" strokeWidth="1.4" strokeLinecap="round" />
      </svg>
    );
  }

  return (
    <svg width={size} height={size} viewBox="0 0 16 16" fill="none" aria-hidden="true">
      <path d="M4.5 3.2h7A1.5 1.5 0 0 1 13 4.7v5.1a1.5 1.5 0 0 1-1.5 1.5H7.2L4 13.4v-8.7a1.5 1.5 0 0 1 1.5-1.5Z" stroke="currentColor" strokeWidth="1.4" strokeLinejoin="round" />
      <path d="M6.2 6.4h4.3M6.2 8.6h3" stroke="currentColor" strokeWidth="1.4" strokeLinecap="round" />
    </svg>
  );
}

function formatScheduleLabel(dueDate: string | undefined, dueTime: string | undefined) {
  if (!dueDate) return "Date prévue";
  return formatTaskScheduleDate(dueDate, dueTime);
}

function Section({
  title,
  children,
  action,
  description,
}: {
  title: string;
  children: ReactNode;
  action?: ReactNode;
  description?: string;
}) {
  return (
    <section
      className="rounded-2xl p-3"
      style={{
        background: surface.s2,
        border: `1px solid ${surface.border}`,
        boxShadow: "inset 0 1px 0 var(--mb-card-highlight)",
      }}
    >
      <div className="flex items-center justify-between gap-2 mb-2">
        <div>
          <p
            className="text-[10px] font-semibold uppercase tracking-[0.14em]"
            style={{ color: text.muted }}
          >
            {title}
          </p>
          {description && (
            <p className="text-[10px] mt-0.5" style={{ color: text.dim }}>
              {description}
            </p>
          )}
        </div>
        {action}
      </div>
      {children}
    </section>
  );
}

function DetailTag({
  label,
  icon,
  color = text.secondary,
  background = surface.s2,
  border = surface.borderSubtle,
  dotColor,
}: {
  label: string;
  icon?: ReactNode;
  color?: string;
  background?: string;
  border?: string;
  /** Si fourni, affiche un petit point de cette couleur à gauche du label
   *  (utilisé pour les pills sobres statut/priorité). */
  dotColor?: string;
}) {
  return (
    <span
      className="rounded-full px-2 py-0.5 text-[10px] font-medium inline-flex items-center gap-1.5"
      style={{ color, background, border: `1px solid ${border}` }}
    >
      {dotColor && (
        <span
          aria-hidden
          style={{ width: 7, height: 7, borderRadius: "50%", background: dotColor, display: "inline-block", flexShrink: 0 }}
        />
      )}
      {icon}
      {label}
    </span>
  );
}

function fieldStyle(): CSSProperties {
  return {
    width: "100%",
    borderRadius: "0.8rem",
    border: `1px solid ${surface.border}`,
    background: surface.s1,
    color: text.primary,
    fontSize: "0.76rem",
    padding: "0.62rem 0.72rem",
    outline: "none",
  };
}
