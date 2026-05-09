import type { ProjectFile } from "@/lib/mock-data";

export const projectFileTypeMeta: Record<ProjectFile["ext"], { label: string; color: string }> = {
  pdf: { label: "PDF", color: "#F87171" },
  doc: { label: "DOC", color: "#60A5FA" },
  xls: { label: "XLS", color: "#4ADE80" },
  img: { label: "IMG", color: "#FBBF24" },
  link: { label: "URL", color: "#A78BFA" },
  other: { label: "FILE", color: "#94A3B8" },
};

export function guessProjectFileExt(filename: string): ProjectFile["ext"] {
  const ext = filename.split(".").pop()?.toLowerCase() ?? "";
  if (ext === "pdf") return "pdf";
  if (["doc", "docx", "rtf"].includes(ext)) return "doc";
  if (["xls", "xlsx", "csv"].includes(ext)) return "xls";
  if (["png", "jpg", "jpeg", "gif", "webp", "svg"].includes(ext)) return "img";
  if (["url", "webloc"].includes(ext)) return "link";
  return "other";
}

export function formatProjectFileSize(bytes: number): string {
  if (bytes < 1024) return `${bytes} o`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(0)} Ko`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} Mo`;
}

export function sanitizeProjectFileName(filename: string): string {
  const cleaned = filename
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[^a-zA-Z0-9._-]+/g, "-")
    .replace(/-{2,}/g, "-")
    .replace(/(^-|-$)/g, "");

  return cleaned || "fichier";
}

export function buildProjectFileHref(projectId: string, fileId: string, mode: "preview" | "download" = "preview") {
  const params = mode === "download" ? "?download=1" : "";
  return `/api/project-files/${encodeURIComponent(projectId)}/${encodeURIComponent(fileId)}${params}`;
}

export function getProjectFileContentType(file: Pick<ProjectFile, "ext" | "mimeType">) {
  if (file.mimeType) return file.mimeType;
  if (file.ext === "pdf") return "application/pdf";
  if (file.ext === "img") return "image/*";
  if (file.ext === "xls") return "text/csv";
  if (file.ext === "doc") return "text/plain";
  return "text/plain; charset=utf-8";
}

export function isInlinePreviewFriendly(file: ProjectFile) {
  return file.ext === "img" || file.ext === "pdf" || file.ext === "other" || file.ext === "link";
}
