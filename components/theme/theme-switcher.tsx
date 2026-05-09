"use client";

import { surface, text } from "@/lib/design-tokens";
import { useTheme, type ThemeMode } from "@/components/theme/theme-provider";

const themeOptions: Array<{ mode: ThemeMode; label: string; title: string }> = [
  { mode: "system", label: "Auto", title: "Suivre le thème du système" },
  { mode: "dark", label: "Sombre", title: "Forcer le thème sombre" },
  { mode: "light", label: "Clair", title: "Forcer le thème clair" },
];

export function ThemeSwitcher() {
  const { mode, resolvedTheme, setMode } = useTheme();

  return (
    <div
      className="flex items-center gap-1 rounded-full p-1"
      style={{ background: surface.s3, border: `1px solid ${surface.borderHover}` }}
      title={`Thème actuel : ${mode === "system" ? `auto (${resolvedTheme})` : mode}`}
    >
      {themeOptions.map((option) => {
        const selected = mode === option.mode;

        return (
          <button
            key={option.mode}
            type="button"
            onClick={() => setMode(option.mode)}
            className="rounded-full px-2.5 py-1 text-[11px] font-semibold transition-colors"
            style={{
              background: selected ? surface.s1 : surface.s3,
              color: selected ? text.primary : text.muted,
              border: `1px solid ${selected ? surface.borderHover : surface.s3}`,
            }}
            aria-pressed={selected}
            title={option.title}
          >
            {option.label}
          </button>
        );
      })}
    </div>
  );
}
