"use client";

import { useState, useTransition, useRef, useEffect, useLayoutEffect } from "react";
import { createPortal } from "react-dom";
import { useRouter } from "next/navigation";
import {
  updateProjectStatusAction,
  updateProjectPriorityAction,
  archiveProjectAction,
  deleteProjectAction,
  duplicateProjectAction,
  updateProjectStatusSettingsAction,
} from "@/app/dashboard/projects/[id]/actions";
import { updateProjectIdentityAction } from "@/app/dashboard/projects/actions";
import { surface, text } from "@/lib/design-tokens";
import { deriveStepStatus, deriveTaskStatus, stepStatusLabels, taskStatusLabels } from "@/lib/project-plan";
import { priorityVisuals } from "@/lib/project-taxonomy";
import { deleteTone, TrashIcon } from "@/components/ui/trash-icon";
import { useEnvironments } from "@/components/environments/environments-provider";
import { listEnvironmentOptions, type Workspace } from "@/lib/workspace";
import type { ProjectStatus, ProjectStatusSettings, Step, StepStatus, TaskStatus } from "@/lib/mock-data";
import type { ProjectPriority } from "@/lib/project-taxonomy";

const STATUS_OPTIONS: { value: ProjectStatus; label: string }[] = [
  { value: "preparing", label: "À préparer" },
  { value: "active", label: "En cours" },
  { value: "paused", label: "En pause" },
  { value: "completed", label: "Terminé" },
  { value: "archived", label: "Archivé" },
];

const STATUS_VISUALS: Record<ProjectStatus, { bg: string; text: string; dot: string }> = {
  preparing: { bg: "var(--mb-status-gray-bg)", text: "var(--mb-status-gray-text)", dot: "var(--mb-text-ghost)" },
  active: { bg: "var(--mb-status-green-bg)", text: "var(--mb-status-green-text)", dot: "var(--mb-status-green-text)" },
  paused: { bg: "var(--mb-status-yellow-bg)", text: "var(--mb-status-yellow-text)", dot: "var(--mb-status-yellow-text)" },
  "on-hold": { bg: "var(--mb-status-yellow-bg)", text: "var(--mb-status-yellow-text)", dot: "var(--mb-status-yellow-text)" },
  completed: { bg: "var(--mb-status-blue-bg)", text: "var(--mb-status-blue-text)", dot: "var(--mb-status-blue-text)" },
  archived: { bg: "var(--mb-status-gray-bg)", text: "var(--mb-status-gray-text)", dot: "var(--mb-text-ghost)" },
};

const PRIORITY_OPTIONS: { value: ProjectPriority; label: string }[] = [
  { value: "high", label: "Haute" },
  { value: "medium", label: "Moyenne" },
  { value: "low", label: "Faible" },
];

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

interface ProjectControlsProps {
  projectId: string;
  workspace: string;
  currentStatus: ProjectStatus;
  currentStatusMode?: "auto" | "manual";
  currentPriority: ProjectPriority;
  hideDestructive?: boolean;
  /** Mode compact : pills réduits, pour intégration inline (ex : à côté du %). */
  compact?: boolean;
}

export function ProjectControls({
  projectId,
  workspace,
  currentStatus,
  currentStatusMode = "auto",
  currentPriority,
  hideDestructive = false,
  compact = false,
}: ProjectControlsProps) {
  const [isPending, startTransition] = useTransition();
  const [statusOpen, setStatusOpen] = useState(false);
  const [priorityOpen, setPriorityOpen] = useState(false);
  const statusRef = useRef<HTMLDivElement>(null);
  const priorityRef = useRef<HTMLDivElement>(null);

  // Close dropdowns on outside click
  useEffect(() => {
    function handleClick(e: PointerEvent) {
      if (statusRef.current && !statusRef.current.contains(e.target as Node)) setStatusOpen(false);
      if (priorityRef.current && !priorityRef.current.contains(e.target as Node)) setPriorityOpen(false);
    }
    document.addEventListener("pointerdown", handleClick);
    return () => document.removeEventListener("pointerdown", handleClick);
  }, []);

  const statusVisual = STATUS_VISUALS[currentStatus];
  const priorityVisual = priorityVisuals[currentPriority];

  function handleStatusChange(status: ProjectStatus) {
    setStatusOpen(false);
    startTransition(() => updateProjectStatusAction(projectId, status));
  }

  function handlePriorityChange(priority: ProjectPriority) {
    setPriorityOpen(false);
    startTransition(() => updateProjectPriorityAction(projectId, priority));
  }

  const pillStyle = compact
    ? { padding: "2px 7px", fontSize: 10.5, gap: 4, borderRadius: 999, whiteSpace: "nowrap" as const, flexShrink: 0 }
    : { padding: "6px 10px", fontSize: 12, gap: 6, borderRadius: 8, whiteSpace: "nowrap" as const, flexShrink: 0 };
  const dotSize = compact ? 5 : 6;
  const chevronSize = compact ? 8 : 9;

  return (
    <div className="flex items-center gap-1.5 flex-nowrap" aria-busy={isPending}>

      {/* Status selector — pill sobre : fond neutre, texte gris, dot coloré */}
      <div ref={statusRef} style={{ position: "relative" }}>
        <button
          type="button"
          onClick={() => { setPriorityOpen(false); setStatusOpen((value) => !value); }}
          className="inline-flex items-center font-medium"
          style={{
            background: surface.s2,
            color: text.secondary,
            border: `1px solid ${surface.borderSubtle}`,
            cursor: "pointer",
            ...pillStyle,
          }}
          title="Changer le statut"
        >
          <span className="rounded-full shrink-0" style={{ width: dotSize, height: dotSize, background: statusVisual.dot }} />
          {STATUS_OPTIONS.find((s) => s.value === currentStatus)?.label ?? currentStatus}
          {currentStatusMode === "manual" && currentStatus !== "archived" && !compact && (
            <span className="text-[10px]" style={{ color: text.muted }}>manuel</span>
          )}
          <svg width={chevronSize} height={chevronSize} viewBox="0 0 16 16" fill="none" style={{ marginLeft: 1, opacity: 0.55 }}>
            <path d="M4 6l4 4 4-4" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round" />
          </svg>
        </button>
        {statusOpen && (
          <div
            className="rounded-xl overflow-hidden"
            style={{
              position: "absolute",
              top: "calc(100% + 6px)",
              right: 0,
              zIndex: 1000,
              background: surface.s1,
              border: `1px solid ${surface.border}`,
              boxShadow: `0 14px 0 -13px ${surface.borderHover}`,
              minWidth: 160,
            }}
          >
            {STATUS_OPTIONS.map((opt) => {
              const v = STATUS_VISUALS[opt.value];
              const selected = opt.value === currentStatus;
              return (
                <button
                  key={opt.value}
                  onClick={() => handleStatusChange(opt.value)}
                  className="w-full flex items-center gap-2.5 px-3 py-2.5 text-xs text-left"
                  style={{
                    color: text.secondary,
                    background: selected ? surface.s2 : surface.s1,
                    fontWeight: selected ? 600 : 400,
                    cursor: "pointer",
                  }}
                >
                  <span className="w-1.5 h-1.5 rounded-full shrink-0" style={{ background: v.dot }} />
                  {opt.label}
                  {selected && (
                    <svg width="10" height="10" viewBox="0 0 16 16" fill="none" style={{ marginLeft: "auto", color: v.dot }}>
                      <path d="M3 8l4 4 6-6" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" />
                    </svg>
                  )}
                </button>
              );
            })}
          </div>
        )}
      </div>

      {/* Priority selector — pill sobre : fond neutre, texte gris, dot coloré */}
      <div ref={priorityRef} style={{ position: "relative" }}>
        <button
          type="button"
          onClick={() => { setStatusOpen(false); setPriorityOpen((value) => !value); }}
          className="inline-flex items-center font-medium"
          style={{
            background: surface.s2,
            color: text.secondary,
            border: `1px solid ${surface.borderSubtle}`,
            cursor: "pointer",
            ...pillStyle,
          }}
          title="Changer la priorité"
        >
          <span className="rounded-full shrink-0" style={{ width: dotSize, height: dotSize, background: priorityVisual.text }} />
          {priorityVisual.label}
          <svg width={chevronSize} height={chevronSize} viewBox="0 0 16 16" fill="none" style={{ marginLeft: 1, opacity: 0.55 }}>
            <path d="M4 6l4 4 4-4" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round" />
          </svg>
        </button>
        {priorityOpen && (
          <div
            className="rounded-xl overflow-hidden"
            style={{
              position: "absolute",
              top: "calc(100% + 6px)",
              right: 0,
              zIndex: 1000,
              background: surface.s1,
              border: `1px solid ${surface.border}`,
              boxShadow: `0 14px 0 -13px ${surface.borderHover}`,
              minWidth: 150,
            }}
          >
            {PRIORITY_OPTIONS.map((opt) => {
              const v = priorityVisuals[opt.value];
              const selected = opt.value === currentPriority;
              return (
                <button
                  key={opt.value}
                  onClick={() => handlePriorityChange(opt.value)}
                  className="w-full flex items-center gap-2.5 px-3 py-2.5 text-xs text-left"
                  style={{
                    color: text.secondary,
                    background: selected ? surface.s2 : surface.s1,
                    fontWeight: selected ? 600 : 400,
                    cursor: "pointer",
                  }}
                >
                  <span className="w-1.5 h-1.5 rounded-full shrink-0" style={{ background: v.text }} />
                  {opt.label}
                  {selected && (
                    <svg width="10" height="10" viewBox="0 0 16 16" fill="none" style={{ marginLeft: "auto", color: v.text }}>
                      <path d="M3 8l4 4 6-6" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" />
                    </svg>
                  )}
                </button>
              );
            })}
          </div>
        )}
      </div>

      {!hideDestructive && (
        <ProjectDestructiveControls
          projectId={projectId}
          workspace={workspace}
          currentStatus={currentStatus}
        />
      )}
    </div>
  );
}

export function ProjectDestructiveControls({
  projectId,
  workspace,
  currentStatus,
}: {
  projectId: string;
  workspace: string;
  currentStatus: ProjectStatus;
}) {
  const [isPending, startTransition] = useTransition();
  const [deleteConfirm, setDeleteConfirm] = useState(false);

  function handleArchive() {
    startTransition(() => archiveProjectAction(projectId, workspace));
  }

  function handleDelete() {
    startTransition(() => deleteProjectAction(projectId, workspace));
  }

  function handleDuplicate() {
    startTransition(() => duplicateProjectAction(projectId, workspace));
  }

  return (
    <div className="flex items-center justify-end gap-2" aria-busy={isPending}>
      <button
        onClick={handleDuplicate}
        className="flex h-9 items-center gap-1.5 px-3 rounded-xl text-xs font-semibold"
        style={{ background: surface.s2, color: text.muted }}
        title="Dupliquer le projet"
      >
        <svg width="13" height="13" viewBox="0 0 16 16" fill="none">
          <rect x="5.5" y="5.5" width="8" height="8" rx="1.6" stroke="currentColor" strokeWidth="1.4" />
          <path d="M10.5 5.5V4a1.6 1.6 0 0 0-1.6-1.6H4A1.6 1.6 0 0 0 2.5 4v4.9A1.6 1.6 0 0 0 4 10.5h1.5" stroke="currentColor" strokeWidth="1.4" strokeLinecap="round" strokeLinejoin="round" />
        </svg>
        Dupliquer
      </button>
      {currentStatus !== "archived" && (
        <button
          onClick={handleArchive}
          className="flex h-9 items-center gap-1.5 px-3 rounded-xl text-xs font-semibold"
          style={{ background: surface.s2, color: text.muted }}
          title="Archiver le projet"
        >
          <svg width="13" height="13" viewBox="0 0 16 16" fill="none">
            <path d="M2 4h12v1.5a1 1 0 0 1-1 1H3a1 1 0 0 1-1-1V4ZM3.5 6.5V13h9V6.5" stroke="currentColor" strokeWidth="1.4" strokeLinecap="round" strokeLinejoin="round" />
            <path d="M6 9.5h4" stroke="currentColor" strokeWidth="1.4" strokeLinecap="round" />
          </svg>
          Archiver
        </button>
      )}

      {!deleteConfirm ? (
        <button
          onClick={() => setDeleteConfirm(true)}
          className="flex h-9 items-center justify-center rounded-xl text-xs font-semibold"
          aria-label="Supprimer le projet"
          style={{
            width: 42,
            background: deleteTone.bg,
            color: deleteTone.text,
          }}
          title="Supprimer le projet"
        >
          <TrashIcon size={17} />
        </button>
      ) : (
        <div className="flex h-9 items-center gap-1 rounded-xl overflow-hidden" style={{ background: deleteTone.bg }}>
          <span className="px-2 text-xs font-semibold" style={{ color: deleteTone.text }}>
            Supprimer ?
          </span>
          <button
            onClick={handleDelete}
            className="h-full px-2.5 text-xs font-semibold"
            style={{ background: deleteTone.solid, color: "#fff" }}
          >
            Oui
          </button>
          <button
            onClick={() => setDeleteConfirm(false)}
            className="h-full px-2.5 text-xs"
            style={{ background: surface.s2, color: text.muted }}
          >
            Non
          </button>
        </div>
      )}
    </div>
  );
}

export function ProjectSettingsMenu({
  projectId,
  projectName,
  workspace,
  currentStatus,
  statusSettings,
  accentColor,
  steps = [],
}: {
  projectId: string;
  projectName: string;
  workspace: string;
  currentStatus: ProjectStatus;
  statusSettings?: ProjectStatusSettings;
  accentColor?: string;
  steps?: Step[];
}) {
  const [isOpen, setIsOpen] = useState(false);
  const [settingsOpen, setSettingsOpen] = useState(false);
  const [mounted, setMounted] = useState(false);
  const buttonRef = useRef<HTMLButtonElement>(null);
  const menuContentRef = useRef<HTMLDivElement>(null);
  const [menuPos, setMenuPos] = useState<{ top: number; left: number; width: number; maxHeight: number } | null>(null);

  useEffect(() => setMounted(true), []);

  // Position du menu (portal vers <body> pour échapper au overflow de la barre
  // d'actions). Borné à la largeur/hauteur de l'écran → tient sur iPhone.
  useLayoutEffect(() => {
    if (!isOpen) return;
    function update() {
      const button = buttonRef.current;
      if (!button) return;
      const rect = button.getBoundingClientRect();
      const margin = 12;
      const width = Math.min(330, window.innerWidth - margin * 2);
      const left = Math.max(margin, Math.min(rect.right - width, window.innerWidth - width - margin));
      const top = rect.bottom + 8;
      // Le menu ne descend jamais sous le bas de l'écran (scroll interne sinon).
      const maxHeight = window.innerHeight - top - margin;
      setMenuPos({ top, left, width, maxHeight: Math.max(160, maxHeight) });
    }
    update();
    window.addEventListener("resize", update);
    window.addEventListener("scroll", update, true);
    return () => {
      window.removeEventListener("resize", update);
      window.removeEventListener("scroll", update, true);
    };
  }, [isOpen]);

  useEffect(() => {
    if (!isOpen) return;
    function handleClick(event: PointerEvent) {
      const target = event.target as Node;
      if (buttonRef.current?.contains(target)) return;
      if (menuContentRef.current?.contains(target)) return;
      setIsOpen(false);
    }
    const timer = window.setTimeout(() => document.addEventListener("pointerdown", handleClick), 0);
    return () => {
      window.clearTimeout(timer);
      document.removeEventListener("pointerdown", handleClick);
    };
  }, [isOpen]);

  return (
    <div style={{ position: "relative" }}>
      <button
        ref={buttonRef}
        type="button"
        onClick={() => setIsOpen((value) => !value)}
        className="mb-project-top-action mb-project-icon-action"
        style={{ background: surface.s1, color: text.secondary, borderColor: surface.border }}
        title="Paramètres"
        aria-label="Paramètres"
      >
        <svg width="14" height="14" viewBox="0 0 16 16" fill="none" aria-hidden="true">
          <path d="M8 10.3a2.3 2.3 0 1 0 0-4.6 2.3 2.3 0 0 0 0 4.6Z" stroke="currentColor" strokeWidth="1.45" />
          <path d="M13.2 8a5.4 5.4 0 0 0-.1-1l1.3-1-1.3-2.2-1.6.6a5.1 5.1 0 0 0-1.7-1L9.6 1.7H6.4l-.2 1.7a5.1 5.1 0 0 0-1.7 1l-1.6-.6-1.3 2.2 1.3 1a5.4 5.4 0 0 0 0 2l-1.3 1 1.3 2.2 1.6-.6a5.1 5.1 0 0 0 1.7 1l.2 1.7h3.2l.2-1.7a5.1 5.1 0 0 0 1.7-1l1.6.6 1.3-2.2-1.3-1c.1-.3.1-.6.1-1Z" stroke="currentColor" strokeWidth="1.2" strokeLinejoin="round" />
        </svg>
      </button>

      {mounted && isOpen && menuPos && createPortal(
        <div
          ref={menuContentRef}
          className="rounded-2xl p-3"
          style={{
            position: "fixed",
            top: menuPos.top,
            left: menuPos.left,
            width: menuPos.width,
            maxHeight: menuPos.maxHeight,
            overflowY: "auto",
            zIndex: 1300,
            background: surface.s1,
            border: `1px solid ${surface.border}`,
            boxShadow: "var(--mb-shadow-menu)",
          }}
        >
          <p className="mb-2 text-[10px] font-semibold uppercase tracking-[0.14em]" style={{ color: text.muted }}>
            Gestion du projet
          </p>
          <button
            type="button"
            onClick={() => {
              setIsOpen(false);
              setSettingsOpen(true);
            }}
            className="mb-3 flex w-full items-center justify-between gap-3 rounded-2xl p-3 text-left"
            style={{ background: surface.s2, color: text.secondary, border: `1px solid ${surface.borderSubtle}`, cursor: "pointer" }}
          >
            <span>
              <span className="block text-xs font-semibold" style={{ color: text.primary }}>
                Paramètres du projet
              </span>
              <span className="mt-0.5 block text-[11px] leading-snug" style={{ color: text.muted }}>
                Renommer le projet, changer d'environnement et personnaliser les statuts.
              </span>
            </span>
            <svg width="13" height="13" viewBox="0 0 16 16" fill="none" aria-hidden="true">
              <path d="M6 3l5 5-5 5" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round" />
            </svg>
          </button>
          <ProjectDestructiveControls projectId={projectId} workspace={workspace} currentStatus={currentStatus} />
        </div>,
        document.body,
      )}
      <ProjectStatusSettingsModal
        open={settingsOpen}
        onClose={() => setSettingsOpen(false)}
        projectId={projectId}
        projectName={projectName}
        workspace={workspace}
        statusSettings={statusSettings}
        accentColor={accentColor}
        steps={steps}
      />
    </div>
  );
}

function ProjectStatusSettingsModal({
  open,
  onClose,
  projectId,
  projectName,
  workspace,
  statusSettings,
  accentColor,
  steps,
}: {
  open: boolean;
  onClose: () => void;
  projectId: string;
  projectName: string;
  workspace: string;
  statusSettings?: ProjectStatusSettings;
  accentColor?: string;
  steps: Step[];
}) {
  useEffect(() => {
    if (!open) return;
    const handler = (event: KeyboardEvent) => {
      if (event.key === "Escape") onClose();
    };
    window.addEventListener("keydown", handler);
    return () => window.removeEventListener("keydown", handler);
  }, [open, onClose]);

  if (!open || typeof document === "undefined") return null;

  return createPortal(
    <>
      <button
        type="button"
        aria-label="Fermer la personnalisation des statuts"
        onClick={onClose}
        className="mb-modal-backdrop"
        style={{ position: "fixed", inset: 0, zIndex: 70, border: "none", cursor: "default" }}
      />
      <section
        role="dialog"
        aria-modal="true"
        aria-label="Paramètres du projet"
        className="mb-modal-surface mb-task-drawer rounded-3xl overflow-hidden flex flex-col"
        style={{
          // Position + width + height héritées de .mb-task-drawer (cf.
          // app/globals.css) qui gère déjà safe-areas iPhone et bottom-nav.
          // L'élément (position:fixed) ne scrolle PAS lui-même : le défilement
          // d'un fixed est peu fiable sur iOS/PWA. On le confie au conteneur
          // interne ci-dessous.
          zIndex: 80,
        }}
      >
        <header className="flex shrink-0 items-start justify-between gap-4 px-6 py-5" style={{ borderBottom: `1px solid ${surface.borderSubtle}` }}>
          <div>
            <h2 className="text-lg font-bold" style={{ color: text.primary, letterSpacing: "-0.01em" }}>
              Paramètres du projet
            </h2>
            <p className="mt-1 max-w-xl text-xs leading-relaxed" style={{ color: text.muted }}>
              Renomme le projet, change son environnement et personnalise les statuts.
            </p>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl"
            style={{ background: surface.s2, color: text.secondary, border: `1px solid ${surface.borderSubtle}`, cursor: "pointer" }}
            title="Fermer"
          >
            <svg width="13" height="13" viewBox="0 0 16 16" fill="none" aria-hidden="true">
              <path d="m4 4 8 8M12 4l-8 8" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" />
            </svg>
          </button>
        </header>

        {/* Corps scrollable : flex-1 + minHeight 0 → prend la hauteur restante
            sous le header et défile correctement (y compris jusqu'au dernier
            statut), sur desktop comme en PWA iOS. */}
        <div className="flex-1 overflow-y-auto" style={{ minHeight: 0 }}>
          <ProjectIdentitySettings
            projectId={projectId}
            projectName={projectName}
            workspace={workspace}
            accentColor={accentColor}
          />

          <div className="grid gap-5 px-6 pb-6 lg:grid-cols-2">
            <StatusSettingsEditor
              scope="task"
              title="Statuts des tâches"
              projectId={projectId}
              statusSettings={statusSettings}
              accentColor={accentColor}
              usageCounts={buildTaskStatusUsageCounts(steps)}
            />
            <StatusSettingsEditor
              scope="step"
              title="Statuts des étapes"
              projectId={projectId}
              statusSettings={statusSettings}
              accentColor={accentColor}
              usageCounts={buildStepStatusUsageCounts(steps)}
            />
          </div>
        </div>
      </section>
    </>,
    document.body,
  );
}

// Bloc « Projet » des paramètres : renommer le projet + le rattacher à un autre
// environnement (Perso / Pro / personnalisé). Réutilise updateProjectIdentityAction
// (qui accepte désormais un `name` optionnel).
function ProjectIdentitySettings({
  projectId,
  projectName,
  workspace,
  accentColor,
}: {
  projectId: string;
  projectName: string;
  workspace: string;
  accentColor?: string;
}) {
  const router = useRouter();
  const [name, setName] = useState(projectName);
  const [selectedWorkspace, setSelectedWorkspace] = useState<Workspace>(workspace);
  const [isPending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);
  const [saved, setSaved] = useState(false);

  const environments = useEnvironments();
  const environmentOptions = listEnvironmentOptions(environments);

  const trimmed = name.trim();
  const dirty = trimmed !== projectName || selectedWorkspace !== workspace;
  const accent = accentColor ?? "var(--mb-personal-accent)";

  // Resynchronise si le projet change sous nos pieds (router.refresh).
  useEffect(() => {
    setName(projectName);
    setSelectedWorkspace(workspace);
  }, [projectName, workspace]);

  function save() {
    if (!trimmed) {
      setError("Le nom du projet ne peut pas être vide.");
      return;
    }
    setError(null);
    startTransition(async () => {
      await updateProjectIdentityAction({ projectId, workspace: selectedWorkspace, name: trimmed });
      setSaved(true);
      router.refresh();
    });
  }

  return (
    <div className="px-6 pt-6">
      <section className="rounded-[22px] p-4" style={{ background: surface.s2, border: `1px solid ${surface.borderSubtle}` }}>
        <h3 className="text-sm font-bold" style={{ color: text.primary, letterSpacing: "-0.005em" }}>
          Projet
        </h3>
        <p className="mt-1 text-[11px] leading-snug" style={{ color: text.muted }}>
          Renomme le projet et choisis l'environnement auquel il est rattaché.
        </p>

        <label className="mt-4 block text-[11px] font-semibold uppercase tracking-[0.14em]" style={{ color: text.muted }}>
          Nom du projet
        </label>
        <input
          value={name}
          onChange={(event) => {
            setName(event.target.value);
            setError(null);
            setSaved(false);
          }}
          placeholder="Nom du projet"
          className="mt-2 w-full rounded-xl px-3 py-2.5 text-sm"
          style={{ background: surface.s1, color: text.primary, border: `1px solid ${surface.borderSubtle}` }}
        />

        <label className="mt-4 block text-[11px] font-semibold uppercase tracking-[0.14em]" style={{ color: text.muted }}>
          Environnement
        </label>
        <div className="mt-2 flex flex-wrap gap-1.5">
          {environmentOptions.map((option) => {
            const selected = selectedWorkspace === option.value;
            return (
              <button
                key={option.value}
                type="button"
                onClick={() => {
                  setSelectedWorkspace(option.value);
                  setSaved(false);
                }}
                className="rounded-full px-3 py-1.5 text-xs font-semibold"
                style={{
                  background: selected ? accent : surface.s1,
                  color: selected ? "#FFFFFF" : text.secondary,
                  border: `1px solid ${selected ? accent : surface.borderSubtle}`,
                  cursor: "pointer",
                }}
              >
                {option.label}
              </button>
            );
          })}
        </div>

        {error && (
          <p className="mt-3 rounded-2xl px-3 py-2 text-[11px] font-semibold" style={{ background: "var(--mb-error-bg)", color: "var(--mb-error-text)", border: "1px solid var(--mb-error-border)" }}>
            {error}
          </p>
        )}

        <div className="mt-4 flex items-center justify-end gap-3">
          {saved && !dirty && (
            <span className="text-[11px] font-semibold" style={{ color: text.muted }}>
              Enregistré
            </span>
          )}
          <button
            type="button"
            onClick={save}
            disabled={isPending || !dirty}
            className="rounded-xl px-4 py-2.5 text-xs font-bold"
            style={{
              background: isPending || !dirty ? surface.s3 : accent,
              color: isPending || !dirty ? text.muted : "#FFFFFF",
              border: "none",
              cursor: isPending ? "wait" : !dirty ? "default" : "pointer",
            }}
          >
            {isPending ? "Enregistrement..." : "Enregistrer"}
          </button>
        </div>
      </section>
    </div>
  );
}

function StatusSettingsEditor({
  scope,
  title,
  projectId,
  statusSettings,
  accentColor,
  usageCounts,
}: {
  scope: "task" | "step";
  title: string;
  projectId: string;
  statusSettings?: ProjectStatusSettings;
  accentColor?: string;
  usageCounts: Partial<Record<TaskStatus | StepStatus, number>>;
}) {
  const router = useRouter();
  const [isPending, startTransition] = useTransition();
  const statusOrder = scope === "task" ? TASK_STATUS_ORDER : STEP_STATUS_ORDER;
  const [rows, setRows] = useState<Array<EditableStatusRow<TaskStatus | StepStatus>>>(() =>
    buildEditableStatusRows(scope, statusSettings),
  );
  const [rowErrors, setRowErrors] = useState<Record<string, string>>({});
  const [saveError, setSaveError] = useState<string | null>(null);

  function getStatusLabel(status: TaskStatus | StepStatus) {
    return scope === "task" ? taskStatusLabels[status as TaskStatus] : stepStatusLabels[status as StepStatus];
  }

  function getDefaultStatusColor(status: TaskStatus | StepStatus) {
    return scope === "task"
      ? TASK_STATUS_DEFAULT_COLORS[status as TaskStatus]
      : STEP_STATUS_DEFAULT_COLORS[status as StepStatus];
  }

  const hiddenBaseStatuses = statusOrder.filter(
    (status) => !rows.some((row) => row.base && row.systemStatus === status),
  );

  function updateRow(id: string, patch: Partial<EditableStatusRow<TaskStatus | StepStatus>>) {
    setRowErrors((current) => ({ ...current, [id]: "" }));
    setSaveError(null);
    setRows((current) => current.map((row) => (row.id === id ? { ...row, ...patch } : row)));
  }

  function removeRow(id: string) {
    const row = rows.find((item) => item.id === id);
    if (!row) return;
    const usageCount = row.base ? usageCounts[row.systemStatus] ?? 0 : 0;
    if (usageCount > 0) {
      setRowErrors((errors) => ({
        ...errors,
        [id]:
          scope === "task"
            ? `${usageCount} tâche${usageCount > 1 ? "s utilisent" : " utilise"} encore ce statut. Change d'abord leur statut.`
            : `${usageCount} étape${usageCount > 1 ? "s utilisent" : " utilise"} encore ce statut. Change d'abord leur statut.`,
      }));
      return;
    }
    if (rows.length <= 1) return;
    setRowErrors((errors) => {
      const next = { ...errors };
      delete next[id];
      return next;
    });
    setSaveError(null);
    setRows((current) => current.filter((item) => item.id !== id));
  }

  function addCustomStatus() {
    const fallbackStatus = statusOrder[0];
    setRows((current) => [
      ...current,
      {
        id: `${scope}-custom-${Date.now()}-${Math.random().toString(16).slice(2)}`,
        systemStatus: fallbackStatus,
        label: "Nouveau statut",
        color: getDefaultStatusColor(fallbackStatus),
        base: false,
      },
    ]);
  }

  function restoreBaseStatus(status: TaskStatus | StepStatus) {
    setRows((current) => [
      ...current,
      {
        id: `${scope}-${status}`,
        systemStatus: status,
        label: getStatusLabel(status),
        color: getDefaultStatusColor(status),
        base: true,
      },
    ]);
  }

  function save() {
    setSaveError(null);
    const cleanedRows = rows
      .map((row) => ({
        ...row,
        label: row.label.trim(),
        color: normalizeStatusColor(row.color, getDefaultStatusColor(row.systemStatus)),
      }))
      .filter((row) => row.label);

    const nextSettings = buildNextProjectStatusSettings(scope, statusSettings, cleanedRows);

    startTransition(async () => {
      const result = await updateProjectStatusSettingsAction(projectId, nextSettings);
      if (!result.ok) {
        setSaveError(result.error ?? "Impossible d'enregistrer cette personnalisation.");
        return;
      }
      router.refresh();
    });
  }

  return (
    <section className="rounded-[22px] p-4" style={{ background: surface.s2, border: `1px solid ${surface.borderSubtle}` }}>
      <div className="flex items-start justify-between gap-3">
        <div>
          <h3 className="text-sm font-bold" style={{ color: text.primary, letterSpacing: "-0.005em" }}>
            {title}
          </h3>
          <p className="mt-1 text-[11px] leading-snug" style={{ color: text.muted }}>
            Les nouveaux statuts restent reliés à une catégorie système pour garder le Kanban et l'IA cohérents.
          </p>
        </div>
        <button
          type="button"
          onClick={addCustomStatus}
          className="shrink-0 rounded-xl px-3 py-2 text-[11px] font-semibold"
          style={{ background: accentColor ?? surface.s3, color: accentColor ? "#FFFFFF" : text.primary, border: "none", cursor: "pointer" }}
        >
          + Ajouter
        </button>
      </div>

      <div className="mt-4 grid gap-2">
        {rows.map((row) => (
          <StatusEditorRow
            key={row.id}
            row={row}
            statusOrder={statusOrder}
            getStatusLabel={getStatusLabel}
            onChange={(patch) => updateRow(row.id, patch)}
            onRemove={() => removeRow(row.id)}
            removeDisabled={rows.length <= 1}
            errorMessage={rowErrors[row.id]}
          />
        ))}
      </div>

      {saveError && (
        <p className="mt-3 rounded-2xl px-3 py-2 text-[11px] font-semibold" style={{ background: "var(--mb-error-bg)", color: "var(--mb-error-text)", border: "1px solid var(--mb-error-border)" }}>
          {saveError}
        </p>
      )}

      {hiddenBaseStatuses.length > 0 && (
        <div className="mt-3 rounded-2xl p-3" style={{ background: surface.s1, border: `1px dashed ${surface.borderSubtle}` }}>
          <p className="text-[10px] font-semibold uppercase tracking-[0.14em]" style={{ color: text.muted }}>
            Statuts masqués
          </p>
          <div className="mt-2 flex flex-wrap gap-1.5">
            {hiddenBaseStatuses.map((status) => (
              <button
                key={status}
                type="button"
                onClick={() => restoreBaseStatus(status)}
                className="rounded-full px-2.5 py-1.5 text-[11px] font-semibold"
                style={{ background: surface.s2, color: text.secondary, border: `1px solid ${surface.borderSubtle}`, cursor: "pointer" }}
              >
                Restaurer {getStatusLabel(status)}
              </button>
            ))}
          </div>
        </div>
      )}

      <div className="mt-4 flex justify-end">
        <button
          type="button"
          onClick={save}
          disabled={isPending}
          className="rounded-xl px-4 py-2.5 text-xs font-bold"
          style={{
            background: isPending ? surface.s3 : accentColor ?? surface.s3,
            color: isPending ? text.muted : accentColor ? "#FFFFFF" : text.primary,
            border: "none",
            cursor: isPending ? "wait" : "pointer",
          }}
        >
          {isPending ? "Enregistrement..." : "Enregistrer"}
        </button>
      </div>
    </section>
  );
}

type EditableStatusRow<TStatus extends string> = {
  id: string;
  systemStatus: TStatus;
  label: string;
  color: string;
  base: boolean;
};

function StatusEditorRow({
  row,
  statusOrder,
  getStatusLabel,
  onChange,
  onRemove,
  removeDisabled,
  errorMessage,
}: {
  row: EditableStatusRow<TaskStatus | StepStatus>;
  statusOrder: Array<TaskStatus | StepStatus>;
  getStatusLabel: (status: TaskStatus | StepStatus) => string;
  onChange: (patch: Partial<EditableStatusRow<TaskStatus | StepStatus>>) => void;
  onRemove: () => void;
  removeDisabled: boolean;
  errorMessage?: string;
}) {
  return (
    <div
      className="grid gap-2 rounded-2xl p-2.5"
      style={{ background: surface.s1, border: `1px solid ${surface.borderSubtle}` }}
    >
      <div
        className="grid items-center gap-2"
        style={{ gridTemplateColumns: row.base ? "38px minmax(0, 1fr) 38px" : "38px minmax(0, 1fr) minmax(112px, 0.7fr) 38px" }}
      >
        <label className="relative inline-flex h-9 w-9 shrink-0 items-center justify-center rounded-xl" style={{ background: row.color, cursor: "pointer", overflow: "hidden" }}>
          <input
            type="color"
            value={row.color}
            onChange={(event) => onChange({ color: event.target.value })}
            className="absolute inset-0 h-full w-full cursor-pointer opacity-0"
            aria-label="Couleur du statut"
          />
        </label>
        <input
          value={row.label}
          onChange={(event) => onChange({ label: event.target.value })}
          placeholder="Nom du statut"
          className="h-9 min-w-0 rounded-xl px-3 text-[12px] font-medium outline-none"
          style={{ background: surface.s2, color: text.primary, border: `1px solid ${surface.borderSubtle}` }}
        />
        {!row.base && (
          <select
            value={row.systemStatus}
            onChange={(event) => onChange({ systemStatus: event.target.value as TaskStatus | StepStatus })}
            className="h-9 min-w-0 rounded-xl px-2 text-[11px] font-semibold outline-none"
            style={{ background: surface.s2, color: text.secondary, border: `1px solid ${surface.borderSubtle}` }}
            aria-label="Catégorie système"
          >
            {statusOrder.map((status) => (
              <option key={status} value={status}>
                {getStatusLabel(status)}
              </option>
            ))}
          </select>
        )}
        <button
          type="button"
          onClick={onRemove}
          disabled={removeDisabled}
          className="flex h-9 w-9 items-center justify-center rounded-xl"
          style={{
            background: removeDisabled ? surface.s2 : "var(--mb-delete-bg)",
            color: removeDisabled ? text.ghost : "var(--mb-delete-text)",
            border: `1px solid ${removeDisabled ? surface.borderSubtle : "var(--mb-delete-border)"}`,
            cursor: removeDisabled ? "not-allowed" : "pointer",
          }}
          title="Supprimer le statut"
          aria-label="Supprimer le statut"
        >
          <svg width="12" height="12" viewBox="0 0 16 16" fill="none" aria-hidden="true">
            <path d="m4 4 8 8M12 4l-8 8" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" />
          </svg>
        </button>
      </div>
      {errorMessage && (
        <p className="pl-[46px] text-[10.5px] font-semibold leading-snug" style={{ color: "var(--mb-error-text)" }}>
          {errorMessage}
        </p>
      )}
      {row.base && (
        <p className="pl-[46px] text-[10px] leading-snug" style={{ color: text.muted }}>
          Catégorie système : {getStatusLabel(row.systemStatus)}
        </p>
      )}
    </div>
  );
}

function buildEditableStatusRows(
  scope: "task" | "step",
  settings?: ProjectStatusSettings,
): Array<EditableStatusRow<TaskStatus | StepStatus>> {
  if (scope === "task") {
    return [
      ...TASK_STATUS_ORDER
        .filter((status) => settings?.task?.[status]?.enabled !== false)
        .map((status) => {
          const setting = settings?.task?.[status];
          return {
            id: `task-${status}`,
            systemStatus: status,
            label: setting?.label ?? taskStatusLabels[status],
            color: setting?.color ?? TASK_STATUS_DEFAULT_COLORS[status],
            base: true,
          };
        }),
      ...(settings?.customTask ?? [])
        .filter((setting) => setting.enabled !== false)
        .map((setting, index) => ({
          id: setting.id ?? `task-custom-${index + 1}`,
          systemStatus: setting.systemStatus,
          label: setting.label,
          color: setting.color,
          base: false,
        })),
    ];
  }

  return [
    ...STEP_STATUS_ORDER
      .filter((status) => settings?.step?.[status]?.enabled !== false)
      .map((status) => {
        const setting = settings?.step?.[status];
        return {
          id: `step-${status}`,
          systemStatus: status,
          label: setting?.label ?? stepStatusLabels[status],
          color: setting?.color ?? STEP_STATUS_DEFAULT_COLORS[status],
          base: true,
        };
      }),
    ...(settings?.customStep ?? [])
      .filter((setting) => setting.enabled !== false)
      .map((setting, index) => ({
        id: setting.id ?? `step-custom-${index + 1}`,
        systemStatus: setting.systemStatus,
        label: setting.label,
        color: setting.color,
        base: false,
      })),
  ];
}

function buildTaskStatusUsageCounts(steps: Step[]): Partial<Record<TaskStatus, number>> {
  return steps
    .flatMap((step) => step.tasks)
    .reduce<Partial<Record<TaskStatus, number>>>((acc, task) => {
      const status = deriveTaskStatus(task);
      acc[status] = (acc[status] ?? 0) + 1;
      return acc;
    }, {});
}

function buildStepStatusUsageCounts(steps: Step[]): Partial<Record<StepStatus, number>> {
  return steps.reduce<Partial<Record<StepStatus, number>>>((acc, step) => {
    const status = deriveStepStatus(step.tasks);
    acc[status] = (acc[status] ?? 0) + 1;
    return acc;
  }, {});
}

function buildNextProjectStatusSettings(
  scope: "task" | "step",
  currentSettings: ProjectStatusSettings | undefined,
  rows: Array<EditableStatusRow<TaskStatus | StepStatus>>,
): ProjectStatusSettings {
  const statusOrder = scope === "task" ? TASK_STATUS_ORDER : STEP_STATUS_ORDER;
  const labels = scope === "task" ? taskStatusLabels : stepStatusLabels;
  const colors = scope === "task" ? TASK_STATUS_DEFAULT_COLORS : STEP_STATUS_DEFAULT_COLORS;

  const nextBase = Object.fromEntries(
    statusOrder.map((status) => {
      const row = rows.find((item) => item.base && item.systemStatus === status);
      return [
        status,
        {
          systemStatus: status,
          label: row?.label || labels[status as never],
          color: row?.color || colors[status as never],
          enabled: Boolean(row),
        },
      ];
    }),
  );

  const nextCustom = rows
    .filter((row) => !row.base)
    .map((row, index) => ({
      id: row.id || `${scope}-custom-${index + 1}`,
      systemStatus: row.systemStatus,
      label: row.label,
      color: row.color,
      enabled: true,
    }));

  if (scope === "task") {
    return {
      ...(currentSettings ?? {}),
      task: nextBase as ProjectStatusSettings["task"],
      customTask: nextCustom as ProjectStatusSettings["customTask"],
    };
  }

  return {
    ...(currentSettings ?? {}),
    step: nextBase as ProjectStatusSettings["step"],
    customStep: nextCustom as ProjectStatusSettings["customStep"],
  };
}

function normalizeStatusColor(value: string, fallback: string) {
  return /^#[0-9a-fA-F]{6}$/.test(value) ? value : fallback;
}
