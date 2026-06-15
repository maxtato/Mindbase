import { NextResponse } from "next/server";
import { getSubscriptions, removeSubscriptions } from "@/lib/push/push-store";
import { sendPush, isPushConfigured } from "@/lib/push/web-push";

export const runtime = "nodejs";

// Envoie une notification de test à tous les abonnements (bouton « Tester »).
export async function POST() {
  if (!isPushConfigured) {
    return NextResponse.json({ error: "Push non configuré côté serveur (VAPID_PRIVATE_KEY)." }, { status: 503 });
  }
  const subscriptions = await getSubscriptions();
  const dead: string[] = [];
  let sent = 0;
  await Promise.allSettled(
    subscriptions.map(async (sub) => {
      const alive = await sendPush(sub, {
        title: "Flatmind",
        body: "Les notifications fonctionnent 🎉",
        url: "/dashboard",
        tag: "mindbase-test",
      });
      if (alive) sent += 1;
      else dead.push(sub.endpoint);
    }),
  );
  await removeSubscriptions(dead);
  return NextResponse.json({ ok: true, sent });
}
