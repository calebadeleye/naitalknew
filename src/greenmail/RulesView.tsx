import React, { useCallback, useEffect, useState } from "react";
import { CalendarClock, Clock, Filter, Loader2, Palmtree, Pencil, Plus, Trash2, Workflow, X } from "lucide-react";
import { gm, type Folder, type MailRule, type RuleKind, type ScheduledEmail, type Vacation } from "./api";
import { useFeedback } from "./feedback";
import { htmlToText } from "./RichText";
import { announceChange, useOnChange } from "./sync";
import { useTemplates } from "./TemplatesView";

const FIELD_LABEL: Record<MailRule["field"], string> = { any: "Every email", from: "From", to: "To / Cc", subject: "Subject" };
const OPERATOR_LABEL: Record<MailRule["operator"], string> = { contains: "contains", is: "is exactly", begins: "begins with", ends: "ends with" };
const ACTIONS: Record<RuleKind, Array<[MailRule["action"], string]>> = {
  filter: [["move", "Move to folder"], ["mark_read", "Mark as read"], ["star", "Star it"], ["delete", "Delete it"]],
  automation: [["auto_reply", "Reply automatically"], ["forward", "Forward a copy to"]],
};

type Draft = Omit<MailRule, "id" | "name" | "active"> & { id?: number; name: string; active: boolean };

const blank = (kind: RuleKind): Draft => ({ kind, name: "", field: "from", operator: "contains", value: "", action: ACTIONS[kind][0][0], target: null, reply_subject: "", reply_text: "", active: true });

const input = "w-full rounded-lg border border-slate-300 px-3 py-2 text-sm text-slate-900 outline-none focus:border-[#1f9d4c]";

/** Filters: sort arriving mail on the server — it happens even when Green Mail is closed. */
export function FiltersView({ token, folders, onSessionError }: { token: string; folders: Folder[]; onSessionError: (error: unknown) => void }) {
  return (
    <Page icon={<Filter className="h-6 w-6 text-[#1f9d4c]" />} title="Filters" intro="Sort mail as it arrives: move it to a folder, mark it read, star it or delete it. Filters run on the mail server, so they work even when Green Mail is closed and on your phone's mail app too.">
      <RulesSection kind="filter" token={token} folders={folders} onSessionError={onSessionError} />
    </Page>
  );
}

/** Automation: vacation reply, automatic replies and forwarding, and emails scheduled for later. */
export function AutomationView({ token, onSessionError }: { token: string; onSessionError: (error: unknown) => void }) {
  return (
    <Page icon={<Workflow className="h-6 w-6 text-[#1f9d4c]" />} title="Automation" intro="Let Green Mail answer and pass on mail for you, and send emails at the right time.">
      <VacationCard token={token} onSessionError={onSessionError} />
      <div className="mt-6">
        <h2 className="text-lg font-black text-slate-900">Automatic replies and forwarding</h2>
        <p className="mb-3 text-sm text-slate-500">Each sender gets an automatic reply at most once a day. Spam is never answered or forwarded. While your vacation reply is on, it replies instead.</p>
        <RulesSection kind="automation" token={token} folders={[]} onSessionError={onSessionError} />
      </div>
      <ScheduledCard token={token} onSessionError={onSessionError} />
    </Page>
  );
}

function Page({ icon, title, intro, children }: { icon: React.ReactNode; title: string; intro: string; children: React.ReactNode }) {
  return (
    <section className="flex min-h-0 flex-1 flex-col overflow-y-auto bg-white p-3 sm:p-6">
      <div className="mx-auto w-full max-w-3xl pb-10">
        <h1 className="flex items-center gap-2 text-xl font-black text-slate-900 sm:text-2xl">{icon} {title}</h1>
        <p className="mt-1 text-sm text-slate-500">{intro}</p>
        <div className="mt-5">{children}</div>
      </div>
    </section>
  );
}

function RulesSection({ kind, token, folders, onSessionError }: { kind: RuleKind; token: string; folders: Folder[]; onSessionError: (error: unknown) => void }) {
  const [rules, setRules] = useState<MailRule[] | null>(null);
  const [editing, setEditing] = useState<Draft | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const { toast, confirm } = useFeedback();
  const templates = useTemplates(token, onSessionError);

  const load = useCallback(() => {
    gm<{ rules: MailRule[] }>(`/rules?kind=${kind}`, token)
      .then((response) => setRules(response.rules))
      .catch((err) => {
        onSessionError(err);
        setRules([]);
      });
  }, [kind, token, onSessionError]);

  useEffect(load, [load]);
  useOnChange("rules", load);

  const fail = (err: unknown, fallback: string) => {
    onSessionError(err);
    toast(err instanceof Error ? err.message : fallback, "error");
  };

  const save = async () => {
    if (!editing) return;
    setBusy(true);
    setError(null);
    try {
      const { id, ...rule } = editing;
      const result = await gm<{ message: string }>(id ? `/rules/${id}` : "/rules", token, { method: id ? "PUT" : "POST", body: JSON.stringify({ ...rule, value: rule.field === "any" ? null : rule.value }) });
      toast(result.message);
      setEditing(null);
      announceChange("rules");
    } catch (err) {
      onSessionError(err);
      setError(err instanceof Error ? err.message : "Could not save the rule.");
    } finally {
      setBusy(false);
    }
  };

  const toggle = async (rule: MailRule) => {
    setRules((current) => current && current.map((r) => (r.id === rule.id ? { ...r, active: !r.active } : r)));
    try {
      const result = await gm<{ message: string }>(`/rules/${rule.id}`, token, { method: "PUT", body: JSON.stringify({ active: !rule.active }) });
      toast(rule.active ? result.message : "Rule switched on. It applies to new mail within a minute.");
    } catch (err) {
      fail(err, "Could not change the rule.");
    }
    announceChange("rules");
  };

  const remove = async (rule: MailRule) => {
    if (!(await confirm({ title: "Delete this rule?", message: rule.name, confirmLabel: "Delete", danger: true }))) return;
    try {
      const result = await gm<{ message: string }>(`/rules/${rule.id}`, token, { method: "DELETE" });
      toast(result.message);
    } catch (err) {
      fail(err, "Could not delete the rule.");
    }
    announceChange("rules");
  };

  const folderChoices = folders.filter((f) => f.role !== "drafts" && f.role !== "sent" && f.role !== "inbox");

  return (
    <div>
      {rules === null ? (
        <Loader2 className="h-5 w-5 animate-spin text-slate-400" />
      ) : rules.length === 0 && !editing ? (
        <p className="rounded-xl border border-dashed border-slate-300 p-5 text-center text-sm text-slate-500">{kind === "filter" ? "No filters yet." : "No automatic replies or forwarding yet."}</p>
      ) : (
        <ul className="divide-y divide-slate-100 rounded-xl border border-slate-200">
          {rules.map((rule) => (
            <li key={rule.id} className="flex items-center gap-3 p-3 sm:p-4">
              <Switch on={rule.active} label={`${rule.active ? "Pause" : "Switch on"} ${rule.name}`} onChange={() => void toggle(rule)} />
              <p className={`min-w-0 flex-1 text-sm ${rule.active ? "text-slate-800" : "text-slate-400"}`}>{rule.name}</p>
              <button type="button" aria-label={`Edit ${rule.name}`} className="rounded p-2 text-slate-500 hover:bg-slate-100" onClick={() => { setError(null); setEditing({ ...rule, value: rule.value ?? "", reply_subject: rule.reply_subject ?? "", reply_text: rule.reply_text ?? "" }); }}>
                <Pencil className="h-4 w-4" />
              </button>
              <button type="button" aria-label={`Delete ${rule.name}`} className="rounded p-2 text-slate-500 hover:bg-slate-100 hover:text-red-600" onClick={() => void remove(rule)}>
                <Trash2 className="h-4 w-4" />
              </button>
            </li>
          ))}
        </ul>
      )}

      {editing ? (
        <form
          className="mt-3 grid gap-3 rounded-xl border border-[#1f9d4c]/40 bg-[#f7fbf8] p-4"
          onSubmit={(event) => {
            event.preventDefault();
            void save();
          }}
        >
          <div className="flex items-center justify-between">
            <p className="font-bold text-slate-900">{editing.id ? "Edit rule" : kind === "filter" ? "New filter" : "New automation"}</p>
            <button type="button" aria-label="Close" className="rounded p-1 text-slate-500 hover:bg-white" onClick={() => setEditing(null)}>
              <X className="h-4 w-4" />
            </button>
          </div>

          <fieldset className="grid gap-2 sm:grid-cols-[150px_150px_1fr]">
            <legend className="mb-1 text-xs font-bold uppercase tracking-wide text-slate-500">When an email arrives and</legend>
            <select aria-label="Which part of the email" value={editing.field} onChange={(event) => setEditing({ ...editing, field: event.target.value as MailRule["field"] })} className={input}>
              {(Object.keys(FIELD_LABEL) as Array<MailRule["field"]>).map((field) => <option key={field} value={field}>{FIELD_LABEL[field]}</option>)}
            </select>
            {editing.field !== "any" && (
              <>
                <select aria-label="How to match" value={editing.operator} onChange={(event) => setEditing({ ...editing, operator: event.target.value as MailRule["operator"] })} className={input}>
                  {(Object.keys(OPERATOR_LABEL) as Array<MailRule["operator"]>).map((op) => <option key={op} value={op}>{OPERATOR_LABEL[op]}</option>)}
                </select>
                <input required aria-label="Text to look for" value={editing.value ?? ""} onChange={(event) => setEditing({ ...editing, value: event.target.value })} placeholder={editing.field === "subject" ? "e.g. invoice" : "e.g. news@shop.com or shop.com"} maxLength={200} className={input} />
              </>
            )}
          </fieldset>

          <fieldset className="grid gap-2 sm:grid-cols-[190px_1fr]">
            <legend className="mb-1 text-xs font-bold uppercase tracking-wide text-slate-500">Then</legend>
            <select aria-label="What to do" value={editing.action} onChange={(event) => setEditing({ ...editing, action: event.target.value as MailRule["action"], target: null })} className={input}>
              {ACTIONS[kind].map(([action, label]) => <option key={action} value={action}>{label}</option>)}
            </select>
            {editing.action === "move" && (
              <select required aria-label="Folder" value={editing.target ?? ""} onChange={(event) => setEditing({ ...editing, target: event.target.value })} className={input}>
                <option value="" disabled>Choose a folder…</option>
                {folderChoices.map((f) => <option key={f.path} value={f.path}>{f.role === "junk" ? "Spam" : f.role === "trash" ? "Trash" : f.role === "archive" ? "Archive" : f.name}</option>)}
              </select>
            )}
            {editing.action === "forward" && (
              <input required type="email" aria-label="Forward to" value={editing.target ?? ""} onChange={(event) => setEditing({ ...editing, target: event.target.value })} placeholder="name@example.com" className={input} />
            )}
            {editing.action === "delete" && <p className="self-center text-xs text-red-600">Matching mail is deleted straight away — it won't reach Trash.</p>}
          </fieldset>

          {editing.action === "auto_reply" && (
            <div className="grid gap-2">
              {templates && templates.length > 0 && (
                <select
                  aria-label="Start from a template"
                  value=""
                  onChange={(event) => {
                    const template = templates.find((t) => String(t.id) === event.target.value);
                    if (template) setEditing({ ...editing, reply_subject: template.subject ?? editing.reply_subject, reply_text: htmlToText(template.body_html) });
                  }}
                  className={input}
                >
                  <option value="">Start from a template…</option>
                  {templates.map((t) => <option key={t.id} value={t.id}>{t.name}</option>)}
                </select>
              )}
              <input aria-label="Reply subject" value={editing.reply_subject ?? ""} onChange={(event) => setEditing({ ...editing, reply_subject: event.target.value })} placeholder="Subject (e.g. Thanks — we got your message)" maxLength={200} className={input} />
              <textarea required aria-label="Reply message" value={editing.reply_text ?? ""} onChange={(event) => setEditing({ ...editing, reply_text: event.target.value })} rows={5} maxLength={4000} placeholder="The reply people get" className={`${input} resize-y`} />
            </div>
          )}

          <input aria-label="Rule name (optional)" value={editing.name} onChange={(event) => setEditing({ ...editing, name: event.target.value })} placeholder="Name (optional)" maxLength={120} className={input} />
          {error && <p className="rounded-md bg-red-50 px-3 py-2 text-xs text-red-700">{error}</p>}
          <div className="flex justify-end gap-2">
            <button type="button" className="rounded-lg px-4 py-2 text-sm font-semibold text-slate-600 hover:bg-white" onClick={() => setEditing(null)}>
              Cancel
            </button>
            <button type="submit" disabled={busy} className="rounded-lg bg-[#1f9d4c] px-4 py-2 text-sm font-bold text-white disabled:opacity-60">
              {busy ? "Saving…" : "Save rule"}
            </button>
          </div>
        </form>
      ) : (
        <button type="button" className="mt-3 inline-flex items-center gap-1.5 text-sm font-bold text-[#1a7f3f] hover:underline" onClick={() => { setError(null); setEditing(blank(kind)); }}>
          <Plus className="h-4 w-4" /> {kind === "filter" ? "Add a filter" : "Add an automation"}
        </button>
      )}
    </div>
  );
}

function Switch({ on, label, onChange }: { on: boolean; label: string; onChange: () => void }) {
  return (
    <button type="button" role="switch" aria-checked={on} aria-label={label} onClick={onChange} className={`relative h-6 w-11 shrink-0 rounded-full transition ${on ? "bg-[#1f9d4c]" : "bg-slate-300"}`}>
      <span className={`gm-keep-white absolute top-0.5 h-5 w-5 rounded-full bg-white shadow transition-all ${on ? "left-[22px]" : "left-0.5"}`} />
    </button>
  );
}

/** "2026-10-20" in the viewer's own zone, for date inputs. */
const localDate = (iso: string | null) => {
  if (!iso) return "";
  const d = new Date(iso);
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
};

function VacationCard({ token, onSessionError }: { token: string; onSessionError: (error: unknown) => void }) {
  const [vacation, setVacation] = useState<Vacation | null>(null);
  const [form, setForm] = useState({ subject: "", message: "", from: "", until: "" });
  const [loadError, setLoadError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const { toast } = useFeedback();

  useEffect(() => {
    gm<{ vacation: Vacation }>("/vacation", token)
      .then((response) => {
        setVacation(response.vacation);
        setForm({ subject: response.vacation.subject || "Out of office", message: response.vacation.message, from: localDate(response.vacation.starts_at), until: localDate(response.vacation.ends_at) });
      })
      .catch((err) => {
        onSessionError(err);
        setLoadError(err instanceof Error ? err.message : "The vacation reply could not be loaded.");
      });
  }, [token, onSessionError]);

  const save = async (enabled: boolean) => {
    setBusy(true);
    try {
      // Whole local days: from the start of the first to the end of the last.
      const startsAt = form.from ? new Date(`${form.from}T00:00:00`).toISOString() : null;
      const endsAt = form.until ? new Date(`${form.until}T23:59:00`).toISOString() : null;
      const result = await gm<{ vacation: Vacation; message: string }>("/vacation", token, {
        method: "PUT",
        body: JSON.stringify({ enabled, subject: form.subject, message: form.message, starts_at: enabled ? startsAt : null, ends_at: enabled ? endsAt : null }),
      });
      setVacation(result.vacation);
      toast(result.message);
      announceChange("rules");
    } catch (err) {
      onSessionError(err);
      toast(err instanceof Error ? err.message : "Could not save the vacation reply.", "error");
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className={`rounded-xl border p-4 ${vacation?.enabled ? "border-[#1f9d4c] bg-[#f3fbf6]" : "border-slate-200"}`}>
      <div className="flex items-center gap-3">
        <Palmtree className="h-6 w-6 shrink-0 text-[#1f9d4c]" />
        <div className="min-w-0 flex-1">
          <h2 className="text-lg font-black text-slate-900">Vacation reply</h2>
          <p className="text-sm text-slate-500">{vacation?.enabled ? `On${vacation.ends_at ? ` until ${new Date(vacation.ends_at).toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" })}` : " until you turn it off"}.` : "Tell people you're away. Each sender gets it once a day."}</p>
        </div>
        {vacation && <Switch on={vacation.enabled} label={vacation.enabled ? "Turn vacation reply off" : "Turn vacation reply on"} onChange={() => void save(!vacation.enabled)} />}
      </div>
      {loadError ? (
        <p className="mt-3 rounded-md bg-amber-50 px-3 py-2 text-sm text-amber-800">{loadError}</p>
      ) : !vacation ? (
        <Loader2 className="mt-3 h-5 w-5 animate-spin text-slate-400" />
      ) : (
        <form
          className="mt-4 grid gap-2"
          onSubmit={(event) => {
            event.preventDefault();
            void save(true);
          }}
        >
          <input aria-label="Subject" value={form.subject} onChange={(event) => setForm({ ...form, subject: event.target.value })} maxLength={200} className={input} />
          <textarea required aria-label="Message" value={form.message} onChange={(event) => setForm({ ...form, message: event.target.value })} rows={4} maxLength={4000} placeholder="Thanks for your email. I'm away until Monday 20 October and will reply when I'm back." className={`${input} resize-y`} />
          <div className="grid grid-cols-2 gap-2">
            <label className="text-xs font-semibold text-slate-600">
              From (optional)
              <input type="date" value={form.from} onChange={(event) => setForm({ ...form, from: event.target.value })} className={`${input} mt-1`} />
            </label>
            <label className="text-xs font-semibold text-slate-600">
              Until (optional)
              <input type="date" value={form.until} min={form.from || undefined} onChange={(event) => setForm({ ...form, until: event.target.value })} className={`${input} mt-1`} />
            </label>
          </div>
          <div className="flex justify-end">
            <button type="submit" disabled={busy || !form.message.trim()} className="rounded-lg bg-[#1f9d4c] px-4 py-2 text-sm font-bold text-white disabled:opacity-60">
              {busy ? "Saving…" : vacation.enabled ? "Save changes" : "Turn on"}
            </button>
          </div>
        </form>
      )}
    </div>
  );
}

function ScheduledCard({ token, onSessionError }: { token: string; onSessionError: (error: unknown) => void }) {
  const [items, setItems] = useState<ScheduledEmail[] | null>(null);
  const { toast, confirm } = useFeedback();

  const load = useCallback(() => {
    gm<{ scheduled: ScheduledEmail[] }>("/scheduled", token)
      .then((response) => setItems(response.scheduled))
      .catch((err) => {
        onSessionError(err);
        setItems([]);
      });
  }, [token, onSessionError]);

  useEffect(load, [load]);
  useOnChange("scheduled", load);
  // Waiting ones go out by themselves; keep the list current while it's open.
  useEffect(() => {
    const timer = window.setInterval(load, 60000);
    return () => window.clearInterval(timer);
  }, [load]);

  const remove = async (item: ScheduledEmail) => {
    const waiting = item.status === "scheduled";
    if (waiting && !(await confirm({ title: "Cancel this scheduled email?", message: item.subject ?? undefined, confirmLabel: "Cancel email", danger: true }))) return;
    try {
      const result = await gm<{ message: string }>(`/scheduled/${item.id}`, token, { method: "DELETE" });
      toast(result.message);
    } catch (err) {
      onSessionError(err);
      toast(err instanceof Error ? err.message : "That did not work.", "error");
    }
    announceChange("scheduled");
  };

  return (
    <div className="mt-8">
      <h2 className="flex items-center gap-2 text-lg font-black text-slate-900"><CalendarClock className="h-5 w-5 text-[#1f9d4c]" /> Scheduled emails</h2>
      <p className="mb-3 text-sm text-slate-500">Write now, send later: in the composer, open the arrow next to Send and choose “Send later”.</p>
      {items === null ? (
        <Loader2 className="h-5 w-5 animate-spin text-slate-400" />
      ) : items.length === 0 ? (
        <p className="rounded-xl border border-dashed border-slate-300 p-5 text-center text-sm text-slate-500">Nothing scheduled.</p>
      ) : (
        <ul className="divide-y divide-slate-100 rounded-xl border border-slate-200">
          {items.map((item) => (
            <li key={item.id} className="flex items-center gap-3 p-3 sm:p-4">
              <Clock className={`h-5 w-5 shrink-0 ${item.status === "failed" ? "text-red-500" : item.status === "sent" ? "text-slate-400" : "text-[#1f9d4c]"}`} />
              <div className="min-w-0 flex-1">
                <p className="truncate text-sm font-bold text-slate-900">{item.subject || "(no subject)"}</p>
                <p className="truncate text-xs text-slate-500">
                  To {item.recipients.slice(0, 2).join(", ")}{item.recipients.length > 2 ? ` +${item.recipients.length - 2}` : ""} ·{" "}
                  {item.status === "sent" ? `Sent ${new Date(item.sent_at ?? item.send_at).toLocaleString("en-US", { month: "short", day: "numeric", hour: "numeric", minute: "2-digit" })}` : item.status === "failed" ? <span className="text-red-600">{item.error ?? "Not sent"}</span> : `Sends ${new Date(item.send_at).toLocaleString("en-US", { weekday: "short", month: "short", day: "numeric", hour: "numeric", minute: "2-digit" })}`}
                </p>
              </div>
              {item.status !== "sending" && (
                <button type="button" className="rounded-lg px-2.5 py-1.5 text-xs font-bold text-slate-600 hover:bg-slate-100" onClick={() => void remove(item)}>
                  {item.status === "scheduled" ? "Cancel" : "Remove"}
                </button>
              )}
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
