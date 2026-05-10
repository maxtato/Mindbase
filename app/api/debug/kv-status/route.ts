import { NextResponse } from "next/server";
import { createClient } from "redis";

// Endpoint de debug pour vérifier l'état du store Redis en production.
// GET /api/debug/kv-status

export async function GET() {
  const matching = Object.keys(process.env)
    .filter((key) => /KV|REDIS|UPSTASH/i.test(key))
    .sort();

  const env = {
    isVercel: Boolean(process.env.VERCEL),
    nodeEnv: process.env.NODE_ENV,
    hasRedisUrl: Boolean(process.env.REDIS_URL),
    hasKvRestApiUrl: Boolean(process.env.KV_REST_API_URL),
    hasUpstashRedisRestUrl: Boolean(process.env.UPSTASH_REDIS_REST_URL),
    matchingEnvVarNames: matching,
  };

  let probe: { ok: boolean; readback?: unknown; error?: string } = { ok: false };
  if (process.env.REDIS_URL) {
    const client = createClient({ url: process.env.REDIS_URL });
    try {
      await client.connect();
      const stamp = Date.now().toString();
      await client.set("mindbase:debug-stamp", stamp);
      const back = await client.get("mindbase:debug-stamp");
      probe = { ok: back === stamp, readback: back };
    } catch (error) {
      probe = { ok: false, error: error instanceof Error ? error.message : String(error) };
    } finally {
      try {
        await client.quit();
      } catch {
        // ignore
      }
    }
  } else {
    probe = { ok: false, error: "REDIS_URL not set" };
  }

  return NextResponse.json({ env, probe });
}
