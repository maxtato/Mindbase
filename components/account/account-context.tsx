"use client";

import { createContext, useContext } from "react";
import { ACTIVE_ACCOUNT_NAME } from "@/lib/current-account";

export interface AccountInfo {
  name: string;
  email: string;
}

const AccountContext = createContext<AccountInfo>({ name: ACTIVE_ACCOUNT_NAME, email: "" });

export function AccountProvider({ value, children }: { value: AccountInfo; children: React.ReactNode }) {
  return <AccountContext.Provider value={value}>{children}</AccountContext.Provider>;
}

/** Identité du compte courant côté client (nom + email). */
export function useAccount(): AccountInfo {
  return useContext(AccountContext);
}

export function useAccountName(): string {
  return useContext(AccountContext).name;
}
