import { Ionicons } from "@expo/vector-icons";
import { useRouter, type Href } from "expo-router";
import { createContext, useCallback, useContext, useEffect, useRef, useState, type ReactNode } from "react";
import { Animated, Dimensions, Modal, Pressable, ScrollView, StyleSheet, Text, View } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { bytes, folderLabel } from "../lib/format";
import type { Folder } from "../lib/types";
import { useSession } from "../state/session";
import { useTheme } from "../state/theme";
import { Avatar, Brand, IconButton, type IconName } from "./ui";

const DrawerContext = createContext<{ open: () => void; close: () => void }>({ open: () => {}, close: () => {} });
export const useDrawer = () => useContext(DrawerContext);

const WIDTH = Math.min(340, Dimensions.get("window").width * 0.86);

const FOLDER_ICONS: Record<string, IconName> = { inbox: "mail-outline", sent: "paper-plane-outline", drafts: "document-text-outline", junk: "alert-circle-outline", trash: "trash-outline", archive: "archive-outline" };
const ORDER = ["inbox", "sent", "drafts", "junk", "trash", "archive"];

export function DrawerProvider({ children }: { children: ReactNode }) {
  const [visible, setVisible] = useState(false);
  const x = useRef(new Animated.Value(-WIDTH)).current;

  const open = useCallback(() => {
    setVisible(true);
    Animated.timing(x, { toValue: 0, duration: 220, useNativeDriver: true }).start();
  }, [x]);
  const close = useCallback(() => {
    Animated.timing(x, { toValue: -WIDTH, duration: 180, useNativeDriver: true }).start(() => setVisible(false));
  }, [x]);

  return (
    <DrawerContext.Provider value={{ open, close }}>
      {children}
      <Modal visible={visible} transparent animationType="none" onRequestClose={close} statusBarTranslucent>
        <Pressable style={{ ...StyleSheet.absoluteFill, backgroundColor: "rgba(0,0,0,0.45)" }} onPress={close} accessibilityLabel="Close menu" />
        <Animated.View style={{ position: "absolute", top: 0, bottom: 0, left: 0, width: WIDTH, transform: [{ translateX: x }] }}>
          <DrawerContent close={close} />
        </Animated.View>
      </Modal>
    </DrawerContext.Provider>
  );
}

function DrawerContent({ close }: { close: () => void }) {
  const { colors } = useTheme();
  const insets = useSafeAreaInsets();
  const router = useRouter();
  const { accounts, account, me, folders, starred, folder, filter, setFolder, switchAccount, outbox, refreshFolders } = useSession();
  const [switcher, setSwitcher] = useState(false);

  useEffect(() => {
    void refreshFolders();
  }, [refreshFolders]);

  const go = (href: Href) => {
    close();
    router.push(href);
  };
  const openFolder = (path: string, f: "all" | "flagged" = "all") => {
    setFolder(path, f);
    close();
    router.navigate("/");
  };

  const inbox = folders.find((f) => f.role === "inbox");
  const sorted = [...folders].sort((a, b) => {
    const ia = a.role ? ORDER.indexOf(a.role) : 99;
    const ib = b.role ? ORDER.indexOf(b.role) : 99;
    return ia - ib || a.name.localeCompare(b.name);
  });
  const name = me?.display_name || account?.email.split("@")[0] || "";
  const quota = me?.quota;
  const pct = quota && quota.limit_bytes > 0 ? Math.min(1, quota.used_bytes / quota.limit_bytes) : 0;
  const waiting = outbox.filter((i) => i.account === account?.email).length;

  const item = (key: string, icon: IconName, label: string, onPress: () => void, active = false, count?: number) => (
    <Pressable key={key} onPress={onPress} accessibilityRole="button" style={({ pressed }) => [styles.item, active && { backgroundColor: colors.navySoft, borderLeftColor: colors.green }, pressed && { opacity: 0.7 }]}>
      <Ionicons name={icon} size={20} color={active ? "#fff" : colors.navyText} />
      <Text style={[styles.itemText, { color: active ? "#fff" : colors.navyText, fontWeight: active ? "700" : "500" }]}>{label}</Text>
      {count ? (
        <View style={[styles.count, { backgroundColor: active ? "#fff" : "rgba(255,255,255,0.14)" }]}>
          <Text style={{ color: active ? colors.navy : "#fff", fontSize: 12, fontWeight: "700" }}>{count}</Text>
        </View>
      ) : null}
    </Pressable>
  );

  return (
    <View style={{ flex: 1, backgroundColor: colors.navy, paddingTop: insets.top + 8 }}>
      <View style={{ flexDirection: "row", alignItems: "center", justifyContent: "space-between", paddingHorizontal: 16, paddingBottom: 12 }}>
        <Brand onDark size={22} />
        <IconButton name="close" label="Close menu" color="#fff" onPress={close} />
      </View>

      <Pressable onPress={() => setSwitcher((s) => !s)} accessibilityRole="button" accessibilityLabel="Switch account" style={{ flexDirection: "row", alignItems: "center", gap: 12, marginHorizontal: 12, padding: 12, borderRadius: 14, backgroundColor: colors.navySoft }}>
        <Avatar name={name || "?"} size={42} color="#f97316" />
        <View style={{ flex: 1 }}>
          <Text style={{ color: "#fff", fontWeight: "700", fontSize: 16 }} numberOfLines={1}>{name}</Text>
          <Text style={{ color: colors.navyMuted, fontSize: 13 }} numberOfLines={1}>{account?.email}</Text>
        </View>
        <Ionicons name={switcher ? "chevron-down" : "chevron-forward"} size={18} color={colors.navyMuted} />
      </Pressable>

      {switcher ? (
        <View style={{ marginHorizontal: 12, marginTop: 6, borderRadius: 14, backgroundColor: colors.navySoft, overflow: "hidden" }}>
          {accounts.map((a) => (
            <Pressable key={a.email} onPress={() => { void switchAccount(a.email); setSwitcher(false); close(); router.navigate("/"); }} style={{ flexDirection: "row", alignItems: "center", gap: 10, padding: 12 }}>
              <Avatar name={a.email} size={30} />
              <Text style={{ flex: 1, color: "#fff" }} numberOfLines={1}>{a.email}</Text>
              {a.email === account?.email ? <Ionicons name="checkmark" size={18} color={colors.green} /> : null}
            </Pressable>
          ))}
          <Pressable onPress={() => go("/sign-in?adding=1")} style={{ flexDirection: "row", alignItems: "center", gap: 10, padding: 12 }}>
            <Ionicons name="add-circle-outline" size={22} color={colors.green} />
            <Text style={{ color: colors.green, fontWeight: "600" }}>Add another account</Text>
          </Pressable>
        </View>
      ) : null}

      <ScrollView style={{ flex: 1, marginTop: 10 }} contentContainerStyle={{ paddingBottom: 12 }}>
        {sorted.map((f: Folder) => {
          const nodes = [item(f.path, FOLDER_ICONS[f.role ?? ""] ?? "folder-outline", folderLabel(f), () => openFolder(f.path), folder === f.path && filter !== "flagged", f.role === "inbox" || f.role === "junk" || !f.role ? f.unread : undefined)];
          if (f.role === "inbox") nodes.push(item("__starred", "star-outline", "Starred", () => openFolder(f.path, "flagged"), folder === f.path && filter === "flagged", starred));
          return nodes;
        })}
        {!inbox ? item("INBOX", "mail-outline", "Inbox", () => openFolder("INBOX"), folder === "INBOX") : null}
        {item("__outbox", "cloud-upload-outline", "Outbox", () => go("/outbox"), false, waiting)}

        <Text style={{ color: colors.navyMuted, fontSize: 13, paddingHorizontal: 20, paddingTop: 18, paddingBottom: 6 }}>Tools</Text>
        {item("cal", "calendar-outline", "Calendar", () => go("/calendar"))}
        {item("tasks", "list-outline", "Tasks", () => go("/tasks"))}
        {item("notes", "document-outline", "Notes", () => go("/notes"))}
        {item("tpl", "copy-outline", "Templates", () => go("/templates"))}
        {item("camp", "megaphone-outline", "Campaigns", () => go("/campaigns"))}
        {item("filters", "funnel-outline", "Filters", () => go("/rules?kind=filter"))}
        {item("auto", "git-network-outline", "Automation", () => go("/rules?kind=automation"))}
        {item("settings", "settings-outline", "Settings", () => go("/settings"))}
      </ScrollView>

      <View style={{ padding: 16, paddingBottom: insets.bottom + 16, borderTopWidth: StyleSheet.hairlineWidth, borderColor: "rgba(255,255,255,0.12)" }}>
        <Text style={{ color: "#fff", fontWeight: "700", marginBottom: 8 }}>Storage</Text>
        <View style={{ height: 5, borderRadius: 3, backgroundColor: "rgba(255,255,255,0.15)", overflow: "hidden" }}>
          <View style={{ width: `${Math.max(2, pct * 100)}%`, height: 5, backgroundColor: pct > 0.9 ? colors.danger : colors.green }} />
        </View>
        <View style={{ flexDirection: "row", justifyContent: "space-between", marginTop: 6 }}>
          <Text style={{ color: colors.navyMuted, fontSize: 12 }}>{quota ? `${bytes(quota.used_bytes)} of ${bytes(quota.limit_bytes)} used` : "Usage not available"}</Text>
          {quota ? <Text style={{ color: colors.navyMuted, fontSize: 12 }}>{Math.round(pct * 100)}%</Text> : null}
        </View>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  item: { flexDirection: "row", alignItems: "center", gap: 14, paddingVertical: 11, paddingHorizontal: 18, marginHorizontal: 8, borderRadius: 10, borderLeftWidth: 3, borderLeftColor: "transparent" },
  itemText: { flex: 1, fontSize: 15.5 },
  count: { minWidth: 22, height: 20, borderRadius: 10, alignItems: "center", justifyContent: "center", paddingHorizontal: 6 },
});
