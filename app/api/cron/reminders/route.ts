import { NextResponse } from "next/server";
import { getProjectsForWorkspace } from "@/lib/project-store";
import { buildDailyFocus } from "@/lib/project-focus";
import { getSubscriptions, removeSubscriptions } from "@/lib/push/push-store";
import { sendPush, isPushConfigured, type PushPayload } from "@/lib/push/web-push";
import type { Workspace } from "@/lib/workspace";
import { getServerT } from "@/lib/i18n/server";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const WORKSPACES: Workspace[] = ["personal", "professional"];

// Cron quotidien (cf. vercel.json) : agrège les échéances du jour tous espaces
// confondus et envoie UNE notification de rappel à tous les abonnés.
export async function GET(request: Request) {
  // Protection : si CRON_SECRET est défini, on exige le header Vercel cron
  // (Authorization: Bearer <secret>) ou un ?key=<secret>.
  const secret = process.env.CRON_SECRET;
  if (secret) {
    const auth = request.headers.get("authorization");
    const url = new URL(request.url);
    const key = url.searchParams.get("key");
    if (auth !== `Bearer ${secret}` && key !== secret) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }
  }

  if (!isPushConfigured) {
    return NextResponse.json({ ok: true, skipped: "push non configuré (VAPID_PRIVATE_KEY manquant)" });
  }

  // Agrégation des compteurs + top action, tous espaces confondus.
  let overdue = 0;
  let dueToday = 0;
  let attention = 0;
  let topAction: string | null = null;
  const { t } = await getServerT();

  for (const workspace of WORKSPACES) {
    const projects = (await getProjectsForWorkspace(workspace)).filter(
      (project) => project.status !== "archived" && !project.deleted,
    );
    const focus = buildDailyFocus(projects, workspace, t);
    overdue += focus.counts.overdue;
    dueToday += focus.counts.dueToday;
    attention += focus.counts.attention;
    if (!topAction && focus.actions[0]) topAction = focus.actions[0].title;
  }

  // Rien à signaler → on n'envoie rien (pas de spam).
  if (overdue === 0 && dueToday === 0 && attention === 0) {
    return NextResponse.json({ ok: true, sent: 0, reason: "rien d'urgent" });
  }

  const parts: string[] = [];
  if (overdue > 0) parts.push(`${overdue} en retard`);
  if (dueToday > 0) parts.push(`${dueToday} pour aujourd'hui`);
  if (attention > 0) parts.push(`${attention} projet${attention > 1 ? "s" : ""} à surveiller`);

  const payload: PushPayload = {
    title: "Vos rappels du jour",
    body: topAction ? `${parts.join(" · ")}\nÀ faire : ${topAction}` : parts.join(" · "),
    url: "/dashboard",
    tag: "mindbase-daily",
  };

  const subscriptions = await getSubscriptions();
  const dead: string[] = [];
  let sent = 0;
  // allSettled : un abonnement défaillant ne doit pas bloquer l'envoi aux autres.
  await Promise.allSettled(
    subscriptions.map(async (sub) => {
      const alive = await sendPush(sub, payload);
      if (alive) sent += 1;
      else dead.push(sub.endpoint);
    }),
  );
  await removeSubscriptions(dead);

  return NextResponse.json({ ok: true, sent, purged: dead.length, counts: { overdue, dueToday, attention } });
}
