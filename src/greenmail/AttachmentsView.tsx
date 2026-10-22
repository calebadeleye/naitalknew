import React, { useCallback, useEffect, useRef, useState } from "react";
import { AlertTriangle, Archive, Download, Eye, File, FileImage, FileSpreadsheet, FileText, Link2, Loader2, Mail, Presentation, RefreshCw, Search, X } from "lucide-react";
import { gm, type AttachmentKind, type IndexedAttachment, type SharedLink } from "./api";
import { downloadFile, FilePreview, ShareDialog, type FileRef } from "./FilePreview";
import { useFeedback } from "./feedback";
import { formatBytes, listDate } from "./ui";

type Page = { attachments: IndexedAttachment[]; page: number; last_page: number; total: number; counts: Partial<Record<AttachmentKind, number>>; indexing: boolean };

const KINDS: Array<[AttachmentKind | "all", string]> = [
  ["all", "All"],
  ["pdf", "PDFs"],
  ["image", "Images"],
  ["document", "Documents"],
  ["spreadsheet", "Spreadsheets"],
  ["presentation", "Slides"],
  ["archive", "Compressed"],
  ["other", "Other"],
];

const ICON: Record<AttachmentKind, React.ComponentType<{ className?: string }>> = {
  pdf: FileText,
  image: FileImage,
  document: FileText,
  spreadsheet: FileSpreadsheet,
  presentation: Presentation,
  archive: Archive,
  other: File,
};

const TINT: Record<AttachmentKind, string> = {
  pdf: "bg-red-50 text-red-600",
  image: "bg-sky-50 text-sky-600",
  document: "bg-blue-50 text-blue-700",
  spreadsheet: "bg-emerald-50 text-emerald-700",
  presentation: "bg-orange-50 text-orange-600",
  archive: "bg-slate-100 text-slate-600",
  other: "bg-slate-100 text-slate-600",
};

const asFile = (a: IndexedAttachment): FileRef => ({ folder: a.folder, uid: a.uid, index: a.part_index, name: a.name, mime: a.mime, size: a.size, warning: a.warning, previewable: a.previewable });

/**
 * Every file people have emailed this mailbox, in one place: browse by type,
 * search by file name or sender, preview, download, share a link, and see a
 * warning on anything that looks dangerous. The index fills in while the page
 * is open (new mail first, then older mail).
 */
export function AttachmentsView({ token, onSessionError, onOpenEmail }: { token: string; onSessionError: (error: unknown) => void; onOpenEmail: (folder: string, uid: number) => void }) {
  const [kind, setKind] = useState<AttachmentKind | "all">("all");
  const [queryInput, setQueryInput] = useState("");
  const [query, setQuery] = useState("");
  const [page, setPage] = useState(1);
  const [data, setData] = useState<Page | null>(null);
  const [loading, setLoading] = useState(false);
  const [preview, setPreview] = useState<FileRef | null>(null);
  const [share, setShare] = useState<FileRef | null>(null);
  const [showLinks, setShowLinks] = useState(false);
  const { toast } = useFeedback();
  const timer = useRef<number | null>(null);

  const load = useCallback(
    async (options: { reset?: boolean; quiet?: boolean } = {}) => {
      if (!options.quiet) setLoading(true);
      const params = new URLSearchParams({ kind, page: String(page) });
      if (query) params.set("q", query);
      if (options.reset) params.set("reset", "1");
      try {
        const result = await gm<Page>(`/attachments?${params.toString()}`, token);
        setData(result);
        // Keep indexing (a batch per request) while there's more to do.
        if (timer.current) window.clearTimeout(timer.current);
        if (result.indexing) timer.current = window.setTimeout(() => void load({ quiet: true }), 1500);
      } catch (error) {
        onSessionError(error);
        toast(error instanceof Error ? error.message : "Could not load attachments.", "error");
      } finally {
        setLoading(false);
      }
    },
    [kind, page, query, token, onSessionError, toast],
  );

  useEffect(() => {
    void load();
    return () => {
      if (timer.current) window.clearTimeout(timer.current);
    };
  }, [load]);

  const open = (a: IndexedAttachment) => {
    if (a.previewable) setPreview(asFile(a));
    else void downloadFile(asFile(a), token).catch(() => gone(a));
  };

  // The email was moved or deleted since it was indexed.
  const gone = (a: IndexedAttachment) => {
    toast("That file is no longer in your mailbox.", "error");
    void gm("/attachments/forget", token, { method: "POST", body: JSON.stringify({ folder: a.folder, uid: a.uid }) }).then(() => load({ quiet: true }));
  };

  const total = Object.values(data?.counts ?? {}).reduce<number>((sum, n) => sum + Number(n ?? 0), 0);

  return (
    <section className="flex min-h-0 flex-1 flex-col overflow-y-auto bg-white p-3 sm:p-6">
      <div className="mx-auto w-full max-w-5xl">
        <div className="flex flex-wrap items-center gap-2">
          <h1 className="mr-auto text-xl font-black text-slate-900 sm:text-2xl">Attachments</h1>
          <button type="button" className="inline-flex items-center gap-1.5 rounded-lg border border-slate-200 px-3 py-1.5 text-sm font-semibold text-slate-700 hover:bg-slate-50" onClick={() => setShowLinks(true)}>
            <Link2 className="h-4 w-4" /> Shared links
          </button>
          <button type="button" title="Rebuild the list from your mailbox" aria-label="Rebuild the list" className="rounded-lg border border-slate-200 p-2 text-slate-600 hover:bg-slate-50" onClick={() => void load({ reset: true })}>
            <RefreshCw className={`h-4 w-4 ${loading ? "animate-spin" : ""}`} />
          </button>
        </div>

        <form
          role="search"
          className="mt-4 flex items-center gap-2 rounded-lg bg-slate-100 px-3 py-2"
          onSubmit={(event) => {
            event.preventDefault();
            setQuery(queryInput.trim());
            setPage(1);
          }}
        >
          <Search className="h-4 w-4 text-slate-500" />
          <input value={queryInput} onChange={(event) => setQueryInput(event.target.value)} placeholder="Search by file name, sender or subject" aria-label="Search attachments" className="min-w-0 flex-1 bg-transparent text-sm outline-none" />
          {query && (
            <button type="button" aria-label="Clear search" className="text-slate-500" onClick={() => { setQuery(""); setQueryInput(""); setPage(1); }}>
              <X className="h-4 w-4" />
            </button>
          )}
        </form>

        <div className="mt-3 flex gap-1 overflow-x-auto pb-1">
          {KINDS.map(([key, label]) => {
            const count = key === "all" ? total : data?.counts[key] ?? 0;
            if (key !== "all" && key !== kind && count === 0) return null;
            return (
              <button key={key} type="button" aria-pressed={kind === key} onClick={() => { setKind(key); setPage(1); }} className={`shrink-0 rounded-full px-3 py-1 text-sm font-semibold ${kind === key ? "bg-[#e3f4e9] text-[#14632f]" : "text-slate-600 hover:bg-slate-100"}`}>
                {label} <span className="text-xs font-normal opacity-70">{count}</span>
              </button>
            );
          })}
        </div>

        {data?.indexing && (
          <p className="mt-2 flex items-center gap-2 rounded-lg bg-[#f2faf5] px-3 py-2 text-xs text-[#14632f]">
            <Loader2 className="h-3.5 w-3.5 animate-spin" /> Finding attachments in your mail… {total} so far. You can keep using the list.
          </p>
        )}

        {!data ? (
          <Loader2 className="mt-6 h-5 w-5 animate-spin text-slate-400" />
        ) : data.attachments.length === 0 ? (
          <p className="mt-8 text-center text-sm text-slate-500">{query ? "No files match your search." : data.indexing ? "Looking through your mail…" : "No attachments yet."}</p>
        ) : (
          <ul className="mt-3 divide-y divide-slate-100 rounded-xl border border-slate-200">
            {data.attachments.map((a) => {
              const Icon = ICON[a.kind];
              return (
                <li key={a.id} className="flex items-center gap-3 px-3 py-2.5">
                  <button type="button" className={`flex h-10 w-10 shrink-0 items-center justify-center rounded-lg ${TINT[a.kind]}`} aria-label={a.previewable ? `Preview ${a.name}` : `Download ${a.name}`} onClick={() => open(a)}>
                    <Icon className="h-5 w-5" />
                  </button>
                  <button type="button" className="min-w-0 flex-1 text-left" onClick={() => open(a)}>
                    <span className="flex items-center gap-1.5">
                      <span className="truncate text-sm font-semibold text-slate-900">{a.name}</span>
                      {a.warning && <AlertTriangle className="h-3.5 w-3.5 shrink-0 text-amber-600" aria-label="Warning" />}
                    </span>
                    <span className="block truncate text-xs text-slate-500">
                      {a.from_name || a.from_email || "Unknown sender"} · {a.subject} · {formatBytes(a.size)}
                    </span>
                    {a.warning && <span className="block truncate text-xs text-amber-700">{a.warning}</span>}
                  </button>
                  <span className="hidden shrink-0 text-xs text-slate-500 sm:block">{listDate(a.sent_at)}</span>
                  <div className="flex shrink-0 items-center">
                    {a.previewable && (
                      <button type="button" title="Preview" aria-label={`Preview ${a.name}`} className="rounded p-1.5 text-slate-500 hover:bg-slate-100" onClick={() => setPreview(asFile(a))}>
                        <Eye className="h-4 w-4" />
                      </button>
                    )}
                    <button type="button" title="Download" aria-label={`Download ${a.name}`} className="rounded p-1.5 text-slate-500 hover:bg-slate-100" onClick={() => void downloadFile(asFile(a), token).catch(() => gone(a))}>
                      <Download className="h-4 w-4" />
                    </button>
                    <button type="button" title="Share a link" aria-label={`Share ${a.name}`} className="hidden rounded p-1.5 text-slate-500 hover:bg-slate-100 sm:block" onClick={() => setShare(asFile(a))}>
                      <Link2 className="h-4 w-4" />
                    </button>
                    <button type="button" title="Open the email" aria-label={`Open the email with ${a.name}`} className="rounded p-1.5 text-slate-500 hover:bg-slate-100" onClick={() => onOpenEmail(a.folder, a.uid)}>
                      <Mail className="h-4 w-4" />
                    </button>
                  </div>
                </li>
              );
            })}
          </ul>
        )}

        {data && data.last_page > 1 && (
          <div className="mt-3 flex items-center justify-center gap-3 text-sm text-slate-600">
            <button type="button" disabled={page <= 1} className="rounded-lg px-3 py-1 hover:bg-slate-100 disabled:opacity-30" onClick={() => setPage(page - 1)}>
              Previous
            </button>
            Page {data.page} of {data.last_page}
            <button type="button" disabled={page >= data.last_page} className="rounded-lg px-3 py-1 hover:bg-slate-100 disabled:opacity-30" onClick={() => setPage(page + 1)}>
              Next
            </button>
          </div>
        )}
      </div>

      {preview && <FilePreview file={preview} token={token} onClose={() => setPreview(null)} onShare={() => setShare(preview)} onSessionError={onSessionError} />}
      {share && <ShareDialog file={share} token={token} onClose={() => setShare(null)} onSessionError={onSessionError} />}
      {showLinks && <SharedLinks token={token} onClose={() => setShowLinks(false)} onSessionError={onSessionError} />}
    </section>
  );
}

/** Links made with "Share link", and stopping them. */
function SharedLinks({ token, onClose, onSessionError }: { token: string; onClose: () => void; onSessionError: (error: unknown) => void }) {
  const [links, setLinks] = useState<SharedLink[] | null>(null);
  const { toast, confirm } = useFeedback();

  const load = useCallback(
    () =>
      gm<{ shares: SharedLink[] }>("/attachments/shares", token)
        .then((r) => setLinks(r.shares))
        .catch((error) => {
          onSessionError(error);
          setLinks([]);
        }),
    [token, onSessionError],
  );

  useEffect(() => {
    void load();
  }, [load]);

  const stop = async (link: SharedLink) => {
    if (!(await confirm({ title: "Stop this link?", message: `${link.name} — anyone who has the link won't be able to download it any more.`, confirmLabel: "Stop link", danger: true }))) return;
    try {
      const result = await gm<{ message: string }>(`/attachments/shares/${link.id}`, token, { method: "DELETE" });
      toast(result.message);
      void load();
    } catch (error) {
      onSessionError(error);
      toast(error instanceof Error ? error.message : "That did not work.", "error");
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-end justify-center bg-slate-900/50 sm:items-center" role="dialog" aria-modal="true" aria-label="Shared links">
      <div className="flex max-h-[85vh] w-full max-w-lg flex-col rounded-t-2xl bg-white shadow-2xl sm:rounded-2xl">
        <div className="flex items-center gap-2 border-b border-slate-200 px-5 py-4">
          <h2 className="flex-1 font-black text-slate-900">Shared links</h2>
          <button type="button" aria-label="Close" className="rounded p-1 text-slate-500 hover:bg-slate-100" onClick={onClose}>
            <X className="h-5 w-5" />
          </button>
        </div>
        <div className="min-h-0 overflow-y-auto px-5 py-3">
          {links === null ? (
            <Loader2 className="h-5 w-5 animate-spin text-slate-400" />
          ) : links.length === 0 ? (
            <p className="py-4 text-sm text-slate-500">You haven't shared any files. Use “Share link” on an attachment.</p>
          ) : (
            <ul className="divide-y divide-slate-100">
              {links.map((link) => (
                <li key={link.id} className="flex items-center gap-3 py-2.5">
                  <div className="min-w-0 flex-1">
                    <p className="truncate text-sm font-semibold text-slate-900">{link.name}</p>
                    <p className="text-xs text-slate-500">
                      {link.available
                        ? `Works until ${new Date(link.expires_at).toLocaleDateString("en-GB", { day: "numeric", month: "short" })} · ${link.downloads}${link.max_downloads ? ` of ${link.max_downloads}` : ""} download${link.downloads === 1 ? "" : "s"}`
                        : link.revoked_at
                          ? "Stopped"
                          : "Expired"}
                    </p>
                  </div>
                  {link.available && (
                    <>
                      <button type="button" className="rounded p-1.5 text-slate-500 hover:bg-slate-100" title="Copy link" aria-label={`Copy link to ${link.name}`} onClick={() => void navigator.clipboard.writeText(link.url).then(() => toast("Link copied."), () => window.prompt("Copy this link:", link.url))}>
                        <Link2 className="h-4 w-4" />
                      </button>
                      <button type="button" className="rounded-md border border-red-200 px-2 py-1 text-xs font-bold text-red-600 hover:bg-red-50" onClick={() => void stop(link)}>
                        Stop
                      </button>
                    </>
                  )}
                </li>
              ))}
            </ul>
          )}
        </div>
      </div>
    </div>
  );
}
