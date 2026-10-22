import Constants from "expo-constants";
import * as Device from "expo-device";
import * as Notifications from "expo-notifications";
import { Platform } from "react-native";
import type { GreenmailClient } from "./api";

/*
 * New-mail notifications. The phone gets an Expo push token and gives it to
 * the server (POST /push/expo) for each signed-in mailbox; the server's
 * greenmail:expo-push-check job pushes when new mail arrives.
 *
 * Needs a development or store build (not Expo Go on Android) and an EAS
 * project id in app.json (extra.eas.projectId) — without one this quietly
 * does nothing.
 */
let cachedToken: string | null = null;

if (Platform.OS !== "web") {
  Notifications.setNotificationHandler({
    handleNotification: async () => ({ shouldShowBanner: true, shouldShowList: true, shouldPlaySound: true, shouldSetBadge: false }),
  });
}

export function projectId(): string | undefined {
  return (Constants.expoConfig?.extra?.eas?.projectId as string | undefined) ?? Constants.easConfig?.projectId;
}

/** The Expo push token, asking for permission if needed. Null when not possible here. */
export async function pushToken(ask = true): Promise<string | null> {
  if (cachedToken) return cachedToken;
  if (!Device.isDevice || Platform.OS === "web" || !projectId()) return null;
  try {
    if (Platform.OS === "android") {
      await Notifications.setNotificationChannelAsync("mail", { name: "New mail", importance: Notifications.AndroidImportance.HIGH, lightColor: "#22a04f" });
    }
    let { status } = await Notifications.getPermissionsAsync();
    if (status !== "granted" && ask) status = (await Notifications.requestPermissionsAsync()).status;
    if (status !== "granted") return null;
    cachedToken = (await Notifications.getExpoPushTokenAsync({ projectId: projectId() })).data;
    return cachedToken;
  } catch {
    return null;
  }
}

export async function registerForPush(client: GreenmailClient, mailboxToken: string): Promise<boolean> {
  const token = await pushToken();
  if (!token) return false;
  try {
    await client.registerPush(mailboxToken, token, Platform.OS === "ios" ? "ios" : "android");
    return true;
  } catch {
    return false;
  }
}

export async function unregisterPush(client: GreenmailClient, mailboxToken: string): Promise<void> {
  const token = await pushToken(false);
  if (token) await client.unregisterPush(mailboxToken, token);
}

export type MailNotificationData = { mailbox?: string; uid?: number; test?: boolean };
