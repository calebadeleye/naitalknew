import { Ionicons } from "@expo/vector-icons";
import DateTimePicker from "@react-native-community/datetimepicker";
import { useMemo, useState } from "react";
import { Alert, Modal, Platform, Pressable, RefreshControl, ScrollView, Switch, Text, TextInput, View } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { useDrawer } from "../../components/Drawer";
import { useToast } from "../../components/toast";
import { Button, Empty, Header, IconButton, SquareAction } from "../../components/ui";
import { api } from "../../lib/config";
import { MONTH_NAMES, timeOfDay, ymd } from "../../lib/format";
import type { CalendarEvent } from "../../lib/types";
import { useCached } from "../../lib/useCached";
import { useSession } from "../../state/session";
import { useTheme } from "../../state/theme";

const WEEKDAYS = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];

export default function CalendarScreen() {
  const { colors } = useTheme();
  const drawer = useDrawer();
  const [month, setMonth] = useState(() => new Date(new Date().getFullYear(), new Date().getMonth(), 1));
  const [selected, setSelected] = useState(() => new Date());
  const [editing, setEditing] = useState<Partial<CalendarEvent> | null>(null);

  const from = new Date(month.getFullYear(), month.getMonth(), 1);
  const to = new Date(month.getFullYear(), month.getMonth() + 1, 1);
  const { data, refresh, loading, offline } = useCached(`events-${ymd(from)}`, (token) => api.events(token, from, to).then((r) => r.events), [month.getTime()]);
  const events = data ?? [];

  const byDay = useMemo(() => {
    const map = new Map<string, CalendarEvent[]>();
    for (const e of events) {
      const key = ymd(new Date(e.starts_at));
      map.set(key, [...(map.get(key) ?? []), e]);
    }
    return map;
  }, [events]);

  const cells: Array<Date | null> = [];
  for (let i = 0; i < from.getDay(); i++) cells.push(null);
  for (let d = 1; d <= new Date(month.getFullYear(), month.getMonth() + 1, 0).getDate(); d++) cells.push(new Date(month.getFullYear(), month.getMonth(), d));
  while (cells.length % 7) cells.push(null);

  const today = ymd(new Date());
  const dayEvents = (byDay.get(ymd(selected)) ?? []).sort((a, b) => a.starts_at.localeCompare(b.starts_at));

  const newEvent = () => {
    const start = new Date(selected);
    start.setHours(9, 0, 0, 0);
    setEditing({ title: "", starts_at: start.toISOString(), all_day: false, location: "", notes: "" });
  };

  return (
    <SafeAreaView edges={["top"]} style={{ flex: 1, backgroundColor: colors.card }}>
      <Header title="Calendar" left={<IconButton name="menu" label="Open menu" onPress={drawer.open} size={26} />} right={<SquareAction icon="add" label="New event" onPress={newEvent} />} />
      <ScrollView refreshControl={<RefreshControl refreshing={loading && !!data} onRefresh={refresh} tintColor={colors.green} />}>
        {offline ? <Text style={{ backgroundColor: colors.banner, color: colors.bannerText, padding: 10, paddingHorizontal: 16, fontSize: 13 }}>Offline — showing the calendar saved on this phone.</Text> : null}
        <View style={{ flexDirection: "row", alignItems: "center", justifyContent: "center", gap: 24, paddingVertical: 10 }}>
          <IconButton name="chevron-back" label="Previous month" onPress={() => setMonth(new Date(month.getFullYear(), month.getMonth() - 1, 1))} />
          <Text style={{ fontSize: 17, fontWeight: "700", color: colors.text, minWidth: 140, textAlign: "center" }}>{MONTH_NAMES[month.getMonth()]} {month.getFullYear()}</Text>
          <IconButton name="chevron-forward" label="Next month" onPress={() => setMonth(new Date(month.getFullYear(), month.getMonth() + 1, 1))} />
        </View>
        <View style={{ flexDirection: "row", paddingHorizontal: 8 }}>
          {WEEKDAYS.map((d) => (
            <Text key={d} style={{ flex: 1, textAlign: "center", color: colors.muted, fontSize: 12, fontWeight: "600" }}>{d}</Text>
          ))}
        </View>
        <View style={{ flexDirection: "row", flexWrap: "wrap", paddingHorizontal: 8, paddingTop: 6 }}>
          {cells.map((d, i) => {
            if (!d) return <View key={`e${i}`} style={{ width: `${100 / 7}%`, height: 48 }} />;
            const key = ymd(d);
            const isSel = key === ymd(selected);
            const has = byDay.has(key);
            return (
              <Pressable key={key} onPress={() => setSelected(d)} accessibilityLabel={`${d.getDate()} ${MONTH_NAMES[d.getMonth()]}${has ? ", has events" : ""}`} style={{ width: `${100 / 7}%`, height: 48, alignItems: "center", justifyContent: "center" }}>
                <View style={{ width: 38, height: 38, borderRadius: 19, alignItems: "center", justifyContent: "center", backgroundColor: isSel ? colors.green : "transparent", borderWidth: key === today && !isSel ? 1.5 : 0, borderColor: colors.green }}>
                  <Text style={{ color: isSel ? "#fff" : colors.text, fontWeight: isSel || key === today ? "700" : "400" }}>{d.getDate()}</Text>
                </View>
                {has ? <View style={{ position: "absolute", bottom: 3, width: 5, height: 5, borderRadius: 3, backgroundColor: isSel ? colors.greenDark : colors.green }} /> : null}
              </Pressable>
            );
          })}
        </View>

        <Text style={{ paddingHorizontal: 16, paddingTop: 18, paddingBottom: 8, fontWeight: "700", color: colors.muted }}>
          {selected.toDateString() === new Date().toDateString() ? "Today" : selected.toDateString()}
        </Text>
        {dayEvents.length === 0 ? (
          <Empty icon="calendar-clear-outline" title="Nothing planned" text="Tap + to add an event." />
        ) : (
          dayEvents.map((e) => (
            <Pressable key={e.id} onPress={() => setEditing(e)} style={{ flexDirection: "row", gap: 12, marginHorizontal: 16, marginBottom: 10, padding: 14, borderRadius: 14, backgroundColor: colors.greenSoft }}>
              <View style={{ width: 4, borderRadius: 2, backgroundColor: colors.green }} />
              <View style={{ flex: 1 }}>
                <Text style={{ color: colors.text, fontWeight: "700", fontSize: 15.5 }}>{e.title}</Text>
                <Text style={{ color: colors.muted, fontSize: 13 }}>
                  {e.all_day ? "All day" : `${timeOfDay(new Date(e.starts_at))}${e.ends_at ? ` – ${timeOfDay(new Date(e.ends_at))}` : ""}`}
                  {e.location ? ` · ${e.location}` : ""}
                </Text>
              </View>
            </Pressable>
          ))
        )}
      </ScrollView>
      {editing ? <EventEditor event={editing} onClose={() => setEditing(null)} onSaved={() => { setEditing(null); void refresh(); }} /> : null}
    </SafeAreaView>
  );
}

function EventEditor({ event, onClose, onSaved }: { event: Partial<CalendarEvent>; onClose: () => void; onSaved: () => void }) {
  const { colors } = useTheme();
  const { account, handleError } = useSession();
  const toast = useToast();
  const [title, setTitle] = useState(event.title ?? "");
  const [start, setStart] = useState(new Date(event.starts_at ?? Date.now()));
  const [end, setEnd] = useState<Date | null>(event.ends_at ? new Date(event.ends_at) : null);
  const [allDay, setAllDay] = useState(!!event.all_day);
  const [location, setLocation] = useState(event.location ?? "");
  const [notes, setNotes] = useState(event.notes ?? "");
  const [picker, setPicker] = useState<null | { which: "start" | "end"; mode: "date" | "time" }>(null);
  const [busy, setBusy] = useState(false);
  const field = { borderWidth: 1, borderColor: colors.border, borderRadius: 12, padding: 12, color: colors.text, fontSize: 16 };

  const save = async () => {
    if (!account || !title.trim()) return;
    setBusy(true);
    try {
      await api.saveEvent(account.token, { id: event.id, title: title.trim(), starts_at: start.toISOString(), ends_at: end && end > start ? end.toISOString() : null, all_day: allDay, location: location || null, notes: notes || null });
      toast("Event saved.");
      onSaved();
    } catch (e) {
      toast(handleError(e), "error");
    } finally {
      setBusy(false);
    }
  };

  const remove = () =>
    Alert.alert("Delete this event?", undefined, [
      { text: "Cancel", style: "cancel" },
      { text: "Delete", style: "destructive", onPress: async () => { try { await api.deleteEvent(account!.token, event.id!); onSaved(); } catch (e) { toast(handleError(e), "error"); } } },
    ]);

  const when = (d: Date | null, which: "start" | "end") => (
    <View style={{ flexDirection: "row", gap: 10 }}>
      <Pressable onPress={() => setPicker({ which, mode: "date" })} style={[field, { flex: 1 }]}><Text style={{ color: colors.text }}>{d ? d.toDateString() : "Add end"}</Text></Pressable>
      {!allDay ? <Pressable onPress={() => setPicker({ which, mode: "time" })} style={field}><Text style={{ color: colors.text }}>{d ? timeOfDay(d) : "--:--"}</Text></Pressable> : null}
    </View>
  );

  return (
    <Modal visible animationType="slide" presentationStyle="pageSheet" onRequestClose={onClose}>
      <SafeAreaView style={{ flex: 1, backgroundColor: colors.card }}>
        <Header title={event.id ? "Edit event" : "New event"} left={<IconButton name="close" label="Close" onPress={onClose} />} right={event.id ? <IconButton name="trash-outline" label="Delete event" onPress={remove} /> : null} />
        <ScrollView contentContainerStyle={{ padding: 16, gap: 14 }}>
          <TextInput value={title} onChangeText={setTitle} placeholder="Title" placeholderTextColor={colors.subtle} style={field} autoFocus={!event.id} />
          <View style={{ flexDirection: "row", alignItems: "center", justifyContent: "space-between" }}>
            <Text style={{ color: colors.text, fontSize: 16 }}>All day</Text>
            <Switch value={allDay} onValueChange={setAllDay} trackColor={{ true: colors.green }} />
          </View>
          <Text style={{ color: colors.muted }}>Starts</Text>
          {when(start, "start")}
          <Text style={{ color: colors.muted }}>Ends</Text>
          {when(end, "end")}
          <TextInput value={location} onChangeText={setLocation} placeholder="Location" placeholderTextColor={colors.subtle} style={field} />
          <TextInput value={notes} onChangeText={setNotes} placeholder="Notes" placeholderTextColor={colors.subtle} style={[field, { minHeight: 90, textAlignVertical: "top" }]} multiline />
          <Button title="Save" onPress={save} busy={busy} disabled={!title.trim()} />
        </ScrollView>
        {picker ? (
          <DateTimePicker
            value={(picker.which === "start" ? start : end) ?? start}
            mode={picker.mode}
            display={Platform.OS === "ios" ? "spinner" : "default"}
            onChange={(ev, d) => {
              if (Platform.OS === "android") setPicker(null);
              if (ev.type === "dismissed" || !d) return;
              if (picker.which === "start") setStart(d);
              else setEnd(d);
            }}
          />
        ) : null}
        {picker && Platform.OS === "ios" ? <Button title="Done" variant="ghost" onPress={() => setPicker(null)} /> : null}
      </SafeAreaView>
    </Modal>
  );
}
