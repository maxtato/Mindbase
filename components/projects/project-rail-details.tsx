import { type ReactNode } from "react";

interface ProjectRailDetailsProps {
  children: ReactNode;
}

// <details> OUVERT par défaut (mobile comme desktop) : la synthèse est visible
// d'emblée, la flèche (summary) sert uniquement à la réduire si on veut gagner
// de la hauteur. On reste sur le natif <details> pour l'accessibilité et la
// mémorisation native du toggle pendant la session.
export function ProjectRailDetails({ children }: ProjectRailDetailsProps) {
  return (
    <details open className="mb-project-rail-shell">
      {children}
    </details>
  );
}
