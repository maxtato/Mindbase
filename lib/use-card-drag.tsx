"use client";

// Drag tactile (iPhone) partagé pour les boards (kanban, calendrier).
// Le HTML5 drag-and-drop ne fonctionne pas au doigt → on suit le pointeur via
// les pointer events, on affiche un APERÇU FLOTTANT « soulevé » qui suit le
// doigt (retour visuel : on voit la carte bouger), on détecte la zone de dépôt
// par document.elementFromPoint + un attribut DOM, et on auto-scrolle près des
// bords (les colonnes/cellules dépassent souvent l'écran sur mobile).

import { useCallback, useRef, useState } from "react";

export interface CardDragGhost {
  label: string;
  x: number;
  y: number;
}

interface UseCardDragOptions {
  /** Attribut DOM marquant une zone de dépôt, ex. "data-kanban-status". */
  dropAttr: string;
  /** Dépôt confirmé : (clé de la carte, valeur de la zone). */
  onDrop: (key: string, target: string) => void;
  /** Conteneur à auto-scroller quand on approche des bords. */
  scrollContainer?: () => HTMLElement | null;
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
    (key: string, label: string, event: React.PointerEvent) => {
      event.preventDefault();
      event.stopPropagation();

      dataRef.current = { key, target: null };
      posRef.current = { x: event.clientX, y: event.clientY };
      setDraggingKey(key);
      setGhost({ label, x: event.clientX, y: event.clientY });

      const tick = () => {
        const sc = options.scrollContainer?.();
        if (sc) {
          const rect = sc.getBoundingClientRect();
          const edge = 56;
          const { x, y } = posRef.current;
          if (x > rect.right - edge) sc.scrollLeft += 14;
          else if (x < rect.left + edge) sc.scrollLeft -= 14;
          if (y > rect.bottom - edge) sc.scrollTop += 12;
          else if (y < rect.top + edge) sc.scrollTop -= 12;
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
        if (rafRef.current !== null) {
          cancelAnimationFrame(rafRef.current);
          rafRef.current = null;
        }
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
