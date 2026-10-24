import { Ionicons } from "@expo/vector-icons";
import { memo } from "react";
import { Pressable, StyleSheet, Text, View } from "react-native";
import { displayName, shortDate } from "../lib/format";
import type { MessageSummary } from "../lib/types";
import { useTheme } from "../state/theme";
import { Avatar } from "./ui";

type Props = { message: MessageSummary; showRecipient?: boolean; onPress: (m: MessageSummary) => void; onStar: (m: MessageSummary) => void; onLongPress?: (m: MessageSummary) => void };

export const MessageRow = memo(function MessageRow({ message, showRecipient, onPress, onStar, onLongPress }: Props) {
  const { colors } = useTheme();
  const who = showRecipient ? (message.to.map(displayName).join(", ") || "(no recipient)") : displayName(message.from) || "(unknown sender)";
  const unread = !message.seen;
  return (
    <Pressable
      onPress={() => onPress(message)}
      onLongPress={() => onLongPress?.(message)}
      accessibilityRole="button"
      accessibilityLabel={`${unread ? "Unread. " : ""}${who}. ${message.subject}`}
      style={({ pressed }) => ({ flexDirection: "row", gap: 12, paddingHorizontal: 16, paddingVertical: 14, backgroundColor: pressed ? colors.input : colors.card, borderBottomWidth: StyleSheet.hairlineWidth, borderColor: colors.border })}
    >
      <Avatar name={who} />
      <View style={{ flex: 1, gap: 2 }}>
        <View style={{ flexDirection: "row", alignItems: "center", gap: 6 }}>
          {unread ? <View style={{ width: 8, height: 8, borderRadius: 4, backgroundColor: colors.unreadDot }} /> : null}
          <Text numberOfLines={1} style={{ flex: 1, fontSize: 16, fontWeight: unread ? "800" : "600", color: colors.text }}>
            {who}
          </Text>
          <Text style={{ fontSize: 12, color: unread ? colors.greenDark : colors.muted, fontWeight: unread ? "700" : "400" }}>{shortDate(message.date)}</Text>
        </View>
        <View style={{ flexDirection: "row", alignItems: "center", gap: 6 }}>
          <Text numberOfLines={1} style={{ flex: 1, fontSize: 14.5, color: colors.text, fontWeight: unread ? "700" : "400" }}>
            {message.subject || "(no subject)"}
          </Text>
          {message.has_attachments ? <Ionicons name="attach" size={16} color={colors.muted} /> : null}
        </View>
        <View style={{ flexDirection: "row", alignItems: "flex-start", gap: 6 }}>
          <Text numberOfLines={1} style={{ flex: 1, fontSize: 13.5, color: colors.muted }}>
            {message.snippet}
          </Text>
          <Pressable hitSlop={10} onPress={() => onStar(message)} accessibilityRole="button" accessibilityLabel={message.flagged ? "Remove star" : "Star"}>
            <Ionicons name={message.flagged ? "star" : "star-outline"} size={19} color={message.flagged ? colors.warning : colors.subtle} />
          </Pressable>
        </View>
      </View>
    </Pressable>
  );
});
