import React, { useCallback, useEffect, useMemo, useState } from "react";
import { ChevronLeft, ChevronRight, Clock, Loader2, MapPin, Plus } from "lucide-react";
import { gm, type CalendarEvent } from "./api";
import { EventModal } from "./EventModal";
import { addDays, eventOnDay, isoDate, monthGrid, sameDay, timeLabel } from "./planner";

const WEEKDAYS = ["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"];

/** Month view with the selected day's agenda alongside (below on phones). */
export function CalendarView({ token, onSessionError, flash }: { token: string; onSessionError: (error: unknown) => void; flash: (text: string) => void }) {
  const [month, setMonth] = useState(() => new Date(new Date().getFullYear(), new Date().getMonth(), 1));
  const [selected, setSelected] = useState(() => new Date());
  const [events, setEvents] = useState<CalendarEvent[] | null>(null);
  const [editing, setEditing] = useState<{ event: CalendarEvent | null } | null>(null);
  const days = useMemo(() => monthGrid(month), [month]);

  const load = useCallback(() => {
    const from = days[0];
    const to = addDays(days[days.length - 1], 1);
    gm<{ events: CalendarEvent[] }>(`/events?from=${encodeURIComponent(from.toISOString())}&to=${encodeURIComponent(to.toISOString())}`, token)
      .then((response) => setEvents(response.events))
      .catch((error) => {
        onSessionError(error);
        setEvents([]);
      });
  }, [days, token, onSessionError]);

  useEffect(load, [load]);

  const today = new Date();
  const dayEvents = (events ?? []).filter((event) => eventOnDay(event, selected));
  const shift = (months: number) => setMonth(new Date(month.getFullYear(), month.getMonth() + months, 1));

  return (
    <section className="flex min-h-0 flex-1 flex-col overflow-y-auto bg-white lg:flex-row lg:overflow-hidden">
      <div className="flex min-h-0 flex-1 flex-col p-3 sm:p-5 lg:overflow-y-auto">
        <div className="flex flex-wrap items-center gap-2">
          <h1 className="mr-auto text-xl font-black text-slate-900 sm:text-2xl">{month.toLocaleDateString("en-US", { month: "long", year: "numeric" })}</h1>
          <button type="button" className="rounded-lg border border-slate-200 px-3 py-1.5 text-sm font-semibold text-slate-700 hover:bg-slate-50" onClick={() => { setMonth(new Date(today.getFullYear(), today.getMonth(), 1)); setSelected(today); }}>
            Today
          </button>
          <button type="button" aria-label="Previous month" className="rounded-lg border border-slate-200 p-1.5 text-slate-700 hover:bg-slate-50" onClick={() => shift(-1)}>
            <ChevronLeft className="h-4 w-4" />
          </button>
          <button type="button" aria-label="Next month" className="rounded-lg border border-slate-200 p-1.5 text-slate-700 hover:bg-slate-50" onClick={() => shift(1)}>
            <ChevronRight className="h-4 w-4" />
          </button>
          <button type="button" className="inline-flex items-center gap-1.5 rounded-lg bg-[#1f9d4c] px-3 py-1.5 text-sm font-bold text-white" onClick={() => setEditing({ event: null })}>
            <Plus className="h-4 w-4" /> New event
          </button>
        </div>

        <div className="mt-4 grid grid-cols-7 text-center text-[11px] font-bold uppercase tracking-wide text-slate-400">
          {WEEKDAYS.map((day) => (
            <div key={day} className="pb-2">{day}</div>
          ))}
        </div>
        <div className="grid flex-1 grid-cols-7 gap-px overflow-hidden rounded-xl border border-slate-200 bg-slate-200">
          {days.map((day) => {
            const inMonth = day.getMonth() === month.getMonth();
            const onDay = (events ?? []).filter((event) => eventOnDay(event, day));
            const isSelected = sameDay(day, selected);
            return (
              <button
                key={isoDate(day)}
                type="button"
                onClick={() => setSelected(day)}
                onDoubleClick={() => { setSelected(day); setEditing({ event: null }); }}
                aria-label={`${day.toDateString()}${onDay.length ? `, ${onDay.length} event${onDay.length === 1 ? "" : "s"}` : ""}`}
                aria-pressed={isSelected}
                className={`flex min-h-[52px] flex-col items-stretch gap-1 p-1 text-left sm:min-h-[84px] sm:p-1.5 ${inMonth ? "bg-white" : "bg-slate-50"} ${isSelected ? "ring-2 ring-inset ring-[#1f9d4c]" : ""}`}
              >
                <span className={`inline-flex h-6 w-6 items-center justify-center self-start rounded-full text-xs font-bold ${sameDay(day, today) ? "bg-[#1f9d4c] text-white" : inMonth ? "text-slate-700" : "text-slate-400"}`}>
                  {day.getDate()}
                </span>
                {/* Phones: dots. Larger screens: the first titles. */}
                <span className="flex gap-0.5 sm:hidden">
                  {onDay.slice(0, 3).map((event) => <span key={event.id} className="h-1.5 w-1.5 rounded-full bg-[#1f9d4c]" />)}
                </span>
                <span className="hidden flex-col gap-0.5 sm:flex">
                  {onDay.slice(0, 2).map((event) => (
                    <span key={event.id} className="truncate rounded bg-[#e3f4e9] px-1.5 py-0.5 text-[11px] font-semibold text-[#14632f]">
                      {!event.all_day && `${timeLabel(event.starts_at)} `}{event.title}
                    </span>
                  ))}
                  {onDay.length > 2 && <span className="px-1 text-[11px] text-slate-500">+{onDay.length - 2} more</span>}
                </span>
              </button>
            );
          })}
        </div>
      </div>

      <aside className="border-t border-slate-200 p-4 sm:p-5 lg:w-[320px] lg:shrink-0 lg:overflow-y-auto lg:border-l lg:border-t-0">
        <p className="text-sm font-bold text-slate-900">{selected.toLocaleDateString("en-US", { weekday: "long", month: "long", day: "numeric" })}</p>
        {events === null ? (
          <Loader2 className="mt-4 h-5 w-5 animate-spin text-slate-400" />
        ) : dayEvents.length === 0 ? (
          <p className="mt-3 text-sm text-slate-500">Nothing planned.</p>
        ) : (
          <ul className="mt-3 grid gap-2">
            {dayEvents.map((event) => (
              <li key={event.id}>
                <button type="button" className="w-full rounded-lg border border-slate-200 p-3 text-left hover:border-[#1f9d4c]" onClick={() => setEditing({ event })}>
                  <p className="font-semibold text-slate-900">{event.title}</p>
                  <p className="mt-1 flex items-center gap-1.5 text-xs text-slate-500">
                    <Clock className="h-3.5 w-3.5" /> {event.all_day ? "All day" : `${timeLabel(event.starts_at)}${event.ends_at ? ` – ${timeLabel(event.ends_at)}` : ""}`}
                  </p>
                  {event.location && (
                    <p className="mt-0.5 flex items-center gap-1.5 truncate text-xs text-slate-500">
                      <MapPin className="h-3.5 w-3.5 shrink-0" /> {event.location}
                    </p>
                  )}
                </button>
              </li>
            ))}
          </ul>
        )}
        <button type="button" className="mt-3 inline-flex items-center gap-1.5 text-sm font-bold text-[#1a7f3f] hover:underline" onClick={() => setEditing({ event: null })}>
          <Plus className="h-4 w-4" /> Add to this day
        </button>
      </aside>

      {editing && (
        <EventModal
          token={token}
          event={editing.event}
          defaultDate={selected}
          onSessionError={onSessionError}
          onClose={() => setEditing(null)}
          onSaved={(message) => {
            setEditing(null);
            flash(message);
            load();
          }}
        />
      )}
    </section>
  );
}
