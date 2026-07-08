import React, { useEffect, useMemo, useState } from "react";
import { AnimatePresence, motion } from "motion/react";
import {
  ArrowRight,
  BarChart3,
  Bell,
  Bot,
  CalendarClock,
  CheckCircle2,
  ChevronDown,
  Code2,
  CreditCard,
  Database,
  Download,
  Eye,
  Facebook,
  FileText,
  Globe2,
  HardDrive,
  Headphones,
  Home,
  Image as ImageIcon,
  KeyRound,
  Linkedin,
  Loader2,
  LockKeyhole,
  LogOut,
  Mail,
  MapPin,
  Menu,
  MessageCircle,
  MonitorSmartphone,
  MoreVertical,
  PackageCheck,
  Pencil,
  Phone,
  Plus,
  Power,
  Radio,
  RefreshCw,
  Save,
  Server,
  Settings,
  ShieldCheck,
  Trash2,
  Twitter,
  Upload,
  User,
  Users,
  Wallet,
  Wifi,
  X,
} from "lucide-react";
import { useToast } from "./toast/ToastProvider";
import { useClientRoute, navigateClient, type ClientRouteName } from "./routing/useClientRoute";
import { consumePendingOrder, hasClientToken, savePendingOrder, startHostingOrder } from "./routing/pendingOrder";

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
  is_active: boolean;
  sort_order: number;
  internal_notes?: string;
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
  | "clients"
  | "products"
  | "orders"
  | "services"
  | "invoices"
  | "payments"
  | "support"
  | "provisioning"
  | "ispconfigMappings"
  | "auditLogs";

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
  { label: "Home", href: "#home" },
];

const staticNavGroups = [
  {
    label: "Solutions",
    items: [
      { label: "Services", href: "#services" },
      { label: "Hosting", href: "#hosting" },
      { label: "AI Solutions", href: "#ai" },
    ],
  },
  {
    label: "Company",
    items: [
      { label: "About", href: "#about" },
      { label: "Portfolio", href: "#portfolio" },
      { label: "Process", href: "#process" },
      { label: "Contact", href: "#contact" },
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
  },
  {
    icon: Code2,
    title: "Custom Software",
    description:
      "Portals, dashboards, payment systems, registration platforms, CBT systems and more.",
  },
  {
    icon: Server,
    title: "Hosting & Domains",
    description:
      "Fast secure hosting, domain registration, SSL, backups and business email.",
  },
  {
    icon: Bot,
    title: "AI Solutions",
    description:
      "AI call assistants, customer support automation, lead capture and workflow tools.",
  },
  {
    icon: ShieldCheck,
    title: "Maintenance & Support",
    description:
      "Updates, security, backups and ongoing support so your business never stops.",
  },
];

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
    name: "Starter",
    slug: "starter",
    audience: "Perfect for small websites",
    monthly: "₦15,000",
    annual: "₦150,000",
    featured: false,
    features: ["1 website", "10GB SSD storage", "Unmetered bandwidth", "1 email account", "Free SSL certificate"],
  },
  {
    name: "Business",
    slug: "business",
    audience: "Great for growing businesses",
    monthly: "₦25,000",
    annual: "₦250,000",
    featured: true,
    features: ["Unlimited websites", "20GB SSD storage", "Unmetered bandwidth", "10 email accounts", "Free SSL certificate"],
  },
  {
    name: "Professional",
    slug: "professional",
    audience: "Advanced for professionals",
    monthly: "₦45,000",
    annual: "₦450,000",
    featured: false,
    features: ["Unlimited websites", "40GB SSD storage", "Unmetered bandwidth", "Unlimited email accounts", "Free SSL certificate"],
  },
  {
    name: "Managed",
    slug: "managed",
    audience: "For high performance needs",
    monthly: "₦85,000",
    annual: "₦850,000",
    featured: false,
    features: ["Unlimited everything", "80GB SSD storage", "Priority support", "Managed backups", "Free SSL certificate"],
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

const adminRenewals = [
  ["scholarjoint.com", "Hosting + Annual", "in 7 days", "₦25,000"],
  ["skinologist.org", "Hosting + Annual", "in 12 days", "₦25,000"],
  ["luminaryfm.com", "Hosting + Annual", "in 15 days", "₦25,000"],
  ["utme.com.ng", "Hosting + Annual", "in 18 days", "₦25,000"],
  ["rhm.com.ng", "Hosting + Annual", "in 20 days", "₦25,000"],
];

const adminPayments = [
  ["John Adewale", "INV-2026-0321", "Paid", "₦25,000", "Jun 22, 2026"],
  ["Chioma Okafor", "INV-2026-0320", "Paid", "₦48,000", "Jun 22, 2026"],
  ["Emeka Nwosu", "INV-2026-0319", "Paid", "₦23,000", "Jun 21, 2026"],
  ["Abiola Yusuf", "INV-2026-0318", "Failed", "₦25,000", "Jun 21, 2026"],
  ["Grace Ibukun", "INV-2026-0317", "Paid", "₦15,000", "Jun 20, 2026"],
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
    <a href="#home" className={`inline-flex items-center ${className}`} aria-label="NAITALK home">
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
                    onClick={item.label === "Logout" ? (event) => { event.preventDefault(); void handleLogout(); } : undefined}
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
          <a href="#contact" className="btn-primary">
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

      <AnimatePresence>
        {isOpen && (
          <motion.div
            className="fixed inset-0 z-50 bg-[#030505]/96 px-4 py-5 backdrop-blur-xl lg:hidden"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
          >
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
                        onClick={
                          item.label === "Logout"
                            ? (event) => { event.preventDefault(); void handleLogout(); }
                            : () => setIsOpen(false)
                        }
                        className="rounded-md border border-white/8 bg-black/20 px-3 py-3 text-sm font-extrabold uppercase text-white/78"
                      >
                        {item.label}
                      </a>
                    ))}
                  </div>
                </div>
              ))}
              <a href="#contact" onClick={() => setIsOpen(false)} className="btn-primary mt-3 justify-center">
                Start a project
                <ArrowRight className="h-4 w-4" />
              </a>
            </nav>
          </motion.div>
        )}
      </AnimatePresence>
    </header>
  );
}

function DeviceShowcase({ projects, logo }: { projects: Project[]; logo: LogoImage }) {
  const featured = projects.slice(0, 3);
  const heroImage = featured[0]?.img || "/data/skinologist.png";
  const phoneImage = featured[1]?.img || "/data/scholarjoint.png";
  const panelImage = featured[2]?.img || "/data/rhm.png";

  return (
    <div className="relative min-h-[420px] sm:min-h-[520px] lg:min-h-[560px]">
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
    <section id="home" className="hero-grid relative overflow-hidden pb-14 pt-28 sm:pb-18 lg:pt-32">
      <div className="mx-auto grid max-w-7xl items-center gap-10 px-4 sm:px-6 lg:grid-cols-[0.95fr_1.05fr] lg:px-8">
        <motion.div
          className="max-w-2xl"
          initial={{ opacity: 0, y: 24 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.65 }}
        >
          <span className="eyebrow">Elite digital engineering & AI solutions</span>
          <h1 className="mt-5 max-w-xl text-4xl font-black leading-[1.02] text-white sm:text-5xl lg:text-6xl">
            We build digital products that help businesses <span className="text-primary">grow.</span>
          </h1>
          <p className="mt-5 max-w-lg text-base leading-7 text-white/68 sm:text-lg">
            Websites, custom software, hosting infrastructure and AI solutions built for ambitious
            businesses and organisations.
          </p>
          <div className="mt-8 flex flex-col gap-3 sm:flex-row">
            <a href="#contact" className="btn-primary justify-center sm:justify-start">
              Start a project
              <ArrowRight className="h-4 w-4" />
            </a>
            <a href={whatsappUrl} className="btn-outline justify-center sm:justify-start">
              <MessageCircle className="h-4 w-4 text-[#25D366]" />
              Chat on WhatsApp
            </a>
          </div>
          <div className="mt-9 grid gap-4 sm:grid-cols-3">
            {[
              ["Modern & scalable", "Future-ready solutions"],
              ["Secure & reliable", "Built for performance"],
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
  return (
    <section className="border-y border-white/8 bg-white/[0.025] py-5">
      <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
        <p className="text-center text-[10px] font-black uppercase text-primary">
          Trusted by businesses, organisations & institutions
        </p>
        <div className="mt-5 grid grid-cols-2 items-center gap-5 text-center sm:grid-cols-3 lg:grid-cols-6">
          {clientLogos.map((logo) => (
            <div key={`${logo.name}-${logo.src}`} className="flex h-16 items-center justify-center rounded-lg border border-white/8 bg-white/[0.02] px-4">
              {logo.src ? (
                <img src={logo.src} alt={logo.alt || logo.name} className="max-h-10 w-full object-contain opacity-70" />
              ) : (
                <span className="text-xl font-black text-white/50 sm:text-2xl">{logo.name}</span>
              )}
            </div>
          ))}
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
              <a href="#contact" className="service-link mt-6 inline-flex items-center gap-2 text-xs font-black">
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
  const shown = projects.slice(0, 4);
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
          <a href="#contact" className="inline-flex items-center gap-2 text-sm font-black text-primary">
            View all projects
            <ArrowRight className="h-4 w-4" />
          </a>
        </div>
        <div className="mt-8 grid gap-5 sm:grid-cols-2 lg:grid-cols-4">
          {shown.map((project) => (
            <button
              key={project.title}
              type="button"
              className="project-card cursor-pointer text-left"
              onClick={() => setSelectedProject(project)}
              aria-label={`View details for ${project.title}`}
            >
              <img src={project.img} alt={`${project.title} project preview`} className="h-32 w-full rounded-md object-cover sm:h-36" />
              <div className="mt-5">
                <h3 className="text-lg font-black text-white">{project.title}</h3>
                <p className="mt-3 text-sm leading-6 text-white/60">{project.details.solution}</p>
                <span className="project-tag mt-5 inline-flex rounded-full border px-3 py-1 text-[11px] font-bold">
                  {project.category.split(",")[0].trim()}
                </span>
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
    let isMounted = true;

    laravelApi<Array<Record<string, unknown>>>("/api/v1/public/hosting-plans")
      .then((data) => {
        if (!isMounted || !Array.isArray(data) || !data.length) return;

        setPlans(
          data.map((plan) => ({
            name: String(plan.name || "Hosting Plan"),
            slug: String(plan.slug || ""),
            audience: String(plan.short_description || "Managed hosting package"),
            monthly: String(plan.monthly_price || "₦0"),
            annual: String(plan.annual_price || "₦0"),
            featured: Boolean(plan.is_featured),
            features: [
              String(plan.storage_allocation || "SSD storage"),
              String(plan.bandwidth_policy || "Bandwidth included"),
              `${Number(plan.websites || 0) || "Multiple"} website${Number(plan.websites || 0) === 1 ? "" : "s"}`,
              `${Number(plan.email_accounts || 0) || "Multiple"} email account${Number(plan.email_accounts || 0) === 1 ? "" : "s"}`,
              plan.backup_frequency ? `${String(plan.backup_frequency)} backups` : "Backup support",
              `${String(plan.support_tier || "Standard")} support`,
            ],
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
            <span className="eyebrow">Managed hosting</span>
            <h2 className="mt-4 text-4xl font-black leading-tight text-white sm:text-5xl">
              Reliable Hosting <span className="section-title-gradient">Built for Growth</span>
            </h2>
            <p className="mt-5 text-sm leading-7 text-white/66 sm:text-base">
              Fast, secure and scalable hosting for websites with 24/7 support you can trust.
              Packages include SSL, backups where applicable, email hosting and migration support.
            </p>
            <div className="mt-5 grid gap-2 text-sm text-white/74 sm:grid-cols-2">
              {["99.9% uptime guarantee", "Free SSL certificate", "Daily backups", "24/7 expert support"].map((item) => (
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
          <div className="text-center">
            <h3 className="text-3xl font-black text-white">Simple, Transparent Pricing</h3>
            <p className="mt-3 text-sm text-white/58">Choose the perfect hosting plan for your needs.</p>
          </div>
          <div className="mt-8 grid gap-4 lg:grid-cols-4">
            {plans.map((plan) => (
              <article key={plan.name} className={plan.featured ? "hosting-plan featured" : "hosting-plan"}>
                {plan.featured && <span className="hosting-badge">Most popular</span>}
                <h4 className="text-xl font-black text-white">{plan.name}</h4>
                <p className="mt-2 min-h-10 text-sm text-white/58">{plan.audience}</p>
                <div className="mt-6 flex items-end gap-1">
                  <span className="text-3xl font-black text-white">{plan.monthly}</span>
                  <span className="pb-1 text-xs text-white/48">/mo</span>
                </div>
                <p className="mt-1 text-xs text-primary">{plan.annual} yearly</p>
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
                  onClick={() => startHostingOrder(plan.slug)}
                  className={plan.featured ? "btn-primary mt-7 w-full justify-center" : "btn-outline mt-7 w-full justify-center"}
                >
                  Choose plan
                </button>
              </article>
            ))}
          </div>
        </div>
      </div>
    </section>
  );
}

function AdminDashboardOverview({ data, isLoading }: { data: AdminDashboardSnapshot | null; isLoading: boolean }) {
  const dashboardMetrics = data?.metrics?.length
    ? data.metrics.map((metric, index) => ({
        ...metric,
        delta: metric.amount || (typeof metric.raw === "number" ? `${metric.raw}` : "Live"),
        icon: adminMetrics[index]?.icon || BarChart3,
        tone: adminMetrics[index]?.tone || "lime",
      }))
    : adminMetrics;
  const renewals = data?.upcoming_renewals?.length ? data.upcoming_renewals : null;
  const payments = data?.recent_payments?.length ? data.recent_payments : null;
  const invoices = data?.invoice_overview?.length ? data.invoice_overview : null;
  const topServices = data?.top_services?.length ? data.top_services : null;
  const systemStatus = data?.system_status?.length ? data.system_status : null;
  const recentOrders = data?.recent_orders?.length ? data.recent_orders : null;

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
          return (
            <article key={metric.label} className={`metric-card tone-${metric.tone}`}>
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
                <small>{renewal.renews_at || "No date"}</small>
                <strong>{renewal.status}</strong>
              </div>
            )) : adminRenewals.map(([name, type, due, amount]) => (
              <div key={name} className="data-row">
                <div className="row-icon"><Globe2 className="h-4 w-4" /></div>
                <div className="min-w-0 flex-1">
                  <p>{name}</p>
                  <small>{type}</small>
                </div>
                <small>{due}</small>
                <strong>{amount}</strong>
              </div>
            ))}
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
                  <small className="block">{payment.paid_at || ""}</small>
                </div>
              </div>
            )) : adminPayments.map(([name, invoice, status, amount, date]) => (
              <div key={invoice} className="data-row">
                <div className="avatar-initial">{name.charAt(0)}</div>
                <div className="min-w-0 flex-1">
                  <p>{name}</p>
                  <small>{invoice}</small>
                </div>
                <span className={status === "Paid" ? "status-pill paid" : "status-pill failed"}>{status}</span>
                <div className="text-right">
                  <strong>{amount}</strong>
                  <small className="block">{date}</small>
                </div>
              </div>
            ))}
          </div>
        </article>
      </div>

      <div className="grid gap-5 xl:grid-cols-[0.9fr_1fr_1.1fr]">
        <article className="dashboard-card">
          <h3>Invoices Overview</h3>
          <div className="donut-wrap">
            <div className="donut-chart"><span>342<small>Total</small></span></div>
            <div className="grid gap-2 text-sm text-white/64">
              {invoices ? invoices.map((item) => (
                <p key={item.status}>{item.status}: {item.count}</p>
              )) : ["Paid 196 (57%)", "Unpaid 74 (22%)", "Overdue 18 (5%)", "Partially Paid 32 (9%)"].map((item) => (
                <p key={item}>{item}</p>
              ))}
            </div>
          </div>
        </article>
        <article className="dashboard-card">
          <h3>Top Services</h3>
          <div className="mt-5 grid gap-4">
            {(topServices || ["Web Hosting", "Professional Email", "SSL Certificates", "Website Maintenance", "Dedicated Hosting"].map((name, index) => ({ name, count: 156 - index * 24 }))).map((service, index) => (
              <div key={service.name} className="service-meter">
                <span>{service.name}</span>
                <div><i style={{ width: `${Math.max(18, 88 - index * 14)}%` }} /></div>
                <strong>{service.count}</strong>
              </div>
            ))}
          </div>
        </article>
        <article className="dashboard-card">
          <h3>System Status</h3>
          <div className="mt-5 grid gap-4">
            {(systemStatus || ["ISPConfig Connection", "Mail Server", "Queue Workers", "Scheduled Tasks", "Backup Service"].map((name) => ({ name, status: "active" }))).map((item) => (
              <div key={item.name} className="system-row">
                <span>{item.name}</span>
                <strong>{item.status}</strong>
              </div>
            ))}
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
                <td>{order.created_at}</td>
                <td><MoreVertical className="h-4 w-4" /></td>
              </tr>
            )) : adminPayments.map(([name, invoice, status, amount, date], index) => (
              <tr key={invoice}>
                <td>ORD-2026-0{162 - index}</td>
                <td>{name}</td>
                <td>{index % 2 ? "Web Hosting (Starter) + Email" : "Web Hosting (Business)"}</td>
                <td>{amount}</td>
                <td><span className={status === "Paid" ? "status-pill paid" : "status-pill pending"}>{status === "Paid" ? "Completed" : "Pending"}</span></td>
                <td>{date}</td>
                <td><MoreVertical className="h-4 w-4" /></td>
              </tr>
            ))}
          </tbody>
        </table>
      </article>
    </section>
  );
}

function AdminRecordsSection({
  title,
  description,
  records,
  isLoading,
  renderRowActions,
}: {
  title: string;
  description: string;
  records: LaravelPage | null;
  isLoading: boolean;
  renderRowActions?: (row: Record<string, unknown>) => React.ReactNode;
}) {
  const rows = records?.data || [];
  const columns = rows[0] ? Object.keys(rows[0]).filter((key) => !["links", "meta"].includes(key)).slice(0, 7) : [];

  const renderValue = (value: unknown): string => {
    if (value === null || value === undefined) return "";
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
          {records?.meta?.total ?? rows.length} records
        </span>
      </div>

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
                {renderRowActions && <th></th>}
              </tr>
            </thead>
            <tbody>
              {rows.map((row, index) => (
                <tr key={String((row as Record<string, unknown>).id || index)}>
                  {columns.map((column) => (
                    <td key={column}>{renderValue((row as Record<string, unknown>)[column])}</td>
                  ))}
                  {renderRowActions && <td>{renderRowActions(row as Record<string, unknown>)}</td>}
                </tr>
              ))}
            </tbody>
          </table>
        ) : (
          <div className="rounded-lg border border-white/10 bg-black/20 p-6 text-sm font-bold text-white/60">No records found.</div>
        )}
      </div>
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
};

const portalNavLinks = [
  { icon: Home, label: "Dashboard", route: "dashboard" as ClientRouteName, path: "/client/dashboard" },
  { icon: PackageCheck, label: "Services Catalog", route: "services-catalog" as ClientRouteName, path: "/client/services/catalog" },
  { icon: FileText, label: "My Orders", route: "orders" as ClientRouteName, path: "/client/orders" },
  { icon: User, label: "My Profile", route: null, path: null },
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
  onProfileClick: () => void;
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
              className={route === item.route ? "portal-nav active" : item.label === "My Profile" ? "portal-nav disabled" : "portal-nav"}
              onClick={() => {
                setIsMobileNavOpen(false);
                if (item.label === "Logout") {
                  onLogout();
                } else if (item.label === "Support Tickets") {
                  window.open(whatsappUrl, "_blank", "noopener,noreferrer");
                } else if (item.label === "My Profile") {
                  onProfileClick();
                } else if (item.path) {
                  navigate(item.path);
                }
              }}
            >
              {React.createElement(item.icon, { className: "h-4 w-4" })}
              {item.label}
              {item.label === "My Profile" && <span className="portal-nav-soon">Soon</span>}
            </button>
          ))}
        </nav>
      </aside>

      <main className="portal-main">
        {!hideWelcomeHeader && (
          <header className="portal-header">
            <div>
              <h1>Welcome back, {dashboard.client.name}</h1>
              <p>Here is an overview of your services and account.</p>
            </div>
            <div className="flex items-center gap-3">
              <Bell className="h-5 w-5 text-primary" />
              <div className="avatar-initial">{dashboard.client.name.split(" ").map((part) => part[0]).join("").slice(0, 2)}</div>
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
            <strong>{overview.renews_at || "—"}</strong>
          </div>
          <div>
            <span>Service ID</span>
            <strong>SRV-{serviceId}</strong>
          </div>
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
          [Users, "FTP Accounts", usage?.ftp_accounts_used ?? 0, usage?.ftp_accounts_limit ?? 0, ""],
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
            ["ftp", Users, "FTP"],
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
                <p className="mt-3 text-sm text-white/40">This package does not include email, database, or FTP management.</p>
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
                          <td className="text-white/40">{mailbox.last_synced_at ? new Date(mailbox.last_synced_at).toLocaleString() : "Pending"}</td>
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
                          <td className="text-white/40">{database.last_synced_at ? new Date(database.last_synced_at).toLocaleString() : "Pending"}</td>
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
                  <h2>FTP Accounts</h2>
                  <p className="mt-1 text-sm text-white/48">
                    Manage file transfer access. Root/server credentials are never exposed here.
                    {ftpAccounts?.serverHostname && (
                      <> Connect using host <strong className="text-white">{ftpAccounts.serverHostname}</strong>.</>
                    )}
                  </p>
                  <p className="mt-1 text-xs text-white/35">Need SSH/SFTP access instead? That's enabled per website — contact support.</p>
                </div>
                {capabilities.ftp_sftp_enabled && (
                  <button type="button" className="btn-primary" onClick={() => setModal({ type: "create-ftp" })}>
                    <Plus className="h-4 w-4" />
                    Create Account
                  </button>
                )}
              </div>
              {!capabilities.ftp_sftp_enabled ? (
                <p className="mt-4 text-sm text-white/40">FTP access is not included in this hosting package.</p>
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
                          <td className="text-white/40">{account.last_synced_at ? new Date(account.last_synced_at).toLocaleString() : "Pending"}</td>
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
                  {ftpAccounts?.items.length === 0 && <p className="mt-4 text-sm text-white/40">No FTP accounts yet.</p>}
                </div>
              )}
            </div>
          )}

          {tab === "access" && (
            <div>
              <h2>Access Details</h2>
              <p className="mt-3 text-sm text-white/54">
                For security, server-level and ISPConfig administrative credentials are never shown in the client portal. Use the actions in the
                Email Accounts, Databases, and FTP tabs above to manage access for this service.
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
            <div className="hosting-summary-row"><span>FTP Accounts</span><strong>{usage?.ftp_accounts_used ?? 0} / {usage?.ftp_accounts_limit ?? 0}</strong></div>
            <div className="hosting-summary-row"><span>Last Synced</span><strong>{overview.last_synced_at ? new Date(overview.last_synced_at).toLocaleString() : "Never"}</strong></div>
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
                onCreateFtp={(payload) => void runAction(`${base}/ftp-accounts`, { method: "POST", body: JSON.stringify(payload) }, "FTP account creation requested.")}
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
  subtotal: string;
  discount: string;
  tax: string;
  total: string;
  amount_paid: string;
  balance_due: string;
  bank_transfer: { bank_name: string; account_name: string; account_number: string };
  bank_transfer_status: string | null;
  bank_transfer_rejection_reason: string | null;
};

function ClientInvoicePage({
  orderNumber,
  token,
  navigate,
  toast,
  isInitiatingPayment,
  bankTransferInfo,
  onPayWithGateway,
  onPayByBankTransfer,
  onResetBankTransfer,
}: {
  orderNumber: string;
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

  const loadInvoice = React.useCallback(() => {
    setIsLoading(true);
    return laravelApi<ClientInvoiceDetail>(`/api/v1/client/orders/${orderNumber}/invoice`, token)
      .then(setInvoice)
      .catch((error) => toast.push({ type: "error", message: error instanceof Error ? error.message : "Could not load this invoice." }))
      .finally(() => setIsLoading(false));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [orderNumber, token]);

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
      const response = await fetch(`${LARAVEL_API_BASE_URL}/api/v1/client/orders/${orderNumber}/invoice/download`, {
        headers: { Authorization: `Bearer ${token}`, Accept: "application/pdf" },
      });

      if (!response.ok) throw new Error("Could not download this invoice.");

      const blob = await response.blob();
      const url = URL.createObjectURL(blob);
      const link = document.createElement("a");
      link.href = url;
      link.download = `invoice-${invoice?.invoice_number || orderNumber}.pdf`;
      link.click();
      URL.revokeObjectURL(url);
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
            <p className="mt-1 text-sm font-bold text-white">{invoice.issued_at || "—"}</p>
          </div>
          <div>
            <p className="text-[10px] font-black uppercase text-white/40">Due Date</p>
            <p className="mt-1 text-sm font-bold text-white">{invoice.due_at || "—"}</p>
          </div>
          <div>
            <p className="text-[10px] font-black uppercase text-white/40">Status</p>
            <span className={isPaid ? "status-pill paid mt-1 inline-flex" : "status-pill failed mt-1 inline-flex"}>{invoice.status}</span>
          </div>
          {invoice.paid_at && (
            <div>
              <p className="text-[10px] font-black uppercase text-white/40">Paid Date</p>
              <p className="mt-1 text-sm font-bold text-white">{invoice.paid_at}</p>
            </div>
          )}
        </div>

        {!isPaid && (
          <div className="relative border-b border-white/10 p-6">
            {hasDismissedBankTransfer || (!bankTransferInfo && !invoice.bank_transfer_status) ? (
              <div className="sm:max-w-sm">
                <p className="text-xs font-black uppercase text-white/50">Choose how to pay</p>
                <div className="mt-3 grid gap-2">
                  <button
                    type="button"
                    className="btn-primary justify-center !min-h-9 !px-3 !py-1.5 !text-[11px]"
                    disabled={isInitiatingPayment}
                    onClick={() => void onPayWithGateway(invoice.invoice_number, "paystack")}
                  >
                    Pay with Paystack
                  </button>
                  <button
                    type="button"
                    className="btn-primary justify-center !min-h-9 !px-3 !py-1.5 !text-[11px]"
                    disabled={isInitiatingPayment}
                    onClick={() => void onPayWithGateway(invoice.invoice_number, "flutterwave")}
                  >
                    Pay with Flutterwave
                  </button>
                  <button
                    type="button"
                    className="btn-outline justify-center !min-h-9 !px-3 !py-1.5 !text-[11px]"
                    disabled={isInitiatingPayment}
                    onClick={() => {
                      setHasDismissedBankTransfer(false);
                      void onPayByBankTransfer(invoice.invoice_number);
                    }}
                  >
                    Pay by Bank Transfer / Upload Proof
                  </button>
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
            <div className="mt-2 flex items-center justify-between"><span className="text-white/60">VAT (7.5%)</span><strong className="text-white">{invoice.tax}</strong></div>
            <div className="mt-3 flex items-center justify-between border-t border-primary/25 pt-3"><span className="font-black text-white">Total</span><strong className="text-lg text-primary">{invoice.total}</strong></div>
            <div className="mt-2 flex items-center justify-between"><span className="text-white/60">Amount Paid</span><strong className="text-white">{invoice.amount_paid}</strong></div>
            <div className="mt-2 flex items-center justify-between"><span className="font-black text-white">Balance Due</span><strong className="text-white">{invoice.balance_due}</strong></div>
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
        <h3 className="text-lg font-black text-white">Create FTP Account</h3>
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
  const { route, search, hostingServiceId, orderNumber, navigate } = useClientRoute();
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
  const [hostingPlans, setHostingPlans] = useState<HostingPlanCard[]>(fallbackHostingPlans);
  const [addOns, setAddOns] = useState<Array<{ name: string; slug: string; monthly_price: string; annual_price: string }>>([]);
  const [orderDraft, setOrderDraft] = useState(INITIAL_ORDER_DRAFT);
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
    } else if (paymentStatus === "failed") {
      toast.push({ type: "error", message: "Payment verification failed. Please try again or contact support." });
    } else if (paymentStatus === "not_found") {
      toast.push({ type: "error", message: "We could not find that payment. Please try again or contact support." });
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

    Promise.all([
      laravelApi<Array<Record<string, unknown>>>("/api/v1/public/hosting-plans"),
      laravelApi<Array<Record<string, unknown>>>("/api/v1/public/hosting-add-ons"),
    ])
      .then(([plans, planAddOns]) => {
        if (Array.isArray(plans) && plans.length) {
          const mapped = plans.map((plan) => ({
            name: String(plan.name || "Hosting Plan"),
            slug: String(plan.slug || ""),
            audience: String(plan.short_description || "Managed hosting package"),
            monthly: String(plan.monthly_price || "₦0"),
            annual: String(plan.annual_price || "₦0"),
            featured: Boolean(plan.is_featured),
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
      .catch(() => setHostingPlans(fallbackHostingPlans));
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
        onProfileClick={() => toast.push({ type: "info", message: "Account settings are coming soon." })}
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
        onProfileClick={() => toast.push({ type: "info", message: "Account settings are coming soon." })}
      >
        <section>
          <h2 className="text-2xl font-black text-white">Explore NAI TALK Services</h2>
          <p className="mt-2 text-sm text-white/58">Hosting, websites, maintenance, AI solutions and add-ons — order directly from your account.</p>
          <div className="mt-6 grid gap-4 md:grid-cols-2 xl:grid-cols-3">
            {(catalog || []).map((item) => (
              <article key={item.slug} className="portal-card">
                <span className="hosting-badge !static !ml-0 mb-2 inline-flex w-fit">{item.category.replace("_", " ")}</span>
                <h3 className="text-lg font-black text-white">{item.name}</h3>
                <p className="mt-2 text-sm text-white/58">{item.short_description}</p>
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
                <p className="mt-4 text-xl font-black text-primary">
                  {item.starting_price ? `From ${item.starting_price}` : "Custom quote"}
                  <span className="ml-1 text-xs font-bold text-white/45">{item.billing_type.replace("_", " ")}</span>
                </p>
                <div className="mt-4 flex flex-wrap gap-2">
                  {!item.is_quote_only && item.order_route && (
                    <button type="button" className="btn-primary justify-center" onClick={() => navigate(item.order_route!)}>
                      Order Now
                    </button>
                  )}
                  {item.is_quote_only && (
                    <button
                      type="button"
                      className="btn-primary justify-center"
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
            ))}
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
        onProfileClick={() => toast.push({ type: "info", message: "Account settings are coming soon." })}
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
    const orderTotal = planAmount + addOnsAmount;

    if (route === "order-hosting") {
      return (
        <ClientPortalShell
        dashboard={dashboard}
        route={route}
        isVerified={isVerified}
        navigate={navigate}
        onLogout={() => void handleClientLogout()}
        onProfileClick={() => toast.push({ type: "info", message: "Account settings are coming soon." })}
      >
          <section className="grid gap-5 lg:grid-cols-[1fr_320px]">
            <div className="portal-card">
              <label className="admin-field">
                <span>Primary domain (optional)</span>
                <input
                  value={orderDraft.primary_domain}
                  onChange={(event) => setOrderDraft((current) => ({ ...current, primary_domain: event.target.value }))}
                  placeholder="yourbusiness.com"
                />
              </label>

              <h2 className="mt-6 text-xl font-black text-white">Choose your hosting plan</h2>
              <div className="mt-5 grid gap-3">
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
                      <p>{plan.name}</p>
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

              <label className="mt-6 flex items-center gap-2 text-sm font-bold text-white/68">
                <input
                  type="checkbox"
                  className="h-4 w-4"
                  checked={orderDraft.auto_renew}
                  onChange={(event) => setOrderDraft((current) => ({ ...current, auto_renew: event.target.checked }))}
                />
                Enable auto-renewal
              </label>
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
              <div className="mt-4 flex items-center justify-between border-t border-white/10 pt-4">
                <span className="text-sm font-bold text-white/68">Total</span>
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
        onProfileClick={() => toast.push({ type: "info", message: "Account settings are coming soon." })}
      >
          <section className="mx-auto grid max-w-2xl gap-5">
            <div className="portal-card">
              <h2 className="text-xl font-black text-white">Review your order</h2>
              <div className="mt-5 grid gap-3 text-sm text-white/72">
                <p><strong className="text-white">Domain:</strong> {orderDraft.primary_domain || "Not set"}</p>
                <p><strong className="text-white">Plan:</strong> {selectedPlan?.name || "—"}</p>
                <p><strong className="text-white">Billing cycle:</strong> {orderDraft.billing_cycle}</p>
                <p>
                  <strong className="text-white">Add-ons:</strong>{" "}
                  {selectedAddOns.length ? selectedAddOns.map((addOn) => addOn.name).join(", ") : "None"}
                </p>
                <p><strong className="text-white">Auto-renew:</strong> {orderDraft.auto_renew ? "Enabled" : "Disabled"}</p>
                <p><strong className="text-white">Total:</strong> {formatNaira(orderTotal)}</p>
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
        onProfileClick={() => toast.push({ type: "info", message: "Account settings are coming soon." })}
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
              <div className="mt-5 grid gap-2 sm:grid-cols-2">
                <button
                  type="button"
                  className="btn-primary justify-center !min-h-9 !py-1.5 !text-[11px]"
                  disabled={isInitiatingPayment}
                  onClick={() => void handlePayWithGateway(checkoutResult.invoice.invoice_number, "paystack")}
                >
                  Pay with Paystack
                </button>
                <button
                  type="button"
                  className="btn-primary justify-center !min-h-9 !py-1.5 !text-[11px]"
                  disabled={isInitiatingPayment}
                  onClick={() => void handlePayWithGateway(checkoutResult.invoice.invoice_number, "flutterwave")}
                >
                  Pay with Flutterwave
                </button>
                <button
                  type="button"
                  className="btn-outline justify-center !min-h-9 !py-1.5 !text-[11px]"
                  disabled={isInitiatingPayment}
                  onClick={() => void handlePayByBankTransfer(checkoutResult.invoice.invoice_number)}
                >
                  Pay by Bank Transfer
                </button>
                <button type="button" className="btn-outline justify-center !min-h-9 !py-1.5 !text-[11px]" onClick={() => navigate("/client/orders")}>
                  Pay Later
                </button>
              </div>
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
        onProfileClick={() => toast.push({ type: "info", message: "Account settings are coming soon." })}
        hideWelcomeHeader
      >
        <HostingManagePanel serviceId={hostingServiceId} token={clientToken} navigate={navigate} toast={toast} />
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
        onProfileClick={() => toast.push({ type: "info", message: "Account settings are coming soon." })}
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

  if (route === "orders") {
    return (
      <ClientPortalShell
        dashboard={dashboard}
        route={route}
        isVerified={isVerified}
        navigate={navigate}
        onLogout={() => void handleClientLogout()}
        onProfileClick={() => toast.push({ type: "info", message: "Account settings are coming soon." })}
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
        onProfileClick={() => toast.push({ type: "info", message: "Account settings are coming soon." })}
      >
      {dashboard.empty_state ? (
        <section className="portal-card mx-auto max-w-xl text-center">
          <h2 className="text-xl font-black text-white">Welcome to NAI TALK</h2>
          <p className="mt-3 text-sm text-white/60">{dashboard.empty_state.title}</p>
          <p className="mt-1 text-sm text-white/60">
            Explore our hosting plans, request a website project, or speak with our team about a solution for your business.
          </p>
          <div className="mt-6 grid gap-3 sm:grid-cols-3">
            <button type="button" className="btn-primary justify-center" onClick={() => navigate("/client/order/hosting")}>
              Explore Hosting Plans
            </button>
            <button type="button" className="btn-outline justify-center" onClick={() => navigate("/client/services/catalog")}>
              Request a Website
            </button>
            <button type="button" className="btn-outline justify-center" onClick={() => (window.location.href = "/#contact")}>
              Contact NAI TALK
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
                  <small>{service.renews_at || "No date"}</small>
                  <strong>{service.service_number}</strong>
                </button>
              ))}
            </div>
          </section>
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
              <article className="rounded-lg border border-white/10 bg-white/[0.035] p-5" key={review.author_name}>
                <div className="mb-4 flex gap-1 text-primary" aria-label={`${review.rating} star rating`}>
                  {Array.from({ length: Math.min(review.rating || 5, 5) }).map((_, index) => (
                    <span key={index}>*</span>
                  ))}
                </div>
                <p className="text-sm leading-6 text-white/66">{review.text}</p>
                <div className="mt-5 text-sm font-black text-white">{review.author_name}</div>
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
      setFormData({ name: "", email: "", service: "Business Website", details: "" });
    } catch (error) {
      setStatus("error");
      setMessage(error instanceof Error ? error.message : "Message could not be sent.");
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
            <a href="#contact-form" className="btn-primary justify-center">
              Start a project
              <ArrowRight className="h-4 w-4" />
            </a>
            <a href={whatsappUrl} className="btn-outline justify-center">
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
              <a href="mailto:info@naitalk.com" className="contact-line">
                <Mail className="h-4 w-4 text-primary" />
                info@naitalk.com
              </a>
              <a href="tel:+2347087057654" className="contact-line">
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

function Footer({ logo }: { logo: LogoImage }) {
  return (
    <footer className="border-t border-white/10 py-8">
      <div className="mx-auto flex max-w-7xl flex-col gap-6 px-4 sm:px-6 lg:flex-row lg:items-center lg:justify-between lg:px-8">
        <div>
          <Logo logo={logo} />
          <p className="mt-3 text-xs text-white/48">© 2026 NAITALK. All rights reserved.</p>
        </div>
        <div className="flex flex-wrap gap-5 text-sm text-white/58">
          <a href="#services" className="hover:text-primary">Services</a>
          <a href="#portfolio" className="hover:text-primary">Projects</a>
          <a href="#hosting" className="hover:text-primary">Hosting</a>
          <a href="#contact" className="hover:text-primary">Contact</a>
        </div>
        <div className="flex gap-3">
          {[
            [Linkedin, "LinkedIn"],
            [Twitter, "X"],
            [Facebook, "Facebook"],
            [Radio, "Media"],
          ].map(([Icon, label]) => (
            <a
              key={label as string}
              href="#home"
              aria-label={label as string}
              className="flex h-10 w-10 items-center justify-center rounded-full border border-white/10 text-white/55 transition hover:border-primary/40 hover:text-primary"
            >
              {React.createElement(Icon as React.ComponentType<{ className?: string }>, { className: "h-4 w-4" })}
            </a>
          ))}
        </div>
      </div>
    </footer>
  );
}

function FloatingWhatsApp() {
  return (
    <a
      href={whatsappUrl}
      aria-label="Chat with NAITALK on WhatsApp"
      className="fixed bottom-5 right-5 z-40 flex h-14 w-14 items-center justify-center rounded-full bg-[#25D366] text-white shadow-[0_12px_40px_rgba(37,211,102,0.35)] transition hover:scale-105"
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
    storage_allocation: "10GB SSD",
    bandwidth_policy: "Unmetered bandwidth",
    websites: 1,
    databases: 1,
    email_accounts: 1,
    backup_frequency: "Weekly",
    support_tier: "standard",
    migration_included: false,
    is_featured: false,
    is_active: true,
    sort_order: 0,
    internal_notes: "",
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

function AdminApp() {
  const adminSections = [
    { id: "dashboard", label: "Dashboard", icon: BarChart3 },
    { id: "logo", label: "Logo", icon: ImageIcon },
    { id: "clientLogos", label: "Client Logos", icon: Users },
    { id: "portfolio", label: "Portfolio", icon: Eye },
    { id: "testimonials", label: "Reviews", icon: MessageCircle },
    { id: "pricing", label: "Pricing", icon: PackageCheck },
    { id: "clients", label: "Clients", icon: Users },
    { id: "products", label: "Products", icon: PackageCheck },
    { id: "orders", label: "Orders", icon: MoreVertical },
    { id: "services", label: "Services", icon: Server },
    { id: "invoices", label: "Invoices", icon: FileText },
    { id: "payments", label: "Payments", icon: CreditCard },
    { id: "support", label: "Support", icon: MessageCircle },
    { id: "provisioning", label: "Provisioning", icon: Settings },
    { id: "ispconfigMappings", label: "ISPConfig", icon: Server },
    { id: "auditLogs", label: "Audit Logs", icon: ShieldCheck },
  ] as const;
  type AdminSectionId = (typeof adminSections)[number]["id"];

  const [isAuthenticated, setIsAuthenticated] = useState(false);
  const [isBooting, setIsBooting] = useState(true);
  const [isSaving, setIsSaving] = useState(false);
  const [isUploading, setIsUploading] = useState("");
  const [message, setMessage] = useState("");
  const [login, setLogin] = useState({ username: "", password: "" });
  const [content, setContent] = useState<SiteContent>(fallbackSiteContent);
  const [activeSection, setActiveSection] = useState<AdminSectionId>(() => {
    const requestedSection = new URLSearchParams(window.location.search).get("section");
    return (adminSections.some((section) => section.id === requestedSection) ? requestedSection : "dashboard") as AdminSectionId;
  });
  const [adminToken, setAdminToken] = useState(() => sessionStorage.getItem("naitalk_laravel_admin_token") || "");
  const [dashboardData, setDashboardData] = useState<AdminDashboardSnapshot | null>(null);
  const [isDashboardLoading, setIsDashboardLoading] = useState(false);
  const [adminRecords, setAdminRecords] = useState<Partial<Record<AdminRecordsSectionId, LaravelPage>>>({});
  const [loadingRecords, setLoadingRecords] = useState<Partial<Record<AdminRecordsSectionId, boolean>>>({});
  const [pricingPackages, setPricingPackages] = useState<PricingPackage[]>([]);
  const [isPricingLoading, setIsPricingLoading] = useState(false);
  const [retryingServiceId, setRetryingServiceId] = useState<number | null>(null);

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
    clients: "/api/v1/admin/clients",
    products: "/api/v1/admin/products",
    orders: "/api/v1/admin/orders",
    services: "/api/v1/admin/services",
    invoices: "/api/v1/admin/invoices",
    payments: "/api/v1/admin/payments",
    support: "/api/v1/admin/support-tickets",
    provisioning: "/api/v1/admin/provisioning-logs",
    ispconfigMappings: "/api/v1/admin/ispconfig-client-mappings",
    auditLogs: "/api/v1/admin/audit-logs",
  };

  const adminRecordLabels: Record<AdminRecordsSectionId, { title: string; description: string }> = {
    clients: { title: "Clients", description: "Laravel client accounts and billing profiles." },
    products: { title: "Products & Pricing", description: "Hosting plans configured in the Laravel billing engine." },
    orders: { title: "Orders", description: "Commercial hosting orders created through checkout." },
    services: { title: "Hosting Services", description: "Customer hosting services and lifecycle statuses." },
    invoices: { title: "Invoices", description: "Issued invoices, balances, due dates and payment status." },
    payments: { title: "Payments", description: "Paystack and Flutterwave payment records." },
    support: { title: "Support Tickets", description: "Client support tickets attached to accounts and services." },
    provisioning: { title: "Provisioning Logs", description: "ISPConfig provisioning queue and execution history." },
    ispconfigMappings: { title: "ISPConfig Mappings", description: "Stored Laravel-to-ISPConfig client mappings and sync status." },
    auditLogs: { title: "Audit Logs", description: "Staff lifecycle actions, state changes and internal reasons." },
  };

  const isRecordSection = (section: AdminSectionId): section is AdminRecordsSectionId =>
    Object.prototype.hasOwnProperty.call(adminRecordEndpoints, section);

  const loadAdminRecords = async (section: AdminRecordsSectionId, token = adminToken, force = false) => {
    if (!token || (adminRecords[section] && !force)) return;
    setLoadingRecords((current) => ({ ...current, [section]: true }));

    try {
      const data = await laravelApi<LaravelPage>(adminRecordEndpoints[section], token);
      setAdminRecords((current) => ({ ...current, [section]: data }));
    } catch (error) {
      setMessage(error instanceof Error ? error.message : `${adminRecordLabels[section].title} could not be loaded`);
    } finally {
      setLoadingRecords((current) => ({ ...current, [section]: false }));
    }
  };

  const retryServiceProvisioning = async (serviceId: number) => {
    setRetryingServiceId(serviceId);

    try {
      await laravelApi(`/api/v1/admin/services/${serviceId}/retry-provisioning`, adminToken, {
        method: "POST",
        body: JSON.stringify({ reason: "Retried from admin services panel" }),
      });
      await loadAdminRecords("services", adminToken, true);
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
      await loadAdminRecords("payments", adminToken, true);
      await loadAdminRecords("services", adminToken, true);
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
      await loadAdminRecords("payments", adminToken, true);
    } catch (error) {
      setMessage(error instanceof Error ? error.message : "Rejecting payment failed");
    } finally {
      setApprovingPaymentId(null);
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
    if (isAuthenticated && activeSection === "pricing") {
      void loadPricingPackages();
    }
  }, [activeSection, isAuthenticated, adminToken]);

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

  return (
    <div className="min-h-screen bg-background text-white">
      <header className="sticky top-0 z-40 border-b border-white/10 bg-[#030505]/90 backdrop-blur-xl">
        <div className="mx-auto flex max-w-7xl flex-col gap-4 px-4 py-4 sm:flex-row sm:items-center sm:justify-between sm:px-6 lg:px-8">
          <div className="flex items-center gap-4">
            <Logo logo={content.brand.logo} />
            <div>
              <h1 className="text-xl font-black">Backend Manager</h1>
              <p className="text-xs font-bold uppercase text-white/45">Grouped content management</p>
            </div>
          </div>
          <div className="flex flex-col gap-3 sm:flex-row">
            <button type="button" className="btn-primary justify-center" onClick={saveContent} disabled={isSaving}>
              <Save className="h-4 w-4" />
              {isSaving ? "Saving..." : "Save changes"}
            </button>
            <button type="button" className="btn-outline justify-center" onClick={handleLogout}>
              <LogOut className="h-4 w-4" />
              Logout
            </button>
          </div>
        </div>
      </header>

      <main className="mx-auto grid max-w-7xl gap-6 px-4 py-8 sm:px-6 lg:px-8">
        {message && <p className={message.includes("saved") || message.includes("uploaded") ? "form-message success" : "form-message error"}>{message}</p>}

        <nav className="admin-section-nav" aria-label="Backend sections">
          {adminSections.map((section) => {
            const Icon = section.icon;
            return (
              <button
                key={section.id}
                type="button"
                className={activeSection === section.id ? "admin-section-tab active" : "admin-section-tab"}
                onClick={() => setActiveSection(section.id)}
              >
                <Icon className="h-4 w-4" />
                {section.label}
                {section.id === "payments" && Boolean(dashboardData?.pending_payment_reviews) && (
                  <span className="ml-1 inline-flex h-4 min-w-4 items-center justify-center rounded-full bg-primary px-1 text-[10px] font-black text-black">
                    {dashboardData?.pending_payment_reviews}
                  </span>
                )}
              </button>
            );
          })}
        </nav>

        {activeSection === "dashboard" && <AdminDashboardOverview data={dashboardData} isLoading={isDashboardLoading} />}

        {isRecordSection(activeSection) && (
          <AdminRecordsSection
            title={adminRecordLabels[activeSection].title}
            description={adminRecordLabels[activeSection].description}
            records={adminRecords[activeSection] || null}
            isLoading={Boolean(loadingRecords[activeSection])}
            renderRowActions={
              activeSection === "services"
                ? (row) =>
                    ["awaiting_provisioning", "provisioning_failed"].includes(String(row.provisioning_status)) ? (
                      <button
                        type="button"
                        className="btn-outline !min-h-9 !px-3 !py-1.5 !text-[10px]"
                        disabled={retryingServiceId === Number(row.id)}
                        onClick={() => void retryServiceProvisioning(Number(row.id))}
                      >
                        {retryingServiceId === Number(row.id) ? "Retrying..." : "Retry Provisioning"}
                      </button>
                    ) : null
                : activeSection === "payments"
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
                : undefined
            }
          />
        )}

        {activeSection === "pricing" && (
          <section className="admin-panel">
            <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
              <div>
                <h2 className="text-2xl font-black">Pricing Packages</h2>
                <p className="mt-1 text-sm text-white/55">Manage the Laravel hosting plans shown on the public website.</p>
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
                    <div className="mt-4 grid gap-4 md:grid-cols-3">
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
                    <div className="mt-5 flex flex-wrap gap-4">
                      <label className="admin-check">
                        <input
                          type="checkbox"
                          checked={plan.is_featured}
                          onChange={(event) => updatePricingPackage(index, { is_featured: event.target.checked })}
                        />
                        Featured
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
              <article key={`${logo.name}-${index}`} className="admin-card">
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
              <article key={`${project.title}-${index}`} className="admin-card">
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
        <Services />
        <Portfolio projects={projects} />
        <Process />
        <AiBand />
        <HostingSection />
        <Testimonials reviews={siteContent.reviews} />
        <Contact logo={siteContent.brand.logo} />
      </main>
      <Footer logo={siteContent.brand.logo} />
      <FloatingWhatsApp />
    </div>
  );
}

export default function App() {
  if (window.location.pathname.startsWith("/admin")) return <AdminApp />;
  if (window.location.pathname.startsWith("/client")) return <ClientPortal />;
  return <PublicSite />;
}
