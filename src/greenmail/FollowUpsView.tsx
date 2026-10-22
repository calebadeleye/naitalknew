import React, { useCallback, useEffect, useState } from "react";
import { AlarmClock, BellRing, Check, Clock, Loader2, Mail, Undo2 } from "lucide-react";
import { gm, type FollowUp, type Snooze } from "./api";
import { useFeedback } from "./feedback";
import { announceChange, useOnChange } from "./sync";
import { fullDate } from "./ui";

/** Suggested times for snooze and "remind me", in the reader's own time zone. */
export function quickTimes(now = new Date()): Array<[string, Date]> {
  const at = (days: number, hour: number) => {
    const d = new Date(now);
    d.setDate(d.getDate() + days);
    d.setHours(hour, 0, 0, 0);
    return d;
  };
  const laterToday = new Date(now.getTime() + 3 * 3600000);
  laterToday.setMinutes(0, 0, 0);
  const toMonday = ((8 - now.getDay()) % 7) || 7;
  const options: Array<[string, Date]> = [];
  if (laterToday.getDate() === now.getDate() && laterToday.getHours() <= 20) options.push(["Later today", laterToday]);
  options.push(["Tomorrow", at(1, 8)], ["In 3 days", at(3, 8)], ["Next week", at(toMonday, 8)]);
  return options;
}

/** Due reminders (count shown in the sidebar), refreshed with the mail. */
export function useDueFollowUps(token: string): number {
  const [due, setDue] = useState(0);
  const load = useCallback(() => gm<{ due: number }>("/followups", token).then((r) => setDue(r.due)).catch(() => undefined), [token]);
  useEffect(() => {
    void load();
    const timer = window.setInterval(() => void load(), 120000);
    return () => window.clearInterval(timer);
  }, [load]);
  useOnChange("followups", () => void load());
  return due;
}

/**
 * Follow-ups: sent emails nobody has answered yet ("remind me if nobody
 * replies"), and emails snoozed until later.
 */
export function FollowUpsView({ token, onSessionError, onOpenEmail }: { token: string; onSessionError: (error: unknown) => void; onOpenEmail: (messageId: string, folder?: string | null) => void }) {
  const [followUps, setFollowUps] = useState<FollowUp[] | null>(null);
  const [snoozes, setSnoozes] = useState<Snooze[] | null>(null);
  const { toast } = useFeedback();

  const load = useCallback(() => {
    void gm<{ followups: FollowUp[] }>("/followups", token).then((r) => setFollowUps(r.followups)).catch((error) => { onSessionError(error); setFollowUps([]); });
    void gm<{ snoozes: Snooze[] }>("/snoozes", token).then((r) => setSnoozes(r.snoozes)).catch((error) => { onSessionError(error); setSnoozes([]); });
  }, [token, onSessionError]);

  useEffect(() => load(), [load]);
  useOnChange("followups", load);

  const run = async (path: string, init: RequestInit) => {
    try {
      const result = await gm<{ message: string }>(path, token, init);
      toast(result.message);
    } catch (error) {
      onSessionError(error);
      toast(error instanceof Error ? error.message : "That did not work.", "error");
    }
    announceChange("followups");
  };

  const due = followUps?.filter((f) => f.status === "due" || f.status === "failed") ?? [];
  const waiting = followUps?.filter((f) => f.status === "waiting" || f.status === "checking") ?? [];

  const row = (key: string, icon: React.ReactNode, title: string, detail: string, actions: React.ReactNode, onOpen: () => void, error?: string | null) => (
    <li key={key} className="flex flex-wrap items-center gap-3 py-3">
      <span className="shrink-0">{icon}</span>
      <button type="button" className="min-w-0 flex-1 text-left" onClick={onOpen}>
        <span className="block truncate text-sm font-semibold text-slate-900">{title || "(no subject)"}</span>
        <span className="block truncate text-xs text-slate-500">{detail}</span>
        {error && <span className="block truncate text-xs text-red-600">{error}</span>}
      </button>
      <div className="flex shrink-0 items-center gap-1">{actions}</div>
    </li>
  );

  const small = "inline-flex items-center gap-1 rounded-md border border-slate-200 px-2 py-1 text-xs font-semibold text-slate-700 hover:bg-slate-50";
  const tomorrow = quickTimes().find(([label]) => label === "Tomorrow")?.[1] ?? new Date(Date.now() + 86400000);

  return (
    <section className="flex min-h-0 flex-1 flex-col overflow-y-auto bg-white p-3 sm:p-6">
      <div className="mx-auto w-full max-w-2xl">
        <h1 className="text-xl font-black text-slate-900 sm:text-2xl">Follow-ups</h1>
        <p className="mt-1 text-sm text-slate-500">Emails waiting for a reply, and emails you snoozed.</p>

        {followUps === null || snoozes === null ? (
          <Loader2 className="mt-6 h-5 w-5 animate-spin text-slate-400" />
        ) : (
          <>
            <h2 className="mt-6 text-xs font-bold uppercase tracking-wide text-slate-500">No reply yet</h2>
            {due.length === 0 ? (
              <p className="py-3 text-sm text-slate-500">Nothing needs chasing.</p>
            ) : (
              <ul className="divide-y divide-slate-100">
                {due.map((f) =>
                  row(
                    `f${f.id}`,
                    <BellRing className="h-5 w-5 text-[#c2410c]" />,
                    f.subject ?? "",
                    `To ${(f.recipients ?? []).join(", ")} · no reply by ${fullDate(f.remind_at)}`,
                    <>
                      <button type="button" className={small} onClick={() => void run(`/followups/${f.id}`, { method: "PATCH", body: JSON.stringify({ action: "later", remind_at: tomorrow.toISOString() }) })}>
                        <AlarmClock className="h-3.5 w-3.5" /> Tomorrow
                      </button>
                      <button type="button" className={small} onClick={() => void run(`/followups/${f.id}`, { method: "PATCH", body: JSON.stringify({ action: "dismiss" }) })}>
                        <Check className="h-3.5 w-3.5" /> Done
                      </button>
                    </>,
                    () => onOpenEmail(f.message_id, f.sent_folder),
                    f.status === "failed" ? f.error : null,
                  ),
                )}
              </ul>
            )}

            <h2 className="mt-6 text-xs font-bold uppercase tracking-wide text-slate-500">Waiting for a reply</h2>
            {waiting.length === 0 ? (
              <p className="py-3 text-sm text-slate-500">Turn on “Remind me if nobody replies” when you send an email, or from an email in Sent.</p>
            ) : (
              <ul className="divide-y divide-slate-100">
                {waiting.map((f) =>
                  row(
                    `f${f.id}`,
                    <Clock className="h-5 w-5 text-slate-400" />,
                    f.subject ?? "",
                    `To ${(f.recipients ?? []).join(", ")} · reminder ${fullDate(f.remind_at)}`,
                    <button type="button" className={small} onClick={() => void run(`/followups/${f.id}`, { method: "DELETE" })}>
                      Cancel
                    </button>,
                    () => onOpenEmail(f.message_id, f.sent_folder),
                  ),
                )}
              </ul>
            )}

            <h2 className="mt-6 text-xs font-bold uppercase tracking-wide text-slate-500">Snoozed</h2>
            {snoozes.length === 0 ? (
              <p className="py-3 text-sm text-slate-500">Snooze an email to have it come back to your Inbox when you're ready for it.</p>
            ) : (
              <ul className="divide-y divide-slate-100">
                {snoozes.map((s) =>
                  row(
                    `s${s.id}`,
                    <AlarmClock className="h-5 w-5 text-[#1f9d4c]" />,
                    s.subject ?? "",
                    `${s.from_email ?? ""} · back ${fullDate(s.until)}`,
                    <button type="button" className={small} onClick={() => void run(`/snoozes/${s.id}`, { method: "DELETE" })}>
                      <Undo2 className="h-3.5 w-3.5" /> Unsnooze
                    </button>,
                    () => onOpenEmail(s.message_id, "Snoozed"),
                  ),
                )}
              </ul>
            )}
            <p className="mt-6 flex items-center gap-1.5 text-xs text-slate-400">
              <Mail className="h-3.5 w-3.5" /> Snoozed emails wait in the “Snoozed” folder, so your phone's mail app sees them too.
            </p>
          </>
        )}
      </div>
    </section>
  );
}
