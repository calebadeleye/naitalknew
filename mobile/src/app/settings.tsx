import { Ionicons } from "@expo/vector-icons";
import Constants from "expo-constants";
import { useRouter } from "expo-router";
import { useEffect, useState, type ReactNode } from "react";
import { Alert, KeyboardAvoidingView, Modal, Pressable, ScrollView, Text, View } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { useToast } from "../components/toast";
import { Avatar, Button, Card, Divider, Field, Header, IconButton, Row, SectionTitle } from "../components/ui";
import { api, API_BASE_URL } from "../lib/config";
import { htmlToText } from "../lib/db";
import { escapeHtml } from "../lib/format";
import { pushSupported, pushToken, registerForPush } from "../lib/push";
import { useSession } from "../state/session";
import { useTheme, type ThemePreference } from "../state/theme";
import { openLink } from "../lib/links";

type Panel = null | "profile" | "signature" | "password" | "recovery" | "theme";

export default function Settings() {
  const { colors, preference } = useTheme();
  const router = useRouter();
  const toast = useToast();
  const { account, accounts, expired, me, switchAccount, signOut, refreshMe } = useSession();
  const [panel, setPanel] = useState<Panel>(null);
  const [push, setPush] = useState<"checking" | "on" | "off" | "unavailable">("checking");

  useEffect(() => {
    pushToken(false).then((t) => setPush(t ? "on" : pushSupported() ? "off" : "unavailable"));
  }, []);

  const confirmSignOut = (email: string) =>
    Alert.alert(`Sign out of ${email}?`, "Mail saved on this phone for it is removed, along with anything still waiting in its outbox.", [
      { text: "Cancel", style: "cancel" },
      {
        text: "Sign out",
        style: "destructive",
        onPress: async () => {
          await signOut(email);
          if (accounts.length <= 1) router.replace("/welcome");
        },
      },
    ]);

  const enablePush = async () => {
    if (!account) return;
    const ok = await registerForPush(api, account.token);
    setPush(ok ? "on" : "off");
    toast(ok ? "Notifications are on for this phone." : "Notifications are blocked. Allow them for Green Mail in your phone's settings.", ok ? "success" : "error");
  };

  const testPush = async () => {
    const token = await pushToken(false);
    if (!token || !account) return;
    try {
      toast((await api.testPush(account.token, token)).message);
    } catch (e) {
      toast(e instanceof Error ? e.message : "Could not send a test.", "error");
    }
  };

  const themeLabel: Record<ThemePreference, string> = { system: "Same as phone", light: "Light", dark: "Dark" };

  return (
    <SafeAreaView style={{ flex: 1, backgroundColor: colors.background }}>
      <Header title="Settings" left={<IconButton name="arrow-back" label="Back" onPress={() => router.back()} />} />
      <ScrollView contentContainerStyle={{ padding: 16, paddingBottom: 40 }}>
        <Card>
          <View style={{ flexDirection: "row", alignItems: "center", gap: 14, padding: 16 }}>
            <Avatar name={me?.display_name || account?.email || "?"} size={52} color="#f97316" />
            <View style={{ flex: 1 }}>
              <Text style={{ color: colors.text, fontWeight: "800", fontSize: 17 }}>{me?.display_name || account?.email.split("@")[0]}</Text>
              <Text style={{ color: colors.muted }}>{account?.email}</Text>
            </View>
          </View>
        </Card>

        <SectionTitle>Account Settings</SectionTitle>
        <Card>
          <Row icon="person-outline" title="Profile" subtitle={me?.display_name ? `Name shown to recipients: ${me.display_name}` : "Add the name recipients see"} onPress={() => setPanel("profile")} />
          <Divider />
          <Row icon="create-outline" title="Signature" subtitle={me?.signature_html ? htmlToText(me.signature_html).slice(0, 60) : "None"} onPress={() => setPanel("signature")} />
          <Divider />
          <Row icon="key-outline" title="Change password" onPress={() => setPanel("password")} />
          <Divider />
          <Row icon="shield-checkmark-outline" title="Recovery email" subtitle={me?.recovery_email ? `${me.recovery_email}${me.recovery_email_verified ? "" : " (not confirmed)"}` : "Not set — needed to reset a forgotten password"} onPress={() => setPanel("recovery")} />
        </Card>

        <SectionTitle>Email Accounts</SectionTitle>
        <Card>
          {accounts.map((a, i) => (
            <View key={a.email}>
              {i ? <Divider /> : null}
              <Row
                icon={expired.includes(a.email) ? "alert-circle" : a.email === account?.email ? "checkmark-circle" : "mail-outline"}
                iconColor={expired.includes(a.email) ? colors.danger : a.email === account?.email ? colors.green : undefined}
                title={a.email}
                subtitle={expired.includes(a.email) ? "Signed out — tap to sign in again" : a.email === account?.email ? "Open now" : "Tap to switch"}
                onPress={
                  expired.includes(a.email)
                    ? () => router.push({ pathname: "/sign-in", params: { email: a.email } })
                    : a.email === account?.email
                      ? undefined
                      : () => void switchAccount(a.email)
                }
                right={<IconButton name="log-out-outline" label={expired.includes(a.email) ? `Remove ${a.email} from this phone` : `Sign out of ${a.email}`} color={colors.danger} size={20} onPress={() => confirmSignOut(a.email)} />}
              />
            </View>
          ))}
          <Divider />
          <Row icon="add-circle-outline" iconColor={colors.green} title="Add another account" onPress={() => router.push("/sign-in?adding=1")} />
        </Card>

        <SectionTitle>Preferences</SectionTitle>
        <Card>
          <Row
            icon="notifications-outline"
            title="Notifications"
            subtitle={push === "on" ? "On for this phone" : push === "off" ? "Off — tap to turn on" : push === "unavailable" ? "Needs the store or development build of the app" : "Checking…"}
            onPress={push === "off" ? enablePush : undefined}
            right={push === "on" ? <Button small variant="ghost" title="Test" onPress={testPush} /> : undefined}
          />
          <Divider />
          <Row icon="contrast-outline" title="Theme" subtitle={themeLabel[preference]} onPress={() => setPanel("theme")} />
        </Card>

        <SectionTitle>About</SectionTitle>
        <Card>
          <Row icon="shield-outline" title="Privacy policy" onPress={() => openLink("https://www.naitalk.com/privacy-policy/green-mail")} />
          <Divider />
          <Row icon="trash-outline" title="Delete account and data" subtitle="Ask NAI TALK to delete this mailbox and its data" danger onPress={() => router.push("/delete-account")} />
          <Divider />
          <Row icon="help-circle-outline" title="Help and support" subtitle="Contact NAI TALK" onPress={() => openLink("https://www.naitalk.com/contact")} />
          <Divider />
          <Row icon="information-circle-outline" title={`Green Mail ${Constants.expoConfig?.version ?? ""}`} subtitle={API_BASE_URL.replace(/^https?:\/\//, "").replace(/\/api\/v1\/greenmail$/, "")} />
        </Card>

        <Button title={`Sign out of ${account?.email ?? ""}`} variant="danger" icon="log-out-outline" style={{ marginTop: 24 }} onPress={() => account && confirmSignOut(account.email)} />
      </ScrollView>

      <ProfileSheet visible={panel === "profile"} onClose={() => setPanel(null)} onSaved={refreshMe} />
      <SignatureSheet visible={panel === "signature"} onClose={() => setPanel(null)} onSaved={refreshMe} />
      <PasswordSheet visible={panel === "password"} onClose={() => setPanel(null)} />
      <RecoverySheet visible={panel === "recovery"} onClose={() => setPanel(null)} onSaved={refreshMe} />
      <ThemeSheet visible={panel === "theme"} onClose={() => setPanel(null)} />
    </SafeAreaView>
  );
}

function Sheet({ visible, title, onClose, children }: { visible: boolean; title: string; onClose: () => void; children: ReactNode }) {
  const { colors } = useTheme();
  return (
    <Modal visible={visible} animationType="slide" presentationStyle="pageSheet" onRequestClose={onClose}>
      <SafeAreaView style={{ flex: 1, backgroundColor: colors.card }}>
        <Header title={title} left={<IconButton name="close" label="Close" onPress={onClose} />} />
        <KeyboardAvoidingView behavior="padding" style={{ flex: 1 }}>
          <ScrollView contentContainerStyle={{ padding: 16, paddingBottom: 48, gap: 16 }} keyboardShouldPersistTaps="handled">
            {children}
          </ScrollView>
        </KeyboardAvoidingView>
      </SafeAreaView>
    </Modal>
  );
}

function useSaver(onDone: () => void) {
  const toast = useToast();
  const { handleError } = useSession();
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const run = async (work: () => Promise<{ message?: string } | unknown>, success: string) => {
    setBusy(true);
    setError(null);
    try {
      const result = (await work()) as { message?: string } | undefined;
      toast(result?.message ?? success);
      onDone();
    } catch (e) {
      setError(handleError(e));
    } finally {
      setBusy(false);
    }
  };
  return { busy, error, run };
}

function ProfileSheet({ visible, onClose, onSaved }: { visible: boolean; onClose: () => void; onSaved: () => void }) {
  const { account, me } = useSession();
  const [name, setName] = useState(me?.display_name ?? "");
  useEffect(() => setName(me?.display_name ?? ""), [me?.display_name, visible]);
  const { busy, error, run } = useSaver(() => { onSaved(); onClose(); });
  return (
    <Sheet visible={visible} title="Profile" onClose={onClose}>
      <Field label="Your name (shown to people you email)" value={name} onChangeText={setName} placeholder="e.g. Caleb Adeleye" error={error} />
      <Button title="Save" busy={busy} onPress={() => void run(() => api.updateSettings(account!.token, { display_name: name.trim() || null }), "Profile saved.")} />
    </Sheet>
  );
}

function SignatureSheet({ visible, onClose, onSaved }: { visible: boolean; onClose: () => void; onSaved: () => void }) {
  const { account, me } = useSession();
  const original = me?.signature_html ?? "";
  const [text, setText] = useState(htmlToText(original));
  const [changed, setChanged] = useState(false);
  useEffect(() => { setText(htmlToText(original)); setChanged(false); }, [original, visible]);
  const { busy, error, run } = useSaver(() => { onSaved(); onClose(); });
  const html = () => (!changed ? original : text.trim() ? text.trim().split("\n").map(escapeHtml).join("<br>") : null);
  return (
    <Sheet visible={visible} title="Signature" onClose={onClose}>
      <Field label="Added to the end of new emails" value={text} onChangeText={(v) => { setChanged(true); setText(v); }} multiline style={{ minHeight: 140, textAlignVertical: "top" }} placeholder={"Caleb Adeleye\nNAI TALK\n+234 …"} error={error} />
      <Button title="Save" busy={busy} onPress={() => void run(() => api.updateSettings(account!.token, { signature_html: html() }), "Signature saved.")} />
    </Sheet>
  );
}

function PasswordSheet({ visible, onClose }: { visible: boolean; onClose: () => void }) {
  const { account, rememberPassword } = useSession();
  const [current, setCurrent] = useState("");
  const [next, setNext] = useState("");
  const { busy, error, run } = useSaver(() => { setCurrent(""); setNext(""); onClose(); });
  return (
    <Sheet visible={visible} title="Change password" onClose={onClose}>
      <Field label="Current password" value={current} onChangeText={setCurrent} secure autoCapitalize="none" />
      <Field label="New password" value={next} onChangeText={setNext} secure autoCapitalize="none" placeholder="At least 8 characters" error={error} />
      <Button title="Change password" busy={busy} disabled={!current || next.length < 8} onPress={() => void run(async () => { const result = await api.changePassword(account!.token, current, next); await rememberPassword(account!.email, next); return result; }, "Password changed.")} />
    </Sheet>
  );
}

function RecoverySheet({ visible, onClose, onSaved }: { visible: boolean; onClose: () => void; onSaved: () => void }) {
  const { account, me } = useSession();
  const [email, setEmail] = useState(me?.recovery_email ?? "");
  const [code, setCode] = useState("");
  const [waiting, setWaiting] = useState(!!me?.recovery_email && !me?.recovery_email_verified);
  const save = useSaver(() => { setWaiting(!!email.trim()); onSaved(); });
  const confirm = useSaver(() => { setWaiting(false); onSaved(); onClose(); });
  return (
    <Sheet visible={visible} title="Recovery email" onClose={onClose}>
      <Field label="A personal address we can send a reset code to" value={email} onChangeText={setEmail} autoCapitalize="none" keyboardType="email-address" error={save.error} />
      <Button title="Save" busy={save.busy} onPress={() => void save.run(() => api.setRecoveryEmail(account!.token, email.trim() || null), "Saved.")} />
      {waiting ? (
        <>
          <Field label="6-digit code sent there" value={code} onChangeText={setCode} keyboardType="number-pad" error={confirm.error} />
          <Button title="Confirm" variant="outline" busy={confirm.busy} disabled={!code.trim()} onPress={() => void confirm.run(() => api.confirmRecoveryEmail(account!.token, code.trim()), "Confirmed.")} />
        </>
      ) : null}
    </Sheet>
  );
}

function ThemeSheet({ visible, onClose }: { visible: boolean; onClose: () => void }) {
  const { colors, preference, setPreference } = useTheme();
  const options: Array<[ThemePreference, string, "phone-portrait-outline" | "sunny-outline" | "moon-outline"]> = [
    ["system", "Same as phone", "phone-portrait-outline"],
    ["light", "Light", "sunny-outline"],
    ["dark", "Dark", "moon-outline"],
  ];
  return (
    <Sheet visible={visible} title="Theme" onClose={onClose}>
      <Card>
        {options.map(([value, label, icon], i) => (
          <View key={value}>
            {i ? <Divider /> : null}
            <Pressable onPress={() => { setPreference(value); onClose(); }} style={{ flexDirection: "row", alignItems: "center", gap: 14, padding: 16 }}>
              <Ionicons name={icon} size={20} color={colors.text} />
              <Text style={{ flex: 1, color: colors.text, fontSize: 16 }}>{label}</Text>
              {preference === value ? <Ionicons name="checkmark" size={20} color={colors.green} /> : null}
            </Pressable>
          </View>
        ))}
      </Card>
    </Sheet>
  );
}
