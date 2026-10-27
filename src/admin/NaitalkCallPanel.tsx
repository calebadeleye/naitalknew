import React, { useCallback, useEffect, useState } from "react";
import { Copy, KeyRound, PhoneCall, RefreshCw } from "lucide-react";
import { laravelApi } from "../shared/api";

export type NaitalkCallTenantRow = {
  id: number;
  business_name: string;
  contact_email: string | null;
  plan: string;
  monthly_price_usd: string;
  monthly_price_ngn: string | null;
  status: "active" | "suspended" | "cancelled";
  room_prefix: string;
  key_source: "managed" | "server";
  api_key: string | null;
  webhook_url: string | null;
  minutes_this_month: number | null;
};

type Payload = {
  data: NaitalkCallTenantRow[];
  plan: { name: string; monthly_usd: string; exchange_rate: number | null; monthly_ngn_kobo: number | null };
  plans: Array<{ id: string; name: string; monthly_usd: string }>;
  public_url: string;
  last_sync: { status: string; message?: string | null; at: string } | null;
};

type IssuedKey = { business: string; apiKey: string; secret: string };

/** "Acme Clinics Ltd" → "acme-clinics-ltd": the start of every room name the business uses. */
export function roomPrefixFor(name: string): string {
  return name.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-+|-+$/g, "").slice(0, 32).replace(/-+$/, "");
}

/** Admin: businesses on Naitalk Call — onboard, issue keys, suspend, see minutes. */
export function NaitalkCallPanel({ adminToken }: { adminToken: string }) {
  const [data, setData] = useState<Payload | null>(null);
  const [notice, setNotice] = useState<string | null>(null);
  const [issued, setIssued] = useState<IssuedKey | null>(null);
  const [busyId, setBusyId] = useState<number | "new" | null>(null);
  const emptyForm = { business_name: "", contact_email: "", room_prefix: "", webhook_url: "", plan: "business" };
  const [form, setForm] = useState(emptyForm);
  const [prefixTouched, setPrefixTouched] = useState(false);

  const load = useCallback(() => {
    laravelApi<Payload>("/api/v1/admin/naitalk-call/tenants", adminToken)
      .then(setData)
      .catch(() => setNotice("Could not load Naitalk Call businesses."));
  }, [adminToken]);

  useEffect(() => {
    load();
  }, [load]);

  const onboard = async (event: React.FormEvent) => {
    event.preventDefault();
    setBusyId("new");
    setNotice(null);
    try {
      const response = await laravelApi<{ data: NaitalkCallTenantRow; api_secret: string }>("/api/v1/admin/naitalk-call/tenants", adminToken, {
        method: "POST",
        body: JSON.stringify({ ...form, contact_email: form.contact_email || null, webhook_url: form.webhook_url || null }),
      });
      setIssued({ business: response.data.business_name, apiKey: response.data.api_key ?? "", secret: response.api_secret });
      setForm(emptyForm);
      setPrefixTouched(false);
      load();
    } catch (error) {
      setNotice(error instanceof Error ? error.message : "Could not onboard the business.");
    } finally {
      setBusyId(null);
    }
  };

  const save = async (row: NaitalkCallTenantRow, changes: Partial<Pick<NaitalkCallTenantRow, "status" | "plan">>) => {
    setBusyId(row.id);
    setNotice(null);
    try {
      await laravelApi(`/api/v1/admin/naitalk-call/tenants/${row.id}`, adminToken, {
        method: "PUT",
        body: JSON.stringify({ business_name: row.business_name, room_prefix: row.room_prefix, contact_email: row.contact_email, webhook_url: row.webhook_url, ...changes }),
      });
      load();
    } catch (error) {
      setNotice(error instanceof Error ? error.message : "Could not update the business.");
    } finally {
      setBusyId(null);
    }
  };

  const rotate = async (row: NaitalkCallTenantRow) => {
    if (!window.confirm(`Issue a new key for ${row.business_name}? Their current key stops working at the next server sync.`)) return;
    setBusyId(row.id);
    setNotice(null);
    try {
      const response = await laravelApi<{ data: NaitalkCallTenantRow; api_secret: string }>(`/api/v1/admin/naitalk-call/tenants/${row.id}/rotate-key`, adminToken, { method: "POST" });
      setIssued({ business: row.business_name, apiKey: response.data.api_key ?? "", secret: response.api_secret });
      load();
    } catch (error) {
      setNotice(error instanceof Error ? error.message : "Could not issue a new key.");
    } finally {
      setBusyId(null);
    }
  };

  if (!data) {
    return <section className="admin-panel text-sm font-bold text-white/60">{notice ?? "Loading..."}</section>;
  }

  const naira = data.plan.monthly_ngn_kobo === null ? null : `₦${(data.plan.monthly_ngn_kobo / 100).toLocaleString("en-NG")}`;

  return (
    <section className="admin-panel">
      <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
        <div>
          <h2 className="flex items-center gap-2 text-2xl font-black"><PhoneCall className="h-6 w-6 text-primary" /> Naitalk Call</h2>
          <p className="mt-1 max-w-2xl text-sm text-white/55">
            Businesses using our LiveKit call server. New keys reach the server when its sync runs (every few minutes, and only while no calls are live,
            because the media server restarts to load them). Apps connect to <span className="font-mono text-white/75">{data.public_url}</span>.
          </p>
        </div>
        <button type="button" className="btn-outline justify-center !text-[11px]" onClick={load}>
          <RefreshCw className="h-4 w-4" /> Refresh
        </button>
      </div>

      <div className="mt-4 grid gap-3 sm:grid-cols-2">
        <div className="rounded-lg border border-white/10 bg-black/20 p-4 text-sm">
          <p className="text-xs font-bold uppercase tracking-wide text-white/45">{data.plan.name}</p>
          <p className="mt-1 text-lg font-black">
            {data.plan.monthly_usd} / month{naira && <span className="text-white/60"> ≈ {naira}</span>}
          </p>
          <p className="mt-1 text-xs text-white/50">
            {data.plan.exchange_rate
              ? `At ₦${data.plan.exchange_rate.toLocaleString("en-NG")} per $1, the rate set under Domain Pricing.`
              : "Set the USD→NGN rate under Domain Pricing to show the Naira price."}
          </p>
        </div>
        <div className="rounded-lg border border-white/10 bg-black/20 p-4 text-sm" data-testid="naitalk-call-sync">
          <p className="text-xs font-bold uppercase tracking-wide text-white/45">Server sync</p>
          {data.last_sync ? (
            <>
              <p className="mt-1 font-black capitalize">{data.last_sync.status}</p>
              <p className="mt-1 text-xs text-white/50">
                {new Date(data.last_sync.at).toLocaleString()}
                {data.last_sync.message ? ` — ${data.last_sync.message}` : ""}
              </p>
            </>
          ) : (
            <p className="mt-1 text-xs text-yellow-200">The server has not synced yet. Install the sync timer on mail.naitalk.com.</p>
          )}
        </div>
      </div>

      {issued && (
        <div className="mt-4 rounded-lg border border-primary/40 bg-primary/10 p-4 text-sm" role="status">
          <p className="font-black">Key for {issued.business}. Copy the secret now; it is not shown again.</p>
          <dl className="mt-2 grid gap-1 font-mono text-xs">
            <div><dt className="inline text-white/50">API key: </dt><dd className="inline">{issued.apiKey}</dd></div>
            <div><dt className="inline text-white/50">API secret: </dt><dd className="inline break-all">{issued.secret}</dd></div>
          </dl>
          <div className="mt-3 flex gap-2">
            <button
              type="button"
              className="btn-outline !min-h-9 !px-3 !py-1.5 !text-[10px]"
              onClick={() => void navigator.clipboard?.writeText(`LIVEKIT_URL=${data.public_url}\nLIVEKIT_API_KEY=${issued.apiKey}\nLIVEKIT_API_SECRET=${issued.secret}\n`)}
            >
              <Copy className="h-3.5 w-3.5" /> Copy as .env
            </button>
            <button type="button" className="btn-outline !min-h-9 !px-3 !py-1.5 !text-[10px]" onClick={() => setIssued(null)}>Done</button>
          </div>
        </div>
      )}

      {notice && <p className="mt-4 text-sm font-bold text-yellow-200">{notice}</p>}

      <div className="mt-6 overflow-x-auto">
        <table className="w-full min-w-[760px] text-left text-xs">
          <thead className="text-white/45">
            <tr>
              <th className="py-1.5 font-bold">Business</th>
              <th className="py-1.5 font-bold">Rooms</th>
              <th className="py-1.5 font-bold">API key</th>
              <th className="py-1.5 font-bold">Plan</th>
              <th className="py-1.5 text-right font-bold">Minutes this month</th>
              <th className="py-1.5 font-bold">Status</th>
              <th className="py-1.5" />
            </tr>
          </thead>
          <tbody className="text-white/75">
            {data.data.map((row) => (
              <tr key={row.id} className="border-t border-white/10 align-top">
                <td className="py-2">
                  <span className="font-bold text-white">{row.business_name}</span>
                  {row.contact_email && <span className="block text-white/45">{row.contact_email}</span>}
                </td>
                <td className="py-2 font-mono">{row.room_prefix}-…</td>
                <td className="py-2 font-mono">{row.key_source === "server" ? <span className="text-white/45">kept on server</span> : row.api_key}</td>
                <td className="py-2">
                  <select
                    aria-label={`Plan for ${row.business_name}`}
                    className="rounded border border-white/15 bg-black/40 px-2 py-1 text-xs"
                    value={row.plan}
                    disabled={busyId === row.id}
                    onChange={(event) => void save(row, { plan: event.target.value })}
                  >
                    {data.plans.map((plan) => (
                      <option key={plan.id} value={plan.id}>{plan.name}</option>
                    ))}
                  </select>
                  <span className="mt-1 block">
                    {row.monthly_price_usd}
                    {row.monthly_price_ngn && <span className="text-white/45"> ≈ {row.monthly_price_ngn}</span>}
                  </span>
                </td>
                <td className="py-2 text-right">{(row.minutes_this_month ?? 0).toLocaleString()}</td>
                <td className="py-2 capitalize">{row.status}</td>
                <td className="py-2">
                  <div className="flex flex-wrap justify-end gap-2">
                    {row.status === "active" ? (
                      <button type="button" className="btn-outline !min-h-9 !px-3 !py-1.5 !text-[10px]" disabled={busyId === row.id} onClick={() => void save(row, { status: "suspended" })}>
                        Suspend
                      </button>
                    ) : (
                      <button type="button" className="btn-outline !min-h-9 !px-3 !py-1.5 !text-[10px]" disabled={busyId === row.id} onClick={() => void save(row, { status: "active" })}>
                        Activate
                      </button>
                    )}
                    {row.key_source === "managed" && (
                      <button type="button" className="btn-outline !min-h-9 !px-3 !py-1.5 !text-[10px]" disabled={busyId === row.id} onClick={() => void rotate(row)}>
                        <KeyRound className="h-3.5 w-3.5" /> New key
                      </button>
                    )}
                  </div>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      <form className="mt-6 grid gap-3 rounded-lg border border-white/10 bg-black/20 p-4 sm:grid-cols-2" onSubmit={(event) => void onboard(event)}>
        <h3 className="text-base font-black sm:col-span-2">Onboard a business</h3>
        <label className="admin-field">
          <span>Business name</span>
          <input
            required
            maxLength={120}
            value={form.business_name}
            onChange={(event) => {
              const business_name = event.target.value;
              setForm((current) => ({ ...current, business_name, room_prefix: prefixTouched ? current.room_prefix : roomPrefixFor(business_name) }));
            }}
          />
        </label>
        <label className="admin-field">
          <span>Contact email</span>
          <input type="email" maxLength={190} value={form.contact_email} onChange={(event) => setForm((current) => ({ ...current, contact_email: event.target.value }))} />
        </label>
        <label className="admin-field">
          <span>Room prefix (rooms are named prefix-…)</span>
          <input
            required
            maxLength={32}
            pattern="[a-z0-9]+(-[a-z0-9]+)*"
            value={form.room_prefix}
            onChange={(event) => {
              setPrefixTouched(true);
              setForm((current) => ({ ...current, room_prefix: event.target.value }));
            }}
          />
        </label>
        <label className="admin-field">
          <span>Webhook URL (optional)</span>
          <input type="url" maxLength={255} placeholder="https://api.example.com/livekit/webhook" value={form.webhook_url} onChange={(event) => setForm((current) => ({ ...current, webhook_url: event.target.value }))} />
        </label>
        <label className="admin-field">
          <span>Plan</span>
          <select value={form.plan} onChange={(event) => setForm((current) => ({ ...current, plan: event.target.value }))}>
            {data.plans.map((plan) => (
              <option key={plan.id} value={plan.id}>{plan.name} — {plan.monthly_usd}</option>
            ))}
          </select>
        </label>
        <div className="sm:col-span-2">
          <button type="submit" className="btn-primary" disabled={busyId === "new" || !form.business_name.trim() || !form.room_prefix}>
            {busyId === "new" ? "Creating..." : `Create key — ${data.plans.find((plan) => plan.id === form.plan)?.name ?? "Business"}`}
          </button>
        </div>
      </form>
    </section>
  );
}
