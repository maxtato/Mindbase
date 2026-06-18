"use client";

// Bottom nav iOS-style — visible uniquement < sm (mobile portrait).
// Reprend les 4 entrées principales du sidebar pour rester cohérent.
// IMPORTANT : on n'utilise PAS useSearchParams ici, car cela force un
// Suspense boundary au niveau de l'AppShell qui, en streaming SSR Next.js,
// rend la nav dans un wrapper `<div hidden>` qui a tout cassé sur iOS.
// On lit l'URL via window.location dans un useEffect — équivalent fonctionnel,
// sans Suspense, donc rendu garanti immédiat dans le bon container.

import Link from "next/link";
import { useEffect, useState } from "react";
import { usePathname } from "next/navigation";
import { getWorkspace, workspaceTheme } from "@/lib/workspace";
import type { Workspace } from "@/lib/workspace";
import { surface, text } from "@/lib/design-tokens";
import { WORKSPACE_EVENT } from "@/lib/workspace-client";
import { useT } from "@/components/i18n/locale-provider";
import { WorkspaceSwitcher } from "@/components/layout/workspace-switcher";

const NAV_ITEMS = [
  {
    href: "/dashboard",
    labelKey: "nav.home",
    exact: true,
    icon: (
      <svg width="20" height="20" viewBox="0 0 16 16" fill="none">
        <rect x="1.5" y="1.5" width="5.5" height="5.5" rx="1.5" fill="currentColor" />
        <rect x="9" y="1.5" width="5.5" height="5.5" rx="1.5" fill="currentColor" />
        <rect x="1.5" y="9" width="5.5" height="5.5" rx="1.5" fill="currentColor" />
        <rect x="9" y="9" width="5.5" height="5.5" rx="1.5" fill="currentColor" />
      </svg>
    ),
  },
  {
    href: "/dashboard/projects",
    labelKey: "nav.projects",
    exact: false,
    icon: (
      <svg width="20" height="20" viewBox="0 0 16 16" fill="none">
        <path
          d="M2 4.5C2 3.12 3.12 2 4.5 2h2.086a1.5 1.5 0 0 1 1.06.44l.915.913a1.5 1.5 0 0 0 1.061.44H11.5C12.88 3.793 14 4.92 14 6.3v5.2A2.5 2.5 0 0 1 11.5 14h-7A2.5 2.5 0 0 1 2 11.5v-7Z"
          stroke="currentColor"
          strokeWidth="1.4"
          strokeLinejoin="round"
        />
      </svg>
    ),
  },
  {
    href: "/dashboard/tasks",
    labelKey: "nav.tasks",
    exact: false,
    icon: (
      <svg width="20" height="20" viewBox="0 0 16 16" fill="none">
        <path d="M2.5 4.5 4 6l2.2-2.6M2.5 11 4 12.5l2.2-2.6M8.5 5h5M8.5 11.5h5" stroke="currentColor" strokeWidth="1.4" strokeLinecap="round" strokeLinejoin="round" />
      </svg>
    ),
  },
  {
    href: "/dashboard/kanban",
    labelKey: "nav.kanban",
    exact: false,
    icon: (
      <svg width="20" height="20" viewBox="0 0 16 16" fill="none">
        <rect x="2" y="2.5" width="3.6" height="11" rx="1" stroke="currentColor" strokeWidth="1.3" />
        <rect x="6.2" y="2.5" width="3.6" height="7.5" rx="1" stroke="currentColor" strokeWidth="1.3" />
        <rect x="10.4" y="2.5" width="3.6" height="9" rx="1" stroke="currentColor" strokeWidth="1.3" />
      </svg>
    ),
  },
  {
    href: "/dashboard/calendar",
    labelKey: "nav.calendar",
    exact: false,
    icon: (
      <svg width="20" height="20" viewBox="0 0 16 16" fill="none">
        <rect x="2" y="3" width="12" height="10.5" rx="1.4" stroke="currentColor" strokeWidth="1.3" />
        <path d="M2 6.2h12M5 1.8v2.5M11 1.8v2.5" stroke="currentColor" strokeWidth="1.3" strokeLinecap="round" />
      </svg>
    ),
  },
  {
    href: "/dashboard/settings",
    labelKey: "nav.settings",
    exact: false,
    icon: (
      <svg width="20" height="20" viewBox="0 0 16 16" fill="none">
        <circle cx="8" cy="8" r="2.5" stroke="currentColor" strokeWidth="1.4" />
        <path
          d="M8 1.5V3M8 13v1.5M1.5 8H3M13 8h1.5M3.4 3.4l1.06 1.06M11.54 11.54l1.06 1.06M3.4 12.6l1.06-1.06M11.54 4.46l1.06-1.06"
          stroke="currentColor"
          strokeWidth="1.3"
          strokeLinecap="round"
        />
      </svg>
    ),
  },
] as const;

interface MobileBottomNavProps {
  /** Workspace lu côté server (cookie) pour avoir la bonne couleur active
   *  dès le premier rendu sur iPhone, avant l'hydratation. */
  initialWorkspace?: Workspace;
}

export function MobileBottomNav({ initialWorkspace }: MobileBottomNavProps = {}) {
  const pathname = usePathname();
  const t = useT();
  // Lit le workspace depuis l'URL côté client uniquement — évite useSearchParams
  // (et donc le Suspense boundary qui casse le rendu sur iOS Safari streaming).
  // L'init avec initialWorkspace évite le flash de couleur au premier rendu.
  const [workspaceParam, setWorkspaceParam] = useState<string | null>(initialWorkspace ?? null);
  useEffect(() => {
    const update = () => {
      const sp = new URLSearchParams(window.location.search);
      const value = sp.get("workspace");
      // Ne reset pas vers null si l'URL n'a pas le param (le middleware le
      // recolle, mais entre-temps on garde notre dernière valeur connue).
      if (value) setWorkspaceParam(value);
    };
    const onWorkspace = (event: Event) => {
      const detail = (event as CustomEvent<string>).detail;
      if (detail) setWorkspaceParam(detail);
    };
    update();
    window.addEventListener("popstate", update);
    window.addEventListener(WORKSPACE_EVENT, onWorkspace);
    return () => {
      window.removeEventListener("popstate", update);
      window.removeEventListener(WORKSPACE_EVENT, onWorkspace);
    };
  }, [pathname]);
  const workspace = getWorkspace(workspaceParam);
  const theme = workspaceTheme[workspace];

  function makeHref(href: string) {
    const sp = new URLSearchParams({ workspace });
    return `${href}?${sp.toString()}`;
  }

  function isActive(href: string, exact: boolean) {
    return exact ? pathname === href : pathname.startsWith(href);
  }

  return (
    <nav
      className="shrink-0 flex items-stretch sm:hidden"
      style={{
        background: surface.s1,
        borderTop: `1px solid ${surface.borderSubtle}`,
        boxShadow: "0 -8px 24px rgba(0, 0, 0, 0.06)",
        // Respect the iPhone home-indicator safe area.
        paddingBottom: "env(safe-area-inset-bottom, 0)",
      }}
      aria-label="Navigation principale"
    >
      {/* Sélecteur d'environnement (pastille) à gauche de la barre. */}
      <div className="flex shrink-0 items-center border-r pl-2 pr-2" style={{ borderColor: surface.borderSubtle }}>
        <WorkspaceSwitcher initialWorkspace={initialWorkspace ?? workspace} />
      </div>
      {NAV_ITEMS.map((item) => {
        const active = isActive(item.href, item.exact);
        return (
          <Link
            key={item.href}
            href={makeHref(item.href)}
            aria-current={active ? "page" : undefined}
            className="flex flex-1 flex-col items-center justify-center gap-1 py-2"
            style={{
              color: active ? theme.accent : text.muted,
              fontSize: 10,
              fontWeight: active ? 600 : 500,
              minHeight: 56,
              textDecoration: "none",
            }}
          >
            {item.icon}
            <span style={{ lineHeight: 1 }}>{t(item.labelKey)}</span>
          </Link>
        );
      })}
    </nav>
  );
}
