import React, { createContext, useCallback, useContext, useEffect, useRef, useState } from "react";
import { AlertTriangle, CheckCircle2, Mail, OctagonAlert, X } from "lucide-react";

/**
 * Toasts ("Moved to Trash.") and confirmation dialogs ("Delete this email?")
 * for the whole of Green Mail. Every action reports back with a toast.
 */
type Tone = "success" | "error" | "info";
type Toast = { id: number; text: string; tone: Tone; action?: { label: string; run: () => void } };
type ConfirmOptions = { title: string; message?: string; confirmLabel?: string; danger?: boolean };

type Feedback = {
  toast: (text: string, tone?: Tone, action?: Toast["action"]) => void;
  confirm: (options: ConfirmOptions) => Promise<boolean>;
};

const FeedbackContext = createContext<Feedback>({
  toast: () => undefined,
  confirm: async (options) => window.confirm(options.title),
});

export const useFeedback = () => useContext(FeedbackContext);

let nextId = 1;

export function FeedbackProvider({ children }: { children: React.ReactNode }) {
  const [toasts, setToasts] = useState<Toast[]>([]);
  const [dialog, setDialog] = useState<(ConfirmOptions & { resolve: (ok: boolean) => void }) | null>(null);

  const dismiss = useCallback((id: number) => setToasts((current) => current.filter((t) => t.id !== id)), []);

  const toast = useCallback<Feedback["toast"]>(
    (text, tone = "success", action) => {
      const id = nextId++;
      // Newest on top; at most three at once.
      setToasts((current) => [{ id, text, tone, action }, ...current].slice(0, 3));
      window.setTimeout(() => dismiss(id), action ? 9000 : tone === "error" ? 7000 : 4500);
    },
    [dismiss],
  );

  const confirm = useCallback<Feedback["confirm"]>((options) => new Promise<boolean>((resolve) => setDialog({ ...options, resolve })), []);

  const close = (ok: boolean) => {
    dialog?.resolve(ok);
    setDialog(null);
  };

  return (
    <FeedbackContext.Provider value={{ toast, confirm }}>
      {children}
      <div className="pointer-events-none fixed inset-x-0 top-3 z-[70] flex flex-col items-center gap-2 px-3" aria-live="polite">
        {toasts.map((t) => (
          <div
            key={t.id}
            role={t.tone === "error" ? "alert" : "status"}
            className={`pointer-events-auto flex w-full max-w-md items-center gap-2.5 rounded-xl px-4 py-3 text-sm font-semibold text-white shadow-xl ${t.tone === "error" ? "bg-red-600" : t.tone === "info" ? "bg-[#0f1a2b]" : "bg-[#15803d]"}`}
          >
            {t.tone === "error" ? <OctagonAlert className="h-4 w-4 shrink-0" /> : t.tone === "info" ? <Mail className="h-4 w-4 shrink-0 text-[#4ade80]" /> : <CheckCircle2 className="h-4 w-4 shrink-0" />}
            <span className="min-w-0 flex-1">{t.text}</span>
            {t.action && (
              <button
                type="button"
                className="shrink-0 rounded-md bg-white/15 px-2.5 py-1 text-xs font-bold hover:bg-white/25"
                onClick={() => {
                  t.action?.run();
                  dismiss(t.id);
                }}
              >
                {t.action.label}
              </button>
            )}
            <button type="button" aria-label="Dismiss" className="shrink-0 rounded p-0.5 text-white/70 hover:text-white" onClick={() => dismiss(t.id)}>
              <X className="h-4 w-4" />
            </button>
          </div>
        ))}
      </div>
      {dialog && <ConfirmDialog {...dialog} onClose={close} />}
    </FeedbackContext.Provider>
  );
}

function ConfirmDialog({ title, message, confirmLabel = "Confirm", danger = false, onClose }: ConfirmOptions & { onClose: (ok: boolean) => void }) {
  const confirmRef = useRef<HTMLButtonElement>(null);

  useEffect(() => {
    confirmRef.current?.focus();
    const onKey = (event: KeyboardEvent) => event.key === "Escape" && onClose(false);
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [onClose]);

  return (
    <div className="fixed inset-0 z-[80] flex items-end justify-center bg-slate-900/50 p-3 sm:items-center" onMouseDown={(event) => event.target === event.currentTarget && onClose(false)}>
      <div role="alertdialog" aria-modal="true" aria-labelledby="gm-confirm-title" className="w-full max-w-sm rounded-2xl bg-white p-5 shadow-2xl">
        <div className="flex gap-3">
          <span className={`flex h-10 w-10 shrink-0 items-center justify-center rounded-full ${danger ? "bg-red-50 text-red-600" : "bg-[#eef8f1] text-[#15803d]"}`}>
            <AlertTriangle className="h-5 w-5" />
          </span>
          <div className="min-w-0">
            <h2 id="gm-confirm-title" className="text-base font-black text-slate-900">{title}</h2>
            {message && <p className="mt-1 text-sm text-slate-600">{message}</p>}
          </div>
        </div>
        <div className="mt-5 flex justify-end gap-2">
          <button type="button" className="rounded-lg px-4 py-2 text-sm font-semibold text-slate-700 hover:bg-slate-100" onClick={() => onClose(false)}>
            Cancel
          </button>
          <button ref={confirmRef} type="button" className={`rounded-lg px-4 py-2 text-sm font-bold text-white ${danger ? "bg-red-600 hover:bg-red-700" : "bg-[#1f9d4c] hover:bg-[#188a42]"}`} onClick={() => onClose(true)}>
            {confirmLabel}
          </button>
        </div>
      </div>
    </div>
  );
}
