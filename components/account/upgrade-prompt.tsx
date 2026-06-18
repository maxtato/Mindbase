"use client";

// Invitation à passer au plan Pro pour les fonctionnalités verrouillées.
// Remplace les boutons masqués / les erreurs brutes par une affordance claire :
// un bouton « verrouillé » (cadenas) qui ouvre une petite fenêtre expliquant le
// plan Pro avec un CTA vers les réglages.

import { useState, type CSSProperties, type ReactNode } from "react";
import { createPortal } from "react-dom";
import Link from "next/link";
import { surface, text } from "@/lib/design-tokens";
import { useT } from "@/components/i18n/locale-provider";

export function UpgradeDialog({ open, onClose }: { open: boolean; onClose: () => void }) {
  const t = useT();
  if (!open || typeof document === "undefined") return null;
  return createPortal(
    <div
      onClick={onClose}
      style={{
        position: "fixed",
        inset: 0,
        zIndex: 9999,
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        padding: 16,
        background: "rgba(15, 23, 42, 0.36)",
      }}
    >
      <div
        role="dialog"
        aria-modal="true"
        aria-label={t("upgrade.title")}
        onClick={(event) => event.stopPropagation()}
        style={{
          width: 360,
          maxWidth: "100%",
          padding: 18,
          background: surface.s1,
          border: `1px solid ${surface.border}`,
          borderRadius: 22,
          boxShadow: "var(--mb-shadow-lg)",
          display: "flex",
          flexDirection: "column",
          gap: 10,
        }}
      >
        <span
          className="inline-flex w-fit items-center gap-1 rounded-full px-2 py-0.5 text-[10px] font-bold uppercase tracking-[0.14em]"
          style={{ background: "var(--mb-mauve)", color: "#FFFFFF" }}
        >
          <LockIcon />
          {t("upgrade.badge")}
        </span>
        <p className="text-base font-bold" style={{ color: text.primary, margin: 0 }}>
          {t("upgrade.title")}
        </p>
        <p className="text-[13px] leading-relaxed" style={{ color: text.secondary, margin: 0 }}>
          {t("upgrade.body")}
        </p>
        <div className="mt-1 flex items-center gap-2">
          <Link
            href="/dashboard/settings"
            onClick={onClose}
            className="inline-flex items-center justify-center rounded-xl px-4 py-2.5 text-sm font-semibold"
            style={{ background: "var(--mb-mauve)", color: "#FFFFFF", textDecoration: "none" }}
          >
            {t("upgrade.cta")}
          </Link>
          <button
            type="button"
            onClick={onClose}
            className="rounded-xl px-3 py-2.5 text-sm font-semibold"
            style={{ background: surface.s2, color: text.secondary, border: `1px solid ${surface.border}`, cursor: "pointer" }}
          >
            {t("upgrade.later")}
          </button>
        </div>
      </div>
    </div>,
    document.body,
  );
}

// Bouton « fonctionnalité Pro verrouillée » : même apparence qu'un bouton normal
// mais grisé avec un cadenas ; au clic, ouvre l'UpgradeDialog.
export function ProLockButton({
  children,
  className,
  style,
  title,
}: {
  children: ReactNode;
  className?: string;
  style?: CSSProperties;
  title?: string;
}) {
  const [open, setOpen] = useState(false);
  return (
    <>
      <button type="button" onClick={() => setOpen(true)} className={className} style={style} title={title}>
        {children}
        <LockIcon />
      </button>
      <UpgradeDialog open={open} onClose={() => setOpen(false)} />
    </>
  );
}

function LockIcon() {
  return (
    <svg width="11" height="11" viewBox="0 0 16 16" fill="none" aria-hidden="true">
      <rect x="3.5" y="7" width="9" height="6.2" rx="1.4" stroke="currentColor" strokeWidth="1.4" />
      <path d="M5.5 7V5.4a2.5 2.5 0 0 1 5 0V7" stroke="currentColor" strokeWidth="1.4" strokeLinecap="round" />
    </svg>
  );
}
