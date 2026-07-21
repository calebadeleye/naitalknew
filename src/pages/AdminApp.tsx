import React, { useEffect, useMemo, useRef, useState } from "react";
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

export const adminMetrics = [
  { label: "Total Revenue", value: "₦5,420,000", delta: "15.2%", icon: Wallet, tone: "lime" },
  { label: "Total Invoices", value: "342", delta: "8.9%", icon: FileText, tone: "cyan" },
  { label: "Paid Invoices", value: "238", delta: "12.1%", icon: CheckCircle2, tone: "lime" },
  { label: "Overdue Invoices", value: "18", delta: "₦1,235,000 overdue", icon: CalendarClock, tone: "gold" },
  { label: "Active Services", value: "256", delta: "11.3%", icon: Server, tone: "violet" },
  { label: "New Clients", value: "26", delta: "8.4%", icon: Users, tone: "cyan" },
];

export const REASON_CATEGORIES: Array<{ value: string; label: string }> = [
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

export type ReasonFormPayload = {
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
export function ReasonFormModal({
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

export type ManualInvoiceLineItemInput = {
  catalogKey: string;
  description: string;
  quantity: string;
  unitPriceNaira: string;
};

export type ManualInvoiceCatalogItem = {
  key: string;
  label: string;
  unitPriceKobo: number | null;
};

export const MANUAL_INVOICE_OTHER_KEY = "other";

export function CreateManualInvoiceModal({
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


export function AdminBreadcrumbs({ items }: { items: Array<{ label: string; onClick?: () => void }> }) {
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

export type ServiceGroupMetrics = {
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

export const SERVICE_STATUS_OPTIONS = [
  "active",
  "suspended",
  "deactivated",
  "expired",
  "grace_period",
  "pending_deletion",
  "deleted_from_ispconfig",
  "cancelled",
];

export function AdminServicesGroupedDashboard({
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

export function AdminDashboardOverview({
  data,
  isLoading,
  onNavigate,
  dateRange,
  onDateRangeChange,
}: {
  data: AdminDashboardSnapshot | null;
  isLoading: boolean;
  onNavigate?: (section: string) => void;
  dateRange?: { from: string; to: string } | null;
  onDateRangeChange?: (range: { from: string; to: string } | null) => void;
}) {
  const todayIso = new Date().toISOString().slice(0, 10);
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
        <div className="flex flex-col gap-3 sm:flex-row sm:items-center">
          <div className="flex items-center gap-2 rounded-lg border border-white/10 bg-white/[0.03] px-3 py-2">
            <label className="text-[10px] font-black uppercase text-white/45" htmlFor="dashboard-range-from">
              From
            </label>
            <input
              id="dashboard-range-from"
              type="date"
              className="bg-transparent text-xs font-bold text-white outline-none [color-scheme:dark]"
              max={dateRange?.to || todayIso}
              value={dateRange?.from || ""}
              onChange={(event) => {
                const from = event.target.value;
                if (!from) {
                  onDateRangeChange?.(null);
                  return;
                }
                onDateRangeChange?.({ from, to: dateRange?.to && dateRange.to >= from ? dateRange.to : todayIso });
              }}
            />
            <span className="text-white/20">–</span>
            <label className="text-[10px] font-black uppercase text-white/45" htmlFor="dashboard-range-to">
              To
            </label>
            <input
              id="dashboard-range-to"
              type="date"
              className="bg-transparent text-xs font-bold text-white outline-none [color-scheme:dark]"
              min={dateRange?.from}
              max={todayIso}
              value={dateRange?.to || ""}
              onChange={(event) => {
                const to = event.target.value;
                if (!dateRange?.from || !to) return;
                onDateRangeChange?.({ from: dateRange.from, to });
              }}
            />
          </div>
          {dateRange && (
            <button type="button" className="btn-outline justify-center !min-h-9 !px-3 !text-[11px]" onClick={() => onDateRangeChange?.(null)}>
              Clear range
            </button>
          )}
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

export type AdminRecordFilterDef = {
  key: string;
  label: string;
  type?: "select" | "text";
  options?: Array<{ value: string; label: string }>;
  placeholder?: string;
};

export function AdminRecordsSection({
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

export type LegacyImportSiteResult = {
  domain: string | null;
  action: string;
  suggested_renewal_date: string | null;
  manual_renewal_date_required: boolean;
};

export type LegacyImportClientResult = {
  ispconfig_client_id: string | null;
  client_id?: number | null;
  client_name: string | null;
  import_status: string;
  websites?: string[];
  email_accounts_count?: number;
  databases_count?: number;
  ssh_accounts_count?: number;
  ftp_accounts_count?: number;
  ispconfig_created_at?: string | null;
  suggested_renewal_date?: string | null;
  renewal_amount?: string;
  manual_renewal_date_required?: boolean;
  sites?: LegacyImportSiteResult[];
  reason?: string;
};

export type LegacyImportResult = {
  dry_run: boolean;
  clients: LegacyImportClientResult[];
};

export const LEGACY_IMPORT_STATUS_LABELS: Record<string, string> = {
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
export function AdminIspConfigImportPanel({ adminToken }: { adminToken: string }) {
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
    if (!window.confirm("This will import ISPConfig clients, websites, mailboxes, databases, SSH accounts and FTP accounts into NAITALK. Continue?")) return;

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
      sshAccounts: clients.reduce((sum, client) => sum + (client.ssh_accounts_count || 0), 0),
      ftpAccounts: clients.reduce((sum, client) => sum + (client.ftp_accounts_count || 0), 0),
      manualRenewalNeeded: clients.filter((client) => client.manual_renewal_date_required).length,
    };
  }, [result]);

  return (
    <section className="admin-panel">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <h2 className="text-2xl font-black">ISPConfig Legacy Import</h2>
          <p className="mt-1 text-sm text-white/55">
            Pulls existing clients, websites, mailboxes, databases, SSH accounts and FTP accounts out of ISPConfig
            and mirrors them into NAITALK under the hidden "Legacy Hosting + SSL" package. Never writes back to
            ISPConfig.
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

          <div className="mt-4 grid grid-cols-2 gap-3 sm:grid-cols-4 lg:grid-cols-9">
            {[
              ["Clients", totals.total],
              ["New", totals.imported],
              ["Linked", totals.linked],
              ["Failed", totals.failed],
              ["Websites", totals.websites],
              ["Mailboxes", totals.mailboxes],
              ["Databases", totals.databases],
              ["SSH accounts", totals.sshAccounts],
              ["FTP accounts", totals.ftpAccounts],
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
                  <th>SSH Accounts</th>
                  <th>FTP Accounts</th>
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
                    <td>{client.ssh_accounts_count ?? 0}</td>
                    <td>{client.ftp_accounts_count ?? 0}</td>
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

export type AdminClientDetail = {
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

export function ClientDetailPage({
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

export type AdminServiceDetail = {
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

export function ServiceDetailPanel({
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


export function AdminClientsList({
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

export function emptyProject(): Project {
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

export function emptyClientLogo(): ClientLogo {
  return {
    name: "",
    alt: "",
    src: "",
    width: null,
    height: null,
  };
}

export function emptyReview(): Review {
  return {
    author_name: "",
    rating: 5,
    text: "",
    profile_photo_url: "",
    relative_time_description: "",
  };
}

export function emptyPricingPackage(): PricingPackage {
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

export function fileToDataUrl(file: File) {
  return new Promise<string>((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(String(reader.result || ""));
    reader.onerror = () => reject(new Error("Image could not be read"));
    reader.readAsDataURL(file);
  });
}

export type DomainMarkupType = "cost_plus_markup" | "percentage_markup" | "fixed_customer_price" | "manual_price";

export type DomainPricingRow = {
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

export function emptyDomainPricingRow(): DomainPricingRow {
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

export type DomainPricingSettingsData = {
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

export type DomainPricingSyncLogRow = {
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

export function AdminDomainPricingSettingsPanel({
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
export function AdminDomainPricingPage({ adminToken }: { adminToken: string }) {
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

export type UnassignedDomainRow = {
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

export function AdminDomainAssignmentPage({ adminToken }: { adminToken: string }) {
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

export type AdminSectionDefinition = { id: AdminSectionId; label: string; icon: typeof BarChart3 };

export const adminSectionGroups: Array<{ label: string; sections: AdminSectionDefinition[] }> = [
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
      { id: "websiteQuotes", label: "Website Quotes", icon: Send },
    ],
  },
];

export const adminSections: AdminSectionDefinition[] = adminSectionGroups.flatMap((group) => group.sections);

export const adminSectionLabels: Record<AdminSectionId, string> = Object.fromEntries(
  adminSections.map((section) => [section.id, section.label]),
) as Record<AdminSectionId, string>;

export function adminExpiresBeforeDate(daysFromNow: number): string {
  const date = new Date();
  date.setDate(date.getDate() + daysFromNow);
  return date.toISOString().slice(0, 10);
}

export function domainAdminBadges(row: Record<string, unknown>): Array<{ label: string; tone: string }> {
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

export const adminRecordFilterDefs: Partial<Record<AdminRecordsSectionId, AdminRecordFilterDef[]>> = {
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
  websiteQuotes: [
    {
      key: "status",
      label: "Status",
      type: "select",
      options: [
        { value: "new", label: "New" },
        { value: "contacted", label: "Contacted" },
        { value: "qualified", label: "Qualified" },
        { value: "quoted", label: "Quoted" },
        { value: "converted", label: "Converted" },
        { value: "closed", label: "Closed" },
        { value: "spam", label: "Spam" },
      ],
    },
    { key: "search", label: "Search", type: "text", placeholder: "Name, email, phone or reference" },
  ],
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

export function AdminApp() {
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
  const [dashboardDateRange, setDashboardDateRange] = useState<{ from: string; to: string } | null>(null);
  const [adminRecords, setAdminRecords] = useState<Partial<Record<AdminRecordsSectionId, LaravelPage>>>({});
  const [loadingRecords, setLoadingRecords] = useState<Partial<Record<AdminRecordsSectionId, boolean>>>({});
  const [recordFilters, setRecordFilters] = useState<Partial<Record<AdminRecordsSectionId, Record<string, string>>>>({});
  const [recordPage, setRecordPage] = useState<Partial<Record<AdminRecordsSectionId, number>>>({});
  const [pricingPackages, setPricingPackages] = useState<PricingPackage[]>([]);
  const [isPricingLoading, setIsPricingLoading] = useState(false);
  const [retryingServiceId, setRetryingServiceId] = useState<number | null>(null);
  const [isSidebarOpen, setIsSidebarOpen] = useState(false);
  const [isCreatingInvoice, setIsCreatingInvoice] = useState(false);
  const [isNotificationsOpen, setIsNotificationsOpen] = useState(false);
  const notificationPanelRef = useRef<HTMLDivElement | null>(null);

  useEffect(() => {
    if (!isNotificationsOpen) return undefined;

    const handleClickOutside = (event: MouseEvent) => {
      if (notificationPanelRef.current && !notificationPanelRef.current.contains(event.target as Node)) {
        setIsNotificationsOpen(false);
      }
    };

    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, [isNotificationsOpen]);

  // Site-content sections editable via the shared `content` state / Save
  // button below -- everything else (dashboard, clients, invoices, etc.) has
  // its own per-section save actions, so the global Save button only makes
  // sense while one of these is active.
  const CONTENT_EDITOR_SECTIONS: AdminSectionId[] = ["logo", "clientLogos", "portfolio", "testimonials", "pricing"];
  const isContentEditorSection = CONTENT_EDITOR_SECTIONS.includes(activeSection);

  const notificationItems: Array<{ id: string; label: string; section: AdminSectionId }> = [
    ...(dashboardData?.pending_payment_reviews
      ? [
          {
            id: "payment-reviews",
            label: `${dashboardData.pending_payment_reviews} bank transfer ${dashboardData.pending_payment_reviews === 1 ? "payment" : "payments"} awaiting review`,
            section: "paymentVerification" as AdminSectionId,
          },
        ]
      : []),
  ];

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

  const loadAdminDashboard = async (token = adminToken, range = dashboardDateRange) => {
    if (!token) return;
    setIsDashboardLoading(true);

    try {
      const query = range ? `?from=${range.from}&to=${range.to}` : "";
      const data = await laravelApi<AdminDashboardSnapshot>(`/api/v1/admin/dashboard${query}`, token);
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
    websiteQuotes: "/api/v1/admin/website-quotes",
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
    websiteQuotes: { title: "Website Quotes", description: "Website-design quote requests submitted from the Google Ads landing page." },
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

  const approveBankTransferPayment = async (invoiceNumber: string, paymentId: number, declaredAmountKobo?: number) => {
    // The client may have declared a partial amount when uploading their
    // proof of payment (declaredAmountKobo, pre-filled here) -- give the
    // admin a chance to confirm or correct it before it's reconciled.
    // Passing a smaller amount than the invoice total is exactly how a
    // partial/underpayment gets recorded (see ReconcileInvoicePaymentService).
    const defaultNaira = declaredAmountKobo ? Math.round(declaredAmountKobo / 100).toString() : "";
    const enteredNaira = window.prompt(
      "Confirm the amount received for this payment (in Naira). Enter less than the invoice total if this was a partial payment:",
      defaultNaira,
    );
    if (enteredNaira === null) return;

    const amountKobo = Math.round(parseNairaAmount(enteredNaira) * 100);
    if (!amountKobo || amountKobo <= 0) {
      setMessage("Please enter a valid amount greater than zero.");
      return;
    }

    setApprovingPaymentId(paymentId);

    try {
      await laravelApi(`/api/v1/admin/invoices/${invoiceNumber}/mark-paid`, adminToken, {
        method: "POST",
        body: JSON.stringify({ amount_kobo: amountKobo }),
      });
      await loadAdminRecords("payments", adminToken);
      void loadAdminDashboard(adminToken);
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

  const [websiteQuoteActionBusyId, setWebsiteQuoteActionBusyId] = useState<number | null>(null);

  const updateWebsiteQuoteStatus = async (quoteId: number, status: string) => {
    setWebsiteQuoteActionBusyId(quoteId);

    try {
      await laravelApi(`/api/v1/admin/website-quotes/${quoteId}/status`, adminToken, {
        method: "PATCH",
        body: JSON.stringify({ status }),
      });
      await loadAdminRecords("websiteQuotes", adminToken);
    } catch (error) {
      setMessage(error instanceof Error ? error.message : "Updating website quote status failed");
    } finally {
      setWebsiteQuoteActionBusyId(null);
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
            <div className="relative" ref={notificationPanelRef}>
              <button
                type="button"
                className="admin-topbar-icon-button"
                onClick={() => setIsNotificationsOpen((current) => !current)}
                aria-expanded={isNotificationsOpen}
                aria-label="Notifications"
              >
                <Bell className="h-4 w-4" />
                {notificationItems.length > 0 && <span className="admin-topbar-badge">{notificationItems.length}</span>}
              </button>
              {isNotificationsOpen && (
                <div className="admin-notification-panel">
                  <p className="admin-notification-panel-title">Notifications</p>
                  {notificationItems.length === 0 ? (
                    <p className="admin-notification-empty">You're all caught up.</p>
                  ) : (
                    notificationItems.map((item) => (
                      <button
                        key={item.id}
                        type="button"
                        className="admin-notification-item"
                        onClick={() => {
                          navigateToSection(item.section);
                          setIsNotificationsOpen(false);
                        }}
                      >
                        {item.label}
                      </button>
                    ))
                  )}
                </div>
              )}
            </div>
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

        {isContentEditorSection && !routeClientId && !routeServiceId && (
          <div className="flex items-center justify-between gap-3 rounded-lg border border-primary/20 bg-primary/[0.04] px-4 py-3">
            <p className="text-xs font-bold text-white/60">
              Changes to {adminSectionLabels[activeSection]} only go live on the public site once saved here.
            </p>
            <button
              type="button"
              className="btn-primary shrink-0 justify-center !min-h-9 !px-3 !text-[11px]"
              onClick={saveContent}
              disabled={isSaving}
            >
              <Save className="h-4 w-4" />
              {isSaving ? "Saving..." : "Save changes"}
            </button>
          </div>
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
            dateRange={dashboardDateRange}
            onDateRangeChange={(range) => {
              setDashboardDateRange(range);
              void loadAdminDashboard(adminToken, range);
            }}
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
                  <button
                    type="button"
                    className="btn-outline !min-h-9 !px-3 !py-1.5 !text-[10px]"
                    disabled={isBusy}
                    onClick={() => void approveBankTransferPayment(invoiceNumber, paymentId, Number(row.amount_kobo) || undefined)}
                  >
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
                          onClick={() => void approveBankTransferPayment(invoiceNumber, paymentId, Number(row.amount_kobo) || undefined)}
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
                      : activeSection === "websiteQuotes"
                        ? (row) => {
                            const quoteId = Number(row.id);
                            const isBusy = websiteQuoteActionBusyId === quoteId;
                            const status = row.status as string;

                            return (
                              <div className="flex flex-wrap items-center justify-end gap-2">
                                {status !== "contacted" && (
                                  <button
                                    type="button"
                                    className="btn-outline !min-h-9 !px-3 !py-1.5 !text-[10px]"
                                    disabled={isBusy}
                                    onClick={() => void updateWebsiteQuoteStatus(quoteId, "contacted")}
                                  >
                                    Mark Contacted
                                  </button>
                                )}
                                {status !== "qualified" && (
                                  <button
                                    type="button"
                                    className="btn-outline !min-h-9 !px-3 !py-1.5 !text-[10px]"
                                    disabled={isBusy}
                                    onClick={() => void updateWebsiteQuoteStatus(quoteId, "qualified")}
                                  >
                                    Mark Qualified
                                  </button>
                                )}
                                {status !== "converted" && (
                                  <button
                                    type="button"
                                    className="btn-outline !min-h-9 !px-3 !py-1.5 !text-[10px]"
                                    disabled={isBusy}
                                    onClick={() => void updateWebsiteQuoteStatus(quoteId, "converted")}
                                  >
                                    Mark Converted
                                  </button>
                                )}
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
