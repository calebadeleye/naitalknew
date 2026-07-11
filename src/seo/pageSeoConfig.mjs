// Single source of truth for static-page SEO tags — imported both by the
// Node/Express server (server.js, for real server-rendered <title>/meta tags
// that social/crawler bots see without running JS) and by the React app's
// useSeo hook (for client-side document.title/meta updates during SPA
// navigation). Keeping this in one plain-JS file avoids duplicating copy
// between the two runtimes.
const SITE_NAME = "NAI TALK";
const SITE_URL = "https://naitalk.com";
const DEFAULT_OG_IMAGE = `${SITE_URL}/og-naitalk-home.png`;

export const pageSeoConfig = {
  "/": {
    title: "NAI TALK — Domains, Hosting, Website Design & Care for Nigerian Businesses",
    description: "Search domains, get reliable hosting, professional websites, business email and ongoing website care — all in one place for Nigerian businesses.",
  },
  "/domains": {
    title: "Search, Register, Transfer and Manage Domains | NAI TALK",
    description: "Find the right domain name for your business and manage everything — registration, transfer, renewal — from one simple NAI TALK dashboard.",
  },
  "/domain-registration": {
    title: "Domain Registration in Nigeria for Businesses | NAI TALK",
    description: "Register .com, .com.ng, .ng, .org and .net domains for your Nigerian business in minutes, with hosting and email available in one checkout.",
  },
  "/domain-transfer": {
    title: "Transfer Your Domain to NAI TALK",
    description: "Move your domain to NAI TALK with your EPP/auth code. Simple eligibility checks, clear steps, and no downtime during transfer.",
  },
  "/domain-renewal": {
    title: "Renew Your Domain Before It Expires | NAI TALK",
    description: "Renewal reminders, auto-renewal, and wallet or saved-card payment support so you never lose a domain to an expiry date.",
  },
  "/domain-pricing": {
    title: "Domain Pricing | NAI TALK",
    description: "Transparent registration, renewal and transfer pricing for every domain extension we support — no hidden fees.",
  },
  "/web-hosting": {
    title: "Reliable Web Hosting in Nigeria | NAI TALK",
    description: "Fast, secure, and supported hosting for small and medium businesses — with SSL, email and backups included.",
  },
  "/website-care-plans": {
    title: "Website Care Plans for Growing Businesses | NAI TALK",
    description: "No technical stress. We keep your website online, secure, backed up, and supported so you can focus on running your business.",
  },
  "/website-design": {
    title: "Website Design for Nigerian Businesses | NAI TALK",
    description: "Professional websites that help your business look credible, attract customers, and grow online — business, e-commerce, school, church and NGO sites.",
  },
  "/business-email-hosting": {
    title: "Professional Business Email Hosting | NAI TALK",
    description: "A professional info@yourbusiness.com address builds trust that free Gmail or Yahoo addresses can't. Included in every Website Care Plan.",
  },
  "/seo-services": {
    title: "SEO Services for Nigerian Businesses | NAI TALK",
    description: "Improve your Google visibility with on-page SEO, content SEO, local SEO and a well-structured, fast website.",
  },
  "/blog": {
    title: "Blog | NAI TALK",
    description: "Practical guides on domains, hosting, website design and running your business online in Nigeria.",
  },
  "/knowledge-base": {
    title: "Knowledge Base for the Client Area | NAI TALK",
    description: "Step-by-step guides and tutorials to help you manage your account, services, domains, billing, and support with ease.",
  },
  "/faqs": {
    title: "Frequently Asked Questions | NAI TALK",
    description: "Answers to common questions about domains, hosting, website care, payments, wallet, support, website design and email.",
  },
  "/how-to-pay": {
    title: "How to Pay | NAI TALK",
    description: "A simple guide to paying with card, bank transfer, or your NAI TALK wallet, and what happens after you pay.",
  },
  "/service-status": {
    title: "Service Status | NAI TALK",
    description: "Live status for website services, hosting, domain registration, email and payments.",
  },
  "/about": {
    title: "About NAI TALK",
    description: "NAI TALK helps Nigerian businesses build a strong online presence with domains, hosting, website design, email and ongoing care.",
  },
  "/contact": {
    title: "Contact NAI TALK",
    description: "Reach NAI TALK by phone, email, WhatsApp or support ticket — we're here to help with domains, hosting and website care.",
  },
  "/portfolio": {
    title: "Portfolio | NAI TALK",
    description: "A selection of websites and projects NAI TALK has designed and built for businesses, schools, churches and NGOs.",
  },
};

export function getPageSeo(pathname) {
  const normalized = pathname.replace(/\/$/, "") || "/";
  const entry = pageSeoConfig[normalized];

  return {
    title: entry?.title || `${SITE_NAME} — Domains, Hosting & Website Care`,
    description: entry?.description || "NAI TALK helps Nigerian businesses build a strong online presence with domains, hosting, website design, email and ongoing care.",
    canonical: `${SITE_URL}${normalized === "/" ? "" : normalized}`,
    ogImage: DEFAULT_OG_IMAGE,
    siteName: SITE_NAME,
  };
}
