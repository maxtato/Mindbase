"use client";

import { surface, text } from "@/lib/design-tokens";
import { COMMAND_OPEN_EVENT } from "@/components/search/command-palette";

// Bouton loupe dans la topbar → ouvre la palette de recherche (⌘K).
export function CommandTrigger() {
  return (
    <button
      type="button"
      aria-label="Rechercher (⌘K)"
      title="Rechercher  ⌘K"
      onClick={() => window.dispatchEvent(new CustomEvent(COMMAND_OPEN_EVENT))}
      className="inline-flex h-9 w-9 shrink-0 items-center justify-center rounded-full"
      style={{ background: surface.s2, border: `1px solid ${surface.borderSubtle}`, cursor: "pointer", color: text.secondary }}
    >
      <svg width="16" height="16" viewBox="0 0 20 20" fill="none" aria-hidden>
        <circle cx="9" cy="9" r="6" stroke="currentColor" strokeWidth="1.7" />
        <path d="m17 17-3.2-3.2" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" />
      </svg>
    </button>
  );
}
