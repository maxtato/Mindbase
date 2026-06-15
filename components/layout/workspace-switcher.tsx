"use client";

// Switcher d'environnement pour la topbar : Personnel / Pro + environnements
// personnalisés + un bouton « + » pour en créer un nouveau.

import Link from "next/link";
import { usePathname, useSearchParams } from "next/navigation";
import { useEffect, useState } from "react";
import { workspaceTheme, BUILTIN_WORKSPACES, ALL_WORKSPACE } from "@/lib/workspace";
import type { Workspace } from "@/lib/workspace";
import { broadcastWorkspace } from "@/lib/workspace-client";
import { useEnvironments } from "@/components/environments/environments-provider";
import { CreateEnvironmentDialog } from "@/components/environments/create-environment-dialog";

interface WorkspaceSwitcherProps {
  workspace: Workspace;
}

export function WorkspaceSwitcher({ workspace }: WorkspaceSwitcherProps) {
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const environments = useEnvironments();
  const [creating, setCreating] = useState(false);

  // Persiste le workspace courant dans un cookie pour que la racine "/" et tout
  // point d'entrée sans param redirige vers le dernier env utilisé.
  useEffect(() => {
    document.cookie = `mindbase-workspace=${workspace}; path=/; max-age=${60 * 60 * 24 * 365}; SameSite=Lax`;
  }, [workspace]);

  function hrefFor(target: Workspace) {
    const next = new URLSearchParams(searchParams?.toString() ?? "");
    next.set("workspace", target);
    return `${pathname}?${next.toString()}`;
  }

  const items: Workspace[] = [...BUILTIN_WORKSPACES, ...environments.map((e) => e.id), ALL_WORKSPACE];

  return (
    <>
      <div
        role="tablist"
        aria-label="Changer d'environnement"
        className="inline-flex items-center gap-0.5 rounded-full p-0.5"
        style={{ background: "var(--mb-s2)", border: "1px solid var(--mb-border-subtle)" }}
      >
        {items.map((item) => {
          const itemTheme = workspaceTheme[item];
          const active = item === workspace;
          return (
            <Link
              key={item}
              href={hrefFor(item)}
              onClick={() => broadcastWorkspace(item)}
              role="tab"
              aria-selected={active}
              title={itemTheme.label}
              className="inline-flex items-center gap-1.5 rounded-full px-2.5 py-1 text-[11px] font-semibold transition-colors"
              style={{
                background: active ? itemTheme.accentBg : "transparent",
                color: active ? itemTheme.accentText : "var(--mb-text-muted)",
                border: `1px solid ${active ? itemTheme.accentBorder : "transparent"}`,
              }}
            >
              <span
                aria-hidden
                style={{
                  width: 6,
                  height: 6,
                  borderRadius: "50%",
                  background: itemTheme.accent,
                  display: "inline-block",
                  opacity: active ? 1 : 0.5,
                }}
              />
              {itemTheme.label}
            </Link>
          );
        })}

        <button
          type="button"
          onClick={() => setCreating(true)}
          title="Créer un environnement"
          aria-label="Créer un environnement"
          className="inline-flex h-6 w-6 items-center justify-center rounded-full"
          style={{ background: "transparent", color: "var(--mb-text-muted)", border: "1px solid transparent", cursor: "pointer" }}
        >
          <svg width="13" height="13" viewBox="0 0 16 16" fill="none" aria-hidden="true">
            <path d="M8 3v10M3 8h10" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" />
          </svg>
        </button>
      </div>

      {creating && <CreateEnvironmentDialog onClose={() => setCreating(false)} />}
    </>
  );
}
