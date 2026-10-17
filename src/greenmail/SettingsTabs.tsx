import React, { useEffect, useState } from "react";
import { Bell, BellOff, CheckCircle2, Eye, EyeOff, KeyRound, Loader2, Mail, Smartphone, Volume2, VolumeX } from "lucide-react";
import { gm, type Me } from "./api";
import { useFeedback } from "./feedback";
import { currentDomain } from "./pwa";
import { checkDevice, disableHere, enableHere, isEnabledHere, pushSupport, sendTestHere, type DeviceCheck, type PushSupport } from "./push";
import { playNewMailSound, setSoundEnabled, soundEnabled } from "./sound";

const field = "mt-1.5 w-full rounded-lg border border-slate-300 px-3 py-2 text-slate-900 outline-none focus:border-[#1f9d4c]";

/** A password box with a show/hide eye. */
export function PasswordField({ label, value, onChange, autoComplete }: { label: string; value: string; onChange: (value: string) => void; autoComplete: string }) {
  const [show, setShow] = useState(false);
  return (
    <label className="block text-sm font-semibold text-slate-700">
      {label}
      <span className="relative mt-1.5 block">
        <input type={show ? "text" : "password"} value={value} onChange={(event) => onChange(event.target.value)} autoComplete={autoComplete} autoCapitalize="none" autoCorrect="off" spellCheck={false} className={`${field} !mt-0 pr-11`} required />
        <button type="button" aria-label={show ? "Hide password" : "Show password"} aria-pressed={show} onClick={() => setShow(!show)} className="absolute inset-y-0 right-0 flex w-11 items-center justify-center text-slate-500 hover:text-slate-800">
          {show ? <EyeOff className="h-5 w-5" /> : <Eye className="h-5 w-5" />}
        </button>
      </span>
    </label>
  );
}

/** Security: change the password, and the recovery email for "Forgot password". */
export function SecurityTab({ token, me, onMeChanged }: { token: string; me: Me; onMeChanged: (me: Me) => void }) {
  const { toast } = useFeedback();
  const [current, setCurrent] = useState("");
  const [next, setNext] = useState("");
  const [again, setAgain] = useState("");
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const [recovery, setRecovery] = useState(me.recovery_email ?? "");
  const [awaitingCode, setAwaitingCode] = useState(Boolean(me.recovery_email && !me.recovery_email_verified));
  const [code, setCode] = useState("");
  const [recoveryBusy, setRecoveryBusy] = useState(false);
  const [recoveryError, setRecoveryError] = useState<string | null>(null);

  const changePassword = async (event: React.FormEvent) => {
    event.preventDefault();
    setError(null);
    if (next !== again) {
      setError("The two new passwords do not match.");
      return;
    }
    setSaving(true);
    try {
      const result = await gm<{ message: string }>("/password", token, { method: "POST", body: JSON.stringify({ current_password: current, password: next, password_confirmation: again }) });
      toast(result.message);
      setCurrent("");
      setNext("");
      setAgain("");
    } catch (err) {
      setError(err instanceof Error ? err.message : "The password could not be changed.");
    } finally {
      setSaving(false);
    }
  };

  const saveRecovery = async () => {
    setRecoveryBusy(true);
    setRecoveryError(null);
    try {
      const result = await gm<{ message: string }>("/recovery-email", token, { method: "PUT", body: JSON.stringify({ recovery_email: recovery.trim() || null }) });
      toast(result.message, "info");
      setAwaitingCode(Boolean(recovery.trim()));
      setCode("");
      onMeChanged({ ...me, recovery_email: recovery.trim() || null, recovery_email_verified: false });
    } catch (err) {
      setRecoveryError(err instanceof Error ? err.message : "Could not save the recovery email.");
    } finally {
      setRecoveryBusy(false);
    }
  };

  const confirmCode = async () => {
    setRecoveryBusy(true);
    setRecoveryError(null);
    try {
      const result = await gm<{ message: string }>("/recovery-email/confirm", token, { method: "POST", body: JSON.stringify({ code: code.trim() }) });
      toast(result.message);
      setAwaitingCode(false);
      onMeChanged({ ...me, recovery_email: recovery.trim(), recovery_email_verified: true });
    } catch (err) {
      setRecoveryError(err instanceof Error ? err.message : "That code did not work.");
    } finally {
      setRecoveryBusy(false);
    }
  };

  const verified = me.recovery_email_verified && me.recovery_email === recovery.trim();

  return (
    <div className="mt-4 grid gap-6">
      <form onSubmit={changePassword} className="grid gap-3">
        <h3 className="flex items-center gap-2 text-sm font-black text-slate-900"><KeyRound className="h-4 w-4 text-[#1f9d4c]" /> Change password</h3>
        <PasswordField label="Current password" value={current} onChange={setCurrent} autoComplete="current-password" />
        <PasswordField label="New password (at least 8 characters)" value={next} onChange={setNext} autoComplete="new-password" />
        <PasswordField label="New password again" value={again} onChange={setAgain} autoComplete="new-password" />
        {error && <p className="rounded-md bg-red-50 px-3 py-2 text-xs text-red-700">{error}</p>}
        <p className="text-xs text-slate-500">This changes the mailbox password everywhere — also for your phone's mail app or Outlook. Other devices signed in to Green Mail will be signed out.</p>
        <div className="flex justify-end">
          <button type="submit" disabled={saving || !current || next.length < 8} className="rounded-lg bg-[#1f9d4c] px-4 py-2 text-sm font-bold text-white disabled:opacity-60">
            {saving ? "Changing…" : "Change password"}
          </button>
        </div>
      </form>

      <div className="grid gap-3 border-t border-slate-200 pt-5">
        <h3 className="flex items-center gap-2 text-sm font-black text-slate-900"><Mail className="h-4 w-4 text-[#1f9d4c]" /> Recovery email</h3>
        <p className="text-xs text-slate-500">If you forget your password, we'll send a reset code here. Use a different address you can always reach (for example your personal Gmail).</p>
        <label className="block text-sm font-semibold text-slate-700">
          Recovery email
          <span className="mt-1.5 flex gap-2">
            <input type="email" value={recovery} onChange={(event) => setRecovery(event.target.value)} placeholder="you@gmail.com" className={`${field} !mt-0 min-w-0 flex-1`} autoCapitalize="none" />
            <button type="button" disabled={recoveryBusy || recovery.trim() === (me.recovery_email ?? "")} onClick={() => void saveRecovery()} className="shrink-0 rounded-lg border border-[#1f9d4c]/50 px-3 text-sm font-bold text-[#15803d] disabled:opacity-50">
              {recoveryBusy && !awaitingCode ? <Loader2 className="h-4 w-4 animate-spin" /> : recovery.trim() ? "Save" : "Remove"}
            </button>
          </span>
        </label>
        {verified && <p className="flex items-center gap-1.5 text-xs font-semibold text-[#15803d]"><CheckCircle2 className="h-4 w-4" /> Confirmed</p>}
        {awaitingCode && !verified && (
          <div className="rounded-lg border border-slate-200 bg-slate-50 p-3">
            <p className="text-xs text-slate-600">Enter the 6-digit code we sent to <strong>{recovery}</strong>.</p>
            <span className="mt-2 flex gap-2">
              <input value={code} onChange={(event) => setCode(event.target.value.replace(/\D/g, "").slice(0, 6))} inputMode="numeric" autoComplete="one-time-code" placeholder="123456" className={`${field} !mt-0 min-w-0 flex-1 tracking-[0.3em]`} />
              <button type="button" disabled={recoveryBusy || code.length !== 6} onClick={() => void confirmCode()} className="shrink-0 rounded-lg bg-[#1f9d4c] px-3 text-sm font-bold text-white disabled:opacity-50">
                Confirm
              </button>
            </span>
            <button type="button" className="mt-2 text-xs font-semibold text-[#1a7f3f] hover:underline" onClick={() => void saveRecovery()}>Send a new code</button>
          </div>
        )}
        {recoveryError && <p className="rounded-md bg-red-50 px-3 py-2 text-xs text-red-700">{recoveryError}</p>}
      </div>
    </div>
  );
}

/** Notifications: the new-mail sound, and notifications on this phone/computer. */
export function NotificationsTab({ token, email }: { token: string; email: string }) {
  const { toast } = useFeedback();
  const [sound, setSound] = useState(soundEnabled);
  const [support] = useState<PushSupport>(pushSupport);
  const [enabled, setEnabled] = useState<boolean | null>(null);
  const [busy, setBusy] = useState(false);
  const [device, setDevice] = useState<DeviceCheck | null>(null);

  useEffect(() => {
    void checkDevice(token).then(setDevice);
  }, [token, enabled]);

  useEffect(() => {
    if (support !== "supported") {
      setEnabled(false);
      return;
    }
    void isEnabledHere(token).then(setEnabled);
  }, [token, support]);

  const toggleSound = () => {
    const next = !sound;
    setSound(next);
    setSoundEnabled(next);
    if (next) playNewMailSound(true);
  };

  const togglePush = async () => {
    setBusy(true);
    try {
      if (enabled) {
        await disableHere(token);
        setEnabled(false);
        toast("Notifications are off on this device.");
      } else {
        await enableHere(token, currentDomain());
        setEnabled(true);
        toast("Notifications are on. You'll be told about new mail even when Green Mail is closed.");
      }
    } catch (err) {
      toast(err instanceof Error ? err.message : "That did not work.", "error");
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="mt-4 grid gap-4">
      <div className="flex items-center gap-3 rounded-xl border border-slate-200 p-4">
        {sound ? <Volume2 className="h-6 w-6 shrink-0 text-[#1f9d4c]" /> : <VolumeX className="h-6 w-6 shrink-0 text-slate-400" />}
        <div className="min-w-0 flex-1">
          <p className="text-sm font-bold text-slate-900">New mail sound</p>
          <p className="text-xs text-slate-500">A soft chime when an email arrives while Green Mail is open.</p>
        </div>
        <Switch on={sound} label="New mail sound" onChange={toggleSound} />
      </div>

      <div className="rounded-xl border border-slate-200 p-4">
        <div className="flex items-center gap-3">
          {enabled ? <Bell className="h-6 w-6 shrink-0 text-[#1f9d4c]" /> : <BellOff className="h-6 w-6 shrink-0 text-slate-400" />}
          <div className="min-w-0 flex-1">
            <p className="text-sm font-bold text-slate-900">Notifications on this device</p>
            <p className="text-xs text-slate-500">Get a notification on this phone or computer when mail arrives for {email}, even when Green Mail is closed.</p>
          </div>
          {support === "supported" && (enabled === null ? <Loader2 className="h-5 w-5 animate-spin text-slate-400" /> : <Switch on={enabled} label="Notifications on this device" onChange={() => void togglePush()} disabled={busy} />)}
        </div>
        {enabled && (
          <button
            type="button"
            className="mt-3 text-xs font-bold text-[#1a7f3f] hover:underline disabled:opacity-50"
            disabled={busy}
            onClick={() => {
              setBusy(true);
              sendTestHere(token)
                .then((message) => toast(message, "info"))
                .catch((err) => toast(err instanceof Error ? err.message : "The test could not be sent.", "error"))
                .finally(() => setBusy(false));
            }}
          >
            Send a test notification
          </button>
        )}
        {support === "install-first" && (
          <p className="mt-3 flex gap-2 rounded-lg bg-amber-50 px-3 py-2 text-xs text-amber-800">
            <Smartphone className="mt-0.5 h-4 w-4 shrink-0" /> On iPhone and iPad, add Green Mail to your Home Screen first (Share, then Add to Home Screen), open it from there, and turn notifications on here.
          </p>
        )}
        {support === "blocked" && <p className="mt-3 rounded-lg bg-amber-50 px-3 py-2 text-xs text-amber-800">Notifications are blocked for Green Mail. Allow them in your browser's site settings (or your phone's settings), then come back here.</p>}
        {support === "unsupported" && <p className="mt-3 rounded-lg bg-slate-50 px-3 py-2 text-xs text-slate-600">This browser can't show notifications. Try Chrome, Edge, Firefox or Safari.</p>}
      </div>

      {device && (
        <details className="rounded-xl border border-slate-200 p-4 text-xs text-slate-600">
          <summary className="cursor-pointer font-bold text-slate-800">Device check</summary>
          <dl className="mt-3 grid grid-cols-[auto_1fr] gap-x-3 gap-y-1">
            {([
              ["Opened as installed app", device.installedApp ? "Yes" : device.iphoneOrIpad ? "No — open Green Mail from the Home Screen icon" : "No"],
              ["Notification permission", device.permission],
              ["Background helper", device.serviceWorker],
              ["Signed up with", device.pushService === "none" ? "Not signed up on this device" : device.pushService],
              ["Status", device.support],
            ] as Array<[string, string]>).map(([label, value]) => (
              <React.Fragment key={label}>
                <dt className="font-semibold text-slate-700">{label}</dt>
                <dd className="break-words">{value}</dd>
              </React.Fragment>
            ))}
          </dl>
          <p className="mt-3 break-words text-[10px] text-slate-400">{device.userAgent}</p>
        </details>
      )}
    </div>
  );
}

function Switch({ on, label, onChange, disabled = false }: { on: boolean; label: string; onChange: () => void; disabled?: boolean }) {
  return (
    <button type="button" role="switch" aria-checked={on} aria-label={label} onClick={onChange} disabled={disabled} className={`relative h-6 w-11 shrink-0 rounded-full transition disabled:opacity-60 ${on ? "bg-[#1f9d4c]" : "bg-slate-300"}`}>
      <span className={`gm-keep-white absolute top-0.5 h-5 w-5 rounded-full bg-white shadow transition-all ${on ? "left-[22px]" : "left-0.5"}`} />
    </button>
  );
}
