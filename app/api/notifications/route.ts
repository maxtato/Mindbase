import { NextResponse } from "next/server";
import { getAllProjects } from "@/lib/project-store";
import { getProfile } from "@/lib/account-store";

// Flux de notifications collaboratives, agrégé à partir de l'état des projets.
// On ne garde que l'activité des AUTRES (jamais la mienne) sur les 30 derniers
// jours : messages, mentions @moi, tâches terminées, fichiers ajoutés.

export interface NotificationItem {
  id: string;
  type: "message" | "mention" | "task" | "file";
  title: string;
  context: string;
  href: string;
  createdAt: string;
}

function normalize(value: string) {
  return value.normalize("NFD").replace(new RegExp("[\\u0300-\\u036f]", "g"), "").trim().toLowerCase();
}

function parseDate(value: string | undefined): Date | null {
  if (!value) return null;
  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? null : date;
}

export async function GET() {
  const [projects, profile] = await Promise.all([getAllProjects(), getProfile()]);
  const meNorm = normalize(profile.name ?? "");
  const meFirst = meNorm.split(" ")[0] ?? "";
  const horizon = Date.now() - 1000 * 60 * 60 * 24 * 30;

  const isMine = (author: string | undefined) => {
    const a = normalize(author ?? "");
    return Boolean(a) && (a === meNorm || (Boolean(meFirst) && a.split(" ")[0] === meFirst));
  };
  const mentionsMe = (content: string | undefined) =>
    Boolean(meFirst) && normalize(content ?? "").includes(`@${meFirst}`);

  const items: NotificationItem[] = [];
  const push = (item: NotificationItem, date: Date | null) => {
    if (!date || date.getTime() < horizon) return;
    items.push(item);
  };

  for (const project of projects) {
    if (project.deleted) continue;
    const base = `/dashboard/projects/${project.id}?workspace=${project.workspace}`;

    for (const m of project.teamMessages ?? []) {
      if (isMine(m.authorName)) continue;
      const mention = mentionsMe(m.content);
      push(
        {
          id: `tm-${project.id}-${m.id}`,
          type: mention ? "mention" : "message",
          title: mention ? `${m.authorName} t'a mentionné` : `${m.authorName} : ${m.content}`,
          context: project.name,
          href: base,
          createdAt: m.createdAt,
        },
        parseDate(m.createdAt),
      );
    }

    for (const file of project.files ?? []) {
      push(
        {
          id: `pf-${project.id}-${file.id}`,
          type: "file",
          title: `Fichier ajouté : ${file.name}`,
          context: project.name,
          href: base,
          createdAt: file.addedAt,
        },
        parseDate(file.addedAt),
      );
    }

    for (const step of project.steps ?? []) {
      for (const task of step.tasks) {
        const taskHref = `${base}&taskId=${task.id}`;
        const taskCtx = `${project.name} · ${task.title}`;

        for (const m of task.discussion ?? []) {
          if (isMine(m.authorName)) continue;
          const mention = mentionsMe(m.content);
          push(
            {
              id: `td-${task.id}-${m.id}`,
              type: mention ? "mention" : "message",
              title: mention ? `${m.authorName} t'a mentionné` : `${m.authorName} : ${m.content}`,
              context: taskCtx,
              href: taskHref,
              createdAt: m.createdAt,
            },
            parseDate(m.createdAt),
          );
        }

        push(
          {
            id: `done-${task.id}`,
            type: "task",
            title: `Tâche terminée : ${task.title}`,
            context: project.name,
            href: taskHref,
            createdAt: task.completedAt ?? "",
          },
          parseDate(task.completedAt),
        );

        for (const file of task.files ?? []) {
          push(
            {
              id: `tf-${task.id}-${file.id}`,
              type: "file",
              title: `Fichier ajouté : ${file.name}`,
              context: taskCtx,
              href: taskHref,
              createdAt: file.addedAt,
            },
            parseDate(file.addedAt),
          );
        }
      }
    }
  }

  items.sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());
  return NextResponse.json({ items: items.slice(0, 40) });
}
