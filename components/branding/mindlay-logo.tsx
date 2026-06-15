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
        viewBox="0 0 64 64"
        fill="none"
        aria-hidden="true"
        className={compact ? "h-14 w-14 shrink-0" : "h-20 w-20 shrink-0"}
        strokeLinecap="round"
        strokeLinejoin="round"
      >
        <defs>
          <linearGradient id="mindlay-gradient" x1="7" y1="11" x2="57" y2="53">
            <stop offset="0%" stopColor="#A855F7" />
            <stop offset="100%" stopColor="#59A8FF" />
          </linearGradient>
        </defs>

        <g stroke="url(#mindlay-gradient)" strokeWidth="3.4">
          {/* Cadre arrondi */}
          <rect x="7" y="11" width="50" height="42" rx="9" />
          {/* Cerveau en boucles : trois lobes qui se chevauchent */}
          <circle cx="24" cy="31" r="7.2" />
          <circle cx="40" cy="31" r="7.2" />
          <circle cx="32" cy="26.5" r="6.4" />
          {/* Tronc qui descend vers le bas du cadre */}
          <path d="M32 38.5 L32 45 Q32 47 34 47 L41 47" />
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
