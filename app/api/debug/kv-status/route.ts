import { NextResponse } from "next/server";
import { kv } from "@vercel/kv";

// Endpoint de debug pour vérifier l'état du store en production.
// GET /api/debug/kv-status

export async function GET() {
  // Liste tous les noms d'env vars liés à un store Redis/KV/Upstash
  // (sans révéler les valeurs sensibles), pour qu'on voie sous quel
  // préfixe Vercel a bien injecté les credentials.
  const matching = Object.keys(process.env)
    .filter((key) => /KV|REDIS|UPSTASH/i.test(key))
    .sort();

  const env = {
    isVercel: Boolean(process.env.VERCEL),
    nodeEnv: process.env.NODE_ENV,
    hasKvUrl: Boolean(process.env.KV_URL),
    hasKvRestApiUrl: Boolean(process.env.KV_REST_API_URL),
    hasKvRestApiToken: Boolean(process.env.KV_REST_API_TOKEN),
    hasRedisUrl: Boolean(process.env.REDIS_URL),
    hasUpstashRedisRestUrl: Boolean(process.env.UPSTASH_REDIS_REST_URL),
    hasUpstashRedisRestToken: Boolean(process.env.UPSTASH_REDIS_REST_TOKEN),
    matchingEnvVarNames: matching,
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
