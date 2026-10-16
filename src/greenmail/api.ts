import { LARAVEL_API_BASE_URL } from "../shared/api";

/*
 * Greenmail talks to /api/v1/greenmail with its own token (not the client
 * area's): the person signs in with their mailbox address and password.
 * "Keep me signed in" keeps the token in localStorage; otherwise it lives only
 * for this tab (sessionStorage).
 */
const TOKEN_KEY = "greenmail_token";

export function readToken(): string {
  try {
    return window.sessionStorage.getItem(TOKEN_KEY) || window.localStorage.getItem(TOKEN_KEY) || "";
  } catch {
    return "";
  }
}

export function storeToken(token: string, remember: boolean): void {
  try {
    clearToken();
    (remember ? window.localStorage : window.sessionStorage).setItem(TOKEN_KEY, token);
  } catch {
    // Storage blocked — the token then lasts only while the page is open (kept in memory by the app).
  }
}

export function clearToken(): void {
  try {
    window.sessionStorage.removeItem(TOKEN_KEY);
    window.localStorage.removeItem(TOKEN_KEY);
  } catch {
    // ignore
  }
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
