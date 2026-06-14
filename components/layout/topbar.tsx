import Image from "next/image";
import { workspaceTheme } from "@/lib/workspace";
import type { Workspace } from "@/lib/workspace";
import { surface, text } from "@/lib/design-tokens";
import { WorkspaceSwitcher } from "@/components/layout/workspace-switcher";
import { CommandTrigger } from "@/components/search/command-trigger";

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
        minHeight: "clamp(64px, 7vw, 70px)",
        padding: "12px clamp(12px, 3vw, 24px)",
        // Voile d'accent très léger en haut → on « sent » l'environnement
        // (Perso violet / Pro bleu) sans bandeau coloré. Re-rendu par page.
        background: `linear-gradient(180deg, color-mix(in srgb, ${theme.accent} 7%, ${surface.s1}) 0%, ${surface.s1} 72%)`,
        borderBottom: `1px solid ${surface.borderSubtle}`,
      }}
    >
      {/* Filet de couleur thème en haut : signature visuelle du workspace. */}
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
        {/* iPhone uniquement : logo Mindbase devant le titre du menu. Sur
            desktop la sidebar porte déjà le logo → on le masque (sm:hidden). */}
        <Image
          src="/mindbase-iphone.png"
          alt="Mindbase"
          // Intrinsèque 3× la taille d'affichage (32px) → net sur les écrans
          // retina iPhone (next/image servait ~64px pour un slot de 96px @3×).
          width={96}
          height={96}
          quality={95}
          priority
          className="shrink-0 sm:hidden"
          style={{ display: "block", width: 32, height: 32, objectFit: "contain", borderRadius: 8 }}
        />
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
        {/* Recherche globale (palette ⌘K) — accessible partout. */}
        <CommandTrigger />
        {/* Switcher d'environnement (Personnel / Professionnel) — cliquable.
            Sur desktop, la sidebar a son propre switcher mais celui-ci reste
            utile et cohérent. Sur mobile, c'est le seul moyen de basculer. */}
        <WorkspaceSwitcher workspace={workspace} />
        {action}
      </div>
    </header>
  );
}
