// Primitives de squelette + squelette de page générique pour les états de
// chargement (Suspense / loading.tsx). Améliore le perçu : on voit la structure
// se dessiner au lieu d'un écran figé pendant la navigation RSC.

import type { CSSProperties } from "react";
import { surface } from "@/lib/design-tokens";

export function Skeleton({ className, style }: { className?: string; style?: CSSProperties }) {
  return <div aria-hidden className={`mb-skeleton ${className ?? ""}`} style={style} />;
}

// Squelette de page (faux topbar + contenu) — calé sur les gouttières et le
// conteneur des pages du dashboard.
export function DashboardPageSkeleton() {
  return (
    <div className="flex h-full flex-col overflow-hidden" aria-busy="true" aria-live="polite">
      {/* Faux topbar */}
      <div
        className="flex shrink-0 items-center gap-4"
        style={{
          minHeight: "clamp(64px, 9vw, 86px)",
          padding: "12px clamp(12px, 3vw, 24px)",
          background: surface.s1,
          borderBottom: `1px solid ${surface.borderSubtle}`,
        }}
      >
        <div className="flex min-w-0 flex-1 flex-col gap-2">
          <Skeleton style={{ width: 180, height: 22, borderRadius: 8 }} />
          <Skeleton style={{ width: 120, height: 12, borderRadius: 6 }} />
        </div>
        <Skeleton style={{ width: 36, height: 36, borderRadius: 999 }} />
        <Skeleton style={{ width: 36, height: 36, borderRadius: 999 }} />
      </div>

      {/* Faux contenu */}
      <div className="mb-page-scroll flex-1 overflow-hidden px-4 py-6 lg:px-8">
        <div className="mx-auto flex w-full max-w-[1480px] flex-col gap-4">
          <Skeleton style={{ width: "100%", height: 132, borderRadius: 22 }} />
          <div className="grid grid-cols-3 gap-3">
            <Skeleton style={{ height: 92, borderRadius: 22 }} />
            <Skeleton style={{ height: 92, borderRadius: 22 }} />
            <Skeleton style={{ height: 92, borderRadius: 22 }} />
          </div>
          <div className="grid gap-4 lg:grid-cols-2">
            <Skeleton style={{ height: 240, borderRadius: 22 }} />
            <Skeleton style={{ height: 240, borderRadius: 22 }} />
          </div>
        </div>
      </div>
    </div>
  );
}
