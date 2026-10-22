import React, { useEffect, useState } from "react";
import { AlertTriangle, Copy, Download, Link2, Loader2, X } from "lucide-react";
import { gm, gmBlobUrl, gmDownload } from "./api";
import { useFeedback } from "./feedback";
import { formatBytes } from "./ui";

/** Enough to fetch, show and share one attachment of one email. */
export type FileRef = { folder: string; uid: number; index: number; name: string; mime: string | null; size: number; warning?: string | null; previewable?: boolean };

const filePath = (file: FileRef, inline = false) => `/messages/${file.uid}/attachments/${file.index}?folder=${encodeURIComponent(file.folder)}${inline ? "&inline=1" : ""}`;

export const downloadFile = (file: FileRef, token: string) => gmDownload(filePath(file), token, file.name);

/** A warning the reader sees before opening a risky file. */
export function FileWarning({ text, className = "" }: { text: string; className?: string }) {
  return (
    <p className={`flex items-start gap-1.5 rounded-md bg-amber-50 px-2 py-1.5 text-xs text-amber-900 ${className}`}>
      <AlertTriangle className="mt-0.5 h-3.5 w-3.5 shrink-0 text-amber-600" /> {text}
    </p>
  );
}

/**
 * Preview in the app: PDFs, pictures and plain text are fetched with the
 * mailbox token and shown from a blob URL — the server only sends types the
 * browser shows safely (never HTML or SVG). Anything else downloads.
 */
export function FilePreview({ file, token, onClose, onShare, onSessionError }: { file: FileRef; token: string; onClose: () => void; onShare: () => void; onSessionError: (error: unknown) => void }) {
  const [url, setUrl] = useState<string | null>(null);
  const [text, setText] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const mime = (file.mime || "").toLowerCase();

  useEffect(() => {
    let blobUrl: string | null = null;
    let cancelled = false;
    gmBlobUrl(filePath(file, true), token)
      .then(async (made) => {
        blobUrl = made;
        if (cancelled) return;
        if (mime.startsWith("text/")) setText(await fetch(made).then((r) => r.text()).then((t) => t.slice(0, 200000)));
        else setUrl(made);
      })
      .catch((err) => {
        onSessionError(err);
        setError(err instanceof Error ? err.message : "The file could not be opened.");
      });
    return () => {
      cancelled = true;
      if (blobUrl) URL.revokeObjectURL(blobUrl);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [file.folder, file.uid, file.index, token]);

  useEffect(() => {
    const onKey = (event: KeyboardEvent) => event.key === "Escape" && onClose();
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [onClose]);

  return (
    <div className="fixed inset-0 z-50 flex flex-col bg-slate-900/80 p-0 sm:p-6" role="dialog" aria-modal="true" aria-label={`Preview of ${file.name}`}>
      <div className="mx-auto flex h-full w-full max-w-5xl flex-col overflow-hidden bg-white sm:rounded-2xl">
        <div className="flex items-center gap-2 border-b border-slate-200 px-4 py-3">
          <div className="min-w-0 flex-1">
            <p className="truncate font-bold text-slate-900">{file.name}</p>
            <p className="text-xs text-slate-500">{formatBytes(file.size)}</p>
          </div>
          <button type="button" className="inline-flex items-center gap-1.5 rounded-lg border border-slate-200 px-3 py-1.5 text-sm font-semibold text-slate-700 hover:bg-slate-50" onClick={onShare}>
            <Link2 className="h-4 w-4" /> <span className="hidden sm:inline">Share link</span>
          </button>
          <button type="button" className="inline-flex items-center gap-1.5 rounded-lg bg-[#1f9d4c] px-3 py-1.5 text-sm font-bold text-white hover:bg-[#188a42]" onClick={() => void downloadFile(file, token).catch(() => setError("Download failed."))}>
            <Download className="h-4 w-4" /> <span className="hidden sm:inline">Download</span>
          </button>
          <button type="button" aria-label="Close preview" className="rounded-lg p-2 text-slate-500 hover:bg-slate-100" onClick={onClose}>
            <X className="h-5 w-5" />
          </button>
        </div>
        {file.warning && <FileWarning text={file.warning} className="mx-4 mt-3" />}
        <div className="flex min-h-0 flex-1 items-center justify-center overflow-auto bg-slate-100">
          {error ? (
            <p className="px-6 text-sm text-slate-600">{error}</p>
          ) : text !== null ? (
            <pre className="h-full w-full overflow-auto whitespace-pre-wrap bg-white p-4 text-xs text-slate-800">{text}</pre>
          ) : !url ? (
            <Loader2 className="h-6 w-6 animate-spin text-slate-400" />
          ) : mime === "application/pdf" ? (
            <iframe title={file.name} src={url} className="h-full w-full border-0 bg-white" />
          ) : (
            <img src={url} alt={file.name} className="max-h-full max-w-full object-contain" />
          )}
        </div>
      </div>
    </div>
  );
}

/**
 * "Share securely": a link that works without signing in, for a limited time
 * and optionally a limited number of downloads. The file is copied to the
 * server (encrypted) so the link keeps working after the email is deleted.
 */
export function ShareDialog({ file, token, onClose, onSessionError }: { file: FileRef; token: string; onClose: () => void; onSessionError: (error: unknown) => void }) {
  const [days, setDays] = useState(7);
  const [limit, setLimit] = useState("");
  const [busy, setBusy] = useState(false);
  const [link, setLink] = useState<{ url: string; message: string } | null>(null);
  const [error, setError] = useState<string | null>(null);
  const { toast } = useFeedback();

  const create = async () => {
    setBusy(true);
    setError(null);
    try {
      const result = await gm<{ url: string; message: string }>("/attachments/share", token, {
        method: "POST",
        body: JSON.stringify({ folder: file.folder, uid: file.uid, index: file.index, days, max_downloads: limit ? Number(limit) : null }),
      });
      setLink(result);
    } catch (err) {
      onSessionError(err);
      setError(err instanceof Error ? err.message : "The link could not be created.");
    } finally {
      setBusy(false);
    }
  };

  const copy = async () => {
    if (!link) return;
    try {
      await navigator.clipboard.writeText(link.url);
      toast("Link copied.");
    } catch {
      window.prompt("Copy this link:", link.url);
    }
  };

  return (
    <div className="fixed inset-0 z-[60] flex items-end justify-center bg-slate-900/50 sm:items-center" role="dialog" aria-modal="true" aria-label="Share a link to this file">
      <div className="w-full max-w-md rounded-t-2xl bg-white p-5 shadow-2xl sm:rounded-2xl">
        <div className="flex items-start gap-3">
          <Link2 className="mt-0.5 h-5 w-5 text-[#1f9d4c]" />
          <div className="min-w-0 flex-1">
            <h2 className="font-black text-slate-900">Share a link</h2>
            <p className="truncate text-sm text-slate-500">{file.name}</p>
          </div>
          <button type="button" aria-label="Close" className="rounded p-1 text-slate-500 hover:bg-slate-100" onClick={onClose}>
            <X className="h-5 w-5" />
          </button>
        </div>

        {link ? (
          <div className="mt-4">
            <div className="flex gap-2">
              <input readOnly value={link.url} aria-label="Share link" className="min-w-0 flex-1 rounded-lg border border-slate-300 bg-slate-50 px-3 py-2 text-xs" onFocus={(event) => event.target.select()} />
              <button type="button" className="inline-flex items-center gap-1.5 rounded-lg bg-[#1f9d4c] px-3 py-2 text-sm font-bold text-white" onClick={() => void copy()}>
                <Copy className="h-4 w-4" /> Copy
              </button>
            </div>
            <p className="mt-2 text-xs text-slate-500">{link.message} Anyone with the link can download the file; you can stop it from the Attachments page.</p>
          </div>
        ) : (
          <div className="mt-4 grid gap-3 text-sm">
            <label className="grid gap-1">
              <span className="font-semibold text-slate-700">Link works for</span>
              <select value={days} onChange={(event) => setDays(Number(event.target.value))} className="rounded-lg border border-slate-300 px-3 py-2">
                {[1, 3, 7, 14, 30].map((d) => (
                  <option key={d} value={d}>
                    {d === 1 ? "1 day" : `${d} days`}
                  </option>
                ))}
              </select>
            </label>
            <label className="grid gap-1">
              <span className="font-semibold text-slate-700">Stop after this many downloads (optional)</span>
              <input type="number" min={1} max={1000} value={limit} onChange={(event) => setLimit(event.target.value)} placeholder="No limit" className="rounded-lg border border-slate-300 px-3 py-2" />
            </label>
            {error && <p className="rounded-md bg-red-50 px-3 py-2 text-xs text-red-700">{error}</p>}
            <button type="button" disabled={busy} className="inline-flex items-center justify-center gap-2 rounded-lg bg-[#1f9d4c] py-2.5 font-bold text-white disabled:opacity-60" onClick={() => void create()}>
              {busy && <Loader2 className="h-4 w-4 animate-spin" />} Create link
            </button>
          </div>
        )}
      </div>
    </div>
  );
}
