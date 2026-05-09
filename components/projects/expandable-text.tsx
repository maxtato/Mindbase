"use client";

import { useLayoutEffect, useRef, useState, type CSSProperties } from "react";
import { text } from "@/lib/design-tokens";

interface ExpandableTextProps {
  children: string;
  collapsedLines?: number;
  className?: string;
  style?: CSSProperties;
}

export function ExpandableText({ children, collapsedLines = 3, className, style }: ExpandableTextProps) {
  const ref = useRef<HTMLParagraphElement>(null);
  const [overflows, setOverflows] = useState(false);
  const [expanded, setExpanded] = useState(false);

  useLayoutEffect(() => {
    const node = ref.current;
    if (!node) return;
    const check = () => {
      setOverflows(node.scrollHeight - node.clientHeight > 1);
    };
    check();
    const observer = new ResizeObserver(check);
    observer.observe(node);
    return () => observer.disconnect();
  }, [children, collapsedLines]);

  const clampStyle: CSSProperties = expanded
    ? {}
    : {
        display: "-webkit-box",
        WebkitLineClamp: collapsedLines,
        WebkitBoxOrient: "vertical",
        overflow: "hidden",
      };

  return (
    <div>
      <p ref={ref} className={className} style={{ ...style, ...clampStyle }}>
        {children}
      </p>
      {(overflows || expanded) && (
        <button
          type="button"
          onClick={() => setExpanded((value) => !value)}
          className="mt-1 text-[11px] font-semibold"
          style={{ color: text.muted, background: "transparent", border: "none", padding: 0, cursor: "pointer" }}
        >
          {expanded ? "Voir moins" : "Voir plus"}
        </button>
      )}
    </div>
  );
}
