import React, { createContext, useCallback, useContext, useEffect, useRef, useState } from "react";
import { AnimatePresence, motion } from "motion/react";
import { AlertTriangle, CheckCircle2, Info, X, XCircle } from "lucide-react";

export type ToastType = "success" | "error" | "warning" | "info";

type ToastInput = {
  type: ToastType;
  message: string;
};

type Toast = ToastInput & { id: number };

type ToastContextValue = {
  push: (toast: ToastInput) => void;
  clear: () => void;
};

const DURATIONS: Record<ToastType, number> = {
  success: 4500,
  info: 4500,
  warning: 6000,
  error: 7000,
};

const ICONS: Record<ToastType, React.ComponentType<{ className?: string }>> = {
  success: CheckCircle2,
  info: Info,
  warning: AlertTriangle,
  error: XCircle,
};

const ToastContext = createContext<ToastContextValue | null>(null);

let toastId = 0;

export function ToastProvider({ children }: { children: React.ReactNode }) {
  const [toasts, setToasts] = useState<Toast[]>([]);
  const timers = useRef(new Map<number, ReturnType<typeof setTimeout>>());

  const dismiss = useCallback((id: number) => {
    setToasts((current) => current.filter((toast) => toast.id !== id));
    const timer = timers.current.get(id);
    if (timer) {
      clearTimeout(timer);
      timers.current.delete(id);
    }
  }, []);

  const clear = useCallback(() => {
    timers.current.forEach((timer) => clearTimeout(timer));
    timers.current.clear();
    setToasts([]);
  }, []);

  const push = useCallback(
    ({ type, message }: ToastInput) => {
      const id = ++toastId;
      setToasts((current) => [...current, { id, type, message }]);
      const timer = setTimeout(() => dismiss(id), DURATIONS[type]);
      timers.current.set(id, timer);
    },
    [dismiss],
  );

  useEffect(() => {
    const handleNavigation = () => clear();
    window.addEventListener("popstate", handleNavigation);
    window.addEventListener("naitalk:navigate", handleNavigation);
    return () => {
      window.removeEventListener("popstate", handleNavigation);
      window.removeEventListener("naitalk:navigate", handleNavigation);
    };
  }, [clear]);

  useEffect(() => {
    return () => {
      timers.current.forEach((timer) => clearTimeout(timer));
    };
  }, []);

  return (
    <ToastContext.Provider value={{ push, clear }}>
      {children}
      <div className="toast-stack" aria-live="polite" aria-atomic="false">
        <AnimatePresence>
          {toasts.map((toast) => {
            const Icon = ICONS[toast.type];
            return (
              <motion.div
                key={toast.id}
                initial={{ opacity: 0, y: -12, scale: 0.98 }}
                animate={{ opacity: 1, y: 0, scale: 1 }}
                exit={{ opacity: 0, y: -8, scale: 0.98 }}
                transition={{ duration: 0.18 }}
                className={`toast toast-${toast.type}`}
                role="status"
              >
                <Icon className="h-5 w-5 shrink-0" />
                <p>{toast.message}</p>
                <button type="button" aria-label="Dismiss notification" onClick={() => dismiss(toast.id)}>
                  <X className="h-4 w-4" />
                </button>
              </motion.div>
            );
          })}
        </AnimatePresence>
      </div>
    </ToastContext.Provider>
  );
}

export function useToast(): ToastContextValue {
  const context = useContext(ToastContext);
  if (!context) {
    throw new Error("useToast must be used within a ToastProvider");
  }
  return context;
}
