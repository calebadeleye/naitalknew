import React, { useEffect, useMemo, useState } from "react";
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
import { PublicPage, PublicBreadcrumbs, usePublicImage, MarketingHero, MarketingCtaBand, FaqAccordionItem, FaqAccordionGroup } from "./marketingWidgets";
import { goToDomainCheckout, DomainPromoBadge, TldPriceCard, DomainFeatureItem, DomainSearchBar, DomainSearchSection, DomainGlobeIllustration } from "./domainWidgets";
import type { DomainFeature, PublicTldPricingRow } from "./domainWidgets";

export const navItems = [
  { label: "Home", href: "/" },
  { label: "Solutions", href: "/website-design" },
];

export const staticNavGroups = [
  {
    label: "Hosting",
    items: [
      { label: "Web Hosting", href: "/web-hosting" },
      { label: "Website Care Plans", href: "/website-care-plans" },
      { label: "Business Email Hosting", href: "/business-email-hosting" },
    ],
  },
  {
    label: "Domains",
    items: [
      { label: "Search Domain", href: "/domains" },
      { label: "Domain Registration", href: "/domain-registration" },
      { label: "Domain Transfer", href: "/domain-transfer" },
      { label: "Domain Pricing", href: "/domain-pricing" },
      { label: "Domain Renewal", href: "/domain-renewal" },
    ],
  },
  {
    label: "Website",
    items: [
      { label: "Website Design", href: "/website-design" },
      { label: "Portfolio", href: "/portfolio" },
    ],
  },
  {
    label: "Company",
    items: [
      { label: "About", href: "/about" },
      { label: "Contact", href: "/contact" },
    ],
  },
];

export const guestAccountGroup = {
  label: "Account",
  items: [
    { label: "Client Login", href: "/client/login" },
    { label: "Create Account", href: "/client/register" },
  ],
};

export const authenticatedAccountGroup = {
  label: "My Account",
  items: [
    { label: "Dashboard", href: "/client/dashboard" },
    { label: "My Services", href: "/client/dashboard" },
    { label: "My Invoices", href: "/client/dashboard" },
    { label: "Order Hosting", href: "/client/order/hosting" },
    { label: "Logout", href: "/client/dashboard" },
  ],
};

export function Logo({ className = "", logo = fallbackSiteContent.brand.logo }: { className?: string; logo?: LogoImage }) {
  return (
    <a href="/" className={`inline-flex items-center ${className}`} aria-label="NAITALK home">
      <img src={logo.src || "/logo.png"} alt={logo.alt || "NAITALK"} className="h-8 w-auto max-w-[150px] object-contain sm:h-9" />
    </a>
  );
}


export function Navbar({ logo }: { logo: LogoImage }) {
  const [isOpen, setIsOpen] = useState(false);
  const [isAuthenticated, setIsAuthenticated] = useState(() => hasClientToken());

  useEffect(() => {
    document.body.style.overflow = isOpen ? "hidden" : "";
    return () => {
      document.body.style.overflow = "";
    };
  }, [isOpen]);

  useEffect(() => {
    const token = sessionStorage.getItem("naitalk_laravel_client_token");
    if (!token) {
      setIsAuthenticated(false);
      return;
    }

    let isMounted = true;
    laravelApi("/api/v1/auth/me", token)
      .then(() => isMounted && setIsAuthenticated(true))
      .catch(() => {
        if (isMounted) {
          sessionStorage.removeItem("naitalk_laravel_client_token");
          setIsAuthenticated(false);
        }
      });

    return () => {
      isMounted = false;
    };
  }, []);

  const handleLogout = async () => {
    const token = sessionStorage.getItem("naitalk_laravel_client_token");
    if (token) {
      await laravelApi("/api/v1/auth/logout", token, { method: "POST" }).catch(() => undefined);
    }
    sessionStorage.removeItem("naitalk_laravel_client_token");
    setIsOpen(false);
    window.location.href = "/";
  };

  const navGroups = [...staticNavGroups, isAuthenticated ? authenticatedAccountGroup : guestAccountGroup];

  return (
    <>
      <header className="fixed inset-x-0 top-0 z-50 border-b border-white/10 bg-[#030505]/85 backdrop-blur-xl">
      <div className="mx-auto flex h-20 max-w-7xl items-center justify-between px-4 sm:px-6 lg:px-8">
        <Logo logo={logo} />

        <nav className="hidden items-center gap-4 lg:flex" aria-label="Primary navigation">
          {navItems.map((item) => (
            <a
              key={item.href}
              href={item.href}
              className="text-[11px] font-extrabold uppercase text-white/78 transition hover:text-primary"
            >
              {item.label}
            </a>
          ))}
          {navGroups.map((group) => (
            <div key={group.label} className="group/nav relative">
              <button
                type="button"
                className="inline-flex h-10 items-center gap-1.5 px-2 text-[11px] font-extrabold uppercase text-white/78 transition hover:text-primary"
              >
                {group.label}
                <ChevronDown className="h-3.5 w-3.5" />
              </button>
              <div className="invisible absolute left-0 top-full z-50 min-w-48 translate-y-2 rounded-lg border border-white/10 bg-[#041015]/95 p-2 opacity-0 shadow-[0_18px_70px_rgba(0,0,0,0.35)] backdrop-blur-xl transition group-hover/nav:visible group-hover/nav:translate-y-0 group-hover/nav:opacity-100">
                {group.items.map((item) => (
                  <a
                    key={item.label}
                    href={item.href}
                    onClick={(event) => {
                      if (item.label === "Logout") {
                        event.preventDefault();
                        void handleLogout();
                        return;
                      }
                      trackCtaClick({ button_text: item.label, page_section: "navbar", destination_url: item.href });
                    }}
                    className="block rounded-md px-3 py-3 text-xs font-extrabold uppercase text-white/68 transition hover:bg-primary/10 hover:text-primary"
                  >
                    {item.label}
                  </a>
                ))}
              </div>
            </div>
          ))}
        </nav>

        <div className="hidden items-center gap-3 sm:flex">
          <a
            href="#contact"
            className="btn-primary"
            onClick={() => trackCtaClick({ button_text: "Start a project", page_section: "navbar" })}
          >
            Start a project
            <ArrowRight className="h-4 w-4" />
          </a>
        </div>

        <button
          type="button"
          className="inline-flex h-11 w-11 items-center justify-center rounded-full border border-white/10 text-white lg:hidden"
          aria-label="Open menu"
          onClick={() => setIsOpen(true)}
        >
          <Menu className="h-5 w-5" />
        </button>
      </div>
      </header>

      {isOpen && (
          <div className="fixed inset-0 z-50 overflow-y-auto bg-[#030505] px-4 py-5 lg:hidden">
            <div className="flex items-center justify-between">
              <Logo logo={logo} />
              <button
                type="button"
                className="inline-flex h-11 w-11 items-center justify-center rounded-full border border-white/10 text-white"
                aria-label="Close menu"
                onClick={() => setIsOpen(false)}
              >
                <X className="h-5 w-5" />
              </button>
            </div>
            <nav className="mt-10 grid gap-3">
              {navItems.map((item) => (
                <a
                  key={item.href}
                  href={item.href}
                  onClick={() => setIsOpen(false)}
                  className="rounded-lg border border-white/10 bg-white/[0.03] px-4 py-4 text-sm font-extrabold uppercase text-white"
                >
                  {item.label}
                </a>
              ))}
              {navGroups.map((group) => (
                <div key={group.label} className="rounded-lg border border-white/10 bg-white/[0.03] p-3">
                  <div className="px-1 text-[10px] font-black uppercase text-primary">{group.label}</div>
                  <div className="mt-3 grid gap-2">
                    {group.items.map((item) => (
                      <a
                        key={item.label}
                        href={item.href}
                        onClick={(event) => {
                          if (item.label === "Logout") {
                            event.preventDefault();
                            void handleLogout();
                            return;
                          }
                          trackCtaClick({ button_text: item.label, page_section: "navbar_mobile", destination_url: item.href });
                          setIsOpen(false);
                        }}
                        className="rounded-md border border-white/8 bg-black/20 px-3 py-3 text-sm font-extrabold uppercase text-white/78"
                      >
                        {item.label}
                      </a>
                    ))}
                  </div>
                </div>
              ))}
              <a
                href="#contact"
                onClick={() => {
                  trackCtaClick({ button_text: "Start a project", page_section: "navbar_mobile" });
                  setIsOpen(false);
                }}
                className="btn-primary mt-3 justify-center"
              >
                Start a project
                <ArrowRight className="h-4 w-4" />
              </a>
            </nav>
          </div>
      )}
    </>
  );
}

export const socialLinks = [
  [Twitter, "Twitter", "https://twitter.com/naitalkc"],
  [Facebook, "Facebook", "https://facebook.com/naitalk"],
  [Linkedin, "LinkedIn", "https://www.linkedin.com/company/naitalk/"],
] as const;

export const footerColumns: Array<{ title: string; links: Array<{ label: string; href: string }> }> = [
  {
    title: "Company",
    links: [
      { label: "About NAI TALK", href: "/about" },
      { label: "Contact Us", href: "/contact" },
      { label: "Portfolio", href: "/portfolio" },
      { label: "Blog", href: "/blog" },
      { label: "Knowledge Base", href: "/knowledge-base" },
    ],
  },
  {
    title: "Services",
    links: [
      { label: "Website Design", href: "/website-design" },
      { label: "Website Care Plans", href: "/website-care-plans" },
      { label: "Web Hosting", href: "/web-hosting" },
      { label: "Business Email Hosting", href: "/business-email-hosting" },
      { label: "SEO Services", href: "/seo-services" },
    ],
  },
  {
    title: "Domains",
    links: [
      { label: "Domain Registration", href: "/domain-registration" },
      { label: "Domain Transfer", href: "/domain-transfer" },
      { label: "Domain Renewal", href: "/domain-renewal" },
      { label: "Domain Pricing", href: "/domain-pricing" },
      { label: "Search Domain", href: "/domains" },
    ],
  },
  {
    title: "Support",
    links: [
      { label: "Client Area", href: "/client/dashboard" },
      { label: "How to Pay", href: "/how-to-pay" },
      { label: "Service Status", href: "/service-status" },
      { label: "FAQs", href: "/faqs" },
    ],
  },
];

export const paymentBadges = [
  { label: "Visa", classes: "bg-white text-[#1a1f71]" },
  { label: "Mastercard", classes: "bg-white text-[#eb001b]" },
  { label: "Verve", classes: "bg-white text-[#00833e]" },
];


export function Footer({ logo }: { logo: LogoImage }) {
  return (
    <>
      <footer className="border-t border-white/10 pt-14">
        <div className="mx-auto grid max-w-7xl gap-10 px-4 sm:px-6 lg:grid-cols-[1.2fr_1fr_1fr_1fr_1.1fr] lg:gap-6 lg:px-8">
          <div>
            <h3 className="text-sm font-black text-white">Get in Touch</h3>
            <ul className="mt-4 grid gap-3 text-sm text-white/58">
              <li className="flex items-start gap-2">
                <Mail className="mt-0.5 h-4 w-4 shrink-0 text-primary" />
                <a
                  href="mailto:info@naitalk.com"
                  className="transition hover:text-primary"
                  onClick={() => trackEvent("email_click", { page_section: "footer" })}
                >
                  info@naitalk.com
                </a>
              </li>
              <li className="flex items-start gap-2">
                <Phone className="mt-0.5 h-4 w-4 shrink-0 text-primary" />
                <a
                  href="tel:+2347087057654"
                  className="transition hover:text-primary"
                  onClick={() => trackEvent("phone_click", { page_section: "footer" })}
                >
                  0708 705 7654
                </a>
              </li>
              <li className="flex items-start gap-2">
                <MapPin className="mt-0.5 h-4 w-4 shrink-0 text-primary" />
                <span>7 Unity Rd, Off Command Rd, Ikola, Lagos.</span>
              </li>
            </ul>
            <div className="mt-5 flex gap-3">
              {socialLinks.map(([Icon, label, href]) => (
                <a
                  key={label}
                  href={href}
                  target="_blank"
                  rel="noopener noreferrer"
                  aria-label={label}
                  className="flex h-9 w-9 items-center justify-center rounded-full border border-white/10 text-white/55 transition hover:border-primary/40 hover:text-primary"
                >
                  {React.createElement(Icon, { className: "h-4 w-4" })}
                </a>
              ))}
            </div>
            <div className="mt-5 rounded-lg border border-white/10 bg-white/[0.03] p-4">
              <div className="flex h-9 w-9 items-center justify-center rounded-full border border-primary/30 bg-primary/10 text-primary">
                <Headphones className="h-4 w-4" />
              </div>
              <p className="mt-3 text-sm font-black text-white">Need Help?</p>
              <p className="mt-1 text-xs leading-5 text-white/50">Our support team is ready to assist you.</p>
              <a
                href={whatsappUrl}
                className="mt-2 inline-flex items-center gap-1 text-xs font-bold text-primary hover:underline"
                onClick={() => trackEvent("whatsapp_click", { page_section: "footer" })}
              >
                Open a Ticket
                <ArrowRight className="h-3 w-3" />
              </a>
            </div>
          </div>

          {footerColumns.map((column) => (
            <div key={column.title}>
              <h3 className="text-sm font-black text-white">{column.title}</h3>
              <ul className="mt-4 grid gap-3 text-sm text-white/58">
                {column.links.map((link) => (
                  <li key={link.label}>
                    <a href={link.href} className="transition hover:text-primary">{link.label}</a>
                  </li>
                ))}
              </ul>
            </div>
          ))}
        </div>

        <div className="mx-auto mt-10 flex max-w-7xl flex-col gap-4 border-t border-white/10 px-4 py-6 sm:px-6 lg:flex-row lg:items-center lg:justify-between lg:px-8">
          <div className="flex items-center gap-3">
            <Logo logo={logo} />
            <p className="text-xs text-white/48">© {new Date().getFullYear()} NAI TALK. All rights reserved.</p>
          </div>

          <div className="flex flex-wrap items-center gap-x-4 gap-y-2 text-xs text-white/48">
            <a href="/privacy-policy" className="hover:text-primary">Privacy Policy</a>
            <span className="text-white/20">|</span>
            <a href="/terms-of-service" className="hover:text-primary">Terms of Service</a>
            <span className="text-white/20">|</span>
            <a href="/refund-policy" className="hover:text-primary">Refund Policy</a>
            <span className="text-white/20">|</span>
            <a href="/sitemap.xml" className="hover:text-primary">Sitemap</a>
          </div>

          <div className="flex items-center gap-3">
            <span className="text-xs text-white/55">We accept:</span>
            <div className="flex gap-1.5">
              {paymentBadges.map((badge) => (
                <span key={badge.label} className={`rounded px-2 py-1 text-[10px] font-black uppercase ${badge.classes}`}>
                  {badge.label}
                </span>
              ))}
            </div>
            <button
              type="button"
              onClick={() => window.scrollTo({ top: 0, behavior: "smooth" })}
              aria-label="Back to top"
              className="flex h-9 w-9 items-center justify-center rounded-full bg-primary text-on-primary transition hover:brightness-95"
            >
              <ArrowUp className="h-4 w-4" />
            </button>
          </div>
        </div>
      </footer>
    </>
  );
}


export function FloatingWhatsApp() {
  return (
    <a
      href={whatsappUrl}
      aria-label="Chat with NAITALK on WhatsApp"
      className="fixed bottom-5 right-5 z-40 flex h-14 w-14 items-center justify-center rounded-full bg-[#25D366] text-white shadow-[0_12px_40px_rgba(37,211,102,0.35)] transition hover:scale-105"
      onClick={() => trackEvent("whatsapp_click", { page_section: "floating_button" })}
    >
      <MessageCircle className="h-7 w-7" />
    </a>
  );
}


export function SectionHeader({
  eyebrow,
  title,
  align = "center",
  headingLevel = "h2",
}: {
  eyebrow: string;
  title: React.ReactNode;
  align?: "center" | "left";
  // Every other call site sits below a page-level h1 already (the
  // homepage's Hero, marketing-page heroes, ...) where h2 is correct.
  // Portfolio is the one exception -- reused standalone on /portfolio,
  // where this heading IS the page's only heading and needs to be the
  // real h1 for a sighted-nav/SEO structure, not just styled to look like
  // one. Same className either way, so this never changes appearance.
  headingLevel?: "h1" | "h2";
}) {
  const Heading = headingLevel;
  return (
    <div className={align === "center" ? "mx-auto max-w-2xl text-center" : "max-w-2xl"}>
      <span className="eyebrow">{eyebrow}</span>
      <Heading className="mt-3 text-3xl font-black leading-tight text-white sm:text-4xl">{title}</Heading>
    </div>
  );
}

