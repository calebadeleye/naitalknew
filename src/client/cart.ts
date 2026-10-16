import { useSyncExternalStore } from "react";

/*
 * The client's cart: what they chose, kept in this browser (per account) until
 * they check out. Prices are never kept here — the cart page asks the server
 * to price the lines, and checkout prices them again from scratch.
 */
export type CartLine =
  | { id: string; type: "hosting"; plan_slug: string; primary_domain: string; add_ons: string[]; register_domain: boolean }
  | { id: string; type: "domain"; domain_name: string }
  | { id: string; type: "service"; offering: string; domain?: string; notes?: string };

/** A line as added (the cart gives it an id). */
export type NewCartLine =
  | Omit<Extract<CartLine, { type: "hosting" }>, "id">
  | Omit<Extract<CartLine, { type: "domain" }>, "id">
  | Omit<Extract<CartLine, { type: "service" }>, "id">;

export const MAX_CART_LINES = 10;

let owner = "";
const listeners = new Set<() => void>();
let cachedRaw: string | null = null;
let cachedLines: CartLine[] = [];

const storageKey = () => (owner ? `naitalk_cart:${owner}` : null);

function readRaw(): string {
  const key = storageKey();
  if (!key) return "[]";
  try {
    return window.localStorage.getItem(key) || "[]";
  } catch {
    return "[]";
  }
}

function snapshot(): CartLine[] {
  const raw = readRaw();
  if (raw !== cachedRaw) {
    cachedRaw = raw;
    try {
      const parsed = JSON.parse(raw);
      cachedLines = Array.isArray(parsed) ? parsed.filter((line) => line && typeof line.id === "string" && ["hosting", "domain", "service"].includes(line.type)) : [];
    } catch {
      cachedLines = [];
    }
  }
  return cachedLines;
}

function write(lines: CartLine[]) {
  const key = storageKey();
  if (key) {
    try {
      window.localStorage.setItem(key, JSON.stringify(lines));
    } catch {
      // Storage blocked: the cart then lasts only until the page reloads.
    }
  }
  cachedRaw = null;
  listeners.forEach((listener) => listener());
}

/** Whose cart this is (their email), so two people on one device never share one. Call when the account is known. */
export function setCartOwner(email: string) {
  const next = email.trim().toLowerCase();
  if (next === owner) return;
  owner = next;
  cachedRaw = null;
  listeners.forEach((listener) => listener());
}

/** What a line is "about": two lines about the same domain would clash, so adding again replaces. */
const subjectOf = (line: Pick<CartLine, "type"> & Record<string, unknown>) =>
  line.type === "hosting" ? `hosting:${line.primary_domain}` : line.type === "domain" ? `domain:${line.domain_name}` : `service:${line.offering}:${line.domain ?? ""}`;

export function addToCart(line: NewCartLine): { added: boolean; replaced: boolean; full: boolean } {
  const current = snapshot();
  const subject = subjectOf(line as never);
  const same = current.find((existing) => subjectOf(existing as never) === subject);

  if (!same && current.length >= MAX_CART_LINES) return { added: false, replaced: false, full: true };

  const next: CartLine = { ...(line as object), id: same?.id ?? `${Date.now().toString(36)}${Math.random().toString(36).slice(2, 7)}` } as CartLine;
  write(same ? current.map((existing) => (existing.id === same.id ? next : existing)) : [...current, next]);
  return { added: true, replaced: Boolean(same), full: false };
}

export function removeFromCart(id: string) {
  write(snapshot().filter((line) => line.id !== id));
}

export function clearCart() {
  write([]);
}

/** The lines as the server wants them. */
export const toApiLines = (lines: CartLine[]) => lines.map(({ id: _id, ...rest }) => rest);

export function useCart() {
  const lines = useSyncExternalStore(
    (listener) => {
      listeners.add(listener);
      window.addEventListener("storage", listener);
      return () => {
        listeners.delete(listener);
        window.removeEventListener("storage", listener);
      };
    },
    snapshot,
    () => [] as CartLine[],
  );

  return { lines, count: lines.length, add: addToCart, remove: removeFromCart, clear: clearCart };
}
