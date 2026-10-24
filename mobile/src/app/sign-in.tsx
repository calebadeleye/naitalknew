import { Ionicons } from "@expo/vector-icons";
import { useLocalSearchParams, useRouter } from "expo-router";
import { useRef, useState, type ElementRef } from "react";
import { KeyboardAvoidingView, Pressable, ScrollView, Text, View } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { Brand, Button, Field, IconButton } from "../components/ui";
import { ApiError } from "../lib/api";
import { isEmail } from "../lib/format";
import { useSession } from "../state/session";
import { useTheme } from "../state/theme";

/** Mailbox sign-in: the full email address and its password. */
export default function SignIn() {
  const params = useLocalSearchParams<{ email?: string; adding?: string }>();
  const router = useRouter();
  const { colors } = useTheme();
  const { signIn, accounts } = useSession();
  const [email, setEmail] = useState(params.email ?? "");
  const [password, setPassword] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const scroll = useRef<ElementRef<typeof ScrollView>>(null);
  const address = () => email.trim().toLowerCase();

  const submit = async () => {
    const full = address();
    if (!isEmail(full)) return setError("Enter your full email address (for example you@yourcompany.com).");
    if (!password) return setError("Enter your password.");
    setBusy(true);
    setError(null);
    try {
      await signIn(full, password);
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
      <KeyboardAvoidingView behavior="padding" style={{ flex: 1 }}>
        <View style={{ flexDirection: "row", paddingHorizontal: 8 }}>
          <IconButton name="arrow-back" label="Back" onPress={() => (router.canGoBack() ? router.back() : router.replace(accounts.length ? "/" : "/welcome"))} />
        </View>
        <ScrollView ref={scroll} contentContainerStyle={{ padding: 24, paddingBottom: 48, gap: 18 }} keyboardShouldPersistTaps="handled">
          <View style={{ alignItems: "center", marginBottom: 8 }}>
            <Brand size={30} />
          </View>
          <View style={{ gap: 6 }}>
            <Text style={{ fontSize: 26, fontWeight: "800", color: colors.text }}>{params.adding ? "Add an account" : "Sign in"}</Text>
            <Text style={{ color: colors.muted, fontSize: 15 }}>Use your business email address and its password.</Text>
          </View>
          <Field label="Email address" value={email} onChangeText={setEmail} placeholder="you@yourcompany.com" autoCapitalize="none" autoComplete="email" keyboardType="email-address" textContentType="username" autoCorrect={false} />
          <Field label="Password" value={password} onChangeText={setPassword} placeholder="Password" secure autoCapitalize="none" autoComplete="password" textContentType="password" onSubmitEditing={submit} returnKeyType="go" onFocus={() => setTimeout(() => scroll.current?.scrollToEnd({ animated: true }), 250)} />
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
