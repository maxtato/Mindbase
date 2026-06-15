"use client";

import { useEffect } from "react";

// Sur le dashboard, on empêche tout défilement du body : l'app-shell
// (position:fixed; inset:0) gère sa propre zone scrollable interne. Évite que
// le fond de page « dépasse » ou rebondisse sous l'app-shell sur iPhone.
// Scopé au dashboard (restauré au démontage → les pages d'auth gardent leur
// défilement normal).
export function ViewportLock() {
  useEffect(() => {
    const html = document.documentElement;
    const body = document.body;
    const prev = {
      htmlOverflow: html.style.overflow,
      bodyOverflow: body.style.overflow,
    };
    html.style.overflow = "hidden";
    body.style.overflow = "hidden";
    return () => {
      html.style.overflow = prev.htmlOverflow;
      body.style.overflow = prev.bodyOverflow;
    };
  }, []);
  return null;
}
