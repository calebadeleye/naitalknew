/** Date helpers for Green Mail's calendar and tasks (all in the viewer's own time zone). */

export const pad = (n: number) => String(n).padStart(2, "0");

/** "2026-10-16" for a local date. */
export const isoDate = (date: Date) => `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}`;

export const startOfDay = (date: Date) => new Date(date.getFullYear(), date.getMonth(), date.getDate());

export const addDays = (date: Date, days: number) => new Date(date.getFullYear(), date.getMonth(), date.getDate() + days);

export const sameDay = (a: Date, b: Date) => isoDate(a) === isoDate(b);

/** 42 days (6 weeks, Monday first) covering the month that contains `month`. */
export function monthGrid(month: Date): Date[] {
  const first = new Date(month.getFullYear(), month.getMonth(), 1);
  const offset = (first.getDay() + 6) % 7;
  const start = addDays(first, -offset);
  return Array.from({ length: 42 }, (_, i) => addDays(start, i));
}

export const timeLabel = (iso: string) => new Date(iso).toLocaleTimeString("en-US", { hour: "numeric", minute: "2-digit" });

/** "Today", "Tomorrow", "Yesterday", "Overdue · Oct 12" or "Oct 20" for a task's due date. */
export function dueLabel(due: string | null): { text: string; tone: "overdue" | "today" | "soon" | "later" } | null {
  if (!due) return null;
  const today = startOfDay(new Date());
  const date = new Date(`${due}T00:00:00`);
  const days = Math.round((date.getTime() - today.getTime()) / 86400000);
  const short = date.toLocaleDateString("en-US", { month: "short", day: "numeric" });
  if (days < 0) return { text: days === -1 ? "Yesterday" : `Overdue · ${short}`, tone: "overdue" };
  if (days === 0) return { text: "Today", tone: "today" };
  if (days === 1) return { text: "Tomorrow", tone: "soon" };
  return { text: short, tone: "later" };
}

/** Does the event happen (at least partly) on this local day? */
export function eventOnDay(event: { starts_at: string; ends_at: string | null }, day: Date): boolean {
  const start = new Date(event.starts_at);
  const end = event.ends_at ? new Date(event.ends_at) : start;
  const dayStart = startOfDay(day);
  const dayEnd = addDays(dayStart, 1);
  return start < dayEnd && (end > dayStart || sameDay(start, day));
}
