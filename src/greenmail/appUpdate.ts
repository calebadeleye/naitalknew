import { useEffect, useState } from "react";

/*
 * Keeps an open (or installed) Green Mail on the newest version.
 *
 * Every build gets a new main script name (/assets/index-<hash>.js). Now and
 * then, and whenever Green Mail comes back to the front, it asks the server
 * which script /greenmail uses today; if that's not the one running, a new
 * version is out. It then reloads itself at a moment nobody loses anything:
 * while it is in the background or has been left alone, and only when no email
 * or campaign is being written. Otherwise it offers a "Reload" banner.
 */

const CHECK_EVERY_MS = 10 * 60 * 1000;
const IDLE_MS = 5 * 60 * 1000;

/** Things being written that a reload would lose (an email, a campaign). */
const holds = new Set<string>();

export function holdReload(reason: string, on: boolean): void {
  if (on) holds.add(reason);
  else holds.delete(reason);
}

/** Keeps the app from reloading itself while `on` (e.g. while an email is being written). */
export function useHoldReload(reason: string, on: boolean): void {
  useEffect(() => {
    holdReload(reason, on);
    return () => holdReload(reason, false);
  }, [reason, on]);
}

const SCRIPT = /<script\b[^>]*\bsrc="(\/assets\/index-[^"]+\.js)"/;

/** The main script of the running page (null in development). */
export function runningVersion(doc: Document = document): string | null {
  const script = Array.from(doc.querySelectorAll<HTMLScriptElement>('script[type="module"][src]')).find((s) => /\/assets\/index-[^/]+\.js$/.test(s.getAttribute("src") ?? ""));
  return script?.getAttribute("src") ?? null;
}

/** The main script the server's Green Mail page uses now (null if it can't be told). */
export async function latestVersion(fetcher: typeof fetch = fetch): Promise<string | null> {
  try {
    const response = await fetcher(`/greenmail?version-check=${Date.now()}`, { cache: "no-store", headers: { Accept: "text/html" } });
    if (!response.ok) return null;
    return (await response.text()).match(SCRIPT)?.[1] ?? null;
  } catch {
    return null;
  }
}

/** True when a newer Green Mail is on the server. Reloads by itself when that's safe. */
export function useAppUpdate(): { ready: boolean; reload: () => void } {
  const [ready, setReady] = useState(false);

  useEffect(() => {
    const running = runningVersion();
    if (!running) return; // development build: nothing to compare with

    let found = false;
    let lastActivity = Date.now();
    const busy = () => holds.size > 0 || isTyping();

    const tryReload = () => {
      if (!found || busy()) return;
      if (document.visibilityState === "hidden" || Date.now() - lastActivity > IDLE_MS) window.location.reload();
    };

    const check = async () => {
      if (found || !navigator.onLine) return tryReload();
      const latest = await latestVersion();
      if (latest && latest !== running) {
        found = true;
        setReady(true);
      }
      tryReload();
    };

    const onVisible = () => {
      if (document.visibilityState === "visible") void check();
      else tryReload();
    };
    const onActivity = () => {
      lastActivity = Date.now();
    };

    const timer = window.setInterval(() => void check(), CHECK_EVERY_MS);
    const idleTimer = window.setInterval(tryReload, 60 * 1000);
    document.addEventListener("visibilitychange", onVisible);
    window.addEventListener("online", check);
    window.addEventListener("focus", check);
    ["pointerdown", "keydown", "wheel", "touchstart"].forEach((type) => window.addEventListener(type, onActivity, { passive: true }));
    void check();

    return () => {
      window.clearInterval(timer);
      window.clearInterval(idleTimer);
      document.removeEventListener("visibilitychange", onVisible);
      window.removeEventListener("online", check);
      window.removeEventListener("focus", check);
      ["pointerdown", "keydown", "wheel", "touchstart"].forEach((type) => window.removeEventListener(type, onActivity));
    };
  }, []);

  return { ready, reload: () => window.location.reload() };
}

/** Someone is typing in a box (search, a form) right now. */
function isTyping(): boolean {
  const el = document.activeElement as HTMLElement | null;
  if (!el) return false;
  if (el.isContentEditable) return true;
  if (el instanceof HTMLTextAreaElement) return el.value.trim() !== "";
  return el instanceof HTMLInputElement && !["checkbox", "radio", "button", "submit"].includes(el.type) && el.value.trim() !== "";
}
