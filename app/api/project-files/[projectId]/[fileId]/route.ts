import { readFile } from "node:fs/promises";
import path from "node:path";
import { getProjectById } from "@/lib/project-store";
import { getProjectFileContentType } from "@/lib/project-files";

function contentDisposition(mode: "inline" | "attachment", filename: string) {
  const safeFallback = filename.replace(/["\\\r\n]/g, "_");
  return `${mode}; filename="${safeFallback}"; filename*=UTF-8''${encodeURIComponent(filename)}`;
}

function buildVirtualPreview(projectName: string, fileName: string) {
  return [
    "MindLay - aperçu de fichier",
    "",
    `Projet : ${projectName}`,
    `Fichier : ${fileName}`,
    "",
    "Ce fichier provient des données de démonstration ou n'a pas encore de binaire attaché.",
    "Ajoutez le fichier réel depuis la carte Documents pour obtenir une prévisualisation et un téléchargement complets.",
  ].join("\n");
}

export async function GET(
  request: Request,
  { params }: { params: Promise<{ projectId: string; fileId: string }> },
) {
  const { projectId, fileId } = await params;
  const project = await getProjectById(projectId);
  const file = project?.files?.find((candidate) => candidate.id === fileId);

  if (!project || !file) {
    return new Response("Fichier introuvable.", { status: 404 });
  }

  const shouldDownload = new URL(request.url).searchParams.get("download") === "1";
  const disposition = contentDisposition(shouldDownload ? "attachment" : "inline", file.name);

  if (file.generatedContent) {
    return new Response(file.generatedContent, {
      headers: {
        "Content-Type": getProjectFileContentType(file),
        "Content-Disposition": disposition,
        "Cache-Control": "private, max-age=0",
      },
    });
  }

  if (file.url?.startsWith("/uploads/")) {
    const publicRoot = path.join(process.cwd(), "public");
    const filePath = path.normalize(path.join(publicRoot, file.url));

    if (filePath.startsWith(publicRoot)) {
      try {
        const buffer = await readFile(filePath);
        return new Response(buffer, {
          headers: {
            "Content-Type": getProjectFileContentType(file),
            "Content-Disposition": disposition,
            "Cache-Control": "private, max-age=0",
          },
        });
      } catch {
        // Fall back to a readable virtual preview below.
      }
    }
  }

  return new Response(buildVirtualPreview(project.name, file.name), {
    headers: {
      "Content-Type": "text/plain; charset=utf-8",
      "Content-Disposition": disposition,
      "Cache-Control": "private, max-age=0",
    },
  });
}
