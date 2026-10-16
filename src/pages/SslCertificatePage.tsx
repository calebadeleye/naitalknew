import React, { useMemo } from "react";
import { AlertTriangle, ArrowRight, CheckCircle2, CreditCard, Headphones, LockKeyhole, Search, ShieldCheck, TrendingUp } from "lucide-react";
import { PublicPage, PublicBreadcrumbs, FaqAccordionGroup } from "../shared/marketingWidgets";
import { useJsonLd } from "../seo/useJsonLd";
import { trackCtaClick } from "../lib/analytics";
import { startServiceOrder } from "../routing/pendingOrder";
import { formatKobo, useServiceOffering } from "../client/ServiceOrderPage";

/*
 * Public page for the stand-alone SSL certificate (₦15,000 — the price comes
 * from the live service offering). Ordering signs in / up first, then the
 * client pays the invoice and our team reaches out to set it up.
 */

const SLUG = "ssl-certificate";
const FALLBACK_PRICE_KOBO = 1500000;

const WHY: Array<[typeof ShieldCheck, string, string]> = [
  [LockKeyhole, "The padlock customers look for", "HTTPS and the browser padlock show visitors your website is the real thing and safe to use."],
  [AlertTriangle, "No more “Not secure” warning", "Chrome, Safari and Edge warn people away from sites without SSL — especially on forms and checkout pages."],
  [ShieldCheck, "Protects what people type", "Contact forms, logins and payments are encrypted between your visitor and your website."],
  [TrendingUp, "Better for Google", "Google prefers secure websites, and many visitors leave the moment they see a warning."],
];

const STEPS: Array<[typeof CreditCard, string, string]> = [
  [CreditCard, "Order and pay", "Tell us the website to secure and pay ₦15,000 by card, bank transfer or wallet."],
  [Headphones, "We reach out", "Our team contacts you — by email and through a support ticket — to arrange the setup."],
  [ShieldCheck, "Your site is secure", "We install the certificate and switch your website to HTTPS. You'll see the padlock."],
];

const FAQS = [
  { question: "How much is an SSL certificate?", answer: "₦15,000 (plus VAT where it applies) for one year of SSL for one website." },
  { question: "Do I need to host my website with NAI TALK?", answer: "No. You can order SSL on its own. After you order, our team reaches out to set it up with you, wherever your website is hosted." },
  { question: "How is it set up?", answer: "We do it with you. Once your payment is confirmed we reach out by email and through a support ticket in your client area, find out how your website is hosted, and install the certificate for you." },
  { question: "How long does it take?", answer: "We reach out after your payment is confirmed. Once we have the access we need to your website, setup is usually quick." },
  { question: "Is SSL included with NAI TALK hosting?", answer: "Websites hosted on NAI TALK Website Care plans include SSL. This stand-alone SSL is for websites that don't have it yet, or are hosted elsewhere." },
  { question: "What happens after a year?", answer: "The certificate covers one year. To keep the padlock after that, order it again or contact us and we'll renew it for you." },
];

export function SslCertificatePage() {
  const { offering } = useServiceOffering(SLUG);
  const priceKobo = offering?.price_kobo ?? FALLBACK_PRICE_KOBO;
  const price = formatKobo(priceKobo);

  const order = (section: string) => {
    trackCtaClick({ button_text: "Order SSL", page_section: section, destination_url: `/client/order/service?offering=${SLUG}` });
    startServiceOrder(SLUG);
  };

  const jsonLd = useMemo(
    () => ({
      "@context": "https://schema.org",
      "@type": "Product",
      name: "SSL Certificate",
      description: "One year of SSL (HTTPS) for one website, set up for you by the NAI TALK team.",
      brand: { "@type": "Organization", name: "NAI TALK" },
      offers: { "@type": "Offer", price: String(priceKobo / 100), priceCurrency: "NGN", availability: "https://schema.org/InStock", url: "https://www.naitalk.com/ssl-certificate" },
    }),
    [priceKobo],
  );
  const faqJsonLd = useMemo(
    () => ({ "@context": "https://schema.org", "@type": "FAQPage", mainEntity: FAQS.map((f) => ({ "@type": "Question", name: f.question, acceptedAnswer: { "@type": "Answer", text: f.answer } })) }),
    [],
  );
  useJsonLd("jsonld-ssl-product", jsonLd);
  useJsonLd("jsonld-ssl-faq", faqJsonLd);

  return (
    <PublicPage>
      <PublicBreadcrumbs items={[{ label: "Web Hosting", href: "/web-hosting" }, { label: "SSL Certificate" }]} dark />

      <section className="relative overflow-hidden" style={{ background: "radial-gradient(circle at 80% 20%, rgba(155,234,22,0.16), transparent 45%)" }}>
        <div className="mx-auto grid max-w-7xl gap-12 px-4 pb-20 pt-10 sm:px-6 lg:grid-cols-[1.1fr_0.9fr] lg:items-center lg:px-8">
          <div>
            <span className="eyebrow">SSL Certificate</span>
            <h1 className="mt-5 text-4xl font-black leading-[1.08] text-white sm:text-5xl">Put the padlock on your website.</h1>
            <p className="mt-5 max-w-xl text-lg leading-8 text-white/65">
              Secure your website with SSL (HTTPS) for <strong className="text-white">{price}</strong> a year. Order it on its own, even if your website is hosted elsewhere. After you order, <strong className="text-white">our team will reach out to you to set it up</strong>.
            </p>
            <div className="mt-8 flex flex-col gap-3 sm:flex-row">
              <button type="button" className="btn-primary justify-center" onClick={() => order("ssl_hero")}>
                Order SSL — {price} <ArrowRight className="h-4 w-4" />
              </button>
              <a href="/contact?service=SSL%20Certificate" className="btn-outline justify-center">Ask a question</a>
            </div>
          </div>

          <div className="rounded-3xl border border-primary/25 bg-white/[0.035] p-7 shadow-[0_30px_80px_rgba(0,0,0,0.35)]">
            <div className="flex items-center gap-2 rounded-xl border border-white/10 bg-black/30 px-3 py-2 font-mono text-sm text-white/80">
              <LockKeyhole className="h-4 w-4 text-primary" /> https://<span className="text-white">yourbusiness.com</span>
            </div>
            <p className="mt-6 text-sm font-bold uppercase tracking-wide text-white/50">SSL Certificate</p>
            <p className="mt-1 flex items-baseline gap-2">
              <span className="text-5xl font-black text-primary">{price}</span>
              <span className="text-sm text-white/55">/ year</span>
            </p>
            <ul className="mt-5 grid gap-2.5">
              {(offering?.benefits ?? ["HTTPS and the browser padlock on your website", "Removes the “Not secure” warning in browsers", "Valid for one year", "Our team reaches out after you order and sets it up for you"]).map((benefit) => (
                <li key={benefit} className="flex gap-2.5 text-sm leading-6 text-white/75">
                  <CheckCircle2 className="mt-0.5 h-4 w-4 shrink-0 text-primary" /> {benefit}
                </li>
              ))}
            </ul>
            <button type="button" className="btn-primary mt-7 w-full justify-center" onClick={() => order("ssl_price_card")}>
              Order now <ArrowRight className="h-4 w-4" />
            </button>
            <p className="mt-3 text-center text-xs text-white/45">Pay by card, bank transfer or wallet. VAT added where it applies.</p>
          </div>
        </div>
      </section>

      <section className="pub-section-tint-dark border-y border-white/8">
        <div className="mx-auto max-w-7xl px-4 py-16 sm:px-6 lg:px-8">
          <div className="mx-auto max-w-2xl text-center">
            <span className="eyebrow">Why SSL</span>
            <h2 className="mt-4 text-3xl font-black text-white">Why every website needs SSL</h2>
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
            <h2 className="mt-4 text-3xl font-black text-white">You order — we set it up</h2>
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
          <p className="mx-auto mt-8 max-w-2xl text-center text-sm leading-7 text-white/60">
            <Search className="mr-1 inline h-4 w-4 text-primary" /> Not sure if your website has SSL? Open it in your browser — if you don't see a padlock next to the address, or you see “Not secure”, it needs one.
          </p>
        </div>
      </section>

      <section className="pub-section-tint-dark border-y border-white/8">
        <div className="mx-auto max-w-3xl px-4 py-16 sm:px-6 lg:px-8">
          <div className="text-center">
            <span className="eyebrow">FAQ</span>
            <h2 className="mt-4 text-3xl font-black text-white">SSL questions, answered</h2>
          </div>
          <div className="mt-8">
            <FaqAccordionGroup dark items={FAQS} />
          </div>
        </div>
      </section>

      <section className="pub-section-dark">
        <div className="mx-auto flex max-w-5xl flex-col items-center gap-5 px-4 py-16 text-center sm:px-6 lg:px-8">
          <h2 className="text-3xl font-black text-white sm:text-4xl">Secure your website today</h2>
          <p className="max-w-2xl text-base leading-7 text-white/62">{price} a year. Order now and our team will reach out to set it up for you.</p>
          <button type="button" className="btn-primary justify-center" onClick={() => order("ssl_footer_cta")}>
            Order SSL <ArrowRight className="h-4 w-4" />
          </button>
        </div>
      </section>
    </PublicPage>
  );
}
