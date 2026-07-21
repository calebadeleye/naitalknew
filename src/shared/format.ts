import React, { useEffect, useMemo, useState } from "react";
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
import type { LogoImage, ClientLogo, Project, Review, SiteContent, HostingPlanCard, ServiceCatalogItem, ClientOrderSummary, BankTransferDetails, PricingPackage, AdminDashboardMetric, AdminDashboardSnapshot, ClientDashboardSnapshot, ClientAuthMode, LaravelPage, AdminRecordsSectionId } from "./types";
import { LARAVEL_API_BASE_URL, laravelApi } from "./api";
import { fallbackClientLogos, fallbackProjects, fallbackReviews, fallbackSiteContent, whatsappUrl } from "./siteDefaults";
import { Logo, Navbar, Footer, FloatingWhatsApp, SectionHeader, socialLinks, paymentBadges, footerColumns } from "./PublicLayout";
import { PublicPage, PublicBreadcrumbs, usePublicImage, MarketingHero, MarketingCtaBand, FaqAccordionItem, FaqAccordionGroup } from "./marketingWidgets";
import { goToDomainCheckout, DomainPromoBadge, TldPriceCard, DomainFeatureItem, DomainSearchBar, DomainSearchSection, DomainGlobeIllustration } from "./domainWidgets";
import type { DomainFeature, PublicTldPricingRow } from "./domainWidgets";

export function parseNairaAmount(value: string | undefined): number {
  if (!value) return 0;
  return Number(value.replace(/[^0-9.]/g, "")) || 0;
}

export function formatNaira(value: number): string {
  return `₦${Math.round(value).toLocaleString()}`;
}

export const catalogCategoryIcons: Record<string, React.ComponentType<{ className?: string }>> = {
  hosting: Server,
  add_on: Settings,
  web_development: Code2,
  maintenance: ShieldCheck,
  ai: Bot,
  email_addon: Mail,
};

export function catalogCategoryIcon(category: string): React.ComponentType<{ className?: string }> {
  return catalogCategoryIcons[category] || PackageCheck;
}

export function formatKobo(kobo: number | null | undefined): string {
  if (kobo === null || kobo === undefined) return "—";
  return `₦${Math.round(kobo / 100).toLocaleString()}`;
}

/** Laravel serializes date-cast fields as full ISO datetimes (e.g. "2027-06-26T00:00:00.000000Z") — show just the date part. */
export const ISO_DATE_PATTERN = /^\d{4}-\d{2}-\d{2}/;

/** ISO "YYYY-MM-DD" — required for native <input type="date"> values. */
export function toDateInputValue(value: string | null | undefined): string {
  if (!value) return "";
  return value.slice(0, 10);
}

/** House style: every date in the app displays as dd/mm/yyyy, including ISPConfig-derived dates. */
export function formatDate(value: string | null | undefined): string {
  if (!value) return "—";
  const [year, month, day] = value.slice(0, 10).split("-");
  if (!year || !month || !day) return value;
  return `${day}/${month}/${year}`;
}

/** dd/mm/yyyy, HH:MM — for timestamps where the time also matters (audit logs, sync status...). */
export function formatDateTime(value: string | null | undefined): string {
  if (!value) return "—";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return formatDate(value);
  const day = String(date.getDate()).padStart(2, "0");
  const month = String(date.getMonth() + 1).padStart(2, "0");
  const hours = String(date.getHours()).padStart(2, "0");
  const minutes = String(date.getMinutes()).padStart(2, "0");
  return `${day}/${month}/${date.getFullYear()}, ${hours}:${minutes}`;
}

export const ACCOUNT_TYPE_LABELS: Record<string, string> = {
  imported_legacy_client: "Legacy Client",
  registered_user: "Registered User",
  billing_client: "Billing Client",
  hosting_client: "Hosting Client",
  prospect: "Prospect",
  new_customer: "New Customer",
  manual_admin_created: "Manually Added",
  website_care_customer: "Website Care Customer",
};

export function accountTypeLabel(value: string | null | undefined): string {
  if (!value) return "—";
  return ACCOUNT_TYPE_LABELS[value] || value.replace(/_/g, " ").replace(/\b\w/g, (letter) => letter.toUpperCase());
}

export function clientStatusPillClass(status: string | null | undefined): string {
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

export function hostingStatusPillClass(status: string): string {
  if (["active", "completed", "provisioned"].includes(status)) return "status-pill paid";
  if (["failed", "missing_remote", "disabled", "deleted", "suspended"].includes(status)) return "status-pill failed";
  return "status-pill pending";
}

export function formatMb(mb: number): string {
  return mb >= 1024 ? `${(mb / 1024).toFixed(1)} GB` : `${mb} MB`;
}

