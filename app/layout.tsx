import type { Metadata, Viewport } from "next";
import { cookies } from "next/headers";
import { ThemeProvider } from "@/components/theme/theme-provider";
import { MobileTapGuard } from "@/components/layout/mobile-tap-guard";
import "./globals.css";

export const metadata: Metadata = {
  title: "Mindbase — Think. Structure. Create.",
  description: "Reliez vos projets, tâches, fichiers et décisions en un seul endroit.",
  applicationName: "Mindbase",
  // Active le mode PWA / standalone sur iOS quand l'app est ajoutée à l'écran
  // d'accueil : pas de barre Safari, status bar adaptée au thème sombre.
  appleWebApp: {
    capable: true,
    title: "Mindbase",
    statusBarStyle: "black-translucent",
  },
  // Hint Apple : tuile par défaut Win/Edge (PWA installable côté desktop).
  other: {
    "mobile-web-app-capable": "yes",
    "apple-mobile-web-app-capable": "yes",
    "apple-mobile-web-app-title": "Mindbase",
  },
};

// Viewport iPhone-friendly : largeur fluide, pas de zoom forcé,
// utilisation des safe areas pour notch/dynamic island.
export const viewport: Viewport = {
  width: "device-width",
  initialScale: 1,
  viewportFit: "cover",
  themeColor: [
    { media: "(prefers-color-scheme: light)", color: "#f2f3f5" },
    { media: "(prefers-color-scheme: dark)", color: "#15171c" },
  ],
};

type InitialThemeMode = "light" | "dark" | "system";

function isInitialThemeMode(value: string | undefined): value is InitialThemeMode {
  return value === "light" || value === "dark" || value === "system";
}

function isResolvedTheme(value: string | undefined): value is "light" | "dark" {
  return value === "light" || value === "dark";
}

export default async function RootLayout({ children }: { children: React.ReactNode }) {
  const cookieStore = await cookies();
  const cookieMode = cookieStore.get("mindbase-theme-mode")?.value;
  const cookieResolved = cookieStore.get("mindbase-theme-resolved")?.value;
  const initialMode: InitialThemeMode = isInitialThemeMode(cookieMode) ? cookieMode : "light";
  // Priorité : cookie résolu (rempli par le client à chaque changement)
  // → permet au SSR de rendre directement avec light/dark sans flash. À
  // défaut, si l'utilisateur a un mode explicite (light/dark) on l'utilise,
  // sinon fallback sur clair (nouvelle DA crème + pastels par défaut).
  const initialTheme = isResolvedTheme(cookieResolved)
    ? cookieResolved
    : initialMode === "dark"
      ? "dark"
      : "light";

  return (
    <html lang="fr" className="h-full" data-theme={initialTheme} data-theme-mode={initialMode} suppressHydrationWarning>
      <body className="h-full" style={{ background: "var(--mb-bg)", color: "var(--mb-text-primary)" }}>
        <ThemeProvider initialMode={initialMode} initialTheme={initialTheme}>
          <MobileTapGuard />
          {children}
        </ThemeProvider>
      </body>
    </html>
  );
}
