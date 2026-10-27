import React, { useEffect, useState } from "react";
import { AlertTriangle, Copy, Download, PhoneCall } from "lucide-react";
import { downloadLaravelFile, laravelApi } from "../shared/api";

/*
 * Client portal: Naitalk Call usage for each business the client has on it.
 * Minutes are participant-minutes (one person in a call for one minute).
 */

export type ClientNaitalkCallBusiness = {
  id: number;
  business_name: string;
  status: string;
  plan: { id: string; name: string; monthly_usd: string; monthly_ngn: string | null; included_minutes: number };
  usage: { month: string; minutes: number; included_minutes: number; percent: number; alerts: boolean };
  daily: Array<{ date: string; minutes: number }>;
  monthly: Array<{ month: string; minutes: number }>;
  connection: { url: string; api_key: string | null; room_prefix: string; webhook_url: string | null };
};

const fmt = (n: number) => n.toLocaleString("en-NG");

/** "October 2026" from "2026-10". */
export function monthLabel(month: string): string {
  const d = new Date(`${month}-01T12:00:00Z`);
  return Number.isNaN(d.getTime()) ? month : d.toLocaleDateString("en-GB", { month: "long", year: "numeric", timeZone: "UTC" });
}

/** Normal, near the limit (80%+) or over it (100%+): said in words as well as colour. */
export function usageLevel(percent: number): { label: string; bar: string; text: string } {
  if (percent >= 100) return { label: "Over your plan's minutes", bar: "bg-red-400", text: "text-red-300" };
  if (percent >= 80) return { label: "Close to your plan's minutes", bar: "bg-yellow-300", text: "text-yellow-200" };
  return { label: "Within your plan", bar: "bg-primary", text: "text-white/60" };
}

function DailyChart({ days }: { days: ClientNaitalkCallBusiness["daily"] }) {
  const max = Math.max(1, ...days.map((d) => d.minutes));
  return (
    <figure>
      <figcaption className="text-xs font-bold uppercase tracking-wide text-white/45">Participant-minutes per day</figcaption>
      <div className="mt-3 flex h-28 items-end gap-[2px] border-b border-white/15" role="img" aria-label={`Daily participant-minutes this month, highest ${fmt(max)}`}>
        {days.map((d) => (
          <div key={d.date} className="group relative flex h-full flex-1 items-end" title={`${d.date}: ${fmt(d.minutes)} min`}>
            <div className="w-full rounded-t-[4px] bg-primary/80 group-hover:bg-primary" style={{ height: d.minutes > 0 ? `${Math.max(2, (d.minutes / max) * 100)}%` : "0" }} />
            <span className="pointer-events-none absolute bottom-full left-1/2 z-10 mb-1 hidden -translate-x-1/2 whitespace-nowrap rounded bg-black/90 px-2 py-1 text-[11px] text-white group-hover:block">
              {Number(d.date.slice(8))} · {fmt(d.minutes)} min
            </span>
          </div>
        ))}
      </div>
      <div className="mt-1 flex justify-between text-[10px] text-white/40">
        <span>{days[0] ? Number(days[0].date.slice(8)) : ""}</span>
        <span>{days.length ? Number(days[days.length - 1].date.slice(8)) : ""}</span>
      </div>
    </figure>
  );
}

function BusinessUsage({ business, token }: { business: ClientNaitalkCallBusiness; token: string }) {
  const level = usageLevel(business.usage.percent);
  const [copied, setCopied] = useState(false);

  const env = `LIVEKIT_URL=${business.connection.url}\nLIVEKIT_API_KEY=${business.connection.api_key ?? ""}\nLIVEKIT_API_SECRET=<the secret we gave you>\n`;

  return (
    <article className="portal-card" data-testid={`naitalk-call-business-${business.id}`}>
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h3 className="text-lg font-black text-white">{business.business_name}</h3>
          <p className="text-sm text-white/55">
            {business.plan.name} plan · {business.plan.monthly_usd}
            {business.plan.monthly_usd !== "Free" && "/mo"}
            {business.plan.monthly_ngn && ` (≈ ${business.plan.monthly_ngn})`}
            {business.status !== "active" && <span className="ml-2 font-bold capitalize text-yellow-200">· {business.status}</span>}
          </p>
        </div>
        <button
          type="button"
          className="btn-outline !min-h-9 !px-3 !py-1.5 !text-[11px]"
          onClick={() => void downloadLaravelFile(`/api/v1/client/naitalk-call/${business.id}/report?month=${business.usage.month}`, token, `naitalk-call-usage-${business.connection.room_prefix}-${business.usage.month}.csv`)}
        >
          <Download className="h-3.5 w-3.5" /> Usage report (CSV)
        </button>
      </div>

      <div className="mt-5">
        <p className="text-xs font-bold uppercase tracking-wide text-white/45">{monthLabel(business.usage.month)}</p>
        <p className="mt-1 text-3xl font-black text-white" data-testid="naitalk-call-minutes">
          {fmt(business.usage.minutes)} <span className="text-base font-bold text-white/50">of {fmt(business.usage.included_minutes)} participant-minutes</span>
        </p>
        <div className="mt-3 h-2 overflow-hidden rounded-full bg-white/10" role="progressbar" aria-valuenow={business.usage.percent} aria-valuemin={0} aria-valuemax={100} aria-label="Share of this month's minutes used">
          <div className={`h-full rounded-full ${level.bar}`} style={{ width: `${Math.min(100, business.usage.percent)}%` }} />
        </div>
        <p className={`mt-2 flex items-center gap-1.5 text-sm font-bold ${level.text}`}>
          {business.usage.percent >= 80 && <AlertTriangle className="h-4 w-4" />}
          {business.usage.percent}% used · {level.label}
        </p>
        <p className="mt-1 text-xs text-white/45">
          {business.usage.alerts ? "We email you at 80% and 100% of your minutes. " : ""}Calls keep working if you go over; minutes reset on the 1st.
        </p>
      </div>

      <div className="mt-6">
        <DailyChart days={business.daily} />
      </div>

      <div className="mt-6 grid gap-6 lg:grid-cols-2">
        <div>
          <p className="text-xs font-bold uppercase tracking-wide text-white/45">Recent months</p>
          <table className="mt-2 w-full text-left text-sm">
            <thead className="text-xs text-white/45">
              <tr>
                <th className="py-1 font-bold">Month</th>
                <th className="py-1 text-right font-bold">Participant-minutes</th>
              </tr>
            </thead>
            <tbody className="text-white/75">
              {business.monthly.map((m) => (
                <tr key={m.month} className="border-t border-white/10">
                  <td className="py-1.5">{monthLabel(m.month)}</td>
                  <td className="py-1.5 text-right tabular-nums">{fmt(m.minutes)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>

        <div>
          <p className="text-xs font-bold uppercase tracking-wide text-white/45">Connect your app</p>
          <dl className="mt-2 grid gap-1.5 text-sm">
            <div><dt className="inline text-white/50">Server URL: </dt><dd className="inline font-mono text-white">{business.connection.url}</dd></div>
            <div><dt className="inline text-white/50">API key: </dt><dd className="inline font-mono text-white">{business.connection.api_key ?? "set up by NAI TALK"}</dd></div>
            <div><dt className="inline text-white/50">Room names start with: </dt><dd className="inline font-mono text-white">{business.connection.room_prefix}-</dd></div>
            <div><dt className="inline text-white/50">Webhook: </dt><dd className="inline break-all font-mono text-white">{business.connection.webhook_url ?? "none"}</dd></div>
          </dl>
          <p className="mt-2 text-xs text-white/45">Your API secret was shown once when your key was made. Lost it? Open a support ticket and we'll issue a new key.</p>
          {business.connection.api_key && (
            <button
              type="button"
              className="btn-outline mt-3 !min-h-9 !px-3 !py-1.5 !text-[11px]"
              onClick={() => {
                void navigator.clipboard?.writeText(env);
                setCopied(true);
              }}
            >
              <Copy className="h-3.5 w-3.5" /> {copied ? "Copied" : "Copy as .env"}
            </button>
          )}
        </div>
      </div>
    </article>
  );
}

export function NaitalkCallUsagePage({ token }: { token: string }) {
  const [businesses, setBusinesses] = useState<ClientNaitalkCallBusiness[] | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    laravelApi<{ data: ClientNaitalkCallBusiness[] }>("/api/v1/client/naitalk-call", token)
      .then((response) => setBusinesses(response.data))
      .catch((e) => setError(e instanceof Error ? e.message : "Could not load your Naitalk Call usage."));
  }, [token]);

  return (
    <section>
      <h2 className="flex items-center gap-2 text-2xl font-black text-white"><PhoneCall className="h-6 w-6 text-primary" /> Naitalk Call</h2>
      <p className="mt-1 text-sm text-white/55">Your voice-call usage this month, in participant-minutes: one person in a call for one minute.</p>

      {error && <p className="mt-5 text-sm font-bold text-yellow-200">{error}</p>}
      {businesses === null && !error && <div className="portal-card mt-5 text-sm font-bold text-white/60">Loading...</div>}
      {businesses?.length === 0 && (
        <div className="portal-card mt-5 text-sm text-white/65">
          You don't have Naitalk Call yet. <a className="font-bold text-primary" href="/naitalk-call">See the plans</a>.
        </div>
      )}
      <div className="mt-5 grid gap-5">
        {businesses?.map((business) => (
          <React.Fragment key={business.id}>
            <BusinessUsage business={business} token={token} />
          </React.Fragment>
        ))}
      </div>
    </section>
  );
}
