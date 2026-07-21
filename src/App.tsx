import React, { Suspense, useEffect, useMemo, useState } from "react";
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
import { useToast } from "./toast/ToastProvider";
import { useSeo } from "./seo/useSeo";
import { useClientRoute, navigateClient, type ClientRouteName } from "./routing/useClientRoute";
import { useAdminRoute, adminPath, adminClientDetailPath, adminServiceDetailPath, type AdminSectionId } from "./routing/useAdminRoute";
import {
  consumePendingOrder,
  hasClientToken,
  savePendingOrder,
  startHostingOrder,
  savePendingPayment,
  peekPendingPayment,
  clearPendingPayment,
} from "./routing/pendingOrder";
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
} from "./lib/analytics";
import { captureAdAttribution } from "./lib/adAttribution";
import { ResponsiveImage, buildDataAssetSrcSet } from "./components/ResponsiveImage";
import type {
  LogoImage,
  ClientLogo,
  Project,
  Review,
  SiteContent,
  HostingPlanCard,
} from "./shared/types";
import { laravelApi } from "./shared/api";
import { catalogCategoryIcon, formatNaira } from "./shared/format";
import {
  fallbackClientLogos,
  fallbackProjects,
  fallbackReviews,
  fallbackSiteContent,
  whatsappUrl,
} from "./shared/siteDefaults";
import { Logo, Navbar, Footer, FloatingWhatsApp, SectionHeader } from "./shared/PublicLayout";

export const services = [
  {
    icon: MonitorSmartphone,
    title: "Business Websites",
    description:
      "Professional, fast and mobile-responsive websites that build trust and bring in customers.",
    href: "/website-design",
  },
  {
    icon: Code2,
    title: "Custom Software",
    description:
      "Portals, dashboards, payment systems, registration platforms, CBT systems and more.",
    href: "#contact",
  },
  {
    icon: Server,
    title: "Hosting & Domains",
    description:
      "Fast secure hosting, domain registration, SSL, backups and business email.",
    href: "/web-hosting",
  },
  {
    icon: Bot,
    title: "AI Solutions",
    description:
      "AI call assistants, customer support automation, lead capture and workflow tools.",
    href: "#contact",
  },
  {
    icon: ShieldCheck,
    title: "Maintenance & Support",
    description:
      "Updates, security, backups and ongoing support so your business never stops.",
    href: "/website-care-plans",
  },
];

export const process = [
  {
    title: "Let's Talk",
    description: "Tell us about your idea, goals and requirements.",
  },
  {
    title: "Plan & Design",
    description: "We plan, design and recommend the best solution.",
  },
  {
    title: "Build & Test",
    description: "We develop, test and refine until it is ready.",
  },
  {
    title: "Launch & Grow",
    description: "We deploy, support and help your business grow.",
  },
];

export const stats = [
  { value: "99.9%", label: "Server uptime" },
  { value: "24/7", label: "Support coverage" },
  { value: "60+", label: "Digital projects" },
];

export const fallbackHostingPlans: HostingPlanCard[] = [
  {
    name: "Starter Website Care",
    slug: "starter-website-care",
    audience: "Basic website care for small businesses, personal brands, churches, schools, landing pages, and simple company websites.",
    monthly: "₦5,000",
    annual: "₦50,000",
    featured: false,
    badge: null,
    ctaLabel: "Start Basic",
    features: [
      "Website hosting",
      "Website security lock / SSL",
      "1 professional business email",
      "Weekly website backup",
      "Basic website support",
      "Renewal reminders",
      "Website recovery support",
      "Peace of mind",
    ],
  },
  {
    name: "Business Website Care",
    slug: "business-website-care",
    audience: "Recommended for growing businesses that need reliable website care, business email, backup protection, faster support, and peace of mind.",
    monthly: "₦10,000",
    annual: "₦100,000",
    featured: true,
    badge: "Most Popular",
    ctaLabel: "Choose Business Care",
    features: [
      "Everything in Starter",
      "Up to 5 professional business emails",
      "Priority support",
      "Regular website health checks",
      "Stronger backup protection",
      "Basic security monitoring",
      "Faster issue resolution",
      "Minor content update assistance",
      "Peace of mind support",
    ],
  },
  {
    name: "Premium Website Care",
    slug: "premium-website-care",
    audience: "Full website care for businesses that want priority support, frequent backups, security review, performance review, and more managed assistance.",
    monthly: "₦18,000",
    annual: "₦180,000",
    featured: false,
    badge: null,
    ctaLabel: "Get Premium Care",
    features: [
      "Everything in Business",
      "Up to 30 professional business emails",
      "Frequent website backups",
      "Monthly website checkup",
      "Priority issue resolution",
      "Security review",
      "Performance review",
      "More content update assistance",
      "Maximum peace of mind",
    ],
  },
];

// Fixed, pre-optimized decorative assets for the hero mockup. Deliberately
// independent of the dynamic /api/site-content projects feed: that data
// arrives after a fetch and used to swap these images out from under the
// user, causing a duplicate download, a flash of different content and
// layout jitter. The real (dynamic) project imagery lives in the Portfolio
// section below the fold instead.
export const heroPreviewImages = {
  dashboard: { src: "/data/skinologist.webp", width: 900, height: 675, alt: "NAITALK project dashboard preview" },
  panel: { src: "/data/rhm.webp", width: 900, height: 900, alt: "Hosted project preview" },
  phone: { src: "/data/scholarjoint.webp", width: 900, height: 900, alt: "Mobile website preview" },
};

export function DeviceShowcase({ logo }: { logo: LogoImage }) {
  return (
    <div className="relative min-h-[380px] sm:min-h-[440px] lg:min-h-[500px]">
      <div className="absolute left-[18%] top-0 hidden h-64 w-64 rounded-full border border-primary/20 sm:block" />
      <div
        className="reveal-up absolute right-0 top-4 w-[84%] max-w-[620px] overflow-hidden rounded-[18px] border border-primary/25 bg-[#080c0b] shadow-[0_28px_120px_rgba(100,216,45,0.15)]"
      >
        <div className="flex items-center justify-between border-b border-white/10 px-4 py-3">
          <div className="flex gap-1.5">
            <span className="h-2.5 w-2.5 rounded-full bg-primary" />
            <span className="h-2.5 w-2.5 rounded-full bg-white/20" />
            <span className="h-2.5 w-2.5 rounded-full bg-white/20" />
          </div>
          <span className="text-[10px] font-bold uppercase text-white/50">Dashboard</span>
        </div>
        <div className="grid gap-4 p-4 sm:grid-cols-[1.2fr_0.8fr]">
          <div className="space-y-4">
            <img
              src={heroPreviewImages.dashboard.src}
              alt={heroPreviewImages.dashboard.alt}
              width={heroPreviewImages.dashboard.width}
              height={heroPreviewImages.dashboard.height}
              className="aspect-[16/10] w-full rounded-lg object-cover"
              loading="eager"
              decoding="async"
              fetchPriority="high"
            />
            <div className="grid grid-cols-3 gap-2">
              {stats.map((stat) => (
                <div key={stat.label} className="rounded-lg border border-white/10 bg-white/[0.04] p-3">
                  <div className="text-lg font-black text-primary">{stat.value}</div>
                  <div className="mt-1 text-[10px] text-white/48">{stat.label}</div>
                </div>
              ))}
            </div>
          </div>
          <div className="rounded-lg border border-primary/20 bg-[#101610] p-3">
            <div className="mb-3 flex items-center justify-between">
              <span className="text-[11px] font-bold text-white">Server Overview</span>
              <span className="rounded-full bg-primary/15 px-2 py-1 text-[9px] font-bold text-primary">
                Live
              </span>
            </div>
            {["CPU usage", "Disk storage", "SSL health"].map((label, index) => (
              <div className="mb-4" key={label}>
                <div className="mb-1 flex justify-between text-[10px] text-white/52">
                  <span>{label}</span>
                  <span>{index === 0 ? "34%" : index === 1 ? "62%" : "100%"}</span>
                </div>
                <div className="h-1.5 rounded-full bg-white/10">
                  <div
                    className="h-full rounded-full bg-primary"
                    style={{ width: index === 0 ? "34%" : index === 1 ? "62%" : "100%" }}
                  />
                </div>
              </div>
            ))}
            <img
              src={heroPreviewImages.panel.src}
              alt={heroPreviewImages.panel.alt}
              width={heroPreviewImages.panel.width}
              height={heroPreviewImages.panel.height}
              className="mt-3 aspect-video w-full rounded-md object-cover"
              loading="lazy"
              decoding="async"
            />
          </div>
        </div>
      </div>

      <div
        className="reveal-up-left absolute bottom-6 left-0 w-[42%] min-w-[170px] max-w-[260px] overflow-hidden rounded-[28px] border border-primary/25 bg-[#050806] p-2 shadow-[0_20px_80px_rgba(0,0,0,0.55)]"
      >
        <div className="rounded-[22px] border border-white/10 bg-[#0b100d] p-3">
          <div className="mb-3 flex items-center justify-between text-[9px] text-white/45">
            <span>9:41</span>
            <span>5G</span>
          </div>
          <div className="mx-auto mb-4 flex h-16 w-16 items-center justify-center rounded-full border border-primary/40 bg-primary/10">
            <Logo logo={logo} className="[&_img]:h-5 [&_img]:max-w-[90px]" />
          </div>
          <img
            src={heroPreviewImages.phone.src}
            alt={heroPreviewImages.phone.alt}
            width={heroPreviewImages.phone.width}
            height={heroPreviewImages.phone.height}
            className="aspect-[4/5] w-full rounded-xl object-cover"
            loading="lazy"
            decoding="async"
          />
          <div className="mt-4 rounded-xl bg-primary px-4 py-3 text-center text-[11px] font-black text-on-primary">
            Get Started
          </div>
        </div>
      </div>
    </div>
  );
}

export function Hero({ logo }: { logo: LogoImage }) {
  return (
    <section id="home" className="hero-grid relative overflow-hidden pb-8 pt-28 sm:pb-10 lg:pt-32">
      <div className="mx-auto grid max-w-7xl items-center gap-10 px-4 sm:px-6 lg:grid-cols-[0.95fr_1.05fr] lg:px-8">
        <div className="reveal-up max-w-2xl">
          <span className="eyebrow">Hosting, domains & websites for growing businesses</span>
          <h1 className="mt-5 max-w-xl text-4xl font-black leading-[1.02] text-white sm:text-5xl lg:text-6xl">
            Reliable hosting and websites that keep your business <span className="text-primary">online.</span>
          </h1>
          <p className="mt-5 max-w-lg text-base leading-7 text-white/68 sm:text-lg">
            Domains, secure hosting and business email, backed by custom websites, software and AI
            tools when you're ready to grow further.
          </p>
          <div className="mt-8 flex flex-col gap-3 sm:flex-row">
            <a
              href="#contact"
              className="btn-primary justify-center sm:justify-start"
              onClick={() => trackCtaClick({ button_text: "Start a project", page_section: "hero" })}
            >
              Start a project
              <ArrowRight className="h-4 w-4" />
            </a>
            <a
              href={whatsappUrl}
              className="btn-outline justify-center sm:justify-start"
              onClick={() => trackEvent("whatsapp_click", { page_section: "hero" })}
            >
              <MessageCircle className="h-4 w-4 text-[#25D366]" />
              Chat on WhatsApp
            </a>
          </div>
          <div className="mt-9 grid gap-4 sm:grid-cols-3">
            {[
              ["Reliable hosting", "99.9% uptime, every day"],
              ["Secure by default", "Free SSL & backups included"],
              ["Support you can trust", "We are here when you need us"],
            ].map(([title, description]) => (
              <div className="flex gap-3" key={title}>
                <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg border border-primary/30 bg-primary/10">
                  <CheckCircle2 className="h-4 w-4 text-primary" />
                </div>
                <div>
                  <div className="text-sm font-bold text-white">{title}</div>
                  <div className="mt-1 text-xs text-white/48">{description}</div>
                </div>
              </div>
            ))}
          </div>
        </div>
        <DeviceShowcase logo={logo} />
      </div>
    </section>
  );
}

// Showing every client logo the admin has ever added competes with the hero
// for bandwidth on first load. A curated subset is enough to convey social
// proof; the marquee still loops seamlessly with far fewer image requests.
export const MAX_TRUST_LOGOS = 8;

export function TrustStrip({ clientLogos }: { clientLogos: ClientLogo[] }) {
  const curated = clientLogos.slice(0, MAX_TRUST_LOGOS);
  if (!curated.length) return null;

  return (
    <section className="border-y border-white/8 bg-white/[0.025] py-7">
      <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
        <p className="text-center text-[10px] font-black uppercase text-primary">
          Trusted by businesses, organisations & institutions
        </p>
        <div className="mt-6 trust-marquee">
          <div className="trust-marquee-track">
            {[...curated, ...curated].map((logo, index) => (
              <div
                key={`${logo.name}-${index}`}
                className="trust-card"
                aria-hidden={index >= curated.length ? "true" : undefined}
              >
                <div className="trust-card-logo">
                  {logo.src ? (
                    <img
                      src={logo.src}
                      alt={logo.alt || logo.name}
                      width={logo.width || 160}
                      height={logo.height || 80}
                      loading="lazy"
                      decoding="async"
                    />
                  ) : (
                    <span className="trust-card-fallback">{logo.name}</span>
                  )}
                </div>
                {logo.src && <span className="trust-card-name">{logo.name}</span>}
              </div>
            ))}
          </div>
        </div>
      </div>
    </section>
  );
}

export function Services() {
  return (
    <section id="services" className="section-pad">
      <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
        <SectionHeader
          eyebrow="What we do"
          title={
            <>
              Solutions that <span className="section-title-gradient">power</span> your business
            </>
          }
        />
        <div className="mt-10 grid gap-4 sm:grid-cols-2 lg:grid-cols-5">
          {services.map((service) => (
            <article key={service.title} className="service-card">
              <div className="service-icon">
                <service.icon className="h-6 w-6" />
              </div>
              <h3 className="mt-7 text-base font-black text-white">{service.title}</h3>
              <p className="mt-3 text-sm leading-6 text-white/58">{service.description}</p>
              <a href={service.href} className="service-link mt-6 inline-flex items-center gap-2 text-xs font-black">
                Learn more
                <ArrowRight className="h-3.5 w-3.5" />
              </a>
            </article>
          ))}
        </div>
      </div>
    </section>
  );
}

export function Portfolio({ projects }: { projects: Project[] }) {
  const [selectedProject, setSelectedProject] = useState<Project | null>(null);

  useEffect(() => {
    if (!selectedProject) return undefined;

    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") {
        setSelectedProject(null);
      }
    };

    document.body.style.overflow = "hidden";
    window.addEventListener("keydown", handleKeyDown);

    return () => {
      document.body.style.overflow = "";
      window.removeEventListener("keydown", handleKeyDown);
    };
  }, [selectedProject]);

  return (
    <section id="portfolio" className="section-pad pt-0">
      <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
        <div className="flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
          <SectionHeader
            eyebrow="Our work"
            title={
              <>
                Projects that make an <span className="section-title-gradient">impact</span>
              </>
            }
            align="left"
          />
          <a href="/portfolio" className="inline-flex items-center gap-2 text-sm font-black text-primary">
            View all projects
            <ArrowRight className="h-4 w-4" />
          </a>
        </div>
      </div>
      <div className="mt-8 project-marquee">
        <div className="project-marquee-track">
          {[...projects, ...projects].map((project, index) => (
            <button
              key={`${project.title}-${index}`}
              type="button"
              className="project-slide cursor-pointer text-left"
              onClick={() => setSelectedProject(project)}
              aria-label={`${project.category.split(",")[0].trim()}: ${project.title}`}
              tabIndex={index < projects.length ? 0 : -1}
              aria-hidden={index >= projects.length}
            >
              <ResponsiveImage
                src={project.img}
                alt={`${project.title} project preview`}
                width={448}
                height={384}
                sources={
                  project.img.startsWith("/data/")
                    ? [{ srcSet: buildDataAssetSrcSet(project.img, 900) }]
                    : undefined
                }
                sizes="(min-width: 1024px) 448px, (min-width: 640px) 384px, 320px"
                loading="lazy"
              />
              <div className="project-slide-overlay" />
              <div className="project-slide-info">
                <span className="project-tag inline-flex rounded-full border px-3 py-1 text-[11px] font-bold">
                  {project.category.split(",")[0].trim()}
                </span>
                <h3 className="mt-2 text-lg font-black text-white">{project.title}</h3>
              </div>
            </button>
          ))}
        </div>
      </div>

      {selectedProject && (
          <div
            className="project-modal-backdrop reveal-fade"
            onClick={() => setSelectedProject(null)}
          >
            <article
              className="project-modal reveal-scale-up"
              onClick={(event) => event.stopPropagation()}
              role="dialog"
              aria-modal="true"
              aria-labelledby="project-modal-title"
            >
              <button
                type="button"
                className="project-modal-close"
                aria-label="Close project details"
                onClick={() => setSelectedProject(null)}
              >
                <X className="h-5 w-5" />
              </button>
              <div className="grid gap-6 lg:grid-cols-[0.95fr_1.05fr]">
                <img
                  src={selectedProject.img}
                  alt={`${selectedProject.title} project preview`}
                  className="aspect-[16/11] w-full rounded-lg object-cover"
                  loading="lazy"
                  decoding="async"
                />
                <div>
                  <span className="project-tag inline-flex rounded-full border px-3 py-1 text-[11px] font-bold">
                    {selectedProject.category.split(",")[0].trim()}
                  </span>
                  <h3 id="project-modal-title" className="mt-4 text-2xl font-black text-white sm:text-3xl">
                    {selectedProject.title}
                  </h3>
                  <div className="mt-6 grid gap-4">
                    {[
                      ["Challenge", selectedProject.details.challenge],
                      ["Solution", selectedProject.details.solution],
                      ["ROI", selectedProject.details.roi],
                    ].map(([label, value]) => (
                      <div key={label} className="project-modal-detail">
                        <h4>{label}</h4>
                        <p>{value || "Details will be added soon."}</p>
                      </div>
                    ))}
                  </div>
                </div>
              </div>
            </article>
          </div>
        )}
    </section>
  );
}

export function Process() {
  return (
    <section id="process" className="pb-10">
      <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
        <SectionHeader eyebrow="Our process" title="How we work" />
        <div className="mt-10 grid gap-6 lg:grid-cols-4">
          {process.map((step, index) => (
            <article key={step.title} className="process-step">
              <div className="process-number">{String(index + 1).padStart(2, "0")}</div>
              <div>
                <h3 className="text-base font-black text-white">{step.title}</h3>
                <p className="mt-2 text-sm leading-6 text-white/58">{step.description}</p>
              </div>
            </article>
          ))}
        </div>
      </div>
    </section>
  );
}

export function AiBand() {
  return (
    <section id="ai" className="py-6">
      <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
        <div className="ai-band">
          <div className="max-w-xl">
            <span className="eyebrow">AI that works for you</span>
            <h2 className="mt-4 text-3xl font-black leading-tight text-white sm:text-4xl">
              Never miss a call or lead again.
            </h2>
            <p className="mt-4 text-sm leading-7 text-white/65 sm:text-base">
              Our AI voice assistant answers calls, engages your customers, captures leads,
              books appointments and works 24/7.
            </p>
            <div className="mt-6 grid gap-3 sm:grid-cols-2">
              {["Answers calls instantly", "Books appointments", "Captures & qualifies leads", "Works 24/7"].map((item) => (
                <div className="flex items-center gap-2 text-sm text-white/75" key={item}>
                  <CheckCircle2 className="h-4 w-4 text-primary" />
                  {item}
                </div>
              ))}
            </div>
            <a href="#contact" className="btn-primary mt-7">
              Explore AI solutions
              <ArrowRight className="h-4 w-4" />
            </a>
          </div>

          <div className="relative min-h-[300px] flex-1">
            <div className="chat-bubble left-0 top-4">Hello! How can I help you today?</div>
            <div className="chat-bubble right-0 top-16">I need more info about your services.</div>
            <div className="chat-bubble bottom-12 left-8 bg-primary/18 text-white">
              Sure! Can I get your name and email?
            </div>
            <div className="chat-bubble bottom-10 right-4 bg-primary/20 text-white">
              John Doe<br />john@example.com
            </div>
            <div className="ai-face">
              <Headphones className="absolute -top-7 h-32 w-32 text-primary/70" />
              <Bot className="relative h-20 w-20 text-primary" />
            </div>
          </div>
        </div>
      </div>
    </section>
  );
}

export function HostingSection() {
  const [plans, setPlans] = useState<HostingPlanCard[]>(fallbackHostingPlans);

  useEffect(() => {
    trackPlanSelection("view", {});
  }, []);

  useEffect(() => {
    let isMounted = true;

    laravelApi<Array<Record<string, unknown>>>("/api/v1/public/hosting-plans")
      .then((data) => {
        if (!isMounted || !Array.isArray(data) || !data.length) return;

        setPlans(
          data.map((plan) => ({
            name: String(plan.name || "Website Care Plan"),
            slug: String(plan.slug || ""),
            audience: String(plan.short_description || "Website care for your business"),
            monthly: String(plan.monthly_price || "₦0"),
            annual: String(plan.annual_price || "₦0"),
            featured: Boolean(plan.is_popular),
            badge: plan.display_badge ? String(plan.display_badge) : null,
            ctaLabel: plan.cta_label ? String(plan.cta_label) : "Choose plan",
            features: Array.isArray(plan.public_features) ? plan.public_features.map(String) : [],
          })),
        );
      })
      .catch(() => setPlans(fallbackHostingPlans));

    return () => {
      isMounted = false;
    };
  }, []);

  return (
    <section id="hosting" className="section-pad pt-10">
      <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
        <div className="hosting-hero">
          <div className="max-w-xl">
            <span className="eyebrow">Website Care</span>
            <h2 className="mt-4 text-4xl font-black leading-tight text-white sm:text-5xl">
              Website Care <span className="section-title-gradient">Built for Growing Businesses</span>
            </h2>
            <p className="mt-5 text-sm leading-7 text-white/66 sm:text-base">
              We keep your business website online, secure, backed up and supported — so you can
              focus on running your business instead of worrying about servers.
            </p>
            <div className="mt-5 grid gap-2 text-sm text-white/74 sm:grid-cols-2">
              {["99.9% uptime guarantee", "Free SSL certificate", "Regular backups", "Real support when you need it"].map((item) => (
                <div key={item} className="flex items-center gap-2">
                  <CheckCircle2 className="h-4 w-4 text-primary" />
                  {item}
                </div>
              ))}
            </div>
            <div className="mt-7 flex flex-col gap-3 sm:flex-row">
              <a href="#hosting-packages" className="btn-primary justify-center">
                View plans
                <ArrowRight className="h-4 w-4" />
              </a>
              <a href="#contact" className="btn-outline justify-center">Talk to sales</a>
            </div>
          </div>
          <div className="hosting-stack" aria-hidden="true">
            {[0, 1, 2, 3].map((item) => (
              <div key={item} className="hosting-server">
                <span />
                <span />
                <span />
              </div>
            ))}
            <div className="hosting-cloud" />
          </div>
        </div>

        <div id="hosting-packages" className="mt-12">
          <div className="mx-auto max-w-2xl text-center">
            <h3 className="text-3xl font-black text-white">Website Care Plans for Growing Businesses</h3>
            <p className="mt-3 text-sm leading-6 text-white/58">
              No technical stress. No confusing server settings. We keep your website online, secure,
              backed up, and supported so you can focus on running your business.
            </p>
          </div>
          <div className="mt-8 grid gap-4 lg:grid-cols-3">
            {plans.map((plan) => (
              <article key={plan.name} className={plan.featured ? "hosting-plan featured" : "hosting-plan"}>
                {plan.badge && <span className="hosting-badge">{plan.badge}</span>}
                <h4 className="text-xl font-black text-white">{plan.name}</h4>
                <p className="mt-2 min-h-10 text-sm text-white/58">{plan.audience}</p>
                <div className="mt-6 flex items-end gap-1">
                  <span className="text-3xl font-black text-white">{plan.monthly}</span>
                  <span className="pb-1 text-xs text-white/48">/month</span>
                </div>
                <p className="mt-1 text-xs text-primary">{plan.annual}/year</p>
                <div className="mt-6 grid gap-3">
                  {plan.features.map((feature) => (
                    <div key={feature} className="flex items-center gap-2 text-sm text-white/68">
                      <CheckCircle2 className="h-4 w-4 text-primary" />
                      {feature}
                    </div>
                  ))}
                </div>
                <button
                  type="button"
                  onClick={() => {
                    trackPlanSelection("select", { plan_id: plan.slug, plan_name: plan.name });
                    trackPlanSelection("buy_click", { plan_id: plan.slug, plan_name: plan.name });
                    trackCtaClick({ button_text: plan.ctaLabel, page_section: "homepage_hosting" });
                    startHostingOrder(plan.slug);
                  }}
                  className={plan.featured ? "btn-primary mt-7 w-full justify-center" : "btn-outline mt-7 w-full justify-center"}
                >
                  {plan.ctaLabel}
                </button>
              </article>
            ))}
          </div>
        </div>
      </div>
    </section>
  );
}

export function Testimonials({ reviews }: { reviews: Review[] }) {
  const shown = reviews.slice(0, 3);

  if (!shown.length) return null;

  return (
    <section id="about" className="section-pad pt-8">
      <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
        <div className="grid gap-5 lg:grid-cols-[0.8fr_1.2fr]">
          <div>
            <span className="eyebrow">Client voices</span>
            <h2 className="mt-4 text-3xl font-black text-white sm:text-4xl">
              Built with the reliability real businesses expect.
            </h2>
            <p className="mt-4 text-sm leading-7 text-white/62">
              We design, ship and support digital infrastructure for teams that need more
              than a pretty homepage.
            </p>
          </div>
          <div className="grid gap-4 md:grid-cols-3">
            {shown.map((review) => (
              <article className="flex flex-col rounded-lg border border-white/10 bg-white/[0.035] p-5" key={review.author_name}>
                <div className="mb-4 flex gap-1 text-primary" role="img" aria-label={`${review.rating} star rating`}>
                  {Array.from({ length: Math.min(review.rating || 5, 5) }).map((_, index) => (
                    <Star key={index} className="h-3.5 w-3.5 fill-primary text-primary" />
                  ))}
                </div>
                <p className="flex-1 text-sm leading-6 text-white/66">{review.text}</p>
                <div className="mt-5 flex items-center gap-3">
                  {review.profile_photo_url ? (
                    <img
                      src={review.profile_photo_url}
                      alt={review.author_name}
                      className="h-9 w-9 shrink-0 rounded-full object-cover"
                    />
                  ) : (
                    <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-primary/15 text-xs font-black text-primary">
                      {review.author_name.charAt(0)}
                    </div>
                  )}
                  <div>
                    <div className="text-sm font-black text-white">{review.author_name}</div>
                    {review.relative_time_description && (
                      <div className="text-xs text-white/45">{review.relative_time_description}</div>
                    )}
                  </div>
                </div>
              </article>
            ))}
          </div>
        </div>
      </div>
    </section>
  );
}

export function Contact({ logo }: { logo: LogoImage }) {
  const [formData, setFormData] = useState({
    name: "",
    email: "",
    service: "Business Website",
    details: "",
  });
  const [status, setStatus] = useState<"idle" | "loading" | "success" | "error">("idle");
  const [message, setMessage] = useState("");

  const handleChange = (
    event: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement | HTMLSelectElement>,
  ) => {
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
      trackFormSubmission("contact_form", "success", { page_section: "homepage_contact", service: formData.service });
      setFormData({ name: "", email: "", service: "Business Website", details: "" });
    } catch (error) {
      setStatus("error");
      setMessage(error instanceof Error ? error.message : "Message could not be sent.");
      trackFormSubmission("contact_form", "error", { page_section: "homepage_contact" });
    }
  };

  return (
    <section id="contact" className="section-pad">
      <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
        <div className="cta-panel">
          <div>
            <h2 className="text-3xl font-black leading-tight text-white sm:text-4xl">
              Have a project in mind?
              <span className="block text-primary">Let's bring it to life.</span>
            </h2>
          </div>
          <div className="flex flex-col gap-3 sm:flex-row">
            <a
              href="#contact-form"
              className="btn-primary justify-center"
              onClick={() => trackCtaClick({ button_text: "Start a project", page_section: "contact_cta_panel" })}
            >
              Start a project
              <ArrowRight className="h-4 w-4" />
            </a>
            <a
              href={whatsappUrl}
              className="btn-outline justify-center"
              onClick={() => trackEvent("whatsapp_click", { page_section: "contact_cta_panel" })}
            >
              <MessageCircle className="h-4 w-4 text-[#25D366]" />
              Chat on WhatsApp
            </a>
          </div>
        </div>

        <div className="mt-8 grid gap-6 lg:grid-cols-[0.8fr_1.2fr]">
          <div className="rounded-lg border border-white/10 bg-white/[0.035] p-6 sm:p-8">
            <Logo logo={logo} />
            <p className="mt-4 text-sm leading-7 text-white/60">Let's talk. We build. You grow.</p>
            <div className="mt-8 space-y-5">
              <a
                href="mailto:info@naitalk.com"
                className="contact-line"
                onClick={() => trackEvent("email_click", { page_section: "homepage_contact" })}
              >
                <Mail className="h-4 w-4 text-primary" />
                info@naitalk.com
              </a>
              <a
                href="tel:+2347087057654"
                className="contact-line"
                onClick={() => trackEvent("phone_click", { page_section: "homepage_contact" })}
              >
                <Phone className="h-4 w-4 text-primary" />
                07087057654
              </a>
              <div className="contact-line">
                <MapPin className="h-4 w-4 text-primary" />
                Lagos, Nigeria
              </div>
            </div>
          </div>

          <form id="contact-form" className="contact-form" onSubmit={handleSubmit}>
            <div className="grid gap-4 sm:grid-cols-2">
              <label>
                <span>Full name</span>
                <input
                  required
                  minLength={2}
                  name="name"
                  value={formData.name}
                  onChange={handleChange}
                  placeholder="John Doe"
                />
              </label>
              <label>
                <span>Email address</span>
                <input
                  required
                  type="email"
                  name="email"
                  value={formData.email}
                  onChange={handleChange}
                  placeholder="john@example.com"
                />
              </label>
            </div>
            <label>
              <span>Service</span>
              <select name="service" value={formData.service} onChange={handleChange}>
                <option>Business Website</option>
                <option>Custom Software</option>
                <option>Hosting & Domains</option>
                <option>AI Solutions</option>
                <option>Maintenance & Support</option>
              </select>
            </label>
            <label>
              <span>Project details</span>
              <textarea
                required
                minLength={10}
                name="details"
                value={formData.details}
                onChange={handleChange}
                rows={5}
                placeholder="Tell us what you want to build..."
              />
            </label>
            <button type="submit" className="btn-primary justify-center" disabled={status === "loading"}>
              {status === "loading" ? "Sending..." : "Send message"}
              <ArrowRight className="h-4 w-4" />
            </button>
            {message && (
              <p className={status === "success" ? "form-message success" : "form-message error"}>{message}</p>
            )}
          </form>
        </div>
      </div>
    </section>
  );
}


export function PublicSite() {
  const [siteContent, setSiteContent] = useState<SiteContent>(fallbackSiteContent);
  const [projects, setProjects] = useState<Project[]>(fallbackProjects);

  useEffect(() => {
    fetch("/api/site-content")
      .then((response) => response.json())
      .then((data) => {
        if (Array.isArray(data.projects) && data.projects.length > 0) {
          setSiteContent({
            ...fallbackSiteContent,
            ...data,
            brand: {
              logo: data.brand?.logo || fallbackSiteContent.brand.logo,
            },
            clientLogos: Array.isArray(data.clientLogos) ? data.clientLogos : fallbackClientLogos,
            reviews: Array.isArray(data.reviews) ? data.reviews : fallbackReviews,
          });
          setProjects(data.projects);
        }
      })
      .catch(() => {
        setSiteContent(fallbackSiteContent);
        setProjects(fallbackProjects);
      });
  }, []);

  const structuredProjects = useMemo(
    () =>
      projects.slice(0, 4).map((project) => ({
        "@type": "CreativeWork",
        name: project.title,
        description: project.details.solution,
        image: project.img,
      })),
    [projects],
  );

  useEffect(() => {
    const jsonLd = {
      "@context": "https://schema.org",
      "@type": "ProfessionalService",
      name: "NAITALK",
      url: "https://naitalk.com/",
      logo: `https://naitalk.com${siteContent.brand.logo.src.startsWith("/") ? siteContent.brand.logo.src : "/logo.png"}`,
      image: "https://naitalk.com/og-naitalk-home.png",
      email: "info@naitalk.com",
      telephone: "+2347087057654",
      address: {
        "@type": "PostalAddress",
        addressLocality: "Lagos",
        addressCountry: "NG",
      },
      areaServed: ["Nigeria", "Africa", "Worldwide"],
      serviceType: [
        "Business website design",
        "Custom software development",
        "Web hosting",
        "Domain registration",
        "AI automation",
      ],
      sameAs: [],
      hasOfferCatalog: {
        "@type": "OfferCatalog",
        name: "NAITALK digital services",
        itemListElement: services.map((service) => ({
          "@type": "Offer",
          itemOffered: {
            "@type": "Service",
            name: service.title,
            description: service.description,
          },
        })),
      },
      workExample: structuredProjects,
    };

    let script = document.getElementById("naitalk-service-schema") as HTMLScriptElement | null;
    if (!script) {
      script = document.createElement("script");
      script.type = "application/ld+json";
      script.id = "naitalk-service-schema";
      document.head.appendChild(script);
    }
    script.textContent = JSON.stringify(jsonLd);
  }, [siteContent.brand.logo.src, structuredProjects]);

  return (
    <div className="min-h-screen overflow-x-hidden bg-background text-white">
      <Navbar logo={siteContent.brand.logo} />
      <main>
        <Hero logo={siteContent.brand.logo} />
        <TrustStrip clientLogos={siteContent.clientLogos} />
        <HostingSection />
        <Services />
        <Testimonials reviews={siteContent.reviews} />
        <Portfolio projects={projects} />
        <Process />
        <AiBand />
        <Contact logo={siteContent.brand.logo} />
      </main>
      <Footer logo={siteContent.brand.logo} />
      <FloatingWhatsApp />
    </div>
  );
}

// Route-level code splitting: the public homepage's initial bundle must not
// pay for admin, client-portal, domain-management, blog, KB or other-marketing
// code. Each lazy() below resolves a named export from a chunk that's only
// ever fetched once a matching route is actually visited.
const LazyAdminApp = React.lazy(() => import("./pages/AdminApp").then((m) => ({ default: m.AdminApp })));
const LazyClientPortal = React.lazy(() => import("./pages/ClientPortal").then((m) => ({ default: m.ClientPortal })));
const LazyDomainsLandingPage = React.lazy(() => import("./pages/DomainPages").then((m) => ({ default: m.DomainsLandingPage })));
const LazyDomainRegistrationPage = React.lazy(() => import("./pages/DomainPages").then((m) => ({ default: m.DomainRegistrationPage })));
const LazyPublicDomainTransferPage = React.lazy(() => import("./pages/DomainPages").then((m) => ({ default: m.PublicDomainTransferPage })));
const LazyDomainRenewalPage = React.lazy(() => import("./pages/DomainPages").then((m) => ({ default: m.DomainRenewalPage })));
const LazyDomainPricingPage = React.lazy(() => import("./pages/DomainPages").then((m) => ({ default: m.DomainPricingPage })));
const LazyWebHostingPage = React.lazy(() => import("./pages/MarketingPages").then((m) => ({ default: m.WebHostingPage })));
const LazyWebsiteCarePlansPage = React.lazy(() => import("./pages/MarketingPages").then((m) => ({ default: m.WebsiteCarePlansPage })));
const LazyWebsiteDesignPage = React.lazy(() => import("./pages/MarketingPages").then((m) => ({ default: m.WebsiteDesignPage })));
const LazyBusinessEmailHostingPage = React.lazy(() => import("./pages/MarketingPages").then((m) => ({ default: m.BusinessEmailHostingPage })));
const LazySeoServicesPage = React.lazy(() => import("./pages/MarketingPages").then((m) => ({ default: m.SeoServicesPage })));
const LazyFaqsPage = React.lazy(() => import("./pages/MarketingPages").then((m) => ({ default: m.FaqsPage })));
const LazyHowToPayPage = React.lazy(() => import("./pages/MarketingPages").then((m) => ({ default: m.HowToPayPage })));
const LazyServiceStatusPage = React.lazy(() => import("./pages/MarketingPages").then((m) => ({ default: m.ServiceStatusPage })));
const LazyAboutPage = React.lazy(() => import("./pages/MarketingPages").then((m) => ({ default: m.AboutPage })));
const LazyContactPage = React.lazy(() => import("./pages/MarketingPages").then((m) => ({ default: m.ContactPage })));
const LazyPortfolioPage = React.lazy(() => import("./pages/MarketingPages").then((m) => ({ default: m.PortfolioPage })));
const LazyPrivacyPolicyPage = React.lazy(() => import("./pages/MarketingPages").then((m) => ({ default: m.PrivacyPolicyPage })));
const LazyTermsOfServicePage = React.lazy(() => import("./pages/MarketingPages").then((m) => ({ default: m.TermsOfServicePage })));
const LazyRefundPolicyPage = React.lazy(() => import("./pages/MarketingPages").then((m) => ({ default: m.RefundPolicyPage })));
const LazyBlogRouter = React.lazy(() => import("./pages/BlogPages").then((m) => ({ default: m.BlogRouter })));
const LazyKnowledgeBaseRouter = React.lazy(() => import("./pages/KnowledgeBasePages").then((m) => ({ default: m.KnowledgeBaseRouter })));
const LazyWebsiteQuoteLandingPage = React.lazy(() => import("./pages/WebsiteQuotePages").then((m) => ({ default: m.WebsiteQuoteLandingPage })));
const LazyWebsiteQuoteThankYouPage = React.lazy(() => import("./pages/WebsiteQuotePages").then((m) => ({ default: m.WebsiteQuoteThankYouPage })));

// Fixed-size, accessible fallback so a route chunk still loading never
// collapses to a blank screen or shifts layout once it resolves.
function RouteLoadingFallback() {
  return (
    <div
      role="status"
      aria-live="polite"
      aria-label="Loading page"
      className="flex min-h-screen items-center justify-center bg-background"
    >
      <div className="h-10 w-10 animate-spin rounded-full border-2 border-primary/25 border-t-primary" />
      <span className="sr-only">Loading…</span>
    </div>
  );
}

function RoutedPage({ children }: { children: React.ReactNode }) {
  return <Suspense fallback={<RouteLoadingFallback />}>{children}</Suspense>;
}

export default function App() {
  const path = window.location.pathname;

  // Fires once per real browser page load (the public site is a classic MPA —
  // every route change here is a fresh document load). SPA zones (/admin,
  // /client) additionally track their internal pushState navigations in
  // useAdminRoute/useClientRoute; trackPageView's own dedupe means the two
  // never double-count the very first render.
  useEffect(() => {
    trackPageView();
    return initScrollDepthTracking();
  }, []);

  if (path.startsWith("/admin")) return <RoutedPage><LazyAdminApp /></RoutedPage>;
  if (path.startsWith("/client")) return <RoutedPage><LazyClientPortal /></RoutedPage>;
  if (path.startsWith("/domains")) return <RoutedPage><LazyDomainsLandingPage /></RoutedPage>;
  if (path.startsWith("/domain-registration")) return <RoutedPage><LazyDomainRegistrationPage /></RoutedPage>;
  if (path.startsWith("/domain-transfer")) return <RoutedPage><LazyPublicDomainTransferPage /></RoutedPage>;
  if (path.startsWith("/domain-renewal")) return <RoutedPage><LazyDomainRenewalPage /></RoutedPage>;
  if (path.startsWith("/domain-pricing")) return <RoutedPage><LazyDomainPricingPage /></RoutedPage>;
  if (path.startsWith("/web-hosting")) return <RoutedPage><LazyWebHostingPage /></RoutedPage>;
  if (path.startsWith("/website-care-plans")) return <RoutedPage><LazyWebsiteCarePlansPage /></RoutedPage>;
  if (path.startsWith("/website-design")) return <RoutedPage><LazyWebsiteDesignPage /></RoutedPage>;
  if (path.startsWith("/business-email-hosting")) return <RoutedPage><LazyBusinessEmailHostingPage /></RoutedPage>;
  if (path.startsWith("/seo-services")) return <RoutedPage><LazySeoServicesPage /></RoutedPage>;
  if (path.startsWith("/blog")) return <RoutedPage><LazyBlogRouter /></RoutedPage>;
  if (path.startsWith("/knowledge-base")) return <RoutedPage><LazyKnowledgeBaseRouter /></RoutedPage>;
  if (path.startsWith("/faqs")) return <RoutedPage><LazyFaqsPage /></RoutedPage>;
  if (path.startsWith("/how-to-pay")) return <RoutedPage><LazyHowToPayPage /></RoutedPage>;
  if (path.startsWith("/service-status")) return <RoutedPage><LazyServiceStatusPage /></RoutedPage>;
  if (path.startsWith("/about")) return <RoutedPage><LazyAboutPage /></RoutedPage>;
  if (path.startsWith("/contact")) return <RoutedPage><LazyContactPage /></RoutedPage>;
  if (path.startsWith("/portfolio")) return <RoutedPage><LazyPortfolioPage /></RoutedPage>;
  if (path.startsWith("/privacy-policy")) return <RoutedPage><LazyPrivacyPolicyPage /></RoutedPage>;
  if (path.startsWith("/terms-of-service")) return <RoutedPage><LazyTermsOfServicePage /></RoutedPage>;
  if (path.startsWith("/refund-policy")) return <RoutedPage><LazyRefundPolicyPage /></RoutedPage>;
  if (path === "/get-a-website/thank-you") return <RoutedPage><LazyWebsiteQuoteThankYouPage /></RoutedPage>;
  if (path === "/get-a-website") return <RoutedPage><LazyWebsiteQuoteLandingPage /></RoutedPage>;
  return <PublicSite />;
}
