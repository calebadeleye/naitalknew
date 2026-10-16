import React, { useEffect, useRef, useState } from "react";
import { Archive, CornerUpLeft, Download, Forward, ImageOff, Loader2, MailOpen, OctagonAlert, Paperclip, ReplyAll, Star, Trash2 } from "lucide-react";
import { gmDownload, type FullMessage } from "./api";
import { Avatar, displayName, formatAddress, formatBytes, fullDate } from "./ui";

export type ReaderAction = "reply" | "reply_all" | "forward" | "archive" | "delete" | "spam" | "not_spam" | "unread" | "star";

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
  children,
}: {
  message: FullMessage | null;
  token: string;
  folder: string;
  isJunk: boolean;
  isLoading: boolean;
  onAction: (action: ReaderAction) => void;
  children?: React.ReactNode;
}) {
  const [showImages, setShowImages] = useState(false);

  useEffect(() => setShowImages(false), [message?.uid]);

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
      </div>

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
        </div>

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
              {message.attachments.map((attachment) => (
                <button
                  key={attachment.index}
                  type="button"
                  className="inline-flex max-w-[260px] items-center gap-2 rounded-lg border border-slate-200 bg-slate-50 px-3 py-2 text-left text-xs hover:border-slate-300"
                  onClick={() =>
                    void gmDownload(`/messages/${message.uid}/attachments/${attachment.index}?folder=${encodeURIComponent(folder)}`, token, attachment.name).catch(() =>
                      window.alert("That attachment could not be downloaded."),
                    )
                  }
                >
                  <Download className="h-4 w-4 shrink-0 text-slate-500" />
                  <span className="min-w-0">
                    <span className="block truncate font-semibold text-slate-800">{attachment.name}</span>
                    <span className="text-slate-500">{formatBytes(attachment.size)}</span>
                  </span>
                </button>
              ))}
            </div>
          </div>
        )}

        {children}
      </div>
    </div>
  );
}

function EmailBody({ html, allowRemoteImages }: { html: string; allowRemoteImages: boolean }) {
  const frameRef = useRef<HTMLIFrameElement>(null);
  const [height, setHeight] = useState(200);

  const imageSources = allowRemoteImages ? "data: https: http:" : "data:";
  const srcDoc = `<!doctype html><html><head><meta charset="utf-8">
<meta http-equiv="Content-Security-Policy" content="default-src 'none'; style-src 'unsafe-inline'; img-src ${imageSources}; font-src data:">
<base target="_blank">
<style>body{margin:0;padding:0 24px 16px;font:14px/1.6 Manrope,system-ui,sans-serif;color:#1e293b;word-wrap:break-word}img{max-width:100%;height:auto}${allowRemoteImages ? "" : "img[src^='http']{display:none}"}blockquote{margin:0 0 0 8px;padding-left:12px;border-left:3px solid #e2e8f0;color:#475569}table{max-width:100%}a{color:#1a7f3f}</style>
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
