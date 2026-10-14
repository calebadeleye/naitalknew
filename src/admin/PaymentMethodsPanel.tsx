import React, { useEffect, useState } from "react";
import { CheckCircle2, CircleAlert, CreditCard, Loader2 } from "lucide-react";
import { laravelApi } from "../shared/api";

type MethodField = {
  name: string;
  label: string;
  secret: boolean;
  required: boolean;
  options: string[] | null;
  value: string | null;
  is_set: boolean;
  hint: string | null;
  from_env: boolean;
};

type Method = { method: string; label: string; enabled: boolean; configured: boolean; fields: MethodField[] };

type Payload = { methods: Method[]; webhooks: Record<string, string>; warning?: string | null };

const NOTES: Record<string, string> = {
  paystack: "Charges in Naira. Cards paid through Paystack can be saved for automatic renewals.",
  flutterwave: "Charges in Naira. Cards paid through Flutterwave can be saved for automatic renewals.",
  stripe: "Clients pay on Stripe's checkout page. Choose the currency your Stripe account charges in and how many Naira one unit is worth — invoices are converted at that rate, rounded up.",
  paypal: "PayPal does not accept Naira, so invoices are converted to the currency below at your rate, rounded up. Use a REST app's Client ID and secret from developer.paypal.com.",
  bank_transfer: "Clients see your bank details, pay by transfer and upload proof; you confirm the payment under Payment Verification.",
};

/** Admin: which payment methods clients are offered, and each gateway's keys. */
export function PaymentMethodsPanel({ adminToken }: { adminToken: string }) {
  const [data, setData] = useState<Payload | null>(null);

  useEffect(() => {
    laravelApi<Payload>("/api/v1/admin/settings/payment-methods", adminToken).then(setData).catch(() => setData(null));
  }, [adminToken]);

  if (!data) return null;

  return (
    <section className="admin-panel">
      <div className="flex items-center gap-2">
        <CreditCard className="h-5 w-5 text-primary" />
        <h2 className="text-lg font-black text-white">Payment methods</h2>
      </div>
      <p className="mt-1 text-sm text-white/58">Clients only see the methods switched on here — and only once all their required keys are filled in.</p>
      <div className="mt-5 grid gap-4 xl:grid-cols-2">
        {data.methods.map((method) => (
          <React.Fragment key={method.method}>
            <MethodCard method={method} webhook={data.webhooks[method.method]} adminToken={adminToken} onSaved={setData} />
          </React.Fragment>
        ))}
      </div>
    </section>
  );
}

function MethodCard({ method, webhook, adminToken, onSaved }: { method: Method; webhook?: string; adminToken: string; onSaved: (payload: Payload) => void }) {
  const [enabled, setEnabled] = useState(method.enabled);
  const [values, setValues] = useState<Record<string, string>>(() =>
    Object.fromEntries(method.fields.map((field) => [field.name, field.secret ? "" : field.value ?? ""])),
  );
  const [isSaving, setIsSaving] = useState(false);
  const [notice, setNotice] = useState<{ text: string; isError: boolean } | null>(null);

  const save = async () => {
    setIsSaving(true);
    setNotice(null);
    try {
      const payload = await laravelApi<Payload>(`/api/v1/admin/settings/payment-methods/${method.method}`, adminToken, {
        method: "PUT",
        body: JSON.stringify({ enabled, values }),
      });
      onSaved(payload);
      setValues((current) => Object.fromEntries(Object.entries(current).map(([name, value]) => [name, method.fields.find((f) => f.name === name)?.secret ? "" : value])));
      setNotice(payload.warning ? { text: payload.warning, isError: true } : { text: "Saved.", isError: false });
    } catch (error) {
      setNotice({ text: error instanceof Error ? error.message : "Could not save.", isError: true });
    } finally {
      setIsSaving(false);
    }
  };

  const status = !method.enabled ? "Off" : method.configured ? "Live for clients" : "On — missing details";

  return (
    <div className="rounded-lg border border-white/10 bg-black/20 p-4">
      <div className="flex items-start justify-between gap-3">
        <div>
          <p className="font-black text-white">{method.label}</p>
          <p className={`mt-0.5 flex items-center gap-1 text-xs ${method.enabled && method.configured ? "text-primary" : method.enabled ? "text-yellow-200" : "text-white/45"}`}>
            {method.enabled && method.configured ? <CheckCircle2 className="h-3.5 w-3.5" /> : method.enabled ? <CircleAlert className="h-3.5 w-3.5" /> : null}
            {status}
          </p>
        </div>
        <label className="flex cursor-pointer items-center gap-2 text-xs font-bold text-white/70">
          <input type="checkbox" className="h-4 w-4 accent-[#b8f04a]" checked={enabled} onChange={(event) => setEnabled(event.target.checked)} />
          Offer to clients
        </label>
      </div>
      <p className="mt-2 text-xs leading-5 text-white/55">{NOTES[method.method]}</p>

      {method.fields.length > 0 && (
        <div className="mt-3 grid gap-3 sm:grid-cols-2">
          {method.fields.map((field) => (
            <label key={field.name} className={`admin-field ${field.secret ? "sm:col-span-2" : ""}`}>
              <span>
                {field.label}
                {field.required ? " *" : ""}
              </span>
              {field.options ? (
                <select value={values[field.name] ?? ""} onChange={(event) => setValues({ ...values, [field.name]: event.target.value })}>
                  {field.options.map((option) => (
                    <option key={option} value={option}>
                      {option}
                    </option>
                  ))}
                </select>
              ) : (
                <input
                  type={field.secret ? "password" : field.name === "ngn_rate" ? "number" : "text"}
                  step={field.name === "ngn_rate" ? "0.01" : undefined}
                  autoComplete="off"
                  value={values[field.name] ?? ""}
                  placeholder={field.secret && field.is_set ? `${field.hint} — leave blank to keep${field.from_env ? " (from .env)" : ""}` : field.name === "ngn_rate" ? "e.g. 1600" : ""}
                  onChange={(event) => setValues({ ...values, [field.name]: event.target.value })}
                />
              )}
            </label>
          ))}
        </div>
      )}

      {webhook && (
        <p className="mt-3 break-all text-[11px] text-white/50">
          Webhook URL to set in {method.label}: <code className="text-white/75">{webhook}</code>
        </p>
      )}

      <div className="mt-3 flex items-center justify-end gap-3">
        {notice && <span className={`text-xs ${notice.isError ? "text-yellow-200" : "text-primary"}`}>{notice.text}</span>}
        <button type="button" className="btn-primary !min-h-9 !text-[11px]" disabled={isSaving} onClick={() => void save()}>
          {isSaving ? <Loader2 className="h-4 w-4 animate-spin" /> : "Save"}
        </button>
      </div>
    </div>
  );
}
