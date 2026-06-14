import { NextResponse } from "next/server";
import { saveSubscription } from "@/lib/push/push-store";
import { VAPID_PUBLIC_KEY } from "@/lib/push/web-push";

export const runtime = "nodejs";

// Renvoie la clé publique VAPID au client (pour pushManager.subscribe).
export async function GET() {
  return NextResponse.json({ publicKey: VAPID_PUBLIC_KEY });
}

export async function POST(request: Request) {
  try {
    const body = await request.json();
    const sub = body?.subscription ?? body;
    if (!sub?.endpoint || !sub?.keys?.p256dh || !sub?.keys?.auth) {
      return NextResponse.json({ error: "Abonnement invalide." }, { status: 400 });
    }
    await saveSubscription({ endpoint: sub.endpoint, keys: { p256dh: sub.keys.p256dh, auth: sub.keys.auth } });
    return NextResponse.json({ ok: true });
  } catch {
    return NextResponse.json({ error: "Requête invalide." }, { status: 400 });
  }
}
