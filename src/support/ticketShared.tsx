import React from "react";
import { Paperclip } from "lucide-react";

export type TicketStatus = "open" | "answered" | "closed";

export type TicketMessage = {
  id: number;
  author_type: "client" | "staff";
  author_name: string;
  body: string;
  files: Array<{ index: number; name: string; size: number }>;
  created_at: string;
};

export const TICKET_CATEGORIES: Array<{ value: string; label: string }> = [
  { value: "technical", label: "Technical / hosting" },
  { value: "website", label: "My website" },
  { value: "email", label: "Email" },
  { value: "domain", label: "Domain" },
  { value: "billing", label: "Billing & payments" },
  { value: "other", label: "Something else" },
];

export const categoryLabel = (value: string) => TICKET_CATEGORIES.find((category) => category.value === value)?.label ?? value;

/** Status as the person reading it needs to see it ("Awaiting your reply" means something different to staff and clients). */
export function TicketStatusPill({ status, viewer }: { status: TicketStatus; viewer: "client" | "staff" }) {
  const label =
    status === "closed" ? "Closed" : status === "answered" ? (viewer === "client" ? "Awaiting your reply" : "Answered") : viewer === "client" ? "Waiting for support" : "Needs reply";
  const tone = status === "closed" ? "" : (status === "open") === (viewer === "staff") ? "pending" : "paid";

  return <span className={`status-pill ${tone}`}>{label}</span>;
}

export function formatTicketTime(value: string | null | undefined): string {
  if (!value) return "";
  return new Date(value).toLocaleString("en-GB", { day: "numeric", month: "short", year: "numeric", hour: "2-digit", minute: "2-digit" });
}

const formatSize = (bytes: number) => (bytes >= 1048576 ? `${(bytes / 1048576).toFixed(1)} MB` : `${Math.max(1, Math.round(bytes / 1024))} KB`);

/** One conversation, oldest message first. Staff messages sit on the left for clients and on the right for staff. */
export function TicketThread({
  messages,
  viewer,
  onDownload,
}: {
  messages: TicketMessage[];
  viewer: "client" | "staff";
  onDownload: (message: TicketMessage, index: number, name: string) => void;
}) {
  return (
    <ol className="grid gap-3">
      {messages.map((message) => {
        const mine = message.author_type === viewer;
        return (
          <li
            key={message.id}
            className={`rounded-lg border p-4 ${mine ? "border-primary/25 bg-primary/[0.06] sm:ml-10" : "border-white/10 bg-black/20 sm:mr-10"}`}
          >
            <div className="flex flex-wrap items-baseline justify-between gap-2 text-xs">
              <strong className={message.author_type === "staff" ? "text-primary" : "text-white"}>{message.author_name}</strong>
              <span className="text-white/45">{formatTicketTime(message.created_at)}</span>
            </div>
            <p className="mt-2 whitespace-pre-wrap break-words text-sm leading-6 text-white/80">{message.body}</p>
            {message.files.length > 0 && (
              <div className="mt-3 flex flex-wrap gap-2">
                {message.files.map((file) => (
                  <button
                    key={file.index}
                    type="button"
                    className="inline-flex items-center gap-1.5 rounded-md border border-white/15 px-2.5 py-1 text-xs text-white/75 hover:border-primary/50"
                    onClick={() => onDownload(message, file.index, file.name)}
                  >
                    <Paperclip className="h-3.5 w-3.5" />
                    {file.name} <span className="text-white/40">({formatSize(file.size)})</span>
                  </button>
                ))}
              </div>
            )}
          </li>
        );
      })}
    </ol>
  );
}

/** Message box + up to three attachments, used for new tickets and replies on both sides. */
export function TicketComposer({
  value,
  onChange,
  files,
  onFilesChange,
  placeholder,
  disabled,
}: {
  value: string;
  onChange: (value: string) => void;
  files: File[];
  onFilesChange: (files: File[]) => void;
  placeholder: string;
  disabled?: boolean;
}) {
  const inputRef = React.useRef<HTMLInputElement>(null);

  return (
    <div className="grid gap-2">
      <label className="admin-field">
        <span>Message</span>
        <textarea rows={6} value={value} onChange={(event) => onChange(event.target.value)} placeholder={placeholder} maxLength={10000} disabled={disabled} required />
      </label>
      <div className="flex flex-wrap items-center gap-2 text-xs text-white/55">
        <button type="button" className="btn-outline !min-h-8 !px-3 !py-1 !text-[11px]" disabled={disabled || files.length >= 3} onClick={() => inputRef.current?.click()}>
          <Paperclip className="h-3.5 w-3.5" /> Attach file
        </button>
        <span>Screenshots, PDFs, text or zip — up to 3 files, 5 MB each.</span>
        <input
          ref={inputRef}
          type="file"
          className="hidden"
          multiple
          accept=".jpg,.jpeg,.png,.webp,.gif,.pdf,.txt,.log,.zip"
          onChange={(event) => {
            const picked: File[] = event.target.files ? Array.from(event.target.files) : [];
            onFilesChange([...files, ...picked].slice(0, 3));
            event.target.value = "";
          }}
        />
      </div>
      {files.length > 0 && (
        <div className="flex flex-wrap gap-2">
          {files.map((file, index) => (
            <span key={`${file.name}-${index}`} className="inline-flex items-center gap-1.5 rounded-md bg-white/[0.06] px-2.5 py-1 text-xs text-white/75">
              {file.name}
              <button type="button" aria-label={`Remove ${file.name}`} className="text-white/50 hover:text-white" onClick={() => onFilesChange(files.filter((_, i) => i !== index))}>
                ×
              </button>
            </span>
          ))}
        </div>
      )}
    </div>
  );
}

export function buildTicketForm(fields: Record<string, string | number | boolean | null | undefined>, files: File[]): FormData {
  const form = new FormData();
  Object.entries(fields).forEach(([key, value]) => {
    if (value === null || value === undefined || value === "") return;
    form.append(key, typeof value === "boolean" ? (value ? "1" : "0") : String(value));
  });
  files.forEach((file) => form.append("attachments[]", file));
  return form;
}
