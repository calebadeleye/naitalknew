import { Ionicons } from "@expo/vector-icons";
import { Image } from "expo-image";
import { useState, type ComponentProps, type ReactNode } from "react";
import { ActivityIndicator, Pressable, StyleSheet, Text, TextInput, View, type StyleProp, type TextInputProps, type TextStyle, type ViewStyle } from "react-native";
import { avatarColor, initials } from "../lib/format";
import { useTheme } from "../state/theme";

export type IconName = ComponentProps<typeof Ionicons>["name"];

/** The Green Mail wordmark: app icon + the name in Pacifico (as on the web). */
export function Brand({ size = 26, onDark = false, icon = true }: { size?: number; onDark?: boolean; icon?: boolean }) {
  const { colors } = useTheme();
  return (
    <View style={{ flexDirection: "row", alignItems: "center", gap: 8 }} accessibilityLabel="Green Mail">
      {icon && <Image source={require("../../assets/logo.png")} style={{ width: size * 1.25, height: size * 1.25, borderRadius: size * 0.3 }} />}
      <Text style={{ fontFamily: "Pacifico_400Regular", fontSize: size, color: onDark ? colors.white : colors.greenDark, includeFontPadding: false, lineHeight: size * 1.55 }}>
        Green Mail
      </Text>
    </View>
  );
}

export function Avatar({ name, size = 44, color }: { name: string; size?: number; color?: string }) {
  return (
    <View style={{ width: size, height: size, borderRadius: size / 2, backgroundColor: color ?? avatarColor(name), alignItems: "center", justifyContent: "center" }}>
      <Text style={{ color: "#fff", fontWeight: "700", fontSize: size * 0.36 }}>{initials(name)}</Text>
    </View>
  );
}

type ButtonProps = {
  title: string;
  onPress?: () => void;
  variant?: "primary" | "outline" | "ghost" | "danger" | "outlineLight";
  icon?: IconName;
  iconRight?: IconName;
  busy?: boolean;
  disabled?: boolean;
  style?: StyleProp<ViewStyle>;
  small?: boolean;
};

export function Button({ title, onPress, variant = "primary", icon, iconRight, busy, disabled, style, small }: ButtonProps) {
  const { colors } = useTheme();
  const bg = variant === "primary" ? colors.green : variant === "danger" ? colors.danger : "transparent";
  const fg = variant === "primary" || variant === "danger" || variant === "outlineLight" ? colors.white : variant === "ghost" ? colors.greenDark : colors.text;
  const border = variant === "outline" ? colors.border : variant === "outlineLight" ? "rgba(255,255,255,0.85)" : "transparent";
  return (
    <Pressable
      accessibilityRole="button"
      onPress={onPress}
      disabled={disabled || busy}
      style={({ pressed }) => [
        { backgroundColor: bg, borderColor: border, borderWidth: 1.5, borderRadius: 999, paddingVertical: small ? 9 : 14, paddingHorizontal: small ? 16 : 22, flexDirection: "row", alignItems: "center", justifyContent: "center", gap: 8, opacity: disabled ? 0.5 : pressed ? 0.85 : 1 },
        style,
      ]}
    >
      {busy ? <ActivityIndicator color={fg} /> : icon ? <Ionicons name={icon} size={small ? 16 : 18} color={fg} /> : null}
      <Text style={{ color: fg, fontWeight: "700", fontSize: small ? 14 : 16 }}>{title}</Text>
      {iconRight && !busy ? <Ionicons name={iconRight} size={18} color={fg} /> : null}
    </Pressable>
  );
}

export function IconButton({ name, onPress, color, size = 22, label, style, badge }: { name: IconName; onPress?: () => void; color?: string; size?: number; label: string; style?: StyleProp<ViewStyle>; badge?: number }) {
  const { colors } = useTheme();
  return (
    <Pressable accessibilityRole="button" accessibilityLabel={label} hitSlop={8} onPress={onPress} style={({ pressed }) => [{ padding: 8, borderRadius: 999, opacity: pressed ? 0.6 : 1 }, style]}>
      <Ionicons name={name} size={size} color={color ?? colors.text} />
      {badge ? (
        <View style={{ position: "absolute", top: 2, right: 2, minWidth: 16, height: 16, borderRadius: 8, backgroundColor: colors.danger, alignItems: "center", justifyContent: "center", paddingHorizontal: 3 }}>
          <Text style={{ color: "#fff", fontSize: 10, fontWeight: "700" }}>{badge}</Text>
        </View>
      ) : null}
    </Pressable>
  );
}

export function Field({ label, error, secure, style, ...props }: TextInputProps & { label?: string; error?: string | null; secure?: boolean }) {
  const { colors } = useTheme();
  const [hidden, setHidden] = useState(true);
  return (
    <View style={{ gap: 6 }}>
      {label ? <Text style={{ color: colors.muted, fontWeight: "600", fontSize: 13 }}>{label}</Text> : null}
      <View style={{ flexDirection: "row", alignItems: "center", backgroundColor: colors.input, borderRadius: 14, borderWidth: 1, borderColor: error ? colors.danger : colors.border }}>
        <TextInput
          placeholderTextColor={colors.subtle}
          secureTextEntry={secure && hidden}
          style={[{ flex: 1, paddingHorizontal: 14, paddingVertical: 13, fontSize: 16, color: colors.text }, style as StyleProp<TextStyle>]}
          {...props}
        />
        {secure ? (
          <IconButton name={hidden ? "eye-outline" : "eye-off-outline"} label={hidden ? "Show password" : "Hide password"} color={colors.muted} onPress={() => setHidden((h) => !h)} style={{ marginRight: 4 }} />
        ) : null}
      </View>
      {error ? <Text style={{ color: colors.danger, fontSize: 13 }}>{error}</Text> : null}
    </View>
  );
}

export function Header({ title, left, right, children }: { title?: ReactNode; left?: ReactNode; right?: ReactNode; children?: ReactNode }) {
  const { colors } = useTheme();
  return (
    <View style={{ backgroundColor: colors.card }}>
      <View style={{ flexDirection: "row", alignItems: "center", paddingHorizontal: 8, minHeight: 56, gap: 4 }}>
        {left}
        <View style={{ flex: 1, paddingHorizontal: 4 }}>{typeof title === "string" ? <Text style={{ fontSize: 20, fontWeight: "800", color: colors.text }}>{title}</Text> : title}</View>
        {right}
      </View>
      {children}
    </View>
  );
}

export function Tabs<T extends string>({ value, options, onChange }: { value: T; options: Array<{ value: T; label: string }>; onChange: (v: T) => void }) {
  const { colors } = useTheme();
  return (
    <View style={{ flexDirection: "row", borderBottomWidth: StyleSheet.hairlineWidth, borderColor: colors.border, paddingHorizontal: 8 }}>
      {options.map((o) => {
        const active = o.value === value;
        return (
          <Pressable key={o.value} onPress={() => onChange(o.value)} accessibilityRole="tab" accessibilityState={{ selected: active }} style={{ paddingVertical: 12, paddingHorizontal: 12, borderBottomWidth: 2.5, borderColor: active ? colors.green : "transparent", flexGrow: options.length <= 2 ? 1 : 0, alignItems: "center" }}>
            <Text style={{ color: active ? colors.greenDark : colors.muted, fontWeight: active ? "700" : "500", fontSize: 14 }}>{o.label}</Text>
          </Pressable>
        );
      })}
    </View>
  );
}

export function Empty({ icon, title, text, action }: { icon: IconName; title: string; text?: string; action?: ReactNode }) {
  const { colors } = useTheme();
  return (
    <View style={{ alignItems: "center", padding: 40, gap: 10 }}>
      <View style={{ width: 72, height: 72, borderRadius: 36, backgroundColor: colors.greenSoft, alignItems: "center", justifyContent: "center" }}>
        <Ionicons name={icon} size={34} color={colors.green} />
      </View>
      <Text style={{ fontSize: 17, fontWeight: "700", color: colors.text, textAlign: "center" }}>{title}</Text>
      {text ? <Text style={{ color: colors.muted, textAlign: "center", lineHeight: 20 }}>{text}</Text> : null}
      {action}
    </View>
  );
}

export function Card({ children, style }: { children: ReactNode; style?: StyleProp<ViewStyle> }) {
  const { colors } = useTheme();
  return <View style={[{ backgroundColor: colors.card, borderRadius: 16, borderWidth: StyleSheet.hairlineWidth, borderColor: colors.border, overflow: "hidden" }, style]}>{children}</View>;
}

export function Row({ icon, iconColor, title, subtitle, onPress, right, danger }: { icon?: IconName; iconColor?: string; title: string; subtitle?: string | null; onPress?: () => void; right?: ReactNode; danger?: boolean }) {
  const { colors } = useTheme();
  return (
    <Pressable onPress={onPress} disabled={!onPress} style={({ pressed }) => ({ flexDirection: "row", alignItems: "center", gap: 14, paddingHorizontal: 16, paddingVertical: 14, backgroundColor: pressed ? colors.input : "transparent" })}>
      {icon ? <Ionicons name={icon} size={21} color={danger ? colors.danger : (iconColor ?? colors.text)} /> : null}
      <View style={{ flex: 1 }}>
        <Text style={{ color: danger ? colors.danger : colors.text, fontSize: 16, fontWeight: "500" }}>{title}</Text>
        {subtitle ? <Text style={{ color: colors.muted, fontSize: 13, marginTop: 2 }} numberOfLines={2}>{subtitle}</Text> : null}
      </View>
      {right ?? (onPress ? <Ionicons name="chevron-forward" size={18} color={colors.subtle} /> : null)}
    </Pressable>
  );
}

export function SectionTitle({ children }: { children: ReactNode }) {
  const { colors } = useTheme();
  return <Text style={{ color: colors.muted, fontWeight: "700", fontSize: 13, paddingHorizontal: 16, paddingTop: 20, paddingBottom: 8 }}>{children}</Text>;
}

export function Divider() {
  const { colors } = useTheme();
  return <View style={{ height: StyleSheet.hairlineWidth, backgroundColor: colors.border, marginLeft: 16 }} />;
}

export function Loading() {
  const { colors } = useTheme();
  return (
    <View style={{ padding: 40, alignItems: "center" }}>
      <ActivityIndicator color={colors.green} />
    </View>
  );
}

/** Green round "+" / action button used in headers (compose, add task…). */
export function SquareAction({ icon, onPress, label }: { icon: IconName; onPress: () => void; label: string }) {
  const { colors } = useTheme();
  return (
    <Pressable accessibilityRole="button" accessibilityLabel={label} onPress={onPress} style={({ pressed }) => ({ width: 44, height: 44, borderRadius: 12, backgroundColor: colors.green, alignItems: "center", justifyContent: "center", opacity: pressed ? 0.85 : 1, marginRight: 8 })}>
      <Ionicons name={icon} size={22} color="#fff" />
    </Pressable>
  );
}
