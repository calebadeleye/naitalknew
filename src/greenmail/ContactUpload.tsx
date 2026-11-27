import React, { useState } from "react";
import { Loader2, Upload, X } from "lucide-react";
import { gm, type ContactGroup } from "./api";
import { readContactFile, type ContactFile } from "./contactFile";

export type ImportResult = { message: string; created: number; contact_ids: number[]; group: ContactGroup | null };

const input = "w-full rounded-lg border border-slate-300 px-3 py-2 text-sm text-slate-900 outline-none focus:border-[#1f9d4c]";

/** "Upload contacts" button: picks a CSV or vCard and opens the dialog below. */
export function UploadContactsButton({ onPicked }: { onPicked: (file: { name: string; read: ContactFile }) => void }) {
  const [error, setError] = useState<string | null>(null);
  return (
    <span className="inline-flex flex-col">
      <label className="inline-flex cursor-pointer items-center gap-1.5 rounded-lg border border-slate-300 px-3 py-1.5 text-xs font-bold text-slate-700 hover:border-[#1f9d4c] hover:text-[#14632f]">
        <Upload className="h-3.5 w-3.5" /> Upload contacts
        <input
          type="file"
          accept=".csv,.txt,.tsv,.vcf,text/csv,text/vcard"
          className="sr-only"
          aria-label="Upload a contact list"
          onChange={(event) => {
            const file = event.target.files?.[0];
            event.target.value = "";
            setError(null);
            if (!file) return;
            if (/\.xlsx?$/i.test(file.name)) {
              setError("Excel files can't be read directly. In Excel choose File → Save As → CSV, then upload that.");
              return;
            }
            if (file.size > 5 * 1024 * 1024) {
              setError("That file is over 5 MB. Split it into smaller files.");
              return;
            }
            void file.text().then((text) => {
              const read = readContactFile(file.name, text);
              if (read.contacts.length === 0) setError("No email addresses were found in that file. It needs a column of email addresses.");
              else onPicked({ name: file.name, read });
            });
          }}
        />
      </label>
      {error && <span role="alert" className="mt-1 max-w-xs text-xs text-red-600">{error}</span>}
    </span>
  );
}

/** Shows what was found in the file, lets you put everyone in a group, then saves them to contacts. */
export function ContactUploadDialog({ token, file, groups, onClose, onImported, onSessionError }: { token: string; file: { name: string; read: ContactFile }; groups: ContactGroup[]; onClose: () => void; onImported: (result: ImportResult, useInCampaign: boolean) => void; onSessionError: (error: unknown) => void }) {
  const suggested = file.name.replace(/\.[^.]+$/, "").replace(/[_-]+/g, " ").trim().slice(0, 80);
  const [choice, setChoice] = useState<"new" | "existing" | "none">("new");
  const [groupName, setGroupName] = useState(suggested);
  const [groupId, setGroupId] = useState<number | "">(groups[0]?.id ?? "");
  const [useInCampaign, setUseInCampaign] = useState(true);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const { contacts, withoutEmail } = file.read;

  const save = async () => {
    setBusy(true);
    setError(null);
    try {
      const result = await gm<ImportResult>("/contacts/import", token, {
        method: "POST",
        body: JSON.stringify({
          contacts,
          group_id: choice === "existing" && groupId !== "" ? groupId : null,
          group_name: choice === "new" ? groupName : null,
        }),
      });
      onImported(result, useInCampaign);
    } catch (err) {
      onSessionError(err);
      setError(err instanceof Error ? err.message : "The contacts could not be saved.");
      setBusy(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/40 p-4" role="dialog" aria-modal="true" aria-label="Upload contacts">
      <div className="flex max-h-[90vh] w-full max-w-lg flex-col rounded-2xl bg-white p-5 shadow-xl">
        <div className="flex items-start gap-2">
          <div className="mr-auto min-w-0">
            <h2 className="text-lg font-black text-slate-900">Upload contacts</h2>
            <p className="truncate text-sm text-slate-500">
              {file.name} · <strong className="text-slate-800">{contacts.length.toLocaleString()}</strong> {contacts.length === 1 ? "person" : "people"} found
              {withoutEmail ? ` · ${withoutEmail.toLocaleString()} ${withoutEmail === 1 ? "row" : "rows"} without an email address skipped` : ""}
            </p>
          </div>
          <button type="button" aria-label="Close" onClick={onClose} className="rounded p-1 text-slate-500 hover:bg-slate-100">
            <X className="h-5 w-5" />
          </button>
        </div>

        <div className="mt-3 min-h-0 overflow-auto rounded-lg border border-slate-100">
          <table className="w-full text-left text-xs">
            <thead className="bg-slate-50 text-slate-500">
              <tr>
                <th className="px-2 py-1.5 font-semibold">Name</th>
                <th className="px-2 py-1.5 font-semibold">Email</th>
                <th className="hidden px-2 py-1.5 font-semibold sm:table-cell">Phone</th>
              </tr>
            </thead>
            <tbody>
              {contacts.slice(0, 5).map((c) => (
                <tr key={c.email} className="border-t border-slate-100">
                  <td className="px-2 py-1.5 text-slate-800">{c.name ?? <span className="text-slate-400">—</span>}</td>
                  <td className="break-all px-2 py-1.5 text-slate-800">{c.email}</td>
                  <td className="hidden px-2 py-1.5 text-slate-600 sm:table-cell">{c.phone ?? ""}</td>
                </tr>
              ))}
            </tbody>
          </table>
          {contacts.length > 5 && <p className="border-t border-slate-100 px-2 py-1.5 text-xs text-slate-500">…and {(contacts.length - 5).toLocaleString()} more</p>}
        </div>

        <fieldset className="mt-4 grid gap-2 text-sm text-slate-800">
          <legend className="mb-1 text-sm font-bold text-slate-900">Put them in a group</legend>
          <label className="flex items-center gap-2">
            <input type="radio" name="group" className="accent-[#1f9d4c]" checked={choice === "new"} onChange={() => setChoice("new")} /> New group
          </label>
          {choice === "new" && <input value={groupName} onChange={(event) => setGroupName(event.target.value)} maxLength={80} placeholder="e.g. Customers" aria-label="New group name" className={`${input} ml-6 w-auto`} />}
          {groups.length > 0 && (
            <label className="flex items-center gap-2">
              <input type="radio" name="group" className="accent-[#1f9d4c]" checked={choice === "existing"} onChange={() => setChoice("existing")} /> Add to a group I have
            </label>
          )}
          {choice === "existing" && (
            <select value={groupId} onChange={(event) => setGroupId(Number(event.target.value))} aria-label="Group" className={`${input} ml-6 w-auto`}>
              {groups.map((g) => <option key={g.id} value={g.id}>{g.name} ({g.contacts_count})</option>)}
            </select>
          )}
          <label className="flex items-center gap-2">
            <input type="radio" name="group" className="accent-[#1f9d4c]" checked={choice === "none"} onChange={() => setChoice("none")} /> No group, just add them to my contacts
          </label>
        </fieldset>

        <label className="mt-3 flex items-center gap-2 text-sm text-slate-800">
          <input type="checkbox" className="h-4 w-4 accent-[#1f9d4c]" checked={useInCampaign} onChange={(event) => setUseInCampaign(event.target.checked)} />
          Send this campaign to them
        </label>
        <p className="mt-2 text-xs text-slate-500">People already in your contacts keep their details. Only upload people who agreed to hear from you.</p>
        {error && <p role="alert" className="mt-2 text-sm text-red-600">{error}</p>}

        <div className="mt-4 flex justify-end gap-2">
          <button type="button" onClick={onClose} className="rounded-lg px-3 py-2 text-sm font-semibold text-slate-600 hover:bg-slate-100">Cancel</button>
          <button type="button" disabled={busy || (choice === "new" && !groupName.trim())} onClick={() => void save()} className="inline-flex items-center gap-1.5 rounded-lg bg-[#1f9d4c] px-4 py-2 text-sm font-bold text-white disabled:opacity-60">
            {busy && <Loader2 className="h-4 w-4 animate-spin" />} Add {contacts.length.toLocaleString()} {contacts.length === 1 ? "contact" : "contacts"}
          </button>
        </div>
      </div>
    </div>
  );
}
