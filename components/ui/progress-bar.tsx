import { surface, text } from "@/lib/design-tokens";

interface ProgressBarProps {
  value: number; // 0-100
  color: string;
  height?: number;
  showLabel?: boolean;
  trackColor?: string;
  borderColor?: string;
}

export function ProgressBar({
  value,
  color,
  height = 4,
  showLabel = false,
  trackColor = surface.s2,
  borderColor = surface.border,
}: ProgressBarProps) {
  const safeValue = Math.min(100, Math.max(0, value));

  return (
    <div className="flex items-center gap-3 w-full">
      <div
        className="flex-1 rounded-full overflow-hidden"
        style={{ height, background: trackColor, border: `1px solid ${borderColor}` }}
        aria-valuemin={0}
        aria-valuemax={100}
        aria-valuenow={safeValue}
        role="progressbar"
      >
        <div
          className="h-full rounded-full transition-all duration-300"
          style={{ width: `${safeValue}%`, background: color }}
        />
      </div>
      {showLabel && (
        <span className="text-xs tabular-nums shrink-0" style={{ color: text.muted }}>
          {value}%
        </span>
      )}
    </div>
  );
}
