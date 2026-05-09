// Type + parser de la période dashboard. Importable depuis server ET client.
// Le composant client (PeriodFilter) ré-exporte ces utilitaires.

export type DashboardPeriod = "today" | "7d" | "30d";

export function getDashboardPeriod(value: string | undefined | null): DashboardPeriod {
  if (value === "today" || value === "7d" || value === "30d") return value;
  return "7d";
}
