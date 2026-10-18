import React, { useCallback, useEffect, useState } from "react";
import { CheckCircle2, Copy, ExternalLink, Loader2, Mail, RefreshCw, XCircle, AlertTriangle } from "lucide-react";
import { laravelApi } from "../shared/api";
import type { useToast } from "../toast/ToastProvider";

type RecordStatus = "ok" | "missing" | "different" | null;

type EmailSetup = {
  domain: string;
  ready: boolean;
  domain_with_us: boolean;
  setup_ticket: string | null;
  records: Array<{
    key: string;
    type: string;
    host: string;
    value: string;
    priority: number | null;
    required: boolean;
    purpose: string;
    status: RecordStatus;
  }>;
  settings: {
    incoming: { protocol: string; host: string; port: number; security: string };
    outgoing: { protocol: string; host: string; port: number; security: string; alternative_port: number; alternative_security: string };
    username: string;
    webmail_url: string;
  };
  checked_at: string | null;
};

const STATUS: Record<Exclude<RecordStatus, null>, { label: string; className: string; Icon: React.ComponentType<{ className?: string }> }> = {
  ok: { label: "In place", className: "text-primary", Icon: CheckCircle2 },
  missing: { label: "Not found yet", className: "text-red-300", Icon: XCircle },
  different: { label: "Found, but different", className: "text-yellow-200", Icon: AlertTriangle },
};

/**
 * "Email setup" tab of an email-only service: the DNS records the domain
 * needs (with a live check of each), mail-app settings and the webmail link.
 */
export function EmailSetupPanel({ serviceId, token, toast }: { serviceId: number; token: string; toast: ReturnType<typeof useToast> }) {
  const [setup, setSetup] = useState<EmailSetup | null>(null);
  const [isChecking, setIsChecking] = useState(false);
  const [isSending, setIsSending] = useState(false);
  const base = `/api/v1/client/services/${serviceId}/email-setup`;

  const load = useCallback(async () => {
    setIsChecking(true);
    try {
      setSetup(await laravelApi<EmailSetup>(base, token));
    } catch (error) {
      toast.push({ type: "error", message: error instanceof Error ? error.message : "Could not load your email setup." });
    } finally {
      setIsChecking(false);
    }
  }, [base, token, toast]);

  useEffect(() => {
    void load();
  }, [load]);

  const copy = (value: string) => {
    void navigator.clipboard?.writeText(value).then(
      () => toast.push({ type: "success", message: "Copied." }),
      () => toast.push({ type: "error", message: "Could not copy — select the text and copy it instead." }),
    );
  };

  const sendInstructions = async () => {
    setIsSending(true);
    try {
      const result = await laravelApi<{ message: string }>(`${base}/send`, token, { method: "POST" });
      toast.push({ type: "success", message: result.message });
    } catch (error) {
      toast.push({ type: "error", message: error instanceof Error ? error.message : "Could not send the instructions." });
    } finally {
      setIsSending(false);
    }
  };

  if (!setup) {
    return (
      <div className="flex min-h-40 items-center justify-center text-white/50">
        <Loader2 className="h-5 w-5 animate-spin" />
      </div>
    );
  }

  if (!setup.ready) {
    return (
      <div>
        <h2>Email setup</h2>
        <p className="mt-2 text-sm text-white/55">Your email is being set up. The DNS records will appear here (and in your inbox) as soon as it's ready.</p>
      </div>
    );
  }

  const required = setup.records.filter((record) => record.required);
  const allInPlace = required.length > 0 && required.every((record) => record.status === "ok");

  return (
    <div className="grid gap-5">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div className="min-w-0">
          <h2>Email setup</h2>
          <p className="mt-1 text-sm text-white/54">
            {setup.domain_with_us
              ? `${setup.domain} is registered with us — our team adds these records for you${setup.setup_ticket ? ` (ticket ${setup.setup_ticket})` : ""}.`
              : `Add these records where ${setup.domain}'s DNS is managed (your registrar or DNS provider). Email reaches you once the MX record is in place.`}
          </p>
        </div>
        <div className="flex flex-wrap gap-2">
          <button type="button" className="btn-outline" onClick={() => void load()} disabled={isChecking}>
            <RefreshCw className={isChecking ? "h-4 w-4 animate-spin" : "h-4 w-4"} />
            Check again
          </button>
          <button type="button" className="btn-outline" onClick={() => void sendInstructions()} disabled={isSending}>
            {isSending ? <Loader2 className="h-4 w-4 animate-spin" /> : <Mail className="h-4 w-4" />}
            Email me these
          </button>
        </div>
      </div>

      {allInPlace ? (
        <p className="rounded-lg border border-primary/30 bg-primary/10 p-3 text-sm font-bold text-primary">
          All set — your domain points its email to us. Create mailboxes in the Email Accounts tab.
        </p>
      ) : (
        <p className="rounded-lg border border-yellow-400/30 bg-yellow-400/10 p-3 text-sm text-yellow-100">
          Not everything is in place yet. DNS changes can take from a few minutes up to 24–48 hours to show — check again later.
        </p>
      )}

      <div className="grid gap-3">
        {setup.records.map((record, index) => {
          const status = record.status ? STATUS[record.status] : null;
          return (
            <div key={record.key} className="rounded-lg border border-white/10 bg-black/20 p-4">
              <div className="flex flex-wrap items-center justify-between gap-2">
                <p className="text-sm font-black text-white">
                  {index + 1}. {record.type} record{record.required ? "" : " (recommended)"}
                </p>
                {status && (
                  <span className={`inline-flex items-center gap-1 text-xs font-bold ${status.className}`}>
                    <status.Icon className="h-4 w-4" />
                    {status.label}
                  </span>
                )}
              </div>
              <dl className="mt-3 grid gap-2 text-sm sm:grid-cols-[120px_minmax(0,1fr)]">
                <dt className="text-white/45">Host / Name</dt>
                <dd className="flex min-w-0 items-center gap-2 font-mono text-white">
                  {record.host}
                  <button type="button" className="text-white/45 hover:text-primary" onClick={() => copy(record.host)} aria-label="Copy host">
                    <Copy className="h-3.5 w-3.5" />
                  </button>
                </dd>
                {record.priority !== null && (
                  <>
                    <dt className="text-white/45">Priority</dt>
                    <dd className="font-mono text-white">{record.priority}</dd>
                  </>
                )}
                <dt className="text-white/45">Value</dt>
                <dd className="flex min-w-0 items-start gap-2">
                  <code className="min-w-0 flex-1 break-all rounded bg-black/30 px-2 py-1 text-xs text-white">{record.value}</code>
                  <button type="button" className="mt-1 text-white/45 hover:text-primary" onClick={() => copy(record.value)} aria-label="Copy value">
                    <Copy className="h-3.5 w-3.5" />
                  </button>
                </dd>
              </dl>
              <p className="mt-3 text-xs leading-5 text-white/50">{record.purpose}</p>
            </div>
          );
        })}
      </div>
      <p className="text-xs text-white/45">"@" means the domain itself — some providers want it left blank or written as {setup.domain}.</p>

      <div className="grid gap-3 sm:grid-cols-2">
        <div className="rounded-lg border border-white/10 bg-black/20 p-4 text-sm">
          <p className="font-black text-white">Green Mail</p>
          <p className="mt-1 text-white/55">Sign in with the full email address and its password.</p>
          <a className="btn-primary mt-3 inline-flex" href={setup.settings.webmail_url} target="_blank" rel="noopener">
            Open Green Mail
            <ExternalLink className="h-4 w-4" />
          </a>
        </div>
        <div className="rounded-lg border border-white/10 bg-black/20 p-4 text-sm text-white/70">
          <p className="font-black text-white">Phone and desktop mail apps</p>
          <p className="mt-2">
            Incoming: {setup.settings.incoming.protocol} <span className="font-mono text-white">{setup.settings.incoming.host}</span>, port {setup.settings.incoming.port} ({setup.settings.incoming.security})
          </p>
          <p className="mt-1">
            Outgoing: {setup.settings.outgoing.protocol} <span className="font-mono text-white">{setup.settings.outgoing.host}</span>, port {setup.settings.outgoing.port} ({setup.settings.outgoing.security}) or {setup.settings.outgoing.alternative_port} ({setup.settings.outgoing.alternative_security})
          </p>
          <p className="mt-1">Username: {setup.settings.username.toLowerCase()}</p>
        </div>
      </div>
    </div>
  );
}
