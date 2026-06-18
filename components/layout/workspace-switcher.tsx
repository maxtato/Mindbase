"use client";

// Sélecteur d'environnement (Tous / Perso / Pro / personnalisés) — contrôle
// persistant et visible, là où il n'existait qu'implicitement via le paramètre
// d'URL `?workspace=`. Réutilise le style « pill » des filtres.
//
// Comme la sidebar/bottom-nav, on suit l'environnement courant via l'évènement
// `WORKSPACE_EVENT` (pas de useSearchParams → pas de Suspense au niveau du shell).

import { useEffect, useState } from "react";
import { usePathname, useRouter } from "next/navigation";
import { FilterPill, type FilterPillOption } from "@/components/ui/filter-pill";
import { useEnvironments } from "@/components/environments/environments-provider";
import { ALL_WORKSPACE, getWorkspace, listEnvironmentOptions, workspaceTheme } from "@/lib/workspace";
import { WORKSPACE_EVENT, broadcastWorkspace } from "@/lib/workspace-client";
import { useT } from "@/components/i18n/locale-provider";

export function WorkspaceSwitcher({
  initialWorkspace,
  minWidth,
}: {
  initialWorkspace: string;
  minWidth?: number;
}) {
  const router = useRouter();
  const pathname = usePathname();
  const t = useT();
  const environments = useEnvironments();
  const [workspaceParam, setWorkspaceParam] = useState<string>(initialWorkspace);

  useEffect(() => {
    function onWorkspace(event: Event) {
      const detail = (event as CustomEvent<string>).detail;
      if (detail) setWorkspaceParam(detail);
    }
    function onPop() {
      const value = new URLSearchParams(window.location.search).get("workspace");
      if (value) setWorkspaceParam(value);
    }
    window.addEventListener(WORKSPACE_EVENT, onWorkspace);
    window.addEventListener("popstate", onPop);
    return () => {
      window.removeEventListener(WORKSPACE_EVENT, onWorkspace);
      window.removeEventListener("popstate", onPop);
    };
  }, []);

  const current = getWorkspace(workspaceParam);
  const accent = workspaceTheme[current].accent;

  const options: FilterPillOption<string>[] = [
    { value: ALL_WORKSPACE, label: t("common.all") },
    ...listEnvironmentOptions(environments).map((option) => ({
      value: option.value,
      label: option.label,
      dot: workspaceTheme[option.value].accent,
    })),
  ];

  function change(value: string) {
    if (value === current) return;
    // Diffuse à la sidebar / bottom-nav (cookie + évènement) puis navigue sur la
    // même page avec le nouvel environnement (re-rendu serveur).
    broadcastWorkspace(value);
    const params = new URLSearchParams(window.location.search);
    params.set("workspace", value);
    router.push(`${pathname}?${params.toString()}`);
    router.refresh();
  }

  return (
    <FilterPill
      label={t("filter.environment")}
      value={current}
      options={options}
      onChange={change}
      accentColor={accent}
      active={current !== ALL_WORKSPACE}
      minWidth={minWidth}
    />
  );
}
