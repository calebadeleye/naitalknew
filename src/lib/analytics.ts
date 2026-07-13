/**
 * Google Tag Manager / GA4 analytics utility.
 *
 * Every event flows through window.dataLayer, which the GTM snippet loaded
 * in index.html reads. GA4 itself (tags, triggers, the Measurement ID) is
 * configured entirely inside the GTM container — see docs/analytics-setup.md.
 * This file never talks to Google directly, so no API key or Measurement
 * Protocol secret is ever needed here.
 *
 * If VITE_GTM_ID is unset (e.g. local dev without a .env entry), every
 * export below becomes a safe no-op — nothing is pushed, nothing throws.
 */

declare global {
  interface Window {
    dataLayer: Record<string, unknown>[];
  }
}

type EventParamValue = string | number | boolean | null | undefined | Array<Record<string, unknown>>;
type EventParams = Record<string, EventParamValue>;

const GTM_ID = import.meta.env.VITE_GTM_ID;

function analyticsEnabled(): boolean {
  return typeof window !== "undefined" && Boolean(GTM_ID);
}

function pushToDataLayer(payload: Record<string, unknown>): void {
  if (!analyticsEnabled()) return;

  try {
    window.dataLayer = window.dataLayer || [];
    window.dataLayer.push(payload);
  } catch {
    // Analytics must never break the app.
  }
}

/** Generic event push — prefer a typed helper below where one exists. */
export function trackEvent(eventName: string, params: EventParams = {}): void {
  pushToDataLayer({ event: eventName, ...params });
}

let lastPageViewPath = "";

/**
 * Fires a page_view with the GA4-recommended shape. Safe to call from
 * multiple mount points (initial app load + SPA route-change hooks) —
 * repeat calls with an unchanged path (e.g. React StrictMode's dev-only
 * double-invoke of effects) are deduped automatically.
 */
export function trackPageView(pathOverride?: string): void {
  if (typeof window === "undefined") return;

  const page_path = pathOverride ?? `${window.location.pathname}${window.location.search}`;
  if (page_path === lastPageViewPath) return;
  lastPageViewPath = page_path;

  pushToDataLayer({
    event: "page_view",
    page_location: window.location.href,
    page_path,
    page_title: document.title,
  });
}

export function trackCtaClick(params: {
  button_text: string;
  page_section?: string;
  destination_url?: string;
}): void {
  trackEvent("cta_click", params);
}

/**
 * Fires `${formName}_submit` on success or `${formName}_error` on failure,
 * e.g. trackFormSubmission("contact_form", "success") -> contact_form_submit.
 */
export function trackFormSubmission(formName: string, status: "success" | "error", params: EventParams = {}): void {
  trackEvent(`${formName}_${status === "success" ? "submit" : "error"}`, params);
}

export function trackDomainSearch(
  stage: "query" | "result",
  params: {
    domain_extension?: string;
    search_result_count?: number;
    available?: boolean;
  } = {},
): void {
  trackEvent(stage === "query" ? "domain_search" : "domain_search_result", params);
}

const firedOnceKeys = new Set<string>();

/**
 * Fires eventName exactly once per unique key for this page's lifetime.
 * Guards mount-effect "view" events (plan views, content views) against
 * React StrictMode's dev-only double-invoke of effects, without needing a
 * useRef guard at every call site. Real repeat views still fire normally,
 * since the public site's pages are each a fresh full page load (fresh JS
 * module state), not a client-side route change within one page.
 */
export function trackViewOnce(key: string, eventName: string, params: EventParams = {}): void {
  if (firedOnceKeys.has(key)) return;
  firedOnceKeys.add(key);
  trackEvent(eventName, params);
}

export function trackPlanSelection(
  stage: "view" | "select" | "buy_click",
  params: {
    plan_id?: string;
    plan_name?: string;
    billing_cycle?: string;
  } = {},
): void {
  if (stage === "view") {
    trackViewOnce(`hosting_plan_view:${window.location.pathname}`, "hosting_plan_view", params);
    return;
  }
  trackEvent(stage === "select" ? "hosting_plan_select" : "buy_hosting_click", params);
}

export function trackCheckout(params: {
  plan_id?: string;
  plan_name?: string;
  billing_cycle?: string;
  value?: number;
  currency?: string;
}): void {
  trackEvent("checkout_begin", params);
}

type PurchaseItem = {
  item_id: string;
  item_name: string;
  price: number;
  quantity: number;
};

const PURCHASE_TRACKED_KEY_PREFIX = "naitalk_ga_purchased_";
const trackedPurchasesThisSession = new Set<string>();

/**
 * Fires the GA4-recommended `purchase` event exactly once per
 * transaction_id — guarded by localStorage (so it survives the redirect to
 * and back from Paystack/Flutterwave) with an in-memory Set as a fallback
 * if storage is unavailable (e.g. private browsing).
 */
export function trackPurchase(params: {
  transaction_id: string;
  value: number;
  currency: string;
  items: PurchaseItem[];
  payment_method?: string;
}): void {
  if (!params.transaction_id || trackedPurchasesThisSession.has(params.transaction_id)) return;

  const storageKey = `${PURCHASE_TRACKED_KEY_PREFIX}${params.transaction_id}`;
  try {
    if (localStorage.getItem(storageKey)) {
      trackedPurchasesThisSession.add(params.transaction_id);
      return;
    }
    localStorage.setItem(storageKey, "1");
  } catch {
    // Private/incognito mode or storage disabled — fall back to the in-memory guard only.
  }

  trackedPurchasesThisSession.add(params.transaction_id);
  trackEvent("purchase", params);
}

const SCROLL_DEPTH_THRESHOLDS = [25, 50, 75, 90];

/**
 * Attaches a scroll listener that fires scroll_depth once per threshold
 * (25/50/75/90% of scrollable height) for the current page. Returns a
 * cleanup function — call from a page-level useEffect.
 */
export function initScrollDepthTracking(): () => void {
  if (typeof window === "undefined") return () => {};

  const firedThresholds = new Set<number>();

  const handleScroll = () => {
    const scrollableHeight = document.documentElement.scrollHeight - window.innerHeight;
    if (scrollableHeight <= 0) return;

    const scrolledPercent = (window.scrollY / scrollableHeight) * 100;

    for (const threshold of SCROLL_DEPTH_THRESHOLDS) {
      if (scrolledPercent >= threshold && !firedThresholds.has(threshold)) {
        firedThresholds.add(threshold);
        trackEvent("scroll_depth", { percent_scrolled: threshold, page_path: window.location.pathname });
      }
    }
  };

  window.addEventListener("scroll", handleScroll, { passive: true });
  return () => window.removeEventListener("scroll", handleScroll);
}
