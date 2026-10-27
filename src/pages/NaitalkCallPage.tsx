import React, { useEffect, useMemo, useState } from "react";
import { ArrowRight, AudioLines, CheckCircle2, Code2, KeyRound, Mic, PhoneCall, ShieldCheck, Users, Webhook } from "lucide-react";
import { PublicPage, PublicBreadcrumbs, FaqAccordionGroup } from "../shared/marketingWidgets";
import { useJsonLd } from "../seo/useJsonLd";
import { trackCtaClick } from "../lib/analytics";
import { LARAVEL_API_BASE_URL } from "../shared/api";

/*
 * Public page for Naitalk Call, our LiveKit voice-call service for apps.
 * Plans are priced in dollars; the Naira figures use the Central Bank of
 * Nigeria's official rate, which the API fetches daily. Until the API
 * answers, the built-in plans below show (dollar prices only).
 */

export type NaitalkCallPlan = {
  id: string;
  name: string;
  tagline: string | null;
  included_minutes: number;
  features: string[];
  monthly_usd_cents: number;
  monthly_usd: string;
  monthly_ngn: string | null;
};

export type NaitalkCallPricing = {
  plans: NaitalkCallPlan[];
  exchange_rate: { rate: number; date: string; source: string } | null;
};

const FALLBACK: NaitalkCallPricing = {
  exchange_rate: null,
  plans: [
    { id: "free", name: "Free", tagline: "For testing while you build", included_minutes: 5000, monthly_usd_cents: 0, monthly_usd: "Free", monthly_ngn: null, features: ["One-to-one and group voice calls", "Web, iOS and Android SDKs", "Your own API key and webhooks", "For development and testing, not live traffic"] },
    { id: "starter", name: "Starter", tagline: "For developers launching an app", included_minutes: 50000, monthly_usd_cents: 2000, monthly_usd: "$20", monthly_ngn: null, features: ["One-to-one and group voice calls", "No arbitrary room-size restriction by subscription tier", "Web, iOS and Android SDKs", "API access and usage dashboard", "Upgrade when you need more minutes"] },
    { id: "growth", name: "Growth", tagline: "For growing apps", included_minutes: 200000, monthly_usd_cents: 4900, monthly_usd: "$49", monthly_ngn: null, features: ["All Starter features", "Larger monthly usage allowance", "Usage alerts and billing reports", "Higher API request allowance"] },
    { id: "business", name: "Business", tagline: "For established apps", included_minutes: 500000, monthly_usd_cents: 9900, monthly_usd: "$99", monthly_ngn: null, features: ["All Growth features", "Higher usage and API allowances", "Priority support", "Options for capacity planning as demand grows"] },
  ],
};

export function useNaitalkCallPricing() {
  const [pricing, setPricing] = useState<NaitalkCallPricing>(FALLBACK);

  useEffect(() => {
    fetch(`${LARAVEL_API_BASE_URL}/api/v1/public/naitalk-call/pricing`, { headers: { Accept: "application/json" } })
      .then((response) => (response.ok ? response.json() : Promise.reject()))
      .then((body: NaitalkCallPricing) => {
        if (Array.isArray(body.plans) && body.plans.length > 0) setPricing(body);
      })
      .catch(() => undefined);
  }, []);

  return pricing;
}

/** "26 Oct 2026" from "2026-10-26". */
export function rateDate(date: string): string {
  const d = new Date(`${date}T12:00:00Z`);
  return Number.isNaN(d.getTime()) ? date : d.toLocaleDateString("en-GB", { day: "numeric", month: "short", year: "numeric", timeZone: "UTC" });
}

const WHY: Array<[typeof PhoneCall, string, string]> = [
  [Mic, "Calls inside your app", "One-to-one calls, group calls and live audio rooms where hosts bring people up to speak."],
  [Code2, "Standard LiveKit", "Use the open-source LiveKit SDKs for web, iOS, Android and Flutter. Point them at Naitalk Call with the key we give you."],
  [Webhook, "Events to your server", "We send room and participant events to your webhook, signed with your own key."],
  [ShieldCheck, "Run for you", "We host, update and watch the media server, so your team doesn't have to."],
];

const STEPS: Array<[typeof PhoneCall, string, string]> = [
  [Users, "Pick a plan", "Start free while you build, then choose the plan that fits your monthly usage."],
  [KeyRound, "Get your key", "We give you an API key, secret and a room-name prefix for your calls."],
  [AudioLines, "Start calling", "Add the LiveKit SDK to your app, mint tokens on your server, and your users can talk."],
];

const minutes = (n: number) => n.toLocaleString("en-NG");

export function NaitalkCallPage() {
  const pricing = useNaitalkCallPricing();
  const rate = pricing.exchange_rate;
  const lowest = pricing.plans.find((p) => p.monthly_usd_cents > 0);

  const choose = (plan: NaitalkCallPlan, section: string) => {
    const url = `/contact?service=${encodeURIComponent(`Naitalk Call ${plan.name}`)}`;
    trackCtaClick({ button_text: `Choose ${plan.name}`, page_section: section, destination_url: url });
    window.location.href = url;
  };

  const faqs = useMemo(
    () => [
      { question: "What is a participant-minute?", answer: "One person in a call for one minute. A 10-minute call between 3 people uses 30 participant-minutes. Your plan's allowance resets every month." },
      {
        question: "Can I pay in Naira?",
        answer: rate
          ? `Yes. Naira prices use the Central Bank of Nigeria's official rate, now ₦${rate.rate.toLocaleString("en-NG", { maximumFractionDigits: 2 })} per $1 (${rateDate(rate.date)}), so they follow the rate.`
          : "Yes. Naira prices use the Central Bank of Nigeria's official rate on the day, so they follow the rate.",
      },
      { question: "Can I try it before paying?", answer: "Yes. The Free plan gives you your own key to build and test with. Move to Starter or above when you go live." },
      { question: "What happens if I use more than my plan's minutes?", answer: "Calls keep working. We'll let you know as you get close, and you can move up a plan." },
      { question: "What do I need to build?", answer: "Your app uses the LiveKit client SDK, and your server makes a short access token for each user with the key and secret we give you. Any LiveKit tutorial works." },
      { question: "Why do my room names need a prefix?", answer: "Every business gets its own prefix, such as yourbrand-. Rooms that start with it are yours, so we can send you your events and count your minutes." },
      { question: "Is it voice only?", answer: "The plans are built for voice calls and audio rooms. Talk to us if you need video." },
    ],
    [rate],
  );

  const jsonLd = useMemo(
    () => ({
      "@context": "https://schema.org",
      "@type": "Product",
      name: "Naitalk Call",
      description: "Hosted LiveKit voice calls and audio rooms for apps, with your own API key, webhooks and monthly usage.",
      brand: { "@type": "Organization", name: "NAI TALK" },
      offers: pricing.plans.map((plan) => ({
        "@type": "Offer",
        name: plan.name,
        price: String(plan.monthly_usd_cents / 100),
        priceCurrency: "USD",
        availability: "https://schema.org/InStock",
        url: "https://www.naitalk.com/naitalk-call",
      })),
    }),
    [pricing.plans],
  );
  useJsonLd("jsonld-naitalk-call-product", jsonLd);

  return (
    <PublicPage>
      <PublicBreadcrumbs items={[{ label: "Naitalk Call" }]} dark />

      <section className="relative overflow-hidden" style={{ background: "radial-gradient(circle at 80% 20%, rgba(155,234,22,0.16), transparent 45%)" }}>
        <div className="mx-auto max-w-4xl px-4 pb-14 pt-10 text-center sm:px-6 lg:px-8">
          <span className="eyebrow">Naitalk Call</span>
          <h1 className="mt-5 text-4xl font-black leading-[1.08] text-white sm:text-5xl">Voice calls for your app, hosted by us.</h1>
          <p className="mx-auto mt-5 max-w-2xl text-lg leading-8 text-white/65">
            Add one-to-one calls, group calls and live audio rooms to your app with LiveKit, running on NAI TALK's servers. Free while you build, then from{" "}
            <strong className="text-white">{lowest?.monthly_usd ?? "$20"} a month</strong>.
          </p>
          <div className="mt-8 flex flex-col justify-center gap-3 sm:flex-row">
            <a href="#naitalk-call-plans" className="btn-primary justify-center">
              See plans <ArrowRight className="h-4 w-4" />
            </a>
            <a href="#naitalk-call-faq" className="btn-outline justify-center">How it works</a>
          </div>
        </div>
      </section>

      <section id="naitalk-call-plans" className="pub-section-dark">
        <div className="mx-auto max-w-7xl px-4 pb-16 sm:px-6 lg:px-8">
          <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
            {pricing.plans.map((plan) => {
              const featured = plan.id === "growth";
              return (
                <div
                  key={plan.id}
                  data-testid={`naitalk-call-plan-${plan.id}`}
                  className={`flex flex-col rounded-3xl border p-6 ${featured ? "border-primary/60 bg-primary/[0.06]" : "border-white/12 bg-white/[0.035]"}`}
                >
                  <p className="text-sm font-black uppercase tracking-wide text-white">{plan.name}</p>
                  {plan.tagline && <p className="mt-1 text-sm text-white/55">{plan.tagline}</p>}
                  <p className="mt-5 flex items-baseline gap-1.5">
                    <span className="text-4xl font-black text-primary">{plan.monthly_usd}</span>
                    {plan.monthly_usd_cents > 0 && <span className="text-sm text-white/55">/mo</span>}
                  </p>
                  <p className="mt-1 min-h-5 text-sm text-white/65">{plan.monthly_ngn ? <>≈ {plan.monthly_ngn}/mo</> : plan.monthly_usd_cents === 0 ? "No card needed" : ""}</p>
                  <p className="mt-4 rounded-xl border border-white/10 bg-black/25 px-3 py-2 text-sm font-bold text-white">
                    {minutes(plan.included_minutes)} participant-minutes
                  </p>
                  <ul className="mt-5 grid flex-1 content-start gap-2.5">
                    {plan.features.map((feature) => (
                      <li key={feature} className="flex gap-2.5 text-sm leading-6 text-white/75">
                        <CheckCircle2 className="mt-0.5 h-4 w-4 shrink-0 text-primary" /> {feature}
                      </li>
                    ))}
                  </ul>
                  <button type="button" className={`${featured ? "btn-primary" : "btn-outline"} mt-6 w-full justify-center`} onClick={() => choose(plan, "naitalk_call_plans")}>
                    {plan.monthly_usd_cents === 0 ? "Start free" : `Choose ${plan.name}`} <ArrowRight className="h-4 w-4" />
                  </button>
                </div>
              );
            })}
          </div>
          <p className="mx-auto mt-6 max-w-3xl text-center text-xs leading-6 text-white/50" data-testid="naitalk-call-rate-note">
            {rate
              ? `Naira prices use the Central Bank of Nigeria official rate: ₦${rate.rate.toLocaleString("en-NG", { maximumFractionDigits: 2 })} per $1 (${rateDate(rate.date)}). They follow the rate.`
              : "Pay in dollars or in Naira at the Central Bank of Nigeria official rate."}{" "}
            VAT added where it applies.
          </p>
        </div>
      </section>

      <section className="pub-section-tint-dark border-y border-white/8">
        <div className="mx-auto max-w-7xl px-4 py-16 sm:px-6 lg:px-8">
          <div className="mx-auto max-w-2xl text-center">
            <span className="eyebrow">Why Naitalk Call</span>
            <h2 className="mt-4 text-3xl font-black text-white">Calls without running servers</h2>
          </div>
          <div className="mt-10 grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
            {WHY.map(([Icon, title, text]) => (
              <div key={title} className="pub-card-dark">
                <div className="flex h-11 w-11 items-center justify-center rounded-lg border border-primary/30 bg-primary/10 text-primary"><Icon className="h-5 w-5" /></div>
                <h3 className="mt-4 text-base font-black text-white">{title}</h3>
                <p className="mt-2 text-sm leading-6 text-white/62">{text}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      <section className="pub-section-dark">
        <div className="mx-auto max-w-7xl px-4 py-16 sm:px-6 lg:px-8">
          <div className="mx-auto max-w-2xl text-center">
            <span className="eyebrow">How it works</span>
            <h2 className="mt-4 text-3xl font-black text-white">From key to first call</h2>
          </div>
          <ol className="mt-10 grid gap-4 md:grid-cols-3">
            {STEPS.map(([Icon, title, text], index) => (
              <li key={title} className="pub-card-dark">
                <span className="flex items-center gap-3">
                  <span className="flex h-10 w-10 items-center justify-center rounded-full bg-primary text-base font-black text-[#031006]">{index + 1}</span>
                  <Icon className="h-5 w-5 text-primary" />
                </span>
                <h3 className="mt-4 text-lg font-black text-white">{title}</h3>
                <p className="mt-2 text-sm leading-6 text-white/62">{text}</p>
              </li>
            ))}
          </ol>
        </div>
      </section>

      <section id="naitalk-call-faq" className="pub-section-tint-dark border-y border-white/8">
        <div className="mx-auto max-w-3xl px-4 py-16 sm:px-6 lg:px-8">
          <div className="text-center">
            <span className="eyebrow">FAQ</span>
            <h2 className="mt-4 text-3xl font-black text-white">Naitalk Call questions</h2>
          </div>
          <div className="mt-8">
            <FaqAccordionGroup dark items={faqs} />
          </div>
        </div>
      </section>
    </PublicPage>
  );
}
