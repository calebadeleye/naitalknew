import React from "react";
import { Share, SquarePlus, X } from "lucide-react";

/** iPhone/iPad have no install button for web apps — these are Safari's steps. */
export function InstallHelp({ onClose }: { onClose: () => void }) {
  return (
    <div className="fixed inset-0 z-50 flex items-end justify-center bg-slate-900/40 sm:items-center sm:p-4" role="dialog" aria-modal="true" aria-label="Install Green Mail">
      <div className="w-full max-w-sm rounded-t-2xl bg-white p-5 shadow-xl sm:rounded-2xl">
        <div className="flex items-center justify-between">
          <h2 className="text-lg font-black text-slate-900">Install Green Mail</h2>
          <button type="button" aria-label="Close" className="rounded p-1 text-slate-500 hover:bg-slate-100" onClick={onClose}>
            <X className="h-5 w-5" />
          </button>
        </div>
        <ol className="mt-4 grid gap-3 text-sm text-slate-700">
          <li className="flex items-center gap-3">
            <span className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-[#e3f4e9] font-bold text-[#14632f]">1</span>
            <span>
              In Safari, tap <Share className="inline h-4 w-4 align-text-bottom" /> <strong>Share</strong>.
            </span>
          </li>
          <li className="flex items-center gap-3">
            <span className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-[#e3f4e9] font-bold text-[#14632f]">2</span>
            <span>
              Choose <SquarePlus className="inline h-4 w-4 align-text-bottom" /> <strong>Add to Home Screen</strong>.
            </span>
          </li>
          <li className="flex items-center gap-3">
            <span className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-[#e3f4e9] font-bold text-[#14632f]">3</span>
            <span>
              Tap <strong>Add</strong>. Green Mail opens from your home screen like any other app.
            </span>
          </li>
        </ol>
        <button type="button" className="mt-5 w-full rounded-lg bg-[#1f9d4c] py-2.5 text-sm font-bold text-white" onClick={onClose}>
          Got it
        </button>
      </div>
    </div>
  );
}
