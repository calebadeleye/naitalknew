import React, { useEffect, useState } from "react";
import { BellRing, X } from "lucide-react";
import { useFeedback } from "./feedback";
import { currentDomain } from "./pwa";
import { enableHere, isEnabledHere, pushSupport } from "./push";

const DISMISSED = "greenmail_push_prompt_dismissed";

/**
 * A banner offering notifications to anyone who hasn't turned them on — so
 * people don't have to find the switch in Settings. On iPhone this is the
 * moment that matters: permission can only be asked straight after a tap.
 */
export function NotificationPrompt({ token, email }: { token: string; email: string }) {
  const { toast } = useFeedback();
  const [show, setShow] = useState(false);
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    let dismissed = false;
    try {
      dismissed = window.localStorage.getItem(`${DISMISSED}:${email}`) === "1";
    } catch {
      // ignore
    }
    if (dismissed || pushSupport() !== "supported" || Notification.permission === "denied") return;
    void isEnabledHere(token).then((on) => setShow(!on));
  }, [token, email]);

  if (!show) return null;

  const dismiss = () => {
    try {
      window.localStorage.setItem(`${DISMISSED}:${email}`, "1");
    } catch {
      // ignore
    }
    setShow(false);
  };

  const turnOn = async () => {
    setBusy(true);
    try {
      await enableHere(token, currentDomain());
      toast("Notifications are on. You'll be told about new mail even when Green Mail is closed.");
      setShow(false);
    } catch (err) {
      toast(err instanceof Error ? err.message : "Notifications could not be turned on.", "error");
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="flex items-center gap-3 border-b border-[#1f9d4c]/30 bg-[#eef8f1] px-4 py-2.5 text-sm">
      <BellRing className="h-5 w-5 shrink-0 text-[#15803d]" />
      <p className="min-w-0 flex-1 text-slate-700">Get a notification on this device when new mail arrives.</p>
      <button type="button" disabled={busy} onClick={() => void turnOn()} className="shrink-0 rounded-lg bg-[#1f9d4c] px-3 py-1.5 text-xs font-bold text-white disabled:opacity-60">
        {busy ? "Turning on…" : "Turn on"}
      </button>
      <button type="button" aria-label="Not now" onClick={dismiss} className="shrink-0 rounded p-1 text-slate-500 hover:bg-white">
        <X className="h-4 w-4" />
      </button>
    </div>
  );
}
