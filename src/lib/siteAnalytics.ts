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
// A visit only counts as a real person once the browser reports either an
// interaction or this much active time on the page — automated browsers that
// just load a page and leave never do either.
const ENGAGED_DWELL_SECONDS = 10;
const INTERACTION_EVENTS = ["scroll", "mousemove", "touchstart", "keydown", "pointerdown"] as const;

let lastTrackedPath = "";
let currentPageViewId: number | null = null;
let activeMs = 0;
let activeSince = 0;
let isActive = false;
let heartbeatTimer: ReturnType<typeof setInterval> | null = null;
let hasInteracted = false;

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

  const activeSeconds = currentActiveSeconds();
  const body = JSON.stringify({
    page_view_id: currentPageViewId,
    duration_seconds: activeSeconds,
    engaged: hasInteracted || activeSeconds >= ENGAGED_DWELL_SECONDS,
  });
  const url = `${apiBase()}/api/v1/public/track/heartbeat`;

  try {
    if (useBeacon && navigator.sendBeacon) {
      navigator.sendBeacon(url, new Blob([body], { type: "application/json" }));
      return;
    }
    fetch(url, { method: "POST", headers: { "Content-Type": "application/json" }, body, keepalive: true })?.catch(() => {});
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

function handleInteraction(): void {
  if (hasInteracted) return;
  hasInteracted = true;
  INTERACTION_EVENTS.forEach((eventName) => window.removeEventListener(eventName, handleInteraction));
  // Report right away rather than waiting for the next 15s heartbeat. If the
  // pageview hasn't come back yet (no id), the flag is sent as soon as it does.
  sendHeartbeat(false);
}

function attachInteractionListeners(): void {
  INTERACTION_EVENTS.forEach((eventName) => window.addEventListener(eventName, handleInteraction, { passive: true }));
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

export type FunnelName = "domain_hosting" | "website_quote";

/**
 * Records one conversion-funnel milestone against the site's own backend,
 * alongside whatever GA4 event already fires at the same call site (see
 * src/lib/analytics.ts) — this is what lets the admin Analytics tab build a
 * funnel chart without depending on Google/GTM. Fire-and-forget: never
 * throws, never blocks the UI. `valueKobo` is only meaningful on the
 * funnel's final ("purchase") step.
 */
export function trackSiteEvent(
  funnel: FunnelName,
  eventName: string,
  properties?: Record<string, string | number | boolean | null | undefined>,
  valueKobo?: number,
): void {
  if (typeof window === "undefined") return;

  const payload = {
    visitor_id: getVisitorId(),
    funnel,
    event_name: eventName,
    properties: properties && Object.keys(properties).length ? properties : undefined,
    value_kobo: valueKobo,
  };

  try {
    fetch(`${apiBase()}/api/v1/public/track/event`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(payload),
      keepalive: true,
    })?.catch(() => {});
  } catch {
    // Tracking must never break the app.
  }
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
    engagement_tracking: true,
  };

  attachInteractionListeners();

  try {
    fetch(`${apiBase()}/api/v1/public/track/pageview`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(payload),
      keepalive: true,
    })
      ?.then((response) => (response.ok ? response.json() : null))
      .then((data: { page_view_id?: number } | null) => {
        if (!data?.page_view_id) return;
        currentPageViewId = data.page_view_id;
        if (hasInteracted) sendHeartbeat(false);
        resumeActiveTimer();
        attachLifecycleListeners();
        stopHeartbeat();
        heartbeatTimer = setInterval(() => sendHeartbeat(false), HEARTBEAT_INTERVAL_MS);
      })
      .catch(() => {
        // Tracking must never break the app.
      });
  } catch {
    // Tracking must never break the app.
  }
}
