import * as SecureStore from "expo-secure-store";
import { Platform } from "react-native";

/*
 * Mailboxes signed in on this phone. Tokens live in the device keychain /
 * keystore (SecureStore), never in the SQLite cache.
 */
export type StoredAccount = { email: string; token: string };

// SecureStore has no browser version; the web build is only a development preview.
const store = Platform.OS === "web"
  ? {
      getItemAsync: async (k: string) => globalThis.localStorage?.getItem(k) ?? null,
      setItemAsync: async (k: string, v: string) => globalThis.localStorage?.setItem(k, v),
    }
  : SecureStore;

const ACCOUNTS_KEY = "greenmail_accounts";
const ACTIVE_KEY = "greenmail_active";
export const MAX_ACCOUNTS = 6;

export async function readAccounts(): Promise<StoredAccount[]> {
  try {
    const parsed = JSON.parse((await store.getItemAsync(ACCOUNTS_KEY)) || "[]");
    return Array.isArray(parsed) ? parsed.filter((a) => a && typeof a.token === "string" && typeof a.email === "string") : [];
  } catch {
    return [];
  }
}

export async function writeAccounts(accounts: StoredAccount[]): Promise<void> {
  await store.setItemAsync(ACCOUNTS_KEY, JSON.stringify(accounts));
}

export async function readActive(): Promise<string | null> {
  return store.getItemAsync(ACTIVE_KEY);
}

export async function writeActive(email: string): Promise<void> {
  await store.setItemAsync(ACTIVE_KEY, email);
}

/** Add or refresh an account (signing in again to the same address replaces its token). */
export function withAccount(accounts: StoredAccount[], account: StoredAccount): StoredAccount[] {
  const email = account.email.trim().toLowerCase();
  return [...accounts.filter((a) => a.email !== email), { email, token: account.token }];
}
