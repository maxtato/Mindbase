import { workspaceTheme } from "@/lib/workspace";
import type { Workspace } from "@/lib/workspace";
import { surface, text } from "@/lib/design-tokens";

interface TopbarProps {
  title: string;
  workspace: Workspace;
  action?: React.ReactNode;
  breadcrumb?: React.ReactNode;
  /** Sous-titre optionnel pour donner du contexte sous le titre. */
  subtitle?: string;
}

export function Topbar({ title, workspace, action, breadcrumb, subtitle }: TopbarProps) {
  const theme = workspaceTheme[workspace];

  return (
    <header
      className="mb-topbar flex items-center justify-between gap-4 shrink-0"
      style={{
        position: "relative",
        minHeight: "clamp(56px, 6vw, 64px)",
        padding: "0 clamp(12px, 3vw, 24px)",
        background: surface.s1,
        borderBottom: `1px solid ${surface.borderSubtle}`,
      }}
    >
      {/* Filet de couleur thème en haut : seule signature visuelle du workspace.
          Pas de picto / logo plate dans le topbar — la couleur suffit. */}
      <span
        aria-hidden
        style={{
          position: "absolute",
          insetInline: 0,
          top: 0,
          height: 2,
          background: theme.gradient,
          opacity: 0.9,
        }}
      />
      <div className="flex items-center gap-3 min-w-0">
        {breadcrumb ?? (
          <div className="min-w-0">
            <h1
              className="truncate"
              style={{
                fontSize: "clamp(18px, 4vw, 22px)",
                fontWeight: 700,
                color: text.primary,
                margin: 0,
                letterSpacing: "-0.02em",
                lineHeight: 1.2,
              }}
            >
              {title}
            </h1>
            {subtitle ? (
              <p
                className="truncate"
                style={{
                  fontSize: 12,
                  color: text.muted,
                  margin: "2px 0 0",
                  lineHeight: 1.4,
                }}
              >
                {subtitle}
              </p>
            ) : null}
          </div>
        )}
      </div>

      <div className="flex shrink-0 flex-wrap items-center justify-end gap-2">
        {/* Pill workspace : signal couleur discret pour rappeler l'environnement actif */}
        <span
          className="inline-flex items-center gap-1.5"
          style={{
            background: theme.accentBg,
            color: theme.accentText,
            fontSize: 11,
            fontWeight: 600,
            padding: "5px 10px 5px 8px",
            borderRadius: 999,
            border: `1px solid ${theme.accentBorder}`,
            letterSpacing: 0,
          }}
        >
          <span
            aria-hidden
            style={{
              width: 6,
              height: 6,
              borderRadius: "50%",
              background: theme.accent,
              display: "inline-block",
            }}
          />
          {theme.label}
        </span>
        {action}
      </div>
    </header>
  );
}
