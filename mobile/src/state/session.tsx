import NetInfo from "@react-native-community/netinfo";
import { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState, type ReactNode } from "react";
import { AppState } from "react-native";
import { MAX_ACCOUNTS, deletePassword, readAccounts, readActive, readPassword, withAccount, writeAccounts, writeActive, writePassword, type StoredAccount } from "../lib/accounts";
import { ApiError, NetworkError, SessionExpired } from "../lib/api";
import { api, sessionHooks } from "../lib/config";
import { cachedFolders, forgetAccount, kvGet, kvSet, cacheKey, removeCachedMessage, saveFolders, sqliteOutbox, updateCachedFlags } from "../lib/db";
import { enqueueItem, processOutbox, retryItem, type OutboxItem, type OutboxKind, type QueuedRequest } from "../lib/outbox";
import type { ComposePayload, Folder, ListFilter, Me } from "../lib/types";
import { registerForPush, unregisterPush } from "../lib/push";

/*
 * Who is signed in, which mailbox is open, whether the phone is online, and
 * the outbox. Screens read this; mail lists load their own pages.
 */
type SessionValue = {
  ready: boolean;
  accounts: StoredAccount[];
  account: StoredAccount | null;
  /** Accounts whose token the server no longer accepts (need signing in again). */
  expired: string[];
  me: Me | null;
  folders: Folder[];
  starred: number;
  folder: string;
  filter: ListFilter;
  /** Open a folder (and optionally a tab: Starred is the Inbox's "Flagged"). */
  setFolder: (path: string, filter?: ListFilter) => void;
  setFilter: (filter: ListFilter) => void;
  online: boolean;
  outbox: OutboxItem[];
  /** Bumped when something changed the mail (sent, deleted…), so lists reload. */
  mailVersion: number;
  bumpMail: () => void;

  signIn: (email: string, password: string) => Promise<void>;
  switchAccount: (email: string) => Promise<void>;
  signOut: (email?: string) => Promise<void>;
  /** After the password was changed in Settings: the app keeps signing in with the new one. */
  rememberPassword: (email: string, password: string) => Promise<void>;
  refreshFolders: () => Promise<void>;
  refreshMe: () => Promise<void>;
  /** Handles SessionExpired from any call (marks the account); returns a message to show. */
  handleError: (error: unknown, fallback?: string) => string;

  /** Queue for sending (from `accountEmail`, default the open mailbox). */
  enqueue: (kind: OutboxKind, payload: ComposePayload | QueuedRequest, label: string, accountEmail?: string) => Promise<void>;
  runOutbox: () => Promise<void>;
  retryOutbox: (id: string) => Promise<void>;
  discardOutbox: (id: string) => Promise<void>;
  /** Mark read / star / move / delete: applied on the phone now, sent now or when back online. */
  messageAction: (folder: string, uid: number, action: MessageAction) => Promise<string | null>;
};

export type MessageAction =
  | { type: "seen"; value: boolean }
  | { type: "flagged"; value: boolean }
  | { type: "delete" }
  | { type: "move"; toRole: "archive" | "junk" | "inbox" | "trash" };

const SessionContext = createContext<SessionValue | null>(null);

export function useSession(): SessionValue {
  const value = useContext(SessionContext);
  if (!value) throw new Error("useSession outside SessionProvider");
  return value;
}

export function SessionProvider({ children }: { children: ReactNode }) {
  const [ready, setReady] = useState(false);
  const [accounts, setAccounts] = useState<StoredAccount[]>([]);
  const [activeEmail, setActiveEmail] = useState<string | null>(null);
  const [expired, setExpired] = useState<string[]>([]);
  const [me, setMe] = useState<Me | null>(null);
  const [folders, setFolders] = useState<Folder[]>([]);
  const [starred, setStarred] = useState(0);
  const [folder, setFolderPath] = useState("INBOX");
  const [filter, setFilter] = useState<ListFilter>("all");
  const setFolder = useCallback((path: string, next: ListFilter = "all") => {
    setFolderPath(path);
    setFilter(next);
  }, []);
  const [online, setOnline] = useState(true);
  const [outbox, setOutbox] = useState<OutboxItem[]>([]);
  const [mailVersion, setMailVersion] = useState(0);

  const account = accounts.find((a) => a.email === activeEmail) ?? accounts[0] ?? null;
  const accountsRef = useRef(accounts);
  accountsRef.current = accounts;
  const running = useRef(false);

  const bumpMail = useCallback(() => setMailVersion((v) => v + 1), []);
  const reloadOutbox = useCallback(async () => setOutbox(await sqliteOutbox.all()), []);

  const markExpired = useCallback((email: string) => setExpired((list) => (list.includes(email) ? list : [...list, email])), []);

  const handleError = useCallback(
    (error: unknown, fallback = "Something went wrong.") => {
      if (error instanceof SessionExpired) {
        if (account) markExpired(account.email);
        return "You were signed out. Please sign in again.";
      }
      return error instanceof Error ? error.message : fallback;
    },
    [account, markExpired],
  );

  // ---- start-up: accounts from the keychain, cached profile and folders ----
  useEffect(() => {
    (async () => {
      const stored = await readAccounts();
      const active = await readActive();
      setAccounts(stored);
      setActiveEmail(stored.find((a) => a.email === active)?.email ?? stored[0]?.email ?? null);
      await reloadOutbox().catch(() => {});
      setReady(true);
    })();
  }, [reloadOutbox]);

  // ---- when the open mailbox changes: show cached data first, then refresh ----
  const refreshFolders = useCallback(async () => {
    if (!account) return;
    try {
      const result = await api.folders(account.token);
      setFolders(result.folders);
      setStarred(result.starred ?? 0);
      await saveFolders(account.email, result);
    } catch (error) {
      if (error instanceof SessionExpired) markExpired(account.email);
    }
  }, [account, markExpired]);

  const refreshMe = useCallback(async () => {
    if (!account) return;
    try {
      const who = await api.me(account.token);
      setMe(who);
      await kvSet(cacheKey(account.email, "me"), who);
    } catch (error) {
      if (error instanceof SessionExpired) markExpired(account.email);
    }
  }, [account, markExpired]);

  useEffect(() => {
    if (!account) {
      setMe(null);
      setFolders([]);
      return;
    }
    let cancelled = false;
    (async () => {
      const [cachedMe, cached] = await Promise.all([kvGet<Me>(cacheKey(account.email, "me")), cachedFolders(account.email)]);
      if (cancelled) return;
      setMe(cachedMe);
      if (cached) {
        setFolders(cached.folders);
        setStarred(cached.starred);
        setFolder(cached.folders.find((f) => f.role === "inbox")?.path ?? "INBOX");
      } else {
        setFolders([]);
        setFolder("INBOX");
      }
      await Promise.all([refreshMe(), refreshFolders()]);
    })();
    return () => {
      cancelled = true;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [account?.email, account?.token]);

  // ---- outbox ----
  const runOutbox = useCallback(async () => {
    if (running.current) return;
    running.current = true;
    try {
      const result = await processOutbox(sqliteOutbox, async (item) => {
        const owner = accountsRef.current.find((a) => a.email === item.account);
        if (!owner) throw new SessionExpired("That mailbox is not signed in on this phone.");
        if (item.kind === "request") {
          const r = item.payload as QueuedRequest;
          await api.request(r.path, owner.token, { method: r.method, body: r.body, query: r.query });
        } else {
          const p = item.payload as ComposePayload;
          if (item.kind === "send") await api.send(owner.token, p);
          else if (item.kind === "draft") await api.saveDraft(owner.token, p);
          else await api.schedule(owner.token, p);
        }
      });
      for (const id of result.signedOut) {
        const item = (await sqliteOutbox.all()).find((i) => i.id === id);
        if (item) markExpired(item.account);
      }
      if (result.sent.length) bumpMail();
    } finally {
      running.current = false;
      await reloadOutbox();
    }
  }, [bumpMail, markExpired, reloadOutbox]);

  const enqueue = useCallback(
    async (kind: OutboxKind, payload: ComposePayload | QueuedRequest, label: string, accountEmail?: string) => {
      const owner = accountEmail ?? account?.email;
      if (!owner) return;
      await sqliteOutbox.put(enqueueItem(owner, kind, payload, label));
      await reloadOutbox();
      void runOutbox();
    },
    [account, reloadOutbox, runOutbox],
  );

  const retryOutbox = useCallback(
    async (id: string) => {
      await retryItem(sqliteOutbox, id);
      await reloadOutbox();
      void runOutbox();
    },
    [reloadOutbox, runOutbox],
  );

  const discardOutbox = useCallback(
    async (id: string) => {
      await sqliteOutbox.remove(id);
      await reloadOutbox();
    },
    [reloadOutbox],
  );

  // Online/offline, and the outbox whenever the connection comes back or the app returns to the front.
  useEffect(() => {
    const unsubscribe = NetInfo.addEventListener((state) => {
      const isOnline = state.isConnected !== false && state.isInternetReachable !== false;
      setOnline((was) => {
        if (!was && isOnline) setTimeout(() => void runOutbox(), 500);
        return isOnline;
      });
    });
    const appState = AppState.addEventListener("change", (s) => s === "active" && void runOutbox());
    const timer = setInterval(() => void runOutbox(), 30000);
    return () => {
      unsubscribe();
      appState.remove();
      clearInterval(timer);
    };
  }, [runOutbox]);

  // ---- sessions that ended: sign in again from the saved password, unseen ----
  const refreshing = useRef(new Map<string, Promise<string | null>>());
  const refreshedTo = useRef(new Map<string, string>());

  const reauth = useCallback(
    (expiredToken: string): Promise<string | null> => {
      const done = refreshedTo.current.get(expiredToken);
      if (done) return Promise.resolve(done);
      const running = refreshing.current.get(expiredToken);
      if (running) return running;

      const job = (async () => {
        const owner = accountsRef.current.find((a) => a.token === expiredToken);
        if (!owner) return null;
        const password = await readPassword(owner.email);
        if (!password) return null;
        try {
          const result = await api.signIn(owner.email, password);
          const next = withAccount(await readAccounts(), { email: result.email, token: result.token });
          await writeAccounts(next);
          accountsRef.current = next;
          setAccounts(next);
          setExpired((list) => list.filter((e) => e !== owner.email));
          refreshedTo.current.set(expiredToken, result.token);
          return result.token;
        } catch (error) {
          // The password was changed elsewhere: forget it, the person signs in again.
          if (error instanceof ApiError && error.status === 422) await deletePassword(owner.email);
          return null;
        } finally {
          refreshing.current.delete(expiredToken);
        }
      })();
      refreshing.current.set(expiredToken, job);
      return job;
    },
    [],
  );
  sessionHooks.refresh = reauth;

  // ---- accounts ----
  const signIn = useCallback(async (email: string, password: string) => {
    const result = await api.signIn(email, password);
    await writePassword(result.email, password);
    const current = await readAccounts();
    const next = withAccount(current, { email: result.email, token: result.token });
    if (next.length > MAX_ACCOUNTS) throw new Error(`You can sign in to up to ${MAX_ACCOUNTS} mailboxes on one phone.`);
    await writeAccounts(next);
    await writeActive(result.email.toLowerCase());
    setAccounts(next);
    setActiveEmail(result.email.toLowerCase());
    setExpired((list) => list.filter((e) => e !== result.email.toLowerCase()));
    void registerForPush(api, result.token);
    setTimeout(() => void runOutbox(), 500);
  }, [runOutbox]);

  const switchAccount = useCallback(async (email: string) => {
    await writeActive(email);
    setActiveEmail(email);
  }, []);

  const signOut = useCallback(
    async (email?: string) => {
      const target = accountsRef.current.find((a) => a.email === (email ?? account?.email));
      if (!target) return;
      await unregisterPush(api, target.token).catch(() => {});
      await deletePassword(target.email);
      await api.signOut(target.token).catch(() => {});
      await forgetAccount(target.email).catch(() => {});
      const next = accountsRef.current.filter((a) => a.email !== target.email);
      await writeAccounts(next);
      setAccounts(next);
      setExpired((list) => list.filter((e) => e !== target.email));
      if (activeEmail === target.email) {
        const nextActive = next[0]?.email ?? null;
        setActiveEmail(nextActive);
        if (nextActive) await writeActive(nextActive);
      }
      await reloadOutbox();
    },
    [account, activeEmail, reloadOutbox],
  );

  // Phones signed in before notifications were allowed: register once per start.
  useEffect(() => {
    if (ready) accounts.forEach((a) => void registerForPush(api, a.token));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [ready]);

  // ---- message actions (optimistic, queued when offline) ----
  const messageAction = useCallback(
    async (path: string, uid: number, action: MessageAction): Promise<string | null> => {
      if (!account) return null;
      let request: QueuedRequest;
      let label: string;
      if (action.type === "seen" || action.type === "flagged") {
        await updateCachedFlags(account.email, path, uid, { [action.type]: action.value });
        request = { method: "PATCH", path: `/messages/${uid}`, body: { folder: path, [action.type]: action.value } };
        label = action.type === "seen" ? (action.value ? "Mark as read" : "Mark as unread") : action.value ? "Star" : "Remove star";
      } else if (action.type === "delete") {
        await removeCachedMessage(account.email, path, uid);
        request = { method: "DELETE", path: `/messages/${uid}`, query: { folder: path } };
        label = "Delete message";
      } else {
        await removeCachedMessage(account.email, path, uid);
        request = { method: "POST", path: `/messages/${uid}/move`, body: { folder: path, to_role: action.toRole } };
        label = `Move to ${action.toRole === "junk" ? "Spam" : action.toRole}`;
      }

      try {
        const result = await api.request<{ message?: string }>(request.path, account.token, { method: request.method, body: request.body, query: request.query });
        if (action.type !== "flagged") void refreshFolders();
        return result.message ?? null;
      } catch (error) {
        if (error instanceof NetworkError) {
          await enqueue("request", request, label);
          return "Saved on this phone — it will sync when you're back online.";
        }
        throw error;
      }
    },
    [account, enqueue, refreshFolders],
  );

  const value = useMemo<SessionValue>(
    () => ({
      ready,
      accounts,
      account,
      expired,
      me,
      folders,
      starred,
      folder,
      filter,
      setFolder,
      setFilter,
      online,
      outbox,
      mailVersion,
      bumpMail,
      signIn,
      switchAccount,
      signOut,
      rememberPassword: writePassword,
      refreshFolders,
      refreshMe,
      handleError,
      enqueue,
      runOutbox,
      retryOutbox,
      discardOutbox,
      messageAction,
    }),
    [ready, accounts, account, expired, me, folders, starred, folder, filter, setFolder, online, outbox, mailVersion, bumpMail, signIn, switchAccount, signOut, refreshFolders, refreshMe, handleError, enqueue, runOutbox, retryOutbox, discardOutbox, messageAction],
  );

  return <SessionContext.Provider value={value}>{children}</SessionContext.Provider>;
}
