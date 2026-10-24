import * as SQLite from "expo-sqlite";
import type { OutboxItem, OutboxStore } from "./outbox";
import type { Folder, FullMessage, ListFilter, MessageSummary } from "./types";

/*
 * The phone's copy of recent mail (so it can be read and searched offline),
 * the outbox, local drafts, and small cached things (folders, profile,
 * calendar…) as JSON. One SQLite file for every signed-in mailbox; rows are
 * keyed by the mailbox address.
 */
let dbPromise: Promise<SQLite.SQLiteDatabase> | null = null;

/** Messages kept per folder; older ones are dropped from the phone (not the server). */
export const KEEP_PER_FOLDER = 400;

export function db(): Promise<SQLite.SQLiteDatabase> {
  if (!dbPromise) {
    dbPromise = (async () => {
      const database = await SQLite.openDatabaseAsync("greenmail.db");
      await database.execAsync(`
        PRAGMA journal_mode = WAL;
        CREATE TABLE IF NOT EXISTS messages (
          account TEXT NOT NULL,
          folder TEXT NOT NULL,
          uid INTEGER NOT NULL,
          date TEXT,
          seen INTEGER NOT NULL DEFAULT 0,
          flagged INTEGER NOT NULL DEFAULT 0,
          has_attachments INTEGER NOT NULL DEFAULT 0,
          search TEXT NOT NULL DEFAULT '',
          summary TEXT NOT NULL,
          full TEXT,
          PRIMARY KEY (account, folder, uid)
        );
        CREATE INDEX IF NOT EXISTS messages_list ON messages (account, folder, uid DESC);
        CREATE TABLE IF NOT EXISTS outbox (id TEXT PRIMARY KEY NOT NULL, account TEXT NOT NULL, created_at INTEGER NOT NULL, item TEXT NOT NULL);
        CREATE TABLE IF NOT EXISTS drafts (id TEXT PRIMARY KEY NOT NULL, account TEXT NOT NULL, updated_at INTEGER NOT NULL, draft TEXT NOT NULL);
        CREATE TABLE IF NOT EXISTS kv (key TEXT PRIMARY KEY NOT NULL, value TEXT NOT NULL);
      `);
      return database;
    })();
  }
  return dbPromise;
}

const searchText = (m: MessageSummary, body = "") =>
  [m.subject, m.from?.name, m.from?.email, ...(m.to ?? []).map((a) => `${a.name ?? ""} ${a.email}`), m.snippet, body].join(" ").toLowerCase();

/** Plain text of an HTML body, for offline search. */
export function htmlToText(html: string): string {
  return html
    .replace(/<(style|script)[^>]*>[\s\S]*?<\/\1>/gi, " ")
    .replace(/<br\s*\/?>|<\/(p|div|li|tr|h\d)>/gi, "\n")
    .replace(/<[^>]+>/g, " ")
    .replace(/&nbsp;/g, " ")
    .replace(/&amp;/g, "&")
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/&quot;/g, '"')
    .replace(/&#39;/g, "'")
    .replace(/[ \t]+/g, " ")
    .replace(/\n\s*\n+/g, "\n\n")
    .trim();
}

// ---------- key/value ----------

export async function kvGet<T>(key: string): Promise<T | null> {
  const row = await (await db()).getFirstAsync<{ value: string }>("SELECT value FROM kv WHERE key = ?", key);
  if (!row) return null;
  try {
    return JSON.parse(row.value) as T;
  } catch {
    return null;
  }
}

export async function kvSet(key: string, value: unknown): Promise<void> {
  await (await db()).runAsync("INSERT OR REPLACE INTO kv (key, value) VALUES (?, ?)", key, JSON.stringify(value));
}

export const cacheKey = (account: string, what: string) => `${account}::${what}`;

export async function cachedFolders(account: string) {
  return kvGet<{ folders: Folder[]; starred: number }>(cacheKey(account, "folders"));
}

export async function saveFolders(account: string, value: { folders: Folder[]; starred: number }) {
  await kvSet(cacheKey(account, "folders"), value);
}

// ---------- messages ----------

/**
 * Stores a page from the server. For the first page of the unfiltered list,
 * messages in the same uid range that are no longer on the server (moved or
 * deleted elsewhere) are dropped too.
 */
export async function saveMessagePage(account: string, folder: string, messages: MessageSummary[], replaceRange: boolean): Promise<void> {
  const database = await db();
  await database.withTransactionAsync(async () => {
    if (replaceRange && messages.length > 0) {
      const lowest = Math.min(...messages.map((m) => m.uid));
      const uids = messages.map((m) => m.uid);
      await database.runAsync(
        `DELETE FROM messages WHERE account = ? AND folder = ? AND uid >= ? AND uid NOT IN (${uids.map(() => "?").join(",")})`,
        account,
        folder,
        lowest,
        ...uids,
      );
    } else if (replaceRange) {
      await database.runAsync("DELETE FROM messages WHERE account = ? AND folder = ?", account, folder);
    }
    for (const m of messages) {
      await database.runAsync(
        `INSERT INTO messages (account, folder, uid, date, seen, flagged, has_attachments, search, summary)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
         ON CONFLICT (account, folder, uid) DO UPDATE SET date = excluded.date, seen = excluded.seen, flagged = excluded.flagged,
           has_attachments = excluded.has_attachments, summary = excluded.summary,
           search = CASE WHEN messages.full IS NULL THEN excluded.search ELSE messages.search END`,
        account,
        folder,
        m.uid,
        m.date,
        m.seen ? 1 : 0,
        m.flagged ? 1 : 0,
        m.has_attachments ? 1 : 0,
        searchText(m),
        JSON.stringify(m),
      );
    }
    // Keep the phone's copy bounded.
    await database.runAsync(
      `DELETE FROM messages WHERE account = ? AND folder = ? AND uid NOT IN (SELECT uid FROM messages WHERE account = ? AND folder = ? ORDER BY uid DESC LIMIT ?)`,
      account,
      folder,
      account,
      folder,
      KEEP_PER_FOLDER,
    );
  });
}

export async function saveFullMessage(account: string, folder: string, message: FullMessage): Promise<void> {
  const summary: MessageSummary = { ...message, seen: true };
  const fields = { cc: message.cc, reply_to: message.reply_to, message_id: message.message_id, references: message.references, html: message.html, text: message.text, has_remote_images: message.has_remote_images, attachments: message.attachments };
  await (await db()).runAsync(
    `INSERT INTO messages (account, folder, uid, date, seen, flagged, has_attachments, search, summary, full)
     VALUES (?, ?, ?, ?, 1, ?, ?, ?, ?, ?)
     ON CONFLICT (account, folder, uid) DO UPDATE SET seen = 1, flagged = excluded.flagged, search = excluded.search, summary = excluded.summary, full = excluded.full`,
    account,
    folder,
    message.uid,
    message.date,
    message.flagged ? 1 : 0,
    message.has_attachments ? 1 : 0,
    searchText(summary, message.text ?? htmlToText(message.html)),
    JSON.stringify(summary),
    JSON.stringify(fields),
  );
}

type Row = { summary: string; full: string | null };

export async function cachedFullMessage(account: string, folder: string, uid: number): Promise<FullMessage | null> {
  const row = await (await db()).getFirstAsync<Row>("SELECT summary, full FROM messages WHERE account = ? AND folder = ? AND uid = ?", account, folder, uid);
  if (!row?.full) return null;
  return { ...(JSON.parse(row.summary) as MessageSummary), ...JSON.parse(row.full) } as FullMessage;
}

/** The phone's copy of a folder (offline), newest first, optionally filtered and searched. */
export async function cachedMessages(account: string, folder: string | null, filter: ListFilter, query: string, limit: number, offset = 0): Promise<MessageSummary[]> {
  const where = ["account = ?"];
  const args: Array<string | number> = [account];
  if (folder) {
    where.push("folder = ?");
    args.push(folder);
  }
  if (filter === "unread") where.push("seen = 0");
  if (filter === "flagged") where.push("flagged = 1");
  if (filter === "attachments") where.push("has_attachments = 1");
  for (const word of query.toLowerCase().split(/\s+/).filter(Boolean)) {
    where.push("search LIKE ? ESCAPE '\\'");
    args.push(`%${word.replace(/[\\%_]/g, (c) => `\\${c}`)}%`);
  }
  const rows = await (await db()).getAllAsync<Row>(
    `SELECT summary, full FROM messages WHERE ${where.join(" AND ")} ORDER BY COALESCE(date, '') DESC, uid DESC LIMIT ? OFFSET ?`,
    ...args,
    limit,
    offset,
  );
  return rows.map((r) => JSON.parse(r.summary) as MessageSummary);
}

/** Keep the phone's copy in step after reading, starring etc. */
export async function updateCachedFlags(account: string, folder: string, uid: number, change: { seen?: boolean; flagged?: boolean }): Promise<void> {
  const database = await db();
  const row = await database.getFirstAsync<Row>("SELECT summary, full FROM messages WHERE account = ? AND folder = ? AND uid = ?", account, folder, uid);
  if (!row) return;
  const summary = { ...(JSON.parse(row.summary) as MessageSummary), ...change };
  await database.runAsync(
    "UPDATE messages SET seen = ?, flagged = ?, summary = ? WHERE account = ? AND folder = ? AND uid = ?",
    summary.seen ? 1 : 0,
    summary.flagged ? 1 : 0,
    JSON.stringify(summary),
    account,
    folder,
    uid,
  );
}

export async function removeCachedMessage(account: string, folder: string, uid: number): Promise<void> {
  await (await db()).runAsync("DELETE FROM messages WHERE account = ? AND folder = ? AND uid = ?", account, folder, uid);
}

/** Everything about a mailbox, when it signs out on this phone. */
export async function forgetAccount(account: string): Promise<void> {
  const database = await db();
  await database.runAsync("DELETE FROM messages WHERE account = ?", account);
  await database.runAsync("DELETE FROM drafts WHERE account = ?", account);
  await database.runAsync("DELETE FROM outbox WHERE account = ?", account);
  await database.runAsync("DELETE FROM kv WHERE key LIKE ?", `${account}::%`);
}

// ---------- outbox ----------

export const sqliteOutbox: OutboxStore = {
  async all() {
    const rows = await (await db()).getAllAsync<{ item: string }>("SELECT item FROM outbox ORDER BY created_at");
    return rows.map((r) => JSON.parse(r.item) as OutboxItem);
  },
  async put(item) {
    await (await db()).runAsync("INSERT OR REPLACE INTO outbox (id, account, created_at, item) VALUES (?, ?, ?, ?)", item.id, item.account, item.createdAt, JSON.stringify(item));
  },
  async remove(id) {
    await (await db()).runAsync("DELETE FROM outbox WHERE id = ?", id);
  },
};

// ---------- local drafts (written offline or not yet saved to the server) ----------

export type LocalDraft = {
  id: string;
  account: string;
  updatedAt: number;
  from: string;
  to: string;
  cc: string;
  bcc: string;
  subject: string;
  html: string;
  quoteHtml?: string;
  attachments: Array<{ uri: string; name: string; mime: string; size?: number | null }>;
  context?: { in_reply_to?: string; references?: string; reply_uid?: number; reply_folder?: string; draft_uid?: number; forward_folder?: string; forward_uid?: number; forward_attachments?: number[] };
};

export async function saveLocalDraft(draft: LocalDraft): Promise<void> {
  await (await db()).runAsync("INSERT OR REPLACE INTO drafts (id, account, updated_at, draft) VALUES (?, ?, ?, ?)", draft.id, draft.account, draft.updatedAt, JSON.stringify(draft));
}

export async function localDrafts(account?: string): Promise<LocalDraft[]> {
  const database = await db();
  const rows = account
    ? await database.getAllAsync<{ draft: string }>("SELECT draft FROM drafts WHERE account = ? ORDER BY updated_at DESC", account)
    : await database.getAllAsync<{ draft: string }>("SELECT draft FROM drafts ORDER BY updated_at DESC");
  return rows.map((r) => JSON.parse(r.draft) as LocalDraft);
}

export async function localDraft(id: string): Promise<LocalDraft | null> {
  const row = await (await db()).getFirstAsync<{ draft: string }>("SELECT draft FROM drafts WHERE id = ?", id);
  return row ? (JSON.parse(row.draft) as LocalDraft) : null;
}

export async function deleteLocalDraft(id: string): Promise<void> {
  await (await db()).runAsync("DELETE FROM drafts WHERE id = ?", id);
}
