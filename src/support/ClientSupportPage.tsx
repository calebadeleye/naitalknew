import React, { useCallback, useEffect, useState } from "react";
import { ArrowLeft, Bot, LifeBuoy, Loader2, Plus } from "lucide-react";
import { OPEN_HELP_ASSISTANT_EVENT } from "../components/ClientHelpAssistant";
import { downloadLaravelFile, laravelApi } from "../shared/api";
import type { useToast } from "../toast/ToastProvider";
import {
  TICKET_CATEGORIES,
  TicketComposer,
  TicketStatusPill,
  TicketThread,
  buildTicketForm,
  categoryLabel,
  formatTicketTime,
  type TicketMessage,
  type TicketStatus,
} from "./ticketShared";

type TicketSummary = {
  ticket_number: string;
  subject: string;
  category: string;
  status: TicketStatus;
  last_reply_at: string | null;
  created_at: string;
  hosting_service?: { primary_domain: string | null } | null;
};

type TicketDetail = {
  ticket: { ticket_number: string; subject: string; category: string; status: TicketStatus; website: string | null; created_at: string };
  messages: TicketMessage[];
};

type Toast = ReturnType<typeof useToast>;

export function ClientSupportPage({
  token,
  toast,
  navigate,
  ticketNumber,
  isNew,
}: {
  token: string;
  toast: Toast;
  navigate: (path: string) => void;
  ticketNumber: string | null;
  isNew: boolean;
}) {
  if (ticketNumber) return <TicketView token={token} toast={toast} navigate={navigate} ticketNumber={ticketNumber} />;
  if (isNew) return <NewTicketForm token={token} toast={toast} navigate={navigate} />;
  return <TicketList token={token} toast={toast} navigate={navigate} />;
}

function TicketList({ token, toast, navigate }: { token: string; toast: Toast; navigate: (path: string) => void }) {
  const [tickets, setTickets] = useState<TicketSummary[] | null>(null);

  useEffect(() => {
    laravelApi<{ tickets: TicketSummary[] }>("/api/v1/client/support-tickets", token)
      .then((response) => setTickets(response.tickets))
      .catch((error) => {
        setTickets([]);
        toast.push({ type: "error", message: error instanceof Error ? error.message : "Could not load your tickets." });
      });
  }, [token, toast]);

  return (
    <section className="grid gap-5">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <h2 className="text-2xl font-black text-white">Support Tickets</h2>
          <p className="mt-1 text-sm text-white/58">Ask our team anything about your hosting, website, email, domains or billing. We reply here and by email.</p>
        </div>
        <button type="button" className="btn-primary" onClick={() => navigate("/client/support/new")}>
          <Plus className="h-4 w-4" /> New ticket
        </button>
      </div>

      <div className="portal-card flex flex-wrap items-center justify-between gap-3 !py-4">
        <p className="flex items-center gap-2 text-sm text-white/70">
          <Bot className="h-4 w-4 text-primary" /> Need a quick answer? The help assistant can answer most questions instantly.
        </p>
        <button type="button" className="btn-outline !min-h-9 !text-[11px]" onClick={() => window.dispatchEvent(new Event(OPEN_HELP_ASSISTANT_EVENT))}>
          Ask the assistant
        </button>
      </div>

      {tickets === null ? (
        <div className="flex items-center gap-2 text-sm text-white/50">
          <Loader2 className="h-4 w-4 animate-spin" /> Loading your tickets...
        </div>
      ) : tickets.length === 0 ? (
        <div className="portal-card text-center">
          <LifeBuoy className="mx-auto h-8 w-8 text-white/30" />
          <p className="mt-3 text-sm text-white/60">You haven't opened any tickets yet.</p>
        </div>
      ) : (
        <div className="grid gap-2">
          {tickets.map((ticket) => (
            <button
              key={ticket.ticket_number}
              type="button"
              className="portal-card flex flex-wrap items-center justify-between gap-3 !py-4 text-left transition hover:border-primary/40"
              onClick={() => navigate(`/client/support/${ticket.ticket_number}`)}
            >
              <div className="min-w-0">
                <p className="truncate font-bold text-white">{ticket.subject}</p>
                <p className="mt-1 text-xs text-white/50">
                  {ticket.ticket_number} · {categoryLabel(ticket.category)}
                  {ticket.hosting_service?.primary_domain ? ` · ${ticket.hosting_service.primary_domain}` : ""} · Updated {formatTicketTime(ticket.last_reply_at || ticket.created_at)}
                </p>
              </div>
              <TicketStatusPill status={ticket.status} viewer="client" />
            </button>
          ))}
        </div>
      )}
    </section>
  );
}

function NewTicketForm({ token, toast, navigate }: { token: string; toast: Toast; navigate: (path: string) => void }) {
  const [services, setServices] = useState<Array<{ id: number; primary_domain: string | null; service_number: string }>>([]);
  const [subject, setSubject] = useState("");
  const [category, setCategory] = useState("technical");
  const [priority, setPriority] = useState("normal");
  const [serviceId, setServiceId] = useState("");
  const [message, setMessage] = useState("");
  const [files, setFiles] = useState<File[]>([]);
  const [isSending, setIsSending] = useState(false);

  useEffect(() => {
    laravelApi<{ services: typeof services }>("/api/v1/client/support-tickets", token)
      .then((response) => setServices(response.services))
      .catch(() => setServices([]));
  }, [token]);

  const submit = async (event: React.FormEvent) => {
    event.preventDefault();
    setIsSending(true);
    try {
      const response = await laravelApi<TicketDetail>("/api/v1/client/support-tickets", token, {
        method: "POST",
        body: buildTicketForm({ subject, category, priority, hosting_service_id: serviceId || null, message }, files),
      });
      toast.push({ type: "success", message: `Ticket ${response.ticket.ticket_number} opened — we'll reply here and by email.` });
      navigate(`/client/support/${response.ticket.ticket_number}`);
    } catch (error) {
      toast.push({ type: "error", message: error instanceof Error ? error.message : "Could not open your ticket." });
    } finally {
      setIsSending(false);
    }
  };

  return (
    <section className="mx-auto grid w-full max-w-2xl gap-4">
      <button type="button" className="auth-link flex items-center gap-1.5 text-sm" onClick={() => navigate("/client/support")}>
        <ArrowLeft className="h-4 w-4" /> All tickets
      </button>
      <form className="portal-card grid gap-4" onSubmit={submit}>
        <h2 className="text-xl font-black text-white">Open a support ticket</h2>
        <label className="admin-field">
          <span>Subject</span>
          <input value={subject} onChange={(event) => setSubject(event.target.value)} maxLength={160} placeholder="e.g. My website shows an error" required />
        </label>
        <div className="grid gap-4 sm:grid-cols-2">
          <label className="admin-field">
            <span>Category</span>
            <select value={category} onChange={(event) => setCategory(event.target.value)}>
              {TICKET_CATEGORIES.map((option) => (
                <option key={option.value} value={option.value}>
                  {option.label}
                </option>
              ))}
            </select>
          </label>
          <label className="admin-field">
            <span>Priority</span>
            <select value={priority} onChange={(event) => setPriority(event.target.value)}>
              <option value="low">Low — a question</option>
              <option value="normal">Normal</option>
              <option value="high">High — my site or email is down</option>
            </select>
          </label>
        </div>
        {services.length > 0 && (
          <label className="admin-field">
            <span>Which website is this about? (optional)</span>
            <select value={serviceId} onChange={(event) => setServiceId(event.target.value)}>
              <option value="">Not about a specific website</option>
              {services.map((service) => (
                <option key={service.id} value={service.id}>
                  {service.primary_domain || service.service_number}
                </option>
              ))}
            </select>
          </label>
        )}
        <TicketComposer
          value={message}
          onChange={setMessage}
          files={files}
          onFilesChange={setFiles}
          placeholder="Tell us what's happening, what you expected, and any error messages you see."
          disabled={isSending}
        />
        <button type="submit" className="btn-primary justify-center" disabled={isSending || !subject.trim() || !message.trim()}>
          {isSending ? "Sending..." : "Open ticket"}
        </button>
      </form>
    </section>
  );
}

function TicketView({ token, toast, navigate, ticketNumber }: { token: string; toast: Toast; navigate: (path: string) => void; ticketNumber: string }) {
  const [detail, setDetail] = useState<TicketDetail | null>(null);
  const [reply, setReply] = useState("");
  const [files, setFiles] = useState<File[]>([]);
  const [isBusy, setIsBusy] = useState(false);
  const base = `/api/v1/client/support-tickets/${ticketNumber}`;

  const load = useCallback(() => {
    laravelApi<TicketDetail>(base, token)
      .then(setDetail)
      .catch((error) => {
        toast.push({ type: "error", message: error instanceof Error ? error.message : "Could not load this ticket." });
        navigate("/client/support");
      });
  }, [base, token, toast, navigate]);

  useEffect(load, [load]);

  const send = async (event: React.FormEvent) => {
    event.preventDefault();
    setIsBusy(true);
    try {
      setDetail(await laravelApi<TicketDetail>(`${base}/replies`, token, { method: "POST", body: buildTicketForm({ message: reply }, files) }));
      setReply("");
      setFiles([]);
      toast.push({ type: "success", message: "Reply sent." });
    } catch (error) {
      toast.push({ type: "error", message: error instanceof Error ? error.message : "Could not send your reply." });
    } finally {
      setIsBusy(false);
    }
  };

  const close = async () => {
    setIsBusy(true);
    try {
      setDetail(await laravelApi<TicketDetail>(`${base}/close`, token, { method: "POST" }));
      toast.push({ type: "success", message: "Ticket closed. Reply any time to reopen it." });
    } catch (error) {
      toast.push({ type: "error", message: error instanceof Error ? error.message : "Could not close this ticket." });
    } finally {
      setIsBusy(false);
    }
  };

  if (!detail) {
    return (
      <div className="flex min-h-[30vh] items-center justify-center text-white/50">
        <Loader2 className="h-6 w-6 animate-spin" />
      </div>
    );
  }

  const { ticket } = detail;

  return (
    <section className="mx-auto grid w-full max-w-3xl gap-4">
      <button type="button" className="auth-link flex items-center gap-1.5 text-sm" onClick={() => navigate("/client/support")}>
        <ArrowLeft className="h-4 w-4" /> All tickets
      </button>
      <div className="portal-card">
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div className="min-w-0">
            <h2 className="break-words text-xl font-black text-white">{ticket.subject}</h2>
            <p className="mt-1 text-xs text-white/50">
              {ticket.ticket_number} · {categoryLabel(ticket.category)}
              {ticket.website ? ` · ${ticket.website}` : ""} · Opened {formatTicketTime(ticket.created_at)}
            </p>
          </div>
          <TicketStatusPill status={ticket.status} viewer="client" />
        </div>
      </div>

      <TicketThread
        messages={detail.messages}
        viewer="client"
        onDownload={(message, index, name) =>
          void downloadLaravelFile(`${base}/messages/${message.id}/attachments/${index}`, token, name).catch((error) =>
            toast.push({ type: "error", message: error instanceof Error ? error.message : "Download failed." }),
          )
        }
      />

      <form className="portal-card grid gap-3" onSubmit={send}>
        {ticket.status === "closed" && <p className="text-xs text-white/55">This ticket is closed. Sending a reply will reopen it.</p>}
        <TicketComposer value={reply} onChange={setReply} files={files} onFilesChange={setFiles} placeholder="Write a reply..." disabled={isBusy} />
        <div className="flex flex-wrap justify-end gap-2">
          {ticket.status !== "closed" && (
            <button type="button" className="btn-outline" disabled={isBusy} onClick={() => void close()}>
              Close ticket
            </button>
          )}
          <button type="submit" className="btn-primary" disabled={isBusy || !reply.trim()}>
            {isBusy ? "Sending..." : "Send reply"}
          </button>
        </div>
      </form>
    </section>
  );
}
