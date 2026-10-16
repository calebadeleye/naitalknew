import React from "react";
import type { Address } from "./api";

// Avatar colours: fixed order, picked by a stable hash of the address, so a
// sender always keeps the same colour.
const AVATAR_COLOURS = ["#7c6cf2", "#3f8cff", "#22a06b", "#f08c28", "#e5484d", "#14a5b8", "#d6409f", "#8a6d3b"];

export function initials(address: Address | null | undefined): string {
  const source = (address?.name || address?.email || "?").replace(/["']/g, "").trim();
  const parts = source.split(/[\s@._-]+/).filter(Boolean);
  return ((parts[0]?.[0] ?? "?") + (parts[1]?.[0] ?? "")).toUpperCase();
}

export function Avatar({ address, size = 40 }: { address: Address | null | undefined; size?: number }) {
  const key = address?.email || "?";
  let hash = 0;
  for (let i = 0; i < key.length; i++) hash = (hash * 31 + key.charCodeAt(i)) >>> 0;
  return (
    <span
      aria-hidden="true"
      className="inline-flex shrink-0 items-center justify-center rounded-full font-bold text-white"
      style={{ width: size, height: size, fontSize: size * 0.36, background: AVATAR_COLOURS[hash % AVATAR_COLOURS.length] }}
    >
      {initials(address)}
    </span>
  );
}

export const displayName = (address: Address | null | undefined) => address?.name || address?.email || "(unknown sender)";

export const formatAddress = (address: Address) => (address.name ? `${address.name} <${address.email}>` : address.email);

/** "09:16 AM" today, "Yesterday", "Oct 13" this year, else "13/10/2025". */
export function listDate(iso: string | null): string {
  if (!iso) return "";
  const date = new Date(iso);
  const now = new Date();
  const startOfToday = new Date(now.getFullYear(), now.getMonth(), now.getDate()).getTime();
  if (date.getTime() >= startOfToday) return date.toLocaleTimeString("en-US", { hour: "2-digit", minute: "2-digit" });
  if (date.getTime() >= startOfToday - 86400000) return "Yesterday";
  if (date.getFullYear() === now.getFullYear()) return date.toLocaleDateString("en-US", { month: "short", day: "numeric" });
  return date.toLocaleDateString("en-GB");
}

export const fullDate = (iso: string | null) =>
  iso ? new Date(iso).toLocaleString("en-US", { weekday: "short", month: "short", day: "numeric", year: "numeric", hour: "numeric", minute: "2-digit" }) : "";

export function formatBytes(bytes: number): string {
  if (bytes >= 1073741824) return `${(bytes / 1073741824).toFixed(1)} GB`;
  if (bytes >= 1048576) return `${(bytes / 1048576).toFixed(1)} MB`;
  if (bytes >= 1024) return `${Math.round(bytes / 1024)} KB`;
  return `${bytes} B`;
}

export function escapeHtml(value: string): string {
  return value.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;");
}

/**
 * The quoted original in a reply/forward is edited in the page itself (not the
 * sandboxed reader), so remote images there would load — and report the open
 * to trackers. They're dropped from the quote; inline (data:) images stay.
 */
export function withoutRemoteImages(html: string): string {
  return html.replace(/<img\b[^>]*\bsrc=["']?(?:https?:)?\/\/[^>]*>/gi, "");
}
