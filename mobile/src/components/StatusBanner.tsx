import { Ionicons } from "@expo/vector-icons";
import { useRouter } from "expo-router";
import { Pressable, Text } from "react-native";
import { useSession } from "../state/session";
import { useTheme } from "../state/theme";

/** Offline / waiting-to-send / failed / signed-out notice above the mail list. */
export function StatusBanner() {
  const { online, outbox, account, expired } = useSession();
  const { colors } = useTheme();
  const router = useRouter();
  const mine = outbox.filter((i) => i.account === account?.email);
  const failed = mine.filter((i) => i.status === "failed").length;
  const pending = mine.length - failed;
  const signedOut = account && expired.includes(account.email);

  let icon: "cloud-offline-outline" | "time-outline" | "alert-circle-outline" | "log-in-outline";
  let text: string;
  let onPress = () => router.push("/outbox");
  if (signedOut) {
    icon = "log-in-outline";
    text = `${account.email} was signed out. Tap to sign in again.`;
    onPress = () => router.push({ pathname: "/sign-in", params: { email: account.email } });
  } else if (failed) {
    icon = "alert-circle-outline";
    text = `${failed} item${failed === 1 ? "" : "s"} could not be sent. Tap to review.`;
  } else if (!online) {
    icon = "cloud-offline-outline";
    text = pending ? `Offline — ${pending} waiting in the outbox` : "Offline — showing mail saved on this phone";
  } else if (pending) {
    icon = "time-outline";
    text = `Sending ${pending} item${pending === 1 ? "" : "s"}…`;
  } else {
    return null;
  }
  const bad = failed || signedOut;
  return (
    <Pressable onPress={onPress} accessibilityRole="button" style={{ flexDirection: "row", alignItems: "center", gap: 8, paddingHorizontal: 16, paddingVertical: 10, backgroundColor: bad ? "#fee2e2" : colors.banner }}>
      <Ionicons name={icon} size={18} color={bad ? "#b91c1c" : colors.bannerText} />
      <Text style={{ flex: 1, color: bad ? "#b91c1c" : colors.bannerText, fontWeight: "600", fontSize: 13 }}>{text}</Text>
      <Ionicons name="chevron-forward" size={16} color={bad ? "#b91c1c" : colors.bannerText} />
    </Pressable>
  );
}
