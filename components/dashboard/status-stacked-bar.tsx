// Anneau (donut) pour la répartition des tâches par statut.
// Chaque arc est légèrement séparé du suivant par un petit espace (gap)
// pour une lecture nette sans bord franc entre les couleurs.

import type { TaskStatus } from "@/lib/mock-data";
import { surface, text } from "@/lib/design-tokens";

type Translate = (key: string, vars?: Record<string, string | number>) => string;

const STATUS_ORDER: TaskStatus[] = ["todo", "in_progress", "waiting", "blocked", "done"];

// Libellés (pluriel) alignés sur les filtres Kanban/Calendrier.
const STATUS_LABEL_KEY: Record<TaskStatus, string> = {
  todo: "filter.taskStatus.todo",
  in_progress: "filter.taskStatus.inProgress",
  waiting: "filter.taskStatus.waiting",
  blocked: "filter.taskStatus.blocked",
  done: "filter.taskStatus.done",
};

// Aligné avec TASK_STATUS_DEFAULT_COLORS (app/dashboard/projects/actions.ts).
// Les couleurs sont les mêmes que celles des dots/badges sur les tâches.
const STATUS_COLOR: Record<TaskStatus, string> = {
  todo: "#64748B",        // slate-500 (À faire)
  in_progress: "#F59E0B", // amber-500 (En cours)
  waiting: "#3B82F6",     // blue-500 (En attente)
  blocked: "#EF4444",     // red-500 (Bloquées)
  done: "#22C55E",        // green-500 (Terminées)
};

interface StatusStackedBarProps {
  breakdown: Record<TaskStatus, number>;
  t: Translate;
}

// L'anneau utilise un viewBox fixe (100×100) et un width 100% pour s'adapter
// dynamiquement à la largeur disponible dans la carte. Les dimensions ci-dessous
// sont donc des unités viewBox, pas des pixels absolus.
const SIZE = 100;
const STROKE = 18;
const RADIUS = (SIZE - STROKE) / 2;
const CIRCUMFERENCE = 2 * Math.PI * RADIUS;
// Espace (en degrés) entre deux arcs de couleur — converti en longueur sur le cercle.
const GAP_DEG = 3;
const GAP_LENGTH = (GAP_DEG / 360) * CIRCUMFERENCE;
// Seuil minimum (en fraction du cercle) pour afficher un nombre sur un arc.
// En dessous, l'arc est trop petit pour lire confortablement le label.
const MIN_LABEL_FRACTION = 0.06;
export function StatusStackedBar({ breakdown, t }: StatusStackedBarProps) {
  const total = STATUS_ORDER.reduce((sum, status) => sum + (breakdown[status] ?? 0), 0);

  if (total === 0) {
    return (
      <p className="text-xs" style={{ color: text.muted }}>
        {t("dashboard.donut.empty")}
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

  // Pré-calcul des arcs colorés et des labels numériques au centre
  // de chaque arc. Système d'angles : 0 = sommet (12 h), sens horaire.
  const arcs: React.ReactNode[] = [];
  const labels: React.ReactNode[] = [];
  let cumOffset = initialOffset;
  let cumFraction = 0;
  for (const { status, count } of segments) {
    const fraction = count / total;
    const length = Math.max(0, fraction * CIRCUMFERENCE - effectiveGap);
    arcs.push(
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
        strokeDashoffset={-cumOffset}
      >
        <title>{`${t(STATUS_LABEL_KEY[status])} · ${count}`}</title>
      </circle>
    );
    if (fraction >= MIN_LABEL_FRACTION) {
      const midFraction = cumFraction + fraction / 2;
      const midAngle = midFraction * 2 * Math.PI;
      const lx = SIZE / 2 + RADIUS * Math.sin(midAngle);
      const ly = SIZE / 2 - RADIUS * Math.cos(midAngle);
      labels.push(
        <text
          key={`label-${status}`}
          x={lx}
          y={ly}
          textAnchor="middle"
          dominantBaseline="central"
          style={{
            fill: "#FFFFFF",
            fontSize: STROKE * 0.55,
            fontWeight: 700,
            fontVariantNumeric: "tabular-nums",
            pointerEvents: "none",
          }}
        >
          {count}
        </text>
      );
    }
    cumOffset += fraction * CIRCUMFERENCE;
    cumFraction += fraction;
  }

  return (
    <div
      className="flex h-full w-full flex-col items-center justify-center gap-5"
      style={{ paddingBlock: 8, paddingInline: 12 }}
    >
      {/* Le donut prend une bonne partie de la largeur disponible mais on
          laisse de la respiration autour pour que ça reste équilibré dans
          la carte. container-type permet aux unités cqi/cqw de fonctionner
          sur les éléments enfants. */}
      <div
        className="relative"
        style={{
          width: "min(78%, 280px)",
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
          aria-label={t("dashboard.card.distribution")}
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
          {arcs}
          {/* Labels au-dessus des arcs pour rester lisibles. */}
          {labels}
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
            {t(total > 1 ? "dashboard.taskUnitOther" : "dashboard.taskUnitOne")}
          </span>
        </div>
      </div>

      {/* Légende compacte sous le donut : couleur + nom du statut.
          Les chiffres sont déjà affichés directement sur les arcs, plus
          la peine de les dupliquer en bas. */}
      <ul className="flex w-full flex-wrap items-center justify-center gap-x-4 gap-y-1.5">
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
              <span style={{ fontWeight: 600 }}>{t(STATUS_LABEL_KEY[status])}</span>
            </li>
          );
        })}
      </ul>
    </div>
  );
}
