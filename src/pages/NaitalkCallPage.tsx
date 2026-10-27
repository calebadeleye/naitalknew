import React, { useEffect, useMemo, useState } from "react";
import { ArrowRight, AudioLines, CheckCircle2, Code2, Globe2, KeyRound, Mic, PhoneCall, ShieldCheck, Users, Webhook } from "lucide-react";
import { PublicPage, PublicBreadcrumbs, FaqAccordionGroup } from "../shared/marketingWidgets";
import { useJsonLd } from "../seo/useJsonLd";
import { trackCtaClick } from "../lib/analytics";
import { LARAVEL_API_BASE_URL } from "../shared/api";
import { formatKobo } from "../client/ServiceOrderPage";

/*
 * Public page for Naitalk Call, our LiveKit voice-call service for apps. The
 * plan is priced in dollars; the Naira figure comes from the USD→NGN rate the
 * admin sets, so it is only shown once the API has answered with one.
 */

export type NaitalkCallPricing = {
  name: string;
  monthly_usd_cents: number;
  monthly_usd: string;
  exchange_rate: number | null;
  monthly_ngn_kobo: number | null;
};

const FALLBACK: NaitalkCallPricing = { name: "Naitalk Call Business", monthly_usd_cents: 2000, monthly_usd: "$20", exchange_rate: null, monthly_ngn_kobo: null };

export function useNaitalkCallPricing() {
  const [pricing, setPricing] = useState<NaitalkCallPricing>(FALLBACK);

  useEffect(() => {
    fetch(`${LARAVEL_API_BASE_URL}/api/v1/public/naitalk-call/pricing`, { headers: { Accept: "application/json" } })
      .then((response) => (response.ok ? response.json() : Promise.reject()))
      .then(setPricing)
      .catch(() => undefined);
  }, []);

  return pricing;
}

const FEATURES = [
  "Voice calls and live audio rooms in your own app",
  "Works with the LiveKit SDKs for web, Android, iOS and Flutter",
  "Your own API key and secret",
  "Room events sent to your server (webhooks)",
  "Hosted and looked after by NAI TALK",
  "Monthly usage report in minutes",
];

const WHY: Array<[typeof PhoneCall, string, string]> = [
  [Mic, "Calls inside your app", "One-to-one calls, group calls and live audio rooms where hosts bring people up to speak."],
  [Code2, "Standard LiveKit", "Use the open-source LiveKit SDKs you already know. Point them at Naitalk Call and use the key we give you."],
  [Webhook, "Events to your server", "We send room and participant events to your webhook, signed with your own key."],
  [ShieldCheck, "Run for you", "We host, update and watch the media server, so your team doesn't have to."],
];

const STEPS: Array<[typeof PhoneCall, string, string]> = [
  [Users, "Tell us about your app", "Contact us with your business name and the address of your webhook, if you use one."],
  [KeyRound, "Get your key", "We set you up and give you an API key, secret and a room-name prefix for your calls."],
  [AudioLines, "Start calling", "Add the LiveKit SDK to your app, mint tokens on your server, and your users can talk."],
];

export function NaitalkCallPage() {
  const pricing = useNaitalkCallPricing();
  const naira = pricing.monthly_ngn_kobo === null ? null : formatKobo(pricing.monthly_ngn_kobo);

  const contact = (section: string) => {
    trackCtaClick({ button_text: "Get Naitalk Call", page_section: section, destination_url: "/contact?service=Naitalk%20Call" });
    window.location.href = "/contact?service=Naitalk%20Call";
  };

  const faqs = useMemo(
    () => [
      {
        question: "How much is Naitalk Call?",
        answer: `${pricing.monthly_usd} a month per business${naira ? ` (about ${naira} at today's rate)` : ""}. You can pay in Naira; the Naira amount follows the exchange rate.`,
      },
      { question: "Can I try it before paying?", answer: "Yes. Ask us for the free testing plan: you get your own key to build and test with, and move to the paid plan when you go live." },
      { question: "What do I need to build?", answer: "Your app uses the LiveKit client SDK, and your server makes a short access token for each user with the key and secret we give you. Any LiveKit tutorial works." },
      { question: "Why do my room names need a prefix?", answer: "Every business gets its own prefix, such as yourbrand-. Rooms that start with it are yours, so we can send you your events and count your minutes." },
      { question: "Is it voice only?", answer: "The plan is built for voice calls and audio rooms. Talk to us if you need video." },
      { question: "Who uses it already?", answer: "Cradle, a Yoruba social app, runs Cradle Call on Naitalk Call." },
    ],
    [pricing.monthly_usd, naira],
  );

  const jsonLd = useMemo(
    () => ({
      "@context": "https://schema.org",
      "@type": "Product",
      name: "Naitalk Call",
      description: "Hosted LiveKit voice calls and audio rooms for apps, with your own API key and webhooks.",
      brand: { "@type": "Organization", name: "NAI TALK" },
      offers: { "@type": "Offer", price: String(pricing.monthly_usd_cents / 100), priceCurrency: "USD", availability: "https://schema.org/InStock", url: "https://www.naitalk.com/naitalk-call" },
    }),
    [pricing.monthly_usd_cents],
  );
  useJsonLd("jsonld-naitalk-call-product", jsonLd);

  return (
    <PublicPage>
      <PublicBreadcrumbs items={[{ label: "Naitalk Call" }]} dark />

      <section className="relative overflow-hidden" style={{ background: "radial-gradient(circle at 80% 20%, rgba(155,234,22,0.16), transparent 45%)" }}>
        <div className="mx-auto grid max-w-7xl gap-12 px-4 pb-20 pt-10 sm:px-6 lg:grid-cols-[1.1fr_0.9fr] lg:items-center lg:px-8">
          <div>
            <span className="eyebrow">Naitalk Call</span>
            <h1 className="mt-5 text-4xl font-black leading-[1.08] text-white sm:text-5xl">Voice calls for your app, hosted by us.</h1>
            <p className="mt-5 max-w-xl text-lg leading-8 text-white/65">
              Add calls and live audio rooms to your app with LiveKit, running on NAI TALK's servers. One plan: <strong className="text-white">{pricing.monthly_usd} a month</strong>
              {naira && <> (about <strong className="text-white">{naira}</strong>)</>}.
            </p>
            <div className="mt-8 flex flex-col gap-3 sm:flex-row">
              <button type="button" className="btn-primary justify-center" onClick={() => contact("naitalk_call_hero")}>
                Get Naitalk Call <ArrowRight className="h-4 w-4" />
              </button>
              <a href="#naitalk-call-faq" className="btn-outline justify-center">How it works</a>
            </div>
          </div>

          <div className="rounded-3xl border border-primary/25 bg-white/[0.035] p-7 shadow-[0_30px_80px_rgba(0,0,0,0.35)]" data-testid="naitalk-call-price-card">
            <div className="flex items-center gap-2 rounded-xl border border-white/10 bg-black/30 px-3 py-2 font-mono text-sm text-white/80">
              <Globe2 className="h-4 w-4 text-primary" /> room: <span className="text-white">yourbrand-</span>call-123
            </div>
            <p className="mt-6 text-sm font-bold uppercase tracking-wide text-white/50">{pricing.name}</p>
            <p className="mt-1 flex items-baseline gap-2">
              <span className="text-5xl font-black text-primary">{pricing.monthly_usd}</span>
              <span className="text-sm text-white/55">/ month</span>
            </p>
            <p className="mt-1 text-sm text-white/65">
              {naira ? <>≈ <strong className="text-white">{naira}</strong> / month at today's rate</> : "Pay in dollars or Naira"}
            </p>
            <ul className="mt-5 grid gap-2.5">
              {FEATURES.map((feature) => (
                <li key={feature} className="flex gap-2.5 text-sm leading-6 text-white/75">
                  <CheckCircle2 className="mt-0.5 h-4 w-4 shrink-0 text-primary" /> {feature}
                </li>
              ))}
            </ul>
            <button type="button" className="btn-primary mt-7 w-full justify-center" onClick={() => contact("naitalk_call_price_card")}>
              Talk to us <ArrowRight className="h-4 w-4" />
            </button>
            <p className="mt-3 text-center text-xs text-white/45">Free testing plan available — ask us. The Naira amount follows the exchange rate. VAT added where it applies.</p>
          </div>
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
