import { NextResponse } from "next/server";
import { getProjectsForWorkspace } from "@/lib/project-store";
import { flattenProjectTasks } from "@/lib/project-insights";
import { resolveProjectSubcategoryDisplay } from "@/lib/project-taxonomy";
import { getDisplayStepTitle } from "@/lib/project-display";
import type { Workspace } from "@/lib/workspace";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const WORKSPACES: Workspace[] = ["personal", "professional"];
const WORKSPACE_LABEL: Record<Workspace, string> = { personal: "Perso", professional: "Pro" };

type ResultType = "project" | "task" | "step";

interface SearchResult {
  id: string;
  type: ResultType;
  title: string;
  sublabel: string;
  href: string;
  color: string;
  workspaceLabel: string;
  score: number;
}

function normalize(value: string) {
  return value
    .normalize("NFD")
    .replace(new RegExp("[\\u0300-\\u036f]", "g"), "")
    .toLowerCase()
    .trim();
}

function scoreMatch(haystack: string, needle: string): number {
  const h = normalize(haystack);
  if (!h) return 0;
  if (h.startsWith(needle)) return 3;
  if (new RegExp(`\\b${escapeRegExp(needle)}`).test(h)) return 2;
  if (h.includes(needle)) return 1;
  return 0;
}

function escapeRegExp(value: string) {
  return value.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

export async function GET(request: Request) {
  const url = new URL(request.url);
  const rawQuery = url.searchParams.get("q") ?? "";
  const q = normalize(rawQuery);
  if (q.length < 2) return NextResponse.json({ results: [] });

  const results: SearchResult[] = [];

  for (const workspace of WORKSPACES) {
    const projects = (await getProjectsForWorkspace(workspace)).filter(
      (project) => project.status !== "archived" && !project.deleted,
    );
    const wsLabel = WORKSPACE_LABEL[workspace];

    for (const project of projects) {
      const color = resolveProjectSubcategoryDisplay(project).color;
      const projectHref = `/dashboard/projects/${project.id}?workspace=${workspace}`;

      const projectScore = Math.max(scoreMatch(project.name, q), scoreMatch(project.objective ?? "", q) - 1);
      if (projectScore > 0) {
        results.push({
          id: `project-${project.id}`,
          type: "project",
          title: project.name,
          sublabel: `Projet · ${wsLabel}`,
          href: projectHref,
          color,
          workspaceLabel: wsLabel,
          score: projectScore + 1, // léger bonus aux projets
        });
      }

      for (const step of project.steps ?? []) {
        const stepScore = scoreMatch(getDisplayStepTitle(step.title), q);
        if (stepScore > 0) {
          results.push({
            id: `step-${project.id}-${step.id}`,
            type: "step",
            title: getDisplayStepTitle(step.title),
            sublabel: `Étape · ${project.name}`,
            href: projectHref,
            color,
            workspaceLabel: wsLabel,
            score: stepScore,
          });
        }
      }

      for (const entry of flattenProjectTasks(project)) {
        const taskScore = scoreMatch(entry.task.title, q);
        if (taskScore > 0) {
          results.push({
            id: `task-${project.id}-${entry.task.id}`,
            type: "task",
            title: entry.task.title,
            sublabel: `Tâche · ${project.name}`,
            href: `${projectHref}&taskId=${entry.task.id}`,
            color,
            workspaceLabel: wsLabel,
            score: taskScore,
          });
        }
      }
    }
  }

  results.sort((a, b) => b.score - a.score || a.title.length - b.title.length);
  return NextResponse.json({ results: results.slice(0, 24) });
}
