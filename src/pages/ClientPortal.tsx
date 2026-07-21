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

export const INITIAL_LOGIN = { email: "", password: "" };
export const INITIAL_REGISTER = {
  name: "",
  email: "",
  phone: "",
  company_name: "",
  billing_address: "",
  password: "",
  password_confirmation: "",
};
export const INITIAL_ORDER_DRAFT = {
  plan_slug: "",
  billing_cycle: "annual" as "monthly" | "annual",
  add_ons: [] as string[],
  primary_domain: "",
  auto_renew: true,
  register_domain: false,
};

export const portalNavLinks = [
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

export function ClientPortalShell({
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


export type HostingManageOverview = {
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

export type HostingMailbox = {
  id: number;
  email_address: string;
  display_name: string | null;
  quota_mb: number;
  status: string;
  last_synced_at: string | null;
};

export type HostingDatabase = {
  id: number;
  database_name: string;
  username: string;
  status: string;
  last_synced_at: string | null;
};

export type HostingFtpAccount = {
  id: number;
  username: string;
  access_type: string;
  status: string;
  last_synced_at: string | null;
};

export type HostingTabName = "overview" | "email" | "databases" | "ftp" | "access";

export type HostingModalState =
  | null
  | { type: "create-mailbox" }
  | { type: "edit-mailbox"; id: number; label: string; display_name: string; quota_mb: number | null }
  | { type: "change-mailbox-password"; id: number; label: string }
  | { type: "create-database" }
  | { type: "reset-database-password"; id: number; label: string }
  | { type: "create-ftp" }
  | { type: "reset-ftp-password"; id: number; label: string }
  | { type: "confirm-delete"; kind: "mailboxes" | "databases" | "ftp-accounts"; id: number; label: string };


export function HostingManagePanel({
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


export type ClientInvoiceDetail = {
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

export type WalletSummary = {
  balance_kobo: number;
  balance: string;
  currency: string;
  status: string;
};

export type WalletTransactionRow = {
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

export type SavedPaymentMethodRow = {
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

export function trackInvoicePaymentSuccess(invoiceNumber: string, outstandingKobo: number, paymentMethod: string) {
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

export function PaymentOptionsPanel({
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

export function ClientInvoicePage({
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
  const [amountPaidNaira, setAmountPaidNaira] = useState("");

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

      // Optional -- only sent if the client filled it in, meaning they paid
      // less than the full outstanding balance. Left blank, the backend
      // defaults to the full outstanding amount (unchanged behaviour).
      const amountKobo = amountPaidNaira.trim() ? Math.round(parseNairaAmount(amountPaidNaira) * 100) : null;
      if (amountKobo && amountKobo > 0) {
        formData.append("amount_kobo", String(amountKobo));
      }

      const response = await fetch(`${LARAVEL_API_BASE_URL}/api/v1/client/invoices/${invoice.invoice_number}/pay/bank-transfer/proof`, {
        method: "POST",
        headers: { Authorization: `Bearer ${token}` },
        body: formData,
      });
      const payload = await response.json().catch(() => ({}));

      if (!response.ok) throw new Error(payload.message || "Could not upload your proof of payment.");

      toast.push({ type: "success", message: payload.message || "Proof of payment submitted." });
      setReceiptFile(null);
      setAmountPaidNaira("");
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
  const statusPillClass =
    invoice.status === "paid" ? "status-pill paid" : invoice.status === "partially_paid" ? "status-pill pending" : "status-pill failed";

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
            <span className={`${statusPillClass} mt-1 inline-flex`}>{invoice.status === "partially_paid" ? "Partially Paid" : invoice.status}</span>
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

                  <label htmlFor="amount-paid" className="mt-3 block text-[11px] font-bold text-white/60">
                    Amount you paid (only if less than the full amount above)
                  </label>
                  <input
                    id="amount-paid"
                    type="number"
                    min={0}
                    step="0.01"
                    inputMode="decimal"
                    placeholder={`Leave blank if you paid the full ${bankTransferInfo?.amount || invoice.total}`}
                    className="mt-1 w-full rounded-lg border border-white/10 bg-black/30 px-3 py-2 text-xs text-white outline-none focus:border-primary/50"
                    value={amountPaidNaira}
                    onChange={(event) => setAmountPaidNaira(event.target.value)}
                  />
                  <p className="mt-1 text-[10px] text-white/40">
                    If you send less than the full amount, the difference will stay as an outstanding balance on this invoice — we'll email you a confirmation either way.
                  </p>

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

export function ClientWalletPage({ token, toast }: { token: string; toast: ReturnType<typeof useToast> }) {
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

export function ClientPaymentMethodsPage({ token, toast }: { token: string; toast: ReturnType<typeof useToast> }) {
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

export type DomainSuggestion = {
  domain: string;
  tld: string;
  registration_price_kobo: number;
  renewal_price_kobo: number;
  currency: string;
};

export type DomainSearchResult = {
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

export type DomainCheckoutResult = {
  order: { order_number: string };
  invoice: { invoice_number: string; total_kobo: number; total?: string };
};

export function DomainSearchPage({
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

export function DomainOnlyCheckoutPage({
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

export function DomainTransferPage({
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

export type DomainRenewalHistoryEntry = {
  date: string | null;
  amount_kobo: number;
  status: string;
  invoice_number: string | null;
};

export type DomainRow = {
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

export function ClientDomainsPage({
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

export function DomainAddHostingPage({
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

export const INITIAL_DOMAIN_CONTACT = {
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

export function DomainContactProfilePage({ token, toast }: { token: string; toast: ReturnType<typeof useToast> }) {
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

export type ClientProfileData = {
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

export type ClientActivityItem = {
  type: string;
  description: string;
  location?: string | null;
  reference?: string;
  amount_kobo?: number;
  occurred_at: string | null;
};

export const ACTIVITY_ICONS: Record<string, LucideIcon> = {
  login: KeyRound,
  password_changed: CheckCircle2,
  two_factor_enabled: ShieldCheck,
  two_factor_disabled: ShieldCheck,
  payment: FileText,
};

export function ClientProfilePage({
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

export function HostingModalContent({
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

export function ClientPortal() {
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


