import React, { useEffect, useState } from "react";
import { ArrowRight, CheckCircle2 } from "lucide-react";
import { laravelApi } from "./api";
import { startEmailOrder } from "../routing/pendingOrder";
import { trackCtaClick } from "../lib/analytics";

/*
 * The email-only (Green Mail on its own) plans as a pricing section — on the
 * Green Mail page and the Business Email Hosting page. Plans come from the
 * live catalogue (/public/hosting-plans?type=email).
 */

export type EmailPlan = { name: string; slug: string; short_description: string; annual_price: string; display_badge: string | null; is_popular: boolean; public_features: string[] };

/** Shown until the live catalogue loads (and if it can't). Prices match the email plans in the database. */
const FALLBACK_EMAIL_PLANS: EmailPlan[] = [
  { name: "Email Starter", slug: "email-starter", short_description: "Business email on your own domain for a small team: 5 mailboxes and 5 GB.", annual_price: "₦12,000", display_badge: null, is_popular: false, public_features: ["5 mailboxes on your own domain", "5 GB of email storage, shared by your mailboxes"] },
  { name: "Email Business", slug: "email-business", short_description: "Business email for a growing team: 20 mailboxes and 20 GB.", annual_price: "₦30,000", display_badge: "Popular", is_popular: true, public_features: ["20 mailboxes on your own domain", "20 GB of email storage, shared by your mailboxes"] },
  { name: "Email Pro", slug: "email-pro", short_description: "Business email for larger teams: 50 mailboxes and 50 GB.", annual_price: "₦60,000", display_badge: null, is_popular: false, public_features: ["50 mailboxes on your own domain", "50 GB of email storage, shared by your mailboxes"] },
];

const LIME = { base: "#9bea16", deep: "#6ed414" };

export function useEmailPlans(): EmailPlan[] {
  const [plans, setPlans] = useState<EmailPlan[]>(FALLBACK_EMAIL_PLANS);
  useEffect(() => {
    laravelApi<EmailPlan[]>("/api/v1/public/hosting-plans?type=email")
      .then((rows) => {
        if (Array.isArray(rows) && rows.length) setPlans(rows);
      })
      .catch(() => undefined);
  }, []);
  return plans;
}

/** Green Mail on its own: business email for people whose website (if any) is elsewhere. */
export function EmailOnlyPlans({
  section,
  eyebrow = "Just want email?",
  title = "Green Mail on its own — no website needed",
  intro = "Keep your domain wherever it is (or register one with us) and get professional email on it. After you order, we email you the few DNS records to add — and if your domain is registered with us, our team adds them for you.",
  footnote = true,
}: {
  /** Analytics label for where the section is. */
  section: string;
  eyebrow?: string;
  title?: string;
  intro?: string;
  /** "Hosting your website with us too?" line under the plans. */
  footnote?: boolean;
}) {
  const plans = useEmailPlans();
  const order = (plan: EmailPlan) => {
    trackCtaClick({ button_text: `Get ${plan.name}`, page_section: section, destination_url: `/client/order/hosting?type=email&plan=${plan.slug}` });
    startEmailOrder(plan.slug);
  };

  return (
    <section id="email-plans" className="pub-section-tint-dark scroll-mt-24 border-y border-white/8">
      <div className="mx-auto max-w-7xl px-4 py-20 sm:px-6 lg:px-8">
        <div className="mx-auto max-w-2xl text-center">
          <span className="eyebrow">{eyebrow}</span>
          <h2 className="mt-4 text-3xl font-black text-white sm:text-4xl">{title}</h2>
          <p className="mt-4 text-base leading-7 text-white/65">{intro}</p>
        </div>
        <div className="mt-12 grid gap-5 md:grid-cols-3">
          {plans.map((plan) => (
            <div key={plan.slug} className={`flex h-full flex-col rounded-3xl border p-6 ${plan.is_popular ? "border-primary/50 bg-primary/[0.07]" : "border-white/10 bg-white/[0.035]"}`}>
              <div className="flex items-center justify-between gap-2">
                <h3 className="text-xl font-black text-white">{plan.name}</h3>
                {plan.display_badge && <span className="rounded-full bg-primary px-2.5 py-1 text-[10px] font-black uppercase text-[#031006]">{plan.display_badge}</span>}
              </div>
              <p className="mt-2 text-sm leading-6 text-white/60">{plan.short_description}</p>
              <p className="mt-5 text-3xl font-black text-white">
                {plan.annual_price}
                <span className="text-sm font-bold text-white/50"> /year</span>
              </p>
              <ul className="mt-5 grid flex-1 gap-2 text-sm text-white/72">
                {plan.public_features.map((feature) => (
                  <li key={feature} className="flex gap-2"><CheckCircle2 className="mt-0.5 h-4 w-4 shrink-0 text-primary" /> {feature}</li>
                ))}
              </ul>
              <button
                type="button"
                onClick={() => order(plan)}
                className={
                  plan.is_popular
                    ? "mt-6 inline-flex min-h-12 items-center justify-center gap-2 rounded-full px-6 py-3 text-sm font-black text-[#031006] transition hover:-translate-y-0.5"
                    : "mt-6 inline-flex min-h-12 items-center justify-center gap-2 rounded-full border border-white/20 px-6 py-3 text-sm font-black text-white transition hover:border-white/50 hover:bg-white/5"
                }
                style={plan.is_popular ? { background: `linear-gradient(135deg, ${LIME.base}, ${LIME.deep})` } : undefined}
              >
                Get {plan.name} <ArrowRight className="h-4 w-4" />
              </button>
            </div>
          ))}
        </div>
        {footnote && (
          <p className="mt-8 text-center text-sm text-white/55">
            Hosting your website with us too? Every <a href="/web-hosting" className="font-bold text-primary hover:underline">hosting plan</a> already includes Green Mail with unlimited mailboxes.
          </p>
        )}
      </div>
    </section>
  );
}
