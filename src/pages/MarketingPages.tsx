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
import { trackSiteEvent } from "../lib/siteAnalytics";
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
import { ResponsiveImage, buildDataAssetSrcSet } from "../components/ResponsiveImage";
import { WEBSITE_CARE_HEADLINE, WEBSITE_CARE_SUBTEXT, PlanBadge, PlanHighlights, PlanFeatureList, WebsiteCareComparisonTable, toHostingPlanCard } from "../shared/websiteCare";
import { EmailOnlyPlans } from "../shared/emailPlans";

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
              [Mail, "Professional email", "Unlimited professional business email accounts on your own domain, included on every plan."],
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
        <div className="mx-auto max-w-7xl px-4 pt-16 sm:px-6 lg:px-8">
          <a href="/green-mail" className="group flex flex-col items-start gap-5 overflow-hidden rounded-3xl border border-[#22a04f]/40 p-6 transition hover:border-[#22a04f]/80 sm:flex-row sm:items-center sm:p-8" style={{ background: "radial-gradient(circle at 90% 0%, rgba(34,160,79,0.3), transparent 50%), rgba(255,255,255,0.03)" }}>
            <img src="/greenmail-app/badge-128.webp" alt="" width={64} height={64} className="shrink-0 rounded-2xl shadow-lg" />
            <span className="flex-1">
              <span className="text-[11px] font-black uppercase tracking-wide text-[#86efac]">Included free with every plan</span>
              <span className="mt-1 block text-2xl font-black text-white">Meet Green Mail, your smarter business inbox</span>
              <span className="mt-1 block text-sm leading-6 text-white/62">Webmail on your own domain with an AI assistant, calendar, tasks, templates, campaigns, filters and an app for your phone.</span>
            </span>
            <span className="inline-flex shrink-0 items-center gap-2 rounded-full bg-[#22a04f] px-5 py-3 text-sm font-black text-white transition group-hover:translate-x-1">
              Explore Green Mail <ArrowRight className="h-4 w-4" />
            </span>
          </a>
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
        subtitle="Hosting, security, backups, email and support — bundled into one simple annual plan."
        ctaLabel="View Plans"
        ctaHref="/website-care-plans"
        dark
      />
    </PublicPage>
  );
}

export function WebsiteCarePlansPage() {
  const [plans, setPlans] = useState<HostingPlanCard[] | null>(null);

  useEffect(() => {
    laravelApi<Array<Record<string, unknown>>>("/api/v1/public/hosting-plans")
      .then((data) => {
        setPlans(data.map(toHostingPlanCard));
        if (data.length) {
          trackPlanSelection("view", {});
          trackSiteEvent("domain_hosting", "hosting_plan_view");
        }
      })
      .catch(() => setPlans([]));
  }, []);

  return (
    <PublicPage>
      <PublicBreadcrumbs items={[{ label: "Website Care Plans" }]} dark />
      <section className="pub-section-dark">
        <div className="mx-auto max-w-3xl px-4 pt-14 text-center sm:px-6 lg:px-8">
          <span className="eyebrow">Website Care Plans</span>
          <h1 className="mt-4 text-4xl font-black text-white sm:text-5xl">{WEBSITE_CARE_HEADLINE}</h1>
          <p className="mt-4 text-base leading-7 text-white/62 sm:text-lg">{WEBSITE_CARE_SUBTEXT}</p>
        </div>

        <div className="mx-auto max-w-7xl px-4 py-14 sm:px-6 lg:px-8">
          {plans === null ? (
            <p className="text-center text-sm text-white/55">Loading plans...</p>
          ) : plans.length === 0 ? (
            <p className="text-center text-sm font-bold text-white/55">Plans are temporarily unavailable. Please contact support.</p>
          ) : (
            <>
              <div className="grid gap-6 sm:grid-cols-2 xl:grid-cols-4">
                {plans.map((plan) => {
                  const ctaText = plan.ctaLabel || "Get Started";

                  return (
                    <div
                      key={plan.slug}
                      className={`pub-card-dark relative flex flex-col ${plan.featured ? "border-2 border-primary shadow-[0_25px_60px_rgba(155,234,22,0.18)] xl:-translate-y-3" : ""}`}
                    >
                      {plan.featured && <PlanBadge label={plan.badge || "Most Popular"} />}
                      <h2 className="text-xl font-black text-white xl:min-h-[3.5rem]">{plan.name}</h2>
                      <p className="mt-1 text-sm text-white/62 xl:min-h-[5.5rem]">{plan.audience}</p>
                      <p className="mt-4 text-3xl font-black text-white">{plan.annual}<span className="text-sm font-bold text-white/55">/year</span></p>
                      <PlanHighlights plan={plan} />
                      <PlanFeatureList features={plan.features} className="mt-5 flex-1" />
                      <a
                        href={`/client/order/hosting?plan=${plan.slug}`}
                        onClick={() => {
                          trackPlanSelection("select", { plan_id: plan.slug, plan_name: plan.name });
                          trackPlanSelection("buy_click", { plan_id: plan.slug, plan_name: plan.name });
                          trackSiteEvent("domain_hosting", "hosting_plan_buy_click", { plan_id: plan.slug, plan_name: plan.name });
                          trackCtaClick({ button_text: ctaText, page_section: "website_care_plans" });
                        }}
                        className={`mt-6 justify-center ${plan.featured ? "btn-primary" : "btn-outline"}`}
                      >
                        {ctaText}
                        <ArrowRight className="h-4 w-4" />
                      </a>
                    </div>
                  );
                })}
              </div>
              <WebsiteCareComparisonTable plans={plans} />
            </>
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
        subtitle="info@yourbusiness.com builds trust that a free Gmail or Yahoo address never can. Get it on its own from ₦12,000 a year — or free with every NAI TALK Website Care Plan."
        ctaLabel="See Email Plans"
        ctaHref="#email-plans"
        secondaryLabel="Website Care Plans"
        secondaryHref="/website-care-plans"
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
              <h3 className="mt-4 text-base font-black text-white">On its own, or with your website</h3>
              <p className="mt-2 text-sm leading-6 text-white/62">Buy email alone from ₦12,000 a year, or get unlimited mailboxes free with any Website Care Plan.</p>
            </div>
            <div className="pub-card-dark">
              <div className="flex h-11 w-11 items-center justify-center rounded-lg border border-primary/30 bg-primary/10 text-primary">
                <Globe2 className="h-5 w-5" />
              </div>
              <h3 className="mt-4 text-base font-black text-white">Works with your domain</h3>
              <p className="mt-2 text-sm leading-6 text-white/62">Keep your domain where it is, or register a new one with us — your email works either way.</p>
            </div>
          </div>

          <a href="/green-mail" className="mt-6 flex items-center gap-4 rounded-2xl border border-[#22a04f]/40 bg-[#22a04f]/[0.07] p-5 transition hover:border-[#22a04f]/80">
            <img src="/greenmail-app/badge-128.webp" alt="" width={48} height={48} className="shrink-0 rounded-xl" />
            <span className="flex-1 text-sm leading-6 text-white/70">
              <strong className="block text-base text-white">Read and send it all in Green Mail</strong>
              Our free webmail, with an AI assistant, calendar, templates and a phone app.
            </span>
            <ArrowRight className="h-5 w-5 shrink-0 text-[#4ade80]" />
          </a>
        </div>
      </section>

      <EmailOnlyPlans
        section="business_email_plans"
        eyebrow="Business email plans"
        title="Professional email on your domain — no website needed"
      />

      <MarketingCtaBand
        title="Building a website too?"
        subtitle="Every Website Care Plan includes unlimited business email accounts — no separate email plan needed."
        ctaLabel="View Website Care Plans"
        ctaHref="/website-care-plans"
        dark
      />
    </PublicPage>
  );
}

const SEO_QUOTE_HREF = "/contact?service=SEO%20Services";
const SEO_WHATSAPP_HREF = `${whatsappUrl.split("?")[0]}?text=${encodeURIComponent("Hello NAI TALK, I'd like a quote for SEO services for my website.")}`;

const SEO_SERVICES = [
  {
    icon: Code2,
    title: "Technical SEO",
    description: "We fix what stops Google from crawling and ranking your site: slow pages, mobile problems, indexing errors, missing sitemaps, broken links and structured data.",
  },
  {
    icon: FileText,
    title: "On-page SEO",
    description: "Every important page gets a clear title, description, headings and internal links aimed at what your customers actually type into Google.",
  },
  {
    icon: MapPin,
    title: "Local SEO",
    description: "Help nearby customers find you: a well-set-up Google Business Profile and the same name, address and phone number everywhere your business appears.",
  },
  {
    icon: BookOpen,
    title: "Content SEO",
    description: "Service pages and helpful articles that answer real customer questions — written to bring in people who are ready to buy, not just traffic.",
  },
  {
    icon: BarChart3,
    title: "Search Console & reporting",
    description: "We set up Google Search Console and report on the numbers that matter: clicks, impressions, rankings for your key pages and the enquiries they bring.",
  },
] as const;

const SEO_AUDIENCES = [
  ["You have a website but few enquiries", "Visitors aren't finding you on Google, or they find you and don't get in touch."],
  ["You're a local business", "You want customers in your area to find you when they search for what you sell."],
  ["You've just launched a website", "You want it indexed properly and set up to grow from the start."],
  ["You run an online store", "Your product and category pages need to show up for the things people shop for."],
] as const;

const SEO_PROCESS = [
  ["Review", "We look at your website, your competitors and — if you have it — your Google Search Console data, and tell you plainly what's holding you back."],
  ["Plan & quote", "You get a prioritised plan and a quote for the work your website actually needs. No long contract to sign before you see the plan."],
  ["Improve", "We make the technical, on-page, local and content improvements — or work alongside your developer if you have one."],
  ["Measure", "We compare clicks, impressions, rankings and enquiries against where you started, so you can see what the work achieved."],
] as const;

const SEO_FAQ_ITEMS = [
  {
    question: "How much do your SEO services cost?",
    answer: "It depends on the size of your website, how competitive your market is and what needs fixing. We review your site first and then give you a quote for the work it actually needs.",
  },
  {
    question: "How long does SEO take to work?",
    answer: "Technical fixes can show up in Google within weeks. Ranking higher for competitive searches usually takes three to six months of steady work. We report progress along the way so you're never guessing.",
  },
  {
    question: "Can you guarantee first-page rankings?",
    answer: "No — and you should be wary of anyone who does. Google decides rankings. What we can promise is honest work on the things that influence them, and clear reporting on the results.",
  },
  {
    question: "Do I need a new website to do SEO?",
    answer: "Usually not. We can improve the website you already have. If it's too slow or badly structured to rank, we'll tell you honestly and explain your options.",
  },
  {
    question: "Do you work on websites you didn't build?",
    answer: "Yes. We can work on websites built by anyone, as long as we can get the access we need to make changes — or we can work alongside your current developer.",
  },
];

export function SeoServicesPage() {
  const [projects, setProjects] = useState<Project[]>(fallbackProjects);

  useEffect(() => {
    fetch("/api/site-content")
      .then((response) => response.json())
      .then((data) => {
        if (Array.isArray(data.projects) && data.projects.length > 0) setProjects(data.projects);
      })
      .catch(() => undefined);
  }, []);

  return (
    <PublicPage>
      <PublicBreadcrumbs items={[{ label: "SEO Services" }]} />
      <MarketingHero
        eyebrow="SEO Services"
        title="SEO Services for Nigerian Businesses"
        subtitle="Get found on Google by customers who are ready to buy. We fix the technical problems, improve your pages and content, and report honestly on the clicks, rankings and enquiries the work brings in."
        ctaLabel="Request an SEO Quote"
        ctaHref={SEO_QUOTE_HREF}
        secondaryLabel="Chat on WhatsApp"
        secondaryHref={SEO_WHATSAPP_HREF}
        imageQuery="analytics search engine marketing dashboard"
      />

      <section className="pub-section-tint border-y border-black/5">
        <div className="mx-auto max-w-7xl px-4 py-16 sm:px-6 lg:px-8">
          <div className="mx-auto max-w-2xl text-center">
            <span className="pub-eyebrow">Who it's for</span>
            <h2 className="mt-4 text-3xl font-black text-[#07111f]">Is SEO right for your business?</h2>
          </div>
          <div className="mt-10 grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
            {SEO_AUDIENCES.map(([title, description]) => (
              <div key={title} className="pub-card">
                <h3 className="text-base font-black text-[#07111f]">{title}</h3>
                <p className="mt-2 text-sm leading-6 text-[#596273]">{description}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      <section className="pub-section">
        <div className="mx-auto max-w-7xl px-4 py-16 sm:px-6 lg:px-8">
          <div className="mx-auto max-w-2xl text-center">
            <span className="pub-eyebrow">What's included</span>
            <h2 className="mt-4 text-3xl font-black text-[#07111f]">The SEO services we provide</h2>
          </div>
          <div className="mt-10 grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
            {SEO_SERVICES.map((service) => (
              <div key={service.title} className="pub-card">
                <div className="flex h-11 w-11 items-center justify-center rounded-lg border border-primary/30 bg-primary/10 text-primary">
                  <service.icon className="h-5 w-5" />
                </div>
                <h3 className="mt-4 text-base font-black text-[#07111f]">{service.title}</h3>
                <p className="mt-2 text-sm leading-6 text-[#596273]">{service.description}</p>
              </div>
            ))}
            <div className="pub-card flex flex-col justify-center">
              <h3 className="text-base font-black text-[#07111f]">Not sure what you need?</h3>
              <p className="mt-2 text-sm leading-6 text-[#596273]">Tell us about your business and website — we'll recommend where to start.</p>
              <a href={SEO_QUOTE_HREF} className="btn-primary mt-4 justify-center">Request an SEO Quote <ArrowRight className="h-4 w-4" /></a>
            </div>
          </div>
        </div>
      </section>

      <section className="pub-section-tint border-y border-black/5">
        <div className="mx-auto max-w-7xl px-4 py-16 sm:px-6 lg:px-8">
          <div className="mx-auto max-w-2xl text-center">
            <span className="pub-eyebrow">How it works</span>
            <h2 className="mt-4 text-3xl font-black text-[#07111f]">What to expect when you work with us</h2>
          </div>
          <ol className="mt-10 grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
            {SEO_PROCESS.map(([title, description], index) => (
              <li key={title} className="pub-card">
                <span className="text-xs font-black uppercase text-primary">Step {index + 1}</span>
                <h3 className="mt-2 text-lg font-black text-[#07111f]">{title}</h3>
                <p className="mt-2 text-sm leading-6 text-[#596273]">{description}</p>
              </li>
            ))}
          </ol>
          <p className="mx-auto mt-8 max-w-3xl text-center text-sm leading-7 text-[#596273]">
            <Clock className="mr-1 inline h-4 w-4 text-primary" /> SEO is steady work, not a switch: technical fixes can show within weeks, while ranking for
            competitive searches usually takes three to six months. We'll never promise you the #1 spot — we'll show you real numbers instead.
          </p>
        </div>
      </section>

      <section className="pub-section">
        <div className="mx-auto max-w-7xl px-4 py-16 sm:px-6 lg:px-8">
          <div className="mx-auto max-w-2xl text-center">
            <span className="pub-eyebrow">Our work</span>
            <h2 className="mt-4 text-3xl font-black text-[#07111f]">Websites we've built</h2>
            <p className="mt-3 text-base leading-7 text-[#596273]">
              Every website we build gets a fast, well-structured foundation with SEO in mind from the start — not bolted on afterwards.
            </p>
          </div>
          <div className="mt-10 grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
            {projects.slice(0, 3).map((project) => (
              <a key={project.title} href="/portfolio" className="pub-card group overflow-hidden !p-0">
                <ResponsiveImage
                  src={project.img}
                  alt={`${project.title} — website by NAI TALK`}
                  width={448}
                  height={280}
                  sources={project.img.startsWith("/data/") ? [{ srcSet: buildDataAssetSrcSet(project.img, 900) }] : undefined}
                  sizes="(min-width: 1024px) 400px, (min-width: 640px) 50vw, 100vw"
                  className="aspect-[16/10] w-full object-cover object-top"
                  loading="lazy"
                />
                <div className="p-5">
                  <span className="text-xs font-black uppercase text-primary">{project.category.split(",")[0].trim()}</span>
                  <h3 className="mt-1 text-base font-black text-[#07111f] group-hover:text-primary">{project.title}</h3>
                </div>
              </a>
            ))}
          </div>
          <div className="mt-8 text-center">
            <a href="/portfolio" className="btn-outline justify-center">See our full portfolio <ArrowRight className="h-4 w-4" /></a>
          </div>
        </div>
      </section>

      <section className="pub-section-tint border-y border-black/5">
        <div className="mx-auto max-w-3xl px-4 py-16 sm:px-6 lg:px-8">
          <div className="text-center">
            <span className="pub-eyebrow">FAQ</span>
            <h2 className="mt-4 text-3xl font-black text-[#07111f]">SEO questions, answered</h2>
          </div>
          <div className="mt-8">
            <FaqAccordionGroup items={SEO_FAQ_ITEMS} />
          </div>
          <p className="mt-8 text-center text-sm text-[#596273]">
            Building a new website? See <a href="/website-design" className="font-bold text-primary underline">website design</a> and{" "}
            <a href="/website-care-plans" className="font-bold text-primary underline">website care plans</a>, or read our{" "}
            <a href="/blog" className="font-bold text-primary underline">blog</a>.
          </p>
        </div>
      </section>

      <MarketingCtaBand
        title="Ready to get found on Google?"
        subtitle="Tell us about your business and website. We'll review it and send you a quote for the work it needs."
        ctaLabel="Request an SEO Quote"
        ctaHref={SEO_QUOTE_HREF}
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

const CONTACT_SERVICE_OPTIONS = ["Business Website", "Domains & Hosting", "Website Care Plan", "Business Email Hosting", "SEO Services", "Something else"];

export function ContactPage() {
  const [formData, setFormData] = useState(() => {
    // Service pages link here with ?service=... (e.g. the SEO page's "Request
    // an SEO Quote"); only a known dropdown option is ever pre-selected.
    const requested = new URLSearchParams(window.location.search).get("service");
    const service = requested && CONTACT_SERVICE_OPTIONS.includes(requested) ? requested : "Business Website";
    return { name: "", email: "", phone: "", service, details: "" };
  });
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
                      {CONTACT_SERVICE_OPTIONS.map((option) => (
                        <option key={option}>{option}</option>
                      ))}
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

type LegalSection = { heading: string; body?: string | string[]; list?: string[] };

export function LegalPage({
  title,
  sections,
  updated = "11 July 2026",
  intro,
}: {
  title: string;
  sections: LegalSection[];
  updated?: string;
  intro?: string;
}) {
  const paragraphs = (body?: string | string[]) => (body === undefined ? [] : Array.isArray(body) ? body : [body]);

  return (
    <PublicPage seoOverrides={{ title: `${title} | NAI TALK`, description: `${title} for NAI TALK's domains, hosting and website services.` }}>
      <PublicBreadcrumbs items={[{ label: title }]} />
      <section className="pub-section">
        <div className="mx-auto max-w-3xl px-4 py-14 sm:px-6 lg:px-8">
          <span className="pub-eyebrow">Legal</span>
          <h1 className="mt-4 text-3xl font-black text-[#07111f] sm:text-4xl">{title}</h1>
          <p className="mt-2 text-xs text-[#596273]">Last updated: {updated}</p>
          {intro && <p className="mt-6 text-sm leading-7 text-[#596273]">{intro}</p>}
          <div className="mt-8 grid gap-8">
            {sections.map((section, index) => (
              <div key={section.heading}>
                <h2 className="text-lg font-black text-[#07111f]">
                  {sections.length > 6 ? `${index + 1}. ` : ""}
                  {section.heading}
                </h2>
                {paragraphs(section.body).map((paragraph) => (
                  <p key={paragraph.slice(0, 40)} className="mt-2 text-sm leading-7 text-[#596273]">
                    {paragraph}
                  </p>
                ))}
                {section.list && (
                  <ul className="mt-2 list-disc space-y-1.5 pl-5 text-sm leading-7 text-[#596273]">
                    {section.list.map((item) => (
                      <li key={item.slice(0, 40)}>{item}</li>
                    ))}
                  </ul>
                )}
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

/**
 * Keep the "updated" date in step with TERMS_VERSION in backend/config/legal.php —
 * every recorded acceptance stores that version.
 */
export function TermsOfServicePage() {
  return (
    <LegalPage
      title="Terms of Service"
      updated="15 October 2026"
      intro="These terms are an agreement between you and NAI TALK SERVICES (“NAI TALK”, “we”, “us”), of 7 Unity Road, Ikola, Lagos, Nigeria. They apply to every service you order from us. By creating an account, placing an order, or ticking “I agree” at checkout, you accept these terms. Please read them carefully — if you do not agree, do not use our services."
      sections={[
        {
          heading: "Our services",
          body: "NAI TALK provides domain registration and transfer, web hosting, website care plans, business email, SSL certificates, website design and development, and related support. What is included in each service — such as storage, email accounts and databases — is described on the plan or quote you order, and in your client area.",
        },
        {
          heading: "Your account",
          list: [
            "You must be at least 18 years old, or have authority to act for the business you register.",
            "Keep the information on your account — especially your email address and phone number — accurate and up to date. Renewal notices and other important messages are sent to the email address on your account.",
            "You are responsible for keeping your login details, and the passwords for your hosting, email, databases and file access, secure, and for everything done with them. Tell us straight away if you suspect someone else has access.",
            "You may ask us to transfer services to another person's account. We may ask for proof that you are entitled to do so.",
          ],
        },
        {
          heading: "Orders, prices and payment",
          list: [
            "Prices are in Nigerian Naira (₦) unless stated otherwise, and include VAT where it applies. The price you pay is the one shown on your invoice.",
            "A service is set up once its invoice is paid. You can pay with the methods offered at checkout — card or bank payment through our payment partners, bank transfer, or your NAI TALK wallet. Bank transfers are applied once we confirm the money has arrived.",
            "We never store your full card details; card payments are handled by our payment partners. If you save a card, only a secure token from the payment partner is kept, so it can be charged for renewals you have authorised.",
            "If you pay more than an invoice total, the extra is added to your NAI TALK wallet and used towards future invoices.",
          ],
        },
        {
          heading: "Renewals and automatic renewal",
          list: [
            "Hosting and website care plans renew for the same billing period (for example, yearly) at the plan's current price. Renewals are charged for your plan only — extra products are charged only if you have subscribed to them.",
            "We email a renewal invoice about 60 days before your renewal date, and remind you 30 days before, 7 days before, and on the renewal date while it remains unpaid.",
            "If automatic renewal is switched on, we may, within the 7 days before your renewal date, take payment from your wallet balance and then from a saved card you have enabled for renewals. You can switch automatic renewal off, or remove a saved card, at any time in your client area.",
            "If a plan's price changes, the new price applies from your next renewal and is shown on the renewal invoice.",
            "Domains must be renewed before they expire. Domain renewal prices are set by the relevant registry and may change.",
          ],
        },
        {
          heading: "Unpaid renewals: grace period, suspension and deletion",
          body: [
            "If a hosting renewal is not paid by the renewal date, the service enters a 30-day grace period. During the grace period your website and email normally keep working, and paying the renewal invoice returns the service to normal.",
            "If the renewal is still unpaid at the end of the grace period, the service is suspended: visitors see an “account suspended” page instead of your website. Paying the renewal invoice restores the service.",
            "If it remains unpaid 14 days after suspension, the website and its files, email accounts and databases are permanently deleted from our servers. We warn you by email 7, 3 and 1 days before deletion. Deleted data cannot be recovered, so please keep your own copies.",
          ],
        },
        {
          heading: "Hosting, storage and fair use",
          list: [
            "Your plan's storage is shared by your website files, email and databases. When you approach your limit we will warn you; if you go over it, uploads and new email may stop working until you free up space or upgrade.",
            "Hosting is shared with other clients. If a website uses so much processing power, memory or traffic that it affects other clients, we may limit it, ask you to upgrade, or suspend it until the problem is fixed. Where practical we will contact you first.",
            "We take regular backups to protect our platform, but backups are not a guarantee. You are responsible for keeping your own up-to-date copies of your website, email and data.",
            "If you run your own application on your hosting (for example a Node.js app), you are responsible for keeping it running, updated and secure.",
          ],
        },
        {
          heading: "Acceptable use",
          body: "You must not use our services, or allow others to use them, to:",
          list: [
            "break any law of Nigeria or of the country where you or your visitors are;",
            "send spam or unsolicited bulk email, or run phishing, scams or fraud;",
            "host or spread malware, or attack, scan or gain unauthorised access to other systems;",
            "host material that infringes someone else's copyright, trademark or other rights;",
            "host content that sexually exploits children, promotes terrorism or violence, or incites hatred;",
            "run cryptocurrency mining, open proxies, or anything else that places an unreasonable load on our servers.",
          ],
        },
        {
          heading: "Your content",
          body: "You keep ownership of everything you publish or store on our services, and you are responsible for it, including having the right to use any text, images, software and plugins. You allow us to store, copy and transmit your content only as needed to provide the services, take backups and comply with the law.",
        },
        {
          heading: "Domains",
          list: [
            "Domain registrations and transfers are subject to the rules of the relevant registry — for example NiRA for .ng domains and ICANN for .com and other generic domains. We act as your registrar or reseller and are not responsible for decisions or delays made by a registry.",
            "You must provide accurate registrant contact details. A domain may be suspended by its registry if they are false.",
            "A domain registered for you is yours. Registries may restrict transfers shortly after registration or transfer. A domain that expires may be held, charged a recovery fee, or released by the registry.",
          ],
        },
        {
          heading: "Website design and development",
          body: "Design and development work is delivered to the scope, timeline and price in the quote you accept. Unless the quote says otherwise, work starts when the agreed deposit is paid, and ownership of the finished website passes to you when it has been paid for in full. Requests outside the agreed scope may be quoted separately.",
        },
        {
          heading: "Support and availability",
          body: [
            "You can reach support through the support tickets in your client area, by email at info@naitalk.com, or on WhatsApp at 0708 705 7654.",
            "We work to keep our services available at all times, but we cannot promise they will be uninterrupted or error-free. We may carry out maintenance, which we try to schedule at quiet times and announce in advance where it affects you.",
          ],
        },
        {
          heading: "Suspension or termination by us",
          body: "We may suspend or end a service immediately if it is used in breach of the acceptable use rules, if it threatens the security or stability of our platform or other clients, or if the law requires it. In other cases — for example non-payment — we follow the notice timeline described above. Where practical we will tell you why and how to fix it.",
        },
        {
          heading: "Cancelling a service",
          body: "You can stop a service at any time by switching off automatic renewal and not paying its renewal, or by asking us to close it. Refunds are covered by our Refund Policy. Before a service ends, please download anything you want to keep — it will be deleted as described above.",
        },
        {
          heading: "Privacy",
          body: "We handle your personal information as described in our Privacy Policy, in line with the Nigeria Data Protection Act 2023.",
        },
        {
          heading: "Limitation of liability",
          body: [
            "Nothing in these terms limits liability that cannot be limited by law.",
            "Otherwise, we are not liable for indirect or consequential losses, such as loss of profit, business, goodwill or data, and our total liability to you for any claim is limited to the amount you paid us for the affected service in the 12 months before the claim.",
          ],
        },
        {
          heading: "Your responsibility to us",
          body: "If a claim is made against NAI TALK because of content you host or the way you use our services in breach of these terms, you agree to cover the reasonable costs and losses this causes us.",
        },
        {
          heading: "Changes to these terms",
          body: "We may update these terms from time to time; the date at the top shows when they last changed. We will tell you by email or in your client area before any important change affects you. If you keep using our services after a change takes effect, the updated terms apply.",
        },
        {
          heading: "Governing law and disputes",
          body: "These terms are governed by the laws of the Federal Republic of Nigeria. If a dispute arises, please contact us first so we can try to resolve it. If we cannot resolve it together, it will be decided by the courts of Lagos State, Nigeria.",
        },
        {
          heading: "Contact us",
          body: "NAI TALK SERVICES, 7 Unity Road, Ikola, Lagos, Nigeria. Email: info@naitalk.com. Phone / WhatsApp: 0708 705 7654.",
        },
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

