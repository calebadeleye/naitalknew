import type { Address, Folder, FolderRole } from "./types";

export const displayName = (a: Address | null | undefined) => (a ? a.name?.trim() || a.email : "");

export function initials(nameOrEmail: string): string {
  const clean = nameOrEmail.replace(/<.*>/, "").replace(/@.*/, "").replace(/[^\p{L}\p{N}\s._-]/gu, " ").trim();
  const parts = clean.split(/[\s._-]+/).filter(Boolean);
  if (parts.length === 0) return "?";
  if (parts.length === 1) return parts[0].slice(0, 2).toUpperCase();
  return (parts[0][0] + parts[1][0]).toUpperCase();
}

const AVATAR_COLORS = ["#a47e3b", "#16a34a", "#0891b2", "#7c3aed", "#db2777", "#ea580c", "#2563eb", "#059669"];
export function avatarColor(seed: string): string {
  let hash = 0;
  for (const ch of seed.toLowerCase()) hash = (hash * 31 + ch.charCodeAt(0)) | 0;
  return AVATAR_COLORS[Math.abs(hash) % AVATAR_COLORS.length];
}

const pad = (n: number) => String(n).padStart(2, "0");
const MONTHS = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];
export const MONTH_NAMES = ["January", "February", "March", "April", "May", "June", "July", "August", "September", "October", "November", "December"];
const DAYS = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];

export function timeOfDay(d: Date): string {
  const h = d.getHours();
  return `${pad(((h + 11) % 12) + 1)}:${pad(d.getMinutes())} ${h < 12 ? "AM" : "PM"}`;
}

/** List date: time today, "Oct 20" this year, else "20/10/2025". */
export function shortDate(iso: string | null, now = new Date()): string {
  if (!iso) return "";
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return "";
  if (d.toDateString() === now.toDateString()) return timeOfDay(d);
  if (d.getFullYear() === now.getFullYear()) return `${MONTHS[d.getMonth()]} ${d.getDate()}`;
  return `${pad(d.getDate())}/${pad(d.getMonth() + 1)}/${d.getFullYear()}`;
}

export function fullDate(iso: string | null): string {
  if (!iso) return "";
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return "";
  return `${DAYS[d.getDay()]}, ${MONTHS[d.getMonth()]} ${d.getDate()}, ${d.getFullYear()} ${timeOfDay(d)}`;
}

export const ymd = (d: Date) => `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;

export function bytes(n: number): string {
  if (n < 1024) return `${n} B`;
  if (n < 1024 * 1024) return `${(n / 1024).toFixed(0)} KB`;
  if (n < 1024 ** 3) return `${(n / 1024 / 1024).toFixed(1)} MB`;
  return `${(n / 1024 ** 3).toFixed(1)} GB`;
}

export function escapeHtml(text: string): string {
  return text.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;");
}

/** Quoted originals in replies don't load remote images (trackers), like the web app. */
export function withoutRemoteImages(html: string): string {
  return html.replace(/<img\b[^>]*\bsrc=["']?(?:https?:)?\/\/[^>]*>/gi, "");
}

export function roleOf(folders: Folder[], path: string): FolderRole {
  return folders.find((f) => f.path === path)?.role ?? (path.toUpperCase() === "INBOX" ? "inbox" : null);
}

export function folderFor(folders: Folder[], role: Exclude<FolderRole, null>): Folder | undefined {
  return folders.find((f) => f.role === role);
}

export function folderLabel(folder: Folder): string {
  switch (folder.role) {
    case "inbox":
      return "Inbox";
    case "sent":
      return "Sent";
    case "drafts":
      return "Drafts";
    case "junk":
      return "Spam";
    case "trash":
      return "Trash";
    case "archive":
      return "Archive";
    default:
      return folder.name;
  }
}

/** Split "a@x.com, b@y.com; c@z.com" into addresses. */
export function splitAddresses(value: string): string[] {
  return value.split(/[,;\s]+/).map((s) => s.trim()).filter(Boolean);
}

export const isEmail = (value: string) => /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(value);
