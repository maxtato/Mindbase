import type { Workspace as WorkspaceType } from "@/lib/workspace";

type WorkspaceParamValue =
  | string
  | number
  | boolean
  | null
  | undefined;

export function getWorkspaceType(value?: string | null): WorkspaceType {
  return value === "professional" ? "professional" : "personal";
}

export function buildWorkspaceHref(
  pathname: string,
  workspace: WorkspaceType,
  params?: Record<string, WorkspaceParamValue>
) {
  const searchParams = new URLSearchParams();

  searchParams.set("workspace", workspace);

  for (const [key, value] of Object.entries(params ?? {})) {
    if (value === null || value === undefined || value === "") {
      continue;
    }

    searchParams.set(key, String(value));
  }

  return `${pathname}?${searchParams.toString()}`;
}
