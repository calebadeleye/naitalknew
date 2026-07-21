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
import { Portfolio } from "../App";

export function WebHostingPage() {
  return (
    <PublicPage>
      <PublicBreadcrumbs items={[{ label: "Web Hosting" }]} dark />
      <MarketingHero
        eyebrow="Web Hosting"
        title="Reliable Web Hosting in Nigeria"
        subtitle="Fast, secure, and supported hosting for small and medium businesses — with SSL, professional email and backups included, and no technical stress on you."
        ctaLabel="View Website Care Plans"
        ctaHref="/website-care-plans"
        secondaryLabel="Start Your Website"
        secondaryHref="/website-design"
        imageQuery="cloud hosting data center"
        dark
      />

      <section className="pub-section-dark">
        <div className="mx-auto max-w-4xl px-4 py-16 sm:px-6 lg:px-8">
          <h2 className="text-2xl font-black text-white">What is hosting?</h2>
          <p className="mt-3 text-base leading-7 text-white/62">
            If your domain name is your business address, hosting is the building where your website actually lives. It stores your website's files and
            makes them available to anyone who visits your domain, at any hour — without you ever needing to touch a server.
          </p>
        </div>
      </section>

      <section className="pub-section-tint-dark border-y border-white/8">
        <div className="mx-auto max-w-7xl px-4 py-16 sm:px-6 lg:px-8">
          <div className="mx-auto max-w-2xl text-center">
            <span className="eyebrow">Why NAI TALK hosting</span>
            <h2 className="mt-4 text-3xl font-black text-white">Everything your website needs, in one place</h2>
          </div>
          <div className="mt-10 grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
            {[
              [ShieldCheck, "Website security", "SSL and security protection included, so your site and your customers stay safe."],
              [Mail, "Professional email", "A business email address that matches your domain, included on every plan."],
              [RefreshCw, "Automatic backups", "Regular backups mean your website can always be restored if something goes wrong."],
              [Headphones, "Real support", "Reach a real person by WhatsApp or support ticket whenever you need help."],
            ].map(([Icon, title, description]) => (
              <div key={title as string} className="pub-card-dark">
                <div className="flex h-11 w-11 items-center justify-center rounded-lg border border-primary/30 bg-primary/10 text-primary">
                  {React.createElement(Icon as LucideIcon, { className: "h-5 w-5" })}
                </div>
                <h3 className="mt-4 text-base font-black text-white">{title as string}</h3>
                <p className="mt-2 text-sm leading-6 text-white/62">{description as string}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      <section className="pub-section-dark">
        <div className="mx-auto max-w-3xl px-4 py-16 sm:px-6 lg:px-8">
          <div className="text-center">
            <span className="eyebrow">FAQ</span>
            <h2 className="mt-4 text-3xl font-black text-white">Common hosting questions</h2>
          </div>
          <div className="mt-8">
            <FaqAccordionGroup
              dark
              items={[
                { question: "Do I need technical knowledge to use your hosting?", answer: "No. Our hosting and Website Care Plans are built so you never have to touch a server or configuration file — we handle the technical side for you." },
                { question: "What happens if my hosting expires?", answer: "Your website may go offline. We send renewal reminders in advance, and auto-renewal (on by default) helps you avoid this entirely." },
                { question: "Can I move my existing website to NAI TALK?", answer: "Yes, we can help migrate an existing website — get in touch and our team will guide you through it." },
              ]}
            />
          </div>
        </div>
      </section>

      <MarketingCtaBand
        title="See our Website Care Plans"
        subtitle="Hosting, security, backups, email and support — bundled into one simple monthly or yearly plan."
        ctaLabel="View Plans"
        ctaHref="/website-care-plans"
        dark
      />
    </PublicPage>
  );
}

export type PublicHostingPlan = {
  name: string;
  slug: string;
  short_description: string;
  monthly_price: string;
  annual_price: string;
  is_popular: boolean;
  is_recommended: boolean;
  display_badge: string | null;
  cta_label: string;
  public_features: string[];
};

export function WebsiteCarePlansPage() {
  const [plans, setPlans] = useState<PublicHostingPlan[] | null>(null);

  useEffect(() => {
    laravelApi<PublicHostingPlan[]>("/api/v1/public/hosting-plans")
      .then((data) => {
        setPlans(data);
        if (data.length) trackPlanSelection("view", {});
      })
      .catch(() => setPlans([]));
  }, []);

  return (
    <PublicPage>
      <PublicBreadcrumbs items={[{ label: "Website Care Plans" }]} dark />
      <section className="pub-section-dark">
        <div className="mx-auto max-w-3xl px-4 pt-14 text-center sm:px-6 lg:px-8">
          <span className="eyebrow">Website Care Plans</span>
          <h1 className="mt-4 text-4xl font-black text-white sm:text-5xl">Website Care Plans for Growing Businesses</h1>
          <p className="mt-4 text-base leading-7 text-white/62 sm:text-lg">
            No technical stress. We keep your website online, secure, backed up, and supported so you can focus on running your business.
          </p>
        </div>

        <div className="mx-auto max-w-6xl px-4 py-14 sm:px-6 lg:px-8">
          {plans === null ? (
            <p className="text-center text-sm text-white/55">Loading plans...</p>
          ) : plans.length === 0 ? (
            <p className="text-center text-sm font-bold text-white/55">Plans are temporarily unavailable. Please contact support.</p>
          ) : (
            <div className="grid gap-6 lg:grid-cols-3">
              {plans.map((plan) => (
                <div
                  key={plan.slug}
                  className={`pub-card-dark flex flex-col ${plan.is_popular ? "border-2 border-primary shadow-[0_25px_60px_rgba(155,234,22,0.18)] lg:-translate-y-3" : ""}`}
                >
                  {plan.is_popular && (
                    <span className="mb-3 inline-flex w-fit items-center rounded-full bg-primary px-3 py-1 text-[10px] font-black uppercase text-on-primary">
                      {plan.display_badge || "Most Popular"}
                    </span>
                  )}
                  <h2 className="text-xl font-black text-white">{plan.name}</h2>
                  <p className="mt-1 text-sm text-white/62">{plan.short_description}</p>
                  <div className="mt-4">
                    <p className="text-3xl font-black text-white">{plan.monthly_price}<span className="text-sm font-bold text-white/55">/month</span></p>
                    <p className="text-sm text-white/55">{plan.annual_price}/year</p>
                  </div>
                  <ul className="mt-6 grid flex-1 gap-2.5 text-sm text-white/72">
                    {(plan.public_features || []).map((feature) => (
                      <li key={feature} className="flex gap-2">
                        <CheckCircle2 className="mt-0.5 h-4 w-4 shrink-0 text-primary" />
                        {feature}
                      </li>
                    ))}
                  </ul>
                  <a
                    href={`/client/order/hosting?plan=${plan.slug}`}
                    onClick={() => {
                      const buttonText = plan.is_popular ? "Choose Business Care" : plan.cta_label || "Get Started";
                      trackPlanSelection("select", { plan_id: plan.slug, plan_name: plan.name });
                      trackPlanSelection("buy_click", { plan_id: plan.slug, plan_name: plan.name });
                      trackCtaClick({ button_text: buttonText, page_section: "website_care_plans" });
                    }}
                    className={`mt-6 justify-center ${plan.is_popular ? "btn-primary" : "btn-outline"}`}
                  >
                    {plan.is_popular ? "Choose Business Care" : plan.cta_label || "Get Started"}
                    <ArrowRight className="h-4 w-4" />
                  </a>
                </div>
              ))}
            </div>
          )}
        </div>
      </section>

      <MarketingCtaBand
        title="Not sure which plan fits?"
        subtitle="Chat with our team on WhatsApp and we'll help you pick the right Website Care Plan for your business."
        ctaLabel="Contact Support"
        ctaHref="/contact"
        dark
      />
    </PublicPage>
  );
}

export function WebsiteDesignPage() {
  return (
    <PublicPage>
      <PublicBreadcrumbs items={[{ label: "Website Design" }]} dark />
      <MarketingHero
        eyebrow="Website Design"
        title="Website Design for Nigerian Businesses"
        subtitle="We build professional websites that help your business look credible, attract customers, and grow online."
        ctaLabel="Start Your Website"
        ctaHref="/contact"
        secondaryLabel="View Portfolio"
        secondaryHref="/portfolio"
        imageQuery="web design laptop workspace"
        dark
      />

      <section className="pub-section-tint-dark border-y border-white/8">
        <div className="mx-auto max-w-7xl px-4 py-16 sm:px-6 lg:px-8">
          <div className="mx-auto max-w-2xl text-center">
            <span className="eyebrow">What we build</span>
            <h2 className="mt-4 text-3xl font-black text-white">Websites for every kind of business</h2>
          </div>
          <div className="mt-10 grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
            {[
              ["Business websites", "A professional online presence that builds trust with customers."],
              ["Landing pages", "A focused page built to convert visitors for a specific offer or campaign."],
              ["E-commerce websites", "Sell products online with a store built for Nigerian customers."],
              ["Schools, churches, clinics & NGOs", "Websites tailored to the needs of organisations, not just businesses."],
            ].map(([title, description]) => (
              <div key={title} className="pub-card-dark">
                <h3 className="text-base font-black text-white">{title}</h3>
                <p className="mt-2 text-sm leading-6 text-white/62">{description}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      <section className="pub-section-dark">
        <div className="mx-auto max-w-7xl px-4 py-16 sm:px-6 lg:px-8">
          <div className="mx-auto max-w-2xl text-center">
            <span className="eyebrow">Our process</span>
            <h2 className="mt-4 text-3xl font-black text-white">From idea to launch</h2>
          </div>
          <div className="mt-10 grid gap-4 sm:grid-cols-3 lg:grid-cols-5">
            {["Consult", "Design", "Build", "Launch", "Support"].map((step, index) => (
              <div key={step} className="pub-card-dark text-center">
                <span className="text-xs font-black uppercase text-primary">Step {index + 1}</span>
                <h3 className="mt-2 text-base font-black text-white">{step}</h3>
              </div>
            ))}
          </div>
          <p className="mx-auto mt-8 max-w-2xl text-center text-sm leading-7 text-white/62">
            Every website comes with the option to bundle your domain, hosting, and a Website Care Plan in one simple checkout — so there's nothing left for
            you to configure on your own.
          </p>
        </div>
      </section>

      <section className="pub-section-tint-dark border-y border-white/8">
        <div className="mx-auto max-w-5xl px-4 py-14 text-center sm:px-6 lg:px-8">
          <span className="eyebrow">Our work</span>
          <h2 className="mt-4 text-2xl font-black text-white">See examples of what we've built</h2>
          <a href="/portfolio" className="btn-outline mt-6 justify-center">
            View Portfolio
            <ArrowRight className="h-4 w-4" />
          </a>
        </div>
      </section>

      <MarketingCtaBand
        title="Ready to start your website?"
        subtitle="Tell us about your business and we'll help you plan a website that fits your budget and goals."
        ctaLabel="Start Your Website"
        ctaHref="/contact"
        dark
      />
    </PublicPage>
  );
}

export function BusinessEmailHostingPage() {
  return (
    <PublicPage>
      <PublicBreadcrumbs items={[{ label: "Business Email Hosting" }]} dark />
      <MarketingHero
        eyebrow="Business Email"
        title="Professional Business Email Hosting"
        subtitle="info@yourbusiness.com builds trust that a free Gmail or Yahoo address never can. Included with every NAI TALK Website Care Plan."
        ctaLabel="Get Business Email"
        ctaHref="/website-care-plans"
        secondaryLabel="Register a Domain First"
        secondaryHref="/domain-registration"
        imageQuery="professional email office laptop"
        dark
      />

      <section className="pub-section-dark">
        <div className="mx-auto max-w-4xl px-4 py-16 sm:px-6 lg:px-8">
          <h2 className="text-2xl font-black text-white">Why professional email matters</h2>
          <p className="mt-3 text-base leading-7 text-white/62">
            First impressions matter, and for many customers, your email address is one of the first things they notice. "info@yourbusiness.com" reads as
            established and trustworthy — a free address reads as a side project. It also gives you control: create addresses for different roles
            (info@, support@, accounts@) without sharing a single personal inbox.
          </p>

          <div className="mt-10 grid gap-4 sm:grid-cols-2">
            <div className="pub-card-dark">
              <div className="flex h-11 w-11 items-center justify-center rounded-lg border border-primary/30 bg-primary/10 text-primary">
                <BadgeCheck className="h-5 w-5" />
              </div>
              <h3 className="mt-4 text-base font-black text-white">Trust and professionalism</h3>
              <p className="mt-2 text-sm leading-6 text-white/62">A matching email address makes your business look established, even if you're just getting started.</p>
            </div>
            <div className="pub-card-dark">
              <div className="flex h-11 w-11 items-center justify-center rounded-lg border border-primary/30 bg-primary/10 text-primary">
                <Settings className="h-5 w-5" />
              </div>
              <h3 className="mt-4 text-base font-black text-white">We help you set it up</h3>
              <p className="mt-2 text-sm leading-6 text-white/62">No technical steps for you to figure out — our team gets your business email working with your domain.</p>
            </div>
            <div className="pub-card-dark">
              <div className="flex h-11 w-11 items-center justify-center rounded-lg border border-primary/30 bg-primary/10 text-primary">
                <PackageCheck className="h-5 w-5" />
              </div>
              <h3 className="mt-4 text-base font-black text-white">Included in Website Care</h3>
              <p className="mt-2 text-sm leading-6 text-white/62">Every plan includes at least one business email account, with higher plans including more.</p>
            </div>
            <div className="pub-card-dark">
              <div className="flex h-11 w-11 items-center justify-center rounded-lg border border-primary/30 bg-primary/10 text-primary">
                <Globe2 className="h-5 w-5" />
              </div>
              <h3 className="mt-4 text-base font-black text-white">Works with your domain</h3>
              <p className="mt-2 text-sm leading-6 text-white/62">Business email is tied to your domain name — register or transfer yours to get started.</p>
            </div>
          </div>
        </div>
      </section>

      <MarketingCtaBand
        title="Get a professional email address"
        subtitle="Business email comes included in every Website Care Plan — no separate setup needed."
        ctaLabel="View Website Care Plans"
        ctaHref="/website-care-plans"
        dark
      />
    </PublicPage>
  );
}

export function SeoServicesPage() {
  return (
    <PublicPage>
      <PublicBreadcrumbs items={[{ label: "SEO Services" }]} />
      <MarketingHero
        eyebrow="SEO Services"
        title="SEO Services for Nigerian Businesses"
        subtitle="Improve your Google visibility with on-page SEO, content SEO, local SEO, and a well-structured, fast website."
        ctaLabel="Improve My Website SEO"
        ctaHref="/contact"
        secondaryLabel="Read Our Blog"
        secondaryHref="/blog"
        imageQuery="analytics search engine marketing dashboard"
      />

      <section className="pub-section-tint border-y border-black/5">
        <div className="mx-auto max-w-7xl px-4 py-16 sm:px-6 lg:px-8">
          <div className="mx-auto max-w-2xl text-center">
            <span className="pub-eyebrow">What's included</span>
            <h2 className="mt-4 text-3xl font-black text-[#07111f]">How we improve your visibility</h2>
          </div>
          <div className="mt-10 grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
            {[
              ["On-page SEO", "Clear titles, headings, and page structure that help Google understand what your business offers."],
              ["Content & blog SEO", "Helpful articles that answer real customer questions and bring in organic search traffic."],
              ["Local SEO", "Show up when Nigerian customers search for businesses like yours in their area."],
              ["Technical SEO basics", "A fast, well-structured website — the foundation every good SEO strategy is built on."],
            ].map(([title, description]) => (
              <div key={title} className="pub-card">
                <h3 className="text-base font-black text-[#07111f]">{title}</h3>
                <p className="mt-2 text-sm leading-6 text-[#596273]">{description}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      <section className="pub-section">
        <div className="mx-auto max-w-4xl px-4 py-16 text-center sm:px-6 lg:px-8">
          <h2 className="text-2xl font-black text-[#07111f]">SEO works better on a solid foundation</h2>
          <p className="mt-3 text-base leading-7 text-[#596273]">
            A fast, well-structured website with clear pages for every service you offer gives search engines far more to work with than a single crowded
            page. That's exactly how NAI TALK builds every website — with SEO in mind from the start, not bolted on afterward.
          </p>
        </div>
      </section>

      <MarketingCtaBand
        title="Ready to improve your search visibility?"
        subtitle="Let's talk about your business goals and how SEO fits into your website strategy."
        ctaLabel="Improve My Website SEO"
        ctaHref="/contact"
      />
    </PublicPage>
  );
}


export function FaqsPage() {
  const [groups, setGroups] = useState<Array<{ group: string; items: Array<{ question: string; answer: string }> }> | null>(null);

  useEffect(() => {
    laravelApi<{ groups: typeof groups }>("/api/v1/public/faqs")
      .then((response) => setGroups(response.groups))
      .catch(() => setGroups([]));
  }, []);

  return (
    <PublicPage>
      <PublicBreadcrumbs items={[{ label: "FAQs" }]} />
      <section className="pub-section">
        <div className="mx-auto max-w-3xl px-4 pt-10 text-center sm:px-6 lg:px-8">
          <span className="pub-eyebrow">FAQs</span>
          <h1 className="mt-4 text-4xl font-black text-[#07111f] sm:text-5xl">Frequently Asked Questions</h1>
          <p className="mt-4 text-base leading-7 text-[#596273]">Answers to the questions we hear most about domains, hosting, website care, payments and support.</p>
        </div>

        <div className="mx-auto max-w-4xl px-4 py-14 sm:px-6 lg:px-8">
          {groups === null ? (
            <p className="text-center text-sm text-[#596273]">Loading...</p>
          ) : groups.length === 0 ? (
            <p className="pub-card text-center text-sm text-[#596273]">FAQs are temporarily unavailable. Please contact support.</p>
          ) : (
            <div className="grid gap-10">
              {groups.map((group) => (
                <FaqAccordionGroup key={group.group} title={group.group} items={group.items} />
              ))}
            </div>
          )}
        </div>
      </section>

      <MarketingCtaBand
        title="Still have questions?"
        subtitle="Our support team is ready to help — reach out any time."
        ctaLabel="Contact Support"
        ctaHref="/contact"
      />
    </PublicPage>
  );
}

export function HowToPayPage() {
  return (
    <PublicPage>
      <PublicBreadcrumbs items={[{ label: "How to Pay" }]} />
      <section className="pub-section">
        <div className="mx-auto max-w-3xl px-4 pt-10 text-center sm:px-6 lg:px-8">
          <span className="pub-eyebrow">How to Pay</span>
          <h1 className="mt-4 text-4xl font-black text-[#07111f] sm:text-5xl">How to Pay</h1>
          <p className="mt-4 text-base leading-7 text-[#596273]">A simple guide to settling any invoice, however you'd rather pay.</p>
        </div>

        <div className="mx-auto max-w-4xl px-4 py-14 sm:px-6 lg:px-8">
          <div className="grid gap-6 sm:grid-cols-2">
            {[
              [CreditCard, "Card payment", "Pay instantly online with your debit card via Paystack or Flutterwave — your invoice is marked paid immediately."],
              [Building2, "Bank transfer", "Transfer directly to our bank account, then upload your proof of payment. Our team verifies it and confirms your invoice."],
              [Wallet, "Wallet payment", "Fund your NAI TALK wallet once, then pay any invoice instantly from your balance — no card details needed each time."],
              [RefreshCw, "Pay with wallet (partial)", "If your wallet balance only covers part of an invoice, that portion is applied automatically and the rest stays outstanding."],
            ].map(([Icon, title, description]) => (
              <div key={title as string} className="pub-card">
                <div className="flex h-11 w-11 items-center justify-center rounded-lg border border-primary/30 bg-primary/10 text-[#2f6d10]">
                  {React.createElement(Icon as LucideIcon, { className: "h-5 w-5" })}
                </div>
                <h3 className="mt-4 text-base font-black text-[#07111f]">{title as string}</h3>
                <p className="mt-2 text-sm leading-6 text-[#596273]">{description as string}</p>
              </div>
            ))}
          </div>

          <div className="mt-10 grid gap-4">
            <h2 className="text-xl font-black text-[#07111f]">Uploading proof of payment</h2>
            <p className="text-sm leading-7 text-[#596273]">
              After a bank transfer, open the invoice from your dashboard and upload a screenshot or receipt of the transfer. Our team reviews it and
              confirms payment — you'll get a notification once it's approved.
            </p>

            <h2 className="mt-4 text-xl font-black text-[#07111f]">Overpayments and underpayments</h2>
            <p className="text-sm leading-7 text-[#596273]">
              If you pay slightly more than an invoice total, the extra amount is automatically credited to your wallet for future use. If you pay slightly
              less, the remaining balance simply stays outstanding until it's settled — nothing is lost either way.
            </p>

            <h2 className="mt-4 text-xl font-black text-[#07111f]">What happens after payment?</h2>
            <p className="text-sm leading-7 text-[#596273]">
              Once your payment is confirmed, your service is activated or renewed automatically, and you'll receive a confirmation email with your receipt.
            </p>
          </div>
        </div>
      </section>

      <MarketingCtaBand
        title="Need help with a payment?"
        subtitle="Our support team can help you complete a payment or check on an invoice."
        ctaLabel="Contact Support"
        ctaHref="/contact"
      />
    </PublicPage>
  );
}

export const SERVICE_STATUS_STYLES: Record<string, string> = {
  operational: "bg-primary/10 text-[#2f6d10] border-primary/30",
  degraded: "bg-yellow-100 text-yellow-800 border-yellow-300",
  maintenance: "bg-blue-100 text-blue-800 border-blue-300",
  incident: "bg-red-100 text-red-700 border-red-300",
};

export const SERVICE_STATUS_LABELS: Record<string, string> = {
  operational: "Operational",
  degraded: "Degraded",
  maintenance: "Maintenance",
  incident: "Incident",
};

export function ServiceStatusPage() {
  const [data, setData] = useState<{ overall_status: string; services: Array<{ name: string; status: string; message: string | null; updated_at: string | null }> } | null>(null);

  useEffect(() => {
    laravelApi<typeof data>("/api/v1/public/service-status")
      .then(setData)
      .catch(() => setData({ overall_status: "operational", services: [] }));
  }, []);

  return (
    <PublicPage>
      <PublicBreadcrumbs items={[{ label: "Service Status" }]} />
      <section className="pub-section">
        <div className="mx-auto max-w-3xl px-4 pt-10 text-center sm:px-6 lg:px-8">
          <span className="pub-eyebrow">Service Status</span>
          <h1 className="mt-4 text-4xl font-black text-[#07111f] sm:text-5xl">Service Status</h1>
          <p className="mt-4 text-base leading-7 text-[#596273]">Live status for the services you depend on.</p>
        </div>

        <div className="mx-auto max-w-3xl px-4 py-14 sm:px-6 lg:px-8">
          {!data ? (
            <p className="text-center text-sm text-[#596273]">Loading status...</p>
          ) : (
            <>
              <div className={`mb-6 rounded-xl border px-5 py-4 text-center text-sm font-black ${SERVICE_STATUS_STYLES[data.overall_status] || SERVICE_STATUS_STYLES.operational}`}>
                {data.overall_status === "operational" ? "All systems operational" : `Some services need attention: ${SERVICE_STATUS_LABELS[data.overall_status]}`}
              </div>
              <div className="grid gap-3">
                {data.services.map((service) => (
                  <div key={service.name} className="pub-card flex items-center justify-between !p-4">
                    <div>
                      <p className="text-sm font-black text-[#07111f]">{service.name}</p>
                      {service.message && <p className="mt-0.5 text-xs text-[#596273]">{service.message}</p>}
                    </div>
                    <span className={`rounded-full border px-3 py-1 text-[10px] font-black uppercase ${SERVICE_STATUS_STYLES[service.status] || SERVICE_STATUS_STYLES.operational}`}>
                      {SERVICE_STATUS_LABELS[service.status] || service.status}
                    </span>
                  </div>
                ))}
              </div>
            </>
          )}
        </div>
      </section>
    </PublicPage>
  );
}

export const ABOUT_VALUES = [
  { icon: ShieldCheck, title: "Reliability first", description: "Your website, email and domains stay online and backed up — we treat every client's business as if it were our own." },
  { icon: Headphones, title: "Real human support", description: "No ticket queues that go nowhere — you can always reach a real person on WhatsApp or a support ticket." },
  { icon: BadgeCheck, title: "Straightforward pricing", description: "No hidden fees or surprise renewals — you always know what you're paying for and why." },
  { icon: Rocket, title: "Built for growth", description: "From your first domain to a fully managed website, we scale with you as your business grows." },
];

export function AboutPage() {
  const heroImage = usePublicImage("team meeting office africa", "landscape");

  return (
    <PublicPage>
      <PublicBreadcrumbs items={[{ label: "About" }]} dark />
      <section className="pub-section-dark">
        <div className="mx-auto grid max-w-7xl gap-10 px-4 py-14 sm:px-6 lg:grid-cols-2 lg:items-center lg:px-8 lg:py-20">
          <div>
            <span className="eyebrow">About NAI TALK</span>
            <h1 className="mt-4 text-4xl font-black leading-[1.08] text-white sm:text-5xl">Helping Nigerian businesses build a trustworthy online presence</h1>
            <p className="mt-5 max-w-xl text-base leading-8 text-white/62 sm:text-lg">
              NAI TALK gives small businesses, schools, churches, NGOs and growing brands an easy way to get online and stay online — domains, hosting,
              professional email and website design, without the technical stress.
            </p>
            <div className="mt-8 flex flex-wrap gap-3">
              <a href="/contact" className="btn-primary justify-center">
                Contact Us
                <ArrowRight className="h-4 w-4" />
              </a>
              <a href="/portfolio" className="btn-outline justify-center">View Our Work</a>
            </div>
          </div>
          <div className="relative">
            <img
              src={heroImage?.url || "/images/placeholder-business.svg"}
              alt={heroImage?.alt_text || "The NAI TALK team at work"}
              loading="eager"
              width={800}
              height={600}
              className="aspect-[4/3] w-full rounded-2xl object-cover shadow-[0_30px_80px_rgba(16,24,16,0.14)]"
            />
          </div>
        </div>
      </section>

      <section className="pub-section-tint-dark">
        <div className="mx-auto max-w-7xl px-4 py-16 sm:px-6 lg:px-8">
          <div className="mx-auto max-w-2xl text-center">
            <span className="eyebrow">What we stand for</span>
            <h2 className="mt-4 text-3xl font-black text-white sm:text-4xl">Why businesses trust NAI TALK</h2>
          </div>
          <div className="mt-10 grid gap-6 sm:grid-cols-2 lg:grid-cols-4">
            {ABOUT_VALUES.map((value) => (
              <div key={value.title} className="pub-card-dark">
                <div className="flex h-11 w-11 items-center justify-center rounded-lg border border-primary/30 bg-primary/10 text-primary">
                  <value.icon className="h-5 w-5" />
                </div>
                <h3 className="mt-4 text-base font-black text-white">{value.title}</h3>
                <p className="mt-2 text-sm leading-6 text-white/62">{value.description}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      <section className="pub-section-dark">
        <div className="mx-auto max-w-4xl px-4 py-16 text-center sm:px-6 lg:px-8">
          <span className="eyebrow">Our story</span>
          <h2 className="mt-4 text-3xl font-black text-white sm:text-4xl">Started to make going online simple</h2>
          <p className="mt-5 text-base leading-8 text-white/62">
            NAI TALK started with a simple observation: too many Nigerian businesses were losing customers because their websites were slow, their email
            looked unprofessional, or their domain had quietly expired. We set out to fix that — bundling domains, hosting, website care and design into one
            place, backed by people who actually pick up the phone.
          </p>
        </div>
      </section>

      <MarketingCtaBand
        title="Ready to start your online journey?"
        subtitle="Search your domain, choose a website care plan, or talk to our team about what you need."
        ctaLabel="Search Domain"
        ctaHref="/domains"
        dark
      />
    </PublicPage>
  );
}

export const contactPageInputClass =
  "w-full rounded-lg border border-white/15 bg-white/5 px-4 py-3 text-sm text-white outline-none transition placeholder:text-white/35 focus:border-primary/50 focus:ring-2 focus:ring-primary/15";

export const contactPageInfoItems = [
  { icon: Mail, label: "Email", lines: ["info@naitalk.com"], href: "mailto:info@naitalk.com" },
  { icon: Phone, label: "Phone", lines: ["+234 708 705 7654"], href: "tel:+2347087057654" },
  { icon: MapPin, label: "Office Address", lines: ["7 Unity Rd, Off Command Rd, Ikola, Lagos."] },
  { icon: Clock, label: "Support Hours", lines: ["Mon – Fri: 8:00 AM – 6:00 PM", "Sat: 9:00 AM – 2:00 PM"] },
];

export function ContactPage() {
  const [formData, setFormData] = useState({ name: "", email: "", phone: "", service: "Business Website", details: "" });
  const [status, setStatus] = useState<"idle" | "loading" | "success" | "error">("idle");
  const [message, setMessage] = useState("");

  const handleChange = (event: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement | HTMLSelectElement>) => {
    const { name, value } = event.target;
    setFormData((current) => ({ ...current, [name]: value }));
  };

  const handleSubmit = async (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    setStatus("loading");
    setMessage("");

    try {
      const response = await fetch("/api/contact", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(formData),
      });
      const payload = await response.json().catch(() => ({}));

      if (!response.ok) {
        throw new Error(payload.error || "Message could not be sent. Please try WhatsApp instead.");
      }

      setStatus("success");
      setMessage("Message sent successfully. We will get back to you shortly.");
      // service is a dropdown category (e.g. "Business Website"), never PII.
      trackFormSubmission("contact_form", "success", { page_section: "contact_page", service: formData.service });
      setFormData({ name: "", email: "", phone: "", service: "Business Website", details: "" });
    } catch (error) {
      setStatus("error");
      setMessage(error instanceof Error ? error.message : "Message could not be sent.");
      trackFormSubmission("contact_form", "error", { page_section: "contact_page" });
    }
  };

  return (
    <PublicPage>
      <PublicBreadcrumbs items={[{ label: "Contact" }]} dark />
      <section className="pub-section-dark relative overflow-hidden">
        <div aria-hidden="true" className="pointer-events-none absolute -right-24 -top-24 h-80 w-80 rounded-full bg-primary/12 blur-3xl" />
        <div aria-hidden="true" className="pointer-events-none absolute -left-16 top-20 hidden h-64 w-64 rounded-full border border-white/10 sm:block" />
        <div aria-hidden="true" className="pointer-events-none absolute -left-10 bottom-0 hidden h-56 w-56 rounded-full border border-white/10 sm:block" />

        <div className="relative mx-auto max-w-3xl px-4 pt-14 text-center sm:px-6 lg:px-8">
          <span className="eyebrow inline-flex items-center gap-2">
            <Mail className="h-3.5 w-3.5" />
            Contact Us
          </span>
          <h1 className="mt-4 text-4xl font-black text-white sm:text-5xl">Let's talk about your website</h1>
          <p className="mt-4 text-base leading-7 text-white/62">
            Whether you need a domain, hosting, a new website or expert support, our team is here to help you succeed online.
          </p>
        </div>

        <div className="relative mx-auto max-w-6xl px-4 py-14 sm:px-6 lg:px-8">
          <div className="grid gap-6 lg:grid-cols-[0.85fr_1.15fr]">
            <div className="grid gap-4">
              {contactPageInfoItems.map((item) => {
                const Icon = item.icon;
                const body = (
                  <>
                    <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-lg border border-primary/30 bg-primary/10 text-primary">
                      <Icon className="h-5 w-5" />
                    </div>
                    <div className="flex-1">
                      <h3 className="text-sm font-black text-white">{item.label}</h3>
                      {item.lines.map((line) => (
                        <p key={line} className="mt-0.5 text-sm text-white/62">{line}</p>
                      ))}
                    </div>
                    {item.href && <ChevronRight className="h-4 w-4 shrink-0 text-white/25" />}
                  </>
                );

                return item.href ? (
                  <a
                    key={item.label}
                    href={item.href}
                    className="pub-card-dark flex items-center gap-4 !p-5 transition hover:border-primary/40"
                    onClick={() => {
                      if (item.href?.startsWith("mailto:")) trackEvent("email_click", { page_section: "contact_page" });
                      else if (item.href?.startsWith("tel:")) trackEvent("phone_click", { page_section: "contact_page" });
                    }}
                  >
                    {body}
                  </a>
                ) : (
                  <div key={item.label} className="pub-card-dark flex items-center gap-4 !p-5">
                    {body}
                  </div>
                );
              })}

              <div className="rounded-2xl border border-primary/25 bg-primary/[0.06] p-5">
                <div className="flex flex-wrap items-center gap-4">
                  <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-lg bg-[#25D366]/15 text-[#25D366]">
                    <MessageCircle className="h-5 w-5" />
                  </div>
                  <div className="flex-1">
                    <h3 className="text-sm font-black text-white">Prefer quick help?</h3>
                    <p className="mt-0.5 text-sm text-white/62">Chat with us on WhatsApp</p>
                  </div>
                  <a
                    href={whatsappUrl}
                    className="inline-flex items-center gap-1.5 whitespace-nowrap rounded-full border border-primary/30 bg-primary/10 px-4 py-2 text-xs font-black text-primary transition hover:border-primary/60"
                    onClick={() => trackEvent("whatsapp_click", { page_section: "contact_page" })}
                  >
                    Chat on WhatsApp
                    <ArrowUpRight className="h-3.5 w-3.5" />
                  </a>
                </div>
              </div>
            </div>

            <div className="pub-card-dark !p-6 sm:!p-8">
              <div className="flex items-center gap-4">
                <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-lg border border-primary/30 bg-primary/10 text-primary">
                  <Send className="h-5 w-5" />
                </div>
                <div>
                  <h2 className="text-lg font-black text-white">Send us a message</h2>
                  <p className="mt-0.5 text-sm text-white/62">Fill out the form below and we'll get back to you shortly.</p>
                </div>
              </div>

              <form className="mt-6 grid gap-5" onSubmit={handleSubmit}>
                <div className="grid gap-5 sm:grid-cols-2">
                  <label className="grid gap-2">
                    <span className="flex items-center gap-1.5 text-xs font-black text-white">
                      <User className="h-3.5 w-3.5 text-white/50" />
                      Full Name
                    </span>
                    <input
                      required
                      minLength={2}
                      name="name"
                      value={formData.name}
                      onChange={handleChange}
                      placeholder="e.g. John Doe"
                      className={contactPageInputClass}
                    />
                  </label>
                  <label className="grid gap-2">
                    <span className="flex items-center gap-1.5 text-xs font-black text-white">
                      <Mail className="h-3.5 w-3.5 text-white/50" />
                      Email Address
                    </span>
                    <input
                      required
                      type="email"
                      name="email"
                      value={formData.email}
                      onChange={handleChange}
                      placeholder="e.g. john@example.com"
                      className={contactPageInputClass}
                    />
                  </label>
                </div>

                <div className="grid gap-5 sm:grid-cols-2">
                  <label className="grid gap-2">
                    <span className="flex items-center gap-1.5 text-xs font-black text-white">
                      <Briefcase className="h-3.5 w-3.5 text-white/50" />
                      Service Interested In
                    </span>
                    <select name="service" value={formData.service} onChange={handleChange} className={contactPageInputClass}>
                      <option>Business Website</option>
                      <option>Domains & Hosting</option>
                      <option>Website Care Plan</option>
                      <option>Business Email Hosting</option>
                      <option>SEO Services</option>
                      <option>Something else</option>
                    </select>
                  </label>
                  <label className="grid gap-2">
                    <span className="flex items-center gap-1.5 text-xs font-black text-white">
                      <Phone className="h-3.5 w-3.5 text-white/50" />
                      Phone Number
                    </span>
                    <input
                      type="tel"
                      name="phone"
                      value={formData.phone}
                      onChange={handleChange}
                      placeholder="e.g. 0708 705 7654"
                      className={contactPageInputClass}
                    />
                  </label>
                </div>

                <label className="grid gap-2">
                  <span className="flex items-center gap-1.5 text-xs font-black text-white">
                    <MessageCircle className="h-3.5 w-3.5 text-white/50" />
                    Message
                  </span>
                  <textarea
                    required
                    minLength={10}
                    maxLength={1000}
                    name="details"
                    value={formData.details}
                    onChange={handleChange}
                    rows={5}
                    placeholder="Tell us how we can help you..."
                    className={`${contactPageInputClass} resize-none`}
                  />
                  <span className="text-right text-xs text-white/35">{formData.details.length} / 1000</span>
                </label>

                <div className="flex flex-wrap items-center justify-between gap-4 border-t border-white/10 pt-5">
                  <span className="inline-flex items-center gap-2 text-xs font-bold text-white/62">
                    <ShieldCheck className="h-4 w-4 text-primary" />
                    Your information is safe with us.
                  </span>
                  <button type="submit" className="btn-primary justify-center" disabled={status === "loading"}>
                    {status === "loading" ? "Sending..." : "Send Message"}
                    <ChevronRight className="h-4 w-4" />
                  </button>
                </div>
                {message && (
                  <p
                    className={`rounded-lg border px-4 py-3 text-sm font-bold ${
                      status === "success" ? "border-primary/30 bg-primary/10 text-primary" : "border-red-500/30 bg-red-500/10 text-red-400"
                    }`}
                  >
                    {message}
                  </p>
                )}
              </form>
            </div>
          </div>
        </div>
      </section>
    </PublicPage>
  );
}

export function PortfolioPage() {
  const [projects, setProjects] = useState<Project[]>(fallbackProjects);

  useEffect(() => {
    fetch("/api/site-content")
      .then((response) => response.json())
      .then((data) => {
        if (Array.isArray(data.projects) && data.projects.length > 0) {
          setProjects(data.projects);
        }
      })
      .catch(() => setProjects(fallbackProjects));
  }, []);

  return (
    <PublicPage>
      <PublicBreadcrumbs items={[{ label: "Portfolio" }]} />
      <div className="pt-4">
        <Portfolio projects={projects} headingLevel="h1" />
      </div>
      <MarketingCtaBand
        title="Ready to start your online journey?"
        subtitle="Search your domain, choose a website care plan, or talk to our team about what you need."
        ctaLabel="Search Domain"
        ctaHref="/domains"
      />
    </PublicPage>
  );
}

export function LegalPage({ title, sections }: { title: string; sections: Array<{ heading: string; body: string }> }) {
  return (
    <PublicPage seoOverrides={{ title: `${title} | NAI TALK`, description: `${title} for NAI TALK's domains, hosting and website services.` }}>
      <PublicBreadcrumbs items={[{ label: title }]} />
      <section className="pub-section">
        <div className="mx-auto max-w-3xl px-4 py-14 sm:px-6 lg:px-8">
          <span className="pub-eyebrow">Legal</span>
          <h1 className="mt-4 text-3xl font-black text-[#07111f] sm:text-4xl">{title}</h1>
          <p className="mt-2 text-xs text-[#596273]">Last updated: 11 July 2026</p>
          <div className="mt-8 grid gap-8">
            {sections.map((section) => (
              <div key={section.heading}>
                <h2 className="text-lg font-black text-[#07111f]">{section.heading}</h2>
                <p className="mt-2 text-sm leading-7 text-[#596273]">{section.body}</p>
              </div>
            ))}
          </div>
        </div>
      </section>
    </PublicPage>
  );
}

export function PrivacyPolicyPage() {
  return (
    <LegalPage
      title="Privacy Policy"
      sections={[
        { heading: "Information we collect", body: "We collect the information you provide when creating an account, placing an order, or contacting support — such as your name, email address, phone number, business address, and payment reference details. We never store your full card details; those are handled directly by our payment processors." },
        { heading: "How we use your information", body: "We use your information to provision and manage your domains and hosting, send billing and renewal notices, respond to support requests, and improve our services. We do not sell your personal information to third parties." },
        { heading: "Data storage & security", body: "Your data is stored on secured servers with access restricted to authorised NAI TALK staff. Sensitive details such as domain transfer codes are encrypted at rest." },
        { heading: "Your rights", body: "You can request a copy of the personal information we hold about you, ask us to correct inaccuracies, or request account deletion by contacting info@naitalk.com." },
        { heading: "Contact us", body: "Questions about this policy can be sent to info@naitalk.com or via WhatsApp on 0708 705 7654." },
      ]}
    />
  );
}

export function TermsOfServicePage() {
  return (
    <LegalPage
      title="Terms of Service"
      sections={[
        { heading: "Our services", body: "NAI TALK provides domain registration and transfer, web hosting, website care plans, business email hosting, website design, and related support services to clients in Nigeria and internationally." },
        { heading: "Accounts & payments", body: "You are responsible for the accuracy of the information on your account and for keeping your login details secure. Invoices are payable by card, bank transfer, or your NAI TALK wallet before a service is activated or renewed." },
        { heading: "Domains", body: "Domain registrations and transfers are subject to the policies of the relevant domain registry. NAI TALK acts as your registrar/reseller and is not responsible for delays or decisions made by registries outside our control." },
        { heading: "Hosting & website care", body: "We provide the infrastructure, backups, and support described in your chosen plan. You remain responsible for the content you publish on your website." },
        { heading: "Service suspension", body: "We may suspend a service for non-payment, abuse, or activity that threatens the security of our platform, after reasonable notice where practical." },
        { heading: "Changes to these terms", body: "We may update these terms from time to time. Continued use of our services after an update means you accept the revised terms." },
      ]}
    />
  );
}

export function RefundPolicyPage() {
  return (
    <LegalPage
      title="Refund Policy"
      sections={[
        { heading: "Domains", body: "Domain registration and transfer fees are generally non-refundable once a domain has been successfully registered or transferred, in line with registry policy." },
        { heading: "Hosting & website care plans", body: "If you're not satisfied with a new hosting or website care plan, contact support within 7 days of your first payment and we'll review your case for a refund or credit." },
        { heading: "Overpayments", body: "If you pay more than an invoice total, the extra amount is automatically credited to your NAI TALK wallet and can be used against any future invoice." },
        { heading: "How to request a refund", body: "Reach out to info@naitalk.com or open a support ticket from your dashboard with your invoice reference, and our team will review your request within 3 business days." },
      ]}
    />
  );
}

