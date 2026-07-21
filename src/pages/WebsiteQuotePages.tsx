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

// ---------------------------------------------------------------------------
// /get-a-website — standalone Google Ads landing page for website-design
// quote requests. Deliberately doesn't use PublicPage/Navbar (fewer exit
// points than the full site nav) even though it reuses Logo/Footer from it.
// ---------------------------------------------------------------------------

export const websiteQuoteWhatsappUrl =
  "https://wa.me/2347087057654?text=Hello%20NAITALK%2C%20I%20am%20interested%20in%20getting%20a%20professional%20website%20for%20my%20business.";

export const WEBSITE_QUOTE_TYPES = [
  "Business or Corporate Website",
  "E-commerce Website",
  "School Website",
  "Church or Ministry Website",
  "Personal or Portfolio Website",
  "Blog or News Website",
  "Hotel or Hospitality Website",
  "Healthcare Website",
  "NGO or Organisation Website",
  "Website Redesign",
  "Other",
];

// Must match StoreWebsiteQuoteRequest::BUDGET_RANGES on the backend exactly
// (including the naira sign and en dash) since the API validates with Rule::in.
export const WEBSITE_QUOTE_BUDGETS = [
  "₦100,000 – ₦200,000",
  "₦200,000 – ₦400,000",
  "₦400,000 – ₦750,000",
  "Above ₦750,000",
  "Not Sure Yet",
];

export type WebsiteQuoteFormData = {
  name: string;
  phone: string;
  email: string;
  website_type: string;
  estimated_budget: string;
  project_description: string;
};

export const emptyWebsiteQuoteForm: WebsiteQuoteFormData = {
  name: "",
  phone: "",
  email: "",
  website_type: "",
  estimated_budget: "",
  project_description: "",
};

export function validateWebsiteQuoteForm(data: WebsiteQuoteFormData): Partial<Record<keyof WebsiteQuoteFormData, string>> {
  const errors: Partial<Record<keyof WebsiteQuoteFormData, string>> = {};

  if (!data.name.trim()) errors.name = "Please enter your name.";
  if (!data.phone.trim()) errors.phone = "Please enter a phone or WhatsApp number.";
  if (!data.email.trim()) {
    errors.email = "Please enter your email address.";
  } else if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(data.email.trim())) {
    errors.email = "Please enter a valid email address.";
  }
  if (!data.website_type) errors.website_type = "Please select the type of website you need.";
  if (!data.estimated_budget) errors.estimated_budget = "Please select your estimated budget.";

  const description = data.project_description.trim();
  if (!description) {
    errors.project_description = "Please tell us a bit about your project.";
  } else if (description.length < 20) {
    errors.project_description = "Please provide a few more details (at least 20 characters).";
  } else if (description.length > 2000) {
    errors.project_description = "Please keep your description under 2000 characters.";
  }

  return errors;
}

export function WebsiteQuoteFieldError({ id, message }: { id: string; message?: string }) {
  if (!message) return null;
  return (
    <p id={id} className="mt-1.5 text-xs font-bold text-red-300">
      {message}
    </p>
  );
}

export function WebsiteQuoteForm() {
  const [formData, setFormData] = useState<WebsiteQuoteFormData>(emptyWebsiteQuoteForm);
  const [errors, setErrors] = useState<Partial<Record<keyof WebsiteQuoteFormData, string>>>({});
  const [status, setStatus] = useState<"idle" | "submitting" | "error">("idle");
  const [message, setMessage] = useState("");

  const inputClasses =
    "w-full rounded-lg border border-white/10 bg-[#041015] px-4 py-3 text-sm text-white outline-none transition placeholder:text-white/32 focus:border-primary/55";
  const labelClasses = "mb-1.5 block text-[11px] font-black uppercase text-white/56";

  const handleChange = (event: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement | HTMLSelectElement>) => {
    const { name, value } = event.target;
    setFormData((current) => ({ ...current, [name]: value }));
  };

  const handleSubmit = async (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (status === "submitting") return;

    const validationErrors = validateWebsiteQuoteForm(formData);
    setErrors(validationErrors);
    if (Object.keys(validationErrors).length > 0) return;

    setStatus("submitting");
    setMessage("");

    const attribution = captureAdAttribution();

    try {
      const response = await laravelApi<{ status: string; message: string; data: { reference: string } }>(
        "/api/v1/public/website-quote",
        undefined,
        {
          method: "POST",
          body: JSON.stringify({
            name: formData.name.trim(),
            phone: formData.phone.trim(),
            email: formData.email.trim(),
            website_type: formData.website_type,
            estimated_budget: formData.estimated_budget,
            project_description: formData.project_description.trim(),
            ...attribution,
          }),
        },
      );

      trackFormSubmission("website_quote", "success", {
        website_type: formData.website_type,
        estimated_budget: formData.estimated_budget,
      });

      try {
        sessionStorage.setItem(
          "naitalk_website_quote_meta",
          JSON.stringify({
            reference: response.data.reference,
            website_type: formData.website_type,
            estimated_budget: formData.estimated_budget,
            campaign: attribution.utm_campaign,
          }),
        );
      } catch {
        // Private/incognito mode — the thank-you page falls back to the ?ref= query param only.
      }

      window.location.assign(`/get-a-website/thank-you?ref=${encodeURIComponent(response.data.reference)}`);
    } catch (error) {
      setStatus("error");
      setMessage(
        error instanceof Error && error.message
          ? error.message
          : "We could not submit your request at the moment. Please try again or contact us through WhatsApp.",
      );
      trackFormSubmission("website_quote", "error", {
        website_type: formData.website_type,
        estimated_budget: formData.estimated_budget,
      });
    }
  };

  return (
    <div
      id="quote-form"
      className="scroll-mt-24 rounded-2xl border border-white/10 bg-white/[0.04] p-6 shadow-[0_30px_90px_rgba(0,0,0,0.35)] sm:p-8"
    >
      <div className="flex items-start gap-3">
        <span className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl bg-primary/15 text-primary">
          <FileText className="h-5 w-5" />
        </span>
        <div>
          <h2 className="text-xl font-black text-white">Request Your Website Quote</h2>
          <p className="mt-1 text-sm text-white/60">Fill in your details and we'll get back to you shortly.</p>
        </div>
      </div>

      <form className="mt-6 grid gap-4" onSubmit={handleSubmit} noValidate aria-live="polite">
        <label>
          <span className={labelClasses}>Name</span>
          <input
            name="name"
            value={formData.name}
            onChange={handleChange}
            placeholder="Enter your full name"
            className={inputClasses}
            aria-invalid={Boolean(errors.name)}
            aria-describedby={errors.name ? "wq-name-error" : undefined}
          />
          <WebsiteQuoteFieldError id="wq-name-error" message={errors.name} />
        </label>

        <label>
          <span className={labelClasses}>Phone or WhatsApp number</span>
          <input
            type="tel"
            name="phone"
            value={formData.phone}
            onChange={handleChange}
            placeholder="e.g. 07031234567"
            className={inputClasses}
            aria-invalid={Boolean(errors.phone)}
            aria-describedby={errors.phone ? "wq-phone-error" : undefined}
          />
          <WebsiteQuoteFieldError id="wq-phone-error" message={errors.phone} />
        </label>

        <label>
          <span className={labelClasses}>Email address</span>
          <input
            type="email"
            name="email"
            value={formData.email}
            onChange={handleChange}
            placeholder="you@example.com"
            className={inputClasses}
            aria-invalid={Boolean(errors.email)}
            aria-describedby={errors.email ? "wq-email-error" : undefined}
          />
          <WebsiteQuoteFieldError id="wq-email-error" message={errors.email} />
        </label>

        <label>
          <span className={labelClasses}>Type of website required</span>
          <select
            name="website_type"
            value={formData.website_type}
            onChange={handleChange}
            className={inputClasses}
            aria-invalid={Boolean(errors.website_type)}
            aria-describedby={errors.website_type ? "wq-website-type-error" : undefined}
          >
            <option value="">Select website type</option>
            {WEBSITE_QUOTE_TYPES.map((type) => (
              <option key={type} value={type}>
                {type}
              </option>
            ))}
          </select>
          <WebsiteQuoteFieldError id="wq-website-type-error" message={errors.website_type} />
        </label>

        <label>
          <span className={labelClasses}>Estimated budget</span>
          <select
            name="estimated_budget"
            value={formData.estimated_budget}
            onChange={handleChange}
            className={inputClasses}
            aria-invalid={Boolean(errors.estimated_budget)}
            aria-describedby={errors.estimated_budget ? "wq-budget-error" : undefined}
          >
            <option value="">Select your budget range</option>
            {WEBSITE_QUOTE_BUDGETS.map((budget) => (
              <option key={budget} value={budget}>
                {budget}
              </option>
            ))}
          </select>
          <WebsiteQuoteFieldError id="wq-budget-error" message={errors.estimated_budget} />
        </label>

        <label>
          <span className={labelClasses}>Short project description</span>
          <textarea
            name="project_description"
            value={formData.project_description}
            onChange={handleChange}
            rows={4}
            placeholder="Tell us more about your business and what you need..."
            className={inputClasses}
            aria-invalid={Boolean(errors.project_description)}
            aria-describedby={errors.project_description ? "wq-description-error" : undefined}
          />
          <WebsiteQuoteFieldError id="wq-description-error" message={errors.project_description} />
        </label>

        <button type="submit" className="btn-primary justify-center" disabled={status === "submitting"}>
          {status === "submitting" ? "Submitting..." : "Request My Quote"}
          <ArrowRight className="h-4 w-4" />
        </button>

        <p className="flex items-center justify-center gap-2 text-center text-[11px] font-bold text-white/45">
          <ShieldCheck className="h-3.5 w-3.5 text-primary" />
          Your information is secure and confidential.
        </p>

        {status === "error" && message && <p className="form-message error">{message}</p>}
      </form>
    </div>
  );
}

export function WebsiteQuoteLandingHeader({ minimal = false }: { minimal?: boolean }) {
  const [isOpen, setIsOpen] = useState(false);

  const navLinks = [
    { label: "What's Included", href: "#included" },
    { label: "Our Work", href: "#work" },
    { label: "Process", href: "#process" },
    { label: "FAQ", href: "#faq" },
  ];

  return (
    <header className="fixed inset-x-0 top-0 z-50 border-b border-white/10 bg-[#1a1e24]/95 backdrop-blur">
      <div className="mx-auto flex max-w-7xl items-center justify-between px-4 py-3 sm:px-6 lg:px-8">
        <Logo />

        {!minimal && (
          <nav className="hidden items-center gap-7 text-xs font-bold uppercase text-white/70 lg:flex">
            {navLinks.map((link) => (
              <a key={link.label} href={link.href} className="transition hover:text-primary">
                {link.label}
              </a>
            ))}
          </nav>
        )}

        <div className="flex items-center gap-3">
          <a
            href={websiteQuoteWhatsappUrl}
            className="btn-primary hidden !min-h-10 !px-5 !py-2 !text-[11px] sm:inline-flex"
            onClick={() => trackEvent("whatsapp_click", { page_section: "website_quote_header" })}
          >
            <MessageCircle className="h-4 w-4" />
            Chat on WhatsApp
          </a>

          {!minimal && (
            <button
              type="button"
              className="flex h-10 w-10 items-center justify-center rounded-lg border border-white/15 text-white lg:hidden"
              onClick={() => setIsOpen((current) => !current)}
              aria-expanded={isOpen}
              aria-label="Toggle navigation menu"
            >
              {isOpen ? <X className="h-5 w-5" /> : <Menu className="h-5 w-5" />}
            </button>
          )}
        </div>
      </div>

      {!minimal && isOpen && (
        <nav className="border-t border-white/10 bg-[#1a1e24] px-4 py-4 lg:hidden">
          <div className="flex flex-col gap-4 text-sm font-bold uppercase text-white/75">
            {navLinks.map((link) => (
              <a key={link.label} href={link.href} onClick={() => setIsOpen(false)} className="transition hover:text-primary">
                {link.label}
              </a>
            ))}
          </div>
        </nav>
      )}
    </header>
  );
}

export function WebsiteQuoteHero() {
  const image = usePublicImage("small business owner working on laptop website design", "landscape");

  return (
    <section className="wq-dark-panel relative overflow-hidden pb-16 pt-28 sm:pb-20 sm:pt-32">
      <div className="pointer-events-none absolute inset-0 overflow-hidden" aria-hidden="true">
        <div className="absolute -left-24 -top-24 h-72 w-72 rounded-full bg-primary/10 blur-3xl" />
        <div className="absolute -right-16 top-1/3 h-96 w-96 rounded-full bg-primary/[0.08] blur-3xl" />
        <div className="absolute bottom-[-6rem] left-1/3 h-64 w-64 rounded-full bg-primary/[0.06] blur-3xl" />
        <div className="absolute right-[8%] top-16 h-24 w-24 rounded-full border border-primary/20" />
        <div className="absolute right-[18%] top-40 h-14 w-14 rotate-12 rounded-xl border border-primary/15" />
        <div className="absolute left-[6%] bottom-16 h-20 w-20 rounded-full border border-primary/10" />
      </div>

      <div className="relative z-10 mx-auto grid max-w-7xl gap-10 px-4 sm:px-6 lg:grid-cols-[1.05fr_0.95fr] lg:items-start lg:gap-14 lg:px-8">
        <div>
          <span className="eyebrow">Professional Website Design &amp; Management</span>
          <h1 className="mt-5 text-4xl font-black leading-[1.08] text-white sm:text-5xl">
            Get a Professional Website for <span className="text-primary">Your Business</span>
          </h1>
          <p className="mt-5 max-w-xl text-base leading-8 text-white/62 sm:text-lg">
            NAITALK builds, hosts and manages fast, secure and modern websites that help Nigerian businesses attract
            customers and grow online.
          </p>
          <div className="mt-8 flex flex-wrap gap-3">
            <a
              href="#quote-form"
              className="btn-primary justify-center"
              onClick={() =>
                trackCtaClick({ button_text: "Get a Quote", page_section: "website_quote_hero", destination_url: "#quote-form" })
              }
            >
              <Send className="h-4 w-4" />
              Get a Quote
            </a>
            <a
              href={websiteQuoteWhatsappUrl}
              className="btn-outline justify-center"
              onClick={() => trackEvent("whatsapp_click", { page_section: "website_quote_hero" })}
            >
              <MessageCircle className="h-4 w-4 text-[#25D366]" />
              Chat on WhatsApp
            </a>
          </div>
          <div className="mt-8 flex flex-wrap gap-x-6 gap-y-3 text-xs font-bold text-white/56">
            <span className="inline-flex items-center gap-2">
              <Zap className="h-4 w-4 text-primary" /> Fast Turnaround
            </span>
            <span className="inline-flex items-center gap-2">
              <ShieldCheck className="h-4 w-4 text-primary" /> Secure
            </span>
            <span className="inline-flex items-center gap-2">
              <Building2 className="h-4 w-4 text-primary" /> Built for Nigerian Businesses
            </span>
          </div>
          <div className="mt-10 hidden overflow-hidden rounded-2xl border border-white/10 shadow-[0_30px_80px_rgba(0,0,0,0.35)] lg:block">
            <img
              src={image?.url || "/images/placeholder-business.svg"}
              alt={image?.alt_text || "A small business owner working on their website"}
              loading="eager"
              width={700}
              height={420}
              className="aspect-[5/3] w-full object-cover"
            />
          </div>
        </div>

        <WebsiteQuoteForm />
      </div>
    </section>
  );
}

export const websiteQuoteTrustItems = [
  [Globe2, "Domain + Hosting + SSL", "Everything you need to get started, included."],
  [Headphones, "Managed Support", "We handle updates, backups and fix issues for you."],
  [CreditCard, "Flexible Payment Options", "Pay conveniently in instalments that work for your business."],
  [Building2, "Built for Nigerian Businesses", "We understand your market and your customers."],
] as const;

export function WebsiteQuoteTrustStrip() {
  return (
    <section className="bg-white">
      <div className="mx-auto grid max-w-7xl gap-6 px-4 py-10 sm:grid-cols-2 sm:px-6 lg:grid-cols-4 lg:px-8">
        {websiteQuoteTrustItems.map(([Icon, title, description]) => (
          <div key={title} className="flex items-start gap-3">
            <span className="flex h-11 w-11 shrink-0 items-center justify-center rounded-full border-2 border-primary text-primary">
              <Icon className="h-5 w-5" />
            </span>
            <div>
              <h3 className="text-sm font-black text-[#07111f]">{title}</h3>
              <p className="mt-1 text-xs leading-5 text-[#596273]">{description}</p>
            </div>
          </div>
        ))}
      </div>
    </section>
  );
}

export const websiteQuoteIncludedItems = [
  [Palette, "Custom Design", "Modern, unique designs that match your brand."],
  [Link2, "Domain Connection", "We connect your domain to your website."],
  [Server, "Reliable Hosting", "Fast, secure hosting for smooth performance."],
  [ShieldCheck, "SSL Certificate", "Secure your website and build trust."],
  [MonitorSmartphone, "Mobile Responsive", "Looks perfect on phones, tablets and desktops."],
  [Settings, "Website Maintenance", "Updates, backups and security handled for you."],
  [FileText, "Contact Forms", "Easy forms to capture leads and enquiries."],
  [Mail, "Business Email Support", "Professional email setup with your domain."],
] as const;

export function WebsiteQuoteIncludedSection() {
  return (
    <section id="included" className="scroll-mt-20 bg-[#f6f8f6]">
      <div className="mx-auto max-w-7xl px-4 py-16 sm:px-6 lg:px-8">
        <div className="mx-auto max-w-2xl text-center">
          <span className="pub-eyebrow">What's Included</span>
          <h2 className="mt-4 text-3xl font-black text-[#07111f]">What's Included in Your Business Website</h2>
        </div>
        <div className="mt-10 grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
          {websiteQuoteIncludedItems.map(([Icon, title, description]) => (
            <div key={title} className="pub-card">
              <span className="flex h-10 w-10 items-center justify-center rounded-lg border-2 border-primary text-primary">
                <Icon className="h-5 w-5" />
              </span>
              <h3 className="mt-4 text-base font-black text-[#07111f]">{title}</h3>
              <p className="mt-2 text-sm leading-6 text-[#596273]">{description}</p>
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}

export const websiteQuoteRecentWork = [
  { title: "Skinologist", description: "E-commerce skincare store built to showcase products and convert browsers into buyers.", image: "/data/work-skinologist.webp" },
  { title: "Caleb Adeleye", description: "A personal portfolio site for a software engineer and founder.", image: "/data/work-caleb-adeleye.webp" },
  { title: "Luminary Radio", description: "A media and radio streaming website with live programming and news.", image: "/data/work-luminary-radio.webp" },
  { title: "Victor Ademofe", description: "A personal portfolio and personal brand website.", image: "/data/work-victor-ademofe.webp" },
  { title: "Luminary Radio Mobile App", description: "A companion mobile app for the radio station's live streaming and programming.", image: "/data/work-luminary-radio-mobile-app.webp" },
  { title: "UTME Mobile App", description: "A mobile app built to help students prepare for and track their UTME examination.", image: "/data/work-utme-mobile-app.webp" },
];

export function WebsiteQuoteRecentWork() {
  return (
    <section id="work" className="scroll-mt-20 pub-section">
      <div className="mx-auto max-w-7xl px-4 py-16 sm:px-6 lg:px-8">
        <div className="mx-auto max-w-2xl text-center">
          <span className="pub-eyebrow">Our Recent Work</span>
          <h2 className="mt-4 text-3xl font-black text-[#07111f]">Our Recent Work</h2>
        </div>
        <div className="mt-10 grid gap-6 sm:grid-cols-2">
          {websiteQuoteRecentWork.map((project) => (
            <div key={project.title} className="overflow-hidden rounded-2xl border border-black/8 bg-white shadow-[0_15px_45px_rgba(16,24,16,0.06)]">
              <img
                src={project.image}
                alt={project.title}
                loading="lazy"
                width={800}
                height={520}
                className="aspect-[16/10] w-full object-cover object-top"
              />
              <div className="p-5">
                <h3 className="text-base font-black text-[#07111f]">{project.title}</h3>
                <p className="mt-1.5 text-sm leading-6 text-[#596273]">{project.description}</p>
              </div>
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}

export const websiteQuoteWhyChooseUs = [
  [ShieldCheck, "Peace of Mind", "We take care of the technical work so you can focus on running your business."],
  [Users, "Local & Reliable Support", "Get practical support from a Nigerian team that understands your market."],
  [Puzzle, "All-in-One Service", "Website design, domain, hosting, SSL and support are handled in one place."],
  [Smile, "Less Technical Stress", "You do not need to understand servers or website technology. We manage it for you."],
] as const;

export function WebsiteQuoteWhyChooseUs() {
  return (
    <section className="bg-[#f6f8f6]">
      <div className="mx-auto max-w-7xl px-4 py-16 sm:px-6 lg:px-8">
        <div className="mx-auto max-w-2xl text-center">
          <span className="pub-eyebrow">Why NAITALK</span>
          <h2 className="mt-4 text-3xl font-black text-[#07111f]">Why Businesses Choose NAITALK</h2>
        </div>
        <div className="mt-10 grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
          {websiteQuoteWhyChooseUs.map(([Icon, title, description]) => (
            <div key={title} className="pub-card text-center">
              <span className="mx-auto flex h-11 w-11 items-center justify-center rounded-full border-2 border-primary text-primary">
                <Icon className="h-5 w-5" />
              </span>
              <h3 className="mt-4 text-base font-black text-[#07111f]">{title}</h3>
              <p className="mt-2 text-sm leading-6 text-[#596273]">{description}</p>
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}

export const websiteQuoteProcessSteps = [
  [MessageCircle, "Tell Us About Your Business", "Share your goals, ideas and requirements with us."],
  [Palette, "We Design", "We create a custom design that matches your business and brand."],
  [Rocket, "We Build & Launch", "We build, test and launch your website."],
  [Headphones, "Ongoing Support", "We provide updates, maintenance, backups and continued support."],
] as const;

export function WebsiteQuoteProcessSection() {
  return (
    <section id="process" className="scroll-mt-20 pub-section">
      <div className="mx-auto max-w-7xl px-4 py-16 sm:px-6 lg:px-8">
        <div className="mx-auto max-w-2xl text-center">
          <span className="pub-eyebrow">Our Process</span>
          <h2 className="mt-4 text-3xl font-black text-[#07111f]">Our Simple 4-Step Process</h2>
        </div>
        <div className="mt-10 grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
          {websiteQuoteProcessSteps.map(([Icon, title, description], index) => (
            <div key={title} className="pub-card">
              <div className="flex items-center gap-3">
                <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-primary text-sm font-black text-on-primary">
                  {index + 1}
                </span>
                <Icon className="h-5 w-5 text-primary" />
              </div>
              <h3 className="mt-4 text-base font-black text-[#07111f]">{title}</h3>
              <p className="mt-2 text-sm leading-6 text-[#596273]">{description}</p>
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}

export const websiteQuoteFaqItems = [
  {
    question: "How long does it take to build my website?",
    answer:
      "Most business websites are designed, built and launched within 1–3 weeks depending on the size of the project and how quickly we receive your content and feedback. We'll give you a clear timeline before work begins.",
  },
  {
    question: "Do I own my website once it's built?",
    answer:
      "Yes. The website and its content belong to you. We handle the domain, hosting and technical setup on your behalf, but you're never locked in — we can transfer everything to you if you ever choose to move.",
  },
  {
    question: "What if I need changes after my website goes live?",
    answer:
      "You can request updates any time. Small changes are typically handled quickly, and larger changes can be scoped as a follow-up project. Our Website Care Plans also include ongoing updates and support.",
  },
  {
    question: "Do you provide hosting and a domain name?",
    answer:
      "Yes. We can register a new domain for you or connect one you already own, and every website is hosted on fast, secure infrastructure with SSL included — so there's nothing extra for you to set up.",
  },
  {
    question: "How much does a website cost?",
    answer:
      "Cost depends on the type of website and features you need. Use the budget ranges in the quote form as a guide — once we understand your requirements, we'll send you a clear, itemised quote with no hidden fees.",
  },
  {
    question: "Can I pay in instalments?",
    answer:
      "Yes, we offer flexible payment options and can split the project cost into instalments that work for your business — just let us know your preference when we discuss your quote.",
  },
  {
    question: "Do you offer ongoing support after launch?",
    answer:
      "Yes. We offer ongoing maintenance, backups, security updates and technical support so you never have to deal with the technical side of running a website — that's what we're here for.",
  },
  {
    question: "I don't have a domain name or logo yet — can you still help?",
    answer:
      "Absolutely. Many of our clients start with nothing more than a business idea. We can help you choose and register a domain, and guide you through getting a logo and brand basics sorted before we design your site.",
  },
];

export function WebsiteQuoteFaqSection() {
  return (
    <section id="faq" className="scroll-mt-20 bg-white">
      <div className="mx-auto max-w-4xl px-4 py-16 sm:px-6 lg:px-8">
        <div className="mx-auto max-w-2xl text-center">
          <span className="pub-eyebrow">FAQ</span>
          <h2 className="mt-4 text-3xl font-black text-[#07111f]">Frequently Asked Questions</h2>
          <p className="mt-3 text-sm leading-6 text-[#596273]">Answers to the questions we hear most from businesses getting a new website.</p>
        </div>
        <div className="mt-10">
          <FaqAccordionGroup items={websiteQuoteFaqItems} />
        </div>
      </div>
    </section>
  );
}

export function WebsiteQuoteFinalCta() {
  return (
    <section className="wq-dark-panel border-t border-white/8">
      <div className="mx-auto max-w-7xl px-4 py-16 sm:px-6 lg:px-8">
        <div className="flex flex-col gap-6 rounded-lg border border-white/10 bg-white/[0.04] p-6 sm:p-8 lg:flex-row lg:items-center lg:justify-between">
          <div>
            <h2 className="text-3xl font-black leading-tight text-white sm:text-4xl">
              Ready to Take <span className="text-primary">Your</span> Business Online?
            </h2>
            <p className="mt-3 max-w-xl text-sm leading-7 text-white/62">
              Let NAITALK build a website that attracts customers, strengthens trust and helps your business grow.
            </p>
          </div>
          <div className="flex flex-col gap-3 sm:flex-row">
            <a
              href="#quote-form"
              className="btn-primary justify-center"
              onClick={() =>
                trackCtaClick({ button_text: "Get a Quote", page_section: "website_quote_final_cta", destination_url: "#quote-form" })
              }
            >
              <Send className="h-4 w-4" />
              Get a Quote
            </a>
            <a
              href={websiteQuoteWhatsappUrl}
              className="btn-outline justify-center"
              onClick={() => trackEvent("whatsapp_click", { page_section: "website_quote_final_cta" })}
            >
              <MessageCircle className="h-4 w-4 text-[#25D366]" />
              Chat on WhatsApp
            </a>
          </div>
        </div>
      </div>
    </section>
  );
}

export const websiteQuoteFooterLinks = [
  { label: "What's Included", href: "#included" },
  { label: "Our Work", href: "#work" },
  { label: "Process", href: "#process" },
  { label: "FAQ", href: "#faq" },
];

/**
 * A dedicated footer for the ad landing page, matching the approved mockup
 * exactly — deliberately not the shared site-wide Footer component, which
 * carries the main site's own nav/column structure.
 */
export function WebsiteQuoteFooter() {
  return (
    <footer className="wq-dark-panel text-white">
      <div className="mx-auto grid max-w-7xl gap-10 px-4 py-14 sm:px-6 lg:grid-cols-[1.3fr_1fr_1fr_1fr_1fr] lg:px-8">
        <div>
          <Logo />
          <p className="mt-4 text-sm font-black text-primary">Let's talk | We build | You grow.</p>
          <p className="mt-3 max-w-xs text-sm leading-6 text-white/60">
            We build, host and manage professional websites for businesses across Nigeria. So you can focus on what you do best.
          </p>
        </div>
        <div>
          <h3 className="text-xs font-black uppercase text-white">Quick Links</h3>
          <ul className="mt-4 space-y-2.5 text-sm text-white/65">
            {websiteQuoteFooterLinks.map((link) => (
              <li key={link.label}>
                <a href={link.href} className="transition hover:text-primary">
                  {link.label}
                </a>
              </li>
            ))}
          </ul>
        </div>
        <div>
          <h3 className="text-xs font-black uppercase text-white">Contact Us</h3>
          <ul className="mt-4 space-y-2.5 text-sm text-white/65">
            <li className="flex items-center gap-2">
              <Mail className="h-4 w-4 shrink-0 text-primary" />
              <a href="mailto:info@naitalk.com" className="transition hover:text-primary">
                info@naitalk.com
              </a>
            </li>
            <li className="flex items-center gap-2">
              <Phone className="h-4 w-4 shrink-0 text-primary" />
              <a href="tel:+2347087057654" className="transition hover:text-primary">
                07087057654
              </a>
            </li>
            <li className="flex items-center gap-2">
              <Globe2 className="h-4 w-4 shrink-0 text-primary" />
              <a href="https://www.naitalk.com" className="transition hover:text-primary">
                www.naitalk.com
              </a>
            </li>
          </ul>
        </div>
        <div>
          <h3 className="text-xs font-black uppercase text-white">Business Hours</h3>
          <ul className="mt-4 space-y-2.5 text-sm text-white/65">
            <li>Mon &ndash; Fri: 9:00am &ndash; 6:00pm</li>
            <li>Saturday: 10:00am &ndash; 2:00pm</li>
            <li>Sunday: Closed</li>
          </ul>
        </div>
        <div>
          <h3 className="text-xs font-black uppercase text-white">Follow Us</h3>
          <div className="mt-4 flex gap-3">
            {socialLinks.map(([Icon, label, url]) => (
              <a
                key={label}
                href={url}
                aria-label={label}
                className="flex h-9 w-9 items-center justify-center rounded-full border border-white/15 text-white/70 transition hover:border-primary hover:text-primary"
              >
                <Icon className="h-4 w-4" />
              </a>
            ))}
          </div>
          <p className="mt-4 text-xs leading-5 text-white/50">Proudly serving businesses across Nigeria.</p>
        </div>
      </div>
      <div className="border-t border-white/10">
        <div className="mx-auto flex max-w-7xl flex-col items-center justify-between gap-3 px-4 py-5 text-xs text-white/50 sm:flex-row sm:px-6 lg:px-8">
          <span>&copy; {new Date().getFullYear()} NAITALK. All rights reserved.</span>
          <div className="flex gap-4">
            <a href="/privacy-policy" className="transition hover:text-primary">
              Privacy Policy
            </a>
            <a href="/terms-of-service" className="transition hover:text-primary">
              Terms of Service
            </a>
          </div>
        </div>
      </div>
    </footer>
  );
}

export function WebsiteQuoteLandingPage() {
  useSeo();

  return (
    <div className="min-h-screen overflow-x-hidden bg-[#1a1e24] text-white">
      <WebsiteQuoteLandingHeader />
      <main>
        <WebsiteQuoteHero />
        <WebsiteQuoteTrustStrip />
        <WebsiteQuoteIncludedSection />
        <WebsiteQuoteRecentWork />
        <WebsiteQuoteWhyChooseUs />
        <WebsiteQuoteProcessSection />
        <WebsiteQuoteFaqSection />
        <WebsiteQuoteFinalCta />
      </main>
      <WebsiteQuoteFooter />
    </div>
  );
}

export type WebsiteQuoteConversionMeta = {
  reference?: string;
  website_type?: string;
  estimated_budget?: string;
  campaign?: string;
};

export const firedGoogleAdsQuoteConversionKeys = new Set<string>();

export function WebsiteQuoteThankYouPage() {
  useSeo();

  const [reference, setReference] = useState("");

  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    const refFromUrl = params.get("ref") || "";
    setReference(refFromUrl);

    let meta: WebsiteQuoteConversionMeta = {};
    try {
      const raw = sessionStorage.getItem("naitalk_website_quote_meta");
      if (raw) {
        meta = JSON.parse(raw) as WebsiteQuoteConversionMeta;
        sessionStorage.removeItem("naitalk_website_quote_meta");
      }
    } catch {
      // Private/incognito mode — fall back to just the reference from the URL.
    }

    const eventReference = meta.reference || refFromUrl;
    if (eventReference) {
      // Google Ads conversion tag hook — non-PII metadata only.
      trackViewOnce(`website_quote_submitted:${eventReference}`, "website_quote_submitted", {
        reference: eventReference,
        website_type: meta.website_type,
        estimated_budget: meta.estimated_budget,
        campaign: meta.campaign,
      });

      // Google Ads "Submit lead form" conversion — fires once per reference.
      // Guarded by localStorage (survives a refresh of this thank-you page,
      // which would otherwise double-count the same conversion) with the
      // in-memory Set as a fallback when storage is unavailable.
      const storageKey = `naitalk_ga_quote_conversion_${eventReference}`;
      let alreadyFired = firedGoogleAdsQuoteConversionKeys.has(eventReference);
      if (!alreadyFired) {
        try {
          alreadyFired = Boolean(localStorage.getItem(storageKey));
          localStorage.setItem(storageKey, "1");
        } catch {
          // Private/incognito mode — fall back to the in-memory guard only.
        }
      }

      if (!alreadyFired) {
        firedGoogleAdsQuoteConversionKeys.add(eventReference);
        trackGoogleAdsConversion("AW-18326410611/aBJTCPvXntEcEPOq26JE", {
          value: 1.0,
          currency: "USD",
        });
      }
    }
  }, []);

  return (
    <div className="min-h-screen overflow-x-hidden bg-[#1a1e24] text-white">
      <WebsiteQuoteLandingHeader minimal />
      <main className="pt-28">
        <section className="pub-section-dark">
          <div className="mx-auto flex max-w-2xl flex-col items-center gap-5 px-4 py-20 text-center sm:px-6 lg:px-8">
            <span className="flex h-16 w-16 items-center justify-center rounded-full bg-primary/15 text-primary">
              <CheckCircle2 className="h-8 w-8" />
            </span>
            <h1 className="text-3xl font-black text-white sm:text-4xl">Thank You — Your Website Request Has Been Received</h1>
            <p className="text-base leading-7 text-white/62">
              Our team will review your request and contact you using the details you provided.
            </p>
            {reference && (
              <div className="rounded-full border border-primary/30 bg-primary/10 px-6 py-3 text-sm font-black text-primary">
                Reference: {reference}
              </div>
            )}
            <div className="mt-4 flex flex-col gap-3 sm:flex-row">
              <a
                href={websiteQuoteWhatsappUrl}
                className="btn-primary justify-center"
                onClick={() => trackEvent("whatsapp_click", { page_section: "website_quote_thank_you" })}
              >
                <MessageCircle className="h-4 w-4" />
                Chat on WhatsApp
              </a>
              <a href="/" className="btn-outline justify-center">
                Return to NAITALK
              </a>
            </div>
          </div>
        </section>
      </main>
      <WebsiteQuoteFooter />
    </div>
  );
}

