const PENDING_ORDER_KEY = "naitalk_pending_order";
const CLIENT_TOKEN_KEY = "naitalk_laravel_client_token";

export type PendingOrder = {
  plan: string;
  billing_cycle: "monthly" | "annual";
};

export function hasClientToken(): boolean {
  return Boolean(sessionStorage.getItem(CLIENT_TOKEN_KEY));
}

export function savePendingOrder(order: PendingOrder) {
  sessionStorage.setItem(PENDING_ORDER_KEY, JSON.stringify(order));
}

export function consumePendingOrder(): PendingOrder | null {
  const raw = sessionStorage.getItem(PENDING_ORDER_KEY);
  if (!raw) return null;

  sessionStorage.removeItem(PENDING_ORDER_KEY);

  try {
    const parsed = JSON.parse(raw);
    if (typeof parsed?.plan === "string") {
      return { plan: parsed.plan, billing_cycle: parsed.billing_cycle === "monthly" ? "monthly" : "annual" };
    }
  } catch {
    // ignore malformed session data
  }

  return null;
}

// Crossing from the public site into the client portal remounts a different
// top-level component tree (see App()'s pathname switch), so this always
// does a full navigation rather than a pushState transition.
export function startHostingOrder(slug: string) {
  if (hasClientToken()) {
    window.location.href = `/client/order/hosting?plan=${encodeURIComponent(slug)}`;
    return;
  }

  savePendingOrder({ plan: slug, billing_cycle: "annual" });
  window.location.href = "/client/register";
}
