import { CheckCircle2, HardDrive, Globe, Mail } from "lucide-react";
import type { HostingPlanCard } from "./types";

/** Mirrors HostingPlan::UNLIMITED_EMAIL_ACCOUNTS on the backend. */
export const UNLIMITED_EMAIL_ACCOUNTS = 9999;

export const WEBSITE_CARE_HEADLINE = "Reliable Hosting. Unlimited Business Email. Expert Support.";
export const WEBSITE_CARE_SUBTEXT =
  "Keep your business online with reliable hosting, unlimited professional business email, SSL, backups and technical support from NAI TALK.";
export const EMAIL_FAIR_USE_NOTE =
  "Unlimited email accounts. Storage is subject to your plan's allocated resources and fair-use/server policies.";

/**
 * Turns a /public/hosting-plans row into the card model. Only the annual
 * price is shown anywhere on the public site.
 */
export function toHostingPlanCard(plan: Record<string, unknown>): HostingPlanCard {
  return {
    name: String(plan.name || "Website Care Plan"),
    slug: String(plan.slug || ""),
    audience: String(plan.short_description || "Website care for your business"),
    annual: String(plan.annual_price || ""),
    storage: String(plan.storage_allocation || ""),
    websites: Number(plan.websites) || 1,
    featured: Boolean(plan.is_popular),
    badge: plan.display_badge ? String(plan.display_badge) : null,
    ctaLabel: plan.cta_label ? String(plan.cta_label) : "Choose plan",
    features: Array.isArray(plan.public_features) ? plan.public_features.map(String) : [],
  };
}

export function websitesLabel(count: number) {
  return `${count} ${count === 1 ? "website" : "websites"}`;
}

/** The three things buyers compare first, kept prominent on every card. */
export function PlanHighlights({ plan }: { plan: Pick<HostingPlanCard, "storage" | "websites"> }) {
  const items: Array<[typeof HardDrive, string]> = [
    [Globe, websitesLabel(plan.websites)],
    [HardDrive, `${plan.storage} storage`],
    [Mail, "Unlimited business email"],
  ];

  return (
    <ul className="mt-5 grid gap-2 rounded-lg border border-primary/25 bg-primary/[0.07] p-3.5">
      {items.map(([Icon, label]) => (
        <li key={label} className="flex items-center gap-2.5 text-sm font-black text-white">
          <Icon className="h-4 w-4 shrink-0 text-primary" />
          {label}
        </li>
      ))}
    </ul>
  );
}

export function PlanFeatureList({ features, className = "" }: { features: string[]; className?: string }) {
  return (
    <ul className={`grid gap-2.5 text-sm text-white/72 ${className}`}>
      {features.map((feature) => (
        <li key={feature} className="flex gap-2">
          <CheckCircle2 className="mt-0.5 h-4 w-4 shrink-0 text-primary" />
          {feature}
        </li>
      ))}
    </ul>
  );
}

export function PlanBadge({ label }: { label: string }) {
  return (
    <span className="absolute -top-3 left-6 inline-flex items-center rounded-full bg-primary px-3 py-1 text-[10px] font-black uppercase text-on-primary shadow-[0_6px_18px_rgba(155,234,22,0.35)]">
      {label}
    </span>
  );
}

export function WebsiteCareComparisonTable({ plans }: { plans: HostingPlanCard[] }) {
  return (
    <div className="mt-10">
      <h4 className="text-center text-xl font-black text-white">Compare plans</h4>
      <div className="mt-4 overflow-x-auto rounded-lg border border-white/10">
        <table className="w-full min-w-[34rem] border-collapse text-left text-sm">
          <thead>
            <tr className="bg-white/[0.05] text-xs font-black uppercase text-white/60">
              <th scope="col" className="px-4 py-3">Plan</th>
              <th scope="col" className="px-4 py-3">Annual Price</th>
              <th scope="col" className="px-4 py-3">Websites</th>
              <th scope="col" className="px-4 py-3">Storage</th>
              <th scope="col" className="px-4 py-3">Business Emails</th>
            </tr>
          </thead>
          <tbody>
            {plans.map((plan) => (
              <tr key={plan.slug} className={`border-t border-white/10 ${plan.featured ? "bg-primary/[0.08]" : ""}`}>
                <th scope="row" className="px-4 py-3 font-black text-white">
                  {plan.name.replace(/ Website Care$/, "")}
                  {plan.featured && <span className="ml-2 rounded-full bg-primary px-2 py-0.5 text-[10px] font-black uppercase text-on-primary">Most Popular</span>}
                </th>
                <td className="px-4 py-3 font-bold text-white">{plan.annual}</td>
                <td className="px-4 py-3 text-white/72">{plan.websites}</td>
                <td className="px-4 py-3 text-white/72">{plan.storage}</td>
                <td className="px-4 py-3 text-white/72">Unlimited</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      <p className="mt-3 text-center text-xs leading-5 text-white/50">{EMAIL_FAIR_USE_NOTE}</p>
    </div>
  );
}
