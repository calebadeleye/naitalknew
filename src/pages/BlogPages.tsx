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

export function NewsletterSignup() {
  const toast = useToast();
  const [email, setEmail] = useState("");

  const submit = (event: React.FormEvent) => {
    event.preventDefault();
    if (!email.trim()) return;
    // There's no email marketing platform wired up yet — this simply
    // acknowledges interest rather than pretending to subscribe anywhere.
    toast.push({ type: "success", message: "Thanks! We'll be in touch." });
    setEmail("");
  };

  return (
    <div className="pub-card !bg-[#0b1210] !border-white/10">
      <h3 className="text-lg font-black text-white">Get business tips in your inbox</h3>
      <p className="mt-2 text-sm leading-6 text-white/60">Practical guides on domains, hosting, and growing your business online.</p>
      <form className="mt-4 flex flex-col gap-2 sm:flex-row" onSubmit={submit}>
        <input
          type="email"
          required
          value={email}
          onChange={(event) => setEmail(event.target.value)}
          placeholder="you@yourbusiness.com"
          className="w-full rounded-lg border border-white/15 bg-white/5 px-4 py-3 text-sm text-white outline-none placeholder:text-white/35 focus:border-primary/50"
        />
        <button type="submit" className="btn-primary shrink-0 justify-center">Subscribe</button>
      </form>
    </div>
  );
}

export type PublicBlogSummary = {
  title: string;
  slug: string;
  excerpt: string | null;
  featured_image_url: string | null;
  featured_image_alt: string | null;
  author_name: string;
  published_at: string | null;
  reading_time_minutes: number;
};

export const BlogCard: React.FC<{ post: PublicBlogSummary }> = ({ post }) => {
  return (
    <a href={`/blog/${post.slug}`} className="pub-card group flex flex-col overflow-hidden !p-0">
      <img
        src={post.featured_image_url || "/images/placeholder-business.svg"}
        alt={post.featured_image_alt || post.title}
        loading="lazy"
        className="aspect-[16/10] w-full object-cover"
      />
      <div className="flex flex-1 flex-col p-5">
        <h3 className="text-lg font-black text-[#07111f] transition group-hover:text-primary">{post.title}</h3>
        <p className="mt-2 flex-1 text-sm leading-6 text-[#596273]">{post.excerpt}</p>
        <div className="mt-4 flex items-center justify-between border-t border-black/8 pt-4 text-xs font-bold text-[#596273]">
          <span>{post.author_name} · {post.published_at ? formatDate(post.published_at) : ""}</span>
          <span className="inline-flex items-center gap-1 text-primary">
            Read more
            <ArrowRight className="h-3.5 w-3.5" />
          </span>
        </div>
      </div>
    </a>
  );
};

export function BlogIndexPage() {
  const [posts, setPosts] = useState<PublicBlogSummary[] | null>(null);
  const [popular, setPopular] = useState<Array<{ title: string; slug: string }>>([]);
  const [search, setSearch] = useState("");
  const [meta, setMeta] = useState<{ current_page: number; last_page: number }>({ current_page: 1, last_page: 1 });
  const [page, setPage] = useState(1);

  useEffect(() => {
    setPosts(null);
    const params = new URLSearchParams();
    if (search) params.set("search", search);
    if (page > 1) params.set("page", String(page));

    laravelApi<{ data: PublicBlogSummary[]; meta: typeof meta; popular: Array<{ title: string; slug: string }> }>(`/api/v1/public/blog?${params.toString()}`)
      .then((response) => {
        setPosts(response.data);
        setMeta(response.meta);
        setPopular(response.popular);
      })
      .catch(() => setPosts([]));
  }, [search, page]);

  return (
    <PublicPage>
      <section className="pub-section">
        <div className="mx-auto max-w-3xl px-4 pt-14 text-center sm:px-6 lg:px-8">
          <span className="pub-eyebrow">Blog</span>
          <h1 className="mt-4 text-4xl font-black text-[#07111f] sm:text-5xl">Guides for growing your business online</h1>
          <p className="mt-4 text-base leading-7 text-[#596273]">Practical, jargon-free articles on domains, hosting, website design, and email — written for Nigerian business owners.</p>
          <div className="mx-auto mt-8 flex max-w-md items-center gap-2 rounded-full border border-black/10 bg-white px-4 py-2 shadow-[0_10px_30px_rgba(16,24,16,0.06)]">
            <Search className="h-4 w-4 shrink-0 text-[#596273]" />
            <input
              value={search}
              onChange={(event) => { setSearch(event.target.value); setPage(1); }}
              placeholder="Search articles..."
              className="w-full bg-transparent text-sm text-[#07111f] outline-none placeholder:text-[#9aa39a]"
            />
          </div>
        </div>

        <div className="mx-auto max-w-7xl px-4 py-14 sm:px-6 lg:px-8">
          <div className="grid gap-10 lg:grid-cols-[1fr_320px]">
            <div>
              {posts === null ? (
                <p className="text-sm text-[#596273]">Loading articles...</p>
              ) : posts.length === 0 ? (
                <p className="pub-card text-sm text-[#596273]">No articles found{search ? ` for "${search}"` : ""}.</p>
              ) : (
                <>
                  <div className="grid gap-6 sm:grid-cols-2">
                    {posts.map((post) => (
                      <BlogCard key={post.slug} post={post} />
                    ))}
                  </div>
                  {meta.last_page > 1 && (
                    <div className="mt-8 flex items-center justify-center gap-3">
                      <button type="button" className="btn-outline-light !min-h-10 !px-4 !text-[11px]" disabled={page <= 1} onClick={() => setPage((current) => current - 1)}>Previous</button>
                      <span className="text-xs font-bold text-[#596273]">Page {meta.current_page} of {meta.last_page}</span>
                      <button type="button" className="btn-outline-light !min-h-10 !px-4 !text-[11px]" disabled={page >= meta.last_page} onClick={() => setPage((current) => current + 1)}>Next</button>
                    </div>
                  )}
                </>
              )}
            </div>

            <aside className="grid gap-6">
              <div className="pub-card">
                <h3 className="text-base font-black text-[#07111f]">Popular Posts</h3>
                <ul className="mt-4 grid gap-3 text-sm">
                  {popular.map((item) => (
                    <li key={item.slug}>
                      <a href={`/blog/${item.slug}`} className="font-bold text-[#07111f] transition hover:text-primary">{item.title}</a>
                    </li>
                  ))}
                </ul>
              </div>
              <NewsletterSignup />
            </aside>
          </div>
        </div>
      </section>
    </PublicPage>
  );
}

export function BlogDetailPage({ slug }: { slug: string }) {
  const toast = useToast();
  const [post, setPost] = useState<(PublicBlogSummary & { content: string; seo_title: string; seo_description: string; og_image: string | null }) | null>(null);
  const [related, setRelated] = useState<PublicBlogSummary[]>([]);
  const [notFound, setNotFound] = useState(false);

  useEffect(() => {
    laravelApi<{ data: typeof post; related: PublicBlogSummary[] }>(`/api/v1/public/blog/${slug}`)
      .then((response) => {
        setPost(response.data);
        setRelated(response.related);
        if (response.data) trackViewOnce(`blog_post_view:${slug}`, "blog_post_view", { content_title: response.data.title, content_slug: slug });
      })
      .catch(() => {
        setNotFound(true);
        toast.push({ type: "error", message: "That article could not be found." });
      });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [slug]);

  useSeo(post ? { title: post.seo_title, description: post.seo_description, ogImage: post.og_image || undefined } : undefined);

  if (notFound) {
    return (
      <PublicPage>
        <div className="pub-section flex min-h-[40vh] items-center justify-center">
          <p className="text-sm text-[#596273]">Article not found. <a href="/blog" className="font-bold text-primary">Back to Blog</a></p>
        </div>
      </PublicPage>
    );
  }

  if (!post) {
    return (
      <PublicPage>
        <div className="pub-section flex min-h-[40vh] items-center justify-center">
          <Loader2 className="h-6 w-6 animate-spin text-[#596273]" />
        </div>
      </PublicPage>
    );
  }

  return (
    <PublicPage>
      <PublicBreadcrumbs items={[{ label: "Blog", href: "/blog" }, { label: post.title }]} />
      <article className="pub-section">
        <div className="mx-auto max-w-3xl px-4 py-10 sm:px-6 lg:px-8">
          <h1 className="text-3xl font-black leading-tight text-[#07111f] sm:text-4xl">{post.title}</h1>
          <div className="mt-4 flex flex-wrap items-center gap-x-4 gap-y-1 text-xs font-bold text-[#596273]">
            <span>{post.author_name}</span>
            <span>{post.published_at ? formatDate(post.published_at) : ""}</span>
            <span>{post.reading_time_minutes} min read</span>
          </div>

          <img
            src={post.featured_image_url || "/images/placeholder-business.svg"}
            alt={post.featured_image_alt || post.title}
            className="mt-6 aspect-[16/9] w-full rounded-2xl object-cover"
          />

          <div className="prose-content mt-8 grid gap-5 text-base leading-8 text-[#334138]">
            {post.content.split(/\n{2,}/).map((block, index) => {
              const trimmed = block.trim();
              const h3 = trimmed.match(/^###\s+(.+)$/);
              if (h3) {
                return (
                  <h3 key={index} className="mt-2 text-lg font-black text-[#07111f] sm:text-xl">
                    {h3[1]}
                  </h3>
                );
              }
              const h2 = trimmed.match(/^##\s+(.+)$/);
              if (h2) {
                return (
                  <h2 key={index} className="mt-4 text-2xl font-black text-[#07111f] sm:text-3xl">
                    {h2[1]}
                  </h2>
                );
              }
              return <p key={index}>{block}</p>;
            })}
          </div>

          <div className="mt-10 grid gap-4 rounded-2xl border border-primary/25 bg-primary/5 p-6 sm:grid-cols-2">
            <div>
              <h3 className="text-base font-black text-[#07111f]">Ready to get started?</h3>
              <p className="mt-1 text-sm text-[#596273]">Search a domain or explore our Website Care Plans.</p>
            </div>
            <div className="flex flex-wrap gap-3 sm:justify-end">
              <a href="/domains" className="btn-outline-light !min-h-10 !text-[11px]">Search Domain</a>
              <a href="/website-care-plans" className="btn-primary !min-h-10 !text-[11px]">View Website Care Plans</a>
            </div>
          </div>
        </div>
      </article>

      {related.length > 0 && (
        <section className="pub-section-tint border-y border-black/5">
          <div className="mx-auto max-w-6xl px-4 py-14 sm:px-6 lg:px-8">
            <h2 className="text-2xl font-black text-[#07111f]">Related articles</h2>
            <div className="mt-6 grid gap-6 sm:grid-cols-3">
              {related.map((item) => (
                <BlogCard key={item.slug} post={item} />
              ))}
            </div>
          </div>
        </section>
      )}

      <section className="pub-section">
        <div className="mx-auto max-w-3xl px-4 py-14 sm:px-6 lg:px-8">
          <NewsletterSignup />
        </div>
      </section>
    </PublicPage>
  );
}

export function BlogRouter() {
  const slug = window.location.pathname.replace(/^\/blog\/?/, "").replace(/\/$/, "");

  return slug ? <BlogDetailPage slug={slug} /> : <BlogIndexPage />;
}
