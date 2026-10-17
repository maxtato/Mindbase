import { createClient, type RedisClientType } from "redis";

// Connexion Redis partagée par les stores (projets, profil, équipe, tâches,
// push). Par défaut, node-redis retente la connexion à l'infini : si la base
// est injoignable (supprimée, DNS mort, réseau coupé), `connect()` ne rend
// jamais la main et la page reste bloquée jusqu'au timeout de la fonction.
// Ici on échoue vite pour que chaque store retombe sur son repli et que l'app
// s'affiche quand même.

export type RedisClient = RedisClientType<
  Record<string, never>,
  Record<string, never>,
  Record<string, never>
>;

const CONNECT_TIMEOUT_MS = 2000;
// Nombre de reconnexions tentées avant d'abandonner (connexion initiale ou
// coupure d'une connexion existante).
const MAX_RECONNECT_ATTEMPTS = 1;
// Après un échec, on ne retente pas avant ce délai : évite de faire payer
// le délai de connexion à chaque requête quand Redis est tombé.
const FAILURE_COOLDOWN_MS = 30_000;

export function createRedisClient(url: string): RedisClient {
  return createClient({
    url,
    socket: {
      connectTimeout: CONNECT_TIMEOUT_MS,
      reconnectStrategy: (retries) =>
        retries >= MAX_RECONNECT_ATTEMPTS
          ? new Error(`Redis injoignable après ${retries + 1} tentative(s)`)
          : 200 * (retries + 1),
    },
  }) as RedisClient;
}

// Fabrique un getter mémoïsé à l'échelle de l'instance serverless : la même
// connexion TCP est réutilisée tant qu'elle est ouverte, et recréée si elle
// a été fermée (coupure, abandon après MAX_RECONNECT_ATTEMPTS).
export function makeRedisGetter(label: string, url: string | undefined) {
  let clientPromise: Promise<RedisClient> | null = null;
  let current: RedisClient | null = null;
  let downUntil = 0;

  return function getRedisClient(): Promise<RedisClient> {
    if (!url) return Promise.reject(new Error("REDIS_URL is not set"));
    if (Date.now() < downUntil) {
      return Promise.reject(new Error("Redis indisponible (nouvel essai plus tard)"));
    }
    if (current && !current.isOpen) {
      clientPromise = null;
      current = null;
    }
    if (!clientPromise) {
      const client = createRedisClient(url);
      client.on("error", (err) => console.error(`[${label}] redis error:`, err));
      current = client;
      clientPromise = client
        .connect()
        .then(() => client)
        .catch((err) => {
          clientPromise = null;
          current = null;
          downUntil = Date.now() + FAILURE_COOLDOWN_MS;
          throw err;
        });
    }
    return clientPromise;
  };
}

// Garde la base « active » : les offres gratuites (Redis Cloud, Upstash)
// suppriment ou archivent une base qui ne reçoit aucune commande pendant
// quelques semaines. Appelé chaque jour par le cron (vercel.json).
const KEEPALIVE_KEY = "mindbase:keepalive";
const getKeepaliveClient = makeRedisGetter(
  "keepalive",
  process.env.REDIS_URL || process.env.KV_URL,
);

export async function pingRedis(): Promise<{ ok: boolean; at?: string; error?: string }> {
  try {
    const client = await getKeepaliveClient();
    const at = new Date().toISOString();
    await client.set(KEEPALIVE_KEY, at);
    return { ok: true, at };
  } catch (error) {
    return { ok: false, error: error instanceof Error ? error.message : String(error) };
  }
}
