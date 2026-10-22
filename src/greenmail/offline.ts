import { useCallback, useEffect, useState } from "react";
import { gm, readAccounts, type FullMessage, type MessageSummary } from "./api";
import { announceChange, useOnChange } from "./sync";

/*
 * Offline mode. Recently opened mail lists and emails are kept in this
 * browser's IndexedDB (only for "Keep me signed in" accounts — on a shared
 * computer nothing is left behind), so Green Mail can show and search them
 * without a connection. Emails sent or drafts saved while offline wait in the
 * Outbox and go out when the connection returns; anything the server refuses
 * stays there with the reason, to fix or delete.
 *
 * Signing out of an account deletes everything kept for it.
 */

const DB_NAME = "greenmail-offline";
const DB_VERSION = 1;
const MAX_MESSAGES = 300; // per account, newest opened kept
const MAX_LISTS = 60;

export type ListPage = { messages: MessageSummary[]; total: number; page: number; last_page: number };

type CachedList = { key: string; email: string; savedAt: number; page: ListPage };
type CachedMessage = { key: string; email: string; folder: string; savedAt: number; message: FullMessage };

/** Form fields as sent to /send or /drafts; files are kept as Blobs. */
type Field = [string, string | File];
export type OutboxItem = {
  id?: number;
  email: string;
  kind: "send" | "draft";
  fields: Field[];
  subject: string;
  to: string;
  createdAt: number;
  status: "pending" | "sending" | "failed";
  error: string | null;
  attempts: number;
};

let opening: Promise<IDBDatabase> | null = null;

function db(): Promise<IDBDatabase> {
  if (!opening) {
    opening = new Promise((resolve, reject) => {
      if (typeof indexedDB === "undefined") return reject(new Error("No offline storage in this browser."));
      const request = indexedDB.open(DB_NAME, DB_VERSION);
      request.onupgradeneeded = () => {
        const store = request.result;
        store.createObjectStore("lists", { keyPath: "key" }).createIndex("email", "email");
        store.createObjectStore("messages", { keyPath: "key" }).createIndex("email", "email");
        store.createObjectStore("outbox", { keyPath: "id", autoIncrement: true }).createIndex("email", "email");
      };
      request.onsuccess = () => resolve(request.result);
      request.onerror = () => reject(request.error);
    });
    opening.catch(() => {
      opening = null;
    });
  }
  return opening;
}

function run<T>(storeName: string, mode: IDBTransactionMode, work: (store: IDBObjectStore) => IDBRequest<T> | void): Promise<T | undefined> {
  return db().then(
    (database) =>
      new Promise<T | undefined>((resolve, reject) => {
        const tx = database.transaction(storeName, mode);
        const request = work(tx.objectStore(storeName));
        tx.oncomplete = () => resolve(request ? request.result : undefined);
        tx.onerror = () => reject(tx.error);
        tx.onabort = () => reject(tx.error);
      }),
  );
}

const allFor = <T>(storeName: string, email: string) => run<T[]>(storeName, "readonly", (store) => store.index("email").getAll(email)).then((rows) => rows ?? []);

/** A failed request that never reached the server (as opposed to the server saying no). */
export function isOfflineError(error: unknown): boolean {
  return (typeof navigator !== "undefined" && navigator.onLine === false) || error instanceof TypeError;
}

/** Whether this account's mail may be kept on this device. */
const keepsMail = (email: string) => Boolean(email) && readAccounts().some((a) => a.email === email && a.remember);

const listKey = (email: string, folder: string, filter: string, page: number) => `${email}|${folder}|${filter}|${page}`;
const messageKey = (email: string, folder: string, uid: number) => `${email}|${folder}|${uid}`;

export async function saveList(email: string, folder: string, filter: string, page: number, data: ListPage): Promise<void> {
  if (!keepsMail(email)) return;
  await run("lists", "readwrite", (store) => store.put({ key: listKey(email, folder, filter, page), email, savedAt: Date.now(), page: data } satisfies CachedList)).catch(() => undefined);
  const lists = await allFor<CachedList>("lists", email).catch(() => []);
  if (lists.length > MAX_LISTS) {
    const old = lists.sort((a, b) => b.savedAt - a.savedAt).slice(MAX_LISTS);
    await run("lists", "readwrite", (store) => old.forEach((row) => store.delete(row.key))).catch(() => undefined);
  }
}

export async function cachedList(email: string, folder: string, filter: string, page: number): Promise<{ page: ListPage; savedAt: number } | null> {
  if (!email) return null;
  const row = await run<CachedList>("lists", "readonly", (store) => store.get(listKey(email, folder, filter, page))).catch(() => undefined);
  return row ? { page: row.page, savedAt: row.savedAt } : null;
}

export async function saveMessage(email: string, folder: string, message: FullMessage): Promise<void> {
  if (!keepsMail(email)) return;
  await run("messages", "readwrite", (store) => store.put({ key: messageKey(email, folder, message.uid), email, folder, savedAt: Date.now(), message } satisfies CachedMessage)).catch(() => undefined);
  const rows = await allFor<CachedMessage>("messages", email).catch(() => []);
  if (rows.length > MAX_MESSAGES) {
    const old = rows.sort((a, b) => b.savedAt - a.savedAt).slice(MAX_MESSAGES);
    await run("messages", "readwrite", (store) => old.forEach((row) => store.delete(row.key))).catch(() => undefined);
  }
}

export async function cachedMessage(email: string, folder: string, uid: number): Promise<FullMessage | null> {
  if (!email) return null;
  const row = await run<CachedMessage>("messages", "readonly", (store) => store.get(messageKey(email, folder, uid))).catch(() => undefined);
  return row?.message ?? null;
}

/** Search what's kept on this device: subjects, senders, previews and opened emails' text. */
export async function searchCached(email: string, folder: string, query: string): Promise<MessageSummary[]> {
  const q = query.trim().toLowerCase();
  if (!email || !q) return [];
  const [lists, messages] = await Promise.all([allFor<CachedList>("lists", email).catch(() => []), allFor<CachedMessage>("messages", email).catch(() => [])]);
  const prefix = `${email}|${folder}|`;
  const found = new Map<number, MessageSummary>();
  const matches = (m: MessageSummary, extra = "") => `${m.subject} ${m.from.name ?? ""} ${m.from.email} ${m.to.map((a) => a.email).join(" ")} ${m.snippet} ${extra}`.toLowerCase().includes(q);

  for (const row of messages) {
    if (row.folder === folder && matches(row.message, row.message.text ?? row.message.html.replace(/<[^>]+>/g, " "))) found.set(row.message.uid, row.message);
  }
  for (const row of lists) {
    if (!row.key.startsWith(prefix)) continue;
    for (const m of row.page.messages) if (!found.has(m.uid) && matches(m)) found.set(m.uid, m);
  }
  return [...found.values()].sort((a, b) => b.uid - a.uid);
}

/** Everything kept for an account (on sign-out). */
export async function forgetAccount(email: string): Promise<void> {
  if (!email) return;
  for (const storeName of ["lists", "messages", "outbox"]) {
    const rows = await allFor<{ key?: string; id?: number }>(storeName, email).catch(() => []);
    await run(storeName, "readwrite", (store) => rows.forEach((row) => store.delete((row.key ?? row.id) as IDBValidKey))).catch(() => undefined);
  }
  announceChange("outbox");
}

// ---------------------------------------------------------------- Outbox

export async function queue(email: string, kind: OutboxItem["kind"], form: FormData): Promise<void> {
  const fields: Field[] = [];
  form.forEach((value, key) => fields.push([key, value]));
  const get = (name: string) => String(form.get(name) ?? "");
  await run("outbox", "readwrite", (store) =>
    store.add({ email, kind, fields, subject: get("subject") || "(no subject)", to: get("to"), createdAt: Date.now(), status: "pending", error: null, attempts: 0 } satisfies OutboxItem),
  );
  announceChange("outbox");
}

export const outboxFor = (email: string) => allFor<OutboxItem>("outbox", email).then((rows) => rows.sort((a, b) => a.createdAt - b.createdAt));

export async function removeFromOutbox(id: number): Promise<void> {
  await run("outbox", "readwrite", (store) => store.delete(id));
  announceChange("outbox");
}

const update = (item: OutboxItem) => run("outbox", "readwrite", (store) => store.put(item));

export async function retry(item: OutboxItem): Promise<void> {
  await update({ ...item, status: "pending", error: null });
  announceChange("outbox");
}

let flushing = false;

/**
 * Send what's waiting, oldest first, for every signed-in account. Stops at
 * the first connection failure (still offline); a refusal from the server
 * marks that item failed and moves on.
 */
export async function flushOutbox(): Promise<{ sent: number; failed: number }> {
  const result = { sent: 0, failed: 0 };
  if (flushing || (typeof navigator !== "undefined" && navigator.onLine === false)) return result;
  flushing = true;
  try {
    const accounts = readAccounts();
    for (const account of accounts) {
      if (!account.email) continue;
      const items = (await outboxFor(account.email).catch(() => [])).filter((i) => i.status === "pending" || (i.status === "sending" && Date.now() - i.createdAt > 120000));
      for (const item of items) {
        await update({ ...item, status: "sending", attempts: item.attempts + 1 });
        const body = new FormData();
        item.fields.forEach(([key, value]) => body.append(key, value));
        try {
          await gm(item.kind === "send" ? "/send" : "/drafts", account.token, { method: "POST", body });
          await run("outbox", "readwrite", (store) => store.delete(item.id as number));
          result.sent++;
        } catch (error) {
          if (isOfflineError(error)) {
            await update({ ...item, status: "pending", attempts: item.attempts + 1 });
            return result;
          }
          await update({ ...item, status: "failed", attempts: item.attempts + 1, error: error instanceof Error ? error.message : "The server refused it." });
          result.failed++;
        }
      }
    }
    return result;
  } finally {
    flushing = false;
    if (result.sent || result.failed) announceChange("outbox");
  }
}

/** navigator.onLine, kept current. */
export function useOnline(): boolean {
  const [online, setOnline] = useState(() => (typeof navigator === "undefined" ? true : navigator.onLine));
  useEffect(() => {
    const on = () => setOnline(true);
    const off = () => setOnline(false);
    window.addEventListener("online", on);
    window.addEventListener("offline", off);
    return () => {
      window.removeEventListener("online", on);
      window.removeEventListener("offline", off);
    };
  }, []);
  return online;
}

/** This account's Outbox, kept current. */
export function useOutbox(email: string): { items: OutboxItem[]; reload: () => void } {
  const [items, setItems] = useState<OutboxItem[]>([]);
  const reload = useCallback(() => {
    if (!email) return setItems([]);
    void outboxFor(email).then(setItems).catch(() => setItems([]));
  }, [email]);
  useEffect(() => reload(), [reload]);
  useOnChange("outbox", reload);
  return { items, reload };
}
