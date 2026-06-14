"use client";

import { useCallback, useEffect, useState } from "react";
import { surface, text } from "@/lib/design-tokens";
import { workspaceTheme, type Workspace } from "@/lib/workspace";

type Status =
  | "checking"
  | "unsupported"
  | "needs-install"
  | "off"
  | "working"
  | "on"
  | "denied"
  | "error";

function urlBase64ToUint8Array(base64String: string) {
  const padding = "=".repeat((4 - (base64String.length % 4)) % 4);
  const base64 = (base64String + padding).replace(/-/g, "+").replace(/_/g, "/");
  const raw = atob(base64);
  const output = new Uint8Array(raw.length);
  for (let i = 0; i < raw.length; i += 1) output[i] = raw.charCodeAt(i);
  return output;
}

function isStandalone() {
  if (typeof window === "undefined") return false;
  return (
    window.matchMedia?.("(display-mode: standalone)").matches ||
    (window.navigator as Navigator & { standalone?: boolean }).standalone === true
  );
}

function isIos() {
  if (typeof navigator === "undefined") return false;
  return /iphone|ipad|ipod/i.test(navigator.userAgent);
}

export function PushSettings({ workspace }: { workspace: Workspace }) {
  const accent = workspaceTheme[workspace].accent;
  const [status, setStatus] = useState<Status>("checking");
  const [message, setMessage] = useState<string | null>(null);
  const [testing, setTesting] = useState(false);

  const supported =
    typeof window !== "undefined" &&
    "serviceWorker" in navigator &&
    "PushManager" in window &&
    "Notification" in window;

  const refresh = useCallback(async () => {
    if (!supported) {
      // iOS < 16.4 ou navigateur sans push : on guide vers l'install PWA si iOS.
      setStatus(isIos() && !isStandalone() ? "needs-install" : "unsupported");
      return;
    }
    if (isIos() && !isStandalone()) {
      setStatus("needs-install");
      return;
    }
    if (Notification.permission === "denied") {
      setStatus("denied");
      return;
    }
    try {
      const reg = await navigator.serviceWorker.getRegistration();
      const sub = reg ? await reg.pushManager.getSubscription() : null;
      setStatus(sub ? "on" : "off");
    } catch {
      setStatus("off");
    }
  }, [supported]);

  useEffect(() => {
    refresh();
  }, [refresh]);

  async function enable() {
    setMessage(null);
    setStatus("working");
    try {
      const permission = await Notification.requestPermission();
      if (permission !== "granted") {
        setStatus(permission === "denied" ? "denied" : "off");
        return;
      }
      const reg = await navigator.serviceWorker.register("/sw.js");
      await navigator.serviceWorker.ready;

      const keyRes = await fetch("/api/push/subscribe");
      const { publicKey } = await keyRes.json();
      if (!publicKey) throw new Error("Clé serveur indisponible.");

      const sub = await reg.pushManager.subscribe({
        userVisibleOnly: true,
        applicationServerKey: urlBase64ToUint8Array(publicKey),
      });

      const res = await fetch("/api/push/subscribe", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ subscription: sub.toJSON() }),
      });
      if (!res.ok) throw new Error("Enregistrement refusé.");

      setStatus("on");
      setMessage("Notifications activées sur cet appareil.");
    } catch (error) {
      console.error(error);
      setStatus("error");
      setMessage(error instanceof Error ? error.message : "Activation impossible.");
    }
  }

  async function disable() {
    setMessage(null);
    setStatus("working");
    try {
      const reg = await navigator.serviceWorker.getRegistration();
      const sub = reg ? await reg.pushManager.getSubscription() : null;
      if (sub) {
        await fetch("/api/push/unsubscribe", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ endpoint: sub.endpoint }),
        });
        await sub.unsubscribe();
      }
      setStatus("off");
      setMessage("Notifications désactivées sur cet appareil.");
    } catch {
      setStatus("error");
      setMessage("Désactivation impossible.");
    }
  }

  async function sendTest() {
    setTesting(true);
    setMessage(null);
    try {
      const res = await fetch("/api/push/test", { method: "POST" });
      const data = await res.json();
      if (!res.ok) throw new Error(data?.error || "Échec.");
      setMessage(data.sent > 0 ? "Notification de test envoyée." : "Aucun appareil abonné côté serveur.");
    } catch (error) {
      setMessage(error instanceof Error ? error.message : "Test impossible.");
    } finally {
      setTesting(false);
    }
  }

  const isOn = status === "on";

  return (
    <div className="flex flex-col gap-3">
      <div className="flex items-center justify-between gap-3">
        <div className="min-w-0">
          <h2 className="text-sm font-semibold" style={{ color: text.primary }}>
            Notifications push
          </h2>
          <p className="mt-1 text-[13px] leading-6" style={{ color: text.secondary }}>
            Reçois un rappel quotidien des tâches en retard et à faire aujourd'hui, même app fermée.
          </p>
        </div>
        {(status === "on" || status === "off" || status === "working" || status === "error") && (
          <button
            type="button"
            onClick={isOn ? disable : enable}
            disabled={status === "working"}
            aria-pressed={isOn}
            className="relative inline-flex h-7 w-12 shrink-0 items-center rounded-full transition-colors"
            style={{
              background: isOn ? accent : surface.s4,
              opacity: status === "working" ? 0.6 : 1,
              cursor: status === "working" ? "default" : "pointer",
              border: `1px solid ${surface.borderSubtle}`,
            }}
          >
            <span
              className="inline-block h-5 w-5 rounded-full bg-white transition-transform"
              style={{ transform: isOn ? "translateX(22px)" : "translateX(3px)", boxShadow: "var(--mb-shadow-xs)" }}
            />
          </button>
        )}
      </div>

      {status === "checking" && <Hint color={text.muted}>Vérification…</Hint>}

      {status === "unsupported" && (
        <Hint color={text.muted}>
          Cet appareil/navigateur ne supporte pas les notifications push.
        </Hint>
      )}

      {status === "needs-install" && (
        <Hint color={text.muted}>
          Sur iPhone, ajoute d'abord Mindbase à l'écran d'accueil (Partager → « Sur l'écran d'accueil »),
          puis rouvre l'app depuis l'icône pour activer les notifications.
        </Hint>
      )}

      {status === "denied" && (
        <Hint color={text.muted}>
          Les notifications sont bloquées dans les réglages du navigateur/de l'app. Autorise-les puis recharge.
        </Hint>
      )}

      {isOn && (
        <button
          type="button"
          onClick={sendTest}
          disabled={testing}
          className="self-start rounded-lg px-3 py-2 text-[12px] font-semibold"
          style={{ background: surface.s2, color: text.primary, border: `1px solid ${surface.border}`, cursor: "pointer" }}
        >
          {testing ? "Envoi…" : "Envoyer une notification de test"}
        </button>
      )}

      {message && (
        <p className="text-[12px]" style={{ color: text.muted }}>
          {message}
        </p>
      )}
    </div>
  );
}

function Hint({ children, color }: { children: React.ReactNode; color: string }) {
  return (
    <p className="text-[12.5px] leading-6" style={{ color }}>
      {children}
    </p>
  );
}
