import React, { useCallback, useEffect, useMemo, useState } from "react";
import {
  Archive,
  ArrowLeft,
  Bot,
  ChevronLeft,
  ChevronRight,
  ChevronsLeft,
  ChevronsRight,
  FileText,
  Folder as FolderIcon,
  Inbox,
  Loader2,
  LogOut,
  OctagonAlert,
  Paperclip,
  Pencil,
  Plus,
  RefreshCw,
  Search,
  Send,
  Settings,
  Star,
  Trash2,
  X,
} from "lucide-react";
import { clearToken, gm, readToken, SessionExpired, type Folder, type FullMessage, type Me, type MessageSummary } from "./api";
import { Composer, type ComposeDraft } from "./Composer";
import { LoginScreen } from "./LoginScreen";
import { MessageReader, type ReaderAction } from "./MessageReader";
import { SettingsModal } from "./SettingsModal";
import { SidePanel } from "./SidePanel";
import { Avatar, displayName, escapeHtml, formatBytes, fullDate, listDate, withoutRemoteImages } from "./ui";

type Filter = "all" | "unread" | "flagged" | "attachments";
type ListPage = { messages: MessageSummary[]; total: number; page: number; last_page: number };
type Compose = { draft: ComposeDraft; variant: "inline" | "window"; key: number };

const ROLE_ICON: Record<string, React.ComponentType<{ className?: string }>> = {
  inbox: Inbox,
  sent: Send,
  drafts: FileText,
  junk: OctagonAlert,
  trash: Trash2,
  archive: Archive,
};

const ROLE_LABEL: Record<string, string> = { inbox: "Inbox", sent: "Sent", drafts: "Drafts", junk: "Spam", trash: "Trash", archive: "Archive" };

/** Greenmail — NAI TALK's webmail (www.naitalk.com/greenmail). */
export function GreenmailApp() {
  const [token, setToken] = useState(readToken);
  const [notice, setNotice] = useState<string | null>(null);

  useEffect(() => {
    document.title = "Naitalk Webmail";
    const robots = document.createElement("meta");
    robots.name = "robots";
    robots.content = "noindex, nofollow";
    document.head.appendChild(robots);
    return () => robots.remove();
  }, []);

  if (!token) {
    return (
      <LoginScreen
        notice={notice}
        onSignedIn={(newToken) => {
          setNotice(null);
          setToken(newToken);
        }}
      />
    );
  }

  return (
    <Mailbox
      token={token}
      onSignedOut={(message) => {
        clearToken();
        setNotice(message);
        setToken("");
      }}
    />
  );
}

function Mailbox({ token, onSignedOut }: { token: string; onSignedOut: (message: string | null) => void }) {
  const [me, setMe] = useState<Me | null>(null);
  const [folders, setFolders] = useState<Folder[]>([]);
  const [folder, setFolder] = useState("INBOX");
  const [filter, setFilter] = useState<Filter>("all");
  const [searchInput, setSearchInput] = useState("");
  const [search, setSearch] = useState("");
  const [page, setPage] = useState(1);
  const [list, setList] = useState<ListPage | null>(null);
  const [isLoadingList, setIsLoadingList] = useState(false);
  const [selectedUid, setSelectedUid] = useState<number | null>(null);
  const [message, setMessage] = useState<FullMessage | null>(null);
  const [isLoadingMessage, setIsLoadingMessage] = useState(false);
  const [compose, setCompose] = useState<Compose | null>(null);
  // Open beside the reader on wide screens; on smaller ones it slides in when asked for.
  const [showSidePanel, setShowSidePanel] = useState(() => window.matchMedia?.("(min-width: 1536px)").matches ?? false);
  const [collapsed, setCollapsed] = useState(false);
  const [showSettings, setShowSettings] = useState(false);
  const [toast, setToast] = useState<string | null>(null);
  const [mobileNav, setMobileNav] = useState(false);

  const handleError = useCallback(
    (error: unknown) => {
      if (error instanceof SessionExpired) onSignedOut(error.message);
    },
    [onSignedOut],
  );

  const flash = (text: string) => {
    setToast(text);
    window.setTimeout(() => setToast((current) => (current === text ? null : current)), 3500);
  };

  const loadFolders = useCallback(
    () =>
      gm<{ folders: Folder[] }>("/folders", token)
        .then((response) => setFolders(response.folders))
        .catch(handleError),
    [token, handleError],
  );

  const loadList = useCallback(
    (quiet = false) => {
      if (!quiet) setIsLoadingList(true);
      const params = new URLSearchParams({ folder, page: String(page), filter });
      if (search) params.set("q", search);
      return gm<ListPage>(`/messages?${params.toString()}`, token)
        .then(setList)
        .catch((error) => {
          handleError(error);
          if (!quiet) flash(error instanceof Error ? error.message : "Could not load messages.");
        })
        .finally(() => setIsLoadingList(false));
    },
    [token, folder, page, filter, search, handleError],
  );

  useEffect(() => {
    gm<Me>("/session", token).then(setMe).catch(handleError);
    void loadFolders();
  }, [token, loadFolders, handleError]);

  useEffect(() => {
    void loadList();
  }, [loadList]);

  // New mail appears without reloading: re-check every minute and on return to the tab.
  useEffect(() => {
    const refresh = () => {
      void loadFolders();
      void loadList(true);
    };
    const timer = window.setInterval(refresh, 60000);
    window.addEventListener("focus", refresh);
    return () => {
      window.clearInterval(timer);
      window.removeEventListener("focus", refresh);
    };
  }, [loadFolders, loadList]);

  const roleOf = (path: string) => folders.find((f) => f.path === path)?.role ?? null;
  const pathOf = (role: string) => folders.find((f) => f.role === role)?.path ?? null;

  const openFolder = (path: string, nextFilter: Filter = "all") => {
    setFolder(path);
    setFilter(nextFilter);
    setPage(1);
    setSelectedUid(null);
    setMessage(null);
    setCompose(null);
    setMobileNav(false);
  };

  const openMessage = async (summary: MessageSummary) => {
    // Drafts open straight into the editor.
    if (roleOf(folder) === "drafts") {
      setIsLoadingMessage(true);
      try {
        const full = await gm<FullMessage>(`/messages/${summary.uid}?folder=${encodeURIComponent(folder)}`, token);
        setCompose({
          variant: "window",
          key: Date.now(),
          draft: { to: full.to.map((a) => a.email).join(", "), cc: full.cc.map((a) => a.email).join(", "), bcc: "", subject: full.subject === "(no subject)" ? "" : full.subject, bodyHtml: full.html },
        });
      } catch (error) {
        handleError(error);
      } finally {
        setIsLoadingMessage(false);
      }
      return;
    }

    setSelectedUid(summary.uid);
    setCompose(null);
    setIsLoadingMessage(true);
    try {
      const full = await gm<FullMessage>(`/messages/${summary.uid}?folder=${encodeURIComponent(folder)}`, token);
      setMessage(full);
      if (!summary.seen) {
        setList((current) => current && { ...current, messages: current.messages.map((m) => (m.uid === summary.uid ? { ...m, seen: true } : m)) });
        void loadFolders();
      }
    } catch (error) {
      handleError(error);
      flash(error instanceof Error ? error.message : "Could not open that message.");
      setSelectedUid(null);
    } finally {
      setIsLoadingMessage(false);
    }
  };

  const signature = useMemo(() => {
    const raw = me?.signature_html?.trim();
    if (!raw) return "";
    const html = /<[a-z][\s\S]*>/i.test(raw) ? raw : escapeHtml(raw).replace(/\n/g, "<br>");
    return `<p><br></p><div class="gm-signature">--<br>${html}</div>`;
  }, [me]);

  const myEmail = me?.email ?? "";

  const startReply = (mode: "reply" | "reply_all" | "forward", bodyText?: string) => {
    if (!message) return;
    const quoteHeader = `On ${escapeHtml(fullDate(message.date))}, ${escapeHtml(displayName(message.from))} wrote:`;
    const subjectBase = message.subject === "(no subject)" ? "" : message.subject;
    const intro = bodyText ? bodyText.split(/\n{2,}/).map((p) => `<p>${escapeHtml(p).replace(/\n/g, "<br>")}</p>`).join("") : "<p><br></p>";

    if (mode === "forward") {
      setCompose({
        variant: "inline",
        key: Date.now(),
        draft: {
          to: "",
          cc: "",
          bcc: "",
          subject: /^fwd?:/i.test(subjectBase) ? subjectBase : `Fwd: ${subjectBase}`,
          bodyHtml: `${intro}${signature}<p><br></p><div>---------- Forwarded message ----------<br>From: ${escapeHtml(displayName(message.from))} &lt;${escapeHtml(message.from.email)}&gt;<br>Date: ${escapeHtml(fullDate(message.date))}<br>Subject: ${escapeHtml(message.subject)}</div><br>${withoutRemoteImages(message.html)}`,
        },
      });
      return;
    }

    const replyTo = (message.reply_to[0] ?? message.from).email;
    const everyone = mode === "reply_all" ? [...message.to, ...message.cc].map((a) => a.email).filter((e) => e !== myEmail && e !== replyTo) : [];

    setCompose({
      variant: "inline",
      key: Date.now(),
      draft: {
        to: replyTo,
        cc: [...new Set(everyone)].join(", "),
        bcc: "",
        subject: /^re:/i.test(subjectBase) ? subjectBase : `Re: ${subjectBase}`,
        bodyHtml: `${intro}${signature}<p><br></p><div>${quoteHeader}</div><blockquote>${withoutRemoteImages(message.html)}</blockquote>`,
        inReplyTo: message.message_id || undefined,
        references: message.references || undefined,
        replyUid: message.uid,
        replyFolder: folder,
      },
    });
  };

  const newMessage = (to = "") => setCompose({ variant: "window", key: Date.now(), draft: { to, cc: "", bcc: "", subject: "", bodyHtml: `<p><br></p>${signature}` } });

  const afterRemoval = (uid: number, text: string) => {
    flash(text);
    setList((current) => current && { ...current, messages: current.messages.filter((m) => m.uid !== uid), total: Math.max(0, current.total - 1) });
    setSelectedUid(null);
    setMessage(null);
    setCompose(null);
    void loadFolders();
  };

  const act = async (action: ReaderAction) => {
    if (!message) return;
    const uid = message.uid;
    const q = `?folder=${encodeURIComponent(folder)}`;
    try {
      switch (action) {
        case "reply":
        case "reply_all":
        case "forward":
          startReply(action);
          return;
        case "star": {
          const flagged = !message.flagged;
          await gm(`/messages/${uid}`, token, { method: "PATCH", body: JSON.stringify({ folder, flagged }) });
          setMessage({ ...message, flagged });
          setList((current) => current && { ...current, messages: current.messages.map((m) => (m.uid === uid ? { ...m, flagged } : m)) });
          return;
        }
        case "unread":
          await gm(`/messages/${uid}`, token, { method: "PATCH", body: JSON.stringify({ folder, seen: false }) });
          setList((current) => current && { ...current, messages: current.messages.map((m) => (m.uid === uid ? { ...m, seen: false } : m)) });
          setSelectedUid(null);
          setMessage(null);
          void loadFolders();
          return;
        case "delete": {
          const result = await gm<{ message: string }>(`/messages/${uid}${q}`, token, { method: "DELETE" });
          afterRemoval(uid, result.message);
          return;
        }
        case "archive":
        case "spam":
        case "not_spam": {
          const toRole = action === "archive" ? "archive" : action === "spam" ? "junk" : "inbox";
          await gm(`/messages/${uid}/move`, token, { method: "POST", body: JSON.stringify({ folder, to_role: toRole }) });
          afterRemoval(uid, action === "archive" ? "Archived." : action === "spam" ? "Moved to Spam." : "Moved to Inbox.");
          return;
        }
      }
    } catch (error) {
      handleError(error);
      flash(error instanceof Error ? error.message : "That did not work.");
    }
  };

  const toggleStarInList = async (summary: MessageSummary) => {
    const flagged = !summary.flagged;
    setList((current) => current && { ...current, messages: current.messages.map((m) => (m.uid === summary.uid ? { ...m, flagged } : m)) });
    if (message?.uid === summary.uid) setMessage({ ...message, flagged });
    await gm(`/messages/${summary.uid}`, token, { method: "PATCH", body: JSON.stringify({ folder, flagged }) }).catch(handleError);
  };

  const signOut = async () => {
    await gm("/session", token, { method: "DELETE" }).catch(() => undefined);
    onSignedOut(null);
  };

  const systemFolders = folders.filter((f) => f.role && f.role !== "archive");
  const otherFolders = folders.filter((f) => !f.role || f.role === "archive");
  const inboxPath = pathOf("inbox") ?? "INBOX";
  const isStarredView = folder === inboxPath && filter === "flagged";
  const currentName = isStarredView ? "Starred" : folders.find((f) => f.path === folder)?.role ? ROLE_LABEL[roleOf(folder) as string] : folders.find((f) => f.path === folder)?.name ?? folder;
  const quota = me?.quota;
  const quotaPercent = quota && quota.limit_bytes > 0 ? Math.min(100, Math.round((quota.used_bytes / quota.limit_bytes) * 100)) : null;

  const folderButton = (key: string, label: string, Icon: React.ComponentType<{ className?: string }>, active: boolean, onClick: () => void, count?: number, highlight = false) => (
    <button
      key={key}
      type="button"
      title={collapsed ? label : undefined}
      onClick={onClick}
      className={`flex w-full items-center gap-3 rounded-lg px-3 py-2 text-[15px] transition ${active ? "bg-white/10 font-bold text-white shadow-[inset_3px_0_0_#22c55e]" : "text-white/80 hover:bg-white/5 hover:text-white"}`}
    >
      <Icon className="h-[18px] w-[18px] shrink-0" />
      {!collapsed && <span className="min-w-0 flex-1 truncate text-left">{label}</span>}
      {!collapsed && count ? (
        <span className={`rounded-md px-1.5 text-xs font-bold ${highlight ? "bg-white text-[#0f1a2b]" : "bg-white/10 text-white/80"}`}>{count}</span>
      ) : null}
    </button>
  );

  const sidebar = (
    <aside className={`flex h-full shrink-0 flex-col bg-[#0f1a2b] text-white ${collapsed ? "w-[72px]" : "w-[240px]"}`}>
      <div className="flex items-center justify-between px-4 py-4">
        {!collapsed && (
          <div className="flex items-center gap-2">
            <img src="/logo-96.png" alt="" width={64} height={24} className="h-7 w-auto" />
            <span className="text-xs font-semibold text-white/60">Webmail</span>
          </div>
        )}
        <button type="button" className="hidden rounded-md border border-white/15 p-1.5 text-white/70 hover:text-white lg:block" aria-label={collapsed ? "Expand sidebar" : "Collapse sidebar"} onClick={() => setCollapsed(!collapsed)}>
          {collapsed ? <ChevronsRight className="h-4 w-4" /> : <ChevronsLeft className="h-4 w-4" />}
        </button>
        <button type="button" className="rounded-md p-1.5 text-white/70 lg:hidden" aria-label="Close menu" onClick={() => setMobileNav(false)}>
          <X className="h-5 w-5" />
        </button>
      </div>
      <div className="px-3">
        <button type="button" onClick={() => { setMobileNav(false); newMessage(); }} className="flex w-full items-center justify-center gap-2 rounded-xl bg-[#22a04f] py-3 font-bold text-white hover:bg-[#1d8f46]">
          <Plus className="h-5 w-5" /> {!collapsed && "Compose"}
        </button>
      </div>
      <nav className="mt-4 grid gap-0.5 overflow-y-auto px-3" aria-label="Mail folders">
        {systemFolders.slice(0, 1).map((f) => folderButton(f.path, "Inbox", Inbox, folder === f.path && filter !== "flagged", () => openFolder(f.path), f.unread, true))}
        {folderButton("starred", "Starred", Star, isStarredView, () => openFolder(inboxPath, "flagged"))}
        {systemFolders.slice(1).map((f) =>
          folderButton(f.path, ROLE_LABEL[f.role as string], ROLE_ICON[f.role as string] ?? FolderIcon, folder === f.path, () => openFolder(f.path), f.role === "drafts" ? f.total : f.role === "junk" ? f.unread : undefined),
        )}
        {otherFolders.length > 0 && (
          <>
            {!collapsed && <p className="mt-5 px-3 pb-1 text-sm font-semibold text-white/60">Folders</p>}
            {otherFolders.map((f) => folderButton(f.path, f.role === "archive" ? "Archive" : f.name, f.role === "archive" ? Archive : FolderIcon, folder === f.path, () => openFolder(f.path), f.unread))}
          </>
        )}
      </nav>
      {quota && !collapsed && (
        <div className="mx-3 mb-3 mt-auto rounded-xl border border-white/10 p-3 text-xs text-white/70">
          <p className="font-semibold text-white/80">Storage</p>
          <div className="mt-2 h-1.5 overflow-hidden rounded-full bg-white/10">
            <div className={`h-full ${quotaPercent !== null && quotaPercent >= 90 ? "bg-red-400" : "bg-[#22c55e]"}`} style={{ width: `${quotaPercent ?? 0}%` }} />
          </div>
          <p className="mt-2 flex justify-between">
            <span>{formatBytes(quota.used_bytes)} of {formatBytes(quota.limit_bytes)} used</span>
            <span>{quotaPercent}%</span>
          </p>
        </div>
      )}
    </aside>
  );

  const listPane = (
    <section className={`flex min-h-0 flex-col border-r border-slate-200 bg-white ${selectedUid || compose ? "hidden md:flex" : "flex"} w-full md:w-[340px] xl:w-[380px] md:shrink-0`}>
      <div className="flex items-center gap-1 border-b border-slate-200 px-3 pt-2">
        {(["all", "unread", "flagged", "attachments"] as Filter[]).map((option) => (
          <button
            key={option}
            type="button"
            onClick={() => { setFilter(option); setPage(1); }}
            className={`border-b-2 px-2.5 pb-2 pt-1 text-sm ${filter === option ? "border-[#22a04f] font-bold text-slate-900" : "border-transparent text-slate-600 hover:text-slate-900"}`}
          >
            {option === "all" ? "All" : option === "unread" ? "Unread" : option === "flagged" ? "Flagged" : "Attachments"}
          </button>
        ))}
        <button type="button" aria-label="Refresh" title="Refresh" className="ml-auto rounded p-1.5 text-slate-500 hover:bg-slate-100" onClick={() => { void loadFolders(); void loadList(); }}>
          <RefreshCw className={`h-4 w-4 ${isLoadingList ? "animate-spin" : ""}`} />
        </button>
      </div>
      <p className="px-4 pb-1 pt-2 text-xs font-semibold uppercase tracking-wide text-slate-400">{currentName}{search ? ` · “${search}”` : ""}</p>
      <ul className="min-h-0 flex-1 overflow-y-auto">
        {isLoadingList && !list && (
          <li className="flex justify-center py-10 text-slate-400"><Loader2 className="h-5 w-5 animate-spin" /></li>
        )}
        {list && list.messages.length === 0 && <li className="px-4 py-10 text-center text-sm text-slate-500">{search ? "No messages match your search." : "Nothing here."}</li>}
        {list?.messages.map((summary) => {
          const person = roleOf(folder) === "sent" || roleOf(folder) === "drafts" ? summary.to[0] ?? summary.from : summary.from;
          const active = summary.uid === selectedUid;
          return (
            <li key={summary.uid} className={`border-b border-slate-100 ${active ? "bg-[#e9f6ee]" : summary.seen ? "bg-white" : "bg-[#f7fbf8]"}`}>
              <div className="flex gap-3 px-4 py-3">
                <button type="button" className="flex min-w-0 flex-1 gap-3 text-left" onClick={() => void openMessage(summary)}>
                  <Avatar address={person} size={40} />
                  <span className="min-w-0 flex-1">
                    <span className="flex items-baseline gap-2">
                      <span className={`min-w-0 flex-1 truncate text-[15px] ${summary.seen ? "text-slate-700" : "font-bold text-slate-900"}`}>{displayName(person)}</span>
                      <span className="shrink-0 text-xs text-slate-500">{listDate(summary.date)}</span>
                    </span>
                    <span className={`flex items-center gap-1.5 truncate text-sm ${summary.seen ? "text-slate-600" : "font-semibold text-slate-800"}`}>
                      <span className="truncate">{summary.subject}</span>
                      {summary.has_attachments && <Paperclip className="h-3.5 w-3.5 shrink-0 text-slate-400" />}
                    </span>
                    <span className="block truncate text-sm text-slate-500">{summary.snippet}</span>
                  </span>
                </button>
                <button type="button" aria-label={summary.flagged ? "Unstar" : "Star"} aria-pressed={summary.flagged} className="self-end rounded p-1 hover:bg-slate-100" onClick={() => void toggleStarInList(summary)}>
                  <Star className={`h-4 w-4 ${summary.flagged ? "fill-amber-400 text-amber-400" : "text-slate-300"}`} />
                </button>
              </div>
            </li>
          );
        })}
      </ul>
      {list && list.last_page > 1 && (
        <div className="flex items-center justify-center gap-3 border-t border-slate-200 py-2 text-sm text-slate-600">
          <button type="button" aria-label="Previous page" disabled={page <= 1} className="rounded p-1 hover:bg-slate-100 disabled:opacity-30" onClick={() => setPage(page - 1)}>
            <ChevronLeft className="h-4 w-4" />
          </button>
          Page {list.page} of {list.last_page}
          <button type="button" aria-label="Next page" disabled={page >= list.last_page} className="rounded p-1 hover:bg-slate-100 disabled:opacity-30" onClick={() => setPage(page + 1)}>
            <ChevronRight className="h-4 w-4" />
          </button>
        </div>
      )}
    </section>
  );

  const isWindowCompose = compose?.variant === "window";
  const readerPane = (
    <section className={`min-h-0 min-w-0 flex-1 flex-col bg-white ${selectedUid || compose ? "flex" : "hidden md:flex"}`}>
      {(selectedUid || compose) && (
        <button type="button" className="flex items-center gap-1.5 border-b border-slate-200 px-4 py-2 text-sm font-semibold text-slate-600 md:hidden" onClick={() => { setSelectedUid(null); setMessage(null); setCompose(null); }}>
          <ArrowLeft className="h-4 w-4" /> {currentName}
        </button>
      )}
      {isWindowCompose && compose ? (
        <div className="flex min-h-0 flex-1 flex-col">
          <div className="flex items-center justify-between border-b border-slate-200 px-4 py-3">
            <h2 className="text-lg font-black text-slate-900">New message</h2>
            <button type="button" aria-label="Close" className="rounded p-1 text-slate-500 hover:bg-slate-100" onClick={() => setCompose(null)}>
              <X className="h-5 w-5" />
            </button>
          </div>
          <React.Fragment key={compose.key}>
            <Composer
              token={token}
              draft={compose.draft}
              variant="window"
              onSessionError={handleError}
              onClose={() => setCompose(null)}
              onSent={(text) => { flash(text); setCompose(null); void loadFolders(); if (roleOf(folder) === "sent" || roleOf(folder) === "drafts") void loadList(true); }}
              />
          </React.Fragment>
        </div>
      ) : (
        <MessageReader message={message} token={token} folder={folder} isJunk={roleOf(folder) === "junk"} isLoading={isLoadingMessage} onAction={(action) => void act(action)}>
          {compose && compose.variant === "inline" && message && (
            <div className="mx-4 mb-6 overflow-hidden rounded-xl border border-slate-200 shadow-sm">
              <div className="flex items-center justify-between border-b border-slate-200 bg-slate-50 px-4 py-2">
                <p className="flex items-center gap-2 text-sm font-bold text-slate-800"><Pencil className="h-4 w-4" /> Quick Reply</p>
                <button type="button" aria-label="Close reply" className="rounded p-1 text-slate-500 hover:bg-slate-200" onClick={() => setCompose(null)}>
                  <X className="h-4 w-4" />
                </button>
              </div>
              <React.Fragment key={compose.key}>
                <Composer
                  token={token}
                  draft={compose.draft}
                  variant="inline"
                  onSessionError={handleError}
                  onClose={() => setCompose(null)}
                  onSent={(text) => { flash(text); setCompose(null); setMessage({ ...message, answered: true }); void loadFolders(); }}
                  />
              </React.Fragment>
            </div>
          )}
        </MessageReader>
      )}
    </section>
  );

  return (
    <div className="flex h-[100dvh] overflow-hidden bg-[#f3f5f7] font-body text-slate-900">
      <div className="hidden lg:flex">{sidebar}</div>
      {mobileNav && (
        <div className="fixed inset-0 z-40 flex lg:hidden">
          {sidebar}
          <button type="button" aria-label="Close menu" className="flex-1 bg-slate-900/40" onClick={() => setMobileNav(false)} />
        </div>
      )}

      <div className="flex min-w-0 flex-1 flex-col">
        <header className="flex items-center gap-3 border-b border-slate-200 bg-white px-3 py-2.5 sm:px-4">
          <button type="button" className="rounded-md p-2 text-slate-600 hover:bg-slate-100 lg:hidden" aria-label="Open menu" onClick={() => setMobileNav(true)}>
            <Inbox className="h-5 w-5" />
          </button>
          <form
            className="flex min-w-0 flex-1 items-center gap-2 rounded-lg bg-slate-100 px-3 py-2 lg:max-w-[640px]"
            onSubmit={(event) => {
              event.preventDefault();
              setSearch(searchInput.trim());
              setPage(1);
              setSelectedUid(null);
              setMessage(null);
            }}
            role="search"
          >
            <Search className="h-4 w-4 shrink-0 text-slate-500" />
            <input value={searchInput} onChange={(event) => setSearchInput(event.target.value)} placeholder={`Search ${currentName}`} aria-label="Search mail" className="min-w-0 flex-1 bg-transparent text-sm outline-none" />
            {search && (
              <button type="button" aria-label="Clear search" className="text-slate-500" onClick={() => { setSearch(""); setSearchInput(""); setPage(1); }}>
                <X className="h-4 w-4" />
              </button>
            )}
          </form>
          <button
            type="button"
            className={`inline-flex items-center gap-2 rounded-lg px-2.5 py-2 text-sm font-bold sm:px-3 ${showSidePanel ? "bg-[#1f9d4c] text-white" : "border border-slate-200 text-slate-700"}`}
            onClick={() => setShowSidePanel(!showSidePanel)}
            aria-pressed={showSidePanel}
          >
            <Bot className="h-4 w-4" /> <span className="hidden sm:inline">AI Assistant</span>
          </button>
          <button type="button" aria-label="Settings" title="Settings" className="rounded-lg p-2 text-slate-600 hover:bg-slate-100" onClick={() => setShowSettings(true)}>
            <Settings className="h-5 w-5" />
          </button>
          <div className="hidden items-center gap-2 border-l border-slate-200 pl-3 md:flex">
            <Avatar address={{ name: me?.display_name ?? null, email: myEmail || "?" }} size={34} />
            <div className="hidden text-right leading-tight xl:block">
              <p className="text-sm font-bold text-slate-900">{me?.display_name || myEmail.split("@")[0]}</p>
              <p className="text-xs text-slate-500">{myEmail}</p>
            </div>
          </div>
          <button type="button" aria-label="Sign out" title="Sign out" className="rounded-lg p-2 text-slate-600 hover:bg-slate-100" onClick={() => void signOut()}>
            <LogOut className="h-5 w-5" />
          </button>
        </header>

        <div className="flex min-h-0 flex-1">
          {listPane}
          {readerPane}
          {showSidePanel && (
            <aside className="fixed inset-y-0 right-0 z-40 flex w-[min(340px,100vw)] flex-col border-l border-slate-200 bg-[#f6f8f7] shadow-2xl 2xl:static 2xl:z-auto 2xl:w-[330px] 2xl:shrink-0 2xl:shadow-none">
              <button type="button" aria-label="Close assistant panel" className="self-end p-2 text-slate-500 hover:text-slate-800 2xl:hidden" onClick={() => setShowSidePanel(false)}>
                <X className="h-5 w-5" />
              </button>
              <SidePanel
                token={token}
                message={message}
                folder={folder}
                onSessionError={handleError}
                onUseDraft={(text) => startReply("reply", text)}
                onWriteTo={(email) => newMessage(email)}
              />
            </aside>
          )}
        </div>
      </div>

      {!selectedUid && !compose && (
        <button
          type="button"
          aria-label="Compose"
          onClick={() => newMessage()}
          className="fixed bottom-16 right-5 z-30 flex h-14 w-14 items-center justify-center rounded-full bg-[#22a04f] text-white shadow-lg md:hidden"
        >
          <Plus className="h-6 w-6" />
        </button>
      )}

      {showSettings && me && <SettingsModal token={token} me={me} onSaved={setMe} onClose={() => setShowSettings(false)} />}

      {toast && (
        <div role="status" className="fixed bottom-5 left-1/2 z-50 -translate-x-1/2 rounded-lg bg-slate-900 px-4 py-2.5 text-sm text-white shadow-lg">
          {toast}
        </div>
      )}
    </div>
  );
}
