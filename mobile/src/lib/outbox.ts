import { ApiError, NetworkError, SessionExpired } from "./api";
import type { ComposePayload } from "./types";

/*
 * The outbox: everything the user did that has to reach the server —
 * emails to send (now or later), drafts to save, and small changes such as
 * "mark read" or "star" — waits here until it goes through. Written while
 * offline, it is sent when the phone is back online.
 *
 * Kept free of storage and network so it can be tested: the app plugs in a
 * SQLite store and the API client.
 */
export type OutboxKind = "send" | "draft" | "schedule" | "request";
export type OutboxStatus = "pending" | "sending" | "failed";

/** A small API change made offline (PATCH/POST/DELETE with a JSON body). */
export type QueuedRequest = { method: "POST" | "PUT" | "PATCH" | "DELETE"; path: string; body?: unknown; query?: Record<string, string | number> };

export type OutboxItem = {
  id: string;
  account: string; // mailbox address
  kind: OutboxKind;
  payload: ComposePayload | QueuedRequest;
  status: OutboxStatus;
  error: string | null;
  attempts: number;
  createdAt: number;
  nextAttemptAt: number;
  /** Short line shown in the Outbox list (subject / what the change is). */
  label: string;
};

export interface OutboxStore {
  all(): Promise<OutboxItem[]>;
  put(item: OutboxItem): Promise<void>;
  remove(id: string): Promise<void>;
}

/** Sends one item; throws the API client's errors. Gets the account's token itself. */
export type OutboxSender = (item: OutboxItem) => Promise<void>;

export type Outcome = "sent" | "retry" | "failed" | "signed-out";

export const MAX_ATTEMPTS = 8;
/** An item left "sending" this long (app closed mid-send) is tried again. */
export const STALE_SENDING_MS = 2 * 60 * 1000;

let counter = 0;
export function newId(now = Date.now()): string {
  counter = (counter + 1) % 1e6;
  return `${now.toString(36)}-${counter.toString(36)}-${Math.random().toString(36).slice(2, 8)}`;
}

export function enqueueItem(
  account: string,
  kind: OutboxKind,
  payload: ComposePayload | QueuedRequest,
  label: string,
  now = Date.now(),
): OutboxItem {
  return { id: newId(now), account, kind, payload, status: "pending", error: null, attempts: 0, createdAt: now, nextAttemptAt: now, label };
}

/** Waits after the n-th failed try: 15s, 30s, 1m, 2m … up to 30 minutes. */
export function backoffMs(attempts: number): number {
  return Math.min(15000 * 2 ** Math.max(0, attempts - 1), 30 * 60 * 1000);
}

/** What an error means for a queued item. */
export function classify(error: unknown): Exclude<Outcome, "sent"> {
  if (error instanceof SessionExpired) return "signed-out";
  if (error instanceof NetworkError) return "retry";
  if (error instanceof ApiError) return error.retryable ? "retry" : "failed";
  return "retry";
}

export function isDue(item: OutboxItem, now: number): boolean {
  if (item.status === "failed") return false;
  if (item.status === "sending") return now - item.nextAttemptAt >= STALE_SENDING_MS;
  return item.nextAttemptAt <= now;
}

export type RunResult = { sent: string[]; failed: string[]; retrying: string[]; signedOut: string[] };

/**
 * Sends everything that is due, oldest first. Stops early (leaving the rest
 * pending) when the connection drops, so a long queue doesn't burn through
 * its retries while offline. Items of a signed-out account wait for sign-in.
 */
export async function processOutbox(store: OutboxStore, send: OutboxSender, now: () => number = Date.now): Promise<RunResult> {
  const result: RunResult = { sent: [], failed: [], retrying: [], signedOut: [] };
  const items = (await store.all()).filter((i) => isDue(i, now())).sort((a, b) => a.createdAt - b.createdAt);
  const skipAccounts = new Set<string>();

  for (const item of items) {
    if (skipAccounts.has(item.account)) continue;

    await store.put({ ...item, status: "sending", nextAttemptAt: now() });
    try {
      await send(item);
      await store.remove(item.id);
      result.sent.push(item.id);
    } catch (error) {
      const outcome = classify(error);
      const message = error instanceof Error ? error.message : "Could not send.";
      const attempts = item.attempts + 1;

      if (outcome === "signed-out") {
        skipAccounts.add(item.account);
        await store.put({ ...item, status: "pending", attempts, error: "Sign in again to send this.", nextAttemptAt: now() });
        result.signedOut.push(item.id);
      } else if (outcome === "failed" || attempts >= MAX_ATTEMPTS) {
        await store.put({ ...item, status: "failed", attempts, error: message });
        result.failed.push(item.id);
      } else {
        await store.put({ ...item, status: "pending", attempts, error: message, nextAttemptAt: now() + backoffMs(attempts) });
        result.retrying.push(item.id);
        // Offline: everything else would fail the same way.
        if (error instanceof NetworkError) break;
      }
    }
  }
  return result;
}

/** "Try again" on a failed item: back to the queue, sent on the next run. */
export async function retryItem(store: OutboxStore, id: string, now = Date.now()): Promise<void> {
  const item = (await store.all()).find((i) => i.id === id);
  if (item) await store.put({ ...item, status: "pending", error: null, attempts: 0, nextAttemptAt: now });
}

/** An in-memory store (tests, and a fallback when SQLite can't open). */
export class MemoryOutboxStore implements OutboxStore {
  private items = new Map<string, OutboxItem>();
  async all() {
    return [...this.items.values()].map((i) => ({ ...i }));
  }
  async put(item: OutboxItem) {
    this.items.set(item.id, { ...item });
  }
  async remove(id: string) {
    this.items.delete(id);
  }
}
