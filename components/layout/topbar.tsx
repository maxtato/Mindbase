import { workspaceTheme } from "@/lib/workspace";
import type { Workspace } from "@/lib/workspace";
import { surface, text } from "@/lib/design-tokens";
import { CommandTrigger } from "@/components/search/command-trigger";
import { NotificationBell } from "@/components/layout/notification-bell";
import { FlatmindWordmark } from "@/components/branding/flatmind-wordmark";
import { FlatmindLogoMark } from "@/components/branding/flatmind-logo-mark";

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
      className="mb-topbar flex flex-row items-center gap-2 sm:gap-4 shrink-0"
      style={{
        position: "relative",
        // Une seule ligne, y compris sur iPhone : titre à gauche, contrôles
        // (recherche + action) au centre, wordmark « Flatmind » à droite.
        minHeight: "clamp(64px, 9vw, 86px)",
        padding: "12px clamp(12px, 3vw, 24px)",
        // Fond uni (plus de voile dégradé) — la signature d'environnement reste
        // portée par le fin filet de couleur en haut.
        background: surface.s1,
        borderBottom: `1px solid ${surface.borderSubtle}`,
      }}
    >
      {/* Filet de couleur thème en haut : signature visuelle du workspace
          (couleur unie, sans dégradé). */}
      <span
        aria-hidden
        style={{
          position: "absolute",
          insetInline: 0,
          top: 0,
          height: 2,
          background: theme.accent,
          opacity: 0.9,
        }}
      />
      {/* Titre du menu à GAUCHE. */}
      <div className="min-w-0">
        {breadcrumb ?? (
          <>
            <h1
              className="truncate"
              style={{
                fontSize: "clamp(20px, 5vw, 26px)",
                fontWeight: 700,
                color: text.primary,
                margin: 0,
                letterSpacing: "-0.02em",
                // line-height + petit padding bas : sinon le jambage du « j »
                // (Projets) est rogné par l'overflow:hidden de .truncate.
                lineHeight: 1.3,
                paddingBottom: 2,
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
          </>
        )}
      </div>

      {/* Contrôles : recherche globale (palette ⌘K) + action de la page.
          iPhone → fixés au CENTRE exact de la barre (position absolue), donc
          au même endroit quel que soit le titre.
          Desktop → en flux, alignés à droite (ml-auto). */}
      <div className="absolute left-1/2 top-1/2 z-[1] flex shrink-0 -translate-x-1/2 -translate-y-1/2 items-center gap-2 sm:static sm:translate-x-0 sm:translate-y-0 sm:ml-auto">
        <NotificationBell />
        <CommandTrigger />
        {action}
      </div>

      {/* iPhone : logo (cerveau Flatmind) + wordmark « Flatmind » à droite.
          Sur desktop la sidebar porte déjà le logo → masqué (sm:hidden). */}
      <span className="ml-auto flex shrink-0 items-center gap-2 sm:hidden">
        <FlatmindLogoMark height={23} style={{ color: text.primary }} />
        <FlatmindWordmark fontSize={28} style={{ color: text.primary }} />
      </span>
    </header>
  );
}
