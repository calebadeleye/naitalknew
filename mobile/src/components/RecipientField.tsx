import { Ionicons } from "@expo/vector-icons";
import { useRef, type ElementRef } from "react";
import { Pressable, Text, TextInput, View } from "react-native";
import { avatarColor, initials, isEmail, splitAddresses } from "../lib/format";
import { useTheme } from "../state/theme";

/**
 * To / Cc / Bcc: each address becomes a chip (avatar, address, ✕) as soon as a
 * comma, space or Enter is typed, or the field loses focus. Tapping anywhere
 * in the row puts the cursor in the field; Backspace on an empty field removes
 * the last chip. An address that isn't valid shows in red.
 *
 * `addresses` are the finished chips, `text` is what is still being typed;
 * the parent keeps both so it can include unfinished text when sending.
 */
type Props = {
  label: string;
  addresses: string[];
  text: string;
  onChange: (addresses: string[], text: string) => void;
  placeholder?: string;
  right?: React.ReactNode;
  autoFocus?: boolean;
};

/** The addresses in a field including text not yet turned into a chip. */
export function allAddresses(addresses: string[], text: string): string[] {
  return [...addresses, ...splitAddresses(text)].filter((a, i, list) => list.indexOf(a) === i);
}

export function RecipientField({ label, addresses, text, onChange, placeholder, right, autoFocus }: Props) {
  const { colors } = useTheme();
  const input = useRef<ElementRef<typeof TextInput>>(null);

  const commit = (value: string, rest = "") => {
    const found = splitAddresses(value);
    if (found.length === 0) return onChange(addresses, rest);
    onChange([...addresses, ...found.filter((a) => !addresses.includes(a))], rest);
  };

  const onText = (value: string) => {
    // A separator ends an address; whatever follows the last separator keeps being typed.
    const cut = Math.max(value.lastIndexOf(","), value.lastIndexOf(";"), value.lastIndexOf(" "), value.lastIndexOf("\n"));
    if (cut === -1) return onChange(addresses, value);
    commit(value.slice(0, cut), value.slice(cut + 1).trim());
  };

  return (
    <View style={{ flexDirection: "row", alignItems: "flex-start", paddingLeft: 16, borderBottomWidth: 1, borderColor: colors.border }}>
      <Text style={{ color: colors.muted, fontSize: 15, width: 48, paddingTop: 15 }}>{label}</Text>
      {/* The whole area is the tap target, not just the thin text box. */}
      <Pressable onPress={() => input.current?.focus()} style={{ flex: 1, flexDirection: "row", flexWrap: "wrap", alignItems: "center", gap: 6, paddingVertical: 8, minHeight: 52 }}>
        {addresses.map((address) => {
          const bad = !isEmail(address);
          return (
            <View
              key={address}
              style={{
                flexDirection: "row",
                alignItems: "center",
                maxWidth: "100%",
                gap: 6,
                paddingVertical: 4,
                paddingLeft: 4,
                paddingRight: 4,
                borderRadius: 999,
                borderWidth: 1,
                borderColor: bad ? colors.danger : colors.green,
                backgroundColor: bad ? "#fee2e2" : colors.greenSoft,
              }}
            >
              <View style={{ width: 24, height: 24, borderRadius: 12, backgroundColor: bad ? colors.danger : avatarColor(address), alignItems: "center", justifyContent: "center" }}>
                {bad ? <Ionicons name="alert" size={14} color="#fff" /> : <Text style={{ color: "#fff", fontSize: 10, fontWeight: "700" }}>{initials(address)}</Text>}
              </View>
              <Text numberOfLines={1} style={{ flexShrink: 1, color: bad ? "#b91c1c" : colors.text, fontSize: 14, fontWeight: "500" }}>
                {address}
              </Text>
              <Pressable
                hitSlop={8}
                accessibilityRole="button"
                accessibilityLabel={`Remove ${address}`}
                onPress={() => onChange(addresses.filter((a) => a !== address), text)}
                style={{ width: 22, height: 22, borderRadius: 11, alignItems: "center", justifyContent: "center", backgroundColor: bad ? "#fecaca" : "rgba(34,160,79,0.18)" }}
              >
                <Ionicons name="close" size={14} color={bad ? "#b91c1c" : colors.greenDark} />
              </Pressable>
            </View>
          );
        })}
        <TextInput
          ref={input}
          value={text}
          onChangeText={onText}
          onSubmitEditing={() => commit(text)}
          onBlur={() => commit(text)}
          onKeyPress={(e) => {
            if (e.nativeEvent.key === "Backspace" && text === "" && addresses.length > 0) onChange(addresses.slice(0, -1), "");
          }}
          blurOnSubmit={false}
          autoFocus={autoFocus}
          autoCapitalize="none"
          autoCorrect={false}
          keyboardType="email-address"
          placeholder={addresses.length ? undefined : placeholder}
          placeholderTextColor={colors.subtle}
          accessibilityLabel={label}
          style={{ flexGrow: 1, minWidth: 120, fontSize: 15.5, color: colors.text, paddingVertical: 6, paddingHorizontal: 4 }}
        />
      </Pressable>
      {right}
    </View>
  );
}
