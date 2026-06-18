// État vide homogène (carte centrée : icône optionnelle + titre + indice +
// action optionnelle). Unifie les états vides du Kanban, du Calendrier et des
// tâches, qui étaient jusque-là divergents.

import type { ReactNode } from "react";
import { surface, text } from "@/lib/design-tokens";

export function EmptyState({
  title,
  hint,
  icon,
  action,
}: {
  title: string;
  hint?: string;
  icon?: ReactNode;
  action?: ReactNode;
}) {
  return (
    <section
      className="mb-soft-shadow flex flex-col items-center justify-center gap-2 rounded-[22px] px-6 py-12 text-center"
      style={{ background: surface.s1, border: `1px solid ${surface.borderSubtle}` }}
    >
      {icon ? (
        <div
          aria-hidden
          className="mb-1 flex h-11 w-11 items-center justify-center rounded-full"
          style={{ background: surface.s2, color: text.muted }}
        >
          {icon}
        </div>
      ) : null}
      <p className="text-sm font-semibold" style={{ color: text.primary }}>
        {title}
      </p>
      {hint ? (
        <p className="max-w-sm text-xs leading-relaxed" style={{ color: text.muted }}>
          {hint}
        </p>
      ) : null}
      {action ? <div className="mt-2">{action}</div> : null}
    </section>
  );
}
