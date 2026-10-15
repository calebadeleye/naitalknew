import React, { useEffect, useMemo, useState } from "react";
import { Loader2 } from "lucide-react";
import { laravelApi } from "../shared/api";

type Day = { date: string; visits: number; pages: number; bandwidth_bytes: number };

type Statistics = {
  days: Day[];
  totals: { visits: number; pages: number; bandwidth_bytes: number };
  previous_totals: { visits: number; pages: number };
  last_updated: string | null;
  has_data: boolean;
};

// Bar colours come from --chart-bar / --chart-bar-hover (index.css): brand
// green steps that pass the palette validator on each theme's surface.
const BAR = "var(--chart-bar, #4fa30c)";
const BAR_HOVER = "var(--chart-bar-hover, #9bea16)";

const compact = (value: number) => new Intl.NumberFormat("en", { notation: value >= 10000 ? "compact" : "standard", maximumFractionDigits: 1 }).format(value);

const formatBytes = (bytes: number) => {
  if (bytes >= 1073741824) return `${(bytes / 1073741824).toFixed(1)} GB`;
  if (bytes >= 1048576) return `${(bytes / 1048576).toFixed(1)} MB`;
  if (bytes >= 1024) return `${Math.round(bytes / 1024)} KB`;
  return `${bytes} B`;
};

const shortDate = (iso: string) => new Date(`${iso}T00:00:00`).toLocaleDateString("en-GB", { day: "numeric", month: "short" });

/** Clean axis maximum: 1, 2, 2.5 or 5 × 10ⁿ at or above the peak. */
function niceMax(peak: number): number {
  if (peak <= 4) return 4;
  const power = 10 ** Math.floor(Math.log10(peak));
  const step = [1, 2, 2.5, 5, 10].find((multiple) => multiple * power >= peak) ?? 10;
  return step * power;
}

/** Statistics tab: visitors to one website, from its nightly AWStats report. */
export function WebsiteStatisticsPanel({ serviceId, token }: { serviceId: number; token: string }) {
  const [range, setRange] = useState<7 | 30 | 90>(30);
  const [data, setData] = useState<Statistics | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [hovered, setHovered] = useState<number | null>(null);
  const [showTable, setShowTable] = useState(false);

  useEffect(() => {
    setData(null);
    setError(null);
    laravelApi<Statistics>(`/api/v1/client/services/${serviceId}/statistics?days=${range}`, token)
      .then(setData)
      .catch((err) => setError(err instanceof Error ? err.message : "Could not load statistics."));
  }, [serviceId, token, range]);

  const axisMax = useMemo(() => niceMax(Math.max(0, ...(data?.days.map((day) => day.visits) ?? [0]))), [data]);

  const change = data && data.previous_totals.visits > 0 ? Math.round(((data.totals.visits - data.previous_totals.visits) / data.previous_totals.visits) * 100) : null;

  return (
    <div>
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <h2>Statistics</h2>
          <p className="mt-1 text-sm text-white/48">Visitors to your website, updated every morning for the previous day.</p>
        </div>
        <div className="flex gap-1" role="group" aria-label="Time range">
          {([7, 30, 90] as const).map((option) => (
            <button
              key={option}
              type="button"
              aria-pressed={range === option}
              className={`rounded-full border px-3 py-1 text-xs font-bold ${range === option ? "border-primary/60 bg-primary/10 text-primary" : "border-white/15 text-white/60 hover:border-white/30"}`}
              onClick={() => setRange(option)}
            >
              {option} days
            </button>
          ))}
        </div>
      </div>

      {error && <p className="mt-4 text-sm text-white/55">{error}</p>}

      {!data && !error && (
        <div className="mt-6 flex items-center gap-2 text-sm text-white/50">
          <Loader2 className="h-4 w-4 animate-spin" /> Loading statistics...
        </div>
      )}

      {data && (
        <>
          <div className="mt-5 grid grid-cols-[repeat(auto-fit,minmax(9rem,1fr))] gap-3">
            <div className="rounded-lg border border-white/10 bg-black/20 p-4">
              <p className="text-xs text-white/50">Visits</p>
              <p className="mt-1 whitespace-nowrap text-xl font-black text-white sm:text-2xl">{compact(data.totals.visits)}</p>
              {change !== null && (
                <p className="mt-0.5 text-xs text-white/55">
                  {change > 0 ? "+" : ""}
                  {change}% vs previous {range} days
                </p>
              )}
            </div>
            <div className="rounded-lg border border-white/10 bg-black/20 p-4">
              <p className="text-xs text-white/50">Page views</p>
              <p className="mt-1 whitespace-nowrap text-xl font-black text-white sm:text-2xl">{compact(data.totals.pages)}</p>
            </div>
            <div className="rounded-lg border border-white/10 bg-black/20 p-4">
              <p className="text-xs text-white/50">Bandwidth</p>
              <p className="mt-1 whitespace-nowrap text-xl font-black text-white sm:text-2xl">{formatBytes(data.totals.bandwidth_bytes)}</p>
            </div>
          </div>

          {!data.has_data ? (
            <p className="mt-5 rounded-lg border border-white/10 bg-black/20 p-4 text-sm text-white/60">
              No visits recorded for this period yet. Statistics appear the morning after your website receives visitors — if your site is busy and
              this stays empty, please open a support ticket so we can check it.
            </p>
          ) : (
            <div className="mt-5 rounded-lg border border-white/10 bg-black/20 p-4">
              <div className="flex items-baseline justify-between gap-3">
                <p className="text-sm font-bold text-white">Visits per day</p>
                <button type="button" className="text-xs font-bold text-white/55 hover:text-white" onClick={() => setShowTable((value) => !value)}>
                  {showTable ? "Show chart" : "Show as table"}
                </button>
              </div>

              {showTable ? (
                <div className="mt-3 max-h-80 overflow-auto">
                  <table className="w-full text-left text-xs">
                    <thead className="sticky top-0 bg-[#0c1519] text-white/45">
                      <tr>
                        <th className="py-1.5 font-bold">Date</th>
                        <th className="py-1.5 text-right font-bold">Visits</th>
                        <th className="py-1.5 text-right font-bold">Page views</th>
                        <th className="py-1.5 text-right font-bold">Bandwidth</th>
                      </tr>
                    </thead>
                    <tbody className="text-white/75">
                      {[...data.days].reverse().map((day) => (
                        <tr key={day.date} className="border-t border-white/10">
                          <td className="py-1.5">{shortDate(day.date)}</td>
                          <td className="py-1.5 text-right tabular-nums">{day.visits.toLocaleString()}</td>
                          <td className="py-1.5 text-right tabular-nums">{day.pages.toLocaleString()}</td>
                          <td className="py-1.5 text-right tabular-nums">{formatBytes(day.bandwidth_bytes)}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              ) : (
                <div className="mt-3 flex gap-2">
                  {/* Y axis: 0, half and max — clean numbers, level with the gridlines. */}
                  <div className="relative h-40 w-8 shrink-0 text-right text-[10px] tabular-nums text-white/40">
                    <span className="absolute right-0 top-0 -translate-y-1/2">{axisMax.toLocaleString()}</span>
                    <span className="absolute right-0 top-1/2 -translate-y-1/2">{(axisMax / 2).toLocaleString()}</span>
                    <span className="absolute bottom-0 right-0 translate-y-1/2">0</span>
                  </div>
                  <div className="min-w-0 flex-1">
                    <div className="relative h-40">
                      <div className="pointer-events-none absolute inset-0">
                        <div className="absolute inset-x-0 top-0 border-t border-white/[0.07]" />
                        <div className="absolute inset-x-0 top-1/2 border-t border-white/[0.07]" />
                        <div className="absolute inset-x-0 bottom-0 border-t border-white/15" />
                      </div>
                      <div className="relative flex h-full items-end" role="img" aria-label={`Visits per day for the last ${range} days`} onMouseLeave={() => setHovered(null)}>
                        {data.days.map((day, index) => {
                          const height = axisMax > 0 ? (day.visits / axisMax) * 100 : 0;
                          const isHovered = hovered === index;
                          return (
                            // The whole column is the hover target, not just the bar.
                            <div
                              key={day.date}
                              className="relative flex h-full flex-1 cursor-default items-end justify-center px-px"
                              onMouseEnter={() => setHovered(index)}
                              onFocus={() => setHovered(index)}
                              onBlur={() => setHovered(null)}
                              tabIndex={0}
                              aria-label={`${shortDate(day.date)}: ${day.visits} visits`}
                            >
                              <div
                                className="w-full max-w-6 rounded-t"
                                style={{ height: `${height}%`, minHeight: day.visits > 0 ? 2 : 0, background: isHovered ? BAR_HOVER : BAR }}
                              />
                              {isHovered && (
                                <div
                                  className={`pointer-events-none absolute top-0 z-10 -translate-y-full whitespace-nowrap rounded-md border border-white/15 bg-[#0c1519] px-2.5 py-1.5 text-[11px] text-white/80 shadow-lg ${
                                    index < data.days.length / 3 ? "left-0" : index > (data.days.length * 2) / 3 ? "right-0" : "left-1/2 -translate-x-1/2"
                                  }`}
                                >
                                  <p className="font-bold text-white">{shortDate(day.date)}</p>
                                  <p>
                                    {day.visits.toLocaleString()} visits · {day.pages.toLocaleString()} pages
                                  </p>
                                  <p className="text-white/50">{formatBytes(day.bandwidth_bytes)}</p>
                                </div>
                              )}
                            </div>
                          );
                        })}
                      </div>
                    </div>
                    <div className="mt-1.5 flex justify-between text-[10px] text-white/40">
                      <span>{shortDate(data.days[0].date)}</span>
                      <span>{shortDate(data.days[data.days.length - 1].date)}</span>
                    </div>
                  </div>
                </div>
              )}
            </div>
          )}
        </>
      )}
    </div>
  );
}
