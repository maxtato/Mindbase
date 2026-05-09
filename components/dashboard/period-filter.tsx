"use client";

// Filtre période — 3 chips Aujourd'hui / 7 jours / 30 jours.
// La sélection est portée par le query string `period`.
// IMPORTANT : on évite useSearchParams qui force un Suspense boundary.
// En streaming SSR Next.js + iOS Safari, ce Suspense peut emprisonner
// tout le contenu de la page dans un <div hidden>, rendant les boutons
// inertes au tactile. On lit la query côté client uniquement.

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useEffect, useState } from "react";
import type { DashboardPeriod } from "@/lib/dashboard-period";

const OPTIONS: Array<{ value: DashboardPeriod; label: string }> = [
  { value: "today", label: "Aujourd'hui" },
  { value: "7d", label: "7 jours" },
  { value: "30d", label: "30 jours" },
];

interface PeriodFilterProps {
  value: DashboardPeriod;
  accentColor: string;
}

export function PeriodFilter({ value, accentColor }: PeriodFilterProps) {
  const pathname = usePathname();
  const [search, setSearch] = useState("");
  useEffect(() => {
    const update = () => setSearch(window.location.search);
    update();
    window.addEventListener("popstate", update);
    return () => window.removeEventListener("popstate", update);
  }, [pathname]);

  function buildHref(next: DashboardPeriod) {
    const params = new URLSearchParams(search);
    if (next === "7d") params.delete("period");
    else params.set("period", next);
    const query = params.toString();
    return query ? `${pathname}?${query}` : pathname;
  }

  return (
    <div
      className="inline-flex items-center gap-1 rounded-full p-1"
      style={{ background: "rgba(255,255,255,0.14)", border: "1px solid rgba(255,255,255,0.2)" }}
    >
      {OPTIONS.map((option) => {
        const active = option.value === value;
        return (
          <Link
            key={option.value}
            href={buildHref(option.value)}
            className="rounded-full px-3 py-1 text-[11px] font-semibold"
            style={{
              background: active ? "#FFFFFF" : "transparent",
              color: active ? accentColor : "rgba(255,255,255,0.85)",
              transition: "background 120ms var(--mb-ease), color 120ms var(--mb-ease)",
            }}
          >
            {option.label}
          </Link>
        );
      })}
    </div>
  );
}
