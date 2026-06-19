"use client";

// FAB « Nouveau projet » — mobile uniquement. Auparavant le « + » violet vivait
// au centre du topbar (position absolue), trop collé au logo Flatmind à droite,
// ce qui était gênant visuellement. On le sort dans un bouton flottant à
// position FIXE, dans le coin bas-droit, au-dessus de la bottom nav : toujours
// au même endroit, facilement atteignable au pouce, sans empiéter sur le logo.
//
// Rendu via portal vers <body> pour échapper aux conteneurs overflow:hidden du
// shell. Masqué sur desktop (sm:hidden) où le bouton texte du topbar suffit.

import Link from "next/link";
import { createPortal } from "react-dom";
import { useEffect, useState } from "react";

export function NewProjectFab({
  href,
  label,
  accent,
}: {
  href: string;
  label: string;
  accent: string;
}) {
  const [mounted, setMounted] = useState(false);
  useEffect(() => setMounted(true), []);
  if (!mounted || typeof document === "undefined") return null;

  return createPortal(
    <Link
      href={href}
      aria-label={label}
      // display géré par les classes (flex / sm:hidden) — surtout PAS en inline,
      // sinon le style inline écraserait `sm:hidden` et le FAB resterait visible
      // sur desktop.
      className="mb-fab sm:hidden flex items-center justify-center"
      style={{
        position: "fixed",
        right: "calc(env(safe-area-inset-right, 0px) + 18px)",
        // Au-dessus de la bottom nav (~56px + safe-area home indicator).
        bottom: "calc(env(safe-area-inset-bottom, 0px) + 84px)",
        zIndex: 60,
        width: 56,
        height: 56,
        borderRadius: 18,
        background: accent,
        color: "#FFFFFF",
        boxShadow: "0 12px 26px -8px rgba(76, 29, 149, 0.55), 0 2px 6px rgba(0, 0, 0, 0.18)",
      }}
    >
      <svg width="22" height="22" viewBox="0 0 16 16" fill="none" aria-hidden="true">
        <path d="M8 3v10M3 8h10" stroke="currentColor" strokeWidth="1.9" strokeLinecap="round" />
      </svg>
    </Link>,
    document.body,
  );
}
