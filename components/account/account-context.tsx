"use client";

import { createContext, useContext } from "react";
import { ACTIVE_ACCOUNT_NAME } from "@/lib/current-account";
import type { AccountPlan } from "@/lib/account-store";

export interface AccountInfo {
  name: string;
  email: string;
  plan: AccountPlan;
}

const AccountContext = createContext<AccountInfo>({ name: ACTIVE_ACCOUNT_NAME, email: "", plan: "pro" });

export function AccountProvider({ value, children }: { value: AccountInfo; children: React.ReactNode }) {
  return <AccountContext.Provider value={value}>{children}</AccountContext.Provider>;
}

/** Identité du compte courant côté client (nom + email + plan). */
export function useAccount(): AccountInfo {
  return useContext(AccountContext);
}

export function useAccountName(): string {
  return useContext(AccountContext).name;
}

/** Vrai si le compte a un plan payant (IA + collaboration débloquées). */
export function useIsPaidPlan(): boolean {
  return useContext(AccountContext).plan === "pro";
}
