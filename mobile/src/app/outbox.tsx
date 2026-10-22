import { Ionicons } from "@expo/vector-icons";
import { useRouter } from "expo-router";
import { useCallback, useState } from "react";
import { Alert, Pressable, ScrollView, Text, View } from "react-native";
import { useFocusEffect } from "expo-router";
import { SafeAreaView } from "react-native-safe-area-context";
import { Button, Card, Divider, Empty, Header, IconButton, SectionTitle } from "../components/ui";
import { localDrafts, deleteLocalDraft, type LocalDraft } from "../lib/db";
import { dropFiles } from "../lib/files";
import { shortDate } from "../lib/format";
import type { OutboxItem } from "../lib/outbox";
import type { ComposePayload } from "../lib/types";
import { useSession } from "../state/session";
import { useTheme } from "../state/theme";

const KIND: Record<OutboxItem["kind"], string> = { send: "Email", draft: "Draft", schedule: "Scheduled email", request: "Change" };

/** Everything waiting to reach the server, and drafts kept only on this phone. */
export default function Outbox() {
  const { colors } = useTheme();
  const router = useRouter();
  const { outbox, online, runOutbox, retryOutbox, discardOutbox, expired } = useSession();
  const [drafts, setDrafts] = useState<LocalDraft[]>([]);

  useFocusEffect(
    useCallback(() => {
      localDrafts().then(setDrafts).catch(() => {});
    }, []),
  );

  const discard = (item: OutboxItem) =>
    Alert.alert("Discard this?", "It will not be sent.", [
      { text: "Keep", style: "cancel" },
      { text: "Discard", style: "destructive", onPress: () => { if (item.kind !== "request") dropFiles((item.payload as ComposePayload).attachments); void discardOutbox(item.id); } },
    ]);

  return (
    <SafeAreaView style={{ flex: 1, backgroundColor: colors.background }}>
      <Header title="Outbox" left={<IconButton name="arrow-back" label="Back" onPress={() => router.back()} />} right={<IconButton name="refresh" label="Send now" onPress={() => void runOutbox()} />} />
      <ScrollView contentContainerStyle={{ padding: 16, gap: 4 }}>
        <View style={{ flexDirection: "row", alignItems: "center", gap: 8, padding: 12, borderRadius: 12, backgroundColor: online ? colors.greenSoft : colors.banner }}>
          <Ionicons name={online ? "cloud-done-outline" : "cloud-offline-outline"} size={18} color={online ? colors.greenDark : colors.bannerText} />
          <Text style={{ flex: 1, color: online ? colors.greenDark : colors.bannerText, fontSize: 13 }}>{online ? "Online — waiting items are sent automatically." : "Offline — items are sent when you're back online."}</Text>
        </View>

        {outbox.length === 0 && drafts.length === 0 ? <Empty icon="cloud-upload-outline" title="Nothing waiting" text="Emails you send while offline wait here." /> : null}

        {outbox.length ? <SectionTitle>Waiting to send</SectionTitle> : null}
        {outbox.length ? (
          <Card>
            {outbox.map((item, i) => (
              <View key={item.id}>
                {i ? <Divider /> : null}
                <View style={{ padding: 14, gap: 6 }}>
                  <View style={{ flexDirection: "row", alignItems: "center", gap: 8 }}>
                    <Ionicons name={item.status === "failed" ? "alert-circle" : item.status === "sending" ? "sync" : "time-outline"} size={18} color={item.status === "failed" ? colors.danger : colors.muted} />
                    <Text style={{ flex: 1, color: colors.text, fontWeight: "700" }} numberOfLines={1}>{item.label}</Text>
                    <Text style={{ color: colors.muted, fontSize: 12 }}>{shortDate(new Date(item.createdAt).toISOString())}</Text>
                  </View>
                  <Text style={{ color: colors.muted, fontSize: 13 }}>
                    {KIND[item.kind]} · {item.account}
                    {item.kind !== "request" && (item.payload as ComposePayload).to ? ` · to ${(item.payload as ComposePayload).to}` : ""}
                  </Text>
                  {item.error ? <Text style={{ color: item.status === "failed" || expired.includes(item.account) ? colors.danger : colors.bannerText, fontSize: 13 }}>{item.status === "failed" ? "Not sent: " : "Last try: "}{item.error}</Text> : null}
                  <View style={{ flexDirection: "row", gap: 8, marginTop: 4 }}>
                    {item.status === "failed" ? <Button small title="Try again" onPress={() => void retryOutbox(item.id)} /> : null}
                    {expired.includes(item.account) ? <Button small title="Sign in" onPress={() => router.push({ pathname: "/sign-in", params: { email: item.account } })} /> : null}
                    <Button small variant="outline" title="Discard" onPress={() => discard(item)} />
                  </View>
                </View>
              </View>
            ))}
          </Card>
        ) : null}

        {drafts.length ? <SectionTitle>Drafts on this phone</SectionTitle> : null}
        {drafts.length ? (
          <Card>
            {drafts.map((d, i) => (
              <View key={d.id}>
                {i ? <Divider /> : null}
                <Pressable onPress={() => router.push({ pathname: "/compose", params: { mode: "local", localId: d.id } })} style={{ padding: 14, flexDirection: "row", alignItems: "center", gap: 10 }}>
                  <Ionicons name="document-text-outline" size={20} color={colors.green} />
                  <View style={{ flex: 1 }}>
                    <Text style={{ color: colors.text, fontWeight: "600" }} numberOfLines={1}>{d.subject || "(no subject)"}</Text>
                    <Text style={{ color: colors.muted, fontSize: 13 }} numberOfLines={1}>{d.to ? `To ${d.to}` : "No recipient yet"} · {shortDate(new Date(d.updatedAt).toISOString())}</Text>
                  </View>
                  <IconButton name="trash-outline" label="Delete draft" size={18} color={colors.muted} onPress={() => { void deleteLocalDraft(d.id).then(() => setDrafts((list) => list.filter((x) => x.id !== d.id))); }} />
                </Pressable>
              </View>
            ))}
          </Card>
        ) : null}
      </ScrollView>
    </SafeAreaView>
  );
}
