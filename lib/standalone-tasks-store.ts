// Tâches autonomes ("to-do") non liées à un projet. Mêmes champs qu'une tâche
// de projet (Task) + un environnement (workspace) pour l'étiquetage/filtrage et
// une date de création. Persistées dans Redis avec repli en mémoire, comme les
// autres stores légers (cf. account-store).

import { createClient, type RedisClientType } from "redis";
import type { ChecklistItem, ProjectFile, Task, TaskStatus } from "@/lib/mock-data";
import type { ProjectPriority } from "@/lib/project-taxonomy";
import type { Workspace } from "@/lib/workspace";

export interface StandaloneTask extends Task {
  /** Environnement de rattachement (Perso / Pro / personnalisé) — sert au
   *  libellé et au filtre, la tâche n'appartient à aucun projet. */
  workspace: Workspace;
  createdAt: string;
}

const REDIS_URL = process.env.REDIS_URL;
const REDIS_KEY = "mindbase:standalone-tasks";

type RedisClient = RedisClientType<Record<string, never>, Record<string, never>, Record<string, never>>;
let redisClientPromise: Promise<RedisClient> | null = null;

function getRedisClient(): Promise<RedisClient> {
  if (!REDIS_URL) return Promise.reject(new Error("REDIS_URL is not set"));
  if (!redisClientPromise) {
    const client = createClient({ url: REDIS_URL }) as RedisClient;
    client.on("error", (err) => console.error("[standalone-tasks] redis error:", err));
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

// Repli mémoire (process) quand Redis est absent (dev local sans REDIS_URL).
let memory: StandaloneTask[] = [];

function randomId() {
  if (typeof crypto !== "undefined" && typeof crypto.randomUUID === "function") {
    return crypto.randomUUID().slice(0, 12);
  }
  return Math.random().toString(36).slice(2, 14);
}

async function readAll(): Promise<StandaloneTask[]> {
  if (!REDIS_URL) return memory;
  try {
    const client = await getRedisClient();
    const raw = await client.get(REDIS_KEY);
    return raw ? (JSON.parse(raw) as StandaloneTask[]) : [];
  } catch (error) {
    console.error("[standalone-tasks] read failed:", error);
    return [];
  }
}

async function writeAll(tasks: StandaloneTask[]): Promise<void> {
  if (!REDIS_URL) {
    memory = tasks;
    return;
  }
  try {
    const client = await getRedisClient();
    await client.set(REDIS_KEY, JSON.stringify(tasks));
  } catch (error) {
    console.error("[standalone-tasks] write failed:", error);
    memory = tasks;
  }
}

export async function getStandaloneTasks(): Promise<StandaloneTask[]> {
  return readAll();
}

export async function getStandaloneTasksForWorkspace(workspace: Workspace): Promise<StandaloneTask[]> {
  const tasks = await readAll();
  if (workspace === "all") return tasks;
  return tasks.filter((task) => task.workspace === workspace);
}

export interface CreateStandaloneTaskInput {
  title: string;
  workspace: Workspace;
  expected?: string;
  dueDate?: string;
  dueTime?: string;
  priority?: ProjectPriority;
  status?: TaskStatus;
  owner?: string;
  assignees?: string[];
  checklist?: ChecklistItem[];
  source?: Task["source"];
}

export async function createStandaloneTask(input: CreateStandaloneTaskInput): Promise<StandaloneTask> {
  const tasks = await readAll();
  const now = new Date().toISOString();
  const task: StandaloneTask = {
    id: `st_${randomId()}`,
    title: input.title.trim(),
    done: input.status === "done",
    status: input.status ?? "todo",
    priority: input.priority ?? "medium",
    expected: input.expected?.trim() || undefined,
    dueDate: input.dueDate || undefined,
    dueTime: input.dueTime || undefined,
    owner: input.owner?.trim() || undefined,
    assignees: input.assignees,
    checklist: input.checklist,
    source: input.source ?? "manual",
    workspace: input.workspace,
    createdAt: now,
    order: tasks.length + 1,
  };
  await writeAll([...tasks, task]);
  return task;
}

type StandaloneTaskPatch = Partial<
  Pick<
    Task,
    | "title"
    | "expected"
    | "realization"
    | "owner"
    | "assignees"
    | "teamIds"
    | "dueDate"
    | "dueTime"
    | "status"
    | "priority"
    | "comments"
    | "checklist"
    | "done"
    | "files"
    | "discussion"
  >
> & { workspace?: Workspace };

export async function updateStandaloneTask(id: string, patch: StandaloneTaskPatch): Promise<StandaloneTask | null> {
  const tasks = await readAll();
  let updated: StandaloneTask | null = null;
  const next = tasks.map((task) => {
    if (task.id !== id) return task;
    const status = patch.status ?? task.status;
    updated = {
      ...task,
      ...patch,
      // Cohérence done/status quand le statut change.
      done: patch.done !== undefined ? patch.done : patch.status ? patch.status === "done" : task.done,
      status,
    };
    return updated;
  });
  if (!updated) return null;
  await writeAll(next);
  return updated;
}

export async function deleteStandaloneTask(id: string): Promise<void> {
  const tasks = await readAll();
  await writeAll(tasks.filter((task) => task.id !== id));
}

export async function toggleStandaloneTaskDone(id: string): Promise<StandaloneTask | null> {
  const tasks = await readAll();
  const current = tasks.find((task) => task.id === id);
  if (!current) return null;
  const done = !current.done;
  return updateStandaloneTask(id, { done, status: done ? "done" : "todo" });
}

export type { ProjectFile };
