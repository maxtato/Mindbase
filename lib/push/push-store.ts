// Stockage des abonnements push. Réutilise Redis (REDIS_URL) comme le store
// projets ; repli en mémoire si Redis absent (dev). Dédup par endpoint.

import { createClient, type RedisClientType } from "redis";
import type { PushSubscriptionRecord } from "@/lib/push/web-push";

const REDIS_URL = process.env.REDIS_URL;
const REDIS_KEY = "mindbase:push:subscriptions";

type RedisClient = RedisClientType<Record<string, never>, Record<string, never>, Record<string, never>>;
let redisClientPromise: Promise<RedisClient> | null = null;

function getRedisClient(): Promise<RedisClient> {
  if (!REDIS_URL) return Promise.reject(new Error("REDIS_URL is not set"));
  if (!redisClientPromise) {
    const client = createClient({ url: REDIS_URL }) as RedisClient;
    client.on("error", (err) => console.error("[push-store] redis error:", err));
    redisClientPromise = client
      .connect()
      .then(() => client)
      .catch((err) => {
        redisClientPromise = null;
        throw err;
      });
  }
  return redisClientPromise;
}

// Repli mémoire (dev sans Redis) — par instance serverless.
let memory: PushSubscriptionRecord[] = [];

async function readAll(): Promise<PushSubscriptionRecord[]> {
  if (!REDIS_URL) return memory;
  try {
    const client = await getRedisClient();
    const raw = await client.get(REDIS_KEY);
    return raw ? (JSON.parse(raw) as PushSubscriptionRecord[]) : [];
  } catch (error) {
    console.error("[push-store] read failed:", error);
    return [];
  }
}

async function writeAll(subs: PushSubscriptionRecord[]): Promise<void> {
  if (!REDIS_URL) {
    memory = subs;
    return;
  }
  try {
    const client = await getRedisClient();
    await client.set(REDIS_KEY, JSON.stringify(subs));
  } catch (error) {
    console.error("[push-store] write failed:", error);
  }
}

export async function getSubscriptions(): Promise<PushSubscriptionRecord[]> {
  return readAll();
}

export async function saveSubscription(sub: PushSubscriptionRecord): Promise<void> {
  if (!sub?.endpoint || !sub.keys?.p256dh || !sub.keys?.auth) return;
  const subs = await readAll();
  const next = subs.filter((existing) => existing.endpoint !== sub.endpoint);
  next.push({ endpoint: sub.endpoint, keys: { p256dh: sub.keys.p256dh, auth: sub.keys.auth } });
  await writeAll(next);
}

export async function removeSubscription(endpoint: string): Promise<void> {
  if (!endpoint) return;
  const subs = await readAll();
  await writeAll(subs.filter((existing) => existing.endpoint !== endpoint));
}

/** Purge une liste d'endpoints morts (renvoyés 404/410 par le service push). */
export async function removeSubscriptions(endpoints: string[]): Promise<void> {
  if (endpoints.length === 0) return;
  const dead = new Set(endpoints);
  const subs = await readAll();
  await writeAll(subs.filter((existing) => !dead.has(existing.endpoint)));
}
