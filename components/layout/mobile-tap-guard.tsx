"use client";

import { useEffect } from "react";

const NATIVE_TAP_SELECTOR = [
  "button",
  "a[href]",
  "summary",
  "label[for]",
  "[data-mobile-tap]",
  "[role='button']",
].join(",");

const MOVE_TOLERANCE = 12;

function getElementTarget(target: EventTarget | null) {
  return target instanceof Element ? target : null;
}

function isDisabled(target: HTMLElement) {
  if (target.closest("[data-mobile-tap-ignore='true']")) return true;
  if (target.getAttribute("aria-disabled") === "true") return true;
  if (target instanceof HTMLButtonElement) return target.disabled;
  if (target instanceof HTMLInputElement) return target.disabled;
  return false;
}

type ReactPropsBag = {
  onClick?: (event: { preventDefault: () => void; stopPropagation: () => void; currentTarget: HTMLElement; target: HTMLElement }) => void;
};

function getReactProps(element: HTMLElement): ReactPropsBag | null {
  const key = Object.keys(element).find((k) => k.startsWith("__reactProps$"));
  if (!key) return null;
  return (element as unknown as Record<string, ReactPropsBag>)[key] ?? null;
}

function findOnClickHandler(start: HTMLElement): { handler: NonNullable<ReactPropsBag["onClick"]>; element: HTMLElement } | null {
  let cursor: HTMLElement | null = start;
  while (cursor && cursor !== document.body) {
    const props = getReactProps(cursor);
    if (props?.onClick) {
      return { handler: props.onClick, element: cursor };
    }
    cursor = cursor.parentElement;
  }
  return null;
}

function findTapTarget(target: EventTarget | null): HTMLElement | null {
  const element = getElementTarget(target);
  if (!element) return null;

  const nativeTarget = element.closest<HTMLElement>(NATIVE_TAP_SELECTOR);
  if (nativeTarget && !isDisabled(nativeTarget)) {
    return nativeTarget;
  }

  const reactTarget = findOnClickHandler(element as HTMLElement);
  if (reactTarget && !isDisabled(reactTarget.element)) {
    return reactTarget.element;
  }

  return null;
}

/**
 * iOS Safari : sur certaines pages, un tap sur un bouton ou un `<div onClick>`
 * peut recevoir l'état "pressed" sans déclencher le handler React.
 *
 * Stratégie :
 *   1. Détecter un vrai tap court (pointerdown + pointerup, peu de mouvement).
 *   2. Si un onClick React existe sur la cible (ou un ancêtre), l'appeler
 *      directement via la fiber React.
 *   3. Bloquer le click natif doublon éventuel pour éviter le double-fire.
 *   4. Laisser les liens, labels et summary à la navigation native.
 */
export function MobileTapGuard() {
  useEffect(() => {
    if (typeof window === "undefined" || typeof document === "undefined") return;

    const supportsPointer = "PointerEvent" in window;

    let activeTap:
      | { id: number; target: HTMLElement; x: number; y: number }
      | null = null;

    function startTap(id: number, target: HTMLElement, x: number, y: number) {
      activeTap = { id, target, x, y };
    }

    function moveTap(id: number, x: number, y: number) {
      if (!activeTap || activeTap.id !== id) return;
      const moved = Math.hypot(x - activeTap.x, y - activeTap.y);
      if (moved > MOVE_TOLERANCE) {
        activeTap = null;
      }
    }

    // Fenêtre courte : juste assez pour neutraliser le click natif iOS qui
    // peut suivre notre appel direct. Au-delà, c'est un nouveau tap utilisateur.
    const SUPPRESS_WINDOW_MS = 350;

    // One-shot suppression PAR LE TEMPS (et non par cible) : après avoir
    // déclenché manuellement un onClick, on s'attend à AU PLUS un click natif
    // fantôme. On le neutralise quelle que soit sa cible — crucial quand le
    // handler a démonté l'élément tapé (ex. une option de filtre qui ferme le
    // menu) : sinon le click fantôme tombe sur la carte exposée en dessous et
    // l'ouvre par erreur.
    let suppressUntil = 0;

    function markSuppressed() {
      suppressUntil = window.performance.now() + SUPPRESS_WINDOW_MS;
    }

    function handleNativeClick(event: MouseEvent) {
      if (!event.isTrusted) return;
      if (window.performance.now() <= suppressUntil) {
        suppressUntil = 0; // one-shot
        event.preventDefault();
        event.stopImmediatePropagation();
      }
    }

    function endTap(id: number, x: number, y: number, releaseEl: Element | null, preventDefault: () => void) {
      if (!activeTap || activeTap.id !== id) return;
      const tap = activeTap;
      activeTap = null;

      const moved = Math.hypot(x - tap.x, y - tap.y);
      if (moved > MOVE_TOLERANCE) return;
      if (releaseEl && !tap.target.contains(releaseEl)) return;
      if (isDisabled(tap.target)) return;

      // Liens, labels, summary : navigation native, on ne touche pas.
      if (tap.target.tagName === "A" || tap.target.tagName === "LABEL" || tap.target.tagName === "SUMMARY") {
        return;
      }

      const onClickEntry = findOnClickHandler(tap.target);
      if (!onClickEntry) return;

      preventDefault();
      markSuppressed();
      try {
        onClickEntry.handler({
          preventDefault: () => {},
          stopPropagation: () => {},
          currentTarget: onClickEntry.element,
          target: tap.target,
        });
      } catch (error) {
        console.error("[MobileTapGuard] onClick threw", error);
      }
    }

    function handlePointerDown(event: PointerEvent) {
      if (event.pointerType !== "touch") return;
      const target = findTapTarget(event.target);
      if (!target) return;
      startTap(event.pointerId, target, event.clientX, event.clientY);
    }

    function handlePointerMove(event: PointerEvent) {
      moveTap(event.pointerId, event.clientX, event.clientY);
    }

    function handlePointerCancel(event: PointerEvent) {
      if (activeTap?.id === event.pointerId) activeTap = null;
    }

    function handlePointerUp(event: PointerEvent) {
      if (event.pointerType !== "touch") return;
      const releaseEl = getElementTarget(event.target);
      endTap(event.pointerId, event.clientX, event.clientY, releaseEl, () => event.preventDefault());
    }

    function handleTouchStart(event: TouchEvent) {
      const touch = event.touches[0];
      if (!touch) return;
      const target = findTapTarget(event.target);
      if (!target) return;
      startTap(touch.identifier, target, touch.clientX, touch.clientY);
    }

    function handleTouchMove(event: TouchEvent) {
      const touch = event.touches[0];
      if (!touch) return;
      moveTap(touch.identifier, touch.clientX, touch.clientY);
    }

    function handleTouchCancel() {
      if (activeTap) activeTap = null;
    }

    function handleTouchEnd(event: TouchEvent) {
      const touch = event.changedTouches[0];
      if (!touch) return;
      const releaseEl = getElementTarget(event.target);
      endTap(touch.identifier, touch.clientX, touch.clientY, releaseEl, () => event.preventDefault());
    }

    if (supportsPointer) {
      document.addEventListener("pointerdown", handlePointerDown, { capture: true, passive: true });
      document.addEventListener("pointermove", handlePointerMove, { capture: true, passive: true });
      document.addEventListener("pointercancel", handlePointerCancel, { capture: true, passive: true });
      document.addEventListener("pointerup", handlePointerUp, { capture: true, passive: false });
    } else {
      document.addEventListener("touchstart", handleTouchStart, { capture: true, passive: true });
      document.addEventListener("touchmove", handleTouchMove, { capture: true, passive: true });
      document.addEventListener("touchcancel", handleTouchCancel, { capture: true, passive: true });
      document.addEventListener("touchend", handleTouchEnd, { capture: true, passive: false });
    }
    // Capture-phase click listener pour annuler le click natif quand iOS le
    // fire après notre appel direct.
    document.addEventListener("click", handleNativeClick, { capture: true });

    return () => {
      if (supportsPointer) {
        document.removeEventListener("pointerdown", handlePointerDown, { capture: true });
        document.removeEventListener("pointermove", handlePointerMove, { capture: true });
        document.removeEventListener("pointercancel", handlePointerCancel, { capture: true });
        document.removeEventListener("pointerup", handlePointerUp, { capture: true });
      } else {
        document.removeEventListener("touchstart", handleTouchStart, { capture: true });
        document.removeEventListener("touchmove", handleTouchMove, { capture: true });
        document.removeEventListener("touchcancel", handleTouchCancel, { capture: true });
        document.removeEventListener("touchend", handleTouchEnd, { capture: true });
      }
      document.removeEventListener("click", handleNativeClick, { capture: true });
    };
  }, []);

  return null;
}
