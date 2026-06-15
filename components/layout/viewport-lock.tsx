"use client";

import { useEffect } from "react";

// Sur le dashboard, on verrouille html/body à 100dvh + overflow hidden pour que
// rien ne dépasse sous l'app-shell (sinon le fond de page gris apparaissait
// sous la bottom nav sur iPhone, body `100%` = grand viewport > shell `100dvh`).
// Scopé au dashboard (monté/démonté avec lui) → les pages d'auth gardent un
// défilement normal.
export function ViewportLock() {
  useEffect(() => {
    const html = document.documentElement;
    const body = document.body;
    const prev = {
      htmlHeight: html.style.height,
      htmlOverflow: html.style.overflow,
      bodyHeight: body.style.height,
      bodyOverflow: body.style.overflow,
    };
    html.style.height = "100dvh";
    html.style.overflow = "hidden";
    body.style.height = "100dvh";
    body.style.overflow = "hidden";
    return () => {
      html.style.height = prev.htmlHeight;
      html.style.overflow = prev.htmlOverflow;
      body.style.height = prev.bodyHeight;
      body.style.overflow = prev.bodyOverflow;
    };
  }, []);
  return null;
}
