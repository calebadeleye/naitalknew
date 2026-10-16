import React, { useCallback, useEffect, useState } from "react";
import { FileText, Loader2, Pencil, Plus, Trash2 } from "lucide-react";
import { gm, type Template } from "./api";
import { useFeedback } from "./feedback";
import { htmlToText, RichText } from "./RichText";
import { announceChange, useOnChange } from "./sync";

/** Shared by the Templates page, the composer and campaigns. */
export function useTemplates(token: string, onSessionError: (error: unknown) => void) {
  const [templates, setTemplates] = useState<Template[] | null>(null);

  const load = useCallback(() => {
    gm<{ templates: Template[] }>("/templates", token)
      .then((response) => setTemplates(response.templates))
      .catch((error) => {
        onSessionError(error);
        setTemplates([]);
      });
  }, [token, onSessionError]);

  useEffect(load, [load]);
  useOnChange("templates", load);

  return templates;
}

type Draft = { id?: number; name: string; subject: string; body_html: string; key: number };

/** Reusable emails. Pick one in the composer ("Templates") to fill in the subject and message. */
export function TemplatesView({ token, onSessionError, onUse }: { token: string; onSessionError: (error: unknown) => void; onUse: (template: Template) => void }) {
  const templates = useTemplates(token, onSessionError);
  const [editing, setEditing] = useState<Draft | null>(null);
  const [busy, setBusy] = useState(false);
  const { toast, confirm } = useFeedback();

  const save = async () => {
    if (!editing) return;
    setBusy(true);
    try {
      const result = await gm<{ message: string }>(editing.id ? `/templates/${editing.id}` : "/templates", token, {
        method: editing.id ? "PUT" : "POST",
        body: JSON.stringify({ name: editing.name, subject: editing.subject || null, body_html: editing.body_html }),
      });
      toast(result.message);
      setEditing(null);
      announceChange("templates");
    } catch (error) {
      onSessionError(error);
      toast(error instanceof Error ? error.message : "Could not save the template.", "error");
    } finally {
      setBusy(false);
    }
  };

  const remove = async (template: Template) => {
    if (!(await confirm({ title: "Delete this template?", message: template.name, confirmLabel: "Delete", danger: true }))) return;
    try {
      await gm(`/templates/${template.id}`, token, { method: "DELETE" });
      toast("Template deleted.");
      announceChange("templates");
    } catch (error) {
      onSessionError(error);
      toast(error instanceof Error ? error.message : "Could not delete the template.", "error");
    }
  };

  return (
    <section className="flex min-h-0 flex-1 flex-col overflow-y-auto bg-white p-3 sm:p-6">
      <div className="mx-auto w-full max-w-3xl">
        <div className="flex flex-wrap items-center gap-2">
          <div className="mr-auto">
            <h1 className="text-xl font-black text-slate-900 sm:text-2xl">Templates</h1>
            <p className="text-sm text-slate-500">Emails you send often. Use {"{{first_name}}"} or {"{{name}}"} — campaigns fill them in for each person.</p>
          </div>
          {!editing && (
            <button type="button" className="inline-flex items-center gap-1.5 rounded-lg bg-[#1f9d4c] px-3 py-2 text-sm font-bold text-white" onClick={() => setEditing({ name: "", subject: "", body_html: "<p><br></p>", key: Date.now() })}>
              <Plus className="h-4 w-4" /> New template
            </button>
          )}
        </div>

        {editing ? (
          <form
            className="mt-5 grid gap-3"
            onSubmit={(event) => {
              event.preventDefault();
              void save();
            }}
          >
            <label className="text-sm font-semibold text-slate-700">
              Template name
              <input required value={editing.name} onChange={(event) => setEditing({ ...editing, name: event.target.value })} maxLength={120} placeholder="e.g. Invoice follow-up" className="mt-1 w-full rounded-lg border border-slate-300 px-3 py-2 text-sm font-normal outline-none focus:border-[#1f9d4c]" />
            </label>
            <label className="text-sm font-semibold text-slate-700">
              Subject
              <input value={editing.subject} onChange={(event) => setEditing({ ...editing, subject: event.target.value })} maxLength={300} className="mt-1 w-full rounded-lg border border-slate-300 px-3 py-2 text-sm font-normal outline-none focus:border-[#1f9d4c]" />
            </label>
            <React.Fragment key={editing.key}>
              <RichText label="Template message" initialHtml={editing.body_html} onChange={(html) => setEditing((current) => current && { ...current, body_html: html })} />
            </React.Fragment>
            <div className="flex justify-end gap-2">
              <button type="button" className="rounded-lg px-4 py-2 text-sm font-semibold text-slate-600 hover:bg-slate-100" onClick={() => setEditing(null)}>
                Cancel
              </button>
              <button type="submit" disabled={busy || !editing.name.trim()} className="rounded-lg bg-[#1f9d4c] px-4 py-2 text-sm font-bold text-white disabled:opacity-60">
                {busy ? "Saving…" : "Save template"}
              </button>
            </div>
          </form>
        ) : templates === null ? (
          <Loader2 className="mt-6 h-5 w-5 animate-spin text-slate-400" />
        ) : templates.length === 0 ? (
          <div className="mt-12 flex flex-col items-center gap-2 text-center text-slate-500">
            <FileText className="h-10 w-10 text-slate-300" />
            <p className="text-sm">No templates yet. Save one here, or from the composer.</p>
          </div>
        ) : (
          <ul className="mt-5 divide-y divide-slate-100 rounded-xl border border-slate-200">
            {templates.map((template) => (
              <li key={template.id} className="flex flex-wrap items-center gap-3 p-4">
                <FileText className="h-5 w-5 shrink-0 text-[#1f9d4c]" />
                <div className="min-w-0 flex-1">
                  <p className="truncate font-bold text-slate-900">{template.name}</p>
                  <p className="truncate text-sm text-slate-500">{template.subject || "(no subject)"} — {htmlToText(template.body_html).slice(0, 90)}</p>
                </div>
                <button type="button" className="rounded-lg border border-[#1f9d4c]/40 px-3 py-1.5 text-sm font-bold text-[#15803d] hover:bg-[#eef8f1]" onClick={() => onUse(template)}>
                  Write with it
                </button>
                <button type="button" aria-label={`Edit ${template.name}`} className="rounded p-2 text-slate-500 hover:bg-slate-100" onClick={() => setEditing({ id: template.id, name: template.name, subject: template.subject ?? "", body_html: template.body_html ?? "", key: Date.now() })}>
                  <Pencil className="h-4 w-4" />
                </button>
                <button type="button" aria-label={`Delete ${template.name}`} className="rounded p-2 text-slate-500 hover:bg-slate-100 hover:text-red-600" onClick={() => void remove(template)}>
                  <Trash2 className="h-4 w-4" />
                </button>
              </li>
            ))}
          </ul>
        )}
      </div>
    </section>
  );
}
