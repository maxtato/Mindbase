"use client";

import { useT } from "@/components/i18n/locale-provider";

// Helpers de libellés localisés pour les statuts et priorités (utilisés dans
// les pastilles, pickers et cartes). Repli sur la valeur fournie si la clé
// n'existe pas (ex. statut personnalisé).
export function useStatusLabel() {
  const t = useT();
  return (status: string, fallback?: string) => {
    const key = `status.${status}`;
    const value = t(key);
    return value === key ? fallback ?? status : value;
  };
}

export function usePriorityLabel() {
  const t = useT();
  return (priority: string, fallback?: string) => {
    const key = `pr.${priority}`;
    const value = t(key);
    return value === key ? fallback ?? priority : value;
  };
}
