import { act, renderHook } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { holdReload, latestVersion, runningVersion, useAppUpdate } from "./appUpdate";

const page = (script: string) => `<!doctype html><html><head><script type="module" crossorigin src="${script}"></script></head><body></body></html>`;

describe("version check", () => {
  it("reads the running script and the server's", async () => {
    const doc = new DOMParser().parseFromString(page("/assets/index-AAA.js"), "text/html");
    expect(runningVersion(doc)).toBe("/assets/index-AAA.js");
    expect(runningVersion(new DOMParser().parseFromString("<p>dev</p>", "text/html"))).toBeNull();

    const fetcher = vi.fn(async (_url: string, _init?: RequestInit) => new Response(page("/assets/index-BBB.js")));
    expect(await latestVersion(fetcher as unknown as typeof fetch)).toBe("/assets/index-BBB.js");
    expect(fetcher.mock.calls[0][1]).toMatchObject({ cache: "no-store" });
    expect(await latestVersion((async () => new Response("", { status: 503 })) as unknown as typeof fetch)).toBeNull();
    expect(await latestVersion((async () => Promise.reject(new Error("offline"))) as unknown as typeof fetch)).toBeNull();
  });
});

describe("useAppUpdate", () => {
  const reload = vi.fn();
  let serverScript = "/assets/index-AAA.js";
  let hidden = false;

  beforeEach(() => {
    serverScript = "/assets/index-AAA.js";
    hidden = false;
    reload.mockReset();
    document.head.innerHTML = '<script type="module" src="/assets/index-AAA.js"></script>';
    vi.stubGlobal("fetch", vi.fn(async () => new Response(page(serverScript))));
    Object.defineProperty(window, "location", { configurable: true, value: { ...window.location, reload } });
    Object.defineProperty(document, "visibilityState", { configurable: true, get: () => (hidden ? "hidden" : "visible") });
  });

  afterEach(() => {
    vi.unstubAllGlobals();
    holdReload("compose", false);
    document.head.innerHTML = "";
  });

  const settle = () => act(async () => {
    await new Promise((resolve) => setTimeout(resolve, 0));
  });

  it("does nothing while the running version is the newest", async () => {
    const { result } = renderHook(() => useAppUpdate());
    await settle();
    expect(result.current.ready).toBe(false);
    expect(reload).not.toHaveBeenCalled();
  });

  it("offers the new version while in use, and reloads once it's in the background", async () => {
    serverScript = "/assets/index-BBB.js";
    const { result } = renderHook(() => useAppUpdate());
    await settle();
    expect(result.current.ready).toBe(true);
    expect(reload).not.toHaveBeenCalled(); // on screen and just used: only the banner

    hidden = true;
    document.dispatchEvent(new Event("visibilitychange"));
    expect(reload).toHaveBeenCalledTimes(1);
  });

  it("never reloads by itself while an email is being written", async () => {
    serverScript = "/assets/index-BBB.js";
    holdReload("compose", true);
    const { result } = renderHook(() => useAppUpdate());
    await settle();
    hidden = true;
    document.dispatchEvent(new Event("visibilitychange"));
    expect(result.current.ready).toBe(true);
    expect(reload).not.toHaveBeenCalled();

    holdReload("compose", false);
    document.dispatchEvent(new Event("visibilitychange"));
    expect(reload).toHaveBeenCalledTimes(1);
  });
});
