"use client";

import { useEffect, useMemo, useRef, useState, useTransition, type ReactNode } from "react";
import { createPortal } from "react-dom";
import { useRouter } from "next/navigation";
import { error as errorTokens, statusColor, surface, text } from "@/lib/design-tokens";
import type { ChecklistItem, ProjectStatusSettings, ProjectTeam, Task, TaskDiscussionMessage, TaskStatus } from "@/lib/mock-data";
import { addTaskDiscussionMessageAction } from "@/app/dashboard/projects/[id]/actions";
import {
  suggestTaskChecklistAction,
  applyAIChecklistAction,
} from "@/app/dashboard/projects/ai-actions";
import { ExpectedAssistant } from "@/components/projects/expected-assistant";
import { RealizationAssistant } from "@/components/projects/realization-assistant";
import { Button } from "@/components/ui/button";
import { formatTaskScheduleDate } from "@/lib/date-format";
import { deriveTaskDisplayPriority, deriveTaskStatus, taskStatusLabels } from "@/lib/project-plan";
import { priorityVisuals, type ProjectPriority } from "@/lib/project-taxonomy";
import { workspaceTheme, type Workspace } from "@/lib/workspace";
import { useAccountName, useIsPaidPlan } from "@/components/account/account-context";
import { useT } from "@/components/i18n/locale-provider";
import { useStatusLabel, usePriorityLabel } from "@/components/i18n/labels";

interface TaskExpandedPreviewProps {
  task: Task;
  accentColor: string;
  workspace?: Workspace;
  projectId?: string;
  stepId?: string;
  projectTeams?: ProjectTeam[];
  projectPeople?: Array<{ id: string; name: string }>;
  statusSettings?: ProjectStatusSettings;
  onUpdate?: (input: {
    title?: string;
    expected?: string;
    realization?: string;
    comments?: string[];
    dueDate?: string;
    dueTime?: string;
    owner?: string;
    assignees?: string[];
    teamIds?: string[];
    priority?: ProjectPriority;
    status?: TaskStatus;
  }) => void;
  onChecklistMutated?: (next: ChecklistItem[]) => void;
  /** Envoi d'un message de discussion hors projet (tâches libres). Quand il est
   *  fourni, la discussion fonctionne sans projectId/stepId : c'est ce callback
   *  qui persiste le message (cf. tâches autonomes). */
  onSendDiscussionMessage?: (content: string) => Promise<void> | void;
  className?: string;
}

export function TaskExpandedPreview({
  task,
  accentColor,
  workspace,
  projectId,
  stepId,
  projectTeams = [],
  projectPeople = [],
  statusSettings,
  onUpdate,
  onChecklistMutated,
  onSendDiscussionMessage,
  className = "",
}: TaskExpandedPreviewProps) {
  // Couleur des boutons / accents IA = couleur de l'ENVIRONNEMENT (Pro/Perso),
  // pas la couleur du thème projet.
  const aiAccent = workspace ? workspaceTheme[workspace].accent : accentColor;

  return (
    <div className={`mb-task-expanded-preview ${className}`} onClick={(event) => event.stopPropagation()}>
      {/* Le bloc « Informations » est désormais intégré à la barre de titre du
          drawer (fixe), il n'est donc plus rendu ici. */}
      <div className="mb-task-expanded-preview-grid">
        <TaskPreviewPane>
          <ExpectedField
            task={task}
            onUpdate={onUpdate}
            accentColor={accentColor}
            aiAccent={aiAccent}
            projectId={projectId}
            stepId={stepId}
          />
          <FilesField task={task} accentColor={aiAccent} />
        </TaskPreviewPane>

        <TaskPreviewPane>
          {/* Checklist au-dessus de Réalisation : on coche les sous-actions
              au fur et à mesure du travail, puis on note ce qui a été
              réellement livré dans Réalisation. L'ordre suit le flux
              naturel d'avancement de la tâche. */}
          <ChecklistField
            task={task}
            onChecklistMutated={onChecklistMutated}
            accentColor={accentColor}
            aiAccent={aiAccent}
            projectId={projectId}
            stepId={stepId}
          />
          <RealizationField task={task} onUpdate={onUpdate} accentColor={accentColor} bulletAccent={aiAccent} aiAccent={aiAccent} />
        </TaskPreviewPane>

        <TaskPreviewPane>
          <NoteField task={task} onUpdate={onUpdate} accentColor={accentColor} bulletAccent={aiAccent} />
          <DiscussionField
            task={task}
            projectId={projectId}
            stepId={stepId}
            accentColor={accentColor}
            projectPeople={projectPeople}
            onSendMessage={onSendDiscussionMessage}
          />
        </TaskPreviewPane>
      </div>
    </div>
  );
}

// ─── Field wrappers ────────────────────────────────────────────────────────

// Regroupement d'une colonne de champs. Volontairement « nu » (pas de
// carte) : les cartes blanches sont les FieldShell eux-mêmes, qui
// flottent directement sur le conteneur gris — comme les cartes-tâches
// dans une étape de projet. Empiler une carte blanche (pane) autour de
// cartes blanches (FieldShell) créait une superposition inutile.
function TaskPreviewPane({ children }: { children: ReactNode }) {
  return (
    <section
      style={{
        display: "flex",
        flexDirection: "column",
        gap: 10,
      }}
    >
      {children}
    </section>
  );
}

interface FieldShellProps {
  title: string;
  icon: TaskPreviewIconName;
  iconColor: string;
  rightLabel?: string;
  rightSlot?: ReactNode;
  children: ReactNode;
}

function FieldShell({ title, icon, iconColor, rightLabel, rightSlot, children }: FieldShellProps) {
  return (
    <section
      style={{
        display: "flex",
        flexDirection: "column",
        gap: 8,
        // Même langage que les cartes-tâches du projet : carte blanche
        // surélevée (ombre + bordure fine + arrondi) sur le conteneur gris.
        background: surface.s1,
        border: `1px solid ${surface.borderSubtle}`,
        borderRadius: 14,
        boxShadow: "var(--mb-shadow-card)",
        padding: 12,
      }}
    >
      <div className="flex items-center justify-between gap-2">
        <div className="flex items-center gap-2">
          <TaskPreviewIcon icon={icon} color={iconColor} />
          <h4
            style={{
              fontSize: 11,
              fontWeight: 600,
              color: text.primary,
              margin: 0,
              textTransform: "uppercase",
              letterSpacing: "0.08em",
            }}
          >
            {title}
          </h4>
        </div>
        <div className="flex items-center gap-1.5">
          {rightLabel && (
            <span style={{ fontSize: 10.5, fontWeight: 600, color: text.muted, fontVariantNumeric: "tabular-nums" }}>
              {rightLabel}
            </span>
          )}
          {rightSlot}
        </div>
      </div>
      {children}
    </section>
  );
}

function AIChip({
  label,
  accentColor,
  onClick,
  disabled,
}: {
  label: string;
  accentColor: string;
  onClick: () => void;
  disabled?: boolean;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      disabled={disabled}
      className="inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-[10px] font-semibold"
      style={{
        background: accentColor,
        color: "#FFFFFF",
        border: "none",
        cursor: disabled ? "wait" : "pointer",
        opacity: disabled ? 0.6 : 1,
        letterSpacing: 0,
      }}
      title="Demander une suggestion à l'IA"
    >
      <svg width="9" height="9" viewBox="0 0 16 16" fill="none" aria-hidden="true">
        <path
          d="M8 2.5v3M8 10.5v3M2.5 8h3M10.5 8h3M4.5 4.5l1.5 1.5M10 10l1.5 1.5M4.5 11.5L6 10M10 6l1.5-1.5"
          stroke="currentColor"
          strokeWidth="1.5"
          strokeLinecap="round"
        />
      </svg>
      {label}
    </button>
  );
}

function fieldInputStyle() {
  return {
    width: "100%",
    background: surface.s2,
    border: `1px solid ${surface.borderSubtle}`,
    borderRadius: 8,
    padding: "10px 12px",
    fontSize: 12.5,
    fontFamily: "inherit",
    color: text.primary,
    lineHeight: 1.55,
    outline: "none",
    resize: "vertical" as const,
    minHeight: 140,
    transition: "border-color 120ms var(--mb-ease), box-shadow 120ms var(--mb-ease)",
  };
}

function FieldActions({
  dirty,
  onSave,
  onCancel,
  saveLabel,
  busy = false,
  accentColor,
}: {
  dirty: boolean;
  onSave: () => void;
  onCancel: () => void;
  saveLabel?: string;
  busy?: boolean;
  accentColor: string;
}) {
  const t = useT();
  if (!dirty) return null;
  return (
    <div className="flex items-center gap-1.5">
      <Button variant="primary" size="sm" accentColor={accentColor} onClick={onSave} disabled={busy}>
        {busy ? t("task.saving") : (saveLabel ?? t("task.save"))}
      </Button>
      <Button variant="ghost" size="sm" onClick={onCancel} disabled={busy}>
        {t("task.cancel")}
      </Button>
    </div>
  );
}

// ─── Sections éditables ────────────────────────────────────────────────────

function ExpectedField({
  task,
  onUpdate,
  accentColor,
  aiAccent,
  projectId,
  stepId,
}: {
  task: Task;
  onUpdate?: TaskExpandedPreviewProps["onUpdate"];
  accentColor: string;
  aiAccent: string;
  projectId?: string;
  stepId?: string;
}) {
  const initial = task.expected ?? task.description ?? "";
  const t = useT();
  const [value, setValue] = useState(initial);
  const [assistantOpen, setAssistantOpen] = useState(false);
  useEffect(() => setValue(initial), [initial]);

  const isPaid = useIsPaidPlan();
  const dirty = value.trim() !== initial.trim();
  const editable = Boolean(onUpdate);
  const aiAvailable = Boolean(projectId && stepId) && isPaid;

  return (
    <FieldShell
      title={t("task.expected")}
      icon="expected"
      iconColor={accentColor}
      rightSlot={
        aiAvailable ? (
          <AIChip
            label={t("task.aiAssistant")}
            accentColor={aiAccent}
            onClick={() => setAssistantOpen(true)}
            disabled={!editable}
          />
        ) : undefined
      }
    >
      <textarea
        value={value}
        onChange={(event) => setValue(event.target.value)}
        placeholder="Ex : Comparer les fournisseurs et choisir l'option la plus fiable…"
        className="mb-input"
        style={fieldInputStyle()}
        readOnly={!editable}
        disabled={!editable}
      />
      <FieldActions
        dirty={dirty}
        onSave={() => onUpdate?.({ expected: value.trim() })}
        onCancel={() => setValue(initial)}
        accentColor={accentColor}
      />
      {assistantOpen && projectId && stepId && (
        <ExpectedAssistant
          projectId={projectId}
          stepId={stepId}
          taskId={task.id}
          currentExpected={value.trim()}
          accentColor={aiAccent}
          onApply={(textValue) => {
            setValue(textValue);
            setAssistantOpen(false);
          }}
          onClose={() => setAssistantOpen(false)}
        />
      )}
    </FieldShell>
  );
}

// Champs Réalisation et Note : chaque ligne est une puce visuelle (rond
// coloré aux couleurs du workspace). Entrée crée une nouvelle ligne,
// Backspace au début fusionne avec la ligne précédente.

function parseBulletRows(text: string | undefined | null): string[] {
  if (!text) return [""];
  const rows = text
    .split("\n")
    .map((line) => line.replace(/^•\s*/, "").trim())
    .filter(Boolean);
  return rows.length > 0 ? rows : [""];
}

function rowsToString(rows: string[]): string {
  return rows
    .map((row) => row.trim())
    .filter(Boolean)
    .join("\n");
}

function rowsEqual(a: string[], b: string[]): boolean {
  const ca = a.map((r) => r.trim()).filter(Boolean);
  const cb = b.map((r) => r.trim()).filter(Boolean);
  if (ca.length !== cb.length) return false;
  return ca.every((row, index) => row === cb[index]);
}

interface BulletListEditorProps {
  rows: string[];
  onChange: (next: string[]) => void;
  bulletColor: string;
  placeholder: string;
  minHeight?: number;
  editable: boolean;
}

function BulletListEditor({
  rows,
  onChange,
  bulletColor,
  placeholder,
  minHeight = 140,
  editable,
}: BulletListEditorProps) {
  const inputsRef = useRef<Array<HTMLTextAreaElement | null>>([]);

  // Ajuste la hauteur d'un textarea pour qu'il colle exactement à son contenu.
  // Les lignes longues passent à la ligne automatiquement (white-space: pre-wrap)
  // sans débordement horizontal ni ascenseur visible.
  function autoSize(textarea: HTMLTextAreaElement | null) {
    if (!textarea) return;
    textarea.style.height = "auto";
    textarea.style.height = `${textarea.scrollHeight}px`;
  }
  const focusTargetRef = useRef<{ index: number; caret: number } | null>(null);

  useEffect(() => {
    // À chaque changement de rows (typing, paste, props), on ajuste la
    // hauteur de tous les textareas pour qu'ils collent à leur contenu.
    inputsRef.current.forEach((el) => autoSize(el));
    const target = focusTargetRef.current;
    if (!target) return;
    focusTargetRef.current = null;
    const input = inputsRef.current[target.index];
    if (!input) return;
    input.focus();
    const caret = Math.min(target.caret, input.value.length);
    input.setSelectionRange(caret, caret);
  }, [rows]);

  function commit(next: string[], focus?: { index: number; caret: number }) {
    if (focus) focusTargetRef.current = focus;
    onChange(next);
  }

  function updateRow(index: number, value: string) {
    const next = rows.map((row, i) => (i === index ? value : row));
    commit(next);
  }

  function handleKeyDown(event: React.KeyboardEvent<HTMLTextAreaElement>, index: number) {
    const input = event.currentTarget;
    const caret = input.selectionStart ?? 0;
    const caretEnd = input.selectionEnd ?? caret;

    if (event.key === "Enter" && !event.shiftKey) {
      event.preventDefault();
      const before = input.value.slice(0, caret);
      const after = input.value.slice(caretEnd);
      const next = [...rows];
      next[index] = before;
      next.splice(index + 1, 0, after);
      commit(next, { index: index + 1, caret: 0 });
      return;
    }

    if (event.key === "Backspace" && caret === 0 && caretEnd === 0 && index > 0) {
      event.preventDefault();
      const previous = rows[index - 1];
      const merged = previous + rows[index];
      const next = [...rows];
      next[index - 1] = merged;
      next.splice(index, 1);
      commit(next, { index: index - 1, caret: previous.length });
      return;
    }

    if (event.key === "ArrowUp" && index > 0) {
      const target = inputsRef.current[index - 1];
      if (target) {
        event.preventDefault();
        target.focus();
        const pos = Math.min(caret, target.value.length);
        target.setSelectionRange(pos, pos);
      }
    }

    if (event.key === "ArrowDown" && index < rows.length - 1) {
      const target = inputsRef.current[index + 1];
      if (target) {
        event.preventDefault();
        target.focus();
        const pos = Math.min(caret, target.value.length);
        target.setSelectionRange(pos, pos);
      }
    }
  }

  return (
    <div
      style={{
        background: surface.s3,
        border: `1px solid ${surface.borderSubtle}`,
        borderRadius: 8,
        padding: "10px 12px",
        minHeight,
        display: "flex",
        flexDirection: "column",
        gap: 6,
        cursor: editable ? "text" : "default",
      }}
      onClick={(event) => {
        if (event.target !== event.currentTarget) return;
        const last = inputsRef.current[rows.length - 1];
        if (last) {
          last.focus();
          last.setSelectionRange(last.value.length, last.value.length);
        }
      }}
    >
      {rows.map((row, index) => (
        <div key={index} style={{ display: "flex", alignItems: "flex-start", gap: 10 }}>
          {/* La puce ne s'affiche que lorsque la ligne contient du texte —
              les lignes vides (notamment l'état initial avec placeholder)
              n'affichent rien. On garde la place via visibility:hidden
              pour que l'input reste aligné quand on commence à taper.
              Légère marge top pour aligner le dot avec la première ligne
              de texte du textarea. */}
          <span
            aria-hidden
            style={{
              width: 9,
              height: 9,
              borderRadius: "50%",
              background: bulletColor,
              flexShrink: 0,
              marginTop: 6,
              visibility: row.length > 0 ? "visible" : "hidden",
            }}
          />
          <textarea
            ref={(el) => {
              inputsRef.current[index] = el;
              autoSize(el);
            }}
            rows={1}
            value={row}
            onChange={(event) => {
              updateRow(index, event.target.value);
              autoSize(event.target);
            }}
            onKeyDown={(event) => handleKeyDown(event, index)}
            placeholder={index === 0 && rows.length === 1 && row === "" ? placeholder : ""}
            disabled={!editable}
            className="mb-input"
            style={{
              flex: 1,
              background: "transparent",
              border: "none",
              outline: "none",
              padding: 0,
              fontSize: 12.5,
              fontFamily: "inherit",
              color: text.primary,
              lineHeight: 1.55,
              resize: "none",
              overflow: "hidden",
              whiteSpace: "pre-wrap",
              wordBreak: "break-word",
              minHeight: 20,
            }}
          />
        </div>
      ))}
    </div>
  );
}

function RealizationField({
  task,
  onUpdate,
  accentColor,
  bulletAccent,
  aiAccent,
}: {
  task: Task;
  onUpdate?: TaskExpandedPreviewProps["onUpdate"];
  accentColor: string;
  bulletAccent: string;
  aiAccent: string;
}) {
  const initialRows = useMemo(
    () => parseBulletRows(task.realization ?? task.completionDetails ?? ""),
    [task.realization, task.completionDetails],
  );
  const t = useT();
  const [rows, setRows] = useState<string[]>(initialRows);
  useEffect(() => setRows(initialRows), [initialRows]);

  const isPaid = useIsPaidPlan();
  const dirty = !rowsEqual(rows, initialRows);
  const editable = Boolean(onUpdate);
  const [assistantOpen, setAssistantOpen] = useState(false);

  return (
    <FieldShell
      title={t("task.realization")}
      icon="realization"
      iconColor={statusColor.green.text}
      rightSlot={
        isPaid ? (
          <AIChip
            label={t("task.aiAssistant")}
            accentColor={aiAccent}
            onClick={() => setAssistantOpen(true)}
            disabled={!editable}
          />
        ) : undefined
      }
    >
      <BulletListEditor
        rows={rows}
        onChange={setRows}
        bulletColor={bulletAccent}
        placeholder="Ce qui a été fait, décidé, livré, validé…"
        minHeight={200}
        editable={editable}
      />
      <FieldActions
        dirty={dirty}
        onSave={() => onUpdate?.({ realization: rowsToString(rows) })}
        onCancel={() => setRows(initialRows)}
        accentColor={accentColor}
      />
      {assistantOpen && (
        <RealizationAssistant
          currentRealization={rowsToString(rows)}
          accentColor={aiAccent}
          onApply={(lines) => {
            setRows(lines.length > 0 ? lines : [""]);
            setAssistantOpen(false);
          }}
          onClose={() => setAssistantOpen(false)}
        />
      )}
    </FieldShell>
  );
}

function NoteField({
  task,
  onUpdate,
  accentColor,
  bulletAccent,
}: {
  task: Task;
  onUpdate?: TaskExpandedPreviewProps["onUpdate"];
  accentColor: string;
  bulletAccent: string;
}) {
  const initialRows = useMemo(() => {
    const joined = (task.comments ?? []).join("\n");
    return parseBulletRows(joined);
  }, [task.comments]);
  const t = useT();
  const [rows, setRows] = useState<string[]>(initialRows);
  useEffect(() => setRows(initialRows), [initialRows]);

  const dirty = !rowsEqual(rows, initialRows);
  const editable = Boolean(onUpdate);

  return (
    <FieldShell title={t("task.note")} icon="note" iconColor={text.muted}>
      <BulletListEditor
        rows={rows}
        onChange={setRows}
        bulletColor={bulletAccent}
        placeholder="Idées, points à creuser, remarques…"
        editable={editable}
      />
      <FieldActions
        dirty={dirty}
        onSave={() =>
          onUpdate?.({
            comments: rows.map((entry) => entry.trim()).filter(Boolean),
          })
        }
        onCancel={() => setRows(initialRows)}
        accentColor={accentColor}
      />
    </FieldShell>
  );
}

// Encart « Fichiers joints » : miniatures des pièces jointes de la tâche.
// Les images s'affichent en aperçu ; les autres formats en pastille d'extension.
// Sans fichier, on affiche « Pas de fichier joint. ».
function FilesField({ task, accentColor }: { task: Task; accentColor: string }) {
  const files = task.files ?? [];
  const t = useT();
  return (
    <FieldShell
      title={t("task.files")}
      icon="file"
      iconColor={text.muted}
      rightLabel={files.length > 0 ? `${files.length}` : undefined}
    >
      {files.length === 0 ? (
        <p style={{ fontSize: 11.5, color: text.muted, margin: 0, fontStyle: "italic" }}>
          {t("task.noFiles")}
        </p>
      ) : (
        <div
          style={{
            display: "grid",
            gridTemplateColumns: "repeat(auto-fill, minmax(74px, 1fr))",
            gap: 8,
          }}
        >
          {files.map((file) => (
            <FileThumb key={file.id} file={file} accentColor={accentColor} />
          ))}
        </div>
      )}
    </FieldShell>
  );
}

const FILE_EXT_LABEL: Record<string, string> = {
  pdf: "PDF",
  doc: "DOC",
  xls: "XLS",
  img: "IMG",
  link: "LIEN",
  other: "FICHIER",
};

function FileThumb({ file, accentColor }: { file: NonNullable<Task["files"]>[number]; accentColor: string }) {
  const isImage = file.ext === "img" && Boolean(file.url);
  const inner = (
    <div style={{ display: "flex", flexDirection: "column", gap: 4, minWidth: 0 }}>
      <div
        style={{
          position: "relative",
          width: "100%",
          aspectRatio: "1 / 1",
          borderRadius: 8,
          overflow: "hidden",
          background: surface.s2,
          border: `1px solid ${surface.borderSubtle}`,
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
        }}
      >
        {isImage ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img src={file.url} alt={file.name} style={{ width: "100%", height: "100%", objectFit: "cover" }} />
        ) : (
          <span
            className="inline-flex items-center justify-center rounded-md text-[10px] font-bold"
            style={{
              padding: "3px 6px",
              background: `color-mix(in srgb, ${accentColor} 14%, transparent)`,
              color: accentColor,
              letterSpacing: "0.04em",
            }}
          >
            {FILE_EXT_LABEL[file.ext] ?? "FICHIER"}
          </span>
        )}
      </div>
      <span
        title={file.name}
        style={{
          fontSize: 9.5,
          color: text.muted,
          lineHeight: 1.25,
          overflow: "hidden",
          textOverflow: "ellipsis",
          whiteSpace: "nowrap",
        }}
      >
        {file.name}
      </span>
    </div>
  );

  if (!file.url) return inner;
  return (
    <a
      href={file.url}
      target="_blank"
      rel="noopener noreferrer"
      data-no-task-expand="true"
      onClick={(event) => event.stopPropagation()}
      style={{ textDecoration: "none" }}
    >
      {inner}
    </a>
  );
}

function ChecklistField({
  task,
  onChecklistMutated,
  accentColor,
  aiAccent,
  projectId,
  stepId,
}: {
  task: Task;
  onChecklistMutated?: TaskExpandedPreviewProps["onChecklistMutated"];
  accentColor: string;
  aiAccent: string;
  projectId?: string;
  stepId?: string;
}) {
  const router = useRouter();
  const checklist = task.checklist ?? [];
  const t = useT();
  const done = checklist.filter((item) => item.done).length;
  const total = checklist.length;
  const [draft, setDraft] = useState("");
  const [aiPending, setAiPending] = useState(false);
  const [aiError, setAiError] = useState<string | null>(null);
  const [aiSuggestions, setAiSuggestions] = useState<string[] | null>(null);
  const isPaid = useIsPaidPlan();
  const editable = Boolean(onChecklistMutated);
  const aiAvailable = Boolean(projectId && stepId) && isPaid;

  async function handleAISuggest() {
    if (!projectId || !stepId) return;
    setAiError(null);
    setAiSuggestions(null);
    setAiPending(true);
    try {
      const { items } = await suggestTaskChecklistAction({
        projectId,
        stepId,
        taskId: task.id,
      });
      setAiSuggestions(items);
    } catch (err) {
      setAiError(err instanceof Error ? err.message : "Erreur IA.");
    } finally {
      setAiPending(false);
    }
  }

  async function applyAISuggestions(mode: "replace" | "append") {
    if (!projectId || !stepId || !aiSuggestions || aiSuggestions.length === 0) return;
    setAiPending(true);
    try {
      const { checklist: nextChecklist } = await applyAIChecklistAction({
        projectId,
        stepId,
        taskId: task.id,
        items: aiSuggestions,
        mode,
      });
      setAiSuggestions(null);
      // Met à jour la checklist localement via le callback du TaskDetailLauncher
      // pour que le drawer reflète immédiatement les nouveaux items sans
      // re-fetch (router.refresh aurait remonté le launcher et fermé le
      // drawer en plein milieu de l'interaction utilisateur).
      onChecklistMutated?.(nextChecklist);
    } catch (err) {
      setAiError(err instanceof Error ? err.message : "Erreur IA.");
    } finally {
      setAiPending(false);
    }
  }

  const toggle = (id: string) => {
    if (!onChecklistMutated) return;
    const next = checklist.map((item) => (item.id === id ? { ...item, done: !item.done } : item));
    onChecklistMutated(next);
  };

  const remove = (id: string) => {
    if (!onChecklistMutated) return;
    onChecklistMutated(checklist.filter((item) => item.id !== id));
  };

  const updateLabel = (id: string, label: string) => {
    if (!onChecklistMutated) return;
    onChecklistMutated(checklist.map((item) => (item.id === id ? { ...item, label } : item)));
  };

  const add = () => {
    const cleaned = draft.trim();
    if (!cleaned || !onChecklistMutated) return;
    const newItem: ChecklistItem = {
      id: `cl_${cryptoRandomId()}`,
      label: cleaned,
      done: false,
    };
    onChecklistMutated([...checklist, newItem]);
    setDraft("");
  };

  return (
    <FieldShell
      title={t("task.checklist")}
      icon="checklist"
      iconColor={text.muted}
      rightLabel={total > 0 ? `${done}/${total}` : undefined}
      rightSlot={
        aiAvailable ? (
          <AIChip
            label={aiPending ? t("task.aiThinking") : t("task.aiSuggestion")}
            accentColor={aiAccent}
            onClick={handleAISuggest}
            disabled={aiPending || !editable}
          />
        ) : undefined
      }
    >
      <div style={{ display: "flex", flexDirection: "column", gap: 4 }}>
        {checklist.length === 0 ? (
          <p style={{ fontSize: 11, color: text.muted, margin: 0, fontStyle: "italic" }}>
            Pas encore de sous-action. Ajoute la première ci-dessous.
          </p>
        ) : (
          checklist.map((item) => (
            <ChecklistRow
              key={item.id}
              item={item}
              accentColor={accentColor}
              editable={editable}
              onToggle={() => toggle(item.id)}
              onRemove={() => remove(item.id)}
              onUpdateLabel={(label) => updateLabel(item.id, label)}
            />
          ))
        )}
      </div>

      {aiError && (
        <p style={{ fontSize: 10.5, color: "var(--mb-status-red-text)", margin: 0 }}>{aiError}</p>
      )}

      {aiSuggestions && aiSuggestions.length > 0 && (
        <div
          style={{
            background: surface.s2,
            border: `1px dashed ${accentColor}`,
            borderRadius: 8,
            padding: 8,
            display: "flex",
            flexDirection: "column",
            gap: 6,
          }}
        >
          <p style={{ fontSize: 10.5, fontWeight: 600, color: accentColor, margin: 0, textTransform: "uppercase", letterSpacing: "0.08em" }}>
            Suggestion IA · {aiSuggestions.length} sous-action{aiSuggestions.length > 1 ? "s" : ""}
          </p>
          {/* Une puce devant chaque sous-action proposée : on voit d'un coup
              d'œil combien de tâches l'IA suggère et où chacune commence. */}
          <div style={{ display: "flex", flexDirection: "column", gap: 4 }}>
            {aiSuggestions.map((item, index) => (
              <div key={index} style={{ display: "flex", alignItems: "flex-start", gap: 8 }}>
                <span
                  aria-hidden
                  style={{ width: 6, height: 6, borderRadius: "50%", background: accentColor, flexShrink: 0, marginTop: 5 }}
                />
                <span style={{ fontSize: 11.5, color: text.secondary, lineHeight: 1.4 }}>{item}</span>
              </div>
            ))}
          </div>
          <div className="flex items-center gap-1.5">
            <Button
              variant="primary"
              size="sm"
              accentColor={accentColor}
              onClick={() => applyAISuggestions("append")}
              disabled={aiPending}
            >
              Ajouter à la checklist
            </Button>
            <Button
              variant="ghost"
              size="sm"
              onClick={() => applyAISuggestions("replace")}
              disabled={aiPending}
            >
              Remplacer
            </Button>
            <Button variant="ghost" size="sm" onClick={() => setAiSuggestions(null)} disabled={aiPending}>
              Ignorer
            </Button>
          </div>
        </div>
      )}
      {editable && (
        <div className="flex items-center gap-1.5">
          <input
            type="text"
            value={draft}
            onChange={(event) => setDraft(event.target.value)}
            onKeyDown={(event) => {
              if (event.key === "Enter") {
                event.preventDefault();
                add();
              }
            }}
            placeholder={t("task.addSubaction")}
            className="mb-input"
            style={{ ...fieldInputStyle(), minHeight: 32, padding: "6px 10px" }}
          />
          <Button
            variant="primary"
            size="sm"
            accentColor={accentColor}
            onClick={add}
            disabled={!draft.trim()}
          >
            Ajouter
          </Button>
        </div>
      )}
    </FieldShell>
  );
}

function ChecklistRow({
  item,
  accentColor,
  editable,
  onToggle,
  onRemove,
  onUpdateLabel,
}: {
  item: ChecklistItem;
  accentColor: string;
  editable: boolean;
  onToggle: () => void;
  onRemove: () => void;
  onUpdateLabel: (label: string) => void;
}) {
  const [editing, setEditing] = useState(false);
  const [draft, setDraft] = useState(item.label);

  useEffect(() => setDraft(item.label), [item.label]);

  const commit = () => {
    const cleaned = draft.trim();
    if (cleaned && cleaned !== item.label) onUpdateLabel(cleaned);
    setEditing(false);
  };

  return (
    <div
      // items-start (au lieu de items-center) pour que la checkbox reste
      // alignée en haut quand le label wrappe sur plusieurs lignes.
      className="flex items-start gap-2 group"
      style={{
        background: surface.s3,
        border: `1px solid ${surface.borderSubtle}`,
        borderRadius: 8,
        padding: "6px 8px",
      }}
    >
      <button
        type="button"
        onClick={onToggle}
        disabled={!editable}
        className="inline-flex items-center justify-center shrink-0 mt-0.5"
        style={{
          width: 16,
          height: 16,
          borderRadius: 4,
          background: item.done ? accentColor : surface.s1,
          border: `1px solid ${item.done ? accentColor : surface.border}`,
          color: "#FFFFFF",
          cursor: editable ? "pointer" : "default",
          transition: "background-color 120ms var(--mb-ease), border-color 120ms var(--mb-ease)",
        }}
      >
        {item.done && (
          <svg width="9" height="9" viewBox="0 0 12 12" fill="none">
            <path d="M2 6l3 3 5-5" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
          </svg>
        )}
      </button>
      {editing ? (
        <input
          type="text"
          value={draft}
          autoFocus
          onChange={(event) => setDraft(event.target.value)}
          onBlur={commit}
          onKeyDown={(event) => {
            if (event.key === "Enter") {
              event.preventDefault();
              commit();
            }
            if (event.key === "Escape") {
              setDraft(item.label);
              setEditing(false);
            }
          }}
          style={{
            flex: 1,
            background: "transparent",
            border: "none",
            outline: "none",
            fontSize: 12,
            color: text.primary,
          }}
        />
      ) : (
        <span
          onClick={() => editable && setEditing(true)}
          className="flex-1 min-w-0 break-words"
          style={{
            fontSize: 12,
            color: item.done ? text.muted : text.secondary,
            textDecoration: item.done ? "line-through" : "none",
            cursor: editable ? "text" : "default",
            // Wrap multi-lignes : on garde tout le texte visible plutôt
            // que de tronquer avec une ellipsis. overflowWrap: anywhere
            // gère aussi les très longs mots (URLs collées, etc.).
            overflowWrap: "anywhere",
            lineHeight: 1.4,
          }}
        >
          {item.label}
        </span>
      )}
      {editable && !editing && (
        <button
          type="button"
          onClick={onRemove}
          className="opacity-0 group-hover:opacity-100"
          aria-label="Supprimer"
          style={{
            color: text.muted,
            background: "transparent",
            border: "none",
            cursor: "pointer",
            padding: 2,
            transition: "opacity 120ms var(--mb-ease)",
          }}
        >
          <svg width="12" height="12" viewBox="0 0 16 16" fill="none">
            <path d="m4 4 8 8M12 4l-8 8" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" />
          </svg>
        </button>
      )}
    </div>
  );
}

function DiscussionField({
  task,
  projectId,
  stepId,
  accentColor,
  projectPeople = [],
  onSendMessage,
}: {
  task: Task;
  projectId?: string;
  stepId?: string;
  accentColor: string;
  projectPeople?: Array<{ id: string; name: string }>;
  /** Hors projet (tâches libres) : persiste le message via ce callback au lieu
   *  de l'action liée au projet/étape. */
  onSendMessage?: (content: string) => Promise<void> | void;
}) {
  const accountName = useAccountName();
  // Messages en attente d'être pris en compte par le serveur, affichés
  // localement pour que l'envoi soit immédiat sans router.refresh
  // (qui fermerait le drawer). Quand le task.discussion serveur les
  // contient, on les filtre pour éviter les doublons.
  const [pendingMessages, setPendingMessages] = useState<TaskDiscussionMessage[]>([]);
  const t = useT();
  const messages = useMemo(() => {
    const persisted = task.discussion ?? [];
    const persistedKeys = new Set(persisted.map((m) => `${m.authorName}|${m.content}`));
    const stillPending = pendingMessages.filter(
      (m) => !persistedKeys.has(`${m.authorName}|${m.content}`),
    );
    return [...persisted, ...stillPending];
  }, [task.discussion, pendingMessages]);
  const [draft, setDraft] = useState("");
  const [isPending, startTransition] = useTransition();
  // Deux modes d'ouverture du sélecteur de mentions :
  //  • mentionsOpen : ouverture manuelle via le bouton (liste complète) ;
  //  • mention : ouverture pilotée par la frappe d'un « @partiel » (liste
  //    filtrée sur le texte saisi après le @).
  const [mentionsOpen, setMentionsOpen] = useState(false);
  const [mention, setMention] = useState<{ start: number; query: string } | null>(null);
  const [mentionActive, setMentionActive] = useState(0);
  const inputRef = useRef<HTMLInputElement | null>(null);
  const mentionsRef = useRef<HTMLDivElement | null>(null);

  // Fermer le picker mentions au clic extérieur
  useEffect(() => {
    if (!mentionsOpen && !mention) return;
    function handleClickOutside(event: MouseEvent) {
      if (mentionsRef.current && !mentionsRef.current.contains(event.target as Node)) {
        setMentionsOpen(false);
        setMention(null);
      }
    }
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, [mentionsOpen, mention]);

  const canSend = onSendMessage
    ? draft.trim().length > 0
    : Boolean(projectId && stepId && draft.trim().length > 0);

  // Liste affichée : filtrée sur le « @partiel » en cours de frappe, sinon
  // (ouverture via bouton) la liste complète des collaborateurs.
  const mentionMatches = useMemo(() => {
    if (!mention || !mention.query) return projectPeople;
    const q = normalizeName(mention.query);
    return projectPeople.filter((person) => normalizeName(person.name).includes(q));
  }, [mention, projectPeople]);
  const pickerList = mention ? mentionMatches : projectPeople;
  const pickerOpen = (mentionsOpen || mention != null) && projectPeople.length > 0;

  function handleDraftChange(event: React.ChangeEvent<HTMLInputElement>) {
    const value = event.target.value;
    const caret = event.target.selectionStart ?? value.length;
    setDraft(value);
    const token = findMentionToken(value, caret);
    setMention(token);
    setMentionActive(0);
    if (token) setMentionsOpen(false); // la frappe pilote le picker
  }

  function insertMention(name: string) {
    if (mention) {
      // Remplace le « @partiel » par « @NomComplet » suivi d'une espace.
      const before = draft.slice(0, mention.start);
      const after = draft.slice(mention.start + 1 + mention.query.length);
      setDraft(`${before}@${name} ${after.replace(/^\s+/, "")}`);
      setMention(null);
    } else {
      const sep = draft.length === 0 || /\s$/.test(draft) ? "" : " ";
      setDraft((current) => `${current}${sep}@${name} `);
    }
    setMentionsOpen(false);
    setMentionActive(0);
    inputRef.current?.focus();
  }

  const send = () => {
    // En projet : projectId/stepId requis. Hors projet (tâche libre) : un
    // onSendMessage suffit.
    if (!canSend) return;
    if (!onSendMessage && (!projectId || !stepId)) return;
    const content = draft.trim();
    const authorName = accountName.trim() || "Moi";
    // Optimistic local message : l'utilisateur voit son envoi tout de
    // suite, le drawer reste ouvert (pas de router.refresh).
    const optimistic: TaskDiscussionMessage = {
      id: `local_${Date.now()}`,
      authorName,
      content,
      createdAt: new Date().toISOString(),
    };
    setPendingMessages((current) => [...current, optimistic]);
    setDraft("");
    startTransition(async () => {
      try {
        if (onSendMessage) {
          await onSendMessage(content);
        } else if (projectId && stepId) {
          await addTaskDiscussionMessageAction(projectId, stepId, task.id, {
            authorName: "Maxime",
            content,
          });
        }
        // Le serveur a persisté ; au prochain re-render (avec task à jour)
        // le message sera dans task.discussion et le useMemo retire
        // l'optimistic via le dedupe par author|content.
      } catch (error) {
        console.error("[discussion] send failed", error);
        // En cas d'erreur, on retire le pending pour ne pas afficher un
        // message fantôme et on remet le brouillon.
        setPendingMessages((current) => current.filter((m) => m.id !== optimistic.id));
        setDraft(content);
      }
    });
  };

  return (
    <FieldShell
      title={t("task.discussion")}
      icon="discussion"
      iconColor={text.muted}
      rightLabel={messages.length > 0 ? `${messages.length}` : undefined}
    >
      <div
        style={{
          background: surface.s3,
          border: `1px solid ${surface.borderSubtle}`,
          borderRadius: 8,
          padding: 10,
          minHeight: 180,
          maxHeight: 320,
          overflowY: "auto",
        }}
      >
        {messages.length > 0 ? (
          <div className="flex flex-col gap-1.5">
            {messages.map((message, index) => (
              <ChatBubble key={message.id} message={message} sent={index % 2 === 1} />
            ))}
          </div>
        ) : (
          <p style={{ fontSize: 11, color: text.muted, margin: 0, fontStyle: "italic" }}>
            Pas encore de message. Démarre la discussion ci-dessous.
          </p>
        )}
      </div>
      {(projectId && stepId) || onSendMessage ? (
        <div ref={mentionsRef} style={{ position: "relative" }}>
          <div className="flex items-center gap-1.5">
            <button
              type="button"
              onClick={() => {
                setMention(null);
                setMentionsOpen((current) => !current);
              }}
              disabled={isPending || projectPeople.length === 0}
              title={
                projectPeople.length === 0
                  ? "Aucun collaborateur dans le projet"
                  : "Mentionner un collaborateur"
              }
              className="inline-flex h-8 w-8 shrink-0 items-center justify-center rounded-full"
              style={{
                background: pickerOpen ? accentColor : surface.s2,
                color: pickerOpen ? "#FFFFFF" : text.secondary,
                border: `1px solid ${pickerOpen ? accentColor : surface.borderSubtle}`,
                cursor: projectPeople.length === 0 ? "not-allowed" : "pointer",
                opacity: projectPeople.length === 0 ? 0.5 : 1,
              }}
            >
              <svg width="13" height="13" viewBox="0 0 16 16" fill="none" aria-hidden="true">
                <circle cx="8" cy="6.2" r="2.6" stroke="currentColor" strokeWidth="1.45" />
                <path d="M3.6 13.5a4.4 4.4 0 0 1 8.8 0" stroke="currentColor" strokeWidth="1.45" strokeLinecap="round" />
              </svg>
            </button>
            <input
              ref={inputRef}
              type="text"
              value={draft}
              onChange={handleDraftChange}
              onKeyDown={(event) => {
                // Quand le sélecteur de mentions est piloté par la frappe, les
                // flèches/Entrée naviguent et choisissent un nom plutôt que
                // d'envoyer le message.
                if (mention && pickerList.length > 0) {
                  if (event.key === "ArrowDown") {
                    event.preventDefault();
                    setMentionActive((prev) => Math.min(prev + 1, pickerList.length - 1));
                    return;
                  }
                  if (event.key === "ArrowUp") {
                    event.preventDefault();
                    setMentionActive((prev) => Math.max(prev - 1, 0));
                    return;
                  }
                  if (event.key === "Enter") {
                    event.preventDefault();
                    insertMention(pickerList[mentionActive]?.name ?? pickerList[0].name);
                    return;
                  }
                  if (event.key === "Escape") {
                    event.preventDefault();
                    setMention(null);
                    return;
                  }
                }
                if (event.key === "Enter" && !event.shiftKey) {
                  event.preventDefault();
                  send();
                }
              }}
              placeholder="Écrire un message… (@ pour mentionner)"
              className="mb-input"
              style={{ ...fieldInputStyle(), minHeight: 32, padding: "6px 10px" }}
              disabled={isPending}
            />
            <Button
              variant="primary"
              size="sm"
              accentColor={accentColor}
              onClick={send}
              disabled={!canSend || isPending}
            >
              {isPending ? "…" : "Envoyer"}
            </Button>
          </div>

          {pickerOpen && (
            <div
              role="listbox"
              style={{
                position: "absolute",
                bottom: "calc(100% + 6px)",
                left: 0,
                zIndex: 60,
                minWidth: 200,
                maxHeight: 200,
                overflowY: "auto",
                padding: 6,
                background: surface.s1,
                border: `1px solid ${surface.borderSubtle}`,
                borderRadius: 12,
                boxShadow: "var(--mb-shadow-md)",
                display: "flex",
                flexDirection: "column",
                gap: 1,
              }}
            >
              <p style={{ fontSize: 9.5, fontWeight: 600, color: text.muted, margin: "4px 8px", textTransform: "uppercase", letterSpacing: "0.08em" }}>
                {mention && mention.query ? `Résultats pour « ${mention.query} »` : "Collaborateurs du projet"}
              </p>
              {pickerList.length === 0 ? (
                <p style={{ fontSize: 11, color: text.muted, margin: "2px 8px 6px", fontStyle: "italic" }}>
                  Aucun collaborateur correspondant.
                </p>
              ) : (
                pickerList.map((person, index) => {
                  const highlighted = mention != null && index === mentionActive;
                  return (
                    <button
                      key={person.id}
                      type="button"
                      onMouseEnter={() => mention && setMentionActive(index)}
                      onClick={() => insertMention(person.name)}
                      className="flex items-center gap-2 rounded-lg px-2 py-1.5 text-left"
                      style={{
                        background: highlighted ? surface.s2 : "transparent",
                        border: "none",
                        color: text.secondary,
                        fontSize: 12,
                        cursor: "pointer",
                      }}
                    >
                      <span
                        aria-hidden
                        className="inline-flex h-6 w-6 items-center justify-center rounded-full text-[10px] font-bold text-white"
                        style={{ background: accentColor }}
                      >
                        {person.name.slice(0, 1).toUpperCase()}
                      </span>
                      <span style={{ fontWeight: 500 }}>@{person.name}</span>
                    </button>
                  );
                })
              )}
            </div>
          )}
        </div>
      ) : null}
    </FieldShell>
  );
}

function ChatBubble({ message, sent }: { message: TaskDiscussionMessage; sent: boolean }) {
  return (
    <div className={`flex ${sent ? "justify-end" : "justify-start"}`}>
      <div
        className="max-w-[84%]"
        style={{
          background: sent ? statusColor.green.bg : surface.s1,
          padding: "6px 10px",
          borderRadius: 12,
          borderTopRightRadius: sent ? 4 : 12,
          borderTopLeftRadius: sent ? 12 : 4,
          border: `1px solid ${surface.borderSubtle}`,
        }}
      >
        <div className="mb-0.5 flex items-center justify-between gap-2">
          <span style={{ fontSize: 9, fontWeight: 600, color: sent ? statusColor.green.text : text.muted }}>
            {message.authorName}
          </span>
          <span style={{ fontSize: 8.5, color: text.dim }}>{formatDiscussionTime(message.createdAt)}</span>
        </div>
        <p style={{ fontSize: 11, color: text.secondary, margin: 0, lineHeight: 1.45 }}>{message.content}</p>
      </div>
    </div>
  );
}

// ─── Quick infos block (lecture seule) ───────────────────────────────────

export function QuickInfos({
  task,
  linkedTeams,
  accentColor,
  projectPeople,
  projectTeams,
  onUpdate,
  statusSettings,
  headless = false,
  assignEmptyHint,
}: {
  task: Task;
  linkedTeams: ProjectTeam[];
  accentColor: string;
  projectPeople: Array<{ id: string; name: string }>;
  projectTeams: ProjectTeam[];
  onUpdate?: TaskExpandedPreviewProps["onUpdate"];
  statusSettings?: ProjectStatusSettings;
  /** Rendu « nu » (sans la carte FieldShell ni le titre « Informations ») pour
   *  intégration directe sous le titre dans la barre d'en-tête. */
  headless?: boolean;
  /** Message affiché quand aucun collaborateur n'est disponible. Permet
   *  d'adapter le texte hors projet (tâches libres → réglages). */
  assignEmptyHint?: string;
}) {
  const accountName = useAccountName();
  const fileCount = task.files?.length ?? 0;
  const meFirst = accountName.trim().toLowerCase().split(" ")[0] ?? "";
  // Liste des personnes assignées (assignees, ou l'ancien `owner` seul).
  const assigneeNames = (task.assignees && task.assignees.length > 0
    ? task.assignees
    : task.owner?.trim()
      ? [task.owner.trim()]
      : []
  ).map((n) => n.trim()).filter(Boolean);
  // « Moi » pour le compte courant.
  const labelParts = [
    ...assigneeNames.map((n) => (meFirst && n.toLowerCase().split(" ")[0] === meFirst ? "Moi" : n)),
    ...linkedTeams.map((t) => t.name),
  ];
  const assigneeCount = labelParts.length;
  // Affiche « Alex », « Alex +2 » ou « 3 assignés ».
  const ownerLabel =
    assigneeCount === 0 ? "" : assigneeCount <= 2 ? labelParts.join(", ") : `${labelParts[0]} +${assigneeCount - 1}`;
  const editable = Boolean(onUpdate);
  const [editing, setEditing] = useState<"calendar" | "person" | "file" | null>(null);
  // Position de la tuile cliquée → ancre du panneau flottant (overlay) qui
  // remplace l'ancienne expansion en ligne sous la carte.
  const [editingRect, setEditingRect] = useState<DOMRect | null>(null);
  const [showCompletionBlocked, setShowCompletionBlocked] = useState(false);

  function toggleEditing(kind: "calendar" | "person" | "file", event: React.MouseEvent<HTMLElement>) {
    const rect = event.currentTarget.getBoundingClientRect();
    setEditing((current) => (current === kind ? null : kind));
    setEditingRect(rect);
  }
  function closeEditing() {
    setEditing(null);
  }

  const body = (
    <>
      {/* Une seule ligne sur ordinateur : statut · date · assigner · joindre ·
          priorité (statut à gauche, priorité à droite). Sur petit écran ça
          repasse sur plusieurs colonnes. */}
      <div className="grid grid-cols-3 gap-1.5 sm:grid-cols-5">
        <ExpandedStatusPicker
          task={task}
          statusSettings={statusSettings}
          editable={editable}
          onPick={(nextStatus) => {
            if (nextStatus === deriveTaskStatus(task)) return;
            if (nextStatus === "done") {
              const checklist = task.checklist ?? [];
              const incomplete = checklist.length > 0 && !checklist.every((item) => item.done);
              if (incomplete) {
                setShowCompletionBlocked(true);
                return;
              }
            }
            onUpdate?.({ status: nextStatus });
          }}
        />
        <QuickInfoTile
          icon="calendar"
          empty={!task.dueDate}
          accentColor={accentColor}
          editable={editable}
          active={editing === "calendar"}
          onClick={editable ? (event) => toggleEditing("calendar", event) : undefined}
        >
          {task.dueDate ? formatTaskScheduleLabel(task) : editable ? "Ajouter date" : "—"}
        </QuickInfoTile>
        <QuickInfoTile
          icon="person"
          empty={assigneeCount === 0}
          accentColor={accentColor}
          editable={editable}
          active={editing === "person"}
          onClick={editable ? (event) => toggleEditing("person", event) : undefined}
        >
          {ownerLabel || (editable ? "Assigner" : "—")}
        </QuickInfoTile>
        <QuickInfoTile
          icon="file"
          empty={fileCount === 0}
          accentColor={accentColor}
          editable={editable}
          active={editing === "file"}
          onClick={editable ? (event) => toggleEditing("file", event) : undefined}
        >
          {fileCount > 0 ? `${fileCount} fichier${fileCount > 1 ? "s" : ""}` : editable ? "Joindre" : "—"}
        </QuickInfoTile>
        <ExpandedPriorityPicker
          value={task.priority ?? "medium"}
          displayValue={deriveTaskDisplayPriority(task)}
          editable={editable}
          onPick={(next) => onUpdate?.({ priority: next })}
        />
      </div>

      {editing === "calendar" && (
        <AnchoredEditorPanel rect={editingRect} width={300} onClose={closeEditing}>
          <DateEditor
            task={task}
            accentColor={accentColor}
            onSave={(dueDate, dueTime) => {
              onUpdate?.({ dueDate, dueTime });
              setEditing(null);
            }}
            onClear={() => {
              onUpdate?.({ dueDate: "", dueTime: "" });
              setEditing(null);
            }}
            onCancel={() => setEditing(null)}
          />
        </AnchoredEditorPanel>
      )}

      {editing === "person" && (
        <AnchoredEditorPanel rect={editingRect} width={320} onClose={closeEditing}>
          <PersonEditor
            task={task}
            projectPeople={projectPeople}
            projectTeams={projectTeams}
            accentColor={accentColor}
            emptyHint={assignEmptyHint}
            onSave={(next) => {
              onUpdate?.({ owner: next.owner, assignees: next.assignees, teamIds: next.teamIds });
              setEditing(null);
            }}
            onCancel={() => setEditing(null)}
          />
        </AnchoredEditorPanel>
      )}

      {editing === "file" && (
        <AnchoredEditorPanel rect={editingRect} width={300} onClose={closeEditing}>
          <div style={{ fontSize: 11.5, color: text.muted, lineHeight: 1.5 }}>
            La gestion des fichiers passe par un upload dédié, cette interface arrive bientôt.
            <button
              type="button"
              onClick={() => setEditing(null)}
              className="ml-2 underline"
              style={{ background: "transparent", border: "none", color: text.secondary, cursor: "pointer" }}
            >
              Fermer
            </button>
          </div>
        </AnchoredEditorPanel>
      )}

      {showCompletionBlocked && (
        <CompletionBlockedAlert
          checklistTotal={task.checklist?.length ?? 0}
          checklistDone={task.checklist?.filter((item) => item.done).length ?? 0}
          onClose={() => setShowCompletionBlocked(false)}
        />
      )}
    </>
  );

  if (headless) {
    return <div className="flex flex-col gap-2">{body}</div>;
  }
  return (
    <FieldShell title="Informations" icon="info" iconColor={text.muted}>
      {body}
    </FieldShell>
  );
}

// Panneau flottant (overlay) ancré à la tuile cliquée — remplace l'expansion
// en ligne pour « Ajouter date », « Assigner », « Joindre ». Rendu via portal
// pour passer au-dessus de la carte sans en pousser le contenu.
function AnchoredEditorPanel({
  rect,
  width = 300,
  onClose,
  children,
}: {
  rect: DOMRect | null;
  width?: number;
  onClose: () => void;
  children: ReactNode;
}) {
  useEffect(() => {
    function handleKey(event: KeyboardEvent) {
      if (event.key === "Escape") onClose();
    }
    // Fermer si la page défile (le panneau est ancré en position fixe et
    // dériverait sinon) ou au redimensionnement.
    function handleScroll() {
      onClose();
    }
    window.addEventListener("keydown", handleKey);
    window.addEventListener("scroll", handleScroll, true);
    window.addEventListener("resize", handleScroll);
    return () => {
      window.removeEventListener("keydown", handleKey);
      window.removeEventListener("scroll", handleScroll, true);
      window.removeEventListener("resize", handleScroll);
    };
  }, [onClose]);

  if (!rect || typeof document === "undefined") return null;

  const margin = 8;
  const isMobile = window.innerWidth < 640;
  const panelWidth = isMobile ? Math.min(window.innerWidth - margin * 2, 360) : width;
  let left = isMobile ? margin : Math.min(rect.left, window.innerWidth - panelWidth - margin);
  left = Math.max(margin, left);
  // Bascule au-dessus de la tuile si la place manque en dessous.
  const spaceBelow = window.innerHeight - rect.bottom;
  const flip = spaceBelow < 260 && rect.top > spaceBelow;

  return createPortal(
    <>
      <button
        type="button"
        aria-hidden
        tabIndex={-1}
        onClick={onClose}
        onPointerDown={(event) => {
          event.preventDefault();
          onClose();
        }}
        style={{ position: "fixed", inset: 0, zIndex: 9998, background: "transparent", border: "none", cursor: "default", padding: 0 }}
      />
      <div
        role="dialog"
        aria-modal="true"
        onClick={(event) => event.stopPropagation()}
        style={{
          position: "fixed",
          ...(flip ? { bottom: window.innerHeight - rect.top + 6 } : { top: rect.bottom + 6 }),
          left,
          width: panelWidth,
          zIndex: 9999,
          background: surface.s1,
          border: `1px solid ${surface.border}`,
          borderRadius: 16,
          boxShadow: "var(--mb-shadow-md)",
          padding: 12,
          maxHeight: "min(70vh, 460px)",
          overflowY: "auto",
        }}
      >
        {children}
      </div>
    </>,
    document.body,
  );
}

// Hook commun aux pickers : ouverture/fermeture, position du menu, click-outside.
function useExpandedPickerMenu() {
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

function getTaskStatusVisual(status: TaskStatus, statusSettings?: ProjectStatusSettings) {
  const customColor = statusSettings?.task?.[status]?.color;
  if (customColor) return { color: customColor, bg: surface.s2 };
  if (status === "done") return { color: statusColor.green.text, bg: statusColor.green.bg };
  if (status === "in_progress") return { color: statusColor.yellow.text, bg: statusColor.yellow.bg };
  if (status === "waiting") return { color: statusColor.blue.text, bg: statusColor.blue.bg };
  if (status === "blocked") return { color: errorTokens.text, bg: errorTokens.bg };
  return { color: statusColor.gray.text, bg: statusColor.gray.bg };
}

const STATUS_OPTIONS: TaskStatus[] = ["todo", "in_progress", "waiting", "blocked", "done"];
const PRIORITY_OPTIONS: ProjectPriority[] = ["high", "medium", "low"];

function ExpandedFieldPill({
  label,
  innerRef,
  onClick,
  disabled,
  dotColor,
  valueLabel,
  title,
}: {
  label: string;
  innerRef: React.RefObject<HTMLButtonElement | null>;
  onClick: () => void;
  disabled?: boolean;
  /** Si fourni, affiche un dot coloré à gauche de la valeur (priorité).
   *  Sinon (statut), pas de dot — la fiche kanban est déjà dans la
   *  colonne du statut, donc le dot serait redondant. */
  dotColor?: string;
  valueLabel: string;
  title: string;
}) {
  return (
    <button
      ref={innerRef}
      type="button"
      onClick={(event) => {
        event.stopPropagation();
        if (!disabled) onClick();
      }}
      disabled={disabled}
      title={title}
      className="flex min-w-0 items-center gap-1.5 text-left"
      style={{
        background: surface.s3,
        border: `1px solid ${surface.borderSubtle}`,
        borderRadius: 8,
        padding: "6px 8px",
        cursor: disabled ? "default" : "pointer",
        opacity: disabled ? 0.7 : 1,
        transition: "border-color 120ms var(--mb-ease), background-color 120ms var(--mb-ease)",
      }}
    >
      {dotColor && (
        <span aria-hidden style={{ width: 7, height: 7, borderRadius: "50%", background: dotColor, flexShrink: 0 }} />
      )}
      <span
        style={{
          fontSize: 10.5,
          fontWeight: 600,
          color: text.muted,
          flexShrink: 0,
        }}
      >
        {label}
      </span>
      <span aria-hidden style={{ color: text.ghost, opacity: 0.6, flexShrink: 0 }}>·</span>
      <span
        style={{
          // Cohérent avec les FilterPill : valeur en gras + couleur primaire
          // pour la rendre plus explicite que le label gauche.
          fontSize: 11,
          fontWeight: 700,
          color: text.primary,
          letterSpacing: "-0.005em",
          minWidth: 0,
          flex: 1,
          overflow: "hidden",
          textOverflow: "ellipsis",
          whiteSpace: "nowrap",
        }}
      >
        {valueLabel}
      </span>
      {!disabled && (
        <svg width="9" height="9" viewBox="0 0 12 12" fill="none" aria-hidden="true" style={{ opacity: 0.55, flexShrink: 0 }}>
          <path d="M3 4.5 6 7.5 9 4.5" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round" />
        </svg>
      )}
    </button>
  );
}

function ExpandedStatusPicker({
  task,
  statusSettings,
  editable,
  onPick,
}: {
  task: Task;
  statusSettings?: ProjectStatusSettings;
  editable: boolean;
  onPick: (status: TaskStatus) => void;
}) {
  const { open, triggerRect, triggerRef, menuRef, toggle, close } = useExpandedPickerMenu();
  const statusLabel = useStatusLabel();
  const current = deriveTaskStatus(task);
  const label = statusSettings?.task?.[current]?.label ?? statusLabel(current, taskStatusLabels[current]);

  return (
    <>
      <ExpandedFieldPill
        label="Statut"
        innerRef={triggerRef}
        onClick={toggle}
        disabled={!editable}
        valueLabel={label}
        title="Changer le statut"
      />
      {open && triggerRect && typeof document !== "undefined"
        ? createPortal(
            <div
              ref={menuRef}
              role="listbox"
              onClick={(event) => event.stopPropagation()}
              style={{
                position: "fixed",
                top: triggerRect.bottom + 4,
                left: Math.max(8, triggerRect.left),
                zIndex: 9999,
                minWidth: Math.max(200, triggerRect.width),
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
              {STATUS_OPTIONS.map((option) => {
                const v = getTaskStatusVisual(option, statusSettings);
                const optionLabel = statusSettings?.task?.[option]?.label ?? statusLabel(option, taskStatusLabels[option]);
                const selected = option === current;
                return (
                  <button
                    key={option}
                    type="button"
                    onClick={(event) => {
                      event.stopPropagation();
                      close();
                      onPick(option);
                    }}
                    className="flex items-center gap-2 rounded-lg px-2 py-1.5 text-left"
                    style={{
                      background: selected ? surface.s2 : "transparent",
                      border: "none",
                      color: text.secondary,
                      fontSize: 10.5,
                      fontWeight: 500,
                      cursor: "pointer",
                    }}
                  >
                    <span aria-hidden style={{ width: 7, height: 7, borderRadius: "50%", background: v.color, flexShrink: 0 }} />
                    <span style={{ flex: 1 }}>{optionLabel}</span>
                    {selected && (
                      <svg width="11" height="11" viewBox="0 0 12 12" fill="none" aria-hidden="true">
                        <path d="M2 6.4 4.5 8.8 10 3.6" stroke={v.color} strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round" />
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

function ExpandedPriorityPicker({
  value,
  displayValue,
  editable,
  onPick,
}: {
  value: ProjectPriority;
  displayValue?: ProjectPriority;
  editable: boolean;
  onPick: (priority: ProjectPriority) => void;
}) {
  const { open, triggerRect, triggerRef, menuRef, toggle, close } = useExpandedPickerMenu();
  const priorityLabel = usePriorityLabel();
  const effectiveValue = displayValue ?? value;
  const visual = { ...priorityVisuals[effectiveValue], label: priorityLabel(effectiveValue, priorityVisuals[effectiveValue].label) };
  const isAutoEscalated = effectiveValue !== value;

  return (
    <>
      <ExpandedFieldPill
        label="Priorité"
        innerRef={triggerRef}
        onClick={toggle}
        disabled={!editable}
        dotColor={visual.text}
        valueLabel={visual.label}
        title={isAutoEscalated ? "Priorité haussée automatiquement : échéance aujourd'hui ou dépassée" : "Changer la priorité"}
      />
      {open && triggerRect && typeof document !== "undefined"
        ? createPortal(
            <div
              ref={menuRef}
              role="listbox"
              onClick={(event) => event.stopPropagation()}
              style={{
                position: "fixed",
                top: triggerRect.bottom + 4,
                left: Math.max(8, triggerRect.left),
                zIndex: 9999,
                minWidth: Math.max(180, triggerRect.width),
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
              {PRIORITY_OPTIONS.map((option) => {
                const v = { ...priorityVisuals[option], label: priorityLabel(option, priorityVisuals[option].label) };
                const selected = option === value;
                return (
                  <button
                    key={option}
                    type="button"
                    onClick={(event) => {
                      event.stopPropagation();
                      close();
                      if (option !== value) onPick(option);
                    }}
                    className="flex items-center gap-2 rounded-lg px-2 py-1.5 text-left"
                    style={{
                      background: selected ? surface.s2 : "transparent",
                      border: "none",
                      color: text.secondary,
                      fontSize: 10.5,
                      fontWeight: 500,
                      cursor: "pointer",
                    }}
                  >
                    <span aria-hidden style={{ width: 7, height: 7, borderRadius: "50%", background: v.text, flexShrink: 0 }} />
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

function CompletionBlockedAlert({
  checklistTotal,
  checklistDone,
  onClose,
}: {
  checklistTotal: number;
  checklistDone: number;
  onClose: () => void;
}) {
  if (typeof document === "undefined") return null;
  const remaining = checklistTotal - checklistDone;
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
              Coche les {remaining} sous-action{remaining > 1 ? "s" : ""} restante{remaining > 1 ? "s" : ""} avant de marquer cette tâche comme terminée.
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

function QuickInfoTile({
  icon,
  empty,
  accentColor,
  editable,
  active,
  onClick,
  children,
}: {
  icon: "calendar" | "person" | "file";
  empty: boolean;
  accentColor: string;
  editable: boolean;
  active: boolean;
  onClick?: (event: React.MouseEvent<HTMLElement>) => void;
  children: ReactNode;
}) {
  const Element = editable ? "button" : "div";
  // Champ « allumé » quand une valeur est renseignée (date posée, personne
  // assignée, fichiers joints) : fond + bordure + texte en couleur d'accent.
  const filled = !empty;
  return (
    <Element
      type={editable ? "button" : undefined}
      onClick={onClick}
      className="flex min-w-0 items-center gap-1.5 text-left"
      style={{
        background: active
          ? surface.s2
          : filled
            ? `color-mix(in srgb, ${accentColor} 13%, transparent)`
            : surface.s3,
        border: `1px solid ${active || filled ? accentColor : surface.borderSubtle}`,
        borderRadius: 8,
        padding: "6px 8px",
        cursor: editable ? "pointer" : "default",
        transition: "border-color 120ms var(--mb-ease), background-color 120ms var(--mb-ease)",
      }}
    >
      <TaskPreviewIcon icon={icon} color={filled ? accentColor : empty ? accentColor : text.muted} />
      <span
        style={{
          fontSize: 10.5,
          fontWeight: filled ? 600 : 500,
          color: filled ? accentColor : empty ? accentColor : text.secondary,
          minWidth: 0,
          overflow: "hidden",
          textOverflow: "ellipsis",
          whiteSpace: "nowrap",
        }}
      >
        {children}
      </span>
    </Element>
  );
}

function DateEditor({
  task,
  accentColor,
  onSave,
  onClear,
  onCancel,
}: {
  task: Task;
  accentColor: string;
  onSave: (dueDate: string, dueTime: string) => void;
  onClear: () => void;
  onCancel: () => void;
}) {
  const [date, setDate] = useState(task.dueDate ?? "");
  const [time, setTime] = useState(task.dueTime ?? "");
  const dirty = (date || "") !== (task.dueDate ?? "") || (time || "") !== (task.dueTime ?? "");

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
      <p style={{ fontSize: 10.5, fontWeight: 600, color: text.muted, margin: 0, textTransform: "uppercase", letterSpacing: "0.08em" }}>
        Échéance
      </p>
      <div className="flex items-center gap-2">
        <input
          type="date"
          value={date}
          onChange={(event) => setDate(event.target.value)}
          className="mb-input"
          style={{ ...fieldInputStyle(), minHeight: 32, padding: "6px 8px", flex: 1 }}
        />
        <input
          type="time"
          value={time}
          onChange={(event) => setTime(event.target.value)}
          className="mb-input"
          style={{ ...fieldInputStyle(), minHeight: 32, padding: "6px 8px", width: 90 }}
        />
      </div>
      <div className="flex items-center gap-1.5">
        <Button
          variant="primary"
          size="sm"
          accentColor={accentColor}
          onClick={() => onSave(date, time)}
          disabled={!dirty || !date}
        >
          Enregistrer
        </Button>
        {task.dueDate && (
          <Button variant="ghost" size="sm" onClick={onClear}>
            Retirer
          </Button>
        )}
        <Button variant="ghost" size="sm" onClick={onCancel}>
          Annuler
        </Button>
      </div>
    </div>
  );
}

function PersonEditor({
  task,
  projectPeople,
  projectTeams,
  accentColor,
  emptyHint,
  onSave,
  onCancel,
}: {
  task: Task;
  projectPeople: Array<{ id: string; name: string }>;
  projectTeams: ProjectTeam[];
  accentColor: string;
  /** Texte affiché quand aucun collaborateur n'est disponible (adaptable hors projet). */
  emptyHint?: string;
  onSave: (input: { owner: string; assignees: string[]; teamIds: string[] }) => void;
  onCancel: () => void;
}) {
  const accountName = useAccountName();
  const firstName = (name: string) => name.trim().toLowerCase().split(" ")[0] ?? "";
  const t = useT();
  const meFirst = firstName(accountName);
  const isMe = (name: string) => Boolean(meFirst) && firstName(name) === meFirst;

  // État initial : on part des assignees existants (ou de l'ancien `owner` seul,
  // pour les tâches d'avant le multi-assignation).
  const initialAssignees = (task.assignees && task.assignees.length > 0
    ? task.assignees
    : task.owner?.trim()
      ? [task.owner.trim()]
      : []
  ).map((n) => n.trim()).filter(Boolean);
  const [assignees, setAssignees] = useState<string[]>(initialAssignees);
  const [teamIds, setTeamIds] = useState<string[]>(task.teamIds ?? []);
  // Recherche : sert UNIQUEMENT à filtrer les collaborateurs déjà ajoutés au
  // projet. On ne peut PAS créer de nom arbitraire ici — l'équipe se définit
  // dans « Collaborer » à la base du projet.
  const [query, setQuery] = useState("");

  const norm = (n: string) => n.trim().toLowerCase();

  // Le compte courant est représenté par la puce « Moi » → on l'exclut des
  // autres puces personnes pour éviter le doublon.
  const otherPeople = projectPeople.filter((person) => !isMe(person.name));
  const meSelected = assignees.some((a) => isMe(a));

  // Personnes assignées qui ne font plus partie des collaborateurs du projet
  // (données héritées / retirées de la collaboration). On les affiche en
  // lecture pour pouvoir les RETIRER, mais on ne peut plus en ajouter.
  const orphanAssignees = assignees.filter(
    (a) => !isMe(a) && !projectPeople.some((p) => norm(p.name) === norm(a)),
  );

  const q = norm(query);
  const filteredPeople = q
    ? otherPeople.filter((person) => norm(person.name).includes(q))
    : otherPeople;
  const meMatches = q ? "moi".includes(q) || norm(accountName).includes(q) : true;

  function toggleName(name: string) {
    const clean = name.trim();
    if (!clean) return;
    setAssignees((cur) =>
      cur.some((a) => norm(a) === norm(clean)) ? cur.filter((a) => norm(a) !== norm(clean)) : [...cur, clean],
    );
  }
  function toggleTeam(id: string) {
    setTeamIds((cur) => (cur.includes(id) ? cur.filter((t) => t !== id) : [...cur, id]));
  }

  function save() {
    const cleaned = assignees.map((a) => a.trim()).filter(Boolean);
    onSave({ owner: cleaned[0] ?? "", assignees: cleaned, teamIds });
  }

  const pill = (selected: boolean) => ({
    background: selected ? accentColor : surface.s2,
    color: selected ? "#FFFFFF" : text.secondary,
    border: `1px solid ${selected ? accentColor : surface.borderSubtle}`,
    cursor: "pointer" as const,
  });

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
      <p style={{ fontSize: 10.5, fontWeight: 600, color: text.muted, margin: 0, textTransform: "uppercase", letterSpacing: "0.08em" }}>
        {t("task.assignedPeople")}
      </p>

      {/* Recherche parmi les collaborateurs DÉJÀ ajoutés au projet. On ne
          peut pas saisir un nom arbitraire : la liste se définit dans
          « Collaborer ». Le champ ne fait que filtrer les puces ci-dessous. */}
      {otherPeople.length > 0 && (
        <input
          type="text"
          value={query}
          onChange={(event) => setQuery(event.target.value)}
          placeholder="Rechercher un collaborateur…"
          className="mb-input"
          style={{ ...fieldInputStyle(), minHeight: 32, padding: "6px 10px" }}
        />
      )}

      <div className="flex flex-wrap gap-1">
        {/* « Moi » : assigne la tâche au compte courant. */}
        {meMatches && (
          <button
            type="button"
            onClick={() => toggleName(accountName)}
            className="rounded-full px-2 py-0.5 text-[11px] font-semibold"
            style={pill(meSelected)}
          >
            Moi
          </button>
        )}
        {filteredPeople.map((person) => (
          <button
            key={person.id}
            type="button"
            onClick={() => toggleName(person.name)}
            className="rounded-full px-2 py-0.5 text-[11px] font-semibold"
            style={pill(assignees.some((a) => norm(a) === norm(person.name)))}
          >
            {person.name}
          </button>
        ))}
      </div>

      {/* Aucun collaborateur encore défini dans le projet → on renvoie vers
          « Collaborer », seul endroit où l'équipe se constitue. */}
      {otherPeople.length === 0 && (
        <p style={{ fontSize: 11, color: text.muted, margin: 0, lineHeight: 1.45 }}>
          {emptyHint ?? "Aucun collaborateur dans le projet. Ajoute des personnes via « Collaborer » à la base du projet pour pouvoir les assigner ici."}
        </p>
      )}

      {/* Personnes assignées qui ne sont plus dans la collaboration : on peut
          seulement les retirer (pas en ajouter de nouvelles). */}
      {orphanAssignees.length > 0 && (
        <>
          <p style={{ fontSize: 10, fontWeight: 600, color: text.muted, margin: "2px 0 0", textTransform: "uppercase", letterSpacing: "0.08em" }}>
            Hors collaboration
          </p>
          <div className="flex flex-wrap gap-1">
            {orphanAssignees.map((a) => (
              <button
                key={`orphan-${a}`}
                type="button"
                onClick={() => toggleName(a)}
                title="Retirer (cette personne n'est plus dans la collaboration)"
                className="rounded-full px-2 py-0.5 text-[11px] font-semibold"
                style={pill(true)}
              >
                {a} ✕
              </button>
            ))}
          </div>
        </>
      )}

      {projectTeams.length > 0 && (
        <>
          <p style={{ fontSize: 10.5, fontWeight: 600, color: text.muted, margin: "2px 0 0", textTransform: "uppercase", letterSpacing: "0.08em" }}>
            Équipes
          </p>
          <div className="flex flex-wrap gap-1">
            {projectTeams.map((team) => {
              const selected = teamIds.includes(team.id);
              const teamColor = team.color || accentColor;
              return (
                <button
                  key={team.id}
                  type="button"
                  onClick={() => toggleTeam(team.id)}
                  className="rounded-full px-2 py-0.5 text-[11px] font-semibold"
                  style={{
                    background: selected ? teamColor : surface.s2,
                    color: selected ? "#FFFFFF" : teamColor,
                    border: `1px solid ${selected ? teamColor : surface.borderSubtle}`,
                    cursor: "pointer",
                  }}
                >
                  {team.name}
                </button>
              );
            })}
          </div>
        </>
      )}

      <div className="flex items-center gap-1.5">
        <Button variant="primary" size="sm" accentColor={accentColor} onClick={save}>
          Enregistrer
        </Button>
        {(assignees.length > 0 || teamIds.length > 0) && (
          <Button variant="ghost" size="sm" onClick={() => { setAssignees([]); setTeamIds([]); }}>
            Tout retirer
          </Button>
        )}
        <Button variant="ghost" size="sm" onClick={onCancel}>
          Annuler
        </Button>
      </div>
    </div>
  );
}

// ─── Helpers ───────────────────────────────────────────────────────────────

type TaskPreviewIconName =
  | "expected"
  | "realization"
  | "note"
  | "person"
  | "file"
  | "calendar"
  | "checklist"
  | "discussion"
  | "info";

function TaskPreviewIcon({ icon, color }: { icon: TaskPreviewIconName; color: string }) {
  const size = icon === "calendar" || icon === "person" || icon === "file" ? 14 : 14;
  return (
    <svg width={size} height={size} viewBox="0 0 16 16" fill="none" aria-hidden="true">
      {icon === "expected" && (
        <>
          <path d="M4 3.2h8v10H4v-10Z" stroke={color} strokeWidth="1.45" strokeLinejoin="round" />
          <path d="M6 6h4M6 8.4h3.2" stroke={color} strokeWidth="1.45" strokeLinecap="round" />
        </>
      )}
      {icon === "realization" && (
        <path d="M3 8.1 6.5 11.5 13 4.8" stroke={color} strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round" />
      )}
      {icon === "note" && (
        <>
          <path d="M4 3.2h8v9.6H4V3.2Z" stroke={color} strokeWidth="1.45" strokeLinejoin="round" />
          <path d="M6 6h4M6 8.4h3" stroke={color} strokeWidth="1.45" strokeLinecap="round" />
        </>
      )}
      {icon === "person" && (
        <>
          <circle cx="8" cy="5.6" r="2.3" stroke={color} strokeWidth="1.45" />
          <path d="M3.8 13a4.3 4.3 0 0 1 8.4 0" stroke={color} strokeWidth="1.45" strokeLinecap="round" />
        </>
      )}
      {icon === "file" && (
        <>
          <path d="M4.5 2.8h4.1l2.9 2.9v7.5h-7V2.8Z" stroke={color} strokeWidth="1.45" strokeLinejoin="round" />
          <path d="M8.6 3v2.8h2.7" stroke={color} strokeWidth="1.45" strokeLinecap="round" strokeLinejoin="round" />
        </>
      )}
      {icon === "calendar" && (
        <>
          <path d="M4.5 2.8v1.8M11.5 2.8v1.8M3.3 6.2h9.4" stroke={color} strokeWidth="1.45" strokeLinecap="round" />
          <path
            d="M4.4 3.8h7.2A1.7 1.7 0 0 1 13.3 5.5v6.1a1.7 1.7 0 0 1-1.7 1.7H4.4a1.7 1.7 0 0 1-1.7-1.7V5.5a1.7 1.7 0 0 1 1.7-1.7Z"
            stroke={color}
            strokeWidth="1.45"
            strokeLinejoin="round"
          />
        </>
      )}
      {icon === "checklist" && (
        <>
          <path d="M3.5 5.3 5 6.8l2.5-3" stroke={color} strokeWidth="1.45" strokeLinecap="round" strokeLinejoin="round" />
          <path
            d="M8.5 5.5h4M3.5 10.4 5 11.9l2.5-3M8.5 10.6h4"
            stroke={color}
            strokeWidth="1.45"
            strokeLinecap="round"
            strokeLinejoin="round"
          />
        </>
      )}
      {icon === "discussion" && (
        <path
          d="M3 4.6A2.1 2.1 0 0 1 5.1 2.5h5.8A2.1 2.1 0 0 1 13 4.6v3.2a2.1 2.1 0 0 1-2.1 2.1H8.3L5 12.7V9.9A2.1 2.1 0 0 1 3 7.8V4.6Z"
          stroke={color}
          strokeWidth="1.45"
          strokeLinejoin="round"
        />
      )}
      {icon === "info" && (
        <>
          <circle cx="8" cy="8" r="5.3" stroke={color} strokeWidth="1.45" />
          <path d="M8 7.4v3.4M8 5.2h.01" stroke={color} strokeWidth="1.55" strokeLinecap="round" />
        </>
      )}
    </svg>
  );
}

function formatTaskScheduleLabel(task: Task) {
  if (!task.dueDate) return "Ajouter";
  return formatTaskScheduleDate(task.dueDate, task.dueTime);
}

function formatDiscussionTime(value: string) {
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return value;
  return date.toLocaleTimeString("fr-FR", { hour: "2-digit", minute: "2-digit" });
}

// Détecte un jeton de mention « @partiel » juste avant le curseur : @ précédé
// d'un début de chaîne ou d'un espace, suivi de lettres/chiffres accentués.
// Sert à filtrer les collaborateurs au fil de la frappe.
function findMentionToken(value: string, caret: number): { start: number; query: string } | null {
  const upto = value.slice(0, caret);
  const match = /(^|\s)@([\p{L}\p{N}._-]*)$/u.exec(upto);
  if (!match) return null;
  return { start: match.index + match[1].length, query: match[2] };
}

function normalizeName(value: string) {
  return value.normalize("NFD").replace(new RegExp("[\\u0300-\\u036f]", "g"), "").toLowerCase();
}

function cryptoRandomId() {
  if (typeof crypto !== "undefined" && typeof crypto.randomUUID === "function") {
    return crypto.randomUUID().slice(0, 8);
  }
  return Math.random().toString(36).slice(2, 10);
}
