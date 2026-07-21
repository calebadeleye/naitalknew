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
import type { LogoImage, ClientLogo, Project, Review, SiteContent, HostingPlanCard, ServiceCatalogItem, ClientOrderSummary, BankTransferDetails, PricingPackage, AdminDashboardMetric, AdminDashboardSnapshot, ClientDashboardSnapshot, ClientAuthMode, LaravelPage, AdminRecordsSectionId } from "../shared/types";
import { LARAVEL_API_BASE_URL, laravelApi } from "../shared/api";
import { parseNairaAmount, formatNaira, formatKobo, toDateInputValue, formatDate, formatDateTime, accountTypeLabel, clientStatusPillClass, hostingStatusPillClass, formatMb, catalogCategoryIcon, ISO_DATE_PATTERN } from "../shared/format";
import { fallbackClientLogos, fallbackProjects, fallbackReviews, fallbackSiteContent, whatsappUrl } from "../shared/siteDefaults";
import { Logo, Navbar, Footer, FloatingWhatsApp, SectionHeader, socialLinks, paymentBadges, footerColumns } from "../shared/PublicLayout";
import { PublicPage, PublicBreadcrumbs, usePublicImage, MarketingHero, MarketingCtaBand, FaqAccordionItem, FaqAccordionGroup } from "../shared/marketingWidgets";
import { goToDomainCheckout, DomainPromoBadge, TldPriceCard, DomainFeatureItem, DomainSearchBar, DomainSearchSection, DomainGlobeIllustration } from "../shared/domainWidgets";
import type { DomainFeature, PublicTldPricingRow } from "../shared/domainWidgets";

/**
 * Standalone /domains page — same section as the homepage, wrapped in the
 * site's normal nav/footer for direct navigation and deep links.
 */
export const DOMAIN_WHY_NAI_TALK = [
  { icon: ShieldCheck, title: "Real-time availability", description: "We check the registry directly, so you never pay for a domain that's already taken." },
  { icon: RefreshCw, title: "Renewal reminders & auto-renewal", description: "Never lose a domain to a forgotten expiry date — we remind you and can renew automatically." },
  { icon: Wallet, title: "Flexible payment", description: "Pay by card, bank transfer, or your NAI TALK wallet — whichever suits your business." },
  { icon: Headphones, title: "Real human support", description: "Questions about your domain? Reach us on WhatsApp or a support ticket, any time." },
];

export const DOMAIN_FAQ_ITEMS = [
  { question: "Can I buy only a domain without hosting?", answer: "Yes. You can register or transfer a domain on its own and add hosting to it whenever you're ready — there's no requirement to buy both together." },
  { question: "Can I buy hosting later after buying a domain?", answer: "Absolutely. From your dashboard, open the domain and choose \"Add Hosting\" — your existing registration stays exactly as it is." },
  { question: "Can I transfer my domain to NAI TALK?", answer: "Yes, as long as it's unlocked and you have its EPP/authorization code from your current registrar. Most transfers complete within a few days." },
  { question: "What happens if I don't renew my domain?", answer: "You'll get renewal reminders before the expiry date. If a domain does expire, there's usually a short grace period before it becomes available to the public again — but renewing on time is always the safest option." },
];

export function DomainsLandingPage() {
  const initialDomain = new URLSearchParams(window.location.search).get("domain") || undefined;
  useSeo();

  return (
    <div className="min-h-screen overflow-x-hidden bg-background text-white">
      <Navbar logo={fallbackSiteContent.brand.logo} />
      <main className="pt-20">
        <DomainSearchSection initialDomain={initialDomain} />

        <section className="pub-section-tint-dark border-y border-white/8">
          <div className="mx-auto max-w-7xl px-4 py-16 sm:px-6 lg:px-8">
            <div className="mx-auto max-w-2xl text-center">
              <span className="eyebrow">Why NAI TALK</span>
              <h2 className="mt-4 text-3xl font-black text-white sm:text-4xl">Why choose NAI TALK for domains</h2>
            </div>
            <div className="mt-10 grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
              {DOMAIN_WHY_NAI_TALK.map((item) => (
                <div key={item.title} className="pub-card-dark">
                  <div className="flex h-11 w-11 items-center justify-center rounded-lg border border-primary/30 bg-primary/10 text-primary">
                    <item.icon className="h-5 w-5" />
                  </div>
                  <h3 className="mt-4 text-base font-black text-white">{item.title}</h3>
                  <p className="mt-2 text-sm leading-6 text-white/62">{item.description}</p>
                </div>
              ))}
            </div>
          </div>
        </section>

        <section className="pub-section-dark">
          <div className="mx-auto max-w-3xl px-4 py-16 sm:px-6 lg:px-8">
            <div className="text-center">
              <span className="eyebrow">FAQ</span>
              <h2 className="mt-4 text-3xl font-black text-white">Domain questions, answered</h2>
            </div>
            <div className="mt-8">
              <FaqAccordionGroup dark items={DOMAIN_FAQ_ITEMS} />
            </div>
          </div>
        </section>

        <MarketingCtaBand
          title="Ready to find your domain?"
          subtitle="Search availability instantly and register in minutes — with hosting and email available in the same checkout if you want them."
          ctaLabel="Search Domain"
          ctaHref="#homepage-domain-search"
          dark
        />
      </main>
      <Footer logo={fallbackSiteContent.brand.logo} />
      <FloatingWhatsApp />
    </div>
  );
}

export function DomainRegistrationPage() {
  return (
    <PublicPage>
      <PublicBreadcrumbs items={[{ label: "Domains", href: "/domains" }, { label: "Domain Registration" }]} dark />
      <MarketingHero
        eyebrow="Domain Registration"
        title="Domain Registration in Nigeria for Businesses"
        subtitle="Your domain name is your business's address online. Search, register, and manage .com, .com.ng, .ng, .org and .net domains in minutes — with hosting and email available in the same checkout."
        ctaLabel="Search Domain"
        ctaHref="/domains"
        secondaryLabel="View Website Care Plans"
        secondaryHref="/website-care-plans"
        imageQuery="domain name website"
        dark
      />

      <section className="pub-section-dark">
        <div className="mx-auto grid max-w-7xl gap-10 px-4 py-16 sm:px-6 lg:grid-cols-2 lg:px-8">
          <div>
            <h2 className="text-2xl font-black text-white">What is a domain name?</h2>
            <p className="mt-3 text-base leading-7 text-white/62">
              A domain name is the address customers type to find your business online — like yourbusiness.com. It's what appears in your email address, on
              your business card, and in every Google search result for your brand. A good domain builds trust before a visitor even sees your website.
            </p>
          </div>
          <div>
            <h2 className="text-2xl font-black text-white">Why the right domain matters</h2>
            <p className="mt-3 text-base leading-7 text-white/62">
              A short, memorable domain that matches your business name makes it easier for customers to find you, remember you, and trust you. It also
              protects your brand from competitors registering it first.
            </p>
          </div>
        </div>
      </section>

      <section className="pub-section-tint-dark border-y border-white/8">
        <div className="mx-auto max-w-7xl px-4 py-16 sm:px-6 lg:px-8">
          <div className="mx-auto max-w-2xl text-center">
            <span className="eyebrow">Extensions we support</span>
            <h2 className="mt-4 text-3xl font-black text-white">Which extension fits your business?</h2>
          </div>
          <div className="mt-10 grid gap-4 sm:grid-cols-2 lg:grid-cols-5">
            {[
              [".com", "Global businesses"],
              [".com.ng", "Nigerian businesses"],
              [".ng", "Premium Nigerian identity"],
              [".org", "Organizations and NGOs"],
              [".net", "Networks and tech brands"],
            ].map(([tld, description]) => (
              <div key={tld} className="pub-card-dark text-center">
                <p className="text-2xl font-black text-primary">{tld}</p>
                <p className="mt-2 text-sm text-white/62">{description}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      <section className="pub-section-dark">
        <div className="mx-auto max-w-7xl px-4 py-16 sm:px-6 lg:px-8">
          <div className="mx-auto max-w-2xl text-center">
            <span className="eyebrow">How it works</span>
            <h2 className="mt-4 text-3xl font-black text-white">Search and register in minutes</h2>
          </div>
          <div className="mt-10 grid gap-4 sm:grid-cols-3">
            {[
              ["Search", "Type the name you want — we check real-time availability against the registry."],
              ["Choose", "Buy the domain only, or bundle it with hosting and a Website Care Plan in one checkout."],
              ["Manage", "Renew, auto-renew, and manage everything from your NAI TALK client dashboard."],
            ].map(([title, description], index) => (
              <div key={title} className="pub-card-dark">
                <span className="text-xs font-black uppercase text-primary">Step {index + 1}</span>
                <h3 className="mt-2 text-lg font-black text-white">{title}</h3>
                <p className="mt-2 text-sm leading-6 text-white/62">{description}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      <section className="pub-section-tint-dark border-y border-white/8">
        <div className="mx-auto max-w-5xl px-4 py-14 text-center sm:px-6 lg:px-8">
          <h2 className="text-2xl font-black text-white">Explore related services</h2>
          <div className="mt-6 flex flex-wrap justify-center gap-3 text-sm font-bold">
            <a href="/web-hosting" className="btn-outline">Web Hosting</a>
            <a href="/website-care-plans" className="btn-outline">Website Care Plans</a>
            <a href="/domain-transfer" className="btn-outline">Domain Transfer</a>
            <a href="/business-email-hosting" className="btn-outline">Business Email Hosting</a>
          </div>
        </div>
      </section>

      <MarketingCtaBand
        title="Find your domain today"
        subtitle="Search availability instantly — if your first choice is taken, we'll suggest similar available alternatives."
        ctaLabel="Search Domain"
        ctaHref="/domains"
        dark
      />
    </PublicPage>
  );
}

export function PublicDomainTransferPage() {
  return (
    <PublicPage>
      <PublicBreadcrumbs items={[{ label: "Domains", href: "/domains" }, { label: "Domain Transfer" }]} dark />
      <MarketingHero
        eyebrow="Domain Transfer"
        title="Transfer Your Domain to NAI TALK"
        subtitle="Move your domain to NAI TALK for easier management, renewal reminders, and support — with no downtime while the transfer completes."
        ctaLabel="Start Domain Transfer"
        ctaHref="/client/domains/transfer"
        secondaryLabel="Check Domain Pricing"
        secondaryHref="/domain-pricing"
        imageQuery="data transfer digital connection"
        dark
      />

      <section className="pub-section-dark">
        <div className="mx-auto max-w-4xl px-4 py-16 sm:px-6 lg:px-8">
          <h2 className="text-2xl font-black text-white">What domain transfer means</h2>
          <p className="mt-3 text-base leading-7 text-white/62">
            Transferring a domain moves its management from your current registrar to NAI TALK, without changing who owns it or affecting your website and
            email while the transfer is in progress. Your domain keeps working normally throughout.
          </p>

          <div className="mt-10 grid gap-4 sm:grid-cols-2">
            <div className="pub-card-dark">
              <div className="flex h-11 w-11 items-center justify-center rounded-lg border border-primary/30 bg-primary/10 text-primary">
                <KeyRound className="h-5 w-5" />
              </div>
              <h3 className="mt-4 text-base font-black text-white">EPP / Authorization code</h3>
              <p className="mt-2 text-sm leading-6 text-white/62">
                Your current registrar can provide this code — it proves you're authorized to move the domain. You'll enter it when you start the transfer.
              </p>
            </div>
            <div className="pub-card-dark">
              <div className="flex h-11 w-11 items-center justify-center rounded-lg border border-primary/30 bg-primary/10 text-primary">
                <ShieldCheck className="h-5 w-5" />
              </div>
              <h3 className="mt-4 text-base font-black text-white">Transfer eligibility</h3>
              <p className="mt-2 text-sm leading-6 text-white/62">
                Your domain must be unlocked at its current registrar and past any recent-registration lock period before it can be transferred.
              </p>
            </div>
          </div>

          <h2 className="mt-14 text-2xl font-black text-white">What to prepare</h2>
          <ul className="mt-4 grid gap-3 text-sm leading-7 text-white/62">
            <li className="flex gap-3"><CheckCircle2 className="mt-0.5 h-4 w-4 shrink-0 text-primary" /> Unlock the domain with your current registrar.</li>
            <li className="flex gap-3"><CheckCircle2 className="mt-0.5 h-4 w-4 shrink-0 text-primary" /> Get your EPP/authorization code from them.</li>
            <li className="flex gap-3"><CheckCircle2 className="mt-0.5 h-4 w-4 shrink-0 text-primary" /> Make sure the domain isn't within 60 days of a previous transfer.</li>
          </ul>

          <h2 className="mt-14 text-2xl font-black text-white">The transfer process</h2>
          <p className="mt-3 text-base leading-7 text-white/62">
            Once you submit your domain and EPP code, we check eligibility immediately. Most transfers complete within a few days on the registry side, and
            you'll get a notification at each stage. Your new registration period is extended once the transfer completes, so you don't lose any time.
          </p>
        </div>
      </section>

      <MarketingCtaBand
        title="Ready to move your domain?"
        subtitle="Start your transfer today — our team is on hand if you have questions about your EPP code or eligibility."
        ctaLabel="Start Domain Transfer"
        ctaHref="/client/domains/transfer"
        dark
      />
    </PublicPage>
  );
}

export function DomainRenewalPage() {
  return (
    <PublicPage>
      <PublicBreadcrumbs items={[{ label: "Domains", href: "/domains" }, { label: "Domain Renewal" }]} dark />
      <MarketingHero
        eyebrow="Domain Renewal"
        title="Renew Your Domain Before It Expires"
        subtitle="An expired domain can take your website and email offline. Renewal reminders and auto-renewal keep your domain safely in your hands."
        ctaLabel="Renew Domain"
        ctaHref="/client/domains"
        secondaryLabel="Search a New Domain"
        secondaryHref="/domains"
        imageQuery="online business calendar reminder"
        dark
      />

      <section className="pub-section-dark">
        <div className="mx-auto max-w-4xl px-4 py-16 sm:px-6 lg:px-8">
          <div className="grid gap-6 sm:grid-cols-2">
            <div className="pub-card-dark">
              <div className="flex h-11 w-11 items-center justify-center rounded-lg border border-primary/30 bg-primary/10 text-primary">
                <Bell className="h-5 w-5" />
              </div>
              <h3 className="mt-4 text-base font-black text-white">Renewal reminders</h3>
              <p className="mt-2 text-sm leading-6 text-white/62">We email you well before your domain's expiry date, so it's never a surprise.</p>
            </div>
            <div className="pub-card-dark">
              <div className="flex h-11 w-11 items-center justify-center rounded-lg border border-primary/30 bg-primary/10 text-primary">
                <RefreshCw className="h-5 w-5" />
              </div>
              <h3 className="mt-4 text-base font-black text-white">Auto-renewal</h3>
              <p className="mt-2 text-sm leading-6 text-white/62">On by default — we renew automatically using your wallet or a saved card, so you never have to remember.</p>
            </div>
            <div className="pub-card-dark">
              <div className="flex h-11 w-11 items-center justify-center rounded-lg border border-primary/30 bg-primary/10 text-primary">
                <Wallet className="h-5 w-5" />
              </div>
              <h3 className="mt-4 text-base font-black text-white">Flexible payment</h3>
              <p className="mt-2 text-sm leading-6 text-white/62">Renew with your NAI TALK wallet, a saved card, bank transfer, or a fresh card payment.</p>
            </div>
            <div className="pub-card-dark">
              <div className="flex h-11 w-11 items-center justify-center rounded-lg border border-primary/30 bg-primary/10 text-primary">
                <ShieldCheck className="h-5 w-5" />
              </div>
              <h3 className="mt-4 text-base font-black text-white">Grace period</h3>
              <p className="mt-2 text-sm leading-6 text-white/62">Most extensions allow a short grace period after expiry — but renewing on time is always the safest option.</p>
            </div>
          </div>

          <h2 className="mt-14 text-2xl font-black text-white">What happens if a domain expires?</h2>
          <p className="mt-3 text-base leading-7 text-white/62">
            Your website and email tied to that domain may stop working. After a grace period, an expired domain can become available for anyone else to
            register — meaning you could lose it permanently. Turning on auto-renewal is the simplest way to avoid this entirely.
          </p>
        </div>
      </section>

      <MarketingCtaBand
        title="Don't risk losing your domain"
        subtitle="Turn on auto-renewal from your dashboard, or renew manually any time before your expiry date."
        ctaLabel="Renew Domain"
        ctaHref="/client/domains"
        dark
      />
    </PublicPage>
  );
}

export type PublicPricingRow = {
  tld: string;
  registration_price: string;
  renewal_price: string;
  transfer_price: string;
  best_for: string;
};

export function DomainPricingPage() {
  const [rows, setRows] = useState<PublicPricingRow[] | null>(null);
  const [isAvailable, setIsAvailable] = useState(true);

  useEffect(() => {
    laravelApi<{ data: PublicPricingRow[]; available: boolean }>("/api/v1/public/domains/pricing-table")
      .then((response) => {
        setRows(response.data);
        setIsAvailable(response.available);
      })
      .catch(() => {
        setRows([]);
        setIsAvailable(false);
      });
  }, []);

  return (
    <PublicPage>
      <PublicBreadcrumbs items={[{ label: "Domains", href: "/domains" }, { label: "Domain Pricing" }]} dark />
      <section className="pub-section-dark">
        <div className="mx-auto max-w-4xl px-4 pt-10 text-center sm:px-6 lg:px-8">
          <span className="eyebrow">Domain Pricing</span>
          <h1 className="mt-4 text-4xl font-black text-white sm:text-5xl">Domain Pricing</h1>
          <p className="mt-4 text-base leading-7 text-white/62">Transparent registration, renewal and transfer pricing — no hidden fees added at checkout.</p>
        </div>

        <div className="mx-auto max-w-5xl px-4 py-12 sm:px-6 lg:px-8">
          {rows === null ? (
            <div className="pub-card-dark text-center text-sm text-white/55">Loading pricing...</div>
          ) : !isAvailable || rows.length === 0 ? (
            <div className="pub-card-dark text-center text-sm font-bold text-white/55">Pricing temporarily unavailable. Please contact support.</div>
          ) : (
            <div className="overflow-x-auto rounded-2xl border border-white/10">
              <table className="w-full min-w-[640px] border-collapse bg-white/[0.02] text-left text-sm">
                <thead>
                  <tr className="border-b border-white/10 text-xs font-black uppercase text-white/55">
                    <th className="px-5 py-4">Extension</th>
                    <th className="px-5 py-4">Registration</th>
                    <th className="px-5 py-4">Renewal</th>
                    <th className="px-5 py-4">Transfer</th>
                    <th className="px-5 py-4">Best For</th>
                    <th className="px-5 py-4"></th>
                  </tr>
                </thead>
                <tbody>
                  {rows.map((row) => (
                    <tr key={row.tld} className="border-b border-white/8 last:border-0">
                      <td className="px-5 py-4 text-base font-black text-white">{row.tld}</td>
                      <td className="px-5 py-4 text-white/85">{row.registration_price}</td>
                      <td className="px-5 py-4 text-white/85">{row.renewal_price}</td>
                      <td className="px-5 py-4 text-white/85">{row.transfer_price}</td>
                      <td className="px-5 py-4 text-white/55">{row.best_for}</td>
                      <td className="px-5 py-4">
                        <a href={`/domains?domain=example${row.tld}`} className="btn-outline !min-h-9 !px-4 !text-[10px]">Search</a>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      </section>

      <MarketingCtaBand
        title="See it for your own business name"
        subtitle="Search your exact domain to see live availability and the price you'll actually pay."
        ctaLabel="Search Domain"
        ctaHref="/domains"
        dark
      />
    </PublicPage>
  );
}

