import React, { useEffect, useState } from "react";
import { HardDrive } from "lucide-react";
import { laravelApi } from "../shared/api";
import { formatMb } from "../shared/format";

type ServerCapacity = {
  websites: { active: number; suspended_or_expired: number };
  packages: Array<{ package: string; active: number; suspended_or_expired: number; allocated_mb: number; used_mb: number }>;
  storage: { allocated_mb: number; used_by_sites_mb: number };
  disk: { total_mb: number; used_mb: number; free_mb: number; used_percent: number } | null;
};

/**
 * "How full is the VPS?" — active websites per package, the space those
 * packages promise vs. what they really use, and what's left on the disk.
 */
export function ServerCapacityPanel({ adminToken }: { adminToken: string }) {
  const [data, setData] = useState<ServerCapacity | null>(null);

  useEffect(() => {
    if (!adminToken) return;
    laravelApi<ServerCapacity>("/api/v1/admin/server-capacity", adminToken).then(setData).catch(() => setData(null));
  }, [adminToken]);

  if (!data) return null;

  const disk = data.disk;
  const overcommitted = disk && data.storage.allocated_mb > disk.free_mb + data.storage.used_by_sites_mb;
  const barTone = !disk ? "bg-primary" : disk.used_percent >= 90 ? "bg-red-500" : disk.used_percent >= 75 ? "bg-yellow-400" : "bg-primary";

  return (
    <div className="admin-panel !p-5">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div className="flex items-center gap-2">
          <HardDrive className="h-5 w-5 text-primary" />
          <h3 className="text-base font-black text-white">Server capacity</h3>
        </div>
        <p className="text-xs text-white/58">
          <strong className="text-white">{data.websites.active}</strong> active websites
          {data.websites.suspended_or_expired > 0 && <> · {data.websites.suspended_or_expired} suspended/expired</>}
        </p>
      </div>

      {disk && (
        <div className="mt-4">
          <div className="flex flex-wrap items-baseline justify-between gap-2 text-xs text-white/60">
            <span>
              VPS disk: <strong className="text-white">{formatMb(disk.used_mb)}</strong> used of {formatMb(disk.total_mb)}
            </span>
            <span>
              <strong className="text-primary">{formatMb(disk.free_mb)}</strong> free
            </span>
          </div>
          <div className="mt-2 h-2.5 overflow-hidden rounded-full bg-white/10" role="progressbar" aria-valuenow={disk.used_percent} aria-valuemin={0} aria-valuemax={100}>
            <div className={`h-full ${barTone}`} style={{ width: `${Math.min(disk.used_percent, 100)}%` }} />
          </div>
        </div>
      )}

      <div className="mt-4 overflow-x-auto">
        <table className="w-full min-w-[420px] text-left text-xs">
          <thead className="text-white/45">
            <tr>
              <th className="py-1.5 font-bold">Package</th>
              <th className="py-1.5 text-right font-bold">Active</th>
              <th className="py-1.5 text-right font-bold">Space promised</th>
              <th className="py-1.5 text-right font-bold">Space used</th>
            </tr>
          </thead>
          <tbody className="text-white/75">
            {data.packages.map((row) => (
              <tr key={row.package} className="border-t border-white/10">
                <td className="py-1.5 font-bold text-white">{row.package}</td>
                <td className="py-1.5 text-right">
                  {row.active}
                  {row.suspended_or_expired > 0 && <span className="text-white/40"> (+{row.suspended_or_expired})</span>}
                </td>
                <td className="py-1.5 text-right">{formatMb(row.allocated_mb)}</td>
                <td className="py-1.5 text-right">{formatMb(row.used_mb)}</td>
              </tr>
            ))}
          </tbody>
          <tfoot className="text-white">
            <tr className="border-t border-white/20 font-black">
              <td className="py-1.5">Total</td>
              <td className="py-1.5 text-right">{data.websites.active}</td>
              <td className="py-1.5 text-right">{formatMb(data.storage.allocated_mb)}</td>
              <td className="py-1.5 text-right">{formatMb(data.storage.used_by_sites_mb)}</td>
            </tr>
          </tfoot>
        </table>
      </div>

      {overcommitted && (
        <p className="mt-3 text-xs text-yellow-200/90">
          The packages together promise more space than the server has left. That's normal for shared hosting, but watch the free space as sites grow.
        </p>
      )}
    </div>
  );
}
