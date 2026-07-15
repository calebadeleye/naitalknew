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
  Pencil,
  Phone,
  Plus,
  Power,
  RefreshCw,
  Rocket,
  Save,
  Search,
  Send,
  Server,
  Settings,
  ShieldCheck,
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
  trackCtaClick,
  trackFormSubmission,
  trackDomainSearch,
  trackPlanSelection,
  trackCheckout,
  trackPurchase,
  initScrollDepthTracking,
} from "./lib/analytics";

type LogoImage = {
  src: string;
  alt: string;
  width?: number | null;
  height?: number | null;
};

type ClientLogo = LogoImage & {
  name: string;
};

type Project = {
  title: string;
  category: string;
  img: string;
  details: {
    challenge: string;
    solution: string;
    roi: string;
  };
};

type Review = {
  author_name: string;
  rating: number;
  text: string;
  profile_photo_url?: string;
  relative_time_description?: string;
};

type SiteContent = {
  brand: {
    logo: LogoImage;
  };
  clientLogos: ClientLogo[];
  projects: Project[];
  reviews: Review[];
};

type AdminDashboardMetric = {
  label: string;
  value: string | number | null;
  amount?: string;
  raw?: number;
};

type AdminDashboardSnapshot = {
  pending_payment_reviews: number;
  metrics: AdminDashboardMetric[];
  revenue_overview: Array<{ month: string; amount: string; raw: number }>;
  upcoming_renewals: Array<{
    service_number: string;
    client: string | null;
    plan: string | null;
    primary_domain: string | null;
    status: string;
    renews_at: string | null;
  }>;
  recent_payments: Array<{
    client: string | null;
    invoice_number: string | null;
    gateway: string;
    status: string;
    amount: string;
    paid_at: string | null;
  }>;
  invoice_overview: Array<{ status: string; count: number; amount: number }>;
  top_services: Array<{ name: string; count: number }>;
  system_status: Array<{ name: string; status: string }>;
  recent_orders: Array<{
    order_number: string;
    client: string | null;
    status: string;
    billing_cycle: string;
    total: string;
    created_at: string;
  }>;
};

type ClientDashboardSnapshot = {
  client: {
    name: string;
    email: string;
    client_code: string;
    status: string;
  };
  metrics: Array<{ label: string; value: string | number | null; raw?: number }>;
  services: Array<{
    id: number;
    service_number: string;
    primary_domain: string | null;
    plan: string | null;
    status: string;
    renews_at: string | null;
  }>;
  recent_invoice: {
    invoice_number: string;
    status: string;
    total: string;
    due_at: string | null;
  } | null;
  invoices: Array<{
    invoice_number: string;
    status: string;
    total: string;
    due_at: string | null;
  }>;
  tickets: Array<Record<string, unknown>>;
  empty_state: {
    title: string;
    actions: Array<{ label: string; href: string }>;
  } | null;
};

type HostingPlanCard = {
  name: string;
  slug: string;
  audience: string;
  monthly: string;
  annual: string;
  featured: boolean;
  badge: string | null;
  ctaLabel: string;
  features: string[];
};

type ServiceCatalogItem = {
  name: string;
  slug: string;
  category: string;
  short_description: string | null;
  benefits: string[];
  starting_price: string | null;
  billing_type: "one_time" | "monthly" | "yearly" | "custom_quote";
  is_quote_only: boolean;
  order_route: string | null;
};

type ClientOrderSummary = {
  order_number: string;
  status: string;
  billing_cycle: string;
  total: string;
  created_at: string | null;
  items: Array<{ description: string; total: string }>;
  invoice: { invoice_number: string; status: string; total: string } | null;
};

type BankTransferDetails = {
  bank_name: string;
  account_name: string;
  account_number: string;
  amount: string;
  reference: string;
  message: string;
};

type PricingPackage = {
  id?: number;
  name: string;
  slug: string;
  short_description: string;
  monthly_price_kobo: number;
  annual_price_kobo: number;
  setup_fee_kobo: number;
  currency?: string;
  monthly_price?: string;
  annual_price?: string;
  setup_fee?: string;
  storage_allocation: string;
  bandwidth_policy: string;
  websites: number;
  databases: number;
  email_accounts: number;
  backup_frequency: string;
  support_tier: string;
  migration_included: boolean;
  is_featured: boolean;
  is_popular: boolean;
  is_recommended: boolean;
  is_active: boolean;
  status?: string;
  sort_order: number;
  display_badge: string;
  cta_label: string;
  internal_notes?: string;
  public_features: string[];
  internal_limits: Record<string, unknown>;
};

type ClientAuthMode = "login" | "register" | "forgot" | "reset";

type LaravelPage<T = Record<string, unknown>> = {
  data: T[];
  links?: unknown[];
  meta?: {
    current_page?: number;
    last_page?: number;
    total?: number;
  };
};

type AdminRecordsSectionId =
  | "products"
  | "orders"
  | "invoices"
  | "payments"
  | "support"
  | "provisioning"
  | "ispconfigMappings"
  | "auditLogs"
  | "domains"
  | "domainOrders"
  | "domainTransfers";

const LARAVEL_API_BASE_URL =
  (import.meta.env.VITE_LARAVEL_API_URL as string | undefined)?.replace(/\/$/, "") || "http://127.0.0.1:8000";

async function laravelApi<T>(path: string, token?: string, options: RequestInit = {}): Promise<T> {
  const headers = new Headers(options.headers);
  headers.set("Accept", "application/json");

  if (options.body && !headers.has("Content-Type")) {
    headers.set("Content-Type", "application/json");
  }

  if (token) {
    headers.set("Authorization", `Bearer ${token}`);
  }

  const response = await fetch(`${LARAVEL_API_BASE_URL}${path}`, {
    ...options,
    headers,
  });
  const payload = await response.json().catch(() => ({}));

  if (!response.ok) {
    throw new Error(payload.message || payload.error || "Laravel API request failed");
  }

  return payload as T;
}

function parseNairaAmount(value: string | undefined): number {
  if (!value) return 0;
  return Number(value.replace(/[^0-9.]/g, "")) || 0;
}

function formatNaira(value: number): string {
  return `₦${Math.round(value).toLocaleString()}`;
}

const navItems = [
  { label: "Home", href: "/" },
  { label: "Solutions", href: "/website-design" },
];

const staticNavGroups = [
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

const guestAccountGroup = {
  label: "Account",
  items: [
    { label: "Client Login", href: "/client/login" },
    { label: "Create Account", href: "/client/register" },
  ],
};

const authenticatedAccountGroup = {
  label: "My Account",
  items: [
    { label: "Dashboard", href: "/client/dashboard" },
    { label: "My Services", href: "/client/dashboard" },
    { label: "My Invoices", href: "/client/dashboard" },
    { label: "Order Hosting", href: "/client/order/hosting" },
    { label: "Logout", href: "/client/dashboard" },
  ],
};

const services = [
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

const catalogCategoryIcons: Record<string, React.ComponentType<{ className?: string }>> = {
  hosting: Server,
  add_on: Settings,
  web_development: Code2,
  maintenance: ShieldCheck,
  ai: Bot,
  email_addon: Mail,
};

function catalogCategoryIcon(category: string): React.ComponentType<{ className?: string }> {
  return catalogCategoryIcons[category] || PackageCheck;
}

const process = [
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

const fallbackClientLogos: ClientLogo[] = ["UTME", "Skinologist", "Luminary", "Naibank", "ScholarJoint", "RHM"].map(
  (name) => ({
    name,
    alt: name,
    src: "",
    width: null,
    height: null,
  }),
);

const fallbackProjects: Project[] = [
  {
    title: "UTME.com.ng",
    category: "CBT Platform",
    img: "/data/scholarjoint.png",
    details: {
      challenge:
        "Students needed a reliable practice environment with payments, offline mode and performance tracking.",
      solution:
        "We built a responsive CBT platform with subscription payments, analytics and secure hosting.",
      roi: "Improved learning access and reduced manual result tracking for administrators.",
    },
  },
  {
    title: "Skinologist",
    category: "E-commerce",
    img: "/data/skinologist.png",
    details: {
      challenge:
        "The skincare brand needed a polished storefront and better customer ordering workflows.",
      solution:
        "We delivered product discovery, secure checkout and a management dashboard.",
      roi: "Raised checkout completion and simplified online inventory operations.",
    },
  },
  {
    title: "Luminary FM",
    category: "Media / Radio",
    img: "/data/rhm.png",
    details: {
      challenge:
        "The broadcaster needed dependable live streaming and a stronger digital presence.",
      solution:
        "We shipped a mobile-friendly streaming platform with scalable hosting.",
      roi: "Expanded listenership and improved broadcast reliability.",
    },
  },
  {
    title: "AI Calling System",
    category: "AI Automation",
    img: "/data/momentum.png",
    details: {
      challenge:
        "The business needed faster customer responses without increasing call center load.",
      solution:
        "We built an AI voice workflow for qualification, support routing and lead capture.",
      roi: "Reduced response time and improved follow-up consistency.",
    },
  },
];

const fallbackReviews: Review[] = [
  {
    author_name: "Tem's Creche",
    rating: 5,
    text: "This was a top notch experience for the project the organization handled for me and my team, thank you for your service of love, we are very happy to do more business with you as I commend your dedication towards time frame delivery of set goals.",
    profile_photo_url: "https://ui-avatars.com/api/?name=Tem's%20Creche&background=random",
    relative_time_description: "9 hours ago",
  },
  {
    author_name: "Samuel Adeyemo",
    rating: 5,
    text: "The AI integration provided by NAITALK has doubled our operational efficiency. Their predictive analytics models are scarily accurate. Highly recommended for any scaling enterprise.",
    profile_photo_url: "https://ui-avatars.com/api/?name=Samuel%20Adeyemo&background=random",
    relative_time_description: "1 month ago",
  },
  {
    author_name: "Anthony Eghosa Ewone",
    rating: 5,
    text: "Excellent service delivery.",
    profile_photo_url: "https://ui-avatars.com/api/?name=Anthony%20Eghosa%20Ewone&background=random",
    relative_time_description: "16 Mar 2022",
  },
];

const stats = [
  { value: "99.9%", label: "Server uptime" },
  { value: "24/7", label: "Support coverage" },
  { value: "60+", label: "Digital projects" },
];

const fallbackHostingPlans: HostingPlanCard[] = [
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

const adminMetrics = [
  { label: "Total Revenue", value: "₦5,420,000", delta: "15.2%", icon: Wallet, tone: "lime" },
  { label: "Total Invoices", value: "342", delta: "8.9%", icon: FileText, tone: "cyan" },
  { label: "Paid Invoices", value: "238", delta: "12.1%", icon: CheckCircle2, tone: "lime" },
  { label: "Overdue Invoices", value: "18", delta: "₦1,235,000 overdue", icon: CalendarClock, tone: "gold" },
  { label: "Active Services", value: "256", delta: "11.3%", icon: Server, tone: "violet" },
  { label: "New Clients", value: "26", delta: "8.4%", icon: Users, tone: "cyan" },
];

const clientServices = [
  ["scholarjoint.com", "Business Hosting", "Active", "Jul 14, 2026", "₦25,000"],
  ["scholarjoint.com Email", "Professional Email", "Active", "Jul 14, 2026", "₦10,000"],
  ["SSL Certificate", "PositiveSSL", "Active", "Jul 14, 2026", "₦15,000"],
];

const whatsappUrl =
  "https://wa.me/2347087057654?text=Hello%20NAITALK%2C%20I%20want%20to%20start%20a%20project.";

const fallbackSiteContent: SiteContent = {
  brand: {
    logo: {
      src: "/logo.png",
      alt: "NAITALK",
      width: null,
      height: null,
    },
  },
  clientLogos: fallbackClientLogos,
  projects: fallbackProjects,
  reviews: fallbackReviews,
};

function Logo({ className = "", logo = fallbackSiteContent.brand.logo }: { className?: string; logo?: LogoImage }) {
  return (
    <a href="/" className={`inline-flex items-center ${className}`} aria-label="NAITALK home">
      <img src={logo.src || "/logo.png"} alt={logo.alt || "NAITALK"} className="h-8 w-auto max-w-[150px] object-contain sm:h-9" />
    </a>
  );
}

function Navbar({ logo }: { logo: LogoImage }) {
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

function DeviceShowcase({ projects, logo }: { projects: Project[]; logo: LogoImage }) {
  const featured = projects.slice(0, 3);
  const heroImage = featured[0]?.img || "/data/skinologist.png";
  const phoneImage = featured[1]?.img || "/data/scholarjoint.png";
  const panelImage = featured[2]?.img || "/data/rhm.png";

  return (
    <div className="relative min-h-[380px] sm:min-h-[440px] lg:min-h-[500px]">
      <div className="absolute left-[18%] top-0 hidden h-64 w-64 rounded-full border border-primary/20 sm:block" />
      <motion.div
        className="absolute right-0 top-4 w-[84%] max-w-[620px] overflow-hidden rounded-[18px] border border-primary/25 bg-[#080c0b] shadow-[0_28px_120px_rgba(100,216,45,0.15)]"
        initial={{ opacity: 0, y: 24 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.7 }}
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
              src={heroImage}
              alt="NAITALK project dashboard preview"
              className="aspect-[16/10] w-full rounded-lg object-cover"
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
            <img src={panelImage} alt="Hosted project preview" className="mt-3 aspect-video w-full rounded-md object-cover" />
          </div>
        </div>
      </motion.div>

      <motion.div
        className="absolute bottom-6 left-0 w-[42%] min-w-[170px] max-w-[260px] overflow-hidden rounded-[28px] border border-primary/25 bg-[#050806] p-2 shadow-[0_20px_80px_rgba(0,0,0,0.55)]"
        initial={{ opacity: 0, x: -20, y: 20 }}
        animate={{ opacity: 1, x: 0, y: 0 }}
        transition={{ duration: 0.7, delay: 0.15 }}
      >
        <div className="rounded-[22px] border border-white/10 bg-[#0b100d] p-3">
          <div className="mb-3 flex items-center justify-between text-[9px] text-white/45">
            <span>9:41</span>
            <span>5G</span>
          </div>
          <div className="mx-auto mb-4 flex h-16 w-16 items-center justify-center rounded-full border border-primary/40 bg-primary/10">
            <Logo logo={logo} className="[&_img]:h-5 [&_img]:max-w-[90px]" />
          </div>
          <img src={phoneImage} alt="Mobile website preview" className="aspect-[4/5] w-full rounded-xl object-cover" />
          <div className="mt-4 rounded-xl bg-primary px-4 py-3 text-center text-[11px] font-black text-on-primary">
            Get Started
          </div>
        </div>
      </motion.div>
    </div>
  );
}

function Hero({ projects, logo }: { projects: Project[]; logo: LogoImage }) {
  return (
    <section id="home" className="hero-grid relative overflow-hidden pb-8 pt-28 sm:pb-10 lg:pt-32">
      <div className="mx-auto grid max-w-7xl items-center gap-10 px-4 sm:px-6 lg:grid-cols-[0.95fr_1.05fr] lg:px-8">
        <motion.div
          className="max-w-2xl"
          initial={{ opacity: 0, y: 24 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.65 }}
        >
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
        </motion.div>
        <DeviceShowcase projects={projects} logo={logo} />
      </div>
    </section>
  );
}

function TrustStrip({ clientLogos }: { clientLogos: ClientLogo[] }) {
  if (!clientLogos.length) return null;

  return (
    <section className="border-y border-white/8 bg-white/[0.025] py-7">
      <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
        <p className="text-center text-[10px] font-black uppercase text-primary">
          Trusted by businesses, organisations & institutions
        </p>
        <div className="mt-6 trust-marquee">
          <div className="trust-marquee-track">
            {[...clientLogos, ...clientLogos].map((logo, index) => (
              <div key={`${logo.name}-${index}`} className="trust-card" aria-hidden={index >= clientLogos.length}>
                <div className="trust-card-logo">
                  {logo.src ? <img src={logo.src} alt={logo.alt || logo.name} /> : <span className="trust-card-fallback">{logo.name}</span>}
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

function Services() {
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

function Portfolio({ projects }: { projects: Project[] }) {
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
              aria-label={`View details for ${project.title}`}
              tabIndex={index < projects.length ? 0 : -1}
              aria-hidden={index >= projects.length}
            >
              <img src={project.img} alt={`${project.title} project preview`} loading="lazy" />
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

      <AnimatePresence>
        {selectedProject && (
          <motion.div
            className="project-modal-backdrop"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            onClick={() => setSelectedProject(null)}
          >
            <motion.article
              className="project-modal"
              initial={{ opacity: 0, scale: 0.96, y: 18 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.96, y: 18 }}
              transition={{ duration: 0.22 }}
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
            </motion.article>
          </motion.div>
        )}
      </AnimatePresence>
    </section>
  );
}

function Process() {
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

function AiBand() {
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

function HostingSection() {
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

const REASON_CATEGORIES: Array<{ value: string; label: string }> = [
  { value: "hosting_expired", label: "Hosting expired" },
  { value: "non_payment", label: "Non-payment" },
  { value: "abuse_report", label: "Abuse report" },
  { value: "security_threat", label: "Malware/security threat" },
  { value: "suspicious_activity", label: "Suspicious activity" },
  { value: "client_request", label: "Client request" },
  { value: "terms_violation", label: "Terms violation" },
  { value: "administrative_correction", label: "Administrative correction" },
  { value: "other", label: "Other" },
];

type ReasonFormPayload = {
  reason_category: string;
  reason_note: string;
  notify_client: boolean;
  effective_at: string;
  supporting_reference: string;
};

/**
 * Required before every sensitive account/service/website action (suspend,
 * deactivate, soft-delete, deactivate website hosting...). Collects the
 * structured fields the backend's audit log expects, plus an optional
 * slot for action-specific extra fields (e.g. a security-action checkbox).
 */
function ReasonFormModal({
  title,
  actionLabel,
  onClose,
  onSubmit,
  isSubmitting,
  error,
  children,
}: {
  title: string;
  actionLabel: string;
  onClose: () => void;
  onSubmit: (payload: ReasonFormPayload) => void;
  isSubmitting: boolean;
  error?: string | null;
  children?: (state: { extra: Record<string, unknown>; setExtra: (key: string, value: unknown) => void }) => React.ReactNode;
}) {
  const [reasonCategory, setReasonCategory] = useState("");
  const [reasonNote, setReasonNote] = useState("");
  const [notifyClient, setNotifyClient] = useState(true);
  const [effectiveAt, setEffectiveAt] = useState("");
  const [supportingReference, setSupportingReference] = useState("");
  const [extra, setExtraState] = useState<Record<string, unknown>>({});

  const setExtra = (key: string, value: unknown) => setExtraState((current) => ({ ...current, [key]: value }));

  return (
    <div className="hosting-modal-backdrop" role="presentation" onClick={onClose}>
      <div className="hosting-modal" role="dialog" aria-modal="true" onClick={(event) => event.stopPropagation()}>
        <form
          className="grid gap-4"
          onSubmit={(event) => {
            event.preventDefault();
            onSubmit({
              reason_category: reasonCategory,
              reason_note: reasonNote,
              notify_client: notifyClient,
              effective_at: effectiveAt,
              supporting_reference: supportingReference,
              ...extra,
            } as ReasonFormPayload);
          }}
        >
          <h3 className="text-lg font-black text-white">{title}</h3>
          {error && <p className="form-message error">{error}</p>}

          <label className="admin-field">
            <span>Reason category</span>
            <select required value={reasonCategory} onChange={(event) => setReasonCategory(event.target.value)}>
              <option value="" disabled>Select a reason...</option>
              {REASON_CATEGORIES.map((category) => (
                <option key={category.value} value={category.value}>{category.label}</option>
              ))}
            </select>
          </label>

          <label className="admin-field">
            <span>Detailed reason / note</span>
            <textarea
              required
              rows={3}
              placeholder="Explain what happened and why this action is being taken..."
              value={reasonNote}
              onChange={(event) => setReasonNote(event.target.value)}
            />
          </label>

          {children?.({ extra, setExtra })}

          <label className="admin-field">
            <span>Effective date/time (optional — defaults to now)</span>
            <input type="datetime-local" value={effectiveAt} onChange={(event) => setEffectiveAt(event.target.value)} />
          </label>

          <label className="admin-field">
            <span>Supporting evidence / internal reference (optional)</span>
            <input type="text" placeholder="e.g. ticket number, report link" value={supportingReference} onChange={(event) => setSupportingReference(event.target.value)} />
          </label>

          <label className="flex items-center gap-2 text-sm text-white/70">
            <input type="checkbox" checked={notifyClient} onChange={(event) => setNotifyClient(event.target.checked)} />
            Notify the client by email
          </label>

          <div className="mt-2 flex gap-3">
            <button type="button" className="btn-outline flex-1 justify-center" onClick={onClose}>Cancel</button>
            <button type="submit" className="btn-primary flex-1 justify-center" disabled={isSubmitting || !reasonCategory || !reasonNote}>
              {isSubmitting ? "Working..." : actionLabel}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}

type ManualInvoiceLineItemInput = {
  catalogKey: string;
  description: string;
  quantity: string;
  unitPriceNaira: string;
};

type ManualInvoiceCatalogItem = {
  key: string;
  label: string;
  unitPriceKobo: number | null;
};

const MANUAL_INVOICE_OTHER_KEY = "other";

function CreateManualInvoiceModal({
  adminToken,
  onClose,
  onCreated,
}: {
  adminToken: string;
  onClose: () => void;
  onCreated: () => void;
}) {
  const [clientQuery, setClientQuery] = useState("");
  const [clientResults, setClientResults] = useState<Array<{ id: number; name: string; email: string; client_code: string }>>([]);
  const [selectedClient, setSelectedClient] = useState<{ id: number; name: string; email: string; client_code: string } | null>(null);
  const [isSearchingClients, setIsSearchingClients] = useState(false);
  const [dueAt, setDueAt] = useState("");
  const [discountNaira, setDiscountNaira] = useState("");
  const [applyVat, setApplyVat] = useState(false);
  const [notes, setNotes] = useState("");
  const [lineItems, setLineItems] = useState<ManualInvoiceLineItemInput[]>([
    { catalogKey: "", description: "", quantity: "1", unitPriceNaira: "" },
  ]);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [catalogPlans, setCatalogPlans] = useState<ManualInvoiceCatalogItem[]>([]);
  const [catalogOfferings, setCatalogOfferings] = useState<ManualInvoiceCatalogItem[]>([]);
  const [vatRate, setVatRate] = useState(0.075);

  useEffect(() => {
    laravelApi<{ vat_rate: number }>("/api/v1/public/billing-config")
      .then((config) => setVatRate(config.vat_rate))
      .catch(() => undefined);
  }, []);

  useEffect(() => {
    Promise.all([
      laravelApi<{ data: Array<{ id: number; name: string; monthly_price_kobo: number; is_active: boolean }> }>(
        "/api/v1/admin/pricing-packages",
        adminToken
      ).catch(() => ({ data: [] })),
      laravelApi<{ data: Array<{ id: number; name: string; price_kobo: number | null; is_active: boolean }> }>(
        "/api/v1/admin/service-offerings",
        adminToken
      ).catch(() => ({ data: [] })),
    ]).then(([plansResponse, offeringsResponse]) => {
      setCatalogPlans(
        (plansResponse.data || [])
          .filter((plan) => plan.is_active)
          .map((plan) => ({ key: `plan:${plan.id}`, label: plan.name, unitPriceKobo: plan.monthly_price_kobo }))
      );
      setCatalogOfferings(
        (offeringsResponse.data || [])
          .filter((offering) => offering.is_active)
          .map((offering) => ({ key: `offering:${offering.id}`, label: offering.name, unitPriceKobo: offering.price_kobo }))
      );
    });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [adminToken]);

  useEffect(() => {
    if (selectedClient || clientQuery.trim().length < 2) {
      setClientResults([]);
      return;
    }

    setIsSearchingClients(true);
    const handle = setTimeout(() => {
      laravelApi<{ data: Array<Record<string, any>> }>(
        `/api/v1/admin/clients?search=${encodeURIComponent(clientQuery.trim())}`,
        adminToken
      )
        .then((response) => {
          setClientResults(
            (response.data || []).map((row) => ({
              id: Number(row.id),
              name: row.company_name || row.user?.name || "Unnamed client",
              email: row.user?.email || row.billing_email || "",
              client_code: row.client_code,
            }))
          );
        })
        .catch(() => setClientResults([]))
        .finally(() => setIsSearchingClients(false));
    }, 300);

    return () => clearTimeout(handle);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [clientQuery, selectedClient, adminToken]);

  const catalogItems = [...catalogPlans, ...catalogOfferings];

  const updateLineItem = (index: number, patch: Partial<ManualInvoiceLineItemInput>) => {
    setLineItems((current) => current.map((item, itemIndex) => (itemIndex === index ? { ...item, ...patch } : item)));
  };

  const selectCatalogItem = (index: number, key: string) => {
    if (key === MANUAL_INVOICE_OTHER_KEY) {
      updateLineItem(index, { catalogKey: key, description: "" });
      return;
    }

    const catalogItem = catalogItems.find((entry) => entry.key === key);
    updateLineItem(index, {
      catalogKey: key,
      description: catalogItem?.label ?? "",
      unitPriceNaira: catalogItem?.unitPriceKobo != null ? String(catalogItem.unitPriceKobo / 100) : "",
    });
  };

  const addLineItem = () => {
    setLineItems((current) => [...current, { catalogKey: "", description: "", quantity: "1", unitPriceNaira: "" }]);
  };

  const removeLineItem = (index: number) => {
    setLineItems((current) => (current.length > 1 ? current.filter((_, itemIndex) => itemIndex !== index) : current));
  };

  const subtotalNaira = lineItems.reduce((sum, item) => {
    const quantity = Number(item.quantity) || 0;
    const unitPrice = Number(item.unitPriceNaira) || 0;
    return sum + quantity * unitPrice;
  }, 0);
  const taxableNaira = Math.max(subtotalNaira - (Number(discountNaira) || 0), 0);
  const vatNaira = applyVat ? taxableNaira * vatRate : 0;
  const totalNaira = taxableNaira + vatNaira;

  const handleSubmit = async (event: React.FormEvent) => {
    event.preventDefault();
    setError(null);

    if (!selectedClient) {
      setError("Search for and select a client first.");
      return;
    }

    setIsSubmitting(true);
    try {
      await laravelApi("/api/v1/admin/invoices", adminToken, {
        method: "POST",
        body: JSON.stringify({
          client_id: selectedClient.id,
          line_items: lineItems.map((item) => ({
            description: item.description,
            quantity: Number(item.quantity) || 1,
            unit_price_kobo: Math.round((Number(item.unitPriceNaira) || 0) * 100),
          })),
          due_at: dueAt,
          discount_kobo: discountNaira ? Math.round(Number(discountNaira) * 100) : undefined,
          apply_vat: applyVat,
          notes: notes || undefined,
        }),
      });
      onCreated();
    } catch (submitError) {
      setError(submitError instanceof Error ? submitError.message : "Creating the invoice failed");
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className="hosting-modal-backdrop" role="presentation" onClick={onClose}>
      <div className="hosting-modal" role="dialog" aria-modal="true" onClick={(event) => event.stopPropagation()}>
        <form className="grid gap-4" onSubmit={(event) => void handleSubmit(event)}>
          <h3 className="text-lg font-black text-white">Create a manual invoice</h3>
          {error && <p className="form-message error">{error}</p>}

          <div className="grid gap-2">
            <span className="text-sm font-bold text-white/80">Client</span>
            {selectedClient ? (
              <div className="flex items-center justify-between gap-3 rounded-md border border-primary/30 bg-primary/5 px-3 py-2">
                <div className="min-w-0">
                  <p className="truncate text-sm font-bold text-white">{selectedClient.name}</p>
                  <p className="truncate text-xs text-white/60">{selectedClient.email} · {selectedClient.client_code}</p>
                </div>
                <button
                  type="button"
                  className="btn-outline !min-h-8 shrink-0 !px-3 !py-1 !text-[10px]"
                  onClick={() => { setSelectedClient(null); setClientQuery(""); }}
                >
                  Change
                </button>
              </div>
            ) : (
              <div className="relative">
                <input
                  required
                  type="text"
                  className="w-full rounded-lg border border-white/10 bg-[#041015] px-4 py-3 text-sm text-white outline-none transition placeholder:text-white/32 focus:border-accent-cyan/55"
                  placeholder="Search by name, email, or client code..."
                  value={clientQuery}
                  onChange={(event) => setClientQuery(event.target.value)}
                />
                {isSearchingClients && <p className="mt-1 text-xs text-white/50">Searching...</p>}
                {clientResults.length > 0 && (
                  <div className="absolute z-10 mt-1 max-h-56 w-full overflow-y-auto rounded-md border border-white/10 bg-black/95">
                    {clientResults.map((client) => (
                      <button
                        key={client.id}
                        type="button"
                        className="block w-full px-3 py-2 text-left hover:bg-white/10"
                        onClick={() => { setSelectedClient(client); setClientResults([]); }}
                      >
                        <p className="truncate text-sm font-bold text-white">{client.name}</p>
                        <p className="truncate text-xs text-white/60">{client.email} · {client.client_code}</p>
                      </button>
                    ))}
                  </div>
                )}
              </div>
            )}
          </div>

          <div className="grid gap-3">
            <span className="text-sm font-bold text-white/80">Line items</span>
            {lineItems.map((item, index) => (
              <div key={index} className="grid grid-cols-1 gap-2 sm:grid-cols-[1fr_auto_auto_auto]">
                <div className="grid gap-2">
                  <select
                    required
                    value={item.catalogKey}
                    onChange={(event) => selectCatalogItem(index, event.target.value)}
                  >
                    <option value="" disabled>Select a service...</option>
                    {catalogPlans.length > 0 && (
                      <optgroup label="Hosting Plans">
                        {catalogPlans.map((entry) => (
                          <option key={entry.key} value={entry.key}>{entry.label}</option>
                        ))}
                      </optgroup>
                    )}
                    {catalogOfferings.length > 0 && (
                      <optgroup label="Other Services">
                        {catalogOfferings.map((entry) => (
                          <option key={entry.key} value={entry.key}>{entry.label}</option>
                        ))}
                      </optgroup>
                    )}
                    <option value={MANUAL_INVOICE_OTHER_KEY}>Other (type manually)</option>
                  </select>
                  {item.catalogKey === MANUAL_INVOICE_OTHER_KEY && (
                    <input
                      required
                      type="text"
                      placeholder="Description"
                      value={item.description}
                      onChange={(event) => updateLineItem(index, { description: event.target.value })}
                    />
                  )}
                </div>
                <input
                  required
                  type="number"
                  min={1}
                  className="w-full sm:w-20"
                  placeholder="Qty"
                  value={item.quantity}
                  onChange={(event) => updateLineItem(index, { quantity: event.target.value })}
                />
                <input
                  required
                  type="number"
                  min={0}
                  step="0.01"
                  className="w-full sm:w-32"
                  placeholder="Unit price (₦)"
                  value={item.unitPriceNaira}
                  onChange={(event) => updateLineItem(index, { unitPriceNaira: event.target.value })}
                />
                <button
                  type="button"
                  className="btn-outline !min-h-9 !px-3 !py-1.5 !text-[10px]"
                  disabled={lineItems.length <= 1}
                  onClick={() => removeLineItem(index)}
                >
                  Remove
                </button>
              </div>
            ))}
            <button type="button" className="btn-outline self-start" onClick={addLineItem}>+ Add line item</button>
          </div>

          <label className="admin-field">
            <span>Due date</span>
            <input required type="date" value={dueAt} onChange={(event) => setDueAt(event.target.value)} />
          </label>

          <label className="admin-field">
            <span>Discount (₦, optional)</span>
            <input type="number" min={0} step="0.01" value={discountNaira} onChange={(event) => setDiscountNaira(event.target.value)} />
          </label>

          <label className="flex items-center gap-2 text-sm text-white/70">
            <input type="checkbox" checked={applyVat} onChange={(event) => setApplyVat(event.target.checked)} />
            Apply VAT ({(vatRate * 100).toFixed(vatRate * 100 % 1 === 0 ? 0 : 1)}%)
          </label>

          <div className="grid gap-1 rounded-md border border-white/10 bg-black/20 p-3 text-sm text-white/70">
            <p className="flex justify-between"><span>Subtotal</span><span>₦{subtotalNaira.toLocaleString()}</span></p>
            {Number(discountNaira) > 0 && (
              <p className="flex justify-between"><span>Discount</span><span>-₦{Number(discountNaira).toLocaleString()}</span></p>
            )}
            {applyVat && (
              <p className="flex justify-between"><span>VAT</span><span>₦{vatNaira.toLocaleString()}</span></p>
            )}
            <p className="flex justify-between font-bold text-white"><span>Total</span><span>₦{totalNaira.toLocaleString()}</span></p>
          </div>

          <label className="admin-field">
            <span>Internal note (optional)</span>
            <textarea rows={2} placeholder="e.g. Agreed one-off project fee" value={notes} onChange={(event) => setNotes(event.target.value)} />
          </label>

          <div className="mt-2 flex gap-3">
            <button type="button" className="btn-outline flex-1 justify-center" onClick={onClose}>Cancel</button>
            <button type="submit" className="btn-primary flex-1 justify-center" disabled={isSubmitting}>
              {isSubmitting ? "Creating..." : "Create Invoice"}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}

function formatKobo(kobo: number | null | undefined): string {
  if (kobo === null || kobo === undefined) return "—";
  return `₦${Math.round(kobo / 100).toLocaleString()}`;
}

/** Laravel serializes date-cast fields as full ISO datetimes (e.g. "2027-06-26T00:00:00.000000Z") — show just the date part. */
const ISO_DATE_PATTERN = /^\d{4}-\d{2}-\d{2}/;

/** ISO "YYYY-MM-DD" — required for native <input type="date"> values. */
function toDateInputValue(value: string | null | undefined): string {
  if (!value) return "";
  return value.slice(0, 10);
}

/** House style: every date in the app displays as dd/mm/yyyy, including ISPConfig-derived dates. */
function formatDate(value: string | null | undefined): string {
  if (!value) return "—";
  const [year, month, day] = value.slice(0, 10).split("-");
  if (!year || !month || !day) return value;
  return `${day}/${month}/${year}`;
}

/** dd/mm/yyyy, HH:MM — for timestamps where the time also matters (audit logs, sync status...). */
function formatDateTime(value: string | null | undefined): string {
  if (!value) return "—";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return formatDate(value);
  const day = String(date.getDate()).padStart(2, "0");
  const month = String(date.getMonth() + 1).padStart(2, "0");
  const hours = String(date.getHours()).padStart(2, "0");
  const minutes = String(date.getMinutes()).padStart(2, "0");
  return `${day}/${month}/${date.getFullYear()}, ${hours}:${minutes}`;
}

const ACCOUNT_TYPE_LABELS: Record<string, string> = {
  imported_legacy_client: "Legacy Client",
  registered_user: "Registered User",
  billing_client: "Billing Client",
  hosting_client: "Hosting Client",
  prospect: "Prospect",
  new_customer: "New Customer",
  manual_admin_created: "Manually Added",
  website_care_customer: "Website Care Customer",
};

function accountTypeLabel(value: string | null | undefined): string {
  if (!value) return "—";
  return ACCOUNT_TYPE_LABELS[value] || value.replace(/_/g, " ").replace(/\b\w/g, (letter) => letter.toUpperCase());
}

function clientStatusPillClass(status: string | null | undefined): string {
  if (status === "active") return "status-pill paid";
  if (status === "suspended" || status === "deactivated") return "status-pill failed";
  if (status === "deleted") return "status-pill pending";
  return "status-pill pending";
}

/**
 * Shows "Admin > Section > Detail" and makes every crumb except the last
 * one clickable, so admins always have a stable way back without relying
 * solely on the browser's own back button.
 */
function AdminBreadcrumbs({ items }: { items: Array<{ label: string; onClick?: () => void }> }) {
  return (
    <nav aria-label="Breadcrumb" className="flex flex-wrap items-center gap-2 text-xs font-bold text-white/50">
      {items.map((item, index) => (
        <span key={`${item.label}-${index}`} className="flex items-center gap-2">
          {index > 0 && <span className="text-white/25">/</span>}
          {item.onClick ? (
            <button type="button" className="text-white/60 hover:text-primary" onClick={item.onClick}>
              {item.label}
            </button>
          ) : (
            <span className="text-white">{item.label}</span>
          )}
        </span>
      ))}
    </nav>
  );
}

type ServiceGroupMetrics = {
  service_type: string;
  label: string;
  active_count: number;
  suspended_count: number;
  expired_count: number;
  client_count: number;
  pending_renewals_count: number;
  due_soon_count: number;
  overdue_renewals_count: number;
  recently_activated_count: number;
  revenue_generated_kobo: number;
  revenue_generated: string;
  expected_renewal_revenue_kobo: number;
  expected_renewal_revenue: string;
};

const SERVICE_STATUS_OPTIONS = [
  "active",
  "suspended",
  "deactivated",
  "expired",
  "grace_period",
  "pending_deletion",
  "deleted_from_ispconfig",
  "cancelled",
];

function AdminServicesGroupedDashboard({
  adminToken,
  initialStatusFilter,
  onOpenService,
}: {
  adminToken: string;
  initialStatusFilter?: string;
  onOpenService: (serviceId: number) => void;
}) {
  const [groups, setGroups] = useState<ServiceGroupMetrics[] | null>(null);
  const [selectedType, setSelectedType] = useState<string | null>(null);
  const [statusFilter, setStatusFilter] = useState(initialStatusFilter || "");
  const [clientIdFilter, setClientIdFilter] = useState("");
  const [sourceFilter, setSourceFilter] = useState("");
  const [records, setRecords] = useState<LaravelPage | null>(null);
  const [isLoadingRecords, setIsLoadingRecords] = useState(false);
  const [page, setPage] = useState(1);

  useEffect(() => {
    if (!adminToken) return;
    laravelApi<{ data: ServiceGroupMetrics[] }>("/api/v1/admin/services/grouped", adminToken)
      .then((response) => setGroups(response.data))
      .catch(() => setGroups([]));
  }, [adminToken]);

  useEffect(() => {
    setPage(1);
  }, [selectedType, statusFilter, clientIdFilter, sourceFilter]);

  useEffect(() => {
    if (!adminToken) return;
    setIsLoadingRecords(true);
    const params = new URLSearchParams();
    if (selectedType) params.set("service_type", selectedType);
    if (statusFilter) params.set("status", statusFilter);
    if (clientIdFilter) params.set("client_id", clientIdFilter);
    if (sourceFilter) params.set("source", sourceFilter);
    if (page > 1) params.set("page", String(page));

    laravelApi<LaravelPage>(`/api/v1/admin/services?${params.toString()}`, adminToken)
      .then(setRecords)
      .catch(() => setRecords(null))
      .finally(() => setIsLoadingRecords(false));
  }, [adminToken, selectedType, statusFilter, clientIdFilter, sourceFilter, page]);

  const selectedLabel = groups?.find((group) => group.service_type === selectedType)?.label;
  const hasActiveFilters = Boolean(selectedType || statusFilter || clientIdFilter || sourceFilter);

  return (
    <section className="grid gap-5">
      <div>
        <h2 className="text-2xl font-black text-white">Active Services</h2>
        <p className="mt-1 text-sm text-white/58">Services grouped by type, with health and revenue at a glance. Click a group to filter the list below.</p>
      </div>

      <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
        {(groups || []).map((group) => (
          <button
            type="button"
            key={group.service_type}
            className={`admin-panel !p-4 text-left transition hover:border-primary/40 ${selectedType === group.service_type ? "border-primary/60 bg-primary/[0.04]" : ""}`}
            onClick={() => setSelectedType(selectedType === group.service_type ? null : group.service_type)}
          >
            <h3 className="text-base font-black text-white">{group.label}</h3>
            <div className="mt-3 grid grid-cols-2 gap-x-3 gap-y-1.5 text-xs text-white/60">
              <span>Active: <strong className="text-white">{group.active_count}</strong></span>
              <span>Suspended: <strong className="text-white">{group.suspended_count}</strong></span>
              <span>Expired: <strong className="text-white">{group.expired_count}</strong></span>
              <span>Clients: <strong className="text-white">{group.client_count}</strong></span>
              <span>Due soon: <strong className="text-white">{group.due_soon_count}</strong></span>
              <span>Overdue: <strong className="text-white">{group.overdue_renewals_count}</strong></span>
              <span>Pending renewals: <strong className="text-white">{group.pending_renewals_count}</strong></span>
              <span>Recently activated: <strong className="text-white">{group.recently_activated_count}</strong></span>
            </div>
            <div className="mt-3 flex items-center justify-between border-t border-white/10 pt-3 text-xs">
              <span className="text-white/60">Revenue: <strong className="text-primary">{group.revenue_generated}</strong></span>
              <span className="text-white/60">Expected: <strong className="text-white">{group.expected_renewal_revenue}</strong></span>
            </div>
          </button>
        ))}
        {!groups && <p className="text-sm text-white/50">Loading service groups...</p>}
      </div>

      <div className="admin-panel">
        <div className="flex flex-wrap items-end gap-3">
          <label className="admin-field w-full sm:w-48">
            <span>Status</span>
            <select value={statusFilter} onChange={(event) => setStatusFilter(event.target.value)}>
              <option value="">All statuses</option>
              {SERVICE_STATUS_OPTIONS.map((status) => (
                <option key={status} value={status}>{status.replace(/_/g, " ")}</option>
              ))}
            </select>
          </label>
          <label className="admin-field w-full sm:w-48">
            <span>Source</span>
            <select value={sourceFilter} onChange={(event) => setSourceFilter(event.target.value)}>
              <option value="">All sources</option>
              <option value="checkout">New (application)</option>
              <option value="ispconfig_import">Imported legacy</option>
            </select>
          </label>
          <label className="admin-field w-full sm:w-40">
            <span>Client ID</span>
            <input type="number" min={1} value={clientIdFilter} onChange={(event) => setClientIdFilter(event.target.value)} placeholder="e.g. 12" />
          </label>
          {hasActiveFilters && (
            <button
              type="button"
              className="btn-outline"
              onClick={() => {
                setSelectedType(null);
                setStatusFilter("");
                setClientIdFilter("");
                setSourceFilter("");
              }}
            >
              Clear filters
            </button>
          )}
        </div>
      </div>

      <AdminRecordsSection
        title={selectedLabel ? `${selectedLabel} services` : "All Services"}
        description="Click a row to view service details and lifecycle actions."
        records={records}
        isLoading={isLoadingRecords}
        onRowClick={(row) => onOpenService(Number(row.id))}
        page={page}
        onPageChange={setPage}
      />
    </section>
  );
}

function AdminDashboardOverview({
  data,
  isLoading,
  onNavigate,
}: {
  data: AdminDashboardSnapshot | null;
  isLoading: boolean;
  onNavigate?: (section: string) => void;
}) {
  const dashboardMetrics = data?.metrics?.length
    ? data.metrics.map((metric, index) => ({
        ...metric,
        delta: metric.amount || (typeof metric.raw === "number" ? `${metric.raw}` : "Live"),
        icon: adminMetrics[index]?.icon || BarChart3,
        tone: adminMetrics[index]?.tone || "lime",
      }))
    : adminMetrics.map((metric) => ({ ...metric, value: "—", delta: "No data yet" }));
  const renewals = data?.upcoming_renewals?.length ? data.upcoming_renewals : null;
  const payments = data?.recent_payments?.length ? data.recent_payments : null;
  const invoices = data?.invoice_overview?.length ? data.invoice_overview : null;
  const topServices = data?.top_services?.length ? data.top_services : null;
  const systemStatus = data?.system_status?.length ? data.system_status : null;
  const recentOrders = data?.recent_orders?.length ? data.recent_orders : null;
  const totalInvoices = invoices ? invoices.reduce((sum, item) => sum + (item.count || 0), 0) : 0;

  return (
    <section className="grid gap-5">
      <div className="flex flex-col gap-4 lg:flex-row lg:items-end lg:justify-between">
        <div>
          <h2 className="text-3xl font-black text-white">Dashboard</h2>
          <p className="mt-2 text-sm text-white/58">
            {isLoading ? "Loading live Laravel dashboard data..." : "Live data from the Laravel billing engine."}
          </p>
        </div>
        <div className="flex flex-col gap-3 sm:flex-row">
          <button type="button" className="btn-outline justify-center">Jun 1 - Jun 30, 2026</button>
          <button type="button" className="btn-primary justify-center">Export report</button>
        </div>
      </div>

      <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-6">
        {dashboardMetrics.map((metric) => {
          const Icon = metric.icon;
          const targetSection = metric.label === "Active Services" ? "services" : metric.label === "New Clients" ? "clients" : null;
          const isClickable = Boolean(onNavigate && targetSection);
          return (
            <article
              key={metric.label}
              className={`metric-card tone-${metric.tone} ${isClickable ? "cursor-pointer transition hover:-translate-y-0.5 hover:border-primary/40" : ""}`}
              role={isClickable ? "button" : undefined}
              tabIndex={isClickable ? 0 : undefined}
              onClick={isClickable ? () => onNavigate?.(targetSection as string) : undefined}
              onKeyDown={
                isClickable
                  ? (event) => {
                      if (event.key === "Enter" || event.key === " ") {
                        event.preventDefault();
                        onNavigate?.(targetSection as string);
                      }
                    }
                  : undefined
              }
            >
              <div className="metric-icon"><Icon className="h-5 w-5" /></div>
              <p className="mt-4 text-xs text-white/58">{metric.label}</p>
              <h3 className="mt-2 text-2xl font-black text-white">{metric.value}</h3>
              <p className="mt-2 text-xs text-primary">{metric.delta}</p>
            </article>
          );
        })}
      </div>

      <div className="grid gap-5 xl:grid-cols-[1.15fr_0.95fr_1.1fr]">
        <article className="dashboard-card">
          <div className="flex items-center justify-between">
            <h3>Revenue Overview</h3>
            <span>This year</span>
          </div>
          <div className="revenue-chart" aria-hidden="true">
            <svg viewBox="0 0 520 240" role="img">
              <defs>
                <linearGradient id="revenueFill" x1="0" x2="0" y1="0" y2="1">
                  <stop offset="0%" stopColor="#9bea16" stopOpacity="0.45" />
                  <stop offset="100%" stopColor="#9bea16" stopOpacity="0.02" />
                </linearGradient>
              </defs>
              <path d="M16 196 C70 154, 90 88, 132 105 C178 123, 188 155, 232 142 C276 129, 285 91, 326 119 C368 146, 390 110, 426 100 C462 90, 486 112, 504 65 L504 220 L16 220 Z" fill="url(#revenueFill)" />
              <path d="M16 196 C70 154, 90 88, 132 105 C178 123, 188 155, 232 142 C276 129, 285 91, 326 119 C368 146, 390 110, 426 100 C462 90, 486 112, 504 65" fill="none" stroke="#9bea16" strokeWidth="5" strokeLinecap="round" />
            </svg>
          </div>
        </article>

        <article className="dashboard-card">
          <div className="flex items-center justify-between">
            <h3>Upcoming Renewals</h3>
            <span>View all</span>
          </div>
          <div className="mt-4 grid gap-3">
            {renewals ? renewals.map((renewal) => (
              <div key={renewal.service_number} className="data-row">
                <div className="row-icon"><Globe2 className="h-4 w-4" /></div>
                <div className="min-w-0 flex-1">
                  <p>{renewal.primary_domain || renewal.client || renewal.service_number}</p>
                  <small>{renewal.plan || renewal.status}</small>
                </div>
                <small>{renewal.renews_at ? formatDate(renewal.renews_at) : "No date"}</small>
                <strong>{renewal.status}</strong>
              </div>
            )) : <p className="text-sm text-white/40">No upcoming renewals.</p>}
          </div>
        </article>

        <article className="dashboard-card">
          <div className="flex items-center justify-between">
            <h3>Recent Payments</h3>
            <span>View all</span>
          </div>
          <div className="mt-4 grid gap-3">
            {payments ? payments.map((payment) => (
              <div key={`${payment.invoice_number}-${payment.amount}`} className="data-row">
                <div className="avatar-initial">{(payment.client || "C").charAt(0)}</div>
                <div className="min-w-0 flex-1">
                  <p>{payment.client || "Client"}</p>
                  <small>{payment.invoice_number || payment.gateway}</small>
                </div>
                <span className={payment.status === "paid" ? "status-pill paid" : "status-pill failed"}>{payment.status}</span>
                <div className="text-right">
                  <strong>{payment.amount}</strong>
                  <small className="block">{payment.paid_at ? formatDate(payment.paid_at) : ""}</small>
                </div>
              </div>
            )) : <p className="text-sm text-white/40">No recent payments yet.</p>}
          </div>
        </article>
      </div>

      <div className="grid gap-5 xl:grid-cols-[0.9fr_1fr_1.1fr]">
        <article className="dashboard-card">
          <h3>Invoices Overview</h3>
          <div className="donut-wrap">
            <div className="donut-chart"><span>{totalInvoices}<small>Total</small></span></div>
            <div className="grid gap-2 text-sm text-white/64">
              {invoices ? invoices.map((item) => (
                <p key={item.status}>{item.status}: {item.count}</p>
              )) : <p className="text-white/40">No invoice data yet.</p>}
            </div>
          </div>
        </article>
        <article className="dashboard-card">
          <h3>Top Services</h3>
          <div className="mt-5 grid gap-4">
            {topServices ? topServices.map((service, index) => (
              <div key={service.name} className="service-meter">
                <span>{service.name}</span>
                <div><i style={{ width: `${Math.max(18, 88 - index * 14)}%` }} /></div>
                <strong>{service.count}</strong>
              </div>
            )) : <p className="text-sm text-white/40">No service data yet.</p>}
          </div>
        </article>
        <article className="dashboard-card">
          <h3>System Status</h3>
          <div className="mt-5 grid gap-4">
            {systemStatus ? systemStatus.map((item) => (
              <div key={item.name} className="system-row">
                <span>{item.name}</span>
                <strong>{item.status}</strong>
              </div>
            )) : <p className="text-sm text-white/40">No system status data yet.</p>}
          </div>
        </article>
      </div>

      <article className="dashboard-card overflow-x-auto">
        <div className="flex items-center justify-between">
          <h3>Recent Orders</h3>
          <span>View all</span>
        </div>
        <table className="admin-table">
          <thead>
            <tr>
              <th>Order #</th>
              <th>Client</th>
              <th>Service</th>
              <th>Amount</th>
              <th>Status</th>
              <th>Date</th>
              <th></th>
            </tr>
          </thead>
          <tbody>
            {recentOrders ? recentOrders.map((order) => (
              <tr key={order.order_number}>
                <td>{order.order_number}</td>
                <td>{order.client || "Client"}</td>
                <td>{order.billing_cycle} hosting</td>
                <td>{order.total}</td>
                <td><span className={order.status === "completed" ? "status-pill paid" : "status-pill pending"}>{order.status}</span></td>
                <td>{formatDate(order.created_at)}</td>
                <td><MoreVertical className="h-4 w-4" /></td>
              </tr>
            )) : (
              <tr>
                <td colSpan={7} className="text-center text-white/40">No recent orders yet.</td>
              </tr>
            )}
          </tbody>
        </table>
      </article>
    </section>
  );
}

type AdminRecordFilterDef = {
  key: string;
  label: string;
  type?: "select" | "text";
  options?: Array<{ value: string; label: string }>;
  placeholder?: string;
};

function AdminRecordsSection({
  title,
  description,
  records,
  isLoading,
  renderRowActions,
  onRowClick,
  filters,
  filterValues,
  onFilterChange,
  onClearFilters,
  page = 1,
  onPageChange,
}: {
  title: string;
  description: string;
  records: LaravelPage | null;
  isLoading: boolean;
  renderRowActions?: (row: Record<string, unknown>) => React.ReactNode;
  onRowClick?: (row: Record<string, unknown>) => void;
  filters?: AdminRecordFilterDef[];
  filterValues?: Record<string, string>;
  onFilterChange?: (key: string, value: string) => void;
  onClearFilters?: () => void;
  page?: number;
  onPageChange?: (page: number) => void;
}) {
  const rows = records?.data || [];
  const columns = rows[0] ? Object.keys(rows[0]).filter((key) => !["links", "meta", "user_id"].includes(key)).slice(0, 7) : [];
  const lastPage = records?.meta?.last_page ?? 1;
  const total = records?.meta?.total ?? rows.length;
  const hasActiveFilters = Boolean(filterValues && Object.values(filterValues).some((value) => value));

  const renderValue = (value: unknown): string => {
    if (value === null || value === undefined) return "";
    if (typeof value === "string" && ISO_DATE_PATTERN.test(value)) {
      return value.length > 10 ? formatDateTime(value) : formatDate(value);
    }
    if (typeof value === "string" || typeof value === "number" || typeof value === "boolean") return String(value);
    if (Array.isArray(value)) return `${value.length} item${value.length === 1 ? "" : "s"}`;
    if (typeof value === "object") {
      const objectValue = value as Record<string, unknown>;
      if (typeof objectValue.name === "string") return objectValue.name;
      if (typeof objectValue.email === "string") return objectValue.email;
      if (typeof objectValue.invoice_number === "string") return objectValue.invoice_number;
      return "View details";
    }
    return String(value);
  };

  return (
    <section className="admin-panel">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <h2 className="text-2xl font-black">{title}</h2>
          <p className="mt-1 text-sm text-white/55">{description}</p>
        </div>
        <span className="rounded-full border border-primary/20 bg-primary/10 px-3 py-1 text-xs font-black text-primary">
          {total} records
        </span>
      </div>

      {filters && filters.length > 0 && (
        <div className="mt-5 flex flex-wrap items-end gap-3 border-t border-white/10 pt-5">
          {filters.map((filter) => (
            <label key={filter.key} className="admin-field w-full sm:w-48">
              <span>{filter.label}</span>
              {filter.type === "text" ? (
                <input
                  value={filterValues?.[filter.key] || ""}
                  placeholder={filter.placeholder}
                  onChange={(event) => onFilterChange?.(filter.key, event.target.value)}
                />
              ) : (
                <select value={filterValues?.[filter.key] || ""} onChange={(event) => onFilterChange?.(filter.key, event.target.value)}>
                  <option value="">All</option>
                  {(filter.options || []).map((option) => (
                    <option key={option.value} value={option.value}>{option.label}</option>
                  ))}
                </select>
              )}
            </label>
          ))}
          {hasActiveFilters && (
            <button type="button" className="btn-outline !min-h-11" onClick={onClearFilters}>
              Clear filters
            </button>
          )}
        </div>
      )}

      <div className="mt-6 overflow-x-auto">
        {isLoading ? (
          <div className="rounded-lg border border-white/10 bg-black/20 p-6 text-sm font-bold text-white/60">Loading Laravel records...</div>
        ) : rows.length ? (
          <table className="admin-table">
            <thead>
              <tr>
                {columns.map((column) => (
                  <th key={column}>{column.replaceAll("_", " ")}</th>
                ))}
                {(renderRowActions || onRowClick) && <th></th>}
              </tr>
            </thead>
            <tbody>
              {rows.map((row, index) => {
                const typedRow = row as Record<string, unknown>;
                return (
                  <tr
                    key={String(typedRow.id || index)}
                    className={onRowClick ? "cursor-pointer hover:bg-white/5" : undefined}
                    onClick={onRowClick ? () => onRowClick(typedRow) : undefined}
                  >
                    {columns.map((column) => (
                      <td key={column}>{renderValue(typedRow[column])}</td>
                    ))}
                    {(renderRowActions || onRowClick) && (
                      <td>{renderRowActions ? renderRowActions(typedRow) : null}</td>
                    )}
                  </tr>
                );
              })}
            </tbody>
          </table>
        ) : (
          <div className="rounded-lg border border-white/10 bg-black/20 p-6 text-sm font-bold text-white/60">No records found.</div>
        )}
      </div>

      {onPageChange && lastPage > 1 && (
        <div className="mt-5 flex items-center justify-between gap-3 border-t border-white/10 pt-5 text-xs font-bold text-white/55">
          <button type="button" className="btn-outline !min-h-9 !px-3 !text-[11px]" disabled={page <= 1 || isLoading} onClick={() => onPageChange(page - 1)}>
            Previous
          </button>
          <span>Page {page} of {lastPage}</span>
          <button type="button" className="btn-outline !min-h-9 !px-3 !text-[11px]" disabled={page >= lastPage || isLoading} onClick={() => onPageChange(page + 1)}>
            Next
          </button>
        </div>
      )}
    </section>
  );
}

type LegacyImportSiteResult = {
  domain: string | null;
  action: string;
  suggested_renewal_date: string | null;
  manual_renewal_date_required: boolean;
};

type LegacyImportClientResult = {
  ispconfig_client_id: string | null;
  client_id?: number | null;
  client_name: string | null;
  import_status: string;
  websites?: string[];
  email_accounts_count?: number;
  databases_count?: number;
  ispconfig_created_at?: string | null;
  suggested_renewal_date?: string | null;
  renewal_amount?: string;
  manual_renewal_date_required?: boolean;
  sites?: LegacyImportSiteResult[];
  reason?: string;
};

type LegacyImportResult = {
  dry_run: boolean;
  clients: LegacyImportClientResult[];
};

const LEGACY_IMPORT_STATUS_LABELS: Record<string, string> = {
  imported_client: "New client imported",
  linked_existing_client: "Linked to existing client",
  failed: "Failed",
};

/**
 * Admin-triggered mirror of ISPConfig's existing clients/websites/mailboxes/
 * databases into NAITALK under the hidden "Legacy Hosting + SSL" package.
 * Always preview (dry run) before running for real — the backend guarantees
 * the import itself never calls any ISPConfig write method.
 */
function AdminIspConfigImportPanel({ adminToken }: { adminToken: string }) {
  const [result, setResult] = useState<LegacyImportResult | null>(null);
  const [isPreviewing, setIsPreviewing] = useState(false);
  const [isRunning, setIsRunning] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [hasRunImport, setHasRunImport] = useState(false);

  const runPreview = async () => {
    setIsPreviewing(true);
    setError(null);
    try {
      const data = await laravelApi<LegacyImportResult>("/api/v1/admin/ispconfig/legacy-import/preview", adminToken, { method: "POST" });
      setResult(data);
      setHasRunImport(false);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Preview failed");
    } finally {
      setIsPreviewing(false);
    }
  };

  const runImport = async () => {
    if (!window.confirm("This will import ISPConfig clients, websites, mailboxes and databases into NAITALK. Continue?")) return;

    setIsRunning(true);
    setError(null);
    try {
      const data = await laravelApi<LegacyImportResult>("/api/v1/admin/ispconfig/legacy-import/run", adminToken, {
        method: "POST",
        body: JSON.stringify({ dry_run: false }),
      });
      setResult(data);
      setHasRunImport(true);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Import failed");
    } finally {
      setIsRunning(false);
    }
  };

  const totals = useMemo(() => {
    if (!result) return null;
    const clients = result.clients;
    return {
      total: clients.length,
      imported: clients.filter((client) => client.import_status === "imported_client").length,
      linked: clients.filter((client) => client.import_status === "linked_existing_client").length,
      failed: clients.filter((client) => client.import_status === "failed").length,
      websites: clients.reduce((sum, client) => sum + (client.websites?.length || 0), 0),
      mailboxes: clients.reduce((sum, client) => sum + (client.email_accounts_count || 0), 0),
      databases: clients.reduce((sum, client) => sum + (client.databases_count || 0), 0),
      manualRenewalNeeded: clients.filter((client) => client.manual_renewal_date_required).length,
    };
  }, [result]);

  return (
    <section className="admin-panel">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <h2 className="text-2xl font-black">ISPConfig Legacy Import</h2>
          <p className="mt-1 text-sm text-white/55">
            Pulls existing clients, websites, mailboxes and databases out of ISPConfig and mirrors them into
            NAITALK under the hidden "Legacy Hosting + SSL" package. Never writes back to ISPConfig.
          </p>
        </div>
        <div className="flex gap-2">
          <button type="button" className="btn-outline !min-h-10 !px-4 !py-2 !text-xs" disabled={isPreviewing || isRunning} onClick={() => void runPreview()}>
            {isPreviewing ? "Previewing..." : "Preview Import"}
          </button>
          <button type="button" className="btn-primary !min-h-10 !px-4 !py-2 !text-xs" disabled={isPreviewing || isRunning} onClick={() => void runImport()}>
            {isRunning ? "Importing..." : "Run Import"}
          </button>
        </div>
      </div>

      {error && <p className="form-message error mt-4">{error}</p>}

      {result && totals && (
        <>
          <div className={`mt-5 rounded-lg border p-3 text-xs font-bold ${hasRunImport ? "border-primary/30 bg-primary/10 text-primary" : "border-white/10 bg-black/20 text-white/60"}`}>
            {hasRunImport ? "Import completed — changes were written to the NAITALK database." : "Preview only — nothing has been written yet. Run the import when this looks right."}
          </div>

          <div className="mt-4 grid grid-cols-2 gap-3 sm:grid-cols-4 lg:grid-cols-7">
            {[
              ["Clients", totals.total],
              ["New", totals.imported],
              ["Linked", totals.linked],
              ["Failed", totals.failed],
              ["Websites", totals.websites],
              ["Mailboxes", totals.mailboxes],
              ["Manual renewal", totals.manualRenewalNeeded],
            ].map(([label, value]) => (
              <div key={label} className="rounded-lg border border-white/10 bg-black/20 p-3">
                <p className="text-[10px] uppercase tracking-wide text-white/50">{label}</p>
                <p className="text-lg font-black text-white">{value}</p>
              </div>
            ))}
          </div>

          <div className="mt-6 overflow-x-auto">
            <table className="admin-table">
              <thead>
                <tr>
                  <th>ISPConfig ID</th>
                  <th>Client</th>
                  <th>Status</th>
                  <th>Websites</th>
                  <th>Emails</th>
                  <th>Databases</th>
                  <th>Renewal date</th>
                </tr>
              </thead>
              <tbody>
                {result.clients.map((client, index) => (
                  <tr key={`${client.ispconfig_client_id || "unknown"}-${index}`}>
                    <td>{client.ispconfig_client_id || "—"}</td>
                    <td>{client.client_name || "—"}</td>
                    <td>
                      {LEGACY_IMPORT_STATUS_LABELS[client.import_status] || client.import_status}
                      {client.reason && <span className="block text-[11px] text-white/45">{client.reason}</span>}
                    </td>
                    <td>{client.websites?.length ?? 0}</td>
                    <td>{client.email_accounts_count ?? 0}</td>
                    <td>{client.databases_count ?? 0}</td>
                    <td>
                      {client.suggested_renewal_date ? (
                        formatDate(client.suggested_renewal_date)
                      ) : client.manual_renewal_date_required ? (
                        <span className="text-amber-400">Manual required</span>
                      ) : (
                        "—"
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </>
      )}

      {!result && !isPreviewing && (
        <div className="mt-6 rounded-lg border border-white/10 bg-black/20 p-6 text-sm font-bold text-white/60">
          Run a preview first to see what would be imported before writing any changes.
        </div>
      )}
    </section>
  );
}

type AdminClientDetail = {
  id: number;
  company_name: string | null;
  account_type: string;
  client_status: string;
  billing_email: string | null;
  billing_phone: string | null;
  suspended_at: string | null;
  deactivated_at: string | null;
  deleted_at: string | null;
  created_at: string;
  total_revenue_kobo: number | null;
  user?: { id: number; name: string; email: string; phone?: string | null } | null;
  hosting_services?: Array<Record<string, any>>;
  invoices?: Array<Record<string, any>>;
  payments?: Array<Record<string, any>>;
  audit_logs?: Array<Record<string, any>>;
  notification_logs?: Array<Record<string, any>>;
};

/**
 * /admin/clients/:id — replaces the old "click a row to impersonate
 * immediately" behaviour with a full management page: account info,
 * services, invoices, action log, and the suspend/deactivate/delete/
 * restore actions (each gated by the required reason form except restore,
 * which the backend doesn't treat as destructive).
 */
function ClientDetailPage({
  clientId,
  adminToken,
  onBack,
  onOpenService,
  onImpersonate,
  impersonatingClientId,
}: {
  clientId: number;
  adminToken: string;
  onBack: () => void;
  onOpenService: (serviceId: number) => void;
  onImpersonate: (clientId: number) => void;
  impersonatingClientId: number | null;
}) {
  const [client, setClient] = useState<AdminClientDetail | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [activeModal, setActiveModal] = useState<"suspend" | "deactivate" | "delete" | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [actionError, setActionError] = useState<string | null>(null);
  const [message, setMessage] = useState("");

  const load = () => {
    setIsLoading(true);
    laravelApi<AdminClientDetail>(`/api/v1/admin/clients/${clientId}`, adminToken)
      .then(setClient)
      .catch(() => setClient(null))
      .finally(() => setIsLoading(false));
  };

  useEffect(() => {
    load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [clientId, adminToken]);

  const runAction = async (path: string, method: string, payload?: Record<string, unknown>) => {
    setIsSubmitting(true);
    setActionError(null);
    try {
      await laravelApi(`/api/v1/admin${path}`, adminToken, {
        method,
        body: payload ? JSON.stringify(payload) : undefined,
      });
      setActiveModal(null);
      setMessage("Action completed.");
      load();
    } catch (error) {
      setActionError(error instanceof Error ? error.message : "Action failed.");
    } finally {
      setIsSubmitting(false);
    }
  };

  if (isLoading) {
    return <p className="text-sm text-white/50">Loading client...</p>;
  }

  if (!client) {
    return (
      <section className="admin-panel">
        <p className="text-sm text-white/60">Client not found.</p>
        <button type="button" className="btn-outline mt-4" onClick={onBack}>Back to Clients</button>
      </section>
    );
  }

  const isDeleted = Boolean(client.deleted_at);
  const services = client.hosting_services || [];

  return (
    <section className="grid gap-5">
      <AdminBreadcrumbs
        items={[
          { label: "Clients", onClick: onBack },
          { label: client.company_name || client.user?.name || `Client #${client.id}` },
        ]}
      />

      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h2 className="text-2xl font-black text-white">{client.company_name || client.user?.name || `Client #${client.id}`}</h2>
          <p className="mt-1 text-sm text-white/58">{client.user?.email || client.billing_email}</p>
        </div>
        <button type="button" className="btn-outline" onClick={onBack}>← Back</button>
      </div>

      {message && <p className="form-message success">{message}</p>}
      {isDeleted && <p className="form-message error">This client has been soft-deleted. Restore it to resume normal management.</p>}

      <div className="grid gap-4 md:grid-cols-4">
        <div className="admin-panel !p-4"><p className="text-xs text-white/50">Account Type</p><p className="mt-1 font-black text-white">{accountTypeLabel(client.account_type)}</p></div>
        <div className="admin-panel !p-4"><p className="text-xs text-white/50">Status</p><p className="mt-1"><span className={clientStatusPillClass(client.client_status)}>{client.client_status}</span></p></div>
        <div className="admin-panel !p-4"><p className="text-xs text-white/50">Active Services</p><p className="mt-1 font-black text-white">{services.filter((service) => service.status === "active").length}</p></div>
        <div className="admin-panel !p-4"><p className="text-xs text-white/50">Total Revenue</p><p className="mt-1 font-black text-primary">{formatKobo(client.total_revenue_kobo)}</p></div>
      </div>

      <div className="admin-panel">
        <h3 className="text-lg font-black text-white">Actions</h3>
        <div className="mt-3 flex flex-wrap gap-3">
          {isDeleted ? (
            <button type="button" className="btn-primary" disabled={isSubmitting} onClick={() => runAction(`/clients/${clientId}/restore`, "POST", {})}>
              {isSubmitting ? "Restoring..." : "Restore Client"}
            </button>
          ) : (
            <>
              <button type="button" className="btn-outline" disabled={impersonatingClientId === client.id} onClick={() => onImpersonate(client.id)}>
                {impersonatingClientId === client.id ? "Entering..." : "Enter as Client"}
              </button>
              <button type="button" className="btn-outline" onClick={() => setActiveModal("suspend")}>Suspend Account</button>
              <button type="button" className="btn-outline" onClick={() => setActiveModal("deactivate")}>Deactivate Account</button>
              <button type="button" className="btn-outline !border-accent-rose/40 !text-accent-rose" onClick={() => setActiveModal("delete")}>Soft-Delete Client</button>
            </>
          )}
        </div>
      </div>

      <section className="admin-panel overflow-x-auto">
        <h3 className="text-lg font-black text-white">Hosting Services</h3>
        <table className="admin-table mt-4">
          <thead><tr><th>Domain</th><th>Plan</th><th>Type</th><th>Status</th><th>Renews</th><th></th></tr></thead>
          <tbody>
            {services.map((service) => (
              <tr key={service.id} className="cursor-pointer hover:bg-white/5" onClick={() => onOpenService(Number(service.id))}>
                <td>{service.primary_domain || service.service_number}</td>
                <td>{service.hosting_plan?.name || "—"}</td>
                <td>{String(service.service_type || "hosting").replace(/_/g, " ")}</td>
                <td>{service.status}</td>
                <td>{formatDate(service.renews_at)}</td>
                <td><span className="text-xs font-bold text-primary">View →</span></td>
              </tr>
            ))}
            {services.length === 0 && <tr><td colSpan={6} className="text-white/50">No hosting services.</td></tr>}
          </tbody>
        </table>
      </section>

      <section className="admin-panel overflow-x-auto">
        <h3 className="text-lg font-black text-white">Invoices</h3>
        <table className="admin-table mt-4">
          <thead><tr><th>Invoice #</th><th>Status</th><th>Total</th><th>Issued</th></tr></thead>
          <tbody>
            {(client.invoices || []).map((invoice) => (
              <tr key={invoice.id}>
                <td>{invoice.invoice_number}</td>
                <td>{invoice.status}</td>
                <td>{formatKobo(invoice.total_kobo)}</td>
                <td>{formatDate(invoice.issued_at)}</td>
              </tr>
            ))}
            {(client.invoices || []).length === 0 && <tr><td colSpan={4} className="text-white/50">No invoices.</td></tr>}
          </tbody>
        </table>
      </section>

      <section className="admin-panel overflow-x-auto">
        <h3 className="text-lg font-black text-white">Action Log</h3>
        <table className="admin-table mt-4">
          <thead><tr><th>Action</th><th>Reason</th><th>Source</th><th>When</th></tr></thead>
          <tbody>
            {(client.audit_logs || []).map((log) => (
              <tr key={log.id}>
                <td>{log.action}</td>
                <td>{log.reason_category ? `${log.reason_category}: ${log.reason || ""}` : log.reason || "—"}</td>
                <td>{log.source || "admin"}</td>
                <td>{formatDateTime(log.created_at)}</td>
              </tr>
            ))}
            {(client.audit_logs || []).length === 0 && <tr><td colSpan={4} className="text-white/50">No actions logged yet.</td></tr>}
          </tbody>
        </table>
      </section>

      {activeModal === "suspend" && (
        <ReasonFormModal
          title="Suspend Client Account"
          actionLabel="Suspend Account"
          isSubmitting={isSubmitting}
          error={actionError}
          onClose={() => { setActiveModal(null); setActionError(null); }}
          onSubmit={(payload) => runAction(`/clients/${clientId}/suspend`, "POST", payload)}
        />
      )}
      {activeModal === "deactivate" && (
        <ReasonFormModal
          title="Deactivate Client Account"
          actionLabel="Deactivate Account"
          isSubmitting={isSubmitting}
          error={actionError}
          onClose={() => { setActiveModal(null); setActionError(null); }}
          onSubmit={(payload) => runAction(`/clients/${clientId}/deactivate`, "POST", payload)}
        />
      )}
      {activeModal === "delete" && (
        <ReasonFormModal
          title="Soft-Delete Client"
          actionLabel="Soft-Delete Client"
          isSubmitting={isSubmitting}
          error={actionError}
          onClose={() => { setActiveModal(null); setActionError(null); }}
          onSubmit={(payload) => runAction(`/clients/${clientId}`, "DELETE", payload)}
        />
      )}
    </section>
  );
}

type AdminServiceDetail = {
  id: number;
  service_number: string;
  primary_domain: string | null;
  status: string;
  service_type: string;
  source: string;
  renews_at: string | null;
  grace_period_ends_at: string | null;
  scheduled_deletion_at: string | null;
  is_security_action: boolean;
  deleted_at: string | null;
  client?: { id: number; company_name: string | null; user?: { name: string; email: string } | null } | null;
  hosting_plan?: { id: number; name: string } | null;
  mailbox_records?: Array<Record<string, any>>;
  database_records?: Array<Record<string, any>>;
  audit_logs?: Array<Record<string, any>>;
};

/**
 * /admin/services/:id — service-level lifecycle actions (suspend, deactivate
 * website hosting in ISPConfig, reactivate, soft-delete, schedule automatic
 * deletion, override the grace period). Every destructive action is gated
 * behind the same required reason form as the client-level actions.
 */
function ServiceDetailPanel({
  serviceId,
  adminToken,
  onBack,
  onOpenClient,
}: {
  serviceId: number;
  adminToken: string;
  onBack: () => void;
  onOpenClient: (clientId: number) => void;
}) {
  const [service, setService] = useState<AdminServiceDetail | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [activeModal, setActiveModal] = useState<"suspend" | "deactivate" | "reactivate" | "delete" | "schedule" | "grace" | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [actionError, setActionError] = useState<string | null>(null);
  const [message, setMessage] = useState("");
  const [dateFieldValue, setDateFieldValue] = useState("");

  const load = () => {
    setIsLoading(true);
    laravelApi<AdminServiceDetail>(`/api/v1/admin/services/${serviceId}`, adminToken)
      .then(setService)
      .catch(() => setService(null))
      .finally(() => setIsLoading(false));
  };

  useEffect(() => {
    load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [serviceId, adminToken]);

  const runAction = async (path: string, method: string, payload?: Record<string, unknown>) => {
    setIsSubmitting(true);
    setActionError(null);
    try {
      await laravelApi(`/api/v1/admin${path}`, adminToken, {
        method,
        body: payload ? JSON.stringify(payload) : undefined,
      });
      setActiveModal(null);
      setMessage("Action completed.");
      load();
    } catch (error) {
      setActionError(error instanceof Error ? error.message : "Action failed.");
    } finally {
      setIsSubmitting(false);
    }
  };

  if (isLoading) {
    return <p className="text-sm text-white/50">Loading service...</p>;
  }

  if (!service) {
    return (
      <section className="admin-panel">
        <p className="text-sm text-white/60">Service not found.</p>
        <button type="button" className="btn-outline mt-4" onClick={onBack}>Back to Services</button>
      </section>
    );
  }

  const isDeleted = Boolean(service.deleted_at);
  const label = service.primary_domain || service.service_number;

  return (
    <section className="grid gap-5">
      <AdminBreadcrumbs items={[{ label: "Services", onClick: onBack }, { label }]} />

      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h2 className="text-2xl font-black text-white">{label}</h2>
          <p className="mt-1 text-sm text-white/58">
            {service.client?.company_name || service.client?.user?.name || "Unknown client"} · {String(service.service_type || "hosting").replace(/_/g, " ")}
          </p>
        </div>
        <button type="button" className="btn-outline" onClick={onBack}>← Back</button>
      </div>

      {message && <p className="form-message success">{message}</p>}
      {service.is_security_action && <p className="form-message error">This service was deactivated as a security action.</p>}

      <div className="grid gap-4 md:grid-cols-4">
        <div className="admin-panel !p-4"><p className="text-xs text-white/50">Status</p><p className="mt-1 font-black text-white">{service.status}</p></div>
        <div className="admin-panel !p-4"><p className="text-xs text-white/50">Renews</p><p className="mt-1 font-black text-white">{formatDate(service.renews_at)}</p></div>
        <div className="admin-panel !p-4"><p className="text-xs text-white/50">Grace period ends</p><p className="mt-1 font-black text-white">{formatDate(service.grace_period_ends_at)}</p></div>
        <div className="admin-panel !p-4"><p className="text-xs text-white/50">Scheduled deletion</p><p className="mt-1 font-black text-white">{formatDate(service.scheduled_deletion_at)}</p></div>
      </div>

      <div className="admin-panel">
        <h3 className="text-lg font-black text-white">Actions</h3>
        <div className="mt-3 flex flex-wrap gap-3">
          {isDeleted ? (
            <p className="text-sm text-white/50">This service has been soft-deleted.</p>
          ) : (
            <>
              {service.client && (
                <button type="button" className="btn-outline" onClick={() => onOpenClient(service.client!.id)}>View Client</button>
              )}
              {service.status === "active" ? (
                <>
                  <button type="button" className="btn-outline" onClick={() => setActiveModal("suspend")}>Suspend Service</button>
                  <button type="button" className="btn-outline" onClick={() => setActiveModal("deactivate")}>Deactivate Website Hosting</button>
                </>
              ) : (
                !["deleted_from_ispconfig", "cancelled"].includes(service.status) && (
                  <button type="button" className="btn-outline" onClick={() => setActiveModal("reactivate")}>Reactivate Website Hosting</button>
                )
              )}
              <button type="button" className="btn-outline" onClick={() => { setDateFieldValue(toDateInputValue(service.grace_period_ends_at)); setActiveModal("grace"); }}>Override Grace Period</button>
              <button type="button" className="btn-outline" onClick={() => { setDateFieldValue(toDateInputValue(service.scheduled_deletion_at)); setActiveModal("schedule"); }}>Schedule Deletion</button>
              <button type="button" className="btn-outline !border-accent-rose/40 !text-accent-rose" onClick={() => setActiveModal("delete")}>Delete Service</button>
            </>
          )}
        </div>
      </div>

      <section className="admin-panel overflow-x-auto">
        <h3 className="text-lg font-black text-white">Action Log</h3>
        <table className="admin-table mt-4">
          <thead><tr><th>Action</th><th>Reason</th><th>Source</th><th>When</th></tr></thead>
          <tbody>
            {(service.audit_logs || []).map((log) => (
              <tr key={log.id}>
                <td>{log.action}</td>
                <td>{log.reason_category ? `${log.reason_category}: ${log.reason || ""}` : log.reason || "—"}</td>
                <td>{log.source || "admin"}</td>
                <td>{formatDateTime(log.created_at)}</td>
              </tr>
            ))}
            {(service.audit_logs || []).length === 0 && <tr><td colSpan={4} className="text-white/50">No actions logged yet.</td></tr>}
          </tbody>
        </table>
      </section>

      {activeModal === "suspend" && (
        <ReasonFormModal
          title="Suspend Service"
          actionLabel="Suspend Service"
          isSubmitting={isSubmitting}
          error={actionError}
          onClose={() => { setActiveModal(null); setActionError(null); }}
          onSubmit={(payload) => runAction(`/services/${serviceId}/suspend`, "POST", payload)}
        />
      )}
      {activeModal === "deactivate" && (
        <ReasonFormModal
          title="Deactivate Website Hosting"
          actionLabel="Deactivate Website"
          isSubmitting={isSubmitting}
          error={actionError}
          onClose={() => { setActiveModal(null); setActionError(null); }}
          onSubmit={(payload) => runAction(`/services/${serviceId}/deactivate-website`, "POST", payload)}
        >
          {({ extra, setExtra }) => (
            <label className="flex items-center gap-2 text-sm text-white/70">
              <input type="checkbox" checked={Boolean(extra.is_security_action)} onChange={(event) => setExtra("is_security_action", event.target.checked)} />
              This is a security-related emergency deactivation (malware, abuse, server risk...)
            </label>
          )}
        </ReasonFormModal>
      )}
      {activeModal === "reactivate" && (
        <ReasonFormModal
          title="Reactivate Website Hosting"
          actionLabel="Reactivate Website"
          isSubmitting={isSubmitting}
          error={actionError}
          onClose={() => { setActiveModal(null); setActionError(null); }}
          onSubmit={(payload) => runAction(`/services/${serviceId}/reactivate-website`, "POST", payload)}
        />
      )}
      {activeModal === "delete" && (
        <ReasonFormModal
          title="Delete Service"
          actionLabel="Delete Service"
          isSubmitting={isSubmitting}
          error={actionError}
          onClose={() => { setActiveModal(null); setActionError(null); }}
          onSubmit={(payload) => runAction(`/services/${serviceId}`, "DELETE", payload)}
        />
      )}
      {activeModal === "grace" && (
        <ReasonFormModal
          title="Override Grace Period"
          actionLabel="Save Grace Period"
          isSubmitting={isSubmitting}
          error={actionError}
          onClose={() => { setActiveModal(null); setActionError(null); }}
          onSubmit={(payload) => runAction(`/services/${serviceId}/override-grace-period`, "POST", { ...payload, grace_period_ends_at: dateFieldValue })}
        >
          {() => (
            <label className="admin-field">
              <span>New grace period end date</span>
              <input required type="date" value={dateFieldValue} onChange={(event) => setDateFieldValue(event.target.value)} />
            </label>
          )}
        </ReasonFormModal>
      )}
      {activeModal === "schedule" && (
        <ReasonFormModal
          title="Schedule Automatic Deletion"
          actionLabel="Schedule Deletion"
          isSubmitting={isSubmitting}
          error={actionError}
          onClose={() => { setActiveModal(null); setActionError(null); }}
          onSubmit={(payload) => runAction(`/services/${serviceId}/schedule-deletion`, "POST", { ...payload, scheduled_deletion_at: dateFieldValue })}
        >
          {() => (
            <label className="admin-field">
              <span>Scheduled deletion date</span>
              <input required type="date" value={dateFieldValue} onChange={(event) => setDateFieldValue(event.target.value)} />
            </label>
          )}
        </ReasonFormModal>
      )}
    </section>
  );
}

function AdminClientsList({
  adminToken,
  onOpenClient,
}: {
  adminToken: string;
  onOpenClient: (clientId: number) => void;
}) {
  const [records, setRecords] = useState<LaravelPage | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [statusFilter, setStatusFilter] = useState("");
  const [page, setPage] = useState(1);

  useEffect(() => {
    setPage(1);
  }, [statusFilter]);

  useEffect(() => {
    if (!adminToken) return;
    setIsLoading(true);
    const params = new URLSearchParams();
    if (statusFilter) params.set("client_status", statusFilter);
    if (page > 1) params.set("page", String(page));

    laravelApi<LaravelPage>(`/api/v1/admin/clients?${params.toString()}`, adminToken)
      .then(setRecords)
      .catch(() => setRecords(null))
      .finally(() => setIsLoading(false));
  }, [adminToken, statusFilter, page]);

  const rows = (records?.data || []) as Array<Record<string, any>>;
  const lastPage = records?.meta?.last_page ?? 1;

  return (
    <section className="admin-panel">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <h2 className="text-2xl font-black">Clients</h2>
          <p className="mt-1 text-sm text-white/55">Laravel client accounts and billing profiles. Click a row for full details and actions.</p>
        </div>
        <label className="admin-field w-full sm:w-56">
          <span>Status</span>
          <select value={statusFilter} onChange={(event) => setStatusFilter(event.target.value)}>
            <option value="">All statuses</option>
            <option value="active">Active</option>
            <option value="suspended">Suspended</option>
            <option value="deactivated">Deactivated</option>
          </select>
        </label>
      </div>

      <div className="mt-6 overflow-x-auto">
        {isLoading ? (
          <div className="rounded-lg border border-white/10 bg-black/20 p-6 text-sm font-bold text-white/60">Loading Laravel records...</div>
        ) : rows.length ? (
          <table className="admin-table">
            <thead>
              <tr>
                <th>Client name</th>
                <th>Email</th>
                <th>Phone</th>
                <th>Account type</th>
                <th>Status</th>
                <th>Active services</th>
                <th>Renewal due</th>
                <th>Total revenue</th>
                <th>Created</th>
                <th></th>
              </tr>
            </thead>
            <tbody>
              {rows.map((row) => (
                <tr key={row.id} className="cursor-pointer hover:bg-white/5" onClick={() => onOpenClient(Number(row.id))}>
                  <td>{row.company_name || row.user?.name || "—"}</td>
                  <td>{row.user?.email || row.billing_email || "—"}</td>
                  <td>{row.billing_phone || row.user?.phone || "—"}</td>
                  <td>{accountTypeLabel(row.account_type)}</td>
                  <td><span className={clientStatusPillClass(row.client_status)}>{row.client_status}</span></td>
                  <td>{row.active_services_count ?? 0}</td>
                  <td>{formatDate(row.next_renewal_due)}</td>
                  <td>{formatKobo(row.total_revenue_kobo)}</td>
                  <td>{formatDate(row.created_at)}</td>
                  <td><span className="text-xs font-bold text-primary">View →</span></td>
                </tr>
              ))}
            </tbody>
          </table>
        ) : (
          <div className="rounded-lg border border-white/10 bg-black/20 p-6 text-sm font-bold text-white/60">No records found.</div>
        )}
      </div>

      {lastPage > 1 && (
        <div className="mt-5 flex items-center justify-between gap-3 border-t border-white/10 pt-5 text-xs font-bold text-white/55">
          <button type="button" className="btn-outline !min-h-9 !px-3 !text-[11px]" disabled={page <= 1 || isLoading} onClick={() => setPage((current) => current - 1)}>
            Previous
          </button>
          <span>Page {page} of {lastPage}</span>
          <button type="button" className="btn-outline !min-h-9 !px-3 !text-[11px]" disabled={page >= lastPage || isLoading} onClick={() => setPage((current) => current + 1)}>
            Next
          </button>
        </div>
      )}
    </section>
  );
}

const INITIAL_LOGIN = { email: "", password: "" };
const INITIAL_REGISTER = {
  name: "",
  email: "",
  phone: "",
  company_name: "",
  billing_address: "",
  password: "",
  password_confirmation: "",
};
const INITIAL_ORDER_DRAFT = {
  plan_slug: "",
  billing_cycle: "annual" as "monthly" | "annual",
  add_ons: [] as string[],
  primary_domain: "",
  auto_renew: true,
  register_domain: false,
};

const portalNavLinks = [
  { icon: Home, label: "Dashboard", route: "dashboard" as ClientRouteName, path: "/client/dashboard" },
  { icon: PackageCheck, label: "Services Catalog", route: "services-catalog" as ClientRouteName, path: "/client/services/catalog" },
  { icon: FileText, label: "My Orders", route: "orders" as ClientRouteName, path: "/client/orders" },
  { icon: Globe2, label: "My Domains", route: "domains" as ClientRouteName, path: "/client/domains" },
  { icon: Globe2, label: "Search Domains", route: "domain-search" as ClientRouteName, path: "/client/domains/search" },
  { icon: Wallet, label: "Wallet", route: "wallet" as ClientRouteName, path: "/client/wallet" },
  { icon: CreditCard, label: "Saved Payment Methods", route: "payment-methods" as ClientRouteName, path: "/client/payment-methods" },
  { icon: User, label: "My Profile", route: "profile" as ClientRouteName, path: "/client/profile" },
  { icon: MessageCircle, label: "Support Tickets", route: null, path: null },
  { icon: LogOut, label: "Logout", route: null, path: null },
];

function ClientPortalShell({
  dashboard,
  route,
  isVerified,
  navigate,
  onLogout,
  onProfileClick,
  hideWelcomeHeader = false,
  children,
}: {
  dashboard: ClientDashboardSnapshot;
  route: ClientRouteName;
  isVerified: boolean | null;
  navigate: (path: string) => void;
  onLogout: () => void;
  onProfileClick?: () => void;
  hideWelcomeHeader?: boolean;
  children: React.ReactNode;
}) {
  const [isMobileNavOpen, setIsMobileNavOpen] = useState(false);

  return (
    <div className="portal-shell">
      <aside className="portal-sidebar">
        <div className="portal-sidebar-header">
          <Logo />
          <button
            type="button"
            className="portal-mobile-toggle"
            aria-label={isMobileNavOpen ? "Close menu" : "Open menu"}
            onClick={() => setIsMobileNavOpen((current) => !current)}
          >
            {isMobileNavOpen ? <X className="h-5 w-5" /> : <Menu className="h-5 w-5" />}
          </button>
        </div>
        <p className="portal-kicker">Client Portal</p>
        <nav className={isMobileNavOpen ? "portal-nav-list open" : "portal-nav-list"}>
          {portalNavLinks.map((item) => (
            <button
              key={item.label}
              type="button"
              className={route === item.route ? "portal-nav active" : "portal-nav"}
              onClick={() => {
                setIsMobileNavOpen(false);
                if (item.label === "Logout") {
                  onLogout();
                } else if (item.label === "Support Tickets") {
                  window.open(whatsappUrl, "_blank", "noopener,noreferrer");
                } else if (item.path) {
                  navigate(item.path);
                }
              }}
            >
              {React.createElement(item.icon, { className: "h-4 w-4" })}
              {item.label}
            </button>
          ))}
        </nav>
      </aside>

      <main className="portal-main">
        {Boolean(sessionStorage.getItem("naitalk_laravel_admin_token")) && (
          <div className="form-message warning mb-2 flex flex-wrap items-center justify-between gap-3">
            <span>You are viewing this account as an admin.</span>
            <button type="button" className="btn-outline" onClick={() => { window.location.href = "/admin"; }}>
              Return to Admin
            </button>
          </div>
        )}
        {!hideWelcomeHeader && (
          <header className="portal-header">
            <div>
              <h1>Welcome back, {dashboard.client.name}</h1>
              <p>Here is an overview of your services and account.</p>
            </div>
            <div className="flex items-center gap-3">
              <Bell className="h-5 w-5 text-primary" />
              <button
                type="button"
                className="avatar-initial cursor-pointer border-0"
                onClick={onProfileClick}
                aria-label="Account settings"
              >
                {dashboard.client.name.split(" ").map((part) => part[0]).join("").slice(0, 2)}
              </button>
            </div>
          </header>
        )}
        {!isVerified && isVerified !== null && (
          <div className="form-message warning mb-2 flex flex-wrap items-center justify-between gap-3">
            <span>Verify your email to unlock hosting orders, invoice payments, and auto-renewal.</span>
            <button type="button" className="btn-outline" onClick={() => navigate("/client/verify-email")}>
              Verify now
            </button>
          </div>
        )}
        {children}
      </main>
    </div>
  );
}

type HostingManageOverview = {
  overview: {
    primary_domain: string | null;
    plan: string | null;
    status: string;
    provisioning_status: string;
    billing_cycle: string;
    renews_at: string | null;
    auto_renew_enabled: boolean;
    last_synced_at: string | null;
  };
  usage: {
    disk_used_mb: number;
    disk_quota_mb: number;
    bandwidth_used_mb: number;
    bandwidth_quota_mb: number;
    email_accounts_used: number;
    email_accounts_limit: number;
    databases_used: number;
    databases_limit: number;
    ftp_accounts_used: number;
    ftp_accounts_limit: number;
    captured_at: string;
  } | null;
  capabilities: {
    email_accounts_enabled: boolean;
    databases_enabled: boolean;
    ftp_sftp_enabled: boolean;
    ssh_access_enabled: boolean;
    ssl_enabled: boolean;
    backup_enabled: boolean;
  };
};

type HostingMailbox = {
  id: number;
  email_address: string;
  display_name: string | null;
  quota_mb: number;
  status: string;
  last_synced_at: string | null;
};

type HostingDatabase = {
  id: number;
  database_name: string;
  username: string;
  status: string;
  last_synced_at: string | null;
};

type HostingFtpAccount = {
  id: number;
  username: string;
  access_type: string;
  status: string;
  last_synced_at: string | null;
};

type HostingTabName = "overview" | "email" | "databases" | "ftp" | "access";

type HostingModalState =
  | null
  | { type: "create-mailbox" }
  | { type: "edit-mailbox"; id: number; label: string; display_name: string; quota_mb: number | null }
  | { type: "change-mailbox-password"; id: number; label: string }
  | { type: "create-database" }
  | { type: "reset-database-password"; id: number; label: string }
  | { type: "create-ftp" }
  | { type: "reset-ftp-password"; id: number; label: string }
  | { type: "confirm-delete"; kind: "mailboxes" | "databases" | "ftp-accounts"; id: number; label: string };

function hostingStatusPillClass(status: string): string {
  if (["active", "completed", "provisioned"].includes(status)) return "status-pill paid";
  if (["failed", "missing_remote", "disabled", "deleted", "suspended"].includes(status)) return "status-pill failed";
  return "status-pill pending";
}

function formatMb(mb: number): string {
  return mb >= 1024 ? `${(mb / 1024).toFixed(1)} GB` : `${mb} MB`;
}

function HostingManagePanel({
  serviceId,
  token,
  navigate,
  toast,
}: {
  serviceId: number;
  token: string;
  navigate: (path: string) => void;
  toast: ReturnType<typeof useToast>;
}) {
  const [tab, setTab] = useState<HostingTabName>("overview");
  const [data, setData] = useState<HostingManageOverview | null>(null);
  const [mailboxes, setMailboxes] = useState<{ items: HostingMailbox[]; limit: number } | null>(null);
  const [databases, setDatabases] = useState<{ items: HostingDatabase[]; limit: number } | null>(null);
  const [ftpAccounts, setFtpAccounts] = useState<{ items: HostingFtpAccount[]; limit: number; serverHostname: string | null } | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [isTogglingAutoRenew, setIsTogglingAutoRenew] = useState(false);
  const [modal, setModal] = useState<HostingModalState>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);

  const base = `/api/v1/client/services/${serviceId}`;

  const loadAll = React.useCallback(async () => {
    try {
      const [overview, mailboxRes, databaseRes, ftpRes] = await Promise.all([
        laravelApi<HostingManageOverview>(`${base}/manage`, token),
        laravelApi<{ mailboxes: HostingMailbox[]; limit: number }>(`${base}/mailboxes`, token),
        laravelApi<{ databases: HostingDatabase[]; limit: number }>(`${base}/databases`, token),
        laravelApi<{ ftp_accounts: HostingFtpAccount[]; limit: number; server_hostname: string | null }>(`${base}/ftp-accounts`, token),
      ]);
      setData(overview);
      setMailboxes({ items: mailboxRes.mailboxes, limit: mailboxRes.limit });
      setDatabases({ items: databaseRes.databases, limit: databaseRes.limit });
      setFtpAccounts({ items: ftpRes.ftp_accounts, limit: ftpRes.limit, serverHostname: ftpRes.server_hostname });
    } catch (error) {
      toast.push({ type: "error", message: error instanceof Error ? error.message : "Could not load hosting service details." });
    } finally {
      setIsLoading(false);
    }
  }, [base, token, toast]);

  useEffect(() => {
    void loadAll();
  }, [loadAll]);

  const handleRefresh = async () => {
    setIsRefreshing(true);
    try {
      await laravelApi(`${base}/manage/refresh`, token, { method: "POST" });
      toast.push({ type: "success", message: "Refresh requested. New usage data will appear shortly." });
      await loadAll();
    } catch (error) {
      toast.push({ type: "error", message: error instanceof Error ? error.message : "Refresh request failed." });
    } finally {
      setIsRefreshing(false);
    }
  };

  const handleToggleAutoRenew = async (enabled: boolean) => {
    setIsTogglingAutoRenew(true);
    try {
      await laravelApi(`${base}/manage/auto-renew`, token, {
        method: "POST",
        body: JSON.stringify({ auto_renew_enabled: enabled }),
      });
      toast.push({ type: "success", message: enabled ? "Auto-renew turned on." : "Auto-renew turned off." });
      await loadAll();
    } catch (error) {
      toast.push({ type: "error", message: error instanceof Error ? error.message : "Could not update auto-renew." });
    } finally {
      setIsTogglingAutoRenew(false);
    }
  };

  const runAction = async (path: string, options: RequestInit, successMessage: string) => {
    setIsSubmitting(true);
    try {
      await laravelApi(path, token, options);
      toast.push({ type: "success", message: successMessage });
      setModal(null);
      await loadAll();
    } catch (error) {
      toast.push({ type: "error", message: error instanceof Error ? error.message : "Action failed." });
    } finally {
      setIsSubmitting(false);
    }
  };

  if (isLoading || !data) {
    return (
      <div className="flex min-h-[40vh] items-center justify-center text-white/50">
        <Loader2 className="h-6 w-6 animate-spin" />
      </div>
    );
  }

  const { overview, usage, capabilities } = data;

  return (
    <div>
      <nav className="hosting-breadcrumb">
        <button type="button" onClick={() => navigate("/client/dashboard")}>Dashboard</button>
        <span>/</span>
        <button type="button" onClick={() => navigate("/client/dashboard")}>Services</button>
        <span>/</span>
        <span className="current">{overview.primary_domain || `Service #${serviceId}`}</span>
      </nav>

      <div className="hosting-header">
        <div className="hosting-header-icon">
          <Server className="h-6 w-6" />
        </div>
        <div>
          <h1 className="text-xl font-black text-white">Manage Hosting</h1>
          <p className="mt-1 text-sm font-bold text-white">{overview.primary_domain || "No domain set"}</p>
          <p className="text-xs text-white/48">{overview.plan || "Hosting Package"}</p>
        </div>
        <span className={hostingStatusPillClass(overview.status)}>{overview.status}</span>
        <div className="hosting-header-meta">
          <div>
            <span>Next Renewal</span>
            <strong>{formatDate(overview.renews_at)}</strong>
          </div>
          <div>
            <span>Service ID</span>
            <strong>SRV-{serviceId}</strong>
          </div>
          <label className="flex items-center gap-2 text-xs font-bold text-white/68">
            <input
              type="checkbox"
              className="h-4 w-4"
              checked={overview.auto_renew_enabled}
              disabled={isTogglingAutoRenew}
              onChange={(event) => void handleToggleAutoRenew(event.target.checked)}
            />
            Auto-renew
          </label>
          <button type="button" className="btn-outline" onClick={() => void handleRefresh()} disabled={isRefreshing}>
            <RefreshCw className={isRefreshing ? "h-4 w-4 animate-spin" : "h-4 w-4"} />
            Refresh
          </button>
        </div>
      </div>

      <div className="hosting-stats">
        {[
          [HardDrive, "Disk Usage", usage?.disk_used_mb ?? 0, usage?.disk_quota_mb ?? 0, ""],
          [Wifi, "Bandwidth Usage", usage?.bandwidth_used_mb ?? 0, usage?.bandwidth_quota_mb ?? 0, "tone-cyan"],
          [Mail, "Email Accounts", usage?.email_accounts_used ?? 0, usage?.email_accounts_limit ?? 0, "tone-violet"],
          [Database, "Databases", usage?.databases_used ?? 0, usage?.databases_limit ?? 0, "tone-gold"],
          [KeyRound, "SSH/SFTP Accounts", usage?.ftp_accounts_used ?? 0, usage?.ftp_accounts_limit ?? 0, ""],
        ].map(([Icon, label, used, limit, tone], index) => {
          const usedNum = used as number;
          const limitNum = limit as number;
          const isCapacity = index === 0 || index === 1;
          const percent = limitNum > 0 ? Math.min(100, Math.round((usedNum / limitNum) * 100)) : 0;

          return (
            <div key={label as string} className={`hosting-stat-card ${tone as string}`}>
              <div className="hosting-stat-card-head">
                {React.createElement(Icon as React.ComponentType<{ className?: string }>, { className: "h-4 w-4" })}
                {label as string}
              </div>
              <div className="hosting-stat-card-value">
                {isCapacity ? formatMb(usedNum) : usedNum}
                {" "}
                <small>/ {isCapacity ? formatMb(limitNum) : limitNum}</small>
              </div>
              <div className="hosting-progress-track">
                <div className="hosting-progress-fill" style={{ width: `${percent}%` }} />
              </div>
              <div className="hosting-stat-card-foot">
                {!usage
                  ? "No usage data yet"
                  : limitNum > usedNum
                    ? `${isCapacity ? formatMb(limitNum - usedNum) : limitNum - usedNum} Available`
                    : "Limit reached"}
              </div>
            </div>
          );
        })}
      </div>

      <div className="hosting-tabs">
        {(
          [
            ["overview", BarChart3, "Overview"],
            ["email", Mail, "Email Accounts"],
            ["databases", Database, "Databases"],
            ["ftp", KeyRound, "SSH/SFTP"],
            ["access", LockKeyhole, "Access Details"],
          ] as [HostingTabName, React.ComponentType<{ className?: string }>, string][]
        ).map(([id, Icon, label]) => (
          <button key={id} type="button" className={tab === id ? "hosting-tab active" : "hosting-tab"} onClick={() => setTab(id)}>
            <Icon className="h-4 w-4" />
            {label}
          </button>
        ))}
      </div>

      <div className="hosting-panel">
        <section className="portal-card">
          {tab === "overview" && (
            <div>
              <h2>Overview</h2>
              <p className="mt-3 text-sm text-white/54">
                {overview.primary_domain} is currently <strong className="text-white">{overview.status}</strong> on the {overview.plan} package,
                billed {overview.billing_cycle}.
              </p>
              {!capabilities.email_accounts_enabled && !capabilities.databases_enabled && !capabilities.ftp_sftp_enabled && (
                <p className="mt-3 text-sm text-white/40">This package does not include email, database, or SSH/SFTP management.</p>
              )}
            </div>
          )}

          {tab === "email" && (
            <div>
              <div className="flex items-center justify-between">
                <div>
                  <h2>Email Accounts</h2>
                  <p className="mt-1 text-sm text-white/48">Manage your email accounts and settings.</p>
                </div>
                {capabilities.email_accounts_enabled && (
                  <button type="button" className="btn-primary" onClick={() => setModal({ type: "create-mailbox" })}>
                    <Plus className="h-4 w-4" />
                    Create Email Account
                  </button>
                )}
              </div>
              {!capabilities.email_accounts_enabled ? (
                <p className="mt-4 text-sm text-white/40">Email accounts are not included in this hosting package.</p>
              ) : (
                <div className="hosting-table-wrap mt-4">
                  <table className="hosting-table">
                    <thead>
                      <tr>
                        <th>Email Address</th>
                        <th>Name</th>
                        <th>Quota</th>
                        <th>Status</th>
                        <th>Last Synced</th>
                        <th></th>
                      </tr>
                    </thead>
                    <tbody>
                      {mailboxes?.items.map((mailbox) => (
                        <tr key={mailbox.id}>
                          <td className="font-bold text-white">{mailbox.email_address}</td>
                          <td>{mailbox.display_name || "—"}</td>
                          <td>{mailbox.quota_mb ? formatMb(mailbox.quota_mb) : "—"}</td>
                          <td><span className={hostingStatusPillClass(mailbox.status)}>{mailbox.status}</span></td>
                          <td className="text-white/40">{mailbox.last_synced_at ? formatDateTime(mailbox.last_synced_at) : "Pending"}</td>
                          <td>
                            <div className="flex items-center justify-end gap-2">
                              <button
                                type="button"
                                className="btn-outline !min-h-9 !px-3 !py-1.5 !text-[10px]"
                                onClick={() =>
                                  setModal({
                                    type: "edit-mailbox",
                                    id: mailbox.id,
                                    label: mailbox.email_address,
                                    display_name: mailbox.display_name || "",
                                    quota_mb: mailbox.quota_mb || null,
                                  })
                                }
                              >
                                <Pencil className="h-3.5 w-3.5" />
                                Edit
                              </button>
                              <button
                                type="button"
                                className="btn-outline !min-h-9 !px-3 !py-1.5 !text-[10px]"
                                onClick={() => setModal({ type: "change-mailbox-password", id: mailbox.id, label: mailbox.email_address })}
                              >
                                <KeyRound className="h-3.5 w-3.5" />
                                Change Password
                              </button>
                              <button
                                type="button"
                                className="btn-outline !min-h-9 !px-3 !py-1.5 !text-[10px]"
                                onClick={() =>
                                  void runAction(
                                    `${base}/mailboxes/${mailbox.id}/${mailbox.status === "suspended" ? "resume" : "suspend"}`,
                                    { method: "POST" },
                                    mailbox.status === "suspended" ? "Mailbox resume requested." : "Mailbox suspend requested.",
                                  )
                                }
                              >
                                <Power className="h-3.5 w-3.5" />
                              </button>
                              <button
                                type="button"
                                className="btn-outline !min-h-9 !px-3 !py-1.5 !text-[10px]"
                                onClick={() => setModal({ type: "confirm-delete", kind: "mailboxes", id: mailbox.id, label: mailbox.email_address })}
                              >
                                <Trash2 className="h-3.5 w-3.5" />
                              </button>
                            </div>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                  {mailboxes?.items.length === 0 && <p className="mt-4 text-sm text-white/40">No email accounts yet.</p>}
                </div>
              )}
            </div>
          )}

          {tab === "databases" && (
            <div>
              <div className="flex items-center justify-between">
                <div>
                  <h2>Databases</h2>
                  <p className="mt-1 text-sm text-white/48">Manage your MySQL databases.</p>
                </div>
                {capabilities.databases_enabled && (
                  <button type="button" className="btn-primary" onClick={() => setModal({ type: "create-database" })}>
                    <Plus className="h-4 w-4" />
                    Create Database
                  </button>
                )}
              </div>
              {!capabilities.databases_enabled ? (
                <p className="mt-4 text-sm text-white/40">Databases are not included in this hosting package.</p>
              ) : (
                <div className="hosting-table-wrap mt-4">
                  <table className="hosting-table">
                    <thead>
                      <tr>
                        <th>Database</th>
                        <th>Username</th>
                        <th>Status</th>
                        <th>Last Synced</th>
                        <th></th>
                      </tr>
                    </thead>
                    <tbody>
                      {databases?.items.map((database) => (
                        <tr key={database.id}>
                          <td className="font-bold text-white">{database.database_name}</td>
                          <td>{database.username}</td>
                          <td><span className={hostingStatusPillClass(database.status)}>{database.status}</span></td>
                          <td className="text-white/40">{database.last_synced_at ? formatDateTime(database.last_synced_at) : "Pending"}</td>
                          <td>
                            <div className="flex items-center justify-end gap-2">
                              <button
                                type="button"
                                className="btn-outline !min-h-9 !px-3 !py-1.5 !text-[10px]"
                                onClick={() => setModal({ type: "reset-database-password", id: database.id, label: database.database_name })}
                              >
                                <KeyRound className="h-3.5 w-3.5" />
                                Reset Password
                              </button>
                              <button
                                type="button"
                                className="btn-outline !min-h-9 !px-3 !py-1.5 !text-[10px]"
                                onClick={() => setModal({ type: "confirm-delete", kind: "databases", id: database.id, label: database.database_name })}
                              >
                                <Trash2 className="h-3.5 w-3.5" />
                              </button>
                            </div>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                  {databases?.items.length === 0 && <p className="mt-4 text-sm text-white/40">No databases yet.</p>}
                </div>
              )}
            </div>
          )}

          {tab === "ftp" && (
            <div>
              <div className="flex items-center justify-between">
                <div>
                  <h2>SSH/SFTP Accounts</h2>
                  <p className="mt-1 text-sm text-white/48">
                    Manage secure shell and file transfer access. Root/server credentials are never exposed here.
                    {ftpAccounts?.serverHostname && (
                      <> Connect using host <strong className="text-white">{ftpAccounts.serverHostname}</strong>.</>
                    )}
                  </p>
                </div>
                {capabilities.ftp_sftp_enabled && (
                  <button type="button" className="btn-primary" onClick={() => setModal({ type: "create-ftp" })}>
                    <Plus className="h-4 w-4" />
                    Create Account
                  </button>
                )}
              </div>
              {!capabilities.ftp_sftp_enabled ? (
                <p className="mt-4 text-sm text-white/40">SSH/SFTP access is not included in this hosting package.</p>
              ) : (
                <div className="hosting-table-wrap mt-4">
                  <table className="hosting-table">
                    <thead>
                      <tr>
                        <th>Username</th>
                        <th>Status</th>
                        <th>Last Synced</th>
                        <th></th>
                      </tr>
                    </thead>
                    <tbody>
                      {ftpAccounts?.items.map((account) => (
                        <tr key={account.id}>
                          <td className="font-bold text-white">{account.username}</td>
                          <td><span className={hostingStatusPillClass(account.status)}>{account.status}</span></td>
                          <td className="text-white/40">{account.last_synced_at ? formatDateTime(account.last_synced_at) : "Pending"}</td>
                          <td>
                            <div className="flex items-center justify-end gap-2">
                              <button
                                type="button"
                                className="btn-outline !min-h-9 !px-3 !py-1.5 !text-[10px]"
                                onClick={() => setModal({ type: "reset-ftp-password", id: account.id, label: account.username })}
                              >
                                <KeyRound className="h-3.5 w-3.5" />
                                Reset Password
                              </button>
                              <button
                                type="button"
                                className="btn-outline !min-h-9 !px-3 !py-1.5 !text-[10px]"
                                onClick={() => void runAction(`${base}/ftp-accounts/${account.id}/disable`, { method: "POST" }, "Account disable requested.")}
                              >
                                <Power className="h-3.5 w-3.5" />
                              </button>
                              <button
                                type="button"
                                className="btn-outline !min-h-9 !px-3 !py-1.5 !text-[10px]"
                                onClick={() => setModal({ type: "confirm-delete", kind: "ftp-accounts", id: account.id, label: account.username })}
                              >
                                <Trash2 className="h-3.5 w-3.5" />
                              </button>
                            </div>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                  {ftpAccounts?.items.length === 0 && <p className="mt-4 text-sm text-white/40">No SSH/SFTP accounts yet.</p>}
                </div>
              )}
            </div>
          )}

          {tab === "access" && (
            <div>
              <h2>Access Details</h2>
              <p className="mt-3 text-sm text-white/54">
                For security, server-level and ISPConfig administrative credentials are never shown in the client portal. Use the actions in the
                Email Accounts, Databases, and SSH/SFTP tabs above to manage access for this service.
              </p>
            </div>
          )}
        </section>

        <aside className="portal-card">
          <h2>Hosting Summary</h2>
          <div className="hosting-summary-list">
            <div className="hosting-summary-row"><span>Package</span><strong>{overview.plan}</strong></div>
            <div className="hosting-summary-row"><span>Primary Domain</span><strong>{overview.primary_domain}</strong></div>
            <div className="hosting-summary-row"><span>Web Space</span><strong>{formatMb(usage?.disk_quota_mb ?? 0)}</strong></div>
            <div className="hosting-summary-row"><span>Bandwidth</span><strong>{formatMb(usage?.bandwidth_quota_mb ?? 0)} / month</strong></div>
            <div className="hosting-summary-row"><span>Email Accounts</span><strong>{usage?.email_accounts_used ?? 0} / {usage?.email_accounts_limit ?? 0}</strong></div>
            <div className="hosting-summary-row"><span>Databases</span><strong>{usage?.databases_used ?? 0} / {usage?.databases_limit ?? 0}</strong></div>
            <div className="hosting-summary-row"><span>SSH/SFTP Accounts</span><strong>{usage?.ftp_accounts_used ?? 0} / {usage?.ftp_accounts_limit ?? 0}</strong></div>
            <div className="hosting-summary-row"><span>Last Synced</span><strong>{overview.last_synced_at ? formatDateTime(overview.last_synced_at) : "Never"}</strong></div>
          </div>
        </aside>
      </div>

      <AnimatePresence>
        {modal && (
          <motion.div className="hosting-modal-backdrop" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} onClick={() => setModal(null)}>
            <motion.div
              className="hosting-modal"
              initial={{ opacity: 0, scale: 0.96, y: 12 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.96, y: 12 }}
              onClick={(event) => event.stopPropagation()}
              role="dialog"
              aria-modal="true"
            >
              <HostingModalContent
                modal={modal}
                isSubmitting={isSubmitting}
                primaryDomain={overview.primary_domain}
                onClose={() => setModal(null)}
                onCreateMailbox={(payload) =>
                  void runAction(
                    `${base}/mailboxes`,
                    {
                      method: "POST",
                      body: JSON.stringify({
                        username: payload.username,
                        password: payload.password,
                        display_name: payload.display_name || undefined,
                        quota_mb: payload.quota_mb ? Number(payload.quota_mb) : undefined,
                      }),
                    },
                    "Mailbox creation requested.",
                  )
                }
                onUpdateMailbox={(id, payload) =>
                  void runAction(
                    `${base}/mailboxes/${id}`,
                    {
                      method: "PUT",
                      body: JSON.stringify({
                        display_name: payload.display_name || undefined,
                        quota_mb: payload.quota_mb ? Number(payload.quota_mb) : undefined,
                      }),
                    },
                    "Mailbox update requested.",
                  )
                }
                onCreateDatabase={(payload) => void runAction(`${base}/databases`, { method: "POST", body: JSON.stringify(payload) }, "Database creation requested.")}
                onCreateFtp={(payload) => void runAction(`${base}/ftp-accounts`, { method: "POST", body: JSON.stringify(payload) }, "SSH/SFTP account creation requested.")}
                onChangeMailboxPassword={(id, payload) => void runAction(`${base}/mailboxes/${id}/change-password`, { method: "POST", body: JSON.stringify(payload) }, "Password change requested.")}
                onResetDatabasePassword={(id, payload) => void runAction(`${base}/databases/${id}/reset-password`, { method: "POST", body: JSON.stringify(payload) }, "Password reset requested.")}
                onResetFtpPassword={(id, payload) => void runAction(`${base}/ftp-accounts/${id}/reset-password`, { method: "POST", body: JSON.stringify(payload) }, "Password reset requested.")}
                onConfirmDelete={(kind, id) => void runAction(`${base}/${kind}/${id}`, { method: "DELETE", body: JSON.stringify({ confirm: true }) }, "Deletion requested.")}
              />
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}

type ClientInvoiceDetail = {
  invoice_number: string;
  order_number: string;
  status: string;
  issued_at: string | null;
  due_at: string | null;
  paid_at: string | null;
  from: {
    name: string;
    address_lines: string[];
    phone: string | null;
    email: string | null;
    website: string | null;
    rc_number: string | null;
    tin: string | null;
  };
  bill_to: {
    name: string;
    address_lines: string[];
    email: string | null;
    phone: string | null;
    tax_id: string | null;
  };
  line_items: Array<{ description: string; quantity: number; unit_price: string; total: string }>;
  reconciliation_status: string;
  subtotal: string;
  discount: string;
  vat_rate: number;
  vat_label: string;
  tax: string;
  total: string;
  amount_paid: string;
  wallet_amount_applied: string;
  wallet_amount_applied_kobo: number;
  overpayment_amount: string;
  overpayment_amount_kobo: number;
  underpayment_amount: string;
  underpayment_amount_kobo: number;
  outstanding_amount: string;
  outstanding_amount_kobo: number;
  balance_due: string;
  bank_transfer: { bank_name: string; account_name: string; account_number: string };
  bank_transfer_status: string | null;
  bank_transfer_rejection_reason: string | null;
};

type WalletSummary = {
  balance_kobo: number;
  balance: string;
  currency: string;
  status: string;
};

type WalletTransactionRow = {
  id: number;
  type: string;
  direction: "credit" | "debit";
  amount: string;
  amount_kobo: number;
  balance_before: string;
  balance_after: string;
  invoice_number: string | null;
  order_number: string | null;
  payment_reference: string | null;
  description: string | null;
  status: string;
  created_at: string;
};

type SavedPaymentMethodRow = {
  id: number;
  payment_provider: string;
  provider_customer_id: string | null;
  provider_authorization_code: string;
  card_brand: string | null;
  last4: string | null;
  exp_month: number | null;
  exp_year: number | null;
  is_active: boolean;
  is_default: boolean;
  use_for_auto_renewal: boolean;
  created_at: string;
};

/**
 * Shared payment-method chooser used both right after checkout and on the
 * unpaid-invoice page, so a client sees the exact same set of options (wallet,
 * saved cards, gateways, bank transfer) in both places.
 *
 * walletMode "split" allows applying a partial wallet balance and shows the
 * remaining amount to pay elsewhere (used on the invoice page). walletMode
 * "full-only" simply blocks the wallet option with an explanatory message
 * when the balance can't cover the full outstanding amount (used right after
 * checkout, before any partial payment has ever landed on the invoice).
 */
/**
 * Shared by the wallet and saved-card payment paths in PaymentOptionsPanel —
 * both confirm payment synchronously (no gateway redirect), so this can fire
 * payment_success + purchase immediately. Falls back to invoice-only details
 * when no pendingPayment was stashed (e.g. paying a renewal invoice that
 * wasn't just created by handleSubmitOrder).
 */
function trackInvoicePaymentSuccess(invoiceNumber: string, outstandingKobo: number, paymentMethod: string) {
  const pendingPayment = peekPendingPayment(invoiceNumber);
  const value = outstandingKobo / 100;

  trackEvent("payment_success", { transaction_id: invoiceNumber, payment_method: paymentMethod });
  trackPurchase({
    transaction_id: invoiceNumber,
    value,
    currency: "NGN",
    payment_method: paymentMethod,
    items: [
      {
        item_id: pendingPayment?.plan_id || invoiceNumber,
        item_name: pendingPayment?.plan_name || "Hosting invoice payment",
        price: value,
        quantity: 1,
      },
    ],
  });

  if (pendingPayment) clearPendingPayment();
}

function PaymentOptionsPanel({
  token,
  invoiceNumber,
  outstandingKobo,
  walletMode,
  isInitiatingPayment,
  onPayWithGateway,
  onPayByBankTransfer,
  toast,
  onPaid,
}: {
  token: string;
  invoiceNumber: string;
  outstandingKobo: number;
  walletMode: "split" | "full-only";
  isInitiatingPayment: boolean;
  onPayWithGateway: (invoiceNumber: string, gateway: "paystack" | "flutterwave") => Promise<void>;
  onPayByBankTransfer: (invoiceNumber: string) => Promise<void>;
  toast: ReturnType<typeof useToast>;
  onPaid: () => void;
}) {
  const [wallet, setWallet] = useState<WalletSummary | null>(null);
  const [methods, setMethods] = useState<SavedPaymentMethodRow[]>([]);
  const [isPayingWithWallet, setIsPayingWithWallet] = useState(false);
  const [payingCardId, setPayingCardId] = useState<number | null>(null);

  const loadWallet = React.useCallback(() => {
    return laravelApi<WalletSummary>("/api/v1/client/wallet", token)
      .then(setWallet)
      .catch(() => undefined);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [token]);

  useEffect(() => {
    void loadWallet();
    laravelApi<{ data: SavedPaymentMethodRow[] }>("/api/v1/client/payment-methods", token)
      .then((response) => setMethods(response.data || []))
      .catch(() => undefined);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [token]);

  const payWithWallet = async () => {
    if (isPayingWithWallet) return;
    setIsPayingWithWallet(true);

    try {
      const result = await laravelApi<{ message: string }>(`/api/v1/client/invoices/${invoiceNumber}/pay/wallet`, token, { method: "POST" });
      toast.push({ type: "success", message: result.message });
      trackInvoicePaymentSuccess(invoiceNumber, outstandingKobo, "wallet");
      onPaid();
      await loadWallet();
    } catch (error) {
      toast.push({ type: "error", message: error instanceof Error ? error.message : "Could not complete the wallet payment." });
    } finally {
      setIsPayingWithWallet(false);
    }
  };

  const payWithCard = async (methodId: number) => {
    setPayingCardId(methodId);

    try {
      const result = await laravelApi<{ message: string }>(`/api/v1/client/invoices/${invoiceNumber}/pay/saved-card/${methodId}`, token, { method: "POST" });
      toast.push({ type: "success", message: result.message });
      trackInvoicePaymentSuccess(invoiceNumber, outstandingKobo, "saved_card");
      onPaid();
    } catch (error) {
      toast.push({ type: "error", message: error instanceof Error ? error.message : "Could not complete the card payment." });
    } finally {
      setPayingCardId(null);
    }
  };

  const activeMethods = methods.filter((method) => method.is_active);
  const walletCoversFull = Boolean(wallet && wallet.balance_kobo >= outstandingKobo);
  const walletInsufficient = Boolean(wallet && wallet.balance_kobo > 0 && wallet.balance_kobo < outstandingKobo);

  return (
    <div className="grid gap-2">
      {wallet && wallet.balance_kobo > 0 && walletMode === "split" && (
        <div className="rounded-md border border-primary/20 bg-primary/5 p-2.5 text-[11px] text-white/70">
          {walletCoversFull ? (
            <>Your wallet balance is <strong className="text-white">{wallet.balance}</strong> — enough to pay this invoice in full.</>
          ) : (
            <>Your wallet balance is <strong className="text-white">{wallet.balance}</strong>. You can apply it to this invoice and pay the remaining{" "}
              <strong className="text-white">₦{((outstandingKobo - wallet.balance_kobo) / 100).toLocaleString()}</strong> using another payment method.</>
          )}
        </div>
      )}

      {walletInsufficient && walletMode === "full-only" && (
        <div className="rounded-md border border-yellow-400/20 bg-yellow-400/5 p-2.5 text-[11px] text-white/70">
          Your wallet balance is <strong className="text-white">{wallet?.balance}</strong>, which isn't enough to cover this invoice. Please fund
          your wallet or choose another payment method below.
        </div>
      )}

      {wallet && wallet.balance_kobo > 0 && (walletMode === "split" || walletCoversFull) && (
        <button
          type="button"
          className="btn-primary justify-center !min-h-9 !px-3 !py-1.5 !text-[11px]"
          disabled={isPayingWithWallet}
          onClick={() => void payWithWallet()}
        >
          {isPayingWithWallet ? "Processing..." : "Pay with Wallet"}
        </button>
      )}

      {activeMethods.map((method) => (
        <button
          key={method.id}
          type="button"
          className="btn-outline justify-center !min-h-9 !px-3 !py-1.5 !text-[11px]"
          disabled={payingCardId !== null}
          onClick={() => void payWithCard(method.id)}
        >
          {payingCardId === method.id
            ? "Processing..."
            : `Pay with ${(method.card_brand || method.payment_provider).toUpperCase()} •••• ${method.last4 || "----"}`}
        </button>
      ))}

      <button
        type="button"
        className="btn-primary justify-center !min-h-9 !px-3 !py-1.5 !text-[11px]"
        disabled={isInitiatingPayment}
        onClick={() => void onPayWithGateway(invoiceNumber, "paystack")}
      >
        Pay with Paystack
      </button>
      <button
        type="button"
        className="btn-primary justify-center !min-h-9 !px-3 !py-1.5 !text-[11px]"
        disabled={isInitiatingPayment}
        onClick={() => void onPayWithGateway(invoiceNumber, "flutterwave")}
      >
        Pay with Flutterwave
      </button>
      <button
        type="button"
        className="btn-outline justify-center !min-h-9 !px-3 !py-1.5 !text-[11px]"
        disabled={isInitiatingPayment}
        onClick={() => void onPayByBankTransfer(invoiceNumber)}
      >
        Pay by Bank Transfer / Upload Proof
      </button>
    </div>
  );
}

function ClientInvoicePage({
  orderNumber,
  invoiceNumber,
  token,
  navigate,
  toast,
  isInitiatingPayment,
  bankTransferInfo,
  onPayWithGateway,
  onPayByBankTransfer,
  onResetBankTransfer,
}: {
  orderNumber?: string;
  invoiceNumber?: string;
  token: string;
  navigate: (path: string) => void;
  toast: ReturnType<typeof useToast>;
  isInitiatingPayment: boolean;
  bankTransferInfo: BankTransferDetails | null;
  onPayWithGateway: (invoiceNumber: string, gateway: "paystack" | "flutterwave") => Promise<void>;
  onPayByBankTransfer: (invoiceNumber: string) => Promise<void>;
  onResetBankTransfer: () => void;
}) {
  const [invoice, setInvoice] = useState<ClientInvoiceDetail | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [isDownloading, setIsDownloading] = useState(false);
  const [hasDismissedBankTransfer, setHasDismissedBankTransfer] = useState(false);
  const [receiptFile, setReceiptFile] = useState<File | null>(null);
  const [isUploadingProof, setIsUploadingProof] = useState(false);

  const invoiceApiPath = orderNumber ? `/api/v1/client/orders/${orderNumber}/invoice` : `/api/v1/client/invoices/${invoiceNumber}`;

  const loadInvoice = React.useCallback(() => {
    setIsLoading(true);
    return laravelApi<ClientInvoiceDetail>(invoiceApiPath, token)
      .then(setInvoice)
      .catch((error) => toast.push({ type: "error", message: error instanceof Error ? error.message : "Could not load this invoice." }))
      .finally(() => setIsLoading(false));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [invoiceApiPath, token]);

  useEffect(() => {
    void loadInvoice();
  }, [loadInvoice]);

  const uploadProof = async () => {
    if (!invoice || !receiptFile) return;
    setIsUploadingProof(true);

    try {
      const formData = new FormData();
      formData.append("receipt", receiptFile);

      const response = await fetch(`${LARAVEL_API_BASE_URL}/api/v1/client/invoices/${invoice.invoice_number}/pay/bank-transfer/proof`, {
        method: "POST",
        headers: { Authorization: `Bearer ${token}` },
        body: formData,
      });
      const payload = await response.json().catch(() => ({}));

      if (!response.ok) throw new Error(payload.message || "Could not upload your proof of payment.");

      toast.push({ type: "success", message: payload.message || "Proof of payment submitted." });
      setReceiptFile(null);
      void loadInvoice();
    } catch (error) {
      toast.push({ type: "error", message: error instanceof Error ? error.message : "Could not upload your proof of payment." });
    } finally {
      setIsUploadingProof(false);
    }
  };

  const downloadInvoicePdf = async () => {
    setIsDownloading(true);

    try {
      const downloadPath = orderNumber
        ? `/api/v1/client/orders/${orderNumber}/invoice/download`
        : `/api/v1/client/invoices/${invoiceNumber}/download`;
      const response = await fetch(`${LARAVEL_API_BASE_URL}${downloadPath}`, {
        headers: { Authorization: `Bearer ${token}`, Accept: "application/pdf" },
      });

      if (!response.ok) throw new Error("Could not download this invoice.");

      const blob = await response.blob();
      const url = URL.createObjectURL(blob);
      const link = document.createElement("a");
      link.href = url;
      link.download = `invoice-${invoice?.invoice_number || orderNumber || invoiceNumber}.pdf`;
      link.click();
      URL.revokeObjectURL(url);
      trackEvent("file_download", { content_title: "invoice_pdf", transaction_id: invoice?.invoice_number || orderNumber || invoiceNumber });
    } catch (error) {
      toast.push({ type: "error", message: error instanceof Error ? error.message : "Could not download this invoice." });
    } finally {
      setIsDownloading(false);
    }
  };

  if (isLoading || !invoice) {
    return (
      <div className="flex min-h-[40vh] items-center justify-center text-white/50">
        <Loader2 className="h-6 w-6 animate-spin" />
      </div>
    );
  }

  const isPaid = invoice.status === "paid";

  return (
    <div>
      <nav className="hosting-breadcrumb">
        <button type="button" onClick={() => navigate("/client/dashboard")}>Dashboard</button>
        <span>/</span>
        <button type="button" onClick={() => navigate("/client/orders")}>My Orders</button>
        <span>/</span>
        <span className="current">{invoice.invoice_number}</span>
      </nav>

      <div className="portal-card mt-5 overflow-hidden !p-0">
        <div className="flex flex-wrap items-center justify-between gap-4 border-b border-primary/20 bg-black/40 p-6">
          <div>
            <p className="text-2xl font-black text-white">
              NAI<span className="text-primary"> TALK</span>
            </p>
            <p className="text-[10px] font-black uppercase tracking-widest text-white/45">Digital Solutions. AI-Powered Growth.</p>
          </div>
          <div className="text-right">
            <h2 className="text-xl font-black uppercase text-white">Invoice</h2>
            <p className="text-sm text-white/50">{invoice.invoice_number}</p>
            <button
              type="button"
              className="btn-outline mt-2 !min-h-9 !px-3 !py-1.5 !text-[10px]"
              disabled={isDownloading}
              onClick={() => void downloadInvoicePdf()}
            >
              {isDownloading ? "Preparing..." : "Download Invoice"}
            </button>
          </div>
        </div>

        <div className="grid gap-4 border-b border-white/10 p-6 sm:grid-cols-4">
          <div>
            <p className="text-[10px] font-black uppercase text-white/40">Issue Date</p>
            <p className="mt-1 text-sm font-bold text-white">{formatDate(invoice.issued_at)}</p>
          </div>
          <div>
            <p className="text-[10px] font-black uppercase text-white/40">Due Date</p>
            <p className="mt-1 text-sm font-bold text-white">{formatDate(invoice.due_at)}</p>
          </div>
          <div>
            <p className="text-[10px] font-black uppercase text-white/40">Status</p>
            <span className={isPaid ? "status-pill paid mt-1 inline-flex" : "status-pill failed mt-1 inline-flex"}>{invoice.status}</span>
          </div>
          {invoice.paid_at && (
            <div>
              <p className="text-[10px] font-black uppercase text-white/40">Paid Date</p>
              <p className="mt-1 text-sm font-bold text-white">{formatDate(invoice.paid_at)}</p>
            </div>
          )}
        </div>

        {!isPaid && (
          <div className="relative border-b border-white/10 p-6">
            {hasDismissedBankTransfer || (!bankTransferInfo && !invoice.bank_transfer_status) ? (
              <div className="sm:max-w-sm">
                <p className="text-xs font-black uppercase text-white/50">Choose how to pay</p>
                <div className="mt-3">
                  <PaymentOptionsPanel
                    token={token}
                    invoiceNumber={invoice.invoice_number}
                    outstandingKobo={invoice.outstanding_amount_kobo || 0}
                    walletMode="split"
                    isInitiatingPayment={isInitiatingPayment}
                    onPayWithGateway={onPayWithGateway}
                    onPayByBankTransfer={(invoiceNumber) => {
                      setHasDismissedBankTransfer(false);
                      return onPayByBankTransfer(invoiceNumber);
                    }}
                    toast={toast}
                    onPaid={() => void loadInvoice()}
                  />
                </div>
              </div>
            ) : invoice.bank_transfer_status === "pending_review" ? (
              <div className="rounded-lg border border-primary/30 bg-primary/5 p-4 text-left text-sm text-white/72 sm:max-w-sm">
                <div className="flex items-center gap-2">
                  <CheckCircle2 className="h-5 w-5 shrink-0 text-primary" />
                  <p className="font-black text-white">Payment proof submitted</p>
                </div>
                <p className="mt-2 text-white/60">
                  Thanks — we've received your proof of payment and it's awaiting confirmation. We'll notify you once it's approved.
                </p>
                <button type="button" className="mt-3 text-xs font-bold text-primary underline" onClick={() => setHasDismissedBankTransfer(true)}>
                  Choose a different payment method
                </button>
              </div>
            ) : (
              <div className="rounded-lg border border-white/10 bg-black/20 p-4 text-left text-sm text-white/72 sm:max-w-sm">
                <p className="font-black text-white">Step 1 — Make a bank transfer</p>
                {invoice.bank_transfer_rejection_reason && (
                  <p className="mt-2 rounded-md bg-red-400/10 p-2 text-xs text-red-200">
                    Your previous proof of payment was not approved: {invoice.bank_transfer_rejection_reason}. Please re-upload or choose a
                    different method.
                  </p>
                )}
                <p className="mt-2"><strong className="text-white">Bank:</strong> {bankTransferInfo?.bank_name || invoice.bank_transfer.bank_name}</p>
                <p className="mt-1"><strong className="text-white">Account name:</strong> {bankTransferInfo?.account_name || invoice.bank_transfer.account_name}</p>
                <p className="mt-1"><strong className="text-white">Account number:</strong> {bankTransferInfo?.account_number || invoice.bank_transfer.account_number}</p>
                <p className="mt-1"><strong className="text-white">Amount:</strong> {bankTransferInfo?.amount || invoice.total}</p>
                <p className="mt-1"><strong className="text-white">Reference:</strong> {bankTransferInfo?.reference || invoice.invoice_number}</p>
                {bankTransferInfo?.message && <p className="mt-3 text-white/60">{bankTransferInfo.message}</p>}

                <div className="mt-4 border-t border-white/10 pt-4">
                  <p className="text-xs font-black uppercase text-white/50">Step 2 — Upload your proof of payment</p>
                  <label
                    htmlFor="receipt-upload"
                    className="mt-2 flex cursor-pointer flex-col items-center gap-1.5 rounded-lg border-2 border-dashed border-primary/40 bg-primary/5 p-4 text-center transition hover:border-primary hover:bg-primary/10"
                  >
                    {receiptFile ? (
                      <>
                        <CheckCircle2 className="h-6 w-6 text-primary" />
                        <span className="text-xs font-bold text-white">{receiptFile.name}</span>
                        <span className="text-[10px] text-white/50">Click to choose a different file</span>
                      </>
                    ) : (
                      <>
                        <Upload className="h-6 w-6 text-primary" />
                        <span className="text-xs font-bold text-white">Click here to upload your receipt or screenshot</span>
                        <span className="text-[10px] text-white/50">JPG, PNG or PDF, up to 5MB</span>
                      </>
                    )}
                  </label>
                  <input
                    id="receipt-upload"
                    type="file"
                    accept="image/png,image/jpeg,application/pdf"
                    className="hidden"
                    onChange={(event) => setReceiptFile(event.target.files?.[0] || null)}
                  />
                  {receiptFile && (
                    <button
                      type="button"
                      className="mt-2 flex items-center gap-1 text-[10px] font-bold text-white/50 hover:text-white/80"
                      onClick={() => setReceiptFile(null)}
                    >
                      <X className="h-3 w-3" /> Remove file
                    </button>
                  )}
                  <button
                    type="button"
                    className="btn-primary mt-3 w-full justify-center !min-h-9 !py-1.5 !text-[11px]"
                    disabled={!receiptFile || isUploadingProof}
                    onClick={() => void uploadProof()}
                  >
                    {isUploadingProof ? "Uploading..." : "Submit Proof of Payment"}
                  </button>
                </div>

                <button
                  type="button"
                  className="mt-3 text-xs font-bold text-primary underline"
                  onClick={() => {
                    setHasDismissedBankTransfer(true);
                    onResetBankTransfer();
                  }}
                >
                  Choose a different payment method
                </button>
              </div>
            )}
          </div>
        )}

        <div className="grid gap-4 border-b border-white/10 p-6 sm:grid-cols-2">
          <div className="rounded-lg border border-white/10 bg-white/[0.03] p-4">
            <p className="text-[10px] font-black uppercase text-primary">From</p>
            <p className="mt-2 text-sm font-black text-white">{invoice.from.name}</p>
            {invoice.from.address_lines.filter(Boolean).map((line) => (
              <p key={line} className="text-sm text-white/60">{line}</p>
            ))}
            {invoice.from.phone && <p className="mt-2 text-sm text-white/60">{invoice.from.phone}</p>}
            {invoice.from.email && <p className="text-sm text-white/60">{invoice.from.email}</p>}
            {invoice.from.website && <p className="text-sm text-white/60">{invoice.from.website}</p>}
            {(invoice.from.rc_number || invoice.from.tin) && (
              <p className="mt-2 text-xs text-white/40">
                {invoice.from.rc_number && <>RC: {invoice.from.rc_number} </>}
                {invoice.from.tin && <>TIN: {invoice.from.tin}</>}
              </p>
            )}
          </div>
          <div className="rounded-lg border border-white/10 bg-white/[0.03] p-4">
            <p className="text-[10px] font-black uppercase text-primary">Bill To</p>
            <p className="mt-2 text-sm font-black text-white">{invoice.bill_to.name}</p>
            {invoice.bill_to.address_lines.filter(Boolean).map((line) => (
              <p key={line} className="text-sm text-white/60">{line}</p>
            ))}
            {invoice.bill_to.email && <p className="mt-2 text-sm text-white/60">{invoice.bill_to.email}</p>}
            {invoice.bill_to.phone && <p className="text-sm text-white/60">{invoice.bill_to.phone}</p>}
            {invoice.bill_to.tax_id && <p className="mt-2 text-xs text-white/40">TIN: {invoice.bill_to.tax_id}</p>}
          </div>
        </div>

        <div className="overflow-x-auto border-b border-white/10">
          <table className="w-full min-w-[480px] text-left text-sm">
            <thead>
              <tr className="bg-black/30 text-[10px] font-black uppercase text-white/45">
                <th className="p-4">#</th>
                <th className="p-4">Description</th>
                <th className="p-4 text-right">Qty</th>
                <th className="p-4 text-right">Unit Price</th>
                <th className="p-4 text-right">Amount</th>
              </tr>
            </thead>
            <tbody>
              {invoice.line_items.map((item, index) => (
                <tr key={`${item.description}-${index}`} className="border-t border-white/5">
                  <td className="p-4 text-white/50">{index + 1}</td>
                  <td className="p-4 font-bold text-white">{item.description}</td>
                  <td className="p-4 text-right text-white/70">{item.quantity}</td>
                  <td className="p-4 text-right text-white/70">{item.unit_price}</td>
                  <td className="p-4 text-right font-bold text-white">{item.total}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>

        <div className="grid gap-4 p-6 sm:grid-cols-2">
          <div className="rounded-lg border border-white/10 bg-white/[0.03] p-4 text-sm">
            <p className="text-[10px] font-black uppercase text-primary">Payment Details</p>
            <p className="mt-2 text-white/60"><strong className="text-white">Bank:</strong> {invoice.bank_transfer.bank_name}</p>
            <p className="mt-1 text-white/60"><strong className="text-white">Account Name:</strong> {invoice.bank_transfer.account_name}</p>
            <p className="mt-1 text-white/60"><strong className="text-white">Account Number:</strong> {invoice.bank_transfer.account_number}</p>
            <p className="mt-2 text-xs text-white/40">Kindly include the invoice number as payment reference.</p>
          </div>
          <div className="rounded-lg border border-white/10 bg-black/30 p-4 text-sm">
            <div className="flex items-center justify-between"><span className="text-white/60">Subtotal</span><strong className="text-white">{invoice.subtotal}</strong></div>
            <div className="mt-2 flex items-center justify-between"><span className="text-white/60">Discount</span><strong className="text-white">{invoice.discount}</strong></div>
            <div className="mt-2 flex items-center justify-between"><span className="text-white/60">{invoice.vat_label}</span><strong className="text-white">{invoice.tax}</strong></div>
            <div className="mt-3 flex items-center justify-between border-t border-primary/25 pt-3"><span className="font-black text-white">Total Payable</span><strong className="text-lg text-primary">{invoice.total}</strong></div>
            <div className="mt-2 flex items-center justify-between"><span className="text-white/60">Amount Paid</span><strong className="text-white">{invoice.amount_paid}</strong></div>
            {invoice.wallet_amount_applied_kobo > 0 && (
              <div className="mt-2 flex items-center justify-between"><span className="text-white/60">Wallet Credit Applied</span><strong className="text-white">{invoice.wallet_amount_applied}</strong></div>
            )}
            {invoice.overpayment_amount_kobo > 0 && (
              <div className="mt-2 flex items-center justify-between"><span className="text-white/60">Overpayment (saved to wallet)</span><strong className="text-white">{invoice.overpayment_amount}</strong></div>
            )}
            {invoice.underpayment_amount_kobo > 0 && (
              <div className="mt-2 flex items-center justify-between"><span className="text-white/60">Underpayment</span><strong className="text-white">{invoice.underpayment_amount}</strong></div>
            )}
            <div className="mt-2 flex items-center justify-between"><span className="font-black text-white">Outstanding Balance</span><strong className="text-white">{invoice.outstanding_amount || invoice.balance_due}</strong></div>
          </div>
        </div>

        <div className="border-t border-white/10 bg-black/30 p-6 text-xs text-white/40">
          <p>Payment is due by the date shown above. Late payments may attract additional charges.</p>
          <p className="mt-1">All services are delivered electronically. Thank you for choosing NAI TALK SERVICES.</p>
        </div>
      </div>
    </div>
  );
}

function ClientWalletPage({ token, toast }: { token: string; toast: ReturnType<typeof useToast> }) {
  const [wallet, setWallet] = useState<WalletSummary | null>(null);
  const [transactions, setTransactions] = useState<WalletTransactionRow[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [isFunding, setIsFunding] = useState<"paystack" | "flutterwave" | null>(null);
  const [fundAmount, setFundAmount] = useState("5000");

  const loadWallet = React.useCallback(() => {
    setIsLoading(true);
    return Promise.all([
      laravelApi<WalletSummary>("/api/v1/client/wallet", token),
      laravelApi<{ data: WalletTransactionRow[] }>("/api/v1/client/wallet/transactions", token),
    ])
      .then(([summary, history]) => {
        setWallet(summary);
        setTransactions(history.data || []);
      })
      .catch((error) => toast.push({ type: "error", message: error instanceof Error ? error.message : "Could not load your wallet." }))
      .finally(() => setIsLoading(false));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [token]);

  useEffect(() => {
    void loadWallet();
  }, [loadWallet]);

  const fundWallet = async (gateway: "paystack" | "flutterwave") => {
    const amountNaira = Number(fundAmount);
    if (!amountNaira || amountNaira <= 0) {
      toast.push({ type: "error", message: "Enter a valid amount to fund." });
      return;
    }

    setIsFunding(gateway);

    try {
      const data = await laravelApi<{ authorization_url?: string; link?: string }>(`/api/v1/client/wallet/fund/${gateway}`, token, {
        method: "POST",
        body: JSON.stringify({ amount_kobo: Math.round(amountNaira * 100) }),
      });
      const redirectUrl = data.authorization_url || data.link;
      if (!redirectUrl) throw new Error("Could not start wallet funding.");
      window.location.href = redirectUrl;
    } catch (error) {
      toast.push({ type: "error", message: error instanceof Error ? error.message : "Could not start wallet funding." });
      setIsFunding(null);
    }
  };

  return (
    <section>
      <h2 className="text-2xl font-black text-white">Wallet</h2>
      <p className="mt-1 text-sm text-white/55">Fund your wallet, apply it to invoices, and review your transaction history.</p>

      <div className="mt-5 grid gap-5 lg:grid-cols-[280px_1fr]">
        <div className="portal-card">
          <p className="text-[10px] font-black uppercase text-white/40">Current Balance</p>
          <h3 className="mt-2 text-3xl font-black text-white">{isLoading ? "…" : wallet?.balance || "₦0"}</h3>
          <div className="mt-5 border-t border-white/10 pt-4">
            <label className="admin-field">
              <span>Amount to fund (₦)</span>
              <input
                type="number"
                min={100}
                value={fundAmount}
                onChange={(event) => setFundAmount(event.target.value)}
              />
            </label>
            <div className="mt-3 grid gap-2">
              <button
                type="button"
                className="btn-primary justify-center !min-h-9 !px-3 !py-1.5 !text-[11px]"
                disabled={isFunding !== null}
                onClick={() => void fundWallet("paystack")}
              >
                {isFunding === "paystack" ? "Redirecting..." : "Fund with Paystack"}
              </button>
              <button
                type="button"
                className="btn-outline justify-center !min-h-9 !px-3 !py-1.5 !text-[11px]"
                disabled={isFunding !== null}
                onClick={() => void fundWallet("flutterwave")}
              >
                {isFunding === "flutterwave" ? "Redirecting..." : "Fund with Flutterwave"}
              </button>
            </div>
          </div>
        </div>

        <div className="portal-card overflow-x-auto">
          <p className="text-[10px] font-black uppercase text-white/40">Transaction History</p>
          {isLoading ? (
            <p className="mt-4 text-sm text-white/55">Loading transactions...</p>
          ) : transactions.length === 0 ? (
            <p className="mt-4 text-sm text-white/55">No wallet transactions yet.</p>
          ) : (
            <table className="admin-table mt-4 w-full min-w-[560px]">
              <thead>
                <tr>
                  <th>Date</th>
                  <th>Type</th>
                  <th>Reference</th>
                  <th>Amount</th>
                  <th>Balance After</th>
                  <th>Status</th>
                </tr>
              </thead>
              <tbody>
                {transactions.map((txn) => (
                  <tr key={txn.id}>
                    <td>{new Date(txn.created_at).toLocaleString()}</td>
                    <td>
                      {txn.type.replaceAll("_", " ")}
                      {(txn.invoice_number || txn.order_number) && (
                        <small className="block text-white/40">
                          {txn.invoice_number ? `Invoice ${txn.invoice_number}` : `Order ${txn.order_number}`}
                        </small>
                      )}
                    </td>
                    <td>{txn.payment_reference || "—"}</td>
                    <td className={txn.direction === "credit" ? "text-primary" : "text-white/70"}>
                      {txn.direction === "credit" ? "+" : "-"}{txn.amount}
                    </td>
                    <td>{txn.balance_after}</td>
                    <td><span className="status-pill paid">{txn.status}</span></td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </div>
      </div>
    </section>
  );
}

function ClientPaymentMethodsPage({ token, toast }: { token: string; toast: ReturnType<typeof useToast> }) {
  const [methods, setMethods] = useState<SavedPaymentMethodRow[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [busyId, setBusyId] = useState<number | null>(null);

  const loadMethods = React.useCallback(() => {
    setIsLoading(true);
    return laravelApi<{ data: SavedPaymentMethodRow[] }>("/api/v1/client/payment-methods", token)
      .then((response) => setMethods(response.data || []))
      .catch((error) => toast.push({ type: "error", message: error instanceof Error ? error.message : "Could not load saved payment methods." }))
      .finally(() => setIsLoading(false));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [token]);

  useEffect(() => {
    void loadMethods();
  }, [loadMethods]);

  const updateMethod = async (id: number, payload: Partial<Pick<SavedPaymentMethodRow, "is_active" | "use_for_auto_renewal" | "is_default">>) => {
    setBusyId(id);

    try {
      await laravelApi(`/api/v1/client/payment-methods/${id}`, token, { method: "PATCH", body: JSON.stringify(payload) });
      await loadMethods();
    } catch (error) {
      toast.push({ type: "error", message: error instanceof Error ? error.message : "Could not update this payment method." });
    } finally {
      setBusyId(null);
    }
  };

  const deleteMethod = async (id: number) => {
    setBusyId(id);

    try {
      await laravelApi(`/api/v1/client/payment-methods/${id}`, token, { method: "DELETE" });
      toast.push({ type: "success", message: "Payment method removed." });
      await loadMethods();
    } catch (error) {
      toast.push({ type: "error", message: error instanceof Error ? error.message : "Could not remove this payment method." });
    } finally {
      setBusyId(null);
    }
  };

  return (
    <section>
      <h2 className="text-2xl font-black text-white">Saved Payment Methods</h2>
      <p className="mt-1 text-sm text-white/55">
        Cards are saved automatically after a successful Paystack or Flutterwave payment — only a safe provider token is stored, never your
        full card number or CVV.
      </p>

      <div className="mt-5 grid gap-3">
        {isLoading ? (
          <p className="text-sm text-white/55">Loading saved payment methods...</p>
        ) : methods.length === 0 ? (
          <div className="portal-card text-sm text-white/55">No saved payment methods yet. Pay an invoice online to save a card here.</div>
        ) : (
          methods.map((method) => (
            <div key={method.id} className="portal-card">
              <div className="flex flex-wrap items-center justify-between gap-3">
                <div className="flex items-center gap-3">
                  <div className="row-icon"><CreditCard className="h-4 w-4" /></div>
                  <div>
                    <p className="font-black text-white">
                      {(method.card_brand || method.payment_provider).toUpperCase()} •••• {method.last4 || "----"}
                      {method.is_default && <span className="ml-2 status-pill paid">Default</span>}
                    </p>
                    <small className="text-white/45">
                      {method.exp_month && method.exp_year ? `Expires ${method.exp_month}/${method.exp_year} — ` : ""}
                      Added {new Date(method.created_at).toLocaleDateString()} via {method.payment_provider}
                    </small>
                  </div>
                </div>
                <span className={method.is_active ? "status-pill paid" : "status-pill failed"}>{method.is_active ? "Active" : "Disabled"}</span>
              </div>

              <div className="mt-4 flex flex-wrap items-center gap-2 border-t border-white/10 pt-4">
                <button
                  type="button"
                  className="btn-outline !min-h-9 !px-3 !py-1.5 !text-[11px]"
                  disabled={busyId === method.id}
                  onClick={() => void updateMethod(method.id, { is_active: !method.is_active })}
                >
                  {method.is_active ? "Disable card" : "Enable card"}
                </button>
                <button
                  type="button"
                  className="btn-outline !min-h-9 !px-3 !py-1.5 !text-[11px]"
                  disabled={busyId === method.id}
                  onClick={() => void updateMethod(method.id, { use_for_auto_renewal: !method.use_for_auto_renewal })}
                >
                  {method.use_for_auto_renewal ? "Disable auto-renewal use" : "Enable for auto-renewal"}
                </button>
                {!method.is_default && (
                  <button
                    type="button"
                    className="btn-outline !min-h-9 !px-3 !py-1.5 !text-[11px]"
                    disabled={busyId === method.id}
                    onClick={() => void updateMethod(method.id, { is_default: true })}
                  >
                    Set as default
                  </button>
                )}
                <button
                  type="button"
                  className="btn-outline !min-h-9 !px-3 !py-1.5 !text-[11px] !text-red-300"
                  disabled={busyId === method.id}
                  onClick={() => void deleteMethod(method.id)}
                >
                  <Trash2 className="h-3 w-3" /> Remove
                </button>
              </div>
            </div>
          ))
        )}
      </div>
    </section>
  );
}

type DomainSuggestion = {
  domain: string;
  tld: string;
  registration_price_kobo: number;
  renewal_price_kobo: number;
  currency: string;
};

type DomainSearchResult = {
  domain: string;
  tld: string;
  available: boolean;
  tld_supported: boolean;
  premium: boolean;
  registration_price_kobo: number | null;
  renewal_price_kobo: number | null;
  transfer_price_kobo: number | null;
  currency: string | null;
  suggestions: DomainSuggestion[];
};

type DomainCheckoutResult = {
  order: { order_number: string };
  invoice: { invoice_number: string; total_kobo: number; total?: string };
};

function DomainSearchPage({
  navigate,
  toast,
}: {
  navigate: (path: string) => void;
  toast: ReturnType<typeof useToast>;
}) {
  const [domainInput, setDomainInput] = useState("");
  const [isSearching, setIsSearching] = useState(false);
  const [result, setResult] = useState<DomainSearchResult | null>(null);
  const [hasSearched, setHasSearched] = useState(false);

  const search = async () => {
    const domain = domainInput.trim().toLowerCase();
    if (!domain) return;
    setIsSearching(true);
    setResult(null);

    const domainExtension = domain.includes(".") ? domain.slice(domain.lastIndexOf(".")) : undefined;
    trackDomainSearch("query", { domain_extension: domainExtension });

    try {
      const data = await laravelApi<DomainSearchResult>(`/api/v1/public/domains/search?domain=${encodeURIComponent(domain)}`);
      setResult(data);
      setHasSearched(true);
      trackDomainSearch("result", { domain_extension: domainExtension, available: data.available });
    } catch (error) {
      toast.push({
        type: "error",
        message: error instanceof Error ? error.message : "Domain search is temporarily unavailable. Please try again shortly.",
      });
    } finally {
      setIsSearching(false);
    }
  };

  const hasPricing = result !== null && result.registration_price_kobo !== null;

  return (
    <section>
      <h2 className="text-2xl font-black text-white">Search Domains</h2>
      <p className="mt-1 text-sm text-white/55">Find and register a new domain, or add hosting to a domain you already own.</p>

      <div className="portal-card mt-5 max-w-xl">
        <div className="flex flex-col gap-2 sm:flex-row">
          <div className="flex flex-1 items-center gap-2 rounded-lg border border-white/10 bg-[#041015] px-4 py-3 transition focus-within:border-accent-cyan/55">
            <Search className="h-4 w-4 shrink-0 text-white/40" aria-hidden="true" />
            <input
              className="w-full bg-transparent text-sm text-white outline-none placeholder:text-white/32"
              placeholder="Search a domain, e.g. yourbusiness.com"
              value={domainInput}
              onChange={(event) => setDomainInput(event.target.value)}
              onKeyDown={(event) => event.key === "Enter" && void search()}
            />
          </div>
          <button type="button" className="btn-primary justify-center !text-[11px]" disabled={isSearching || !domainInput.trim()} onClick={() => void search()}>
            {isSearching ? "Searching..." : "Search"}
          </button>
        </div>

        <p className="mt-3 text-xs text-white/45">
          Looking to transfer a domain you already own?{" "}
          <button type="button" className="font-bold text-primary underline" onClick={() => navigate("/client/domains/transfer")}>
            Transfer it here
          </button>
        </p>

        {hasSearched && result && (
          <div className="mt-5 rounded-lg border border-white/10 bg-black/20 p-4">
            <div className="flex items-center justify-between">
              <p className="text-lg font-black text-white">{result.domain}</p>
              <span className={result.available ? "status-pill paid" : "status-pill failed"}>
                {result.available ? "Available" : result.tld_supported ? "Not Available" : "Not Supported"}
              </span>
            </div>

            {result.available && result.premium && <p className="mt-2 text-xs font-bold uppercase text-yellow-300">Premium domain</p>}

            {result.available && hasPricing && (
              <>
                <div className="mt-3 grid gap-1 text-sm text-white/70">
                  <div className="flex items-center justify-between">
                    <span>Registration (1 year)</span>
                    <strong className="text-white">{formatNaira((result.registration_price_kobo || 0) / 100)}</strong>
                  </div>
                  {result.renewal_price_kobo !== null && (
                    <div className="flex items-center justify-between">
                      <span>Renewal (per year)</span>
                      <strong className="text-white">{formatNaira(result.renewal_price_kobo / 100)}</strong>
                    </div>
                  )}
                </div>
                <div className="mt-4 grid gap-2 sm:grid-cols-2">
                  <button
                    type="button"
                    className="btn-primary justify-center !text-[11px]"
                    onClick={() => navigate(`/client/domains/checkout?domain=${encodeURIComponent(result.domain)}`)}
                  >
                    Buy Domain Only
                  </button>
                  <button
                    type="button"
                    className="btn-outline justify-center !text-[11px]"
                    onClick={() => navigate(`/client/order/hosting?domain=${encodeURIComponent(result.domain)}&register_domain=1`)}
                  >
                    Buy Domain + Hosting
                  </button>
                </div>
              </>
            )}

            {result.available && !hasPricing && (
              <p className="mt-3 text-sm text-white/60">
                Pricing for this domain extension is being finalized. Please contact NAI TALK support to register it.
              </p>
            )}

            {!result.available && !result.tld_supported && (
              <p className="mt-3 text-sm text-white/60">
                This domain extension isn't currently supported for registration. Please try .com, .org, .net, or a
                different name.
              </p>
            )}

            {!result.available && result.tld_supported && (
              <>
                <p className="mt-3 text-sm text-white/60">This domain is already taken. Here are some available alternatives:</p>
                {result.suggestions.length > 0 ? (
                  <div className="mt-3 grid gap-2 sm:grid-cols-2">
                    {result.suggestions.map((suggestion) => (
                      <button
                        key={suggestion.domain}
                        type="button"
                        onClick={() => navigate(`/client/domains/checkout?domain=${encodeURIComponent(suggestion.domain)}`)}
                        className="flex items-center justify-between gap-2 rounded-lg border border-white/10 bg-white/[0.03] px-3 py-2 text-left transition hover:border-primary/40"
                      >
                        <span className="text-xs font-bold text-white">{suggestion.domain}</span>
                        <span className="text-[11px] font-black text-primary">
                          {formatNaira(suggestion.registration_price_kobo / 100)}
                        </span>
                      </button>
                    ))}
                  </div>
                ) : (
                  <p className="mt-2 text-xs text-white/40">No alternatives found right now — try a different name.</p>
                )}
              </>
            )}
          </div>
        )}
      </div>
    </section>
  );
}

function DomainOnlyCheckoutPage({
  token,
  domainName,
  navigate,
  toast,
  isInitiatingPayment,
  onPayWithGateway,
  onPayByBankTransfer,
}: {
  token: string;
  domainName: string | null;
  navigate: (path: string) => void;
  toast: ReturnType<typeof useToast>;
  isInitiatingPayment: boolean;
  onPayWithGateway: (invoiceNumber: string, gateway: "paystack" | "flutterwave") => Promise<void>;
  onPayByBankTransfer: (invoiceNumber: string) => Promise<void>;
}) {
  const [order, setOrder] = useState<DomainCheckoutResult | null>(null);
  const [isCreating, setIsCreating] = useState(true);
  const hasCreatedRef = React.useRef(false);

  useEffect(() => {
    if (hasCreatedRef.current || !domainName) return;
    hasCreatedRef.current = true;
    setIsCreating(true);

    laravelApi<DomainCheckoutResult>("/api/v1/client/domains/orders", token, {
      method: "POST",
      body: JSON.stringify({ domain_name: domainName }),
    })
      .then(setOrder)
      .catch((error) => toast.push({ type: "error", message: error instanceof Error ? error.message : "Could not create your domain order." }))
      .finally(() => setIsCreating(false));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [domainName, token]);

  if (!domainName) {
    return (
      <section className="portal-card mx-auto max-w-lg text-center">
        <p className="text-sm text-white/60">No domain selected. Please search for a domain first.</p>
        <button type="button" className="btn-primary mt-4 justify-center" onClick={() => navigate("/client/domains/search")}>
          Search Domains
        </button>
      </section>
    );
  }

  if (isCreating || !order) {
    return (
      <div className="flex min-h-[40vh] items-center justify-center text-white/50">
        <Loader2 className="h-6 w-6 animate-spin" />
      </div>
    );
  }

  return (
    <section className="mx-auto max-w-xl portal-card text-center">
      <h2 className="text-xl font-black text-white">Domain Checkout</h2>
      <p className="mt-3 text-sm text-white/60">
        Order {order.order.order_number} created. Invoice <strong className="text-white">{order.invoice.invoice_number}</strong> for{" "}
        <strong className="text-white">{order.invoice.total || formatNaira(order.invoice.total_kobo / 100)}</strong> has been emailed to you.
      </p>
      <p className="mt-2 text-sm text-white/60">Choose how you'd like to pay:</p>
      <div className="mt-5">
        <PaymentOptionsPanel
          token={token}
          invoiceNumber={order.invoice.invoice_number}
          outstandingKobo={order.invoice.total_kobo}
          walletMode="full-only"
          isInitiatingPayment={isInitiatingPayment}
          onPayWithGateway={onPayWithGateway}
          onPayByBankTransfer={onPayByBankTransfer}
          toast={toast}
          onPaid={() => navigate(`/client/orders/${order.order.order_number}`)}
        />
      </div>
      <button type="button" className="btn-outline mt-2 w-full justify-center !min-h-9 !py-1.5 !text-[11px]" onClick={() => navigate("/client/orders")}>
        Pay Later
      </button>
    </section>
  );
}

function DomainTransferPage({
  token,
  navigate,
  toast,
  isInitiatingPayment,
  onPayWithGateway,
  onPayByBankTransfer,
}: {
  token: string;
  navigate: (path: string) => void;
  toast: ReturnType<typeof useToast>;
  isInitiatingPayment: boolean;
  onPayWithGateway: (invoiceNumber: string, gateway: "paystack" | "flutterwave") => Promise<void>;
  onPayByBankTransfer: (invoiceNumber: string) => Promise<void>;
}) {
  const [domainName, setDomainName] = useState("");
  const [eppCode, setEppCode] = useState("");
  const [isCheckingEligibility, setIsCheckingEligibility] = useState(false);
  const [eligibility, setEligibility] = useState<{ eligible: boolean; status: string } | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [order, setOrder] = useState<DomainCheckoutResult | null>(null);

  const checkEligibility = async () => {
    if (!domainName.trim()) return;
    setIsCheckingEligibility(true);
    setEligibility(null);

    try {
      const data = await laravelApi<{ eligible: boolean; status: string }>(
        `/api/v1/client/domains/transfers/eligibility?domain=${encodeURIComponent(domainName.trim().toLowerCase())}`,
        token,
      );
      setEligibility(data);
    } catch (error) {
      toast.push({ type: "error", message: error instanceof Error ? error.message : "Transfer eligibility check is temporarily unavailable." });
    } finally {
      setIsCheckingEligibility(false);
    }
  };

  const submitTransfer = async () => {
    if (!domainName.trim() || !eppCode.trim()) {
      toast.push({ type: "error", message: "Please enter both the domain name and your EPP/auth code." });

      return;
    }

    setIsSubmitting(true);

    try {
      const data = await laravelApi<DomainCheckoutResult>("/api/v1/client/domains/transfers", token, {
        method: "POST",
        body: JSON.stringify({ domain_name: domainName.trim().toLowerCase(), epp_code: eppCode.trim() }),
      });
      setOrder(data);
    } catch (error) {
      toast.push({ type: "error", message: error instanceof Error ? error.message : "Could not start this domain transfer." });
    } finally {
      setIsSubmitting(false);
    }
  };

  if (order) {
    return (
      <section className="mx-auto max-w-xl portal-card text-center">
        <h2 className="text-xl font-black text-white">Domain Transfer Checkout</h2>
        <p className="mt-3 text-sm text-white/60">
          Transfer order {order.order.order_number} created. Invoice <strong className="text-white">{order.invoice.invoice_number}</strong> for{" "}
          <strong className="text-white">{order.invoice.total || formatNaira(order.invoice.total_kobo / 100)}</strong> has been emailed to you.
        </p>
        <p className="mt-2 text-sm text-white/60">Choose how you'd like to pay:</p>
        <div className="mt-5">
          <PaymentOptionsPanel
            token={token}
            invoiceNumber={order.invoice.invoice_number}
            outstandingKobo={order.invoice.total_kobo}
            walletMode="full-only"
            isInitiatingPayment={isInitiatingPayment}
            onPayWithGateway={onPayWithGateway}
            onPayByBankTransfer={onPayByBankTransfer}
            toast={toast}
            onPaid={() => navigate(`/client/orders/${order.order.order_number}`)}
          />
        </div>
      </section>
    );
  }

  return (
    <section className="mx-auto max-w-xl">
      <h2 className="text-2xl font-black text-white">Transfer a Domain to NAI TALK</h2>
      <p className="mt-1 text-sm text-white/55">Enter the domain and the EPP/auth code from your current registrar.</p>

      <div className="portal-card mt-5">
        <label className="admin-field">
          <span>Domain name</span>
          <input value={domainName} onChange={(event) => setDomainName(event.target.value)} placeholder="yourbusiness.com" />
        </label>
        <label className="admin-field mt-3">
          <span>EPP / Auth Code</span>
          <input value={eppCode} onChange={(event) => setEppCode(event.target.value)} placeholder="Provided by your current registrar" />
        </label>

        <button
          type="button"
          className="btn-outline mt-4 w-full justify-center"
          disabled={isCheckingEligibility || !domainName.trim()}
          onClick={() => void checkEligibility()}
        >
          {isCheckingEligibility ? "Checking..." : "Check Transfer Eligibility"}
        </button>

        {eligibility && (
          <p className="mt-3 text-sm text-white/60">
            {eligibility.eligible
              ? "This domain looks eligible for transfer. You can proceed below."
              : "We could not automatically confirm eligibility — you can still proceed, and our team will review it."}
          </p>
        )}

        <button
          type="button"
          className="btn-primary mt-4 w-full justify-center"
          disabled={isSubmitting || !domainName.trim() || !eppCode.trim()}
          onClick={() => void submitTransfer()}
        >
          {isSubmitting ? "Submitting..." : "Proceed to Checkout"}
        </button>
      </div>
    </section>
  );
}

type DomainRenewalHistoryEntry = {
  date: string | null;
  amount_kobo: number;
  status: string;
  invoice_number: string | null;
};

type DomainRow = {
  id: number;
  domain_name: string;
  tld: string;
  source: string;
  source_label: string;
  provider_label: string;
  status: string;
  registration_status: string;
  transfer_status: string | null;
  registered_at: string | null;
  expires_at: string | null;
  days_to_expiry: number | null;
  renewal_due: boolean;
  auto_renew: boolean;
  linked_hosting_service: { id: number; service_number: string; status: string } | null;
  can_add_hosting: boolean;
  shows_dns_instructions: boolean;
  server_hostname: string | null;
  nameservers: string[] | null;
  dns_status: string | null;
  next_invoice_date: string | null;
  next_renewal_amount_kobo: number | null;
  payment_status: string | null;
  registrar_operation_status_label: string | null;
  renewal_history: DomainRenewalHistoryEntry[];
};

function ClientDomainsPage({
  token,
  navigate,
  toast,
}: {
  token: string;
  navigate: (path: string) => void;
  toast: ReturnType<typeof useToast>;
}) {
  const [domains, setDomains] = useState<DomainRow[] | null>(null);
  const [busyId, setBusyId] = useState<number | null>(null);

  const load = React.useCallback(() => {
    laravelApi<{ data: DomainRow[] }>("/api/v1/client/domains", token)
      .then((response) => setDomains(response.data || []))
      .catch(() => setDomains([]));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [token]);

  useEffect(() => {
    load();
  }, [load]);

  const toggleAutoRenew = async (domain: DomainRow) => {
    setBusyId(domain.id);

    try {
      const data = await laravelApi<{ auto_renew_confirmation_pending?: boolean }>(`/api/v1/client/domains/${domain.id}/auto-renew`, token, {
        method: "PATCH",
        body: JSON.stringify({ auto_renew: !domain.auto_renew }),
      });
      if (data.auto_renew_confirmation_pending) {
        toast.push({ type: "info", message: "Auto-renew change requested — this will be confirmed shortly." });
      }
      load();
    } catch (error) {
      toast.push({ type: "error", message: error instanceof Error ? error.message : "Could not update auto-renew." });
    } finally {
      setBusyId(null);
    }
  };

  const renewDomain = async (domain: DomainRow) => {
    setBusyId(domain.id);

    try {
      const data = await laravelApi<{ invoice_number: string | null }>(`/api/v1/client/domains/${domain.id}/renew`, token, {
        method: "POST",
      });

      if (data.invoice_number) {
        navigate(`/client/orders/${data.invoice_number}`);
      } else {
        toast.push({ type: "info", message: "A renewal invoice already exists for this domain." });
        load();
      }
    } catch (error) {
      toast.push({ type: "error", message: error instanceof Error ? error.message : "Could not start renewal." });
    } finally {
      setBusyId(null);
    }
  };

  if (domains === null) {
    return (
      <div className="flex min-h-[40vh] items-center justify-center text-white/50">
        <Loader2 className="h-6 w-6 animate-spin" />
      </div>
    );
  }

  return (
    <section>
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h2 className="text-2xl font-black text-white">My Domains</h2>
          <p className="mt-1 text-sm text-white/55">Manage domains you've registered, transferred, or connected to NAI TALK.</p>
        </div>
        <div className="flex gap-2">
          <button type="button" className="btn-outline justify-center !text-[11px]" onClick={() => navigate("/client/domain-contact")}>
            Contact Profile
          </button>
          <button type="button" className="btn-primary justify-center !text-[11px]" onClick={() => navigate("/client/domains/search")}>
            Search Domains
          </button>
        </div>
      </div>

      {domains.length === 0 ? (
        <div className="portal-card mt-6 text-center text-sm text-white/55">You don't have any domains yet.</div>
      ) : (
        <div className="mt-6 grid gap-4">
          {domains.map((domain) => (
            <div key={domain.id} className="portal-card">
              <div className="flex flex-wrap items-center justify-between gap-2">
                <div>
                  <p className="text-lg font-black text-white">{domain.domain_name}</p>
                  <p className="text-xs text-white/45">
                    {domain.source_label} • {domain.provider_label}
                  </p>
                </div>
                <span className={domain.status === "active" ? "status-pill paid" : "status-pill failed"}>
                  {domain.registration_status === "awaiting_manual_registration"
                    ? "Provisioning — active within 24 hours"
                    : domain.status}
                </span>
              </div>

              <div className="mt-4 grid gap-1 text-sm text-white/68 sm:grid-cols-2">
                <p>
                  <strong className="text-white">Registered:</strong> {domain.registered_at || "—"}
                </p>
                <p>
                  <strong className="text-white">Expires:</strong> {domain.expires_at || "—"}
                </p>
                {domain.transfer_status && (
                  <p>
                    <strong className="text-white">Transfer status:</strong> {domain.transfer_status}
                  </p>
                )}
                <p>
                  <strong className="text-white">Linked hosting:</strong>{" "}
                  {domain.linked_hosting_service ? domain.linked_hosting_service.service_number : "None"}
                </p>
                {domain.next_renewal_amount_kobo !== null && (
                  <p>
                    <strong className="text-white">Next renewal amount:</strong> {formatKobo(domain.next_renewal_amount_kobo)}
                  </p>
                )}
                {domain.next_invoice_date && (
                  <p>
                    <strong className="text-white">Next invoice date:</strong> {domain.next_invoice_date}
                  </p>
                )}
                {domain.payment_status && (
                  <p>
                    <strong className="text-white">Payment status:</strong> {domain.payment_status}
                  </p>
                )}
                {domain.registrar_operation_status_label && (
                  <p>
                    <strong className="text-white">Renewal status:</strong> {domain.registrar_operation_status_label}
                  </p>
                )}
              </div>

              {domain.nameservers && domain.nameservers.length > 0 && (
                <div className="mt-3 rounded-lg border border-white/10 bg-black/20 p-3 text-xs text-white/60">
                  <p>
                    <strong className="text-white">Nameservers:</strong> {domain.nameservers.join(", ")}
                  </p>
                  {domain.dns_status && (
                    <p className="mt-1">
                      <strong className="text-white">DNS status:</strong> {domain.dns_status}
                    </p>
                  )}
                </div>
              )}

              {domain.shows_dns_instructions && (
                <p className="mt-3 rounded-lg border border-white/10 bg-black/20 p-3 text-xs text-white/60">
                  Point this domain's DNS to <strong className="text-white">{domain.server_hostname}</strong> to connect your hosting.
                </p>
              )}

              {domain.renewal_history.length > 0 && (
                <details className="mt-3 rounded-lg border border-white/10 bg-black/20 p-3 text-xs text-white/60">
                  <summary className="cursor-pointer font-bold text-white">Renewal history</summary>
                  <div className="mt-2 grid gap-1">
                    {domain.renewal_history.map((entry, index) => (
                      <p key={`${entry.invoice_number || index}`}>
                        {entry.date || "—"} • {formatKobo(entry.amount_kobo)} • {entry.status}
                        {entry.invoice_number ? ` • ${entry.invoice_number}` : ""}
                      </p>
                    ))}
                  </div>
                </details>
              )}

              <div className="mt-4 flex flex-wrap items-center gap-2">
                <button
                  type="button"
                  className="btn-outline justify-center !text-[11px]"
                  disabled={busyId === domain.id}
                  onClick={() => void toggleAutoRenew(domain)}
                >
                  {domain.auto_renew ? "Disable Auto-Renew" : "Enable Auto-Renew"}
                </button>

                {domain.renewal_due && (
                  <button
                    type="button"
                    className="btn-primary justify-center !text-[11px]"
                    disabled={busyId === domain.id}
                    onClick={() => void renewDomain(domain)}
                  >
                    Renew Now
                  </button>
                )}

                {domain.can_add_hosting && (
                  <button type="button" className="btn-primary justify-center !text-[11px]" onClick={() => navigate(`/client/domains/${domain.id}`)}>
                    Add Hosting
                  </button>
                )}
              </div>
            </div>
          ))}
        </div>
      )}
    </section>
  );
}

function DomainAddHostingPage({
  token,
  domainId,
  navigate,
  toast,
  isInitiatingPayment,
  onPayWithGateway,
  onPayByBankTransfer,
}: {
  token: string;
  domainId: number | null;
  navigate: (path: string) => void;
  toast: ReturnType<typeof useToast>;
  isInitiatingPayment: boolean;
  onPayWithGateway: (invoiceNumber: string, gateway: "paystack" | "flutterwave") => Promise<void>;
  onPayByBankTransfer: (invoiceNumber: string) => Promise<void>;
}) {
  const [domain, setDomain] = useState<DomainRow | null>(null);
  const [plans, setPlans] = useState<Array<{ name: string; slug: string; monthly: string; annual: string }>>([]);
  const [planSlug, setPlanSlug] = useState("");
  const [billingCycle, setBillingCycle] = useState<"monthly" | "annual">("annual");
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [order, setOrder] = useState<DomainCheckoutResult | null>(null);

  useEffect(() => {
    if (!domainId) return;

    laravelApi<DomainRow>(`/api/v1/client/domains/${domainId}`, token)
      .then(setDomain)
      .catch(() => undefined);

    laravelApi<Array<Record<string, unknown>>>("/api/v1/public/hosting-plans")
      .then((data) => {
        const mapped = (data || []).map((plan) => ({
          name: String(plan.name || "Website Care Plan"),
          slug: String(plan.slug || ""),
          monthly: String(plan.monthly_price || "₦0"),
          annual: String(plan.annual_price || "₦0"),
        }));
        setPlans(mapped);
        setPlanSlug((current) => current || mapped[0]?.slug || "");
      })
      .catch(() => undefined);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [domainId, token]);

  const submit = async () => {
    if (!domainId || !planSlug) return;
    setIsSubmitting(true);

    try {
      const data = await laravelApi<DomainCheckoutResult>(`/api/v1/client/domains/${domainId}/hosting`, token, {
        method: "POST",
        body: JSON.stringify({ plan_slug: planSlug, billing_cycle: billingCycle, add_ons: [] }),
      });
      setOrder(data);
    } catch (error) {
      toast.push({ type: "error", message: error instanceof Error ? error.message : "Could not add hosting to this domain." });
    } finally {
      setIsSubmitting(false);
    }
  };

  if (!domainId) {
    return (
      <section className="portal-card mx-auto max-w-lg text-center">
        <p className="text-sm text-white/60">Domain not found.</p>
        <button type="button" className="btn-primary mt-4 justify-center" onClick={() => navigate("/client/domains")}>
          Back to Domains
        </button>
      </section>
    );
  }

  if (order) {
    return (
      <section className="mx-auto max-w-xl portal-card text-center">
        <h2 className="text-xl font-black text-white">Hosting Checkout</h2>
        <p className="mt-3 text-sm text-white/60">
          Order {order.order.order_number} created. Invoice <strong className="text-white">{order.invoice.invoice_number}</strong> for{" "}
          <strong className="text-white">{order.invoice.total || formatNaira(order.invoice.total_kobo / 100)}</strong> has been emailed to you.
        </p>
        <div className="mt-5">
          <PaymentOptionsPanel
            token={token}
            invoiceNumber={order.invoice.invoice_number}
            outstandingKobo={order.invoice.total_kobo}
            walletMode="full-only"
            isInitiatingPayment={isInitiatingPayment}
            onPayWithGateway={onPayWithGateway}
            onPayByBankTransfer={onPayByBankTransfer}
            toast={toast}
            onPaid={() => navigate(`/client/orders/${order.order.order_number}`)}
          />
        </div>
      </section>
    );
  }

  return (
    <section className="mx-auto max-w-xl">
      <h2 className="text-2xl font-black text-white">Add Hosting to {domain?.domain_name || "your domain"}</h2>
      <p className="mt-1 text-sm text-white/55">Choose a website care plan to connect to this domain.</p>

      <div className="portal-card mt-5">
        <div className="grid gap-3">
          {plans.map((plan) => (
            <label key={plan.slug} className={`client-service-row cursor-pointer ${planSlug === plan.slug ? "border-primary/50" : ""}`}>
              <input
                type="radio"
                name="add-hosting-plan"
                className="h-4 w-4"
                checked={planSlug === plan.slug}
                onChange={() => setPlanSlug(plan.slug)}
              />
              <div className="min-w-0 flex-1">
                <p>{plan.name}</p>
              </div>
              <strong>{billingCycle === "monthly" ? plan.monthly : plan.annual}</strong>
            </label>
          ))}
        </div>

        <div className="mt-5 flex items-center gap-3">
          <span className="text-sm font-bold text-white/68">Billing cycle</span>
          <div className="inline-flex overflow-hidden rounded-lg border border-white/10">
            {(["monthly", "annual"] as const).map((cycle) => (
              <button
                key={cycle}
                type="button"
                className={`px-4 py-2 text-xs font-black uppercase ${billingCycle === cycle ? "bg-primary text-on-primary" : "bg-transparent text-white/60"}`}
                onClick={() => setBillingCycle(cycle)}
              >
                {cycle}
              </button>
            ))}
          </div>
        </div>

        <button type="button" className="btn-primary mt-6 w-full justify-center" disabled={isSubmitting || !planSlug} onClick={() => void submit()}>
          {isSubmitting ? "Creating order..." : "Create Hosting Order"}
        </button>
      </div>
    </section>
  );
}

const INITIAL_DOMAIN_CONTACT = {
  full_name: "",
  company_name: "",
  email: "",
  phone: "",
  address: "",
  city: "",
  state: "",
  country: "",
  postal_code: "",
};

function DomainContactProfilePage({ token, toast }: { token: string; toast: ReturnType<typeof useToast> }) {
  const [form, setForm] = useState(INITIAL_DOMAIN_CONTACT);
  const [isLoading, setIsLoading] = useState(true);
  const [isSaving, setIsSaving] = useState(false);
  const [isComplete, setIsComplete] = useState(false);

  useEffect(() => {
    laravelApi<{ data: (typeof INITIAL_DOMAIN_CONTACT & { id: number }) | null; is_complete: boolean }>("/api/v1/client/domain-contact", token)
      .then((response) => {
        if (response.data) {
          setForm({
            full_name: response.data.full_name || "",
            company_name: response.data.company_name || "",
            email: response.data.email || "",
            phone: response.data.phone || "",
            address: response.data.address || "",
            city: response.data.city || "",
            state: response.data.state || "",
            country: response.data.country || "",
            postal_code: response.data.postal_code || "",
          });
        }
        setIsComplete(response.is_complete);
      })
      .catch(() => undefined)
      .finally(() => setIsLoading(false));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [token]);

  const field = (key: keyof typeof form, label: string, required = true) => (
    <label className="admin-field" key={key}>
      <span>
        {label}
        {required ? "" : " (optional)"}
      </span>
      <input value={form[key] || ""} onChange={(event) => setForm((current) => ({ ...current, [key]: event.target.value }))} />
    </label>
  );

  const save = async () => {
    setIsSaving(true);

    try {
      const response = await laravelApi<{ data: unknown; is_complete: boolean }>("/api/v1/client/domain-contact", token, {
        method: "PUT",
        body: JSON.stringify(form),
      });
      setIsComplete(response.is_complete);
      toast.push({ type: "success", message: "Domain contact details saved." });
    } catch (error) {
      toast.push({ type: "error", message: error instanceof Error ? error.message : "Could not save domain contact details." });
    } finally {
      setIsSaving(false);
    }
  };

  if (isLoading) {
    return (
      <div className="flex min-h-[40vh] items-center justify-center text-white/50">
        <Loader2 className="h-6 w-6 animate-spin" />
      </div>
    );
  }

  return (
    <section className="mx-auto max-w-xl">
      <h2 className="text-2xl font-black text-white">Domain Contact Profile</h2>
      <p className="mt-1 text-sm text-white/55">
        Required by domain registries as the registrant/admin/technical/billing contact for any domain you register or transfer.
      </p>

      {!isComplete && (
        <p className="mt-3 rounded-lg border border-yellow-400/30 bg-yellow-400/10 p-3 text-xs font-bold text-yellow-200">
          Complete this profile before you can register or transfer a domain.
        </p>
      )}

      <div className="portal-card mt-5 grid gap-3 sm:grid-cols-2">
        {field("full_name", "Full name")}
        {field("company_name", "Company name", false)}
        {field("email", "Email")}
        {field("phone", "Phone")}
        {field("address", "Address")}
        {field("city", "City")}
        {field("state", "State")}
        {field("country", "Country")}
        {field("postal_code", "Postal code")}
      </div>

      <button type="button" className="btn-primary mt-5 w-full justify-center" disabled={isSaving} onClick={() => void save()}>
        {isSaving ? "Saving..." : "Save Contact Profile"}
      </button>
    </section>
  );
}

type ClientProfileData = {
  customer_id: string;
  member_since: string | null;
  account_status: string;
  personal: {
    full_name: string;
    email: string;
    phone: string | null;
    country: string | null;
    state: string | null;
    city: string | null;
    address: string | null;
  };
  company: {
    business_name: string | null;
    website: string | null;
    industry: string | null;
    support_email: string | null;
    company_size: string | null;
    tax_id: string | null;
  };
  security: {
    two_factor_enabled: boolean;
    login_alerts_enabled: boolean;
    last_login_at: string | null;
    last_login_ip: string | null;
  };
  communication_preferences: {
    invoice_alerts: boolean;
    renewal_reminders: boolean;
    product_updates: boolean;
  };
};

type ClientActivityItem = {
  type: string;
  description: string;
  location?: string | null;
  reference?: string;
  amount_kobo?: number;
  occurred_at: string | null;
};

const ACTIVITY_ICONS: Record<string, LucideIcon> = {
  login: KeyRound,
  password_changed: CheckCircle2,
  two_factor_enabled: ShieldCheck,
  two_factor_disabled: ShieldCheck,
  payment: FileText,
};

function ClientProfilePage({
  token,
  dashboard,
  toast,
}: {
  token: string;
  dashboard: ClientDashboardSnapshot;
  toast: ReturnType<typeof useToast>;
}) {
  const [profile, setProfile] = useState<ClientProfileData | null>(null);
  const [activity, setActivity] = useState<ClientActivityItem[]>([]);
  const [paymentMethods, setPaymentMethods] = useState<SavedPaymentMethodRow[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [isEditing, setIsEditing] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  const [form, setForm] = useState<{ name: string; phone: string; country: string; state: string; city: string; address: string; business_name: string; website: string; industry: string; support_email: string; company_size: string; tax_id: string }>({
    name: "",
    phone: "",
    country: "",
    state: "",
    city: "",
    address: "",
    business_name: "",
    website: "",
    industry: "",
    support_email: "",
    company_size: "",
    tax_id: "",
  });
  const [isChangingPassword, setIsChangingPassword] = useState(false);
  const [passwordForm, setPasswordForm] = useState({ current_password: "", password: "", password_confirmation: "" });
  const [isSavingPassword, setIsSavingPassword] = useState(false);
  const [busyPreference, setBusyPreference] = useState<string | null>(null);

  const syncFormFromProfile = (data: ClientProfileData) => {
    setForm({
      name: data.personal.full_name || "",
      phone: data.personal.phone || "",
      country: data.personal.country || "",
      state: data.personal.state || "",
      city: data.personal.city || "",
      address: data.personal.address || "",
      business_name: data.company.business_name || "",
      website: data.company.website || "",
      industry: data.company.industry || "",
      support_email: data.company.support_email || "",
      company_size: data.company.company_size || "",
      tax_id: data.company.tax_id || "",
    });
  };

  const loadProfile = React.useCallback(() => {
    return laravelApi<ClientProfileData>("/api/v1/client/profile", token).then((data) => {
      setProfile(data);
      syncFormFromProfile(data);
    });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [token]);

  useEffect(() => {
    setIsLoading(true);
    Promise.all([
      loadProfile(),
      laravelApi<{ data: ClientActivityItem[] }>("/api/v1/client/profile/activity", token).then((response) => setActivity(response.data || [])),
      laravelApi<{ data: SavedPaymentMethodRow[] }>("/api/v1/client/payment-methods", token).then((response) => setPaymentMethods(response.data || [])),
    ])
      .catch((error) => toast.push({ type: "error", message: error instanceof Error ? error.message : "Could not load your profile." }))
      .finally(() => setIsLoading(false));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [token]);

  const saveProfile = async () => {
    setIsSaving(true);

    try {
      const data = await laravelApi<ClientProfileData>("/api/v1/client/profile", token, {
        method: "PUT",
        body: JSON.stringify({
          name: form.name,
          phone: form.phone,
          country: form.country,
          state: form.state,
          city: form.city,
          address: form.address,
          company_name: form.business_name,
          website: form.website,
          industry: form.industry,
          support_email: form.support_email,
          company_size: form.company_size,
          tax_id: form.tax_id,
        }),
      });
      setProfile(data);
      syncFormFromProfile(data);
      setIsEditing(false);
      toast.push({ type: "success", message: "Profile updated." });
    } catch (error) {
      toast.push({ type: "error", message: error instanceof Error ? error.message : "Could not update your profile." });
    } finally {
      setIsSaving(false);
    }
  };

  const updateSecurity = async (payload: Partial<{ two_factor_enabled: boolean; login_alerts_enabled: boolean }>) => {
    if (!profile) return;
    const key = Object.keys(payload)[0];
    setBusyPreference(key);

    try {
      await laravelApi("/api/v1/client/profile/security", token, { method: "PUT", body: JSON.stringify(payload) });
      setProfile((current) => (current ? { ...current, security: { ...current.security, ...payload } } : current));
    } catch (error) {
      toast.push({ type: "error", message: error instanceof Error ? error.message : "Could not update this setting." });
    } finally {
      setBusyPreference(null);
    }
  };

  const updateCommunicationPreference = async (key: keyof ClientProfileData["communication_preferences"], value: boolean) => {
    if (!profile) return;
    setBusyPreference(key);
    const nextPreferences = { ...profile.communication_preferences, [key]: value };

    try {
      await laravelApi("/api/v1/client/profile/communication-preferences", token, { method: "PUT", body: JSON.stringify(nextPreferences) });
      setProfile((current) => (current ? { ...current, communication_preferences: nextPreferences } : current));
    } catch (error) {
      toast.push({ type: "error", message: error instanceof Error ? error.message : "Could not update this preference." });
    } finally {
      setBusyPreference(null);
    }
  };

  const changePassword = async () => {
    setIsSavingPassword(true);

    try {
      await laravelApi("/api/v1/client/profile/change-password", token, { method: "POST", body: JSON.stringify(passwordForm) });
      toast.push({ type: "success", message: "Password updated successfully." });
      setPasswordForm({ current_password: "", password: "", password_confirmation: "" });
      setIsChangingPassword(false);
    } catch (error) {
      toast.push({ type: "error", message: error instanceof Error ? error.message : "Could not change your password." });
    } finally {
      setIsSavingPassword(false);
    }
  };

  const metric = (label: string) => dashboard.metrics.find((item) => item.label === label)?.value ?? "—";

  if (isLoading || !profile) {
    return (
      <div className="flex min-h-[40vh] items-center justify-center text-white/50">
        <Loader2 className="h-6 w-6 animate-spin" />
      </div>
    );
  }

  return (
    <section className="grid gap-5">
      <div>
        <h2 className="text-2xl font-black text-white">My Profile</h2>
        <p className="mt-1 text-sm text-white/55">Manage your account details, security, and company information.</p>
      </div>

      <div className="portal-card">
        <div className="flex flex-col gap-5 lg:flex-row lg:items-center lg:justify-between">
          <div className="flex items-center gap-4">
            <div className="avatar-initial flex h-16 w-16 shrink-0 items-center justify-center rounded-full !text-xl">
              {profile.personal.full_name.charAt(0).toUpperCase() || "?"}
            </div>
            <div>
              <p className="flex items-center gap-2 text-lg font-black text-white">
                {profile.personal.full_name}
                <span className="status-pill paid">Client Account</span>
              </p>
              <div className="mt-2 flex flex-wrap gap-x-5 gap-y-1 text-xs text-white/45">
                <span>Customer ID <strong className="text-white/70">{profile.customer_id}</strong></span>
                <span>Member Since <strong className="text-white/70">{formatDate(profile.member_since)}</strong></span>
                <span>Account Status <strong className="text-primary">{profile.account_status}</strong></span>
              </div>
            </div>
          </div>
          <div className="flex gap-2">
            {isEditing ? (
              <>
                <button type="button" className="btn-outline !min-h-9 !text-[11px]" onClick={() => { setIsEditing(false); syncFormFromProfile(profile); }}>
                  Cancel
                </button>
                <button type="button" className="btn-primary !min-h-9 !text-[11px]" disabled={isSaving} onClick={() => void saveProfile()}>
                  {isSaving ? "Saving..." : "Save Changes"}
                </button>
              </>
            ) : (
              <button type="button" className="btn-outline !min-h-9 !text-[11px]" onClick={() => setIsEditing(true)}>
                <Pencil className="h-3.5 w-3.5" />
                Edit Profile
              </button>
            )}
          </div>
        </div>

        <div className="mt-5 grid gap-3 border-t border-white/10 pt-5 sm:grid-cols-2 lg:grid-cols-4">
          {[
            [PackageCheck, "Active Services", metric("Active Services")],
            [Wallet, "Wallet Balance", metric("Wallet Balance")],
            [CreditCard, "Outstanding Balance", metric("Outstanding Balance")],
            [CalendarClock, "Next Renewal", metric("Next Renewal") || "None scheduled"],
          ].map(([Icon, label, value]) => (
            <div key={label as string} className="data-row">
              <div className="row-icon">{React.createElement(Icon as LucideIcon, { className: "h-4 w-4" })}</div>
              <div className="min-w-0 flex-1">
                <p>{label as string}</p>
                <small>{value as string}</small>
              </div>
            </div>
          ))}
        </div>
      </div>

      <div className="grid gap-5 lg:grid-cols-2">
        <div className="portal-card">
          <h2 className="flex items-center gap-2"><User className="h-4 w-4 text-primary" /> Personal Information</h2>
          <div className="mt-4 grid gap-3">
            {isEditing ? (
              <>
                <label className="admin-field">
                  <span>Full Name</span>
                  <input value={form.name} onChange={(event) => setForm((current) => ({ ...current, name: event.target.value }))} />
                </label>
                <label className="admin-field">
                  <span>Phone Number</span>
                  <input value={form.phone} onChange={(event) => setForm((current) => ({ ...current, phone: event.target.value }))} />
                </label>
                <label className="admin-field">
                  <span>Country</span>
                  <input value={form.country} onChange={(event) => setForm((current) => ({ ...current, country: event.target.value }))} />
                </label>
                <label className="admin-field">
                  <span>State</span>
                  <input value={form.state} onChange={(event) => setForm((current) => ({ ...current, state: event.target.value }))} />
                </label>
                <label className="admin-field">
                  <span>Address</span>
                  <input value={form.address} onChange={(event) => setForm((current) => ({ ...current, address: event.target.value }))} />
                </label>
              </>
            ) : (
              <>
                <div className="data-row"><div className="min-w-0 flex-1"><p>Full Name</p></div><strong>{profile.personal.full_name}</strong></div>
                <div className="data-row"><div className="min-w-0 flex-1"><p>Email Address</p></div><strong>{profile.personal.email}</strong></div>
                <div className="data-row"><div className="min-w-0 flex-1"><p>Phone Number</p></div><strong>{profile.personal.phone || "—"}</strong></div>
                <div className="data-row"><div className="min-w-0 flex-1"><p>Country</p></div><strong>{profile.personal.country || "—"}</strong></div>
                <div className="data-row"><div className="min-w-0 flex-1"><p>State</p></div><strong>{profile.personal.state || "—"}</strong></div>
                <div className="data-row"><div className="min-w-0 flex-1"><p>Address</p></div><strong>{profile.personal.address || "—"}</strong></div>
              </>
            )}
          </div>
        </div>

        <div className="portal-card">
          <h2 className="flex items-center gap-2"><Building2 className="h-4 w-4 text-primary" /> Company Information</h2>
          <div className="mt-4 grid gap-3">
            {isEditing ? (
              <>
                <label className="admin-field">
                  <span>Business Name</span>
                  <input value={form.business_name} onChange={(event) => setForm((current) => ({ ...current, business_name: event.target.value }))} />
                </label>
                <label className="admin-field">
                  <span>Website</span>
                  <input value={form.website} onChange={(event) => setForm((current) => ({ ...current, website: event.target.value }))} />
                </label>
                <label className="admin-field">
                  <span>Industry</span>
                  <input value={form.industry} onChange={(event) => setForm((current) => ({ ...current, industry: event.target.value }))} />
                </label>
                <label className="admin-field">
                  <span>Support Email</span>
                  <input value={form.support_email} onChange={(event) => setForm((current) => ({ ...current, support_email: event.target.value }))} />
                </label>
                <label className="admin-field">
                  <span>Company Size</span>
                  <input value={form.company_size} onChange={(event) => setForm((current) => ({ ...current, company_size: event.target.value }))} />
                </label>
                <label className="admin-field">
                  <span>Tax ID (Optional)</span>
                  <input value={form.tax_id} onChange={(event) => setForm((current) => ({ ...current, tax_id: event.target.value }))} />
                </label>
              </>
            ) : (
              <>
                <div className="data-row"><div className="min-w-0 flex-1"><p>Business Name</p></div><strong>{profile.company.business_name || "—"}</strong></div>
                <div className="data-row"><div className="min-w-0 flex-1"><p>Website</p></div><strong>{profile.company.website || "—"}</strong></div>
                <div className="data-row"><div className="min-w-0 flex-1"><p>Industry</p></div><strong>{profile.company.industry || "—"}</strong></div>
                <div className="data-row"><div className="min-w-0 flex-1"><p>Support Email</p></div><strong>{profile.company.support_email || "—"}</strong></div>
                <div className="data-row"><div className="min-w-0 flex-1"><p>Company Size</p></div><strong>{profile.company.company_size || "—"}</strong></div>
                <div className="data-row"><div className="min-w-0 flex-1"><p>Tax ID</p></div><strong>{profile.company.tax_id || "—"}</strong></div>
              </>
            )}
          </div>
        </div>

        <div className="portal-card">
          <h2 className="flex items-center gap-2"><ShieldCheck className="h-4 w-4 text-primary" /> Security & Access</h2>
          <div className="mt-4 grid gap-3">
            <div className="data-row">
              <div className="min-w-0 flex-1"><p>Password</p></div>
              <button type="button" className="btn-outline !min-h-9 !px-3 !text-[11px]" onClick={() => setIsChangingPassword((current) => !current)}>
                Change
              </button>
            </div>
            {isChangingPassword && (
              <div className="grid gap-3 rounded-lg border border-white/10 bg-black/20 p-4">
                <label className="admin-field">
                  <span>Current Password</span>
                  <input type="password" value={passwordForm.current_password} onChange={(event) => setPasswordForm((current) => ({ ...current, current_password: event.target.value }))} />
                </label>
                <label className="admin-field">
                  <span>New Password</span>
                  <input type="password" minLength={10} value={passwordForm.password} onChange={(event) => setPasswordForm((current) => ({ ...current, password: event.target.value }))} />
                </label>
                <label className="admin-field">
                  <span>Confirm New Password</span>
                  <input type="password" minLength={10} value={passwordForm.password_confirmation} onChange={(event) => setPasswordForm((current) => ({ ...current, password_confirmation: event.target.value }))} />
                </label>
                <button type="button" className="btn-primary justify-center" disabled={isSavingPassword} onClick={() => void changePassword()}>
                  {isSavingPassword ? "Updating..." : "Update Password"}
                </button>
              </div>
            )}
            <div className="data-row">
              <div className="min-w-0 flex-1">
                <p>Two-Factor Authentication</p>
                <small>Add an extra layer of security</small>
              </div>
              <input
                type="checkbox"
                className="toggle-switch"
                checked={profile.security.two_factor_enabled}
                disabled={busyPreference === "two_factor_enabled"}
                onChange={(event) => void updateSecurity({ two_factor_enabled: event.target.checked })}
              />
            </div>
            <div className="data-row">
              <div className="min-w-0 flex-1">
                <p>Last Login</p>
                <small>
                  {profile.security.last_login_at ? formatDateTime(profile.security.last_login_at) : "No previous login on record"}
                  {profile.security.last_login_ip ? ` · ${profile.security.last_login_ip}` : ""}
                </small>
              </div>
            </div>
            <div className="data-row">
              <div className="min-w-0 flex-1">
                <p>Login Alerts</p>
                <small>Get notified of new sign-ins</small>
              </div>
              <input
                type="checkbox"
                className="toggle-switch"
                checked={profile.security.login_alerts_enabled}
                disabled={busyPreference === "login_alerts_enabled"}
                onChange={(event) => void updateSecurity({ login_alerts_enabled: event.target.checked })}
              />
            </div>
          </div>
        </div>

        <div className="portal-card">
          <h2 className="flex items-center gap-2"><Mail className="h-4 w-4 text-primary" /> Billing & Communication Preferences</h2>
          <div className="mt-4 grid gap-3">
            {(
              [
                ["invoice_alerts", "Invoice Alerts", "Receive alerts for new invoices"],
                ["renewal_reminders", "Renewal Reminders", "Get reminders before services renew"],
                ["product_updates", "Product Updates", "Receive updates about new products"],
              ] as const
            ).map(([key, label, description]) => (
              <div className="data-row" key={key}>
                <div className="min-w-0 flex-1">
                  <p>{label}</p>
                  <small>{description}</small>
                </div>
                <input
                  type="checkbox"
                  className="toggle-switch"
                  checked={profile.communication_preferences[key]}
                  disabled={busyPreference === key}
                  onChange={(event) => void updateCommunicationPreference(key, event.target.checked)}
                />
              </div>
            ))}
          </div>
        </div>

        <div className="portal-card">
          <div className="flex items-center justify-between">
            <h2 className="flex items-center gap-2"><CreditCard className="h-4 w-4 text-primary" /> Payment Methods</h2>
            <span className="text-xs font-bold text-white/45">{paymentMethods.length} saved</span>
          </div>
          <div className="mt-4 grid gap-2">
            {paymentMethods.length === 0 ? (
              <p className="text-sm text-white/40">No saved payment methods yet.</p>
            ) : (
              paymentMethods.map((method) => (
                <div className="data-row" key={method.id}>
                  <div className="row-icon"><CreditCard className="h-4 w-4" /></div>
                  <div className="min-w-0 flex-1">
                    <p>{(method.card_brand || method.payment_provider).toUpperCase()} ending in {method.last4 || "----"}</p>
                    <small>{method.exp_month && method.exp_year ? `Expires ${method.exp_month}/${method.exp_year}` : ""}</small>
                  </div>
                  {method.is_default && <span className="status-pill paid">Primary</span>}
                </div>
              ))
            )}
          </div>
          <button
            type="button"
            className="btn-outline mt-4 w-full justify-center"
            onClick={() => navigateClient("/client/payment-methods")}
          >
            <Settings className="h-4 w-4" />
            Manage Payment Methods
          </button>
        </div>

        <div className="portal-card">
          <h2 className="flex items-center gap-2"><Activity className="h-4 w-4 text-primary" /> Account Activity</h2>
          <div className="mt-4 grid gap-2">
            {activity.length === 0 ? (
              <p className="text-sm text-white/40">No recent activity yet.</p>
            ) : (
              activity.map((item, index) => {
                const Icon = ACTIVITY_ICONS[item.type] || Activity;
                return (
                  <div className="data-row" key={`${item.type}-${item.occurred_at}-${index}`}>
                    <div className="row-icon"><Icon className="h-4 w-4" /></div>
                    <div className="min-w-0 flex-1">
                      <p>{item.description}{item.reference ? ` — ${item.reference}` : ""}</p>
                      <small>
                        {item.occurred_at ? formatDateTime(item.occurred_at) : ""}
                        {item.location ? ` · ${item.location}` : ""}
                      </small>
                    </div>
                    {typeof item.amount_kobo === "number" && <strong className="text-primary">{formatKobo(item.amount_kobo)}</strong>}
                  </div>
                );
              })
            )}
          </div>
        </div>
      </div>
    </section>
  );
}

function HostingModalContent({
  modal,
  isSubmitting,
  primaryDomain,
  onClose,
  onCreateMailbox,
  onUpdateMailbox,
  onCreateDatabase,
  onCreateFtp,
  onChangeMailboxPassword,
  onResetDatabasePassword,
  onResetFtpPassword,
  onConfirmDelete,
}: {
  modal: Exclude<HostingModalState, null>;
  isSubmitting: boolean;
  primaryDomain: string | null;
  onClose: () => void;
  onCreateMailbox: (payload: { username: string; password: string; display_name: string; quota_mb: string }) => void;
  onUpdateMailbox: (id: number, payload: { display_name: string; quota_mb: string }) => void;
  onCreateDatabase: (payload: { database_name: string; username: string; password: string }) => void;
  onCreateFtp: (payload: { username: string; password: string }) => void;
  onChangeMailboxPassword: (id: number, payload: { password: string; password_confirmation: string }) => void;
  onResetDatabasePassword: (id: number, payload: { password: string; password_confirmation: string }) => void;
  onResetFtpPassword: (id: number, payload: { password: string; password_confirmation: string }) => void;
  onConfirmDelete: (kind: "mailboxes" | "databases" | "ftp-accounts", id: number) => void;
}) {
  const [mailboxUsername, setMailboxUsername] = useState("");
  const [mailboxDisplayName, setMailboxDisplayName] = useState(modal.type === "edit-mailbox" ? modal.display_name : "");
  const [mailboxQuotaMb, setMailboxQuotaMb] = useState(modal.type === "edit-mailbox" ? String(modal.quota_mb ?? "") : "");
  const [databaseName, setDatabaseName] = useState("");
  const [databaseUsername, setDatabaseUsername] = useState("");
  const [ftpUsername, setFtpUsername] = useState("");
  const [password, setPassword] = useState("");
  const [passwordConfirmation, setPasswordConfirmation] = useState("");

  if (modal.type === "create-mailbox") {
    return (
      <form
        className="grid gap-4"
        onSubmit={(event) => {
          event.preventDefault();
          onCreateMailbox({ username: mailboxUsername, password, display_name: mailboxDisplayName, quota_mb: mailboxQuotaMb });
        }}
      >
        <h3 className="text-lg font-black text-white">Create Email Account</h3>
        <label className="admin-field">
          <span>Username</span>
          <div className="flex items-center gap-2">
            <input
              required
              type="text"
              className="flex-1"
              placeholder="e.g. info"
              pattern="[A-Za-z0-9._-]+"
              value={mailboxUsername}
              onChange={(event) => setMailboxUsername(event.target.value)}
            />
            <span className="whitespace-nowrap text-sm text-white/50">@{primaryDomain || "your domain"}</span>
          </div>
          {mailboxUsername && (
            <small className="mt-1 block text-white/40">
              You're creating {mailboxUsername}@{primaryDomain || "your domain"}
            </small>
          )}
        </label>
        <label className="admin-field">
          <span>Name</span>
          <input type="text" placeholder="e.g. Support Team" value={mailboxDisplayName} onChange={(event) => setMailboxDisplayName(event.target.value)} />
        </label>
        <label className="admin-field">
          <span>Quota (MB)</span>
          <input type="number" min={1} placeholder="e.g. 1024" value={mailboxQuotaMb} onChange={(event) => setMailboxQuotaMb(event.target.value)} />
        </label>
        <label className="admin-field">
          <span>Password</span>
          <input required minLength={10} type="password" value={password} onChange={(event) => setPassword(event.target.value)} />
        </label>
        <div className="mt-2 flex gap-3">
          <button type="button" className="btn-outline flex-1 justify-center" onClick={onClose}>Cancel</button>
          <button type="submit" className="btn-primary flex-1 justify-center" disabled={isSubmitting}>Create</button>
        </div>
      </form>
    );
  }

  if (modal.type === "edit-mailbox") {
    return (
      <form
        className="grid gap-4"
        onSubmit={(event) => {
          event.preventDefault();
          onUpdateMailbox(modal.id, { display_name: mailboxDisplayName, quota_mb: mailboxQuotaMb });
        }}
      >
        <h3 className="text-lg font-black text-white">Edit Email Account</h3>
        <p className="text-sm text-white/48">{modal.label}</p>
        <label className="admin-field">
          <span>Name</span>
          <input type="text" placeholder="e.g. Support Team" value={mailboxDisplayName} onChange={(event) => setMailboxDisplayName(event.target.value)} />
        </label>
        <label className="admin-field">
          <span>Quota (MB)</span>
          <input type="number" min={1} placeholder="e.g. 1024" value={mailboxQuotaMb} onChange={(event) => setMailboxQuotaMb(event.target.value)} />
        </label>
        <div className="mt-2 flex gap-3">
          <button type="button" className="btn-outline flex-1 justify-center" onClick={onClose}>Cancel</button>
          <button type="submit" className="btn-primary flex-1 justify-center" disabled={isSubmitting}>Save</button>
        </div>
      </form>
    );
  }

  if (modal.type === "create-database") {
    return (
      <form
        className="grid gap-4"
        onSubmit={(event) => {
          event.preventDefault();
          onCreateDatabase({ database_name: databaseName, username: databaseUsername, password });
        }}
      >
        <h3 className="text-lg font-black text-white">Create Database</h3>
        <label className="admin-field">
          <span>Database Name</span>
          <input required type="text" value={databaseName} onChange={(event) => setDatabaseName(event.target.value)} />
        </label>
        <label className="admin-field">
          <span>Username</span>
          <input required type="text" value={databaseUsername} onChange={(event) => setDatabaseUsername(event.target.value)} />
        </label>
        <label className="admin-field">
          <span>Password</span>
          <input required minLength={10} type="password" value={password} onChange={(event) => setPassword(event.target.value)} />
        </label>
        <div className="mt-2 flex gap-3">
          <button type="button" className="btn-outline flex-1 justify-center" onClick={onClose}>Cancel</button>
          <button type="submit" className="btn-primary flex-1 justify-center" disabled={isSubmitting}>Create</button>
        </div>
      </form>
    );
  }

  if (modal.type === "create-ftp") {
    return (
      <form
        className="grid gap-4"
        onSubmit={(event) => {
          event.preventDefault();
          onCreateFtp({ username: ftpUsername, password });
        }}
      >
        <h3 className="text-lg font-black text-white">Create SSH/SFTP Account</h3>
        <label className="admin-field">
          <span>Username</span>
          <input required type="text" value={ftpUsername} onChange={(event) => setFtpUsername(event.target.value)} />
        </label>
        <label className="admin-field">
          <span>Password</span>
          <input required minLength={10} type="password" value={password} onChange={(event) => setPassword(event.target.value)} />
        </label>
        <div className="mt-2 flex gap-3">
          <button type="button" className="btn-outline flex-1 justify-center" onClick={onClose}>Cancel</button>
          <button type="submit" className="btn-primary flex-1 justify-center" disabled={isSubmitting}>Create</button>
        </div>
      </form>
    );
  }

  if (modal.type === "change-mailbox-password" || modal.type === "reset-database-password" || modal.type === "reset-ftp-password") {
    const submit = (event: React.FormEvent) => {
      event.preventDefault();
      const payload = { password, password_confirmation: passwordConfirmation };
      if (modal.type === "change-mailbox-password") onChangeMailboxPassword(modal.id, payload);
      if (modal.type === "reset-database-password") onResetDatabasePassword(modal.id, payload);
      if (modal.type === "reset-ftp-password") onResetFtpPassword(modal.id, payload);
    };

    return (
      <form className="grid gap-4" onSubmit={submit}>
        <h3 className="text-lg font-black text-white">Change Password</h3>
        <p className="text-sm text-white/48">{modal.label}</p>
        <label className="admin-field">
          <span>New Password</span>
          <input required minLength={10} type="password" value={password} onChange={(event) => setPassword(event.target.value)} />
        </label>
        <label className="admin-field">
          <span>Confirm Password</span>
          <input required minLength={10} type="password" value={passwordConfirmation} onChange={(event) => setPasswordConfirmation(event.target.value)} />
        </label>
        <div className="mt-2 flex gap-3">
          <button type="button" className="btn-outline flex-1 justify-center" onClick={onClose}>Cancel</button>
          <button type="submit" className="btn-primary flex-1 justify-center" disabled={isSubmitting}>Update</button>
        </div>
      </form>
    );
  }

  return (
    <div className="grid gap-4">
      <h3 className="text-lg font-black text-white">Delete {modal.label}?</h3>
      <p className="text-sm text-white/54">This will permanently remove this resource from ISPConfig. This action cannot be undone.</p>
      <div className="mt-2 flex gap-3">
        <button type="button" className="btn-outline flex-1 justify-center" onClick={onClose}>Cancel</button>
        <button
          type="button"
          className="btn-primary flex-1 justify-center !bg-red-400 !shadow-none"
          disabled={isSubmitting}
          onClick={() => onConfirmDelete(modal.kind, modal.id)}
        >
          Delete
        </button>
      </div>
    </div>
  );
}

function ClientPortal() {
  const toast = useToast();
  const { route, search, hostingServiceId, orderNumber, invoiceNumber, domainId, navigate } = useClientRoute();
  const [clientToken, setClientToken] = useState(() => sessionStorage.getItem("naitalk_laravel_client_token") || "");
  const [login, setLogin] = useState(INITIAL_LOGIN);
  const [registerForm, setRegisterForm] = useState(INITIAL_REGISTER);
  const [forgotForm, setForgotForm] = useState({ email: "" });
  const [resetForm, setResetForm] = useState(() => {
    const params = new URLSearchParams(window.location.search);
    return {
      email: params.get("email") || "",
      token: params.get("token") || "",
      password: "",
      password_confirmation: "",
    };
  });
  const [dashboard, setDashboard] = useState<ClientDashboardSnapshot | null>(null);
  const [isVerified, setIsVerified] = useState<boolean | null>(null);
  const [verifiedEmail, setVerifiedEmail] = useState("");
  const [isLoading, setIsLoading] = useState(Boolean(clientToken));
  const [isResending, setIsResending] = useState(false);
  const [verificationCode, setVerificationCode] = useState("");
  const [isVerifyingCode, setIsVerifyingCode] = useState(false);
  const [catalog, setCatalog] = useState<ServiceCatalogItem[] | null>(null);
  const [orders, setOrders] = useState<ClientOrderSummary[] | null>(null);
  const [hostingPlans, setHostingPlans] = useState<HostingPlanCard[]>([]);
  const [isLoadingHostingPlans, setIsLoadingHostingPlans] = useState(false);
  const [addOns, setAddOns] = useState<Array<{ name: string; slug: string; monthly_price: string; annual_price: string }>>([]);
  // Fetched from the backend (never hardcoded) so the pre-checkout Order Summary/Review
  // preview always matches whatever VAT rate CheckoutService will actually apply.
  const [vatRate, setVatRate] = useState(0.075);
  const [orderDraft, setOrderDraft] = useState(INITIAL_ORDER_DRAFT);
  // Preview only, for the domain+hosting wizard's Order Summary/Review/Checkout
  // screens — re-fetched from the same public pricing the backend itself
  // uses, so the preview total actually includes the domain fee instead of
  // silently showing hosting-only (the bug this fixes). The invoice
  // returned by POST /orders/hosting remains the sole authoritative charge.
  const [domainRegistrationPriceKobo, setDomainRegistrationPriceKobo] = useState<number | null>(null);
  const [checkoutResult, setCheckoutResult] = useState<{
    order: { order_number: string };
    invoice: { invoice_number: string; total_kobo: number; total?: string };
  } | null>(null);
  const [isSubmittingOrder, setIsSubmittingOrder] = useState(false);
  const [isInitiatingPayment, setIsInitiatingPayment] = useState(false);
  const [bankTransferInfo, setBankTransferInfo] = useState<BankTransferDetails | null>(null);

  const loadClientDashboard = async (token = clientToken) => {
    if (!token) return;
    setIsLoading(true);

    try {
      const data = await laravelApi<ClientDashboardSnapshot>("/api/v1/client/dashboard", token);
      setDashboard(data);
    } catch (error) {
      sessionStorage.removeItem("naitalk_laravel_client_token");
      setClientToken("");
      toast.push({ type: "error", message: error instanceof Error ? error.message : "Client dashboard could not be loaded." });
    } finally {
      setIsLoading(false);
    }
  };

  const loadVerificationStatus = async (token = clientToken) => {
    if (!token) return;

    try {
      const data = await laravelApi<{ user: { email: string; email_verified_at: string | null } }>("/api/v1/auth/me", token);
      setIsVerified(Boolean(data.user.email_verified_at));
      setVerifiedEmail(data.user.email);
    } catch {
      // Dashboard load failure already surfaces an error toast and clears the session.
    }
  };

  useEffect(() => {
    if (clientToken) {
      void loadClientDashboard(clientToken);
      void loadVerificationStatus(clientToken);
    }
  }, []);

  useEffect(() => {
    if (route !== "services-catalog" || !clientToken) return;
    laravelApi<{ data: ServiceCatalogItem[] }>("/api/v1/client/services/catalog", clientToken)
      .then((data) => setCatalog(data.data))
      .catch((error) => toast.push({ type: "error", message: error instanceof Error ? error.message : "Could not load services." }));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [route, clientToken]);

  useEffect(() => {
    if (route !== "orders" || !clientToken) return;
    laravelApi<{ data: ClientOrderSummary[] }>("/api/v1/client/orders", clientToken)
      .then((data) => setOrders(data.data))
      .catch((error) => toast.push({ type: "error", message: error instanceof Error ? error.message : "Could not load your orders." }));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [route, clientToken]);

  useEffect(() => {
    if (route !== "orders") return;

    const paymentStatus = search.get("payment");
    const invoiceParam = search.get("invoice");

    if (paymentStatus === "success") {
      toast.push({ type: "success", message: `Payment confirmed for invoice ${invoiceParam || ""}. Provisioning will begin shortly.` });

      // React state doesn't survive the redirect to Paystack/Flutterwave and
      // back, so the order/plan details saved in handleSubmitOrder are read
      // back here, keyed by invoice number, to fire the purchase event.
      const pendingPayment = invoiceParam ? peekPendingPayment(invoiceParam) : null;
      trackEvent("payment_success", { transaction_id: invoiceParam || undefined, payment_method: pendingPayment?.payment_method });
      if (pendingPayment) {
        trackPurchase({
          transaction_id: pendingPayment.invoice_number,
          value: pendingPayment.value,
          currency: pendingPayment.currency,
          payment_method: pendingPayment.payment_method,
          items: [
            {
              item_id: pendingPayment.plan_id,
              item_name: pendingPayment.plan_name,
              price: pendingPayment.value,
              quantity: 1,
            },
          ],
        });
        clearPendingPayment();
      }
    } else if (paymentStatus === "failed") {
      toast.push({ type: "error", message: "Payment verification failed. Please try again or contact support." });
      trackEvent("payment_failed", { transaction_id: invoiceParam || undefined, error_category: "gateway_failed" });
    } else if (paymentStatus === "not_found") {
      toast.push({ type: "error", message: "We could not find that payment. Please try again or contact support." });
      trackEvent("payment_failed", { transaction_id: invoiceParam || undefined, error_category: "not_found" });
    }

    if (paymentStatus || invoiceParam) {
      navigate("/client/orders");
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [route]);

  useEffect(() => {
    if (route !== "order-hosting") return;

    setCheckoutResult(null);
    setBankTransferInfo(null);

    const preselected = search.get("plan");
    if (preselected) {
      setOrderDraft((current) => ({ ...current, plan_slug: preselected }));
    }

    const prefilledDomain = search.get("domain");
    const prefilledRegisterDomain = search.get("register_domain") === "1";
    if (prefilledDomain) {
      setOrderDraft((current) => ({
        ...current,
        primary_domain: prefilledDomain,
        register_domain: prefilledRegisterDomain,
      }));
    }

    if (prefilledDomain && prefilledRegisterDomain) {
      laravelApi<{ registration_price_kobo: number | null }>(
        `/api/v1/public/domains/search?domain=${encodeURIComponent(prefilledDomain)}`,
      )
        .then((result) => setDomainRegistrationPriceKobo(result.registration_price_kobo ?? null))
        .catch(() => setDomainRegistrationPriceKobo(null));
    } else {
      setDomainRegistrationPriceKobo(null);
    }

    setIsLoadingHostingPlans(true);

    laravelApi<{ vat_rate: number }>("/api/v1/public/billing-config")
      .then((config) => setVatRate(config.vat_rate))
      .catch(() => undefined);

    Promise.all([
      laravelApi<Array<Record<string, unknown>>>("/api/v1/public/hosting-plans"),
      laravelApi<Array<Record<string, unknown>>>("/api/v1/public/hosting-add-ons"),
    ])
      .then(([plans, planAddOns]) => {
        if (Array.isArray(plans) && plans.length) {
          const mapped = plans.map((plan) => ({
            name: String(plan.name || "Website Care Plan"),
            slug: String(plan.slug || ""),
            audience: String(plan.short_description || "Website care for your business"),
            monthly: String(plan.monthly_price || "₦0"),
            annual: String(plan.annual_price || "₦0"),
            featured: Boolean(plan.is_popular),
            badge: plan.display_badge ? String(plan.display_badge) : null,
            ctaLabel: plan.cta_label ? String(plan.cta_label) : "Choose plan",
            features: [] as string[],
          }));
          setHostingPlans(mapped);
          setOrderDraft((current) => ({ ...current, plan_slug: current.plan_slug || mapped[0]?.slug || "" }));
        }
        if (Array.isArray(planAddOns)) {
          setAddOns(
            planAddOns.map((addOn) => ({
              name: String(addOn.name || ""),
              slug: String(addOn.slug || ""),
              monthly_price: String(addOn.monthly_price || "₦0"),
              annual_price: String(addOn.annual_price || "₦0"),
            })),
          );
        }
      })
      .catch((error) =>
        toast.push({ type: "error", message: error instanceof Error ? error.message : "Could not load hosting plans from the catalogue." }),
      )
      .finally(() => setIsLoadingHostingPlans(false));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [route]);

  const handleClientLogin = async (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    setIsLoading(true);

    try {
      const data = await laravelApi<{ token: string; user: { role: string } }>("/api/v1/auth/login", undefined, {
        method: "POST",
        body: JSON.stringify({
          email: login.email,
          password: login.password,
          device_name: "naitalk-react-client",
        }),
      });

      if (data.user.role !== "client") {
        throw new Error("This account is not a client portal account.");
      }

      sessionStorage.setItem("naitalk_laravel_client_token", data.token);
      setClientToken(data.token);
      setLogin(INITIAL_LOGIN);
      await loadClientDashboard(data.token);
      await loadVerificationStatus(data.token);

      trackEvent("login", { method: "email" });

      const pending = consumePendingOrder();
      if (pending) {
        setOrderDraft((current) => ({ ...current, plan_slug: pending.plan, billing_cycle: pending.billing_cycle }));
        navigate("/client/order/review");
      } else {
        navigate("/client/dashboard");
      }
    } catch (error) {
      setLogin((current) => ({ ...current, password: "" }));
      toast.push({ type: "error", message: error instanceof Error ? error.message : "Invalid email address or password." });
      trackEvent("login_error", { method: "email" });
    } finally {
      setIsLoading(false);
    }
  };

  const handleClientRegister = async (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();

    if (registerForm.password !== registerForm.password_confirmation) {
      setRegisterForm((current) => ({ ...current, password: "", password_confirmation: "" }));
      toast.push({ type: "error", message: "Passwords do not match." });
      return;
    }

    trackEvent("signup_start", { method: "email" });
    setIsLoading(true);

    try {
      const data = await laravelApi<{ token: string; user: { role: string; email: string }; message: string }>(
        "/api/v1/auth/register",
        undefined,
        {
          method: "POST",
          body: JSON.stringify(registerForm),
        },
      );

      if (data.user.role !== "client") {
        throw new Error("This account is not a client portal account.");
      }

      sessionStorage.setItem("naitalk_laravel_client_token", data.token);
      setClientToken(data.token);
      setVerifiedEmail(data.user.email);
      setIsVerified(false);
      setRegisterForm(INITIAL_REGISTER);
      toast.push({ type: "success", message: data.message || "Your account has been created successfully. Please check your email to verify your account." });
      trackEvent("sign_up", { method: "email" });
      await loadClientDashboard(data.token);
      navigate("/client/verify-email");
    } catch (error) {
      setRegisterForm((current) => ({ ...current, password: "", password_confirmation: "" }));
      toast.push({ type: "error", message: error instanceof Error ? error.message : "Registration failed." });
    } finally {
      setIsLoading(false);
    }
  };

  const handleForgotPassword = async (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    setIsLoading(true);

    try {
      const data = await laravelApi<{ message: string; reset_token?: string | null }>("/api/v1/auth/forgot-password", undefined, {
        method: "POST",
        body: JSON.stringify(forgotForm),
      });
      toast.push({ type: "success", message: data.message || "Password reset request received." });

      if (data.reset_token) {
        setResetForm((current) => ({
          ...current,
          email: forgotForm.email,
          token: data.reset_token || "",
        }));
        navigate("/client/reset-password");
      }
    } catch (error) {
      toast.push({ type: "error", message: error instanceof Error ? error.message : "Password reset request failed." });
    } finally {
      setIsLoading(false);
    }
  };

  const handleResetPassword = async (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();

    if (resetForm.password !== resetForm.password_confirmation) {
      setResetForm((current) => ({ ...current, password: "", password_confirmation: "" }));
      toast.push({ type: "error", message: "Passwords do not match." });
      return;
    }

    setIsLoading(true);

    try {
      const data = await laravelApi<{ message: string }>("/api/v1/auth/reset-password", undefined, {
        method: "POST",
        body: JSON.stringify(resetForm),
      });
      toast.push({ type: "success", message: data.message || "Your password has been updated successfully." });
      setLogin({ email: resetForm.email, password: "" });
      setResetForm({ email: "", token: "", password: "", password_confirmation: "" });
      navigate("/client/login");
    } catch (error) {
      setResetForm((current) => ({ ...current, password: "", password_confirmation: "" }));
      toast.push({ type: "error", message: error instanceof Error ? error.message : "Password reset failed." });
    } finally {
      setIsLoading(false);
    }
  };

  const handleResendVerification = async () => {
    if (!clientToken || isResending) return;
    setIsResending(true);

    try {
      const data = await laravelApi<{ message: string }>("/api/v1/auth/email/resend", clientToken, { method: "POST" });
      toast.push({ type: "success", message: data.message || "Verification code sent. Please check your inbox." });
    } catch (error) {
      toast.push({ type: "error", message: error instanceof Error ? error.message : "Could not resend verification code." });
    } finally {
      setIsResending(false);
    }
  };

  const handleVerifyCode = async (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (!clientToken || isVerifyingCode) return;
    setIsVerifyingCode(true);

    try {
      const data = await laravelApi<{ message: string }>("/api/v1/auth/email/verify-code", clientToken, {
        method: "POST",
        body: JSON.stringify({ code: verificationCode }),
      });
      toast.push({ type: "success", message: data.message || "Your email has been verified successfully. Your NAI TALK account is now active." });
      setVerificationCode("");
      setIsVerified(true);

      const pending = consumePendingOrder();
      if (pending) {
        setOrderDraft((current) => ({ ...current, plan_slug: pending.plan, billing_cycle: pending.billing_cycle }));
        navigate("/client/order/review");
      } else {
        navigate("/client/dashboard");
      }
    } catch (error) {
      setVerificationCode("");
      toast.push({ type: "error", message: error instanceof Error ? error.message : "That verification code is incorrect." });
    } finally {
      setIsVerifyingCode(false);
    }
  };

  const handleClientLogout = async () => {
    if (clientToken) {
      await laravelApi<{ message: string }>("/api/v1/auth/logout", clientToken, { method: "POST" }).catch(() => undefined);
    }
    sessionStorage.removeItem("naitalk_laravel_client_token");
    setClientToken("");
    setDashboard(null);
    setIsVerified(null);
    setLogin(INITIAL_LOGIN);
    setRegisterForm(INITIAL_REGISTER);
    setForgotForm({ email: "" });
    setResetForm({ email: "", token: "", password: "", password_confirmation: "" });
    setOrderDraft(INITIAL_ORDER_DRAFT);
    setCheckoutResult(null);
    setBankTransferInfo(null);
    toast.clear();
    navigate("/client/login");
  };

  const handleSubmitOrder = async () => {
    if (!clientToken || checkoutResult) return;
    setIsSubmittingOrder(true);

    try {
      const checkout = await laravelApi<{
        order: { order_number: string };
        invoice: { invoice_number: string; total_kobo: number; total?: string };
      }>("/api/v1/client/orders/hosting", clientToken, {
        method: "POST",
        body: JSON.stringify({ ...orderDraft, terms_accepted: true }),
      });

      setCheckoutResult(checkout);
      toast.push({ type: "success", message: `Order created. Invoice ${checkout.invoice.invoice_number} has been emailed to you.` });

      const selectedPlan = hostingPlans.find((plan) => plan.slug === orderDraft.plan_slug);
      const value = checkout.invoice.total_kobo / 100;
      trackCheckout({
        plan_id: orderDraft.plan_slug,
        plan_name: selectedPlan?.name,
        billing_cycle: orderDraft.billing_cycle,
        value,
        currency: "NGN",
      });
      // Stashed so the purchase event can still fire correctly after the
      // full-page redirect to Paystack/Flutterwave (see the payment=success
      // handling below) — React state doesn't survive that round trip.
      savePendingPayment({
        invoice_number: checkout.invoice.invoice_number,
        order_number: checkout.order.order_number,
        value,
        currency: "NGN",
        plan_id: orderDraft.plan_slug,
        plan_name: selectedPlan?.name || orderDraft.plan_slug,
        billing_cycle: orderDraft.billing_cycle,
      });

      setOrderDraft(INITIAL_ORDER_DRAFT);
    } catch (error) {
      toast.push({ type: "error", message: error instanceof Error ? error.message : "Hosting order could not be created." });
    } finally {
      setIsSubmittingOrder(false);
    }
  };

  const handlePayWithGateway = async (invoiceNumber: string, gateway: "paystack" | "flutterwave") => {
    if (!clientToken || isInitiatingPayment) return;
    setIsInitiatingPayment(true);

    try {
      const data = await laravelApi<{ authorization_url?: string; link?: string }>(
        `/api/v1/client/invoices/${invoiceNumber}/pay/${gateway}`,
        clientToken,
        { method: "POST" },
      );
      const redirectUrl = data.authorization_url || data.link;
      if (!redirectUrl) throw new Error("Could not start payment.");

      const pendingPayment = peekPendingPayment(invoiceNumber);
      if (pendingPayment) savePendingPayment({ ...pendingPayment, payment_method: gateway });

      window.location.href = redirectUrl;
    } catch (error) {
      toast.push({ type: "error", message: error instanceof Error ? error.message : "Could not start payment. Please try again or contact support." });
      setIsInitiatingPayment(false);
    }
  };

  const handlePayByBankTransfer = async (invoiceNumber: string) => {
    if (!clientToken || isInitiatingPayment) return;
    setIsInitiatingPayment(true);

    try {
      const data = await laravelApi<BankTransferDetails>(`/api/v1/client/invoices/${invoiceNumber}/pay/bank-transfer`, clientToken, {
        method: "POST",
      });
      setBankTransferInfo(data);
    } catch (error) {
      toast.push({ type: "error", message: error instanceof Error ? error.message : "Could not load bank transfer details." });
    } finally {
      setIsInitiatingPayment(false);
    }
  };

  if (!clientToken) {
    const authMode = route === "register" || route === "forgot" || route === "reset" ? route : "login";
    const authTitle =
      authMode === "register"
        ? "Create your account"
        : authMode === "forgot"
          ? "Forgot password"
          : authMode === "reset"
            ? "Reset password"
            : "Client portal login";

    return (
      <div className="grid min-h-screen place-items-center bg-background px-4 py-10 text-white">
        <div className="admin-panel w-full max-w-2xl">
          <div className="mb-7 flex items-center gap-3">
            <div className="flex h-11 w-11 items-center justify-center rounded-lg border border-primary/30 bg-primary/10">
              <User className="h-5 w-5 text-primary" />
            </div>
            <div>
              <Logo />
              <p className="mt-2 text-sm text-white/55">{authTitle}</p>
            </div>
          </div>

          {authMode === "login" && (
            <form className="grid gap-4" onSubmit={handleClientLogin}>
              <label className="admin-field">
                <span>Email</span>
                <input
                  type="email"
                  value={login.email}
                  onChange={(event) => setLogin((current) => ({ ...current, email: event.target.value }))}
                  placeholder="john@naitalk.test"
                  autoComplete="email"
                  required
                />
              </label>
              <label className="admin-field">
                <span>Password</span>
                <input
                  type="password"
                  value={login.password}
                  onChange={(event) => setLogin((current) => ({ ...current, password: event.target.value }))}
                  autoComplete="current-password"
                  required
                />
              </label>
              <button type="submit" className="btn-primary w-full justify-center" disabled={isLoading}>
                {isLoading ? "Signing in..." : "Sign in"}
                <ArrowRight className="h-4 w-4" />
              </button>
              <div className="flex flex-wrap items-center justify-between gap-3 text-sm font-bold text-white/62">
                <button type="button" className="auth-link auth-link-primary" onClick={() => navigate("/client/register")}>
                  Register a new account
                </button>
                <button type="button" className="auth-link auth-link-cyan" onClick={() => navigate("/client/forgot-password")}>
                  Forgot password?
                </button>
              </div>
            </form>
          )}

          {authMode === "register" && (
            <form className="grid gap-4" onSubmit={handleClientRegister}>
              <div className="grid gap-4 sm:grid-cols-2">
                <label className="admin-field">
                  <span>Full name</span>
                  <input
                    value={registerForm.name}
                    onChange={(event) => setRegisterForm((current) => ({ ...current, name: event.target.value }))}
                    autoComplete="name"
                    required
                  />
                </label>
                <label className="admin-field">
                  <span>Email</span>
                  <input
                    type="email"
                    value={registerForm.email}
                    onChange={(event) => setRegisterForm((current) => ({ ...current, email: event.target.value }))}
                    autoComplete="email"
                    required
                  />
                </label>
              </div>
              <div className="grid gap-4 sm:grid-cols-2">
                <label className="admin-field">
                  <span>Phone</span>
                  <input
                    value={registerForm.phone}
                    onChange={(event) => setRegisterForm((current) => ({ ...current, phone: event.target.value }))}
                    autoComplete="tel"
                  />
                </label>
                <label className="admin-field">
                  <span>Company</span>
                  <input
                    value={registerForm.company_name}
                    onChange={(event) => setRegisterForm((current) => ({ ...current, company_name: event.target.value }))}
                    autoComplete="organization"
                  />
                </label>
              </div>
              <label className="admin-field">
                <span>Billing address</span>
                <textarea
                  value={registerForm.billing_address}
                  onChange={(event) => setRegisterForm((current) => ({ ...current, billing_address: event.target.value }))}
                  rows={3}
                />
              </label>
              <div className="grid gap-4 sm:grid-cols-2">
                <label className="admin-field">
                  <span>Password</span>
                  <input
                    type="password"
                    minLength={8}
                    value={registerForm.password}
                    onChange={(event) => setRegisterForm((current) => ({ ...current, password: event.target.value }))}
                    autoComplete="new-password"
                    required
                  />
                </label>
                <label className="admin-field">
                  <span>Confirm password</span>
                  <input
                    type="password"
                    minLength={8}
                    value={registerForm.password_confirmation}
                    onChange={(event) => setRegisterForm((current) => ({ ...current, password_confirmation: event.target.value }))}
                    autoComplete="new-password"
                    required
                  />
                </label>
              </div>
              <button type="submit" className="btn-primary w-full justify-center" disabled={isLoading}>
                {isLoading ? "Creating account..." : "Create account"}
                <ArrowRight className="h-4 w-4" />
              </button>
              <button type="button" className="auth-link auth-link-primary text-sm font-bold" onClick={() => navigate("/client/login")}>
                Already have an account? Sign in
              </button>
            </form>
          )}

          {authMode === "forgot" && (
            <form className="grid gap-4" onSubmit={handleForgotPassword}>
              <label className="admin-field">
                <span>Email</span>
                <input
                  type="email"
                  value={forgotForm.email}
                  onChange={(event) => setForgotForm({ email: event.target.value })}
                  autoComplete="email"
                  required
                />
              </label>
              <button type="submit" className="btn-primary w-full justify-center" disabled={isLoading}>
                {isLoading ? "Preparing reset..." : "Send reset link"}
                <ArrowRight className="h-4 w-4" />
              </button>
              <button type="button" className="auth-link auth-link-primary text-sm font-bold" onClick={() => navigate("/client/login")}>
                Back to sign in
              </button>
            </form>
          )}

          {authMode === "reset" && (
            <form className="grid gap-4" onSubmit={handleResetPassword}>
              <label className="admin-field">
                <span>Email</span>
                <input
                  type="email"
                  value={resetForm.email}
                  onChange={(event) => setResetForm((current) => ({ ...current, email: event.target.value }))}
                  autoComplete="email"
                  required
                />
              </label>
              <label className="admin-field">
                <span>Reset token</span>
                <input
                  value={resetForm.token}
                  onChange={(event) => setResetForm((current) => ({ ...current, token: event.target.value }))}
                  required
                />
              </label>
              <div className="grid gap-4 sm:grid-cols-2">
                <label className="admin-field">
                  <span>New password</span>
                  <input
                    type="password"
                    minLength={8}
                    value={resetForm.password}
                    onChange={(event) => setResetForm((current) => ({ ...current, password: event.target.value }))}
                    autoComplete="new-password"
                    required
                  />
                </label>
                <label className="admin-field">
                  <span>Confirm password</span>
                  <input
                    type="password"
                    minLength={8}
                    value={resetForm.password_confirmation}
                    onChange={(event) => setResetForm((current) => ({ ...current, password_confirmation: event.target.value }))}
                    autoComplete="new-password"
                    required
                  />
                </label>
              </div>
              <button type="submit" className="btn-primary w-full justify-center" disabled={isLoading}>
                {isLoading ? "Resetting..." : "Reset password"}
                <ArrowRight className="h-4 w-4" />
              </button>
              <button type="button" className="auth-link auth-link-primary text-sm font-bold" onClick={() => navigate("/client/login")}>
                Back to sign in
              </button>
            </form>
          )}
        </div>
      </div>
    );
  }

  if (!dashboard) {
    return (
      <div className="grid min-h-screen place-items-center bg-background px-4 text-white/60">
        Loading your NAI TALK account...
      </div>
    );
  }

  const metricByLabel = (label: string) => dashboard.metrics.find((metric) => metric.label === label)?.value || "";

  if (route === "verify-email") {
    return (
      <ClientPortalShell
        dashboard={dashboard}
        route={route}
        isVerified={isVerified}
        navigate={navigate}
        onLogout={() => void handleClientLogout()}
        onProfileClick={() => navigate("/client/profile")}
      >
        <section className="portal-card mx-auto max-w-xl text-center">
          <div className="mx-auto flex h-14 w-14 items-center justify-center rounded-full border border-primary/30 bg-primary/10">
            <Mail className="h-6 w-6 text-primary" />
          </div>
          <h2 className="mt-5 text-2xl font-black text-white">Account created successfully</h2>
          <p className="mt-3 text-sm text-white/60">
            We have sent a verification code to <strong className="text-white">{verifiedEmail || dashboard.client.email}</strong>.
            Enter the code below to activate your account.
          </p>
          {isVerified ? (
            <p className="form-message success mt-4">Your email is verified. You have full access to your account.</p>
          ) : (
            <form className="mx-auto mt-6 grid max-w-xs gap-3" onSubmit={handleVerifyCode}>
              <label className="admin-field">
                <span>Verification code</span>
                <input
                  value={verificationCode}
                  onChange={(event) => setVerificationCode(event.target.value.replace(/\D/g, "").slice(0, 6))}
                  inputMode="numeric"
                  autoComplete="one-time-code"
                  maxLength={6}
                  placeholder="123456"
                  className="text-center tracking-[0.5em]"
                  required
                />
              </label>
              <button type="submit" className="btn-primary w-full justify-center" disabled={isVerifyingCode || verificationCode.length !== 6}>
                {isVerifyingCode ? "Verifying..." : "Verify Code"}
                <ArrowRight className="h-4 w-4" />
              </button>
            </form>
          )}
          <div className="mt-6 grid gap-3 sm:grid-cols-3">
            <button type="button" className="btn-primary justify-center" disabled={isResending} onClick={() => void handleResendVerification()}>
              {isResending ? "Sending..." : "Resend Verification Email"}
            </button>
            <button type="button" className="btn-outline justify-center" onClick={() => navigate("/client/register")}>
              Change Email Address
            </button>
            <button type="button" className="btn-outline justify-center" onClick={() => (window.location.href = "/")}>
              Back to Home
            </button>
          </div>
        </section>
      </ClientPortalShell>
    );
  }

  if (route === "services-catalog") {
    return (
      <ClientPortalShell
        dashboard={dashboard}
        route={route}
        isVerified={isVerified}
        navigate={navigate}
        onLogout={() => void handleClientLogout()}
        onProfileClick={() => navigate("/client/profile")}
      >
        <section>
          <h2 className="text-2xl font-black text-white">Explore NAI TALK Services</h2>
          <p className="mt-2 text-sm text-white/58">Hosting, websites, maintenance, AI solutions and add-ons — order directly from your account.</p>
          <div className="mt-6 grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
            {(catalog || []).map((item) => {
              const isContactOnly = item.slug === "website-migration";
              const Icon = catalogCategoryIcon(item.category);

              return (
                <article key={item.slug} className="catalog-card">
                  <div className="catalog-card-icon">
                    <Icon className="h-6 w-6" />
                  </div>
                  <span className="hosting-badge !static !ml-0 mt-4 inline-flex w-fit">{item.category.replace("_", " ")}</span>
                  <h3 className="mt-3 text-lg font-black text-white">{item.name}</h3>
                  <p className="mt-2 text-sm leading-6 text-white/58">{item.short_description}</p>
                  {item.benefits.length > 0 && (
                    <ul className="mt-3 grid gap-1.5 text-xs text-white/68">
                      {item.benefits.map((benefit) => (
                        <li key={benefit} className="flex items-center gap-2">
                          <CheckCircle2 className="h-3.5 w-3.5 text-primary" />
                          {benefit}
                        </li>
                      ))}
                    </ul>
                  )}
                  {!isContactOnly && (
                    <p className="mt-4 text-xl font-black text-primary">
                      {item.starting_price ? `From ${item.starting_price}` : "Custom quote"}
                      <span className="ml-1 text-xs font-bold text-white/45">{item.billing_type.replace("_", " ")}</span>
                    </p>
                  )}
                  <div className="mt-4 flex flex-wrap gap-2">
                    {isContactOnly && (
                      <a
                        href="mailto:info@naitalk.com"
                        className="btn-outline justify-center"
                        onClick={() => trackEvent("email_click", { page_section: "services_catalog" })}
                      >
                        Contact Us
                      </a>
                    )}
                    {!isContactOnly && !item.is_quote_only && item.order_route && (
                      <button type="button" className="btn-outline catalog-order-btn justify-center" onClick={() => navigate(item.order_route!)}>
                        Order Now
                      </button>
                    )}
                    {!isContactOnly && item.is_quote_only && (
                      <button
                        type="button"
                        className="btn-outline justify-center"
                        onClick={() => window.open(whatsappUrl, "_blank", "noopener,noreferrer")}
                      >
                        Request Quote
                      </button>
                    )}
                    <button type="button" className="btn-outline justify-center" onClick={() => window.open("/#services", "_blank", "noopener,noreferrer")}>
                      Learn More
                    </button>
                  </div>
                </article>
              );
            })}
            {!catalog && <p className="text-sm text-white/50">Loading services...</p>}
          </div>
        </section>
      </ClientPortalShell>
    );
  }

  if (route === "order-hosting" || route === "order-review" || route === "checkout") {
    if (isVerified === false) {
      return (
        <ClientPortalShell
        dashboard={dashboard}
        route={route}
        isVerified={isVerified}
        navigate={navigate}
        onLogout={() => void handleClientLogout()}
        onProfileClick={() => navigate("/client/profile")}
      >
          <section className="portal-card mx-auto max-w-lg text-center">
            <h2 className="text-xl font-black text-white">Verify your email to continue</h2>
            <p className="mt-3 text-sm text-white/60">You need a verified NAI TALK account before placing a hosting order.</p>
            <button type="button" className="btn-primary mt-5 justify-center" onClick={() => navigate("/client/verify-email")}>
              Go to verification
            </button>
          </section>
        </ClientPortalShell>
      );
    }

    const selectedPlan = hostingPlans.find((plan) => plan.slug === orderDraft.plan_slug);
    const selectedAddOns = addOns.filter((addOn) => orderDraft.add_ons.includes(addOn.slug));
    const planAmount = selectedPlan ? parseNairaAmount(orderDraft.billing_cycle === "monthly" ? selectedPlan.monthly : selectedPlan.annual) : 0;
    const addOnsAmount = selectedAddOns.reduce(
      (sum, addOn) => sum + parseNairaAmount(orderDraft.billing_cycle === "monthly" ? addOn.monthly_price : addOn.annual_price),
      0,
    );
    const domainRegistrationAmount =
      orderDraft.register_domain && domainRegistrationPriceKobo ? domainRegistrationPriceKobo / 100 : 0;
    // Preview only — the invoice returned by POST /orders/hosting is always the
    // authoritative, backend-calculated total actually charged.
    const orderSubtotal = planAmount + addOnsAmount + domainRegistrationAmount;
    const vatAmount = Math.round(orderSubtotal * vatRate);
    const orderTotal = orderSubtotal + vatAmount;
    const vatPercentLabel = `${(vatRate * 100).toFixed(vatRate * 100 % 1 === 0 ? 0 : 1)}%`;

    if (route === "order-hosting") {
      return (
        <ClientPortalShell
        dashboard={dashboard}
        route={route}
        isVerified={isVerified}
        navigate={navigate}
        onLogout={() => void handleClientLogout()}
        onProfileClick={() => navigate("/client/profile")}
      >
          <section className="grid gap-5 lg:grid-cols-[1fr_320px]">
            <div className="portal-card">
              <label className="admin-field">
                <span>Primary domain (optional)</span>
                <input
                  value={orderDraft.primary_domain}
                  onChange={(event) => setOrderDraft((current) => ({ ...current, primary_domain: event.target.value, register_domain: false }))}
                  placeholder="yourbusiness.com"
                  disabled={orderDraft.register_domain}
                />
              </label>
              {orderDraft.register_domain ? (
                <p className="mt-2 text-xs font-bold text-primary">
                  This domain will be registered for you as part of this order.
                </p>
              ) : (
                orderDraft.primary_domain && (
                  <p className="mt-2 text-xs text-white/45">
                    We'll email you DNS instructions to point this domain to your new hosting once it's active.
                  </p>
                )
              )}

              <h2 className="mt-6 text-xl font-black text-white">Choose your website care plan</h2>
              <div className="mt-5 grid gap-3">
                {isLoadingHostingPlans ? (
                  <p className="text-sm text-white/55">Loading plans from the service catalogue...</p>
                ) : hostingPlans.length === 0 ? (
                  <p className="text-sm text-white/55">No hosting plans are available right now. Please try again shortly.</p>
                ) : null}
                {hostingPlans.map((plan) => (
                  <label
                    key={plan.slug}
                    className={`client-service-row cursor-pointer ${orderDraft.plan_slug === plan.slug ? "border-primary/50" : ""}`}
                  >
                    <input
                      type="radio"
                      name="plan"
                      className="h-4 w-4"
                      checked={orderDraft.plan_slug === plan.slug}
                      onChange={() => setOrderDraft((current) => ({ ...current, plan_slug: plan.slug }))}
                    />
                    <div className="min-w-0 flex-1">
                      <p className="flex items-center gap-2">
                        {plan.name}
                        {plan.badge && (
                          <span className="rounded-full bg-primary px-2 py-0.5 text-[9px] font-black uppercase text-on-primary">
                            {plan.badge}
                          </span>
                        )}
                      </p>
                      <small>{plan.audience}</small>
                    </div>
                    <strong>{orderDraft.billing_cycle === "monthly" ? plan.monthly : plan.annual}</strong>
                  </label>
                ))}
              </div>

              <div className="mt-5 flex items-center gap-3">
                <span className="text-sm font-bold text-white/68">Billing cycle</span>
                <div className="inline-flex overflow-hidden rounded-lg border border-white/10">
                  {(["monthly", "annual"] as const).map((cycle) => (
                    <button
                      key={cycle}
                      type="button"
                      className={`px-4 py-2 text-xs font-black uppercase ${orderDraft.billing_cycle === cycle ? "bg-primary text-on-primary" : "bg-transparent text-white/60"}`}
                      onClick={() => setOrderDraft((current) => ({ ...current, billing_cycle: cycle }))}
                    >
                      {cycle}
                    </button>
                  ))}
                </div>
              </div>

              {addOns.length > 0 && (
                <div className="mt-6">
                  <h3 className="text-sm font-black uppercase text-white/68">Optional add-ons</h3>
                  <div className="mt-3 grid gap-2">
                    {addOns.map((addOn) => (
                      <label key={addOn.slug} className="client-service-row cursor-pointer">
                        <input
                          type="checkbox"
                          className="h-4 w-4"
                          checked={orderDraft.add_ons.includes(addOn.slug)}
                          onChange={(event) =>
                            setOrderDraft((current) => ({
                              ...current,
                              add_ons: event.target.checked
                                ? [...current.add_ons, addOn.slug]
                                : current.add_ons.filter((slug) => slug !== addOn.slug),
                            }))
                          }
                        />
                        <div className="min-w-0 flex-1">
                          <p>{addOn.name}</p>
                        </div>
                        <strong>{orderDraft.billing_cycle === "monthly" ? addOn.monthly_price : addOn.annual_price}</strong>
                      </label>
                    ))}
                  </div>
                </div>
              )}
            </div>

            <aside className="portal-card">
              <h2>Order Summary</h2>
              <p className="mt-4 text-sm text-white/52">{selectedPlan?.name || "No plan selected"}</p>
              <p className="mt-1 text-sm text-white/68">
                {selectedPlan ? (orderDraft.billing_cycle === "monthly" ? selectedPlan.monthly : selectedPlan.annual) : "₦0"}
              </p>
              {selectedAddOns.length > 0 && (
                <div className="mt-4 grid gap-2 border-t border-white/10 pt-4 text-sm text-white/68">
                  {selectedAddOns.map((addOn) => (
                    <div key={addOn.slug} className="flex items-center justify-between gap-2">
                      <span>{addOn.name}</span>
                      <span>{orderDraft.billing_cycle === "monthly" ? addOn.monthly_price : addOn.annual_price}</span>
                    </div>
                  ))}
                </div>
              )}
              {orderDraft.register_domain && orderDraft.primary_domain && (
                <div className="mt-4 grid gap-2 border-t border-white/10 pt-4 text-sm text-white/68">
                  <div className="flex items-center justify-between gap-2">
                    <span>Domain Registration — {orderDraft.primary_domain}</span>
                    <span>{domainRegistrationPriceKobo !== null ? formatNaira(domainRegistrationAmount) : "Loading…"}</span>
                  </div>
                </div>
              )}
              <div className="mt-4 grid gap-2 border-t border-white/10 pt-4 text-sm text-white/68">
                <div className="flex items-center justify-between"><span>Subtotal</span><span>{formatNaira(orderSubtotal)}</span></div>
                <div className="flex items-center justify-between"><span>VAT {vatPercentLabel}</span><span>{formatNaira(vatAmount)}</span></div>
              </div>
              <div className="mt-4 flex items-center justify-between border-t border-white/10 pt-4">
                <span className="text-sm font-bold text-white/68">Total Payable</span>
                <h3 className="text-2xl font-black text-white">{formatNaira(orderTotal)}</h3>
              </div>
              <button
                type="button"
                className="btn-primary mt-6 w-full justify-center"
                disabled={!orderDraft.plan_slug}
                onClick={() => navigate("/client/order/review")}
              >
                Review order
                <ArrowRight className="h-4 w-4" />
              </button>
            </aside>
          </section>
        </ClientPortalShell>
      );
    }

    if (route === "order-review") {
      return (
        <ClientPortalShell
        dashboard={dashboard}
        route={route}
        isVerified={isVerified}
        navigate={navigate}
        onLogout={() => void handleClientLogout()}
        onProfileClick={() => navigate("/client/profile")}
      >
          <section className="mx-auto grid max-w-2xl gap-5">
            <div className="portal-card">
              <h2 className="text-xl font-black text-white">Review your order</h2>
              <div className="mt-5 grid gap-3 text-sm text-white/72">
                <p>
                  <strong className="text-white">Domain:</strong> {orderDraft.primary_domain || "Not set"}
                  {orderDraft.primary_domain && (orderDraft.register_domain ? " (will be registered with this order)" : " (existing domain)")}
                </p>
                <p><strong className="text-white">Plan:</strong> {selectedPlan?.name || "—"}</p>
                <p><strong className="text-white">Billing cycle:</strong> {orderDraft.billing_cycle}</p>
                <p>
                  <strong className="text-white">Add-ons:</strong>{" "}
                  {selectedAddOns.length ? selectedAddOns.map((addOn) => addOn.name).join(", ") : "None"}
                </p>
                <p><strong className="text-white">Auto-renew:</strong> Enabled by default — you can turn this off anytime from your service's Manage Hosting page.</p>
                {orderDraft.register_domain && orderDraft.primary_domain && (
                  <p>
                    <strong className="text-white">Domain Registration — {orderDraft.primary_domain}:</strong>{" "}
                    {domainRegistrationPriceKobo !== null ? formatNaira(domainRegistrationAmount) : "Loading…"}
                  </p>
                )}
                <p><strong className="text-white">Subtotal:</strong> {formatNaira(orderSubtotal)}</p>
                <p><strong className="text-white">VAT {vatPercentLabel}:</strong> {formatNaira(vatAmount)}</p>
                <p><strong className="text-white">Total Payable:</strong> {formatNaira(orderTotal)}</p>
              </div>
              <div className="mt-5 border-t border-white/10 pt-5 text-sm text-white/72">
                <p className="font-black text-white">Billing details</p>
                <p className="mt-2">{dashboard.client.name} — {dashboard.client.email}</p>
                <p className="mt-1 text-xs text-white/45">Edit your profile details from Account Settings before checkout if needed.</p>
              </div>
              <div className="mt-6 flex flex-wrap gap-3">
                <button type="button" className="btn-outline justify-center" onClick={() => navigate("/client/order/hosting")}>
                  Back to edit
                </button>
                <button type="button" className="btn-primary justify-center" disabled={!orderDraft.plan_slug} onClick={() => navigate("/client/checkout")}>
                  Proceed to checkout
                  <ArrowRight className="h-4 w-4" />
                </button>
              </div>
            </div>
          </section>
        </ClientPortalShell>
      );
    }

    return (
      <ClientPortalShell
        dashboard={dashboard}
        route={route}
        isVerified={isVerified}
        navigate={navigate}
        onLogout={() => void handleClientLogout()}
        onProfileClick={() => navigate("/client/profile")}
      >
        <section className="mx-auto max-w-xl portal-card text-center">
          <h2 className="text-xl font-black text-white">Checkout</h2>
          {!checkoutResult && (
            <>
              <p className="mt-3 text-sm text-white/60">
                Create your order for {selectedPlan?.name || "your hosting plan"} — {formatNaira(orderTotal)}. An invoice will be created and emailed to you, and you can pay now or later.
              </p>
              <button type="button" className="btn-primary mt-5 w-full justify-center" disabled={isSubmittingOrder} onClick={() => void handleSubmitOrder()}>
                {isSubmittingOrder ? "Creating order..." : "Create order"}
                <ArrowRight className="h-4 w-4" />
              </button>
            </>
          )}

          {checkoutResult && !bankTransferInfo && (
            <>
              <p className="mt-3 text-sm text-white/60">
                Order {checkoutResult.order.order_number} created. Invoice <strong className="text-white">{checkoutResult.invoice.invoice_number}</strong> for{" "}
                <strong className="text-white">{checkoutResult.invoice.total || formatNaira(checkoutResult.invoice.total_kobo / 100)}</strong> has been emailed to you.
              </p>
              <p className="mt-2 text-sm text-white/60">Choose how you'd like to pay:</p>
              <div className="mt-5">
                <PaymentOptionsPanel
                  token={clientToken}
                  invoiceNumber={checkoutResult.invoice.invoice_number}
                  outstandingKobo={checkoutResult.invoice.total_kobo}
                  walletMode="full-only"
                  isInitiatingPayment={isInitiatingPayment}
                  onPayWithGateway={handlePayWithGateway}
                  onPayByBankTransfer={handlePayByBankTransfer}
                  toast={toast}
                  onPaid={() => navigate(`/client/orders/${checkoutResult.order.order_number}`)}
                />
              </div>
              <button type="button" className="btn-outline mt-2 w-full justify-center !min-h-9 !py-1.5 !text-[11px]" onClick={() => navigate("/client/orders")}>
                Pay Later
              </button>
            </>
          )}

          {checkoutResult && bankTransferInfo && (
            <div className="mt-5 rounded-lg border border-white/10 bg-black/20 p-5 text-left text-sm text-white/72">
              <p className="font-black text-white">Bank Transfer Details</p>
              <p className="mt-3">
                <strong className="text-white">Bank:</strong> {bankTransferInfo.bank_name}
              </p>
              <p className="mt-1">
                <strong className="text-white">Account name:</strong> {bankTransferInfo.account_name}
              </p>
              <p className="mt-1">
                <strong className="text-white">Account number:</strong> {bankTransferInfo.account_number}
              </p>
              <p className="mt-1">
                <strong className="text-white">Amount:</strong> {bankTransferInfo.amount}
              </p>
              <p className="mt-1">
                <strong className="text-white">Reference:</strong> {bankTransferInfo.reference}
              </p>
              <p className="mt-3 text-white/60">{bankTransferInfo.message}</p>
              <button type="button" className="mt-3 text-xs font-bold text-primary underline" onClick={() => setBankTransferInfo(null)}>
                Choose a different payment method
              </button>
              <button type="button" className="btn-primary mt-3 w-full justify-center" onClick={() => navigate("/client/orders")}>
                View my orders to upload proof of payment
              </button>
            </div>
          )}
        </section>
      </ClientPortalShell>
    );
  }

  if (route === "hosting-manage") {
    if (!hostingServiceId) {
      navigate("/client/dashboard");

      return null;
    }

    return (
      <ClientPortalShell
        dashboard={dashboard}
        route={route}
        isVerified={isVerified}
        navigate={navigate}
        onLogout={() => void handleClientLogout()}
        onProfileClick={() => navigate("/client/profile")}
        hideWelcomeHeader
      >
        <HostingManagePanel serviceId={hostingServiceId} token={clientToken} navigate={navigate} toast={toast} />
      </ClientPortalShell>
    );
  }

  if (route === "wallet") {
    return (
      <ClientPortalShell
        dashboard={dashboard}
        route={route}
        isVerified={isVerified}
        navigate={navigate}
        onLogout={() => void handleClientLogout()}
        onProfileClick={() => navigate("/client/profile")}
      >
        <ClientWalletPage token={clientToken} toast={toast} />
      </ClientPortalShell>
    );
  }

  if (route === "payment-methods") {
    return (
      <ClientPortalShell
        dashboard={dashboard}
        route={route}
        isVerified={isVerified}
        navigate={navigate}
        onLogout={() => void handleClientLogout()}
        onProfileClick={() => navigate("/client/profile")}
      >
        <ClientPaymentMethodsPage token={clientToken} toast={toast} />
      </ClientPortalShell>
    );
  }

  if (route === "domain-search") {
    return (
      <ClientPortalShell
        dashboard={dashboard}
        route={route}
        isVerified={isVerified}
        navigate={navigate}
        onLogout={() => void handleClientLogout()}
        onProfileClick={() => navigate("/client/profile")}
      >
        <DomainSearchPage navigate={navigate} toast={toast} />
      </ClientPortalShell>
    );
  }

  if (route === "domain-checkout") {
    return (
      <ClientPortalShell
        dashboard={dashboard}
        route={route}
        isVerified={isVerified}
        navigate={navigate}
        onLogout={() => void handleClientLogout()}
        onProfileClick={() => navigate("/client/profile")}
      >
        <DomainOnlyCheckoutPage
          token={clientToken}
          domainName={search.get("domain")}
          navigate={navigate}
          toast={toast}
          isInitiatingPayment={isInitiatingPayment}
          onPayWithGateway={handlePayWithGateway}
          onPayByBankTransfer={handlePayByBankTransfer}
        />
      </ClientPortalShell>
    );
  }

  if (route === "domain-transfer") {
    return (
      <ClientPortalShell
        dashboard={dashboard}
        route={route}
        isVerified={isVerified}
        navigate={navigate}
        onLogout={() => void handleClientLogout()}
        onProfileClick={() => navigate("/client/profile")}
      >
        <DomainTransferPage
          token={clientToken}
          navigate={navigate}
          toast={toast}
          isInitiatingPayment={isInitiatingPayment}
          onPayWithGateway={handlePayWithGateway}
          onPayByBankTransfer={handlePayByBankTransfer}
        />
      </ClientPortalShell>
    );
  }

  if (route === "domains") {
    return (
      <ClientPortalShell
        dashboard={dashboard}
        route={route}
        isVerified={isVerified}
        navigate={navigate}
        onLogout={() => void handleClientLogout()}
        onProfileClick={() => navigate("/client/profile")}
      >
        <ClientDomainsPage token={clientToken} navigate={navigate} toast={toast} />
      </ClientPortalShell>
    );
  }

  if (route === "domain-detail") {
    return (
      <ClientPortalShell
        dashboard={dashboard}
        route={route}
        isVerified={isVerified}
        navigate={navigate}
        onLogout={() => void handleClientLogout()}
        onProfileClick={() => navigate("/client/profile")}
      >
        <DomainAddHostingPage
          token={clientToken}
          domainId={domainId}
          navigate={navigate}
          toast={toast}
          isInitiatingPayment={isInitiatingPayment}
          onPayWithGateway={handlePayWithGateway}
          onPayByBankTransfer={handlePayByBankTransfer}
        />
      </ClientPortalShell>
    );
  }

  if (route === "domain-contact") {
    return (
      <ClientPortalShell
        dashboard={dashboard}
        route={route}
        isVerified={isVerified}
        navigate={navigate}
        onLogout={() => void handleClientLogout()}
        onProfileClick={() => navigate("/client/profile")}
      >
        <DomainContactProfilePage token={clientToken} toast={toast} />
      </ClientPortalShell>
    );
  }

  if (route === "profile") {
    return (
      <ClientPortalShell
        dashboard={dashboard}
        route={route}
        isVerified={isVerified}
        navigate={navigate}
        onLogout={() => void handleClientLogout()}
      >
        <ClientProfilePage token={clientToken} dashboard={dashboard} toast={toast} />
      </ClientPortalShell>
    );
  }

  if (route === "invoice-detail") {
    if (!orderNumber) {
      navigate("/client/orders");

      return null;
    }

    return (
      <ClientPortalShell
        dashboard={dashboard}
        route={route}
        isVerified={isVerified}
        navigate={navigate}
        onLogout={() => void handleClientLogout()}
        onProfileClick={() => navigate("/client/profile")}
        hideWelcomeHeader
      >
        <ClientInvoicePage
          orderNumber={orderNumber}
          token={clientToken}
          navigate={navigate}
          toast={toast}
          isInitiatingPayment={isInitiatingPayment}
          bankTransferInfo={bankTransferInfo}
          onPayWithGateway={handlePayWithGateway}
          onPayByBankTransfer={handlePayByBankTransfer}
          onResetBankTransfer={() => setBankTransferInfo(null)}
        />
      </ClientPortalShell>
    );
  }

  if (route === "invoice-by-number") {
    if (!invoiceNumber) {
      navigate("/client/dashboard");

      return null;
    }

    return (
      <ClientPortalShell
        dashboard={dashboard}
        route={route}
        isVerified={isVerified}
        navigate={navigate}
        onLogout={() => void handleClientLogout()}
        onProfileClick={() => navigate("/client/profile")}
        hideWelcomeHeader
      >
        <ClientInvoicePage
          invoiceNumber={invoiceNumber}
          token={clientToken}
          navigate={navigate}
          toast={toast}
          isInitiatingPayment={isInitiatingPayment}
          bankTransferInfo={bankTransferInfo}
          onPayWithGateway={handlePayWithGateway}
          onPayByBankTransfer={handlePayByBankTransfer}
          onResetBankTransfer={() => setBankTransferInfo(null)}
        />
      </ClientPortalShell>
    );
  }

  if (route === "orders") {
    return (
      <ClientPortalShell
        dashboard={dashboard}
        route={route}
        isVerified={isVerified}
        navigate={navigate}
        onLogout={() => void handleClientLogout()}
        onProfileClick={() => navigate("/client/profile")}
      >
        <section>
          <h2 className="text-2xl font-black text-white">My Orders</h2>
          <div className="mt-5 grid gap-3">
            {(orders || []).map((order) => {
              const isUnpaid = order.invoice && order.invoice.status !== "paid";

              return (
                <div
                  key={order.order_number}
                  className="portal-card cursor-pointer"
                  onClick={() => navigate(`/client/orders/${order.order_number}`)}
                >
                  <div className="client-service-row !border-0 !p-0">
                    <div className="row-icon"><PackageCheck className="h-4 w-4" /></div>
                    <div className="min-w-0 flex-1">
                      <p>{order.order_number}</p>
                      <small>{order.items.map((item) => item.description).join(", ")}</small>
                      {order.invoice && <small className="block text-white/40">Invoice {order.invoice.invoice_number}</small>}
                    </div>
                    <span className={isUnpaid ? "status-pill failed" : "status-pill paid"}>{order.invoice?.status || order.status}</span>
                    <strong>{order.total}</strong>
                    {isUnpaid && order.invoice && (
                      <button
                        type="button"
                        className="btn-outline"
                        onClick={(event) => {
                          event.stopPropagation();
                          trackCtaClick({ button_text: "Pay Now / Upload Proof", page_section: "client_orders_list" });
                          navigate(`/client/orders/${order.order_number}`);
                        }}
                      >
                        Pay Now / Upload Proof
                      </button>
                    )}
                  </div>
                </div>
              );
            })}
            {orders && orders.length === 0 && <p className="text-sm text-white/50">You have not placed any orders yet.</p>}
            {!orders && <p className="text-sm text-white/50">Loading your orders...</p>}
          </div>
        </section>
      </ClientPortalShell>
    );
  }

  return (
    <ClientPortalShell
        dashboard={dashboard}
        route={route}
        isVerified={isVerified}
        navigate={navigate}
        onLogout={() => void handleClientLogout()}
        onProfileClick={() => navigate("/client/profile")}
      >
      {dashboard.empty_state ? (
        <section className="portal-card mx-auto max-w-xl text-center">
          <h2 className="text-xl font-black text-white">Welcome to NAI TALK</h2>
          <p className="mt-3 text-sm text-white/60">{dashboard.empty_state.title}</p>
          <p className="mt-1 text-sm text-white/60">
            Explore our hosting plans, request a website project, or speak with our team about a solution for your business.
          </p>
          <div className="mt-6 grid gap-3 sm:grid-cols-2">
            <button type="button" className="btn-primary justify-center" onClick={() => navigate("/client/order/hosting")}>
              Order Services
            </button>
            <button type="button" className="btn-outline justify-center" onClick={() => navigate("/client/services/catalog")}>
              Request a Website
            </button>
          </div>
        </section>
      ) : (
        <div className="portal-stats">
          {[
            [PackageCheck, "Active Services", metricByLabel("Active Services"), "tone-lime"],
            [CreditCard, "Outstanding Balance", metricByLabel("Outstanding Balance"), "tone-cyan"],
            [CalendarClock, "Next Renewal", metricByLabel("Next Renewal") || "No renewal", "tone-gold"],
            [Wallet, "Total Paid", metricByLabel("Total Paid"), "tone-violet"],
          ].map(([Icon, label, value, tone]) => (
            <article key={label as string} className={`portal-card ${tone as string}`}>
              <div className="portal-card-icon">
                {React.createElement(Icon as React.ComponentType<{ className?: string }>, { className: "h-5 w-5" })}
              </div>
              <p>{label as string}</p>
              <h3>{value as string}</h3>
            </article>
          ))}
        </div>
      )}

      {!dashboard.empty_state && (
        <div className="grid gap-5">
          <section className="portal-card">
            <div className="flex items-center justify-between">
              <h2>Your Services</h2>
            </div>
            <div className="mt-5 grid gap-3">
              {dashboard.services.map((service) => (
                <button
                  key={service.service_number}
                  type="button"
                  className="client-service-row cursor-pointer text-left"
                  onClick={() => navigate(`/client/services/${service.id}/manage`)}
                >
                  <div className="row-icon"><Server className="h-4 w-4" /></div>
                  <div className="min-w-0 flex-1">
                    <p>{service.primary_domain || service.service_number}</p>
                    <small>{service.plan || "Hosting Service"}</small>
                  </div>
                  <span className={hostingStatusPillClass(service.status)}>{service.status}</span>
                  <small>{service.renews_at ? formatDate(service.renews_at) : "No date"}</small>
                  <strong>{service.service_number}</strong>
                </button>
              ))}
            </div>
          </section>

          {dashboard.invoices.length > 0 && (
            <section className="portal-card">
              <div className="flex items-center justify-between">
                <h2>Invoices</h2>
              </div>
              <div className="mt-5 grid gap-3">
                {dashboard.invoices.map((invoice) => (
                  <button
                    key={invoice.invoice_number}
                    type="button"
                    className="client-service-row cursor-pointer text-left"
                    onClick={() => navigate(`/client/invoices/${invoice.invoice_number}`)}
                  >
                    <div className="row-icon"><CreditCard className="h-4 w-4" /></div>
                    <div className="min-w-0 flex-1">
                      <p>{invoice.invoice_number}</p>
                      <small>Due {invoice.due_at ? formatDate(invoice.due_at) : "—"}</small>
                    </div>
                    <span className={invoice.status === "paid" ? "status-pill paid" : "status-pill failed"}>{invoice.status}</span>
                    <strong>{invoice.total}</strong>
                  </button>
                ))}
              </div>
            </section>
          )}
        </div>
      )}

      <div className="portal-actions">
        {[
          [PackageCheck, "Hosting Plans", () => navigate("/client/services/catalog"), "tone-lime"],
          [Bot, "Explore AI Solutions", () => navigate("/client/services/catalog"), "tone-violet"],
        ].map(([Icon, title, onClick, tone]) => (
          <button
            key={title as string}
            type="button"
            className={`portal-card tone-interactive group text-left ${tone as string}`}
            onClick={onClick as () => void}
          >
            <div className="portal-card-icon">
              {React.createElement(Icon as React.ComponentType<{ className?: string }>, { className: "h-5 w-5" })}
            </div>
            <h3>{title as string}</h3>
            <div className="portal-action-arrow">
              <ArrowRight className="h-4 w-4" />
            </div>
          </button>
        ))}
      </div>
    </ClientPortalShell>
  );
}


function Testimonials({ reviews }: { reviews: Review[] }) {
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
                <div className="mb-4 flex gap-1 text-primary" aria-label={`${review.rating} star rating`}>
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

function Contact({ logo }: { logo: LogoImage }) {
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

const socialLinks = [
  [Twitter, "Twitter", "https://twitter.com/naitalkc"],
  [Facebook, "Facebook", "https://facebook.com/naitalk"],
  [Linkedin, "LinkedIn", "https://www.linkedin.com/company/naitalk/"],
] as const;

const footerColumns: Array<{ title: string; links: Array<{ label: string; href: string }> }> = [
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

const paymentBadges = [
  { label: "Visa", classes: "bg-white text-[#1a1f71]" },
  { label: "Mastercard", classes: "bg-white text-[#eb001b]" },
  { label: "Verve", classes: "bg-white text-[#00833e]" },
];

function Footer({ logo }: { logo: LogoImage }) {
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
            <span className="text-xs text-white/45">We accept:</span>
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

function FloatingWhatsApp() {
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

function SectionHeader({
  eyebrow,
  title,
  align = "center",
}: {
  eyebrow: string;
  title: React.ReactNode;
  align?: "center" | "left";
}) {
  return (
    <div className={align === "center" ? "mx-auto max-w-2xl text-center" : "max-w-2xl"}>
      <span className="eyebrow">{eyebrow}</span>
      <h2 className="mt-3 text-3xl font-black leading-tight text-white sm:text-4xl">{title}</h2>
    </div>
  );
}

function emptyProject(): Project {
  return {
    title: "",
    category: "",
    img: "",
    details: {
      challenge: "",
      solution: "",
      roi: "",
    },
  };
}

function emptyClientLogo(): ClientLogo {
  return {
    name: "",
    alt: "",
    src: "",
    width: null,
    height: null,
  };
}

function emptyReview(): Review {
  return {
    author_name: "",
    rating: 5,
    text: "",
    profile_photo_url: "",
    relative_time_description: "",
  };
}

function emptyPricingPackage(): PricingPackage {
  return {
    name: "",
    slug: "",
    short_description: "",
    monthly_price_kobo: 0,
    annual_price_kobo: 0,
    setup_fee_kobo: 0,
    currency: "NGN",
    storage_allocation: "10GB SSD",
    bandwidth_policy: "Unmetered bandwidth",
    websites: 1,
    databases: 1,
    email_accounts: 1,
    backup_frequency: "Weekly",
    support_tier: "standard",
    migration_included: false,
    is_featured: false,
    is_popular: false,
    is_recommended: false,
    is_active: true,
    status: "active",
    sort_order: 0,
    display_badge: "",
    cta_label: "Choose plan",
    internal_notes: "",
    public_features: [],
    internal_limits: {},
  };
}

function fileToDataUrl(file: File) {
  return new Promise<string>((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(String(reader.result || ""));
    reader.onerror = () => reject(new Error("Image could not be read"));
    reader.readAsDataURL(file);
  });
}

type DomainMarkupType = "cost_plus_markup" | "percentage_markup" | "fixed_customer_price" | "manual_price";

type DomainPricingRow = {
  id: number | null;
  tld: string;
  provider: string;
  currency: string;
  provider_currency: string | null;
  provider_registration_price: string | null;
  provider_renewal_price: string | null;
  provider_transfer_price: string | null;
  exchange_rate_to_ngn: number | null;
  safety_buffer_percent: number;
  registration_price_kobo: number;
  renewal_price_kobo: number;
  transfer_price_kobo: number;
  markup_type: DomainMarkupType;
  markup_value_kobo: number | null;
  markup_percent: number | null;
  fixed_customer_price_kobo: number | null;
  is_ready: boolean;
  customer_registration_price: string | null;
  customer_renewal_price: string | null;
  customer_transfer_price: string | null;
  status: "needs_review" | "active" | "inactive";
  last_synced_at: string | null;
  last_sync_status: string | null;
  last_sync_error: string | null;
};

function emptyDomainPricingRow(): DomainPricingRow {
  return {
    id: null,
    tld: "",
    provider: "spaceship",
    currency: "NGN",
    provider_currency: null,
    provider_registration_price: null,
    provider_renewal_price: null,
    provider_transfer_price: null,
    exchange_rate_to_ngn: null,
    safety_buffer_percent: 0,
    registration_price_kobo: 0,
    renewal_price_kobo: 0,
    transfer_price_kobo: 0,
    markup_type: "cost_plus_markup",
    markup_value_kobo: 0,
    markup_percent: null,
    fixed_customer_price_kobo: null,
    is_ready: false,
    customer_registration_price: null,
    customer_renewal_price: null,
    customer_transfer_price: null,
    status: "needs_review",
    last_synced_at: null,
    last_sync_status: null,
    last_sync_error: null,
  };
}

type DomainPricingSettingsData = {
  base_currency: string;
  target_currency: string;
  exchange_rate: number | null;
  safety_buffer_percent: number;
  default_markup_type: DomainMarkupType;
  default_markup_value_kobo: number | null;
  default_markup_percent: number | null;
  auto_sync_enabled: boolean;
  sync_frequency: "manual" | "weekly" | "monthly";
  last_updated_by: string | null;
  updated_at: string | null;
  manual_balance_ngn_kobo: number | null;
  manual_balance_checked_at: string | null;
  low_balance_threshold_kobo: number;
  is_balance_low: boolean;
};

type DomainPricingSyncLogRow = {
  id: number;
  sync_type: string;
  status: string;
  started_at: string | null;
  completed_at: string | null;
  total_tlds_found: number;
  total_tlds_created: number;
  total_tlds_updated: number;
  total_tlds_failed: number;
  error_message: string | null;
};

/**
 * Global FX rate + default markup + sync controls — the "only thing the
 * admin should normally edit" per the pricing spec. Per-TLD markup is still
 * editable individually further down the page.
 */
function AdminDomainPricingSettingsPanel({
  adminToken,
  onSynced,
}: {
  adminToken: string;
  onSynced: () => void;
}) {
  const [settings, setSettings] = useState<DomainPricingSettingsData | null>(null);
  const [isSaving, setIsSaving] = useState(false);
  const [isSyncing, setIsSyncing] = useState(false);
  const [notice, setNotice] = useState<{ text: string; isError: boolean } | null>(null);
  const [logs, setLogs] = useState<DomainPricingSyncLogRow[]>([]);
  const [showLogs, setShowLogs] = useState(false);
  const [balanceInput, setBalanceInput] = useState("");
  const [isSavingBalance, setIsSavingBalance] = useState(false);

  const load = React.useCallback(() => {
    laravelApi<DomainPricingSettingsData>("/api/v1/admin/domain-pricing-settings", adminToken)
      .then(setSettings)
      .catch(() => undefined);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [adminToken]);

  useEffect(() => {
    load();
  }, [load]);

  const loadLogs = () => {
    laravelApi<{ data: DomainPricingSyncLogRow[] }>("/api/v1/admin/domain-pricing/sync-logs", adminToken)
      .then((response) => setLogs(response.data || []))
      .catch(() => undefined);
  };

  const save = async () => {
    if (!settings) return;
    setIsSaving(true);
    setNotice(null);

    try {
      const saved = await laravelApi<DomainPricingSettingsData>("/api/v1/admin/domain-pricing-settings", adminToken, {
        method: "PUT",
        body: JSON.stringify(settings),
      });
      setSettings(saved);
      setNotice({ text: "FX rate and default markup saved.", isError: false });
    } catch (error) {
      setNotice({ text: error instanceof Error ? error.message : "Saving settings failed.", isError: true });
    } finally {
      setIsSaving(false);
    }
  };

  const sync = async () => {
    setIsSyncing(true);
    setNotice(null);

    try {
      const response = await laravelApi<{ message: string }>("/api/v1/admin/domain-pricing/sync", adminToken, { method: "POST" });
      setNotice({ text: response.message || "Sync started. Prices will update shortly.", isError: false });
      onSynced();
      loadLogs();
    } catch (error) {
      setNotice({ text: error instanceof Error ? error.message : "Starting the sync failed.", isError: true });
    } finally {
      setIsSyncing(false);
    }
  };

  const saveBalance = async () => {
    if (!settings || balanceInput.trim() === "") return;
    setIsSavingBalance(true);

    try {
      const saved = await laravelApi<DomainPricingSettingsData>("/api/v1/admin/domain-pricing-settings/balance", adminToken, {
        method: "PUT",
        body: JSON.stringify({ manual_balance_ngn_kobo: Math.round(Number(balanceInput) * 100) }),
      });
      setSettings(saved);
      setBalanceInput("");
      setNotice({ text: "Spaceship balance recorded.", isError: false });
    } catch (error) {
      setNotice({ text: error instanceof Error ? error.message : "Saving the balance failed.", isError: true });
    } finally {
      setIsSavingBalance(false);
    }
  };

  if (!settings) {
    return (
      <div className="admin-panel">
        <p className="text-sm font-bold text-white/60">Loading pricing settings...</p>
      </div>
    );
  }

  return (
    <div className="admin-panel">
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h2 className="text-2xl font-black">FX Rate & Default Markup</h2>
          <p className="mt-1 text-sm text-white/55">
            The exchange rate and default markup used whenever new TLDs are synced from Spaceship. This is normally
            the only thing you need to edit — per-TLD markup below can still be overridden individually.
          </p>
        </div>
        <button type="button" className="btn-primary justify-center !text-[11px]" disabled={isSyncing} onClick={() => void sync()}>
          <RefreshCw className="h-4 w-4" />
          {isSyncing ? "Syncing..." : "Sync Prices from Spaceship"}
        </button>
      </div>

      <p className="mt-3 rounded-lg border border-yellow-500/25 bg-yellow-500/10 p-3 text-xs font-semibold leading-5 text-yellow-200">
        Note: Spaceship's official API does not currently provide a bulk TLD pricing endpoint (confirmed against
        their docs), so this button will report a failed sync until they add one — it never overwrites existing
        prices when that happens. Provider cost per TLD should be entered manually below (checked against Spaceship's
        own pricing) until an automatic source is available.
      </p>

      <div className="mt-5 grid gap-4 lg:grid-cols-4">
        <label className="admin-field">
          <span>Provider currency</span>
          <input value={settings.base_currency} onChange={(event) => setSettings({ ...settings, base_currency: event.target.value.toUpperCase() })} />
        </label>
        <label className="admin-field">
          <span>Target currency</span>
          <input value={settings.target_currency} onChange={(event) => setSettings({ ...settings, target_currency: event.target.value.toUpperCase() })} />
        </label>
        <label className="admin-field">
          <span>
            Exchange rate (1 {settings.base_currency} = ₦)
          </span>
          <input
            type="number"
            min={0}
            step="0.01"
            value={settings.exchange_rate ?? ""}
            onChange={(event) => setSettings({ ...settings, exchange_rate: event.target.value === "" ? null : Number(event.target.value) })}
          />
        </label>
        <label className="admin-field">
          <span>Safety buffer (%)</span>
          <input
            type="number"
            min={0}
            max={100}
            step="0.1"
            value={settings.safety_buffer_percent}
            onChange={(event) => setSettings({ ...settings, safety_buffer_percent: Number(event.target.value) })}
          />
        </label>
      </div>

      <div className="mt-4 grid gap-4 lg:grid-cols-4">
        <label className="admin-field">
          <span>Default markup type</span>
          <select
            value={settings.default_markup_type}
            onChange={(event) => setSettings({ ...settings, default_markup_type: event.target.value as DomainMarkupType })}
          >
            <option value="cost_plus_markup">Fixed amount</option>
            <option value="percentage_markup">Percentage</option>
            <option value="fixed_customer_price">Fixed customer price</option>
          </select>
        </label>
        {settings.default_markup_type === "percentage_markup" ? (
          <label className="admin-field">
            <span>Default markup (%)</span>
            <input
              type="number"
              min={0}
              step="0.1"
              value={settings.default_markup_percent ?? ""}
              onChange={(event) => setSettings({ ...settings, default_markup_percent: event.target.value === "" ? null : Number(event.target.value) })}
            />
          </label>
        ) : (
          <label className="admin-field">
            <span>Default markup (₦)</span>
            <input
              type="number"
              min={0}
              value={(settings.default_markup_value_kobo ?? 0) / 100}
              onChange={(event) => setSettings({ ...settings, default_markup_value_kobo: Math.round(Number(event.target.value) * 100) })}
            />
          </label>
        )}
        <label className="admin-field">
          <span>Auto-sync</span>
          <select
            value={settings.auto_sync_enabled ? "on" : "off"}
            onChange={(event) => setSettings({ ...settings, auto_sync_enabled: event.target.value === "on" })}
          >
            <option value="off">Disabled</option>
            <option value="on">Enabled</option>
          </select>
        </label>
        <label className="admin-field">
          <span>Sync frequency</span>
          <select
            value={settings.sync_frequency}
            onChange={(event) => setSettings({ ...settings, sync_frequency: event.target.value as DomainPricingSettingsData["sync_frequency"] })}
          >
            <option value="manual">Manual only</option>
            <option value="weekly">Weekly</option>
            <option value="monthly">Monthly</option>
          </select>
        </label>
      </div>

      <div className="mt-4 flex flex-wrap items-center gap-3">
        <button type="button" className="btn-outline justify-center !text-[11px]" disabled={isSaving} onClick={() => void save()}>
          {isSaving ? "Saving..." : "Save Settings"}
        </button>
        <button
          type="button"
          className="text-[11px] font-bold text-white/50 underline"
          onClick={() => {
            setShowLogs((current) => !current);
            if (!showLogs) loadLogs();
          }}
        >
          {showLogs ? "Hide sync history" : "View sync history"}
        </button>
        {settings.last_updated_by && (
          <span className="text-[11px] text-white/40">
            Last updated by {settings.last_updated_by}
            {settings.updated_at && ` on ${formatDateTime(settings.updated_at)}`}
          </span>
        )}
        {notice && (
          <span className={`rounded-full px-3 py-1.5 text-[11px] font-bold ${notice.isError ? "bg-red-500/15 text-red-400" : "bg-primary/15 text-primary"}`}>
            {notice.text}
          </span>
        )}
      </div>

      <div className="mt-5 rounded-lg border border-white/10 bg-black/20 p-4">
        <p className="text-sm font-black text-white">Spaceship Balance</p>
        <p className="mt-1 text-xs text-white/50">
          Spaceship's API has no wallet/balance endpoint, so this is tracked manually — check your balance on
          Spaceship's own site and record it here.
        </p>

        {settings.manual_balance_ngn_kobo !== null && (
          <div className="mt-3 flex flex-wrap items-center gap-3">
            <span className="text-lg font-black text-white">{formatNaira(settings.manual_balance_ngn_kobo / 100)}</span>
            {settings.manual_balance_checked_at && (
              <span className="text-[11px] text-white/40">Checked {formatDateTime(settings.manual_balance_checked_at)}</span>
            )}
            {settings.is_balance_low && (
              <span className="rounded-full bg-red-500/15 px-3 py-1 text-[11px] font-black text-red-400">
                Warning: balance may be too low for automatic domain registration.
              </span>
            )}
          </div>
        )}

        <div className="mt-3 flex flex-wrap items-end gap-3">
          <label className="admin-field">
            <span>Record current balance (₦)</span>
            <input type="number" min={0} value={balanceInput} onChange={(event) => setBalanceInput(event.target.value)} placeholder="e.g. 150000" />
          </label>
          <label className="admin-field">
            <span>Low-balance threshold (₦)</span>
            <input
              type="number"
              min={0}
              value={settings.low_balance_threshold_kobo / 100}
              onChange={(event) => setSettings({ ...settings, low_balance_threshold_kobo: Math.round(Number(event.target.value) * 100) })}
            />
          </label>
          <button
            type="button"
            className="btn-outline justify-center !text-[11px]"
            disabled={isSavingBalance || balanceInput.trim() === ""}
            onClick={() => void saveBalance()}
          >
            {isSavingBalance ? "Saving..." : "Save Balance"}
          </button>
        </div>
      </div>

      {showLogs && (
        <div className="mt-4 overflow-x-auto rounded-lg border border-white/10">
          <table className="admin-table">
            <thead>
              <tr>
                <th>Started</th>
                <th>Type</th>
                <th>Status</th>
                <th>Found</th>
                <th>Created</th>
                <th>Updated</th>
                <th>Failed</th>
                <th>Error</th>
              </tr>
            </thead>
            <tbody>
              {logs.length === 0 ? (
                <tr>
                  <td colSpan={8}>No sync runs yet.</td>
                </tr>
              ) : (
                logs.map((log) => (
                  <tr key={log.id}>
                    <td>{log.started_at ? formatDateTime(log.started_at) : "—"}</td>
                    <td>{log.sync_type}</td>
                    <td>{log.status}</td>
                    <td>{log.total_tlds_found}</td>
                    <td>{log.total_tlds_created}</td>
                    <td>{log.total_tlds_updated}</td>
                    <td>{log.total_tlds_failed}</td>
                    <td>{log.error_message || "—"}</td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}

/**
 * Admin CRUD for domain TLD pricing (spec §10). Deactivate ("Deactivate")
 * soft-deletes by flipping status to inactive server-side rather than
 * physically deleting the row, matching DomainPricingController::destroy().
 */
function AdminDomainPricingPage({ adminToken }: { adminToken: string }) {
  const [rows, setRows] = useState<DomainPricingRow[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [savingIndex, setSavingIndex] = useState<number | null>(null);
  const [savedNotice, setSavedNotice] = useState<{ index: number; text: string; isError: boolean } | null>(null);
  const [tldFilter, setTldFilter] = useState("");
  const [statusFilter, setStatusFilter] = useState<"all" | DomainPricingRow["status"]>("all");
  const [syncStatusFilter, setSyncStatusFilter] = useState<"all" | "success" | "failed" | "never">("all");

  const load = React.useCallback(() => {
    setIsLoading(true);
    laravelApi<{ data: Array<Record<string, unknown>> }>("/api/v1/admin/domain-pricing", adminToken)
      .then((response) => {
        setRows(
          (response.data || []).map((row) => ({
            id: Number(row.id),
            tld: String(row.tld || ""),
            provider: String(row.provider || ""),
            currency: String(row.currency || "NGN"),
            provider_currency: (row.provider_currency as string) ?? null,
            provider_registration_price: (row.provider_registration_price as string) ?? null,
            provider_renewal_price: (row.provider_renewal_price as string) ?? null,
            provider_transfer_price: (row.provider_transfer_price as string) ?? null,
            exchange_rate_to_ngn: row.exchange_rate_to_ngn === null || row.exchange_rate_to_ngn === undefined ? null : Number(row.exchange_rate_to_ngn),
            safety_buffer_percent: Number(row.safety_buffer_percent || 0),
            registration_price_kobo: Number(row.registration_price_kobo || 0),
            renewal_price_kobo: Number(row.renewal_price_kobo || 0),
            transfer_price_kobo: Number(row.transfer_price_kobo || 0),
            markup_type: (row.markup_type as DomainPricingRow["markup_type"]) || "cost_plus_markup",
            markup_value_kobo: row.markup_value_kobo === null || row.markup_value_kobo === undefined ? null : Number(row.markup_value_kobo),
            markup_percent: row.markup_percent === null || row.markup_percent === undefined ? null : Number(row.markup_percent),
            fixed_customer_price_kobo:
              row.fixed_customer_price_kobo === null || row.fixed_customer_price_kobo === undefined ? null : Number(row.fixed_customer_price_kobo),
            is_ready: Boolean(row.is_ready),
            customer_registration_price: (row.customer_registration_price as string) ?? null,
            customer_renewal_price: (row.customer_renewal_price as string) ?? null,
            customer_transfer_price: (row.customer_transfer_price as string) ?? null,
            status: (row.status as DomainPricingRow["status"]) || "needs_review",
            last_synced_at: (row.last_synced_at as string) ?? null,
            last_sync_status: (row.last_sync_status as string) ?? null,
            last_sync_error: (row.last_sync_error as string) ?? null,
          })),
        );
      })
      .catch(() => undefined)
      .finally(() => setIsLoading(false));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [adminToken]);

  useEffect(() => {
    load();
  }, [load]);

  const update = (index: number, patch: Partial<DomainPricingRow>) => {
    setRows((current) => current.map((row, i) => (i === index ? { ...row, ...patch } : row)));
  };

  const flashSavedNotice = (index: number, text: string, isError = false) => {
    setSavedNotice({ index, text, isError });
    window.setTimeout(() => {
      setSavedNotice((current) => (current?.index === index ? null : current));
    }, 4000);
  };

  const save = async (index: number) => {
    const row = rows[index];
    const wasNew = !row.id;
    setSavingIndex(index);
    setSavedNotice(null);

    try {
      const payload = {
        tld: row.tld,
        provider: row.provider,
        currency: row.currency,
        registration_price_kobo: row.registration_price_kobo,
        renewal_price_kobo: row.renewal_price_kobo,
        transfer_price_kobo: row.transfer_price_kobo,
        markup_type: row.markup_type,
        markup_value_kobo: row.markup_value_kobo,
        markup_percent: row.markup_percent,
        fixed_customer_price_kobo: row.fixed_customer_price_kobo,
        status: row.status,
      };

      const saved = row.id
        ? await laravelApi<Record<string, unknown>>(`/api/v1/admin/domain-pricing/${row.id}`, adminToken, {
            method: "PUT",
            body: JSON.stringify(payload),
          })
        : await laravelApi<Record<string, unknown>>("/api/v1/admin/domain-pricing", adminToken, {
            method: "POST",
            body: JSON.stringify(payload),
          });

      update(index, { id: Number(saved.id) });
      flashSavedNotice(index, wasNew ? `${row.tld || "TLD"} pricing created.` : `${row.tld || "TLD"} pricing updated.`);
      load();
    } catch (error) {
      flashSavedNotice(index, error instanceof Error ? error.message : "Saving this TLD's pricing failed.", true);
    } finally {
      setSavingIndex(null);
    }
  };

  const deactivate = async (index: number) => {
    const row = rows[index];

    if (!row.id) {
      setRows((current) => current.filter((_, i) => i !== index));

      return;
    }

    setSavingIndex(index);
    setSavedNotice(null);

    try {
      await laravelApi(`/api/v1/admin/domain-pricing/${row.id}`, adminToken, { method: "DELETE" });
      update(index, { status: "inactive" });
      flashSavedNotice(index, `${row.tld || "TLD"} pricing deactivated.`);
    } catch (error) {
      flashSavedNotice(index, error instanceof Error ? error.message : "Deactivating this TLD failed.", true);
    } finally {
      setSavingIndex(null);
    }
  };

  const filteredRows = rows.filter((row, index) => {
    if (tldFilter.trim() && !row.tld.toLowerCase().includes(tldFilter.trim().toLowerCase())) return false;
    if (statusFilter !== "all" && row.status !== statusFilter) return false;
    if (syncStatusFilter === "never" && row.last_sync_status) return false;
    if (syncStatusFilter === "success" && row.last_sync_status !== "success") return false;
    if (syncStatusFilter === "failed" && row.last_sync_status !== "failed") return false;
    return true;
  }).map((row) => ({ row, index: rows.indexOf(row) }));

  return (
    <div className="grid gap-5">
      <AdminDomainPricingSettingsPanel adminToken={adminToken} onSynced={load} />

      <section className="admin-panel">
        <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <h2 className="text-2xl font-black">Domain Pricing by TLD</h2>
            <p className="mt-1 text-sm text-white/55">
              Provider cost and FX-converted cost are filled in automatically by the sync above — markup is what you
              normally edit here.
            </p>
          </div>
          <button type="button" className="btn-outline justify-center" onClick={() => setRows((current) => [...current, emptyDomainPricingRow()])}>
            <Plus className="h-4 w-4" />
            Add TLD
          </button>
        </div>

        <div className="mt-4 grid gap-3 sm:grid-cols-3">
          <input value={tldFilter} onChange={(event) => setTldFilter(event.target.value)} placeholder="Filter by TLD (e.g. .com)" />
          <select value={statusFilter} onChange={(event) => setStatusFilter(event.target.value as typeof statusFilter)}>
            <option value="all">All statuses</option>
            <option value="needs_review">Needs review</option>
            <option value="active">Active</option>
            <option value="inactive">Inactive</option>
          </select>
          <select value={syncStatusFilter} onChange={(event) => setSyncStatusFilter(event.target.value as typeof syncStatusFilter)}>
            <option value="all">Any sync status</option>
            <option value="success">Last sync succeeded</option>
            <option value="failed">Last sync failed</option>
            <option value="never">Never synced</option>
          </select>
        </div>

        {isLoading && !rows.length ? (
          <div className="mt-6 rounded-lg border border-white/10 bg-black/20 p-6 text-sm font-bold text-white/60">Loading domain pricing...</div>
        ) : (
          <div className="mt-6 grid gap-5">
            {filteredRows.map(({ row, index }) => (
              <article key={row.id ?? `new-${index}`} className="admin-card">
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <div className="flex items-center gap-2">
                    <span className="text-lg font-black text-primary">{row.tld || "New TLD"}</span>
                    {!row.is_ready && (
                      <span className="rounded-full bg-yellow-500/15 px-2 py-0.5 text-[10px] font-black uppercase text-yellow-400">
                        Not ready — needs FX rate
                      </span>
                    )}
                    {row.last_sync_status === "failed" && (
                      <span className="rounded-full bg-red-500/15 px-2 py-0.5 text-[10px] font-black uppercase text-red-400">Sync failed</span>
                    )}
                  </div>
                  <span className="text-[11px] text-white/40">
                    {row.last_synced_at ? `Last synced ${formatDateTime(row.last_synced_at)}` : `Never synced from ${row.provider || "provider"}`}
                  </span>
                </div>
                {row.last_sync_error && <p className="mt-1 text-xs font-semibold text-red-400">{row.last_sync_error}</p>}

                <div className="mt-4 grid gap-4 lg:grid-cols-4">
                  <label className="admin-field">
                    <span>TLD</span>
                    <input value={row.tld} onChange={(event) => update(index, { tld: event.target.value })} placeholder=".com" />
                  </label>
                  <label className="admin-field">
                    <span>Provider</span>
                    <input value={row.provider} onChange={(event) => update(index, { provider: event.target.value })} />
                  </label>
                  <label className="admin-field">
                    <span>Currency</span>
                    <input value={row.currency} onChange={(event) => update(index, { currency: event.target.value })} />
                  </label>
                  <label className="admin-field">
                    <span>Status</span>
                    <select value={row.status} onChange={(event) => update(index, { status: event.target.value as DomainPricingRow["status"] })}>
                      <option value="needs_review">Needs review</option>
                      <option value="active">Active (sold publicly)</option>
                      <option value="inactive">Inactive</option>
                    </select>
                  </label>
                </div>

                <div className="mt-4 rounded-lg border border-white/10 bg-black/20 p-3">
                  <p className="text-[10px] font-black uppercase tracking-wide text-white/40">
                    {row.provider ? row.provider.charAt(0).toUpperCase() + row.provider.slice(1) : "Provider"} cost → NGN conversion (read-only, from sync)
                  </p>
                  <div className="mt-2 grid gap-2 text-xs text-white/60 sm:grid-cols-4">
                    <span>Reg. cost: {row.provider_registration_price || "—"}</span>
                    <span>Renewal cost: {row.provider_renewal_price || "—"}</span>
                    <span>Transfer cost: {row.provider_transfer_price || "—"}</span>
                    <span>FX rate: {row.exchange_rate_to_ngn ? `₦${row.exchange_rate_to_ngn}` : "—"}</span>
                  </div>
                </div>

                <div className="mt-4 grid gap-4 lg:grid-cols-3">
                  <label className="admin-field">
                    <span>Converted registration cost (₦)</span>
                    <input
                      type="number"
                      min={0}
                      value={row.registration_price_kobo / 100}
                      onChange={(event) => update(index, { registration_price_kobo: Math.round(Number(event.target.value) * 100) })}
                    />
                  </label>
                  <label className="admin-field">
                    <span>Converted renewal cost (₦)</span>
                    <input
                      type="number"
                      min={0}
                      value={row.renewal_price_kobo / 100}
                      onChange={(event) => update(index, { renewal_price_kobo: Math.round(Number(event.target.value) * 100) })}
                    />
                  </label>
                  <label className="admin-field">
                    <span>Converted transfer cost (₦)</span>
                    <input
                      type="number"
                      min={0}
                      value={row.transfer_price_kobo / 100}
                      onChange={(event) => update(index, { transfer_price_kobo: Math.round(Number(event.target.value) * 100) })}
                    />
                  </label>
                </div>

                <div className="mt-4 grid gap-4 lg:grid-cols-3">
                  <label className="admin-field">
                    <span>Markup type</span>
                    <select
                      value={row.markup_type}
                      onChange={(event) => update(index, { markup_type: event.target.value as DomainPricingRow["markup_type"] })}
                    >
                      <option value="cost_plus_markup">Fixed amount</option>
                      <option value="percentage_markup">Percentage</option>
                      <option value="fixed_customer_price">Fixed customer price</option>
                      <option value="manual_price">Manual price</option>
                    </select>
                  </label>
                  {row.markup_type === "percentage_markup" ? (
                    <label className="admin-field">
                      <span>Markup (%)</span>
                      <input
                        type="number"
                        min={0}
                        step="0.1"
                        value={row.markup_percent ?? ""}
                        onChange={(event) => update(index, { markup_percent: event.target.value === "" ? null : Number(event.target.value) })}
                      />
                    </label>
                  ) : (row.markup_type === "fixed_customer_price" || row.markup_type === "manual_price") ? (
                    <label className="admin-field">
                      <span>Fixed customer price (₦)</span>
                      <input
                        type="number"
                        min={0}
                        value={(row.fixed_customer_price_kobo || 0) / 100}
                        onChange={(event) => update(index, { fixed_customer_price_kobo: Math.round(Number(event.target.value) * 100) })}
                      />
                    </label>
                  ) : (
                    <label className="admin-field">
                      <span>Markup (₦)</span>
                      <input
                        type="number"
                        min={0}
                        value={(row.markup_value_kobo || 0) / 100}
                        onChange={(event) => update(index, { markup_value_kobo: Math.round(Number(event.target.value) * 100) })}
                      />
                    </label>
                  )}
                </div>

                <div className="mt-4 rounded-lg border border-primary/20 bg-primary/5 p-3">
                  <p className="text-[10px] font-black uppercase tracking-wide text-primary/80">Final customer price (before VAT)</p>
                  <div className="mt-2 grid gap-2 text-sm font-bold text-white sm:grid-cols-3">
                    <span>Registration: {row.customer_registration_price || "Not ready"}</span>
                    <span>Renewal: {row.customer_renewal_price || "Not ready"}</span>
                    <span>Transfer: {row.customer_transfer_price || "Not ready"}</span>
                  </div>
                </div>

                <div className="mt-4 flex flex-wrap items-center gap-2">
                  <button
                    type="button"
                    className="btn-primary justify-center !text-[11px]"
                    disabled={savingIndex === index}
                    onClick={() => void save(index)}
                  >
                    {savingIndex === index ? "Saving..." : "Save"}
                  </button>
                  <button
                    type="button"
                    className="btn-outline justify-center !text-[11px]"
                    disabled={savingIndex === index}
                    onClick={() => void deactivate(index)}
                  >
                    {row.id ? "Deactivate" : "Remove"}
                  </button>
                  {savedNotice && savedNotice.index === index && (
                    <span
                      className={`rounded-full px-3 py-1.5 text-[11px] font-bold ${
                        savedNotice.isError ? "bg-red-500/15 text-red-400" : "bg-primary/15 text-primary"
                      }`}
                    >
                      {savedNotice.text}
                    </span>
                  )}
                </div>
              </article>
            ))}

            {filteredRows.length === 0 && !isLoading && (
              <div className="rounded-lg border border-white/10 bg-black/20 p-6 text-sm font-bold text-white/60">
                No TLDs match these filters.
              </div>
            )}
          </div>
        )}
      </section>
    </div>
  );
}

type UnassignedDomainRow = {
  id: number;
  domain_name: string;
  tld: string;
  provider: string;
  provider_status: string | null;
  expires_at: string | null;
  auto_renew: boolean;
  ownership_assignment_status: string;
  assignment_note: string | null;
};

function AdminDomainAssignmentPage({ adminToken }: { adminToken: string }) {
  const [rows, setRows] = useState<UnassignedDomainRow[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [providerFilter, setProviderFilter] = useState("");
  const [busyId, setBusyId] = useState<number | null>(null);
  const [notice, setNotice] = useState<{ id: number; text: string; isError: boolean } | null>(null);
  const [formState, setFormState] = useState<Record<number, { clientId: string; priceKobo: string; invoiceDate: string; note: string }>>({});

  const load = React.useCallback(() => {
    setIsLoading(true);
    const params = new URLSearchParams();
    if (providerFilter) params.set("provider", providerFilter);
    const query = params.toString();

    laravelApi<{ data: Array<Record<string, unknown>> }>(`/api/v1/admin/domain-assignments${query ? `?${query}` : ""}`, adminToken)
      .then((response) => {
        setRows(
          (response.data || []).map((row) => ({
            id: Number(row.id),
            domain_name: String(row.domain_name || ""),
            tld: String(row.tld || ""),
            provider: String(row.provider || ""),
            provider_status: (row.provider_status as string) ?? null,
            expires_at: (row.expires_at as string) ?? null,
            auto_renew: Boolean(row.auto_renew),
            ownership_assignment_status: String(row.ownership_assignment_status || ""),
            assignment_note: (row.assignment_note as string) ?? null,
          })),
        );
      })
      .catch(() => undefined)
      .finally(() => setIsLoading(false));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [adminToken, providerFilter]);

  useEffect(() => {
    load();
  }, [load]);

  const fieldsFor = (id: number) => formState[id] || { clientId: "", priceKobo: "", invoiceDate: "", note: "" };
  const updateField = (id: number, patch: Partial<{ clientId: string; priceKobo: string; invoiceDate: string; note: string }>) => {
    setFormState((current) => ({ ...current, [id]: { ...fieldsFor(id), ...patch } }));
  };

  const flashNotice = (id: number, text: string, isError = false) => {
    setNotice({ id, text, isError });
    window.setTimeout(() => setNotice((current) => (current?.id === id ? null : current)), 4000);
  };

  const assign = async (row: UnassignedDomainRow) => {
    const fields = fieldsFor(row.id);
    const clientId = Number(fields.clientId);

    if (!Number.isFinite(clientId) || clientId <= 0) {
      flashNotice(row.id, "Enter a valid client ID before assigning.", true);
      return;
    }

    setBusyId(row.id);

    try {
      await laravelApi(`/api/v1/admin/domain-assignments/${row.id}/assign`, adminToken, {
        method: "POST",
        body: JSON.stringify({
          client_id: clientId,
          customer_renewal_price_kobo: fields.priceKobo ? Number(fields.priceKobo) : undefined,
          next_invoice_date: fields.invoiceDate || undefined,
          assignment_note: fields.note || undefined,
        }),
      });
      flashNotice(row.id, `${row.domain_name} assigned to client #${clientId}.`);
      load();
    } catch (error) {
      flashNotice(row.id, error instanceof Error ? error.message : "Assigning this domain failed.", true);
    } finally {
      setBusyId(null);
    }
  };

  const markInternal = async (row: UnassignedDomainRow) => {
    if (!window.confirm(`Mark ${row.domain_name} as a NAITALK-owned internal domain?`)) return;
    const fields = fieldsFor(row.id);
    setBusyId(row.id);

    try {
      await laravelApi(`/api/v1/admin/domain-assignments/${row.id}/mark-internal`, adminToken, {
        method: "POST",
        body: JSON.stringify({ assignment_note: fields.note || undefined }),
      });
      flashNotice(row.id, `${row.domain_name} marked as an internal domain.`);
      load();
    } catch (error) {
      flashNotice(row.id, error instanceof Error ? error.message : "Marking this domain internal failed.", true);
    } finally {
      setBusyId(null);
    }
  };

  return (
    <section className="admin-panel">
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h2 className="text-2xl font-black">Unassigned Domains</h2>
          <p className="mt-1 text-sm text-white/55">
            Domains imported from a registrar sync (e.g. Cloudflare) that still need to be assigned to a client, or
            marked as a NAITALK-owned internal domain. Nothing here triggers an invoice or notification until you act.
          </p>
        </div>
      </div>

      <div className="mt-4 grid gap-3 sm:grid-cols-3">
        <select value={providerFilter} onChange={(event) => setProviderFilter(event.target.value)}>
          <option value="">All registrar providers</option>
          <option value="cloudflare">Cloudflare</option>
          <option value="spaceship">Spaceship</option>
          <option value="external">External</option>
          <option value="manual">Manual</option>
        </select>
      </div>

      {isLoading ? (
        <div className="mt-5 rounded-lg border border-white/10 bg-black/20 p-6 text-sm font-bold text-white/60">Loading...</div>
      ) : rows.length === 0 ? (
        <div className="mt-5 rounded-lg border border-white/10 bg-black/20 p-6 text-sm font-bold text-white/60">
          No unassigned domains need review right now.
        </div>
      ) : (
        <div className="mt-5 grid gap-4">
          {rows.map((row) => {
            const fields = fieldsFor(row.id);
            const isBusy = busyId === row.id;

            return (
              <article key={row.id} className="rounded-xl border border-white/10 bg-black/20 p-5">
                <div className="flex flex-wrap items-center justify-between gap-3">
                  <div>
                    <h3 className="text-lg font-black text-white">{row.domain_name}</h3>
                    <p className="mt-1 text-xs text-white/55">
                      {row.provider} • Registrar status: {row.provider_status || "unknown"} • Expires{" "}
                      {row.expires_at ? formatDate(row.expires_at) : "unknown"} • Auto-renew {row.auto_renew ? "on" : "off"}
                    </p>
                  </div>
                  <span className="status-pill pending">{row.ownership_assignment_status}</span>
                </div>

                <div className="mt-4 grid gap-3 sm:grid-cols-4">
                  <label className="admin-field">
                    <span>Client ID</span>
                    <input
                      value={fields.clientId}
                      onChange={(event) => updateField(row.id, { clientId: event.target.value })}
                      placeholder="e.g. 42"
                    />
                  </label>
                  <label className="admin-field">
                    <span>Renewal price (kobo)</span>
                    <input
                      value={fields.priceKobo}
                      onChange={(event) => updateField(row.id, { priceKobo: event.target.value })}
                      placeholder="Optional override"
                    />
                  </label>
                  <label className="admin-field">
                    <span>Next invoice date</span>
                    <input
                      type="date"
                      value={fields.invoiceDate}
                      onChange={(event) => updateField(row.id, { invoiceDate: event.target.value })}
                    />
                  </label>
                  <label className="admin-field">
                    <span>Internal note</span>
                    <input value={fields.note} onChange={(event) => updateField(row.id, { note: event.target.value })} placeholder="Optional" />
                  </label>
                </div>

                <div className="mt-4 flex flex-wrap items-center gap-3">
                  <button type="button" className="btn-primary justify-center" disabled={isBusy} onClick={() => void assign(row)}>
                    {isBusy ? "Saving..." : "Assign to Client"}
                  </button>
                  <button type="button" className="btn-outline justify-center" disabled={isBusy} onClick={() => void markInternal(row)}>
                    Mark as Internal Domain
                  </button>
                  {notice?.id === row.id && (
                    <span className={`text-xs font-bold ${notice.isError ? "text-red-400" : "text-primary"}`}>{notice.text}</span>
                  )}
                </div>
              </article>
            );
          })}
        </div>
      )}
    </section>
  );
}

type AdminSectionDefinition = { id: AdminSectionId; label: string; icon: typeof BarChart3 };

const adminSectionGroups: Array<{ label: string; sections: AdminSectionDefinition[] }> = [
  {
    label: "Overview",
    sections: [{ id: "dashboard", label: "Dashboard", icon: BarChart3 }],
  },
  {
    label: "Site Content",
    sections: [
      { id: "logo", label: "Logo", icon: ImageIcon },
      { id: "clientLogos", label: "Client Logos", icon: Users },
      { id: "portfolio", label: "Portfolio", icon: Eye },
      { id: "testimonials", label: "Reviews", icon: MessageCircle },
      { id: "pricing", label: "Pricing", icon: PackageCheck },
    ],
  },
  {
    label: "Clients & Commerce",
    sections: [
      { id: "clients", label: "Clients", icon: Users },
      { id: "products", label: "Products", icon: PackageCheck },
      { id: "orders", label: "Orders", icon: MoreVertical },
      { id: "services", label: "Services", icon: Server },
      { id: "invoices", label: "Invoices", icon: FileText },
      { id: "payments", label: "Payments", icon: CreditCard },
      { id: "paymentVerification", label: "Payment Verification", icon: CreditCard },
    ],
  },
  {
    label: "Domains",
    sections: [
      { id: "domains", label: "Domains", icon: Globe2 },
      { id: "domainAssignments", label: "Unassigned Domains", icon: Globe2 },
      { id: "domainOrders", label: "Domain Orders", icon: Globe2 },
      { id: "domainTransfers", label: "Domain Transfers", icon: Globe2 },
      { id: "domainPricing", label: "Domain Pricing", icon: Globe2 },
    ],
  },
  {
    label: "Support & Operations",
    sections: [
      { id: "support", label: "Support", icon: MessageCircle },
      { id: "provisioning", label: "Provisioning", icon: Settings },
      { id: "ispconfigMappings", label: "ISPConfig", icon: Server },
      { id: "ispconfigImport", label: "ISPConfig Import", icon: Upload },
      { id: "auditLogs", label: "Audit Logs", icon: ShieldCheck },
    ],
  },
];

const adminSections: AdminSectionDefinition[] = adminSectionGroups.flatMap((group) => group.sections);

const adminSectionLabels: Record<AdminSectionId, string> = Object.fromEntries(
  adminSections.map((section) => [section.id, section.label]),
) as Record<AdminSectionId, string>;

function adminExpiresBeforeDate(daysFromNow: number): string {
  const date = new Date();
  date.setDate(date.getDate() + daysFromNow);
  return date.toISOString().slice(0, 10);
}

function domainAdminBadges(row: Record<string, unknown>): Array<{ label: string; tone: string }> {
  const badges: Array<{ label: string; tone: string }> = [];
  const provider = row.provider as string | undefined;
  const dnsProvider = row.dns_provider as string | undefined;
  const registrationSource = row.registration_source as string | undefined;
  const ownershipStatus = row.ownership_assignment_status as string | undefined;
  const paymentStatus = row.payment_status as string | undefined;
  const registrarOperationStatus = row.registrar_operation_status as string | undefined;

  if (provider === "cloudflare") {
    badges.push({ label: "Cloudflare Registrar", tone: "pending" });
  } else if (dnsProvider === "cloudflare") {
    badges.push({ label: "Cloudflare DNS only", tone: "pending" });
  }

  if (registrationSource === "imported") badges.push({ label: "Imported", tone: "pending" });
  if (registrationSource === "transferred") badges.push({ label: "Transferred", tone: "pending" });
  if (registrationSource === "purchased") badges.push({ label: "Purchased", tone: "pending" });

  if (ownershipStatus === "unassigned" || ownershipStatus === "needs_review") {
    badges.push({ label: "Unassigned", tone: "failed" });
  }

  if (paymentStatus === "unpaid" || paymentStatus === "failed") {
    badges.push({ label: "Payment due", tone: "failed" });
  }

  if (registrarOperationStatus === "pending" || registrarOperationStatus === "processing") {
    badges.push({ label: "Renewal pending", tone: "pending" });
  } else if (registrarOperationStatus === "completed") {
    badges.push({ label: "Renewed", tone: "paid" });
  } else if (registrarOperationStatus === "failed") {
    badges.push({ label: "Sync failed", tone: "failed" });
  } else if (registrarOperationStatus === "requires_attention") {
    badges.push({ label: "Requires attention", tone: "failed" });
  }

  return badges;
}

const adminRecordFilterDefs: Partial<Record<AdminRecordsSectionId, AdminRecordFilterDef[]>> = {
  products: [
    { key: "is_active", label: "Status", type: "select", options: [{ value: "1", label: "Active" }, { value: "0", label: "Inactive" }] },
  ],
  orders: [
    {
      key: "status",
      label: "Status",
      type: "select",
      options: [{ value: "pending_payment", label: "Pending payment" }, { value: "completed", label: "Completed" }],
    },
    {
      key: "billing_cycle",
      label: "Billing cycle",
      type: "select",
      options: [{ value: "monthly", label: "Monthly" }, { value: "annual", label: "Annual" }],
    },
  ],
  invoices: [
    {
      key: "status",
      label: "Status",
      type: "select",
      options: [
        { value: "unpaid", label: "Unpaid" },
        { value: "paid", label: "Paid" },
        { value: "partially_paid", label: "Partially paid" },
        { value: "overdue", label: "Overdue" },
      ],
    },
  ],
  payments: [
    {
      key: "status",
      label: "Status",
      type: "select",
      options: [
        { value: "pending", label: "Pending" },
        { value: "paid", label: "Paid" },
        { value: "failed", label: "Failed" },
        { value: "pending_review", label: "Pending review" },
        { value: "awaiting_bank_transfer", label: "Awaiting bank transfer" },
      ],
    },
    {
      key: "gateway",
      label: "Gateway",
      type: "select",
      options: [
        { value: "paystack", label: "Paystack" },
        { value: "flutterwave", label: "Flutterwave" },
        { value: "wallet", label: "Wallet" },
        { value: "bank_transfer", label: "Bank transfer" },
      ],
    },
  ],
  support: [
    {
      key: "status",
      label: "Status",
      type: "select",
      options: [{ value: "open", label: "Open" }, { value: "pending", label: "Pending" }, { value: "closed", label: "Closed" }],
    },
    {
      key: "priority",
      label: "Priority",
      type: "select",
      options: [
        { value: "low", label: "Low" },
        { value: "normal", label: "Normal" },
        { value: "high", label: "High" },
        { value: "urgent", label: "Urgent" },
      ],
    },
  ],
  provisioning: [
    {
      key: "status",
      label: "Status",
      type: "select",
      options: [
        { value: "pending", label: "Pending" },
        { value: "running", label: "Running" },
        { value: "success", label: "Success" },
        { value: "failed", label: "Failed" },
      ],
    },
  ],
  ispconfigMappings: [
    {
      key: "sync_status",
      label: "Sync status",
      type: "select",
      options: [
        { value: "not_provisioned", label: "Not provisioned" },
        { value: "awaiting_provisioning", label: "Awaiting provisioning" },
        { value: "provisioned", label: "Provisioned" },
        { value: "failed", label: "Failed" },
      ],
    },
  ],
  auditLogs: [{ key: "action", label: "Action", type: "text", placeholder: "e.g. domain_pricing_updated" }],
  domains: [
    {
      key: "status",
      label: "Status",
      type: "select",
      options: [{ value: "pending", label: "Pending" }, { value: "active", label: "Active" }],
    },
    {
      key: "source",
      label: "Source",
      type: "select",
      options: [
        { value: "spaceship_registered", label: "Registered" },
        { value: "spaceship_transferred", label: "Transferred" },
        { value: "external", label: "External" },
        { value: "manual", label: "Manual" },
      ],
    },
    {
      key: "provider",
      label: "Registrar provider",
      type: "select",
      options: [
        { value: "cloudflare", label: "Cloudflare" },
        { value: "spaceship", label: "Spaceship" },
        { value: "external", label: "External" },
        { value: "manual", label: "Manual" },
      ],
    },
    {
      key: "ownership_assignment_status",
      label: "Assignment",
      type: "select",
      options: [
        { value: "assigned", label: "Assigned" },
        { value: "unassigned", label: "Unassigned" },
        { value: "needs_review", label: "Needs review" },
        { value: "internal", label: "Internal" },
      ],
    },
    {
      key: "payment_status",
      label: "Payment status",
      type: "select",
      options: [
        { value: "unpaid", label: "Unpaid" },
        { value: "pending", label: "Pending" },
        { value: "paid", label: "Paid" },
        { value: "failed", label: "Failed" },
        { value: "refunded", label: "Refunded" },
      ],
    },
    {
      key: "registrar_operation_status",
      label: "Registrar operation",
      type: "select",
      options: [
        { value: "not_started", label: "Not started" },
        { value: "pending", label: "Pending" },
        { value: "processing", label: "Processing" },
        { value: "completed", label: "Completed" },
        { value: "failed", label: "Failed" },
        { value: "requires_attention", label: "Requires attention" },
      ],
    },
    {
      key: "auto_renew",
      label: "Auto-renew",
      type: "select",
      options: [{ value: "1", label: "Enabled" }, { value: "0", label: "Disabled" }],
    },
    {
      key: "expires_before",
      label: "Expiring within",
      type: "select",
      options: [
        { value: adminExpiresBeforeDate(7), label: "7 days" },
        { value: adminExpiresBeforeDate(30), label: "30 days" },
        { value: adminExpiresBeforeDate(60), label: "60 days" },
        { value: adminExpiresBeforeDate(90), label: "90 days" },
      ],
    },
    { key: "tld", label: "TLD", type: "text", placeholder: "e.g. .com" },
  ],
  domainOrders: [
    {
      key: "status",
      label: "Status",
      type: "select",
      options: [
        { value: "pending_payment", label: "Pending payment" },
        { value: "payment_confirmed", label: "Payment confirmed" },
        { value: "awaiting_manual_registration", label: "Awaiting manual registration" },
        { value: "processing", label: "Processing" },
        { value: "completed", label: "Completed" },
        { value: "failed", label: "Failed" },
      ],
    },
    {
      key: "order_type",
      label: "Type",
      type: "select",
      options: [
        { value: "registration", label: "Registration" },
        { value: "transfer", label: "Transfer" },
        { value: "renewal", label: "Renewal" },
      ],
    },
  ],
  domainTransfers: [
    {
      key: "transfer_status",
      label: "Transfer status",
      type: "select",
      options: [
        { value: "transfer_pending_payment", label: "Pending payment" },
        { value: "transfer_initiated", label: "Initiated" },
        { value: "transfer_completed", label: "Completed" },
        { value: "transfer_failed", label: "Failed" },
      ],
    },
  ],
};

function AdminApp() {
  const { section: activeSection, clientId: routeClientId, serviceId: routeServiceId, isServicesActiveRoute, navigate: navigateAdminRoute, navigateToSection } = useAdminRoute();

  const [isAuthenticated, setIsAuthenticated] = useState(false);
  const [isBooting, setIsBooting] = useState(true);
  const [isSaving, setIsSaving] = useState(false);
  const [isUploading, setIsUploading] = useState("");
  const [message, setMessage] = useState("");
  const [login, setLogin] = useState({ username: "", password: "" });
  const [content, setContent] = useState<SiteContent>(fallbackSiteContent);
  const [adminToken, setAdminToken] = useState(() => sessionStorage.getItem("naitalk_laravel_admin_token") || "");
  const [dashboardData, setDashboardData] = useState<AdminDashboardSnapshot | null>(null);
  const [isDashboardLoading, setIsDashboardLoading] = useState(false);
  const [adminRecords, setAdminRecords] = useState<Partial<Record<AdminRecordsSectionId, LaravelPage>>>({});
  const [loadingRecords, setLoadingRecords] = useState<Partial<Record<AdminRecordsSectionId, boolean>>>({});
  const [recordFilters, setRecordFilters] = useState<Partial<Record<AdminRecordsSectionId, Record<string, string>>>>({});
  const [recordPage, setRecordPage] = useState<Partial<Record<AdminRecordsSectionId, number>>>({});
  const [pricingPackages, setPricingPackages] = useState<PricingPackage[]>([]);
  const [isPricingLoading, setIsPricingLoading] = useState(false);
  const [retryingServiceId, setRetryingServiceId] = useState<number | null>(null);
  const [isSidebarOpen, setIsSidebarOpen] = useState(false);
  const [isCreatingInvoice, setIsCreatingInvoice] = useState(false);

  const adminRequest = async <T,>(url: string, options: RequestInit = {}): Promise<T> => {
    const headers = new Headers(options.headers);
    if (options.body && !headers.has("Content-Type")) {
      headers.set("Content-Type", "application/json");
    }
    if (adminToken && !headers.has("Authorization")) {
      headers.set("Authorization", `Bearer ${adminToken}`);
    }

    const response = await fetch(url, {
      ...options,
      headers,
    });
    const payload = await response.json().catch(() => ({}));

    if (response.status === 401) {
      setIsAuthenticated(false);
    }

    if (!response.ok) {
      throw new Error(payload.error || "Request failed");
    }

    return payload as T;
  };

  const loadContent = async () => {
    const response = await fetch("/api/site-content");
    const data = await response.json();
    setContent({
      ...fallbackSiteContent,
      ...data,
      brand: {
        logo: data.brand?.logo || fallbackSiteContent.brand.logo,
      },
      clientLogos: Array.isArray(data.clientLogos) ? data.clientLogos : fallbackClientLogos,
      projects: Array.isArray(data.projects) ? data.projects : fallbackProjects,
      reviews: Array.isArray(data.reviews) ? data.reviews : fallbackReviews,
    });
  };

  const loadAdminDashboard = async (token = adminToken) => {
    if (!token) return;
    setIsDashboardLoading(true);

    try {
      const data = await laravelApi<AdminDashboardSnapshot>("/api/v1/admin/dashboard", token);
      setDashboardData(data);
    } catch (error) {
      sessionStorage.removeItem("naitalk_laravel_admin_token");
      setAdminToken("");
      setIsAuthenticated(false);
      setMessage(error instanceof Error ? error.message : "Laravel dashboard could not be loaded");
    } finally {
      setIsDashboardLoading(false);
    }
  };

  const adminRecordEndpoints: Record<AdminRecordsSectionId, string> = {
    products: "/api/v1/admin/products",
    orders: "/api/v1/admin/orders",
    invoices: "/api/v1/admin/invoices",
    payments: "/api/v1/admin/payments",
    support: "/api/v1/admin/support-tickets",
    provisioning: "/api/v1/admin/provisioning-logs",
    ispconfigMappings: "/api/v1/admin/ispconfig-client-mappings",
    auditLogs: "/api/v1/admin/audit-logs",
    domains: "/api/v1/admin/domains",
    domainOrders: "/api/v1/admin/domain-orders",
    domainTransfers: "/api/v1/admin/domain-transfers",
  };

  const adminRecordLabels: Record<AdminRecordsSectionId, { title: string; description: string }> = {
    products: { title: "Products & Pricing", description: "Hosting plans configured in the Laravel billing engine." },
    orders: { title: "Orders", description: "Commercial hosting orders created through checkout." },
    invoices: { title: "Invoices", description: "Issued invoices, balances, due dates and payment status." },
    payments: { title: "Payments", description: "Paystack and Flutterwave payment records." },
    support: { title: "Support Tickets", description: "Client support tickets attached to accounts and services." },
    provisioning: { title: "Provisioning Logs", description: "ISPConfig provisioning queue and execution history." },
    ispconfigMappings: { title: "ISPConfig Mappings", description: "Stored Laravel-to-ISPConfig client mappings and sync status." },
    auditLogs: { title: "Audit Logs", description: "Staff lifecycle actions, state changes and internal reasons." },
    domains: { title: "Domains", description: "All domains registered, transferred, or connected across every client and registrar." },
    domainOrders: { title: "Domain Orders", description: "Domain registration, transfer, and renewal orders and their payment/registration status." },
    domainTransfers: { title: "Domain Transfers", description: "Incoming domain transfers and their registrar transfer status." },
  };

  const isRecordSection = (section: AdminSectionId): section is AdminRecordsSectionId =>
    Object.prototype.hasOwnProperty.call(adminRecordEndpoints, section);

  const loadAdminRecords = async (section: AdminRecordsSectionId, token = adminToken) => {
    if (!token) return;
    setLoadingRecords((current) => ({ ...current, [section]: true }));

    const params = new URLSearchParams();
    const activeFilters: Record<string, string> = recordFilters[section] || {};
    Object.entries(activeFilters).forEach(([key, value]) => {
      if (value) params.set(key, value);
    });
    const page = recordPage[section] || 1;
    if (page > 1) params.set("page", String(page));
    const query = params.toString();

    try {
      const data = await laravelApi<LaravelPage>(`${adminRecordEndpoints[section]}${query ? `?${query}` : ""}`, token);
      setAdminRecords((current) => ({ ...current, [section]: data }));
    } catch (error) {
      setMessage(error instanceof Error ? error.message : `${adminRecordLabels[section].title} could not be loaded`);
    } finally {
      setLoadingRecords((current) => ({ ...current, [section]: false }));
    }
  };

  const updateRecordFilter = (section: AdminRecordsSectionId, key: string, value: string) => {
    setRecordFilters((current) => ({ ...current, [section]: { ...(current[section] || {}), [key]: value } }));
    setRecordPage((current) => ({ ...current, [section]: 1 }));
  };

  const clearRecordFilters = (section: AdminRecordsSectionId) => {
    setRecordFilters((current) => ({ ...current, [section]: {} }));
    setRecordPage((current) => ({ ...current, [section]: 1 }));
  };

  const retryServiceProvisioning = async (serviceId: number) => {
    setRetryingServiceId(serviceId);

    try {
      await laravelApi(`/api/v1/admin/services/${serviceId}/retry-provisioning`, adminToken, {
        method: "POST",
        body: JSON.stringify({ reason: "Retried from admin services panel" }),
      });
    } catch (error) {
      setMessage(error instanceof Error ? error.message : "Retry provisioning failed");
    } finally {
      setRetryingServiceId(null);
    }
  };

  const [approvingPaymentId, setApprovingPaymentId] = useState<number | null>(null);

  const approveBankTransferPayment = async (invoiceNumber: string, paymentId: number) => {
    setApprovingPaymentId(paymentId);

    try {
      await laravelApi(`/api/v1/admin/invoices/${invoiceNumber}/mark-paid`, adminToken, { method: "POST" });
      await loadAdminRecords("payments", adminToken);
    } catch (error) {
      setMessage(error instanceof Error ? error.message : "Approving payment failed");
    } finally {
      setApprovingPaymentId(null);
    }
  };

  const rejectBankTransferPayment = async (invoiceNumber: string, paymentId: number) => {
    const reason = window.prompt("Reason for rejecting this bank transfer payment:");
    if (!reason) return;

    setApprovingPaymentId(paymentId);

    try {
      await laravelApi(`/api/v1/admin/invoices/${invoiceNumber}/reject-bank-transfer`, adminToken, {
        method: "POST",
        body: JSON.stringify({ reason }),
      });
      await loadAdminRecords("payments", adminToken);
    } catch (error) {
      setMessage(error instanceof Error ? error.message : "Rejecting payment failed");
    } finally {
      setApprovingPaymentId(null);
    }
  };

  const [domainActionBusyId, setDomainActionBusyId] = useState<number | null>(null);

  const markDomainRegistered = async (domainOrderId: number) => {
    const expiresAt = window.prompt("Expiry date for this domain (YYYY-MM-DD):");
    if (!expiresAt) return;

    setDomainActionBusyId(domainOrderId);

    try {
      await laravelApi(`/api/v1/admin/domain-orders/${domainOrderId}/mark-registered`, adminToken, {
        method: "POST",
        body: JSON.stringify({ expires_at: expiresAt }),
      });
      await loadAdminRecords("domainOrders", adminToken);
    } catch (error) {
      setMessage(error instanceof Error ? error.message : "Marking domain as registered failed");
    } finally {
      setDomainActionBusyId(null);
    }
  };

  const retryDomainTransferSync = async (transferId: number) => {
    setDomainActionBusyId(transferId);

    try {
      await laravelApi(`/api/v1/admin/domain-transfers/${transferId}/retry-sync`, adminToken, { method: "POST" });
      await loadAdminRecords("domainTransfers", adminToken);
    } catch (error) {
      setMessage(error instanceof Error ? error.message : "Retrying transfer sync failed");
    } finally {
      setDomainActionBusyId(null);
    }
  };

  const disableDomainAutoRenew = async (domainId: number) => {
    setDomainActionBusyId(domainId);

    try {
      await laravelApi(`/api/v1/admin/domains/${domainId}/disable-auto-renew`, adminToken, { method: "POST" });
      await loadAdminRecords("domains", adminToken);
    } catch (error) {
      setMessage(error instanceof Error ? error.message : "Disabling auto-renew failed");
    } finally {
      setDomainActionBusyId(null);
    }
  };

  const renewDomainAdmin = async (domainId: number) => {
    setDomainActionBusyId(domainId);

    try {
      const data = await laravelApi<{ invoice_number: string | null }>(`/api/v1/admin/domains/${domainId}/renew`, adminToken, { method: "POST" });
      setMessage(data.invoice_number ? `Renewal invoice ${data.invoice_number} created for this domain.` : "A renewal invoice already exists for this domain.");
    } catch (error) {
      setMessage(error instanceof Error ? error.message : "Starting domain renewal failed");
    } finally {
      setDomainActionBusyId(null);
    }
  };

  const sendDomainDnsInstructions = async (domainId: number) => {
    setDomainActionBusyId(domainId);

    try {
      await laravelApi(`/api/v1/admin/domains/${domainId}/send-dns-instructions`, adminToken, { method: "POST" });
      setMessage("DNS instructions email sent to the client.");
    } catch (error) {
      setMessage(error instanceof Error ? error.message : "Sending DNS instructions failed");
    } finally {
      setDomainActionBusyId(null);
    }
  };

  const linkDomainHosting = async (domainId: number) => {
    const hostingServiceId = window.prompt("Hosting service ID to link this domain to:");
    if (!hostingServiceId) return;

    setDomainActionBusyId(domainId);

    try {
      await laravelApi(`/api/v1/admin/domains/${domainId}/link-hosting`, adminToken, {
        method: "POST",
        body: JSON.stringify({ hosting_service_id: Number(hostingServiceId) }),
      });
      await loadAdminRecords("domains", adminToken);
    } catch (error) {
      setMessage(error instanceof Error ? error.message : "Linking hosting to this domain failed");
    } finally {
      setDomainActionBusyId(null);
    }
  };

  const unlinkDomainHosting = async (domainId: number) => {
    setDomainActionBusyId(domainId);

    try {
      await laravelApi(`/api/v1/admin/domains/${domainId}/unlink-hosting`, adminToken, { method: "POST" });
      await loadAdminRecords("domains", adminToken);
    } catch (error) {
      setMessage(error instanceof Error ? error.message : "Unlinking hosting from this domain failed");
    } finally {
      setDomainActionBusyId(null);
    }
  };

  const markDomainSource = async (domainId: number, source: "external" | "manual") => {
    setDomainActionBusyId(domainId);

    try {
      await laravelApi(`/api/v1/admin/domains/${domainId}/mark-source`, adminToken, {
        method: "POST",
        body: JSON.stringify({ source }),
      });
      await loadAdminRecords("domains", adminToken);
    } catch (error) {
      setMessage(error instanceof Error ? error.message : "Marking domain source failed");
    } finally {
      setDomainActionBusyId(null);
    }
  };

  const refreshDomainFromCloudflare = async (domainId: number) => {
    if (!window.confirm("Refresh this domain's registrar status from Cloudflare now?")) return;
    setDomainActionBusyId(domainId);

    try {
      await laravelApi(`/api/v1/admin/domains/${domainId}/refresh-from-cloudflare`, adminToken, { method: "POST" });
      setMessage("A refresh from Cloudflare has been queued — reload shortly to see updated status.");
    } catch (error) {
      setMessage(error instanceof Error ? error.message : "Queuing a Cloudflare refresh failed");
    } finally {
      setDomainActionBusyId(null);
    }
  };

  const assignOrReassignDomainCustomer = async (domainId: number, currentClientId: number | null) => {
    const clientIdInput = window.prompt(
      currentClientId ? "New client ID to reassign this domain to:" : "Client ID to assign this domain to:"
    );
    if (!clientIdInput) return;

    const clientId = Number(clientIdInput);
    if (!Number.isFinite(clientId) || clientId <= 0) {
      setMessage("Enter a valid numeric client ID.");
      return;
    }

    if (!window.confirm(`Confirm ${currentClientId ? "reassigning" : "assigning"} this domain to client #${clientId}?`)) return;

    setDomainActionBusyId(domainId);

    try {
      const endpoint = currentClientId
        ? `/api/v1/admin/domain-assignments/${domainId}/reassign`
        : `/api/v1/admin/domain-assignments/${domainId}/assign`;
      await laravelApi(endpoint, adminToken, { method: "POST", body: JSON.stringify({ client_id: clientId }) });
      await loadAdminRecords("domains", adminToken);
    } catch (error) {
      setMessage(error instanceof Error ? error.message : "Assigning this domain failed");
    } finally {
      setDomainActionBusyId(null);
    }
  };

  const markDomainInternal = async (domainId: number) => {
    if (!window.confirm("Mark this domain as a NAITALK-owned internal domain? It will be unassigned from any client.")) return;
    setDomainActionBusyId(domainId);

    try {
      await laravelApi(`/api/v1/admin/domain-assignments/${domainId}/mark-internal`, adminToken, { method: "POST" });
      await loadAdminRecords("domains", adminToken);
    } catch (error) {
      setMessage(error instanceof Error ? error.message : "Marking this domain internal failed");
    } finally {
      setDomainActionBusyId(null);
    }
  };

  const addDomainNote = async (domainId: number) => {
    const note = window.prompt("Administrative note for this domain:");
    if (!note) return;

    setDomainActionBusyId(domainId);

    try {
      await laravelApi(`/api/v1/admin/domains/${domainId}/note`, adminToken, {
        method: "POST",
        body: JSON.stringify({ assignment_note: note }),
      });
      await loadAdminRecords("domains", adminToken);
    } catch (error) {
      setMessage(error instanceof Error ? error.message : "Saving this note failed");
    } finally {
      setDomainActionBusyId(null);
    }
  };

  const viewDomainSyncHistory = async (domainId: number) => {
    setDomainActionBusyId(domainId);

    try {
      const data = await laravelApi<{ data: Array<{ action: string; status: string; error_message: string | null; created_at: string }> }>(
        `/api/v1/admin/domains/${domainId}/sync-logs`,
        adminToken
      );
      if (!data.data.length) {
        window.alert("No sync history recorded for this domain yet.");
      } else {
        const summary = data.data
          .map((log) => `${formatDateTime(log.created_at)} — ${log.action} (${log.status})${log.error_message ? `: ${log.error_message}` : ""}`)
          .join("\n");
        window.alert(`Recent sync history:\n\n${summary}`);
      }
    } catch (error) {
      setMessage(error instanceof Error ? error.message : "Loading sync history failed");
    } finally {
      setDomainActionBusyId(null);
    }
  };

  const downloadReceipt = async (paymentId: number) => {
    try {
      const response = await fetch(`${LARAVEL_API_BASE_URL}/api/v1/admin/payments/${paymentId}/receipt`, {
        headers: { Authorization: `Bearer ${adminToken}` },
      });
      if (!response.ok) throw new Error("Could not download this receipt.");
      const blob = await response.blob();
      const url = URL.createObjectURL(blob);
      window.open(url, "_blank", "noopener,noreferrer");
    } catch (error) {
      setMessage(error instanceof Error ? error.message : "Could not download this receipt.");
    }
  };

  const [impersonatingClientId, setImpersonatingClientId] = useState<number | null>(null);

  const impersonateClient = async (clientId: number) => {
    if (impersonatingClientId) return;
    setImpersonatingClientId(clientId);

    try {
      const data = await laravelApi<{ token: string }>(`/api/v1/admin/clients/${clientId}/impersonate`, adminToken, {
        method: "POST",
      });
      sessionStorage.setItem("naitalk_laravel_client_token", data.token);
      window.location.href = "/client/dashboard";
    } catch (error) {
      setMessage(error instanceof Error ? error.message : "Could not enter this client's account.");
      setImpersonatingClientId(null);
    }
  };

  const loadPricingPackages = async (token = adminToken) => {
    if (!token) return;
    setIsPricingLoading(true);

    try {
      const payload = await laravelApi<{ data: PricingPackage[] }>("/api/v1/admin/pricing-packages", token);
      setPricingPackages(Array.isArray(payload.data) ? payload.data : []);
    } catch (error) {
      setMessage(error instanceof Error ? error.message : "Pricing packages could not be loaded");
    } finally {
      setIsPricingLoading(false);
    }
  };

  useEffect(() => {
    if (!adminToken) {
      loadContent().finally(() => setIsBooting(false));
      return;
    }

    laravelApi<{ user: { role: string } }>("/api/v1/auth/me", adminToken)
      .then(async ({ user }) => {
        if (!["super_admin", "admin_staff"].includes(user.role)) {
          throw new Error("This account does not have admin access.");
        }
        setIsAuthenticated(true);
        await Promise.all([loadContent(), loadAdminDashboard(adminToken)]);
      })
      .catch((error) => {
        sessionStorage.removeItem("naitalk_laravel_admin_token");
        setAdminToken("");
        setIsAuthenticated(false);
        setMessage(error instanceof Error ? error.message : "Admin session expired");
      })
      .finally(() => setIsBooting(false));
  }, []);

  useEffect(() => {
    if (isAuthenticated && isRecordSection(activeSection)) {
      void loadAdminRecords(activeSection);
    }
    if (isAuthenticated && activeSection === "paymentVerification") {
      void loadAdminRecords("payments");
    }
    if (isAuthenticated && activeSection === "pricing") {
      void loadPricingPackages();
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [activeSection, isAuthenticated, adminToken, recordFilters, recordPage]);

  // Without this, switching from a long scrolled-down page (e.g. Dashboard)
  // to a short one (e.g. Logo, Orders while loading) leaves the viewport
  // scrolled past the new page's content, which looks like a rendering bug —
  // a wall of empty space above content that actually rendered correctly.
  useEffect(() => {
    window.scrollTo({ top: 0 });
  }, [activeSection, routeClientId, routeServiceId]);

  const handleLogin = async (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    setMessage("");

    try {
      const data = await laravelApi<{ token: string; user: { role: string } }>("/api/v1/auth/login", undefined, {
        method: "POST",
        body: JSON.stringify({
          email: login.username,
          password: login.password,
          device_name: "naitalk-react-admin",
        }),
      });

      if (!["super_admin", "admin_staff"].includes(data.user.role)) {
        throw new Error("This account does not have admin access.");
      }

      sessionStorage.setItem("naitalk_laravel_admin_token", data.token);
      setAdminToken(data.token);
      setIsAuthenticated(true);
      await Promise.all([loadContent(), loadAdminDashboard(data.token)]);
    } catch (error) {
      setMessage(error instanceof Error ? error.message : "Login failed");
    }
  };

  const handleLogout = async () => {
    if (adminToken) {
      await laravelApi<{ message: string }>("/api/v1/auth/logout", adminToken, { method: "POST" }).catch(() => undefined);
    }
    sessionStorage.removeItem("naitalk_laravel_admin_token");
    setAdminToken("");
    setDashboardData(null);
    setIsAuthenticated(false);
  };

  const uploadImage = async (file: File | undefined, uploadKey: string, onUploaded: (image: LogoImage) => void) => {
    if (!file) return;
    setMessage("");
    setIsUploading(uploadKey);

    try {
      const dataUrl = await fileToDataUrl(file);
      const image = await adminRequest<LogoImage>("/api/admin/upload", {
        method: "POST",
        body: JSON.stringify({ dataUrl, fileName: file.name }),
      });
      onUploaded(image);
      setMessage("Image uploaded. Save changes when you are ready.");
    } catch (error) {
      setMessage(error instanceof Error ? error.message : "Upload failed");
    } finally {
      setIsUploading("");
    }
  };

  const saveContent = async () => {
    setIsSaving(true);
    setMessage("");

    try {
      const saved = await adminRequest<SiteContent>("/api/admin/content", {
        method: "PUT",
        body: JSON.stringify(content),
      });
      setContent(saved);
      setMessage("Changes saved.");
    } catch (error) {
      setMessage(error instanceof Error ? error.message : "Changes could not be saved");
    } finally {
      setIsSaving(false);
    }
  };

  const updateProject = (index: number, patch: Partial<Project>) => {
    setContent((current) => {
      const projects = [...current.projects];
      projects[index] = { ...projects[index], ...patch };
      return { ...current, projects };
    });
  };

  const updateProjectDetail = (index: number, field: keyof Project["details"], value: string) => {
    setContent((current) => {
      const projects = [...current.projects];
      projects[index] = {
        ...projects[index],
        details: {
          ...projects[index].details,
          [field]: value,
        },
      };
      return { ...current, projects };
    });
  };

  const updateClientLogo = (index: number, patch: Partial<ClientLogo>) => {
    setContent((current) => {
      const clientLogos = [...current.clientLogos];
      clientLogos[index] = { ...clientLogos[index], ...patch };
      return { ...current, clientLogos };
    });
  };

  const updateReview = (index: number, patch: Partial<Review>) => {
    setContent((current) => {
      const reviews = [...current.reviews];
      reviews[index] = { ...reviews[index], ...patch };
      return { ...current, reviews };
    });
  };

  const updatePricingPackage = (index: number, patch: Partial<PricingPackage>) => {
    setPricingPackages((current) => {
      const next = [...current];
      next[index] = { ...next[index], ...patch };
      return next;
    });
  };

  const savePricingPackage = async (index: number) => {
    const plan = pricingPackages[index];
    const method = plan.id ? "PUT" : "POST";
    const path = plan.id ? `/api/v1/admin/pricing-packages/${plan.id}` : "/api/v1/admin/pricing-packages";

    setMessage("");
    setIsPricingLoading(true);

    try {
      const saved = await laravelApi<PricingPackage>(path, adminToken, {
        method,
        body: JSON.stringify(plan),
      });
      setPricingPackages((current) => {
        const next = [...current];
        next[index] = saved;
        return next;
      });
      setMessage("Pricing package saved.");
    } catch (error) {
      setMessage(error instanceof Error ? error.message : "Pricing package could not be saved");
    } finally {
      setIsPricingLoading(false);
    }
  };

  const removePricingPackage = async (index: number) => {
    const plan = pricingPackages[index];

    if (!plan.id) {
      setPricingPackages((current) => current.filter((_, planIndex) => planIndex !== index));
      return;
    }

    setMessage("");
    setIsPricingLoading(true);

    try {
      const saved = await laravelApi<PricingPackage>(`/api/v1/admin/pricing-packages/${plan.id}`, adminToken, {
        method: "DELETE",
      });
      setPricingPackages((current) => {
        const next = [...current];
        next[index] = saved;
        return next;
      });
      setMessage("Pricing package disabled.");
    } catch (error) {
      setMessage(error instanceof Error ? error.message : "Pricing package could not be disabled");
    } finally {
      setIsPricingLoading(false);
    }
  };

  if (isBooting) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-background px-4 text-white">
        <div className="rounded-lg border border-white/10 bg-white/[0.035] px-5 py-4 text-sm font-bold text-white/70">
          Loading admin...
        </div>
      </div>
    );
  }

  if (!isAuthenticated) {
    return (
      <div className="grid min-h-screen place-items-center bg-background px-4 py-10 text-white">
        <form className="admin-panel w-full max-w-md" onSubmit={handleLogin}>
          <div className="mb-7 flex items-center gap-3">
            <div className="flex h-11 w-11 items-center justify-center rounded-lg border border-primary/30 bg-primary/10">
              <LockKeyhole className="h-5 w-5 text-primary" />
            </div>
            <div>
              <h1 className="text-2xl font-black">Backend Login</h1>
              <p className="mt-1 text-sm text-white/55">NAITALK content management</p>
            </div>
          </div>
          <label className="admin-field">
            <span>Admin email</span>
            <input
              value={login.username}
              onChange={(event) => setLogin((current) => ({ ...current, username: event.target.value }))}
              autoComplete="email"
              placeholder="admin@naitalk.com"
              required
            />
          </label>
          <label className="admin-field">
            <span>Password</span>
            <input
              type="password"
              value={login.password}
              onChange={(event) => setLogin((current) => ({ ...current, password: event.target.value }))}
              autoComplete="current-password"
              required
            />
          </label>
          <button type="submit" className="btn-primary mt-3 w-full justify-center">
            Login
            <ArrowRight className="h-4 w-4" />
          </button>
          {message && <p className="form-message error mt-4">{message}</p>}
        </form>
      </div>
    );
  }

  const closeSidebarAndNavigate = (sectionId: AdminSectionId) => {
    navigateToSection(sectionId);
    setIsSidebarOpen(false);
  };

  return (
    <div className="admin-shell">
      {isSidebarOpen && <div className="admin-sidebar-backdrop" onClick={() => setIsSidebarOpen(false)} />}

      <aside className={isSidebarOpen ? "admin-sidebar open" : "admin-sidebar"}>
        <div className="admin-sidebar-brand">
          <Logo logo={content.brand.logo} />
          <button type="button" className="admin-topbar-icon-button !h-9 !w-9 lg:hidden" onClick={() => setIsSidebarOpen(false)}>
            <X className="h-4 w-4" />
          </button>
        </div>
        <nav className="admin-sidebar-nav">
          {adminSectionGroups.map((group) => (
            <div key={group.label} className="admin-sidebar-group">
              <p className="admin-sidebar-group-label">{group.label === "Overview" ? "Main Menu" : group.label}</p>
              {group.sections.map((section) => {
                const Icon = section.icon;
                return (
                  <button
                    key={section.id}
                    type="button"
                    className={activeSection === section.id ? "admin-sidebar-link group active" : "admin-sidebar-link group"}
                    onClick={() => closeSidebarAndNavigate(section.id)}
                  >
                    <Icon className="h-4 w-4 shrink-0" />
                    <span>{section.label}</span>
                    {section.id === "payments" && Boolean(dashboardData?.pending_payment_reviews) && (
                      <span className="admin-sidebar-badge">{dashboardData?.pending_payment_reviews}</span>
                    )}
                    <ChevronRight className="admin-sidebar-chevron h-4 w-4" />
                  </button>
                );
              })}
            </div>
          ))}
        </nav>
      </aside>

      <div className="admin-main">
        <header className="admin-topbar">
          <div className="flex flex-1 items-center gap-3">
            <button type="button" className="admin-topbar-icon-button !h-10 !w-10 lg:hidden" onClick={() => setIsSidebarOpen(true)}>
              <Menu className="h-4 w-4" />
            </button>
            <div className="admin-topbar-search">
              <Search className="h-4 w-4 shrink-0" />
              <span className="truncate">Search anything...</span>
              <kbd>⌘K</kbd>
            </div>
          </div>
          <div className="flex shrink-0 items-center gap-2 sm:gap-3">
            <button type="button" className="btn-primary justify-center !min-h-9 !px-3 !text-[11px]" onClick={saveContent} disabled={isSaving}>
              <Save className="h-4 w-4" />
              <span className="hidden sm:inline">{isSaving ? "Saving..." : "Save changes"}</span>
            </button>
            <button type="button" className="admin-topbar-icon-button">
              <Bell className="h-4 w-4" />
              {Boolean(dashboardData?.pending_payment_reviews) && (
                <span className="admin-topbar-badge">{dashboardData?.pending_payment_reviews}</span>
              )}
            </button>
            <button type="button" className="admin-topbar-avatar" onClick={handleLogout} title="Logout">
              <span className="admin-avatar-circle">
                <User className="h-4 w-4" />
              </span>
              <span className="hidden text-left sm:block">
                <p>Admin</p>
                <small>Administrator</small>
              </span>
              <LogOut className="h-3.5 w-3.5 shrink-0 text-white/40" />
            </button>
          </div>
        </header>

      <main className="admin-content">
        {message && (
          <p className={/fail|could not|invalid|expired|must be|enter a valid/i.test(message) ? "form-message error" : "form-message success"}>
            {message}
          </p>
        )}

        {activeSection !== "dashboard" && !routeClientId && !routeServiceId && (
          <AdminBreadcrumbs
            items={[
              { label: "Dashboard", onClick: () => navigateToSection("dashboard") },
              { label: adminSectionLabels[activeSection] },
            ]}
          />
        )}

        {routeClientId && (
          <ClientDetailPage
            clientId={routeClientId}
            adminToken={adminToken}
            onBack={() => navigateAdminRoute(adminPath("clients"))}
            onOpenService={(serviceId) => navigateAdminRoute(adminServiceDetailPath(serviceId))}
            onImpersonate={(id) => void impersonateClient(id)}
            impersonatingClientId={impersonatingClientId}
          />
        )}

        {routeServiceId && !routeClientId && (
          <ServiceDetailPanel
            serviceId={routeServiceId}
            adminToken={adminToken}
            onBack={() => navigateAdminRoute(adminPath("services"))}
            onOpenClient={(clientId) => navigateAdminRoute(adminClientDetailPath(clientId))}
          />
        )}

        {activeSection === "dashboard" && !routeClientId && !routeServiceId && (
          <AdminDashboardOverview
            data={dashboardData}
            isLoading={isDashboardLoading}
            onNavigate={(section) => navigateToSection(section as AdminSectionId)}
          />
        )}

        {activeSection === "clients" && !routeClientId && !routeServiceId && (
          <AdminClientsList adminToken={adminToken} onOpenClient={(id) => navigateAdminRoute(adminClientDetailPath(id))} />
        )}

        {activeSection === "paymentVerification" && !routeClientId && !routeServiceId && (
          <AdminRecordsSection
            title="Payment Verification"
            description="Bank transfer payments awaiting manual review and approval."
            records={adminRecords.payments || null}
            isLoading={Boolean(loadingRecords.payments)}
            renderRowActions={(row) => {
              const invoiceNumber = (row.invoice as { invoice_number?: string } | null)?.invoice_number;
              const paymentId = Number(row.id);
              const isBusy = approvingPaymentId === paymentId;

              if (row.gateway !== "bank_transfer" || row.status !== "pending_review" || !invoiceNumber) return null;

              return (
                <div className="flex items-center justify-end gap-2">
                  <button type="button" className="btn-outline !min-h-9 !px-3 !py-1.5 !text-[10px]" onClick={() => void downloadReceipt(paymentId)}>View Proof</button>
                  <button type="button" className="btn-outline !min-h-9 !px-3 !py-1.5 !text-[10px]" disabled={isBusy} onClick={() => void approveBankTransferPayment(invoiceNumber, paymentId)}>
                    {isBusy ? "Approving..." : "Approve"}
                  </button>
                  <button type="button" className="btn-outline !min-h-9 !px-3 !py-1.5 !text-[10px]" disabled={isBusy} onClick={() => void rejectBankTransferPayment(invoiceNumber, paymentId)}>Reject</button>
                </div>
              );
            }}
            filters={adminRecordFilterDefs.payments}
            filterValues={recordFilters.payments}
            onFilterChange={(key, value) => updateRecordFilter("payments", key, value)}
            onClearFilters={() => clearRecordFilters("payments")}
            page={recordPage.payments || 1}
            onPageChange={(page) => setRecordPage((current) => ({ ...current, payments: page }))}
          />
        )}

        {activeSection === "services" && !routeClientId && !routeServiceId && (
          <AdminServicesGroupedDashboard
            adminToken={adminToken}
            initialStatusFilter={isServicesActiveRoute ? "active" : undefined}
            onOpenService={(id) => navigateAdminRoute(adminServiceDetailPath(id))}
          />
        )}

        {activeSection === "ispconfigImport" && !routeClientId && !routeServiceId && (
          <AdminIspConfigImportPanel adminToken={adminToken} />
        )}

        {activeSection === "invoices" && !routeClientId && !routeServiceId && (
          <div className="admin-panel flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
            <div>
              <h3 className="text-lg font-black text-white">Create a manual invoice</h3>
              <p className="mt-1 text-sm text-white/55">Bill a client for something outside the normal checkout or renewal flow.</p>
            </div>
            <button type="button" className="btn-primary" onClick={() => setIsCreatingInvoice(true)}>+ Create Invoice</button>
          </div>
        )}

        {isCreatingInvoice && (
          <CreateManualInvoiceModal
            adminToken={adminToken}
            onClose={() => setIsCreatingInvoice(false)}
            onCreated={() => {
              setIsCreatingInvoice(false);
              setMessage("Invoice created and emailed to the client.");
              void loadAdminRecords("invoices", adminToken);
            }}
          />
        )}

        {isRecordSection(activeSection) && !routeClientId && !routeServiceId && (
          <AdminRecordsSection
            title={adminRecordLabels[activeSection].title}
            description={adminRecordLabels[activeSection].description}
            records={adminRecords[activeSection] || null}
            isLoading={Boolean(loadingRecords[activeSection])}
            renderRowActions={
              activeSection === "payments"
                ? (row) => {
                    const invoiceNumber = (row.invoice as { invoice_number?: string } | null)?.invoice_number;
                    const paymentId = Number(row.id);
                    const isBusy = approvingPaymentId === paymentId;

                    if (row.gateway !== "bank_transfer" || row.status !== "pending_review" || !invoiceNumber) return null;

                    return (
                      <div className="flex items-center justify-end gap-2">
                        <button
                          type="button"
                          className="btn-outline !min-h-9 !px-3 !py-1.5 !text-[10px]"
                          onClick={() => void downloadReceipt(paymentId)}
                        >
                          View Proof
                        </button>
                        <button
                          type="button"
                          className="btn-outline !min-h-9 !px-3 !py-1.5 !text-[10px]"
                          disabled={isBusy}
                          onClick={() => void approveBankTransferPayment(invoiceNumber, paymentId)}
                        >
                          {isBusy ? "Approving..." : "Approve"}
                        </button>
                        <button
                          type="button"
                          className="btn-outline !min-h-9 !px-3 !py-1.5 !text-[10px]"
                          disabled={isBusy}
                          onClick={() => void rejectBankTransferPayment(invoiceNumber, paymentId)}
                        >
                          Reject
                        </button>
                      </div>
                    );
                  }
                : activeSection === "domainOrders"
                  ? (row) => {
                      const domainOrderId = Number(row.id);
                      const isBusy = domainActionBusyId === domainOrderId;

                      if (row.status !== "awaiting_manual_registration") return null;

                      return (
                        <div className="flex items-center justify-end gap-2">
                          <button
                            type="button"
                            className="btn-outline !min-h-9 !px-3 !py-1.5 !text-[10px]"
                            disabled={isBusy}
                            onClick={() => void markDomainRegistered(domainOrderId)}
                          >
                            {isBusy ? "Saving..." : "Mark as Registered"}
                          </button>
                        </div>
                      );
                    }
                  : activeSection === "domainTransfers"
                    ? (row) => {
                        const transferId = Number(row.id);
                        const isBusy = domainActionBusyId === transferId;

                        return (
                          <div className="flex items-center justify-end gap-2">
                            <button
                              type="button"
                              className="btn-outline !min-h-9 !px-3 !py-1.5 !text-[10px]"
                              disabled={isBusy}
                              onClick={() => void retryDomainTransferSync(transferId)}
                            >
                              {isBusy ? "Syncing..." : "Retry Sync"}
                            </button>
                          </div>
                        );
                      }
                    : activeSection === "domains"
                      ? (row) => {
                          const domainId = Number(row.id);
                          const isBusy = domainActionBusyId === domainId;
                          const linkedHostingService = row.linked_hosting_service as { id: number } | null;
                          const isExternal = row.source === "external";
                          const isAutoRenewOn = Boolean(row.auto_renew);
                          const isCloudflare = row.provider === "cloudflare";
                          const client = row.client as { id: number } | null;
                          const badges = domainAdminBadges(row);

                          return (
                            <div className="flex flex-col items-end gap-2">
                              {badges.length > 0 && (
                                <div className="flex flex-wrap justify-end gap-1">
                                  {badges.map((badge) => (
                                    <span key={badge.label} className={`status-pill ${badge.tone}`}>
                                      {badge.label}
                                    </span>
                                  ))}
                                </div>
                              )}
                              <div className="flex flex-wrap items-center justify-end gap-2">
                              {linkedHostingService ? (
                                <button
                                  type="button"
                                  className="btn-outline !min-h-9 !px-3 !py-1.5 !text-[10px]"
                                  disabled={isBusy}
                                  onClick={() => void unlinkDomainHosting(domainId)}
                                >
                                  Unlink Hosting
                                </button>
                              ) : (
                                <button
                                  type="button"
                                  className="btn-outline !min-h-9 !px-3 !py-1.5 !text-[10px]"
                                  disabled={isBusy}
                                  onClick={() => void linkDomainHosting(domainId)}
                                >
                                  Link Hosting
                                </button>
                              )}
                              {isExternal && linkedHostingService && (
                                <button
                                  type="button"
                                  className="btn-outline !min-h-9 !px-3 !py-1.5 !text-[10px]"
                                  disabled={isBusy}
                                  onClick={() => void sendDomainDnsInstructions(domainId)}
                                >
                                  Send DNS
                                </button>
                              )}
                              {isAutoRenewOn && (
                                <button
                                  type="button"
                                  className="btn-outline !min-h-9 !px-3 !py-1.5 !text-[10px]"
                                  disabled={isBusy}
                                  onClick={() => void disableDomainAutoRenew(domainId)}
                                >
                                  Disable Auto-Renew
                                </button>
                              )}
                              <button
                                type="button"
                                className="btn-outline !min-h-9 !px-3 !py-1.5 !text-[10px]"
                                disabled={isBusy}
                                onClick={() => void renewDomainAdmin(domainId)}
                              >
                                Renew
                              </button>
                              {!isExternal && (
                                <button
                                  type="button"
                                  className="btn-outline !min-h-9 !px-3 !py-1.5 !text-[10px]"
                                  disabled={isBusy}
                                  onClick={() => void markDomainSource(domainId, "external")}
                                >
                                  Mark External
                                </button>
                              )}
                              {isCloudflare && (
                                <button
                                  type="button"
                                  className="btn-outline !min-h-9 !px-3 !py-1.5 !text-[10px]"
                                  disabled={isBusy}
                                  onClick={() => void refreshDomainFromCloudflare(domainId)}
                                >
                                  Refresh from Cloudflare
                                </button>
                              )}
                              <button
                                type="button"
                                className="btn-outline !min-h-9 !px-3 !py-1.5 !text-[10px]"
                                disabled={isBusy}
                                onClick={() => void assignOrReassignDomainCustomer(domainId, client?.id ?? null)}
                              >
                                {client ? "Change Customer" : "Assign Customer"}
                              </button>
                              {!client && (
                                <button
                                  type="button"
                                  className="btn-outline !min-h-9 !px-3 !py-1.5 !text-[10px]"
                                  disabled={isBusy}
                                  onClick={() => void markDomainInternal(domainId)}
                                >
                                  Mark Internal
                                </button>
                              )}
                              <button
                                type="button"
                                className="btn-outline !min-h-9 !px-3 !py-1.5 !text-[10px]"
                                disabled={isBusy}
                                onClick={() => void viewDomainSyncHistory(domainId)}
                              >
                                Sync History
                              </button>
                              <button
                                type="button"
                                className="btn-outline !min-h-9 !px-3 !py-1.5 !text-[10px]"
                                disabled={isBusy}
                                onClick={() => void addDomainNote(domainId)}
                              >
                                Add Note
                              </button>
                              </div>
                            </div>
                          );
                        }
                      : undefined
            }
            filters={adminRecordFilterDefs[activeSection]}
            filterValues={recordFilters[activeSection]}
            onFilterChange={(key, value) => updateRecordFilter(activeSection, key, value)}
            onClearFilters={() => clearRecordFilters(activeSection)}
            page={recordPage[activeSection] || 1}
            onPageChange={(page) => setRecordPage((current) => ({ ...current, [activeSection]: page }))}
          />
        )}

        {activeSection === "domainPricing" && !routeClientId && !routeServiceId && <AdminDomainPricingPage adminToken={adminToken} />}

        {activeSection === "domainAssignments" && !routeClientId && !routeServiceId && <AdminDomainAssignmentPage adminToken={adminToken} />}

        {activeSection === "pricing" && (
          <section className="admin-panel">
            <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
              <div>
                <h2 className="text-2xl font-black">Website Care Packages</h2>
                <p className="mt-1 text-sm text-white/55">
                  Manage the Website Care packages shown on the public pricing page. Technical limits stay internal —
                  the public site only shows the customer-friendly features below.
                </p>
              </div>
              <button
                type="button"
                className="btn-outline justify-center"
                onClick={() => setPricingPackages((current) => [...current, emptyPricingPackage()])}
              >
                <Plus className="h-4 w-4" />
                Add package
              </button>
            </div>

            {isPricingLoading && !pricingPackages.length ? (
              <div className="mt-6 rounded-lg border border-white/10 bg-black/20 p-6 text-sm font-bold text-white/60">Loading pricing packages...</div>
            ) : (
              <div className="mt-6 grid gap-5">
                {pricingPackages.map((plan, index) => (
                  <article key={`${plan.id || "new"}-${index}`} className="admin-card">
                    <div className="grid gap-4 lg:grid-cols-3">
                      <label className="admin-field">
                        <span>Name</span>
                        <input value={plan.name} onChange={(event) => updatePricingPackage(index, { name: event.target.value })} />
                      </label>
                      <label className="admin-field">
                        <span>Slug</span>
                        <input value={plan.slug} onChange={(event) => updatePricingPackage(index, { slug: event.target.value })} />
                      </label>
                      <label className="admin-field">
                        <span>Sort order</span>
                        <input
                          type="number"
                          min={0}
                          value={plan.sort_order}
                          onChange={(event) => updatePricingPackage(index, { sort_order: Number(event.target.value) })}
                        />
                      </label>
                    </div>
                    <label className="admin-field mt-4">
                      <span>Short description</span>
                      <input
                        value={plan.short_description}
                        onChange={(event) => updatePricingPackage(index, { short_description: event.target.value })}
                      />
                    </label>
                    <div className="mt-4 grid gap-4 md:grid-cols-2">
                      <label className="admin-field">
                        <span>Display badge (e.g. "Most Popular")</span>
                        <input
                          value={plan.display_badge || ""}
                          onChange={(event) => updatePricingPackage(index, { display_badge: event.target.value })}
                        />
                      </label>
                      <label className="admin-field">
                        <span>CTA button label</span>
                        <input
                          value={plan.cta_label || ""}
                          onChange={(event) => updatePricingPackage(index, { cta_label: event.target.value })}
                        />
                      </label>
                    </div>
                    <label className="admin-field mt-4">
                      <span>Public features (one per line — shown on the pricing page)</span>
                      <textarea
                        defaultValue={(plan.public_features || []).join("\n")}
                        onBlur={(event) =>
                          updatePricingPackage(index, {
                            public_features: event.target.value
                              .split("\n")
                              .map((line) => line.trim())
                              .filter(Boolean),
                          })
                        }
                        rows={6}
                      />
                    </label>
                    <div className="mt-4 grid gap-4 md:grid-cols-3">
                      <label className="admin-field">
                        <span>Monthly price (kobo)</span>
                        <input
                          type="number"
                          min={0}
                          value={plan.monthly_price_kobo}
                          onChange={(event) => updatePricingPackage(index, { monthly_price_kobo: Number(event.target.value) })}
                        />
                      </label>
                      <label className="admin-field">
                        <span>Annual price (kobo)</span>
                        <input
                          type="number"
                          min={0}
                          value={plan.annual_price_kobo}
                          onChange={(event) => updatePricingPackage(index, { annual_price_kobo: Number(event.target.value) })}
                        />
                      </label>
                      <label className="admin-field">
                        <span>Setup fee (kobo)</span>
                        <input
                          type="number"
                          min={0}
                          value={plan.setup_fee_kobo}
                          onChange={(event) => updatePricingPackage(index, { setup_fee_kobo: Number(event.target.value) })}
                        />
                      </label>
                    </div>
                    <div className="mt-5 flex flex-wrap gap-4">
                      <label className="admin-check">
                        <input
                          type="checkbox"
                          checked={plan.is_popular}
                          onChange={(event) => updatePricingPackage(index, { is_popular: event.target.checked })}
                        />
                        Most popular
                      </label>
                      <label className="admin-check">
                        <input
                          type="checkbox"
                          checked={plan.is_recommended}
                          onChange={(event) => updatePricingPackage(index, { is_recommended: event.target.checked })}
                        />
                        Recommended
                      </label>
                      <label className="admin-check">
                        <input
                          type="checkbox"
                          checked={plan.is_active}
                          onChange={(event) => updatePricingPackage(index, { is_active: event.target.checked })}
                        />
                        Active
                      </label>
                      <label className="admin-check">
                        <input
                          type="checkbox"
                          checked={plan.migration_included}
                          onChange={(event) => updatePricingPackage(index, { migration_included: event.target.checked })}
                        />
                        Migration included
                      </label>
                    </div>

                    <p className="mt-6 text-xs font-black uppercase tracking-wide text-white/40">
                      Internal limits — used for provisioning, never shown on the public site
                    </p>
                    <div className="mt-3 grid gap-4 md:grid-cols-3">
                      <label className="admin-field">
                        <span>Storage</span>
                        <input value={plan.storage_allocation} onChange={(event) => updatePricingPackage(index, { storage_allocation: event.target.value })} />
                      </label>
                      <label className="admin-field">
                        <span>Bandwidth</span>
                        <input value={plan.bandwidth_policy} onChange={(event) => updatePricingPackage(index, { bandwidth_policy: event.target.value })} />
                      </label>
                      <label className="admin-field">
                        <span>Support tier</span>
                        <input value={plan.support_tier} onChange={(event) => updatePricingPackage(index, { support_tier: event.target.value })} />
                      </label>
                    </div>
                    <div className="mt-4 grid gap-4 md:grid-cols-4">
                      <label className="admin-field">
                        <span>Websites</span>
                        <input type="number" min={0} value={plan.websites} onChange={(event) => updatePricingPackage(index, { websites: Number(event.target.value) })} />
                      </label>
                      <label className="admin-field">
                        <span>Databases</span>
                        <input type="number" min={0} value={plan.databases} onChange={(event) => updatePricingPackage(index, { databases: Number(event.target.value) })} />
                      </label>
                      <label className="admin-field">
                        <span>Email accounts</span>
                        <input type="number" min={0} value={plan.email_accounts} onChange={(event) => updatePricingPackage(index, { email_accounts: Number(event.target.value) })} />
                      </label>
                      <label className="admin-field">
                        <span>Backups</span>
                        <input value={plan.backup_frequency || ""} onChange={(event) => updatePricingPackage(index, { backup_frequency: event.target.value })} />
                      </label>
                    </div>
                    <label className="admin-field mt-4">
                      <span>Internal limits (JSON — business_emails, support_level, security_monitoring, etc.)</span>
                      <textarea
                        defaultValue={JSON.stringify(plan.internal_limits || {}, null, 2)}
                        onBlur={(event) => {
                          try {
                            updatePricingPackage(index, { internal_limits: JSON.parse(event.target.value || "{}") });
                          } catch {
                            setMessage("Internal limits must be valid JSON — change not applied.");
                          }
                        }}
                        rows={6}
                        className="font-mono"
                      />
                    </label>
                    <label className="admin-field mt-4">
                      <span>Internal notes</span>
                      <textarea
                        value={plan.internal_notes || ""}
                        onChange={(event) => updatePricingPackage(index, { internal_notes: event.target.value })}
                        rows={3}
                      />
                    </label>
                    <div className="mt-5 flex flex-col gap-3 sm:flex-row sm:justify-end">
                      <button type="button" className="btn-primary justify-center" onClick={() => savePricingPackage(index)} disabled={isPricingLoading}>
                        <Save className="h-4 w-4" />
                        Save package
                      </button>
                      <button type="button" className="btn-outline justify-center" onClick={() => removePricingPackage(index)} disabled={isPricingLoading}>
                        <Trash2 className="h-4 w-4" />
                        {plan.id ? "Disable" : "Remove"}
                      </button>
                    </div>
                  </article>
                ))}
              </div>
            )}
          </section>
        )}

        {activeSection === "logo" && (
        <section className="admin-panel">
          <div className="flex flex-col gap-5 lg:flex-row lg:items-center lg:justify-between">
            <div>
              <h2 className="text-2xl font-black">Main Logo</h2>
              <p className="mt-1 text-sm text-white/55">Shown in the header, mobile preview, contact section and footer.</p>
            </div>
            <div className="flex h-24 w-full items-center justify-center rounded-lg border border-white/10 bg-[#050806] p-4 lg:w-72">
              <img src={content.brand.logo.src || "/logo.png"} alt={content.brand.logo.alt || "NAITALK"} className="max-h-full w-full object-contain" />
            </div>
          </div>
          <div className="mt-6 grid gap-4 lg:grid-cols-[1fr_1fr_auto] lg:items-end">
            <label className="admin-field">
              <span>Alt text</span>
              <input
                value={content.brand.logo.alt}
                onChange={(event) =>
                  setContent((current) => ({
                    ...current,
                    brand: { logo: { ...current.brand.logo, alt: event.target.value } },
                  }))
                }
              />
            </label>
            <label className="admin-field">
              <span>Image path</span>
              <input
                value={content.brand.logo.src}
                onChange={(event) =>
                  setContent((current) => ({
                    ...current,
                    brand: { logo: { ...current.brand.logo, src: event.target.value } },
                  }))
                }
              />
            </label>
            <label className="admin-upload-button">
              <Upload className="h-4 w-4" />
              {isUploading === "brand" ? "Uploading..." : "Upload"}
              <input
                type="file"
                accept="image/png,image/jpeg,image/webp,image/gif,image/svg+xml"
                onChange={(event) =>
                  uploadImage(event.target.files?.[0], "brand", (image) =>
                    setContent((current) => ({
                      ...current,
                      brand: { logo: { ...current.brand.logo, ...image, alt: current.brand.logo.alt || image.alt } },
                    })),
                  )
                }
              />
            </label>
          </div>
        </section>
        )}

        {activeSection === "clientLogos" && (
        <section className="admin-panel">
          <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
            <div>
              <h2 className="text-2xl font-black">Client Logos</h2>
              <p className="mt-1 text-sm text-white/55">Wide, square and tall images are fitted without cropping.</p>
            </div>
            <button
              type="button"
              className="btn-outline justify-center"
              onClick={() => setContent((current) => ({ ...current, clientLogos: [...current.clientLogos, emptyClientLogo()] }))}
            >
              <Plus className="h-4 w-4" />
              Add logo
            </button>
          </div>
          <div className="mt-6 grid gap-4 md:grid-cols-2 xl:grid-cols-3">
            {content.clientLogos.map((logo, index) => (
              <article key={index} className="admin-card">
                <div className="flex h-20 items-center justify-center rounded-lg border border-white/10 bg-[#050806] p-3">
                  {logo.src ? (
                    <img src={logo.src} alt={logo.alt || logo.name} className="max-h-full w-full object-contain" />
                  ) : (
                    <ImageIcon className="h-7 w-7 text-white/30" />
                  )}
                </div>
                <label className="admin-field">
                  <span>Name</span>
                  <input value={logo.name} onChange={(event) => updateClientLogo(index, { name: event.target.value })} />
                </label>
                <label className="admin-field">
                  <span>Alt text</span>
                  <input value={logo.alt} onChange={(event) => updateClientLogo(index, { alt: event.target.value })} />
                </label>
                <label className="admin-field">
                  <span>Image path</span>
                  <input value={logo.src} onChange={(event) => updateClientLogo(index, { src: event.target.value })} />
                </label>
                <div className="flex gap-3">
                  <label className="admin-upload-button flex-1">
                    <Upload className="h-4 w-4" />
                    {isUploading === `client-${index}` ? "Uploading..." : "Upload"}
                    <input
                      type="file"
                      accept="image/png,image/jpeg,image/webp,image/gif,image/svg+xml"
                      onChange={(event) =>
                        uploadImage(event.target.files?.[0], `client-${index}`, (image) =>
                          updateClientLogo(index, { ...image, alt: logo.alt || image.alt }),
                        )
                      }
                    />
                  </label>
                  <button
                    type="button"
                    className="admin-icon-button"
                    aria-label="Remove client logo"
                    onClick={() =>
                      setContent((current) => ({
                        ...current,
                        clientLogos: current.clientLogos.filter((_, logoIndex) => logoIndex !== index),
                      }))
                    }
                  >
                    <Trash2 className="h-4 w-4" />
                  </button>
                </div>
              </article>
            ))}
          </div>
        </section>
        )}

        {activeSection === "portfolio" && (
        <section className="admin-panel">
          <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
            <div>
              <h2 className="text-2xl font-black">Portfolio</h2>
              <p className="mt-1 text-sm text-white/55">These records feed the homepage portfolio and showcase images.</p>
            </div>
            <button
              type="button"
              className="btn-outline justify-center"
              onClick={() => setContent((current) => ({ ...current, projects: [...current.projects, emptyProject()] }))}
            >
              <Plus className="h-4 w-4" />
              Add project
            </button>
          </div>

          <div className="mt-6 grid gap-5">
            {content.projects.map((project, index) => (
              <article key={index} className="admin-card">
                <div className="grid gap-5 lg:grid-cols-[220px_1fr]">
                  <div>
                    <div className="flex aspect-[4/3] items-center justify-center overflow-hidden rounded-lg border border-white/10 bg-[#050806]">
                      {project.img ? (
                        <img src={project.img} alt={`${project.title} preview`} className="h-full w-full object-cover" />
                      ) : (
                        <ImageIcon className="h-8 w-8 text-white/30" />
                      )}
                    </div>
                    <label className="admin-upload-button mt-3 w-full">
                      <Upload className="h-4 w-4" />
                      {isUploading === `project-${index}` ? "Uploading..." : "Upload image"}
                      <input
                        type="file"
                        accept="image/png,image/jpeg,image/webp,image/gif,image/svg+xml"
                        onChange={(event) =>
                          uploadImage(event.target.files?.[0], `project-${index}`, (image) => updateProject(index, { img: image.src }))
                        }
                      />
                    </label>
                  </div>

                  <div className="grid gap-4">
                    <div className="grid gap-4 md:grid-cols-2">
                      <label className="admin-field">
                        <span>Project title</span>
                        <input value={project.title} onChange={(event) => updateProject(index, { title: event.target.value })} />
                      </label>
                      <label className="admin-field">
                        <span>Category</span>
                        <input value={project.category} onChange={(event) => updateProject(index, { category: event.target.value })} />
                      </label>
                    </div>
                    <label className="admin-field">
                      <span>Image path</span>
                      <input value={project.img} onChange={(event) => updateProject(index, { img: event.target.value })} />
                    </label>
                    <label className="admin-field">
                      <span>Challenge</span>
                      <textarea value={project.details.challenge} onChange={(event) => updateProjectDetail(index, "challenge", event.target.value)} rows={3} />
                    </label>
                    <label className="admin-field">
                      <span>Solution</span>
                      <textarea value={project.details.solution} onChange={(event) => updateProjectDetail(index, "solution", event.target.value)} rows={3} />
                    </label>
                    <label className="admin-field">
                      <span>ROI</span>
                      <textarea value={project.details.roi} onChange={(event) => updateProjectDetail(index, "roi", event.target.value)} rows={2} />
                    </label>
                    <div className="flex justify-end">
                      <button
                        type="button"
                        className="btn-outline"
                        onClick={() =>
                          setContent((current) => ({
                            ...current,
                            projects: current.projects.filter((_, projectIndex) => projectIndex !== index),
                          }))
                        }
                      >
                        <Trash2 className="h-4 w-4" />
                        Remove
                      </button>
                    </div>
                  </div>
                </div>
              </article>
            ))}
          </div>
        </section>
        )}

        {activeSection === "testimonials" && (
        <section className="admin-panel">
          <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
            <div>
              <h2 className="text-2xl font-black">Testimonials</h2>
              <p className="mt-1 text-sm text-white/55">Manage the client reviews shown on the homepage.</p>
            </div>
            <button
              type="button"
              className="btn-outline justify-center"
              onClick={() => setContent((current) => ({ ...current, reviews: [...current.reviews, emptyReview()] }))}
            >
              <Plus className="h-4 w-4" />
              Add testimonial
            </button>
          </div>

          <div className="mt-6 grid gap-5 md:grid-cols-2">
            {content.reviews.map((review, index) => (
              <article key={`${review.author_name}-${index}`} className="admin-card">
                <div className="flex items-center gap-4">
                  <div className="flex h-16 w-16 shrink-0 items-center justify-center overflow-hidden rounded-full border border-primary/25 bg-primary/10">
                    {review.profile_photo_url ? (
                      <img src={review.profile_photo_url} alt={review.author_name || "Reviewer"} className="h-full w-full object-cover" />
                    ) : (
                      <MessageCircle className="h-6 w-6 text-primary" />
                    )}
                  </div>
                  <div>
                    <h3 className="font-black text-white">{review.author_name || "New testimonial"}</h3>
                    <p className="mt-1 text-xs text-white/50">{review.rating || 5} star rating</p>
                  </div>
                </div>

                <div className="mt-5 grid gap-4">
                  <div className="grid gap-4 sm:grid-cols-[1fr_120px]">
                    <label className="admin-field">
                      <span>Client name</span>
                      <input value={review.author_name} onChange={(event) => updateReview(index, { author_name: event.target.value })} />
                    </label>
                    <label className="admin-field">
                      <span>Rating</span>
                      <input
                        type="number"
                        min={1}
                        max={5}
                        value={review.rating}
                        onChange={(event) => updateReview(index, { rating: Number(event.target.value) })}
                      />
                    </label>
                  </div>
                  <label className="admin-field">
                    <span>Time label</span>
                    <input
                      value={review.relative_time_description || ""}
                      onChange={(event) => updateReview(index, { relative_time_description: event.target.value })}
                      placeholder="1 week ago"
                    />
                  </label>
                  <label className="admin-field">
                    <span>Profile photo URL</span>
                    <input
                      value={review.profile_photo_url || ""}
                      onChange={(event) => updateReview(index, { profile_photo_url: event.target.value })}
                    />
                  </label>
                  <label className="admin-field">
                    <span>Review text</span>
                    <textarea value={review.text} onChange={(event) => updateReview(index, { text: event.target.value })} rows={5} />
                  </label>
                  <div className="flex justify-end">
                    <button
                      type="button"
                      className="btn-outline"
                      onClick={() =>
                        setContent((current) => ({
                          ...current,
                          reviews: current.reviews.filter((_, reviewIndex) => reviewIndex !== index),
                        }))
                      }
                    >
                      <Trash2 className="h-4 w-4" />
                      Remove
                    </button>
                  </div>
                </div>
              </article>
            ))}
          </div>
        </section>
        )}
      </main>
      </div>
    </div>
  );
}

type PublicDomainSuggestion = {
  domain: string;
  tld: string;
  registration_price_kobo: number;
  renewal_price_kobo: number;
  currency: string;
};

type PublicDomainSearchResult = {
  domain: string;
  tld: string;
  available: boolean;
  tld_supported: boolean;
  premium: boolean;
  registration_price_kobo: number | null;
  renewal_price_kobo: number | null;
  transfer_price_kobo: number | null;
  currency: string | null;
  suggestions: PublicDomainSuggestion[];
};

type PublicTldPricingRow = {
  tld: string;
  registration_price_kobo: number | null;
  registration_price: string | null;
};

const DOMAIN_TLD_ORDER = [".com", ".ng", ".com.ng", ".org", ".net"];

const DOMAIN_TLD_BADGES: Record<string, string> = {
  ".com": "Most Popular",
  ".ng": "Popular in Nigeria",
  ".com.ng": "Great for Businesses",
  ".org": "For Organizations",
  ".net": "For Networks",
};

type DomainFeature = { icon: LucideIcon; title: string; description: string };

const DOMAIN_FEATURES: DomainFeature[] = [
  { icon: Globe2, title: "Domain Registration", description: "Get the perfect domain for your business." },
  { icon: ArrowRightLeft, title: "Domain Transfer", description: "Move your domain to NAI TALK easily." },
  { icon: RefreshCw, title: "Renewals", description: "Never lose your domain with auto-renewal." },
  { icon: Settings, title: "Easy Management", description: "Manage all your domains in one simple dashboard." },
];

function goToDomainCheckout(domain: string) {
  const domainExtension = domain.includes(".") ? domain.slice(domain.lastIndexOf(".")) : undefined;
  trackEvent("domain_purchase_start", { domain_extension: domainExtension });
  window.location.href = `/client/domains/search?domain=${encodeURIComponent(domain)}`;
}

/** Top-right promo pill: "Welcome to NAI TALK! Get 10% off ...". */
function DomainPromoBadge() {
  return (
    <div className="domain-promo-badge">
      <span className="domain-promo-icon">
        <Gift className="h-5 w-5" />
      </span>
      <p>
        <strong>Welcome to NAI TALK!</strong>
        <br />
        <span>
          Get <b>10% off</b> your first domain search.
        </span>
      </p>
    </div>
  );
}

/** A single popular-TLD price card ("From ₦7,500 /yr", badge pill). */
const TldPriceCard: React.FC<{ row: PublicTldPricingRow }> = ({ row }) => {
  return (
    <div className="domain-tld-card">
      <p>{row.tld}</p>
      <span>
        From <strong className="text-black">{row.registration_price} /yr</strong>
      </span>
      <small>
        {DOMAIN_TLD_BADGES[row.tld] || "Great value"}
      </small>
    </div>
  );
};

/** One item in the "Domain Registration / Transfer / Renewals / Easy Management" row. */
const DomainFeatureItem: React.FC<{ feature: DomainFeature }> = ({ feature }) => {
  return (
    <div className="domain-feature-item">
      <span>
        <feature.icon className="h-5 w-5" strokeWidth={3} aria-hidden="true" />
      </span>
      <div>
        <p>{feature.title}</p>
        <small>{feature.description}</small>
      </div>
    </div>
  );
};

/** The domain search input + CTA button, with inline results/suggestions. */
function DomainSearchBar({ initialDomain }: { initialDomain?: string } = {}) {
  const [domainInput, setDomainInput] = useState(initialDomain || "");
  const [isSearching, setIsSearching] = useState(false);
  const [result, setResult] = useState<PublicDomainSearchResult | null>(null);
  const [hasSearched, setHasSearched] = useState(false);
  const [searchError, setSearchError] = useState("");

  const search = async (domainOverride?: string) => {
    const domain = (domainOverride ?? domainInput).trim().toLowerCase();
    if (!domain) return;

    setIsSearching(true);
    setSearchError("");
    setResult(null);

    const domainExtension = domain.includes(".") ? domain.slice(domain.lastIndexOf(".")) : undefined;
    trackDomainSearch("query", { domain_extension: domainExtension });

    try {
      const data = await laravelApi<PublicDomainSearchResult>(`/api/v1/public/domains/search?domain=${encodeURIComponent(domain)}`);
      setResult(data);
      setHasSearched(true);
      trackDomainSearch("result", {
        domain_extension: domainExtension,
        available: data.available,
        search_result_count: 1 + (data.suggestions?.length || 0),
      });
    } catch (error) {
      setSearchError(error instanceof Error ? error.message : "Domain search is temporarily unavailable. Please try again shortly.");
    } finally {
      setIsSearching(false);
    }
  };

  useEffect(() => {
    if (initialDomain) {
      void search(initialDomain);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  return (
    <>
      <form
        className="domain-search-form"
        onSubmit={(event) => {
          event.preventDefault();
          void search();
        }}
      >
        <label htmlFor="homepage-domain-search" className="sr-only">
          Search for a domain name
        </label>
        <div className="domain-search-input-wrap">
          <Search className="h-7 w-7 shrink-0" aria-hidden="true" />
          <input
            id="homepage-domain-search"
            value={domainInput}
            onChange={(event) => setDomainInput(event.target.value)}
            placeholder="Search your domain e.g. mybusiness.com"
            className="w-full bg-transparent text-sm text-black placeholder:text-black/38 focus:outline-none sm:text-base"
          />
        </div>
        <button
          type="submit"
          disabled={isSearching}
          className="domain-search-button"
        >
          {isSearching ? "Searching..." : "Search Domain"}
          <ArrowRight className="h-5 w-5" aria-hidden="true" />
        </button>
      </form>

      {searchError && <p className="mt-3 text-sm font-bold text-red-600">{searchError}</p>}

      {hasSearched && result && (
        <div className="domain-search-result">
          <div className="flex items-center justify-between gap-3">
            <p className="text-lg font-black text-[#0b1210]">{result.domain}</p>
            <span
              className={`rounded-full px-3 py-1 text-xs font-black uppercase ${
                result.available ? "bg-primary/15 text-primary" : "bg-red-100 text-red-600"
              }`}
            >
              {result.available ? "Available" : result.tld_supported ? "Not Available" : "Not Supported"}
            </span>
          </div>

          {result.available && result.registration_price_kobo !== null && (
            <>
              <p className="mt-3 text-sm text-black/55">
                Registration (1 year): <strong className="text-black">{formatNaira(result.registration_price_kobo / 100)}</strong>
              </p>
              <button
                type="button"
                className="mt-4 flex w-full items-center justify-center gap-2 rounded-xl bg-primary px-5 py-3 text-sm font-black text-on-primary transition hover:brightness-95"
                onClick={() => goToDomainCheckout(result.domain)}
              >
                Buy This Domain
                <ArrowRight className="h-4 w-4" />
              </button>
            </>
          )}

          {result.available && result.registration_price_kobo === null && (
            <p className="mt-3 text-sm text-black/55">Pricing for this extension is being finalized — contact us to register it.</p>
          )}

          {!result.available && !result.tld_supported && (
            <p className="mt-3 text-sm text-black/55">
              This domain extension isn't currently supported for registration. Please try .com, .org, .net, or a different name.
            </p>
          )}

          {!result.available && result.tld_supported && (
            <>
              <p className="mt-3 text-sm text-black/55">That domain is already taken. Here are some available alternatives:</p>
              {result.suggestions.length > 0 ? (
                <div className="mt-4 grid gap-2 sm:grid-cols-2">
                  {result.suggestions.map((suggestion) => (
                    <button
                      key={suggestion.domain}
                      type="button"
                      onClick={() => goToDomainCheckout(suggestion.domain)}
                      className="flex items-center justify-between gap-2 rounded-xl border border-black/8 bg-[#f7fbf6] px-4 py-3 text-left transition hover:border-primary/40 hover:bg-primary/5"
                    >
                      <span className="text-sm font-bold text-black">{suggestion.domain}</span>
                      <span className="text-xs font-black text-primary">{formatNaira(suggestion.registration_price_kobo / 100)}</span>
                    </button>
                  ))}
                </div>
              ) : (
                <p className="mt-3 text-sm text-black/40">No alternatives found right now — try a different name.</p>
              )}
            </>
          )}
        </div>
      )}
    </>
  );
}

/**
 * Homepage-ready Domain Search & Management section — used both directly on
 * the public homepage and as the body of the standalone /domains page, so
 * the two never drift out of sync. TLD prices come from the real
 * admin-configured pricing endpoint, never hardcoded numbers.
 */
function DomainSearchSection({ initialDomain }: { initialDomain?: string } = {}) {
  const [tldPricing, setTldPricing] = useState<PublicTldPricingRow[] | null>(null);

  useEffect(() => {
    laravelApi<{ data: PublicTldPricingRow[] }>("/api/v1/public/domains/pricing")
      .then((response) => setTldPricing(response.data || []))
      .catch(() => setTldPricing([]));
  }, []);

  // Always the real, admin-configured prices — never a hardcoded stand-in,
  // so a TLD only ever appears here once it's actually priced and active.
  // DOMAIN_TLD_ORDER is a display-order preference only — any TLD not in it
  // (a newly added one, say) still shows, just sorted after the curated set,
  // instead of being silently dropped.
  const orderedPricing = (tldPricing ?? []).length
    ? [...(tldPricing ?? [])].sort((a, b) => {
        const rankA = DOMAIN_TLD_ORDER.indexOf(a.tld);
        const rankB = DOMAIN_TLD_ORDER.indexOf(b.tld);
        const orderA = rankA === -1 ? DOMAIN_TLD_ORDER.length : rankA;
        const orderB = rankB === -1 ? DOMAIN_TLD_ORDER.length : rankB;
        return orderA !== orderB ? orderA - orderB : a.tld.localeCompare(b.tld);
      })
    : [];

  return (
    <section
      id="domains"
      className="domain-landing-section"
    >
      <div aria-hidden="true" className="domain-dot-field" />
      <div aria-hidden="true" className="domain-soft-glow domain-soft-glow-left" />
      <div aria-hidden="true" className="domain-soft-glow domain-soft-glow-right" />

      <div className="domain-landing-shell">
        <div className="domain-landing-topbar">
          <DomainPromoBadge />
        </div>

        <div className="domain-hero-grid">
          <div className="domain-copy-panel">
            <h2>
              Find the perfect domain
              <br />
              for <span className="text-primary">your business</span>
            </h2>
            <p>
              Start your online journey with the right domain name. Search, register, transfer, and manage your
              domain with ease.
            </p>

            <div className="domain-search-wrap">
              <DomainSearchBar initialDomain={initialDomain} />
            </div>
          </div>

          <DomainGlobeIllustration />

          <div className="domain-feature-row">
            {DOMAIN_FEATURES.map((feature) => (
              <DomainFeatureItem key={feature.title} feature={feature} />
            ))}
          </div>
        </div>

        <div className="domain-bottom-grid">
          {tldPricing === null && (
            <p className="col-span-full text-sm font-semibold text-white/45">Loading domain pricing…</p>
          )}

          {tldPricing !== null && orderedPricing.length === 0 && (
            <p className="col-span-full text-sm font-semibold text-white/45">
              Domain pricing is being finalized — check back shortly.
            </p>
          )}

          {orderedPricing.map((row) => (
            <TldPriceCard key={row.tld} row={row} />
          ))}

          <div className="domain-launch-panel">
            <span>
              <Rocket className="h-6 w-6" aria-hidden="true" />
            </span>
            <div>
              <p>Launch your brand online</p>
              <small>Your domain is the first step to building trust and growing your business.</small>
              <a href="#homepage-domain-search">
                Start your journey today
                <ArrowRight className="h-5 w-5" aria-hidden="true" />
              </a>
            </div>
          </div>
        </div>

        <div className="domain-trust-row">
          <div className="flex items-center gap-2">
            <ShieldCheck className="h-4 w-4 text-primary" aria-hidden="true" />
            Trusted by thousands of businesses
          </div>
          <div className="flex items-center gap-2 font-bold text-white/70">
            <span className="flex -space-x-2">
              {["A", "B", "C"].map((letter) => (
                <span
                  key={letter}
                  className="flex h-7 w-7 items-center justify-center rounded-full border-2 border-white bg-primary/20 text-[10px] font-black text-primary"
                >
                  {letter}
                </span>
              ))}
            </span>
            2K+ and counting
          </div>
          <div className="flex items-center gap-2">
            <LockKeyhole className="h-4 w-4 text-primary" aria-hidden="true" />
            Secure
          </div>
          <div className="flex items-center gap-2">
            <Headphones className="h-4 w-4 text-primary" aria-hidden="true" />
            24/7 Support
          </div>
          <div className="flex items-center gap-2">
            <BadgeCheck className="h-4 w-4 text-primary" aria-hidden="true" />
            Trusted Domain Partner
          </div>
        </div>
      </div>
    </section>
  );
}

/**
 * Shared shell for every marketing/content page — same dark Navbar/Footer
 * as the homepage. Content in between is being migrated page-by-page from
 * the older light `pub-*` styles to the dark-native styles (pass `dark` to
 * MarketingHero/MarketingCtaBand/FaqAccordionGroup/PublicBreadcrumbs on
 * migrated pages). seoOverrides falls back to the per-path defaults in
 * seo/pageSeoConfig.mjs when omitted.
 */
function PublicPage({
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

function PublicBreadcrumbs({ items, dark = false }: { items: Array<{ label: string; href?: string }>; dark?: boolean }) {
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
function usePublicImage(query: string, orientation: "landscape" | "portrait" = "landscape") {
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

function MarketingHero({
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

function MarketingCtaBand({
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

const FaqAccordionItem: React.FC<{ question: string; answer: string; dark?: boolean }> = ({ question, answer, dark = false }) => {
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

const FaqAccordionGroup: React.FC<{ title?: string; items: Array<{ question: string; answer: string }>; dark?: boolean }> = ({ title, items, dark = false }) => {
  return (
    <div className="grid gap-3">
      {title && <h3 className={`text-lg font-black ${dark ? "text-white" : "text-[#07111f]"}`}>{title}</h3>}
      {items.map((item) => (
        <FaqAccordionItem key={item.question} question={item.question} answer={item.answer} dark={dark} />
      ))}
    </div>
  );
}

/**
 * Standalone /domains page — same section as the homepage, wrapped in the
 * site's normal nav/footer for direct navigation and deep links.
 */
const DOMAIN_WHY_NAI_TALK = [
  { icon: ShieldCheck, title: "Real-time availability", description: "We check the registry directly, so you never pay for a domain that's already taken." },
  { icon: RefreshCw, title: "Renewal reminders & auto-renewal", description: "Never lose a domain to a forgotten expiry date — we remind you and can renew automatically." },
  { icon: Wallet, title: "Flexible payment", description: "Pay by card, bank transfer, or your NAI TALK wallet — whichever suits your business." },
  { icon: Headphones, title: "Real human support", description: "Questions about your domain? Reach us on WhatsApp or a support ticket, any time." },
];

const DOMAIN_FAQ_ITEMS = [
  { question: "Can I buy only a domain without hosting?", answer: "Yes. You can register or transfer a domain on its own and add hosting to it whenever you're ready — there's no requirement to buy both together." },
  { question: "Can I buy hosting later after buying a domain?", answer: "Absolutely. From your dashboard, open the domain and choose \"Add Hosting\" — your existing registration stays exactly as it is." },
  { question: "Can I transfer my domain to NAI TALK?", answer: "Yes, as long as it's unlocked and you have its EPP/authorization code from your current registrar. Most transfers complete within a few days." },
  { question: "What happens if I don't renew my domain?", answer: "You'll get renewal reminders before the expiry date. If a domain does expire, there's usually a short grace period before it becomes available to the public again — but renewing on time is always the safest option." },
];

function DomainsLandingPage() {
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

function DomainRegistrationPage() {
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

function PublicDomainTransferPage() {
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

function DomainRenewalPage() {
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

type PublicPricingRow = {
  tld: string;
  registration_price: string;
  renewal_price: string;
  transfer_price: string;
  best_for: string;
};

function DomainPricingPage() {
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

function WebHostingPage() {
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

type PublicHostingPlan = {
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

function WebsiteCarePlansPage() {
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

function WebsiteDesignPage() {
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

function BusinessEmailHostingPage() {
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

function SeoServicesPage() {
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

function NewsletterSignup() {
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

type PublicBlogSummary = {
  title: string;
  slug: string;
  excerpt: string | null;
  featured_image_url: string | null;
  featured_image_alt: string | null;
  author_name: string;
  published_at: string | null;
  reading_time_minutes: number;
};

const BlogCard: React.FC<{ post: PublicBlogSummary }> = ({ post }) => {
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

function BlogIndexPage() {
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

function BlogDetailPage({ slug }: { slug: string }) {
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

function BlogRouter() {
  const slug = window.location.pathname.replace(/^\/blog\/?/, "").replace(/\/$/, "");

  return slug ? <BlogDetailPage slug={slug} /> : <BlogIndexPage />;
}

const KB_GROUP_ICONS: Record<string, LucideIcon> = {
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

const KB_POPULAR_SLUGS = [
  "how-to-fund-your-wallet",
  "how-to-pay-an-invoice",
  "how-to-search-and-register-a-domain",
  "how-to-raise-a-support-ticket",
  "how-auto-renewal-works",
  "how-to-order-hosting-and-manage-services",
  "how-to-add-hosting-to-a-domain",
  "how-to-update-your-profile",
];

const KB_GETTING_STARTED_SLUGS = [
  "getting-started-with-your-client-dashboard",
  "how-to-order-hosting-and-manage-services",
];

const KB_GROUP_DESCRIPTIONS: Record<string, string> = {
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

type KbGroup = {
  name: string;
  slug: string;
  icon: string | null;
  articles: Array<{ title: string; slug: string; summary: string | null }>;
};

function KnowledgeBaseIndexPage() {
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

function KnowledgeBaseArticlePage({ slug }: { slug: string }) {
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
            <p className="mt-2 text-xs font-bold text-[#9aa39a]">Last updated {article.last_updated_at ? formatDate(article.last_updated_at) : "recently"}</p>

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

function KnowledgeBaseRouter() {
  const slug = window.location.pathname.replace(/^\/knowledge-base\/?/, "").replace(/\/$/, "");

  return slug ? <KnowledgeBaseArticlePage slug={slug} /> : <KnowledgeBaseIndexPage />;
}

function FaqsPage() {
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

function HowToPayPage() {
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

const SERVICE_STATUS_STYLES: Record<string, string> = {
  operational: "bg-primary/10 text-[#2f6d10] border-primary/30",
  degraded: "bg-yellow-100 text-yellow-800 border-yellow-300",
  maintenance: "bg-blue-100 text-blue-800 border-blue-300",
  incident: "bg-red-100 text-red-700 border-red-300",
};

const SERVICE_STATUS_LABELS: Record<string, string> = {
  operational: "Operational",
  degraded: "Degraded",
  maintenance: "Maintenance",
  incident: "Incident",
};

function ServiceStatusPage() {
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

const ABOUT_VALUES = [
  { icon: ShieldCheck, title: "Reliability first", description: "Your website, email and domains stay online and backed up — we treat every client's business as if it were our own." },
  { icon: Headphones, title: "Real human support", description: "No ticket queues that go nowhere — you can always reach a real person on WhatsApp or a support ticket." },
  { icon: BadgeCheck, title: "Straightforward pricing", description: "No hidden fees or surprise renewals — you always know what you're paying for and why." },
  { icon: Rocket, title: "Built for growth", description: "From your first domain to a fully managed website, we scale with you as your business grows." },
];

function AboutPage() {
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

const contactPageInputClass =
  "w-full rounded-lg border border-white/15 bg-white/5 px-4 py-3 text-sm text-white outline-none transition placeholder:text-white/35 focus:border-primary/50 focus:ring-2 focus:ring-primary/15";

const contactPageInfoItems = [
  { icon: Mail, label: "Email", lines: ["info@naitalk.com"], href: "mailto:info@naitalk.com" },
  { icon: Phone, label: "Phone", lines: ["+234 708 705 7654"], href: "tel:+2347087057654" },
  { icon: MapPin, label: "Office Address", lines: ["7 Unity Rd, Off Command Rd, Ikola, Lagos."] },
  { icon: Clock, label: "Support Hours", lines: ["Mon – Fri: 8:00 AM – 6:00 PM", "Sat: 9:00 AM – 2:00 PM"] },
];

function ContactPage() {
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

function PortfolioPage() {
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
        <Portfolio projects={projects} />
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

/**
 * Decorative approximation of the mockup's globe illustration — a dotted
 * sphere with floating UI cards. Purely visual, hidden on small screens.
 */
function DomainGlobeIllustration() {
  return (
    <div className="domain-visual" aria-hidden="true">
      <div className="domain-orbit domain-orbit-one" />
      <div className="domain-orbit domain-orbit-two" />
      <div className="domain-orbit domain-orbit-three" />
      <div className="domain-globe">
        <div className="domain-globe-map domain-globe-map-left" />
        <div className="domain-globe-map domain-globe-map-right" />
        <div className="domain-globe-map domain-globe-map-top" />
      </div>

      <div className="domain-url-card">
        <div>
          <LockKeyhole className="h-4 w-4" />
          <span>
            https://www.your<strong>business</strong>.com
          </span>
        </div>
      </div>
      <MousePointer2 className="domain-cursor" />

      <div className="domain-floating-card domain-brand-card">
        <div className="flex items-center gap-2">
          <span>
            <Globe2 className="h-7 w-7" />
          </span>
          <div>
            <p>Your Brand</p>
            <small>
              .yourbusiness.com
              <CheckCircle2 className="h-3 w-3 text-primary" />
            </small>
          </div>
        </div>
      </div>

      <div className="domain-floating-card domain-secure-card">
        <div className="flex items-center gap-2">
          <span>
            <ShieldCheck className="h-7 w-7" />
          </span>
          <div>
            <p>Secure & Reliable</p>
            <small>
              Your domain is always protected
              <CheckCircle2 className="h-3 w-3 text-primary" />
            </small>
          </div>
        </div>
      </div>
    </div>
  );
}

function LegalPage({ title, sections }: { title: string; sections: Array<{ heading: string; body: string }> }) {
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

function PrivacyPolicyPage() {
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

function TermsOfServicePage() {
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

function RefundPolicyPage() {
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

function PublicSite() {
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
        <Hero projects={projects} logo={siteContent.brand.logo} />
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

  if (path.startsWith("/admin")) return <AdminApp />;
  if (path.startsWith("/client")) return <ClientPortal />;
  if (path.startsWith("/domains")) return <DomainsLandingPage />;
  if (path.startsWith("/domain-registration")) return <DomainRegistrationPage />;
  if (path.startsWith("/domain-transfer")) return <PublicDomainTransferPage />;
  if (path.startsWith("/domain-renewal")) return <DomainRenewalPage />;
  if (path.startsWith("/domain-pricing")) return <DomainPricingPage />;
  if (path.startsWith("/web-hosting")) return <WebHostingPage />;
  if (path.startsWith("/website-care-plans")) return <WebsiteCarePlansPage />;
  if (path.startsWith("/website-design")) return <WebsiteDesignPage />;
  if (path.startsWith("/business-email-hosting")) return <BusinessEmailHostingPage />;
  if (path.startsWith("/seo-services")) return <SeoServicesPage />;
  if (path.startsWith("/blog")) return <BlogRouter />;
  if (path.startsWith("/knowledge-base")) return <KnowledgeBaseRouter />;
  if (path.startsWith("/faqs")) return <FaqsPage />;
  if (path.startsWith("/how-to-pay")) return <HowToPayPage />;
  if (path.startsWith("/service-status")) return <ServiceStatusPage />;
  if (path.startsWith("/about")) return <AboutPage />;
  if (path.startsWith("/contact")) return <ContactPage />;
  if (path.startsWith("/portfolio")) return <PortfolioPage />;
  if (path.startsWith("/privacy-policy")) return <PrivacyPolicyPage />;
  if (path.startsWith("/terms-of-service")) return <TermsOfServicePage />;
  if (path.startsWith("/refund-policy")) return <RefundPolicyPage />;
  return <PublicSite />;
}
