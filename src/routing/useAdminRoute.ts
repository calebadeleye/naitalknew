import { useCallback, useEffect, useState } from "react";
import { trackPageView } from "../lib/analytics";

export type AdminSectionId =
  | "dashboard"
  | "logo"
  | "clientLogos"
  | "portfolio"
  | "testimonials"
  | "pricing"
  | "clients"
  | "products"
  | "orders"
  | "services"
  | "invoices"
  | "payments"
  | "support"
  | "provisioning"
  | "ispconfigMappings"
  | "ispconfigImport"
  | "auditLogs"
  | "paymentVerification"
  | "domains"
  | "domainOrders"
  | "domainTransfers"
  | "domainPricing";

const SECTION_PATHS: Record<AdminSectionId, string> = {
  dashboard: "",
  logo: "logo",
  clientLogos: "client-logos",
  portfolio: "portfolio",
  testimonials: "reviews",
  pricing: "pricing",
  clients: "clients",
  products: "products",
  orders: "orders",
  services: "services",
  invoices: "invoices",
  payments: "payments",
  support: "support",
  provisioning: "provisioning",
  ispconfigMappings: "ispconfig-mappings",
  ispconfigImport: "ispconfig-import",
  auditLogs: "audit-logs",
  paymentVerification: "payment-verification",
  domains: "domains",
  domainOrders: "domain-orders",
  domainTransfers: "domain-transfers",
  domainPricing: "domain-pricing",
};

const PATH_TO_SECTION: Record<string, AdminSectionId> = Object.fromEntries(
  Object.entries(SECTION_PATHS).map(([id, path]) => [path, id as AdminSectionId]),
);

const CLIENT_DETAIL_PATTERN = /^clients\/(\d+)$/;
const SERVICE_DETAIL_PATTERN = /^services\/(\d+)$/;

function segmentOf(pathname: string): string {
  return pathname.replace(/^\/admin\/?/, "").replace(/\/$/, "");
}

function parseSection(pathname: string): AdminSectionId {
  const segment = segmentOf(pathname);

  if (segment === "" || segment === "services/active") {
    return segment === "" ? "dashboard" : "services";
  }
  if (CLIENT_DETAIL_PATTERN.test(segment)) return "clients";
  if (SERVICE_DETAIL_PATTERN.test(segment)) return "services";

  return PATH_TO_SECTION[segment] ?? "dashboard";
}

function parseClientId(pathname: string): number | null {
  const match = segmentOf(pathname).match(CLIENT_DETAIL_PATTERN);
  return match ? Number(match[1]) : null;
}

function parseServiceId(pathname: string): number | null {
  const match = segmentOf(pathname).match(SERVICE_DETAIL_PATTERN);
  return match ? Number(match[1]) : null;
}

function parseIsServicesActive(pathname: string): boolean {
  return segmentOf(pathname) === "services/active";
}

export function adminPath(section: AdminSectionId): string {
  const suffix = SECTION_PATHS[section];
  return suffix ? `/admin/${suffix}` : "/admin";
}

export function adminClientDetailPath(clientId: number): string {
  return `/admin/clients/${clientId}`;
}

export function adminServiceDetailPath(serviceId: number): string {
  return `/admin/services/${serviceId}`;
}

export function navigateAdmin(path: string) {
  window.history.pushState(null, "", path);
  window.dispatchEvent(new Event("naitalk:admin-navigate"));
}

/**
 * Mirrors useClientRoute.ts's approach for /client/* — the URL path is the
 * single source of truth for which admin page is showing, so refresh, deep
 * links, and browser back/forward all just work. Query params (filters,
 * pagination) are preserved automatically since they live on the same URL.
 */
export function useAdminRoute() {
  const [section, setSection] = useState<AdminSectionId>(() => parseSection(window.location.pathname));
  const [search, setSearch] = useState<URLSearchParams>(() => new URLSearchParams(window.location.search));
  const [clientId, setClientId] = useState<number | null>(() => parseClientId(window.location.pathname));
  const [serviceId, setServiceId] = useState<number | null>(() => parseServiceId(window.location.pathname));
  const [isServicesActiveRoute, setIsServicesActiveRoute] = useState<boolean>(() => parseIsServicesActive(window.location.pathname));

  const sync = useCallback(() => {
    setSection(parseSection(window.location.pathname));
    setSearch(new URLSearchParams(window.location.search));
    setClientId(parseClientId(window.location.pathname));
    setServiceId(parseServiceId(window.location.pathname));
    setIsServicesActiveRoute(parseIsServicesActive(window.location.pathname));
  }, []);

  useEffect(() => {
    window.addEventListener("popstate", sync);
    window.addEventListener("naitalk:admin-navigate", sync);
    return () => {
      window.removeEventListener("popstate", sync);
      window.removeEventListener("naitalk:admin-navigate", sync);
    };
  }, [sync]);

  // Virtual page view for this SPA zone's internal (pushState) navigations.
  useEffect(() => {
    trackPageView();
  }, [section]);

  const navigate = useCallback((path: string) => {
    navigateAdmin(path);
  }, []);

  const navigateToSection = useCallback((sectionId: AdminSectionId) => {
    navigateAdmin(adminPath(sectionId));
  }, []);

  return { section, search, clientId, serviceId, isServicesActiveRoute, navigate, navigateToSection };
}
