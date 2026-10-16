import React, { useState } from "react";
import { Loader2, Trash2, X } from "lucide-react";
import { gm, type CalendarEvent } from "./api";
import { isoDate, pad } from "./planner";

const timeOf = (iso: string) => {
  const d = new Date(iso);
  return `${pad(d.getHours())}:${pad(d.getMinutes())}`;
};

/** Add or edit a calendar event. */
export function EventModal({
  token,
  event,
  defaultDate,
  onSaved,
  onClose,
  onSessionError,
}: {
  token: string;
  event: CalendarEvent | null;
  defaultDate: Date;
  onSaved: (message: string) => void;
  onClose: () => void;
  onSessionError: (error: unknown) => void;
}) {
  const [title, setTitle] = useState(event?.title ?? "");
  const [date, setDate] = useState(event ? isoDate(new Date(event.starts_at)) : isoDate(defaultDate));
  const [allDay, setAllDay] = useState(event?.all_day ?? false);
  const [start, setStart] = useState(event ? timeOf(event.starts_at) : "09:00");
  const [end, setEnd] = useState(event?.ends_at ? timeOf(event.ends_at) : "10:00");
  const [location, setLocation] = useState(event?.location ?? "");
  const [notes, setNotes] = useState(event?.notes ?? "");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const save = async (submit: React.FormEvent) => {
    submit.preventDefault();
    setBusy(true);
    setError(null);
    // Local wall-clock times → ISO with the browser's offset (the server stores UTC).
    const startsAt = new Date(`${date}T${allDay ? "00:00" : start}:00`);
    const endsAt = allDay ? new Date(`${date}T23:59:00`) : new Date(`${date}T${end}:00`);
    try {
      await gm(event ? `/events/${event.id}` : "/events", token, {
        method: event ? "PUT" : "POST",
        body: JSON.stringify({ title: title.trim(), starts_at: startsAt.toISOString(), ends_at: endsAt.toISOString(), all_day: allDay, location: location.trim() || null, notes: notes.trim() || null }),
      });
      onSaved(event ? "Event updated." : "Event added.");
    } catch (err) {
      onSessionError(err);
      setError(err instanceof Error ? err.message : "Could not save the event.");
    } finally {
      setBusy(false);
    }
  };

  const remove = async () => {
    if (!event || !window.confirm(`Delete "${event.title}"?`)) return;
    setBusy(true);
    try {
      await gm(`/events/${event.id}`, token, { method: "DELETE" });
      onSaved("Event deleted.");
    } catch (err) {
      onSessionError(err);
      setError(err instanceof Error ? err.message : "Could not delete the event.");
      setBusy(false);
    }
  };

  const input = "mt-1 w-full rounded-lg border border-slate-300 px-3 py-2 text-sm text-slate-900 outline-none focus:border-[#1f9d4c]";

  return (
    <div className="fixed inset-0 z-50 flex items-end justify-center bg-slate-900/40 sm:items-center sm:p-4" role="dialog" aria-modal="true" aria-label={event ? "Edit event" : "New event"}>
      <form onSubmit={save} className="max-h-[92dvh] w-full max-w-md overflow-y-auto rounded-t-2xl bg-white p-5 shadow-xl sm:rounded-2xl">
        <div className="flex items-center justify-between">
          <h2 className="text-lg font-black text-slate-900">{event ? "Edit event" : "New event"}</h2>
          <button type="button" aria-label="Close" className="rounded p-1 text-slate-500 hover:bg-slate-100" onClick={onClose}>
            <X className="h-5 w-5" />
          </button>
        </div>
        <label className="mt-3 block text-sm font-semibold text-slate-700">
          Title
          <input className={input} value={title} onChange={(e) => setTitle(e.target.value)} required maxLength={200} autoFocus placeholder="e.g. Client call" />
        </label>
        <div className="mt-3 grid grid-cols-2 gap-3">
          <label className="col-span-2 block text-sm font-semibold text-slate-700 sm:col-span-1">
            Date
            <input type="date" className={input} value={date} onChange={(e) => setDate(e.target.value)} required />
          </label>
          <label className="col-span-2 flex items-end gap-2 pb-2 text-sm text-slate-700 sm:col-span-1">
            <input type="checkbox" className="h-4 w-4 accent-[#1f9d4c]" checked={allDay} onChange={(e) => setAllDay(e.target.checked)} /> All day
          </label>
          {!allDay && (
            <>
              <label className="block text-sm font-semibold text-slate-700">
                Starts
                <input type="time" className={input} value={start} onChange={(e) => setStart(e.target.value)} required />
              </label>
              <label className="block text-sm font-semibold text-slate-700">
                Ends
                <input type="time" className={input} value={end} onChange={(e) => setEnd(e.target.value)} required />
              </label>
            </>
          )}
        </div>
        <label className="mt-3 block text-sm font-semibold text-slate-700">
          Where (place or meeting link)
          <input className={input} value={location} onChange={(e) => setLocation(e.target.value)} maxLength={255} placeholder="e.g. Google Meet" />
        </label>
        <label className="mt-3 block text-sm font-semibold text-slate-700">
          Notes
          <textarea className={input} rows={3} value={notes} onChange={(e) => setNotes(e.target.value)} maxLength={5000} />
        </label>
        {error && <p className="mt-3 rounded-md bg-red-50 px-3 py-2 text-xs text-red-700">{error}</p>}
        <div className="mt-5 flex items-center gap-2">
          {event && (
            <button type="button" disabled={busy} className="inline-flex items-center gap-1.5 rounded-lg px-3 py-2 text-sm font-semibold text-red-600 hover:bg-red-50" onClick={() => void remove()}>
              <Trash2 className="h-4 w-4" /> Delete
            </button>
          )}
          <button type="button" className="ml-auto rounded-lg px-4 py-2 text-sm font-semibold text-slate-600 hover:bg-slate-100" onClick={onClose}>
            Cancel
          </button>
          <button type="submit" disabled={busy || !title.trim()} className="inline-flex items-center gap-2 rounded-lg bg-[#1f9d4c] px-4 py-2 text-sm font-bold text-white disabled:opacity-60">
            {busy && <Loader2 className="h-4 w-4 animate-spin" />} Save
          </button>
        </div>
      </form>
    </div>
  );
}
