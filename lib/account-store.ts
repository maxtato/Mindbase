// Profil utilisateur (mono-compte pour l'instant) persistant dans Redis.
// Remplace l'identité codée en dur « Maxime T. ». Sert à : l'affichage du
// compte (sidebar), l'attribution des messages/commentaires, et le filtre
// « Mes tâches » (assigné à moi). Repli en mémoire si Redis absent.

import { createClient, type RedisClientType } from "redis";
import { ACTIVE_ACCOUNT_NAME } from "@/lib/current-account";

export type AccountPlan = "free" | "pro";

export interface AccountProfile {
  name: string;
  email: string;
  /** Palier d'abonnement. "pro" débloque l'IA et la collaboration. */
  plan: AccountPlan;
}

const REDIS_URL = process.env.REDIS_URL;
const REDIS_KEY = "mindbase:profile";

// Par défaut "pro" : le compte propriétaire existant garde tout l'accès.
const DEFAULT_PROFILE: AccountProfile = { name: ACTIVE_ACCOUNT_NAME, email: "", plan: "pro" };

type RedisClient = RedisClientType<Record<string, never>, Record<string, never>, Record<string, never>>;
let redisClientPromise: Promise<RedisClient> | null = null;

function getRedisClient(): Promise<RedisClient> {
  if (!REDIS_URL) return Promise.reject(new Error("REDIS_URL is not set"));
  if (!redisClientPromise) {
    const client = createClient({ url: REDIS_URL }) as RedisClient;
    client.on("error", (err) => console.error("[account-store] redis error:", err));
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

let memory: AccountProfile = { ...DEFAULT_PROFILE };

function sanitize(profile: Partial<AccountProfile> | null | undefined): AccountProfile {
  const name = typeof profile?.name === "string" ? profile.name.trim() : "";
  const email = typeof profile?.email === "string" ? profile.email.trim() : "";
  const plan: AccountPlan = profile?.plan === "free" ? "free" : "pro";
  return {
    name: name || DEFAULT_PROFILE.name,
    email,
    plan,
  };
}

export async function getProfile(): Promise<AccountProfile> {
  if (!REDIS_URL) return memory;
  try {
    const client = await getRedisClient();
    const raw = await client.get(REDIS_KEY);
    return raw ? sanitize(JSON.parse(raw) as AccountProfile) : { ...DEFAULT_PROFILE };
  } catch (error) {
    console.error("[account-store] read failed:", error);
    return { ...DEFAULT_PROFILE };
  }
}

export async function saveProfile(patch: Partial<AccountProfile>): Promise<AccountProfile> {
  // Fusion avec le profil existant pour ne pas écraser les champs absents du
  // patch (ex : enregistrer le nom ne doit pas réinitialiser le plan).
  const current = await getProfile();
  const next = sanitize({ ...current, ...patch });
  if (!REDIS_URL) {
    memory = next;
    return next;
  }
  try {
    const client = await getRedisClient();
    await client.set(REDIS_KEY, JSON.stringify(next));
  } catch (error) {
    console.error("[account-store] write failed:", error);
  }
  return next;
}
