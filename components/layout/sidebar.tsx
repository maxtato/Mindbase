"use client";

// Sidebar — on évite useSearchParams pour ne pas créer de Suspense boundary
// au niveau de l'AppShell (qui, en streaming SSR + iOS Safari, peut emprisonner
// tout le contenu de la page dans un <div hidden> et bloquer les taps).

import Link from "next/link";
import Image from "next/image";
import { useEffect, useState } from "react";
import { usePathname } from "next/navigation";
import { getWorkspace, workspaceTheme } from "@/lib/workspace";
import type { Workspace } from "@/lib/workspace";
import { error, surface, text } from "@/lib/design-tokens";
import { broadcastWorkspace, WORKSPACE_EVENT } from "@/lib/workspace-client";

const WIDE = 212;
const COLLAPSED = 62;

interface SidebarWorkspaceStats {
  projectCount: number;
  pendingActionsCount: number;
  openBlockersCount: number;
}

interface SidebarProps {
  stats: Record<Workspace, SidebarWorkspaceStats>;
  /** Workspace lu côté server (cookie) pour avoir les bons liens dès le
   *  SSR. Sinon le state initial null générerait des hrefs ?workspace=
   *  personal qui peuvent être suivis avant que l'hydratation ne corrige. */
  initialWorkspace?: Workspace;
}

export function Sidebar({ stats, initialWorkspace }: SidebarProps) {
  const [collapsed, setCollapsed] = useState(false);
  const pathname = usePathname();
  // Lit le workspace depuis l'URL côté client uniquement (pas de useSearchParams).
  const [workspaceParam, setWorkspaceParam] = useState<string | null>(initialWorkspace ?? null);
  useEffect(() => {
    const update = () => {
      const sp = new URLSearchParams(window.location.search);
      const value = sp.get("workspace");
      // Ne reset pas vers null si l'URL n'a pas le param (le middleware
      // le recolle), on garde la dernière valeur connue.
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
  const workspaceStats = stats[workspace] ?? {
    projectCount: 0,
    pendingActionsCount: 0,
    openBlockersCount: 0,
  };

  const w = collapsed ? COLLAPSED : WIDE;
  useEffect(() => {
    const mediaQuery = window.matchMedia("(max-width: 900px)");
    const syncCollapsed = () => {
      if (mediaQuery.matches) setCollapsed(true);
    };

    syncCollapsed();
    mediaQuery.addEventListener("change", syncCollapsed);
    return () => mediaQuery.removeEventListener("change", syncCollapsed);
  }, []);

  const brandWidth = collapsed ? 52 : 188;
  const brandHeight = collapsed ? 52 : 64;
  const brandLogoSize = collapsed ? 46 : 42;

  const isActive = (href: string, exact = false) =>
    exact ? pathname === href : pathname.startsWith(href);

  const makeHref = (href: string) => {
    const sp = new URLSearchParams({ workspace });
    return `${href}?${sp.toString()}`;
  };
  const makeWorkspaceHref = (targetWorkspace: Workspace) => {
    const sp = new URLSearchParams();
    sp.set("workspace", targetWorkspace);
    return `/dashboard?${sp.toString()}`;
  };

  const workspaces: Workspace[] = ["personal", "professional"];
  const navItems = [
    {
      href: "/dashboard",
      exact: true,
      label: "Dashboard",
      badge:
        workspaceStats.openBlockersCount > 0
          ? { count: workspaceStats.openBlockersCount, color: error.text, bg: error.bg }
          : undefined,
      icon: (
        <svg width="15" height="15" viewBox="0 0 16 16" fill="none">
          <rect x="1.5" y="1.5" width="5.5" height="5.5" rx="1.5" fill="currentColor" />
          <rect x="9" y="1.5" width="5.5" height="5.5" rx="1.5" fill="currentColor" />
          <rect x="1.5" y="9" width="5.5" height="5.5" rx="1.5" fill="currentColor" />
          <rect x="9" y="9" width="5.5" height="5.5" rx="1.5" fill="currentColor" />
        </svg>
      ),
    },
    {
      href: "/dashboard/projects",
      exact: false,
      label: "Projets",
      badge:
        workspaceStats.projectCount > 0
          ? { count: workspaceStats.projectCount, color: text.sidebar, bg: surface.sidebarPanel }
          : undefined,
      icon: (
        <svg width="15" height="15" viewBox="0 0 16 16" fill="none">
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
      exact: false,
      label: "Kanban",
      badge:
        workspaceStats.pendingActionsCount > 0
          ? { count: workspaceStats.pendingActionsCount, color: text.sidebar, bg: surface.sidebarPanel }
          : undefined,
      icon: (
        <svg width="15" height="15" viewBox="0 0 16 16" fill="none">
          <rect x="2" y="2.5" width="3.6" height="11" rx="1" stroke="currentColor" strokeWidth="1.3" />
          <rect x="6.2" y="2.5" width="3.6" height="7.5" rx="1" stroke="currentColor" strokeWidth="1.3" />
          <rect x="10.4" y="2.5" width="3.6" height="9" rx="1" stroke="currentColor" strokeWidth="1.3" />
        </svg>
      ),
    },
    {
      href: "/dashboard/calendar",
      exact: false,
      label: "Calendrier",
      badge: undefined,
      icon: (
        <svg width="15" height="15" viewBox="0 0 16 16" fill="none">
          <rect x="2" y="3" width="12" height="10.5" rx="1.4" stroke="currentColor" strokeWidth="1.3" />
          <path d="M2 6.2h12M5 1.8v2.5M11 1.8v2.5" stroke="currentColor" strokeWidth="1.3" strokeLinecap="round" />
        </svg>
      ),
    },
  ] as const;

  return (
    <aside
      className="hidden sm:flex flex-col h-full shrink-0 py-4"
      style={{
        width: w,
        minWidth: w,
        background: surface.sidebar,
        borderRight: `1px solid ${surface.sidebarBorder}`,
        transition: "width 200ms ease, min-width 200ms ease",
        overflow: "hidden",
      }}
    >
      {/* Header: logo + collapse button */}
      <div
        className="mb-4 relative"
        style={{
          minHeight: collapsed ? 74 : 76,
          paddingInline: collapsed ? 3 : 12,
          display: "flex",
          flexDirection: "column",
          alignItems: "center",
          justifyContent: "flex-start",
          gap: 5,
        }}
      >
        {/* Logo + nom (vrai texte qui suit le thème, plus d'image sur plaque) */}
        <Link
          href={makeHref("/dashboard")}
          className="flex items-center shrink-0"
          title="Mindbase"
          style={{
            width: brandWidth,
            height: brandHeight,
            gap: collapsed ? 0 : 10,
            justifyContent: collapsed ? "center" : "flex-start",
          }}
        >
          <Image
            src="/mindbase-iphone.png"
            alt="Mindbase"
            width={brandLogoSize}
            height={brandLogoSize}
            priority
            className="shrink-0"
            style={{ display: "block", objectFit: "contain", borderRadius: 10 }}
          />
          {!collapsed && (
            <span
              style={{
                fontSize: 24,
                fontWeight: 700,
                letterSpacing: "-0.02em",
                lineHeight: 1,
                color: text.sidebar,
              }}
            >
              Mindbase
            </span>
          )}
        </Link>

        {/* Collapse toggle */}
        {!collapsed && (
          <button
            type="button"
            onClick={() => setCollapsed(true)}
            className="mb-sidebar-collapse-toggle flex items-center justify-center shrink-0"
            title="Réduire"
            aria-label="Réduire la barre latérale"
          >
            <svg width="14" height="14" viewBox="0 0 16 16" fill="none">
              <path d="M10 3L6 8l4 5" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
            </svg>
          </button>
        )}

        {collapsed && (
          <button
            type="button"
            onClick={() => setCollapsed(false)}
            className="mb-sidebar-collapse-toggle mt-1 flex items-center justify-center"
            title="Déplier"
            aria-label="Déplier la barre latérale"
          >
            <svg width="14" height="14" viewBox="0 0 16 16" fill="none">
              <path d="M6 3l4 5-4 5" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
            </svg>
          </button>
        )}
      </div>

      {/* Workspace switcher */}
      <div className="px-3 mb-4">
        {collapsed ? (
          <div className="flex flex-col gap-2 items-center">
            {workspaces.map((item) => {
              const itemTheme = workspaceTheme[item];
              const active = item === workspace;

              return (
                <Link
                  key={item}
                  href={makeWorkspaceHref(item)}
                  onClick={() => broadcastWorkspace(item)}
                  className="w-8 h-8 rounded-full flex items-center justify-center text-[11px] font-bold"
                  style={{
                    background: active ? itemTheme.gradient : surface.sidebarPanel,
                    color: active ? "#FFFFFF" : text.sidebarMuted,
                    border: `1px solid ${active ? itemTheme.accentBorder : surface.sidebarBorder}`,
                  }}
                  title={itemTheme.label}
                >
                  {itemTheme.initial}
                </Link>
              );
            })}
          </div>
        ) : (
          <div
            className="flex flex-col gap-1.5 p-1.5 rounded-2xl"
            style={{ background: surface.sidebarPanel, border: `1px solid ${surface.sidebarBorder}` }}
          >
            {workspaces.map((item) => {
              const itemTheme = workspaceTheme[item];
              const active = item === workspace;

              return (
                <Link
                  key={item}
                  href={makeWorkspaceHref(item)}
                  onClick={() => broadcastWorkspace(item)}
                  className="h-10 rounded-xl flex items-center gap-2 px-2.5 text-[11px] font-semibold"
                  style={{
                    background: active ? itemTheme.gradient : surface.sidebarPanel,
                    color: active ? "#FFFFFF" : text.sidebarMuted,
                    border: `1px solid ${active ? itemTheme.accentBorder : surface.sidebarPanel}`,
                  }}
                >
                  <span
                    className="w-5 h-5 rounded-full flex items-center justify-center text-[10px] font-bold shrink-0"
                    style={{
                      background: active ? surface.metricIconBg : surface.sidebarPanelActive,
                      color: active ? surface.metricIconBg : text.sidebarMuted,
                      border: `1px solid ${active ? surface.metricIconBorder : surface.sidebarBorder}`,
                    }}
                  >
                    <span style={{ color: active ? itemTheme.accent : text.sidebarMuted }}>{itemTheme.initial}</span>
                  </span>
                  <span className="truncate leading-none">{itemTheme.label}</span>
                  {active && (
                    <span
                      className="ml-auto w-1.5 h-1.5 rounded-full"
                      style={{ background: surface.metricIconBg }}
                    />
                  )}
                </Link>
              );
            })}
          </div>
        )}
      </div>

      {/* Divider */}
      <div className="mx-3 mb-3" style={{ height: 1, background: surface.sidebarBorder }} />

      {/* Nav items */}
      <nav className="flex flex-col gap-0.5 flex-1 px-2">
        {navItems.map((item) => {
          const active = isActive(item.href, item.exact ?? false);
          return (
            <Link
              key={item.href}
              href={makeHref(item.href)}
              title={collapsed ? item.label : undefined}
              className="relative flex items-center rounded-xl transition-all"
              style={{
                height: 42,
                gap: 10,
                paddingLeft: 10,
                paddingRight: 10,
                background: active ? theme.gradient : surface.sidebar,
                color: active ? surface.onColor : text.sidebarMuted,
                border: active ? `1px solid ${theme.accentBorder}` : `1px solid ${surface.sidebar}`,
              }}
            >
              {/* Active indicator */}
              {active && (
                <div
                  className="absolute left-0 top-2 bottom-2 w-0.5 rounded-full"
                  style={{ background: theme.accent }}
                />
              )}
              <span className="shrink-0">{item.icon}</span>
              {!collapsed && (
                <>
                  <span className="text-[12px] font-medium whitespace-nowrap flex-1 leading-none">{item.label}</span>
                  {item.badge && (
                    <span
                      className="text-[9px] font-bold px-1.5 py-0.5 rounded-full shrink-0 leading-none"
                      style={{ background: item.badge.bg, color: item.badge.color }}
                    >
                      {item.badge.count}
                    </span>
                  )}
                </>
              )}
              {collapsed && item.badge && (
                <span
                  className="absolute top-1 right-1 w-2 h-2 rounded-full"
                  style={{ background: item.badge.color }}
                />
              )}
            </Link>
          );
        })}
      </nav>

      {/* Divider */}
      <div className="mx-3 my-3" style={{ height: 1, background: surface.sidebarBorder }} />

      {/* Bottom: settings + profile */}
      <div className="px-2 space-y-0.5">
        <Link
          href={makeHref("/dashboard/settings")}
          className="relative flex items-center rounded-lg w-full"
          style={{
            height: 36,
            gap: 10,
            paddingLeft: 10,
            paddingRight: 10,
            color: text.sidebarMuted,
          }}
          title="Paramètres"
        >
          <svg width="15" height="15" viewBox="0 0 16 16" fill="none" className="shrink-0">
            <circle cx="8" cy="8" r="2.5" stroke="currentColor" strokeWidth="1.4" />
            <path
              d="M8 1.5V3M8 13v1.5M1.5 8H3M13 8h1.5M3.4 3.4l1.06 1.06M11.54 11.54l1.06 1.06M3.4 12.6l1.06-1.06M11.54 4.46l1.06-1.06"
              stroke="currentColor"
              strokeWidth="1.3"
              strokeLinecap="round"
            />
          </svg>
          {!collapsed && (
            <span className="text-[12px] font-medium leading-none">Paramètres</span>
          )}
        </Link>

        {/* Profile */}
        <div
          className="flex items-center rounded-lg"
          style={{
            height: 36,
            gap: 10,
            paddingLeft: 10,
            paddingRight: 10,
          }}
        >
          <div
            className="w-6 h-6 rounded-full flex items-center justify-center text-[10px] font-bold text-white shrink-0"
            style={{ background: theme.gradient }}
          >
            M
          </div>
          {!collapsed && (
            <div className="min-w-0">
              <p className="text-[11px] font-medium truncate leading-none" style={{ color: text.sidebar }}>Maxime T.</p>
            </div>
          )}
        </div>
      </div>
    </aside>
  );
}
