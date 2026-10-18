import React, { useEffect, useRef, useState } from "react";
import type { LucideIcon } from "lucide-react";
import {
  ArrowRight,
  ArrowRightLeft,
  BarChart3,
  Briefcase,
  ChevronDown,
  Code2,
  FileText,
  Globe2,
  Inbox,
  Mail,
  RefreshCw,
  Search,
  Server,
  ShieldCheck,
  Sparkles,
  Tag,
  Wrench,
} from "lucide-react";
import { trackCtaClick } from "../lib/analytics";

/*
 * The public site's mega menu: every offering in one wide panel, grouped
 * into columns, each with an icon and a one-line description, plus a
 * featured card. Opens on hover (with a short grace period so the pointer
 * can travel into the panel), on click/tap, and from the keyboard; Escape
 * or a click outside closes it.
 */

export type MegaLink = { label: string; href: string; description: string; icon: LucideIcon; badge?: string };
export type MegaColumn = { title: string; links: MegaLink[] };
export type MegaFeature = { eyebrow: string; title: string; text: string; cta: string; href: string; icon: LucideIcon };
export type MegaMenuDef = { label: string; columns: MegaColumn[]; feature?: MegaFeature; footer?: { text: string; cta: string; href: string } };

export const MEGA_MENUS: MegaMenuDef[] = [
  {
    label: "Services",
    columns: [
      {
        title: "Hosting",
        links: [
          { label: "Web Hosting", href: "/web-hosting", description: "Fast, secure hosting for your website", icon: Server },
          { label: "Website Care Plans", href: "/website-care-plans", description: "Hosting + updates, backups and support", icon: Wrench },
          { label: "SSL Certificate", href: "/ssl-certificate", description: "HTTPS and the padlock — ₦15,000/yr", icon: ShieldCheck },
        ],
      },
      {
        title: "Business Email",
        links: [
          { label: "Green Mail", href: "/green-mail", description: "Smart email with AI, calendar and tasks", icon: Inbox, badge: "New" },
          { label: "Email-only Plans", href: "/green-mail#email-plans", description: "Email on your domain — no website needed", icon: Mail },
          { label: "Business Email Hosting", href: "/business-email-hosting", description: "Professional addresses for your team", icon: Briefcase },
        ],
      },
      {
        title: "Websites & Growth",
        links: [
          { label: "Website Design", href: "/website-design", description: "Custom websites that win customers", icon: Code2 },
          { label: "Get a Website Quote", href: "/get-a-website", description: "Tell us what you need, get a price", icon: FileText },
          { label: "SEO Services", href: "/seo-services", description: "Get found on Google", icon: BarChart3 },
          { label: "Portfolio", href: "/portfolio", description: "Websites we've built", icon: Sparkles },
        ],
      },
    ],
    feature: {
      eyebrow: "Just want email?",
      title: "Green Mail on its own",
      text: "Business email on the domain you already have — from ₦12,000 a year.",
      cta: "See email plans",
      href: "/green-mail#email-plans",
      icon: Inbox,
    },
    footer: { text: "Not sure what you need? We'll help you choose.", cta: "Talk to us", href: "/contact" },
  },
  {
    label: "Domains",
    columns: [
      {
        title: "Get a domain",
        links: [
          { label: "Search Domain", href: "/domains", description: "Check if your name is available", icon: Search },
          { label: "Domain Registration", href: "/domain-registration", description: "Register .com, .ng, .com.ng and more", icon: Globe2 },
          { label: "Domain Pricing", href: "/domain-pricing", description: "Prices for every extension", icon: Tag },
        ],
      },
      {
        title: "Already have one?",
        links: [
          { label: "Domain Transfer", href: "/domain-transfer", description: "Move your domain to NAI TALK", icon: ArrowRightLeft },
          { label: "Domain Renewal", href: "/domain-renewal", description: "Keep your domain from expiring", icon: RefreshCw },
          { label: "Email-only Plans", href: "/green-mail#email-plans", description: "Add business email to your domain", icon: Mail },
        ],
      },
    ],
    feature: {
      eyebrow: "Find your name",
      title: "Your business, online",
      text: "Search thousands of names and extensions in seconds.",
      cta: "Search domains",
      href: "/domains",
      icon: Globe2,
    },
  },
];

function MegaPanel({ menu, onNavigate }: { menu: MegaMenuDef; onNavigate: () => void }) {
  const columns = menu.columns.length;

  return (
    <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
      <div className="overflow-hidden rounded-2xl border border-white/10 bg-[#061015] shadow-[0_30px_90px_rgba(0,0,0,0.55)]">
        <div className={`grid gap-6 p-6 ${menu.feature ? "lg:grid-cols-[minmax(0,1fr)_280px]" : ""}`}>
          <div className={`grid gap-6 ${columns >= 3 ? "lg:grid-cols-3" : "lg:grid-cols-2"}`}>
            {menu.columns.map((column) => (
              <div key={column.title} className="min-w-0">
                <p className="px-3 text-[10px] font-black uppercase tracking-wider text-primary">{column.title}</p>
                <ul className="mt-3 grid gap-1">
                  {column.links.map((link) => (
                    <li key={`${column.title}-${link.href}`}>
                      <a
                        href={link.href}
                        onClick={() => {
                          trackCtaClick({ button_text: link.label, page_section: "mega_menu", destination_url: link.href });
                          onNavigate();
                        }}
                        className="group/link flex gap-3 rounded-xl px-3 py-2.5 transition hover:bg-white/[0.05] focus-visible:bg-white/[0.05] focus-visible:outline-none"
                      >
                        <span className="mt-0.5 flex h-9 w-9 shrink-0 items-center justify-center rounded-lg border border-white/10 bg-white/[0.04] text-white/70 transition group-hover/link:border-primary/40 group-hover/link:text-primary">
                          <link.icon className="h-4 w-4" />
                        </span>
                        <span className="min-w-0">
                          <span className="flex items-center gap-2 text-sm font-extrabold text-white transition group-hover/link:text-primary">
                            {link.label}
                            {link.badge && <span className="rounded-full bg-primary px-1.5 py-0.5 text-[9px] font-black uppercase leading-none text-[#031006]">{link.badge}</span>}
                          </span>
                          <span className="mt-0.5 block text-xs leading-5 text-white/50">{link.description}</span>
                        </span>
                      </a>
                    </li>
                  ))}
                </ul>
              </div>
            ))}
          </div>

          {menu.feature && (
            <a
              href={menu.feature.href}
              onClick={() => {
                trackCtaClick({ button_text: menu.feature!.cta, page_section: "mega_menu_feature", destination_url: menu.feature!.href });
                onNavigate();
              }}
              className="group/feature relative flex flex-col justify-between overflow-hidden rounded-xl border border-primary/25 p-5"
              style={{ background: "radial-gradient(circle at 85% 0%, rgba(155,234,22,0.22), transparent 55%), linear-gradient(160deg, rgba(155,234,22,0.08), rgba(255,255,255,0.02))" }}
            >
              <div>
                <span className="flex h-10 w-10 items-center justify-center rounded-xl bg-primary/15 text-primary">
                  <menu.feature.icon className="h-5 w-5" />
                </span>
                <p className="mt-4 text-[10px] font-black uppercase tracking-wider text-primary">{menu.feature.eyebrow}</p>
                <p className="mt-1 text-lg font-black text-white">{menu.feature.title}</p>
                <p className="mt-2 text-sm leading-6 text-white/60">{menu.feature.text}</p>
              </div>
              <span className="mt-5 inline-flex items-center gap-1.5 text-sm font-black text-primary">
                {menu.feature.cta} <ArrowRight className="h-4 w-4 transition group-hover/feature:translate-x-0.5" />
              </span>
            </a>
          )}
        </div>

        {menu.footer && (
          <div className="flex flex-wrap items-center justify-between gap-3 border-t border-white/8 bg-white/[0.02] px-6 py-3.5">
            <p className="text-xs text-white/55">{menu.footer.text}</p>
            <a href={menu.footer.href} onClick={onNavigate} className="inline-flex items-center gap-1.5 text-xs font-black uppercase text-primary hover:underline">
              {menu.footer.cta} <ArrowRight className="h-3.5 w-3.5" />
            </a>
          </div>
        )}
      </div>
    </div>
  );
}

/**
 * Desktop triggers + panels. Render inside the fixed header; the panel spans
 * the header's width (it's positioned against the nearest `relative` parent,
 * which must be the header).
 */
export function MegaMenuBar() {
  const [open, setOpen] = useState<string | null>(null);
  const closeTimer = useRef<number | null>(null);
  // Hovering opens a menu just before the click lands; that click mustn't close it again.
  const openedAt = useRef(0);
  const show = (label: string) => {
    cancelClose();
    if (open !== label) openedAt.current = Date.now();
    setOpen(label);
  };
  const barRef = useRef<HTMLDivElement>(null);

  const cancelClose = () => {
    if (closeTimer.current) window.clearTimeout(closeTimer.current);
    closeTimer.current = null;
  };
  const closeSoon = () => {
    cancelClose();
    closeTimer.current = window.setTimeout(() => setOpen(null), 160);
  };

  useEffect(() => {
    if (!open) return undefined;
    const onKey = (event: KeyboardEvent) => event.key === "Escape" && setOpen(null);
    const onClick = (event: MouseEvent) => {
      if (barRef.current && !barRef.current.contains(event.target as Node)) setOpen(null);
    };
    document.addEventListener("keydown", onKey);
    document.addEventListener("mousedown", onClick);
    return () => {
      document.removeEventListener("keydown", onKey);
      document.removeEventListener("mousedown", onClick);
    };
  }, [open]);

  useEffect(() => cancelClose, []);

  const active = MEGA_MENUS.find((menu) => menu.label === open);

  return (
    <div ref={barRef} className="contents" onMouseLeave={closeSoon} onMouseEnter={cancelClose}>
      {MEGA_MENUS.map((menu) => (
        <button
          key={menu.label}
          type="button"
          aria-expanded={open === menu.label}
          aria-haspopup="true"
          onMouseEnter={() => show(menu.label)}
          onClick={() => (open === menu.label && Date.now() - openedAt.current > 400 ? setOpen(null) : show(menu.label))}
          className={`inline-flex h-10 items-center gap-1.5 px-2 text-[11px] font-extrabold uppercase transition hover:text-primary ${open === menu.label ? "text-primary" : "text-white/78"}`}
        >
          {menu.label}
          <ChevronDown className={`h-3.5 w-3.5 transition ${open === menu.label ? "rotate-180" : ""}`} />
        </button>
      ))}

      {active && (
        <div className="absolute inset-x-0 top-full z-50 pt-2" onMouseEnter={cancelClose} onMouseLeave={closeSoon} role="menu" aria-label={active.label}>
          <MegaPanel menu={active} onNavigate={() => setOpen(null)} />
        </div>
      )}
    </div>
  );
}

/** Mobile drawer version: each menu as a section, links with their icons and descriptions. */
export function MegaMenuMobile({ onNavigate }: { onNavigate: () => void }) {
  const [expanded, setExpanded] = useState<string | null>(MEGA_MENUS[0]?.label ?? null);

  return (
    <>
      {MEGA_MENUS.map((menu) => {
        const isOpen = expanded === menu.label;
        return (
          <div key={menu.label} className="rounded-lg border border-white/10 bg-white/[0.03]">
            <button
              type="button"
              aria-expanded={isOpen}
              onClick={() => setExpanded(isOpen ? null : menu.label)}
              className="flex w-full items-center justify-between px-4 py-4 text-sm font-extrabold uppercase text-white"
            >
              {menu.label}
              <ChevronDown className={`h-4 w-4 transition ${isOpen ? "rotate-180 text-primary" : "text-white/50"}`} />
            </button>
            {isOpen && (
              <div className="grid gap-4 px-3 pb-4">
                {menu.columns.map((column) => (
                  <div key={column.title}>
                    <p className="px-1 text-[10px] font-black uppercase tracking-wider text-primary">{column.title}</p>
                    <div className="mt-2 grid gap-1">
                      {column.links.map((link) => (
                        <a
                          key={`${column.title}-${link.href}`}
                          href={link.href}
                          onClick={() => {
                            trackCtaClick({ button_text: link.label, page_section: "mega_menu_mobile", destination_url: link.href });
                            onNavigate();
                          }}
                          className="flex items-center gap-3 rounded-md border border-white/8 bg-black/20 px-3 py-2.5"
                        >
                          <link.icon className="h-4 w-4 shrink-0 text-primary" />
                          <span className="min-w-0">
                            <span className="block text-sm font-extrabold text-white">{link.label}</span>
                            <span className="block text-xs text-white/50">{link.description}</span>
                          </span>
                        </a>
                      ))}
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        );
      })}
    </>
  );
}
