// Équipe / collaboration — registre des membres invités par l'admin (le compte
// courant). Persistant dans Redis (repli mémoire si Redis absent), comme le
// profil. Phase 1 de la collaboration : un admin invite des personnes (nom +
// email), leur attribue un rôle, et les membres « actifs » deviennent des noms
// disponibles pour collaborer sur les projets.

import { createClient, type RedisClientType } from "redis";

export type TeamMemberRole = "admin" | "member";
export type TeamMemberStatus = "pending" | "active";

export interface TeamMember {
  id: string;
  name: string;
  email: string;
  role: TeamMemberRole;
  status: TeamMemberStatus;
  invitedAt: string;
}

const REDIS_URL = process.env.REDIS_URL;
const REDIS_KEY = "mindbase:team-members";

type RedisClient = RedisClientType<Record<string, never>, Record<string, never>, Record<string, never>>;
let redisClientPromise: Promise<RedisClient> | null = null;

function getRedisClient(): Promise<RedisClient> {
  if (!REDIS_URL) return Promise.reject(new Error("REDIS_URL is not set"));
  if (!redisClientPromise) {
    const client = createClient({ url: REDIS_URL }) as RedisClient;
    client.on("error", (err) => console.error("[team-store] redis error:", err));
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

let memory: TeamMember[] = [];

function sanitizeMember(raw: Partial<TeamMember> | null | undefined): TeamMember | null {
  if (!raw || typeof raw.name !== "string") return null;
  const name = raw.name.trim();
  if (!name) return null;
  return {
    id: typeof raw.id === "string" && raw.id ? raw.id : `mbr_${crypto.randomUUID().slice(0, 8)}`,
    name,
    email: typeof raw.email === "string" ? raw.email.trim() : "",
    role: raw.role === "admin" ? "admin" : "member",
    status: raw.status === "active" ? "active" : "pending",
    invitedAt: typeof raw.invitedAt === "string" ? raw.invitedAt : new Date().toISOString(),
  };
}

function sanitizeList(raw: unknown): TeamMember[] {
  if (!Array.isArray(raw)) return [];
  return raw.map((m) => sanitizeMember(m as Partial<TeamMember>)).filter((m): m is TeamMember => m !== null);
}

export async function getTeamMembers(): Promise<TeamMember[]> {
  if (!REDIS_URL) return memory;
  try {
    const client = await getRedisClient();
    const raw = await client.get(REDIS_KEY);
    return raw ? sanitizeList(JSON.parse(raw)) : [];
  } catch (error) {
    console.error("[team-store] read failed:", error);
    return [];
  }
}

async function saveTeamMembers(list: TeamMember[]): Promise<void> {
  if (!REDIS_URL) {
    memory = list;
    return;
  }
  try {
    const client = await getRedisClient();
    await client.set(REDIS_KEY, JSON.stringify(list));
  } catch (error) {
    console.error("[team-store] write failed:", error);
  }
}

const norm = (value: string) => value.trim().toLowerCase();

export async function addTeamMember(input: { name: string; email: string }): Promise<TeamMember[]> {
  const name = input.name.trim();
  const email = input.email.trim();
  if (!name) return getTeamMembers();

  const existing = await getTeamMembers();
  // Dédoublonnage par email (si fourni) sinon par nom.
  const dupe = existing.some((m) =>
    email ? norm(m.email) === norm(email) && email !== "" : norm(m.name) === norm(name),
  );
  if (dupe) return existing;

  const member: TeamMember = {
    id: `mbr_${crypto.randomUUID().slice(0, 8)}`,
    name,
    email,
    role: "member",
    status: "pending",
    invitedAt: new Date().toISOString(),
  };
  const next = [...existing, member];
  await saveTeamMembers(next);
  return next;
}

export async function updateTeamMember(
  id: string,
  patch: { role?: TeamMemberRole; status?: TeamMemberStatus; name?: string; email?: string },
): Promise<TeamMember[]> {
  const existing = await getTeamMembers();
  const next = existing.map((m) =>
    m.id === id
      ? {
          ...m,
          role: patch.role ?? m.role,
          status: patch.status ?? m.status,
          name: patch.name !== undefined ? patch.name.trim() || m.name : m.name,
          email: patch.email !== undefined ? patch.email.trim() : m.email,
        }
      : m,
  );
  await saveTeamMembers(next);
  return next;
}

export async function removeTeamMember(id: string): Promise<TeamMember[]> {
  const existing = await getTeamMembers();
  const next = existing.filter((m) => m.id !== id);
  await saveTeamMembers(next);
  return next;
}

/** Noms des membres ACTIFS — disponibles comme collaborateurs sur les projets. */
export async function getActiveTeamMemberNames(): Promise<string[]> {
  const members = await getTeamMembers();
  return members.filter((m) => m.status === "active").map((m) => m.name);
}
