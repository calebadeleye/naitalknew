import React from "react";
import { AlertTriangle, CloudOff, FileText, Loader2, RotateCw, Send, Trash2 } from "lucide-react";
import { useFeedback } from "./feedback";
import { removeFromOutbox, retry, type OutboxItem } from "./offline";
import { fullDate } from "./ui";

/** Emails sent (and drafts saved) while offline, waiting on this device. */
export function OutboxView({ items, online, onSendNow }: { items: OutboxItem[]; online: boolean; onSendNow: () => void }) {
  const { confirm, toast } = useFeedback();

  const remove = async (item: OutboxItem) => {
    if (!(await confirm({ title: item.kind === "send" ? "Delete this unsent email?" : "Delete this draft?", message: item.subject, confirmLabel: "Delete", danger: true }))) return;
    await removeFromOutbox(item.id as number);
    toast("Deleted.");
  };

  return (
    <section className="flex min-h-0 flex-1 flex-col overflow-y-auto bg-white p-3 sm:p-6">
      <div className="mx-auto w-full max-w-2xl">
        <div className="flex flex-wrap items-center gap-2">
          <h1 className="mr-auto text-xl font-black text-slate-900 sm:text-2xl">Outbox</h1>
          <button type="button" disabled={!online || items.length === 0} className="inline-flex items-center gap-1.5 rounded-lg bg-[#1f9d4c] px-3 py-1.5 text-sm font-bold text-white disabled:opacity-50" onClick={onSendNow}>
            <Send className="h-4 w-4" /> Send now
          </button>
        </div>
        <p className="mt-1 text-sm text-slate-500">
          {online ? "These go out automatically. Anything the mail server refused shows why." : (
            <span className="inline-flex items-center gap-1.5"><CloudOff className="h-4 w-4" /> You're offline. These will be sent when you're back online.</span>
          )}
        </p>

        {items.length === 0 ? (
          <p className="mt-6 text-sm text-slate-500">Nothing waiting to be sent.</p>
        ) : (
          <ul className="mt-4 divide-y divide-slate-100 rounded-xl border border-slate-200">
            {items.map((item) => (
              <li key={item.id} className="flex items-center gap-3 px-3 py-3">
                <span className="shrink-0">
                  {item.status === "failed" ? <AlertTriangle className="h-5 w-5 text-red-500" /> : item.status === "sending" ? <Loader2 className="h-5 w-5 animate-spin text-[#1f9d4c]" /> : item.kind === "draft" ? <FileText className="h-5 w-5 text-slate-400" /> : <Send className="h-5 w-5 text-slate-400" />}
                </span>
                <div className="min-w-0 flex-1">
                  <p className="truncate text-sm font-semibold text-slate-900">{item.subject}</p>
                  <p className="truncate text-xs text-slate-500">
                    {item.kind === "draft" ? "Draft" : `To ${item.to || "(no recipient)"}`} · {fullDate(new Date(item.createdAt).toISOString())} ·{" "}
                    {item.status === "failed" ? "Not sent" : item.status === "sending" ? "Sending…" : "Waiting"}
                  </p>
                  {item.error && <p className="text-xs text-red-600">{item.error}</p>}
                </div>
                {item.status === "failed" && (
                  <button type="button" title="Try again" aria-label={`Try sending ${item.subject} again`} className="rounded p-1.5 text-slate-500 hover:bg-slate-100" onClick={() => void retry(item).then(onSendNow)}>
                    <RotateCw className="h-4 w-4" />
                  </button>
                )}
                <button type="button" title="Delete" aria-label={`Delete ${item.subject}`} className="rounded p-1.5 text-slate-500 hover:bg-slate-100 hover:text-red-600" onClick={() => void remove(item)}>
                  <Trash2 className="h-4 w-4" />
                </button>
              </li>
            ))}
          </ul>
        )}
      </div>
    </section>
  );
}
