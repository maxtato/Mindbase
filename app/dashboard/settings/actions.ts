"use server";

import { revalidatePath } from "next/cache";
import { saveProfile, type AccountPlan, type AccountProfile } from "@/lib/account-store";

export async function saveProfileAction(input: { name: string; email: string }): Promise<AccountProfile> {
  const profile = await saveProfile({ name: input.name, email: input.email });
  // Le nom du compte apparaît dans la sidebar (layout) et sert au filtre
  // « Mes tâches » → on rafraîchit le layout du dashboard.
  revalidatePath("/dashboard", "layout");
  return profile;
}

// Bascule le plan (gratuit / payant). Sans paiement réel pour l'instant : sert
// d'indicateur qui débloque l'IA et la collaboration côté UI et serveur.
export async function savePlanAction(plan: AccountPlan): Promise<AccountProfile> {
  const profile = await saveProfile({ plan: plan === "pro" ? "pro" : "free" });
  revalidatePath("/dashboard", "layout");
  return profile;
}
