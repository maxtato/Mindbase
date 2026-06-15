import Image from "next/image";
import { workspaceTheme } from "@/lib/workspace";
import type { Workspace } from "@/lib/workspace";
import { surface, text } from "@/lib/design-tokens";
import { WorkspaceSwitcher } from "@/components/layout/workspace-switcher";
import { CommandTrigger } from "@/components/search/command-trigger";
import { FlatmindWordmark } from "@/components/branding/mindlay-wordmark";

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
      className="mb-topbar flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between sm:gap-4 shrink-0"
      style={{
        position: "relative",
        // Barre plus épaisse (présence + premium). Sur iPhone elle passe sur
        // 2 lignes (titre en haut, contrôles en dessous) → le nom du menu n'est
        // plus coupé par la recherche / le sélecteur d'environnement.
        minHeight: "clamp(74px, 9vw, 86px)",
        padding: "15px clamp(12px, 3vw, 24px)",
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
      {/* Ligne 1 : titre du menu à GAUCHE, et sur iPhone le wordmark « Flatmind »
          à DROITE. Sur desktop la sidebar porte déjà le logo → wordmark masqué
          (sm:hidden). */}
      <div className="flex w-full items-center justify-between gap-2 min-w-0 sm:w-auto sm:justify-start sm:gap-3">
        {breadcrumb ?? (
          <div className="min-w-0">
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
          </div>
        )}

        {/* iPhone : logo (cerveau Flatmind) + wordmark « Flatmind » à droite du titre. */}
        <span className="flex shrink-0 items-center gap-2 sm:hidden">
          <Image
            src="/flatmind-logo.png"
            alt="Flatmind"
            width={912}
            height={706}
            priority
            style={{ display: "block", height: 26, width: "auto", objectFit: "contain" }}
          />
          <FlatmindWordmark fontSize={28} style={{ color: text.primary }} />
        </span>
      </div>

      <div className="flex w-full shrink-0 flex-wrap items-center justify-start gap-2 sm:w-auto sm:justify-end">
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
