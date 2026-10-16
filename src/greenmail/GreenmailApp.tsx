import React, { useCallback, useEffect, useMemo, useRef, useState } from "react";
import {
  Archive,
  ArrowLeft,
  Bot,
  CalendarDays,
  ChevronLeft,
  ChevronRight,
  ChevronsLeft,
  ChevronsRight,
  Download,
  FileText,
  Filter as FilterIcon,
  Folder as FolderIcon,
  Inbox,
  Loader2,
  ListTodo,
  Mail,
  MailOpen,
  Megaphone,
  Menu,
  OctagonAlert,
  Paperclip,
  Plus,
  RefreshCw,
  Search,
  Send,
  Settings,
  Star,
  StickyNote,
  Trash2,
  Workflow,
  X,
} from "lucide-react";
import { AccountMenu, useOtherAccounts } from "./Accounts";
import { clearToken, gm, readAccounts, readToken, rememberAccountEmail, SessionExpired, setActiveToken, type StoredAccount, type Folder, type FullMessage, type Me, type MessageSummary, type Template } from "./api";
import { CampaignsView } from "./CampaignsView";
import { Composer, type ComposeDraft } from "./Composer";
import { FeedbackProvider, useFeedback } from "./feedback";
import { InstallHelp } from "./InstallHelp";
import { LoginScreen } from "./LoginScreen";
import { currentDomain, useGreenmailAppShell, useInstall } from "./pwa";
import { MessageReader, type ReaderAction } from "./MessageReader";
import { NotesView } from "./NotesView";
import { AutomationView, FiltersView } from "./RulesView";
import { SettingsModal } from "./SettingsModal";
import { CalendarView } from "./CalendarView";
import { SidePanel } from "./SidePanel";
import { TasksView } from "./TasksView";
import { TemplatesView } from "./TemplatesView";
import { Avatar, Brand, displayName, escapeHtml, formatBytes, fullDate, listDate, withoutRemoteImages } from "./ui";

type Filter = "all" | "unread" | "flagged" | "attachments";
type ListPage = { messages: MessageSummary[]; total: number; page: number; last_page: number };
type Compose = { draft: ComposeDraft; variant: "inline" | "window"; key: number };
type View = "mail" | "calendar" | "tasks" | "notes" | "templates" | "campaigns" | "filters" | "automation";

/** How often Green Mail looks for new mail while it's open. */
const NEW_MAIL_CHECK_MS = 30000;

const ROLE_ICON: Record<string, React.ComponentType<{ className?: string }>> = {
  inbox: Inbox,
  sent: Send,
  drafts: FileText,
  junk: OctagonAlert,
  trash: Trash2,
  archive: Archive,
};

const TOOLS: Array<[Exclude<View, "mail">, string, React.ComponentType<{ className?: string }>]> = [
  ["calendar", "Calendar", CalendarDays],
  ["tasks", "Tasks", ListTodo],
  ["notes", "Notes", StickyNote],
  ["templates", "Templates", FileText],
  ["campaigns", "Campaigns", Megaphone],
  ["filters", "Filters", FilterIcon],
  ["automation", "Automation", Workflow],
];

const ROLE_LABEL: Record<string, string> = { inbox: "Inbox", sent: "Sent", drafts: "Drafts", junk: "Spam", trash: "Trash", archive: "Archive" };

/** Greenmail — NAI TALK's webmail (www.naitalk.com/greenmail). */
export function GreenmailApp() {
  const [token, setToken] = useState(readToken);
  const [notice, setNotice] = useState<string | null>(null);
  // Which website this Green Mail belongs to (from yourdomain.com/greenmail, or remembered).
  const [domain] = useState(currentDomain);
  const installer = useInstall();
  const [showInstallHelp, setShowInstallHelp] = useState(false);
  useGreenmailAppShell(domain);

  const install = () => void installer.install().then((result) => result === "ios" && setShowInstallHelp(true));
  const installHelp = showInstallHelp && <InstallHelp onClose={() => setShowInstallHelp(false)} />;

  useEffect(() => {
    document.title = "Green Mail";
    const robots = document.createElement("meta");
    robots.name = "robots";
    robots.content = "noindex, nofollow";
    document.head.appendChild(robots);
    return () => robots.remove();
  }, []);

  return (
    <FeedbackProvider>
      <AccountsShell domain={domain} onInstall={installer.canInstall ? install : null} />
      {installHelp}
    </FeedbackProvider>
  );
}

/**
 * Which mailbox is on screen. Several can be signed in on this device;
 * switching swaps the token (the mailbox view reloads for that account),
 * signing out of one moves to the next, and the sign-in screen only shows
 * when none are left — or when adding another account.
 */
function AccountsShell({ domain, onInstall }: { domain: string; onInstall: (() => void) | null }) {
  const [accounts, setAccounts] = useState<StoredAccount[]>(readAccounts);
  const [token, setToken] = useState(readToken);
  const [notice, setNotice] = useState<string | null>(null);
  const [adding, setAdding] = useState(false);
  const { toast } = useFeedback();

  const refresh = useCallback(() => setAccounts(readAccounts()), []);

  const switchTo = useCallback(
    (next: string, message?: string) => {
      setActiveToken(next);
      setToken(next);
      setAdding(false);
      refresh();
      const account = readAccounts().find((a) => a.token === next);
      toast(message ?? `Switched to ${account?.email || "your other account"}.`, "info");
    },
    [refresh, toast],
  );

  /** Forget one account here; move to the next if there is one. */
  const leave = useCallback(
    (gone: string, message: string | null) => {
      const goneEmail = readAccounts().find((a) => a.token === gone)?.email;
      clearToken(gone);
      const rest = readAccounts();
      refresh();
      if (gone !== token) {
        if (message) toast(message, "info");
        return;
      }
      if (rest.length > 0) {
        switchTo(rest[0].token, message ?? `Signed out of ${goneEmail || "that account"}. Now showing ${rest[0].email || "your other account"}.`);
      } else {
        setNotice(message);
        setToken("");
      }
    },
    [token, refresh, switchTo, toast],
  );

  const others = accounts.filter((a) => a.token !== token);
  const otherUnread = useOtherAccounts(others, (next) => switchTo(next), (account) => leave(account.token, `${account.email || "An account"} was signed out (its session ended). Add it again from the account menu.`));

  const signOutAll = async () => {
    await Promise.all(readAccounts().map((a) => gm("/session", a.token, { method: "DELETE" }).catch(() => undefined)));
    readAccounts().forEach((a) => clearToken(a.token));
    refresh();
    setNotice("You've signed out of all accounts.");
    setToken("");
  };

  if (!token || adding) {
    return (
      <LoginScreen
        notice={adding ? null : notice}
        domain={domain}
        onInstall={onInstall}
        onCancel={adding && token ? () => setAdding(false) : undefined}
        signedInEmails={accounts.map((a) => a.email)}
        onSignedIn={(newToken) => {
          setNotice(null);
          setAdding(false);
          refresh();
          setToken(newToken);
          if (token) toast(`Added ${readAccounts().find((a) => a.token === newToken)?.email || "the account"}. Switch accounts from the menu at the top right.`);
        }}
      />
    );
  }

  // Keyed by token: switching accounts starts the mailbox view afresh.
  return (
    <React.Fragment key={token}>
    <Mailbox
      token={token}
      onInstall={onInstall}
      accounts={accounts}
      otherUnread={otherUnread}
      onIdentified={(email) => {
        rememberAccountEmail(token, email);
        refresh();
      }}
      onSwitch={(next) => switchTo(next)}
      onAddAccount={() => setAdding(true)}
      onSignOutAll={() => void signOutAll()}
      onSignedOut={(message) => leave(token, message)}
    />
    </React.Fragment>
  );
}

function Mailbox({
  token,
  onSignedOut,
  onInstall,
  accounts,
  otherUnread,
  onIdentified,
  onSwitch,
  onAddAccount,
  onSignOutAll,
}: {
  token: string;
  onSignedOut: (message: string | null) => void;
  onInstall: (() => void) | null;
  accounts: StoredAccount[];
  otherUnread: Record<string, number>;
  onIdentified: (email: string) => void;
  onSwitch: (token: string) => void;
  onAddAccount: () => void;
  onSignOutAll: () => void;
}) {
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
  const [starredCount, setStarredCount] = useState(0);
  const [selected, setSelected] = useState<Set<number>>(new Set());
  const [mobileNav, setMobileNav] = useState(false);
  const [view, setView] = useState<View>("mail");
  const { toast, confirm } = useFeedback();

  const handleError = useCallback(
    (error: unknown) => {
      if (error instanceof SessionExpired) onSignedOut(error.message);
    },
    [onSignedOut],
  );

  const flash = useCallback((text: string, tone: "success" | "error" = "success") => toast(text, tone), [toast]);

  const loadFolders = useCallback(
    () =>
      gm<{ folders: Folder[]; starred: number }>("/folders", token)
        .then((response) => {
          setFolders(response.folders);
          setStarredCount(response.starred ?? 0);
        })
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
          if (!quiet) flash(error instanceof Error ? error.message : "Could not load messages.", "error");
        })
        .finally(() => setIsLoadingList(false));
    },
    [token, folder, page, filter, search, handleError],
  );

  useEffect(() => {
    gm<Me>("/session", token)
      .then((who) => {
        setMe(who);
        onIdentified(who.email);
      })
      .catch(handleError);
    void loadFolders();
  }, [token, loadFolders, handleError]);

  useEffect(() => {
    void loadList();
    setSelected(new Set());
  }, [loadList]);

  // Changes show without reloading: the list and counts refresh quietly every
  // 30 seconds, when the tab comes back into view, and after every action.
  const refresh = useCallback(() => {
    void loadFolders();
    void loadList(true);
  }, [loadFolders, loadList]);

  const refreshRef = useRef(refresh);
  refreshRef.current = refresh;

  // "You have new mail": watch the Inbox for messages newer than the newest seen so far.
  const newestUid = useRef(0);
  const openFromNoticeRef = useRef<(folderPath: string, uid: number) => void>(() => undefined);
  useEffect(() => {
    let stopped = false;
    const check = async () => {
      if (stopped) return;
      try {
        const result = await gm<{ folder: string; latest_uid: number; new: Array<{ uid: number; subject: string; from: { name: string | null; email: string } }> }>(`/check?since=${newestUid.current}`, token);
        const isFirstCheck = newestUid.current === 0;
        newestUid.current = Math.max(newestUid.current, result.latest_uid);
        if (isFirstCheck || result.new.length === 0) return;

        const [latest] = result.new;
        const sender = latest.from.name || latest.from.email;
        if (result.new.length === 1) {
          toast(`New email from ${sender}: ${latest.subject}`, "info", { label: "Open", run: () => openFromNoticeRef.current(result.folder, latest.uid) });
        } else {
          toast(`You have ${result.new.length} new emails — the latest from ${sender}.`, "info", { label: "View", run: () => openFromNoticeRef.current(result.folder, 0) });
        }
        refreshRef.current();
      } catch (error) {
        handleError(error);
      }
    };

    void check();
    const timer = window.setInterval(() => {
      void check();
      refreshRef.current();
    }, NEW_MAIL_CHECK_MS);
    const onVisible = () => {
      if (document.visibilityState === "visible") {
        void check();
        refreshRef.current();
      }
    };
    document.addEventListener("visibilitychange", onVisible);
    window.addEventListener("focus", onVisible);
    return () => {
      stopped = true;
      window.clearInterval(timer);
      document.removeEventListener("visibilitychange", onVisible);
      window.removeEventListener("focus", onVisible);
    };
  }, [token, toast, handleError]);

  // Unread count in the tab title, and on the installed app's icon where supported.
  const inboxUnread = folders.find((f) => f.role === "inbox")?.unread ?? 0;
  useEffect(() => {
    document.title = inboxUnread > 0 ? `(${inboxUnread}) Green Mail` : "Green Mail";
    const nav = navigator as Navigator & { setAppBadge?: (n?: number) => Promise<void>; clearAppBadge?: () => Promise<void> };
    if (inboxUnread > 0) void nav.setAppBadge?.(inboxUnread).catch(() => undefined);
    else void nav.clearAppBadge?.().catch(() => undefined);
  }, [inboxUnread]);

  const roleOf = (path: string) => folders.find((f) => f.path === path)?.role ?? null;
  const pathOf = (role: string) => folders.find((f) => f.role === role)?.path ?? null;

  const openFolder = (path: string, nextFilter: Filter = "all") => {
    setView("mail");
    setFolder(path);
    setFilter(nextFilter);
    setPage(1);
    setSelectedUid(null);
    setMessage(null);
    setCompose(null);
    setMobileNav(false);
  };

  openFromNoticeRef.current = (folderPath: string, uid: number) => {
    openFolder(folderPath);
    if (!uid) return;
    setSelectedUid(uid);
    setIsLoadingMessage(true);
    gm<FullMessage>(`/messages/${uid}?folder=${encodeURIComponent(folderPath)}`, token)
      .then((full) => {
        setMessage(full);
        setList((current) => current && { ...current, messages: current.messages.map((m) => (m.uid === uid ? { ...m, seen: true } : m)) });
        void loadFolders();
      })
      .catch((error) => {
        handleError(error);
        setSelectedUid(null);
      })
      .finally(() => setIsLoadingMessage(false));
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
      flash(error instanceof Error ? error.message : "Could not open that message.", "error");
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
    const subjectBase = message.subject === "(no subject)" ? "" : message.subject;
    // Where to start typing: the composer puts the cursor here and shows a hint until something is typed.
    const startHere = `<p class="gm-start" data-placeholder="${mode === "forward" ? "Add a message (optional)…" : "Type your reply here…"}"><br></p>`;
    const intro = bodyText ? bodyText.split(/\n{2,}/).map((p) => `<p>${escapeHtml(p).replace(/\n/g, "<br>")}</p>`).join("") : startHere;
    const original = withoutRemoteImages(message.html);

    if (mode === "forward") {
      setCompose({
        variant: "inline",
        key: Date.now(),
        draft: {
          to: "",
          cc: "",
          bcc: "",
          subject: /^fwd?:/i.test(subjectBase) ? subjectBase : `Fwd: ${subjectBase}`,
          bodyHtml: `${intro}${signature}`,
          forward: { folder, uid: message.uid, attachments: message.attachments },
          quoteHtml: `<div>---------- Forwarded message ----------<br>From: ${escapeHtml(displayName(message.from))} &lt;${escapeHtml(message.from.email)}&gt;<br>Date: ${escapeHtml(fullDate(message.date))}<br>Subject: ${escapeHtml(message.subject)}</div><br>${original}`,
        },
      });
      return;
    }

    const replyTo = message.reply_to[0] ?? message.from;
    const everyone = mode === "reply_all" ? [...message.to, ...message.cc].filter((a) => a.email !== myEmail && a.email !== replyTo.email) : [];
    const uniqueOthers = [...new Map(everyone.map((a) => [a.email, a])).values()];

    setCompose({
      variant: "inline",
      key: Date.now(),
      draft: {
        to: replyTo.email,
        cc: uniqueOthers.map((a) => a.email).join(", "),
        bcc: "",
        subject: /^re:/i.test(subjectBase) ? subjectBase : `Re: ${subjectBase}`,
        bodyHtml: `${intro}${signature}`,
        quoteHtml: `<div>On ${escapeHtml(fullDate(message.date))}, ${escapeHtml(displayName(message.from))} wrote:</div><blockquote>${original}</blockquote>`,
        replyingTo: displayName(replyTo) + (uniqueOthers.length ? ` +${uniqueOthers.length}` : ""),
        inReplyTo: message.message_id || undefined,
        references: message.references || undefined,
        replyUid: message.uid,
        replyFolder: folder,
      },
    });
  };

  const newMessage = (to = "", template?: Template) => {
    setView("mail");
    setSelectedUid(null);
    setMessage(null);
    setCompose({ variant: "window", key: Date.now(), draft: { to, cc: "", bcc: "", subject: template?.subject ?? "", bodyHtml: `${template?.body_html ?? '<p class="gm-start" data-placeholder="Write your message…"><br></p>'}${signature}` } });
  };

  const afterRemoval = (uid: number, text: string) => {
    flash(text);
    setList((current) => current && { ...current, messages: current.messages.filter((m) => m.uid !== uid), total: Math.max(0, current.total - 1) });
    setSelected((current) => {
      const next = new Set(current);
      next.delete(uid);
      return next;
    });
    setSelectedUid(null);
    setMessage(null);
    setCompose(null);
    // Then confirm with the server, so the list and counts match without a reload.
    refresh();
  };

  const isTrash = (path: string) => roleOf(path) === "trash";

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
          setMessage({ ...message, flagged });
          setList((current) => current && { ...current, messages: current.messages.map((m) => (m.uid === uid ? { ...m, flagged } : m)) });
          await gm(`/messages/${uid}`, token, { method: "PATCH", body: JSON.stringify({ folder, flagged }) });
          flash(flagged ? "Starred." : "Star removed.");
          void loadFolders();
          return;
        }
        case "unread":
          await gm(`/messages/${uid}`, token, { method: "PATCH", body: JSON.stringify({ folder, seen: false }) });
          setList((current) => current && { ...current, messages: current.messages.map((m) => (m.uid === uid ? { ...m, seen: false } : m)) });
          setSelectedUid(null);
          setMessage(null);
          flash("Marked as unread.");
          void loadFolders();
          return;
        case "delete": {
          const forGood = isTrash(folder);
          const ok = await confirm({
            title: forGood ? "Delete this email for good?" : "Delete this email?",
            message: forGood ? `“${message.subject}” will be removed permanently. This can't be undone.` : `“${message.subject}” will be moved to Trash.`,
            confirmLabel: forGood ? "Delete for good" : "Delete",
            danger: true,
          });
          if (!ok) return;
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
      flash(error instanceof Error ? error.message : "That did not work.", "error");
    }
  };

  const toggleStarInList = async (summary: MessageSummary) => {
    const flagged = !summary.flagged;
    setList((current) => current && { ...current, messages: current.messages.map((m) => (m.uid === summary.uid ? { ...m, flagged } : m)) });
    if (message?.uid === summary.uid) setMessage({ ...message, flagged });
    try {
      await gm(`/messages/${summary.uid}`, token, { method: "PATCH", body: JSON.stringify({ folder, flagged }) });
      flash(flagged ? "Starred." : "Star removed.");
    } catch (error) {
      handleError(error);
      flash(error instanceof Error ? error.message : "That did not work.", "error");
    }
    void loadFolders();
    if (filter === "flagged") void loadList(true);
  };

  const pageUids = list?.messages.map((m) => m.uid) ?? [];
  const allSelected = pageUids.length > 0 && pageUids.every((uid) => selected.has(uid));

  const toggleSelected = (uid: number) =>
    setSelected((current) => {
      const next = new Set(current);
      if (next.has(uid)) next.delete(uid);
      else next.add(uid);
      return next;
    });

  const bulk = async (action: "delete" | "archive" | "spam" | "not_spam" | "read" | "unread") => {
    const uids = [...selected];
    if (uids.length === 0) return;
    if (action === "delete") {
      const forGood = isTrash(folder);
      const noun = uids.length === 1 ? "this email" : `these ${uids.length} emails`;
      const ok = await confirm({
        title: forGood ? `Delete ${noun} for good?` : `Delete ${noun}?`,
        message: forGood ? "They will be removed permanently. This can't be undone." : "They will be moved to Trash.",
        confirmLabel: forGood ? "Delete for good" : "Delete",
        danger: true,
      });
      if (!ok) return;
    }
    // Feels instant: take them off the page now; the refresh below confirms.
    if (action !== "read" && action !== "unread") {
      setList((current) => current && { ...current, messages: current.messages.filter((m) => !uids.includes(m.uid)), total: Math.max(0, current.total - uids.length) });
    } else {
      setList((current) => current && { ...current, messages: current.messages.map((m) => (uids.includes(m.uid) ? { ...m, seen: action === "read" } : m)) });
    }
    try {
      const result = await gm<{ message: string }>("/messages/bulk", token, { method: "POST", body: JSON.stringify({ folder, uids, action }) });
      flash(result.message);
      setSelected(new Set());
      if (message && uids.includes(message.uid) && action !== "read" && action !== "unread") {
        setSelectedUid(null);
        setMessage(null);
      }
      void loadFolders();
      void loadList(true);
    } catch (error) {
      handleError(error);
      flash(error instanceof Error ? error.message : "That did not work.", "error");
    }
  };

  const emptyFolder = async () => {
    const label = roleOf(folder) === "junk" ? "Spam" : "Trash";
    const ok = await confirm({ title: `Empty ${label}?`, message: `Everything in ${label} (${list?.total ?? 0}) will be deleted for good, on the server too. This can't be undone.`, confirmLabel: `Empty ${label}`, danger: true });
    if (!ok) return;
    try {
      const result = await gm<{ message: string }>("/folders/empty", token, { method: "POST", body: JSON.stringify({ folder }) });
      flash(result.message);
      setSelectedUid(null);
      setMessage(null);
      void loadFolders();
      void loadList();
    } catch (error) {
      handleError(error);
      flash(error instanceof Error ? error.message : `Could not empty ${label}.`, "error");
    }
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
      className={`flex w-full items-center gap-3 rounded-lg px-3 py-2 text-[15px] transition ${active && (view === "mail" || key.startsWith("tool-")) ? "bg-white/10 font-bold text-white shadow-[inset_3px_0_0_#22c55e]" : "text-white/80 hover:bg-white/5 hover:text-white"}`}
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
        <Brand onDark compact={collapsed} />
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
        {folderButton("starred", "Starred", Star, isStarredView, () => openFolder(inboxPath, "flagged"), starredCount, true)}
        {systemFolders.slice(1).map((f) =>
          folderButton(f.path, ROLE_LABEL[f.role as string], ROLE_ICON[f.role as string] ?? FolderIcon, folder === f.path, () => openFolder(f.path), f.role === "drafts" ? f.total : f.role === "junk" ? f.unread : undefined),
        )}
        {otherFolders.length > 0 && (
          <>
            {!collapsed && <p className="mt-5 px-3 pb-1 text-sm font-semibold text-white/60">Folders</p>}
            {otherFolders.map((f) => folderButton(f.path, f.role === "archive" ? "Archive" : f.name, f.role === "archive" ? Archive : FolderIcon, folder === f.path, () => openFolder(f.path), f.unread))}
          </>
        )}
        {!collapsed && <p className="mt-5 px-3 pb-1 text-sm font-semibold text-white/60">Tools</p>}
        {TOOLS.map(([key, label, Icon]) => folderButton(`tool-${key}`, label, Icon, view === key, () => { setView(key); setMobileNav(false); }))}
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
      {selected.size > 0 ? (
        <div className="flex items-center gap-1 border-b border-slate-200 bg-[#eef8f1] px-3 py-2">
          <input type="checkbox" aria-label="Select all on this page" className="h-4 w-4 accent-[#1f9d4c]" checked={allSelected} onChange={() => setSelected(allSelected ? new Set() : new Set(pageUids))} />
          <span className="mx-2 text-sm font-bold text-slate-800">{selected.size} selected</span>
          <div className="ml-auto flex items-center gap-0.5">
            {([
              ["delete", "Delete", Trash2],
              ["archive", "Archive", Archive],
              roleOf(folder) === "junk" ? ["not_spam", "Not spam", Inbox] : ["spam", "Spam", OctagonAlert],
              ["read", "Mark read", MailOpen],
              ["unread", "Mark unread", Mail],
            ] as Array<["delete" | "archive" | "spam" | "not_spam" | "read" | "unread", string, React.ComponentType<{ className?: string }>]>).map(([action, label, Icon]) => (
              <button key={action} type="button" title={label} aria-label={label} className="rounded-md p-2 text-slate-700 hover:bg-white" onClick={() => void bulk(action)}>
                <Icon className="h-4 w-4" />
              </button>
            ))}
            <button type="button" title="Clear selection" aria-label="Clear selection" className="rounded-md p-2 text-slate-500 hover:bg-white" onClick={() => setSelected(new Set())}>
              <X className="h-4 w-4" />
            </button>
          </div>
        </div>
      ) : (
        <div className="flex items-center gap-1 border-b border-slate-200 px-3 pt-2">
          <input
            type="checkbox"
            aria-label="Select all on this page"
            className="mb-2 mr-1 h-4 w-4 accent-[#1f9d4c]"
            checked={false}
            disabled={pageUids.length === 0}
            onChange={() => setSelected(new Set(pageUids))}
          />
          {(["all", "unread", "flagged", "attachments"] as Filter[]).map((option) => (
            <button
              key={option}
              type="button"
              onClick={() => { setFilter(option); setPage(1); }}
              className={`whitespace-nowrap border-b-2 px-2 pb-2 pt-1 text-sm ${filter === option ? "border-[#22a04f] font-bold text-slate-900" : "border-transparent text-slate-600 hover:text-slate-900"}`}
            >
              {option === "all" ? "All" : option === "unread" ? "Unread" : option === "flagged" ? "Flagged" : "Attachments"}
            </button>
          ))}
          <button type="button" aria-label="Refresh" title="Refresh" className="mb-1 ml-auto rounded p-1.5 text-slate-500 hover:bg-slate-100" onClick={() => { void loadFolders(); void loadList(); }}>
            <RefreshCw className={`h-4 w-4 ${isLoadingList ? "animate-spin" : ""}`} />
          </button>
        </div>
      )}
      {(roleOf(folder) === "junk" || roleOf(folder) === "trash") && (list?.total ?? 0) > 0 && (
        <div className="flex items-center justify-between gap-2 border-b border-slate-100 bg-slate-50 px-4 py-2 text-xs text-slate-600">
          <span>{roleOf(folder) === "junk" ? "Spam" : "Trash"}: {list?.total} message{list?.total === 1 ? "" : "s"}</span>
          <button type="button" className="rounded-md border border-red-200 bg-white px-3 py-1 font-bold text-red-600 hover:bg-red-50" onClick={() => void emptyFolder()}>
            Empty {roleOf(folder) === "junk" ? "Spam" : "Trash"}
          </button>
        </div>
      )}
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
            <li key={summary.uid} className={`border-b border-slate-100 ${selected.has(summary.uid) ? "bg-[#eef8f1]" : active ? "bg-[#e9f6ee]" : summary.seen ? "bg-white" : "bg-[#f7fbf8]"}`}>
              <div className="flex gap-2.5 px-3 py-3 sm:px-4">
                <input
                  type="checkbox"
                  aria-label={`Select ${summary.subject}`}
                  className="mt-3 h-4 w-4 shrink-0 accent-[#1f9d4c]"
                  checked={selected.has(summary.uid)}
                  onChange={() => toggleSelected(summary.uid)}
                />
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
          <React.Fragment key={compose.key}>
            <Composer
              token={token}
              draft={compose.draft}
              variant="window"
              onSessionError={handleError}
              onDraftSaved={() => { flash("Draft saved."); void loadFolders(); }}
              onClose={() => setCompose(null)}
              onSent={(text) => { flash(text); setCompose(null); void loadFolders(); if (roleOf(folder) === "sent" || roleOf(folder) === "drafts") void loadList(true); }}
              />
          </React.Fragment>
        </div>
      ) : (
        <MessageReader message={message} token={token} folder={folder} isJunk={roleOf(folder) === "junk"} isLoading={isLoadingMessage} onAction={(action) => void act(action)}>
          {compose && compose.variant === "inline" && message && (
            <div className="mx-4 mb-6 overflow-hidden rounded-xl border border-slate-200 shadow-sm">
              <React.Fragment key={compose.key}>
                <Composer
                  token={token}
                  draft={compose.draft}
                  variant="inline"
                  onSessionError={handleError}
                  onDraftSaved={() => { flash("Draft saved."); void loadFolders(); }}
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
            <Menu className="h-5 w-5" />
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
          {onInstall && (
            <button type="button" title="Install Green Mail on this device" className="inline-flex items-center gap-1.5 rounded-lg border border-[#1f9d4c]/40 px-2.5 py-2 text-sm font-bold text-[#15803d] hover:bg-[#eef8f1]" onClick={onInstall}>
              <Download className="h-4 w-4" /> <span className="hidden md:inline">Install app</span>
            </button>
          )}
          <button type="button" aria-label="Settings" title="Settings" className="rounded-lg p-2 text-slate-600 hover:bg-slate-100" onClick={() => setShowSettings(true)}>
            <Settings className="h-5 w-5" />
          </button>
          <AccountMenu
            email={myEmail}
            displayName={me?.display_name ?? null}
            accounts={accounts}
            activeToken={token}
            otherUnread={otherUnread}
            onSwitch={onSwitch}
            onAdd={onAddAccount}
            onSignOut={() => void signOut()}
            onSignOutAll={onSignOutAll}
          />
        </header>

        <div className="flex min-h-0 flex-1">
          {view === "calendar" && <CalendarView token={token} onSessionError={handleError} flash={flash} />}
          {view === "tasks" && <TasksView token={token} onSessionError={handleError} />}
          {view === "notes" && <NotesView token={token} onSessionError={handleError} />}
          {view === "templates" && <TemplatesView token={token} onSessionError={handleError} onUse={(template) => newMessage("", template)} />}
          {view === "campaigns" && <CampaignsView token={token} onSessionError={handleError} />}
          {view === "filters" && <FiltersView token={token} folders={folders} onSessionError={handleError} />}
          {view === "automation" && <AutomationView token={token} onSessionError={handleError} />}
          {view === "mail" && listPane}
          {view === "mail" && readerPane}
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
                onOpenCalendar={() => setView("calendar")}
                onOpenTasks={() => setView("tasks")}
              />
            </aside>
          )}
        </div>
      </div>

      {view === "mail" && !selectedUid && !compose && (
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

    </div>
  );
}
