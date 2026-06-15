import { cx, decorativeStyles, textStyles } from "@/components/ui/theme";
import { FlatmindLogoMark } from "@/components/branding/flatmind-logo-mark";

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
      {/* Logo Flatmind (image fournie) — suit la couleur du texte (blanc en sombre). */}
      <FlatmindLogoMark height={compact ? 52 : 72} style={{ color: "var(--mb-text-primary)" }} />

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
