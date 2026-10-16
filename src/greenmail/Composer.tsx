import React, { useEffect, useRef, useState } from "react";
import { Bold, Italic, Link2, List, ListOrdered, Loader2, Paperclip, Quote, Send, Trash2, Underline, X } from "lucide-react";
import { gm, type Contact } from "./api";
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
}: {
  token: string;
  draft: ComposeDraft;
  variant: "inline" | "window";
  onSent: (message: string) => void;
  onClose: () => void;
  onSessionError: (error: unknown) => void;
}) {
  const [to, setTo] = useState(draft.to);
  const [cc, setCc] = useState(draft.cc);
  const [bcc, setBcc] = useState(draft.bcc);
  const [showCopies, setShowCopies] = useState(Boolean(draft.cc || draft.bcc));
  const [subject, setSubject] = useState(draft.subject);
  const [files, setFiles] = useState<File[]>([]);
  const [busy, setBusy] = useState<"send" | "draft" | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [savedAt, setSavedAt] = useState<string | null>(null);
  const editorRef = useRef<HTMLDivElement>(null);
  const fileRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (editorRef.current) editorRef.current.innerHTML = draft.bodyHtml;
    // Only on open — after that the editor owns its content.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

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
    data.append("html", editorRef.current?.innerHTML ?? "");
    if (draft.inReplyTo) data.append("in_reply_to", draft.inReplyTo);
    if (draft.references) data.append("references", draft.references);
    if (draft.replyUid) data.append("reply_uid", String(draft.replyUid));
    if (draft.replyFolder) data.append("reply_folder", draft.replyFolder);
    files.forEach((file) => data.append("attachments[]", file));
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

  const saveDraft = async () => {
    setBusy("draft");
    setError(null);
    try {
      await gm("/drafts", token, { method: "POST", body: form() });
      setSavedAt(new Date().toLocaleTimeString("en-US", { hour: "numeric", minute: "2-digit" }));
    } catch (err) {
      onSessionError(err);
      setError(err instanceof Error ? err.message : "Could not save the draft.");
    } finally {
      setBusy(null);
    }
  };

  const toolbarButton = (label: string, icon: React.ReactNode, action: () => void) => (
    <button type="button" className="rounded p-1.5 text-slate-600 hover:bg-slate-100" aria-label={label} title={label} onMouseDown={(event) => event.preventDefault()} onClick={action}>
      {icon}
    </button>
  );

  return (
    <div className={variant === "window" ? "flex h-full flex-col" : "flex flex-col"}>
      <div className="grid gap-0 border-b border-slate-200 text-sm">
        <RecipientField label="To" value={to} onChange={setTo} token={token} autoFocus={!draft.to}>
          {!showCopies && (
            <button type="button" className="text-xs font-semibold text-slate-500 hover:text-slate-800" onClick={() => setShowCopies(true)}>
              Cc Bcc
            </button>
          )}
        </RecipientField>
        {showCopies && <RecipientField label="Cc" value={cc} onChange={setCc} token={token} />}
        {showCopies && <RecipientField label="Bcc" value={bcc} onChange={setBcc} token={token} />}
        <label className="flex items-center gap-3 px-4 py-2">
          <span className="w-12 shrink-0 text-slate-500">Subject</span>
          <input value={subject} onChange={(event) => setSubject(event.target.value)} className="min-w-0 flex-1 bg-transparent text-slate-900 outline-none" maxLength={300} />
        </label>
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

      {files.length > 0 && (
        <div className="flex flex-wrap gap-2 px-4 pb-2">
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

      <div className="flex items-center gap-2 border-t border-slate-200 px-4 py-3">
        <button type="button" className="inline-flex items-center gap-2 rounded-lg bg-[#1f9d4c] px-5 py-2 text-sm font-bold text-white hover:bg-[#188a42] disabled:opacity-60" disabled={busy !== null || !to.trim()} onClick={() => void send()}>
          {busy === "send" ? <Loader2 className="h-4 w-4 animate-spin" /> : <Send className="h-4 w-4" />} Send
        </button>
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
