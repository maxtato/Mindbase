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
    <div className="flex h-full w-full flex-col items-center justify-center gap-4">
      {/* Le donut prend toute la largeur disponible et reste carré.
          On limite à 360px max pour que ça reste élégant sur très grand
          écran sans dominer la carte. container-type permet aux unités
          cqi/cqw de fonctionner sur les éléments enfants. */}
      <div
        className="relative w-full"
        style={{
          maxWidth: 360,
          aspectRatio: "1 / 1",
          containerType: "inline-size",
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
        {/* Total au centre de l'anneau — taille adaptée à la taille
            du donut grâce aux unités relatives au container (cqw). */}
        <div
          className="absolute inset-0 flex flex-col items-center justify-center"
          style={{ pointerEvents: "none" }}
        >
          <span
            style={{
              fontSize: "clamp(28px, 14cqi, 56px)",
              fontWeight: 800,
              color: text.primary,
              fontVariantNumeric: "tabular-nums",
              lineHeight: 1,
              letterSpacing: "-0.02em",
            }}
          >
            {total}
          </span>
          <span
            style={{
              marginTop: 4,
              fontSize: "clamp(10px, 3cqi, 13px)",
              color: text.muted,
              textTransform: "uppercase",
              letterSpacing: "0.14em",
              fontWeight: 600,
            }}
          >
            tâche{total > 1 ? "s" : ""}
          </span>
        </div>
      </div>

      {/* Légende en grille 2 colonnes sous le donut, aérée. */}
      <ul className="grid w-full grid-cols-2 gap-x-4 gap-y-1.5">
        {STATUS_ORDER.map((status) => {
          const count = breakdown[status] ?? 0;
          const empty = count === 0;
          return (
            <li
              key={status}
              className="flex items-center gap-2 text-[11.5px]"
              style={{ color: empty ? text.muted : text.secondary }}
            >
              <span
                aria-hidden
                className="inline-block h-2.5 w-2.5 shrink-0 rounded-full"
                style={{ background: STATUS_COLOR[status], opacity: empty ? 0.4 : 1 }}
              />
              <span className="truncate" style={{ flex: 1 }}>
                {STATUS_LABELS[status]}
              </span>
              <span
                style={{
                  fontWeight: 700,
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
