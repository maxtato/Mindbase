"use client";

import { createContext, useCallback, useContext, useMemo } from "react";
import { useRouter } from "next/navigation";
import { DEFAULT_LOCALE, LOCALE_COOKIE, type Locale } from "@/lib/i18n/config";
import { interpolate } from "@/lib/i18n/messages";

interface LocaleContextValue {
  locale: Locale;
  t: (key: string, vars?: Record<string, string | number>) => string;
  setLocale: (locale: Locale) => void;
}

const LocaleContext = createContext<LocaleContextValue>({
  locale: DEFAULT_LOCALE,
  t: (key) => key,
  setLocale: () => {},
});

// Provider de langue côté client. Reçoit la langue courante + le dictionnaire
// de cette langue (calculés côté serveur depuis le cookie) → pas de flash, et
// on n'embarque qu'une seule langue dans le client. Changer de langue écrit le
// cookie puis rafraîchit (router.refresh) pour re-rendre tout le serveur.
export function LocaleProvider({
  locale,
  messages,
  children,
}: {
  locale: Locale;
  messages: Record<string, string>;
  children: React.ReactNode;
}) {
  const router = useRouter();

  const t = useCallback(
    (key: string, vars?: Record<string, string | number>) => {
      const template = messages[key] ?? key;
      return interpolate(template, vars);
    },
    [messages],
  );

  const setLocale = useCallback(
    (next: Locale) => {
      if (next === locale) return;
      try {
        document.cookie = `${LOCALE_COOKIE}=${next}; path=/; max-age=${60 * 60 * 24 * 365}; samesite=lax`;
        document.documentElement.lang = next;
      } catch {
        /* cookie indisponible */
      }
      router.refresh();
    },
    [locale, router],
  );

  const value = useMemo<LocaleContextValue>(() => ({ locale, t, setLocale }), [locale, t, setLocale]);
  return <LocaleContext.Provider value={value}>{children}</LocaleContext.Provider>;
}

export function useLocale(): Locale {
  return useContext(LocaleContext).locale;
}

// Hook de traduction côté client.
export function useT() {
  return useContext(LocaleContext).t;
}

export function useSetLocale() {
  return useContext(LocaleContext).setLocale;
}
