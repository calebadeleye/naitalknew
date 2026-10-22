import React, { useState } from "react";
import { ArrowLeft, Download, Eye, EyeOff, KeyRound, Loader2, LockKeyhole } from "lucide-react";
import { gm, storeToken } from "./api";
import { rememberedEmail, rememberSignIn } from "./pwa";
import { PasswordField } from "./SettingsTabs";
import { Brand } from "./ui";

/** Mailbox sign-in. ?email=… or ?domain=… (from yourdomain.com/greenmail) pre-fill the address. */
export function LoginScreen({
  onSignedIn,
  notice,
  domain,
  onInstall,
  onCancel,
  signedInEmails = [],
}: {
  onSignedIn: (token: string) => void;
  /** Adding another account while signed in: shows Cancel (back to the mailbox). */
  onCancel?: () => void;
  /** Addresses already signed in on this device. */
  signedInEmails?: string[];
  notice: string | null;
  /** The website this Green Mail belongs to (remembered on the device). */
  domain: string;
  onInstall: (() => void) | null;
}) {
  const params = new URLSearchParams(window.location.search);
  const adding = Boolean(onCancel);
  const [email, setEmail] = useState(adding ? (domain ? `@${domain}` : "") : params.get("email") || rememberedEmail(domain) || (domain ? `@${domain}` : ""));
  const [password, setPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [remember, setRemember] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [mode, setMode] = useState<"signin" | "forgot">("signin");
  const [signInNotice, setSignInNotice] = useState<string | null>(null);
  const emailRef = React.useRef<HTMLInputElement>(null);
  const needsName = email.startsWith("@");

  // Only the domain is known (from yourdomain.com/greenmail): put the cursor before "@".
  React.useEffect(() => {
    if (needsName) emailRef.current?.setSelectionRange(0, 0);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const submit = async (event: React.FormEvent) => {
    event.preventDefault();
    if (adding && signedInEmails.includes(email.trim().toLowerCase())) {
      setError("That account is already signed in. Pick it from the account menu.");
      return;
    }
    setBusy(true);
    setError(null);
    try {
      const response = await gm<{ token: string; email: string }>("/session", "", { method: "POST", body: JSON.stringify({ email: email.trim(), password }) });
      storeToken(response.token, remember, response.email);
      rememberSignIn(email);
      onSignedIn(response.token);
    } catch (err) {
      // The password is kept so it can be shown (eye button) and corrected.
      setError(err instanceof Error ? err.message : "Could not sign in.");
    } finally {
      setBusy(false);
    }
  };


  if (mode === "forgot") {
    return (
      <main className="flex min-h-screen items-center justify-center bg-[#f3f6f4] px-4 py-10">
        <div className="w-full max-w-md">
          <div className="mb-6 flex justify-center">
            <Brand size="lg" />
          </div>
          <ForgotPassword
            initialEmail={needsName ? "" : email}
            onBack={() => setMode("signin")}
            onDone={(resetEmail, message) => {
              setEmail(resetEmail);
              setPassword("");
              setError(null);
              setSignInNotice(message);
              setMode("signin");
            }}
          />
        </div>
      </main>
    );
  }

  return (
    <main className="flex min-h-screen items-center justify-center bg-[#f3f6f4] px-4 py-10">
      <div className="w-full max-w-md">
        <div className="mb-6 flex justify-center">
          <Brand size="lg" />
        </div>
        <form onSubmit={submit} className="rounded-2xl border border-slate-200 bg-white p-7 shadow-sm">
          <h1 className="text-xl font-black text-slate-900">{adding ? "Add another account" : "Sign in to your email"}</h1>
          <p className="mt-1 text-sm text-slate-500">{adding ? "Sign in to another mailbox. You can switch between them any time without signing out." : "Use your full email address and its password."}</p>
          {notice && <p className="mt-4 rounded-md bg-amber-50 px-3 py-2 text-sm text-amber-800">{notice}</p>}
          {signInNotice && <p className="mt-4 rounded-md bg-[#eef8f1] px-3 py-2 text-sm text-[#14632f]">{signInNotice}</p>}
          <label className="mt-5 block text-sm font-semibold text-slate-700">
            Email address
            <input
              type="text"
              inputMode="email"
              required
              autoComplete="username"
              value={email}
              onChange={(event) => setEmail(event.target.value)}
              ref={emailRef}
              className="mt-1.5 w-full rounded-lg border border-slate-300 px-3 py-2.5 text-slate-900 outline-none focus:border-[#1f9d4c] focus:ring-2 focus:ring-[#1f9d4c]/20"
              autoFocus={!email || needsName}
            />
          </label>
          <label className="mt-4 block text-sm font-semibold text-slate-700">
            <span className="flex items-center justify-between">
              Password
              <button type="button" className="text-xs font-semibold text-[#1a7f3f] hover:underline" onClick={() => setMode("forgot")}>
                Forgot password?
              </button>
            </span>
            <span className="relative mt-1.5 block">
              <input
                type={showPassword ? "text" : "password"}
                required
                autoComplete="current-password"
                autoCapitalize="none"
                autoCorrect="off"
                spellCheck={false}
                value={password}
                onChange={(event) => setPassword(event.target.value)}
                className="w-full rounded-lg border border-slate-300 py-2.5 pl-3 pr-11 text-slate-900 outline-none focus:border-[#1f9d4c] focus:ring-2 focus:ring-[#1f9d4c]/20"
                autoFocus={Boolean(email) && !needsName}
              />
              {/* Lets people check what they typed before trying again. */}
              <button
                type="button"
                aria-label={showPassword ? "Hide password" : "Show password"}
                aria-pressed={showPassword}
                title={showPassword ? "Hide password" : "Show password"}
                onClick={() => setShowPassword(!showPassword)}
                className="absolute inset-y-0 right-0 flex w-11 items-center justify-center rounded-r-lg text-slate-500 hover:text-slate-800"
              >
                {showPassword ? <EyeOff className="h-5 w-5" /> : <Eye className="h-5 w-5" />}
              </button>
            </span>
          </label>
          <label className="mt-4 flex items-center gap-2 text-sm text-slate-600">
            <input type="checkbox" checked={remember} onChange={(event) => setRemember(event.target.checked)} className="h-4 w-4 accent-[#1f9d4c]" />
            Keep me signed in on this device
          </label>
          {error && <p className="mt-4 rounded-md bg-red-50 px-3 py-2 text-sm text-red-700" role="alert">{error}</p>}
          <button type="submit" disabled={busy} className="mt-5 inline-flex w-full items-center justify-center gap-2 rounded-lg bg-[#1f9d4c] py-2.5 font-bold text-white hover:bg-[#188a42] disabled:opacity-60">
            {busy ? <Loader2 className="h-4 w-4 animate-spin" /> : <LockKeyhole className="h-4 w-4" />} {adding ? "Add account" : "Sign in"}
          </button>
          {adding && (
            <button type="button" onClick={onCancel} className="mt-2 w-full rounded-lg py-2.5 text-sm font-semibold text-slate-600 hover:bg-slate-50">
              Cancel
            </button>
          )}
        </form>
        {onInstall && (
          <button type="button" onClick={onInstall} className="mx-auto mt-4 flex items-center gap-2 rounded-lg px-3 py-2 text-sm font-semibold text-[#15803d] hover:bg-white">
            <Download className="h-4 w-4" /> Install Green Mail on this device
          </button>
        )}
      </div>
    </main>
  );
}

/** Forgot password: a code to the recovery email, then a new password. */
function ForgotPassword({ initialEmail, onBack, onDone }: { initialEmail: string; onBack: () => void; onDone: (email: string, message: string) => void }) {
  const [step, setStep] = useState<"email" | "code">("email");
  const [email, setEmail] = useState(initialEmail);
  const [code, setCode] = useState("");
  const [password, setPassword] = useState("");
  const [again, setAgain] = useState("");
  const [info, setInfo] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  const requestCode = async (event?: React.FormEvent) => {
    event?.preventDefault();
    setBusy(true);
    setError(null);
    try {
      const result = await gm<{ message: string }>("/password/forgot", "", { method: "POST", body: JSON.stringify({ email: email.trim() }) });
      setInfo(result.message);
      setStep("code");
    } catch (err) {
      setError(err instanceof Error ? err.message : "Something went wrong. Please try again.");
    } finally {
      setBusy(false);
    }
  };

  const reset = async (event: React.FormEvent) => {
    event.preventDefault();
    if (password !== again) {
      setError("The two new passwords do not match.");
      return;
    }
    setBusy(true);
    setError(null);
    try {
      const result = await gm<{ message: string }>("/password/reset", "", { method: "POST", body: JSON.stringify({ email: email.trim(), code: code.trim(), password, password_confirmation: again }) });
      onDone(email.trim(), result.message);
    } catch (err) {
      setError(err instanceof Error ? err.message : "The password could not be reset.");
    } finally {
      setBusy(false);
    }
  };

  const input = "mt-1.5 w-full rounded-lg border border-slate-300 px-3 py-2.5 text-slate-900 outline-none focus:border-[#1f9d4c] focus:ring-2 focus:ring-[#1f9d4c]/20";

  return (
    <form onSubmit={step === "email" ? requestCode : reset} className="rounded-2xl border border-slate-200 bg-white p-7 shadow-sm">
      <button type="button" onClick={onBack} className="mb-3 inline-flex items-center gap-1.5 text-sm font-semibold text-slate-600 hover:text-slate-900">
        <ArrowLeft className="h-4 w-4" /> Back to sign in
      </button>
      <h1 className="flex items-center gap-2 text-xl font-black text-slate-900"><KeyRound className="h-5 w-5 text-[#1f9d4c]" /> Reset your password</h1>

      {step === "email" ? (
        <>
          <p className="mt-1 text-sm text-slate-500">Enter your email address. We'll send a reset code to the recovery email you added in Green Mail.</p>
          <label className="mt-5 block text-sm font-semibold text-slate-700">
            Email address
            <input type="email" required autoComplete="username" value={email} onChange={(event) => setEmail(event.target.value)} className={input} autoFocus />
          </label>
        </>
      ) : (
        <>
          {info && <p className="mt-3 rounded-md bg-[#eef8f1] px-3 py-2 text-sm text-[#14632f]">{info}</p>}
          <label className="mt-5 block text-sm font-semibold text-slate-700">
            6-digit code
            <input value={code} onChange={(event) => setCode(event.target.value.replace(/\D/g, "").slice(0, 6))} inputMode="numeric" autoComplete="one-time-code" placeholder="123456" required className={`${input} tracking-[0.3em]`} autoFocus />
          </label>
          <div className="mt-4 grid gap-4">
            <PasswordField label="New password (at least 8 characters)" value={password} onChange={setPassword} autoComplete="new-password" />
            <PasswordField label="New password again" value={again} onChange={setAgain} autoComplete="new-password" />
          </div>
          <button type="button" className="mt-3 text-xs font-semibold text-[#1a7f3f] hover:underline" disabled={busy} onClick={() => void requestCode()}>
            Didn't get a code? Send it again
          </button>
        </>
      )}

      {error && <p className="mt-4 rounded-md bg-red-50 px-3 py-2 text-sm text-red-700" role="alert">{error}</p>}
      <button type="submit" disabled={busy || (step === "code" && (code.length !== 6 || password.length < 8))} className="mt-5 inline-flex w-full items-center justify-center gap-2 rounded-lg bg-[#1f9d4c] py-2.5 font-bold text-white hover:bg-[#188a42] disabled:opacity-60">
        {busy && <Loader2 className="h-4 w-4 animate-spin" />} {step === "email" ? "Send reset code" : "Set new password"}
      </button>
      <p className="mt-4 text-center text-xs text-slate-500">No recovery email yet? We'll ask the owner of your website's NAI TALK account to help you.</p>
    </form>
  );
}
