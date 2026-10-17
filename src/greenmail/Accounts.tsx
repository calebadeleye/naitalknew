import React, { useEffect, useRef, useState } from "react";
import { Check, LogOut, Plus, Users } from "lucide-react";
import { gm, MAX_ACCOUNTS, SessionExpired, type Folder, type StoredAccount } from "./api";
import { useFeedback } from "./feedback";
import { playNewMailSound } from "./sound";
import { Avatar } from "./ui";

/**
 * Several mailboxes signed in on one device: the account menu (switch, add,
 * sign out) and a quiet watcher that keeps unread counts for the other
 * accounts and says when new mail arrives in one of them.
 */

const WATCH_MS = 60000;

/** Unread Inbox counts for the accounts not on screen, with a "new email" notice and a Switch button. */
export function useOtherAccounts(others: StoredAccount[], onSwitch: (token: string) => void, onExpired: (account: StoredAccount) => void): Record<string, number> {
  const [unread, setUnread] = useState<Record<string, number>>({});
  const newest = useRef<Record<string, number>>({});
  const { toast } = useFeedback();
  const handlers = useRef({ onSwitch, onExpired, toast });
  handlers.current = { onSwitch, onExpired, toast };
  const key = others.map((a) => a.token).join(",");

  useEffect(() => {
    if (others.length === 0) return;
    let stopped = false;

    const checkOne = async (account: StoredAccount) => {
      try {
        const [folders, check] = await Promise.all([
          gm<{ folders: Folder[] }>("/folders", account.token),
          gm<{ latest_uid: number; new: Array<{ subject: string; from: { name: string | null; email: string } }> }>(`/check?since=${newest.current[account.token] ?? 0}`, account.token),
        ]);
        if (stopped) return;
        setUnread((current) => ({ ...current, [account.token]: folders.folders.find((f) => f.role === "inbox")?.unread ?? 0 }));
        const first = newest.current[account.token] === undefined;
        newest.current[account.token] = Math.max(newest.current[account.token] ?? 0, check.latest_uid);
        if (!first && check.new.length > 0) {
          playNewMailSound();
          const latest = check.new[0];
          const who = account.email || "another account";
          handlers.current.toast(
            check.new.length === 1 ? `New email for ${who} from ${latest.from.name || latest.from.email}: ${latest.subject}` : `${check.new.length} new emails for ${who}`,
            "info",
            { label: "Switch", run: () => handlers.current.onSwitch(account.token) },
          );
        }
      } catch (error) {
        if (error instanceof SessionExpired) handlers.current.onExpired(account);
      }
    };

    const run = () => others.forEach((account) => void checkOne(account));
    run();
    const timer = window.setInterval(run, WATCH_MS);
    return () => {
      stopped = true;
      window.clearInterval(timer);
    };
    // Re-run only when the set of accounts changes.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [key]);

  return unread;
}

export function AccountMenu({
  email,
  displayName,
  accounts,
  activeToken,
  otherUnread,
  onSwitch,
  onAdd,
  onSignOut,
  onSignOutAll,
}: {
  email: string;
  displayName: string | null;
  accounts: StoredAccount[];
  activeToken: string;
  otherUnread: Record<string, number>;
  onSwitch: (token: string) => void;
  onAdd: () => void;
  onSignOut: () => void;
  onSignOutAll: () => void;
}) {
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);
  const others = accounts.filter((a) => a.token !== activeToken);
  const othersUnread = others.reduce((sum, a) => sum + (otherUnread[a.token] ?? 0), 0);

  useEffect(() => {
    if (!open) return;
    const close = (event: MouseEvent | KeyboardEvent) => {
      if (event instanceof KeyboardEvent ? event.key === "Escape" : !ref.current?.contains(event.target as Node)) setOpen(false);
    };
    document.addEventListener("mousedown", close);
    document.addEventListener("keydown", close);
    return () => {
      document.removeEventListener("mousedown", close);
      document.removeEventListener("keydown", close);
    };
  }, [open]);

  const choose = (action: () => void) => {
    setOpen(false);
    action();
  };

  return (
    <div ref={ref} className="relative">
      <button
        type="button"
        aria-haspopup="menu"
        aria-expanded={open}
        aria-label={`Account: ${email}${others.length ? `, ${others.length} other account${others.length === 1 ? "" : "s"}` : ""}`}
        title="Accounts"
        onClick={() => setOpen(!open)}
        className="relative flex items-center gap-2 rounded-lg p-1 hover:bg-slate-100 md:border-l md:border-slate-200 md:pl-3"
      >
        <Avatar address={{ name: displayName, email: email || "?" }} size={34} />
        <span className="hidden text-right leading-tight xl:block">
          <span className="block text-sm font-bold text-slate-900">{displayName || email.split("@")[0]}</span>
          <span className="block text-xs text-slate-500">{email}</span>
        </span>
        {othersUnread > 0 && (
          <span className="absolute -right-0.5 -top-0.5 min-w-[18px] rounded-full bg-red-500 px-1 text-center text-[10px] font-bold leading-[18px] text-white" aria-hidden="true">
            {othersUnread > 99 ? "99+" : othersUnread}
          </span>
        )}
      </button>

      {open && (
        <div role="menu" className="absolute right-0 top-full z-50 mt-2 w-[min(320px,calc(100vw-24px))] overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-2xl">
          <div className="flex items-center gap-3 border-b border-slate-100 p-4">
            <Avatar address={{ name: displayName, email: email || "?" }} size={42} />
            <div className="min-w-0 flex-1">
              <p className="truncate font-bold text-slate-900">{displayName || email.split("@")[0]}</p>
              <p className="truncate text-sm text-slate-500">{email}</p>
            </div>
            <Check className="h-5 w-5 shrink-0 text-[#1f9d4c]" aria-label="Current account" />
          </div>

          {others.length > 0 && (
            <div className="border-b border-slate-100 py-1">
              <p className="px-4 pb-1 pt-2 text-[11px] font-bold uppercase tracking-wide text-slate-400">Switch account</p>
              {others.map((account) => (
                <button key={account.token} type="button" role="menuitem" onClick={() => choose(() => onSwitch(account.token))} className="flex w-full items-center gap-3 px-4 py-2.5 text-left hover:bg-slate-50">
                  <Avatar address={{ name: null, email: account.email || "?" }} size={32} />
                  <span className="min-w-0 flex-1 truncate text-sm font-semibold text-slate-800">{account.email || "Signed-in account"}</span>
                  {(otherUnread[account.token] ?? 0) > 0 && <span className="rounded-md bg-[#e3f4e9] px-1.5 text-xs font-bold text-[#14632f]">{otherUnread[account.token]}</span>}
                </button>
              ))}
            </div>
          )}

          <div className="py-1">
            <button
              type="button"
              role="menuitem"
              disabled={accounts.length >= MAX_ACCOUNTS}
              onClick={() => choose(onAdd)}
              className="flex w-full items-center gap-3 px-4 py-2.5 text-left text-sm font-semibold text-slate-800 hover:bg-slate-50 disabled:opacity-50"
              title={accounts.length >= MAX_ACCOUNTS ? `Up to ${MAX_ACCOUNTS} accounts can be signed in at once` : undefined}
            >
              <span className="flex h-8 w-8 items-center justify-center rounded-full border border-dashed border-slate-300 text-slate-500"><Plus className="h-4 w-4" /></span>
              Add another account
            </button>
            <button type="button" role="menuitem" onClick={() => choose(onSignOut)} className="flex w-full items-center gap-3 px-4 py-2.5 text-left text-sm text-slate-700 hover:bg-slate-50">
              <span className="flex h-8 w-8 items-center justify-center"><LogOut className="h-4 w-4" /></span>
              <span className="min-w-0 truncate">Sign out of {email || "this account"}</span>
            </button>
            {accounts.length > 1 && (
              <button type="button" role="menuitem" onClick={() => choose(onSignOutAll)} className="flex w-full items-center gap-3 px-4 py-2.5 text-left text-sm text-slate-700 hover:bg-slate-50">
                <span className="flex h-8 w-8 items-center justify-center"><Users className="h-4 w-4" /></span>
                Sign out of all accounts
              </button>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
