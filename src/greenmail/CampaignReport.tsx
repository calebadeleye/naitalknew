import React, { useMemo, useState } from "react";
import { Download, ExternalLink, Info, MailOpen, MousePointerClick, UserMinus } from "lucide-react";
import type { Campaign, CampaignRecipient } from "./api";

type Filter = "all" | "opened" | "clicked" | "unopened" | "unsubscribed" | "failed";

const FILTERS: Array<[Filter, string, (r: CampaignRecipient) => boolean]> = [
  ["all", "All", () => true],
  ["opened", "Opened", (r) => !!r.opened_at],
  ["clicked", "Clicked", (r) => !!r.clicked_at],
  ["unopened", "Not opened", (r) => r.status === "sent" && !r.opened_at],
  ["unsubscribed", "Unsubscribed", (r) => !!r.unsubscribed_at || r.status === "skipped"],
  ["failed", "Failed", (r) => r.status === "failed"],
];

const short = (iso: string | null) => (iso ? new Date(iso).toLocaleString("en-US", { month: "short", day: "numeric", hour: "numeric", minute: "2-digit" }) : "");

/** The campaign report: rates, when people opened, which links they clicked, and each person's activity. */
export function CampaignReportView({ campaign }: { campaign: Campaign }) {
  const report = campaign.report;
  const recipients = campaign.recipients ?? [];
  const [filter, setFilter] = useState<Filter>("all");
  const shown = useMemo(() => recipients.filter(FILTERS.find(([key]) => key === filter)![2]), [recipients, filter]);

  const exportCsv = () => {
    const cell = (value: string | number | null) => `"${String(value ?? "").replace(/"/g, '""')}"`;
    const rows = [
      ["Email", "Name", "Status", "Sent", "Opened", "Opens", "First click", "Clicks", "Unsubscribed", "Error"],
      ...recipients.map((r) => [r.email, r.name, r.status, r.sent_at, r.opened_at, r.open_count, r.clicked_at, r.click_count, r.unsubscribed_at, r.error]),
    ];
    const blob = new Blob([rows.map((row) => row.map(cell).join(",")).join("\n")], { type: "text/csv" });
    const link = document.createElement("a");
    link.href = URL.createObjectURL(blob);
    link.download = `${campaign.name.replace(/[^a-z0-9]+/gi, "-").toLowerCase() || "campaign"}-report.csv`;
    link.click();
    URL.revokeObjectURL(link.href);
  };

  return (
    <>
      {report && campaign.status !== "draft" && (
        report.tracked ? (
          <div className="grid gap-4">
            <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
              <Metric icon={<MailOpen className="h-4 w-4" />} label="Opened" value={`${report.open_rate}%`} detail={`${report.opened} of ${report.sent} people · ${report.opens} opens`} />
              <Metric icon={<MousePointerClick className="h-4 w-4" />} label="Clicked" value={`${report.click_rate}%`} detail={`${report.clicked} people · ${report.clicks} clicks`} />
              <Metric icon={<MousePointerClick className="h-4 w-4" />} label="Clicked after opening" value={`${report.click_to_open_rate}%`} detail="of the people who opened it" />
              <Metric icon={<UserMinus className="h-4 w-4" />} label="Unsubscribed" value={`${report.unsubscribe_rate}%`} detail={`${report.unsubscribed} ${report.unsubscribed === 1 ? "person" : "people"}`} />
            </div>

            <Timeline report={report} />

            {report.links.length > 0 && (
              <div>
                <h2 className="mb-2 text-sm font-bold text-slate-900">Links clicked</h2>
                <div className="overflow-hidden rounded-xl border border-slate-200 text-sm">
                  <div className="grid grid-cols-[1fr_auto_auto] gap-3 bg-slate-50 px-3 py-2 text-xs font-semibold text-slate-500">
                    <span>Link</span>
                    <span className="w-14 text-right">People</span>
                    <span className="w-14 text-right">Clicks</span>
                  </div>
                  {report.links.map((link) => (
                    <div key={link.id} className="grid grid-cols-[1fr_auto_auto] items-center gap-3 border-t border-slate-100 px-3 py-2">
                      <a href={link.url} target="_blank" rel="noreferrer noopener" className="flex min-w-0 items-center gap-1 text-[#15803d] hover:underline" title={link.url}>
                        <span className="truncate">{link.url.replace(/^https?:\/\/(www\.)?/, "")}</span>
                        <ExternalLink className="h-3 w-3 shrink-0" />
                      </a>
                      <span className="w-14 text-right font-semibold text-slate-900">{link.people}</span>
                      <span className="w-14 text-right text-slate-600">{link.clicks}</span>
                    </div>
                  ))}
                </div>
              </div>
            )}

            <p className="flex items-start gap-1.5 text-xs text-slate-500">
              <Info className="mt-0.5 h-3.5 w-3.5 shrink-0" />
              Opens are approximate: some email apps (like Apple Mail) load pictures before the person reads the email, and others block pictures. A click always counts as an open.
            </p>
          </div>
        ) : (
          <p className="rounded-xl bg-slate-50 px-4 py-3 text-sm text-slate-600">Opens and clicks were not tracked for this campaign.</p>
        )
      )}

      <div>
        <div className="mb-2 flex flex-wrap items-center gap-2">
          <h2 className="mr-auto text-sm font-bold text-slate-900">Recipients ({campaign.total})</h2>
          {recipients.length > 0 && campaign.status !== "draft" && (
            <button type="button" className="inline-flex items-center gap-1.5 rounded-lg px-2.5 py-1.5 text-xs font-semibold text-slate-600 hover:bg-slate-100" onClick={exportCsv}>
              <Download className="h-3.5 w-3.5" /> Download CSV
            </button>
          )}
        </div>
        {campaign.status !== "draft" && (
          <div className="mb-2 flex flex-wrap gap-1.5">
            {FILTERS.filter(([key]) => report?.tracked || !["opened", "clicked", "unopened"].includes(key)).map(([key, label, test]) => (
              <button
                key={key}
                type="button"
                onClick={() => setFilter(key)}
                className={`rounded-full px-3 py-1 text-xs font-semibold ${filter === key ? "bg-[#1f9d4c] text-white" : "bg-slate-100 text-slate-600 hover:bg-slate-200"}`}
              >
                {label} <span className="opacity-70">{recipients.filter(test).length}</span>
              </button>
            ))}
          </div>
        )}
        <ul className="max-h-[420px] divide-y divide-slate-100 overflow-y-auto rounded-xl border border-slate-200 text-sm">
          {shown.length === 0 && <li className="px-3 py-6 text-center text-xs text-slate-500">Nobody here yet.</li>}
          {shown.map((r) => (
            <li key={r.id} className="flex flex-wrap items-center gap-x-2 gap-y-1 px-3 py-2">
              <span className="min-w-0 flex-1 truncate text-slate-800">{r.name ? `${r.name} — ${r.email}` : r.email}</span>
              {r.opened_at && (
                <span className="inline-flex items-center gap-1 rounded-full bg-[#e3f4e9] px-2 py-0.5 text-[11px] font-semibold text-[#14632f]" title={`First opened ${short(r.opened_at)}`}>
                  <MailOpen className="h-3 w-3" /> {r.open_count > 1 ? `${r.open_count}×` : "Opened"}
                </span>
              )}
              {r.clicked_at && (
                <span className="inline-flex items-center gap-1 rounded-full bg-[#dbeafe] px-2 py-0.5 text-[11px] font-semibold text-[#1e40af]" title={`First clicked ${short(r.clicked_at)}`}>
                  <MousePointerClick className="h-3 w-3" /> {r.click_count} {r.click_count === 1 ? "click" : "clicks"}
                </span>
              )}
              {r.unsubscribed_at && <span className="rounded-full bg-amber-50 px-2 py-0.5 text-[11px] font-semibold text-amber-800">Unsubscribed</span>}
              <span className={`shrink-0 text-xs font-semibold ${r.status === "sent" ? "text-[#15803d]" : r.status === "failed" ? "text-red-600" : r.status === "skipped" ? "text-amber-700" : "text-slate-400"}`} title={r.error ?? undefined}>
                {r.status === "sent" ? "Sent" : r.status === "failed" ? "Failed" : r.status === "skipped" ? "Skipped" : "Waiting"}
              </span>
            </li>
          ))}
        </ul>
      </div>
    </>
  );
}

function Metric({ icon, label, value, detail }: { icon: React.ReactNode; label: string; value: string; detail: string }) {
  return (
    <div className="rounded-xl border border-slate-200 p-3">
      <p className="flex items-center gap-1.5 text-xs font-semibold text-slate-500">
        {icon} {label}
      </p>
      <p className="mt-1 text-2xl font-black text-slate-900">{value}</p>
      <p className="text-xs text-slate-500">{detail}</p>
    </div>
  );
}

/** First opens (green) and first clicks (blue) per hour or per day since sending started. */
function Timeline({ report }: { report: NonNullable<Campaign["report"]> }) {
  const points = report.timeline.points;
  if (points.length === 0 || report.opened === 0) return null;
  const max = Math.max(1, ...points.map((p) => p.opens));
  const label = (iso: string) =>
    report.timeline.unit === "hour"
      ? new Date(iso).toLocaleString("en-US", { weekday: "short", hour: "numeric" })
      : new Date(iso).toLocaleDateString("en-US", { month: "short", day: "numeric" });
  const every = Math.max(1, Math.ceil(points.length / 8));

  return (
    <div>
      <h2 className="mb-2 text-sm font-bold text-slate-900">When people opened it <span className="font-normal text-slate-500">(per {report.timeline.unit})</span></h2>
      <div className="rounded-xl border border-slate-200 p-3">
        <div className="flex h-28 items-end gap-px" role="img" aria-label={`First opens per ${report.timeline.unit}`}>
          {points.map((p) => (
            <div key={p.at} className="group relative flex h-full flex-1 flex-col justify-end" title={`${label(p.at)}: ${p.opens} opened, ${p.clicks} clicked`}>
              <div className="w-full rounded-t-sm bg-[#22a04f]" style={{ height: `${(p.opens / max) * 100}%`, minHeight: p.opens ? 2 : 0 }} />
              {p.clicks > 0 && <div className="absolute bottom-0 w-full rounded-t-sm bg-[#3b82f6]/80" style={{ height: `${(p.clicks / max) * 100}%`, minHeight: 2 }} />}
            </div>
          ))}
        </div>
        <div className="mt-1 flex gap-px text-[10px] text-slate-400">
          {points.map((p, i) => (
            <span key={p.at} className="flex-1 truncate">{i % every === 0 ? label(p.at) : ""}</span>
          ))}
        </div>
        <p className="mt-2 flex gap-3 text-[11px] text-slate-500">
          <span className="inline-flex items-center gap-1"><span className="h-2 w-2 rounded-sm bg-[#22a04f]" /> Opened</span>
          <span className="inline-flex items-center gap-1"><span className="h-2 w-2 rounded-sm bg-[#3b82f6]" /> Clicked</span>
        </p>
      </div>
    </div>
  );
}
