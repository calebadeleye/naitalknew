/**
 * First-party visit tracking for the admin analytics dashboard.
 *
 * Unlike src/lib/analytics.ts (Google Tag Manager/GA4), this posts directly
 * to our own backend (/api/v1/public/track/*) — no third-party script, so
 * nothing here is subject to ad-blockers stripping a Google tag, and no
 * visitor data goes to Google. Only meant to run on the public marketing
 * site, never inside /admin or /client — the site owner's own usage isn't
 * a "visitor".
 */

const VISITOR_ID_STORAGE_KEY = "naitalk_visitor_id";
const HEARTBEAT_INTERVAL_MS = 15_000;

let lastTrackedPath = "";
let currentPageViewId: number | null = null;
let activeMs = 0;
let activeSince = 0;
let isActive = false;
let heartbeatTimer: ReturnType<typeof setInterval> | null = null;

function apiBase(): string {
  return (import.meta.env.VITE_LARAVEL_API_URL as string | undefined)?.replace(/\/$/, "") || "http://127.0.0.1:8000";
}

function getVisitorId(): string {
  try {
    const existing = localStorage.getItem(VISITOR_ID_STORAGE_KEY);
    if (existing) return existing;
    const fresh = crypto.randomUUID();
    localStorage.setItem(VISITOR_ID_STORAGE_KEY, fresh);
    return fresh;
  } catch {
    // Private browsing / storage disabled — fall back to a per-load id.
    return crypto.randomUUID();
  }
}

function pauseActiveTimer(): void {
  if (!isActive) return;
  activeMs += Date.now() - activeSince;
  isActive = false;
}

function resumeActiveTimer(): void {
  if (isActive) return;
  activeSince = Date.now();
  isActive = true;
}

function currentActiveSeconds(): number {
  const liveMs = isActive ? Date.now() - activeSince : 0;
  return Math.max(0, Math.round((activeMs + liveMs) / 1000));
}

function sendHeartbeat(useBeacon: boolean): void {
  if (currentPageViewId === null) return;

  const body = JSON.stringify({ page_view_id: currentPageViewId, duration_seconds: currentActiveSeconds() });
  const url = `${apiBase()}/api/v1/public/track/heartbeat`;

  try {
    if (useBeacon && navigator.sendBeacon) {
      navigator.sendBeacon(url, new Blob([body], { type: "application/json" }));
      return;
    }
    fetch(url, { method: "POST", headers: { "Content-Type": "application/json" }, body, keepalive: true }).catch(() => {});
  } catch {
    // Tracking must never break the app.
  }
}

function stopHeartbeat(): void {
  if (heartbeatTimer) {
    clearInterval(heartbeatTimer);
    heartbeatTimer = null;
  }
}

function handleVisibilityChange(): void {
  if (document.visibilityState === "hidden") {
    pauseActiveTimer();
    sendHeartbeat(true);
  } else {
    resumeActiveTimer();
  }
}

let listenersAttached = false;

function attachLifecycleListeners(): void {
  if (listenersAttached) return;
  listenersAttached = true;
  document.addEventListener("visibilitychange", handleVisibilityChange);
  window.addEventListener("pagehide", () => {
    pauseActiveTimer();
    sendHeartbeat(true);
  });
}

/**
 * Records one page view against the site's own backend and starts an
 * active-time tracker (paused while the tab is hidden) so the admin
 * analytics dashboard can show an approximate time-on-page. The public site
 * is a classic MPA, so this is called once per real page load — there is
 * never a previous page view to flush from the same JS context.
 */
export function trackSiteVisit(): void {
  if (typeof window === "undefined") return;

  const path = `${window.location.pathname}${window.location.search}`;
  // Guards against React StrictMode's dev-only double-invoke of effects,
  // matching trackPageView's own dedupe in src/lib/analytics.ts.
  if (path === lastTrackedPath) return;
  lastTrackedPath = path;

  const payload = {
    visitor_id: getVisitorId(),
    path,
    title: document.title,
    referrer: document.referrer || undefined,
  };

  fetch(`${apiBase()}/api/v1/public/track/pageview`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(payload),
    keepalive: true,
  })
    .then((response) => (response.ok ? response.json() : null))
    .then((data: { page_view_id?: number } | null) => {
      if (!data?.page_view_id) return;
      currentPageViewId = data.page_view_id;
      resumeActiveTimer();
      attachLifecycleListeners();
      stopHeartbeat();
      heartbeatTimer = setInterval(() => sendHeartbeat(false), HEARTBEAT_INTERVAL_MS);
    })
    .catch(() => {
      // Tracking must never break the app.
    });
}
