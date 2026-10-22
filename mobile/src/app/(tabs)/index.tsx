import { Ionicons } from "@expo/vector-icons";
import { useRouter } from "expo-router";
import { useCallback, useEffect, useRef, useState } from "react";
import { ActionSheetIOS, Alert, FlatList, Platform, Pressable, RefreshControl, Text, TextInput, View } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { useDrawer } from "../../components/Drawer";
import { MessageRow } from "../../components/MessageRow";
import { StatusBanner } from "../../components/StatusBanner";
import { useToast } from "../../components/toast";
import { Avatar, Brand, Empty, IconButton, Loading, SquareAction, Tabs } from "../../components/ui";
import { NetworkError } from "../../lib/api";
import { api } from "../../lib/config";
import { cachedMessages, saveMessagePage } from "../../lib/db";
import { folderLabel, roleOf } from "../../lib/format";
import type { ListFilter, MessageSummary } from "../../lib/types";
import { useSession } from "../../state/session";
import { useTheme } from "../../state/theme";

const FILTERS: Array<{ value: ListFilter; label: string }> = [
  { value: "all", label: "All" },
  { value: "unread", label: "Unread" },
  { value: "flagged", label: "Flagged" },
  { value: "attachments", label: "Attachments" },
];
const PAGE = 50;

export default function MailScreen() {
  const { colors } = useTheme();
  const router = useRouter();
  const drawer = useDrawer();
  const toast = useToast();
  const { account, me, folder, folders, filter, setFilter, mailVersion, messageAction, handleError, refreshFolders } = useSession();
  const [messages, setMessages] = useState<MessageSummary[]>([]);
  const [page, setPage] = useState(1);
  const [lastPage, setLastPage] = useState(1);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [loadingMore, setLoadingMore] = useState(false);
  const [offline, setOffline] = useState(false);
  const [query, setQuery] = useState("");
  const [search, setSearch] = useState("");
  const request = useRef(0);

  useEffect(() => {
    const t = setTimeout(() => setSearch(query.trim()), 400);
    return () => clearTimeout(t);
  }, [query]);

  const role = roleOf(folders, folder);
  const current = folders.find((f) => f.path === folder);
  const title = filter === "flagged" && role === "inbox" ? "Starred" : current ? folderLabel(current) : "Inbox";

  /** Page 1: the phone's copy at once, then the server's. Offline, the copy is all there is. */
  const load = useCallback(
    async (mode: "initial" | "refresh") => {
      if (!account) return;
      const id = ++request.current;
      if (mode === "initial") {
        setLoading(true);
        const cached = await cachedMessages(account.email, folder, filter, search, PAGE).catch(() => []);
        if (id !== request.current) return;
        setMessages(cached);
        if (cached.length) setLoading(false);
      }
      try {
        const result = await api.messages(account.token, folder, 1, filter, search || undefined);
        if (id !== request.current) return;
        setMessages(result.messages);
        setPage(1);
        setLastPage(result.last_page);
        setOffline(false);
        void saveMessagePage(account.email, folder, result.messages, filter === "all" && !search).catch(() => {});
      } catch (error) {
        if (id !== request.current) return;
        if (error instanceof NetworkError) {
          setOffline(true);
          setLastPage(1);
          if (mode === "refresh") toast("You're offline — showing mail saved on this phone.", "info");
        } else {
          toast(handleError(error, "Could not load messages."), "error");
        }
      } finally {
        if (id === request.current) {
          setLoading(false);
          setRefreshing(false);
        }
      }
    },
    [account, folder, filter, search, toast, handleError],
  );

  useEffect(() => {
    void load("initial");
  }, [load]);

  // Something changed elsewhere (sent, deleted, outbox synced): refresh quietly.
  const firstVersion = useRef(mailVersion);
  useEffect(() => {
    if (mailVersion !== firstVersion.current) void load("refresh");
  }, [mailVersion]); // eslint-disable-line react-hooks/exhaustive-deps

  const loadMore = async () => {
    if (!account || loadingMore || loading) return;
    if (offline) {
      // Offline: page through the phone's copy.
      if (messages.length % PAGE !== 0 || messages.length === 0) return;
      setLoadingMore(true);
      const more = await cachedMessages(account.email, folder, filter, search, PAGE, messages.length).catch(() => []);
      setMessages((m) => [...m, ...more.filter((x) => !m.some((y) => y.uid === x.uid))]);
      setLoadingMore(false);
      return;
    }
    if (page >= lastPage) return;
    setLoadingMore(true);
    try {
      const result = await api.messages(account.token, folder, page + 1, filter, search || undefined);
      setMessages((m) => [...m, ...result.messages.filter((x) => !m.some((y) => y.uid === x.uid))]);
      setPage(result.page);
      setLastPage(result.last_page);
      void saveMessagePage(account.email, folder, result.messages, false).catch(() => {});
    } catch (error) {
      if (!(error instanceof NetworkError)) toast(handleError(error), "error");
    } finally {
      setLoadingMore(false);
    }
  };

  const open = useCallback(
    (m: MessageSummary) => {
      if (role === "drafts") {
        router.push({ pathname: "/compose", params: { mode: "draft", folder, uid: String(m.uid) } });
        return;
      }
      setMessages((list) => list.map((x) => (x.uid === m.uid ? { ...x, seen: true } : x)));
      router.push({ pathname: "/message", params: { folder, uid: String(m.uid) } });
    },
    [folder, role, router],
  );

  const star = useCallback(
    (m: MessageSummary) => {
      setMessages((list) => list.map((x) => (x.uid === m.uid ? { ...x, flagged: !m.flagged } : x)));
      messageAction(folder, m.uid, { type: "flagged", value: !m.flagged }).catch((e) => {
        setMessages((list) => list.map((x) => (x.uid === m.uid ? { ...x, flagged: m.flagged } : x)));
        toast(handleError(e), "error");
      });
    },
    [folder, messageAction, toast, handleError],
  );

  const actions = useCallback(
    (m: MessageSummary) => {
      const choices = [
        { label: m.seen ? "Mark as unread" : "Mark as read", run: () => messageAction(folder, m.uid, { type: "seen", value: !m.seen }).then(() => setMessages((l) => l.map((x) => (x.uid === m.uid ? { ...x, seen: !m.seen } : x)))) },
        ...(role !== "archive" ? [{ label: "Archive", run: () => messageAction(folder, m.uid, { type: "move", toRole: "archive" }).then(removeRow(m)) }] : []),
        ...(role === "junk" ? [{ label: "Not spam", run: () => messageAction(folder, m.uid, { type: "move", toRole: "inbox" }).then(removeRow(m)) }] : [{ label: "Spam", run: () => messageAction(folder, m.uid, { type: "move", toRole: "junk" }).then(removeRow(m)) }]),
        { label: role === "trash" ? "Delete for good" : "Delete", destructive: true, run: () => messageAction(folder, m.uid, { type: "delete" }).then(removeRow(m)) },
      ];
      const runChoice = (i: number) =>
        choices[i]
          ?.run()
          .then(() => void refreshFolders())
          .catch((e) => toast(handleError(e), "error"));
      if (Platform.OS === "ios") {
        ActionSheetIOS.showActionSheetWithOptions({ options: [...choices.map((c) => c.label), "Cancel"], cancelButtonIndex: choices.length, destructiveButtonIndex: choices.length - 1, title: m.subject }, runChoice);
      } else {
        Alert.alert(m.subject || "(no subject)", undefined, [...choices.map((c, i) => ({ text: c.label, style: c.destructive ? ("destructive" as const) : ("default" as const), onPress: () => runChoice(i) })), { text: "Cancel", style: "cancel" as const }], { cancelable: true });
      }
    },
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [folder, role, messageAction],
  );

  const removeRow = (m: MessageSummary) => (text: string | null) => {
    setMessages((list) => list.filter((x) => x.uid !== m.uid));
    if (text) toast(text);
  };

  return (
    <SafeAreaView edges={["top"]} style={{ flex: 1, backgroundColor: colors.card }}>
      <View style={{ flexDirection: "row", alignItems: "center", paddingHorizontal: 8, height: 58 }}>
        <IconButton name="menu" label="Open menu" onPress={drawer.open} size={26} />
        <View style={{ flex: 1, alignItems: "center" }}>
          <Brand size={22} />
        </View>
        <Pressable onPress={() => router.push("/settings")} accessibilityLabel="Account and settings" style={{ padding: 4, marginRight: 4 }}>
          <Avatar name={me?.display_name || account?.email || "?"} size={36} color={colors.green} />
        </Pressable>
      </View>

      <View style={{ flexDirection: "row", alignItems: "center", gap: 10, paddingLeft: 16, paddingBottom: 8 }}>
        <View style={{ flex: 1, flexDirection: "row", alignItems: "center", backgroundColor: colors.input, borderRadius: 14, paddingHorizontal: 12, height: 44 }}>
          <Ionicons name="search" size={18} color={colors.muted} />
          <TextInput
            value={query}
            onChangeText={setQuery}
            placeholder={`Search ${title}…`}
            placeholderTextColor={colors.subtle}
            returnKeyType="search"
            autoCorrect={false}
            style={{ flex: 1, marginLeft: 8, fontSize: 15, color: colors.text }}
          />
          {query ? <IconButton name="close-circle" label="Clear search" size={18} color={colors.subtle} onPress={() => setQuery("")} /> : null}
        </View>
        <SquareAction icon="create-outline" label="Compose" onPress={() => router.push("/compose")} />
      </View>

      <Tabs value={filter} options={FILTERS} onChange={setFilter} />
      <StatusBanner />

      <View style={{ flex: 1, backgroundColor: colors.card }}>
        {loading && messages.length === 0 ? (
          <Loading />
        ) : (
          <FlatList
            data={messages}
            keyExtractor={(m) => String(m.uid)}
            renderItem={({ item }) => <MessageRow message={item} showRecipient={role === "sent" || role === "drafts"} onPress={open} onStar={star} onLongPress={actions} />}
            refreshControl={<RefreshControl refreshing={refreshing} onRefresh={() => { setRefreshing(true); void refreshFolders(); void load("refresh"); }} tintColor={colors.green} colors={[colors.green]} />}
            onEndReached={loadMore}
            onEndReachedThreshold={0.4}
            ListHeaderComponent={
              <View style={{ paddingHorizontal: 16, paddingTop: 10, paddingBottom: 4, flexDirection: "row", justifyContent: "space-between" }}>
                <Text style={{ color: colors.muted, fontWeight: "700", fontSize: 13 }}>{search ? `Results in ${title}` : title}</Text>
                {offline ? <Text style={{ color: colors.bannerText, fontSize: 12 }}>Saved on this phone</Text> : null}
              </View>
            }
            ListFooterComponent={loadingMore ? <Loading /> : <View style={{ height: 24 }} />}
            ListEmptyComponent={
              <Empty
                icon={search ? "search-outline" : "mail-open-outline"}
                title={search ? "No matches" : offline ? "Nothing saved here yet" : "No messages"}
                text={search ? (offline ? "Only mail saved on this phone is searched while offline." : "Try other words.") : offline ? "Mail you open while online is kept for reading offline." : undefined}
              />
            }
          />
        )}
      </View>
    </SafeAreaView>
  );
}
