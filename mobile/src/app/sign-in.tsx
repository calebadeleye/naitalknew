import { Ionicons } from "@expo/vector-icons";
import { useLocalSearchParams, useRouter } from "expo-router";
import { useEffect, useState } from "react";
import { KeyboardAvoidingView, Platform, Pressable, ScrollView, Text, View } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { Brand, Button, Field, IconButton } from "../components/ui";
import { kvGet, kvSet } from "../lib/db";
import { ApiError } from "../lib/api";
import { isEmail } from "../lib/format";
import { useSession } from "../state/session";
import { useTheme } from "../state/theme";

/** Mailbox sign-in. An optional domain fills in the part after "@" (like yourdomain.com/greenmail on the web). */
export default function SignIn() {
  const params = useLocalSearchParams<{ email?: string; adding?: string }>();
  const router = useRouter();
  const { colors } = useTheme();
  const { signIn, accounts } = useSession();
  const [email, setEmail] = useState(params.email ?? "");
  const [domain, setDomain] = useState("");
  const [showDomain, setShowDomain] = useState(false);
  const [password, setPassword] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    kvGet<string>("last_domain").then((d) => d && setDomain(d)).catch(() => {});
  }, []);

  const address = () => {
    const value = email.trim().toLowerCase();
    if (value.includes("@") || !domain.trim()) return value;
    return `${value}@${domain.trim().replace(/^@/, "").toLowerCase()}`;
  };

  const submit = async () => {
    const full = address();
    if (!isEmail(full)) return setError("Enter your full email address (for example you@yourcompany.com).");
    if (!password) return setError("Enter your password.");
    setBusy(true);
    setError(null);
    try {
      await signIn(full, password);
      await kvSet("last_domain", full.split("@")[1]).catch(() => {});
      router.dismissAll?.();
      router.replace("/");
    } catch (e) {
      setError(e instanceof ApiError && e.status === 422 ? "Wrong email address or password." : e instanceof Error ? e.message : "Could not sign in.");
    } finally {
      setBusy(false);
    }
  };

  return (
    <SafeAreaView style={{ flex: 1, backgroundColor: colors.card }}>
      <KeyboardAvoidingView behavior={Platform.OS === "ios" ? "padding" : undefined} style={{ flex: 1 }}>
        <View style={{ flexDirection: "row", paddingHorizontal: 8 }}>
          <IconButton name="arrow-back" label="Back" onPress={() => (router.canGoBack() ? router.back() : router.replace(accounts.length ? "/" : "/welcome"))} />
        </View>
        <ScrollView contentContainerStyle={{ padding: 24, gap: 18 }} keyboardShouldPersistTaps="handled">
          <View style={{ alignItems: "center", marginBottom: 8 }}>
            <Brand size={30} />
          </View>
          <View style={{ gap: 6 }}>
            <Text style={{ fontSize: 26, fontWeight: "800", color: colors.text }}>{params.adding ? "Add an account" : "Sign in"}</Text>
            <Text style={{ color: colors.muted, fontSize: 15 }}>Use your business email address and its password.</Text>
          </View>
          <Field label="Email address" value={email} onChangeText={setEmail} placeholder="you@yourcompany.com" autoCapitalize="none" autoComplete="email" keyboardType="email-address" textContentType="username" autoCorrect={false} />
          {showDomain || (domain && !email.includes("@")) ? (
            <Field label="Domain (optional)" value={domain} onChangeText={setDomain} placeholder="yourcompany.com" autoCapitalize="none" autoCorrect={false} keyboardType="url" />
          ) : (
            <Pressable onPress={() => setShowDomain(true)}>
              <Text style={{ color: colors.greenDark, fontWeight: "600" }}>Sign in with a domain</Text>
            </Pressable>
          )}
          <Field label="Password" value={password} onChangeText={setPassword} placeholder="Password" secure autoCapitalize="none" autoComplete="password" textContentType="password" onSubmitEditing={submit} returnKeyType="go" />
          {error ? (
            <View style={{ flexDirection: "row", gap: 8, backgroundColor: "#fee2e2", padding: 12, borderRadius: 12 }}>
              <Ionicons name="alert-circle" size={18} color="#b91c1c" />
              <Text style={{ color: "#b91c1c", flex: 1 }}>{error}</Text>
            </View>
          ) : null}
          <Button title="Sign In" onPress={submit} busy={busy} />
          <Pressable onPress={() => router.push({ pathname: "/forgot-password", params: { email: address() } })} style={{ alignSelf: "center", padding: 8 }}>
            <Text style={{ color: colors.greenDark, fontWeight: "600" }}>Forgot password?</Text>
          </Pressable>
        </ScrollView>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}
