import { cx, decorativeStyles, textStyles } from "@/components/ui/theme";

type FlatmindLogoProps = {
  className?: string;
  compact?: boolean;
  showTagline?: boolean;
};

export function FlatmindLogo({
  className,
  compact = false,
  showTagline = false,
}: FlatmindLogoProps) {
  return (
    <div
      className={cx(
        "flex items-center gap-4",
        compact ? "justify-start" : "justify-center",
        className
      )}
    >
      {/* Logo Flatmind : cerveau en boucles dans un cadre arrondi, en dégradé. */}
      <svg
        viewBox="0 0 120 120"
        fill="none"
        aria-hidden="true"
        className={compact ? "h-14 w-14 shrink-0" : "h-20 w-20 shrink-0"}
        strokeLinecap="round"
        strokeLinejoin="round"
      >
        <defs>
          <linearGradient id="mindlay-gradient" x1="20" y1="30" x2="100" y2="84">
            <stop offset="0%" stopColor="#A855F7" />
            <stop offset="100%" stopColor="#59A8FF" />
          </linearGradient>
        </defs>

        <g stroke="url(#mindlay-gradient)" strokeWidth="6.5">
          {/* Cadre arrondi paysage + tronc */}
          <path d="M50 84 L33 84 Q20 84 20 71 L20 43 Q20 30 33 30 L87 30 Q100 30 100 43 L100 71 Q100 84 87 84 L66 84 Q60 84 60 78 L60 66" />
          {/* Silhouette du cerveau */}
          <path d="M60 66 L43 66 Q32 65 32 53 Q32 37 45 36 Q54 35 57 44 Q60 35 69 36 Q82 37 82 53 Q82 65 71 66 Z" />
          {/* Boucles internes */}
          <ellipse cx="57" cy="49" rx="4.6" ry="7" />
          <ellipse cx="45" cy="54" rx="8" ry="5" transform="rotate(-18 45 54)" />
          <ellipse cx="69" cy="54" rx="8" ry="5" transform="rotate(18 69 54)" />
        </g>
      </svg>

      <div className="min-w-0">
        <div
          className={cx(
            "leading-none font-semibold tracking-tight",
            compact ? "text-[2rem]" : "text-[3.2rem]"
          )}
        >
          <span className="mb-wordmark-mind" style={{ ...textStyles.strong, fontWeight: 700 }}>Flat</span>
          <span className="mb-script" style={{ ...textStyles.strong, fontSize: "1.2em" }}>
            mind
          </span>
        </div>

        {showTagline ? (
          <div className="mt-3">
            <div
              className="h-[3px] w-28 rounded-full"
              style={decorativeStyles.gradientRule}
            />
            <p
              className="mt-3 text-[11px] uppercase tracking-[0.45em]"
              style={textStyles.soft}
            >
              Think. Structure. Create.
            </p>
          </div>
        ) : null}
      </div>
    </div>
  );
}
