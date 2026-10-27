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
  included_minutes: number;
  /** The client account that owns this app: who subscribes and pays (TYF for Cradle). */
  client: ClientOption | null;
  revoked_at: string | null;
};

export type ClientOption = { id: number; name: string | null; email: string | null; client_code: string | null };

export const clientLabel = (c: ClientOption) => c.name || c.email || `Client #${c.id}`;

/**
 * Search registered client accounts by company, email or client code. Only
 * registered accounts can subscribe, so there is no free-text entry.
 */
export function ClientPicker({ adminToken, value, onChange, label = "Client account" }: { adminToken: string; value: ClientOption | null; onChange: (client: ClientOption | null) => void; label?: string }) {
  const [query, setQuery] = useState("");
  const [results, setResults] = useState<ClientOption[] | null>(null);

  useEffect(() => {
    const q = query.trim();
    if (q.length < 2) {
      setResults(null);
      return;
    }
    const timer = setTimeout(() => {
      laravelApi<{ data: ClientOption[] }>(`/api/v1/admin/naitalk-call/clients?q=${encodeURIComponent(q)}`, adminToken)
        .then((response) => setResults(response.data))
        .catch(() => setResults([]));
    }, 250);
    return () => clearTimeout(timer);
  }, [query, adminToken]);

  if (value) {
    return (
      <div className="flex items-center justify-between gap-2 rounded-lg border border-primary/40 bg-primary/10 px-3 py-2 text-sm" data-testid="client-picked">
        <span>
          <span className="font-bold">{clientLabel(value)}</span>
          <span className="text-white/55"> · {[value.email, value.client_code].filter(Boolean).join(" · ")}</span>
        </span>
        <button type="button" className="text-xs font-bold text-primary" onClick={() => onChange(null)}>Change</button>
      </div>
    );
  }

  return (
    <div className="relative">
      <input
        aria-label={label}
        className="w-full"
        placeholder="Search by company, email or client code"
        value={query}
        onChange={(event) => setQuery(event.target.value)}
      />
      {results && (
        <ul className="absolute z-20 mt-1 max-h-64 w-full overflow-auto rounded-lg border border-white/15 bg-[#0b130b] text-sm shadow-xl" role="listbox">
          {results.length === 0 ? (
            <li className="px-3 py-2 text-white/55">No registered client matches. They need a client account on NAI TALK first.</li>
          ) : (
            results.map((client) => (
              <li key={client.id}>
                <button type="button" role="option" aria-selected={false} className="w-full px-3 py-2 text-left hover:bg-white/10" onClick={() => onChange(client)}>
                  <span className="font-bold">{clientLabel(client)}</span>
                  <span className="block text-xs text-white/55">{[client.email, client.client_code].filter(Boolean).join(" · ")}</span>
                </button>
              </li>
            ))
          )}
        </ul>
      )}
    </div>
  );
}

/** "12,300 of 50,000 (25%)" and how full the plan is, for the usage column. */
export function usageSummary(used: number, included: number): { text: string; percent: number } {
  const percent = included > 0 ? Math.round((used / included) * 100) : 0;
  return { text: `${used.toLocaleString("en-NG")} of ${included.toLocaleString("en-NG")} (${percent}%)`, percent };
}

type Payload = {
  data: NaitalkCallTenantRow[];
  plans: Array<{ id: string; name: string; monthly_usd: string; monthly_ngn: string | null; included_minutes: number }>;
  exchange_rate: { rate: number; date: string; source: string; fetched_at?: string } | null;
  public_url: string;
  last_sync: { status: string; message?: string | null; at: string } | null;
};

type IssuedKey = { business: string; apiKey: string; secret: string };

/** "Acme Clinics Ltd" → "acme-clinics-ltd": the start of every room name the business uses. */
export function roomPrefixFor(name: string): string {
  return name.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-+|-+$/g, "").slice(0, 32).replace(/-+$/, "");
}

/** Admin: client accounts' apps on Naitalk Call — onboard, issue and revoke keys, suspend, see minutes. */
export function NaitalkCallPanel({ adminToken }: { adminToken: string }) {
  const [data, setData] = useState<Payload | null>(null);
  const [notice, setNotice] = useState<string | null>(null);
  const [issued, setIssued] = useState<IssuedKey | null>(null);
  const [busyId, setBusyId] = useState<number | "new" | null>(null);
  const emptyForm = { business_name: "", room_prefix: "", webhook_url: "", plan: "starter" };
  const [form, setForm] = useState(emptyForm);
  const [formClient, setFormClient] = useState<ClientOption | null>(null);
  const [linking, setLinking] = useState<number | null>(null);
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
        body: JSON.stringify({ ...form, client_id: formClient?.id, webhook_url: form.webhook_url || null }),
      });
      setIssued({ business: response.data.business_name, apiKey: response.data.api_key ?? "", secret: response.api_secret });
      setForm(emptyForm);
      setFormClient(null);
      setPrefixTouched(false);
      load();
    } catch (error) {
      setNotice(error instanceof Error ? error.message : "Could not onboard the business.");
    } finally {
      setBusyId(null);
    }
  };

  const save = async (row: NaitalkCallTenantRow, changes: Partial<Pick<NaitalkCallTenantRow, "status" | "plan">> & { client_id?: number | null }) => {
    setBusyId(row.id);
    setNotice(null);
    try {
      await laravelApi(`/api/v1/admin/naitalk-call/tenants/${row.id}`, adminToken, {
        method: "PUT",
        body: JSON.stringify({ business_name: row.business_name, room_prefix: row.room_prefix, webhook_url: row.webhook_url, ...changes }),
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

  const revoke = async (row: NaitalkCallTenantRow) => {
    const ok = window.confirm(
      `Revoke the key ${row.api_key} of ${row.business_name}${row.client ? ` (${clientLabel(row.client)})` : ""}?\n\n` +
        `${row.business_name} will stop connecting to Naitalk Call once the server syncs (within minutes, as soon as no calls are live), ` +
        `and its webhooks stop. Calls in its app fail until you issue a new key and they put it in their app.`,
    );
    if (!ok) return;
    setBusyId(row.id);
    setNotice(null);
    try {
      await laravelApi(`/api/v1/admin/naitalk-call/tenants/${row.id}/revoke-key`, adminToken, { method: "POST" });
      load();
    } catch (error) {
      setNotice(error instanceof Error ? error.message : "Could not revoke the key.");
    } finally {
      setBusyId(null);
    }
  };

  const refreshRate = async () => {
    setNotice(null);
    try {
      await laravelApi("/api/v1/admin/naitalk-call/exchange-rate/refresh", adminToken, { method: "POST" });
      load();
    } catch (error) {
      setNotice(error instanceof Error ? error.message : "Could not fetch the CBN rate.");
    }
  };

  if (!data) {
    return <section className="admin-panel text-sm font-bold text-white/60">{notice ?? "Loading..."}</section>;
  }


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
        <div className="rounded-lg border border-white/10 bg-black/20 p-4 text-sm" data-testid="naitalk-call-plans">
          <div className="flex items-start justify-between gap-2">
            <p className="text-xs font-bold uppercase tracking-wide text-white/45">Plans</p>
            <button type="button" className="text-[11px] font-bold text-primary" onClick={() => void refreshRate()}>Refresh CBN rate</button>
          </div>
          <ul className="mt-2 grid gap-1">
            {data.plans.map((plan) => (
              <li key={plan.id} className="flex justify-between gap-3">
                <span className="font-bold">{plan.name}</span>
                <span className="text-white/70">
                  {plan.monthly_usd}
                  {plan.monthly_ngn && <span className="text-white/45"> ≈ {plan.monthly_ngn}</span>} · {plan.included_minutes.toLocaleString("en-NG")} min
                </span>
              </li>
            ))}
          </ul>
          <p className="mt-2 text-xs text-white/50">
            {data.exchange_rate
              ? `Naira at the CBN official rate: ₦${data.exchange_rate.rate.toLocaleString("en-NG")} per $1 (${data.exchange_rate.date}). Fetched twice a day.`
              : "No CBN rate yet, so Naira prices are hidden. Refresh it now or wait for the next scheduled fetch."}
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
              <th className="py-1.5 font-bold">Client / app</th>
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
              <React.Fragment key={row.id}>
              <tr className="border-t border-white/10 align-top">
                <td className="py-2">
                  {row.client ? <span className="font-bold text-white">{clientLabel(row.client)}</span> : <span className="font-bold text-yellow-200">No client account</span>}
                  <span className="block text-white/60">App: {row.business_name}</span>
                </td>
                <td className="py-2 font-mono">{row.room_prefix}-…</td>
                <td className="py-2 font-mono">
                  {row.key_source === "server" ? (
                    <span className="text-white/45">kept on server</span>
                  ) : row.revoked_at ? (
                    <span className="text-red-300"><s>{row.api_key}</s> revoked</span>
                  ) : (
                    row.api_key
                  )}
                </td>
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
                <td className="py-2 text-right">
                  {(() => {
                    const usage = usageSummary(row.minutes_this_month ?? 0, row.included_minutes);
                    return <span className={usage.percent >= 100 ? "font-bold text-red-300" : usage.percent >= 80 ? "font-bold text-yellow-200" : undefined}>{usage.text}</span>;
                  })()}
                </td>
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
                    <button type="button" className="btn-outline !min-h-9 !px-3 !py-1.5 !text-[10px]" disabled={busyId === row.id} onClick={() => setLinking(linking === row.id ? null : row.id)}>
                      {row.client ? "Change client" : "Link client"}
                    </button>
                    {row.key_source === "managed" && (
                      <button type="button" className="btn-outline !min-h-9 !px-3 !py-1.5 !text-[10px]" disabled={busyId === row.id} onClick={() => void rotate(row)}>
                        <KeyRound className="h-3.5 w-3.5" /> New key
                      </button>
                    )}
                    {row.key_source === "server" ? (
                      <button
                        type="button"
                        className="btn-outline !min-h-9 !px-3 !py-1.5 !text-[10px]"
                        disabled
                        title={`This key is still kept on the server. Hand it to Naitalk first (sync.mjs --adopt ${row.room_prefix}), then it can be revoked here.`}
                      >
                        Revoke key
                      </button>
                    ) : (
                      row.api_key && !row.revoked_at && (
                        <button type="button" className="btn-outline !min-h-9 !border-red-400/50 !px-3 !py-1.5 !text-[10px] !text-red-300" disabled={busyId === row.id} onClick={() => void revoke(row)}>
                          Revoke key
                        </button>
                      )
                    )}
                  </div>
                </td>
              </tr>
              {linking === row.id && (
                <tr>
                  <td colSpan={7} className="pb-3">
                    <div className="max-w-xl">
                      <p className="mb-1 text-xs text-white/55">Which client account owns {row.business_name}? Its usage dashboard and alerts go to them.</p>
                      <ClientPicker
                        adminToken={adminToken}
                        label={`Client account for ${row.business_name}`}
                        value={null}
                        onChange={(client) => {
                          if (!client) return;
                          setLinking(null);
                          void save(row, { client_id: client.id });
                        }}
                      />
                    </div>
                  </td>
                </tr>
              )}
              </React.Fragment>
            ))}
          </tbody>
        </table>
      </div>

      <form className="mt-6 grid gap-3 rounded-lg border border-white/10 bg-black/20 p-4 sm:grid-cols-2" onSubmit={(event) => void onboard(event)}>
        <h3 className="text-base font-black sm:col-span-2">Add an app for a client</h3>
        <div className="admin-field sm:col-span-2">
          <span>Client account (must be registered)</span>
          <ClientPicker adminToken={adminToken} value={formClient} onChange={setFormClient} />
        </div>
        <label className="admin-field">
          <span>App name (e.g. Cradle)</span>
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
          <button type="submit" className="btn-primary" disabled={busyId === "new" || !formClient || !form.business_name.trim() || !form.room_prefix}>
            {busyId === "new" ? "Creating..." : `Create key — ${data.plans.find((plan) => plan.id === form.plan)?.name ?? "Starter"}`}
          </button>
        </div>
      </form>
    </section>
  );
}
