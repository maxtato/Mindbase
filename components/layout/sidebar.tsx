"use client";

// Sidebar — on évite useSearchParams pour ne pas créer de Suspense boundary
// au niveau de l'AppShell (qui, en streaming SSR + iOS Safari, peut emprisonner
// tout le contenu de la page dans un <div hidden> et bloquer les taps).

import Link from "next/link";
import { useEffect, useState } from "react";
import { usePathname } from "next/navigation";
import { getWorkspace, workspaceTheme } from "@/lib/workspace";
import type { Workspace } from "@/lib/workspace";
import { error, surface, text } from "@/lib/design-tokens";
import { WORKSPACE_EVENT } from "@/lib/workspace-client";
import { WorkspaceSwitcher } from "@/components/layout/workspace-switcher";
import { useT } from "@/components/i18n/locale-provider";
import { FlatmindWordmark } from "@/components/branding/flatmind-wordmark";
import { FlatmindLogoMark } from "@/components/branding/flatmind-logo-mark";

const WIDE = 212;
const COLLAPSED = 62;

interface SidebarWorkspaceStats {
  projectCount: number;
  pendingActionsCount: number;
  scheduledTasksCount: number;
  openBlockersCount: number;
  standaloneOpenCount: number;
}

interface SidebarProps {
  stats: Record<Workspace, SidebarWorkspaceStats>;
  /** Workspace lu côté server (cookie) pour avoir les bons liens dès le
   *  SSR. Sinon le state initial null générerait des hrefs ?workspace=
   *  personal qui peuvent être suivis avant que l'hydratation ne corrige. */
  initialWorkspace?: Workspace;
  /** Nom du compte courant (profil) affiché en bas de la sidebar. */
  accountName?: string;
}

export function Sidebar({ stats, initialWorkspace, accountName }: SidebarProps) {
  const [collapsed, setCollapsed] = useState(false);
  const pathname = usePathname();
  const t = useT();
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
    scheduledTasksCount: 0,
    openBlockersCount: 0,
    standaloneOpenCount: 0,
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
  const brandHeight = collapsed ? 52 : 72;
  const brandLogoSize = collapsed ? 33 : 24;

  const isActive = (href: string, exact = false) =>
    exact ? pathname === href : pathname.startsWith(href);

  const makeHref = (href: string) => {
    const sp = new URLSearchParams({ workspace });
    return `${href}?${sp.toString()}`;
  };

  const navItems = [
    {
      href: "/dashboard",
      exact: true,
      label: t("nav.dashboard"),
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
      label: t("nav.projects"),
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
      href: "/dashboard/tasks",
      exact: false,
      label: t("nav.tasks"),
      badge:
        workspaceStats.standaloneOpenCount > 0
          ? { count: workspaceStats.standaloneOpenCount, color: text.sidebar, bg: surface.sidebarPanel }
          : undefined,
      icon: (
        <svg width="15" height="15" viewBox="0 0 16 16" fill="none">
          <path d="M2.5 4.5 4 6l2.2-2.6M2.5 11 4 12.5l2.2-2.6M8.5 5h5M8.5 11.5h5" stroke="currentColor" strokeWidth="1.4" strokeLinecap="round" strokeLinejoin="round" />
        </svg>
      ),
    },
    {
      href: "/dashboard/kanban",
      exact: false,
      label: t("nav.kanban"),
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
      label: t("nav.calendar"),
      badge:
        workspaceStats.scheduledTasksCount > 0
          ? { count: workspaceStats.scheduledTasksCount, color: text.sidebar, bg: surface.sidebarPanel }
          : undefined,
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
          minHeight: collapsed ? 74 : 88,
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
          title="Flatmind"
          style={{
            width: brandWidth,
            height: brandHeight,
            gap: collapsed ? 0 : 8,
            justifyContent: collapsed ? "center" : "flex-start",
          }}
        >
          {/* Logo Flatmind + wordmark agrandi quand la sidebar est dépliée. */}
          <FlatmindLogoMark height={brandLogoSize} className="shrink-0" style={{ color: text.sidebar }} />
          {!collapsed && (
            <FlatmindWordmark fontSize={34} style={{ color: text.sidebar }} />
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

      {/* Sélecteur d'environnement : contrôle visible et persistant (déplié). */}
      {!collapsed && (
        <div className="px-2 pb-2">
          <WorkspaceSwitcher initialWorkspace={initialWorkspace ?? workspace} />
        </div>
      )}

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
            <span className="text-[12px] font-medium leading-none">{t("nav.settingsFull")}</span>
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
            {(accountName?.trim() || "Maxime T.").charAt(0).toUpperCase()}
          </div>
          {!collapsed && (
            <div className="min-w-0">
              <p className="text-[11px] font-medium truncate leading-none" style={{ color: text.sidebar }}>
                {accountName?.trim() || "Maxime T."}
              </p>
            </div>
          )}
        </div>
      </div>
    </aside>
  );
}
