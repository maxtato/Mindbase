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
import { surface, text } from "@/lib/design-tokens";

const NAV_ITEMS = [
  {
    href: "/dashboard",
    label: "Accueil",
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
    label: "Projets",
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
    href: "/dashboard/kanban",
    label: "Kanban",
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
    label: "Calendrier",
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
    label: "Réglages",
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

export function MobileBottomNav() {
  const pathname = usePathname();
  // Lit le workspace depuis l'URL côté client uniquement — évite useSearchParams
  // (et donc le Suspense boundary qui casse le rendu sur iOS Safari streaming).
  const [workspaceParam, setWorkspaceParam] = useState<string | null>(null);
  useEffect(() => {
    const update = () => {
      const sp = new URLSearchParams(window.location.search);
      setWorkspaceParam(sp.get("workspace"));
    };
    update();
    window.addEventListener("popstate", update);
    return () => window.removeEventListener("popstate", update);
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
      className="fixed bottom-0 left-0 right-0 z-50 flex items-stretch justify-around sm:hidden"
      style={{
        background: surface.s1,
        borderTop: `1px solid ${surface.borderSubtle}`,
        boxShadow: "0 -8px 24px rgba(0, 0, 0, 0.06)",
        // Respect the iPhone home-indicator safe area.
        paddingBottom: "env(safe-area-inset-bottom, 0)",
      }}
      aria-label="Navigation principale"
    >
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
            <span style={{ lineHeight: 1 }}>{item.label}</span>
          </Link>
        );
      })}
    </nav>
  );
}
