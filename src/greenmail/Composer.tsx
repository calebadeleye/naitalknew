import React, { useEffect, useRef, useState } from "react";
import { Bold, CalendarClock, ChevronDown, FileText, Italic, Link2, List, ListOrdered, Loader2, Paperclip, Quote, Send, Trash2, Underline, UserPlus, X } from "lucide-react";
import { gm, type Attachment, type Contact, type Template } from "./api";
import { useFeedback } from "./feedback";
import { announceChange } from "./sync";
import { useTemplates } from "./TemplatesView";
import { formatBytes } from "./ui";

export type ComposeDraft = {
  to: string;
  cc: string;
  bcc: string;
  subject: string;
  /** Starting HTML for the body (quote of the original, signature …). */
  bodyHtml: string;
  inReplyTo?: string;
  references?: string;
  replyUid?: number;
  replyFolder?: string;
  /** Reply/forward: who it's going to, shown as one line instead of the fields. */
  replyingTo?: string;
  /** The original message — not shown in the editor, added under the reply when it's sent. */
  quoteHtml?: string;
  /** Forward: the original's attachments, sent along unless removed (the server copies them). */
  forward?: { folder: string; uid: number; attachments: Attachment[] };
};

/**
 * The message editor, used for new mail, replies and forwards. Rich text is a
 * contentEditable area driven by the browser's own editing commands — enough
 * for bold/italic/lists/links/quotes without a heavyweight editor.
 */
export function Composer({
  token,
  draft,
  variant,
  onSent,
  onClose,
  onSessionError,
  onDraftSaved,
  title = "New message",
}: {
  token: string;
  draft: ComposeDraft;
  variant: "inline" | "window";
  onSent: (message: string) => void;
  onClose: () => void;
  onSessionError: (error: unknown) => void;
  onDraftSaved?: () => void;
  /** The title bar text for a full-window message. */
  title?: string;
}) {
  const [to, setTo] = useState(draft.to);
  const [cc, setCc] = useState(draft.cc);
  const [bcc, setBcc] = useState(draft.bcc);
  const [showCc, setShowCc] = useState(Boolean(draft.cc));
  const [showBcc, setShowBcc] = useState(Boolean(draft.bcc));
  const [copiesMenu, setCopiesMenu] = useState(false);
  const [editRecipients, setEditRecipients] = useState(!draft.replyingTo);
  const [subject, setSubject] = useState(draft.subject);
  const [files, setFiles] = useState<File[]>([]);
  const [forwarded, setForwarded] = useState<Attachment[]>(draft.forward?.attachments ?? []);
  const [busy, setBusy] = useState<"send" | "draft" | "later" | null>(null);
  const [menu, setMenu] = useState<"templates" | "later" | null>(null);
  const [laterAt, setLaterAt] = useState("");
  const templates = useTemplates(token, onSessionError);
  const { toast } = useFeedback();
  const [error, setError] = useState<string | null>(null);
  const [savedAt, setSavedAt] = useState<string | null>(null);
  const editorRef = useRef<HTMLDivElement>(null);
  const fileRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    const editor = editorRef.current;
    if (!editor) return;
    editor.innerHTML = draft.bodyHtml;

    // Replies go straight to the message: cursor where the person types
    // (above the signature), scrolled into view. New messages and forwards
    // start in the To field instead.
    if (draft.replyingTo) {
      const start = editor.querySelector(".gm-start") ?? [...editor.children].filter((node) => !node.classList.contains("gm-signature")).pop() ?? editor;
      editor.focus({ preventScroll: true });
      const range = document.createRange();
      range.selectNodeContents(start);
      range.collapse(!start.textContent?.trim());
      const selection = window.getSelection();
      selection?.removeAllRanges();
      selection?.addRange(range);
      editor.scrollIntoView({ block: "nearest", behavior: "smooth" });
    }
    // Only on open — after that the editor owns its content.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  /** The message as written, without the editor's "start typing here" marker. */
  const bodyHtml = () => {
    const copy = editorRef.current?.cloneNode(true) as HTMLElement | undefined;
    copy?.querySelectorAll(".gm-start").forEach((node) => {
      node.classList.remove("gm-start");
      node.removeAttribute("data-placeholder");
      if (!node.getAttribute("class")) node.removeAttribute("class");
    });
    return copy?.innerHTML ?? "";
  };

  const command = (name: string, value?: string) => {
    editorRef.current?.focus();
    document.execCommand(name, false, value);
  };

  const form = () => {
    const data = new FormData();
    data.append("to", to);
    data.append("cc", cc);
    data.append("bcc", bcc);
    data.append("subject", subject);
    data.append("html", bodyHtml() + (draft.quoteHtml ? `<br>${draft.quoteHtml}` : ""));
    if (draft.inReplyTo) data.append("in_reply_to", draft.inReplyTo);
    if (draft.references) data.append("references", draft.references);
    if (draft.replyUid) data.append("reply_uid", String(draft.replyUid));
    if (draft.replyFolder) data.append("reply_folder", draft.replyFolder);
    files.forEach((file) => data.append("attachments[]", file));
    if (draft.forward && forwarded.length > 0) {
      data.append("forward_folder", draft.forward.folder);
      data.append("forward_uid", String(draft.forward.uid));
      forwarded.forEach((attachment) => data.append("forward_attachments[]", String(attachment.index)));
    }
    return data;
  };

  const send = async () => {
    setBusy("send");
    setError(null);
    try {
      const result = await gm<{ message: string }>("/send", token, { method: "POST", body: form() });
      onSent(result.message);
    } catch (err) {
      onSessionError(err);
      setError(err instanceof Error ? err.message : "Could not send.");
    } finally {
      setBusy(null);
    }
  };

  /** Send later: the server keeps it and sends it at `when`. */
  const schedule = async (when: Date) => {
    setMenu(null);
    setBusy("later");
    setError(null);
    try {
      const data = form();
      data.append("send_at", when.toISOString());
      const result = await gm<{ message: string }>("/scheduled", token, { method: "POST", body: data });
      announceChange("scheduled");
      onSent(result.message);
    } catch (err) {
      onSessionError(err);
      setError(err instanceof Error ? err.message : "Could not schedule it.");
    } finally {
      setBusy(null);
    }
  };

  const nextMorning = (daysAhead: number) => {
    const date = new Date();
    date.setDate(date.getDate() + daysAhead);
    date.setHours(8, 0, 0, 0);
    return date;
  };
  const daysToMonday = ((8 - new Date().getDay()) % 7) || 7;

  /** Put a template in: into an empty message (keeping the signature), or at the cursor. */
  const applyTemplate = (template: Template) => {
    setMenu(null);
    const editor = editorRef.current;
    if (!editor) return;
    if (!subject.trim() && template.subject) setSubject(template.subject);
    const signature = editor.querySelector(".gm-signature");
    const written = (editor.innerText || "").replace(signature?.textContent ?? "", "").replace(/^\s*--\s*$/m, "").trim();
    if (!written) {
      editor.innerHTML = (template.body_html ?? "") + (signature ? `<p><br></p>${signature.outerHTML}` : "");
    } else {
      editor.focus();
      document.execCommand("insertHTML", false, template.body_html ?? "");
    }
    toast(`Template “${template.name}” added.`);
  };

  const saveAsTemplate = async () => {
    setMenu(null);
    const name = window.prompt("Name this template", subject || "My template");
    if (!name?.trim()) return;
    try {
      // The signature is left out — it's added to each new message anyway.
      const copy = document.createElement("div");
      copy.innerHTML = bodyHtml();
      copy.querySelectorAll(".gm-signature").forEach((node) => node.remove());
      const result = await gm<{ message: string }>("/templates", token, { method: "POST", body: JSON.stringify({ name: name.trim(), subject: subject || null, body_html: copy.innerHTML }) });
      toast(result.message);
      announceChange("templates");
    } catch (err) {
      onSessionError(err);
      toast(err instanceof Error ? err.message : "Could not save the template.", "error");
    }
  };

  const saveDraft = async () => {
    setBusy("draft");
    setError(null);
    try {
      await gm("/drafts", token, { method: "POST", body: form() });
      setSavedAt(new Date().toLocaleTimeString("en-US", { hour: "numeric", minute: "2-digit" }));
      onDraftSaved?.();
    } catch (err) {
      onSessionError(err);
      setError(err instanceof Error ? err.message : "Could not save the draft.");
    } finally {
      setBusy(null);
    }
  };

  /**
   * Phones: the keyboard and browser bars can cover the bottom row, so Send
   * is also at the top — in the title bar for a new message, in the
   * "Replying to" line for a reply.
   */
  const topSend = (
    <button
      type="button"
      aria-label="Send"
      title="Send"
      className="inline-flex shrink-0 items-center gap-1.5 rounded-lg bg-[#1f9d4c] px-3 py-1.5 text-xs font-bold text-white disabled:opacity-60 md:hidden"
      disabled={busy !== null || !to.trim()}
      onMouseDown={(event) => event.preventDefault()}
      onClick={() => void send()}
    >
      {busy === "send" ? <Loader2 className="h-4 w-4 animate-spin" /> : <Send className="h-4 w-4" />} Send
    </button>
  );

  const toolbarButton = (label: string, icon: React.ReactNode, action: () => void) => (
    <button type="button" className="rounded p-1.5 text-slate-600 hover:bg-slate-100" aria-label={label} title={label} onMouseDown={(event) => event.preventDefault()} onClick={action}>
      {icon}
    </button>
  );

  return (
    <div className={variant === "window" ? "flex h-full min-h-0 flex-col" : "flex flex-col"}>
      {variant === "window" && (
        <div className="flex items-center gap-2 border-b border-slate-200 px-4 py-3">
          <h2 className="mr-auto text-lg font-black text-slate-900">{title}</h2>
          {topSend}
          <button type="button" aria-label="Close" className="rounded p-1 text-slate-500 hover:bg-slate-100" onClick={onClose}>
            <X className="h-5 w-5" />
          </button>
        </div>
      )}
      <div className="grid gap-0 border-b border-slate-200 text-sm">
        {!editRecipients ? (
          <div className="flex items-center gap-3 px-4 py-2.5">
            <span className="min-w-0 flex-1 truncate text-slate-600">
              Replying to <strong className="font-semibold text-slate-900">{draft.replyingTo}</strong>
              {(cc || bcc) && <span className="text-slate-500"> and others</span>}
            </span>
            <button type="button" className="shrink-0 text-xs font-semibold text-[#1a7f3f] hover:underline" onClick={() => setEditRecipients(true)}>
              Edit
            </button>
            {topSend}
          </div>
        ) : (
          <>
            <RecipientField label="To" value={to} onChange={setTo} token={token} autoFocus={!draft.to}>
              <div className="relative">
                <button
                  type="button"
                  aria-label="Add Cc or Bcc"
                  title="Add Cc or Bcc"
                  aria-expanded={copiesMenu}
                  className="rounded-md p-1.5 text-slate-500 hover:bg-slate-100 hover:text-slate-800"
                  onClick={() => setCopiesMenu(!copiesMenu)}
                >
                  <UserPlus className="h-4 w-4" />
                </button>
                {copiesMenu && (
                  <div className="absolute right-0 top-full z-30 mt-1 w-32 overflow-hidden rounded-lg border border-slate-200 bg-white py-1 shadow-lg">
                    {!showCc && (
                      <button type="button" className="block w-full px-3 py-2 text-left text-sm hover:bg-slate-50" onClick={() => { setShowCc(true); setCopiesMenu(false); }}>
                        Add Cc
                      </button>
                    )}
                    {!showBcc && (
                      <button type="button" className="block w-full px-3 py-2 text-left text-sm hover:bg-slate-50" onClick={() => { setShowBcc(true); setCopiesMenu(false); }}>
                        Add Bcc
                      </button>
                    )}
                    {showCc && showBcc && <p className="px-3 py-2 text-xs text-slate-400">Cc and Bcc added</p>}
                  </div>
                )}
              </div>
            </RecipientField>
            {showCc && <RecipientField label="Cc" value={cc} onChange={setCc} token={token} autoFocus />}
            {showBcc && <RecipientField label="Bcc" value={bcc} onChange={setBcc} token={token} autoFocus />}
          </>
        )}
        {editRecipients && (
          <label className="flex items-center gap-3 px-4 py-2">
            <span className="w-12 shrink-0 text-slate-500">Subject</span>
            <input value={subject} onChange={(event) => setSubject(event.target.value)} className="min-w-0 flex-1 bg-transparent text-slate-900 outline-none" maxLength={300} />
            {variant === "inline" && topSend}
          </label>
        )}
      </div>

      <div className="flex flex-wrap items-center gap-0.5 border-b border-slate-200 px-3 py-1.5">
        {toolbarButton("Bold", <Bold className="h-4 w-4" />, () => command("bold"))}
        {toolbarButton("Italic", <Italic className="h-4 w-4" />, () => command("italic"))}
        {toolbarButton("Underline", <Underline className="h-4 w-4" />, () => command("underline"))}
        {toolbarButton("Bulleted list", <List className="h-4 w-4" />, () => command("insertUnorderedList"))}
        {toolbarButton("Numbered list", <ListOrdered className="h-4 w-4" />, () => command("insertOrderedList"))}
        {toolbarButton("Quote", <Quote className="h-4 w-4" />, () => command("formatBlock", "blockquote"))}
        {toolbarButton("Link", <Link2 className="h-4 w-4" />, () => {
          const url = window.prompt("Link address (https://…)");
          if (url && /^(https?:|mailto:)/i.test(url.trim())) command("createLink", url.trim());
        })}
        <div className="relative ml-auto">
          <button type="button" aria-expanded={menu === "templates"} className="inline-flex items-center gap-1 rounded px-2 py-1.5 text-xs font-semibold text-slate-600 hover:bg-slate-100" onMouseDown={(event) => event.preventDefault()} onClick={() => setMenu(menu === "templates" ? null : "templates")}>
            <FileText className="h-4 w-4" /> Templates
          </button>
          {menu === "templates" && (
            <div className="absolute right-0 top-full z-30 mt-1 w-64 overflow-hidden rounded-lg border border-slate-200 bg-white py-1 shadow-lg">
              {templates === null ? (
                <p className="px-3 py-2 text-xs text-slate-400">Loading…</p>
              ) : templates.length === 0 ? (
                <p className="px-3 py-2 text-xs text-slate-500">No templates yet.</p>
              ) : (
                <ul className="max-h-56 overflow-y-auto">
                  {templates.map((template) => (
                    <li key={template.id}>
                      <button type="button" className="block w-full px-3 py-2 text-left text-sm hover:bg-slate-50" onMouseDown={(event) => event.preventDefault()} onClick={() => applyTemplate(template)}>
                        <span className="block truncate font-semibold text-slate-800">{template.name}</span>
                        {template.subject && <span className="block truncate text-xs text-slate-500">{template.subject}</span>}
                      </button>
                    </li>
                  ))}
                </ul>
              )}
              <button type="button" className="block w-full border-t border-slate-100 px-3 py-2 text-left text-sm font-semibold text-[#1a7f3f] hover:bg-slate-50" onClick={() => void saveAsTemplate()}>
                Save this message as a template
              </button>
            </div>
          )}
        </div>
      </div>

      <div
        ref={editorRef}
        contentEditable
        role="textbox"
        aria-multiline="true"
        aria-label="Message"
        className={`greenmail-editor overflow-y-auto px-4 py-3 text-sm leading-6 text-slate-800 outline-none ${variant === "window" ? "min-h-[220px] flex-1" : "min-h-[160px] max-h-[360px]"}`}
        suppressContentEditableWarning
      />

      {draft.quoteHtml && <p className="px-4 pb-2 text-[11px] text-slate-400">The original message is included below your reply when it's sent.</p>}

      {(files.length > 0 || forwarded.length > 0) && (
        <div className="flex flex-wrap gap-2 px-4 pb-2">
          {forwarded.map((attachment) => (
            <span key={`fwd-${attachment.index}`} className="inline-flex items-center gap-1.5 rounded-md border border-slate-200 bg-slate-50 px-2 py-1 text-xs text-slate-700">
              <Paperclip className="h-3 w-3" /> {attachment.name} <span className="text-slate-400">({formatBytes(attachment.size)})</span>
              <button type="button" aria-label={`Don't forward ${attachment.name}`} onClick={() => setForwarded(forwarded.filter((a) => a.index !== attachment.index))}>
                <X className="h-3 w-3" />
              </button>
            </span>
          ))}
          {files.map((file, index) => (
            <span key={`${file.name}-${index}`} className="inline-flex items-center gap-1.5 rounded-md border border-slate-200 bg-slate-50 px-2 py-1 text-xs text-slate-700">
              <Paperclip className="h-3 w-3" /> {file.name} <span className="text-slate-400">({formatBytes(file.size)})</span>
              <button type="button" aria-label={`Remove ${file.name}`} onClick={() => setFiles(files.filter((_, i) => i !== index))}>
                <X className="h-3 w-3" />
              </button>
            </span>
          ))}
        </div>
      )}

      {error && <p className="mx-4 mb-2 rounded-md bg-red-50 px-3 py-2 text-xs text-red-700">{error}</p>}

      <div className="sticky bottom-0 z-10 flex items-center gap-2 border-t border-slate-200 bg-white px-4 py-3 pb-[max(0.75rem,env(safe-area-inset-bottom))]">
        <div className="relative flex">
          <button type="button" className="inline-flex items-center gap-2 rounded-l-lg bg-[#1f9d4c] px-5 py-2 text-sm font-bold text-white hover:bg-[#188a42] disabled:opacity-60" disabled={busy !== null || !to.trim()} onClick={() => void send()}>
            {busy === "send" || busy === "later" ? <Loader2 className="h-4 w-4 animate-spin" /> : <Send className="h-4 w-4" />} Send
          </button>
          <button type="button" aria-label="Send later" title="Send later" aria-expanded={menu === "later"} className="rounded-r-lg border-l border-white/30 bg-[#1f9d4c] px-2 text-white hover:bg-[#188a42] disabled:opacity-60" disabled={busy !== null || !to.trim()} onClick={() => setMenu(menu === "later" ? null : "later")}>
            <ChevronDown className="h-4 w-4" />
          </button>
          {menu === "later" && (
            <div className="absolute bottom-full left-0 z-30 mb-2 w-72 rounded-xl border border-slate-200 bg-white p-2 shadow-xl">
              <p className="flex items-center gap-1.5 px-2 py-1 text-xs font-bold uppercase tracking-wide text-slate-500"><CalendarClock className="h-3.5 w-3.5" /> Send later</p>
              {[
                ["Tomorrow morning", nextMorning(1)],
                ["Monday morning", nextMorning(daysToMonday)],
              ].map(([label, date]) => (
                <button key={label as string} type="button" className="flex w-full justify-between rounded-lg px-2 py-2 text-left text-sm hover:bg-slate-50" onClick={() => void schedule(date as Date)}>
                  <span className="font-semibold text-slate-800">{label as string}</span>
                  <span className="text-xs text-slate-500">{(date as Date).toLocaleString("en-US", { weekday: "short", hour: "numeric", minute: "2-digit" })}</span>
                </button>
              ))}
              <div className="mt-1 flex gap-2 border-t border-slate-100 px-2 pt-2">
                <input type="datetime-local" aria-label="Pick a date and time" value={laterAt} onChange={(event) => setLaterAt(event.target.value)} className="min-w-0 flex-1 rounded-md border border-slate-300 px-2 py-1 text-xs" />
                <button type="button" disabled={!laterAt || new Date(laterAt) <= new Date()} className="rounded-md bg-[#1f9d4c] px-2.5 py-1 text-xs font-bold text-white disabled:opacity-50" onClick={() => void schedule(new Date(laterAt))}>
                  Schedule
                </button>
              </div>
            </div>
          )}
        </div>
        <button type="button" className="rounded-lg p-2 text-slate-600 hover:bg-slate-100" aria-label="Attach files" title="Attach files" onClick={() => fileRef.current?.click()}>
          <Paperclip className="h-4 w-4" />
        </button>
        <input
          ref={fileRef}
          type="file"
          multiple
          className="hidden"
          onChange={(event) => {
            const picked: File[] = event.target.files ? Array.from(event.target.files) : [];
            setFiles([...files, ...picked].slice(0, 10));
            event.target.value = "";
          }}
        />
        <button type="button" className="rounded-lg px-3 py-2 text-xs font-semibold text-slate-600 hover:bg-slate-100 disabled:opacity-60" disabled={busy !== null} onClick={() => void saveDraft()}>
          {busy === "draft" ? "Saving…" : "Save draft"}
        </button>
        <span className="ml-auto text-xs text-slate-400">{savedAt ? `Saved ${savedAt}` : ""}</span>
        <button type="button" className="rounded-lg p-2 text-slate-500 hover:bg-slate-100" aria-label="Discard" title="Discard" onClick={onClose}>
          <Trash2 className="h-4 w-4" />
        </button>
      </div>
    </div>
  );
}

/** Comma-separated recipients, suggesting contacts for the address being typed. */
function RecipientField({
  label,
  value,
  onChange,
  token,
  autoFocus,
  children,
}: {
  label: string;
  value: string;
  onChange: (value: string) => void;
  token: string;
  autoFocus?: boolean;
  children?: React.ReactNode;
}) {
  const [suggestions, setSuggestions] = useState<Contact[]>([]);
  // Suggest only once the person types — not for addresses filled in for a reply.
  const [typed, setTyped] = useState(false);
  const current = value.split(",").pop()?.trim() ?? "";

  useEffect(() => {
    if (!typed || current.length < 2) {
      setSuggestions([]);
      return;
    }
    const timer = window.setTimeout(() => {
      gm<{ contacts: Contact[] }>(`/contacts?q=${encodeURIComponent(current)}`, token)
        .then((response) => setSuggestions(response.contacts.slice(0, 6)))
        .catch(() => setSuggestions([]));
    }, 200);
    return () => window.clearTimeout(timer);
  }, [current, token, typed]);

  const pick = (contact: Contact) => {
    const parts = value.split(",").slice(0, -1).map((part) => part.trim()).filter(Boolean);
    onChange([...parts, contact.email].join(", ") + ", ");
    setSuggestions([]);
    setTyped(false);
  };

  return (
    <div className="relative flex items-center gap-3 border-b border-slate-100 px-4 py-2 last:border-b-0">
      <span className="w-12 shrink-0 text-slate-500">{label}</span>
      <input
        value={value}
        onChange={(event) => {
          setTyped(true);
          onChange(event.target.value);
        }}
        onBlur={() => window.setTimeout(() => setSuggestions([]), 150)}
        className="min-w-0 flex-1 bg-transparent text-slate-900 outline-none"
        placeholder={label === "To" ? "name@example.com, …" : ""}
        autoFocus={autoFocus}
        autoComplete="off"
        aria-label={label}
      />
      {children}
      {suggestions.length > 0 && (
        <ul className="absolute left-16 top-full z-20 mt-1 w-72 overflow-hidden rounded-lg border border-slate-200 bg-white shadow-lg" role="listbox">
          {suggestions.map((contact) => (
            <li key={contact.id}>
              <button type="button" className="block w-full px-3 py-2 text-left text-sm hover:bg-slate-50" onMouseDown={(event) => event.preventDefault()} onClick={() => pick(contact)}>
                <span className="font-semibold text-slate-800">{contact.name || contact.email}</span>
                {contact.name && <span className="block text-xs text-slate-500">{contact.email}</span>}
              </button>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
