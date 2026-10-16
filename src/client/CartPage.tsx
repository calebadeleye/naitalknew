import React, { useEffect, useState } from "react";
import { AlertTriangle, ArrowRight, Globe2, Loader2, PackageCheck, Server, ShieldCheck, ShoppingCart, Trash2 } from "lucide-react";
import { laravelApi } from "../shared/api";
import { TermsAgreement } from "../components/TermsAgreement";
import type { useToast } from "../toast/ToastProvider";
import { toApiLines, useCart, type CartLine } from "./cart";

type QuotedLine = {
  index: number;
  type: CartLine["type"];
  title: string;
  subtitle: string | null;
  items: Array<{ description: string; amount_kobo: number }>;
  subtotal_kobo: number;
  error?: string;
};

type Quote = { lines: QuotedLine[]; subtotal_kobo: number; vat_rate: number; vat_kobo: number; total_kobo: number; has_errors: boolean };

export type CartCheckout = { order: { order_number: string }; invoice: { invoice_number: string; total_kobo: number; total?: string } };

const naira = (kobo: number) => `₦${(kobo / 100).toLocaleString("en-NG", { maximumFractionDigits: 2 })}`;

const ICON = { hosting: Server, domain: Globe2, service: ShieldCheck } as const;

/**
 * The cart page: everything collected so far, priced by the server, with one
 * checkout for all of it (one order, one invoice, one payment).
 */
export function CartPage({
  token,
  navigate,
  toast,
  onPlaced,
}: {
  token: string;
  navigate: (path: string) => void;
  toast: ReturnType<typeof useToast>;
  onPlaced: (result: CartCheckout) => void;
}) {
  const cart = useCart();
  const [quoted, setQuoted] = useState<{ signature: string; quote: Quote } | null>(null);
  const [loading, setLoading] = useState(false);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [terms, setTerms] = useState(false);
  const [placing, setPlacing] = useState(false);

  // Re-priced whenever the cart changes (the server is the only source of prices).
  const signature = JSON.stringify(toApiLines(cart.lines));
  useEffect(() => {
    if (cart.lines.length === 0) {
      setQuoted(null);
      return;
    }
    let cancelled = false;
    setLoading(true);
    setLoadError(null);
    laravelApi<Quote>("/api/v1/client/cart/quote", token, { method: "POST", body: JSON.stringify({ lines: toApiLines(cart.lines) }) })
      .then((result) => !cancelled && setQuoted({ signature, quote: result }))
      .catch((error) => !cancelled && setLoadError(error instanceof Error ? error.message : "Could not price your cart."))
      .finally(() => !cancelled && setLoading(false));
    return () => {
      cancelled = true;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [signature, token]);

  // Prices are only shown for exactly this cart — never a stale list after a removal.
  const quote = quoted && quoted.signature === signature ? quoted.quote : null;

  const placeOrder = async () => {
    setPlacing(true);
    try {
      const result = await laravelApi<CartCheckout>("/api/v1/client/orders/cart", token, {
        method: "POST",
        body: JSON.stringify({ lines: toApiLines(cart.lines), terms_accepted: terms }),
      });
      toast.push({ type: "success", message: `Order ${result.order.order_number} created. Invoice ${result.invoice.invoice_number} has been emailed to you.` });
      onPlaced(result);
    } catch (error) {
      toast.push({ type: "error", message: error instanceof Error ? error.message : "Your order could not be placed." });
    } finally {
      setPlacing(false);
    }
  };

  const shortcuts = (
    <div className="flex flex-wrap gap-2">
      <button type="button" className="btn-outline !min-h-10 !px-4 !text-[11px]" onClick={() => navigate("/client/order/hosting")}>
        <Server className="h-4 w-4" /> Add hosting
      </button>
      <button type="button" className="btn-outline !min-h-10 !px-4 !text-[11px]" onClick={() => navigate("/client/domains/search")}>
        <Globe2 className="h-4 w-4" /> Add a domain
      </button>
      <button type="button" className="btn-outline !min-h-10 !px-4 !text-[11px]" onClick={() => navigate("/client/order/service?offering=ssl-certificate")}>
        <ShieldCheck className="h-4 w-4" /> Add SSL
      </button>
    </div>
  );

  if (cart.lines.length === 0) {
    return (
      <section className="portal-card mx-auto max-w-xl text-center">
        <span className="mx-auto flex h-14 w-14 items-center justify-center rounded-full border border-primary/30 bg-primary/10 text-primary">
          <ShoppingCart className="h-6 w-6" />
        </span>
        <h2 className="mt-4 text-xl font-black text-white">Your cart is empty</h2>
        <p className="mt-2 text-sm text-white/60">Add hosting, a domain or an SSL certificate — as many as you like — then check out once.</p>
        <div className="mt-5 flex justify-center">{shortcuts}</div>
        <button type="button" className="auth-link mt-5 text-sm" onClick={() => navigate("/client/services/catalog")}>
          <PackageCheck className="mr-1 inline h-4 w-4" /> Browse all services
        </button>
      </section>
    );
  }

  return (
    <section className="grid gap-5 lg:grid-cols-[minmax(0,1fr)_340px]">
      <div className="grid min-w-0 grid-cols-[minmax(0,1fr)] content-start gap-4">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <h2 className="text-2xl font-black text-white">Your cart ({cart.count})</h2>
          {shortcuts}
        </div>

        {cart.lines.map((line, index) => {
          const priced = quote?.lines[index];
          const Icon = ICON[line.type];
          return (
            <article key={line.id} className={`portal-card ${priced?.error ? "!border-red-400/50" : ""}`}>
              <div className="flex items-start gap-3">
                <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg border border-primary/30 bg-primary/10 text-primary">
                  <Icon className="h-5 w-5" />
                </span>
                <div className="min-w-0 flex-1">
                  <h3 className="font-black text-white">{priced?.title ?? (line.type === "hosting" ? "Hosting" : line.type === "domain" ? "Domain Registration" : "Service")}</h3>
                  <p className="truncate text-sm text-white/60">
                    {priced?.subtitle ?? (line.type === "hosting" ? line.primary_domain : line.type === "domain" ? line.domain_name : line.domain ?? "")}
                  </p>
                </div>
                <div className="text-right">
                  {priced && !priced.error && <p className="font-black text-white">{naira(priced.subtotal_kobo)}</p>}
                  <button type="button" className="mt-1 inline-flex items-center gap-1 text-xs font-bold text-white/50 hover:text-red-300" onClick={() => cart.remove(line.id)} aria-label={`Remove ${priced?.title ?? "item"} from cart`}>
                    <Trash2 className="h-3.5 w-3.5" /> Remove
                  </button>
                </div>
              </div>
              {priced?.error ? (
                <p className="mt-3 flex items-start gap-2 rounded-md bg-red-500/10 px-3 py-2 text-sm text-red-300">
                  <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0" /> {priced.error} Remove it to continue.
                </p>
              ) : (
                priced && (
                  <ul className="mt-3 grid grid-cols-[minmax(0,1fr)] gap-1 border-t border-white/8 pt-3 text-sm text-white/65">
                    {priced.items.map((item) => (
                      <li key={item.description} className="flex justify-between gap-3">
                        <span className="min-w-0 truncate">{item.description}</span>
                        <span className="shrink-0">{naira(item.amount_kobo)}</span>
                      </li>
                    ))}
                  </ul>
                )
              )}
            </article>
          );
        })}
        {loading && !quote && (
          <p className="flex items-center gap-2 text-sm text-white/50">
            <Loader2 className="h-4 w-4 animate-spin" /> Pricing your cart…
          </p>
        )}
        {loadError && <p className="rounded-md bg-red-500/10 px-3 py-2 text-sm text-red-300">{loadError}</p>}
      </div>

      <aside className="portal-card h-fit lg:sticky lg:top-4">
        <h3 className="text-sm font-black uppercase text-white/50">Order summary</h3>
        <div className="mt-4 grid gap-2 text-sm text-white/75">
          <div className="flex justify-between"><span>Subtotal</span><span>{quote ? naira(quote.subtotal_kobo) : "—"}</span></div>
          <div className="flex justify-between"><span>VAT {quote ? `(${Math.round(quote.vat_rate * 1000) / 10}%)` : ""}</span><span>{quote ? naira(quote.vat_kobo) : "—"}</span></div>
        </div>
        <div className="mt-4 flex items-center justify-between border-t border-white/10 pt-4">
          <span className="text-sm font-bold text-white/68">Total payable</span>
          <span className="text-2xl font-black text-white">{quote ? naira(quote.total_kobo) : "—"}</span>
        </div>
        <p className="mt-3 text-xs leading-5 text-white/50">One invoice for everything in your cart. You'll choose how to pay next: card, bank transfer or wallet.</p>
        <TermsAgreement className="mt-4" checked={terms} onChange={setTerms} />
        <button type="button" className="btn-primary mt-4 w-full justify-center" disabled={placing || loading || !quote || quote.has_errors || !terms} onClick={() => void placeOrder()}>
          {placing ? <Loader2 className="h-4 w-4 animate-spin" /> : null} {placing ? "Creating order…" : "Place order"} <ArrowRight className="h-4 w-4" />
        </button>
        {quote?.has_errors && <p className="mt-2 text-xs text-red-300">Remove the items marked in red to continue.</p>}
      </aside>
    </section>
  );
}
