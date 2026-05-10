"use client";

import { useEffect, useRef, type ReactNode } from "react";

interface ProjectRailDetailsProps {
  children: ReactNode;
}

// <details> qui démarre fermé sur mobile (gain de hauteur sur l'écran
// iPhone, l'utilisateur déplie quand il veut consulter la synthèse) et
// s'ouvre automatiquement sur desktop, où il y a la place côté droit.
// On reste sur le natif <details> pour conserver l'accessibilité et la
// mémorisation native du toggle pendant la session.
const DESKTOP_QUERY = "(min-width: 768px)";

export function ProjectRailDetails({ children }: ProjectRailDetailsProps) {
  const ref = useRef<HTMLDetailsElement>(null);

  useEffect(() => {
    const node = ref.current;
    if (!node) return;
    if (window.matchMedia(DESKTOP_QUERY).matches) {
      node.open = true;
    }
  }, []);

  return (
    <details ref={ref} className="mb-project-rail-shell">
      {children}
    </details>
  );
}
