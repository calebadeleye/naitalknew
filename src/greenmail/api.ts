import { LARAVEL_API_BASE_URL } from "../shared/api";

/*
 * Greenmail talks to /api/v1/greenmail with its own token (not the client
 * area's): the person signs in with their mailbox address and password.
 *
 * Several mailboxes can be signed in on one device and switched between.
 * Each has its own token; "Keep me signed in" keeps that account in
 * localStorage, otherwise it lives only for this tab (sessionStorage).
 */
export type StoredAccount = { email: string; token: string; remember: boolean };

const ACCOUNTS_KEY = "greenmail_accounts";
const ACTIVE_KEY = "greenmail_active";
const LEGACY_TOKEN_KEY = "greenmail_token";
export const MAX_ACCOUNTS = 6;

function readList(storage: Storage): StoredAccount[] {
  try {
    const parsed = JSON.parse(storage.getItem(ACCOUNTS_KEY) || "[]");
    return Array.isArray(parsed) ? parsed.filter((a) => a && typeof a.token === "string" && a.token.startsWith("gm_")) : [];
  } catch {
    return [];
  }
}

function writeLists(accounts: StoredAccount[]): void {
  try {
    window.localStorage.setItem(ACCOUNTS_KEY, JSON.stringify(accounts.filter((a) => a.remember)));
    window.sessionStorage.setItem(ACCOUNTS_KEY, JSON.stringify(accounts.filter((a) => !a.remember)));
  } catch {
    // Storage blocked — accounts then last only while the page is open.
  }
}

/** Every mailbox signed in on this device (remembered ones first). */
export function readAccounts(): StoredAccount[] {
  try {
    const accounts = [...readList(window.localStorage), ...readList(window.sessionStorage)];
    // A sign-in from before multiple accounts existed: keep it (its address is filled in once it loads).
    for (const storage of [window.localStorage, window.sessionStorage]) {
      const legacy = storage.getItem(LEGACY_TOKEN_KEY);
      if (legacy && !accounts.some((a) => a.token === legacy)) accounts.push({ email: "", token: legacy, remember: storage === window.localStorage });
      storage.removeItem(LEGACY_TOKEN_KEY);
    }
    writeLists(accounts);
    return accounts;
  } catch {
    return [];
  }
}

/** The account in use: the last one chosen on this device, else the first. */
export function readToken(): string {
  const accounts = readAccounts();
  let active = "";
  try {
    active = window.sessionStorage.getItem(ACTIVE_KEY) || window.localStorage.getItem(ACTIVE_KEY) || "";
  } catch {
    // ignore
  }
  return accounts.find((a) => a.token === active)?.token ?? accounts[0]?.token ?? "";
}

export function setActiveToken(token: string): void {
  try {
    window.sessionStorage.setItem(ACTIVE_KEY, token);
    window.localStorage.setItem(ACTIVE_KEY, token);
  } catch {
    // ignore
  }
}

/** Add (or refresh) a signed-in mailbox and make it the active one. Signing in again to the same address replaces its old token. */
export function storeToken(token: string, remember: boolean, email = ""): void {
  const address = email.trim().toLowerCase();
  const accounts = readAccounts().filter((a) => a.token !== token && (!address || a.email !== address));
  writeLists([...accounts, { email: address, token, remember }]);
  setActiveToken(token);
}

/** Fill in an account's address once it's known (sign-ins from before accounts were listed). */
export function rememberAccountEmail(token: string, email: string): void {
  const accounts = readAccounts();
  const account = accounts.find((a) => a.token === token);
  if (account && account.email !== email) {
    account.email = email;
    writeLists(accounts);
  }
}

/** Forget one account on this device (default: the active one). */
export function clearToken(token = readToken()): void {
  writeLists(readAccounts().filter((a) => a.token !== token));
}

export class SessionExpired extends Error {}

export async function gm<T>(path: string, token: string, options: RequestInit = {}): Promise<T> {
  const headers = new Headers(options.headers);
  headers.set("Accept", "application/json");
  if (token) headers.set("X-Greenmail-Token", token);
  if (options.body && !(options.body instanceof FormData) && !headers.has("Content-Type")) headers.set("Content-Type", "application/json");

  const response = await fetch(`${LARAVEL_API_BASE_URL}/api/v1/greenmail${path}`, { ...options, headers });
  const payload = await response.json().catch(() => ({}));

  if (response.status === 401 && token) throw new SessionExpired(payload.message || "Please sign in again.");
  if (!response.ok) {
    const firstError = payload.errors ? (Object.values(payload.errors)[0] as string[] | undefined)?.[0] : undefined;
    throw new Error(firstError || payload.message || "Something went wrong. Please try again.");
  }

  return payload as T;
}

export async function gmDownload(path: string, token: string, filename: string): Promise<void> {
  const response = await fetch(`${LARAVEL_API_BASE_URL}/api/v1/greenmail${path}`, { headers: { "X-Greenmail-Token": token } });
  if (!response.ok) throw new Error("Download failed.");
  const url = URL.createObjectURL(await response.blob());
  const link = document.createElement("a");
  link.href = url;
  link.download = filename;
  link.click();
  URL.revokeObjectURL(url);
}

export type Address = { name: string | null; email: string };

export type Folder = { path: string; name: string; role: "inbox" | "sent" | "drafts" | "junk" | "trash" | "archive" | null; unread: number; total: number };

export type MessageSummary = {
  uid: number;
  subject: string;
  from: Address;
  to: Address[];
  date: string | null;
  seen: boolean;
  flagged: boolean;
  answered: boolean;
  has_attachments: boolean;
  snippet: string;
};

export type Attachment = { index: number; name: string; size: number; mime: string; content_id: string | null; inline: boolean };

export type FullMessage = MessageSummary & {
  cc: Address[];
  reply_to: Address[];
  message_id: string;
  references: string;
  html: string;
  text: string | null;
  has_remote_images: boolean;
  attachments: Attachment[];
};

export type Contact = { id: number; name: string | null; email: string; phone: string | null; company: string | null; notes: string | null };

export type Me = { email: string; display_name: string | null; signature_html: string | null; quota: { used_bytes: number; limit_bytes: number } | null };

export type CalendarEvent = { id: number; title: string; starts_at: string; ends_at: string | null; all_day: boolean; location: string | null; notes: string | null };

export type Task = { id: number; title: string; due_date: string | null; done: boolean; completed_at: string | null; notes: string | null };

export type Note = { id: number; title: string | null; body: string | null; color: "yellow" | "green" | "blue" | "pink" | "gray" | null; pinned: boolean; updated_at: string };

export type Template = { id: number; name: string; subject: string | null; body_html: string | null };

export type RuleKind = "filter" | "automation";
export type MailRule = {
  id: number;
  kind: RuleKind;
  name: string;
  field: "any" | "from" | "to" | "subject";
  operator: "contains" | "is" | "begins" | "ends";
  value: string | null;
  action: "move" | "delete" | "mark_read" | "star" | "forward" | "auto_reply";
  target: string | null;
  reply_subject: string | null;
  reply_text: string | null;
  active: boolean;
};

export type Vacation = { enabled: boolean; subject: string; message: string; starts_at: string | null; ends_at: string | null; open_ended: boolean };

export type ScheduledEmail = { id: number; subject: string | null; recipients: string[]; send_at: string; status: "scheduled" | "sending" | "sent" | "failed" | "cancelled"; error: string | null; sent_at: string | null };

export type Campaign = {
  id: number;
  name: string;
  subject: string;
  status: "draft" | "sending" | "sent" | "cancelled" | "failed";
  send_at: string | null;
  total: number;
  sent_count: number;
  failed_count: number;
  skipped_count: number;
  started_at: string | null;
  finished_at: string | null;
  last_error: string | null;
  created_at: string;
  body_html?: string;
  unsubscribed?: number;
  recipients?: Array<{ id: number; email: string; name: string | null; status: "pending" | "sent" | "failed" | "skipped"; error: string | null; sent_at: string | null }>;
};

export type CampaignLimits = { per_minute: number; per_day: number; max_recipients: number };
