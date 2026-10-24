import { Linking } from "react-native";

/**
 * Links (in emails and to our own pages) open in the phone's own browser, never in a
 * browser inside the app. The app has no web browsing of its own, which is what the
 * App Store's "Unrestricted Web Access" question asks about.
 */
export function openLink(url: string): void {
  void Linking.openURL(url).catch(() => {});
}
