import Image from "next/image";
import Link from "next/link";
import { workspaceTheme } from "@/lib/workspace";
import type { Workspace } from "@/lib/workspace";
import { surface, text } from "@/lib/design-tokens";
import { WorkspaceSwitcher } from "@/components/layout/workspace-switcher";

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
      <div className="flex items-center gap-2 min-w-0 sm:gap-3">
        {/* Mark Mindbase visible uniquement en mobile : la sidebar avec le
            logo plein n'est pas affichée sur petit écran. */}
        <Link
          href="/dashboard"
          aria-label="Accueil Mindbase"
          className="shrink-0 sm:hidden"
        >
          <Image
            src="/mindbase-mark.png"
            alt=""
            width={28}
            height={28}
            priority
            style={{ display: "block", borderRadius: 6 }}
          />
        </Link>
        {breadcrumb ?? (
          <div className="min-w-0">
            <h1
              className="truncate"
              style={{
                fontSize: "clamp(16px, 4vw, 22px)",
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
        {/* Switcher d'environnement (Personnel / Professionnel) — cliquable.
            Sur desktop, la sidebar a son propre switcher mais celui-ci reste
            utile et cohérent. Sur mobile, c'est le seul moyen de basculer. */}
        <WorkspaceSwitcher workspace={workspace} />
        {action}
      </div>
    </header>
  );
}
