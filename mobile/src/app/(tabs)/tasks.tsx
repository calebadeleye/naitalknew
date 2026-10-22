import { Ionicons } from "@expo/vector-icons";
import DateTimePicker from "@react-native-community/datetimepicker";
import { useEffect, useState } from "react";
import { Alert, FlatList, Modal, Platform, Pressable, RefreshControl, ScrollView, Text, TextInput, View } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { useDrawer } from "../../components/Drawer";
import { useToast } from "../../components/toast";
import { Button, Empty, Header, IconButton, SquareAction, Tabs } from "../../components/ui";
import { api } from "../../lib/config";
import { cacheKey, kvGet, kvSet } from "../../lib/db";
import { ymd } from "../../lib/format";
import type { Task } from "../../lib/types";
import { useCached } from "../../lib/useCached";
import { useSession } from "../../state/session";
import { useTheme } from "../../state/theme";

type View_ = "all" | "today" | "upcoming" | "completed";
/** Priority isn't stored by the server yet, so it's kept on this phone. */
type Priority = "high" | "medium" | "low";
const PRIORITY_COLORS: Record<Priority, string> = { high: "#ef4444", medium: "#f59e0b", low: "#22a04f" };

function dueLabel(due: string | null): { text: string; overdue: boolean } | null {
  if (!due) return null;
  const today = ymd(new Date());
  const tomorrow = ymd(new Date(Date.now() + 86400000));
  if (due === today) return { text: "Today", overdue: false };
  if (due === tomorrow) return { text: "Tomorrow", overdue: false };
  const d = new Date(`${due}T00:00:00`);
  return { text: d.toDateString().slice(4, 10), overdue: due < today };
}

export default function TasksScreen() {
  const { colors } = useTheme();
  const drawer = useDrawer();
  const toast = useToast();
  const { account, handleError } = useSession();
  const [view, setView] = useState<View_>("all");
  const [adding, setAdding] = useState<Task | "new" | null>(null);
  const [priorities, setPriorities] = useState<Record<number, Priority>>({});
  const { data, setData, refresh, loading, offline } = useCached("tasks", (token) => api.tasks(token, "all").then((r) => r.tasks));
  const tasks = data ?? [];

  useEffect(() => {
    if (account) kvGet<Record<number, Priority>>(cacheKey(account.email, "task-priorities")).then((p) => p && setPriorities(p));
  }, [account]);
  const setPriority = (id: number, p: Priority | null) => {
    const next = { ...priorities };
    if (p) next[id] = p;
    else delete next[id];
    setPriorities(next);
    if (account) void kvSet(cacheKey(account.email, "task-priorities"), next);
  };

  const today = ymd(new Date());
  const shown = tasks.filter((t) => (view === "completed" ? t.done : !t.done && (view === "all" || (view === "today" ? t.due_date !== null && t.due_date <= today : t.due_date !== null && t.due_date > today))));

  const toggle = async (task: Task) => {
    if (!account) return;
    setData(tasks.map((t) => (t.id === task.id ? { ...t, done: !t.done } : t)));
    try {
      await api.updateTask(account.token, task.id, { done: !task.done });
    } catch (e) {
      setData(tasks);
      toast(handleError(e), "error");
    }
  };

  const remove = (task: Task) =>
    Alert.alert(task.title, undefined, [
      { text: "Edit", onPress: () => setAdding(task) },
      { text: "Delete", style: "destructive", onPress: async () => { try { await api.deleteTask(account!.token, task.id); setData(tasks.filter((t) => t.id !== task.id)); } catch (e) { toast(handleError(e), "error"); } } },
      { text: "Cancel", style: "cancel" },
    ]);

  return (
    <SafeAreaView edges={["top"]} style={{ flex: 1, backgroundColor: colors.card }}>
      <Header title="Tasks" left={<IconButton name="menu" label="Open menu" onPress={drawer.open} size={26} />} right={<SquareAction icon="add" label="New task" onPress={() => setAdding("new")} />}>
        <Tabs value={view} onChange={setView} options={[{ value: "all", label: "All" }, { value: "today", label: "Today" }, { value: "upcoming", label: "Upcoming" }, { value: "completed", label: "Completed" }]} />
      </Header>
      {offline ? <Text style={{ backgroundColor: colors.banner, color: colors.bannerText, padding: 10, paddingHorizontal: 16, fontSize: 13 }}>Offline — changes need a connection.</Text> : null}
      <FlatList
        data={shown}
        keyExtractor={(t) => String(t.id)}
        refreshControl={<RefreshControl refreshing={loading && !!data} onRefresh={refresh} tintColor={colors.green} />}
        ListEmptyComponent={loading && !data ? undefined : <Empty icon="checkbox-outline" title={view === "completed" ? "Nothing completed yet" : "No tasks here"} text="Tap + to add one." />}
        renderItem={({ item }) => {
          const due = dueLabel(item.due_date);
          const p = priorities[item.id];
          return (
            <Pressable onLongPress={() => remove(item)} onPress={() => setAdding(item)} style={{ flexDirection: "row", alignItems: "center", gap: 14, paddingHorizontal: 16, paddingVertical: 14, borderBottomWidth: 1, borderColor: colors.border }}>
              <Pressable onPress={() => void toggle(item)} hitSlop={10} accessibilityRole="checkbox" accessibilityState={{ checked: item.done }}>
                <Ionicons name={item.done ? "checkbox" : "square-outline"} size={24} color={item.done ? colors.green : colors.muted} />
              </Pressable>
              <View style={{ flex: 1 }}>
                <Text style={{ color: item.done ? colors.muted : colors.text, fontSize: 15.5, textDecorationLine: item.done ? "line-through" : "none" }}>{item.title}</Text>
                {due ? (
                  <View style={{ flexDirection: "row", alignItems: "center", gap: 4, marginTop: 3 }}>
                    <Ionicons name="time-outline" size={13} color={due.overdue || due.text === "Today" ? colors.danger : colors.muted} />
                    <Text style={{ color: due.overdue || due.text === "Today" ? colors.danger : colors.muted, fontSize: 12.5 }}>{due.text}</Text>
                  </View>
                ) : null}
              </View>
              {p ? <Ionicons name="flag" size={18} color={PRIORITY_COLORS[p]} /> : null}
              <IconButton name="ellipsis-vertical" label="Task options" size={18} color={colors.muted} onPress={() => remove(item)} />
            </Pressable>
          );
        }}
      />
      {adding ? (
        <TaskEditor
          task={adding === "new" ? null : adding}
          priority={adding === "new" ? null : (priorities[adding.id] ?? null)}
          onClose={() => setAdding(null)}
          onSaved={(task, priority) => {
            setPriority(task.id, priority);
            setAdding(null);
            setData([...tasks.filter((t) => t.id !== task.id), task]);
          }}
        />
      ) : null}
    </SafeAreaView>
  );
}

function TaskEditor({ task, priority: initialPriority, onClose, onSaved }: { task: Task | null; priority: Priority | null; onClose: () => void; onSaved: (t: Task, p: Priority | null) => void }) {
  const { colors } = useTheme();
  const { account, handleError } = useSession();
  const toast = useToast();
  const [title, setTitle] = useState(task?.title ?? "");
  const [due, setDue] = useState<string | null>(task?.due_date ?? null);
  const [notes, setNotes] = useState(task?.notes ?? "");
  const [priority, setPriority] = useState<Priority | null>(initialPriority);
  const [picking, setPicking] = useState(false);
  const [busy, setBusy] = useState(false);
  const field = { borderWidth: 1, borderColor: colors.border, borderRadius: 12, padding: 12, color: colors.text, fontSize: 16 };
  const chip = (active: boolean) => ({ paddingVertical: 8, paddingHorizontal: 14, borderRadius: 999, borderWidth: 1, borderColor: active ? colors.green : colors.border, backgroundColor: active ? colors.greenSoft : "transparent" });

  const save = async () => {
    if (!account || !title.trim()) return;
    setBusy(true);
    try {
      const body = { title: title.trim(), due_date: due, notes: notes || null };
      const { task: saved } = task ? await api.updateTask(account.token, task.id, body) : await api.createTask(account.token, body);
      onSaved(saved, priority);
    } catch (e) {
      toast(handleError(e), "error");
    } finally {
      setBusy(false);
    }
  };

  return (
    <Modal visible animationType="slide" presentationStyle="pageSheet" onRequestClose={onClose}>
      <SafeAreaView style={{ flex: 1, backgroundColor: colors.card }}>
        <Header title={task ? "Edit task" : "New task"} left={<IconButton name="close" label="Close" onPress={onClose} />} />
        <ScrollView contentContainerStyle={{ padding: 16, gap: 14 }}>
          <TextInput value={title} onChangeText={setTitle} placeholder="What needs doing?" placeholderTextColor={colors.subtle} style={field} autoFocus={!task} />
          <Text style={{ color: colors.muted }}>Due</Text>
          <View style={{ flexDirection: "row", flexWrap: "wrap", gap: 8 }}>
            {[["None", null], ["Today", ymd(new Date())], ["Tomorrow", ymd(new Date(Date.now() + 86400000))]].map(([label, value]) => (
              <Pressable key={label} onPress={() => setDue(value)} style={chip(due === value)}><Text style={{ color: colors.text }}>{label}</Text></Pressable>
            ))}
            <Pressable onPress={() => setPicking(true)} style={chip(!!due && due !== ymd(new Date()) && due !== ymd(new Date(Date.now() + 86400000)))}>
              <Text style={{ color: colors.text }}>{due && due !== ymd(new Date()) && due !== ymd(new Date(Date.now() + 86400000)) ? due : "Pick a date…"}</Text>
            </Pressable>
          </View>
          <Text style={{ color: colors.muted }}>Priority (kept on this phone)</Text>
          <View style={{ flexDirection: "row", gap: 8 }}>
            {(["high", "medium", "low"] as Priority[]).map((p) => (
              <Pressable key={p} onPress={() => setPriority(priority === p ? null : p)} style={[chip(priority === p), { flexDirection: "row", gap: 6, alignItems: "center" }]}>
                <Ionicons name="flag" size={14} color={PRIORITY_COLORS[p]} />
                <Text style={{ color: colors.text, textTransform: "capitalize" }}>{p}</Text>
              </Pressable>
            ))}
          </View>
          <TextInput value={notes} onChangeText={setNotes} placeholder="Notes" placeholderTextColor={colors.subtle} style={[field, { minHeight: 90, textAlignVertical: "top" }]} multiline />
          <Button title="Save" onPress={save} busy={busy} disabled={!title.trim()} />
        </ScrollView>
        {picking ? (
          <DateTimePicker
            value={due ? new Date(`${due}T12:00:00`) : new Date()}
            mode="date"
            display={Platform.OS === "ios" ? "inline" : "default"}
            onChange={(ev, d) => {
              if (Platform.OS === "android") setPicking(false);
              if (ev.type === "set" && d) setDue(ymd(d));
            }}
          />
        ) : null}
        {picking && Platform.OS === "ios" ? <Button title="Done" variant="ghost" onPress={() => setPicking(false)} /> : null}
      </SafeAreaView>
    </Modal>
  );
}
