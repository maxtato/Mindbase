"use client";

import { createContext, useContext } from "react";
import { registerCustomEnvironments, type CustomEnvironment } from "@/lib/workspace";

const EnvironmentsContext = createContext<CustomEnvironment[]>([]);

// Rend disponibles les environnements personnalisés à toute l'app ET enregistre
// leurs thèmes (couleur) dans le registre `workspaceTheme`. L'appel à
// registerCustomEnvironments se fait pendant le rendu (SSR + client), donc AVANT
// celui des enfants, pour que `workspaceTheme[id]` résolve correctement partout
// (y compris dans les composants serveur rendus dessous).
export function EnvironmentsProvider({
  initial,
  children,
}: {
  initial: CustomEnvironment[];
  children: React.ReactNode;
}) {
  registerCustomEnvironments(initial);
  return <EnvironmentsContext.Provider value={initial}>{children}</EnvironmentsContext.Provider>;
}

export function useEnvironments(): CustomEnvironment[] {
  return useContext(EnvironmentsContext);
}
