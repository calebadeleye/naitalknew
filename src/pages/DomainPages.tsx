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

/** Real, published guides — linked from the domain pages so each page and article supports the other. */
const DOMAIN_GUIDES = [
  { href: "/blog/how-much-does-domain-registration-cost-in-nigeria", label: "How much does domain registration cost in Nigeria?" },
  { href: "/blog/com-vs-comng-vs-ng-which-domain-should-your-business-use", label: ".com vs .com.ng vs .ng — which should your business use?" },
  { href: "/blog/how-to-choose-the-perfect-domain-name-for-your-nigerian-business", label: "How to choose the perfect domain name for your business" },
];

type DomainPriceColumn = "registration" | "renewal" | "transfer";

const DOMAIN_PRICE_COLUMN_LABELS: Record<DomainPriceColumn, string> = {
  registration: "Register (per year)",
  renewal: "Renew (per year)",
  transfer: "Transfer",
};

/**
 * The live, admin-configured price list (same endpoint as /domain-pricing),
 * so these pages can never advertise an extension or a price that checkout
 * doesn't actually offer. The prerender pass waits for it, so the prices are
 * in the HTML search engines read too.
 */
function LiveDomainPriceTable({ columns, showSearch = true }: { columns: DomainPriceColumn[]; showSearch?: boolean }) {
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

  if (rows === null) {
    return <div className="pub-card-dark text-center text-sm text-white/55">Loading pricing...</div>;
  }

  if (!isAvailable || rows.length === 0) {
    return (
      <div className="pub-card-dark text-center text-sm font-bold text-white/55">
        Pricing temporarily unavailable. Please <a href="/contact" className="text-primary underline">contact us</a> for a quote.
      </div>
    );
  }

  const priceFor = (row: PublicPricingRow, column: DomainPriceColumn) =>
    column === "registration" ? row.registration_price : column === "renewal" ? row.renewal_price : row.transfer_price;

  return (
    <div>
      <div className="overflow-x-auto rounded-2xl border border-white/10">
        <table className="w-full min-w-[560px] border-collapse bg-white/[0.02] text-left text-sm">
          <thead>
            <tr className="border-b border-white/10 text-xs font-black uppercase text-white/55">
              <th className="px-5 py-4">Extension</th>
              {columns.map((column) => (
                <th key={column} className="px-5 py-4">{DOMAIN_PRICE_COLUMN_LABELS[column]}</th>
              ))}
              <th className="px-5 py-4">Best for</th>
              {showSearch && <th className="px-5 py-4"></th>}
            </tr>
          </thead>
          <tbody>
            {rows.map((row) => (
              <tr key={row.tld} className="border-b border-white/8 last:border-0">
                <td className="px-5 py-4 text-base font-black text-white">{row.tld}</td>
                {columns.map((column) => (
                  <td key={column} className="px-5 py-4 text-white/85">{priceFor(row, column)}</td>
                ))}
                <td className="px-5 py-4 text-white/55">{row.best_for}</td>
                {showSearch && (
                  <td className="px-5 py-4">
                    <a href={`/domains?domain=example${row.tld}`} className="btn-outline !min-h-9 !px-4 !text-[10px]">Search</a>
                  </td>
                )}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      <p className="mt-3 text-xs text-white/45">Prices are in naira, per year. VAT is added at checkout where it applies.</p>
    </div>
  );
}

function DomainGuideLinks({ title = "Helpful guides" }: { title?: string }) {
  return (
    <div className="pub-card-dark">
      <h3 className="flex items-center gap-2 text-base font-black text-white">
        <BookOpen className="h-4 w-4 text-primary" /> {title}
      </h3>
      <ul className="mt-3 grid gap-2 text-sm">
        {DOMAIN_GUIDES.map((guide) => (
          <li key={guide.href}>
            <a href={guide.href} className="inline-flex items-start gap-2 text-white/75 hover:text-primary">
              <ChevronRight className="mt-0.5 h-4 w-4 shrink-0 text-primary" /> {guide.label}
            </a>
          </li>
        ))}
      </ul>
    </div>
  );
}

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

const DOMAIN_REGISTRATION_STEPS = [
  ["Search for your name", "Type the name you want. We check live availability with the registry and suggest close alternatives if it's already taken."],
  ["Choose your extension", "Pick the extension that fits — and add hosting, business email or a Website Care Plan in the same checkout, or just buy the domain."],
  ["Sign in or create an account", "Your client account is where you'll manage the domain. You enter the owner (registrant) details once, and the domain is registered in your name."],
  ["Pay the way you prefer", "Pay by card, bank transfer or your NAI TALK wallet. Card and wallet payments confirm instantly; bank transfers once we've verified them."],
  ["Manage it from your dashboard", "Your domain appears in your dashboard with its expiry date, nameservers, renewal history and auto-renewal switch."],
] as const;

const DOMAIN_REGISTRATION_FAQ_ITEMS = [
  {
    question: "How much does it cost to register a domain in Nigeria?",
    answer: "It depends on the extension. The table on this page shows our current price for every extension we offer, per year, in naira — the same prices you'll see at checkout, plus VAT where it applies.",
  },
  {
    question: "Which extension should I choose — .com or .com.ng?",
    answer: ".com is recognised everywhere and suits businesses with customers outside Nigeria; .com.ng tells visitors you're a Nigerian business and is usually the more affordable choice. Many businesses register both so no one else can take either.",
  },
  {
    question: "Can I register a domain without buying hosting?",
    answer: "Yes. You can register a domain on its own and add hosting or business email later from your dashboard — your registration stays exactly as it is.",
  },
  {
    question: "Who owns the domain once I register it?",
    answer: "You do. The domain is registered with your details as the owner (registrant), and you manage it from your own client account.",
  },
  {
    question: "Can I pay by bank transfer?",
    answer: "Yes — card, bank transfer and your NAI TALK wallet are all accepted. A bank transfer is confirmed once we've verified the payment, after which registration goes ahead.",
  },
  {
    question: "I already have a domain with another provider. What should I do?",
    answer: "You don't need to register it again. You can transfer it to NAI TALK with the EPP/authorisation code from your current provider, or keep it where it is and point it to your NAI TALK hosting.",
  },
];

export function DomainRegistrationPage() {
  return (
    <PublicPage>
      <PublicBreadcrumbs items={[{ label: "Domains", href: "/domains" }, { label: "Domain Registration" }]} dark />
      <MarketingHero
        eyebrow="Domain Registration"
        title="Domain Registration in Nigeria"
        subtitle="Register a new domain name for your business in minutes. Check live availability, see clear prices for .com, .com.ng and more, and pay by card, bank transfer or wallet — with real support if you need help."
        ctaLabel="Search for a Domain"
        ctaHref="#register-domain-search"
        secondaryLabel="See Domain Prices"
        secondaryHref="#domain-prices"
        imageQuery="domain name website"
        dark
      />

      <section id="register-domain-search" className="pub-section-tint-dark scroll-mt-24 border-y border-white/8">
        <div className="mx-auto max-w-4xl px-4 py-14 sm:px-6 lg:px-8">
          <div className="text-center">
            <span className="eyebrow">Register a new domain</span>
            <h2 className="mt-4 text-3xl font-black text-white">Check if your domain name is available</h2>
            <p className="mt-3 text-base leading-7 text-white/62">Search your business name — you'll see availability and the exact price straight away.</p>
          </div>
          <div className="mt-8">
            <DomainSearchBar />
          </div>
        </div>
      </section>

      <section id="domain-prices" className="pub-section-dark scroll-mt-24">
        <div className="mx-auto max-w-5xl px-4 py-16 sm:px-6 lg:px-8">
          <div className="mx-auto max-w-2xl text-center">
            <span className="eyebrow">Domain extensions & prices</span>
            <h2 className="mt-4 text-3xl font-black text-white">Domain prices in Nigeria</h2>
            <p className="mt-3 text-base leading-7 text-white/62">
              Every extension we currently offer, with the price to register, renew and transfer it. No hidden fees are added at checkout.
            </p>
          </div>
          <div className="mt-10">
            <LiveDomainPriceTable columns={["registration", "renewal", "transfer"]} />
          </div>
        </div>
      </section>

      <section className="pub-section-tint-dark border-y border-white/8">
        <div className="mx-auto max-w-7xl px-4 py-16 sm:px-6 lg:px-8">
          <div className="mx-auto max-w-2xl text-center">
            <span className="eyebrow">How it works</span>
            <h2 className="mt-4 text-3xl font-black text-white">How to register a new domain</h2>
          </div>
          <ol className="mt-10 grid gap-4 sm:grid-cols-2 lg:grid-cols-5">
            {DOMAIN_REGISTRATION_STEPS.map(([title, description], index) => (
              <li key={title} className="pub-card-dark">
                <span className="text-xs font-black uppercase text-primary">Step {index + 1}</span>
                <h3 className="mt-2 text-base font-black text-white">{title}</h3>
                <p className="mt-2 text-sm leading-6 text-white/62">{description}</p>
              </li>
            ))}
          </ol>
        </div>
      </section>

      <section className="pub-section-dark">
        <div className="mx-auto grid max-w-7xl gap-10 px-4 py-16 sm:px-6 lg:grid-cols-2 lg:px-8">
          <div>
            <h2 className="text-2xl font-black text-white">What is a domain name?</h2>
            <p className="mt-3 text-base leading-7 text-white/62">
              A domain name is the address customers type to find your business online — like yourbusiness.com.ng. It's also what appears in your
              business email address, on your business card and in every Google search result for your brand. A short, memorable domain that matches your
              business name builds trust before a visitor even sees your website, and registering it early stops someone else from taking it.
            </p>
            <h2 className="mt-10 text-2xl font-black text-white">Buying a domain in Nigeria with NAI TALK</h2>
            <ul className="mt-4 grid gap-3 text-sm leading-7 text-white/62">
              {[
                "Prices in naira, shown before you pay — no surprise fees at checkout.",
                "Pay by card, bank transfer or your NAI TALK wallet.",
                "Renewal reminders by email and auto-renewal, so your domain doesn't lapse.",
                "Hosting and professional business email available in the same checkout.",
                "Help from a real person on WhatsApp or through a support ticket.",
              ].map((point) => (
                <li key={point} className="flex gap-3"><CheckCircle2 className="mt-1 h-4 w-4 shrink-0 text-primary" /> {point}</li>
              ))}
            </ul>
          </div>
          <div className="grid content-start gap-4">
            <div className="pub-card-dark">
              <h3 className="flex items-center gap-2 text-base font-black text-white"><ArrowRightLeft className="h-4 w-4 text-primary" /> Already have a domain?</h3>
              <p className="mt-2 text-sm leading-6 text-white/62">
                Move it to NAI TALK with your EPP code — see <a href="/domain-transfer" className="text-primary underline">domain transfer</a>. If it's
                already with us and expiring soon, go to <a href="/domain-renewal" className="text-primary underline">domain renewal</a>.
              </p>
            </div>
            <div className="pub-card-dark">
              <h3 className="flex items-center gap-2 text-base font-black text-white"><Server className="h-4 w-4 text-primary" /> Need a website or email too?</h3>
              <p className="mt-2 text-sm leading-6 text-white/62">
                Add <a href="/web-hosting" className="text-primary underline">web hosting</a> and{" "}
                <a href="/business-email-hosting" className="text-primary underline">business email</a> to the same order, or let us{" "}
                <a href="/website-design" className="text-primary underline">design your website</a>.
              </p>
            </div>
            <DomainGuideLinks title="Choosing a domain: our guides" />
          </div>
        </div>
      </section>

      <section className="pub-section-tint-dark border-y border-white/8">
        <div className="mx-auto max-w-3xl px-4 py-16 sm:px-6 lg:px-8">
          <div className="text-center">
            <span className="eyebrow">FAQ</span>
            <h2 className="mt-4 text-3xl font-black text-white">Domain registration questions</h2>
          </div>
          <div className="mt-8">
            <FaqAccordionGroup dark items={DOMAIN_REGISTRATION_FAQ_ITEMS} />
          </div>
          <p className="mt-8 text-center text-sm text-white/55">
            Still unsure which domain to choose?{" "}
            <a href="/contact" className="font-bold text-primary underline">Ask our team</a> — we'll help you pick.
          </p>
        </div>
      </section>

      <MarketingCtaBand
        title="Register your domain today"
        subtitle="Search availability instantly — if your first choice is taken, we'll suggest similar names that are available."
        ctaLabel="Search for a Domain"
        ctaHref="#register-domain-search"
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

const DOMAIN_RENEWAL_WHATSAPP_HREF = `${whatsappUrl.split("?")[0]}?text=${encodeURIComponent("Hello NAI TALK, I need help renewing my domain.")}`;

const DOMAIN_RENEWAL_STEPS = [
  ["Sign in to your client area", "Use the email and password for your NAI TALK account."],
  ["Open Domains and pick the domain", "You'll see its expiry date, its renewal price per year and whether auto-renewal is on."],
  ["Click Renew", "We create a renewal invoice for one year at the renewal price shown below."],
  ["Pay the invoice", "Pay by card, bank transfer or your NAI TALK wallet."],
  ["Your new expiry date appears", "Once payment is confirmed the renewal is sent to the registry and the new expiry date shows on your dashboard."],
] as const;

const DOMAIN_RENEWAL_FAQ_ITEMS = [
  {
    question: "How do I renew my domain name?",
    answer: "If the domain is with NAI TALK: sign in, open Domains, choose the domain, click Renew and pay the invoice by card, bank transfer or wallet. If it's with another provider, renew it there or transfer it to us.",
  },
  {
    question: "Do I lose the remaining time if I renew early?",
    answer: "No. For most extensions the new year is added on top of your current expiry date, so renewing early never shortens your registration.",
  },
  {
    question: "Can I renew a domain that has already expired?",
    answer: "Often, yes — but act quickly. Most extensions allow renewal for a short period after expiry, and some then have a restoration period that costs more. Contact us straight away with the domain name and we'll tell you what's possible.",
  },
  {
    question: "How long does a renewal last?",
    answer: "Renewals from your dashboard are billed one year at a time, at the renewal price for that extension.",
  },
  {
    question: "How do I turn auto-renewal on or off?",
    answer: "Open the domain in your dashboard and use the Enable / Disable Auto-Renew button. Auto-renewal pays from your NAI TALK wallet or a saved card you've marked for auto-renewal, so keep one of them ready.",
  },
  {
    question: "My domain is registered somewhere else. Can you renew it?",
    answer: "We can only renew domains managed by NAI TALK. Renew it with your current provider, or transfer it to us with its EPP/authorisation code and manage future renewals from your NAI TALK dashboard.",
  },
];

export function DomainRenewalPage() {
  return (
    <PublicPage>
      <PublicBreadcrumbs items={[{ label: "Domains", href: "/domains" }, { label: "Domain Renewal" }]} dark />
      <MarketingHero
        eyebrow="Domain Renewal"
        title="Renew Your Domain Name"
        subtitle="Keep your website and business email online. Renew a domain registered with NAI TALK in a few clicks, pay by card, bank transfer or wallet, and turn on auto-renewal so it never lapses."
        ctaLabel="Renew in Your Dashboard"
        ctaHref="/client/domains"
        secondaryLabel="Domain With Another Provider?"
        secondaryHref="#renew-elsewhere"
        imageQuery="online business calendar reminder"
        dark
      />

      <section className="pub-section-tint-dark border-y border-white/8">
        <div className="mx-auto max-w-7xl px-4 py-16 sm:px-6 lg:px-8">
          <div className="mx-auto max-w-2xl text-center">
            <span className="eyebrow">Step by step</span>
            <h2 className="mt-4 text-3xl font-black text-white">How to renew your domain</h2>
            <p className="mt-3 text-base leading-7 text-white/62">For domains registered with or transferred to NAI TALK.</p>
          </div>
          <ol className="mt-10 grid gap-4 sm:grid-cols-2 lg:grid-cols-5">
            {DOMAIN_RENEWAL_STEPS.map(([title, description], index) => (
              <li key={title} className="pub-card-dark">
                <span className="text-xs font-black uppercase text-primary">Step {index + 1}</span>
                <h3 className="mt-2 text-base font-black text-white">{title}</h3>
                <p className="mt-2 text-sm leading-6 text-white/62">{description}</p>
              </li>
            ))}
          </ol>
          <div className="mt-8 text-center">
            <a href="/client/domains" className="btn-primary justify-center">Renew My Domain <ArrowRight className="h-4 w-4" /></a>
          </div>
        </div>
      </section>

      <section className="pub-section-dark">
        <div className="mx-auto max-w-5xl px-4 py-16 sm:px-6 lg:px-8">
          <div className="mx-auto max-w-2xl text-center">
            <span className="eyebrow">Renewal prices</span>
            <h2 className="mt-4 text-3xl font-black text-white">Domain renewal prices</h2>
            <p className="mt-3 text-base leading-7 text-white/62">What it costs to renew each extension for another year.</p>
          </div>
          <div className="mt-10">
            {/* Renewal is for a domain you already own — no "search new domain" buttons here. */}
            <LiveDomainPriceTable columns={["renewal"]} showSearch={false} />
          </div>
        </div>
      </section>

      <section className="pub-section-tint-dark border-y border-white/8">
        <div className="mx-auto max-w-4xl px-4 py-16 sm:px-6 lg:px-8">
          <div className="mx-auto max-w-2xl text-center">
            <span className="eyebrow">Never miss an expiry date</span>
            <h2 className="mt-4 text-3xl font-black text-white">Auto-renewal and expiry reminders</h2>
          </div>
          <div className="mt-10 grid gap-4 sm:grid-cols-2">
            <div className="pub-card-dark">
              <div className="flex h-11 w-11 items-center justify-center rounded-lg border border-primary/30 bg-primary/10 text-primary">
                <RefreshCw className="h-5 w-5" />
              </div>
              <h3 className="mt-4 text-base font-black text-white">Auto-renewal</h3>
              <p className="mt-2 text-sm leading-6 text-white/62">
                On by default for your domains. It renews from your NAI TALK wallet or a saved card you've marked for auto-renewal — keep one of them
                ready. You can switch it off for any domain from your dashboard.
              </p>
            </div>
            <div className="pub-card-dark">
              <div className="flex h-11 w-11 items-center justify-center rounded-lg border border-primary/30 bg-primary/10 text-primary">
                <Bell className="h-5 w-5" />
              </div>
              <h3 className="mt-4 text-base font-black text-white">Expiry reminders</h3>
              <p className="mt-2 text-sm leading-6 text-white/62">
                We email you 30, 14, 7 and 1 day before your domain expires, and on the expiry date — unless you've turned renewal reminders off in your
                account preferences.
              </p>
            </div>
          </div>
        </div>
      </section>

      <section className="pub-section-dark">
        <div className="mx-auto max-w-4xl px-4 py-16 sm:px-6 lg:px-8">
          <h2 className="text-2xl font-black text-white">What happens if your domain expires?</h2>
          <p className="mt-3 text-base leading-7 text-white/62">
            When a domain expires, the website and business email that use it can stop working. What happens next depends on the extension:
          </p>
          <ul className="mt-4 grid gap-3 text-sm leading-7 text-white/62">
            <li className="flex gap-3"><Clock className="mt-1 h-4 w-4 shrink-0 text-primary" /> <span><strong className="text-white">Grace period.</strong> For a short time after expiry, the domain can usually still be renewed at the normal price.</span></li>
            <li className="flex gap-3"><ShieldCheck className="mt-1 h-4 w-4 shrink-0 text-primary" /> <span><strong className="text-white">Redemption.</strong> For .com, .net and .org, there's then a period of about 30 days when the domain can only be restored for an extra fee.</span></li>
            <li className="flex gap-3"><Globe2 className="mt-1 h-4 w-4 shrink-0 text-primary" /> <span><strong className="text-white">Released.</strong> After that, the domain is deleted and anyone can register it — including a competitor.</span></li>
          </ul>
          <p className="mt-4 text-sm leading-7 text-white/55">
            Nigerian extensions such as .com.ng and .org.ng follow the registry's own timelines. If your domain has expired, contact us as soon as possible
            and we'll tell you exactly what can still be done.
          </p>
        </div>
      </section>

      <section id="renew-elsewhere" className="pub-section-tint-dark scroll-mt-24 border-y border-white/8">
        <div className="mx-auto grid max-w-7xl gap-4 px-4 py-16 sm:px-6 lg:grid-cols-3 lg:px-8">
          <div className="pub-card-dark">
            <h3 className="flex items-center gap-2 text-base font-black text-white"><ArrowRightLeft className="h-4 w-4 text-primary" /> Domain with another provider?</h3>
            <p className="mt-2 text-sm leading-6 text-white/62">
              We can only renew domains managed by NAI TALK. Renew it with your current provider, or{" "}
              <a href="/domain-transfer" className="text-primary underline">transfer it to NAI TALK</a> and manage every renewal from one dashboard.
            </p>
          </div>
          <div className="pub-card-dark">
            <h3 className="flex items-center gap-2 text-base font-black text-white"><Search className="h-4 w-4 text-primary" /> Looking for a new domain?</h3>
            <p className="mt-2 text-sm leading-6 text-white/62">
              Renewal keeps a domain you already own. To get a new one, see{" "}
              <a href="/domain-registration" className="text-primary underline">domain registration</a> and search for your name.
            </p>
          </div>
          <div className="pub-card-dark">
            <h3 className="flex items-center gap-2 text-base font-black text-white"><Headphones className="h-4 w-4 text-primary" /> Need help renewing?</h3>
            <p className="mt-2 text-sm leading-6 text-white/62">
              Message us on <a href={DOMAIN_RENEWAL_WHATSAPP_HREF} target="_blank" rel="noreferrer" className="text-primary underline">WhatsApp</a>, open a support
              ticket from your dashboard, or <a href="/contact" className="text-primary underline">contact us</a>. See also{" "}
              <a href="/how-to-pay" className="text-primary underline">how to pay</a>.
            </p>
          </div>
        </div>
      </section>

      <section className="pub-section-dark">
        <div className="mx-auto max-w-3xl px-4 py-16 sm:px-6 lg:px-8">
          <div className="text-center">
            <span className="eyebrow">FAQ</span>
            <h2 className="mt-4 text-3xl font-black text-white">Domain renewal questions</h2>
          </div>
          <div className="mt-8">
            <FaqAccordionGroup dark items={DOMAIN_RENEWAL_FAQ_ITEMS} />
          </div>
        </div>
      </section>

      <MarketingCtaBand
        title="Don't risk losing your domain"
        subtitle="Renew now from your dashboard, or turn on auto-renewal and let us handle it every year."
        ctaLabel="Renew My Domain"
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
          <LiveDomainPriceTable columns={["registration", "renewal", "transfer"]} />
          <p className="mt-8 text-center text-sm text-white/55">
            Ready to buy? See <a href="/domain-registration" className="text-primary underline">domain registration</a>,{" "}
            <a href="/domain-renewal" className="text-primary underline">domain renewal</a> or{" "}
            <a href="/domain-transfer" className="text-primary underline">domain transfer</a>.
          </p>
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

