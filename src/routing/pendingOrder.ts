const PENDING_ORDER_KEY = "naitalk_pending_order";
const PENDING_PAYMENT_KEY = "naitalk_pending_payment";
const CLIENT_TOKEN_KEY = "naitalk_laravel_client_token";

// Bridges the order/plan details needed for a GA4 `purchase` event across a
// full-page redirect to Paystack/Flutterwave and back (React state doesn't
// survive that round trip). Keyed by invoice_number so the redirect-return
// handler only ever reads back the payment it's expecting.
export type PendingPayment = {
  invoice_number: string;
  order_number: string;
  value: number;
  currency: string;
  plan_id: string;
  plan_name: string;
  billing_cycle: "monthly" | "annual";
  payment_method?: string;
};

export function savePendingPayment(payment: PendingPayment) {
  sessionStorage.setItem(PENDING_PAYMENT_KEY, JSON.stringify(payment));
}

export function peekPendingPayment(invoiceNumber: string): PendingPayment | null {
  const raw = sessionStorage.getItem(PENDING_PAYMENT_KEY);
  if (!raw) return null;

  try {
    const parsed = JSON.parse(raw) as Partial<PendingPayment>;
    return parsed?.invoice_number === invoiceNumber ? (parsed as PendingPayment) : null;
  } catch {
    return null;
  }
}

export function clearPendingPayment() {
  sessionStorage.removeItem(PENDING_PAYMENT_KEY);
}

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
