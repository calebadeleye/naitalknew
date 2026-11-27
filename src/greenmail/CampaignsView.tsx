import React, { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { ArrowLeft, CalendarClock, Loader2, Megaphone, Plus, Send, Trash2, Users } from "lucide-react";
import { gm, type Campaign, type CampaignLimits, type CampaignQuota, type Contact, type ContactGroup } from "./api";
import { ContactUploadDialog, UploadContactsButton } from "./ContactUpload";
import type { ContactFile } from "./contactFile";
import { BuyEmailsDialog, QuotaMeter } from "./CampaignCredits";
import { useFeedback } from "./feedback";
import { RichText } from "./RichText";
import { announceChange, useOnChange } from "./sync";
import { useTemplates } from "./TemplatesView";
import { CampaignReportView } from "./CampaignReport";
import { useHoldReload } from "./appUpdate";

const STATUS: Record<Campaign["status"], { label: string; tone: string }> = {
  draft: { label: "Draft", tone: "bg-slate-100 text-slate-700" },
  sending: { label: "Sending", tone: "bg-[#e3f4e9] text-[#14632f]" },
  sent: { label: "Sent", tone: "bg-[#dbeafe] text-[#1e40af]" },
  cancelled: { label: "Stopped", tone: "bg-amber-50 text-amber-800" },
  failed: { label: "Failed", tone: "bg-red-50 text-red-700" },
};

type Person = { email: string; name: string | null };
type Draft = { id?: number; name: string; subject: string; body_html: string; track: boolean; key: number; allContacts: boolean; contactIds: number[]; groupIds: number[]; pasted: string };

/** "Ada Obi <ada@x.com>, bola@y.com" → people. */
export function parsePeople(text: string): Person[] {
  return text
    .split(/[\n,;]+/)
    .map((part) => part.trim())
    .filter(Boolean)
    .map((part) => {
      const match = part.match(/^(.*?)\s*<\s*([^>]+)\s*>$/);
      const email = (match ? match[2] : part).trim().toLowerCase();
      const name = match ? match[1].replace(/^["']|["']$/g, "").trim() || null : null;
      return { email, name };
    })
    .filter((person) => /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(person.email));
}

const input = "w-full rounded-lg border border-slate-300 px-3 py-2 text-sm text-slate-900 outline-none focus:border-[#1f9d4c]";
const pct = (n: number, of: number) => `${of ? Math.round((n / of) * 100) : 0}%`;
const when = (iso: string | null) => (iso ? new Date(iso).toLocaleString("en-US", { month: "short", day: "numeric", hour: "numeric", minute: "2-digit" }) : "");

/** Campaigns: one email sent separately to each person on a list. */
export function CampaignsView({ token, onSessionError }: { token: string; onSessionError: (error: unknown) => void }) {
  const [campaigns, setCampaigns] = useState<Campaign[] | null>(null);
  const [limits, setLimits] = useState<CampaignLimits | null>(null);
  const [quota, setQuota] = useState<CampaignQuota | null>(null);
  const [buying, setBuying] = useState(false);
  const [openId, setOpenId] = useState<number | null>(null);
  const [draft, setDraft] = useState<Draft | null>(null);

  const load = useCallback(() => {
    gm<{ campaigns: Campaign[]; limits: CampaignLimits; quota: CampaignQuota }>("/campaigns", token)
      .then((response) => {
        setCampaigns(response.campaigns);
        setLimits(response.limits);
        setQuota(response.quota);
      })
      .catch((error) => {
        onSessionError(error);
        setCampaigns([]);
      });
  }, [token, onSessionError]);

  useEffect(load, [load]);
  useOnChange("campaigns", load);
  // Sending happens a few emails a minute; keep the progress moving.
  const sending = campaigns?.some((c) => c.status === "sending");
  useEffect(() => {
    if (!sending) return;
    const timer = window.setInterval(load, 15000);
    return () => window.clearInterval(timer);
  }, [sending, load]);

  const buyDialog = buying && quota && <BuyEmailsDialog token={token} quota={quota} onClose={() => setBuying(false)} onSessionError={onSessionError} />;

  if (draft) {
    return <>{buyDialog}<CampaignEditor token={token} draft={draft} limits={limits} quota={quota} onBuy={() => setBuying(true)} onSessionError={onSessionError} onDone={(id) => { setDraft(null); setOpenId(id); }} onCancel={() => setDraft(null)} /></>;
  }

  if (openId) {
    return <CampaignDetail token={token} id={openId} onSessionError={onSessionError} onBack={() => setOpenId(null)} onEdit={(campaign) => setDraft({ id: campaign.id, name: campaign.name, subject: campaign.subject, body_html: campaign.body_html ?? "", track: campaign.track, key: Date.now(), allContacts: false, contactIds: [], groupIds: [], pasted: (campaign.recipients ?? []).map((r) => (r.name ? `${r.name} <${r.email}>` : r.email)).join("\n") })} />;
  }

  return (
    <section className="flex min-h-0 flex-1 flex-col overflow-y-auto bg-white p-3 sm:p-6">
      <div className="mx-auto w-full max-w-3xl">
        <div className="flex flex-wrap items-center gap-2">
          <div className="mr-auto">
            <h1 className="flex items-center gap-2 text-xl font-black text-slate-900 sm:text-2xl"><Megaphone className="h-6 w-6 text-[#1f9d4c]" /> Campaigns</h1>
            <p className="text-sm text-slate-500">Send one email to many people — each gets their own copy, with an unsubscribe link.</p>
          </div>
          <button type="button" className="inline-flex items-center gap-1.5 rounded-lg bg-[#1f9d4c] px-3 py-2 text-sm font-bold text-white" onClick={() => setDraft({ name: "", subject: "", body_html: "<p>Hi {{first_name}},</p><p><br></p>", track: true, key: Date.now(), allContacts: false, contactIds: [], groupIds: [], pasted: "" })}>
            <Plus className="h-4 w-4" /> New campaign
          </button>
        </div>
        {buyDialog}
        {quota && <QuotaMeter quota={quota} onBuy={() => setBuying(true)} />}
        {limits && <p className="mt-3 rounded-lg bg-slate-50 px-3 py-2 text-xs text-slate-600">To protect your domain's reputation, campaigns send up to {limits.per_minute} emails a minute and {limits.per_day} a day, to at most {limits.max_recipients} people each.</p>}

        {campaigns === null ? (
          <Loader2 className="mt-6 h-5 w-5 animate-spin text-slate-400" />
        ) : campaigns.length === 0 ? (
          <div className="mt-12 flex flex-col items-center gap-2 text-center text-slate-500">
            <Megaphone className="h-10 w-10 text-slate-300" />
            <p className="text-sm">No campaigns yet.</p>
          </div>
        ) : (
          <ul className="mt-5 grid gap-3">
            {campaigns.map((campaign) => {
              const done = campaign.sent_count + campaign.failed_count + campaign.skipped_count;
              const percent = campaign.total ? Math.round((done / campaign.total) * 100) : 0;
              return (
                <li key={campaign.id}>
                  <button type="button" className="w-full rounded-xl border border-slate-200 p-4 text-left hover:border-[#1f9d4c]" onClick={() => setOpenId(campaign.id)}>
                    <span className="flex items-center gap-2">
                      <span className="min-w-0 flex-1 truncate font-bold text-slate-900">{campaign.name}</span>
                      <span className={`rounded-full px-2.5 py-0.5 text-xs font-bold ${STATUS[campaign.status].tone}`}>{STATUS[campaign.status].label}</span>
                    </span>
                    <span className="mt-0.5 block truncate text-sm text-slate-500">{campaign.subject}</span>
                    {campaign.status !== "draft" && (
                      <span className="mt-3 block">
                        <span className="block h-1.5 overflow-hidden rounded-full bg-slate-100"><span className="block h-full bg-[#22a04f]" style={{ width: `${percent}%` }} /></span>
                        <span className="mt-1 block text-xs text-slate-500">
                          {campaign.sent_count} of {campaign.total} sent{campaign.failed_count ? ` · ${campaign.failed_count} failed` : ""}{campaign.skipped_count ? ` · ${campaign.skipped_count} unsubscribed` : ""}
                          {campaign.track && campaign.sent_count > 0 ? ` · ${pct(campaign.opened_count, campaign.sent_count)} opened · ${pct(campaign.clicked_count, campaign.sent_count)} clicked` : ""}
                          {campaign.status === "sending" && campaign.send_at && new Date(campaign.send_at) > new Date() ? ` · starts ${when(campaign.send_at)}` : ""}
                        </span>
                      </span>
                    )}
                    {campaign.status === "draft" && <span className="mt-1 block text-xs text-slate-500">{campaign.total} recipient{campaign.total === 1 ? "" : "s"}</span>}
                  </button>
                </li>
              );
            })}
          </ul>
        )}
      </div>
    </section>
  );
}

function CampaignEditor({ token, draft: initial, limits, quota, onBuy, onSessionError, onDone, onCancel }: { token: string; draft: Draft; limits: CampaignLimits | null; quota: CampaignQuota | null; onBuy: () => void; onSessionError: (error: unknown) => void; onDone: (id: number) => void; onCancel: () => void }) {
  const [draft, setDraft] = useState(initial);
  useHoldReload("campaign-editor", true);
  const [contacts, setContacts] = useState<Contact[] | null>(null);
  const [contactQuery, setContactQuery] = useState("");
  const [groups, setGroups] = useState<ContactGroup[]>([]);
  const [totalContacts, setTotalContacts] = useState<number | null>(null);
  const [groupFilter, setGroupFilter] = useState<number | "">("");
  const [upload, setUpload] = useState<{ name: string; read: ContactFile } | null>(null);
  const [busy, setBusy] = useState<"save" | "test" | "send" | null>(null);
  const [scheduleAt, setScheduleAt] = useState("");
  const [error, setError] = useState<string | null>(null);
  const templates = useTemplates(token, onSessionError);
  const { toast, confirm } = useFeedback();

  const loadContacts = useCallback(
    () =>
      gm<{ contacts: Contact[]; groups: ContactGroup[]; total: number }>("/contacts?all=1", token)
        .then((response) => {
          setContacts(response.contacts);
          setGroups(response.groups);
          setTotalContacts(response.total);
        })
        .catch(() => setContacts([])),
    [token],
  );
  useEffect(() => void loadContacts(), [loadContacts]);
  useOnChange("contacts", () => void loadContacts());

  // Put the people checked below into a group (a new one, or one you have).
  const groupChecked = async (target: number | "new") => {
    const name = target === "new" ? window.prompt("Name of the new group")?.trim() : null;
    if (target === "new" && !name) return;
    try {
      const id = target === "new" ? (await gm<{ group: ContactGroup }>("/contact-groups", token, { method: "POST", body: JSON.stringify({ name }) })).group.id : target;
      const result = await gm<{ group: ContactGroup }>(`/contact-groups/${id}`, token, { method: "PUT", body: JSON.stringify({ add: draft.contactIds }) });
      toast(`${draft.contactIds.length} added to “${result.group.name}”.`);
      announceChange("contacts");
    } catch (err) {
      onSessionError(err);
      toast(err instanceof Error ? err.message : "Could not update the group.", "error");
    }
  };

  const deleteGroup = async (group: ContactGroup) => {
    if (!(await confirm({ title: `Delete the group “${group.name}”?`, message: "The people in it stay in your contacts.", confirmLabel: "Delete group", danger: true }))) return;
    try {
      await gm(`/contact-groups/${group.id}`, token, { method: "DELETE" });
      setDraft((current) => ({ ...current, groupIds: current.groupIds.filter((id) => id !== group.id) }));
      if (groupFilter === group.id) setGroupFilter("");
      announceChange("contacts");
    } catch (err) {
      onSessionError(err);
      toast(err instanceof Error ? err.message : "Could not delete the group.", "error");
    }
  };

  const pasted = useMemo(() => parsePeople(draft.pasted), [draft.pasted]);
  const recipientCount = useMemo(() => {
    const emails = new Set(pasted.map((p) => p.email));
    (contacts ?? [])
      .filter((c) => draft.allContacts || draft.contactIds.includes(c.id) || (c.group_ids ?? []).some((id) => draft.groupIds.includes(id)))
      .forEach((c) => emails.add(c.email.toLowerCase()));
    return emails.size;
  }, [pasted, contacts, draft.allContacts, draft.contactIds, draft.groupIds]);

  const matching = (contacts ?? []).filter(
    (c) => (groupFilter === "" || (c.group_ids ?? []).includes(groupFilter)) && (!contactQuery || `${c.name ?? ""} ${c.email}`.toLowerCase().includes(contactQuery.toLowerCase())),
  );
  const visibleContacts = matching.slice(0, 200);

  const save = async (): Promise<number | null> => {
    setError(null);
    try {
      const result = await gm<{ campaign: Campaign; message: string }>(draft.id ? `/campaigns/${draft.id}` : "/campaigns", token, {
        method: draft.id ? "PUT" : "POST",
        body: JSON.stringify({ name: draft.name, subject: draft.subject, body_html: draft.body_html, track: draft.track, recipients: pasted, contact_ids: draft.contactIds, group_ids: draft.groupIds, all_contacts: draft.allContacts }),
      });
      setDraft((current) => ({ ...current, id: result.campaign.id }));
      announceChange("campaigns");
      return result.campaign.id;
    } catch (err) {
      onSessionError(err);
      setError(err instanceof Error ? err.message : "Could not save the campaign.");
      return null;
    }
  };

  // What sending this campaign uses from the month's emails and bought credits.
  const available = quota && !quota.unlimited ? quota.available : null;
  const shortBy = available === null ? 0 : Math.max(0, recipientCount - available);

  const run = async (action: "save" | "test" | "send") => {
    setBusy(action);
    try {
      const id = await save();
      if (!id) return;
      if (action === "save") {
        toast("Campaign saved as a draft.");
        onDone(id);
      } else if (action === "test") {
        const result = await gm<{ message: string }>(`/campaigns/${id}/test`, token, { method: "POST" });
        toast(result.message);
      } else {
        const sendAt = scheduleAt ? new Date(scheduleAt).toISOString() : null;
        const ok = await confirm({
          title: sendAt ? `Schedule this campaign for ${when(sendAt)}?` : `Send this campaign to ${recipientCount} ${recipientCount === 1 ? "person" : "people"}?`,
          message: `Each person gets their own copy. You can stop it while it is sending.${shortBy > 0 ? ` You have ${available} campaign emails left, so it will pause after ${available} until you buy more.` : ""}`,
          confirmLabel: sendAt ? "Schedule" : "Send now",
        });
        if (!ok) return;
        const result = await gm<{ message: string }>(`/campaigns/${id}/send`, token, { method: "POST", body: JSON.stringify({ send_at: sendAt }) });
        toast(result.message);
        announceChange("campaigns");
        onDone(id);
      }
    } catch (err) {
      onSessionError(err);
      setError(err instanceof Error ? err.message : "That did not work.");
    } finally {
      setBusy(null);
    }
  };

  return (
    <section className="flex min-h-0 flex-1 flex-col overflow-y-auto bg-white p-3 sm:p-6">
      <div className="mx-auto grid w-full max-w-3xl gap-4 pb-10">
        <button type="button" className="inline-flex items-center gap-1.5 justify-self-start text-sm font-semibold text-slate-600 hover:text-slate-900" onClick={onCancel}>
          <ArrowLeft className="h-4 w-4" /> Campaigns
        </button>
        <h1 className="text-xl font-black text-slate-900 sm:text-2xl">{draft.id ? "Edit campaign" : "New campaign"}</h1>

        <label className="text-sm font-semibold text-slate-700">
          Campaign name <span className="font-normal text-slate-400">(only you see this)</span>
          <input value={draft.name} onChange={(event) => setDraft({ ...draft, name: event.target.value })} maxLength={120} placeholder="e.g. October newsletter" className={`${input} mt-1`} />
        </label>
        <label className="text-sm font-semibold text-slate-700">
          Subject
          <input value={draft.subject} onChange={(event) => setDraft({ ...draft, subject: event.target.value })} maxLength={300} placeholder="e.g. News for {{first_name}}" className={`${input} mt-1`} />
        </label>
        <div>
          <p className="mb-1 text-sm font-semibold text-slate-700">Message</p>
          <React.Fragment key={draft.key}>
            <RichText
              label="Campaign message"
              initialHtml={draft.body_html}
              onChange={(html) => setDraft((current) => ({ ...current, body_html: html }))}
              toolbarExtra={
                templates && templates.length > 0 ? (
                  <select
                    aria-label="Use a template"
                    value=""
                    className="rounded-md border border-slate-200 bg-white px-2 py-1 text-xs"
                    onChange={(event) => {
                      const template = templates.find((t) => String(t.id) === event.target.value);
                      if (template) setDraft((current) => ({ ...current, subject: current.subject || template.subject || "", body_html: template.body_html ?? "", key: Date.now() }));
                    }}
                  >
                    <option value="">Use a template…</option>
                    {templates.map((t) => <option key={t.id} value={t.id}>{t.name}</option>)}
                  </select>
                ) : null
              }
            />
          </React.Fragment>
          <p className="mt-1 text-xs text-slate-500">{"{{first_name}}"}, {"{{name}}"} and {"{{email}}"} are replaced for each person. An unsubscribe link is added at the bottom.</p>
        </div>

        <fieldset className="rounded-xl border border-slate-200 p-4">
          <legend className="px-1 text-sm font-bold text-slate-900"><Users className="mr-1 inline h-4 w-4" /> Recipients · {recipientCount}{limits ? ` of up to ${limits.max_recipients}` : ""}</legend>
          <div className="flex flex-wrap items-center gap-x-4 gap-y-2">
            <label className="mr-auto flex items-center gap-2 text-sm text-slate-800">
              <input type="checkbox" className="h-4 w-4 accent-[#1f9d4c]" checked={draft.allContacts} onChange={(event) => setDraft({ ...draft, allContacts: event.target.checked })} />
              All my contacts ({totalContacts?.toLocaleString() ?? "…"})
            </label>
            <UploadContactsButton onPicked={setUpload} />
          </div>

          {!draft.allContacts && groups.length > 0 && (
            <div className="mt-3">
              <p className="text-xs font-bold uppercase tracking-wide text-slate-500">Groups</p>
              <ul className="mt-1.5 flex flex-wrap gap-2">
                {groups.map((group) => {
                  const on = draft.groupIds.includes(group.id);
                  return (
                    <li key={group.id} className={`group inline-flex items-center rounded-full border text-sm ${on ? "border-[#1f9d4c] bg-[#e3f4e9] text-[#14632f]" : "border-slate-300 text-slate-700"}`}>
                      <label className="flex cursor-pointer items-center gap-1.5 py-1 pl-3 pr-1">
                        <input
                          type="checkbox"
                          className="h-3.5 w-3.5 accent-[#1f9d4c]"
                          checked={on}
                          onChange={(event) => setDraft({ ...draft, groupIds: event.target.checked ? [...draft.groupIds, group.id] : draft.groupIds.filter((id) => id !== group.id) })}
                        />
                        <span className="font-semibold">{group.name}</span>
                        <span className="text-xs opacity-70">{group.contacts_count.toLocaleString()}</span>
                      </label>
                      <button type="button" aria-label={`Delete the group ${group.name}`} title="Delete group" onClick={() => void deleteGroup(group)} className="mr-1 rounded-full p-1 opacity-50 hover:bg-white hover:opacity-100">
                        <Trash2 className="h-3 w-3" />
                      </button>
                    </li>
                  );
                })}
              </ul>
            </div>
          )}

          {!draft.allContacts && contacts && contacts.length > 0 && (
            <div className="mt-3">
              <div className="flex gap-2">
                <input value={contactQuery} onChange={(event) => setContactQuery(event.target.value)} placeholder="Find contacts" aria-label="Find contacts" className={input} />
                {groups.length > 0 && (
                  <select value={groupFilter} onChange={(event) => setGroupFilter(event.target.value === "" ? "" : Number(event.target.value))} aria-label="Show a group" className={`${input} w-auto`}>
                    <option value="">Everyone</option>
                    {groups.map((g) => <option key={g.id} value={g.id}>{g.name}</option>)}
                  </select>
                )}
              </div>
              <ul className="mt-2 max-h-48 overflow-y-auto rounded-lg border border-slate-100">
                {visibleContacts.map((contact) => (
                  <li key={contact.id}>
                    <label className="flex items-center gap-2 px-3 py-1.5 text-sm hover:bg-slate-50">
                      <input
                        type="checkbox"
                        className="h-4 w-4 accent-[#1f9d4c]"
                        checked={draft.contactIds.includes(contact.id)}
                        onChange={(event) => setDraft({ ...draft, contactIds: event.target.checked ? [...draft.contactIds, contact.id] : draft.contactIds.filter((id) => id !== contact.id) })}
                      />
                      <span className="min-w-0 flex-1 truncate">{contact.name ? `${contact.name} — ${contact.email}` : contact.email}</span>
                      {(contact.group_ids ?? []).length > 0 && (
                        <span className="hidden shrink-0 text-xs text-slate-400 sm:inline">{groups.filter((g) => contact.group_ids?.includes(g.id)).map((g) => g.name).join(", ")}</span>
                      )}
                    </label>
                  </li>
                ))}
                {matching.length > visibleContacts.length && <li className="px-3 py-1.5 text-xs text-slate-500">Showing {visibleContacts.length} of {matching.length.toLocaleString()}. Search to find others.</li>}
                {matching.length === 0 && <li className="px-3 py-1.5 text-xs text-slate-500">No contacts match.</li>}
              </ul>
              {draft.contactIds.length > 0 && (
                <div className="mt-2 flex flex-wrap items-center gap-2 text-xs text-slate-600">
                  <span>{draft.contactIds.length} checked</span>
                  <select
                    value=""
                    aria-label="Add the checked people to a group"
                    onChange={(event) => void groupChecked(event.target.value === "new" ? "new" : Number(event.target.value))}
                    className="rounded-md border border-slate-300 bg-white px-2 py-1 text-xs"
                  >
                    <option value="">Add them to a group…</option>
                    {groups.map((g) => <option key={g.id} value={g.id}>{g.name}</option>)}
                    <option value="new">New group…</option>
                  </select>
                </div>
              )}
            </div>
          )}
          <label className="mt-3 block text-sm font-semibold text-slate-700">
            Add addresses <span className="font-normal text-slate-400">(one per line, or “Name &lt;email&gt;”)</span>
            <textarea value={draft.pasted} onChange={(event) => setDraft({ ...draft, pasted: event.target.value })} rows={4} placeholder={"Ada Obi <ada@example.com>\nbola@example.com"} className={`${input} mt-1 resize-y font-mono text-xs`} />
          </label>
          <p className="mt-2 text-xs text-slate-500">Only email people who expect to hear from you. People who unsubscribed are skipped automatically. To upload, use a CSV (in Excel: Save As → CSV) or a .vcf exported from your phone.</p>
        </fieldset>
        {upload && (
          <ContactUploadDialog
            token={token}
            file={upload}
            groups={groups}
            onSessionError={onSessionError}
            onClose={() => setUpload(null)}
            onImported={(result, useInCampaign) => {
              setUpload(null);
              toast(result.message);
              if (useInCampaign) {
                setDraft((current) =>
                  result.group
                    ? { ...current, groupIds: current.groupIds.includes(result.group.id) ? current.groupIds : [...current.groupIds, result.group.id] }
                    : { ...current, contactIds: Array.from(new Set([...current.contactIds, ...result.contact_ids])) },
                );
              }
              announceChange("contacts");
              void loadContacts();
            }}
          />
        )}

        <label className="flex items-start gap-2 rounded-xl border border-slate-200 p-3 text-sm text-slate-700">
          <input type="checkbox" className="mt-0.5 h-4 w-4 accent-[#1f9d4c]" checked={draft.track} onChange={(event) => setDraft({ ...draft, track: event.target.checked })} />
          <span>
            <span className="font-semibold">Track opens and link clicks</span>
            <span className="block text-xs text-slate-500">See who opened the email and which links they clicked in the campaign report. Adds an invisible picture, and links go through Green Mail on the way to their address.</span>
          </span>
        </label>

        {quota && quota.unlimited === false && recipientCount > 0 && (
          <div className={`flex flex-wrap items-center gap-2 rounded-xl px-3 py-2 text-sm ${shortBy > 0 ? "bg-amber-50 text-amber-900" : "bg-slate-50 text-slate-600"}`}>
            <p className="mr-auto">
              This campaign uses <strong>{recipientCount.toLocaleString()}</strong> {recipientCount === 1 ? "email" : "emails"}. You have {quota.left.toLocaleString()} left this month
              {quota.credits > 0 ? ` and ${quota.credits.toLocaleString()} bought` : ""}.
              {shortBy > 0 ? ` ${shortBy.toLocaleString()} more needed: it will pause until you buy more or the month resets.` : ""}
            </p>
            {shortBy > 0 && quota.can_buy && (
              <button type="button" onClick={onBuy} className="rounded-lg bg-[#1f9d4c] px-3 py-1.5 text-xs font-bold text-white">
                Buy more emails
              </button>
            )}
          </div>
        )}

        {error && <p className="rounded-md bg-red-50 px-3 py-2 text-sm text-red-700">{error}</p>}

        <div className="flex flex-wrap items-center gap-2 rounded-xl bg-slate-50 p-3">
          <button type="button" disabled={busy !== null || !draft.name.trim() || !draft.subject.trim()} className="rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm font-semibold text-slate-700 disabled:opacity-50" onClick={() => void run("save")}>
            {busy === "save" ? "Saving…" : "Save draft"}
          </button>
          <button type="button" disabled={busy !== null || !draft.name.trim() || !draft.subject.trim()} className="rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm font-semibold text-slate-700 disabled:opacity-50" onClick={() => void run("test")}>
            {busy === "test" ? "Sending…" : "Send me a test"}
          </button>
          <label className="ml-auto flex items-center gap-1.5 text-xs font-semibold text-slate-600">
            <CalendarClock className="h-4 w-4" />
            <input type="datetime-local" aria-label="Schedule for (optional)" value={scheduleAt} onChange={(event) => setScheduleAt(event.target.value)} className="rounded-md border border-slate-300 bg-white px-2 py-1.5 text-xs" />
          </label>
          <button type="button" disabled={busy !== null || recipientCount === 0 || !draft.name.trim() || !draft.subject.trim()} className="inline-flex items-center gap-1.5 rounded-lg bg-[#1f9d4c] px-4 py-2 text-sm font-bold text-white disabled:opacity-50" onClick={() => void run("send")}>
            {busy === "send" ? <Loader2 className="h-4 w-4 animate-spin" /> : <Send className="h-4 w-4" />} {scheduleAt ? "Schedule" : "Send now"}
          </button>
        </div>
      </div>
    </section>
  );
}

function CampaignDetail({ token, id, onSessionError, onBack, onEdit }: { token: string; id: number; onSessionError: (error: unknown) => void; onBack: () => void; onEdit: (campaign: Campaign) => void }) {
  const [campaign, setCampaign] = useState<Campaign | null>(null);
  const { toast, confirm } = useFeedback();
  const backRef = useRef(onBack);
  backRef.current = onBack;

  const load = useCallback(() => {
    gm<{ campaign: Campaign }>(`/campaigns/${id}`, token)
      .then((response) => setCampaign(response.campaign))
      .catch((error) => {
        onSessionError(error);
        toast(error instanceof Error ? error.message : "Could not open the campaign.", "error");
        backRef.current();
      });
  }, [id, token, onSessionError, toast]);

  useEffect(load, [load]);
  useOnChange("campaigns", load);
  // Sending: refresh often. Sent: opens and clicks keep coming in for days.
  useEffect(() => {
    if (!campaign || campaign.status === "draft") return;
    const timer = window.setInterval(load, campaign.status === "sending" ? 15000 : 60000);
    return () => window.clearInterval(timer);
  }, [campaign?.status, load]); // eslint-disable-line react-hooks/exhaustive-deps

  if (!campaign) {
    return (
      <section className="flex flex-1 items-center justify-center bg-white">
        <Loader2 className="h-6 w-6 animate-spin text-slate-400" />
      </section>
    );
  }

  const stop = async () => {
    if (!(await confirm({ title: "Stop this campaign?", message: "Emails already sent stay sent. The rest won't go out.", confirmLabel: "Stop sending", danger: true }))) return;
    try {
      const result = await gm<{ message: string }>(`/campaigns/${campaign.id}/cancel`, token, { method: "POST" });
      toast(result.message);
      announceChange("campaigns");
    } catch (error) {
      onSessionError(error);
      toast(error instanceof Error ? error.message : "That did not work.", "error");
    }
  };

  const retry = async () => {
    if (!(await confirm({ title: `Send again to the ${campaign.failed_count} that failed?`, message: "Only the failed recipients get it. Those already sent don't get a second copy.", confirmLabel: "Send again" }))) return;
    try {
      const result = await gm<{ message: string }>(`/campaigns/${campaign.id}/retry`, token, { method: "POST" });
      toast(result.message);
      announceChange("campaigns");
    } catch (error) {
      onSessionError(error);
      toast(error instanceof Error ? error.message : "That did not work.", "error");
    }
  };

  const remove = async () => {
    if (!(await confirm({ title: "Delete this campaign?", message: campaign.name, confirmLabel: "Delete", danger: true }))) return;
    try {
      const result = await gm<{ message: string }>(`/campaigns/${campaign.id}`, token, { method: "DELETE" });
      toast(result.message);
      announceChange("campaigns");
      onBack();
    } catch (error) {
      onSessionError(error);
      toast(error instanceof Error ? error.message : "That did not work.", "error");
    }
  };

  const done = campaign.sent_count + campaign.failed_count + campaign.skipped_count;
  const percent = campaign.total ? Math.round((done / campaign.total) * 100) : 0;

  return (
    <section className="flex min-h-0 flex-1 flex-col overflow-y-auto bg-white p-3 sm:p-6">
      <div className="mx-auto grid w-full max-w-3xl gap-4 pb-10">
        <button type="button" className="inline-flex items-center gap-1.5 justify-self-start text-sm font-semibold text-slate-600 hover:text-slate-900" onClick={onBack}>
          <ArrowLeft className="h-4 w-4" /> Campaigns
        </button>
        <div className="flex flex-wrap items-start gap-2">
          <div className="mr-auto min-w-0">
            <h1 className="text-xl font-black text-slate-900 sm:text-2xl">{campaign.name}</h1>
            <p className="text-sm text-slate-500">{campaign.subject}</p>
          </div>
          <span className={`rounded-full px-3 py-1 text-xs font-bold ${STATUS[campaign.status].tone}`}>{STATUS[campaign.status].label}</span>
        </div>

        {campaign.status !== "draft" && (
          <div className="rounded-xl border border-slate-200 p-4">
            <div className="h-2 overflow-hidden rounded-full bg-slate-100"><div className="h-full bg-[#22a04f]" style={{ width: `${percent}%` }} /></div>
            <dl className="mt-3 grid grid-cols-2 gap-3 text-sm sm:grid-cols-4">
              {[["Sent", campaign.sent_count], ["Waiting", campaign.total - done], ["Failed", campaign.failed_count], ["Unsubscribed", campaign.skipped_count]].map(([label, value]) => (
                <div key={label as string}>
                  <dt className="text-xs text-slate-500">{label}</dt>
                  <dd className="text-xl font-black text-slate-900">{value}</dd>
                </div>
              ))}
            </dl>
            {campaign.status === "sending" && campaign.send_at && new Date(campaign.send_at) > new Date() && <p className="mt-2 text-xs text-slate-500">Starts {when(campaign.send_at)}.</p>}
            {campaign.last_error && <p className="mt-2 rounded-md bg-amber-50 px-3 py-2 text-xs text-amber-800">{campaign.last_error}</p>}
          </div>
        )}

        <div className="flex flex-wrap gap-2">
          {campaign.status === "draft" && (
            <button type="button" className="rounded-lg bg-[#1f9d4c] px-4 py-2 text-sm font-bold text-white" onClick={() => onEdit(campaign)}>
              Edit and send
            </button>
          )}
          {campaign.status === "sending" && (
            <button type="button" className="rounded-lg border border-red-200 px-4 py-2 text-sm font-bold text-red-600 hover:bg-red-50" onClick={() => void stop()}>
              Stop sending
            </button>
          )}
          {campaign.status !== "sending" && campaign.status !== "draft" && campaign.failed_count > 0 && (
            <button type="button" className="rounded-lg bg-[#1f9d4c] px-4 py-2 text-sm font-bold text-white" onClick={() => void retry()}>
              Send again to {campaign.failed_count} failed
            </button>
          )}
          {campaign.status !== "sending" && (
            <button type="button" className="inline-flex items-center gap-1.5 rounded-lg px-3 py-2 text-sm font-semibold text-slate-600 hover:bg-slate-100" onClick={() => void remove()}>
              <Trash2 className="h-4 w-4" /> Delete
            </button>
          )}
        </div>

        <CampaignReportView campaign={campaign} />
      </div>
    </section>
  );
}
