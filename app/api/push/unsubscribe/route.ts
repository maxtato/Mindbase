import { NextResponse } from "next/server";
import { removeSubscription } from "@/lib/push/push-store";

export const runtime = "nodejs";

export async function POST(request: Request) {
  try {
    const body = await request.json();
    const endpoint = body?.endpoint ?? body?.subscription?.endpoint;
    if (!endpoint) return NextResponse.json({ error: "endpoint manquant." }, { status: 400 });
    await removeSubscription(endpoint);
    return NextResponse.json({ ok: true });
  } catch {
    return NextResponse.json({ error: "Requête invalide." }, { status: 400 });
  }
}
