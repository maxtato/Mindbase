"use client";

// Drag tactile (iPhone) partagé pour les boards (kanban, calendrier).
// Le HTML5 drag-and-drop ne fonctionne pas au doigt → on suit le pointeur via
// les pointer events, on affiche un APERÇU FLOTTANT « soulevé » qui suit le
// doigt (retour visuel : on voit la carte bouger), on détecte la zone de dépôt
// par document.elementFromPoint + un attribut DOM, et on auto-scrolle près des
// bords (les colonnes/cellules dépassent souvent l'écran sur mobile).

import { useCallback, useRef, useState } from "react";

// Trouve l'ancêtre RÉELLEMENT scrollable verticalement (overflow auto/scroll +
// contenu qui déborde). Selon la page, ce n'est pas le même élément : sur la
// fiche projet c'est `.mb-project-detail-frame`, sur kanban/calendrier c'est le
// `<main>`. On le détecte dynamiquement plutôt que de coder un nom de classe.
export function findScrollParent(start: HTMLElement | null): HTMLElement | null {
  let el: HTMLElement | null = start;
  while (el && el !== document.body) {
    const style = window.getComputedStyle(el);
    const overflowY = style.overflowY;
    if ((overflowY === "auto" || overflowY === "scroll") && el.scrollHeight > el.clientHeight + 1) {
      return el;
    }
    el = el.parentElement;
  }
  return (document.scrollingElement as HTMLElement | null) ?? null;
}

// Détection d'appui long (touch) pour « décoller » un élément et le glisser,
// sans poignée. Un mouvement avant le délai = scroll → on annule. Au-delà du
// délai immobile = on engage le drag via onEngage.
export function useLongPressDrag(
  onEngage: (info: { x: number; y: number; element: HTMLElement }) => void,
  options?: { delay?: number; moveTolerance?: number },
) {
  const delay = options?.delay ?? 300;
  const tolerance = options?.moveTolerance ?? 9;
  const timerRef = useRef<number | null>(null);
  const startRef = useRef<{ x: number; y: number; element: HTMLElement } | null>(null);

  const cancel = useCallback(() => {
    if (timerRef.current !== null) {
      window.clearTimeout(timerRef.current);
      timerRef.current = null;
    }
    startRef.current = null;
  }, []);

  const onPointerDown = useCallback(
    (event: React.PointerEvent) => {
      if (event.pointerType === "mouse") return;
      const element = event.currentTarget as HTMLElement;
      startRef.current = { x: event.clientX, y: event.clientY, element };
      timerRef.current = window.setTimeout(() => {
        const start = startRef.current;
        timerRef.current = null;
        if (start) onEngage(start);
      }, delay);
    },
    [onEngage, delay],
  );

  const onPointerMove = useCallback(
    (event: React.PointerEvent) => {
      const start = startRef.current;
      if (!start || timerRef.current === null) return;
      if (Math.hypot(event.clientX - start.x, event.clientY - start.y) > tolerance) cancel();
    },
    [cancel, tolerance],
  );

  return { onPointerDown, onPointerMove, onPointerUp: cancel, onPointerCancel: cancel };
}

export interface CardDragGhost {
  label: string;
  x: number;
  y: number;
  /** HTML cloné de la carte source → l'aperçu montre la carte ENTIÈRE. */
  html?: string;
  /** Largeur de la carte source (px) pour dimensionner l'aperçu. */
  width?: number;
}

interface UseCardDragOptions {
  /** Attribut DOM marquant une zone de dépôt, ex. "data-kanban-status". */
  dropAttr: string;
  /** Dépôt confirmé : (clé de la carte, valeur de la zone). */
  onDrop: (key: string, target: string) => void;
  /** Conteneur à auto-scroller horizontalement près des bords gauche/droit. */
  scrollContainer?: () => HTMLElement | null;
  /** Idem que scrollContainer (alias explicite pour l'axe horizontal). */
  horizontalScroll?: () => HTMLElement | null;
  /** Conteneur à auto-scroller verticalement près du haut/bas de l'écran. */
  verticalScroll?: () => HTMLElement | null;
  /** Notifie la zone actuellement survolée (pour la surligner), ou null. */
  onOverTarget?: (target: string | null) => void;
}

export function useCardDrag(options: UseCardDragOptions) {
  const [ghost, setGhost] = useState<CardDragGhost | null>(null);
  const [draggingKey, setDraggingKey] = useState<string | null>(null);
  const dataRef = useRef<{ key: string; target: string | null } | null>(null);
  const posRef = useRef({ x: 0, y: 0 });
  const rafRef = useRef<number | null>(null);

  const begin = useCallback(
    (key: string, label: string, startX: number, startY: number, element: HTMLElement) => {
      // Clone de la carte source (marquée data-drag-card) → l'aperçu montre la
      // carte ENTIÈRE qui suit le doigt, pas juste un libellé.
      const cardEl = element.closest("[data-drag-card]") as HTMLElement | null;
      const html = cardEl?.outerHTML;
      const width = cardEl?.getBoundingClientRect().width;

      dataRef.current = { key, target: null };
      posRef.current = { x: startX, y: startY };
      setDraggingKey(key);
      setGhost({ label, x: startX, y: startY, html, width });
      navigator.vibrate?.(12);

      // Bloque le scroll de la page pendant le drag (sinon iOS scrolle).
      const preventScroll = (touchEvent: TouchEvent) => touchEvent.preventDefault();
      window.addEventListener("touchmove", preventScroll, { passive: false });

      // Conteneurs scrollables résolus une seule fois (getComputedStyle est
      // coûteux → on ne le refait pas à chaque frame).
      const h = options.horizontalScroll?.() ?? options.scrollContainer?.() ?? null;
      const v = options.verticalScroll?.() ?? null;

      const tick = () => {
        const { x, y } = posRef.current;
        const edge = 84;
        const speed = 18;
        // Horizontal : on scrolle le conteneur (grille kanban / mois calendrier)
        // quand le doigt approche du bord gauche/droit de l'ÉCRAN.
        if (h) {
          if (x > window.innerWidth - edge) h.scrollLeft += speed;
          else if (x < edge) h.scrollLeft -= speed;
        }
        // Vertical : on scrolle la PAGE quand le doigt approche du haut/bas de
        // l'écran (décalages pour la topbar en haut et la bottom nav en bas).
        if (v) {
          if (y < edge + 24) v.scrollTop -= speed;
          else if (y > window.innerHeight - edge - 24) v.scrollTop += speed;
        }
        rafRef.current = requestAnimationFrame(tick);
      };
      rafRef.current = requestAnimationFrame(tick);

      const move = (ev: PointerEvent) => {
        ev.preventDefault();
        posRef.current = { x: ev.clientX, y: ev.clientY };
        const el = document.elementFromPoint(ev.clientX, ev.clientY);
        const targetEl = el instanceof Element ? el.closest(`[${options.dropAttr}]`) : null;
        const target = targetEl?.getAttribute(options.dropAttr) ?? null;
        if (dataRef.current) dataRef.current.target = target;
        options.onOverTarget?.(target);
        setGhost((current) => (current ? { ...current, x: ev.clientX, y: ev.clientY } : current));
      };

      const end = () => {
        window.removeEventListener("pointermove", move);
        window.removeEventListener("pointerup", end);
        window.removeEventListener("pointercancel", end);
        window.removeEventListener("touchmove", preventScroll);
        if (rafRef.current !== null) {
          cancelAnimationFrame(rafRef.current);
          rafRef.current = null;
        }
        // Supprime le clic synthétique post-drag (sinon ouverture de la carte).
        const suppressClick = (clickEvent: MouseEvent) => {
          clickEvent.preventDefault();
          clickEvent.stopPropagation();
          document.removeEventListener("click", suppressClick, true);
        };
        document.addEventListener("click", suppressClick, true);
        window.setTimeout(() => document.removeEventListener("click", suppressClick, true), 400);

        const drag = dataRef.current;
        dataRef.current = null;
        setGhost(null);
        setDraggingKey(null);
        options.onOverTarget?.(null);
        if (drag && drag.target) options.onDrop(drag.key, drag.target);
      };

      window.addEventListener("pointermove", move, { passive: false });
      window.addEventListener("pointerup", end);
      window.addEventListener("pointercancel", end);
    },
    [options],
  );

  return { ghost, draggingKey, begin };
}

// Aperçu flottant : une mini-carte « soulevée » (ombre + légère rotation) qui
// suit le doigt, placée juste au-dessus pour ne pas être masquée par le doigt.
export function DragGhost({ ghost }: { ghost: CardDragGhost | null }) {
  if (!ghost) return null;

  // Aperçu = la carte entière clonée qui suit le doigt (effet « carte soulevée »).
  if (ghost.html) {
    return (
      <div
        aria-hidden
        style={{
          position: "fixed",
          left: ghost.x,
          top: ghost.y,
          width: ghost.width,
          transform: "translate(-50%, -50%) rotate(-2deg)",
          zIndex: 9999,
          pointerEvents: "none",
          borderRadius: 18,
          overflow: "hidden",
          boxShadow: "var(--mb-shadow-lg)",
          opacity: 0.96,
        }}
        dangerouslySetInnerHTML={{ __html: ghost.html }}
      />
    );
  }

  // Repli : si on n'a pas pu cloner la carte, on affiche un petit libellé.
  return (
    <div
      aria-hidden
      style={{
        position: "fixed",
        left: ghost.x,
        top: ghost.y,
        transform: "translate(-50%, -120%) rotate(-3deg)",
        zIndex: 9999,
        pointerEvents: "none",
        maxWidth: 240,
        padding: "10px 14px",
        borderRadius: 14,
        background: "var(--mb-s1)",
        border: "1px solid var(--mb-border)",
        boxShadow: "var(--mb-shadow-lg)",
        color: "var(--mb-text-primary)",
        fontSize: 12,
        fontWeight: 600,
        lineHeight: 1.3,
        overflow: "hidden",
        textOverflow: "ellipsis",
        whiteSpace: "nowrap",
        opacity: 0.97,
      }}
    >
      {ghost.label}
    </div>
  );
}
