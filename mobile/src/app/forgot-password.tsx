import { useLocalSearchParams, useRouter } from "expo-router";
import { useState } from "react";
import { KeyboardAvoidingView, ScrollView, Text } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { Button, Field, Header, IconButton } from "../components/ui";
import { useToast } from "../components/toast";
import { api } from "../lib/config";
import { isEmail } from "../lib/format";
import { useTheme } from "../state/theme";

/** Forgot password: a 6-digit code goes to the recovery email, then a new password. */
export default function ForgotPassword() {
  const params = useLocalSearchParams<{ email?: string }>();
  const router = useRouter();
  const toast = useToast();
  const { colors } = useTheme();
  const [email, setEmail] = useState(params.email && isEmail(params.email) ? params.email : "");
  const [stage, setStage] = useState<"ask" | "reset">("ask");
  const [info, setInfo] = useState<string | null>(null);
  const [code, setCode] = useState("");
  const [password, setPassword] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const ask = async () => {
    if (!isEmail(email.trim())) return setError("Enter your full email address.");
    setBusy(true);
    setError(null);
    try {
      setInfo((await api.forgotPassword(email.trim())).message);
      setStage("reset");
    } catch (e) {
      setError(e instanceof Error ? e.message : "Please try again.");
    } finally {
      setBusy(false);
    }
  };

  const reset = async () => {
    if (password.length < 8) return setError("The new password needs at least 8 characters.");
    setBusy(true);
    setError(null);
    try {
      toast((await api.resetPassword(email.trim(), code.trim(), password)).message);
      router.replace({ pathname: "/sign-in", params: { email: email.trim() } });
    } catch (e) {
      setError(e instanceof Error ? e.message : "Please try again.");
    } finally {
      setBusy(false);
    }
  };

  return (
    <SafeAreaView style={{ flex: 1, backgroundColor: colors.card }}>
      <Header title="Reset password" left={<IconButton name="arrow-back" label="Back" onPress={() => router.back()} />} />
      <KeyboardAvoidingView behavior="padding" style={{ flex: 1 }}>
        <ScrollView contentContainerStyle={{ padding: 24, gap: 18 }} keyboardShouldPersistTaps="handled">
          {stage === "ask" ? (
            <>
              <Text style={{ color: colors.muted, fontSize: 15, lineHeight: 21 }}>We'll send a 6-digit code to the recovery email set for this mailbox.</Text>
              <Field label="Email address" value={email} onChangeText={setEmail} autoCapitalize="none" keyboardType="email-address" placeholder="you@yourcompany.com" error={error} />
              <Button title="Send code" onPress={ask} busy={busy} />
            </>
          ) : (
            <>
              <Text style={{ color: colors.muted, fontSize: 15, lineHeight: 21 }}>{info}</Text>
              <Field label="6-digit code" value={code} onChangeText={setCode} keyboardType="number-pad" maxLength={10} autoComplete="one-time-code" />
              <Field label="New password" value={password} onChangeText={setPassword} secure autoCapitalize="none" placeholder="At least 8 characters" error={error} />
              <Button title="Change password" onPress={reset} busy={busy} />
              <Button title="Send a new code" variant="ghost" onPress={() => setStage("ask")} />
            </>
          )}
        </ScrollView>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}
