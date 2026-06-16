// Garde serveur pour le palier d'abonnement. "pro" débloque l'IA et la
// collaboration ; "free" peut créer des projets manuels en solo, accéder aux
// tâches partagées et les faire évoluer, mais pas l'IA ni la collaboration.

import { getProfile } from "@/lib/account-store";

export async function isPaidPlan(): Promise<boolean> {
  return (await getProfile()).plan === "pro";
}

/** Lève une erreur claire si le compte n'est pas sur un plan payant. */
export async function assertPaidPlan(feature = "Cette fonctionnalité"): Promise<void> {
  if (!(await isPaidPlan())) {
    throw new Error(`${feature} nécessite un abonnement payant (l'IA et la collaboration sont réservées au plan Pro).`);
  }
}
