import React, { useState } from "react";
import { Loader2, LockKeyhole } from "lucide-react";
import { gm, storeToken } from "./api";
import { Brand } from "./ui";

/** Mailbox sign-in. ?email=… or ?domain=… (from yourdomain.com/greenmail) pre-fill the address. */
export function LoginScreen({ onSignedIn, notice }: { onSignedIn: (token: string) => void; notice: string | null }) {
  const params = new URLSearchParams(window.location.search);
  const domain = (params.get("domain") || "").replace(/^www\./i, "").replace(/[^a-z0-9.-]/gi, "");
  const [email, setEmail] = useState(params.get("email") || (domain ? `@${domain}` : ""));
  const [password, setPassword] = useState("");
  const [remember, setRemember] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const emailRef = React.useRef<HTMLInputElement>(null);
  const needsName = email.startsWith("@");

  // Only the domain is known (from yourdomain.com/greenmail): put the cursor before "@".
  React.useEffect(() => {
    if (needsName) emailRef.current?.setSelectionRange(0, 0);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const submit = async (event: React.FormEvent) => {
    event.preventDefault();
    setBusy(true);
    setError(null);
    try {
      const response = await gm<{ token: string }>("/session", "", { method: "POST", body: JSON.stringify({ email: email.trim(), password }) });
      storeToken(response.token, remember);
      onSignedIn(response.token);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Could not sign in.");
      setPassword("");
    } finally {
      setBusy(false);
    }
  };

  const webmailHost = email.includes("@") ? email.split("@")[1] : domain;

  return (
    <main className="flex min-h-screen items-center justify-center bg-[#f3f6f4] px-4 py-10">
      <div className="w-full max-w-md">
        <div className="mb-6 flex justify-center">
          <Brand size="lg" />
        </div>
        <form onSubmit={submit} className="rounded-2xl border border-slate-200 bg-white p-7 shadow-sm">
          <h1 className="text-xl font-black text-slate-900">Sign in to your email</h1>
          <p className="mt-1 text-sm text-slate-500">Use your full email address and its password.</p>
          {notice && <p className="mt-4 rounded-md bg-amber-50 px-3 py-2 text-sm text-amber-800">{notice}</p>}
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
            Password
            <input
              type="password"
              required
              autoComplete="current-password"
              value={password}
              onChange={(event) => setPassword(event.target.value)}
              className="mt-1.5 w-full rounded-lg border border-slate-300 px-3 py-2.5 text-slate-900 outline-none focus:border-[#1f9d4c] focus:ring-2 focus:ring-[#1f9d4c]/20"
              autoFocus={Boolean(email) && !needsName}
            />
          </label>
          <label className="mt-4 flex items-center gap-2 text-sm text-slate-600">
            <input type="checkbox" checked={remember} onChange={(event) => setRemember(event.target.checked)} className="h-4 w-4 accent-[#1f9d4c]" />
            Keep me signed in on this device
          </label>
          {error && <p className="mt-4 rounded-md bg-red-50 px-3 py-2 text-sm text-red-700" role="alert">{error}</p>}
          <button type="submit" disabled={busy} className="mt-5 inline-flex w-full items-center justify-center gap-2 rounded-lg bg-[#1f9d4c] py-2.5 font-bold text-white hover:bg-[#188a42] disabled:opacity-60">
            {busy ? <Loader2 className="h-4 w-4 animate-spin" /> : <LockKeyhole className="h-4 w-4" />} Sign in
          </button>
          <p className="mt-5 text-center text-xs text-slate-500">
            Forgot your password? The owner of your hosting account can reset it in the NAI TALK client area.
            {webmailHost && /\./.test(webmailHost) && (
              <>
                {" "}
                Prefer the classic webmail?{" "}
                <a className="font-semibold text-[#1a7f3f] hover:underline" href={`https://${webmailHost}/webmail`}>
                  Open it here
                </a>
                .
              </>
            )}
          </p>
        </form>
      </div>
    </main>
  );
}
