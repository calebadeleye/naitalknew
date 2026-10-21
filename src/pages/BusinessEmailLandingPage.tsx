import React from "react";
import { ArrowDown, CheckCircle2, CreditCard, Globe2, MailCheck, MessageCircle, ShieldCheck, Smartphone, Sparkles } from "lucide-react";
import { useSeo } from "../seo/useSeo";
import { EmailOnlyPlans } from "../shared/emailPlans";
import { trackCtaClick } from "../lib/analytics";

/*
 * Advert landing page for business email (/get-business-email) — for
 * Instagram ads. Deliberately no site menu or footer: the visitor sees what
 * they get, three steps, and the plans to order. Not linked from the site,
 * not in the sitemap, and noindex (see src/seo/publicRoutes.mjs).
 */

const WHATSAPP_HREF = `https://wa.me/2347087057654?text=${encodeURIComponent("Hello NAI TALK, I want business email for my domain.")}`;

const STEPS = [
  {
    icon: Globe2,
    title: "Choose a plan and your domain",
    text: "Use the domain you already have (e.g. yourbusiness.com), wherever it's registered — or get a new one in the same order.",
  },
  {
    icon: CreditCard,
    title: "Pay securely",
    text: "Pay by card or bank transfer. Your invoice is emailed to you straight away.",
  },
  {
    icon: MailCheck,
    title: "We set it up",
    text: "We send you the few DNS settings to add (if your domain is with us, we add them for you). Then create your mailboxes and start sending.",
  },
];

const PERKS = [
  { icon: Smartphone, label: "Phone & computer" },
  { icon: Sparkles, label: "AI writing help" },
  { icon: ShieldCheck, label: "Spam & virus protection" },
];

export function BusinessEmailLandingPage() {
  useSeo();

  const scrollToPlans = () => {
    trackCtaClick({ button_text: "See plans", page_section: "ad_email_landing_hero", destination_url: "#email-plans" });
    document.getElementById("email-plans")?.scrollIntoView({ behavior: "smooth" });
  };

  return (
    <div className="min-h-screen overflow-x-hidden bg-[#030505] text-white">
      {/* Brand only — not a link, so nothing leads away from the offer. */}
      <header className="border-b border-white/8">
        <div className="mx-auto flex max-w-6xl items-center justify-between px-4 py-4 sm:px-6">
          <img src="/logo-96.png" srcSet="/logo-96.png 1x, /logo-192.png 2x" alt="NAI TALK" width={96} height={36} className="h-8 w-auto" />
          <span className="inline-flex items-center gap-2 text-xs font-bold text-white/60">
            <img src="/greenmail-app/badge-128.webp" alt="" width={22} height={22} className="rounded-md" />
            Green Mail
          </span>
        </div>
      </header>

      <main>
        {/* Hero */}
        <section
          className="relative"
          style={{ background: "radial-gradient(circle at 80% 0%, rgba(155,234,22,0.18), transparent 50%), radial-gradient(circle at 0% 100%, rgba(155,234,22,0.07), transparent 45%)" }}
        >
          <div className="mx-auto max-w-3xl px-4 pb-14 pt-12 text-center sm:px-6 sm:pt-16">
            <span className="inline-flex items-center gap-2 rounded-full border border-primary/40 bg-primary/10 px-4 py-1.5 text-[11px] font-black uppercase tracking-wide text-primary">
              No website needed
            </span>
            <h1 className="mt-5 text-4xl font-black leading-[1.1] sm:text-5xl">
              Get{" "}
              <span className="block break-all text-[1.65rem] text-primary min-[400px]:text-[2rem] sm:text-5xl">you@yourbusiness.com</span>
            </h1>
            <p className="mx-auto mt-4 max-w-xl text-lg leading-8 text-white/70">
              Professional business email on your own domain, from <strong className="text-white">₦12,000 a year</strong>. Look serious to every
              customer you email.
            </p>

            {/* What it looks like to the people they email. */}
            <div className="mx-auto mt-8 max-w-md rounded-2xl border border-white/10 bg-white p-4 text-left text-slate-800 shadow-[0_30px_80px_rgba(0,0,0,0.45)]">
              <div className="flex items-center gap-3">
                <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-[#22a04f] text-sm font-black text-white">YB</span>
                <div className="min-w-0">
                  <p className="truncate text-sm font-bold">Your Business</p>
                  <p className="truncate text-xs text-slate-500">info@yourbusiness.com</p>
                </div>
                <span className="ml-auto text-xs text-slate-400">9:41 AM</span>
              </div>
              <p className="mt-3 text-sm font-bold">Your quotation is ready</p>
              <p className="mt-1 text-xs leading-5 text-slate-500">Good morning, please find attached the quotation you requested. We look forward to working with you…</p>
            </div>

            <button
              type="button"
              onClick={scrollToPlans}
              className="mt-8 inline-flex min-h-12 items-center justify-center gap-2 rounded-full px-8 py-3 text-sm font-black uppercase text-[#031006] shadow-[0_12px_32px_rgba(155,234,22,0.3)] transition hover:-translate-y-0.5"
              style={{ background: "linear-gradient(135deg, #9bea16, #6ed414)" }}
            >
              See plans & order <ArrowDown className="h-4 w-4" />
            </button>

            <ul className="mt-6 flex flex-wrap justify-center gap-x-5 gap-y-2 text-sm text-white/65">
              {PERKS.map((perk) => (
                <li key={perk.label} className="flex items-center gap-1.5">
                  <perk.icon className="h-4 w-4 text-primary" /> {perk.label}
                </li>
              ))}
            </ul>
          </div>
        </section>

        {/* How it works */}
        <section className="border-t border-white/8">
          <div className="mx-auto max-w-5xl px-4 py-14 sm:px-6">
            <h2 className="text-center text-2xl font-black sm:text-3xl">How it works</h2>
            <ol className="mt-8 grid gap-4 md:grid-cols-3">
              {STEPS.map((step, index) => (
                <li key={step.title} className="rounded-2xl border border-white/10 bg-white/[0.035] p-5">
                  <div className="flex items-center gap-3">
                    <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-primary text-sm font-black text-[#031006]">{index + 1}</span>
                    <step.icon className="h-5 w-5 text-primary" />
                  </div>
                  <h3 className="mt-4 text-base font-black">{step.title}</h3>
                  <p className="mt-2 text-sm leading-6 text-white/62">{step.text}</p>
                </li>
              ))}
            </ol>
          </div>
        </section>

        {/* Plans — each button starts the order (sign up / sign in first if needed). */}
        <EmailOnlyPlans
          section="ad_email_landing_plans"
          eyebrow="Choose your plan"
          title="Pick the plan that fits your team"
          intro="Every plan includes Green Mail webmail, works with your phone's mail app, and comes with our team's help to set it up."
          footnote={false}
        />

        <section className="px-4 py-12 text-center sm:px-6">
          <ul className="mx-auto flex max-w-3xl flex-wrap justify-center gap-x-6 gap-y-2 text-sm text-white/60">
            {["Keep your current domain", "Setup help included", "Yearly billing — turn off auto-renew anytime"].map((item) => (
              <li key={item} className="flex items-center gap-1.5">
                <CheckCircle2 className="h-4 w-4 text-primary" /> {item}
              </li>
            ))}
          </ul>
          <a
            href={WHATSAPP_HREF}
            target="_blank"
            rel="noopener noreferrer"
            onClick={() => trackCtaClick({ button_text: "WhatsApp", page_section: "ad_email_landing_help", destination_url: "whatsapp" })}
            className="mt-6 inline-flex items-center gap-2 text-sm font-bold text-white/70 hover:text-primary"
          >
            <MessageCircle className="h-4 w-4 text-[#25D366]" /> Questions? Chat with us on WhatsApp
          </a>
          <p className="mt-8 text-xs text-white/35">© {new Date().getFullYear()} NAI TALK · Green Mail business email</p>
        </section>
      </main>
    </div>
  );
}
