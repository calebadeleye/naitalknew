import { useCallback, useEffect, useState } from "react";
import { trackPageView } from "../lib/analytics";

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
  | "invoice-by-number"
  | "wallet"
  | "payment-methods"
  | "domain-search"
  | "domain-checkout"
  | "domain-transfer"
  | "domains"
  | "domain-detail"
  | "domain-contact"
  | "profile";

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
  "domains/search": "domain-search",
  "domains/checkout": "domain-checkout",
  "domains/transfer": "domain-transfer",
  domains: "domains",
  "domain-contact": "domain-contact",
  profile: "profile",
};

const HOSTING_MANAGE_PATTERN = /^services\/(\d+)\/manage$/;
const ORDER_NUMBER_PATTERN = /^orders\/([A-Za-z0-9-]+)$/;
const INVOICE_NUMBER_PATTERN = /^invoices\/([A-Za-z0-9-]+)$/;
const DOMAIN_DETAIL_PATTERN = /^domains\/(\d+)$/;

function parseRoute(pathname: string): ClientRouteName {
  const segment = pathname.replace(/^\/client\/?/, "").replace(/\/$/, "");

  if (HOSTING_MANAGE_PATTERN.test(segment)) return "hosting-manage";
  if (ORDER_NUMBER_PATTERN.test(segment)) return "invoice-detail";
  if (INVOICE_NUMBER_PATTERN.test(segment)) return "invoice-by-number";
  if (DOMAIN_DETAIL_PATTERN.test(segment)) return "domain-detail";

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

function parseInvoiceNumber(pathname: string): string | null {
  const segment = pathname.replace(/^\/client\/?/, "").replace(/\/$/, "");
  const match = segment.match(INVOICE_NUMBER_PATTERN);

  return match ? match[1] : null;
}

function parseDomainId(pathname: string): number | null {
  const segment = pathname.replace(/^\/client\/?/, "").replace(/\/$/, "");
  const match = segment.match(DOMAIN_DETAIL_PATTERN);

  return match ? Number(match[1]) : null;
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
  const [invoiceNumber, setInvoiceNumber] = useState<string | null>(() => parseInvoiceNumber(window.location.pathname));
  const [domainId, setDomainId] = useState<number | null>(() => parseDomainId(window.location.pathname));

  const sync = useCallback(() => {
    setRoute(parseRoute(window.location.pathname));
    setSearch(new URLSearchParams(window.location.search));
    setHostingServiceId(parseHostingServiceId(window.location.pathname));
    setOrderNumber(parseOrderNumber(window.location.pathname));
    setInvoiceNumber(parseInvoiceNumber(window.location.pathname));
    setDomainId(parseDomainId(window.location.pathname));
  }, []);

  useEffect(() => {
    window.addEventListener("popstate", sync);
    window.addEventListener("naitalk:navigate", sync);
    return () => {
      window.removeEventListener("popstate", sync);
      window.removeEventListener("naitalk:navigate", sync);
    };
  }, [sync]);

  // Virtual page view for this SPA zone's internal (pushState) navigations.
  // trackPageView dedupes against the initial App()-mount page_view, so the
  // very first render of /client/* doesn't get counted twice.
  useEffect(() => {
    trackPageView();
  }, [route]);

  const navigate = useCallback((path: string) => {
    navigateClient(path);
  }, []);

  return { route, search, hostingServiceId, orderNumber, invoiceNumber, domainId, navigate };
}
