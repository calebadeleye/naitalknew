import { Ionicons } from "@expo/vector-icons";
import { useRouter } from "expo-router";
import { useState } from "react";
import { Alert, FlatList, Modal, Pressable, RefreshControl, Text, TextInput, View } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { useToast } from "../components/toast";
import { Empty, Header, IconButton, SquareAction } from "../components/ui";
import { api } from "../lib/config";
import { shortDate } from "../lib/format";
import type { Note } from "../lib/types";
import { useCached } from "../lib/useCached";
import { useSession } from "../state/session";
import { useTheme } from "../state/theme";

const NOTE_COLORS: Record<NonNullable<Note["color"]>, string> = { yellow: "#fef9c3", green: "#dcfce7", blue: "#dbeafe", pink: "#fce7f3", gray: "#f1f5f9" };

export default function Notes() {
  const { colors } = useTheme();
  const router = useRouter();
  const { data, setData, refresh, loading, offline } = useCached("notes", (token) => api.notes(token).then((r) => r.notes));
  const [editing, setEditing] = useState<Partial<Note> | null>(null);
  const [q, setQ] = useState("");
  const notes = (data ?? [])
    .filter((n) => !q || `${n.title ?? ""} ${n.body ?? ""}`.toLowerCase().includes(q.toLowerCase()))
    .sort((a, b) => Number(b.pinned) - Number(a.pinned) || b.updated_at.localeCompare(a.updated_at));

  return (
    <SafeAreaView style={{ flex: 1, backgroundColor: colors.background }}>
      <Header title="Notes" left={<IconButton name="arrow-back" label="Back" onPress={() => router.back()} />} right={<SquareAction icon="add" label="New note" onPress={() => setEditing({ title: "", body: "", color: "yellow", pinned: false })} />}>
        <View style={{ marginHorizontal: 16, marginBottom: 10, flexDirection: "row", alignItems: "center", backgroundColor: colors.input, borderRadius: 12, paddingHorizontal: 12 }}>
          <Ionicons name="search" size={16} color={colors.muted} />
          <TextInput value={q} onChangeText={setQ} placeholder="Search notes" placeholderTextColor={colors.subtle} style={{ flex: 1, padding: 10, color: colors.text }} />
        </View>
      </Header>
      {offline ? <Text style={{ backgroundColor: colors.banner, color: colors.bannerText, padding: 10, paddingHorizontal: 16, fontSize: 13 }}>Offline — notes saved on this phone. Editing needs a connection.</Text> : null}
      <FlatList
        data={notes}
        numColumns={2}
        keyExtractor={(n) => String(n.id)}
        contentContainerStyle={{ padding: 10 }}
        refreshControl={<RefreshControl refreshing={loading && !!data} onRefresh={refresh} tintColor={colors.green} />}
        ListEmptyComponent={loading && !data ? undefined : <Empty icon="document-outline" title="No notes" text="Tap + to write one." />}
        renderItem={({ item }) => (
          <Pressable onPress={() => setEditing(item)} style={{ flex: 1, margin: 6, padding: 14, borderRadius: 16, minHeight: 120, backgroundColor: NOTE_COLORS[item.color ?? "yellow"] }}>
            <View style={{ flexDirection: "row", gap: 6 }}>
              <Text style={{ flex: 1, fontWeight: "700", color: "#0f172a" }} numberOfLines={2}>{item.title || "Untitled"}</Text>
              {item.pinned ? <Ionicons name="pin" size={14} color="#475569" /> : null}
            </View>
            <Text style={{ color: "#334155", marginTop: 6, fontSize: 13.5 }} numberOfLines={6}>{item.body}</Text>
            <Text style={{ color: "#64748b", fontSize: 11, marginTop: "auto", paddingTop: 8 }}>{shortDate(item.updated_at)}</Text>
          </Pressable>
        )}
      />
      {editing ? (
        <NoteEditor
          note={editing}
          onClose={() => setEditing(null)}
          onSaved={(n) => { setEditing(null); setData([...(data ?? []).filter((x) => x.id !== n.id), n]); }}
          onDeleted={(id) => { setEditing(null); setData((data ?? []).filter((x) => x.id !== id)); }}
        />
      ) : null}
    </SafeAreaView>
  );
}

function NoteEditor({ note, onClose, onSaved, onDeleted }: { note: Partial<Note>; onClose: () => void; onSaved: (n: Note) => void; onDeleted: (id: number) => void }) {
  const { colors } = useTheme();
  const { account, handleError } = useSession();
  const toast = useToast();
  const [title, setTitle] = useState(note.title ?? "");
  const [body, setBody] = useState(note.body ?? "");
  const [color, setColor] = useState<Note["color"]>(note.color ?? "yellow");
  const [pinned, setPinned] = useState(!!note.pinned);

  const save = async () => {
    if (!account) return;
    if (!title.trim() && !body.trim()) return onClose();
    try {
      const { note: saved } = await api.saveNote(account.token, { id: note.id, title, body, color, pinned });
      onSaved(saved);
    } catch (e) {
      toast(handleError(e), "error");
    }
  };

  const remove = () =>
    Alert.alert("Delete this note?", undefined, [
      { text: "Cancel", style: "cancel" },
      { text: "Delete", style: "destructive", onPress: async () => { try { await api.deleteNote(account!.token, note.id!); onDeleted(note.id!); } catch (e) { toast(handleError(e), "error"); } } },
    ]);

  return (
    <Modal visible animationType="slide" presentationStyle="pageSheet" onRequestClose={save}>
      <SafeAreaView style={{ flex: 1, backgroundColor: NOTE_COLORS[color ?? "yellow"] }}>
        <Header
          title=""
          left={<IconButton name="checkmark" label="Save and close" onPress={save} />}
          right={
            <View style={{ flexDirection: "row" }}>
              <IconButton name={pinned ? "pin" : "pin-outline"} label={pinned ? "Unpin" : "Pin"} onPress={() => setPinned((p) => !p)} />
              {note.id ? <IconButton name="trash-outline" label="Delete note" onPress={remove} /> : null}
            </View>
          }
        />
        <View style={{ flexDirection: "row", gap: 10, paddingHorizontal: 16, paddingVertical: 8 }}>
          {(Object.keys(NOTE_COLORS) as Array<NonNullable<Note["color"]>>).map((c) => (
            <Pressable key={c} accessibilityLabel={`${c} note`} onPress={() => setColor(c)} style={{ width: 28, height: 28, borderRadius: 14, backgroundColor: NOTE_COLORS[c], borderWidth: 2, borderColor: color === c ? colors.green : "#cbd5e1" }} />
          ))}
        </View>
        <TextInput value={title} onChangeText={setTitle} placeholder="Title" placeholderTextColor="#64748b" style={{ fontSize: 22, fontWeight: "800", paddingHorizontal: 16, paddingVertical: 8, color: "#0f172a" }} />
        <TextInput value={body} onChangeText={setBody} placeholder="Write something…" placeholderTextColor="#64748b" multiline autoFocus={!note.id} style={{ flex: 1, fontSize: 16, paddingHorizontal: 16, color: "#0f172a", textAlignVertical: "top" }} />
      </SafeAreaView>
    </Modal>
  );
}
