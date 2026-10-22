import { useLocalSearchParams, useRouter } from "expo-router";
import { useState } from "react";
import { Alert, FlatList, Modal, Pressable, RefreshControl, ScrollView, Switch, Text, TextInput, View } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { useToast } from "../components/toast";
import { Button, Empty, Header, IconButton, SquareAction } from "../components/ui";
import { api } from "../lib/config";
import { folderLabel } from "../lib/format";
import type { MailRule, RuleKind, Vacation } from "../lib/types";
import { useCached } from "../lib/useCached";
import { useSession } from "../state/session";
import { useTheme } from "../state/theme";

const ACTIONS: Record<RuleKind, Array<[MailRule["action"], string]>> = {
  filter: [["move", "Move to folder"], ["mark_read", "Mark as read"], ["star", "Star"], ["delete", "Delete"]],
  automation: [["forward", "Forward a copy"], ["auto_reply", "Auto-reply"]],
};
const FIELDS: Array<[MailRule["field"], string]> = [["from", "From"], ["to", "To"], ["subject", "Subject"], ["any", "Every email"]];
const OPERATORS: Array<[MailRule["operator"], string]> = [["contains", "contains"], ["is", "is"], ["begins", "begins with"], ["ends", "ends with"]];

/** Filters (sort mail) and Automation (forward / auto-reply, plus the out-of-office reply). */
export default function Rules() {
  const { kind: kindParam } = useLocalSearchParams<{ kind?: RuleKind }>();
  const kind: RuleKind = kindParam === "automation" ? "automation" : "filter";
  const { colors } = useTheme();
  const router = useRouter();
  const toast = useToast();
  const { account, handleError } = useSession();
  const { data, setData, refresh, loading } = useCached(`rules-${kind}`, (token) => api.rules(token, kind).then((r) => r.rules), [kind]);
  const [editing, setEditing] = useState<Partial<MailRule> | null>(null);

  const toggle = async (rule: MailRule) => {
    setData((data ?? []).map((r) => (r.id === rule.id ? { ...r, active: !r.active } : r)));
    try {
      await api.toggleRule(account!.token, rule.id, !rule.active);
    } catch (e) {
      setData(data);
      toast(handleError(e), "error");
    }
  };

  return (
    <SafeAreaView style={{ flex: 1, backgroundColor: colors.card }}>
      <Header
        title={kind === "filter" ? "Filters" : "Automation"}
        left={<IconButton name="arrow-back" label="Back" onPress={() => router.back()} />}
        right={<SquareAction icon="add" label="New rule" onPress={() => setEditing({ kind, field: "from", operator: "contains", action: ACTIONS[kind][0][0], active: true })} />}
      />
      <FlatList
        data={data ?? []}
        keyExtractor={(r) => String(r.id)}
        refreshControl={<RefreshControl refreshing={loading && !!data} onRefresh={refresh} tintColor={colors.green} />}
        ListHeaderComponent={kind === "automation" ? <VacationCard /> : undefined}
        ListEmptyComponent={loading && !data ? undefined : <Empty icon={kind === "filter" ? "funnel-outline" : "git-network-outline"} title={kind === "filter" ? "No filters" : "No automation rules"} text={kind === "filter" ? "Filters sort new mail as it arrives — move, star, mark read or delete." : "Forward copies or send automatic replies to matching mail."} />}
        renderItem={({ item }) => (
          <Pressable onPress={() => setEditing(item)} style={{ flexDirection: "row", alignItems: "center", gap: 12, padding: 16, borderBottomWidth: 1, borderColor: colors.border }}>
            <View style={{ flex: 1 }}>
              <Text style={{ color: colors.text, fontWeight: "600" }}>{item.name}</Text>
              {!item.active ? <Text style={{ color: colors.muted, fontSize: 12 }}>Paused</Text> : null}
            </View>
            <Switch value={item.active} onValueChange={() => void toggle(item)} trackColor={{ true: colors.green }} />
          </Pressable>
        )}
      />
      {editing ? <RuleEditor rule={editing} kind={kind} onClose={() => setEditing(null)} onSaved={() => { setEditing(null); void refresh(); }} /> : null}
    </SafeAreaView>
  );
}

function Choice<T extends string>({ value, options, onChange }: { value: T | undefined; options: Array<[T, string]>; onChange: (v: T) => void }) {
  const { colors } = useTheme();
  return (
    <View style={{ flexDirection: "row", flexWrap: "wrap", gap: 8 }}>
      {options.map(([v, label]) => (
        <Pressable key={v} onPress={() => onChange(v)} style={{ paddingVertical: 8, paddingHorizontal: 14, borderRadius: 999, borderWidth: 1, borderColor: value === v ? colors.green : colors.border, backgroundColor: value === v ? colors.greenSoft : "transparent" }}>
          <Text style={{ color: colors.text }}>{label}</Text>
        </Pressable>
      ))}
    </View>
  );
}

function RuleEditor({ rule, kind, onClose, onSaved }: { rule: Partial<MailRule>; kind: RuleKind; onClose: () => void; onSaved: () => void }) {
  const { colors } = useTheme();
  const { account, folders, handleError } = useSession();
  const toast = useToast();
  const [r, setR] = useState<Partial<MailRule>>(rule);
  const [busy, setBusy] = useState(false);
  const set = (patch: Partial<MailRule>) => setR((x) => ({ ...x, ...patch }));
  const field = { borderWidth: 1, borderColor: colors.border, borderRadius: 12, padding: 12, color: colors.text, fontSize: 16 };
  const label = { color: colors.muted, fontWeight: "600" as const };

  const save = async () => {
    setBusy(true);
    try {
      await api.saveRule(account!.token, { id: r.id, kind, name: r.name ?? "", field: r.field ?? "from", operator: r.operator ?? "contains", value: r.value ?? null, action: r.action!, target: r.target ?? null, reply_subject: r.reply_subject ?? null, reply_text: r.reply_text ?? null, active: r.active ?? true });
      toast("Rule saved.");
      onSaved();
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
          title={rule.id ? "Edit rule" : "New rule"}
          left={<IconButton name="close" label="Close" onPress={onClose} />}
          right={rule.id ? <IconButton name="trash-outline" label="Delete rule" onPress={() => Alert.alert("Delete this rule?", undefined, [{ text: "Cancel", style: "cancel" }, { text: "Delete", style: "destructive", onPress: async () => { try { await api.deleteRule(account!.token, rule.id!); onSaved(); } catch (e) { toast(handleError(e), "error"); } } }])} /> : null}
        />
        <ScrollView contentContainerStyle={{ padding: 16, gap: 12 }} keyboardShouldPersistTaps="handled">
          <Text style={label}>When</Text>
          <Choice value={r.field} options={FIELDS} onChange={(field) => set({ field })} />
          {r.field !== "any" ? (
            <>
              <Choice value={r.operator} options={OPERATORS} onChange={(operator) => set({ operator })} />
              <TextInput value={r.value ?? ""} onChangeText={(value) => set({ value })} placeholder="e.g. invoices@supplier.com" placeholderTextColor={colors.subtle} autoCapitalize="none" style={field} />
            </>
          ) : null}
          <Text style={label}>Then</Text>
          <Choice value={r.action} options={ACTIONS[kind]} onChange={(action) => set({ action })} />
          {r.action === "move" ? (
            <Choice value={r.target ?? undefined} options={folders.filter((f) => f.role !== "inbox").map((f) => [f.path, folderLabel(f)] as [string, string])} onChange={(target) => set({ target })} />
          ) : null}
          {r.action === "forward" ? <TextInput value={r.target ?? ""} onChangeText={(target) => set({ target })} placeholder="Forward to (email address)" placeholderTextColor={colors.subtle} autoCapitalize="none" keyboardType="email-address" style={field} /> : null}
          {r.action === "auto_reply" ? (
            <>
              <TextInput value={r.reply_subject ?? ""} onChangeText={(reply_subject) => set({ reply_subject })} placeholder="Reply subject (optional)" placeholderTextColor={colors.subtle} style={field} />
              <TextInput value={r.reply_text ?? ""} onChangeText={(reply_text) => set({ reply_text })} placeholder="Reply message" placeholderTextColor={colors.subtle} multiline style={[field, { minHeight: 120, textAlignVertical: "top" }]} />
            </>
          ) : null}
          <TextInput value={r.name ?? ""} onChangeText={(name) => set({ name })} placeholder="Name (optional)" placeholderTextColor={colors.subtle} style={field} />
          <Button title="Save rule" onPress={save} busy={busy} />
        </ScrollView>
      </SafeAreaView>
    </Modal>
  );
}

/** Out-of-office: the vacation auto-reply (PUT /vacation). */
function VacationCard() {
  const { colors } = useTheme();
  const { account, handleError } = useSession();
  const toast = useToast();
  const { data, setData } = useCached("vacation", (token) => api.vacation(token).then((r) => r.vacation));
  const [busy, setBusy] = useState(false);
  if (!data) return null;
  const field = { borderWidth: 1, borderColor: colors.border, borderRadius: 12, padding: 12, color: colors.text, fontSize: 15 };

  const save = async (next: Vacation) => {
    setBusy(true);
    try {
      const result = await api.saveVacation(account!.token, next);
      setData(result.vacation);
      toast(result.message);
    } catch (e) {
      toast(handleError(e), "error");
    } finally {
      setBusy(false);
    }
  };

  return (
    <View style={{ margin: 16, padding: 16, borderRadius: 16, backgroundColor: colors.greenSoft, gap: 10 }}>
      <View style={{ flexDirection: "row", alignItems: "center" }}>
        <Text style={{ flex: 1, fontWeight: "700", color: colors.text, fontSize: 16 }}>Out-of-office reply</Text>
        <Switch value={data.enabled} onValueChange={(enabled) => (enabled && !data.message ? setData({ ...data, enabled }) : void save({ ...data, enabled }))} trackColor={{ true: colors.green }} />
      </View>
      {data.enabled ? (
        <>
          <TextInput value={data.subject} onChangeText={(subject) => setData({ ...data, subject })} placeholder="Subject" placeholderTextColor={colors.subtle} style={field} />
          <TextInput value={data.message} onChangeText={(message) => setData({ ...data, message })} placeholder="I'm away until… I'll reply when I'm back." placeholderTextColor={colors.subtle} multiline style={[field, { minHeight: 100, textAlignVertical: "top" }]} />
          <Button small title="Save" busy={busy} onPress={() => void save(data)} />
        </>
      ) : null}
    </View>
  );
}
