import { Pacifico_400Regular, useFonts } from "@expo-google-fonts/pacifico";
import { Stack, useRouter } from "expo-router";
import * as SplashScreen from "expo-splash-screen";
import { StatusBar } from "expo-status-bar";
import { useEffect } from "react";
import { SafeAreaProvider } from "react-native-safe-area-context";
import { DrawerProvider } from "../components/Drawer";
import { ToastProvider } from "../components/toast";
import { useNotificationTaps, type MailNotificationData } from "../lib/push";
import { SessionProvider, useSession } from "../state/session";
import { ThemeProvider, useTheme } from "../state/theme";

SplashScreen.preventAutoHideAsync().catch(() => {});

export default function RootLayout() {
  // If the wordmark font can't load, carry on with the system font.
  const [fontsLoaded, fontError] = useFonts({ Pacifico_400Regular });
  return (
    <SafeAreaProvider>
      <ThemeProvider>
        <SessionProvider>
          <ToastProvider>
            <DrawerProvider>{fontsLoaded || fontError ? <Navigator /> : null}</DrawerProvider>
          </ToastProvider>
        </SessionProvider>
      </ThemeProvider>
    </SafeAreaProvider>
  );
}

function Navigator() {
  const { colors, dark } = useTheme();
  const { ready } = useSession();

  useEffect(() => {
    if (ready) SplashScreen.hideAsync().catch(() => {});
  }, [ready]);

  useOpenFromNotification();

  if (!ready) return null;
  return (
    <>
      <StatusBar style={dark ? "light" : "dark"} />
      <Stack screenOptions={{ headerShown: false, contentStyle: { backgroundColor: colors.background } }}>
        <Stack.Screen name="(tabs)" />
        <Stack.Screen name="welcome" options={{ animation: "fade" }} />
        <Stack.Screen name="compose" options={{ presentation: "modal" }} />
      </Stack>
    </>
  );
}

/** Tapping a new-mail notification opens that mailbox's message. */
function useOpenFromNotification() {
  const router = useRouter();
  const { accounts, switchAccount, folders, ready } = useSession();

  useNotificationTaps((data: MailNotificationData) => {
    if (!data.mailbox || !accounts.some((a) => a.email === data.mailbox)) return;
    void switchAccount(data.mailbox).then(() => {
      const inbox = folders.find((f) => f.role === "inbox")?.path ?? "INBOX";
      if (data.uid) router.push({ pathname: "/message", params: { folder: inbox, uid: String(data.uid) } });
      else router.navigate("/");
    });
  }, ready);
}
