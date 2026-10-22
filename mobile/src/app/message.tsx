import { Ionicons } from "@expo/vector-icons";
import { File, Paths } from "expo-file-system";
import { useLocalSearchParams, useRouter } from "expo-router";
import * as Sharing from "expo-sharing";
import { useEffect, useState } from "react";
import { ActionSheetIOS, ActivityIndicator, Alert, Platform, Pressable, ScrollView, Text, View } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { HtmlView } from "../components/HtmlView";
import { useToast } from "../components/toast";
import { Avatar, Empty, IconButton, Loading } from "../components/ui";
import { NetworkError } from "../lib/api";
import { api } from "../lib/config";
import { cachedFullMessage, saveFullMessage } from "../lib/db";
import { bytes, displayName, fullDate, roleOf } from "../lib/format";
import type { AssistantAction, FullMessage } from "../lib/types";
import { useSession } from "../state/session";
import { useTheme } from "../state/theme";

const ASSISTANT: Array<{ action: AssistantAction; label: string; icon: "list" | "create" | "checkbox" | "language" }> = [
  { action: "summarise", label: "Summarise", icon: "list" },
  { action: "draft_reply", label: "Draft reply", icon: "create" },
  { action: "action_items", label: "Action items", icon: "checkbox" },
  { action: "translate_yoruba", label: "Translate to Yoruba", icon: "language" },
];

export default function MessageScreen() {
  const { folder, uid: uidParam } = useLocalSearchParams<{ folder: string; uid: string }>();
  const uid = Number(uidParam);
  const router = useRouter();
  const toast = useToast();
  const { colors } = useTheme();
  const { account, folders, messageAction, handleError, refreshFolders, bumpMail } = useSession();
  const [message, setMessage] = useState<FullMessage | null>(null);
  const [loading, setLoading] = useState(true);
  const [fromCache, setFromCache] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [showImages, setShowImages] = useState(false);
  const [assistant, setAssistant] = useState<{ action: AssistantAction; text: string | null } | null>(null);
  const [downloading, setDownloading] = useState<number | null>(null);
  const role = roleOf(folders, folder);

  useEffect(() => {
    if (!account) return;
    let cancelled = false;
    (async () => {
      const cached = await cachedFullMessage(account.email, folder, uid).catch(() => null);
      if (cached && !cancelled) {
        setMessage(cached);
        setFromCache(true);
        setLoading(false);
      }
      try {
        const full = await api.message(account.token, folder, uid);
        if (cancelled) return;
        setMessage(full);
        setFromCache(false);
        void saveFullMessage(account.email, folder, full).catch(() => {});
        if (!cached?.seen) void refreshFolders();
      } catch (e) {
        if (cancelled) return;
        if (!(e instanceof NetworkError) || !cached) setError(e instanceof NetworkError ? "You're offline, and this message isn't saved on this phone yet." : handleError(e, "Could not open that message."));
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [account, folder, uid]); // eslint-disable-line react-hooks/exhaustive-deps

  const act = async (action: Parameters<typeof messageAction>[2], leave = true) => {
    try {
      const text = await messageAction(folder, uid, action);
      if (text) toast(text);
      bumpMail();
      if (leave) router.back();
    } catch (e) {
      toast(handleError(e), "error");
    }
  };

  const toggleStar = () => {
    if (!message) return;
    setMessage({ ...message, flagged: !message.flagged });
    void act({ type: "flagged", value: !message.flagged }, false);
  };

  const more = () => {
    const choices: Array<{ label: string; run: () => void; destructive?: boolean }> = [
      { label: "Reply all", run: () => compose("reply_all") },
      { label: "Mark as unread", run: () => void act({ type: "seen", value: false }) },
      ...(role !== "archive" ? [{ label: "Archive", run: () => void act({ type: "move", toRole: "archive" }) }] : []),
      role === "junk" ? { label: "Not spam", run: () => void act({ type: "move", toRole: "inbox" }) } : { label: "Report spam", run: () => void act({ type: "move", toRole: "junk" }) },
      ...ASSISTANT.map((a) => ({ label: `AI: ${a.label}`, run: () => void ask(a.action) })),
    ];
    if (Platform.OS === "ios") {
      ActionSheetIOS.showActionSheetWithOptions({ options: [...choices.map((c) => c.label), "Cancel"], cancelButtonIndex: choices.length }, (i) => choices[i]?.run());
    } else {
      Alert.alert("More", undefined, [...choices.map((c) => ({ text: c.label, onPress: c.run })), { text: "Cancel", style: "cancel" as const }], { cancelable: true });
    }
  };

  const compose = (mode: "reply" | "reply_all" | "forward", body?: string) =>
    router.push({ pathname: "/compose", params: { mode, folder, uid: String(uid), ...(body ? { body } : {}) } });

  const ask = async (action: AssistantAction) => {
    if (!account) return;
    setAssistant({ action, text: null });
    try {
      const { reply } = await api.assistant(account.token, action, folder, uid);
      setAssistant({ action, text: reply });
    } catch (e) {
      setAssistant(null);
      toast(e instanceof NetworkError ? "The assistant needs an internet connection." : handleError(e), "error");
    }
  };

  const openAttachment = async (index: number, name: string) => {
    if (!account) return;
    setDownloading(index);
    try {
      const response = await api.download(`/messages/${uid}/attachments/${index}`, account.token, { folder });
      const file = new File(Paths.cache, `${Date.now()}-${name.replace(/[^\w.\- ]/g, "_")}`);
      file.write(new Uint8Array(await response.arrayBuffer()));
      if (await Sharing.isAvailableAsync()) await Sharing.shareAsync(file.uri, { dialogTitle: name });
      else toast("Saved to this phone.");
    } catch (e) {
      toast(handleError(e, "Could not download it."), "error");
    } finally {
      setDownloading(null);
    }
  };

  const header = (
    <View style={{ flexDirection: "row", alignItems: "center", paddingHorizontal: 6, height: 54, backgroundColor: colors.card }}>
      <IconButton name="arrow-back" label="Back" onPress={() => router.back()} />
      <View style={{ flex: 1 }} />
      <IconButton name="arrow-undo-outline" label="Reply" onPress={() => compose("reply")} />
      <IconButton name="arrow-redo-outline" label="Forward" onPress={() => compose("forward")} />
      <IconButton name="trash-outline" label={role === "trash" ? "Delete for good" : "Delete"} onPress={() => void act({ type: "delete" })} />
      <IconButton name="ellipsis-horizontal" label="More actions" onPress={more} />
    </View>
  );

  if (loading && !message) {
    return (
      <SafeAreaView style={{ flex: 1, backgroundColor: colors.card }}>
        {header}
        <Loading />
      </SafeAreaView>
    );
  }
  if (!message) {
    return (
      <SafeAreaView style={{ flex: 1, backgroundColor: colors.card }}>
        {header}
        <Empty icon="cloud-offline-outline" title="Can't open this message" text={error ?? undefined} />
      </SafeAreaView>
    );
  }

  const sender = displayName(message.from);
  return (
    <SafeAreaView style={{ flex: 1, backgroundColor: colors.card }}>
      {header}
      <ScrollView contentContainerStyle={{ paddingBottom: 24 }}>
        <View style={{ paddingHorizontal: 16, paddingTop: 6, flexDirection: "row", gap: 12, alignItems: "flex-start" }}>
          <Text selectable style={{ flex: 1, fontSize: 23, fontWeight: "800", color: colors.text, lineHeight: 30 }}>{message.subject || "(no subject)"}</Text>
          <IconButton name={message.flagged ? "star" : "star-outline"} label={message.flagged ? "Remove star" : "Star"} color={message.flagged ? colors.warning : colors.muted} onPress={toggleStar} />
        </View>

        <View style={{ flexDirection: "row", gap: 12, padding: 16, alignItems: "center" }}>
          <Avatar name={sender} size={46} />
          <View style={{ flex: 1 }}>
            <Text style={{ color: colors.text, fontWeight: "700", fontSize: 15.5 }} numberOfLines={1}>
              {sender} <Text style={{ color: colors.muted, fontWeight: "400", fontSize: 13 }}>{message.from.name ? `<${message.from.email}>` : ""}</Text>
            </Text>
            <Text style={{ color: colors.muted, fontSize: 13 }} numberOfLines={2}>
              to {message.to.map((a) => a.email).join(", ") || "(no recipient)"}
              {message.cc.length ? `, cc ${message.cc.map((a) => a.email).join(", ")}` : ""}
            </Text>
          </View>
          <Text style={{ color: colors.muted, fontSize: 12, textAlign: "right", maxWidth: 96 }}>{fullDate(message.date)}</Text>
        </View>

        {fromCache ? (
          <Text style={{ marginHorizontal: 16, marginBottom: 8, color: colors.bannerText, fontSize: 12 }}>Showing the copy saved on this phone.</Text>
        ) : null}

        <View style={{ flexDirection: "row", flexWrap: "wrap", gap: 8, paddingHorizontal: 16, paddingBottom: 10 }}>
          {ASSISTANT.map((a) => (
            <Pressable key={a.action} onPress={() => void ask(a.action)} style={{ flexDirection: "row", alignItems: "center", gap: 6, paddingVertical: 7, paddingHorizontal: 12, borderRadius: 999, backgroundColor: colors.greenSoft }}>
              <Ionicons name={`${a.icon}-outline` as never} size={15} color={colors.greenDark} />
              <Text style={{ color: colors.greenDark, fontWeight: "600", fontSize: 13 }}>{a.label}</Text>
            </Pressable>
          ))}
        </View>

        {assistant ? (
          <View style={{ marginHorizontal: 16, marginBottom: 12, padding: 14, borderRadius: 14, backgroundColor: colors.greenSoft, gap: 8 }}>
            <View style={{ flexDirection: "row", alignItems: "center", gap: 8 }}>
              <Ionicons name="sparkles" size={16} color={colors.greenDark} />
              <Text style={{ flex: 1, color: colors.greenDark, fontWeight: "700" }}>{ASSISTANT.find((a) => a.action === assistant.action)?.label}</Text>
              <IconButton name="close" label="Close assistant" size={18} color={colors.greenDark} onPress={() => setAssistant(null)} />
            </View>
            {assistant.text === null ? <ActivityIndicator color={colors.green} /> : <Text selectable style={{ color: colors.text, lineHeight: 21 }}>{assistant.text}</Text>}
            {assistant.action === "draft_reply" && assistant.text ? (
              <Pressable onPress={() => compose("reply", assistant.text!)} style={{ alignSelf: "flex-start", paddingVertical: 8, paddingHorizontal: 14, borderRadius: 999, backgroundColor: colors.green }}>
                <Text style={{ color: "#fff", fontWeight: "700" }}>Use this reply</Text>
              </Pressable>
            ) : null}
          </View>
        ) : null}

        {message.has_remote_images && !showImages ? (
          <Pressable onPress={() => setShowImages(true)} style={{ marginHorizontal: 16, marginBottom: 8, padding: 12, borderRadius: 12, backgroundColor: colors.input, flexDirection: "row", gap: 8, alignItems: "center" }}>
            <Ionicons name="image-outline" size={18} color={colors.muted} />
            <Text style={{ flex: 1, color: colors.muted, fontSize: 13 }}>Images from the internet are hidden to protect your privacy.</Text>
            <Text style={{ color: colors.greenDark, fontWeight: "700" }}>Show</Text>
          </Pressable>
        ) : null}

        <HtmlView html={message.html} allowRemoteImages={showImages} />

        {message.attachments.length ? (
          <View style={{ paddingHorizontal: 16, gap: 8, marginTop: 8 }}>
            <Text style={{ color: colors.muted, fontWeight: "700", fontSize: 13 }}>{message.attachments.length} attachment{message.attachments.length === 1 ? "" : "s"}</Text>
            {message.attachments.map((a) => (
              <Pressable key={a.index} onPress={() => void openAttachment(a.index, a.name)} style={{ flexDirection: "row", alignItems: "center", gap: 12, padding: 12, borderRadius: 12, borderWidth: 1, borderColor: colors.border }}>
                <Ionicons name={a.mime.startsWith("image/") ? "image-outline" : a.mime === "application/pdf" ? "document-text-outline" : "document-attach-outline"} size={24} color={colors.green} />
                <View style={{ flex: 1 }}>
                  <Text style={{ color: colors.text, fontWeight: "600" }} numberOfLines={1}>{a.name}</Text>
                  <Text style={{ color: colors.muted, fontSize: 12 }}>{bytes(a.size)}</Text>
                </View>
                {downloading === a.index ? <ActivityIndicator color={colors.green} /> : <Ionicons name="download-outline" size={20} color={colors.muted} />}
              </Pressable>
            ))}
          </View>
        ) : null}
      </ScrollView>

      <View style={{ flexDirection: "row", gap: 10, padding: 12, borderTopWidth: 1, borderColor: colors.border, backgroundColor: colors.card }}>
        <Pressable onPress={() => compose("reply")} style={{ flex: 1, flexDirection: "row", alignItems: "center", gap: 10, paddingHorizontal: 16, height: 48, borderRadius: 14, backgroundColor: colors.input }}>
          <Ionicons name="arrow-undo-outline" size={20} color={colors.muted} />
          <Text style={{ color: colors.muted, fontSize: 16 }}>Reply</Text>
        </Pressable>
        <Pressable onPress={more} accessibilityLabel="More actions" style={{ width: 48, height: 48, borderRadius: 14, borderWidth: 1, borderColor: colors.border, alignItems: "center", justifyContent: "center" }}>
          <Ionicons name="ellipsis-horizontal" size={20} color={colors.text} />
        </Pressable>
      </View>
    </SafeAreaView>
  );
}
