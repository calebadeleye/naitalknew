import React, { useEffect, useRef, useState } from "react";
import "@fontsource/pacifico/latin-400.css";
import { ArrowRight, Bot, CalendarDays, CheckCircle2, Filter, Megaphone, Smartphone } from "lucide-react";
import type { ClientLogo } from "./types";
import { LARAVEL_API_BASE_URL } from "./api";
import { trackCtaClick } from "../lib/analytics";

/*
 * Green Mail pieces shared by the public /green-mail page and the homepage:
 * the live usage counter, the strip of brands that use it, and the homepage
 * teaser section. Uses the site's lime brand colour (--color-primary).
 */

export type GreenmailStats = { businesses: number; mailboxes: number };

/** Live counts from the server (cached there for a few hours); null until loaded. */
export function useGreenmailStats(): GreenmailStats | null {
  const [stats, setStats] = useState<GreenmailStats | null>(null);
  useEffect(() => {
    let cancelled = false;
    fetch(`${LARAVEL_API_BASE_URL}/api/v1/public/greenmail/stats`, { headers: { Accept: "application/json" } })
      .then((response) => (response.ok ? response.json() : null))
      .then((data) => {
        if (!cancelled && data && typeof data.businesses === "number") setStats(data);
      })
      .catch(() => undefined);
    return () => {
      cancelled = true;
    };
  }, []);
  return stats;
}

/** Counts up from 0 the first time it scrolls into view. */
export function CountUp({ value, suffix = "" }: { value: number | null; suffix?: string }) {
  const [shown, setShown] = useState(0);
  const ref = useRef<HTMLSpanElement>(null);
  const started = useRef(false);

  useEffect(() => {
    const node = ref.current;
    if (!node || value === null) return;
    const run = () => {
      if (started.current) return;
      started.current = true;
      if (window.matchMedia?.("(prefers-reduced-motion: reduce)").matches) {
        setShown(value);
        return;
      }
      const start = performance.now();
      const tick = (now: number) => {
        const progress = Math.min(1, (now - start) / 1200);
        setShown(Math.round(value * (1 - Math.pow(1 - progress, 3))));
        if (progress < 1) requestAnimationFrame(tick);
      };
      requestAnimationFrame(tick);
    };
    if (!("IntersectionObserver" in window)) {
      run();
      return;
    }
    const observer = new IntersectionObserver((entries) => entries.some((entry) => entry.isIntersecting) && run(), { threshold: 0.4 });
    observer.observe(node);
    return () => observer.disconnect();
  }, [value]);

  return (
    <span ref={ref} aria-label={value === null ? "loading" : `${value}${suffix}`}>
      {value === null ? "—" : `${shown}${suffix}`}
    </span>
  );
}

/**
 * Businesses with Green Mail mailboxes on our servers. `logo` matches a client
 * logo's name in the site content (uploaded in admin); brands without an
 * uploaded logo show as a wordmark.
 */
export const GREENMAIL_BRANDS: Array<{ name: string; logo?: string }> = [
  { name: "Elinth Group" },
  { name: "UTME", logo: "UTME" },
  { name: "Skinologist", logo: "Skinologist" },
  { name: "Luminary FM", logo: "Luminary" },
  { name: "ScholarJoint", logo: "ScholarJoint" },
  { name: "Lilian Collin SPA", logo: "Lilian Collin SPA" },
  { name: "Ikees Stores", logo: "Ikees Stores" },
  { name: "Providence Pay" },
  { name: "HoneyTee Senior Care" },
  { name: "His Grace Children School" },
];

/** Logos from /api/site-content (the same ones the homepage shows), by name. */
function useClientLogos(provided?: ClientLogo[]) {
  const [logos, setLogos] = useState<ClientLogo[]>(provided ?? []);
  useEffect(() => {
    if (provided?.some((logo) => logo.src)) {
      setLogos(provided);
      return;
    }
    fetch("/api/site-content")
      .then((response) => response.json())
      .then((data) => Array.isArray(data.clientLogos) && setLogos(data.clientLogos))
      .catch(() => undefined);
  }, [provided]);
  return logos;
}

/** A slowly scrolling row of the brands that use Green Mail (pauses on hover; static when motion is reduced). */
export function GreenmailBrandStrip({ clientLogos }: { clientLogos?: ClientLogo[] }) {
  const logos = useClientLogos(clientLogos);
  const items = GREENMAIL_BRANDS.map((brand) => ({ ...brand, src: brand.logo ? logos.find((logo) => logo.name === brand.logo && logo.src)?.src : undefined }));

  const row = (hidden: boolean) => (
    <ul className="flex shrink-0 items-center gap-4 pr-4" aria-hidden={hidden || undefined}>
      {items.map((brand) => (
        <li key={brand.name} className="flex w-40 shrink-0 flex-col items-center justify-center gap-2 rounded-2xl border border-white/10 bg-white/[0.03] px-4 py-4" title={brand.name}>
          <span className="flex h-14 w-full items-center justify-center">
            {brand.src ? (
              <img src={brand.src} alt={hidden ? "" : brand.name} loading="lazy" decoding="async" className="max-h-14 max-w-full rounded object-contain opacity-90 transition hover:opacity-100" />
            ) : (
              <span className="text-center text-base font-black leading-tight text-white/80">{brand.name}</span>
            )}
          </span>
          {brand.src && <span className="w-full truncate text-center text-[10px] font-bold uppercase tracking-wide text-white/45">{brand.name}</span>}
        </li>
      ))}
    </ul>
  );

  return (
    <div className="gm-marquee relative overflow-hidden [mask-image:linear-gradient(90deg,transparent,#000_8%,#000_92%,transparent)]">
      <div className="gm-marquee-track flex w-max">
        {row(false)}
        {row(true)}
      </div>
    </div>
  );
}

/** The homepage section introducing Green Mail. */
export function GreenmailHomeSection({ clientLogos }: { clientLogos?: ClientLogo[] }) {
  const stats = useGreenmailStats();
  const highlights: Array<[typeof Bot, string]> = [
    [Bot, "AI assistant: summaries, reply drafts, Yoruba translation"],
    [CalendarDays, "Calendar, tasks and notes beside your inbox"],
    [Megaphone, "Templates and personalised email campaigns"],
    [Filter, "Filters, vacation reply and send-later"],
    [Smartphone, "Installs as an app on phone and desktop"],
  ];

  return (
    <section id="green-mail" className="relative overflow-hidden border-y border-white/8 py-20" style={{ background: "radial-gradient(circle at 85% 15%, rgba(155,234,22,0.16), transparent 45%)" }}>
      <div className="mx-auto grid max-w-7xl gap-12 px-4 sm:px-6 lg:grid-cols-[1.05fr_0.95fr] lg:items-center lg:px-8">
        <div className="min-w-0">
          <span className="eyebrow">Free with every hosting plan</span>
          <div className="mt-5 flex items-center gap-3">
            <img src="/greenmail-app/badge-128.webp" alt="" width={52} height={52} className="rounded-2xl shadow-[0_10px_30px_rgba(155,234,22,0.25)]" />
            <span className="text-[34px] leading-none text-white" style={{ fontFamily: "Pacifico, cursive" }}>Green Mail</span>
          </div>
          <h2 className="mt-5 text-3xl font-black leading-tight text-white sm:text-4xl">Business email on your own domain, with a smarter inbox built in.</h2>
          <p className="mt-4 max-w-xl text-base leading-7 text-white/62">
            Every NAI TALK website gets Green Mail at no extra cost: read and send as you@yourbusiness.com from any device, with AI, planning and automation tools your team will actually use.
          </p>
          <ul className="mt-6 grid gap-3 sm:grid-cols-2">
            {highlights.map(([Icon, text]) => (
              <li key={text} className="flex gap-3 text-sm leading-6 text-white/75">
                <Icon className="mt-0.5 h-5 w-5 shrink-0 text-primary" /> {text}
              </li>
            ))}
          </ul>
          <div className="mt-8 flex flex-col gap-3 sm:flex-row">
            <a href="/green-mail" className="btn-primary justify-center" onClick={() => trackCtaClick({ button_text: "Explore Green Mail", page_section: "home_greenmail", destination_url: "/green-mail" })}>
              Explore Green Mail <ArrowRight className="h-4 w-4" />
            </a>
            <a href="/web-hosting" className="btn-outline justify-center">See hosting plans</a>
          </div>
        </div>

        <div className="grid min-w-0 gap-4">
          <div className="grid grid-cols-2 gap-4">
            {[
              [stats?.businesses ?? null, "businesses use Green Mail"],
              [stats?.mailboxes ?? null, "mailboxes hosted"],
            ].map(([value, label]) => (
              <div key={label as string} className="rounded-3xl border border-primary/25 bg-primary/[0.06] p-6">
                <p className="text-4xl font-black text-primary sm:text-5xl"><CountUp value={value as number | null} suffix="+" /></p>
                <p className="mt-2 text-xs font-bold uppercase tracking-wide text-white/55">{label as string}</p>
              </div>
            ))}
          </div>
          <div className="min-w-0 overflow-hidden rounded-3xl border border-white/10 bg-white/[0.03] p-5">
            <p className="flex items-center gap-2 text-xs font-bold uppercase tracking-wide text-white/50"><CheckCircle2 className="h-4 w-4 text-primary" /> Trusted by growing brands</p>
            <div className="mt-4">
              <GreenmailBrandStrip clientLogos={clientLogos} />
            </div>
          </div>
        </div>
      </div>
    </section>
  );
}
