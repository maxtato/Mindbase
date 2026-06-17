"use client";

import { useEffect, useState } from "react";
import { createPortal } from "react-dom";
import { DocumentsCard } from "@/components/projects/documents-card";
import type { ProjectFile } from "@/lib/mock-data";
import { surface, text } from "@/lib/design-tokens";
import type { Workspace } from "@/lib/workspace";

interface ProjectFilesLauncherProps {
  projectId: string;
  workspace: Workspace;
  files: ProjectFile[];
  accentColor: string;
}

export function ProjectFilesLauncher({ projectId, workspace, files, accentColor }: ProjectFilesLauncherProps) {
  const [open, setOpen] = useState(false);
  const hasFiles = files.length > 0;

  // Suivi « vu » local : on mémorise (sur l'appareil) les ids de fichiers déjà
  // consultés → pastille « nouveau » pour ceux pas encore vus, tout en gardant
  // le nombre TOTAL de fichiers joints.
  const seenKey = `mb-files-seen-${projectId}`;
  const [seenIds, setSeenIds] = useState<string[]>([]);
  const [mounted, setMounted] = useState(false);
  useEffect(() => {
    setMounted(true);
    try {
      const raw = window.localStorage.getItem(seenKey);
      setSeenIds(raw ? (JSON.parse(raw) as string[]) : []);
    } catch {
      setSeenIds([]);
    }
  }, [seenKey]);

  const unseenCount = mounted ? files.filter((file) => !seenIds.includes(file.id)).length : 0;

  function markFilesSeen() {
    const allIds = files.map((file) => file.id);
    setSeenIds(allIds);
    try {
      window.localStorage.setItem(seenKey, JSON.stringify(allIds));
    } catch {
      /* stockage indisponible */
    }
  }

  function openFiles() {
    markFilesSeen();
    setOpen(true);
  }

  useEffect(() => {
    if (!open) return;
    const handler = (event: KeyboardEvent) => {
      if (event.key === "Escape") setOpen(false);
    };
    window.addEventListener("keydown", handler);
    return () => window.removeEventListener("keydown", handler);
  }, [open]);

  return (
    <>
      <button
        type="button"
        onClick={openFiles}
        className="mb-project-top-action mb-project-icon-action"
        style={{
          background: surface.s1,
          color: hasFiles ? accentColor : text.secondary,
          borderColor: hasFiles ? accentColor : surface.border,
        }}
        title={`Fichiers${hasFiles ? ` · ${files.length} fichier${files.length > 1 ? "s" : ""}` : ""}${unseenCount > 0 ? ` · ${unseenCount} nouveau${unseenCount > 1 ? "x" : ""}` : ""}`}
        aria-label="Fichiers"
      >
        <FileIcon />
        {/* Nombre TOTAL de fichiers joints. */}
        {hasFiles && (
          <span className="mb-project-action-dot" style={{ background: accentColor }} aria-hidden="true">
            {files.length > 9 ? "9+" : files.length}
          </span>
        )}
        {/* Pastille « nouveau » : fichiers pas encore vus (en haut à gauche). */}
        {unseenCount > 0 && (
          <span
            aria-hidden="true"
            title={`${unseenCount} nouveau${unseenCount > 1 ? "x" : ""} fichier${unseenCount > 1 ? "s" : ""}`}
            style={{
              position: "absolute",
              top: -4,
              left: -4,
              minWidth: 15,
              height: 15,
              padding: "0 3px",
              borderRadius: 999,
              background: "var(--mb-status-red-text)",
              color: "#FFFFFF",
              fontSize: 9,
              fontWeight: 700,
              lineHeight: "15px",
              textAlign: "center",
              border: `2px solid ${surface.s1}`,
            }}
          >
            {unseenCount > 9 ? "9+" : unseenCount}
          </span>
        )}
      </button>

      {open && typeof document !== "undefined" && createPortal(
        <>
          <button
            type="button"
            aria-label="Fermer les fichiers"
            onClick={() => setOpen(false)}
            className="mb-modal-backdrop"
            style={{
              position: "fixed",
              inset: 0,
              zIndex: 50,
              border: "none",
              cursor: "default",
            }}
          />
          <section
            role="dialog"
            aria-modal="true"
            aria-label="Fichiers du projet"
            className="mb-modal-surface rounded-3xl overflow-hidden"
            style={{
              position: "fixed",
              top: "50%",
              left: "50%",
              transform: "translate(-50%, -50%)",
              width: "min(760px, calc(100vw - 32px))",
              maxHeight: "min(760px, calc(100dvh - 40px))",
              overflowY: "auto",
              zIndex: 60,
            }}
          >
            <div className="flex items-center justify-between gap-3 px-5 py-4" style={{ borderBottom: `1px solid ${surface.borderSubtle}` }}>
              <div>
                <p className="text-sm font-semibold" style={{ color: text.primary }}>
                  Fichiers du projet
                </p>
                <p className="mt-0.5 text-[11px]" style={{ color: text.muted }}>
                  {files.length} fichier{files.length > 1 ? "s" : ""} visible{files.length > 1 ? "s" : ""} pour le projet.
                </p>
              </div>
              <button
                type="button"
                onClick={() => setOpen(false)}
                className="flex h-8 w-8 items-center justify-center rounded-xl"
                style={{ background: surface.s2, color: text.secondary, border: `1px solid ${surface.border}`, cursor: "pointer" }}
                title="Fermer"
              >
                <svg width="13" height="13" viewBox="0 0 16 16" fill="none" aria-hidden="true">
                  <path d="m4 4 8 8M12 4l-8 8" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" />
                </svg>
              </button>
            </div>
            <div className="p-4">
              <DocumentsCard projectId={projectId} workspace={workspace} initialFiles={files} />
            </div>
          </section>
        </>,
        document.body,
      )}
    </>
  );
}

function FileIcon() {
  return (
    <svg width="14" height="14" viewBox="0 0 16 16" fill="none" aria-hidden="true">
      <path d="M4.5 2.5h4L12 6v7.5h-7.5v-11Z" stroke="currentColor" strokeWidth="1.4" strokeLinejoin="round" />
      <path d="M8.5 2.7V6h3.2" stroke="currentColor" strokeWidth="1.4" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  );
}
