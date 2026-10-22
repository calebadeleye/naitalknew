import { Ionicons, MaterialCommunityIcons } from "@expo/vector-icons";
import DateTimePicker from "@react-native-community/datetimepicker";
import * as DocumentPicker from "expo-document-picker";
import * as ImagePicker from "expo-image-picker";
import { useLocalSearchParams, useRouter } from "expo-router";
import { useEffect, useMemo, useRef, useState } from "react";
import { Alert, KeyboardAvoidingView, Modal, Platform, Pressable, ScrollView, Text, TextInput, View } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { RichEditor, type RichEditorHandle } from "../components/RichEditor";
import { useToast } from "../components/toast";
import { Button, IconButton, Loading, type IconName } from "../components/ui";
import { ApiError, NetworkError } from "../lib/api";
import { api } from "../lib/config";
import { cacheKey, cachedFullMessage, deleteLocalDraft, kvGet, kvSet, localDraft, saveLocalDraft, type LocalDraft } from "../lib/db";
import { dropFiles, keepFile } from "../lib/files";
import { bytes, displayName, escapeHtml, fullDate, isEmail, splitAddresses, withoutRemoteImages } from "../lib/format";
import { newId } from "../lib/outbox";
import type { ComposePayload, Contact, FullMessage, LocalFile, Template } from "../lib/types";
import { useSession } from "../state/session";
import { useTheme } from "../state/theme";

type Mode = "new" | "reply" | "reply_all" | "forward" | "draft" | "local";
type Context = NonNullable<LocalDraft["context"]>;

export default function Compose() {
  const params = useLocalSearchParams<{ mode?: Mode; folder?: string; uid?: string; body?: string; to?: string; templateId?: string; localId?: string }>();
  const mode: Mode = params.mode ?? "new";
  const router = useRouter();
  const toast = useToast();
  const { colors } = useTheme();
  const { accounts, account, me, online, enqueue, handleError, bumpMail } = useSession();

  const [ready, setReady] = useState(false);
  const [draftId] = useState(() => params.localId ?? newId());
  const [from, setFrom] = useState(account?.email ?? "");
  const [to, setTo] = useState(params.to ?? "");
  const [cc, setCc] = useState("");
  const [bcc, setBcc] = useState("");
  const [showCc, setShowCc] = useState(false);
  const [subject, setSubject] = useState("");
  const [initialHtml, setInitialHtml] = useState("");
  const [quoteHtml, setQuoteHtml] = useState("");
  const [context, setContext] = useState<Context>({});
  const [files, setFiles] = useState<LocalFile[]>([]);
  const [forwarded, setForwarded] = useState<Array<{ index: number; name: string; size: number }>>([]);
  const [busy, setBusy] = useState<null | "send" | "schedule" | "draft">(null);
  const [error, setError] = useState<string | null>(null);
  const [panel, setPanel] = useState<null | "from" | "templates" | "schedule" | "link">(null);
  const [suggestions, setSuggestions] = useState<Contact[]>([]);
  const html = useRef("");
  const editor = useRef<RichEditorHandle>(null);
  const touched = useRef(false);

  const signature = useMemo(() => (me?.signature_html?.trim() ? `<br><div class="gm-signature">-- <br>${me.signature_html}</div>` : ""), [me?.signature_html]);

  // ---- prefill: reply / forward / draft / template / saved local draft ----
  useEffect(() => {
    (async () => {
      try {
        if (mode === "local" && params.localId) {
          const d = await localDraft(params.localId);
          if (d) {
            setFrom(d.from);
            setTo(d.to);
            setCc(d.cc);
            setBcc(d.bcc);
            setShowCc(!!(d.cc || d.bcc));
            setSubject(d.subject);
            setInitialHtml(d.html);
            html.current = d.html;
            setQuoteHtml(d.quoteHtml ?? "");
            setFiles(d.attachments);
            setContext(d.context ?? {});
          }
          return;
        }
        let original: FullMessage | null = null;
        if (params.folder && params.uid && account && mode !== "new") {
          original = await cachedFullMessage(account.email, params.folder, Number(params.uid)).catch(() => null);
          if (!original || mode === "draft") original = await api.message(account.token, params.folder, Number(params.uid)).catch(() => original);
        }
        const start = params.body ? `<p>${escapeHtml(params.body).replace(/\n/g, "<br>")}</p>` : "<p><br></p>";

        if (original && mode === "draft") {
          setTo(original.to.map((a) => a.email).join(", "));
          setCc(original.cc.map((a) => a.email).join(", "));
          setShowCc(original.cc.length > 0);
          setSubject(original.subject === "(no subject)" ? "" : original.subject);
          setInitialHtml(original.html);
          html.current = original.html;
          setContext({ draft_uid: original.uid });
        } else if (original && (mode === "reply" || mode === "reply_all")) {
          const replyTo = original.reply_to[0] ?? original.from;
          const others = mode === "reply_all" ? [...original.to, ...original.cc].filter((a) => a.email !== account?.email && a.email !== replyTo.email) : [];
          setTo(replyTo.email);
          setCc([...new Set(others.map((a) => a.email))].join(", "));
          setShowCc(others.length > 0);
          setSubject(/^re:/i.test(original.subject) ? original.subject : `Re: ${original.subject}`);
          setInitialHtml(start + signature);
          html.current = start + signature;
          setQuoteHtml(`<div>On ${escapeHtml(fullDate(original.date))}, ${escapeHtml(displayName(original.from))} wrote:</div><blockquote>${withoutRemoteImages(original.html)}</blockquote>`);
          setContext({ in_reply_to: original.message_id || undefined, references: original.references || undefined, reply_uid: original.uid, reply_folder: params.folder });
        } else if (original && mode === "forward") {
          setSubject(/^fwd?:/i.test(original.subject) ? original.subject : `Fwd: ${original.subject}`);
          setInitialHtml(start + signature);
          html.current = start + signature;
          setQuoteHtml(
            `<div>---------- Forwarded message ----------<br>From: ${escapeHtml(displayName(original.from))} &lt;${escapeHtml(original.from.email)}&gt;<br>Date: ${escapeHtml(fullDate(original.date))}<br>Subject: ${escapeHtml(original.subject)}</div><br>${withoutRemoteImages(original.html)}`,
          );
          setForwarded(original.attachments.map((a) => ({ index: a.index, name: a.name, size: a.size })));
          setContext({ forward_folder: params.folder, forward_uid: original.uid });
        } else {
          let body = start;
          if (params.templateId && account) {
            const list = (await kvGet<Template[]>(cacheKey(account.email, "templates"))) ?? [];
            const template = list.find((t) => String(t.id) === params.templateId);
            if (template) {
              setSubject(template.subject ?? "");
              body = template.body_html || start;
            }
          }
          setInitialHtml(body + signature);
          html.current = body + signature;
        }
      } finally {
        setReady(true);
      }
    })();
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  // ---- autosave on this phone (works offline; nothing is lost if the app closes) ----
  const snapshot = (): LocalDraft => ({ id: draftId, account: from, updatedAt: Date.now(), from, to, cc, bcc, subject, html: html.current, quoteHtml, attachments: files, context: { ...context, forward_attachments: forwarded.map((f) => f.index) } });
  useEffect(() => {
    if (!ready || !touched.current) return;
    const t = setTimeout(() => void saveLocalDraft(snapshot()).catch(() => {}), 1200);
    return () => clearTimeout(t);
  }); // eslint-disable-line react-hooks/exhaustive-deps

  // ---- contact suggestions for To ----
  useEffect(() => {
    const last = to.split(/[,;]/).pop()?.trim() ?? "";
    const owner = accounts.find((a) => a.email === from);
    if (last.length < 2 || !owner || !online) return setSuggestions([]);
    const t = setTimeout(() => api.contacts(owner.token, last).then((r) => setSuggestions(r.contacts.slice(0, 5))).catch(() => setSuggestions([])), 250);
    return () => clearTimeout(t);
  }, [to, from, online, accounts]);

  const change = <T,>(setter: (v: T) => void) => (v: T) => {
    touched.current = true;
    setter(v);
  };

  const payload = (): ComposePayload => ({
    to,
    cc,
    bcc,
    subject,
    html: html.current + (quoteHtml ? `<br>${quoteHtml}` : ""),
    ...context,
    forward_attachments: forwarded.length ? forwarded.map((f) => f.index) : undefined,
    forward_folder: forwarded.length ? context.forward_folder : undefined,
    forward_uid: forwarded.length ? context.forward_uid : undefined,
    attachments: files,
  });

  const validate = (needRecipient: boolean) => {
    const all = [...splitAddresses(to), ...splitAddresses(cc), ...splitAddresses(bcc)];
    if (needRecipient && splitAddresses(to).length === 0) return "Add at least one recipient.";
    const bad = all.find((a) => !isEmail(a));
    return bad ? `"${bad}" is not a valid email address.` : null;
  };

  /** Send now when online; when offline (or the server is unreachable) it waits in the outbox. */
  const deliver = async (kind: "send" | "schedule" | "draft", sendAt?: Date) => {
    const problem = validate(kind !== "draft");
    if (problem) return setError(problem);
    const owner = accounts.find((a) => a.email === from);
    if (!owner) return setError("Choose the account to send from.");
    const body = { ...payload(), ...(sendAt ? { send_at: sendAt.toISOString() } : {}) };
    const label = subject.trim() || "(no subject)";
    setBusy(kind);
    setError(null);
    try {
      if (online) {
        try {
          const result = kind === "send" ? await api.send(owner.token, body) : kind === "draft" ? await api.saveDraft(owner.token, body) : await api.schedule(owner.token, body);
          toast(result.message);
          await finish();
          return;
        } catch (e) {
          if (!(e instanceof NetworkError) && !(e instanceof ApiError && e.retryable)) throw e;
        }
      }
      await enqueue(kind, body, label, owner.email);
      toast(kind === "send" ? "Saved in the outbox — it will be sent when you're back online." : kind === "draft" ? "Draft kept on this phone — it will sync when you're online." : "Scheduled — it will reach the server when you're online.", "info");
      await finish(false);
    } catch (e) {
      setError(handleError(e, "Could not send."));
    } finally {
      setBusy(null);
    }
  };

  const finish = async (cleanFiles = true) => {
    await deleteLocalDraft(draftId).catch(() => {});
    if (cleanFiles) dropFiles(files);
    bumpMail();
    router.back();
  };

  const close = () => {
    const empty = !to.trim() && !subject.trim() && html.current.replace(/<[^>]+>|&nbsp;|\s/g, "") === "" && files.length === 0;
    if (!touched.current || empty) {
      void deleteLocalDraft(draftId).catch(() => {});
      return router.back();
    }
    Alert.alert("Save this draft?", undefined, [
      { text: "Discard", style: "destructive", onPress: () => void finish() },
      { text: "Keep editing", style: "cancel" },
      { text: "Save draft", onPress: () => void deliver("draft") },
    ]);
  };

  const pickFile = async () => {
    const result = await DocumentPicker.getDocumentAsync({ multiple: true, copyToCacheDirectory: true });
    if (result.canceled) return;
    touched.current = true;
    setFiles((f) => [...f, ...result.assets.map((a) => keepFile({ uri: a.uri, name: a.name, mime: a.mimeType ?? "application/octet-stream", size: a.size }))]);
  };

  const pickImage = async () => {
    const result = await ImagePicker.launchImageLibraryAsync({ mediaTypes: ["images"], allowsMultipleSelection: true, quality: 0.85 });
    if (result.canceled) return;
    touched.current = true;
    setFiles((f) => [...f, ...result.assets.map((a, i) => keepFile({ uri: a.uri, name: a.fileName ?? `photo-${Date.now()}-${i}.jpg`, mime: a.mimeType ?? "image/jpeg", size: a.fileSize }))]);
  };

  if (!ready) {
    return (
      <SafeAreaView style={{ flex: 1, backgroundColor: colors.card }}>
        <Loading />
      </SafeAreaView>
    );
  }

  const line = { flexDirection: "row" as const, alignItems: "center" as const, paddingHorizontal: 16, minHeight: 52, borderBottomWidth: 1, borderColor: colors.border, gap: 10 };
  const label = { color: colors.muted, fontSize: 15, width: 64 };
  const input = { flex: 1, fontSize: 15.5, color: colors.text, paddingVertical: 12 };
  const tool = (icon: keyof typeof MaterialCommunityIcons.glyphMap, name: string, onPress: () => void) => (
    <Pressable key={name} accessibilityRole="button" accessibilityLabel={name} hitSlop={6} onPress={onPress} style={({ pressed }) => ({ padding: 9, opacity: pressed ? 0.5 : 1 })}>
      <MaterialCommunityIcons name={icon} size={22} color={colors.text} />
    </Pressable>
  );

  return (
    <SafeAreaView style={{ flex: 1, backgroundColor: colors.card }}>
      <View style={{ flexDirection: "row", alignItems: "center", paddingHorizontal: 6, height: 58 }}>
        <IconButton name="arrow-back" label="Close" onPress={close} />
        <Text style={{ flex: 1, fontSize: 20, fontWeight: "800", color: colors.text, marginLeft: 6 }}>{mode === "reply" || mode === "reply_all" ? "Reply" : mode === "forward" ? "Forward" : "Compose"}</Text>
        <Pressable accessibilityRole="button" accessibilityLabel="Send" disabled={!!busy} onPress={() => void deliver("send")} style={({ pressed }) => ({ width: 48, height: 44, borderRadius: 12, backgroundColor: colors.green, alignItems: "center", justifyContent: "center", marginRight: 8, opacity: busy ? 0.6 : pressed ? 0.85 : 1 })}>
          <Ionicons name={online ? "paper-plane-outline" : "cloud-upload-outline"} size={21} color="#fff" />
        </Pressable>
      </View>

      <KeyboardAvoidingView behavior={Platform.OS === "ios" ? "padding" : undefined} style={{ flex: 1 }}>
        <ScrollView keyboardShouldPersistTaps="handled" contentContainerStyle={{ flexGrow: 1 }}>
          {!online ? <Text style={{ backgroundColor: colors.banner, color: colors.bannerText, paddingHorizontal: 16, paddingVertical: 8, fontSize: 13 }}>You're offline. Sending puts this in the outbox; it goes when you're back online.</Text> : null}
          {error ? <Text style={{ backgroundColor: "#fee2e2", color: "#b91c1c", paddingHorizontal: 16, paddingVertical: 10 }}>{error}</Text> : null}

          <Pressable style={line} onPress={() => accounts.length > 1 && setPanel("from")}>
            <Text style={label}>From</Text>
            <Text style={[input, { paddingVertical: 0 }]}>{from}</Text>
            {accounts.length > 1 ? <Ionicons name="chevron-down" size={18} color={colors.muted} /> : null}
          </Pressable>
          <View style={line}>
            <Text style={label}>To</Text>
            <TextInput value={to} onChangeText={change(setTo)} style={input} autoCapitalize="none" keyboardType="email-address" autoCorrect={false} placeholder="name@example.com" placeholderTextColor={colors.subtle} />
            <IconButton name={showCc ? "chevron-up" : "chevron-down"} label="Cc and Bcc" color={colors.muted} size={18} onPress={() => setShowCc((s) => !s)} />
          </View>
          {suggestions.length ? (
            <View style={{ borderBottomWidth: 1, borderColor: colors.border }}>
              {suggestions.map((c) => (
                <Pressable
                  key={c.id}
                  onPress={() => {
                    const parts = to.split(/[,;]/).slice(0, -1).map((s) => s.trim()).filter(Boolean);
                    setTo([...parts, c.email].join(", ") + ", ");
                    setSuggestions([]);
                  }}
                  style={{ paddingHorizontal: 16, paddingVertical: 10 }}
                >
                  <Text style={{ color: colors.text, fontWeight: "600" }}>{c.name || c.email}</Text>
                  {c.name ? <Text style={{ color: colors.muted, fontSize: 13 }}>{c.email}</Text> : null}
                </Pressable>
              ))}
            </View>
          ) : null}
          {showCc ? (
            <>
              <View style={line}>
                <Text style={label}>Cc</Text>
                <TextInput value={cc} onChangeText={change(setCc)} style={input} autoCapitalize="none" keyboardType="email-address" autoCorrect={false} />
              </View>
              <View style={line}>
                <Text style={label}>Bcc</Text>
                <TextInput value={bcc} onChangeText={change(setBcc)} style={input} autoCapitalize="none" keyboardType="email-address" autoCorrect={false} />
              </View>
            </>
          ) : (
            <Pressable style={line} onPress={() => setShowCc(true)}>
              <Text style={[label, { width: undefined }]}>Cc / Bcc</Text>
            </Pressable>
          )}
          <View style={line}>
            <TextInput value={subject} onChangeText={change(setSubject)} style={input} placeholder="Subject" placeholderTextColor={colors.muted} />
          </View>

          <View style={{ flexDirection: "row", paddingHorizontal: 8, borderBottomWidth: 1, borderColor: colors.border, justifyContent: "space-between" }}>
            {tool("format-bold", "Bold", () => editor.current?.command("bold"))}
            {tool("format-italic", "Italic", () => editor.current?.command("italic"))}
            {tool("format-underline", "Underline", () => editor.current?.command("underline"))}
            {tool("format-list-bulleted", "Bulleted list", () => editor.current?.command("insertUnorderedList"))}
            {tool("format-list-numbered", "Numbered list", () => editor.current?.command("insertOrderedList"))}
            {tool("link-variant", "Add link", () => setPanel("link"))}
            {tool("file-document-multiple-outline", "Templates", () => setPanel("templates"))}
          </View>

          <View style={{ flex: 1, minHeight: 280 }}>
            <RichEditor
              ref={editor}
              initialHtml={initialHtml}
              onChange={(value) => {
                touched.current = true;
                html.current = value;
              }}
            />
          </View>

          {quoteHtml ? <Text style={{ color: colors.muted, fontSize: 12, paddingHorizontal: 16, paddingBottom: 6 }}>{mode === "forward" ? "The forwarded message is included below your text." : "The original message is quoted below your reply."}</Text> : null}

          {files.length || forwarded.length ? (
            <View style={{ paddingHorizontal: 16, gap: 6, paddingBottom: 10 }}>
              {forwarded.map((f) => (
                <Chip key={`fw-${f.index}`} icon="arrow-redo-outline" name={f.name} size={f.size} onRemove={() => setForwarded((list) => list.filter((x) => x.index !== f.index))} />
              ))}
              {files.map((f) => (
                <Chip key={f.uri} icon={f.mime.startsWith("image/") ? "image-outline" : "document-attach-outline"} name={f.name} size={f.size ?? undefined} onRemove={() => { dropFiles([f]); setFiles((list) => list.filter((x) => x.uri !== f.uri)); }} />
              ))}
            </View>
          ) : null}
        </ScrollView>

        <View style={{ flexDirection: "row", alignItems: "center", gap: 10, padding: 12, borderTopWidth: 1, borderColor: colors.border }}>
          {(["attach-outline", "image-outline", "calendar-outline"] as const).map((icon, i) => (
            <Pressable key={icon} accessibilityLabel={["Attach file", "Attach image", "Schedule send"][i]} onPress={[pickFile, pickImage, () => setPanel("schedule")][i]} style={{ width: 46, height: 46, borderRadius: 12, borderWidth: 1, borderColor: colors.border, alignItems: "center", justifyContent: "center" }}>
              <Ionicons name={icon} size={21} color={colors.text} />
            </Pressable>
          ))}
          <View style={{ flex: 1 }} />
          <Button small variant="outline" title="Save draft" busy={busy === "draft"} onPress={() => void deliver("draft")} />
        </View>
      </KeyboardAvoidingView>

      <FromPicker visible={panel === "from"} accounts={accounts.map((a) => a.email)} value={from} onPick={(e) => { setFrom(e); setPanel(null); }} onClose={() => setPanel(null)} />
      <TemplatePicker
        visible={panel === "templates"}
        onClose={() => setPanel(null)}
        onPick={(t) => {
          setPanel(null);
          touched.current = true;
          if (!subject.trim() && t.subject) setSubject(t.subject);
          editor.current?.insertHtml(t.body_html ?? "");
        }}
      />
      <SchedulePicker visible={panel === "schedule"} onClose={() => setPanel(null)} onPick={(when) => { setPanel(null); void deliver("schedule", when); }} />
      <LinkPrompt visible={panel === "link"} onClose={() => setPanel(null)} onInsert={(url, text) => { setPanel(null); editor.current?.insertHtml(`<a href="${escapeHtml(url)}">${escapeHtml(text || url)}</a>`); }} />
    </SafeAreaView>
  );
}

function Chip({ icon, name, size, onRemove }: { icon: IconName; name: string; size?: number; onRemove: () => void }) {
  const { colors } = useTheme();
  return (
    <View style={{ flexDirection: "row", alignItems: "center", gap: 10, padding: 10, borderRadius: 12, backgroundColor: colors.input }}>
      <Ionicons name={icon} size={20} color={colors.green} />
      <Text style={{ flex: 1, color: colors.text }} numberOfLines={1}>{name}</Text>
      {size ? <Text style={{ color: colors.muted, fontSize: 12 }}>{bytes(size)}</Text> : null}
      <IconButton name="close" label={`Remove ${name}`} size={16} color={colors.muted} onPress={onRemove} />
    </View>
  );
}

function Sheet({ visible, onClose, title, children }: { visible: boolean; onClose: () => void; title: string; children: React.ReactNode }) {
  const { colors } = useTheme();
  return (
    <Modal visible={visible} transparent animationType="slide" onRequestClose={onClose}>
      <Pressable style={{ flex: 1, backgroundColor: "rgba(0,0,0,0.35)" }} onPress={onClose} />
      <View style={{ backgroundColor: colors.card, borderTopLeftRadius: 22, borderTopRightRadius: 22, paddingBottom: 30, maxHeight: "75%" }}>
        <View style={{ flexDirection: "row", alignItems: "center", padding: 16 }}>
          <Text style={{ flex: 1, fontSize: 18, fontWeight: "800", color: colors.text }}>{title}</Text>
          <IconButton name="close" label="Close" onPress={onClose} />
        </View>
        {children}
      </View>
    </Modal>
  );
}

function FromPicker({ visible, accounts, value, onPick, onClose }: { visible: boolean; accounts: string[]; value: string; onPick: (e: string) => void; onClose: () => void }) {
  const { colors } = useTheme();
  return (
    <Sheet visible={visible} onClose={onClose} title="Send from">
      {accounts.map((e) => (
        <Pressable key={e} onPress={() => onPick(e)} style={{ flexDirection: "row", padding: 16, gap: 10 }}>
          <Text style={{ flex: 1, color: colors.text, fontSize: 16 }}>{e}</Text>
          {e === value ? <Ionicons name="checkmark" size={20} color={colors.green} /> : null}
        </Pressable>
      ))}
    </Sheet>
  );
}

function TemplatePicker({ visible, onPick, onClose }: { visible: boolean; onPick: (t: Template) => void; onClose: () => void }) {
  const { colors } = useTheme();
  const { account } = useSession();
  const [templates, setTemplates] = useState<Template[] | null>(null);
  useEffect(() => {
    if (!visible || !account) return;
    kvGet<Template[]>(cacheKey(account.email, "templates")).then((t) => t && setTemplates(t));
    api.templates(account.token).then((r) => {
      setTemplates(r.templates);
      void kvSet(cacheKey(account.email, "templates"), r.templates);
    }).catch(() => setTemplates((t) => t ?? []));
  }, [visible, account]);
  return (
    <Sheet visible={visible} onClose={onClose} title="Insert a template">
      {templates === null ? <Loading /> : templates.length === 0 ? <Text style={{ color: colors.muted, padding: 16 }}>No templates yet. Create them under Templates.</Text> : (
        <ScrollView>
          {templates.map((t) => (
            <Pressable key={t.id} onPress={() => onPick(t)} style={{ padding: 16, borderBottomWidth: 1, borderColor: colors.border }}>
              <Text style={{ color: colors.text, fontWeight: "700" }}>{t.name}</Text>
              {t.subject ? <Text style={{ color: colors.muted, fontSize: 13 }}>{t.subject}</Text> : null}
            </Pressable>
          ))}
        </ScrollView>
      )}
    </Sheet>
  );
}

function SchedulePicker({ visible, onPick, onClose }: { visible: boolean; onPick: (d: Date) => void; onClose: () => void }) {
  const { colors } = useTheme();
  const [custom, setCustom] = useState<Date | null>(null);
  const [androidStep, setAndroidStep] = useState<null | "date" | "time">(null);
  const at = (days: number, hour: number) => {
    const d = new Date();
    d.setDate(d.getDate() + days);
    d.setHours(hour, 0, 0, 0);
    return d;
  };
  const toMonday = ((8 - new Date().getDay()) % 7) || 7;
  const presets: Array<[string, Date]> = [
    ["In 1 hour", new Date(Date.now() + 3600_000)],
    ["Tomorrow morning (8:00 AM)", at(1, 8)],
    ["Tomorrow afternoon (1:00 PM)", at(1, 13)],
    ["Monday morning (8:00 AM)", at(toMonday, 8)],
  ];
  return (
    <Sheet visible={visible} onClose={onClose} title="Schedule send">
      {presets.map(([label, when]) => (
        <Pressable key={label} onPress={() => onPick(when)} style={{ flexDirection: "row", alignItems: "center", gap: 12, padding: 16 }}>
          <Ionicons name="time-outline" size={20} color={colors.green} />
          <Text style={{ color: colors.text, fontSize: 16 }}>{label}</Text>
        </Pressable>
      ))}
      <Pressable onPress={() => { const d = new Date(Date.now() + 2 * 3600_000); setCustom(d); if (Platform.OS === "android") setAndroidStep("date"); }} style={{ flexDirection: "row", alignItems: "center", gap: 12, padding: 16 }}>
        <Ionicons name="calendar-outline" size={20} color={colors.green} />
        <Text style={{ color: colors.text, fontSize: 16 }}>Pick date and time…</Text>
      </Pressable>
      {custom && Platform.OS === "ios" ? (
        <View style={{ paddingHorizontal: 16, gap: 12 }}>
          <DateTimePicker value={custom} mode="datetime" display="inline" minimumDate={new Date()} onChange={(_, d) => d && setCustom(d)} />
          <Button title="Schedule" onPress={() => onPick(custom)} />
        </View>
      ) : null}
      {custom && androidStep ? (
        <DateTimePicker
          value={custom}
          mode={androidStep}
          minimumDate={new Date()}
          onChange={(event, d) => {
            if (event.type !== "set" || !d) return setAndroidStep(null);
            if (androidStep === "date") {
              const next = new Date(custom);
              next.setFullYear(d.getFullYear(), d.getMonth(), d.getDate());
              setCustom(next);
              setAndroidStep("time");
            } else {
              const next = new Date(custom);
              next.setHours(d.getHours(), d.getMinutes(), 0, 0);
              setAndroidStep(null);
              onPick(next);
            }
          }}
        />
      ) : null}
    </Sheet>
  );
}

function LinkPrompt({ visible, onInsert, onClose }: { visible: boolean; onInsert: (url: string, text: string) => void; onClose: () => void }) {
  const { colors } = useTheme();
  const [url, setUrl] = useState("https://");
  const [text, setText] = useState("");
  const style = { borderWidth: 1, borderColor: colors.border, borderRadius: 12, padding: 12, color: colors.text, fontSize: 16 };
  return (
    <Sheet visible={visible} onClose={onClose} title="Add a link">
      <View style={{ paddingHorizontal: 16, gap: 12 }}>
        <TextInput value={url} onChangeText={setUrl} autoCapitalize="none" keyboardType="url" style={style} placeholder="https://" placeholderTextColor={colors.subtle} />
        <TextInput value={text} onChangeText={setText} style={style} placeholder="Text to show (optional)" placeholderTextColor={colors.subtle} />
        <Button title="Insert link" disabled={!/^https?:\/\/\S+\.\S+/.test(url)} onPress={() => onInsert(url.trim(), text.trim())} />
      </View>
    </Sheet>
  );
}
