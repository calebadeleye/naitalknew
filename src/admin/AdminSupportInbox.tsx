import React, { useCallback, useEffect, useState } from "react";
import { ArrowLeft, Loader2, Search } from "lucide-react";
import { downloadLaravelFile, laravelApi } from "../shared/api";
import {
  TicketComposer,
  TicketStatusPill,
  TicketThread,
  buildTicketForm,
  categoryLabel,
  formatTicketTime,
  type TicketMessage,
  type TicketStatus,
} from "../support/ticketShared";

type InboxTicket = {
  ticket_number: string;
  subject: string;
  category: string;
  status: TicketStatus;
  priority: string;
  last_reply_by: "client" | "staff" | null;
  last_reply_at: string | null;
  created_at: string;
  client: { id: number; name: string | null; email: string | null };
  website: string | null;
};

type InboxPage = {
  data: InboxTicket[];
  current_page: number;
  last_page: number;
  counts: { open: number; answered: number; closed: number };
};

type TicketDetail = { ticket: InboxTicket & { closed_at: string | null }; messages: TicketMessage[] };

const FILTERS: Array<{ value: string; label: string; count?: keyof InboxPage["counts"] }> = [
  { value: "active", label: "Active" },
  { value: "open", label: "Needs reply", count: "open" },
  { value: "answered", label: "Answered", count: "answered" },
  { value: "closed", label: "Closed", count: "closed" },
  { value: "", label: "All" },
];

const PRIORITY_TONE: Record<string, string> = { urgent: "text-red-300", high: "text-yellow-200", normal: "text-white/60", low: "text-white/40" };

/** Admin side of support tickets: an inbox (waiting-for-us first) and the conversation with reply/close/priority. */
export function AdminSupportInbox({ adminToken }: { adminToken: string }) {
  const [openTicket, setOpenTicket] = useState<string | null>(() => new URLSearchParams(window.location.search).get("ticket"));

  const show = (ticketNumber: string | null) => {
    const url = new URL(window.location.href);
    if (ticketNumber) url.searchParams.set("ticket", ticketNumber);
    else url.searchParams.delete("ticket");
    window.history.replaceState(null, "", url.toString());
    setOpenTicket(ticketNumber);
  };

  return openTicket ? (
    <AdminTicketView adminToken={adminToken} ticketNumber={openTicket} onBack={() => show(null)} />
  ) : (
    <AdminTicketList adminToken={adminToken} onOpen={show} />
  );
}

function AdminTicketList({ adminToken, onOpen }: { adminToken: string; onOpen: (ticketNumber: string) => void }) {
  const [filter, setFilter] = useState("active");
  const [search, setSearch] = useState("");
  const [query, setQuery] = useState("");
  const [page, setPage] = useState(1);
  const [inbox, setInbox] = useState<InboxPage | null>(null);
  const [isLoading, setIsLoading] = useState(false);

  useEffect(() => {
    const params = new URLSearchParams();
    if (filter) params.set("status", filter);
    if (query) params.set("search", query);
    if (page > 1) params.set("page", String(page));
    setIsLoading(true);
    laravelApi<InboxPage>(`/api/v1/admin/support-tickets?${params.toString()}`, adminToken)
      .then(setInbox)
      .catch(() => setInbox(null))
      .finally(() => setIsLoading(false));
  }, [adminToken, filter, query, page]);

  return (
    <section className="grid gap-5">
      <div>
        <h2 className="text-2xl font-black text-white">Support Tickets</h2>
        <p className="mt-1 text-sm text-white/58">Tickets waiting for a reply come first. Clients are emailed when you reply.</p>
      </div>

      <div className="flex flex-wrap items-center gap-2">
        {FILTERS.map((option) => (
          <button
            key={option.label}
            type="button"
            className={`rounded-full border px-3 py-1.5 text-xs font-bold ${filter === option.value ? "border-primary/60 bg-primary/10 text-primary" : "border-white/15 text-white/65 hover:border-white/30"}`}
            onClick={() => {
              setFilter(option.value);
              setPage(1);
            }}
          >
            {option.label}
            {option.count && inbox ? ` (${inbox.counts[option.count]})` : ""}
          </button>
        ))}
        <form
          className="ml-auto flex items-center gap-2"
          onSubmit={(event) => {
            event.preventDefault();
            setQuery(search.trim());
            setPage(1);
          }}
        >
          <label className="admin-field !gap-0">
            <span className="sr-only">Search tickets</span>
            <input value={search} onChange={(event) => setSearch(event.target.value)} placeholder="Ticket, subject, client..." className="!min-h-9 !py-1.5 text-sm" />
          </label>
          <button type="submit" className="btn-outline !min-h-9 !px-3" aria-label="Search">
            <Search className="h-4 w-4" />
          </button>
        </form>
      </div>

      <div className="admin-panel !p-0 overflow-x-auto">
        {isLoading && !inbox ? (
          <div className="flex items-center gap-2 p-5 text-sm text-white/50">
            <Loader2 className="h-4 w-4 animate-spin" /> Loading tickets...
          </div>
        ) : !inbox || inbox.data.length === 0 ? (
          <p className="p-5 text-sm text-white/55">No tickets here.</p>
        ) : (
          <table className="w-full min-w-[720px] text-left text-sm">
            <thead className="text-xs text-white/45">
              <tr>
                <th className="px-4 py-3 font-bold">Ticket</th>
                <th className="px-4 py-3 font-bold">Client</th>
                <th className="px-4 py-3 font-bold">Priority</th>
                <th className="px-4 py-3 font-bold">Last activity</th>
                <th className="px-4 py-3 font-bold">Status</th>
              </tr>
            </thead>
            <tbody>
              {inbox.data.map((ticket) => (
                <tr key={ticket.ticket_number} className="cursor-pointer border-t border-white/10 hover:bg-white/[0.03]" onClick={() => onOpen(ticket.ticket_number)}>
                  <td className="px-4 py-3">
                    <p className="font-bold text-white">{ticket.subject}</p>
                    <p className="text-xs text-white/45">
                      {ticket.ticket_number} · {categoryLabel(ticket.category)}
                      {ticket.website ? ` · ${ticket.website}` : ""}
                    </p>
                  </td>
                  <td className="px-4 py-3 text-xs">
                    <p className="text-white/85">{ticket.client.name || "—"}</p>
                    <p className="text-white/45">{ticket.client.email}</p>
                  </td>
                  <td className={`px-4 py-3 text-xs font-bold capitalize ${PRIORITY_TONE[ticket.priority] ?? "text-white/60"}`}>{ticket.priority}</td>
                  <td className="px-4 py-3 text-xs text-white/60">
                    {formatTicketTime(ticket.last_reply_at || ticket.created_at)}
                    {ticket.last_reply_by && <span className="block text-white/40">by {ticket.last_reply_by === "staff" ? "us" : "client"}</span>}
                  </td>
                  <td className="px-4 py-3">
                    <TicketStatusPill status={ticket.status} viewer="staff" />
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>

      {inbox && inbox.last_page > 1 && (
        <div className="flex items-center justify-end gap-2 text-xs text-white/60">
          <button type="button" className="btn-outline !min-h-8 !px-3" disabled={page <= 1} onClick={() => setPage(page - 1)}>
            Previous
          </button>
          Page {inbox.current_page} of {inbox.last_page}
          <button type="button" className="btn-outline !min-h-8 !px-3" disabled={page >= inbox.last_page} onClick={() => setPage(page + 1)}>
            Next
          </button>
        </div>
      )}
    </section>
  );
}

function AdminTicketView({ adminToken, ticketNumber, onBack }: { adminToken: string; ticketNumber: string; onBack: () => void }) {
  const [detail, setDetail] = useState<TicketDetail | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [reply, setReply] = useState("");
  const [files, setFiles] = useState<File[]>([]);
  const [isBusy, setIsBusy] = useState(false);
  const base = `/api/v1/admin/support-tickets/${ticketNumber}`;

  const load = useCallback(() => {
    laravelApi<TicketDetail>(base, adminToken)
      .then(setDetail)
      .catch((err) => setError(err instanceof Error ? err.message : "Could not load this ticket."));
  }, [base, adminToken]);

  useEffect(load, [load]);

  const send = async (close: boolean) => {
    setIsBusy(true);
    setError(null);
    try {
      setDetail(await laravelApi<TicketDetail>(`${base}/replies`, adminToken, { method: "POST", body: buildTicketForm({ message: reply, close }, files) }));
      setReply("");
      setFiles([]);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Could not send the reply.");
    } finally {
      setIsBusy(false);
    }
  };

  const update = async (changes: { status?: string; priority?: string }) => {
    setIsBusy(true);
    try {
      setDetail(await laravelApi<TicketDetail>(base, adminToken, { method: "PATCH", body: JSON.stringify(changes) }));
    } catch (err) {
      setError(err instanceof Error ? err.message : "Could not update the ticket.");
    } finally {
      setIsBusy(false);
    }
  };

  return (
    <section className="grid gap-4">
      <button type="button" className="flex items-center gap-1.5 text-sm font-bold text-white/65 hover:text-white" onClick={onBack}>
        <ArrowLeft className="h-4 w-4" /> All tickets
      </button>

      {error && <p className="rounded-lg border border-red-500/40 bg-red-500/10 p-3 text-sm text-red-100">{error}</p>}

      {!detail ? (
        !error && (
          <div className="flex items-center gap-2 text-sm text-white/50">
            <Loader2 className="h-4 w-4 animate-spin" /> Loading ticket...
          </div>
        )
      ) : (
        <>
          <div className="admin-panel !p-5">
            <div className="flex flex-wrap items-start justify-between gap-3">
              <div className="min-w-0">
                <h2 className="break-words text-xl font-black text-white">{detail.ticket.subject}</h2>
                <p className="mt-1 text-xs text-white/50">
                  {detail.ticket.ticket_number} · {categoryLabel(detail.ticket.category)}
                  {detail.ticket.website ? ` · ${detail.ticket.website}` : ""} · Opened {formatTicketTime(detail.ticket.created_at)}
                </p>
                <p className="mt-1 text-xs text-white/70">
                  {detail.ticket.client.name} · {detail.ticket.client.email}
                </p>
              </div>
              <div className="flex flex-wrap items-center gap-2">
                <TicketStatusPill status={detail.ticket.status} viewer="staff" />
                <label className="admin-field !gap-0">
                  <span className="sr-only">Priority</span>
                  <select value={detail.ticket.priority} disabled={isBusy} onChange={(event) => void update({ priority: event.target.value })} className="!min-h-9 !py-1 text-xs">
                    {["low", "normal", "high", "urgent"].map((priority) => (
                      <option key={priority} value={priority}>
                        {priority[0].toUpperCase() + priority.slice(1)} priority
                      </option>
                    ))}
                  </select>
                </label>
                {detail.ticket.status === "closed" ? (
                  <button type="button" className="btn-outline !min-h-9 !text-[11px]" disabled={isBusy} onClick={() => void update({ status: "open" })}>
                    Reopen
                  </button>
                ) : (
                  <button type="button" className="btn-outline !min-h-9 !text-[11px]" disabled={isBusy} onClick={() => void update({ status: "closed" })}>
                    Close
                  </button>
                )}
              </div>
            </div>
          </div>

          <TicketThread
            messages={detail.messages}
            viewer="staff"
            onDownload={(message, index, name) =>
              void downloadLaravelFile(`${base}/messages/${message.id}/attachments/${index}`, adminToken, name).catch((err) =>
                setError(err instanceof Error ? err.message : "Download failed."),
              )
            }
          />

          <form
            className="admin-panel grid gap-3 !p-5"
            onSubmit={(event) => {
              event.preventDefault();
              void send(false);
            }}
          >
            <TicketComposer value={reply} onChange={setReply} files={files} onFilesChange={setFiles} placeholder="Reply to the client — they'll get it by email too." disabled={isBusy} />
            <div className="flex flex-wrap justify-end gap-2">
              <button type="button" className="btn-outline" disabled={isBusy || !reply.trim()} onClick={() => void send(true)}>
                Reply & close
              </button>
              <button type="submit" className="btn-primary" disabled={isBusy || !reply.trim()}>
                {isBusy ? "Sending..." : "Send reply"}
              </button>
            </div>
          </form>
        </>
      )}
    </section>
  );
}
