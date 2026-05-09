// Anneau (donut) pour la répartition des tâches par statut.
// Chaque arc est légèrement séparé du suivant par un petit espace (gap)
// pour une lecture nette sans bord franc entre les couleurs.

import type { TaskStatus } from "@/lib/mock-data";
import { surface, text } from "@/lib/design-tokens";

const STATUS_ORDER: TaskStatus[] = ["todo", "in_progress", "waiting", "blocked", "done"];

const STATUS_LABELS: Record<TaskStatus, string> = {
  todo: "À faire",
  in_progress: "En cours",
  waiting: "En attente",
  blocked: "Bloquées",
  done: "Terminées",
};

const STATUS_COLOR: Record<TaskStatus, string> = {
  todo: "var(--mb-status-gray-text)",
  in_progress: "var(--mb-status-blue-text)",
  waiting: "var(--mb-status-yellow-text)",
  blocked: "var(--mb-status-red-text)",
  done: "var(--mb-status-green-text)",
};

interface StatusStackedBarProps {
  breakdown: Record<TaskStatus, number>;
}

// L'anneau utilise un viewBox fixe (100×100) et un width 100% pour s'adapter
// dynamiquement à la largeur disponible dans la carte. Les dimensions ci-dessous
// sont donc des unités viewBox, pas des pixels absolus.
const SIZE = 100;
const STROKE = 11;
const RADIUS = (SIZE - STROKE) / 2;
const CIRCUMFERENCE = 2 * Math.PI * RADIUS;
// Espace (en degrés) entre deux arcs de couleur — converti en longueur sur le cercle.
const GAP_DEG = 4;
const GAP_LENGTH = (GAP_DEG / 360) * CIRCUMFERENCE;
// Tailles min/max du donut en pixels pour rester lisible sur tous les
// formats de carte sans déborder.
const DONUT_MIN_PX = 96;
const DONUT_MAX_PX = 168;

export function StatusStackedBar({ breakdown }: StatusStackedBarProps) {
  const total = STATUS_ORDER.reduce((sum, status) => sum + (breakdown[status] ?? 0), 0);

  if (total === 0) {
    return (
      <p className="text-xs" style={{ color: text.muted }}>
        Aucune tâche structurée pour le moment.
      </p>
    );
  }

  // Construit la liste des arcs visibles (statuts avec count > 0).
  const segments = STATUS_ORDER.filter((status) => (breakdown[status] ?? 0) > 0).map((status) => ({
    status,
    count: breakdown[status] ?? 0,
  }));

  // Si un seul segment a des tâches, on n'applique pas de gap (sinon il
  // y aurait un espace dans un cercle plein, ce qui est laid).
  const effectiveGap = segments.length > 1 ? GAP_LENGTH : 0;

  // Position de départ : on remonte d'un quart de tour pour que le premier
  // arc commence en haut (12 h).
  const initialOffset = -CIRCUMFERENCE / 4;

  return (
    <div className="flex items-center gap-3 sm:gap-4">
      <div
        className="relative shrink-0"
        style={{
          width: "min(100%, var(--donut-max))",
          maxWidth: DONUT_MAX_PX,
          minWidth: DONUT_MIN_PX,
          aspectRatio: "1 / 1",
          ["--donut-max" as string]: `${DONUT_MAX_PX}px`,
          flex: "1 1 auto",
        }}
      >
        <svg
          width="100%"
          height="100%"
          viewBox={`0 0 ${SIZE} ${SIZE}`}
          preserveAspectRatio="xMidYMid meet"
          role="img"
          aria-label="Répartition des tâches par statut"
        >
          {/* Anneau de fond très subtil */}
          <circle
            cx={SIZE / 2}
            cy={SIZE / 2}
            r={RADIUS}
            fill="none"
            stroke={surface.s2}
            strokeWidth={STROKE}
          />
          {segments.reduce<{ circles: React.ReactNode[]; cumOffset: number }>(
            (acc, { status, count }) => {
              const fraction = count / total;
              const length = Math.max(0, fraction * CIRCUMFERENCE - effectiveGap);
              const offset = acc.cumOffset;
              acc.circles.push(
                <circle
                  key={status}
                  cx={SIZE / 2}
                  cy={SIZE / 2}
                  r={RADIUS}
                  fill="none"
                  stroke={STATUS_COLOR[status]}
                  strokeWidth={STROKE}
                  strokeLinecap="butt"
                  strokeDasharray={`${length} ${CIRCUMFERENCE - length}`}
                  strokeDashoffset={-offset}
                  transform={`rotate(0 ${SIZE / 2} ${SIZE / 2})`}
                >
                  <title>{`${STATUS_LABELS[status]} · ${count}`}</title>
                </circle>
              );
              return { circles: acc.circles, cumOffset: acc.cumOffset + fraction * CIRCUMFERENCE };
            },
            { circles: [], cumOffset: initialOffset }
          ).circles}
        </svg>
        {/* Total au centre de l'anneau */}
        <div
          className="absolute inset-0 flex flex-col items-center justify-center"
          style={{ pointerEvents: "none" }}
        >
          <span
            style={{
              fontSize: 18,
              fontWeight: 700,
              color: text.primary,
              fontVariantNumeric: "tabular-nums",
              lineHeight: 1,
            }}
          >
            {total}
          </span>
          <span
            style={{
              marginTop: 2,
              fontSize: 9,
              color: text.muted,
              textTransform: "uppercase",
              letterSpacing: "0.1em",
            }}
          >
            tâche{total > 1 ? "s" : ""}
          </span>
        </div>
      </div>

      <ul className="flex flex-1 flex-col gap-1 min-w-0">
        {STATUS_ORDER.map((status) => {
          const count = breakdown[status] ?? 0;
          const empty = count === 0;
          return (
            <li
              key={status}
              className="flex items-center gap-1.5 text-[10.5px]"
              style={{ color: empty ? text.muted : text.secondary }}
            >
              <span
                aria-hidden
                className="inline-block h-2 w-2 shrink-0 rounded-full"
                style={{ background: STATUS_COLOR[status], opacity: empty ? 0.4 : 1 }}
              />
              <span style={{ flex: 1 }}>{STATUS_LABELS[status]}</span>
              <span
                style={{
                  fontWeight: 600,
                  color: empty ? text.muted : text.primary,
                  fontVariantNumeric: "tabular-nums",
                }}
              >
                {count}
              </span>
            </li>
          );
        })}
      </ul>
    </div>
  );
}
