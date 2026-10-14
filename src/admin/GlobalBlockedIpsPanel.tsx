import React, { useEffect, useState } from "react";
import { ShieldBan } from "lucide-react";
import { laravelApi } from "../shared/api";
import { formatDateTime } from "../shared/format";

type Entry = { ip: string; note: string | null; added_at: string };
type Payload = { blocked_ips: Entry[]; your_ip: string };

/**
 * Admin: addresses blocked on every website at once (e.g. a scanner or brute-
 * forcer working through many sites). Each client can also block addresses
 * on their own site from its Website tab; those lists are kept separately.
 */
export function GlobalBlockedIpsPanel({ adminToken }: { adminToken: string }) {
  const [data, setData] = useState<Payload | null>(null);
  const [ip, setIp] = useState("");
  const [note, setNote] = useState("");
  const [isBusy, setIsBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    laravelApi<Payload>("/api/v1/admin/blocked-ips", adminToken).then(setData).catch(() => setData(null));
  }, [adminToken]);

  const change = async (method: "POST" | "DELETE", body: Record<string, string | null>) => {
    setIsBusy(true);
    setError(null);
    try {
      setData(await laravelApi<Payload>("/api/v1/admin/blocked-ips", adminToken, { method, body: JSON.stringify(body) }));
      return true;
    } catch (err) {
      setError(err instanceof Error ? err.message : "That did not work.");
      return false;
    } finally {
      setIsBusy(false);
    }
  };

  if (!data) return null;

  return (
    <div className="admin-panel !p-5">
      <div className="flex items-center gap-2">
        <ShieldBan className="h-5 w-5 text-primary" />
        <h3 className="text-base font-black text-white">Blocked on all websites</h3>
      </div>
      <p className="mt-1 text-xs leading-5 text-white/58">
        Addresses here get "403 Forbidden" on every hosted website. Changes are applied to all sites in the background within a minute or two. Your
        address is <strong className="text-white/80">{data.your_ip}</strong>.
      </p>
      <form
        className="mt-3 flex flex-wrap items-end gap-2"
        onSubmit={async (event) => {
          event.preventDefault();
          if (await change("POST", { ip: ip.trim(), note: note.trim() || null })) {
            setIp("");
            setNote("");
          }
        }}
      >
        <label className="admin-field min-w-[180px] flex-1">
          <span>IP address or range</span>
          <input value={ip} onChange={(event) => setIp(event.target.value)} placeholder="e.g. 203.0.113.5 or 203.0.113.0/24" maxLength={64} />
        </label>
        <label className="admin-field min-w-[180px] flex-1">
          <span>Reason (optional)</span>
          <input value={note} onChange={(event) => setNote(event.target.value)} placeholder="e.g. WordPress login brute force" maxLength={120} />
        </label>
        <button type="submit" className="btn-outline" disabled={isBusy || !ip.trim()}>
          Block everywhere
        </button>
      </form>
      {error && <p className="mt-2 text-xs text-yellow-200">{error}</p>}
      {data.blocked_ips.length > 0 && (
        <ul className="mt-3 grid gap-1.5">
          {data.blocked_ips.map((entry) => (
            <li key={entry.ip} className="flex flex-wrap items-center justify-between gap-2 rounded-md bg-white/[0.04] px-3 py-2 text-xs">
              <span>
                <strong className="text-white">{entry.ip}</strong>
                {entry.note && <span className="text-white/50"> — {entry.note}</span>}
                <span className="block text-white/35">Blocked {formatDateTime(entry.added_at)}</span>
              </span>
              <button type="button" className="font-bold text-primary hover:underline" disabled={isBusy} onClick={() => void change("DELETE", { ip: entry.ip })}>
                Unblock
              </button>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
