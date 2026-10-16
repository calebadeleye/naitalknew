import React, { useCallback, useEffect, useState } from "react";
import { Loader2, Pin, PinOff, Plus, Search, StickyNote, Trash2, X } from "lucide-react";
import { gm, type Note } from "./api";
import { useFeedback } from "./feedback";
import { announceChange, useOnChange } from "./sync";

const COLORS: Record<NonNullable<Note["color"]>, { card: string; dot: string; label: string }> = {
  yellow: { card: "bg-[#fff8db] border-[#f5e3a3]", dot: "bg-[#f5c518]", label: "Yellow" },
  green: { card: "bg-[#e9f7ee] border-[#bfe5cc]", dot: "bg-[#22a04f]", label: "Green" },
  blue: { card: "bg-[#e8f1ff] border-[#c3d8fb]", dot: "bg-[#3f8cff]", label: "Blue" },
  pink: { card: "bg-[#fdecf4] border-[#f6c6dc]", dot: "bg-[#d6409f]", label: "Pink" },
  gray: { card: "bg-slate-50 border-slate-200", dot: "bg-slate-400", label: "Gray" },
};

type Draft = { id?: number; title: string; body: string; color: Note["color"]; pinned: boolean };

/** Notes: quick, colourful, pinned ones first. */
export function NotesView({ token, onSessionError }: { token: string; onSessionError: (error: unknown) => void }) {
  const [notes, setNotes] = useState<Note[] | null>(null);
  const [query, setQuery] = useState("");
  const [editing, setEditing] = useState<Draft | null>(null);
  const [busy, setBusy] = useState(false);
  const { toast, confirm } = useFeedback();

  const load = useCallback(() => {
    gm<{ notes: Note[] }>(`/notes${query ? `?q=${encodeURIComponent(query)}` : ""}`, token)
      .then((response) => setNotes(response.notes))
      .catch((error) => {
        onSessionError(error);
        setNotes([]);
      });
  }, [token, query, onSessionError]);

  useEffect(() => {
    const timer = window.setTimeout(load, query ? 250 : 0);
    return () => window.clearTimeout(timer);
  }, [load, query]);
  useOnChange("notes", load);

  const save = async () => {
    if (!editing) return;
    if (!editing.title.trim() && !editing.body.trim()) {
      setEditing(null);
      return;
    }
    setBusy(true);
    try {
      const body = JSON.stringify({ title: editing.title.trim() || null, body: editing.body.trim() || null, color: editing.color, pinned: editing.pinned });
      const result = await gm<{ message: string }>(editing.id ? `/notes/${editing.id}` : "/notes", token, { method: editing.id ? "PUT" : "POST", body });
      toast(result.message);
      setEditing(null);
      announceChange("notes");
    } catch (error) {
      onSessionError(error);
      toast(error instanceof Error ? error.message : "Could not save the note.", "error");
    } finally {
      setBusy(false);
    }
  };

  const togglePin = async (note: Note) => {
    try {
      await gm(`/notes/${note.id}`, token, { method: "PUT", body: JSON.stringify({ title: note.title, body: note.body, color: note.color, pinned: !note.pinned }) });
      toast(note.pinned ? "Note unpinned." : "Note pinned.");
      announceChange("notes");
    } catch (error) {
      onSessionError(error);
      toast(error instanceof Error ? error.message : "That did not work.", "error");
    }
  };

  const remove = async (note: Note) => {
    if (!(await confirm({ title: "Delete this note?", message: note.title || note.body?.slice(0, 80) || undefined, confirmLabel: "Delete", danger: true }))) return;
    try {
      await gm(`/notes/${note.id}`, token, { method: "DELETE" });
      toast("Note deleted.");
      setEditing(null);
      announceChange("notes");
    } catch (error) {
      onSessionError(error);
      toast(error instanceof Error ? error.message : "Could not delete the note.", "error");
    }
  };

  return (
    <section className="flex min-h-0 flex-1 flex-col overflow-y-auto bg-white p-3 sm:p-6">
      <div className="mx-auto w-full max-w-5xl">
        <div className="flex flex-wrap items-center gap-2">
          <h1 className="mr-auto text-xl font-black text-slate-900 sm:text-2xl">Notes</h1>
          <label className="flex min-w-0 flex-1 items-center gap-2 rounded-lg bg-slate-100 px-3 py-2 sm:max-w-xs">
            <Search className="h-4 w-4 shrink-0 text-slate-500" />
            <input value={query} onChange={(event) => setQuery(event.target.value)} placeholder="Search notes" aria-label="Search notes" className="min-w-0 flex-1 bg-transparent text-sm outline-none" />
          </label>
          <button type="button" className="inline-flex items-center gap-1.5 rounded-lg bg-[#1f9d4c] px-3 py-2 text-sm font-bold text-white" onClick={() => setEditing({ title: "", body: "", color: "yellow", pinned: false })}>
            <Plus className="h-4 w-4" /> New note
          </button>
        </div>

        {notes === null ? (
          <Loader2 className="mt-6 h-5 w-5 animate-spin text-slate-400" />
        ) : notes.length === 0 ? (
          <div className="mt-12 flex flex-col items-center gap-2 text-center text-slate-500">
            <StickyNote className="h-10 w-10 text-slate-300" />
            <p className="text-sm">{query ? "No notes match your search." : "Jot down ideas, reminders and anything worth keeping."}</p>
          </div>
        ) : (
          <ul className="mt-5 grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
            {notes.map((note) => {
              const colour = COLORS[note.color ?? "yellow"];
              return (
                <li key={note.id} className={`group relative rounded-xl border p-4 ${colour.card}`}>
                  <button type="button" className="block w-full text-left" onClick={() => setEditing({ id: note.id, title: note.title ?? "", body: note.body ?? "", color: note.color, pinned: note.pinned })}>
                    {note.title && <p className="pr-14 font-bold text-slate-900">{note.title}</p>}
                    {note.body && <p className="mt-1 line-clamp-6 whitespace-pre-wrap text-sm text-slate-700">{note.body}</p>}
                    <p className="mt-3 text-[11px] text-slate-500">{new Date(note.updated_at).toLocaleString("en-US", { month: "short", day: "numeric", hour: "numeric", minute: "2-digit" })}</p>
                  </button>
                  <span className="absolute right-2 top-2 flex gap-0.5">
                    <button type="button" aria-label={note.pinned ? "Unpin note" : "Pin note"} title={note.pinned ? "Unpin" : "Pin"} className={`rounded p-1.5 hover:bg-black/5 ${note.pinned ? "text-[#15803d]" : "text-slate-400 sm:opacity-0 sm:group-hover:opacity-100"}`} onClick={() => void togglePin(note)}>
                      {note.pinned ? <Pin className="h-4 w-4 fill-current" /> : <Pin className="h-4 w-4" />}
                    </button>
                    <button type="button" aria-label="Delete note" title="Delete" className="rounded p-1.5 text-slate-400 hover:bg-black/5 hover:text-red-600 sm:opacity-0 sm:group-hover:opacity-100" onClick={() => void remove(note)}>
                      <Trash2 className="h-4 w-4" />
                    </button>
                  </span>
                </li>
              );
            })}
          </ul>
        )}
      </div>

      {editing && (
        <div className="fixed inset-0 z-50 flex items-end justify-center bg-slate-900/40 sm:items-center sm:p-4" role="dialog" aria-modal="true" aria-label={editing.id ? "Edit note" : "New note"}>
          <form
            className={`w-full max-w-lg rounded-t-2xl border p-4 shadow-xl sm:rounded-2xl ${COLORS[editing.color ?? "yellow"].card}`}
            onSubmit={(event) => {
              event.preventDefault();
              void save();
            }}
          >
            <div className="flex items-center gap-2">
              <input value={editing.title} onChange={(event) => setEditing({ ...editing, title: event.target.value })} placeholder="Title" aria-label="Title" maxLength={255} className="min-w-0 flex-1 bg-transparent text-lg font-bold text-slate-900 outline-none placeholder:text-slate-400" autoFocus={!editing.id} />
              <button type="button" aria-label={editing.pinned ? "Unpin" : "Pin"} aria-pressed={editing.pinned} className={`rounded p-1.5 hover:bg-black/5 ${editing.pinned ? "text-[#15803d]" : "text-slate-500"}`} onClick={() => setEditing({ ...editing, pinned: !editing.pinned })}>
                {editing.pinned ? <PinOff className="h-4 w-4" /> : <Pin className="h-4 w-4" />}
              </button>
              <button type="button" aria-label="Close" className="rounded p-1.5 text-slate-500 hover:bg-black/5" onClick={() => setEditing(null)}>
                <X className="h-4 w-4" />
              </button>
            </div>
            <textarea value={editing.body} onChange={(event) => setEditing({ ...editing, body: event.target.value })} placeholder="Write a note…" aria-label="Note" rows={9} maxLength={20000} className="mt-2 w-full resize-y bg-transparent text-sm leading-6 text-slate-800 outline-none placeholder:text-slate-400" autoFocus={Boolean(editing.id)} />
            <div className="mt-2 flex flex-wrap items-center gap-2">
              <span className="flex gap-1.5" role="radiogroup" aria-label="Colour">
                {(Object.keys(COLORS) as Array<NonNullable<Note["color"]>>).map((key) => (
                  <button key={key} type="button" role="radio" aria-checked={editing.color === key} aria-label={COLORS[key].label} className={`h-6 w-6 rounded-full ${COLORS[key].dot} ${editing.color === key ? "ring-2 ring-slate-900 ring-offset-2" : ""}`} onClick={() => setEditing({ ...editing, color: key })} />
                ))}
              </span>
              {editing.id && (
                <button type="button" className="ml-auto rounded-lg px-3 py-2 text-sm font-semibold text-red-600 hover:bg-red-50" onClick={() => { const note = notes?.find((n) => n.id === editing.id); if (note) void remove(note); }}>
                  Delete
                </button>
              )}
              <button type="submit" disabled={busy} className={`${editing.id ? "" : "ml-auto"} rounded-lg bg-[#1f9d4c] px-4 py-2 text-sm font-bold text-white disabled:opacity-60`}>
                {busy ? "Saving…" : "Save"}
              </button>
            </div>
          </form>
        </div>
      )}
    </section>
  );
}
