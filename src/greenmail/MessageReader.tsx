import React, { useEffect, useRef, useState } from "react";
import { AlarmClock, AlertTriangle, Archive, BellRing, CornerUpLeft, Download, Eye, Forward, ImageOff, Link2, ListTodo, Loader2, MailOpen, OctagonAlert, Paperclip, ReplyAll, Star, Tag, Trash2, X } from "lucide-react";
import { LABELS, type Attachment, type FullMessage, type LabelKey } from "./api";
import { downloadFile, FilePreview, ShareDialog, type FileRef } from "./FilePreview";
import { quickTimes } from "./FollowUpsView";
import { Avatar, displayName, formatAddress, formatBytes, fullDate } from "./ui";

export type ReaderAction = "reply" | "reply_all" | "forward" | "archive" | "delete" | "spam" | "not_spam" | "unread" | "star" | "task";

/** Follow-up actions that need a time or a label. */
export type ReaderExtras = {
  /** Snooze (not offered in Sent, Drafts, Trash or Snoozed itself). */
  onSnooze?: (until: Date) => void;
  /** "Remind me if nobody replies" — for emails in Sent. */
  onRemind?: (at: Date) => void;
  onLabel: (label: LabelKey, on: boolean) => void;
  onSessionError: (error: unknown) => void;
};

/**
 * One email. Its HTML (already cleaned on the server) is shown in a sandboxed
 * frame with scripts off and a content policy that blocks remote content —
 * so tracking pixels stay silent until the reader clicks "Show images".
 */
export function MessageReader({
  message,
  token,
  folder,
  isJunk,
  isLoading,
  onAction,
  extras,
  children,
}: {
  message: FullMessage | null;
  token: string;
  folder: string;
  isJunk: boolean;
  isLoading: boolean;
  onAction: (action: ReaderAction) => void;
  extras: ReaderExtras;
  /** The inline reply/forward box, shown under the header (above the email). */
  children?: React.ReactNode;
}) {
  const [showImages, setShowImages] = useState(false);
  const [menu, setMenu] = useState<"snooze" | "remind" | "label" | null>(null);
  const [preview, setPreview] = useState<FileRef | null>(null);
  const [share, setShare] = useState<FileRef | null>(null);

  useEffect(() => {
    setShowImages(false);
    setMenu(null);
  }, [message?.uid]);

  if (isLoading && !message) {
    return (
      <div className="flex h-full items-center justify-center text-slate-400">
        <Loader2 className="h-6 w-6 animate-spin" />
      </div>
    );
  }

  if (!message) {
    return (
      <div className="flex h-full flex-col items-center justify-center gap-2 text-slate-400">
        <MailOpen className="h-10 w-10" />
        <p className="text-sm">Select an email to read it</p>
      </div>
    );
  }

  const fileOf = (attachment: Attachment): FileRef => ({ folder, uid: message.uid, index: attachment.index, name: attachment.name, mime: attachment.mime, size: attachment.size, warning: attachment.warning, previewable: attachment.previewable });

  const menuButton = (key: "snooze" | "remind" | "label", label: string, icon: React.ReactNode) => (
    <button type="button" title={label} aria-label={label} aria-expanded={menu === key} className={`inline-flex shrink-0 items-center gap-1.5 rounded-md px-2.5 py-1.5 text-[13px] text-slate-700 hover:bg-slate-100 ${menu === key ? "bg-slate-100" : ""}`} onClick={() => setMenu(menu === key ? null : key)}>
      {icon}
      <span className="hidden 2xl:inline">{label}</span>
    </button>
  );

  const tool = (action: ReaderAction, label: string, icon: React.ReactNode, showLabel = true) => (
    <button type="button" title={label} aria-label={label} className="inline-flex shrink-0 items-center gap-1.5 rounded-md px-2.5 py-1.5 text-[13px] text-slate-700 hover:bg-slate-100" onClick={() => onAction(action)}>
      {icon}
      {showLabel && <span className="hidden xl:inline">{label}</span>}
    </button>
  );

  return (
    <div className="flex h-full flex-col">
      <div className="flex items-center gap-0.5 overflow-x-auto border-b border-slate-200 px-3 py-2">
        {tool("reply", "Reply", <CornerUpLeft className="h-4 w-4" />)}
        {tool("reply_all", "Reply all", <ReplyAll className="h-4 w-4" />)}
        {tool("forward", "Forward", <Forward className="h-4 w-4" />)}
        {tool("archive", "Archive", <Archive className="h-4 w-4" />)}
        {tool("delete", "Delete", <Trash2 className="h-4 w-4" />)}
        {isJunk ? tool("not_spam", "Not spam", <OctagonAlert className="h-4 w-4" />) : tool("spam", "Spam", <OctagonAlert className="h-4 w-4" />)}
        {tool("unread", "Mark unread", <MailOpen className="h-4 w-4" />, false)}
        <span className="mx-1 h-5 w-px shrink-0 bg-slate-200" />
        {extras.onSnooze && menuButton("snooze", "Snooze", <AlarmClock className="h-4 w-4" />)}
        {extras.onRemind && menuButton("remind", "Remind me", <BellRing className="h-4 w-4" />)}
        {menuButton("label", "Label", <Tag className="h-4 w-4" />)}
        {tool("task", "Create task", <ListTodo className="h-4 w-4" />, false)}
      </div>
      {menu && (
        <div className="relative z-30">
          <div className="absolute right-3 top-1 w-72 rounded-xl border border-slate-200 bg-white p-2 shadow-xl">
            {menu === "label" ? (
              <>
                <p className="px-2 py-1 text-xs font-bold uppercase tracking-wide text-slate-500">Label</p>
                {(Object.keys(LABELS) as LabelKey[]).map((key) => {
                  const on = message.labels.includes(key);
                  return (
                    <button key={key} type="button" aria-pressed={on} className="flex w-full items-center gap-2 rounded-lg px-2 py-2 text-left text-sm hover:bg-slate-50" onClick={() => { setMenu(null); extras.onLabel(key, !on); }}>
                      <input type="checkbox" readOnly checked={on} tabIndex={-1} className="h-4 w-4 accent-[#1f9d4c]" />
                      <span className={`rounded px-1.5 py-0.5 text-xs font-bold ${LABELS[key].className}`}>{LABELS[key].name}</span>
                    </button>
                  );
                })}
              </>
            ) : (
              <TimeMenu
                title={menu === "snooze" ? "Snooze until" : "Remind me if nobody replies by"}
                action={menu === "snooze" ? "Snooze" : "Remind me"}
                onPick={(when) => {
                  setMenu(null);
                  (menu === "snooze" ? extras.onSnooze : extras.onRemind)?.(when);
                }}
              />
            )}
          </div>
        </div>
      )}

      <div className="min-h-0 flex-1 overflow-y-auto">
        <div className="px-6 pb-4 pt-5">
          <div className="flex items-start gap-3">
            <h1 className="min-w-0 flex-1 break-words text-2xl font-black text-slate-900">{message.subject}</h1>
            <button type="button" aria-label={message.flagged ? "Unstar" : "Star"} aria-pressed={message.flagged} className="mt-1 rounded p-1 hover:bg-slate-100" onClick={() => onAction("star")}>
              <Star className={`h-5 w-5 ${message.flagged ? "fill-amber-400 text-amber-400" : "text-slate-400"}`} />
            </button>
          </div>
          <div className="mt-4 flex items-start gap-3">
            <Avatar address={message.from} size={40} />
            <div className="min-w-0 flex-1 text-sm">
              <p className="truncate">
                <strong className="text-slate-900">{displayName(message.from)}</strong>{" "}
                {message.from.name && <span className="text-slate-500">&lt;{message.from.email}&gt;</span>}
              </p>
              <p className="truncate text-xs text-slate-500" title={[...message.to, ...message.cc].map(formatAddress).join(", ")}>
                to {message.to.map((a) => a.name || a.email).join(", ") || "(undisclosed recipients)"}
                {message.cc.length > 0 && `, cc ${message.cc.map((a) => a.name || a.email).join(", ")}`}
              </p>
            </div>
            <span className="shrink-0 text-xs text-slate-500">{fullDate(message.date)}</span>
          </div>
          {(message.labels.length > 0 || message.suggested_label) && (
            <div className="mt-3 flex flex-wrap items-center gap-1.5">
              {message.labels.map((key) => (
                <span key={key} className={`inline-flex items-center gap-1 rounded px-1.5 py-0.5 text-xs font-bold ${LABELS[key].className}`}>
                  {LABELS[key].name}
                  <button type="button" aria-label={`Remove the ${LABELS[key].name} label`} onClick={() => extras.onLabel(key, false)}>
                    <X className="h-3 w-3" />
                  </button>
                </span>
              ))}
              {message.suggested_label && (
                <span className="inline-flex items-center gap-2 rounded-md bg-slate-50 px-2 py-1 text-xs text-slate-600">
                  <Tag className="h-3.5 w-3.5" /> Looks like {message.suggested_label === "invoice" ? "an invoice" : message.suggested_label === "quotation" ? "a quotation" : "a customer request"}.
                  <button type="button" className="font-bold text-[#1f9d4c] hover:underline" onClick={() => extras.onLabel(message.suggested_label as LabelKey, true)}>
                    Label it
                  </button>
                </span>
              )}
            </div>
          )}
        </div>

        {/* The reply/forward box sits right under the header, not after a long email. */}
        {children}

        {message.has_remote_images && !showImages && (
          <div className="mx-6 mb-3 flex flex-wrap items-center gap-2 rounded-md bg-slate-50 px-3 py-2 text-xs text-slate-600">
            <ImageOff className="h-4 w-4" /> Images from the internet are hidden to protect your privacy.
            <button type="button" className="font-bold text-[#1f9d4c] hover:underline" onClick={() => setShowImages(true)}>
              Show images
            </button>
          </div>
        )}

        <EmailBody html={message.html} allowRemoteImages={showImages} />

        {message.attachments.length > 0 && (
          <div className="border-t border-slate-100 px-6 py-4">
            <p className="mb-2 flex items-center gap-1.5 text-sm text-slate-600">
              <Paperclip className="h-4 w-4" /> {message.attachments.length} attachment{message.attachments.length === 1 ? "" : "s"} ·{" "}
              {formatBytes(message.attachments.reduce((sum, a) => sum + a.size, 0))}
            </p>
            <div className="flex flex-wrap gap-2">
              {message.attachments.map((attachment) => {
                const file = fileOf(attachment);
                return (
                  <div key={attachment.index} className={`flex max-w-[300px] flex-col rounded-lg border text-xs ${attachment.warning ? "border-amber-300 bg-amber-50" : "border-slate-200 bg-slate-50"}`}>
                    <div className="flex items-center gap-1">
                      <button
                        type="button"
                        title={attachment.previewable ? "Preview" : "Download"}
                        className="flex min-w-0 flex-1 items-center gap-2 px-3 py-2 text-left"
                        onClick={() => (attachment.previewable ? setPreview(file) : void downloadFile(file, token).catch(() => window.alert("That attachment could not be downloaded.")))}
                      >
                        {attachment.warning ? <AlertTriangle className="h-4 w-4 shrink-0 text-amber-600" /> : attachment.previewable ? <Eye className="h-4 w-4 shrink-0 text-slate-500" /> : <Download className="h-4 w-4 shrink-0 text-slate-500" />}
                        <span className="min-w-0">
                          <span className="block truncate font-semibold text-slate-800">{attachment.name}</span>
                          <span className="text-slate-500">{formatBytes(attachment.size)}</span>
                        </span>
                      </button>
                      {attachment.previewable && (
                        <button type="button" title="Download" aria-label={`Download ${attachment.name}`} className="rounded p-1.5 text-slate-500 hover:bg-white" onClick={() => void downloadFile(file, token).catch(() => window.alert("That attachment could not be downloaded."))}>
                          <Download className="h-3.5 w-3.5" />
                        </button>
                      )}
                      <button type="button" title="Share a link" aria-label={`Share ${attachment.name}`} className="mr-1 rounded p-1.5 text-slate-500 hover:bg-white" onClick={() => setShare(file)}>
                        <Link2 className="h-3.5 w-3.5" />
                      </button>
                    </div>
                    {attachment.warning && <p className="px-3 pb-2 text-[11px] leading-4 text-amber-900">{attachment.warning}</p>}
                  </div>
                );
              })}
            </div>
          </div>
        )}
      </div>
      {preview && <FilePreview file={preview} token={token} onClose={() => setPreview(null)} onShare={() => setShare(preview)} onSessionError={extras.onSessionError} />}
      {share && <ShareDialog file={share} token={token} onClose={() => setShare(null)} onSessionError={extras.onSessionError} />}
    </div>
  );
}

/** Quick choices plus a custom date and time. */
function TimeMenu({ title, action, onPick }: { title: string; action: string; onPick: (when: Date) => void }) {
  const [custom, setCustom] = useState("");
  return (
    <>
      <p className="px-2 py-1 text-xs font-bold uppercase tracking-wide text-slate-500">{title}</p>
      {quickTimes().map(([label, date]) => (
        <button key={label} type="button" className="flex w-full justify-between rounded-lg px-2 py-2 text-left text-sm hover:bg-slate-50" onClick={() => onPick(date)}>
          <span className="font-semibold text-slate-800">{label}</span>
          <span className="text-xs text-slate-500">{date.toLocaleString("en-US", { weekday: "short", hour: "numeric", minute: "2-digit" })}</span>
        </button>
      ))}
      <div className="mt-1 flex gap-2 border-t border-slate-100 px-2 pt-2">
        <input type="datetime-local" aria-label="Pick a date and time" value={custom} onChange={(event) => setCustom(event.target.value)} className="min-w-0 flex-1 rounded-md border border-slate-300 px-2 py-1 text-xs" />
        <button type="button" disabled={!custom || new Date(custom) <= new Date()} className="rounded-md bg-[#1f9d4c] px-2.5 py-1 text-xs font-bold text-white disabled:opacity-50" onClick={() => onPick(new Date(custom))}>
          {action}
        </button>
      </div>
    </>
  );
}

function EmailBody({ html, allowRemoteImages }: { html: string; allowRemoteImages: boolean }) {
  const frameRef = useRef<HTMLIFrameElement>(null);
  const [height, setHeight] = useState(200);

  const imageSources = allowRemoteImages ? "data: https: http:" : "data:";
  const srcDoc = `<!doctype html><html><head><meta charset="utf-8">
<meta http-equiv="Content-Security-Policy" content="default-src 'none'; style-src 'unsafe-inline'; img-src ${imageSources}; font-src data:">
<base target="_blank">
<style>html{background:#fff}body{margin:0;padding:12px 24px 16px;background:#fff;font:14px/1.6 Manrope,system-ui,sans-serif;color:#1e293b;word-wrap:break-word}img{max-width:100%;height:auto}${allowRemoteImages ? "" : "img[src^='http']{display:none}"}blockquote{margin:0 0 0 8px;padding-left:12px;border-left:3px solid #e2e8f0;color:#475569}table{max-width:100%}a{color:#1a7f3f}</style>
</head><body>${html}</body></html>`;

  // Same-origin (but no scripts) only so the frame can be sized to its content.
  const resize = () => {
    const body = frameRef.current?.contentDocument?.body;
    if (body) setHeight(Math.max(120, body.scrollHeight + 8));
  };

  return (
    <iframe
      ref={frameRef}
      title="Email message"
      sandbox="allow-same-origin allow-popups allow-popups-to-escape-sandbox"
      srcDoc={srcDoc}
      onLoad={() => {
        resize();
        window.setTimeout(resize, 400);
      }}
      className="block w-full border-0"
      style={{ height }}
    />
  );
}
