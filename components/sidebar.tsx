"use client";

import Link from "next/link";
import { usePathname, useSearchParams } from "next/navigation";
import { workspaceTheme, getWorkspace } from "@/lib/workspace";

const nav = [
  {
    href: "/",
    label: "Dashboard",
    icon: (
      <svg width="18" height="18" viewBox="0 0 24 24" fill="none" aria-hidden="true">
        <rect x="3" y="3" width="7.5" height="7.5" rx="2" stroke="currentColor" strokeWidth="1.6" />
        <rect x="13.5" y="3" width="7.5" height="7.5" rx="2" stroke="currentColor" strokeWidth="1.6" />
        <rect x="3" y="13.5" width="7.5" height="7.5" rx="2" stroke="currentColor" strokeWidth="1.6" />
        <rect x="13.5" y="13.5" width="7.5" height="7.5" rx="2" stroke="currentColor" strokeWidth="1.6" />
      </svg>
    ),
  },
  {
    href: "/dashboard/projects",
    label: "Projets",
    icon: (
      <svg width="18" height="18" viewBox="0 0 24 24" fill="none" aria-hidden="true">
        <path
          d="M3 7a3 3 0 0 1 3-3h3.172a2 2 0 0 1 1.414.586l1.828 1.828A2 2 0 0 0 13.828 7H18a3 3 0 0 1 3 3v7a3 3 0 0 1-3 3H6a3 3 0 0 1-3-3V7Z"
          stroke="currentColor"
          strokeWidth="1.6"
          strokeLinejoin="round"
        />
      </svg>
    ),
  },
  {
    href: "/dashboard/tasks",
    label: "Tâches",
    icon: (
      <svg width="18" height="18" viewBox="0 0 24 24" fill="none" aria-hidden="true">
        <rect x="3" y="5" width="5" height="5" rx="1.5" stroke="currentColor" strokeWidth="1.6" />
        <rect x="3" y="14" width="5" height="5" rx="1.5" stroke="currentColor" strokeWidth="1.6" />
        <path d="M11 7.5h10M11 16.5h10" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" />
      </svg>
    ),
  },
];

export function Sidebar() {
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const workspace = getWorkspace(searchParams.get("workspace"));
  const theme = workspaceTheme[workspace];

  const isActive = (href: string) => {
    if (href === "/") return pathname === "/" || pathname === "/dashboard";
    return pathname.startsWith(href);
  };

  return (
    <aside
      className="mb-sidebar-shell"
      style={{ ["--mb-sidebar-active" as string]: theme.accent } as React.CSSProperties}
    >
      {/* Brand : logo prend la couleur du workspace */}
      <div className="mb-sidebar-brand">
        <div
          className="mb-sidebar-logo"
          style={{
            background: theme.gradient,
            boxShadow: `0 6px 14px -4px ${theme.accent}, inset 0 1px 0 rgba(255,255,255,0.18)`,
          }}
        >
          {workspace === "professional" ? (
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" aria-hidden="true">
              <path
                d="M5 20V6a1 1 0 0 1 1-1h7a1 1 0 0 1 1 1v14M14 20V11a1 1 0 0 1 1-1h3a1 1 0 0 1 1 1v9"
                stroke="currentColor"
                strokeWidth="1.8"
                strokeLinecap="round"
                strokeLinejoin="round"
              />
            </svg>
          ) : (
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" aria-hidden="true">
              <path
                d="m4 11 8-7 8 7M6 9.5V19.5a1 1 0 0 0 1 1H17a1 1 0 0 0 1-1V9.5"
                stroke="currentColor"
                strokeWidth="1.8"
                strokeLinecap="round"
                strokeLinejoin="round"
              />
            </svg>
          )}
        </div>
        <div className="mb-sidebar-brand-text">
          <span className="mb-sidebar-brand-name">Mindbase</span>
          <span className="mb-sidebar-brand-meta" style={{ color: theme.accentText }}>
            {theme.label}
          </span>
        </div>
      </div>

      {/* Nav */}
      <nav className="mb-sidebar-nav">
        <p className="mb-sidebar-section-label">Pilotage</p>
        {nav.map((item) => {
          const active = isActive(item.href);
          const href = `${item.href}?workspace=${workspace}`;
          return (
            <Link
              key={item.href}
              href={href}
              className="mb-sidebar-link"
              data-active={active ? "true" : undefined}
            >
              <span aria-hidden className="mb-sidebar-active-rail" />
              <span className="mb-sidebar-icon" aria-hidden>
                {item.icon}
              </span>
              <span className="mb-sidebar-link-label">{item.label}</span>
            </Link>
          );
        })}
      </nav>

      {/* Footer */}
      <div className="mb-sidebar-footer">
        <button type="button" className="mb-sidebar-link" aria-label="Paramètres">
          <span aria-hidden className="mb-sidebar-active-rail" />
          <span className="mb-sidebar-icon" aria-hidden>
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none">
              <path
                d="M12 15a3 3 0 1 0 0-6 3 3 0 0 0 0 6Zm9-3a9.06 9.06 0 0 0-.105-1.388l1.953-1.524-2-3.464-2.34.838a9.044 9.044 0 0 0-2.4-1.388l-.358-2.474h-4l-.358 2.474a9.044 9.044 0 0 0-2.4 1.388l-2.34-.838-2 3.464 1.953 1.524A9.06 9.06 0 0 0 3 12c0 .47.036.933.105 1.388l-1.953 1.524 2 3.464 2.34-.838a9.044 9.044 0 0 0 2.4 1.388l.358 2.474h4l.358-2.474a9.044 9.044 0 0 0 2.4-1.388l2.34.838 2-3.464-1.953-1.524A9.06 9.06 0 0 0 21 12Z"
                stroke="currentColor"
                strokeWidth="1.5"
                strokeLinejoin="round"
              />
            </svg>
          </span>
          <span className="mb-sidebar-link-label">Paramètres</span>
        </button>

        <div className="mb-sidebar-account">
          <div
            className="mb-sidebar-avatar"
            style={{
              background: theme.gradient,
              boxShadow: `0 4px 10px -2px ${theme.accent}`,
            }}
          >
            M
          </div>
          <div className="min-w-0">
            <p className="mb-sidebar-account-name">Maxime T.</p>
            <p className="mb-sidebar-account-meta">Compte {workspace === "professional" ? "professionnel" : "personnel"}</p>
          </div>
        </div>
      </div>
    </aside>
  );
}
