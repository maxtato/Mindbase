import { NextResponse } from "next/server";
import { kv } from "@vercel/kv";

// Endpoint de debug pour vérifier l'état de Vercel KV en production.
// À supprimer une fois la persistance confirmée. GET /api/debug/kv-status

export async function GET() {
  const env = {
    hasKvUrl: Boolean(process.env.KV_URL),
    hasKvRestApiUrl: Boolean(process.env.KV_REST_API_URL),
    hasKvRestApiToken: Boolean(process.env.KV_REST_API_TOKEN),
    isVercel: Boolean(process.env.VERCEL),
    nodeEnv: process.env.NODE_ENV,
  };

  let probe: { ok: boolean; readback?: unknown; error?: string } = { ok: false };
  try {
    const stamp = Date.now().toString();
    await kv.set("mindbase:debug-stamp", stamp);
    const back = await kv.get<string>("mindbase:debug-stamp");
    probe = { ok: back === stamp, readback: back };
  } catch (error) {
    probe = { ok: false, error: error instanceof Error ? error.message : String(error) };
  }

  return NextResponse.json({ env, probe });
}
