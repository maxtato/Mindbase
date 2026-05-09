"use client";

import { useRef, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { deleteProjectFileAction, uploadProjectFilesAction } from "@/app/dashboard/projects/[id]/actions";
import type { ProjectFile } from "@/lib/mock-data";
import { buildProjectFileHref, isInlinePreviewFriendly, projectFileTypeMeta } from "@/lib/project-files";
import { error as errorTokens, surface, text } from "@/lib/design-tokens";
import { workspaceTheme, type Workspace } from "@/lib/workspace";
import { deleteTone, TrashIcon } from "@/components/ui/trash-icon";

interface DocumentsCardProps {
  projectId: string;
  workspace: Workspace;
  initialFiles?: ProjectFile[];
  compact?: boolean;
}

export function DocumentsCard({ projectId, workspace, initialFiles = [], compact = false }: DocumentsCardProps) {
  const router = useRouter();
  const inputRef = useRef<HTMLInputElement>(null);
  const [previewFileId, setPreviewFileId] = useState<string | null>(initialFiles[0]?.id ?? null);
  const [uploadError, setUploadError] = useState<string | null>(null);
  const [compactExpanded, setCompactExpanded] = useState(false);
  const [isPending, startTransition] = useTransition();
  const theme = workspaceTheme[workspace];

  function openUploadPicker() {
    if (compact) setCompactExpanded(true);
    inputRef.current?.click();
  }

  function handleFileChange(event: React.ChangeEvent<HTMLInputElement>) {
    const picked = Array.from(event.target.files ?? []);
    if (picked.length === 0) return;

    const formData = new FormData();
    formData.set("projectId", projectId);
    formData.set("workspace", workspace);
    picked.forEach((file) => formData.append("files", file));
    setUploadError(null);

    startTransition(async () => {
      try {
        const result = await uploadProjectFilesAction(formData);
        if (!result.ok) {
          setUploadError(result.error);
          return;
        }
        router.refresh();
      } catch (error) {
        console.error("[project_file_upload]", error);
        setUploadError("Impossible d'ajouter le fichier pour le moment.");
      }
    });

    event.target.value = "";
  }

  function handleDelete(fileId: string) {
    setUploadError(null);
    startTransition(async () => {
      try {
        await deleteProjectFileAction(projectId, fileId);
        router.refresh();
      } catch (error) {
        console.error("[project_file_delete]", error);
        setUploadError("Impossible de supprimer ce fichier pour le moment.");
      }
    });
  }

  const files = initialFiles;
  const selectedFile = previewFileId ? files.find((file) => file.id === previewFileId) ?? null : null;

  if (compact) {
    if (!compactExpanded) {
      return (
        <div
          className="mb-card-premium mb-card-subtle rounded-2xl p-3"
          style={{ background: surface.s1, border: `1px solid ${surface.border}` }}
        >
          <input
            ref={inputRef}
            type="file"
            multiple
            className="hidden"
            onChange={handleFileChange}
          />
          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={() => setCompactExpanded(true)}
              className="flex min-w-0 flex-1 items-center gap-3 rounded-xl px-2.5 py-2 text-left"
              style={{ background: surface.s2, border: `1px solid ${surface.borderSubtle}`, cursor: "pointer" }}
            >
              <span
                className="flex h-8 w-8 shrink-0 items-center justify-center rounded-xl"
                style={{ background: theme.accentBg, color: theme.accentText, border: `1px solid ${theme.accentBorder}` }}
              >
                <svg width="14" height="14" viewBox="0 0 16 16" fill="none" aria-hidden="true">
                  <path d="M4 2.5h5l3 3V13a1 1 0 0 1-1 1H4a1 1 0 0 1-1-1V3.5a1 1 0 0 1 1-1Z" stroke="currentColor" strokeWidth="1.35" strokeLinejoin="round" />
                  <path d="M9 2.5V6h3" stroke="currentColor" strokeWidth="1.35" strokeLinejoin="round" />
                </svg>
              </span>
              <span className="min-w-0">
                <span className="block text-xs font-semibold" style={{ color: text.primary }}>
                  Fichiers joints
                </span>
                <span className="block text-[11px]" style={{ color: text.muted }}>
                  {files.length} fichier{files.length !== 1 ? "s" : ""}
                </span>
              </span>
            </button>
            <button
              type="button"
              onClick={() => setCompactExpanded(true)}
              className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full transition-transform hover:translate-x-0.5"
              style={{
                background: theme.accentBg,
                color: theme.accentText,
                border: `1px solid ${theme.accentBorder}`,
                cursor: "pointer",
              }}
              aria-label="Afficher les fichiers joints"
              title="Afficher les fichiers joints"
            >
              <svg width="13" height="13" viewBox="0 0 16 16" fill="none" aria-hidden="true">
                <path d="m6 3 4.5 5L6 13" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round" />
              </svg>
            </button>
          </div>
          {uploadError && (
            <div
              className="mt-2 rounded-xl px-3 py-2 text-xs font-medium"
              style={{ background: errorTokens.bg, color: errorTokens.text, border: `1px solid ${errorTokens.border}` }}
            >
              {uploadError}
            </div>
          )}
        </div>
      );
    }

    return (
      <div
        className="mb-card-premium mb-card-subtle rounded-2xl p-4"
        style={{ background: surface.s1, border: `1px solid ${surface.border}` }}
      >
        <div className="flex items-center justify-between gap-3 mb-3">
          <div className="min-w-0">
            <p className="text-sm font-semibold" style={{ color: text.primary }}>Fichiers joints</p>
            <p className="text-[11px] mt-0.5" style={{ color: text.muted }}>
              {files.length} fichier{files.length !== 1 ? "s" : ""} disponible{files.length !== 1 ? "s" : ""} pour le contexte du projet.
            </p>
          </div>
          <input
            ref={inputRef}
            type="file"
            multiple
            className="hidden"
            onChange={handleFileChange}
          />
          <button
            type="button"
            onClick={openUploadPicker}
            className="rounded-lg px-2.5 py-1.5 text-xs font-semibold shrink-0"
            style={{ background: theme.accent, color: "#FFFFFF", border: `1px solid ${theme.accentBorder}`, cursor: isPending ? "wait" : "pointer" }}
            disabled={isPending}
          >
            {isPending ? "Ajout..." : "+ Ajouter"}
          </button>
          <button
            type="button"
            onClick={() => setCompactExpanded(false)}
            className="rounded-lg px-2.5 py-1.5 text-xs font-semibold shrink-0"
            style={{ background: surface.s2, color: text.secondary, border: `1px solid ${surface.border}`, cursor: "pointer" }}
          >
            Réduire
          </button>
        </div>

        {uploadError && (
          <div
            className="mb-3 rounded-xl px-3 py-2 text-xs font-medium"
            style={{ background: errorTokens.bg, color: errorTokens.text, border: `1px solid ${errorTokens.border}` }}
          >
            {uploadError}
          </div>
        )}

        {files.length === 0 ? (
          <button
            type="button"
            onClick={openUploadPicker}
            className="w-full rounded-xl px-3 py-3 text-xs text-left"
            style={{ background: surface.s2, color: text.muted, border: `1px dashed ${surface.border}` }}
          >
            Ajouter les fichiers utiles au projet.
          </button>
        ) : (
          <div className="flex flex-wrap gap-2">
            {files.slice(0, 4).map((file) => {
              const meta = projectFileTypeMeta[file.ext];
              return (
                <div
                  key={file.id}
                  className="rounded-xl px-2.5 py-2"
                  style={{ background: surface.s2, border: `1px solid ${surface.borderSubtle}`, minWidth: 150, flex: "1 1 150px" }}
                >
                  <div className="flex items-center gap-2">
                    <span
                      className="w-7 h-7 rounded-lg flex items-center justify-center shrink-0 text-[9px] font-bold"
                      style={{ background: `${meta.color}22`, color: meta.color, border: `1px solid ${meta.color}` }}
                    >
                      {meta.label}
                    </span>
                    <div className="min-w-0">
                      <p className="text-[11px] font-semibold truncate" style={{ color: text.primary }}>{file.name}</p>
                      {file.taskTitle && (
                        <p className="text-[10px] mt-0.5 truncate" style={{ color: text.muted }}>
                          Tâche · {file.taskTitle}
                        </p>
                      )}
                      <div className="mt-1 flex items-center gap-2">
                        <a href={buildProjectFileHref(projectId, file.id)} target="_blank" rel="noreferrer" className="text-[10px] font-semibold" style={{ color: text.secondary }}>
                          Ouvrir
                        </a>
                        <a href={buildProjectFileHref(projectId, file.id, "download")} className="text-[10px] font-semibold" style={{ color: text.secondary }}>
                          Télécharger
                        </a>
                      </div>
                    </div>
                  </div>
                </div>
              );
            })}
            {files.length > 4 && (
              <span className="rounded-xl px-3 py-2 text-[11px] font-semibold" style={{ background: surface.s2, color: text.muted, border: `1px solid ${surface.borderSubtle}` }}>
                +{files.length - 4} autre{files.length - 4 > 1 ? "s" : ""}
              </span>
            )}
          </div>
        )}
      </div>
    );
  }

  return (
    <div
      className="mb-card-premium mb-card-subtle rounded-2xl p-5"
      style={{ background: surface.s1, border: `1px solid ${surface.border}` }}
    >
      <div className="flex items-center justify-between gap-3 mb-4">
        <div>
          <p className="text-sm font-semibold" style={{ color: text.primary }}>Documents</p>
          <p className="text-[11px] mt-0.5" style={{ color: text.muted }}>
            Fichiers visibles par le projet et disponibles dans le contexte projet.
          </p>
        </div>
        <input
          ref={inputRef}
          type="file"
          multiple
          className="hidden"
          onChange={handleFileChange}
        />
        <button
          type="button"
          onClick={openUploadPicker}
          className="flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg text-xs font-semibold"
          style={{ background: surface.s2, color: text.secondary, border: `1px solid ${surface.border}` }}
          disabled={isPending}
        >
          <svg width="11" height="11" viewBox="0 0 16 16" fill="none">
            <path d="M8 3v10M3 8h10" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" />
          </svg>
          {isPending ? "Ajout..." : "Ajouter"}
        </button>
      </div>

      {uploadError && (
        <div
          className="mb-3 rounded-xl px-3 py-2 text-xs font-medium"
          style={{ background: errorTokens.bg, color: errorTokens.text, border: `1px solid ${errorTokens.border}` }}
        >
          {uploadError}
        </div>
      )}

      {files.length === 0 ? (
        <button
          type="button"
          onClick={openUploadPicker}
          className="mb-card-premium mb-card-subtle mb-card-hover w-full rounded-xl flex flex-col items-center justify-center gap-2 py-6"
          style={{ background: surface.s2, border: `1px dashed ${surface.border}` }}
        >
          <svg width="20" height="20" viewBox="0 0 16 16" fill="none">
            <path d="M3 10.5V12a1 1 0 0 0 1 1h8a1 1 0 0 0 1-1v-1.5M8 3v7M5.5 5.5 8 3l2.5 2.5" stroke={text.muted} strokeWidth="1.4" strokeLinecap="round" strokeLinejoin="round" />
          </svg>
          <p className="text-xs" style={{ color: text.muted }}>Cliquer pour ajouter des fichiers</p>
        </button>
      ) : (
        <>
          <div className="flex flex-col" style={{ gap: "0.5rem" }}>
            {files.map((file) => {
              const meta = projectFileTypeMeta[file.ext];
              const isSelected = selectedFile?.id === file.id;
              const previewHref = buildProjectFileHref(projectId, file.id);
              const downloadHref = buildProjectFileHref(projectId, file.id, "download");

              return (
                <div
                  key={file.id}
                  className="mb-card-premium mb-card-subtle rounded-xl p-3"
                  style={{
                    background: isSelected ? surface.s3 : surface.s2,
                    border: `1px solid ${isSelected ? meta.color : surface.border}`,
                  }}
                >
                  <div className="flex items-center gap-3">
                    <div
                      className="w-9 h-9 rounded-xl flex items-center justify-center shrink-0 text-[10px] font-bold"
                      style={{ background: `${meta.color}22`, color: meta.color, border: `1px solid ${meta.color}` }}
                    >
                      {meta.label}
                    </div>
                    <div className="min-w-0 flex-1">
                      <p className="text-xs font-semibold truncate" style={{ color: text.primary }}>{file.name}</p>
                      <p className="text-[11px] mt-0.5" style={{ color: text.muted }}>
                        {[file.size, file.addedAt].filter(Boolean).join(" · ")}
                      </p>
                      {file.taskTitle && (
                        <p className="text-[11px] mt-0.5 truncate" style={{ color: text.muted }}>
                          Depuis la tâche · {file.taskTitle}
                        </p>
                      )}
                    </div>
                  </div>

                  <div className="mt-2 flex items-center gap-1.5 flex-wrap">
                    <button
                      type="button"
                      onClick={() => setPreviewFileId(isSelected ? null : file.id)}
                      className="rounded-lg px-2 py-1 text-[10px] font-semibold"
                      style={{ background: surface.s1, color: text.secondary, border: `1px solid ${surface.border}` }}
                    >
                      {isSelected ? "Masquer" : "Visualiser"}
                    </button>
                    <a
                      href={previewHref}
                      target="_blank"
                      rel="noreferrer"
                      className="rounded-lg px-2 py-1 text-[10px] font-semibold"
                      style={{ background: surface.s1, color: text.secondary, border: `1px solid ${surface.border}` }}
                    >
                      Ouvrir
                    </a>
                    <a
                      href={downloadHref}
                      className="rounded-lg px-2 py-1 text-[10px] font-semibold"
                      style={{ background: surface.s1, color: text.secondary, border: `1px solid ${surface.border}` }}
                    >
                      Télécharger
                    </a>
                    <button
                      type="button"
                      onClick={() => handleDelete(file.id)}
                      className="ml-auto inline-flex items-center gap-1 rounded-lg px-2 py-1 text-[10px] font-semibold"
                      style={{ background: surface.s1, color: deleteTone.text, border: `1px solid ${deleteTone.border}` }}
                      title="Supprimer"
                    >
                      <TrashIcon size={11} />
                      Supprimer
                    </button>
                  </div>
                </div>
              );
            })}
          </div>

          {selectedFile && (
            <div className="mt-3 rounded-xl overflow-hidden" style={{ background: surface.s2, border: `1px solid ${surface.border}` }}>
              <div className="px-3 py-2 flex items-center justify-between gap-3" style={{ borderBottom: `1px solid ${surface.border}` }}>
                <p className="text-xs font-semibold truncate" style={{ color: text.primary }}>
                  Aperçu · {selectedFile.name}
                </p>
                <a
                  href={buildProjectFileHref(projectId, selectedFile.id)}
                  target="_blank"
                  rel="noreferrer"
                  className="text-[10px] font-semibold"
                  style={{ color: text.muted }}
                >
                  Plein écran
                </a>
              </div>
              {isInlinePreviewFriendly(selectedFile) ? (
                selectedFile.ext === "img" ? (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img
                    src={buildProjectFileHref(projectId, selectedFile.id)}
                    alt={selectedFile.name}
                    className="w-full max-h-72 object-contain"
                    style={{ background: surface.bg }}
                  />
                ) : (
                  <iframe
                    title={`Aperçu ${selectedFile.name}`}
                    src={buildProjectFileHref(projectId, selectedFile.id)}
                    className="w-full"
                    style={{ height: 260, background: surface.bg }}
                  />
                )
              ) : (
                <div className="p-4">
                  <p className="text-xs leading-relaxed" style={{ color: text.secondary }}>
                    Ce type de fichier s&apos;ouvre mieux dans un nouvel onglet ou en téléchargement.
                  </p>
                </div>
              )}
            </div>
          )}
        </>
      )}
    </div>
  );
}
