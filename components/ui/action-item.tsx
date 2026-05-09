"use client";

import { useState } from "react";
import type { Action } from "@/lib/mock-data";
import { surface, text, error, statusColor } from "@/lib/design-tokens";
import { getVisibleTaskOwner } from "@/lib/task-people";

interface ActionItemProps {
  action: Action;
  accentColor: string;
}

export function ActionItem({ action, accentColor }: ActionItemProps) {
  const [done, setDone] = useState(action.done);
  const visibleOwner = getVisibleTaskOwner(action.owner);

  return (
    <div
      className="mb-card-premium mb-card-subtle mb-card-hover flex items-center gap-3 py-2.5 px-3 rounded-lg cursor-pointer"
      style={{
        background: action.blocked && !done ? error.bg : surface.s2,
        border: `1px solid ${action.blocked && !done ? error.border : surface.border}`,
      }}
      onClick={() => setDone((d) => !d)}
    >
      {/* Checkbox */}
      <div
        className="w-4 h-4 rounded flex items-center justify-center shrink-0 transition-all"
        style={{
          border: done ? "none" : `1.5px solid ${surface.borderHover}`,
          background: done ? accentColor : "transparent",
        }}
      >
        {done && (
          <svg width="10" height="10" viewBox="0 0 12 12" fill="none">
            <path
              d="M2 6l3 3 5-5"
              stroke="white"
              strokeWidth="1.5"
              strokeLinecap="round"
              strokeLinejoin="round"
            />
          </svg>
        )}
      </div>

      {/* Title */}
      <span
        className="flex-1 text-sm select-none"
        style={{
          color: done ? text.dim : text.secondary,
          textDecoration: done ? "line-through" : "none",
        }}
      >
        {action.title}
      </span>

      {action.priority === "high" && !done && (
        <span
          className="text-[10px] px-1.5 py-0.5 rounded font-medium shrink-0"
          style={{
            background: statusColor.yellow.bg,
            color: statusColor.yellow.text,
            border: `1px solid ${statusColor.yellow.text}`,
          }}
        >
          priorité
        </span>
      )}

      {action.blocked && !done && (
        <span
          className="text-[11px] px-1.5 py-0.5 rounded font-medium shrink-0"
          style={{ background: error.bg, color: error.text, border: `1px solid ${error.border}` }}
        >
          bloqué
        </span>
      )}

      {visibleOwner && (
        <span className="text-xs shrink-0" style={{ color: text.dim }}>
          {visibleOwner}
        </span>
      )}
      <span className="text-xs shrink-0 tabular-nums" style={{ color: text.ghost }}>
        {action.due.slice(0, 10)}
      </span>
    </div>
  );
}
