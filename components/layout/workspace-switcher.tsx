"use client";

// Sélecteur d'environnement — pastille ronde affichant la LETTRE de
// l'environnement courant (couleur = accent de l'environnement). Au clic, une
// petite fenêtre (popover) liste les environnements pour basculer.
//
// On suit l'environnement courant via `WORKSPACE_EVENT` (pas de useSearchParams
// → pas de Suspense au niveau du shell).

import { useEffect, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { usePathname, useRouter } from "next/navigation";
import { useEnvironments } from "@/components/environments/environments-provider";
import { ALL_WORKSPACE, getWorkspace, listEnvironmentOptions, workspaceTheme } from "@/lib/workspace";
import { WORKSPACE_EVENT, broadcastWorkspace } from "@/lib/workspace-client";
import { useT } from "@/components/i18n/locale-provider";
import { surface, text } from "@/lib/design-tokens";

export function WorkspaceSwitcher({
  initialWorkspace,
  size = 30,
}: {
  initialWorkspace: string;
  size?: number;
}) {
  const router = useRouter();
  const pathname = usePathname();
  const t = useT();
  const environments = useEnvironments();
  const [workspaceParam, setWorkspaceParam] = useState<string>(initialWorkspace);
  const [open, setOpen] = useState(false);
  const [position, setPosition] = useState<{ left: number; top?: number; bottom?: number } | null>(null);
  const buttonRef = useRef<HTMLButtonElement>(null);
  const menuRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    function onWorkspace(event: Event) {
      const detail = (event as CustomEvent<string>).detail;
      if (detail) setWorkspaceParam(detail);
    }
    function onPop() {
      const value = new URLSearchParams(window.location.search).get("workspace");
      if (value) setWorkspaceParam(value);
    }
    window.addEventListener(WORKSPACE_EVENT, onWorkspace);
    window.addEventListener("popstate", onPop);
    return () => {
      window.removeEventListener(WORKSPACE_EVENT, onWorkspace);
      window.removeEventListener("popstate", onPop);
    };
  }, []);

  // Fermeture au clic extérieur / Échap / scroll.
  useEffect(() => {
    if (!open) return;
    function onPointerDown(event: PointerEvent) {
      const target = event.target as Node;
      if (buttonRef.current?.contains(target) || menuRef.current?.contains(target)) return;
      setOpen(false);
    }
    function onKey(event: KeyboardEvent) {
      if (event.key === "Escape") setOpen(false);
    }
    function onScroll() {
      setOpen(false);
    }
    const timer = window.setTimeout(() => document.addEventListener("pointerdown", onPointerDown), 0);
    window.addEventListener("keydown", onKey);
    window.addEventListener("scroll", onScroll, true);
    window.addEventListener("resize", onScroll);
    return () => {
      window.clearTimeout(timer);
      document.removeEventListener("pointerdown", onPointerDown);
      window.removeEventListener("keydown", onKey);
      window.removeEventListener("scroll", onScroll, true);
      window.removeEventListener("resize", onScroll);
    };
  }, [open]);

  const current = getWorkspace(workspaceParam);
  const accent = workspaceTheme[current].accent;
  const options = [
    { value: ALL_WORKSPACE as string, label: t("common.all") },
    ...listEnvironmentOptions(environments),
  ];
  const currentLabel = options.find((option) => option.value === current)?.label ?? "?";
  const letter = currentLabel.trim().charAt(0).toUpperCase() || "?";

  function toggle() {
    if (open) {
      setOpen(false);
      return;
    }
    const rect = buttonRef.current?.getBoundingClientRect();
    if (!rect) return;
    const menuWidth = 212;
    const spaceBelow = window.innerHeight - rect.bottom;
    // Au bas de l'écran (barre du bas iPhone) → on ouvre vers le haut.
    const flip = spaceBelow < 260;
    const left = Math.min(Math.max(8, rect.left), window.innerWidth - menuWidth - 8);
    setPosition(
      flip
        ? { left, bottom: window.innerHeight - rect.top + 8 }
        : { left, top: rect.bottom + 8 },
    );
    setOpen(true);
  }

  function pick(value: string) {
    setOpen(false);
    if (value === current) return;
    broadcastWorkspace(value);
    const params = new URLSearchParams(window.location.search);
    params.set("workspace", value);
    router.push(`${pathname}?${params.toString()}`);
    router.refresh();
  }

  return (
    <>
      <button
        ref={buttonRef}
        type="button"
        onClick={toggle}
        aria-haspopup="listbox"
        aria-expanded={open}
        title={`${t("filter.environment")} : ${currentLabel}`}
        aria-label={`${t("filter.environment")} : ${currentLabel}`}
        style={{
          width: size,
          height: size,
          borderRadius: "50%",
          background: accent,
          color: "#FFFFFF",
          fontWeight: 700,
          fontSize: Math.round(size * 0.42),
          lineHeight: 1,
          display: "inline-flex",
          alignItems: "center",
          justifyContent: "center",
          border: "none",
          cursor: "pointer",
          flexShrink: 0,
          boxShadow: "0 1px 2px rgba(16,24,40,0.16)",
        }}
      >
        {letter}
      </button>

      {open && position && typeof document !== "undefined"
        ? createPortal(
            <div
              ref={menuRef}
              role="listbox"
              aria-label={t("filter.environment")}
              style={{
                position: "fixed",
                left: position.left,
                ...(position.bottom !== undefined ? { bottom: position.bottom } : { top: position.top }),
                width: 212,
                zIndex: 9999,
                background: surface.s1,
                border: `1px solid ${surface.border}`,
                borderRadius: 14,
                boxShadow: "var(--mb-shadow-md)",
                padding: 6,
                display: "flex",
                flexDirection: "column",
                gap: 1,
              }}
            >
              <p
                style={{
                  fontSize: 9.5,
                  fontWeight: 700,
                  color: text.muted,
                  textTransform: "uppercase",
                  letterSpacing: "0.14em",
                  margin: "4px 8px 6px",
                }}
              >
                {t("filter.environment")}
              </p>
              {options.map((option) => {
                const selected = option.value === current;
                const optionAccent = workspaceTheme[option.value].accent;
                return (
                  <button
                    key={option.value}
                    type="button"
                    role="option"
                    aria-selected={selected}
                    onClick={() => pick(option.value)}
                    className="flex items-center gap-2 rounded-lg px-2 py-1.5 text-left"
                    style={{
                      background: selected ? surface.s2 : "transparent",
                      border: "none",
                      color: text.secondary,
                      fontSize: 12.5,
                      fontWeight: selected ? 600 : 500,
                      cursor: "pointer",
                    }}
                  >
                    <span
                      aria-hidden
                      className="inline-flex h-5 w-5 shrink-0 items-center justify-center rounded-full text-[9px] font-bold text-white"
                      style={{ background: optionAccent }}
                    >
                      {option.label.trim().charAt(0).toUpperCase()}
                    </span>
                    <span className="min-w-0 flex-1 truncate">{option.label}</span>
                    {selected && (
                      <svg width="12" height="12" viewBox="0 0 16 16" fill="none" aria-hidden>
                        <path d="m3 8.4 3.2 3.2L13 5" stroke={optionAccent} strokeWidth="1.85" strokeLinecap="round" strokeLinejoin="round" />
                      </svg>
                    )}
                  </button>
                );
              })}
            </div>,
            document.body,
          )
        : null}
    </>
  );
}
