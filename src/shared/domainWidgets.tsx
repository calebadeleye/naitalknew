import React, { useEffect, useMemo, useState } from "react";
import { AnimatePresence, motion } from "motion/react";
import type { LucideIcon } from "lucide-react";
import {
  ArrowRight,
  ArrowRightLeft,
  ArrowUp,
  ArrowUpRight,
  Activity,
  BadgeCheck,
  BarChart3,
  Bell,
  BookOpen,
  Bot,
  Briefcase,
  Building2,
  CalendarClock,
  CheckCircle2,
  ChevronDown,
  ChevronRight,
  Clock,
  Code2,
  CreditCard,
  Database,
  Download,
  ExternalLink,
  Eye,
  Facebook,
  FileText,
  Gift,
  Globe2,
  HardDrive,
  Headphones,
  HelpCircle,
  Home,
  Image as ImageIcon,
  KeyRound,
  LayoutDashboard,
  Link2,
  Linkedin,
  List,
  Loader2,
  LockKeyhole,
  LogOut,
  Mail,
  MapPin,
  Menu,
  MessageCircle,
  MonitorSmartphone,
  MousePointer2,
  MoreVertical,
  PackageCheck,
  Palette,
  Pencil,
  Phone,
  Plus,
  Power,
  Puzzle,
  RefreshCw,
  Rocket,
  Save,
  Search,
  Send,
  Server,
  Settings,
  ShieldCheck,
  Smile,
  Star,
  Trash2,
  Twitter,
  Upload,
  User,
  Users,
  Wallet,
  Wifi,
  X,
  Zap,
} from "lucide-react";
import { useToast } from "../toast/ToastProvider";
import { useSeo } from "../seo/useSeo";
import { useClientRoute, navigateClient, type ClientRouteName } from "../routing/useClientRoute";
import { useAdminRoute, adminPath, adminClientDetailPath, adminServiceDetailPath, type AdminSectionId } from "../routing/useAdminRoute";
import {
  consumePendingOrder,
  hasClientToken,
  savePendingOrder,
  startHostingOrder,
  savePendingPayment,
  peekPendingPayment,
  clearPendingPayment,
} from "../routing/pendingOrder";
import {
  trackPageView,
  trackEvent,
  trackViewOnce,
  trackGoogleAdsConversion,
  trackCtaClick,
  trackFormSubmission,
  trackDomainSearch,
  trackPlanSelection,
  trackCheckout,
  trackPurchase,
  initScrollDepthTracking,
} from "../lib/analytics";
import { captureAdAttribution } from "../lib/adAttribution";
import type { LogoImage, ClientLogo, Project, Review, SiteContent, HostingPlanCard, ServiceCatalogItem, ClientOrderSummary, BankTransferDetails, PricingPackage, AdminDashboardMetric, AdminDashboardSnapshot, ClientDashboardSnapshot, ClientAuthMode, LaravelPage, AdminRecordsSectionId } from "./types";
import { LARAVEL_API_BASE_URL, laravelApi } from "./api";
import { parseNairaAmount, formatNaira, formatKobo, toDateInputValue, formatDate, formatDateTime, accountTypeLabel, clientStatusPillClass, hostingStatusPillClass, formatMb, catalogCategoryIcon, ISO_DATE_PATTERN } from "./format";
import { fallbackClientLogos, fallbackProjects, fallbackReviews, fallbackSiteContent, whatsappUrl } from "./siteDefaults";
import { Logo, Navbar, Footer, FloatingWhatsApp, SectionHeader, socialLinks, paymentBadges, footerColumns } from "./PublicLayout";
import { PublicPage, PublicBreadcrumbs, usePublicImage, MarketingHero, MarketingCtaBand, FaqAccordionItem, FaqAccordionGroup } from "./marketingWidgets";

export type PublicDomainSuggestion = {
  domain: string;
  tld: string;
  registration_price_kobo: number;
  renewal_price_kobo: number;
  currency: string;
};

export type PublicDomainSearchResult = {
  domain: string;
  tld: string;
  available: boolean;
  tld_supported: boolean;
  premium: boolean;
  registration_price_kobo: number | null;
  renewal_price_kobo: number | null;
  transfer_price_kobo: number | null;
  currency: string | null;
  suggestions: PublicDomainSuggestion[];
};

export type PublicTldPricingRow = {
  tld: string;
  registration_price_kobo: number | null;
  registration_price: string | null;
};

export const DOMAIN_TLD_ORDER = [".com", ".ng", ".com.ng", ".org", ".net"];

export const DOMAIN_TLD_BADGES: Record<string, string> = {
  ".com": "Most Popular",
  ".ng": "Popular in Nigeria",
  ".com.ng": "Great for Businesses",
  ".org": "For Organizations",
  ".net": "For Networks",
};

export type DomainFeature = { icon: LucideIcon; title: string; description: string };

export const DOMAIN_FEATURES: DomainFeature[] = [
  { icon: Globe2, title: "Domain Registration", description: "Get the perfect domain for your business." },
  { icon: ArrowRightLeft, title: "Domain Transfer", description: "Move your domain to NAI TALK easily." },
  { icon: RefreshCw, title: "Renewals", description: "Never lose your domain with auto-renewal." },
  { icon: Settings, title: "Easy Management", description: "Manage all your domains in one simple dashboard." },
];

export function goToDomainCheckout(domain: string) {
  const domainExtension = domain.includes(".") ? domain.slice(domain.lastIndexOf(".")) : undefined;
  trackEvent("domain_purchase_start", { domain_extension: domainExtension });
  window.location.href = `/client/domains/search?domain=${encodeURIComponent(domain)}`;
}

/** Top-right promo pill: "Welcome to NAI TALK! Get 10% off ...". */
export function DomainPromoBadge() {
  return (
    <div className="domain-promo-badge">
      <span className="domain-promo-icon">
        <Gift className="h-5 w-5" />
      </span>
      <p>
        <strong>Welcome to NAI TALK!</strong>
        <br />
        <span>
          Get <b>10% off</b> your first domain search.
        </span>
      </p>
    </div>
  );
}

/** A single popular-TLD price card ("From ₦7,500 /yr", badge pill). */
export const TldPriceCard: React.FC<{ row: PublicTldPricingRow }> = ({ row }) => {
  return (
    <div className="domain-tld-card">
      <p>{row.tld}</p>
      <span>
        From <strong className="text-black">{row.registration_price} /yr</strong>
      </span>
      <small>
        {DOMAIN_TLD_BADGES[row.tld] || "Great value"}
      </small>
    </div>
  );
};

/** One item in the "Domain Registration / Transfer / Renewals / Easy Management" row. */
export const DomainFeatureItem: React.FC<{ feature: DomainFeature }> = ({ feature }) => {
  return (
    <div className="domain-feature-item">
      <span>
        <feature.icon className="h-5 w-5" strokeWidth={3} aria-hidden="true" />
      </span>
      <div>
        <p>{feature.title}</p>
        <small>{feature.description}</small>
      </div>
    </div>
  );
};

/** The domain search input + CTA button, with inline results/suggestions. */
export function DomainSearchBar({ initialDomain }: { initialDomain?: string } = {}) {
  const [domainInput, setDomainInput] = useState(initialDomain || "");
  const [isSearching, setIsSearching] = useState(false);
  const [result, setResult] = useState<PublicDomainSearchResult | null>(null);
  const [hasSearched, setHasSearched] = useState(false);
  const [searchError, setSearchError] = useState("");

  const search = async (domainOverride?: string) => {
    const domain = (domainOverride ?? domainInput).trim().toLowerCase();
    if (!domain) return;

    setIsSearching(true);
    setSearchError("");
    setResult(null);

    const domainExtension = domain.includes(".") ? domain.slice(domain.lastIndexOf(".")) : undefined;
    trackDomainSearch("query", { domain_extension: domainExtension });

    try {
      const data = await laravelApi<PublicDomainSearchResult>(`/api/v1/public/domains/search?domain=${encodeURIComponent(domain)}`);
      setResult(data);
      setHasSearched(true);
      trackDomainSearch("result", {
        domain_extension: domainExtension,
        available: data.available,
        search_result_count: 1 + (data.suggestions?.length || 0),
      });
    } catch (error) {
      setSearchError(error instanceof Error ? error.message : "Domain search is temporarily unavailable. Please try again shortly.");
    } finally {
      setIsSearching(false);
    }
  };

  useEffect(() => {
    if (initialDomain) {
      void search(initialDomain);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  return (
    <>
      <form
        className="domain-search-form"
        onSubmit={(event) => {
          event.preventDefault();
          void search();
        }}
      >
        <label htmlFor="homepage-domain-search" className="sr-only">
          Search for a domain name
        </label>
        <div className="domain-search-input-wrap">
          <Search className="h-7 w-7 shrink-0" aria-hidden="true" />
          <input
            id="homepage-domain-search"
            value={domainInput}
            onChange={(event) => setDomainInput(event.target.value)}
            placeholder="Search your domain e.g. mybusiness.com"
            className="w-full bg-transparent text-sm text-black placeholder:text-black/38 focus:outline-none sm:text-base"
          />
        </div>
        <button
          type="submit"
          disabled={isSearching}
          className="domain-search-button"
        >
          {isSearching ? "Searching..." : "Search Domain"}
          <ArrowRight className="h-5 w-5" aria-hidden="true" />
        </button>
      </form>

      {searchError && <p className="mt-3 text-sm font-bold text-red-600">{searchError}</p>}

      {hasSearched && result && (
        <div className="domain-search-result">
          <div className="flex items-center justify-between gap-3">
            <p className="text-lg font-black text-[#0b1210]">{result.domain}</p>
            <span
              className={`rounded-full px-3 py-1 text-xs font-black uppercase ${
                result.available ? "bg-primary/15 text-primary" : "bg-red-100 text-red-600"
              }`}
            >
              {result.available ? "Available" : result.tld_supported ? "Not Available" : "Not Supported"}
            </span>
          </div>

          {result.available && result.registration_price_kobo !== null && (
            <>
              <p className="mt-3 text-sm text-black/55">
                Registration (1 year): <strong className="text-black">{formatNaira(result.registration_price_kobo / 100)}</strong>
              </p>
              <button
                type="button"
                className="mt-4 flex w-full items-center justify-center gap-2 rounded-xl bg-primary px-5 py-3 text-sm font-black text-on-primary transition hover:brightness-95"
                onClick={() => goToDomainCheckout(result.domain)}
              >
                Buy This Domain
                <ArrowRight className="h-4 w-4" />
              </button>
            </>
          )}

          {result.available && result.registration_price_kobo === null && (
            <p className="mt-3 text-sm text-black/55">Pricing for this extension is being finalized — contact us to register it.</p>
          )}

          {!result.available && !result.tld_supported && (
            <p className="mt-3 text-sm text-black/55">
              This domain extension isn't currently supported for registration. Please try .com, .org, .net, or a different name.
            </p>
          )}

          {!result.available && result.tld_supported && (
            <>
              <p className="mt-3 text-sm text-black/55">That domain is already taken. Here are some available alternatives:</p>
              {result.suggestions.length > 0 ? (
                <div className="mt-4 grid gap-2 sm:grid-cols-2">
                  {result.suggestions.map((suggestion) => (
                    <button
                      key={suggestion.domain}
                      type="button"
                      onClick={() => goToDomainCheckout(suggestion.domain)}
                      className="flex items-center justify-between gap-2 rounded-xl border border-black/8 bg-[#f7fbf6] px-4 py-3 text-left transition hover:border-primary/40 hover:bg-primary/5"
                    >
                      <span className="text-sm font-bold text-black">{suggestion.domain}</span>
                      <span className="text-xs font-black text-primary">{formatNaira(suggestion.registration_price_kobo / 100)}</span>
                    </button>
                  ))}
                </div>
              ) : (
                <p className="mt-3 text-sm text-black/40">No alternatives found right now — try a different name.</p>
              )}
            </>
          )}
        </div>
      )}
    </>
  );
}

/**
 * Homepage-ready Domain Search & Management section — used both directly on
 * the public homepage and as the body of the standalone /domains page, so
 * the two never drift out of sync. TLD prices come from the real
 * admin-configured pricing endpoint, never hardcoded numbers.
 */
export function DomainSearchSection({ initialDomain }: { initialDomain?: string } = {}) {
  const [tldPricing, setTldPricing] = useState<PublicTldPricingRow[] | null>(null);

  useEffect(() => {
    laravelApi<{ data: PublicTldPricingRow[] }>("/api/v1/public/domains/pricing")
      .then((response) => setTldPricing(response.data || []))
      .catch(() => setTldPricing([]));
  }, []);

  // Always the real, admin-configured prices — never a hardcoded stand-in,
  // so a TLD only ever appears here once it's actually priced and active.
  // DOMAIN_TLD_ORDER is a display-order preference only — any TLD not in it
  // (a newly added one, say) still shows, just sorted after the curated set,
  // instead of being silently dropped.
  const orderedPricing = (tldPricing ?? []).length
    ? [...(tldPricing ?? [])].sort((a, b) => {
        const rankA = DOMAIN_TLD_ORDER.indexOf(a.tld);
        const rankB = DOMAIN_TLD_ORDER.indexOf(b.tld);
        const orderA = rankA === -1 ? DOMAIN_TLD_ORDER.length : rankA;
        const orderB = rankB === -1 ? DOMAIN_TLD_ORDER.length : rankB;
        return orderA !== orderB ? orderA - orderB : a.tld.localeCompare(b.tld);
      })
    : [];

  return (
    <section
      id="domains"
      className="domain-landing-section"
    >
      <div aria-hidden="true" className="domain-dot-field" />
      <div aria-hidden="true" className="domain-soft-glow domain-soft-glow-left" />
      <div aria-hidden="true" className="domain-soft-glow domain-soft-glow-right" />

      <div className="domain-landing-shell">
        <div className="domain-landing-topbar">
          <DomainPromoBadge />
        </div>

        <div className="domain-hero-grid">
          <div className="domain-copy-panel">
            <h2>
              Find the perfect domain
              <br />
              for <span className="text-primary">your business</span>
            </h2>
            <p>
              Start your online journey with the right domain name. Search, register, transfer, and manage your
              domain with ease.
            </p>

            <div className="domain-search-wrap">
              <DomainSearchBar initialDomain={initialDomain} />
            </div>
          </div>

          <DomainGlobeIllustration />

          <div className="domain-feature-row">
            {DOMAIN_FEATURES.map((feature) => (
              <DomainFeatureItem key={feature.title} feature={feature} />
            ))}
          </div>
        </div>

        <div className="domain-bottom-grid">
          {tldPricing === null && (
            <p className="col-span-full text-sm font-semibold text-white/45">Loading domain pricing…</p>
          )}

          {tldPricing !== null && orderedPricing.length === 0 && (
            <p className="col-span-full text-sm font-semibold text-white/45">
              Domain pricing is being finalized — check back shortly.
            </p>
          )}

          {orderedPricing.map((row) => (
            <TldPriceCard key={row.tld} row={row} />
          ))}

          <div className="domain-launch-panel">
            <span>
              <Rocket className="h-6 w-6" aria-hidden="true" />
            </span>
            <div>
              <p>Launch your brand online</p>
              <small>Your domain is the first step to building trust and growing your business.</small>
              <a href="#homepage-domain-search">
                Start your journey today
                <ArrowRight className="h-5 w-5" aria-hidden="true" />
              </a>
            </div>
          </div>
        </div>

        <div className="domain-trust-row">
          <div className="flex items-center gap-2">
            <ShieldCheck className="h-4 w-4 text-primary" aria-hidden="true" />
            Trusted by thousands of businesses
          </div>
          <div className="flex items-center gap-2 font-bold text-white/70">
            <span className="flex -space-x-2">
              {["A", "B", "C"].map((letter) => (
                <span
                  key={letter}
                  className="flex h-7 w-7 items-center justify-center rounded-full border-2 border-white bg-primary/20 text-[10px] font-black text-primary"
                >
                  {letter}
                </span>
              ))}
            </span>
            2K+ and counting
          </div>
          <div className="flex items-center gap-2">
            <LockKeyhole className="h-4 w-4 text-primary" aria-hidden="true" />
            Secure
          </div>
          <div className="flex items-center gap-2">
            <Headphones className="h-4 w-4 text-primary" aria-hidden="true" />
            24/7 Support
          </div>
          <div className="flex items-center gap-2">
            <BadgeCheck className="h-4 w-4 text-primary" aria-hidden="true" />
            Trusted Domain Partner
          </div>
        </div>
      </div>
    </section>
  );
}

/**
 * Shared shell for every marketing/content page — same dark Navbar/Footer
 * as the homepage. Content in between is being migrated page-by-page from
 * the older light `pub-*` styles to the dark-native styles (pass `dark` to
 * MarketingHero/MarketingCtaBand/FaqAccordionGroup/PublicBreadcrumbs on
 * migrated pages). seoOverrides falls back to the per-path defaults in
 * seo/pageSeoConfig.mjs when omitted.
 */

/**
 * Decorative approximation of the mockup's globe illustration — a dotted
 * sphere with floating UI cards. Purely visual, hidden on small screens.
 */
export function DomainGlobeIllustration() {
  return (
    <div className="domain-visual" aria-hidden="true">
      <div className="domain-orbit domain-orbit-one" />
      <div className="domain-orbit domain-orbit-two" />
      <div className="domain-orbit domain-orbit-three" />
      <div className="domain-globe">
        <div className="domain-globe-map domain-globe-map-left" />
        <div className="domain-globe-map domain-globe-map-right" />
        <div className="domain-globe-map domain-globe-map-top" />
      </div>

      <div className="domain-url-card">
        <div>
          <LockKeyhole className="h-4 w-4" />
          <span>
            https://www.your<strong>business</strong>.com
          </span>
        </div>
      </div>
      <MousePointer2 className="domain-cursor" />

      <div className="domain-floating-card domain-brand-card">
        <div className="flex items-center gap-2">
          <span>
            <Globe2 className="h-7 w-7" />
          </span>
          <div>
            <p>Your Brand</p>
            <small>
              .yourbusiness.com
              <CheckCircle2 className="h-3 w-3 text-primary" />
            </small>
          </div>
        </div>
      </div>

      <div className="domain-floating-card domain-secure-card">
        <div className="flex items-center gap-2">
          <span>
            <ShieldCheck className="h-7 w-7" />
          </span>
          <div>
            <p>Secure & Reliable</p>
            <small>
              Your domain is always protected
              <CheckCircle2 className="h-3 w-3 text-primary" />
            </small>
          </div>
        </div>
      </div>
    </div>
  );
}
