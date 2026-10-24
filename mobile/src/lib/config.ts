import Constants from "expo-constants";
import { createClient, DEFAULT_BASE_URL } from "./api";

/** API base: EXPO_PUBLIC_GREENMAIL_API (e.g. a local backend) > app.json extra.apiBaseUrl > production. */
export const API_BASE_URL: string =
  process.env.EXPO_PUBLIC_GREENMAIL_API || (Constants.expoConfig?.extra?.apiBaseUrl as string | undefined) || DEFAULT_BASE_URL;

export const api = createClient({ baseUrl: API_BASE_URL });

export const PLANS_URL = "https://www.naitalk.com/green-mail#email-plans";
