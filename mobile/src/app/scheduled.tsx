import { useRouter } from "expo-router";
import { Alert, FlatList, RefreshControl, Text, View } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { useToast } from "../components/toast";
import { Button, Empty, Header, IconButton } from "../components/ui";
import { api } from "../lib/config";
import { fullDate } from "../lib/format";
import { useCached } from "../lib/useCached";
import { useSession } from "../state/session";
import { useTheme } from "../state/theme";

export default function Scheduled() {
  const { colors } = useTheme();
  const router = useRouter();
  const toast = useToast();
  const { account, handleError } = useSession();
  const { data, refresh, loading } = useCached("scheduled", (token) => api.scheduled(token).then((r) => r.scheduled));

  const cancel = (id: number) =>
    Alert.alert("Cancel this email?", "It will not be sent.", [
      { text: "Keep", style: "cancel" },
      { text: "Cancel email", style: "destructive", onPress: async () => { try { toast((await api.cancelScheduled(account!.token, id)).message); void refresh(); } catch (e) { toast(handleError(e), "error"); } } },
    ]);

  return (
    <SafeAreaView style={{ flex: 1, backgroundColor: colors.card }}>
      <Header title="Scheduled" left={<IconButton name="arrow-back" label="Back" onPress={() => router.back()} />} />
      <FlatList
        data={data ?? []}
        keyExtractor={(s) => String(s.id)}
        refreshControl={<RefreshControl refreshing={loading && !!data} onRefresh={refresh} tintColor={colors.green} />}
        ListEmptyComponent={loading ? undefined : <Empty icon="time-outline" title="Nothing scheduled" text="In Compose, tap the calendar button to send later." />}
        renderItem={({ item }) => (
          <View style={{ padding: 16, borderBottomWidth: 1, borderColor: colors.border, gap: 4 }}>
            <Text style={{ color: colors.text, fontWeight: "700" }}>{item.subject || "(no subject)"}</Text>
            <Text style={{ color: colors.muted, fontSize: 13 }}>To {item.recipients.join(", ")}</Text>
            <Text style={{ color: item.status === "failed" ? colors.danger : colors.greenDark, fontSize: 13 }}>
              {item.status === "scheduled" ? `Sends ${fullDate(item.send_at)}` : item.status === "sent" ? `Sent ${fullDate(item.sent_at)}` : item.status === "failed" ? `Failed: ${item.error ?? ""}` : item.status}
            </Text>
            {item.status === "scheduled" ? <Button small variant="outline" title="Cancel" onPress={() => cancel(item.id)} style={{ alignSelf: "flex-start", marginTop: 6 }} /> : null}
          </View>
        )}
      />
    </SafeAreaView>
  );
}
