"use client";

import { createContext, useContext, useEffect, useMemo, useSyncExternalStore } from "react";

export type ThemeMode = "light" | "dark" | "system";
export type ResolvedTheme = "light" | "dark";

const THEME_STORAGE_KEY = "mindbase-theme-mode";
// Cookie séparé qui stocke le thème RÉSOLU (light/dark), utilisé par le SSR
// pour rendre le bon `data-theme` dès le HTML initial. Évite le flash de
// thème par défaut (dark) à chaque navigation, en particulier sur iPhone.
const THEME_RESOLVED_COOKIE_KEY = "mindbase-theme-resolved";
const themeListeners = new Set<() => void>();

interface ThemeContextValue {
  mode: ThemeMode;
  resolvedTheme: ResolvedTheme;
  setMode: (mode: ThemeMode) => void;
}

const ThemeContext = createContext<ThemeContextValue | null>(null);

function isThemeMode(value: string | null): value is ThemeMode {
  return value === "light" || value === "dark" || value === "system";
}

function getCookieMode(): ThemeMode | null {
  if (typeof document === "undefined") return null;

  const cookieValue = document.cookie
    .split("; ")
    .find((row) => row.startsWith(`${THEME_STORAGE_KEY}=`))
    ?.split("=")[1];

  const normalizedCookieValue = cookieValue ?? null;
  return isThemeMode(normalizedCookieValue) ? normalizedCookieValue : null;
}

function writeCookieMode(mode: ThemeMode) {
  if (typeof document === "undefined") return;

  document.cookie = `${THEME_STORAGE_KEY}=${mode}; path=/; max-age=31536000; SameSite=Lax`;
}

function writeCookieResolved(theme: ResolvedTheme) {
  if (typeof document === "undefined") return;

  document.cookie = `${THEME_RESOLVED_COOKIE_KEY}=${theme}; path=/; max-age=31536000; SameSite=Lax`;
}

function getStoredMode(): ThemeMode {
  if (typeof window === "undefined") return "light";

  const stored = window.localStorage.getItem(THEME_STORAGE_KEY);
  if (isThemeMode(stored)) return stored;

  // Nouvelle DA crème + pastels : clair par défaut quand rien n'est stocké.
  return getCookieMode() ?? "light";
}

function getSystemTheme(): ResolvedTheme {
  if (typeof window === "undefined") return "light";

  return window.matchMedia("(prefers-color-scheme: dark)").matches ? "dark" : "light";
}

function resolveTheme(mode: ThemeMode): ResolvedTheme {
  return mode === "system" ? getSystemTheme() : mode;
}

function applyTheme(mode: ThemeMode, resolvedTheme: ResolvedTheme) {
  const root = document.documentElement;
  root.dataset.theme = resolvedTheme;
  root.dataset.themeMode = mode;
  root.style.colorScheme = resolvedTheme;
}

type ThemeSnapshot = `${ThemeMode}:${ResolvedTheme}`;

function emitThemeChange() {
  themeListeners.forEach((listener) => listener());
}

function getThemeSnapshot(): ThemeSnapshot {
  const mode = getStoredMode();
  return `${mode}:${resolveTheme(mode)}`;
}

function subscribeToTheme(listener: () => void) {
  themeListeners.add(listener);

  const media = window.matchMedia("(prefers-color-scheme: light)");
  const handleStorage = (event: StorageEvent) => {
    if (event.key === THEME_STORAGE_KEY) listener();
  };

  window.addEventListener("storage", handleStorage);
  media.addEventListener("change", listener);

  return () => {
    themeListeners.delete(listener);
    window.removeEventListener("storage", handleStorage);
    media.removeEventListener("change", listener);
  };
}

function parseThemeSnapshot(snapshot: ThemeSnapshot): [ThemeMode, ResolvedTheme] {
  const [mode, resolvedTheme] = snapshot.split(":") as [ThemeMode, ResolvedTheme];
  return [mode, resolvedTheme];
}

export function ThemeProvider({
  children,
  initialMode = "light",
  initialTheme = "light",
}: {
  children: React.ReactNode;
  initialMode?: ThemeMode;
  initialTheme?: ResolvedTheme;
}) {
  const serverSnapshot: ThemeSnapshot = `${initialMode}:${initialTheme}`;
  const snapshot = useSyncExternalStore(subscribeToTheme, getThemeSnapshot, () => serverSnapshot);
  const [mode, resolvedTheme] = parseThemeSnapshot(snapshot);

  useEffect(() => {
    applyTheme(mode, resolvedTheme);
    writeCookieMode(mode);
    // Persiste le thème résolu pour que le SSR rende avec le bon
    // `data-theme` dès la prochaine navigation — pas de flash dark→light.
    writeCookieResolved(resolvedTheme);
  }, [mode, resolvedTheme]);

  const value = useMemo<ThemeContextValue>(
    () => ({
      mode,
      resolvedTheme,
      setMode(nextMode) {
        window.localStorage.setItem(THEME_STORAGE_KEY, nextMode);
        writeCookieMode(nextMode);
        writeCookieResolved(resolveTheme(nextMode));
        emitThemeChange();
      },
    }),
    [mode, resolvedTheme],
  );

  return <ThemeContext.Provider value={value}>{children}</ThemeContext.Provider>;
}

export function useTheme() {
  const context = useContext(ThemeContext);

  if (!context) {
    throw new Error("useTheme must be used inside ThemeProvider");
  }

  return context;
}
