import React, { useEffect, useState } from "react";
import { CheckCircle2, Loader2, ShieldCheck } from "lucide-react";
import { LARAVEL_API_BASE_URL, laravelApi } from "../shared/api";
import { TermsAgreement } from "../components/TermsAgreement";
import type { useToast } from "../toast/ToastProvider";

/** A service that can be ordered on its own (e.g. the SSL certificate). */
export type PublicServiceOffering = {
  name: string;
  slug: string;
  short_description: string;
  benefits: string[];
  price_kobo: number;
  price: string;
  vat_rate: number;
  total_kobo: number;
  billing_type: string;
  requires_domain: boolean;
};

export function useServiceOffering(slug: string | null) {
  const [offering, setOffering] = useState<PublicServiceOffering | null>(null);
  const [missing, setMissing] = useState(false);

  useEffect(() => {
    if (!slug) {
      setMissing(true);
      return;
    }
    fetch(`${LARAVEL_API_BASE_URL}/api/v1/public/service-offerings/${encodeURIComponent(slug)}`, { headers: { Accept: "application/json" } })
      .then((response) => (response.ok ? response.json() : Promise.reject()))
      .then(setOffering)
      .catch(() => setMissing(true));
  }, [slug]);

  return { offering, missing };
}

export const formatKobo = (kobo: number) => `₦${(kobo / 100).toLocaleString("en-NG", { maximumFractionDigits: 2 })}`;

/**
 * Client area: order a stand-alone service. Creates the invoice and opens it
 * for payment; once paid, a setup ticket is opened and our team reaches out.
 */
export function ServiceOrderPage({
  token,
  slug,
  navigate,
  toast,
}: {
  token: string;
  slug: string | null;
  navigate: (path: string) => void;
  toast: ReturnType<typeof useToast>;
}) {
  const { offering, missing } = useServiceOffering(slug);
  const [domain, setDomain] = useState(() => new URLSearchParams(window.location.search).get("domain") ?? "");
  const [notes, setNotes] = useState("");
  const [terms, setTerms] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  if (missing) {
    return (
      <section className="portal-card mx-auto max-w-lg text-center">
        <h2 className="text-xl font-black text-white">This service can't be ordered online</h2>
        <p className="mt-3 text-sm text-white/60">Browse the services catalog, or open a support ticket and we'll help.</p>
        <button type="button" className="btn-primary mt-5 justify-center" onClick={() => navigate("/client/services/catalog")}>
          View services
        </button>
      </section>
    );
  }

  if (!offering) {
    return (
      <section className="flex justify-center py-16 text-white/50">
        <Loader2 className="h-6 w-6 animate-spin" />
      </section>
    );
  }

  const vat = offering.total_kobo - offering.price_kobo;

  const submit = async (event: React.FormEvent) => {
    event.preventDefault();
    setBusy(true);
    setError(null);
    try {
      const result = await laravelApi<{ invoice: { invoice_number: string } }>("/api/v1/client/orders/service", token, {
        method: "POST",
        body: JSON.stringify({ offering: offering.slug, domain: domain.trim() || null, notes: notes.trim() || null, terms_accepted: terms }),
      });
      toast.push({ type: "success", message: "Order placed. Pay the invoice to confirm it — our team will then reach out to set it up." });
      navigate(`/client/invoices/${result.invoice.invoice_number}`);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Could not place the order.");
    } finally {
      setBusy(false);
    }
  };

  return (
    <section className="grid gap-5 lg:grid-cols-[1fr_320px]">
      <form className="portal-card" onSubmit={submit}>
        <div className="flex items-center gap-3">
          <span className="flex h-11 w-11 items-center justify-center rounded-lg border border-primary/30 bg-primary/10 text-primary">
            <ShieldCheck className="h-5 w-5" />
          </span>
          <div>
            <h2 className="text-2xl font-black text-white">Order {offering.name}</h2>
            <p className="text-sm text-white/60">{offering.short_description}</p>
          </div>
        </div>

        <ul className="mt-5 grid gap-2 sm:grid-cols-2">
          {offering.benefits.map((benefit) => (
            <li key={benefit} className="flex gap-2 text-sm text-white/75">
              <CheckCircle2 className="mt-0.5 h-4 w-4 shrink-0 text-primary" /> {benefit}
            </li>
          ))}
        </ul>

        <div className="mt-6 grid gap-4">
          <label className="admin-field">
            <span>{offering.requires_domain ? "Website to secure" : "Website (optional)"}</span>
            <input
              value={domain}
              onChange={(event) => setDomain(event.target.value)}
              placeholder="yourbusiness.com"
              required={offering.requires_domain}
              autoCapitalize="none"
              autoCorrect="off"
              spellCheck={false}
            />
          </label>
          <label className="admin-field">
            <span>Anything we should know? (optional)</span>
            <textarea value={notes} onChange={(event) => setNotes(event.target.value)} maxLength={2000} rows={3} placeholder="e.g. who hosts the website, or the best time to reach you" />
          </label>
        </div>

        <div className="mt-5 rounded-lg border border-primary/25 bg-primary/[0.06] p-4 text-sm leading-6 text-white/75">
          <strong className="text-white">What happens next:</strong> pay the invoice, and our team will reach out to you (by email and through a support ticket) to set up your {offering.name.toLowerCase()} on your website.
        </div>

        <TermsAgreement checked={terms} onChange={setTerms} className="mt-5" />
        {error && <p className="mt-4 rounded-md bg-red-500/10 px-3 py-2 text-sm text-red-300">{error}</p>}
        <button type="submit" className="btn-primary mt-5 w-full justify-center sm:w-auto" disabled={busy || !terms}>
          {busy ? <Loader2 className="h-4 w-4 animate-spin" /> : null} Continue to payment
        </button>
      </form>

      <aside className="portal-card h-fit">
        <h3 className="text-sm font-black uppercase text-white/50">Order summary</h3>
        <div className="mt-4 grid gap-2 text-sm text-white/75">
          <div className="flex justify-between gap-3">
            <span>{offering.name}{offering.billing_type === "yearly" ? " (1 year)" : ""}</span>
            <span>{formatKobo(offering.price_kobo)}</span>
          </div>
          {vat > 0 && (
            <div className="flex justify-between gap-3">
              <span>VAT ({Math.round(offering.vat_rate * 1000) / 10}%)</span>
              <span>{formatKobo(vat)}</span>
            </div>
          )}
          <div className="mt-2 flex justify-between gap-3 border-t border-white/10 pt-3 text-base font-black text-white">
            <span>Total</span>
            <span>{formatKobo(offering.total_kobo)}</span>
          </div>
        </div>
        <p className="mt-4 text-xs leading-5 text-white/50">Pay by card, bank transfer or your NAI TALK wallet on the next page.</p>
      </aside>
    </section>
  );
}
