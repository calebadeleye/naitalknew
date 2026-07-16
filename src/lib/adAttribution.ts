/**
 * Captures Google Ads / UTM attribution for the website-design landing page
 * and persists it in sessionStorage so it survives browsing/scrolling before
 * the quote form is submitted. A fresh ad click (new utm_ or gclid params in
 * the URL) overwrites the stored value; browsing with no ad params keeps
 * whatever was already captured instead of wiping it out.
 */

const STORAGE_KEY = "naitalk_ad_attribution";

const UTM_KEYS = ["utm_source", "utm_medium", "utm_campaign", "utm_term", "utm_content", "gclid"] as const;

export type AdAttribution = {
  utm_source: string;
  utm_medium: string;
  utm_campaign: string;
  utm_term: string;
  utm_content: string;
  gclid: string;
  referrer: string;
  landing_page: string;
};

function readStored(): AdAttribution | null {
  try {
    const raw = sessionStorage.getItem(STORAGE_KEY);
    return raw ? (JSON.parse(raw) as AdAttribution) : null;
  } catch {
    return null;
  }
}

function writeStored(attribution: AdAttribution): void {
  try {
    sessionStorage.setItem(STORAGE_KEY, JSON.stringify(attribution));
  } catch {
    // Private/incognito mode or storage disabled — attribution just won't persist across navigations.
  }
}

export function captureAdAttribution(): AdAttribution {
  if (typeof window === "undefined") {
    return { utm_source: "", utm_medium: "", utm_campaign: "", utm_term: "", utm_content: "", gclid: "", referrer: "", landing_page: "" };
  }

  const params = new URLSearchParams(window.location.search);
  const hasAdParams = UTM_KEYS.some((key) => Boolean(params.get(key)));
  const existing = readStored();

  if (!hasAdParams && existing) {
    return existing;
  }

  const attribution: AdAttribution = {
    utm_source: params.get("utm_source") || existing?.utm_source || "",
    utm_medium: params.get("utm_medium") || existing?.utm_medium || "",
    utm_campaign: params.get("utm_campaign") || existing?.utm_campaign || "",
    utm_term: params.get("utm_term") || existing?.utm_term || "",
    utm_content: params.get("utm_content") || existing?.utm_content || "",
    gclid: params.get("gclid") || existing?.gclid || "",
    referrer: existing?.referrer || document.referrer || "",
    landing_page: existing?.landing_page || window.location.href,
  };

  writeStored(attribution);
  return attribution;
}
