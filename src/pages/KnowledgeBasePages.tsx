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

export const KB_GROUP_ICONS: Record<string, LucideIcon> = {
  LayoutDashboard,
  PackageCheck,
  FileText,
  Globe2,
  Wallet,
  RefreshCw,
  ShieldCheck,
  MessageCircle,
  Server,
};

export const KB_POPULAR_SLUGS = [
  "how-to-fund-your-wallet",
  "how-to-pay-an-invoice",
  "how-to-search-and-register-a-domain",
  "how-to-raise-a-support-ticket",
  "how-auto-renewal-works",
  "how-to-order-hosting-and-manage-services",
  "how-to-add-hosting-to-a-domain",
  "how-to-update-your-profile",
];

export const KB_GETTING_STARTED_SLUGS = [
  "getting-started-with-your-client-dashboard",
  "how-to-order-hosting-and-manage-services",
];

export const KB_GROUP_DESCRIPTIONS: Record<string, string> = {
  "dashboard-overview": "Understand your dashboard and key features.",
  "services-catalog": "Explore our services and available add-ons.",
  "orders-invoices": "View orders, invoices, and payment history.",
  "domains-dns": "Manage domains, DNS records, and name servers.",
  "wallet-payments": "Add funds, transactions, and payment methods.",
  "auto-renewal": "Learn how auto-renewal keeps you protected.",
  "profile-security": "Update your profile and security settings.",
  "support-tickets": "Open, track, and manage your support tickets.",
  "website-management": "Manage your websites, SSL, and related tools.",
};

export type KbGroup = {
  name: string;
  slug: string;
  icon: string | null;
  articles: Array<{ title: string; slug: string; summary: string | null }>;
};

export function KnowledgeBaseIndexPage() {
  const [groups, setGroups] = useState<KbGroup[] | null>(null);
  const [search, setSearch] = useState("");

  useEffect(() => {
    laravelApi<{ groups: KbGroup[] }>("/api/v1/public/knowledge-base")
      .then((response) => setGroups(response.groups))
      .catch(() => setGroups([]));
  }, []);

  const filteredGroups = (groups || [])
    .map((group) => ({
      ...group,
      articles: search
        ? group.articles.filter((article) => article.title.toLowerCase().includes(search.toLowerCase()))
        : group.articles,
    }))
    .filter((group) => group.articles.length > 0);

  const popularArticles = (groups || [])
    .flatMap((group) => group.articles)
    .filter((article) => KB_POPULAR_SLUGS.includes(article.slug))
    .sort((a, b) => KB_POPULAR_SLUGS.indexOf(a.slug) - KB_POPULAR_SLUGS.indexOf(b.slug));

  const gettingStartedArticles = KB_GETTING_STARTED_SLUGS.map((slug) => {
    const group = (groups || []).find((candidate) => candidate.articles.some((article) => article.slug === slug));
    const article = group?.articles.find((candidate) => candidate.slug === slug);
    return article && group ? { ...article, group } : null;
  }).filter((item): item is { title: string; slug: string; summary: string | null; group: KbGroup } => item !== null);

  return (
    <PublicPage>
      <section className="border-b border-white/8">
        <div className="mx-auto max-w-4xl px-4 py-16 text-center sm:px-6 lg:px-8">
          <span className="eyebrow">— Help Center</span>
          <h1 className="mt-4 text-4xl font-black sm:text-5xl">
            Knowledge Base for the <span className="text-primary">Client Area</span>
          </h1>
          <p className="mt-4 text-base leading-7 text-white/62 sm:text-lg">
            Find step-by-step guides, tutorials, and articles to help you manage your account, services, domains, billing, and support with ease.
          </p>
          <div className="mx-auto mt-8 flex max-w-md items-center gap-2 rounded-full border border-white/15 bg-white/5 py-2 pl-4 pr-2">
            <Search className="h-4 w-4 shrink-0 text-white/50" />
            <input
              value={search}
              onChange={(event) => setSearch(event.target.value)}
              placeholder="Search help articles, guides, or tutorials..."
              className="w-full bg-transparent text-sm text-white outline-none placeholder:text-white/35"
            />
            <span className="btn-primary !min-h-9 shrink-0 !px-5 !py-0 !text-[10px]">Search</span>
          </div>
        </div>
      </section>

      <section className="border-b border-white/8 bg-white/[0.02]">
        <div className="mx-auto max-w-7xl px-4 py-14 sm:px-6 lg:px-8">
          <h2 className="flex items-center gap-2 text-xl font-black text-white">
            <BookOpen className="h-5 w-5 text-primary" />
            Getting Started
          </h2>
          <div className="mt-6 grid gap-4 sm:grid-cols-2">
            {gettingStartedArticles.map((item) => {
              const Icon = (item.group.icon && KB_GROUP_ICONS[item.group.icon]) || Rocket;
              return (
                <a
                  key={item.slug}
                  href={`/knowledge-base/${item.slug}`}
                  className="group flex items-start gap-4 rounded-2xl border border-white/10 bg-white/[0.035] p-5 transition hover:border-primary/40 hover:bg-primary/[0.05]"
                >
                  <span className="service-icon shrink-0">
                    <Icon className="h-5 w-5" />
                  </span>
                  <div className="min-w-0 flex-1">
                    <p className="font-black text-white">{item.title}</p>
                    {item.summary && <p className="mt-1 text-sm text-white/55">{item.summary}</p>}
                    <span className="mt-3 inline-block rounded-full border border-white/15 px-3 py-1 text-[11px] font-bold text-white/60">
                      {item.group.articles.length} articles
                    </span>
                  </div>
                  <ChevronRight className="h-4 w-4 shrink-0 text-white/30 transition group-hover:translate-x-1 group-hover:text-primary" />
                </a>
              );
            })}
          </div>
        </div>
      </section>

      <section>
        <div className="mx-auto max-w-7xl px-4 py-14 sm:px-6 lg:px-8">
          <div className="grid items-start gap-10 lg:grid-cols-[1fr_320px]">
            <div>
              <h2 className="flex items-center gap-2 text-xl font-black text-white">
                <List className="h-5 w-5 text-primary" />
                Knowledge Base
              </h2>

              {groups === null ? (
                <p className="mt-6 text-sm text-white/55">Loading articles...</p>
              ) : (
                <div className="mt-6 grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
                  {groups.map((group) => {
                    const Icon = (group.icon && KB_GROUP_ICONS[group.icon]) || Server;
                    return (
                      <a
                        key={group.slug}
                        href={`#group-${group.slug}`}
                        className="rounded-2xl border border-white/10 bg-white/[0.035] p-5 transition hover:border-primary/40 hover:bg-primary/[0.05]"
                      >
                        <Icon className="h-6 w-6 text-primary" />
                        <p className="mt-3 font-black text-white">{group.name}</p>
                        {KB_GROUP_DESCRIPTIONS[group.slug] && (
                          <p className="mt-1 text-sm text-white/55">{KB_GROUP_DESCRIPTIONS[group.slug]}</p>
                        )}
                        <span className="mt-3 inline-block rounded-full border border-white/15 px-3 py-1 text-[11px] font-bold text-primary">
                          {group.articles.length} articles
                        </span>
                      </a>
                    );
                  })}
                </div>
              )}

              <div className="mt-12 grid gap-8">
                {groups !== null && filteredGroups.length === 0 && (
                  <p className="rounded-2xl border border-white/10 bg-white/[0.035] p-5 text-sm text-white/55">No articles matched your search.</p>
                )}
                {filteredGroups.map((group) => {
                  const Icon = (group.icon && KB_GROUP_ICONS[group.icon]) || Server;
                  return (
                    <div key={group.slug} id={`group-${group.slug}`} className="scroll-mt-24">
                      <div className="flex items-center gap-2">
                        <Icon className="h-4 w-4 text-primary" />
                        <h3 className="text-lg font-black text-white">{group.name}</h3>
                      </div>
                      <div className="mt-3 grid gap-2 sm:grid-cols-2">
                        {group.articles.map((article) => (
                          <a
                            key={article.slug}
                            href={`/knowledge-base/${article.slug}`}
                            className="rounded-xl border border-white/10 bg-white/[0.03] p-4 transition hover:border-primary/40"
                          >
                            <p className="text-sm font-black text-white">{article.title}</p>
                            {article.summary && <p className="mt-1 line-clamp-2 text-xs text-white/50">{article.summary}</p>}
                          </a>
                        ))}
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>

            <aside className="grid gap-6">
              <div className="rounded-2xl border border-white/10 bg-white/[0.035] p-6">
                <h3 className="flex items-center gap-2 text-base font-black text-white">
                  <Star className="h-4 w-4 text-primary" />
                  Popular Articles
                </h3>
                <ul className="mt-4 grid gap-3 text-sm">
                  {popularArticles.map((article) => (
                    <li key={article.slug}>
                      <a
                        href={`/knowledge-base/${article.slug}`}
                        className="flex items-center justify-between gap-2 font-bold text-white/75 transition hover:text-primary"
                      >
                        <span className="truncate">{article.title}</span>
                        <ChevronRight className="h-3.5 w-3.5 shrink-0" />
                      </a>
                    </li>
                  ))}
                </ul>
              </div>

              <div className="rounded-2xl border border-white/10 bg-white/[0.035] p-6">
                <h3 className="flex items-center gap-2 text-base font-black text-white">
                  <Zap className="h-4 w-4 text-primary" />
                  Quick Actions
                </h3>
                <div className="mt-4 grid gap-2">
                  {[
                    { label: "Open Client Area", href: "/client/dashboard" },
                    { label: "Contact Support", href: "/contact" },
                    { label: "Start a Domain Search", href: "/domains" },
                  ].map((action) => (
                    <a
                      key={action.label}
                      href={action.href}
                      className="flex items-center justify-between rounded-xl border border-white/10 bg-white/[0.02] px-4 py-3 text-sm font-bold text-white/75 transition hover:border-primary/40 hover:text-primary"
                    >
                      {action.label}
                      <ExternalLink className="h-3.5 w-3.5" />
                    </a>
                  ))}
                </div>
              </div>

              <div className="rounded-2xl border border-primary/30 bg-primary/[0.06] p-6 text-center">
                <span className="mx-auto flex h-12 w-12 items-center justify-center rounded-full border border-primary/40 text-primary">
                  <HelpCircle className="h-6 w-6" />
                </span>
                <h3 className="mt-3 text-base font-black text-white">Still need help?</h3>
                <p className="mt-1 text-sm text-white/55">Our support team is here for you 24/7.</p>
                <a href="/contact" className="btn-primary mt-4 w-full justify-center">Contact Support</a>
              </div>
            </aside>
          </div>
        </div>
      </section>

      <section className="border-t border-white/8 bg-white/[0.02]">
        <div className="mx-auto grid max-w-7xl gap-6 px-4 py-10 sm:grid-cols-3 sm:px-6 lg:px-8">
          {[
            { icon: ShieldCheck, title: "Trusted & Secure", desc: "Your data is safe with enterprise-grade security." },
            { icon: Clock, title: "99.9% Uptime", desc: "Reliable infrastructure you can count on." },
            { icon: MessageCircle, title: "24/7 Expert Support", desc: "We're here anytime you need us." },
          ].map((item) => (
            <div key={item.title} className="flex items-center gap-3">
              <item.icon className="h-6 w-6 shrink-0 text-primary" />
              <div>
                <p className="font-black text-white">{item.title}</p>
                <p className="text-sm text-white/55">{item.desc}</p>
              </div>
            </div>
          ))}
        </div>
      </section>
    </PublicPage>
  );
}

export function KnowledgeBaseArticlePage({ slug }: { slug: string }) {
  const toast = useToast();
  const [article, setArticle] = useState<{
    title: string; summary: string | null; content: string; group: { name: string; slug: string };
    last_updated_at: string | null; seo_title: string; seo_description: string;
  } | null>(null);
  const [related, setRelated] = useState<Array<{ title: string; slug: string; summary: string | null }>>([]);
  const [notFound, setNotFound] = useState(false);
  const [feedback, setFeedback] = useState<"yes" | "no" | null>(null);

  useEffect(() => {
    laravelApi<{ data: typeof article; related: typeof related }>(`/api/v1/public/knowledge-base/${slug}`)
      .then((response) => {
        setArticle(response.data);
        setRelated(response.related);
        if (response.data) trackViewOnce(`knowledge_base_view:${slug}`, "knowledge_base_view", { content_title: response.data.title, content_slug: slug });
      })
      .catch(() => setNotFound(true));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [slug]);

  useSeo(article ? { title: article.seo_title, description: article.seo_description } : undefined);

  const submitFeedback = (value: "yes" | "no") => {
    setFeedback(value);
    toast.push({ type: "success", message: "Thanks for the feedback!" });
  };

  if (notFound) {
    return (
      <PublicPage>
        <div className="pub-section flex min-h-[40vh] items-center justify-center">
          <p className="text-sm text-[#596273]">Article not found. <a href="/knowledge-base" className="font-bold text-primary">Back to Knowledge Base</a></p>
        </div>
      </PublicPage>
    );
  }

  if (!article) {
    return (
      <PublicPage>
        <div className="pub-section flex min-h-[40vh] items-center justify-center">
          <Loader2 className="h-6 w-6 animate-spin text-[#596273]" />
        </div>
      </PublicPage>
    );
  }

  const headings = article.content.split(/\n{2,}/).map((paragraph) => paragraph.split("\n")[0]).slice(0, 6);

  return (
    <PublicPage>
      <PublicBreadcrumbs items={[{ label: "Knowledge Base", href: "/knowledge-base" }, { label: article.group.name }, { label: article.title }]} />
      <section className="pub-section">
        <div className="mx-auto grid max-w-6xl gap-10 px-4 py-10 sm:px-6 lg:grid-cols-[1fr_260px] lg:px-8">
          <article>
            <h1 className="text-3xl font-black text-[#07111f] sm:text-4xl">{article.title}</h1>
            {article.summary && <p className="mt-3 text-base leading-7 text-[#596273]">{article.summary}</p>}
            <p className="mt-2 text-xs font-bold text-[#9aa39a]">
              Last updated {article.last_updated_at ? <time dateTime={article.last_updated_at}>{formatDate(article.last_updated_at)}</time> : "recently"}
            </p>

            <div className="mt-8 grid gap-5 text-base leading-8 text-[#334138]">
              {article.content.split(/\n{2,}/).map((paragraph, index) => (
                <p key={index}>{paragraph}</p>
              ))}
            </div>

            <div className="mt-10 rounded-2xl border border-black/8 bg-white p-6 text-center shadow-[0_15px_45px_rgba(16,24,16,0.06)]">
              <p className="text-sm font-black text-[#07111f]">Was this helpful?</p>
              <div className="mt-3 flex justify-center gap-3">
                <button type="button" onClick={() => submitFeedback("yes")} className={`btn-outline-light !min-h-10 !px-5 !text-[11px] ${feedback === "yes" ? "!border-primary !text-primary" : ""}`}>Yes</button>
                <button type="button" onClick={() => submitFeedback("no")} className={`btn-outline-light !min-h-10 !px-5 !text-[11px] ${feedback === "no" ? "!border-primary !text-primary" : ""}`}>No</button>
              </div>
              <a href="/contact" className="mt-4 inline-block text-xs font-bold text-primary hover:underline">Still stuck? Contact support</a>
            </div>
          </article>

          <aside className="grid gap-6">
            {headings.length > 1 && (
              <div className="pub-card">
                <h3 className="text-sm font-black uppercase text-[#596273]">On this page</h3>
                <ul className="mt-3 grid gap-2 text-sm text-[#334138]">
                  {headings.map((heading, index) => (
                    <li key={index} className="truncate">{heading}</li>
                  ))}
                </ul>
              </div>
            )}
            {related.length > 0 && (
              <div className="pub-card">
                <h3 className="text-sm font-black uppercase text-[#596273]">Related Articles</h3>
                <ul className="mt-3 grid gap-2.5 text-sm">
                  {related.map((item) => (
                    <li key={item.slug}>
                      <a href={`/knowledge-base/${item.slug}`} className="font-bold text-[#07111f] transition hover:text-primary">{item.title}</a>
                    </li>
                  ))}
                </ul>
              </div>
            )}
          </aside>
        </div>
      </section>
    </PublicPage>
  );
}

export function KnowledgeBaseRouter() {
  const slug = window.location.pathname.replace(/^\/knowledge-base\/?/, "").replace(/\/$/, "");

  return slug ? <KnowledgeBaseArticlePage slug={slug} /> : <KnowledgeBaseIndexPage />;
}

