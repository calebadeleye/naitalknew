import { Pacifico_400Regular, useFonts } from "@expo-google-fonts/pacifico";
import * as Notifications from "expo-notifications";
import { Stack, useRouter } from "expo-router";
import * as SplashScreen from "expo-splash-screen";
import { StatusBar } from "expo-status-bar";
import { useEffect } from "react";
import { Platform } from "react-native";
import { SafeAreaProvider } from "react-native-safe-area-context";
import { DrawerProvider } from "../components/Drawer";
import { ToastProvider } from "../components/toast";
import type { MailNotificationData } from "../lib/push";
import { SessionProvider, useSession } from "../state/session";
import { ThemeProvider, useTheme } from "../state/theme";

SplashScreen.preventAutoHideAsync().catch(() => {});

export default function RootLayout() {
  const [fontsLoaded] = useFonts({ Pacifico_400Regular });
  return (
    <SafeAreaProvider>
      <ThemeProvider>
        <SessionProvider>
          <ToastProvider>
            <DrawerProvider>{fontsLoaded ? <Navigator /> : null}</DrawerProvider>
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
  const last = Notifications.useLastNotificationResponse?.();

  useEffect(() => {
    if (!ready || Platform.OS === "web" || !last) return;
    const data = last.notification.request.content.data as MailNotificationData;
    if (!data?.mailbox || !accounts.some((a) => a.email === data.mailbox)) return;
    void switchAccount(data.mailbox).then(() => {
      const inbox = folders.find((f) => f.role === "inbox")?.path ?? "INBOX";
      if (data.uid) router.push({ pathname: "/message", params: { folder: inbox, uid: String(data.uid) } });
      else router.navigate("/");
    });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [last, ready]);
}
