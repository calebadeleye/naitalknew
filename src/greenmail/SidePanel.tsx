import React, { useEffect, useState } from "react";
import { Bot, CalendarDays, ChevronDown, ChevronUp, FileText, Languages, ListChecks, ListTodo, Loader2, Pencil, Plus, Send, Trash2, UserRound } from "lucide-react";
import { gm, type CalendarEvent, type Contact, type FullMessage } from "./api";
import { EventModal } from "./EventModal";
import { useFeedback } from "./feedback";
import { announceChange, useOnChange } from "./sync";
import { addDays, startOfDay, timeLabel } from "./planner";
import { TaskRow, useTasks } from "./TasksView";
import { Avatar } from "./ui";

type AssistantAction = "summarise" | "draft_reply" | "action_items" | "translate_yoruba" | "ask";

/** Right-hand panel: the AI assistant for the open email, and contacts. */
export function SidePanel({
  token,
  message,
  folder,
  onUseDraft,
  onWriteTo,
  onSessionError,
  onOpenCalendar,
  onOpenTasks,
}: {
  token: string;
  message: FullMessage | null;
  folder: string;
  onUseDraft: (text: string) => void;
  onWriteTo: (email: string) => void;
  onSessionError: (error: unknown) => void;
  onOpenCalendar: () => void;
  onOpenTasks: () => void;
}) {
  return (
    <div className="grid min-h-0 flex-1 grid-cols-[minmax(0,1fr)] content-start gap-3 overflow-y-auto p-3">
      <AssistantCard token={token} message={message} folder={folder} onUseDraft={onUseDraft} onSessionError={onSessionError} />
      <CalendarCard token={token} onSessionError={onSessionError} onOpen={onOpenCalendar} />
      <TasksCard token={token} onSessionError={onSessionError} onOpen={onOpenTasks} />
      <ContactsCard token={token} onWriteTo={onWriteTo} onSessionError={onSessionError} />
    </div>
  );
}

function Card({ title, icon, children }: { title: string; icon: React.ReactNode; children: React.ReactNode }) {
  const [open, setOpen] = useState(true);
  return (
    <section className="rounded-xl border border-slate-200 bg-white">
      <button type="button" className="flex w-full items-center gap-2 px-4 py-3 text-left" aria-expanded={open} onClick={() => setOpen(!open)}>
        {icon}
        <span className="flex-1 text-[15px] font-bold text-slate-900">{title}</span>
        {open ? <ChevronUp className="h-4 w-4 text-slate-500" /> : <ChevronDown className="h-4 w-4 text-slate-500" />}
      </button>
      {open && <div className="px-4 pb-4">{children}</div>}
    </section>
  );
}

function AssistantCard({
  token,
  message,
  folder,
  onUseDraft,
  onSessionError,
}: {
  token: string;
  message: FullMessage | null;
  folder: string;
  onUseDraft: (text: string) => void;
  onSessionError: (error: unknown) => void;
}) {
  const [prompt, setPrompt] = useState("");
  const [busy, setBusy] = useState<AssistantAction | null>(null);
  const [result, setResult] = useState<{ action: AssistantAction; text: string } | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    setResult(null);
    setError(null);
  }, [message?.uid]);

  const run = async (action: AssistantAction) => {
    setBusy(action);
    setError(null);
    try {
      const response = await gm<{ reply: string }>("/assistant", token, {
        method: "POST",
        body: JSON.stringify({ action, folder: message ? folder : null, uid: message?.uid ?? null, prompt: action === "ask" ? prompt : null }),
      });
      setResult({ action, text: response.reply });
      if (action === "ask") setPrompt("");
    } catch (err) {
      onSessionError(err);
      setError(err instanceof Error ? err.message : "The assistant is unavailable.");
    } finally {
      setBusy(null);
    }
  };

  const chip = (action: AssistantAction, label: string, icon: React.ReactNode) => (
    <button
      type="button"
      disabled={!message || busy !== null}
      className="inline-flex items-center gap-1.5 rounded-full border border-slate-200 px-2.5 py-1 text-xs text-slate-700 hover:border-[#1f9d4c] hover:text-[#1a7f3f] disabled:opacity-50"
      onClick={() => void run(action)}
    >
      {busy === action ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : icon} {label}
    </button>
  );

  return (
    <Card title="AI Assistant" icon={<Bot className="h-5 w-5 text-[#1f9d4c]" />}>
      <form
        className="relative"
        onSubmit={(event) => {
          event.preventDefault();
          if (prompt.trim()) void run("ask");
        }}
      >
        <textarea
          value={prompt}
          onChange={(event) => setPrompt(event.target.value)}
          rows={3}
          maxLength={1000}
          placeholder={message ? "Ask about this email, draft a reply, summarise, translate…" : "Ask anything — open an email to ask about it"}
          className="w-full resize-none rounded-lg border border-slate-200 px-3 py-2 pr-9 text-sm text-slate-800 outline-none focus:border-[#1f9d4c]"
        />
        <button type="submit" disabled={!prompt.trim() || busy !== null} aria-label="Ask" className="absolute bottom-3 right-2 rounded p-1 text-[#1f9d4c] disabled:text-slate-300">
          {busy === "ask" ? <Loader2 className="h-4 w-4 animate-spin" /> : <Send className="h-4 w-4" />}
        </button>
      </form>
      <div className="mt-2 flex flex-wrap gap-1.5">
        {chip("summarise", "Summarise this email", <FileText className="h-3.5 w-3.5" />)}
        {chip("draft_reply", "Draft a professional reply", <Pencil className="h-3.5 w-3.5" />)}
        {chip("action_items", "Extract action items", <ListChecks className="h-3.5 w-3.5" />)}
        {chip("translate_yoruba", "Translate to Yoruba", <Languages className="h-3.5 w-3.5" />)}
      </div>
      {error && <p className="mt-3 rounded-md bg-red-50 px-3 py-2 text-xs text-red-700">{error}</p>}
      {result && (
        <div className="mt-3 rounded-lg bg-slate-50 p-3 text-sm text-slate-800">
          <p className="whitespace-pre-wrap leading-6">{result.text}</p>
          {result.action === "draft_reply" && (
            <button type="button" className="mt-2 text-xs font-bold text-[#1a7f3f] hover:underline" onClick={() => onUseDraft(result.text)}>
              Use this reply
            </button>
          )}
          <p className="mt-2 text-[11px] text-slate-400">AI can make mistakes — check before sending.</p>
        </div>
      )}
    </Card>
  );
}

function ContactsCard({ token, onWriteTo, onSessionError }: { token: string; onWriteTo: (email: string) => void; onSessionError: (error: unknown) => void }) {
  const [contacts, setContacts] = useState<Contact[] | null>(null);
  const [showAll, setShowAll] = useState(false);
  const [editing, setEditing] = useState<Partial<Contact> | null>(null);
  const [error, setError] = useState<string | null>(null);
  const { toast, confirm } = useFeedback();

  const load = () =>
    gm<{ contacts: Contact[] }>("/contacts", token)
      .then((response) => setContacts(response.contacts))
      .catch((err) => {
        onSessionError(err);
        setContacts([]);
      });

  // eslint-disable-next-line react-hooks/exhaustive-deps
  useEffect(() => void load(), [token]);
  useOnChange("contacts", () => void load());

  const save = async () => {
    if (!editing) return;
    setError(null);
    try {
      await gm(editing.id ? `/contacts/${editing.id}` : "/contacts", token, { method: editing.id ? "PUT" : "POST", body: JSON.stringify(editing) });
      toast(editing.id ? "Contact updated." : "Contact added.");
      setEditing(null);
      announceChange("contacts");
    } catch (err) {
      onSessionError(err);
      setError(err instanceof Error ? err.message : "Could not save.");
    }
  };

  const remove = async (contact: Contact) => {
    if (!(await confirm({ title: "Delete this contact?", message: contact.name ? `${contact.name} <${contact.email}>` : contact.email, confirmLabel: "Delete", danger: true }))) return;
    try {
      await gm(`/contacts/${contact.id}`, token, { method: "DELETE" });
      toast("Contact deleted.");
    } catch (err) {
      onSessionError(err);
      toast(err instanceof Error ? err.message : "Could not delete.", "error");
    }
    announceChange("contacts");
  };

  // The server lists named contacts first, so the first three are the useful ones.
  const visible = showAll ? contacts ?? [] : (contacts ?? []).slice(0, 3);

  return (
    <Card title="Contacts" icon={<UserRound className="h-5 w-5 text-slate-700" />}>
      {contacts === null ? (
        <Loader2 className="h-4 w-4 animate-spin text-slate-400" />
      ) : (
        <>
          {contacts.length === 0 && <p className="text-xs text-slate-500">People you email are added here automatically.</p>}
          <ul className={`grid gap-2 ${showAll ? "max-h-80 overflow-y-auto" : ""}`}>
            {visible.map((contact) => (
              <li key={contact.id} className="group flex items-center gap-2.5">
                <Avatar address={{ name: contact.name, email: contact.email }} size={32} />
                <button type="button" className="min-w-0 flex-1 text-left" onClick={() => onWriteTo(contact.email)} title={`Write to ${contact.email}`}>
                  <span className="block truncate text-sm font-semibold text-slate-800">{contact.name || contact.email}</span>
                  {contact.name && <span className="block truncate text-xs text-slate-500">{contact.email}</span>}
                </button>
                {showAll && (
                  <span className="flex gap-1 opacity-0 group-hover:opacity-100">
                    <button type="button" aria-label="Edit contact" className="rounded p-1 text-slate-500 hover:bg-slate-100" onClick={() => setEditing(contact)}>
                      <Pencil className="h-3.5 w-3.5" />
                    </button>
                    <button type="button" aria-label="Delete contact" className="rounded p-1 text-slate-500 hover:bg-slate-100" onClick={() => void remove(contact)}>
                      <Trash2 className="h-3.5 w-3.5" />
                    </button>
                  </span>
                )}
              </li>
            ))}
          </ul>
          <div className="mt-3 flex items-center justify-between">
            <button type="button" className="inline-flex items-center gap-1 text-sm font-bold text-[#1a7f3f] hover:underline" onClick={() => setEditing({ name: "", email: "" })}>
              <Plus className="h-4 w-4" /> Add contact
            </button>
            {contacts.length > 3 && (
              <button type="button" className="text-xs font-bold text-[#1a7f3f] hover:underline" onClick={() => setShowAll(!showAll)}>
                {showAll ? "Show fewer" : "View all"}
              </button>
            )}
          </div>
        </>
      )}

      {editing && (
        <form
          className="mt-3 grid gap-2 rounded-lg border border-slate-200 p-3"
          onSubmit={(event) => {
            event.preventDefault();
            void save();
          }}
        >
          {(["name", "email", "phone", "company"] as const).map((field) => (
            <input
              key={field}
              type={field === "email" ? "email" : "text"}
              required={field === "email"}
              placeholder={field[0].toUpperCase() + field.slice(1)}
              value={(editing[field] as string | null | undefined) ?? ""}
              onChange={(event) => setEditing({ ...editing, [field]: event.target.value })}
              className="rounded-md border border-slate-200 px-2.5 py-1.5 text-sm text-slate-800 outline-none focus:border-[#1f9d4c]"
            />
          ))}
          {error && <p className="text-xs text-red-600">{error}</p>}
          <div className="flex justify-end gap-2">
            <button type="button" className="rounded-md px-3 py-1.5 text-xs font-semibold text-slate-600 hover:bg-slate-100" onClick={() => setEditing(null)}>
              Cancel
            </button>
            <button type="submit" className="rounded-md bg-[#1f9d4c] px-3 py-1.5 text-xs font-bold text-white">
              Save
            </button>
          </div>
        </form>
      )}
    </Card>
  );
}

/** Today's events, as in the mockup; "View calendar" opens the full month. */
function CalendarCard({ token, onSessionError, onOpen }: { token: string; onSessionError: (error: unknown) => void; onOpen: () => void }) {
  const [events, setEvents] = useState<CalendarEvent[] | null>(null);
  const [adding, setAdding] = useState(false);
  const today = startOfDay(new Date());

  const load = () =>
    gm<{ events: CalendarEvent[] }>(`/events?from=${encodeURIComponent(today.toISOString())}&to=${encodeURIComponent(addDays(today, 1).toISOString())}`, token)
      .then((response) => setEvents(response.events))
      .catch((error) => {
        onSessionError(error);
        setEvents([]);
      });

  // eslint-disable-next-line react-hooks/exhaustive-deps
  useEffect(() => void load(), [token]);
  useOnChange("events", () => void load());
  const { toast } = useFeedback();

  return (
    <Card title="Calendar" icon={<CalendarDays className="h-5 w-5 text-slate-700" />}>
      <p className="-mt-1 mb-2 text-xs text-slate-500">Today, {today.toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" })}</p>
      {events === null ? (
        <Loader2 className="h-4 w-4 animate-spin text-slate-400" />
      ) : events.length === 0 ? (
        <p className="text-xs text-slate-500">Nothing planned today.</p>
      ) : (
        <ul className="grid gap-2">
          {events.map((event) => (
            <li key={event.id} className="flex gap-3 text-sm">
              <span className="w-[68px] shrink-0 text-xs leading-5 text-slate-500">{event.all_day ? "All day" : <>{timeLabel(event.starts_at)}{event.ends_at && <><br />{timeLabel(event.ends_at)}</>}</>}</span>
              <span className="min-w-0 border-l-2 border-[#1f9d4c] pl-2.5">
                <span className="block truncate font-semibold text-slate-800">{event.title}</span>
                {event.location && <span className="block truncate text-xs text-slate-500">{event.location}</span>}
              </span>
            </li>
          ))}
        </ul>
      )}
      <div className="mt-3 flex items-center justify-between">
        <button type="button" className="inline-flex items-center gap-1 text-sm font-bold text-[#1a7f3f] hover:underline" onClick={() => setAdding(true)}>
          <Plus className="h-4 w-4" /> New event
        </button>
        <button type="button" className="text-xs font-bold text-[#1a7f3f] hover:underline" onClick={onOpen}>
          View calendar
        </button>
      </div>
      {adding && (
        <EventModal
          token={token}
          event={null}
          defaultDate={new Date()}
          onSessionError={onSessionError}
          onClose={() => setAdding(false)}
          onSaved={(text) => {
            setAdding(false);
            toast(text);
            announceChange("events");
          }}
        />
      )}
    </Card>
  );
}

/** What's due, with a quick add; "View all" opens the Tasks page. */
function TasksCard({ token, onSessionError, onOpen }: { token: string; onSessionError: (error: unknown) => void; onOpen: () => void }) {
  const { tasks, add, update } = useTasks(token, "open", onSessionError);
  const [title, setTitle] = useState("");

  return (
    <Card title="Tasks" icon={<ListTodo className="h-5 w-5 text-slate-700" />}>
      {tasks === null ? (
        <Loader2 className="h-4 w-4 animate-spin text-slate-400" />
      ) : tasks.length === 0 ? (
        <p className="text-xs text-slate-500">Nothing to do.</p>
      ) : (
        <ul>
          {tasks.slice(0, 5).map((task) => (
            <React.Fragment key={task.id}>
              <TaskRow task={task} compact onToggle={() => void update(task, { done: true })} />
            </React.Fragment>
          ))}
        </ul>
      )}
      <form
        className="mt-2 flex items-center gap-2 rounded-lg border border-slate-200 px-2 py-1"
        onSubmit={(event) => {
          event.preventDefault();
          if (!title.trim()) return;
          void add(title.trim(), null);
          setTitle("");
        }}
      >
        <Plus className="h-4 w-4 text-slate-400" />
        <input value={title} onChange={(event) => setTitle(event.target.value)} placeholder="New task" aria-label="New task" maxLength={255} className="min-w-0 flex-1 bg-transparent py-1 text-sm outline-none" />
      </form>
      {tasks && tasks.length > 5 && (
        <button type="button" className="mt-2 text-xs font-bold text-[#1a7f3f] hover:underline" onClick={onOpen}>
          View all {tasks.length}
        </button>
      )}
      {tasks && tasks.length <= 5 && (
        <button type="button" className="mt-2 text-xs font-bold text-[#1a7f3f] hover:underline" onClick={onOpen}>
          Open tasks
        </button>
      )}
    </Card>
  );
}
