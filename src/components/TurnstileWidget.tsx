import React, { useEffect, useRef } from "react";
import { laravelApi } from "../shared/api";

/**
 * Cloudflare Turnstile on the sign-up form. The site key comes from the
 * backend, so the check switches on (or off) without rebuilding the frontend:
 * with no key configured nothing is shown and sign-up works as before.
 */

type TurnstileApi = {
  render: (element: HTMLElement, options: Record<string, unknown>) => string;
  remove: (widgetId: string) => void;
};

declare global {
  interface Window {
    turnstile?: TurnstileApi;
  }
}

const SCRIPT_SRC = "https://challenges.cloudflare.com/turnstile/v0/api.js?render=explicit";
let scriptPromise: Promise<TurnstileApi> | null = null;

function loadTurnstile(): Promise<TurnstileApi> {
  if (window.turnstile) return Promise.resolve(window.turnstile);
  if (!scriptPromise) {
    scriptPromise = new Promise((resolve, reject) => {
      const script = document.createElement("script");
      script.src = SCRIPT_SRC;
      script.async = true;
      script.defer = true;
      script.onload = () => (window.turnstile ? resolve(window.turnstile) : reject(new Error("Turnstile did not load.")));
      script.onerror = () => {
        scriptPromise = null;
        reject(new Error("Turnstile did not load."));
      };
      document.head.appendChild(script);
    });
  }
  return scriptPromise;
}

/** The site key, or null when Turnstile is off. undefined while it is being fetched. */
export function useTurnstileSiteKey(active: boolean): string | null | undefined {
  const [siteKey, setSiteKey] = React.useState<string | null | undefined>(undefined);
  useEffect(() => {
    if (!active || siteKey !== undefined) return;
    let cancelled = false;
    laravelApi<{ site_key: string | null }>("/api/v1/auth/turnstile")
      .then((data) => !cancelled && setSiteKey(data.site_key || null))
      .catch(() => !cancelled && setSiteKey(null));
    return () => {
      cancelled = true;
    };
  }, [active, siteKey]);
  return siteKey;
}

/** Renders the check. `onToken` gets the token, or "" when it expires or fails. Change `resetKey` to get a fresh check. */
export function TurnstileWidget({ siteKey, onToken, resetKey = 0, action = "register" }: { siteKey: string; onToken: (token: string) => void; resetKey?: number; action?: string }) {
  const holder = useRef<HTMLDivElement>(null);
  const onTokenRef = useRef(onToken);
  onTokenRef.current = onToken;

  useEffect(() => {
    let widgetId: string | null = null;
    let cancelled = false;
    onTokenRef.current("");
    loadTurnstile()
      .then((turnstile) => {
        if (cancelled || !holder.current) return;
        widgetId = turnstile.render(holder.current, {
          sitekey: siteKey,
          theme: "dark",
          action,
          callback: (token: string) => onTokenRef.current(token),
          "expired-callback": () => onTokenRef.current(""),
          "error-callback": () => onTokenRef.current(""),
        });
      })
      .catch(() => onTokenRef.current(""));
    return () => {
      cancelled = true;
      if (widgetId && window.turnstile) window.turnstile.remove(widgetId);
    };
  }, [siteKey, resetKey, action]);

  return <div ref={holder} className="flex min-h-[65px] justify-center" />;
}
