"use client";

// Switcher d'environnement (Personnel / Professionnel) pour la topbar.
// Visible sur tous les écrans, mais c'est surtout utile sur mobile où la
// sidebar avec son switcher latéral n'est pas visible.

import Link from "next/link";
import { usePathname, useSearchParams } from "next/navigation";
import { useEffect } from "react";
import { workspaceTheme } from "@/lib/workspace";
import type { Workspace } from "@/lib/workspace";

interface WorkspaceSwitcherProps {
  workspace: Workspace;
}

const WORKSPACES: Workspace[] = ["personal", "professional"];

export function WorkspaceSwitcher({ workspace }: WorkspaceSwitcherProps) {
  const pathname = usePathname();
  const searchParams = useSearchParams();

  // Persiste le workspace courant dans un cookie pour que la racine "/"
  // et tout point d'entrée sans param redirige vers le dernier env utilisé,
  // au lieu de toujours retomber sur "personal".
  useEffect(() => {
    document.cookie = `mindbase-workspace=${workspace}; path=/; max-age=${60 * 60 * 24 * 365}; SameSite=Lax`;
  }, [workspace]);

  function hrefFor(target: Workspace) {
    const next = new URLSearchParams(searchParams?.toString() ?? "");
    next.set("workspace", target);
    return `${pathname}?${next.toString()}`;
  }

  return (
    <div
      role="tablist"
      aria-label="Changer d'environnement"
      className="inline-flex items-center gap-0.5 rounded-full p-0.5"
      style={{
        background: "var(--mb-s2)",
        border: "1px solid var(--mb-border-subtle)",
      }}
    >
      {WORKSPACES.map((item) => {
        const itemTheme = workspaceTheme[item];
        const active = item === workspace;
        return (
          <Link
            key={item}
            href={hrefFor(item)}
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
    </div>
  );
}
