"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { surface, text } from "@/lib/design-tokens";

interface NotificationItem {
  id: string;
  type: "message" | "mention" | "task" | "file";
  title: string;
  context: string;
  href: string;
  createdAt: string;
}

const SEEN_KEY = "mb-notif-seen";

// Cloche de notifications collaboratives (barre du haut). Agrège l'activité des
// autres via /api/notifications ; le compteur « non lu » se base sur la
// dernière ouverture (mémorisée sur l'appareil).
export function NotificationBell() {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [items, setItems] = useState<NotificationItem[]>([]);
  const [seenAt, setSeenAt] = useState<number>(0);
  const [mounted, setMounted] = useState(false);
  const ref = useRef<HTMLDivElement>(null);

  const refresh = useCallback(async () => {
    try {
      const res = await fetch("/api/notifications", { cache: "no-store" });
      const data = await res.json();
      setItems(Array.isArray(data.items) ? data.items : []);
    } catch {
      /* réseau indisponible : on garde la liste précédente */
    }
  }, []);

  useEffect(() => {
    setMounted(true);
    try {
      setSeenAt(Number(window.localStorage.getItem(SEEN_KEY) ?? 0));
    } catch {
      /* ignore */
    }
    refresh();
    // Rafraîchissement périodique léger (pas de websocket dans ce prototype).
    const id = window.setInterval(refresh, 60000);
    return () => window.clearInterval(id);
  }, [refresh]);

  // Fermer au clic extérieur.
  useEffect(() => {
    if (!open) return;
    function handle(event: MouseEvent) {
      if (ref.current && !ref.current.contains(event.target as Node)) setOpen(false);
    }
    document.addEventListener("mousedown", handle);
    return () => document.removeEventListener("mousedown", handle);
  }, [open]);

  const unread = mounted
    ? items.filter((item) => new Date(item.createdAt).getTime() > seenAt).length
    : 0;

  function toggle() {
    const next = !open;
    setOpen(next);
    if (next) {
      // À l'ouverture, on marque tout comme lu.
      refresh();
      const now = Date.now();
      setSeenAt(now);
      try {
        window.localStorage.setItem(SEEN_KEY, String(now));
      } catch {
        /* ignore */
      }
    }
  }

  function openItem(item: NotificationItem) {
    setOpen(false);
    router.push(item.href);
  }

  return (
    <div ref={ref} style={{ position: "relative" }}>
      <button
        type="button"
        onClick={toggle}
        aria-label="Notifications"
        title="Notifications"
        className="relative inline-flex h-9 w-9 shrink-0 items-center justify-center rounded-full"
        style={{ background: surface.s2, border: `1px solid ${surface.borderSubtle}`, cursor: "pointer", color: text.secondary }}
      >
        <svg width="16" height="16" viewBox="0 0 20 20" fill="none" aria-hidden>
          <path
            d="M10 2.5a4.5 4.5 0 0 0-4.5 4.5c0 3.2-1 4.6-1.6 5.3-.3.3-.1.9.4.9h11.4c.5 0 .7-.6.4-.9-.6-.7-1.6-2.1-1.6-5.3A4.5 4.5 0 0 0 10 2.5Z"
            stroke="currentColor"
            strokeWidth="1.5"
            strokeLinejoin="round"
          />
          <path d="M8.4 16.5a1.8 1.8 0 0 0 3.2 0" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" />
        </svg>
        {unread > 0 && (
          <span
            aria-hidden
            style={{
              position: "absolute",
              top: -3,
              right: -3,
              minWidth: 16,
              height: 16,
              padding: "0 4px",
              borderRadius: 999,
              background: "var(--mb-status-red-text)",
              color: "#FFFFFF",
              fontSize: 9.5,
              fontWeight: 700,
              lineHeight: "16px",
              textAlign: "center",
              border: `2px solid ${surface.s1}`,
            }}
          >
            {unread > 9 ? "9+" : unread}
          </span>
        )}
      </button>

      {open && (
        <div
          role="dialog"
          aria-label="Notifications"
          style={{
            position: "absolute",
            top: "calc(100% + 8px)",
            right: 0,
            zIndex: 200,
            width: "min(340px, calc(100vw - 24px))",
            maxHeight: "min(60vh, 460px)",
            overflowY: "auto",
            background: surface.s1,
            border: `1px solid ${surface.border}`,
            borderRadius: 16,
            boxShadow: "var(--mb-shadow-lg)",
            padding: 8,
          }}
        >
          <p className="px-2 py-1.5 text-[11px] font-semibold uppercase tracking-[0.14em]" style={{ color: text.muted }}>
            Notifications
          </p>
          {items.length === 0 ? (
            <p className="px-2 py-6 text-center text-[12.5px]" style={{ color: text.muted }}>
              Rien de nouveau côté collaboration.
            </p>
          ) : (
            <div className="flex flex-col gap-1">
              {items.map((item) => (
                <button
                  key={item.id}
                  type="button"
                  onClick={() => openItem(item)}
                  className="flex w-full items-start gap-2.5 rounded-xl px-2 py-2 text-left"
                  style={{ background: "transparent", border: "none", cursor: "pointer" }}
                >
                  <NotificationIcon type={item.type} />
                  <span className="flex min-w-0 flex-1 flex-col">
                    <span className="line-clamp-2 text-[12.5px] font-medium" style={{ color: text.primary }}>
                      {item.title}
                    </span>
                    <span className="truncate text-[10.5px]" style={{ color: text.muted }}>
                      {item.context} · {formatRelative(item.createdAt)}
                    </span>
                  </span>
                </button>
              ))}
            </div>
          )}
        </div>
      )}
    </div>
  );
}

function NotificationIcon({ type }: { type: NotificationItem["type"] }) {
  const palette: Record<NotificationItem["type"], { bg: string; color: string }> = {
    message: { bg: "var(--mb-status-blue-bg)", color: "var(--mb-status-blue-text)" },
    mention: { bg: "var(--mb-personal-accent-bg)", color: "var(--mb-personal-accent)" },
    task: { bg: "var(--mb-status-green-bg)", color: "var(--mb-status-green-text)" },
    file: { bg: surface.s2, color: text.secondary },
  };
  const { bg, color } = palette[type];
  return (
    <span
      aria-hidden
      className="mt-0.5 inline-flex h-7 w-7 shrink-0 items-center justify-center rounded-lg text-[12px] font-bold"
      style={{ background: bg, color }}
    >
      {type === "message" && "💬"}
      {type === "mention" && "@"}
      {type === "task" && "✓"}
      {type === "file" && "📎"}
    </span>
  );
}

function formatRelative(value: string): string {
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "";
  const diff = Date.now() - date.getTime();
  const minutes = Math.floor(diff / 60000);
  if (minutes < 1) return "à l'instant";
  if (minutes < 60) return `il y a ${minutes} min`;
  const hours = Math.floor(minutes / 60);
  if (hours < 24) return `il y a ${hours} h`;
  const days = Math.floor(hours / 24);
  return `il y a ${days} j`;
}
