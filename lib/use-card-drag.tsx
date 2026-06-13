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
// sans poignée.
//
// IMPORTANT : on s'appuie sur les TOUCH events (pas pointer). Sur iOS, le
// navigateur ANNULE les pointer events dès qu'il soupçonne un scroll, ce qui
// tuait le minuteur d'appui long dans les conteneurs scrollables (kanban,
// calendrier). Avec les touch events :
//   - un MOUVEMENT avant le délai = l'utilisateur scrolle → on annule l'appui
//     long et on laisse le navigateur défiler nativement (fluide, sans
//     preventDefault) ;
//   - un appui IMMOBILE au-delà du délai = on engage le drag (le blocage du
//     scroll est alors posé par le drag lui-même, cf. begin()).
// Plus besoin de touch-action:none → le scroll au doigt sur les cartes reste
// fluide tant qu'on n'a pas « décollé ».
export function useLongPressDrag(
  onEngage: (info: { x: number; y: number; element: HTMLElement }) => void,
  options?: { delay?: number; moveTolerance?: number },
) {
  const delay = options?.delay ?? 280;
  const tolerance = options?.moveTolerance ?? 12;
  const timerRef = useRef<number | null>(null);
  const startRef = useRef<{ x: number; y: number; element: HTMLElement } | null>(null);
  const engagedRef = useRef(false);

  const clear = useCallback(() => {
    if (timerRef.current !== null) {
      window.clearTimeout(timerRef.current);
      timerRef.current = null;
    }
    startRef.current = null;
  }, []);

  const onTouchStart = useCallback(
    (event: React.TouchEvent) => {
      // Multi-touch (pinch/zoom) → ce n'est pas un appui long.
      if (event.touches.length !== 1) {
        clear();
        return;
      }
      const touch = event.touches[0];
      const element = event.currentTarget as HTMLElement;
      engagedRef.current = false;
      startRef.current = { x: touch.clientX, y: touch.clientY, element };
      timerRef.current = window.setTimeout(() => {
        const start = startRef.current;
        timerRef.current = null;
        if (start) {
          engagedRef.current = true;
          onEngage(start);
        }
      }, delay);
    },
    [onEngage, delay, clear],
  );

  const onTouchMove = useCallback(
    (event: React.TouchEvent) => {
      // Une fois engagé, c'est le drag (begin) qui pilote le mouvement.
      if (engagedRef.current) return;
      const start = startRef.current;
      const touch = event.touches[0];
      if (!start || !touch || timerRef.current === null) return;
      // On NE preventDefault PAS ici → le scroll natif reste fluide. Si le doigt
      // bouge avant le délai, c'est un scroll : on annule l'appui long.
      if (Math.hypot(touch.clientX - start.x, touch.clientY - start.y) > tolerance) clear();
    },
    [clear, tolerance],
  );

  const onTouchEnd = useCallback(() => {
    if (!engagedRef.current) clear();
  }, [clear]);

  return { onTouchStart, onTouchMove, onTouchEnd, onTouchCancel: onTouchEnd };
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
        // Vertical : on déclenche le défilement par rapport aux BORDS VISIBLES
        // du conteneur scrollable (pas du viewport brut). La marge haute est
        // large pour que ça commence à scroller dès qu'on approche du panneau
        // du haut (filtres / réglages assistant), pas seulement tout en haut.
        if (v) {
          const r = v.getBoundingClientRect();
          const topTrigger = Math.max(r.top, 0) + 120;
          const bottomTrigger = Math.min(r.bottom, window.innerHeight) - 96;
          if (y < topTrigger) v.scrollTop -= speed;
          else if (y > bottomTrigger) v.scrollTop += speed;
        }
        rafRef.current = requestAnimationFrame(tick);
      };
      rafRef.current = requestAnimationFrame(tick);

      // Drag piloté par les TOUCH events : on preventDefault le touchmove (le
      // drag est engagé → on bloque le scroll natif) et on suit le doigt.
      const move = (ev: TouchEvent) => {
        const touch = ev.touches[0];
        if (!touch) return;
        ev.preventDefault();
        const x = touch.clientX;
        const y = touch.clientY;
        posRef.current = { x, y };
        const el = document.elementFromPoint(x, y);
        const targetEl = el instanceof Element ? el.closest(`[${options.dropAttr}]`) : null;
        const target = targetEl?.getAttribute(options.dropAttr) ?? null;
        if (dataRef.current) dataRef.current.target = target;
        options.onOverTarget?.(target);
        setGhost((current) => (current ? { ...current, x, y } : current));
      };

      const end = () => {
        window.removeEventListener("touchmove", move);
        window.removeEventListener("touchend", end);
        window.removeEventListener("touchcancel", end);
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

      window.addEventListener("touchmove", move, { passive: false });
      window.addEventListener("touchend", end);
      window.addEventListener("touchcancel", end);
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
