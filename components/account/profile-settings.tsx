"use client";

import { useState, useTransition } from "react";
import { surface, text } from "@/lib/design-tokens";
import { workspaceTheme, type Workspace } from "@/lib/workspace";
import { saveProfileAction } from "@/app/dashboard/settings/actions";

interface ProfileSettingsProps {
  workspace: Workspace;
  initialName: string;
  initialEmail: string;
}

export function ProfileSettings({ workspace, initialName, initialEmail }: ProfileSettingsProps) {
  const accent = workspaceTheme[workspace].accent;
  const [name, setName] = useState(initialName);
  const [email, setEmail] = useState(initialEmail);
  const [saved, setSaved] = useState(false);
  const [pending, startTransition] = useTransition();

  const dirty = name.trim() !== initialName.trim() || email.trim() !== initialEmail.trim();

  function save() {
    const cleanName = name.trim();
    if (!cleanName) return;
    setSaved(false);
    startTransition(async () => {
      await saveProfileAction({ name: cleanName, email: email.trim() });
      setSaved(true);
    });
  }

  return (
    <div className="flex flex-col gap-4">
      <div>
        <h2 className="text-sm font-semibold" style={{ color: text.primary }}>
          Profil
        </h2>
        <p className="mt-1 text-[13px] leading-6" style={{ color: text.secondary }}>
          Ton nom apparaît dans l'app et sert au filtre « Mes tâches » (les tâches dont tu es responsable).
        </p>
      </div>

      <div className="grid gap-3 sm:grid-cols-2">
        <label className="flex flex-col gap-1.5">
          <span className="text-[11px] font-semibold uppercase tracking-[0.14em]" style={{ color: text.muted }}>
            Nom
          </span>
          <input
            value={name}
            onChange={(event) => {
              setName(event.target.value);
              setSaved(false);
            }}
            placeholder="Ton nom"
            className="mb-input rounded-xl px-3 py-2.5 text-[14px]"
            style={{ background: surface.s2, border: `1px solid ${surface.border}`, color: text.primary }}
          />
        </label>
        <label className="flex flex-col gap-1.5">
          <span className="text-[11px] font-semibold uppercase tracking-[0.14em]" style={{ color: text.muted }}>
            Email (optionnel)
          </span>
          <input
            type="email"
            value={email}
            onChange={(event) => {
              setEmail(event.target.value);
              setSaved(false);
            }}
            placeholder="toi@exemple.com"
            className="mb-input rounded-xl px-3 py-2.5 text-[14px]"
            style={{ background: surface.s2, border: `1px solid ${surface.border}`, color: text.primary }}
          />
        </label>
      </div>

      <div className="flex items-center gap-3">
        <button
          type="button"
          onClick={save}
          disabled={!dirty || pending || !name.trim()}
          className="rounded-xl px-4 py-2.5 text-[13px] font-semibold"
          style={{
            background: accent,
            color: "#FFFFFF",
            border: "none",
            cursor: dirty && !pending ? "pointer" : "default",
            opacity: dirty && !pending && name.trim() ? 1 : 0.55,
          }}
        >
          {pending ? "Enregistrement…" : "Enregistrer"}
        </button>
        {saved && !dirty && (
          <span className="text-[12px]" style={{ color: text.muted }}>
            Profil enregistré.
          </span>
        )}
      </div>
    </div>
  );
}
