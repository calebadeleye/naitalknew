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
import { parseNairaAmount, formatNaira, formatKobo, toDateInputValue, formatDate, formatDateTime, accountTypeLabel, clientStatusPillClass, hostingStatusPillClass, formatMb, catalogCategoryIcon, ISO_DATE_PATTERN } from "./format";
import { Logo, Navbar, Footer, FloatingWhatsApp, SectionHeader, socialLinks, paymentBadges, footerColumns } from "./PublicLayout";
import { PublicPage, PublicBreadcrumbs, usePublicImage, MarketingHero, MarketingCtaBand, FaqAccordionItem, FaqAccordionGroup } from "./marketingWidgets";
import { goToDomainCheckout, DomainPromoBadge, TldPriceCard, DomainFeatureItem, DomainSearchBar, DomainSearchSection, DomainGlobeIllustration } from "./domainWidgets";
import type { DomainFeature, PublicTldPricingRow } from "./domainWidgets";

export const fallbackClientLogos: ClientLogo[] = ["UTME", "Skinologist", "Luminary", "Naibank", "ScholarJoint", "RHM"].map(
  (name) => ({
    name,
    alt: name,
    src: "",
    width: null,
    height: null,
  }),
);

export const fallbackProjects: Project[] = [
  {
    title: "UTME.com.ng",
    category: "CBT Platform",
    img: "/data/scholarjoint.webp",
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
    img: "/data/skinologist.webp",
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
    img: "/data/rhm.webp",
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
    img: "/data/momentum.webp",
    details: {
      challenge:
        "The business needed faster customer responses without increasing call center load.",
      solution:
        "We built an AI voice workflow for qualification, support routing and lead capture.",
      roi: "Reduced response time and improved follow-up consistency.",
    },
  },
];

export const fallbackReviews: Review[] = [
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

export const whatsappUrl =
  "https://wa.me/2347087057654?text=Hello%20NAITALK%2C%20I%20want%20to%20start%20a%20project.";

export const fallbackSiteContent: SiteContent = {
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
