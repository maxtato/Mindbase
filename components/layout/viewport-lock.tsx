"use client";

import { useEffect } from "react";

// Sur iPhone, ni `100dvh` ni `position:fixed; inset:0` ne donnent de façon
// fiable la hauteur EXACTE de la zone visible (toolbar dynamique, safe-areas,
// PWA standalone…), d'où une bande grise sous la bottom nav. On mesure donc la
// zone visible réelle via `visualViewport` et on l'expose dans
// `--mb-app-height`, que l'app-shell utilise comme hauteur. Mis à jour à chaque
// changement (rotation, toolbar, clavier). Body en overflow:hidden pour éviter
// tout défilement parasite. Scopé au dashboard (monté/démonté avec lui).
export function ViewportLock() {
  useEffect(() => {
    const root = document.documentElement;
    const body = document.body;
    const prev = { ho: root.style.overflow, bo: body.style.overflow };
    root.style.overflow = "hidden";
    body.style.overflow = "hidden";

    const apply = () => {
      const h = window.visualViewport?.height ?? window.innerHeight;
      root.style.setProperty("--mb-app-height", `${Math.round(h)}px`);
    };
    apply();

    const vv = window.visualViewport;
    vv?.addEventListener("resize", apply);
    vv?.addEventListener("scroll", apply);
    window.addEventListener("resize", apply);
    window.addEventListener("orientationchange", apply);

    return () => {
      root.style.overflow = prev.ho;
      body.style.overflow = prev.bo;
      root.style.removeProperty("--mb-app-height");
      vv?.removeEventListener("resize", apply);
      vv?.removeEventListener("scroll", apply);
      window.removeEventListener("resize", apply);
      window.removeEventListener("orientationchange", apply);
    };
  }, []);

  return null;
}
