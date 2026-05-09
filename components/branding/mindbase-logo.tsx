import { cx, decorativeStyles, textStyles } from "@/components/ui/theme";

type MindbaseLogoProps = {
  className?: string;
  compact?: boolean;
  showTagline?: boolean;
};

export function MindbaseLogo({
  className,
  compact = false,
  showTagline = false,
}: MindbaseLogoProps) {
  return (
    <div
      className={cx(
        "flex items-center gap-4",
        compact ? "justify-start" : "justify-center",
        className
      )}
    >
      <svg
        viewBox="0 0 172 172"
        aria-hidden="true"
        className={compact ? "h-14 w-14 shrink-0" : "h-20 w-20 shrink-0"}
      >
        <defs>
          <linearGradient id="mindbase-gradient" x1="18" y1="18" x2="154" y2="154">
            <stop offset="0%" stopColor="#A855F7" />
            <stop offset="100%" stopColor="#59A8FF" />
          </linearGradient>
        </defs>

        <g
          fill="none"
          stroke="url(#mindbase-gradient)"
          strokeWidth="10"
          strokeLinecap="round"
          strokeLinejoin="round"
        >
          <path d="M76 23c-21 0-38 17-38 38c-14 2-25 14-25 29c0 10 4 19 10 25c-7 7-10 16-10 27c0 20 16 36 36 36c2 18 17 32 35 32" />
          <path d="M76 23v133" />
          <path d="M55 50c-9 4-15 14-15 24c0 15 11 27 25 27c7 0 13-2 18-6" />
          <path d="M44 111c0 16 12 29 28 29c6 0 12-2 17-6" />
          <path d="M58 68c7 0 13 6 13 13" />
          <path d="M56 126c0 9 7 16 16 16" />
        </g>

        <path
          fill="url(#mindbase-gradient)"
          d="M103 34c4-2 10-2 14 0l38 23c8 5 8 17 0 22l-38 23c-9 6-21-1-21-12V46c0-11 12-18 21-12Z"
        />
        <rect
          x="96"
          y="108"
          width="61"
          height="16"
          rx="8"
          fill="url(#mindbase-gradient)"
        />
        <rect
          x="96"
          y="133"
          width="61"
          height="16"
          rx="8"
          fill="url(#mindbase-gradient)"
        />
      </svg>

      <div className="min-w-0">
        <div
          className={cx(
            "leading-none font-semibold tracking-tight",
            compact ? "text-[2rem]" : "text-[3.2rem]"
          )}
        >
          <span className="text-white">Mind</span>
          <span style={decorativeStyles.gradientText}>base</span>
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
