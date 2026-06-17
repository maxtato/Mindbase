"use client";

// Persistance des filtres des vues Kanban / Calendrier.
// Les filtres vivent dans l'URL (?project=&step=&status=…). Problème : en
// quittant l'onglet puis en y revenant via la nav (qui ne porte que
// ?workspace=), les filtres étaient perdus. Ici on :
//  • sauvegarde les filtres actifs dans localStorage à chaque changement ;
//  • à une arrivée « fraîche » SANS filtre dans l'URL, on ré-applique ceux
//    mémorisés (router.replace) — une seule fois, pour ne pas ré-injecter des
//    filtres que l'utilisateur vient volontairement d'effacer.

import { useEffect, useRef } from "react";
import { useRouter } from "next/navigation";

const FILTER_KEYS = ["project", "step", "status", "priority", "owner", "person"] as const;

interface BoardFilterPersistenceProps {
  storageKey: string;
  basePath: string;
  workspace: string;
  month?: string;
  /** Signature des filtres courants (re-déclenche l'effet à chaque changement). */
  signature: string;
}

export function BoardFilterPersistence({ storageKey, basePath, workspace, month, signature }: BoardFilterPersistenceProps) {
  const router = useRouter();
  const didInit = useRef(false);

  useEffect(() => {
    if (typeof window === "undefined") return;
    const sp = new URL(window.location.href).searchParams;
    const present = FILTER_KEYS.filter((key) => sp.get(key));

    // Arrivée fraîche sans aucun filtre → on restaure depuis le stockage.
    if (!didInit.current) {
      didInit.current = true;
      if (present.length === 0) {
        const raw = window.localStorage.getItem(storageKey);
        if (raw) {
          try {
            const saved = JSON.parse(raw) as Record<string, string>;
            const keys = (FILTER_KEYS as readonly string[]).filter((key) => saved[key]);
            if (keys.length > 0) {
              const next = new URLSearchParams();
              next.set("workspace", workspace);
              if (month) next.set("month", month);
              keys.forEach((key) => next.set(key, saved[key]));
              router.replace(`${basePath}?${next.toString()}`);
              return;
            }
          } catch {
            /* ignore */
          }
        }
        return;
      }
    }

    // Sinon : on persiste l'état courant (y compris vide si l'utilisateur a
    // tout effacé — on respecte alors son choix).
    const saved: Record<string, string> = {};
    present.forEach((key) => {
      const value = sp.get(key);
      if (value) saved[key] = value;
    });
    window.localStorage.setItem(storageKey, JSON.stringify(saved));
  }, [signature, storageKey, basePath, workspace, month, router]);

  return null;
}
