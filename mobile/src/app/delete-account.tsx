import { useRouter } from "expo-router";
import * as WebBrowser from "expo-web-browser";
import { useState } from "react";
import { Alert, KeyboardAvoidingView, ScrollView, Text, View } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { Button, Field, Header, IconButton } from "../components/ui";
import { api } from "../lib/config";
import { useSession } from "../state/session";
import { useTheme } from "../state/theme";

/** Delete account and data: asks NAI TALK to delete the mailbox and its Green Mail data. Needs the password again. */
export default function DeleteAccount() {
  const { colors } = useTheme();
  const router = useRouter();
  const { account, signOut, handleError } = useSession();
  const [password, setPassword] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [done, setDone] = useState<string | null>(null);

  const send = async () => {
    if (!account) return;
    setBusy(true);
    setError(null);
    try {
      setDone((await api.requestAccountDeletion(account.token, password)).message);
    } catch (e) {
      setError(handleError(e, "Could not send the request."));
    } finally {
      setBusy(false);
    }
  };

  const confirm = () =>
    Alert.alert("Request deletion?", `NAI TALK will delete ${account?.email} and its Green Mail data. This cannot be undone once it is done.`, [
      { text: "Cancel", style: "cancel" },
      { text: "Request deletion", style: "destructive", onPress: () => void send() },
    ]);

  const body = { color: colors.muted, fontSize: 15, lineHeight: 22 } as const;

  return (
    <SafeAreaView style={{ flex: 1, backgroundColor: colors.card }}>
      <Header title="Delete account and data" left={<IconButton name="arrow-back" label="Back" onPress={() => router.back()} />} />
      <KeyboardAvoidingView behavior="padding" style={{ flex: 1 }}>
        <ScrollView contentContainerStyle={{ padding: 20, paddingBottom: 48, gap: 16 }} keyboardShouldPersistTaps="handled">
          {done ? (
            <>
              <Text style={{ color: colors.text, fontSize: 18, fontWeight: "800" }}>Request sent</Text>
              <Text style={body}>{done}</Text>
              <Text style={body}>You can sign out of this phone now. Until we have deleted the mailbox it still works.</Text>
              <Button
                title="Sign out on this phone"
                variant="danger"
                onPress={async () => {
                  await signOut(account?.email);
                  router.replace("/");
                }}
              />
              <Button title="Back to settings" variant="outline" onPress={() => router.back()} />
            </>
          ) : (
            <>
              <Text style={body}>
                This asks NAI TALK to delete <Text style={{ fontWeight: "700", color: colors.text }}>{account?.email}</Text> and the data Green Mail keeps for it: your email, calendar events, tasks, notes, templates, contacts, filters, scheduled emails and notification settings.
              </Text>
              <Text style={body}>We confirm by email once it is done. If you only want to remove some things, delete them in the app, for example a note, task or event, and sign out to remove this phone's saved copy.</Text>
              <View style={{ gap: 6 }}>
                <Field label="Enter your password to confirm" value={password} onChangeText={setPassword} secure autoCapitalize="none" error={error} />
              </View>
              <Button title="Request deletion" variant="danger" busy={busy} disabled={!password} onPress={confirm} />
              <Button title="More about your data" variant="ghost" onPress={() => void WebBrowser.openBrowserAsync("https://www.naitalk.com/privacy-policy/green-mail/delete-account")} />
            </>
          )}
        </ScrollView>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}
