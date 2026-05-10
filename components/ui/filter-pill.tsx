"use client";

// Filtre / sélecteur unifié — style "tag" compact, sans pictogramme.
// Layout horizontal : Label · Valeur ▾, sur une seule ligne. Quand un filtre
// est actif (valeur ≠ défaut), le bouton bascule en solide à la couleur du
// workspace avec texte blanc. Cohérent d'une page à l'autre.
//
// iOS Safari : le menu déroulant est rendu via `createPortal` dans <body>
// pour échapper aux stacking contexts (overflow:hidden, transform, …). On
// utilise `pointerdown` plutôt que `mousedown` pour fermer au clic extérieur,
// car sur iOS la séquence touch→mouse synthétique peut désynchroniser
// l'ordre des events et faire fermer le menu juste après l'avoir ouvert.

import { useEffect, useLayoutEffect, useRef, useState, type ReactNode } from "react";
import { createPortal } from "react-dom";

export interface FilterPillOption<T extends string = string> {
  value: T;
  label: string;
  /** Pastille colorée optionnelle à gauche du label (statut, priorité…). */
  dot?: string;
  /** Description discrète sous le label dans le menu. */
  description?: string;
}

interface FilterPillProps<T extends string> {
  label: string;
  value: T;
  options: FilterPillOption<T>[];
  onChange: (value: T) => void;
  /** Quand `true`, le bouton bascule en solide accent (workspace). */
  active?: boolean;
  /** Couleur d'accent solide (utilisée pour l'état actif et l'item sélectionné). */
  accentColor?: string;
  /** Côté d'alignement du menu déroulant. */
  align?: "start" | "end";
  /** Largeur min optionnelle (sinon largeur naturelle au contenu). */
  minWidth?: number;
}

export function FilterPill<T extends string>({
  label,
  value,
  options,
  onChange,
  active = false,
  accentColor,
  align = "start",
  minWidth,
}: FilterPillProps<T>) {
  const [open, setOpen] = useState(false);
  const buttonRef = useRef<HTMLButtonElement>(null);
  const menuRef = useRef<HTMLDivElement>(null);
  const [menuPosition, setMenuPosition] = useState<{ top: number; left: number; width: number; flipped: boolean } | null>(null);
  const [mounted, setMounted] = useState(false);
  const selected = options.find((option) => option.value === value);
  const accent = accentColor ?? "var(--mb-mauve)";

  useEffect(() => {
    setMounted(true);
  }, []);

  // Calcule la position du menu portail relativement au bouton. Recalculé
  // sur scroll/resize pour suivre le bouton si la page bouge.
  useLayoutEffect(() => {
    if (!open || !buttonRef.current) return;

    function updatePosition() {
      const button = buttonRef.current;
      if (!button) return;
      const rect = button.getBoundingClientRect();
      const viewportH = window.innerHeight;
      const menuH = menuRef.current?.offsetHeight ?? 240; // best-effort estimate
      // Si on n'a pas la place en dessous mais qu'on a la place au-dessus,
      // on flip le menu vers le haut. Évite de devoir afficher le menu
      // off-screen ou en bottom-sheet sur mobile.
      const spaceBelow = viewportH - rect.bottom;
      const spaceAbove = rect.top;
      const flipped = spaceBelow < Math.min(menuH, 220) && spaceAbove > spaceBelow;
      // Sur petit écran on aligne le menu au left/right de la viewport
      // avec une marge, plutôt qu'au bouton (lisible + accessible au pouce).
      const isMobile = window.innerWidth < 640;
      let left: number;
      let width: number;
      if (isMobile) {
        const margin = 12;
        left = margin;
        width = Math.max(0, window.innerWidth - margin * 2);
      } else {
        left = align === "end" ? rect.right - 220 : rect.left;
        width = rect.width;
      }
      setMenuPosition({
        top: flipped ? rect.top - 6 : rect.bottom + 6,
        left,
        width,
        flipped,
      });
    }

    updatePosition();
    window.addEventListener("scroll", updatePosition, true);
    window.addEventListener("resize", updatePosition);
    return () => {
      window.removeEventListener("scroll", updatePosition, true);
      window.removeEventListener("resize", updatePosition);
    };
  }, [open, align]);

  useEffect(() => {
    if (!open) return;

    function handleOutsidePointerDown(event: PointerEvent) {
      const target = event.target as Node;
      const insideButton = buttonRef.current?.contains(target);
      const insideMenu = menuRef.current?.contains(target);
      if (!insideButton && !insideMenu) {
        setOpen(false);
      }
    }

    // Délai 0 — le pointerdown qui a ouvert le menu finit son cycle d'event
    // avant que le listener s'attache, sinon il fermerait immédiatement.
    const timer = window.setTimeout(() => {
      document.addEventListener("pointerdown", handleOutsidePointerDown);
    }, 0);

    return () => {
      window.clearTimeout(timer);
      document.removeEventListener("pointerdown", handleOutsidePointerDown);
    };
  }, [open]);

  function handleSelect(nextValue: T) {
    onChange(nextValue);
    setOpen(false);
  }

  return (
    <>
      <button
        ref={buttonRef}
        type="button"
        onClick={() => setOpen((current) => !current)}
        aria-expanded={open}
        aria-haspopup="listbox"
        className="mb-filter-pill"
        data-active={active ? "true" : undefined}
        data-open={open ? "true" : undefined}
        style={{
          minWidth,
          ["--mb-filter-accent" as string]: accent,
        } as React.CSSProperties}
      >
        <span className="mb-filter-pill-label">{label}</span>
        <span className="mb-filter-pill-sep" aria-hidden>·</span>
        {selected?.dot && !active && (
          <span
            aria-hidden
            className="mb-filter-pill-dot"
            style={{ background: selected.dot }}
          />
        )}
        <span className="mb-filter-pill-value">{selected?.label ?? value}</span>
        <span className="mb-filter-pill-chevron" aria-hidden>
          <svg width="10" height="10" viewBox="0 0 16 16" fill="none">
            <path
              d="m4 6 4 4 4-4"
              stroke="currentColor"
              strokeWidth="1.8"
              strokeLinecap="round"
              strokeLinejoin="round"
            />
          </svg>
        </span>
      </button>

      {mounted && open && menuPosition && createPortal(
        <div
          ref={menuRef}
          role="listbox"
          className="mb-filter-pill-menu"
          style={{
            position: "fixed",
            // Si flipped, on ancre par le bas du menu juste au-dessus du
            // bouton (transform translateY(-100%) via "bottom" anchor).
            ...(menuPosition.flipped
              ? { bottom: window.innerHeight - menuPosition.top }
              : { top: menuPosition.top }),
            left: menuPosition.left,
            width: menuPosition.width || undefined,
            minWidth: Math.max(180, menuPosition.width),
            ["--mb-filter-accent" as string]: accent,
          } as React.CSSProperties}
        >
          {options.map((option) => {
            const isSelected = option.value === value;
            return (
              <button
                key={option.value}
                type="button"
                role="option"
                aria-selected={isSelected}
                onClick={() => handleSelect(option.value)}
                className="mb-filter-pill-item"
                data-selected={isSelected ? "true" : undefined}
              >
                <span className="mb-filter-pill-item-dot" aria-hidden>
                  {option.dot ? (
                    <span
                      style={{
                        width: 8,
                        height: 8,
                        borderRadius: "50%",
                        background: option.dot,
                      }}
                    />
                  ) : null}
                </span>
                <span className="mb-filter-pill-item-text">
                  <span className="mb-filter-pill-item-label">{option.label}</span>
                  {option.description && (
                    <span className="mb-filter-pill-item-description">{option.description}</span>
                  )}
                </span>
                {isSelected && (
                  <svg width="12" height="12" viewBox="0 0 16 16" fill="none" aria-hidden>
                    <path
                      d="m3 8.4 3.2 3.2L13 5"
                      stroke="currentColor"
                      strokeWidth="1.85"
                      strokeLinecap="round"
                      strokeLinejoin="round"
                    />
                  </svg>
                )}
              </button>
            );
          })}
        </div>,
        document.body,
      )}
    </>
  );
}

// ─── Filter group : conteneur visuel pour aligner plusieurs FilterPill ──────

interface FilterPillGroupProps {
  children: ReactNode;
  /** Slot droit pour des actions secondaires (chips toggle, séparateur, etc.) */
  trailing?: ReactNode;
}

export function FilterPillGroup({ children, trailing }: FilterPillGroupProps) {
  return (
    <div className="mb-filter-pill-group">
      <div className="flex flex-wrap items-center gap-1.5">{children}</div>
      {trailing && (
        <>
          <span className="mb-filter-pill-divider" aria-hidden />
          <div className="flex flex-wrap items-center gap-1.5">{trailing}</div>
        </>
      )}
    </div>
  );
}

// ─── Toggle chip : pour les filtres on/off (Bloqués, En retard…) ────────────

interface FilterToggleChipProps {
  label: string;
  active: boolean;
  onToggle: () => void;
  accentColor?: string;
  /** Pastille colorée optionnelle à gauche du label (uniquement visible quand inactif). */
  dot?: string;
}

export function FilterToggleChip({ label, active, onToggle, accentColor, dot }: FilterToggleChipProps) {
  const accent = accentColor ?? "var(--mb-mauve)";
  return (
    <button
      type="button"
      onClick={onToggle}
      aria-pressed={active}
      className="mb-filter-toggle-chip"
      data-active={active ? "true" : undefined}
      style={{ ["--mb-filter-accent" as string]: accent } as React.CSSProperties}
    >
      {dot && !active && (
        <span
          aria-hidden
          style={{ width: 6, height: 6, borderRadius: "50%", background: dot }}
        />
      )}
      <span>{label}</span>
    </button>
  );
}
