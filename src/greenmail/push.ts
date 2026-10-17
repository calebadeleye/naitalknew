import { gm } from "./api";

/*
 * Phone/desktop notifications for new mail (Web Push). The browser gives this
 * device one push address; each signed-in mailbox that wants notifications
 * registers it with the server, which checks for new mail every minute — so
 * they arrive even when Green Mail is closed.
 */
export type PushSupport = "supported" | "install-first" | "unsupported" | "blocked";

const isIos = () => /iphone|ipad|ipod/i.test(navigator.userAgent) || (navigator.platform === "MacIntel" && navigator.maxTouchPoints > 1);
const isInstalled = () => window.matchMedia?.("(display-mode: standalone)").matches || (navigator as Navigator & { standalone?: boolean }).standalone === true;

export function pushSupport(): PushSupport {
  const hasApis = "serviceWorker" in navigator && "PushManager" in window && "Notification" in window;
  // iPhone/iPad only allow notifications for apps added to the Home Screen.
  if (isIos() && !isInstalled()) return "install-first";
  if (!hasApis) return "unsupported";
  if (Notification.permission === "denied") return "blocked";
  return "supported";
}

async function registration(): Promise<ServiceWorkerRegistration | null> {
  const existing = await navigator.serviceWorker.getRegistration("/greenmail");
  if (existing) return existing;
  try {
    return await navigator.serviceWorker.register("/greenmail-sw.js", { scope: "/greenmail" });
  } catch {
    return null;
  }
}

export async function deviceSubscription(): Promise<PushSubscription | null> {
  if (pushSupport() !== "supported") return null;
  const reg = await registration();
  return (await reg?.pushManager.getSubscription()) ?? null;
}

const toKey = (base64: string) => {
  const padded = (base64 + "=".repeat((4 - (base64.length % 4)) % 4)).replace(/-/g, "+").replace(/_/g, "/");
  const raw = window.atob(padded);
  return Uint8Array.from(raw, (c) => c.charCodeAt(0));
};

/** Is this mailbox getting notifications on this device? */
export async function isEnabledHere(token: string): Promise<boolean> {
  const subscription = await deviceSubscription();
  if (!subscription) return false;
  const status = await gm<{ this_device: boolean }>(`/push?endpoint=${encodeURIComponent(subscription.endpoint)}`, token).catch(() => ({ this_device: false }));
  return status.this_device;
}

/** Tells the server why turning notifications on failed, so support can see it (best effort). */
function reportProblem(token: string, stage: string, error: unknown) {
  const message = error instanceof Error ? `${error.name}: ${error.message}` : String(error);
  void gm("/push/problem", token, { method: "POST", body: JSON.stringify({ stage, message: message.slice(0, 480), standalone: isInstalled() }) }).catch(() => undefined);
}

export async function enableHere(token: string, domain: string): Promise<void> {
  let stage = "permission";
  try {
    // Must be the first thing after the tap: iPhone only asks for permission straight after a tap.
    const permission = await Notification.requestPermission();
    if (permission !== "granted") throw new Error(permission === "denied" ? "Notifications were not allowed. Allow them for Green Mail in your phone or browser settings, then try again." : "Notifications were not turned on. Tap the switch again and choose Allow.");

    stage = "key";
    const { public_key: key } = await gm<{ public_key: string | null }>("/push/key", "");
    if (!key) throw new Error("Notifications are not available yet. Please try again later.");

    stage = "register";
    const reg = await registration();
    if (!reg) throw new Error("This browser can't receive notifications from Green Mail.");
    await navigator.serviceWorker.ready;

    stage = "subscribe";
    const subscription = (await reg.pushManager.getSubscription()) ?? (await reg.pushManager.subscribe({ userVisibleOnly: true, applicationServerKey: toKey(key) }));
    const json = subscription.toJSON();

    stage = "server";
    await gm("/push", token, { method: "POST", body: JSON.stringify({ endpoint: json.endpoint, keys: json.keys, domain: domain || null }) });
  } catch (error) {
    reportProblem(token, stage, error);
    if (stage === "subscribe") throw new Error("This device could not sign up for notifications. Close Green Mail completely, open it again from the Home Screen, and try once more.");
    throw error;
  }
}

/** Ask the server to send a test notification to this device. */
export async function sendTestHere(token: string): Promise<string> {
  const subscription = await deviceSubscription();
  if (!subscription) throw new Error("Notifications are not on for this device. Turn them on first.");
  const result = await gm<{ message: string }>("/push/test", token, { method: "POST", body: JSON.stringify({ endpoint: subscription.endpoint }) });
  return result.message;
}

export { isInstalled as runningAsInstalledApp };

/** Stop for this mailbox (other signed-in mailboxes on this device keep theirs). */
export async function disableHere(token: string): Promise<void> {
  const subscription = await deviceSubscription();
  if (subscription) await gm("/push", token, { method: "DELETE", body: JSON.stringify({ endpoint: subscription.endpoint }) });
}
