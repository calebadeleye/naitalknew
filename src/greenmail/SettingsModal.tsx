import React, { useEffect, useRef, useState } from "react";
import { Bold, ImagePlus, Italic, Link2, Loader2, Monitor, Moon, Sun, X } from "lucide-react";
import { gm, type Me } from "./api";
import { useGreenmailTheme, type ThemeChoice } from "./theme";
import { escapeHtml } from "./ui";

/** Name shown on sent mail, and the signature (text, links and images) added to new messages and replies. */
export function SettingsModal({ token, me, onSaved, onClose }: { token: string; me: Me; onSaved: (me: Me) => void; onClose: () => void }) {
  const [displayName, setDisplayName] = useState(me.display_name ?? "");
  const [busy, setBusy] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const editorRef = useRef<HTMLDivElement>(null);
  const fileRef = useRef<HTMLInputElement>(null);
  const theme = useGreenmailTheme();

  useEffect(() => {
    const saved = me.signature_html?.trim() ?? "";
    // Older signatures were plain text — show their line breaks.
    if (editorRef.current) editorRef.current.innerHTML = /<[a-z][\s\S]*>/i.test(saved) ? saved : escapeHtml(saved).replace(/\n/g, "<br>");
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const command = (name: string, value?: string) => {
    editorRef.current?.focus();
    document.execCommand(name, false, value);
  };

  const addImage = async (file: File) => {
    setUploading(true);
    setError(null);
    try {
      const form = new FormData();
      form.append("image", file);
      const { url } = await gm<{ url: string }>("/settings/signature-image", token, { method: "POST", body: form });
      editorRef.current?.focus();
      document.execCommand("insertHTML", false, `<img src="${url}" alt="" style="max-width:180px;height:auto">`);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Could not upload that image.");
    } finally {
      setUploading(false);
    }
  };

  const save = async () => {
    setBusy(true);
    setError(null);
    const html = editorRef.current?.innerHTML.trim() ?? "";
    const isEmpty = !editorRef.current?.textContent?.trim() && !/<img/i.test(html);
    try {
      const saved = await gm<{ display_name: string | null; signature_html: string | null }>("/settings", token, {
        method: "PUT",
        body: JSON.stringify({ display_name: displayName.trim() || null, signature_html: isEmpty ? null : html }),
      });
      onSaved({ ...me, ...saved });
      onClose();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Could not save.");
    } finally {
      setBusy(false);
    }
  };

  const tool = (label: string, icon: React.ReactNode, action: () => void) => (
    <button type="button" aria-label={label} title={label} className="rounded p-1.5 text-slate-600 hover:bg-slate-100" onMouseDown={(event) => event.preventDefault()} onClick={action}>
      {icon}
    </button>
  );

  return (
    <div className="fixed inset-0 z-50 flex items-end justify-center bg-slate-900/40 sm:items-center sm:p-4" role="dialog" aria-modal="true" aria-label="Mail settings">
      <div className="max-h-[92dvh] w-full max-w-lg overflow-y-auto rounded-t-2xl bg-white p-5 shadow-xl sm:rounded-2xl sm:p-6">
        <div className="flex items-center justify-between">
          <h2 className="text-lg font-black text-slate-900">Settings</h2>
          <button type="button" aria-label="Close" className="rounded p-1 text-slate-500 hover:bg-slate-100" onClick={onClose}>
            <X className="h-5 w-5" />
          </button>
        </div>
        {/* Appearance applies straight away and is remembered on this device. */}
        <p className="mt-4 text-sm font-semibold text-slate-700">Appearance</p>
        <div role="radiogroup" aria-label="Appearance" className="mt-1.5 grid grid-cols-3 gap-2">
          {([
            ["light", "Light", Sun],
            ["dark", "Dark", Moon],
            ["system", "Match device", Monitor],
          ] as Array<[ThemeChoice, string, typeof Sun]>).map(([value, label, Icon]) => (
            <button
              key={value}
              type="button"
              role="radio"
              aria-checked={theme.choice === value}
              onClick={() => theme.setChoice(value)}
              className={`flex flex-col items-center gap-1.5 rounded-xl border px-2 py-3 text-xs font-semibold transition ${theme.choice === value ? "border-[#1f9d4c] bg-[#eef8f1] text-[#14632f]" : "border-slate-200 text-slate-600 hover:border-slate-300"}`}
            >
              <Icon className="h-5 w-5" /> {label}
            </button>
          ))}
        </div>

        <label className="mt-4 block text-sm font-semibold text-slate-700">
          Your name (shown to people you email)
          <input value={displayName} onChange={(event) => setDisplayName(event.target.value)} maxLength={120} className="mt-1.5 w-full rounded-lg border border-slate-300 px-3 py-2 text-slate-900 outline-none focus:border-[#1f9d4c]" />
        </label>

        <p className="mt-4 text-sm font-semibold text-slate-700">Signature</p>
        <div className="mt-1.5 overflow-hidden rounded-lg border border-slate-300 focus-within:border-[#1f9d4c]">
          <div className="flex items-center gap-0.5 border-b border-slate-200 bg-slate-50 px-2 py-1">
            {tool("Bold", <Bold className="h-4 w-4" />, () => command("bold"))}
            {tool("Italic", <Italic className="h-4 w-4" />, () => command("italic"))}
            {tool("Link", <Link2 className="h-4 w-4" />, () => {
              const url = window.prompt("Link address (https://…)");
              if (url && /^(https?:|mailto:|tel:)/i.test(url.trim())) command("createLink", url.trim());
            })}
            <button
              type="button"
              className="ml-1 inline-flex items-center gap-1.5 rounded px-2 py-1 text-xs font-semibold text-slate-700 hover:bg-slate-100 disabled:opacity-60"
              onMouseDown={(event) => event.preventDefault()}
              onClick={() => fileRef.current?.click()}
              disabled={uploading}
            >
              {uploading ? <Loader2 className="h-4 w-4 animate-spin" /> : <ImagePlus className="h-4 w-4" />} Add image
            </button>
            <input
              ref={fileRef}
              type="file"
              accept="image/png,image/jpeg,image/gif,image/webp"
              className="hidden"
              onChange={(event) => {
                const file = event.target.files?.[0];
                event.target.value = "";
                if (file) void addImage(file);
              }}
            />
          </div>
          <div
            ref={editorRef}
            contentEditable
            role="textbox"
            aria-multiline="true"
            aria-label="Signature"
            suppressContentEditableWarning
            className="greenmail-editor min-h-[140px] px-3 py-2 text-sm leading-6 text-slate-800 outline-none"
          />
        </div>
        <p className="mt-1 text-xs text-slate-500">Add your photo or company logo (PNG, JPG, GIF or WebP, up to 1 MB).</p>

        {error && <p className="mt-3 rounded-md bg-red-50 px-3 py-2 text-xs text-red-700">{error}</p>}
        <div className="mt-5 flex justify-end gap-2">
          <button type="button" className="rounded-lg px-4 py-2 text-sm font-semibold text-slate-600 hover:bg-slate-100" onClick={onClose}>
            Cancel
          </button>
          <button type="button" disabled={busy || uploading} className="rounded-lg bg-[#1f9d4c] px-4 py-2 text-sm font-bold text-white disabled:opacity-60" onClick={() => void save()}>
            {busy ? "Saving…" : "Save"}
          </button>
        </div>
      </div>
    </div>
  );
}
