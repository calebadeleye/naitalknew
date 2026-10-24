import Constants from "expo-constants";
import { createClient, DEFAULT_BASE_URL } from "./api";

/** API base: EXPO_PUBLIC_GREENMAIL_API (e.g. a local backend) > app.json extra.apiBaseUrl > production. */
export const API_BASE_URL: string =
  process.env.EXPO_PUBLIC_GREENMAIL_API || (Constants.expoConfig?.extra?.apiBaseUrl as string | undefined) || DEFAULT_BASE_URL;

/** Set by the session provider: signs a mailbox in again from its saved password when its session has expired. */
export const sessionHooks: { refresh: ((expiredToken: string) => Promise<string | null>) | null } = { refresh: null };

export const api = createClient({ baseUrl: API_BASE_URL, onSessionExpired: (token) => (sessionHooks.refresh ? sessionHooks.refresh(token) : Promise.resolve(null)) });

export const PLANS_URL = "https://www.naitalk.com/green-mail#email-plans";
