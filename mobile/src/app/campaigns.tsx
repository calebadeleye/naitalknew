import { useRouter } from "expo-router";
import { FlatList, RefreshControl, Text, View } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { Button, Empty, Header, IconButton } from "../components/ui";
import { api } from "../lib/config";
import { shortDate } from "../lib/format";
import type { Campaign } from "../lib/types";
import { useCached } from "../lib/useCached";
import { useSession } from "../state/session";
import { useTheme } from "../state/theme";
import { openLink } from "../lib/links";

const STATUS: Record<Campaign["status"], [string, string]> = {
  draft: ["Draft", "#64748b"],
  sending: ["Sending", "#f59e0b"],
  sent: ["Sent", "#16a34a"],
  cancelled: ["Cancelled", "#64748b"],
  failed: ["Failed", "#dc2626"],
};

/** Campaign progress on the phone; building a campaign (recipient lists) is done on the web. */
export default function Campaigns() {
  const { colors } = useTheme();
  const router = useRouter();
  const { account } = useSession();
  const { data, refresh, loading } = useCached("campaigns", (token) => api.campaigns(token).then((r) => r.campaigns));
  const domain = account?.email.split("@")[1] ?? "";

  return (
    <SafeAreaView style={{ flex: 1, backgroundColor: colors.card }}>
      <Header title="Campaigns" left={<IconButton name="arrow-back" label="Back" onPress={() => router.back()} />} />
      <FlatList
        data={data ?? []}
        keyExtractor={(c) => String(c.id)}
        refreshControl={<RefreshControl refreshing={loading && !!data} onRefresh={refresh} tintColor={colors.green} />}
        ListEmptyComponent={loading && !data ? undefined : <Empty icon="megaphone-outline" title="No campaigns yet" text="Send one email to many people — create campaigns in Green Mail on the web." />}
        renderItem={({ item }) => {
          const [label, color] = STATUS[item.status];
          const done = item.sent_count + item.failed_count + item.skipped_count;
          return (
            <View style={{ padding: 16, borderBottomWidth: 1, borderColor: colors.border, gap: 6 }}>
              <View style={{ flexDirection: "row", alignItems: "center", gap: 8 }}>
                <Text style={{ flex: 1, color: colors.text, fontWeight: "700", fontSize: 15.5 }} numberOfLines={1}>{item.name}</Text>
                <Text style={{ color, fontWeight: "700", fontSize: 12 }}>{label}</Text>
              </View>
              <Text style={{ color: colors.muted, fontSize: 13 }} numberOfLines={1}>{item.subject}</Text>
              {item.total ? (
                <View style={{ height: 5, borderRadius: 3, backgroundColor: colors.input, overflow: "hidden" }}>
                  <View style={{ width: `${Math.round((done / item.total) * 100)}%`, height: 5, backgroundColor: colors.green }} />
                </View>
              ) : null}
              <Text style={{ color: colors.muted, fontSize: 12 }}>
                {item.sent_count} of {item.total} sent{item.failed_count ? ` · ${item.failed_count} failed` : ""} · {shortDate(item.created_at)}
              </Text>
            </View>
          );
        }}
      />
      <View style={{ padding: 16 }}>
        <Button title="Create a campaign on the web" variant="outline" icon="open-outline" onPress={() => openLink(`https://www.naitalk.com/greenmail?domain=${encodeURIComponent(domain)}`)} />
      </View>
    </SafeAreaView>
  );
}
