import Constants, { ExecutionEnvironment } from "expo-constants";
import * as Device from "expo-device";
import { useEffect, useRef } from "react";
import { Platform } from "react-native";
import type { GreenmailClient } from "./api";

/*
 * New-mail notifications. The phone gets an Expo push token and gives it to
 * the server (POST /push/expo) for each signed-in mailbox; the server's
 * greenmail:expo-push-check job pushes when new mail arrives.
 *
 * Needs a development or store build and an EAS project id in app.json
 * (extra.eas.projectId). In Expo Go (which on Android doesn't even contain
 * the notifications module) and in the browser this quietly does nothing.
 */
type NotificationsModule = typeof import("expo-notifications");
export type MailNotificationData = { mailbox?: string; uid?: number; test?: boolean };

let loaded: NotificationsModule | null | undefined;
let cachedToken: string | null = null;

function cannotPush(): boolean {
  return Constants.executionEnvironment === ExecutionEnvironment.StoreClient || (Constants as { appOwnership?: string | null }).appOwnership === "expo" || !Constants.expoConfig?.extra?.eas?.projectId;
}

function notifications(): NotificationsModule | null {
  if (loaded !== undefined) return loaded;
  if (Platform.OS === "web" || cannotPush()) return (loaded = null);
  try {
    // eslint-disable-next-line @typescript-eslint/no-require-imports
    const mod = require("expo-notifications") as NotificationsModule;
    mod.setNotificationHandler({
      handleNotification: async () => ({ shouldShowBanner: true, shouldShowList: true, shouldPlaySound: true, shouldSetBadge: false }),
    });
    loaded = mod;
  } catch {
    loaded = null;
  }
  return loaded;
}

export function projectId(): string | undefined {
  return (Constants.expoConfig?.extra?.eas?.projectId as string | undefined) ?? Constants.easConfig?.projectId;
}

/** Whether this copy of the app can get push notifications at all. */
export function pushSupported(): boolean {
  return Device.isDevice && !!projectId() && notifications() !== null;
}

/** The Expo push token, asking for permission if needed. Null when not possible here. */
export async function pushToken(ask = true): Promise<string | null> {
  if (cachedToken) return cachedToken;
  const N = notifications();
  if (!N || !Device.isDevice || !projectId()) return null;
  try {
    if (Platform.OS === "android") {
      await N.setNotificationChannelAsync("mail", { name: "New mail", importance: N.AndroidImportance.HIGH, lightColor: "#22a04f" });
    }
    let { status } = await N.getPermissionsAsync();
    if (status !== "granted" && ask) status = (await N.requestPermissionsAsync()).status;
    if (status !== "granted") return null;
    cachedToken = (await N.getExpoPushTokenAsync({ projectId: projectId() })).data;
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

/** Calls `open` when a notification is tapped (also the one that launched the app). */
export function useNotificationTaps(open: (data: MailNotificationData) => void, enabled: boolean): void {
  const handler = useRef(open);
  handler.current = open;

  useEffect(() => {
    const N = notifications();
    if (!N || !enabled) return;
    const seen = new Set<string>();
    const handle = (response: import("expo-notifications").NotificationResponse | null) => {
      if (!response || seen.has(response.notification.request.identifier)) return;
      seen.add(response.notification.request.identifier);
      handler.current((response.notification.request.content.data ?? {}) as MailNotificationData);
    };
    void N.getLastNotificationResponseAsync().then(handle).catch(() => {});
    const subscription = N.addNotificationResponseReceivedListener(handle);
    return () => subscription.remove();
  }, [enabled]);
}
