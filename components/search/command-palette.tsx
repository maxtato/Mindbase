"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { useRouter } from "next/navigation";
import { surface, text } from "@/lib/design-tokens";
import { getWorkspace, workspaceTheme } from "@/lib/workspace";
import { WORKSPACE_EVENT } from "@/lib/workspace-client";

export const COMMAND_OPEN_EVENT = "mb:command-open";

interface RemoteResult {
  id: string;
  type: "project" | "task" | "step";
  title: string;
  sublabel: string;
  href: string;
  color: string;
  workspaceLabel: string;
}

interface Item {
  key: string;
  title: string;
  sublabel: string;
  href: string;
  color?: string;
  kind: "nav" | RemoteResult["type"];
}

function normalize(value: string) {
  return value
    .normalize("NFD")
    .replace(new RegExp("[\\u0300-\\u036f]", "g"), "")
    .toLowerCase();
}

export function CommandPalette({ initialWorkspace }: { initialWorkspace: string }) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState("");
  const [results, setResults] = useState<RemoteResult[]>([]);
  const [loading, setLoading] = useState(false);
  const [active, setActive] = useState(0);
  const [workspace, setWorkspace] = useState(initialWorkspace);
  const inputRef = useRef<HTMLInputElement>(null);
  const listRef = useRef<HTMLDivElement>(null);

  // Suit le workspace courant (pour les liens de navigation rapide), sans
  // useSearchParams — même approche que la sidebar.
  useEffect(() => {
    const update = () => {
      const value = new URLSearchParams(window.location.search).get("workspace");
      if (value) setWorkspace(value);
    };
    const onWorkspace = (event: Event) => {
      const detail = (event as CustomEvent<string>).detail;
      if (detail) setWorkspace(detail);
    };
    update();
    window.addEventListener("popstate", update);
    window.addEventListener(WORKSPACE_EVENT, onWorkspace);
    return () => {
      window.removeEventListener("popstate", update);
      window.removeEventListener(WORKSPACE_EVENT, onWorkspace);
    };
  }, []);

  const ws = getWorkspace(workspace);
  const accent = workspaceTheme[ws].accent;
  const qs = `workspace=${ws}`;

  const navItems = useMemo<Item[]>(
    () => [
      { key: "nav-dashboard", title: "Tableau de bord", sublabel: "Aller à", href: `/dashboard?${qs}`, kind: "nav" },
      { key: "nav-projects", title: "Projets", sublabel: "Aller à", href: `/dashboard/projects?${qs}`, kind: "nav" },
      { key: "nav-kanban", title: "Kanban", sublabel: "Aller à", href: `/dashboard/kanban?${qs}`, kind: "nav" },
      { key: "nav-calendar", title: "Calendrier", sublabel: "Aller à", href: `/dashboard/calendar?${qs}`, kind: "nav" },
      { key: "nav-settings", title: "Paramètres", sublabel: "Aller à", href: `/dashboard/settings?${qs}`, kind: "nav" },
      { key: "nav-new", title: "Créer un projet", sublabel: "Action", href: `/dashboard/projects/new?${qs}`, kind: "nav" },
    ],
    [qs],
  );

  const close = useCallback(() => {
    setOpen(false);
    setQuery("");
    setResults([]);
    setActive(0);
  }, []);

  // Raccourci global ⌘K / Ctrl+K + évènement d'ouverture (bouton topbar).
  useEffect(() => {
    const onKey = (event: KeyboardEvent) => {
      if ((event.metaKey || event.ctrlKey) && event.key.toLowerCase() === "k") {
        event.preventDefault();
        setOpen((prev) => !prev);
      }
    };
    const onOpen = () => setOpen(true);
    window.addEventListener("keydown", onKey);
    window.addEventListener(COMMAND_OPEN_EVENT, onOpen);
    return () => {
      window.removeEventListener("keydown", onKey);
      window.removeEventListener(COMMAND_OPEN_EVENT, onOpen);
    };
  }, []);

  useEffect(() => {
    if (open) {
      // Focus après le paint pour l'autofocus iOS.
      const id = window.setTimeout(() => inputRef.current?.focus(), 30);
      return () => window.clearTimeout(id);
    }
  }, [open]);

  // Recherche distante débattue.
  useEffect(() => {
    if (!open) return;
    const q = query.trim();
    if (q.length < 2) {
      setResults([]);
      setLoading(false);
      return;
    }
    setLoading(true);
    const controller = new AbortController();
    const id = window.setTimeout(async () => {
      try {
        const res = await fetch(`/api/search?q=${encodeURIComponent(q)}`, { signal: controller.signal });
        const data = await res.json();
        setResults(Array.isArray(data.results) ? data.results : []);
      } catch {
        /* abort / réseau : on ignore */
      } finally {
        setLoading(false);
      }
    }, 160);
    return () => {
      controller.abort();
      window.clearTimeout(id);
    };
  }, [query, open]);

  const filteredNav = useMemo(() => {
    const q = normalize(query.trim());
    if (!q) return navItems;
    return navItems.filter((item) => normalize(item.title).includes(q));
  }, [navItems, query]);

  const items = useMemo<Item[]>(() => {
    const remote: Item[] = results.map((r) => ({
      key: r.id,
      title: r.title,
      sublabel: r.sublabel,
      href: r.href,
      color: r.color,
      kind: r.type,
    }));
    return [...filteredNav, ...remote];
  }, [filteredNav, results]);

  useEffect(() => {
    setActive(0);
  }, [query]);

  const go = useCallback(
    (item: Item | undefined) => {
      if (!item) return;
      close();
      router.push(item.href);
    },
    [close, router],
  );

  function onInputKeyDown(event: React.KeyboardEvent) {
    if (event.key === "ArrowDown") {
      event.preventDefault();
      setActive((prev) => Math.min(prev + 1, items.length - 1));
    } else if (event.key === "ArrowUp") {
      event.preventDefault();
      setActive((prev) => Math.max(prev - 1, 0));
    } else if (event.key === "Enter") {
      event.preventDefault();
      go(items[active]);
    } else if (event.key === "Escape") {
      event.preventDefault();
      close();
    }
  }

  useEffect(() => {
    const el = listRef.current?.querySelector<HTMLElement>(`[data-idx="${active}"]`);
    el?.scrollIntoView({ block: "nearest" });
  }, [active]);

  if (!open || typeof document === "undefined") return null;

  return createPortal(
    <div
      role="dialog"
      aria-modal="true"
      aria-label="Recherche"
      onMouseDown={close}
      style={{
        position: "fixed",
        inset: 0,
        zIndex: 4000,
        background: "rgba(0,0,0,0.45)",
        display: "flex",
        alignItems: "flex-start",
        justifyContent: "center",
        padding: "max(10vh, calc(env(safe-area-inset-top,0px) + 16px)) 12px 12px",
      }}
    >
      <div
        onMouseDown={(event) => event.stopPropagation()}
        style={{
          width: "min(620px, 100%)",
          maxHeight: "min(70vh, 560px)",
          background: surface.s1,
          border: `1px solid ${surface.border}`,
          borderRadius: 18,
          boxShadow: "var(--mb-shadow-lg)",
          display: "flex",
          flexDirection: "column",
          overflow: "hidden",
        }}
      >
        <div className="flex items-center gap-2.5 px-4" style={{ borderBottom: `1px solid ${surface.borderSubtle}`, height: 52 }}>
          <SearchIcon color={text.muted} />
          <input
            ref={inputRef}
            value={query}
            onChange={(event) => setQuery(event.target.value)}
            onKeyDown={onInputKeyDown}
            placeholder="Rechercher un projet, une tâche, une étape…"
            className="flex-1 bg-transparent outline-none"
            style={{ fontSize: 15, color: text.primary }}
            autoComplete="off"
            autoCorrect="off"
            spellCheck={false}
          />
          {loading && <span className="text-[11px]" style={{ color: text.muted }}>…</span>}
        </div>

        <div ref={listRef} className="flex-1 overflow-y-auto py-2" style={{ WebkitOverflowScrolling: "touch" }}>
          {items.length === 0 ? (
            <p className="px-4 py-6 text-center text-[13px]" style={{ color: text.muted }}>
              {query.trim().length < 2 ? "Tape pour rechercher." : "Aucun résultat."}
            </p>
          ) : (
            items.map((item, index) => (
              <button
                key={item.key}
                data-idx={index}
                type="button"
                onMouseEnter={() => setActive(index)}
                onClick={() => go(item)}
                className="flex w-full items-center gap-3 px-4 py-2.5 text-left"
                style={{ background: index === active ? surface.s2 : "transparent", border: "none", cursor: "pointer" }}
              >
                <span
                  aria-hidden
                  className="flex h-7 w-7 shrink-0 items-center justify-center rounded-lg"
                  style={{ background: surface.s3, color: item.color ?? text.muted }}
                >
                  {item.kind === "nav" ? <ArrowIcon color={accent} /> : <KindDot color={item.color ?? accent} />}
                </span>
                <span className="flex min-w-0 flex-1 flex-col">
                  <span className="truncate text-[13.5px] font-semibold" style={{ color: text.primary }}>
                    {item.title}
                  </span>
                  <span className="truncate text-[11px]" style={{ color: text.muted }}>
                    {item.sublabel}
                  </span>
                </span>
              </button>
            ))
          )}
        </div>
      </div>
    </div>,
    document.body,
  );
}

function SearchIcon({ color }: { color: string }) {
  return (
    <svg width="17" height="17" viewBox="0 0 20 20" fill="none" aria-hidden className="shrink-0">
      <circle cx="9" cy="9" r="6" stroke={color} strokeWidth="1.7" />
      <path d="m17 17-3.2-3.2" stroke={color} strokeWidth="1.7" strokeLinecap="round" />
    </svg>
  );
}

function ArrowIcon({ color }: { color: string }) {
  return (
    <svg width="13" height="13" viewBox="0 0 16 16" fill="none" aria-hidden>
      <path d="M3 8h9m0 0-3.5-3.5M12 8l-3.5 3.5" stroke={color} strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  );
}

function KindDot({ color }: { color: string }) {
  return <span style={{ width: 9, height: 9, borderRadius: "50%", background: color, display: "inline-block" }} />;
}
