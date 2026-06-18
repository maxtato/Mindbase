"use client";

// Petit bouton client qui ouvre une tâche libre en place (drawer) via le
// provider du dashboard. Permet de garder les composants serveur (FocusPanel…)
// tout en offrant l'ouverture directe d'une tâche libre.

import type { CSSProperties, ReactNode } from "react";
import { useOpenStandalone } from "@/components/dashboard/standalone-open-provider";

export function OpenStandaloneButton({
  taskId,
  className,
  style,
  children,
}: {
  taskId: string;
  className?: string;
  style?: CSSProperties;
  children: ReactNode;
}) {
  const open = useOpenStandalone();
  return (
    <button type="button" onClick={() => open(taskId)} className={className} style={style}>
      {children}
    </button>
  );
}
