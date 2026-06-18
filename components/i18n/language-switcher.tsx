"use client";

import { LOCALES, LOCALE_LABELS } from "@/lib/i18n/config";
import { useLocale, useSetLocale } from "@/components/i18n/locale-provider";
import { surface, text } from "@/lib/design-tokens";

// Sélecteur FR / EN. Le choix est mémorisé (cookie) et applique la langue à
// toute l'app (interface + futurs textes serveur) via un rafraîchissement.
export function LanguageSwitcher() {
  const locale = useLocale();
  const setLocale = useSetLocale();

  return (
    <div
      className="inline-flex items-center gap-1 rounded-xl p-1"
      style={{ background: surface.s2, border: `1px solid ${surface.borderSubtle}` }}
    >
      {LOCALES.map((loc) => {
        const active = loc === locale;
        return (
          <button
            key={loc}
            type="button"
            onClick={() => setLocale(loc)}
            className="rounded-lg px-3 py-1.5 text-xs font-semibold"
            style={{
              background: active ? surface.s1 : "transparent",
              color: active ? text.primary : text.muted,
              border: active ? `1px solid ${surface.border}` : "1px solid transparent",
              cursor: "pointer",
            }}
            aria-pressed={active}
          >
            {LOCALE_LABELS[loc]}
          </button>
        );
      })}
    </div>
  );
}
