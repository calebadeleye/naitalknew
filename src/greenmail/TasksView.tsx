import React, { useCallback, useEffect, useState } from "react";
import { CalendarDays, Loader2, Mail, Plus, Trash2 } from "lucide-react";
import { gm, type Task } from "./api";
import { useFeedback } from "./feedback";
import { dueLabel } from "./planner";
import { announceChange, useOnChange } from "./sync";

const TONE: Record<string, string> = { overdue: "text-red-600", today: "text-[#c2410c]", soon: "text-[#1a7f3f]", later: "text-slate-500" };

/** Shared by the Tasks page and the side-panel card. */
export function useTasks(token: string, status: "open" | "done", onSessionError: (error: unknown) => void) {
  const [tasks, setTasks] = useState<Task[] | null>(null);
  const { toast, confirm } = useFeedback();

  const load = useCallback(
    () =>
      gm<{ tasks: Task[] }>(`/tasks?status=${status}`, token)
        .then((response) => setTasks(response.tasks))
        .catch((error) => {
          onSessionError(error);
          setTasks([]);
        }),
    [token, status, onSessionError],
  );

  useEffect(() => {
    void load();
  }, [load]);

  // The Tasks page and the side-panel card stay in step.
  useOnChange("tasks", () => void load());

  const failed = (error: unknown) => {
    onSessionError(error);
    toast(error instanceof Error ? error.message : "That did not work.", "error");
  };

  const add = async (title: string, dueDate: string | null) => {
    try {
      await gm("/tasks", token, { method: "POST", body: JSON.stringify({ title, due_date: dueDate }) });
      toast("Task added.");
    } catch (error) {
      failed(error);
    }
    announceChange("tasks");
  };

  const update = async (task: Task, changes: Partial<Pick<Task, "title" | "due_date" | "done">>) => {
    // Feels instant: tick first, then confirm with the server.
    setTasks((current) => current && (changes.done !== undefined ? current.filter((t) => t.id !== task.id) : current.map((t) => (t.id === task.id ? { ...t, ...changes } : t))));
    try {
      await gm(`/tasks/${task.id}`, token, { method: "PATCH", body: JSON.stringify(changes) });
      if (changes.done !== undefined) toast(changes.done ? "Task completed." : "Task moved back to To do.");
      else toast("Due date updated.");
    } catch (error) {
      failed(error);
    }
    announceChange("tasks");
  };

  const remove = async (task: Task) => {
    if (!(await confirm({ title: "Delete this task?", message: task.title, confirmLabel: "Delete", danger: true }))) return;
    setTasks((current) => current && current.filter((t) => t.id !== task.id));
    try {
      await gm(`/tasks/${task.id}`, token, { method: "DELETE" });
      toast("Task deleted.");
    } catch (error) {
      failed(error);
    }
    announceChange("tasks");
  };

  return { tasks, add, update, remove };
}

export function TaskRow({
  task,
  onToggle,
  onDue,
  onRemove,
  onOpenEmail,
  compact = false,
}: {
  task: Task;
  onToggle: () => void;
  onDue?: (due: string | null) => void;
  onRemove?: () => void;
  onOpenEmail?: () => void;
  compact?: boolean;
}) {
  const due = dueLabel(task.due_date);
  return (
    <li className="group flex items-center gap-3 py-1.5">
      <input type="checkbox" checked={task.done} onChange={onToggle} aria-label={`${task.done ? "Reopen" : "Complete"} ${task.title}`} className="h-4 w-4 shrink-0 accent-[#1f9d4c]" />
      <span className={`min-w-0 flex-1 truncate text-sm ${task.done ? "text-slate-400 line-through" : "text-slate-800"}`}>{task.title}</span>
      {task.source_message_id && onOpenEmail && (
        <button type="button" title={`Open the email: ${task.source_subject ?? ""}`} aria-label={`Open the email for ${task.title}`} className="inline-flex shrink-0 items-center gap-1 rounded px-1.5 py-0.5 text-xs text-slate-500 hover:bg-slate-100 hover:text-slate-800" onClick={onOpenEmail}>
          <Mail className="h-3.5 w-3.5" /> <span className="hidden sm:inline">Email</span>
        </button>
      )}
      {due && !task.done && <span className={`shrink-0 text-xs font-semibold ${TONE[due.tone]}`}>{due.text}</span>}
      {!compact && onDue && (
        <label className="relative shrink-0 cursor-pointer rounded p-1 text-slate-400 hover:bg-slate-100 hover:text-slate-700" title="Set due date">
          <CalendarDays className="h-4 w-4" />
          <input type="date" className="absolute inset-0 cursor-pointer opacity-0" value={task.due_date ?? ""} onChange={(event) => onDue(event.target.value || null)} aria-label={`Due date for ${task.title}`} />
        </label>
      )}
      {!compact && onRemove && (
        <button type="button" aria-label={`Delete ${task.title}`} className="shrink-0 rounded p-1 text-slate-400 hover:bg-slate-100 hover:text-red-600 sm:opacity-0 sm:group-hover:opacity-100" onClick={onRemove}>
          <Trash2 className="h-4 w-4" />
        </button>
      )}
    </li>
  );
}

/** The Tasks page: add, tick off, date and delete. */
export function TasksView({ token, onSessionError, onOpenEmail }: { token: string; onSessionError: (error: unknown) => void; onOpenEmail?: (messageId: string, folder?: string | null) => void }) {
  const [status, setStatus] = useState<"open" | "done">("open");
  const { tasks, add, update, remove } = useTasks(token, status, onSessionError);
  const [title, setTitle] = useState("");
  const [due, setDue] = useState("");

  return (
    <section className="flex min-h-0 flex-1 flex-col overflow-y-auto bg-white p-3 sm:p-6">
      <div className="mx-auto w-full max-w-2xl">
        <div className="flex flex-wrap items-center gap-2">
          <h1 className="mr-auto text-xl font-black text-slate-900 sm:text-2xl">Tasks</h1>
          {(["open", "done"] as const).map((option) => (
            <button key={option} type="button" aria-pressed={status === option} onClick={() => setStatus(option)} className={`rounded-full px-3 py-1 text-sm font-semibold ${status === option ? "bg-[#e3f4e9] text-[#14632f]" : "text-slate-600 hover:bg-slate-100"}`}>
              {option === "open" ? "To do" : "Completed"}
            </button>
          ))}
        </div>

        {status === "open" && (
          <form
            className="mt-4 flex flex-wrap items-center gap-2 rounded-xl border border-slate-200 p-2"
            onSubmit={(event) => {
              event.preventDefault();
              if (!title.trim()) return;
              void add(title.trim(), due || null);
              setTitle("");
              setDue("");
            }}
          >
            <Plus className="ml-1 h-4 w-4 text-slate-400" />
            <input value={title} onChange={(event) => setTitle(event.target.value)} placeholder="Add a task…" aria-label="New task" maxLength={255} className="min-w-0 flex-1 bg-transparent py-1.5 text-sm outline-none" />
            <input type="date" value={due} onChange={(event) => setDue(event.target.value)} aria-label="Due date" className="rounded-md border border-slate-200 px-2 py-1 text-xs text-slate-600" />
            <button type="submit" disabled={!title.trim()} className="rounded-lg bg-[#1f9d4c] px-3 py-1.5 text-sm font-bold text-white disabled:opacity-50">
              Add
            </button>
          </form>
        )}

        {tasks === null ? (
          <Loader2 className="mt-6 h-5 w-5 animate-spin text-slate-400" />
        ) : tasks.length === 0 ? (
          <p className="mt-6 text-sm text-slate-500">{status === "open" ? "Nothing to do — add a task above." : "No completed tasks yet."}</p>
        ) : (
          <ul className="mt-4 divide-y divide-slate-100">
            {tasks.map((task) => (
              <React.Fragment key={task.id}>
                <TaskRow
                  task={task}
                  onToggle={() => void update(task, { done: !task.done })}
                  onDue={(value) => void update(task, { due_date: value })}
                  onRemove={() => void remove(task)}
                  onOpenEmail={onOpenEmail && task.source_message_id ? () => onOpenEmail(task.source_message_id as string, task.source_folder) : undefined}
                />
              </React.Fragment>
            ))}
          </ul>
        )}
      </div>
    </section>
  );
}
