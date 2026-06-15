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
      <div className="flex w-full items-center gap-2 min-w-0 sm:w-auto sm:gap-3">
        {/* iPhone uniquement : logo MindLay devant le titre du menu. Sur
            desktop la sidebar porte déjà le logo → on masque via le WRAPPER
            (sm:hidden). Important : on ne met PAS sm:hidden sur l'<Image> car
            son style inline `display:block` l'emporterait sur la classe et le
            logo resterait visible sur desktop. */}
        <span className="shrink-0 sm:hidden">
          <Image
            src="/mindbase-iphone.png"
            alt="MindLay"
            // Logo agrandi + intrinsèque 3× (net sur retina iPhone).
            width={120}
            height={120}
            quality={95}
            priority
            style={{ display: "block", width: 40, height: 40, objectFit: "contain", borderRadius: 9 }}
          />
        </span>
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
                lineHeight: 1.15,
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
