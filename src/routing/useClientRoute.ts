import { useCallback, useEffect, useState } from "react";

export type ClientRouteName =
  | "login"
  | "register"
  | "forgot"
  | "reset"
  | "verify-email"
  | "dashboard"
  | "services-catalog"
  | "order-hosting"
  | "order-review"
  | "checkout"
  | "orders"
  | "hosting-manage"
  | "invoice-detail"
  | "wallet"
  | "payment-methods";

const ROUTE_SEGMENTS: Record<string, ClientRouteName> = {
  login: "login",
  register: "register",
  "forgot-password": "forgot",
  "reset-password": "reset",
  "verify-email": "verify-email",
  dashboard: "dashboard",
  "services/catalog": "services-catalog",
  "order/hosting": "order-hosting",
  "order/review": "order-review",
  checkout: "checkout",
  orders: "orders",
  wallet: "wallet",
  "payment-methods": "payment-methods",
};

const HOSTING_MANAGE_PATTERN = /^services\/(\d+)\/manage$/;
const ORDER_NUMBER_PATTERN = /^orders\/([A-Za-z0-9-]+)$/;

function parseRoute(pathname: string): ClientRouteName {
  const segment = pathname.replace(/^\/client\/?/, "").replace(/\/$/, "");

  if (HOSTING_MANAGE_PATTERN.test(segment)) return "hosting-manage";
  if (ORDER_NUMBER_PATTERN.test(segment)) return "invoice-detail";

  for (const [prefix, route] of Object.entries(ROUTE_SEGMENTS)) {
    if (segment === prefix) return route;
  }

  return "login";
}

function parseHostingServiceId(pathname: string): number | null {
  const segment = pathname.replace(/^\/client\/?/, "").replace(/\/$/, "");
  const match = segment.match(HOSTING_MANAGE_PATTERN);

  return match ? Number(match[1]) : null;
}

function parseOrderNumber(pathname: string): string | null {
  const segment = pathname.replace(/^\/client\/?/, "").replace(/\/$/, "");
  const match = segment.match(ORDER_NUMBER_PATTERN);

  return match ? match[1] : null;
}

export function navigateClient(path: string) {
  window.history.pushState(null, "", path);
  window.dispatchEvent(new Event("naitalk:navigate"));
}

export function useClientRoute() {
  const [route, setRoute] = useState<ClientRouteName>(() => parseRoute(window.location.pathname));
  const [search, setSearch] = useState<URLSearchParams>(() => new URLSearchParams(window.location.search));
  const [hostingServiceId, setHostingServiceId] = useState<number | null>(() => parseHostingServiceId(window.location.pathname));
  const [orderNumber, setOrderNumber] = useState<string | null>(() => parseOrderNumber(window.location.pathname));

  const sync = useCallback(() => {
    setRoute(parseRoute(window.location.pathname));
    setSearch(new URLSearchParams(window.location.search));
    setHostingServiceId(parseHostingServiceId(window.location.pathname));
    setOrderNumber(parseOrderNumber(window.location.pathname));
  }, []);

  useEffect(() => {
    window.addEventListener("popstate", sync);
    window.addEventListener("naitalk:navigate", sync);
    return () => {
      window.removeEventListener("popstate", sync);
      window.removeEventListener("naitalk:navigate", sync);
    };
  }, [sync]);

  const navigate = useCallback((path: string) => {
    navigateClient(path);
  }, []);

  return { route, search, hostingServiceId, orderNumber, navigate };
}
