import React, { useState } from "react";
import { X } from "lucide-react";
import { gm, type Me } from "./api";

/** Name shown on sent mail, and the signature added to new messages and replies. */
export function SettingsModal({ token, me, onSaved, onClose }: { token: string; me: Me; onSaved: (me: Me) => void; onClose: () => void }) {
  const [displayName, setDisplayName] = useState(me.display_name ?? "");
  const [signature, setSignature] = useState(me.signature_html ?? "");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const save = async () => {
    setBusy(true);
    setError(null);
    try {
      const saved = await gm<{ display_name: string | null; signature_html: string | null }>("/settings", token, {
        method: "PUT",
        body: JSON.stringify({ display_name: displayName.trim() || null, signature_html: signature.trim() || null }),
      });
      onSaved({ ...me, ...saved });
      onClose();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Could not save.");
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/40 p-4" role="dialog" aria-modal="true" aria-label="Mail settings">
      <div className="w-full max-w-lg rounded-2xl bg-white p-6 shadow-xl">
        <div className="flex items-center justify-between">
          <h2 className="text-lg font-black text-slate-900">Settings</h2>
          <button type="button" aria-label="Close" className="rounded p-1 text-slate-500 hover:bg-slate-100" onClick={onClose}>
            <X className="h-5 w-5" />
          </button>
        </div>
        <label className="mt-4 block text-sm font-semibold text-slate-700">
          Your name (shown to people you email)
          <input value={displayName} onChange={(event) => setDisplayName(event.target.value)} maxLength={120} className="mt-1.5 w-full rounded-lg border border-slate-300 px-3 py-2 text-slate-900 outline-none focus:border-[#1f9d4c]" />
        </label>
        <label className="mt-4 block text-sm font-semibold text-slate-700">
          Signature
          <textarea
            value={signature}
            onChange={(event) => setSignature(event.target.value)}
            rows={6}
            placeholder={"Caleb Adeleye\nTechnology Strategist\nNAI TALK"}
            className="mt-1.5 w-full rounded-lg border border-slate-300 px-3 py-2 font-mono text-xs text-slate-900 outline-none focus:border-[#1f9d4c]"
          />
          <span className="mt-1 block text-xs font-normal text-slate-500">Plain text, or HTML (for links, bold and images by web address).</span>
        </label>
        {error && <p className="mt-3 rounded-md bg-red-50 px-3 py-2 text-xs text-red-700">{error}</p>}
        <div className="mt-5 flex justify-end gap-2">
          <button type="button" className="rounded-lg px-4 py-2 text-sm font-semibold text-slate-600 hover:bg-slate-100" onClick={onClose}>
            Cancel
          </button>
          <button type="button" disabled={busy} className="rounded-lg bg-[#1f9d4c] px-4 py-2 text-sm font-bold text-white disabled:opacity-60" onClick={() => void save()}>
            {busy ? "Saving…" : "Save"}
          </button>
        </div>
      </div>
    </div>
  );
}
