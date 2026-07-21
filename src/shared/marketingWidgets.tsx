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
import { goToDomainCheckout, DomainPromoBadge, TldPriceCard, DomainFeatureItem, DomainSearchBar, DomainSearchSection, DomainGlobeIllustration } from "./domainWidgets";
import type { DomainFeature, PublicTldPricingRow } from "./domainWidgets";

export function PublicPage({
  children,
  seoOverrides,
}: {
  children: React.ReactNode;
  seoOverrides?: { title?: string; description?: string };
}) {
  useSeo(seoOverrides);

  return (
    <div className="min-h-screen overflow-x-hidden bg-background text-white">
      <Navbar logo={fallbackSiteContent.brand.logo} />
      <main className="pt-20">{children}</main>
      <Footer logo={fallbackSiteContent.brand.logo} />
      <FloatingWhatsApp />
    </div>
  );
}

export function PublicBreadcrumbs({ items, dark = false }: { items: Array<{ label: string; href?: string }>; dark?: boolean }) {
  return (
    <nav
      aria-label="Breadcrumb"
      className={`mx-auto flex max-w-7xl flex-wrap items-center gap-2 px-4 pt-8 text-xs font-bold sm:px-6 lg:px-8 ${dark ? "text-white/50" : "text-[#596273]"}`}
    >
      <a href="/" className="hover:text-primary">Home</a>
      {items.map((item, index) => (
        <span key={item.label} className="flex items-center gap-2">
          <span className={dark ? "text-white/20" : "text-black/25"}>/</span>
          {item.href && index < items.length - 1 ? (
            <a href={item.href} className="hover:text-primary">{item.label}</a>
          ) : (
            <span className={dark ? "text-white" : "text-[#07111f]"}>{item.label}</span>
          )}
        </span>
      ))}
    </nav>
  );
}

/**
 * Fetches a business-friendly Pexels image for a page hero/card via the
 * cached backend endpoint — never calls Pexels directly from the browser,
 * so the API key never reaches the client. Always renders the local
 * placeholder immediately so there's no layout shift while the real image
 * (or the fallback the backend itself returns) loads in.
 */
export function usePublicImage(query: string, orientation: "landscape" | "portrait" = "landscape") {
  const [image, setImage] = useState<{ url: string; alt_text: string } | null>(null);

  useEffect(() => {
    let isMounted = true;
    laravelApi<{ data: { url: string; alt_text: string } }>(
      `/api/v1/public/images/search?query=${encodeURIComponent(query)}&orientation=${orientation}`,
    )
      .then((response) => isMounted && setImage(response.data))
      .catch(() => undefined);
    return () => {
      isMounted = false;
    };
  }, [query, orientation]);

  return image;
}

export function MarketingHero({
  eyebrow,
  title,
  subtitle,
  ctaLabel,
  ctaHref,
  secondaryLabel,
  secondaryHref,
  imageQuery,
  dark = false,
}: {
  eyebrow: string;
  title: React.ReactNode;
  subtitle: string;
  ctaLabel: string;
  ctaHref: string;
  secondaryLabel?: string;
  secondaryHref?: string;
  imageQuery: string;
  dark?: boolean;
}) {
  const image = usePublicImage(imageQuery);

  return (
    <section className={dark ? "pub-section-dark" : "pub-section"}>
      <div className="mx-auto grid max-w-7xl gap-10 px-4 py-14 sm:px-6 lg:grid-cols-2 lg:items-center lg:px-8 lg:py-20">
        <div>
          <span className={dark ? "eyebrow" : "pub-eyebrow"}>{eyebrow}</span>
          <h1 className={`mt-4 text-4xl font-black leading-[1.08] sm:text-5xl ${dark ? "text-white" : "text-[#07111f]"}`}>{title}</h1>
          <p className={`mt-5 max-w-xl text-base leading-8 sm:text-lg ${dark ? "text-white/62" : "text-[#596273]"}`}>{subtitle}</p>
          <div className="mt-8 flex flex-wrap gap-3">
            <a
              href={ctaHref}
              className="btn-primary justify-center"
              onClick={() => trackCtaClick({ button_text: ctaLabel, page_section: "marketing_hero", destination_url: ctaHref })}
            >
              {ctaLabel}
              <ArrowRight className="h-4 w-4" />
            </a>
            {secondaryLabel && secondaryHref && (
              <a
                href={secondaryHref}
                className={dark ? "btn-outline justify-center" : "btn-outline-light justify-center"}
                onClick={() => trackCtaClick({ button_text: secondaryLabel, page_section: "marketing_hero", destination_url: secondaryHref })}
              >
                {secondaryLabel}
              </a>
            )}
          </div>
        </div>
        <div className="relative">
          <img
            src={image?.url || "/images/placeholder-business.svg"}
            alt={image?.alt_text || String(title)}
            loading="eager"
            width={800}
            height={600}
            className="aspect-[4/3] w-full rounded-2xl object-cover shadow-[0_30px_80px_rgba(16,24,16,0.14)]"
          />
        </div>
      </div>
    </section>
  );
}

export function MarketingCtaBand({
  title,
  subtitle,
  ctaLabel,
  ctaHref,
  dark = false,
}: {
  title: string;
  subtitle: string;
  ctaLabel: string;
  ctaHref: string;
  dark?: boolean;
}) {
  return (
    <section className={dark ? "pub-section-tint-dark border-y border-white/8" : "pub-section-tint border-y border-black/5"}>
      <div className="mx-auto flex max-w-5xl flex-col items-center gap-5 px-4 py-16 text-center sm:px-6 lg:px-8">
        <h2 className={`text-3xl font-black sm:text-4xl ${dark ? "text-white" : "text-[#07111f]"}`}>{title}</h2>
        <p className={`max-w-2xl text-base leading-7 ${dark ? "text-white/62" : "text-[#596273]"}`}>{subtitle}</p>
        <a
          href={ctaHref}
          className="btn-primary justify-center"
          onClick={() => trackCtaClick({ button_text: ctaLabel, page_section: "marketing_cta_band", destination_url: ctaHref })}
        >
          {ctaLabel}
          <ArrowRight className="h-4 w-4" />
        </a>
      </div>
    </section>
  );
}

export const FaqAccordionItem: React.FC<{ question: string; answer: string; dark?: boolean }> = ({ question, answer, dark = false }) => {
  const [isOpen, setIsOpen] = useState(false);

  return (
    <div className={dark ? "pub-card-dark !p-0 overflow-hidden" : "pub-card !p-0 overflow-hidden"}>
      <button
        type="button"
        className="flex w-full items-center justify-between gap-4 px-5 py-4 text-left"
        onClick={() => setIsOpen((current) => !current)}
        aria-expanded={isOpen}
      >
        <span className={`text-sm font-black sm:text-base ${dark ? "text-white" : "text-[#07111f]"}`}>{question}</span>
        <ChevronDown className={`h-4 w-4 shrink-0 text-primary transition ${isOpen ? "rotate-180" : ""}`} />
      </button>
      {isOpen && (
        <p className={`border-t px-5 py-4 text-sm leading-7 ${dark ? "border-white/10 text-white/62" : "border-black/8 text-[#596273]"}`}>{answer}</p>
      )}
    </div>
  );
};

export const FaqAccordionGroup: React.FC<{ title?: string; items: Array<{ question: string; answer: string }>; dark?: boolean }> = ({ title, items, dark = false }) => {
  return (
    <div className="grid gap-3">
      {title && <h3 className={`text-lg font-black ${dark ? "text-white" : "text-[#07111f]"}`}>{title}</h3>}
      {items.map((item) => (
        <FaqAccordionItem key={item.question} question={item.question} answer={item.answer} dark={dark} />
      ))}
    </div>
  );
}
