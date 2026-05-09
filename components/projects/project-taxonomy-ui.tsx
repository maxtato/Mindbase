import type { CSSProperties } from "react";
import type { Project } from "@/lib/mock-data";
import { surface, text } from "@/lib/design-tokens";
import {
  priorityVisuals,
  resolveProjectSubcategoryDisplay,
  type ProjectCategoryIconKey,
  type ProjectPriority,
} from "@/lib/project-taxonomy";

interface CategoryIconProps {
  icon: ProjectCategoryIconKey;
  color?: string;
  size?: number;
}

export function ProjectCategoryIcon({ icon, color = "currentColor", size = 14 }: CategoryIconProps) {
  // Style premium : strokes 1.8 cohérents, line caps arrondis, proportions équilibrées,
  // accents pleins minimaux pour ancrer chaque pictogramme.
  const common = {
    stroke: color,
    strokeWidth: 1.8,
    strokeLinecap: "round" as const,
    strokeLinejoin: "round" as const,
    fill: "none" as const,
    vectorEffect: "non-scaling-stroke" as const,
  };

  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" aria-hidden="true">
      {icon === "target" && (
        <>
          <circle cx="12" cy="12" r="8" {...common} />
          <circle cx="12" cy="12" r="4.5" {...common} />
          <circle cx="12" cy="12" r="1.5" fill={color} />
        </>
      )}
      {icon === "briefcase" && (
        <>
          <rect x="3.5" y="7.5" width="17" height="12" rx="2.4" {...common} />
          <path d="M9 7.5V6.2A1.7 1.7 0 0 1 10.7 4.5h2.6A1.7 1.7 0 0 1 15 6.2V7.5" {...common} />
          <path d="M3.5 12.4h17" {...common} />
          <rect x="10.5" y="11.6" width="3" height="2.5" rx="0.6" fill={color} stroke="none" />
        </>
      )}
      {icon === "megaphone" && (
        <>
          <path d="M5 10.2v3.6a1.4 1.4 0 0 0 1.4 1.4h2.2L13 18.5V5.5l-4.4 3.3H6.4A1.4 1.4 0 0 0 5 10.2Z" {...common} />
          <path d="M16.6 9.2a4 4 0 0 1 0 5.6" {...common} />
          <path d="m9.5 15.6 1 3.4a1 1 0 0 0 1 .7h.6a1 1 0 0 0 .9-1.3l-.7-2.1" {...common} />
        </>
      )}
      {icon === "settings" && (
        <>
          <path d="M4.5 7h15M4.5 12h15M4.5 17h15" {...common} />
          <circle cx="8.5" cy="7" r="1.9" fill={color} stroke="none" />
          <circle cx="15.5" cy="12" r="1.9" fill={color} stroke="none" />
          <circle cx="10.5" cy="17" r="1.9" fill={color} stroke="none" />
        </>
      )}
      {icon === "wallet" && (
        <>
          <path d="M3.5 8.4A2.4 2.4 0 0 1 5.9 6h12A1.1 1.1 0 0 1 19 7.1v1.3" {...common} />
          <rect x="3.5" y="8.4" width="17" height="11.1" rx="2.2" {...common} />
          <path d="M20.5 13.2H17a1.6 1.6 0 0 0 0 3.2h3.5" {...common} />
          <circle cx="17.4" cy="14.8" r="0.9" fill={color} stroke="none" />
        </>
      )}
      {icon === "layers" && (
        <>
          <path d="M12 3.8 3.5 8 12 12.2 20.5 8Z" {...common} />
          <path d="m3.5 12 8.5 4.2L20.5 12" {...common} />
          <path d="m3.5 16 8.5 4.2L20.5 16" {...common} />
        </>
      )}
      {icon === "users" && (
        <>
          <circle cx="9.2" cy="8.3" r="3.2" {...common} />
          <path d="M3.5 19.5a5.7 5.7 0 0 1 11.4 0" {...common} />
          <path d="M16 5.4a2.9 2.9 0 0 1 0 5.6" {...common} />
          <path d="M16.5 14.6a4.5 4.5 0 0 1 4 3.7" {...common} />
        </>
      )}
      {icon === "clipboard" && (
        <>
          <rect x="6" y="5.5" width="12" height="14" rx="2" {...common} />
          <rect x="9" y="3.5" width="6" height="3.5" rx="1.2" {...common} />
          <path d="M9.5 11h5M9.5 14.5h5M9.5 18h3" {...common} />
        </>
      )}
      {icon === "house" && (
        <>
          <path d="m3.5 11 8.5-7.2 8.5 7.2" {...common} />
          <path d="M5.5 9.5v9.4a1 1 0 0 0 1 1H10v-5.4a1 1 0 0 1 1-1h2a1 1 0 0 1 1 1v5.4h3.5a1 1 0 0 0 1-1V9.5" {...common} />
        </>
      )}
      {icon === "heart" && (
        <path d="M12 20.4 4.7 13a4.6 4.6 0 0 1 6.5-6.5l.8.8.8-.8a4.6 4.6 0 1 1 6.5 6.5Z" {...common} />
      )}
      {icon === "spark" && (
        <>
          <path d="M12 3.5v3.8M12 16.7v3.8M3.5 12h3.8M16.7 12h3.8M5.6 5.6l2.7 2.7M15.7 15.7l2.7 2.7M5.6 18.4l2.7-2.7M15.7 8.3l2.7-2.7" {...common} />
          <circle cx="12" cy="12" r="3" fill={color} stroke="none" />
        </>
      )}
      {icon === "car" && (
        <>
          <path d="m4.5 12.5 1.7-4.6A1.5 1.5 0 0 1 7.6 7h8.8a1.5 1.5 0 0 1 1.4 0.9l1.7 4.6" {...common} />
          <path d="M3.5 12.5h17v4.5a1 1 0 0 1-1 1H18v1.5a.5.5 0 0 1-.5.5h-1.5a.5.5 0 0 1-.5-.5v-1.5H8.5v1.5a.5.5 0 0 1-.5.5H6.5a.5.5 0 0 1-.5-.5v-1.5H4.5a1 1 0 0 1-1-1Z" {...common} />
          <circle cx="7.5" cy="14.8" r="1" fill={color} stroke="none" />
          <circle cx="16.5" cy="14.8" r="1" fill={color} stroke="none" />
        </>
      )}
      {icon === "music" && (
        <>
          <path d="M9 16.5V6.2l9-2v10.3" {...common} />
          <path d="M9 9.5 18 7.4" {...common} />
          <ellipse cx="6.6" cy="16.5" rx="2.4" ry="2" {...common} />
          <ellipse cx="15.6" cy="14.5" rx="2.4" ry="2" {...common} />
        </>
      )}
      {icon === "plane" && (
        <>
          <path d="M10.6 2.5 3 12.2l3 1.4 3.5-2.4L11 13l-1.6 4.4 1.5 1.5 2.4-4.7 4.5 2 1-1.4-3.4-3.6 4-6.8a1.4 1.4 0 0 0-2-1.9Z" {...common} />
        </>
      )}
      {icon === "document" && (
        <>
          <path d="M6 3.5h7.5L18.5 8.5v11A1 1 0 0 1 17.5 20.5h-11A1 1 0 0 1 5.5 19.5v-15a1 1 0 0 1 1-1Z" {...common} />
          <path d="M13.5 3.5v4.5a1 1 0 0 0 1 1h4" {...common} />
          <path d="M9 12.5h6M9 15.5h6M9 18.5h3.5" {...common} />
        </>
      )}
      {icon === "gear" && (
        <>
          <path d="m13.6 3.5 0.4 2.2a7 7 0 0 1 1.7 1l2.1-0.7 1.6 2.8-1.7 1.4a7 7 0 0 1 0 2l1.7 1.4-1.6 2.8-2.1-0.7a7 7 0 0 1-1.7 1l-0.4 2.2h-3.2l-0.4-2.2a7 7 0 0 1-1.7-1l-2.1 0.7L4.6 13.6 6.3 12.2a7 7 0 0 1 0-2L4.6 8.8l1.6-2.8 2.1 0.7a7 7 0 0 1 1.7-1l0.4-2.2Z" {...common} />
          <circle cx="12" cy="12" r="2.6" {...common} />
        </>
      )}
      {icon === "palette" && (
        <>
          <path d="M12 3.5a8.5 8.5 0 0 0 0 17c1 0 1.7-0.6 1.9-1.5 0.2-0.7-0.1-1.2-0.1-1.7 0-0.8 0.6-1.4 1.4-1.4h1.5A4 4 0 0 0 20.5 11.7 8 8 0 0 0 12 3.5Z" {...common} />
          <circle cx="8" cy="11" r="1.1" fill={color} stroke="none" />
          <circle cx="11" cy="7.8" r="1.1" fill={color} stroke="none" />
          <circle cx="15.2" cy="8.5" r="1.1" fill={color} stroke="none" />
          <circle cx="17.2" cy="12.4" r="1.1" fill={color} stroke="none" />
        </>
      )}
      {icon === "asterisk" && (
        <>
          <path d="M12 4.5v15M5.7 8 18.3 16M18.3 8 5.7 16" {...common} />
        </>
      )}
    </svg>
  );
}

function badgeStyle(background: string, border: string, color: string, compact: boolean): CSSProperties {
  return {
    display: "inline-flex",
    alignItems: "center",
    gap: compact ? "0.35rem" : "0.45rem",
    minHeight: compact ? 24 : 28,
    padding: compact ? "0.175rem 0.55rem" : "0.25rem 0.65rem",
    borderRadius: "999px",
    background,
    border: `1px solid ${border}`,
    color,
    fontSize: compact ? "0.6875rem" : "0.75rem",
    fontWeight: 600,
  };
}

type ProjectTaxonomySnapshot = Pick<
  Project,
  | "workspace"
  | "subcategory"
  | "subcategoryColor"
  | "isCustomSubcategory"
  | "customSubcategoryLabel"
  | "customSubcategoryColor"
  | "priority"
>;

interface ProjectSubcategoryBadgeProps {
  project: ProjectTaxonomySnapshot;
  compact?: boolean;
}

export function ProjectSubcategoryBadge({ project, compact = false }: ProjectSubcategoryBadgeProps) {
  const display = resolveProjectSubcategoryDisplay(project);

  return (
    <span style={badgeStyle(surface.s2, display.color, text.primary, compact)}>
      <span
        className="inline-flex items-center justify-center rounded-full shrink-0"
        style={{
          width: compact ? 16 : 18,
          height: compact ? 16 : 18,
          background: display.color,
        }}
      >
        <ProjectCategoryIcon icon={display.icon} color="#FFFFFF" size={compact ? 10 : 11} />
      </span>
      <span>{display.label}</span>
    </span>
  );
}

interface ProjectPriorityBadgeProps {
  priority: ProjectPriority;
  compact?: boolean;
}

export function ProjectPriorityBadge({ priority, compact = false }: ProjectPriorityBadgeProps) {
  // Pill sobre : fond gris neutre + dot coloré qui indique la priorité.
  const tone = priorityVisuals[priority];
  return (
    <span
      style={{
        display: "inline-flex",
        alignItems: "center",
        gap: compact ? "0.35rem" : "0.45rem",
        minHeight: compact ? 24 : 28,
        padding: compact ? "0.175rem 0.55rem" : "0.25rem 0.65rem",
        borderRadius: 999,
        background: surface.s2,
        border: `1px solid ${surface.borderSubtle}`,
        color: text.secondary,
        fontSize: compact ? "0.6875rem" : "0.75rem",
        fontWeight: 500,
      }}
    >
      <span
        aria-hidden
        style={{
          width: compact ? 7 : 8,
          height: compact ? 7 : 8,
          borderRadius: "50%",
          background: tone.text,
          flexShrink: 0,
          display: "inline-block",
        }}
      />
      {tone.label}
    </span>
  );
}

interface ProjectMetaRowProps {
  project: ProjectTaxonomySnapshot;
  compact?: boolean;
}

export function ProjectMetaRow({ project, compact = false }: ProjectMetaRowProps) {
  return (
    <div className="flex items-center gap-2 flex-wrap">
      <ProjectSubcategoryBadge project={project} compact={compact} />
      <ProjectPriorityBadge priority={project.priority} compact={compact} />
    </div>
  );
}
