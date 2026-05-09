"use client";

// Détecte les appareils tactiles purs (sans souris). Sur ces appareils,
// HTML5 drag-and-drop ne fonctionne pas (iOS Safari) et l'attribut
// `draggable=true` peut interférer avec la propagation des taps.
// Solution : on désactive le drag natif, on garde le onClick.

import { useEffect, useState } from "react";

function detectTouchDevice() {
  if (typeof window === "undefined") return false;

  const hasTouchAPI = "ontouchstart" in window || (navigator?.maxTouchPoints ?? 0) > 0;
  const hasCoarsePointer =
    typeof window.matchMedia === "function" &&
    window.matchMedia("(hover: none) and (pointer: coarse)").matches;

  return hasTouchAPI || hasCoarsePointer;
}

export function useIsTouchDevice(): boolean {
  // On démarre à false pour garder le rendu serveur/client stable. Le CSS
  // mobile neutralise déjà le drag natif avant même l'effet ci-dessous.
  const [isTouch, setIsTouch] = useState(false);

  useEffect(() => {
    if (typeof window === "undefined") return;
    // Détection robuste : on combine la media query CSS standard (hover/pointer)
    // ET la présence de l'API Touch — soit iPhone/Android, soit un appareil
    // hybride qui réagit au doigt en plus de la souris.
    const mq = window.matchMedia("(hover: none) and (pointer: coarse)");
    const detect = () => {
      setIsTouch(detectTouchDevice());
    };
    detect();
    if (typeof mq.addEventListener === "function") {
      mq.addEventListener("change", detect);
      return () => mq.removeEventListener("change", detect);
    }
    mq.addListener(detect);
    return () => mq.removeListener(detect);
  }, []);

  return isTouch;
}
