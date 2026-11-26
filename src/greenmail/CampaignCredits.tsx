import React, { useState } from "react";
import { Loader2, ShoppingCart, X } from "lucide-react";
import { gm, type CampaignQuota } from "./api";
import { useFeedback } from "./feedback";

const naira = (kobo: number) => `₦${(kobo / 100).toLocaleString("en-NG", { maximumFractionDigits: 0 })}`;
const day = (iso: string) => new Date(iso).toLocaleDateString("en-US", { month: "short", day: "numeric" });

/** "Emails left this month" with a bar, credits, and Buy more. */
export function QuotaMeter({ quota, onBuy }: { quota: CampaignQuota; onBuy: () => void }) {
  if (quota.unlimited === true) return null;
  const used = quota.allowance ? Math.min(100, Math.round((quota.used / quota.allowance) * 100)) : 100;
  const low = quota.available === 0 || (quota.credits === 0 && used >= 80);

  return (
    <div className={`mt-3 rounded-xl border p-3 ${low ? "border-amber-300 bg-amber-50" : "border-slate-200"}`}>
      <div className="flex flex-wrap items-center gap-x-3 gap-y-1">
        <p className="mr-auto text-sm text-slate-700">
          <span className="font-bold text-slate-900">{quota.left.toLocaleString()}</span> of {quota.allowance.toLocaleString()} campaign emails left this month
          {quota.credits > 0 && (
            <>
              {" "}· <span className="font-bold text-slate-900">{quota.credits.toLocaleString()}</span> bought
            </>
          )}
        </p>
        {quota.can_buy && (
          <button type="button" onClick={onBuy} className="inline-flex items-center gap-1.5 rounded-lg bg-[#1f9d4c] px-3 py-1.5 text-xs font-bold text-white">
            <ShoppingCart className="h-3.5 w-3.5" /> Buy more emails
          </button>
        )}
      </div>
      <div className="mt-2 h-1.5 overflow-hidden rounded-full bg-slate-100">
        <div className={`h-full ${low ? "bg-amber-500" : "bg-[#22a04f]"}`} style={{ width: `${used}%` }} />
      </div>
      <p className="mt-1.5 text-xs text-slate-500">
        {quota.plan ? `Included with ${quota.plan}` : "Included with your hosting"} · resets {day(quota.resets_at)}
        {quota.credits > 0 && quota.credits_expire_at ? ` · bought emails used after these, valid until ${day(quota.credits_expire_at)}` : ""}
        {quota.available === 0 ? " · Campaigns are paused until you buy more or the month resets." : ""}
        {!quota.can_buy ? " · To buy more, contact NAI TALK support." : ""}
      </p>
    </div>
  );
}

/** Pick a pack and pay by card; the payment page brings you back to Campaigns. */
export function BuyEmailsDialog({ token, quota, onClose, onSessionError }: { token: string; quota: CampaignQuota; onClose: () => void; onSessionError: (error: unknown) => void }) {
  const { toast } = useFeedback();
  const [busy, setBusy] = useState<number | null>(null);

  const buy = async (emails: number) => {
    setBusy(emails);
    try {
      const { url } = await gm<{ url: string }>("/campaigns/credits/checkout", token, { method: "POST", body: JSON.stringify({ emails }) });
      window.location.assign(url);
    } catch (error) {
      onSessionError(error);
      toast(error instanceof Error ? error.message : "Payment could not be started.", "error");
      setBusy(null);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/40 p-4" role="dialog" aria-modal="true" aria-label="Buy campaign emails">
      <div className="w-full max-w-md rounded-2xl bg-white p-5 shadow-xl">
        <div className="flex items-start gap-2">
          <div className="mr-auto">
            <h2 className="text-lg font-black text-slate-900">Buy campaign emails</h2>
            <p className="text-sm text-slate-500">Used after this month's free emails. Valid for 12 months.</p>
          </div>
          <button type="button" aria-label="Close" onClick={onClose} className="rounded p-1 text-slate-500 hover:bg-slate-100">
            <X className="h-5 w-5" />
          </button>
        </div>
        <div className="mt-4 grid gap-2">
          {quota.packs.map((pack, index) => (
            <button
              key={pack.emails}
              type="button"
              disabled={busy !== null}
              onClick={() => void buy(pack.emails)}
              className="flex items-center gap-3 rounded-xl border border-slate-200 px-4 py-3 text-left hover:border-[#1f9d4c] disabled:opacity-60"
            >
              <span className="mr-auto">
                <span className="block font-bold text-slate-900">{pack.emails.toLocaleString()} emails</span>
                <span className="text-xs text-slate-500">
                  ₦{(pack.price_kobo / pack.emails / 100).toFixed(2)} per email
                  {index > 0 ? ` · save ${Math.round((1 - pack.price_kobo / pack.emails / (quota.packs[0].price_kobo / quota.packs[0].emails)) * 100)}%` : ""}
                </span>
              </span>
              {busy === pack.emails ? <Loader2 className="h-4 w-4 animate-spin text-slate-400" /> : <span className="font-black text-[#15803d]">{naira(pack.price_kobo)}</span>}
            </button>
          ))}
        </div>
        <p className="mt-3 text-xs text-slate-500">You'll pay by card on a secure payment page, then come straight back here. Paused campaigns carry on by themselves.</p>
      </div>
    </div>
  );
}
