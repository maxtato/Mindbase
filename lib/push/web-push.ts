// Configuration web-push côté serveur (VAPID). La clé PUBLIQUE est par nature
// publique (envoyée au navigateur) → on peut la committer. La clé PRIVÉE doit
// rester secrète : on la lit dans VAPID_PRIVATE_KEY (variable d'env Vercel).
// Sans clé privée configurée, l'envoi est désactivé proprement (no-op) — le
// build et le déploiement ne cassent jamais.

import webpush from "web-push";

// Clé publique par défaut (paire générée pour ce projet). Surchargeables par env.
export const VAPID_PUBLIC_KEY =
  process.env.VAPID_PUBLIC_KEY ||
  "BLkJ5x64s4HDRvdftWhuyiOQRrrqSrWfpmyfnq7o410JSUaJNIvUF4SYe9bSDFN8HWKQWF2zOe4TyxF2cyKrcJc";

const VAPID_PRIVATE_KEY = process.env.VAPID_PRIVATE_KEY;
const VAPID_SUBJECT = process.env.VAPID_SUBJECT || "mailto:contact@mindbase.app";

export const isPushConfigured = Boolean(VAPID_PUBLIC_KEY && VAPID_PRIVATE_KEY);

let configured = false;
function ensureConfigured() {
  if (configured || !isPushConfigured) return;
  webpush.setVapidDetails(VAPID_SUBJECT, VAPID_PUBLIC_KEY, VAPID_PRIVATE_KEY as string);
  configured = true;
}

export interface PushSubscriptionRecord {
  endpoint: string;
  keys: { p256dh: string; auth: string };
}

export interface PushPayload {
  title: string;
  body: string;
  url?: string;
  tag?: string;
}

/** Envoie une notif à un abonnement. Renvoie false si l'abonnement est mort
 *  (404/410) → l'appelant doit le purger. */
export async function sendPush(sub: PushSubscriptionRecord, payload: PushPayload): Promise<boolean> {
  ensureConfigured();
  if (!isPushConfigured) return true;
  try {
    await webpush.sendNotification(
      { endpoint: sub.endpoint, keys: sub.keys },
      JSON.stringify(payload),
    );
    return true;
  } catch (error) {
    const status = (error as { statusCode?: number }).statusCode;
    if (status === 404 || status === 410) return false; // abonnement expiré
    console.error("[web-push] send failed:", error);
    return true; // erreur transitoire → on garde l'abonnement
  }
}
