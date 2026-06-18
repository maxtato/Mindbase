import { DashboardPageSkeleton } from "@/components/ui/skeleton";

// Squelette affiché pendant le chargement (RSC) des pages du dashboard.
// S'applique à /dashboard et à ses sous-routes qui n'ont pas leur propre
// loading.tsx → perçu de chargement cohérent dans toute l'app.
export default function DashboardLoading() {
  return <DashboardPageSkeleton />;
}
