export type LogoImage = {
  src: string;
  alt: string;
  width?: number | null;
  height?: number | null;
};

export type ClientLogo = LogoImage & {
  name: string;
};

export type Project = {
  title: string;
  category: string;
  img: string;
  details: {
    challenge: string;
    solution: string;
    roi: string;
  };
};

export type Review = {
  author_name: string;
  rating: number;
  text: string;
  profile_photo_url?: string;
  relative_time_description?: string;
};

export type SiteContent = {
  brand: {
    logo: LogoImage;
  };
  clientLogos: ClientLogo[];
  projects: Project[];
  reviews: Review[];
};

export type AdminDashboardMetric = {
  label: string;
  value: string | number | null;
  amount?: string;
  raw?: number;
};

export type AdminDashboardSnapshot = {
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

export type ClientDashboardSnapshot = {
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

export type HostingPlanCard = {
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

export type ServiceCatalogItem = {
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

export type ClientOrderSummary = {
  order_number: string;
  status: string;
  billing_cycle: string;
  total: string;
  created_at: string | null;
  items: Array<{ description: string; total: string }>;
  invoice: { invoice_number: string; status: string; total: string } | null;
};

export type BankTransferDetails = {
  bank_name: string;
  account_name: string;
  account_number: string;
  amount: string;
  reference: string;
  message: string;
};

export type PricingPackage = {
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

export type ClientAuthMode = "login" | "register" | "forgot" | "reset";

export type LaravelPage<T = Record<string, unknown>> = {
  data: T[];
  links?: unknown[];
  meta?: {
    current_page?: number;
    last_page?: number;
    total?: number;
  };
};

export type AdminRecordsSectionId =
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
  | "domainTransfers"
  | "websiteQuotes";
