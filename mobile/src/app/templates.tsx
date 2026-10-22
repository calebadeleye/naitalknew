import { Ionicons } from "@expo/vector-icons";
import { useRouter } from "expo-router";
import { useState } from "react";
import { Alert, FlatList, Modal, Pressable, RefreshControl, ScrollView, Text, TextInput, View } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { useToast } from "../components/toast";
import { Button, Empty, Header, IconButton, Tabs, type IconName } from "../components/ui";
import { api } from "../lib/config";
import { escapeHtml } from "../lib/format";
import { htmlToText } from "../lib/db";
import type { Template } from "../lib/types";
import { useCached } from "../lib/useCached";
import { useSession } from "../state/session";
import { useTheme } from "../state/theme";

/** Ready-made starting points (the mockup's "All Templates"); "My Templates" are the mailbox's own. */
const STARTERS: Array<{ name: string; description: string; icon: IconName; color: string; subject: string; body: string }> = [
  { name: "Welcome Email", description: "Send a warm welcome to new users", icon: "mail-open-outline", color: "#3b82f6", subject: "Welcome aboard!", body: "<p>Hello,</p><p>Welcome! We're glad to have you with us. If you have any questions, just reply to this email.</p><p>Best regards,</p>" },
  { name: "Password Reset", description: "Email for password reset link", icon: "lock-closed-outline", color: "#f97316", subject: "Reset your password", body: "<p>Hello,</p><p>We received a request to reset your password. Use the link below to choose a new one. If you didn't ask for this, you can ignore this email.</p><p>Best regards,</p>" },
  { name: "Invoice Notification", description: "Notify customers about invoices", icon: "document-text-outline", color: "#6366f1", subject: "Your invoice is ready", body: "<p>Hello,</p><p>Your invoice is attached. Please let us know if you have any questions about it.</p><p>Best regards,</p>" },
  { name: "Payment Confirmation", description: "Confirm successful payments", icon: "receipt-outline", color: "#16a34a", subject: "Payment received — thank you", body: "<p>Hello,</p><p>We have received your payment. Thank you for your business.</p><p>Best regards,</p>" },
  { name: "Account Verification", description: "Verify user email address", icon: "shield-checkmark-outline", color: "#0ea5e9", subject: "Please confirm your email address", body: "<p>Hello,</p><p>Please confirm your email address to finish setting up your account.</p><p>Best regards,</p>" },
  { name: "Security Alert", description: "Notify users about security events", icon: "warning-outline", color: "#ef4444", subject: "Security alert on your account", body: "<p>Hello,</p><p>We noticed a new sign-in to your account. If this was you, there's nothing to do. If not, please change your password right away.</p><p>Best regards,</p>" },
  { name: "General Announcement", description: "Send important updates to users", icon: "megaphone-outline", color: "#f59e0b", subject: "An update from us", body: "<p>Hello,</p><p>We have some news to share with you.</p><p>Best regards,</p>" },
];

type Item = { starter?: (typeof STARTERS)[number]; template?: Template };

export default function Templates() {
  const { colors } = useTheme();
  const router = useRouter();
  const [tab, setTab] = useState<"all" | "mine">("all");
  const [editing, setEditing] = useState<Partial<Template> | null>(null);
  const { data, setData, refresh, loading } = useCached("templates", (token) => api.templates(token).then((r) => r.templates));
  const mine = data ?? [];

  const row = (key: string, icon: IconName, color: string, title: string, subtitle: string, onPress: () => void) => (
    <Pressable key={key} onPress={onPress} style={{ flexDirection: "row", alignItems: "center", gap: 14, paddingHorizontal: 16, paddingVertical: 14, borderBottomWidth: 1, borderColor: colors.border }}>
      <View style={{ width: 42, height: 42, borderRadius: 12, backgroundColor: `${color}22`, alignItems: "center", justifyContent: "center" }}>
        <Ionicons name={icon} size={22} color={color} />
      </View>
      <View style={{ flex: 1 }}>
        <Text style={{ color: colors.text, fontWeight: "700", fontSize: 15.5 }}>{title}</Text>
        <Text style={{ color: colors.muted, fontSize: 13 }} numberOfLines={1}>{subtitle}</Text>
      </View>
      <Ionicons name="chevron-forward" size={18} color={colors.subtle} />
    </Pressable>
  );

  return (
    <SafeAreaView style={{ flex: 1, backgroundColor: colors.card }}>
      <Header title="Templates" left={<IconButton name="arrow-back" label="Back" onPress={() => router.back()} />}>
        <Tabs value={tab} onChange={setTab} options={[{ value: "all", label: "All Templates" }, { value: "mine", label: "My Templates" }]} />
      </Header>
      <FlatList
        data={tab === "all" ? [...STARTERS.map((s): Item => ({ starter: s })), ...mine.map((t): Item => ({ template: t }))] : mine.map((t): Item => ({ template: t }))}
        keyExtractor={(item, i) => (item.template ? `t${item.template.id}` : `s${i}`)}
        refreshControl={<RefreshControl refreshing={loading && !!data} onRefresh={refresh} tintColor={colors.green} />}
        ListEmptyComponent={<Empty icon="copy-outline" title="No templates of your own yet" text="Create one, or start from one under All Templates." />}
        renderItem={({ item }) =>
          item.starter
            ? row(item.starter.name, item.starter.icon, item.starter.color, item.starter.name, item.starter.description, () => setEditing({ name: item.starter!.name, subject: item.starter!.subject, body_html: item.starter!.body }))
            : row(`t${item.template!.id}`, "document-outline", colors.green, item.template!.name, item.template!.subject || htmlToText(item.template!.body_html ?? "").slice(0, 80), () => setEditing(item.template!))
        }
      />
      <View style={{ padding: 16 }}>
        <Button title="Create New Template" icon="add" onPress={() => setEditing({ name: "", subject: "", body_html: "" })} />
      </View>
      {editing ? (
        <TemplateEditor
          template={editing}
          onClose={() => setEditing(null)}
          onSaved={(t) => { setEditing(null); setData([...mine.filter((x) => x.id !== t.id), t]); setTab("mine"); }}
          onDeleted={(id) => { setEditing(null); setData(mine.filter((x) => x.id !== id)); }}
          onUse={(t) => { setEditing(null); router.push({ pathname: "/compose", params: { templateId: String(t.id) } }); }}
        />
      ) : null}
    </SafeAreaView>
  );
}

function TemplateEditor({ template, onClose, onSaved, onDeleted, onUse }: { template: Partial<Template>; onClose: () => void; onSaved: (t: Template) => void; onDeleted: (id: number) => void; onUse: (t: Template) => void }) {
  const { colors } = useTheme();
  const { account, handleError } = useSession();
  const toast = useToast();
  const [name, setName] = useState(template.name ?? "");
  const [subject, setSubject] = useState(template.subject ?? "");
  const [body, setBodyText] = useState(htmlToText(template.body_html ?? ""));
  // A template written on the web keeps its formatting unless its text is changed here.
  const [bodyChanged, setBodyChanged] = useState(false);
  const setBody = (v: string) => {
    setBodyChanged(true);
    setBodyText(v);
  };
  const [busy, setBusy] = useState(false);
  const field = { borderWidth: 1, borderColor: colors.border, borderRadius: 12, padding: 12, color: colors.text, fontSize: 16 };
  const bodyHtml = () => (!bodyChanged && template.body_html ? template.body_html : body.split(/\n{2,}/).map((p) => `<p>${escapeHtml(p).replace(/\n/g, "<br>")}</p>`).join(""));

  const save = async () => {
    if (!account || !name.trim()) return;
    setBusy(true);
    try {
      const { template: saved } = await api.saveTemplate(account.token, { id: template.id, name: name.trim(), subject: subject || null, body_html: bodyHtml() });
      toast("Template saved.");
      onSaved(saved);
    } catch (e) {
      toast(handleError(e), "error");
    } finally {
      setBusy(false);
    }
  };

  return (
    <Modal visible animationType="slide" presentationStyle="pageSheet" onRequestClose={onClose}>
      <SafeAreaView style={{ flex: 1, backgroundColor: colors.card }}>
        <Header
          title={template.id ? "Edit template" : "New template"}
          left={<IconButton name="close" label="Close" onPress={onClose} />}
          right={template.id ? <IconButton name="trash-outline" label="Delete template" onPress={() => Alert.alert("Delete this template?", undefined, [{ text: "Cancel", style: "cancel" }, { text: "Delete", style: "destructive", onPress: async () => { try { await api.deleteTemplate(account!.token, template.id!); onDeleted(template.id!); } catch (e) { toast(handleError(e), "error"); } } }])} /> : null}
        />
        <ScrollView contentContainerStyle={{ padding: 16, gap: 14 }}>
          <TextInput value={name} onChangeText={setName} placeholder="Template name" placeholderTextColor={colors.subtle} style={field} />
          <TextInput value={subject} onChangeText={setSubject} placeholder="Subject" placeholderTextColor={colors.subtle} style={field} />
          <TextInput value={body} onChangeText={setBody} placeholder="Message" placeholderTextColor={colors.subtle} multiline style={[field, { minHeight: 220, textAlignVertical: "top" }]} />
          <Button title="Save template" onPress={save} busy={busy} disabled={!name.trim()} />
          {template.id ? <Button title="Write an email with it" variant="outline" icon="create-outline" onPress={() => onUse(template as Template)} /> : null}
        </ScrollView>
      </SafeAreaView>
    </Modal>
  );
}
