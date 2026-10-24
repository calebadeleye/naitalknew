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

/*
 * The mailbox password is kept in the same secure storage (iPhone Keychain /
 * Android Keystore) so the app can sign in again by itself when the server's
 * session expires (8 hours idle, 7 days at most). Removed on sign out.
 */
const passwordKey = (email: string) => `gm_pw_${email.trim().toLowerCase().replace(/[^A-Za-z0-9._-]/g, "_")}`;

export async function readPassword(email: string): Promise<string | null> {
  try {
    return (await store.getItemAsync(passwordKey(email))) || null;
  } catch {
    return null;
  }
}

export async function writePassword(email: string, password: string): Promise<void> {
  try {
    await store.setItemAsync(passwordKey(email), password);
  } catch {
    // Without a saved password the app just asks again when the session ends.
  }
}

export async function deletePassword(email: string): Promise<void> {
  try {
    if (Platform.OS === "web") globalThis.localStorage?.removeItem(passwordKey(email));
    else await SecureStore.deleteItemAsync(passwordKey(email));
  } catch {
    // already gone
  }
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
