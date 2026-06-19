"use client";

import { useEffect, useRef, useState, useTransition, type ReactNode } from "react";
import { createPortal } from "react-dom";
import Link from "next/link";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { updateTaskAction } from "@/app/dashboard/projects/[id]/actions";
import { TaskExpandedPreview, QuickInfos } from "@/components/projects/task-expanded-preview";
import type { ChecklistItem, ProjectPerson, ProjectStatusSettings, ProjectTeam, Task } from "@/lib/mock-data";
import { surface, text } from "@/lib/design-tokens";
import type { Workspace } from "@/lib/workspace";
import { useT } from "@/components/i18n/locale-provider";

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
  /** Mode "controlled" : si fourni, l'ouverture du drawer est pilotée par
   *  le parent (ex : le calendrier qui gère un selectedTask global pour
   *  éviter le démontage du portail quand sa modal liste se ferme). */
  controlledOpen?: boolean;
  onControlledOpenChange?: (open: boolean) => void;
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
  controlledOpen,
  onControlledOpenChange,
}: TaskDetailLauncherProps) {
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const isControlled = controlledOpen !== undefined;
  const [internalOpen, setInternalOpen] = useState(false);
  const open = isControlled ? controlledOpen : internalOpen;
  const setOpen = (next: boolean) => {
    if (isControlled) {
      onControlledOpenChange?.(next);
    } else {
      setInternalOpen(next);
    }
  };
  const [draftTask, setDraftTask] = useState(task);
  const [, startTransition] = useTransition();
  // Une édition a-t-elle eu lieu pendant que le drawer était ouvert ? Si oui,
  // on rafraîchit l'arbre serveur à la FERMETURE (pas pendant l'édition, pour
  // ne pas démonter le drawer) afin que la liste/le tableau et une éventuelle
  // réouverture reflètent les valeurs persistées (assignation, statut, date…).
  const dirtyRef = useRef(false);

  // Auto-ouvrir le drawer si l'URL contient taskId qui correspond à cette
  // tâche. Permet d'arriver depuis le dashboard ou kanban directement sur
  // une tâche ouverte. La fermeture nettoie le paramètre pour rester sur
  // la page projet sans drawer. Désactivé en mode contrôlé (le parent gère).
  const urlTaskId = isControlled ? null : searchParams?.get("taskId");
  useEffect(() => {
    if (isControlled) return;
    if (urlTaskId === task.id) setInternalOpen(true);
  }, [urlTaskId, task.id, isControlled]);

  function clearTaskIdFromUrl() {
    if (isControlled || !urlTaskId) return;
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
    // Toujours optimiste sur le state local : le drawer reflète
    // immédiatement la modification (statut, date, attendu, …) et reste
    // monté. Pas de router.refresh qui remonterait le launcher et
    // fermerait le drawer en plein milieu de l'édition. Les compteurs
    // globaux (sidebar, dashboard) se re-sync à la prochaine navigation.
    setDraftTask((current) => ({ ...current, ...input }));
    dirtyRef.current = true;
    if (onTaskChange) {
      onTaskChange(input);
    }
    startTransition(async () => {
      await updateTaskAction(projectId, stepId, task.id, input);
    });
  }

  function handleChecklistMutated(nextChecklist: ChecklistItem[]) {
    // Mise à jour optimiste du state local : le drawer reflète immédiatement
    // la nouvelle checklist sans re-fetch RSC. C'est ce qui évite que le
    // drawer ne se "ferme" visuellement quand on coche un item ou applique
    // une suggestion IA.
    setDraftTask((current) => ({ ...current, checklist: nextChecklist }));
    dirtyRef.current = true;
    if (onChecklistChange) {
      onChecklistChange(nextChecklist);
    }
    startTransition(async () => {
      // Persiste côté serveur en arrière-plan. PAS de router.refresh ici :
      // ça déclencherait un re-render du Server Component parent qui peut
      // remonter le launcher (et fermer le drawer). Les vues globales
      // (sidebar stats, dashboard counters) seront re-sync à la prochaine
      // navigation.
      await updateTaskAction(projectId, stepId, task.id, { checklist: nextChecklist });
    });
  }

  function openTask() {
    setDraftTask(task);
    dirtyRef.current = false;
    setOpen(true);
  }

  // Fermeture : on synchronise l'arbre serveur si une édition a eu lieu, pour
  // que les valeurs persistées (assignation, date, statut…) soient reflétées
  // partout (liste, tableau, réouverture). Le drawer étant en train de se
  // fermer, le refresh ne le démonte pas en plein milieu d'une édition.
  function handleClose() {
    setOpen(false);
    clearTaskIdFromUrl();
    if (dirtyRef.current) {
      dirtyRef.current = false;
      startTransition(() => router.refresh());
    }
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
          onClose={handleClose}
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
  const t = useT();
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
        className="mb-modal-surface mb-task-drawer rounded-[22px] overflow-hidden"
        style={{
          display: "flex",
          flexDirection: "column",
          zIndex: 80,
        }}
      >
        <header
          className="flex shrink-0 flex-col gap-3 px-5 py-4"
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
          <div className="flex items-start justify-between gap-4">
            <div className="min-w-0 flex-1">
              <p
                className="text-[10.5px] font-semibold uppercase tracking-[0.14em]"
                style={{ color: text.muted }}
              >
                Tâche · {stepTitle}
              </p>
              <h2
                className="mt-1 text-base font-bold"
                style={{
                  color: text.primary,
                  letterSpacing: "-0.005em",
                  // Titre de la tâche OUVERTE : affiché EN ENTIER (s'enroule sur
                  // plusieurs lignes), jamais tronqué. On gère les mots très longs.
                  lineHeight: 1.3,
                  overflowWrap: "anywhere",
                  wordBreak: "break-word",
                }}
              >
                {task.title}
              </h2>
              {stepDescription && (
                <p className="mt-0.5 truncate text-[11.5px]" style={{ color: text.muted }}>
                  {stepDescription}
                </p>
              )}
            </div>
            {/* Actions en-tête : « Voir le projet » (icône seule) à gauche de la
                croix de fermeture. Le lien projet est surtout utile quand la
                tâche est ouverte depuis le Kanban ou le Calendrier. */}
            <div className="flex shrink-0 items-center gap-2">
              <Link
                href={`/dashboard/projects/${projectId}?workspace=${workspace}`}
                onClick={onClose}
                className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl"
                style={{ background: surface.s2, color: text.secondary, border: `1px solid ${surface.borderSubtle}`, textDecoration: "none", cursor: "pointer" }}
                title={t("task.openProject")}
                aria-label={t("task.openProject")}
              >
                <svg width="13" height="13" viewBox="0 0 16 16" fill="none" aria-hidden="true">
                  <path d="M2.5 5.2A1.7 1.7 0 0 1 4.2 3.5h2.3l1.3 1.4h4A1.7 1.7 0 0 1 13.5 6.6v5a1.7 1.7 0 0 1-1.7 1.7H4.2a1.7 1.7 0 0 1-1.7-1.7V5.2Z" stroke="currentColor" strokeWidth="1.35" strokeLinejoin="round" />
                </svg>
              </Link>
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
            </div>
          </div>

          {/* Champs (date, personne, fichiers, statut, priorité) directement
              sous le titre, sans carte ni libellé — la barre d'en-tête reste
              fixe, tout le reste scrolle. */}
          <QuickInfos
            headless
            task={task}
            linkedTeams={projectTeams.filter((team) => task.teamIds?.includes(team.id))}
            accentColor={accentColor}
            projectPeople={projectPeople.map((person) => ({ id: person.id, name: person.name }))}
            projectTeams={projectTeams}
            onUpdate={onUpdate}
            statusSettings={statusSettings}
          />
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
