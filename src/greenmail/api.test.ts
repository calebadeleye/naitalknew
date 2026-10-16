import { beforeEach, describe, expect, it } from "vitest";
import { clearToken, readAccounts, readToken, rememberAccountEmail, setActiveToken, storeToken } from "./api";

describe("Green Mail accounts on this device", () => {
  beforeEach(() => {
    window.localStorage.clear();
    window.sessionStorage.clear();
  });

  it("keeps a sign-in from before multiple accounts existed", () => {
    window.localStorage.setItem("greenmail_token", "gm_old");
    expect(readToken()).toBe("gm_old");
    rememberAccountEmail("gm_old", "info@shop.com");
    expect(readAccounts()).toEqual([{ email: "info@shop.com", token: "gm_old", remember: true }]);
    expect(window.localStorage.getItem("greenmail_token")).toBeNull();
  });

  it("adds accounts, switches, replaces a re-signed-in address and signs out one at a time", () => {
    storeToken("gm_a", true, "Caleb@Shop.com");
    storeToken("gm_b", false, "info@shop.com");
    expect(readToken()).toBe("gm_b");
    expect(readAccounts().map((a) => a.email)).toEqual(["caleb@shop.com", "info@shop.com"]);

    setActiveToken("gm_a");
    expect(readToken()).toBe("gm_a");

    storeToken("gm_a2", true, "caleb@shop.com");
    expect(readAccounts().map((a) => a.token)).toEqual(["gm_a2", "gm_b"]);

    clearToken("gm_a2");
    expect(readAccounts().map((a) => a.email)).toEqual(["info@shop.com"]);
    expect(readToken()).toBe("gm_b");
    // Not "Keep me signed in": only this tab knows it.
    expect(JSON.parse(window.localStorage.getItem("greenmail_accounts") || "[]")).toEqual([]);
  });
});
