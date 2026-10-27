// @vitest-environment node
import { describe, expect, it, vi } from "vitest";
import { ensureInternalKey, readInternalKey, readKeys, readUnmanagedKeys, readWebhookKey, renderConfig, roomOf, routeFor, signWebhook, verifyJwt, verifyWebhook } from "./lib.mjs";
import { handle } from "./router.mjs";

// The shape cradle/deploy/livekit/install.sh writes.
const LIVE_YAML = `# Naitalk Call media server (LiveKit). Managed by Naitalk.
port: 7880
bind_addresses: ["127.0.0.1"]
log_level: info

rtc:
  tcp_port: 7881
  udp_port: 7882-7884
  use_external_ip: false
  node_ip: 161.97.180.13

# One key per customer business.
keys:
  cradle1a2b3c4d: CradleSecretThatMustNeverChange123

room:
  empty_timeout: 300
  departure_timeout: 20
  max_participants: 500

webhook:
  api_key: cradle1a2b3c4d
  urls:
    - http://127.0.0.1:4300/v1/calls/webhook
`;

const ROUTER = "http://127.0.0.1:7890/webhook";

describe("renderConfig", () => {
  it("adds managed keys after Cradle's and points webhooks at the router, leaving every other line alone", () => {
    const { yaml, skipped } = renderConfig(LIVE_YAML, { ncacme: "AcmeSecret" }, ROUTER);

    expect(skipped).toEqual([]);
    expect(readKeys(yaml)).toEqual({ cradle1a2b3c4d: "CradleSecretThatMustNeverChange123", ncacme: "AcmeSecret" });
    expect(readWebhookKey(yaml)).toBe("cradle1a2b3c4d");
    expect(yaml).toContain(`keys:
  cradle1a2b3c4d: CradleSecretThatMustNeverChange123
  # BEGIN naitalk-call managed keys
  ncacme: AcmeSecret
  # END naitalk-call managed keys

room:`);
    expect(yaml).toContain(`  urls:\n    - ${ROUTER}\n`);
    expect(yaml).not.toContain("4300");

    // Only the keys block and the webhook URL changed.
    const changed = yaml.split("\n").filter((line) => !LIVE_YAML.split("\n").includes(line));
    expect(changed).toEqual(["  # BEGIN naitalk-call managed keys", "  ncacme: AcmeSecret", "  # END naitalk-call managed keys", `    - ${ROUTER}`]);
  });

  it("is idempotent, replaces the managed block on change, and can empty it", () => {
    const once = renderConfig(LIVE_YAML, { ncacme: "AcmeSecret" }, ROUTER).yaml;
    expect(renderConfig(once, { ncacme: "AcmeSecret" }, ROUTER).yaml).toBe(once);

    const rotated = renderConfig(once, { ncacme2: "NewSecret" }, ROUTER).yaml;
    expect(readKeys(rotated)).toEqual({ cradle1a2b3c4d: "CradleSecretThatMustNeverChange123", ncacme2: "NewSecret" });

    const none = renderConfig(rotated, {}, ROUTER).yaml;
    expect(readKeys(none)).toEqual({ cradle1a2b3c4d: "CradleSecretThatMustNeverChange123" });
    expect(none).toContain("# BEGIN naitalk-call managed keys\n  # END naitalk-call managed keys");
  });

  it("never lets a managed key replace Cradle's or inject YAML", () => {
    const { yaml, skipped } = renderConfig(LIVE_YAML, { cradle1a2b3c4d: "Hijack", "evil: x\nwebhook": "y", ncok: "bad secret" }, ROUTER);

    expect(skipped.sort()).toEqual(["cradle1a2b3c4d", "evil: x\nwebhook", "ncok"].sort());
    expect(readKeys(yaml)).toEqual({ cradle1a2b3c4d: "CradleSecretThatMustNeverChange123" });
  });

  it("refuses a config it does not understand", () => {
    expect(() => renderConfig(LIVE_YAML.replace("keys:", "api_keys:"), {}, ROUTER)).toThrow(/no top-level keys/);
    expect(() => renderConfig(LIVE_YAML.replace("  urls:", "  url:"), {}, ROUTER)).toThrow(/no urls/);
  });
});

describe("revoking any key, Cradle's included", () => {
  const internalKey = () => ({ key: "ncinternalabc", secret: "InternalSecret" });

  it("adds Naitalk's internal signing key once and keeps it", () => {
    const first = ensureInternalKey(LIVE_YAML, internalKey);
    expect(first.key).toBe("ncinternalabc");
    expect(readInternalKey(first.yaml)).toEqual({ key: "ncinternalabc", secret: "InternalSecret" });
    expect(ensureInternalKey(first.yaml, () => ({ key: "other", secret: "x" })).yaml).toBe(first.yaml);
    expect(readUnmanagedKeys(first.yaml)).toEqual({ cradle1a2b3c4d: "CradleSecretThatMustNeverChange123" });
  });

  it("adopts Cradle's key unchanged, signs webhooks with the internal key, then can revoke Cradle's", () => {
    const { yaml } = ensureInternalKey(LIVE_YAML, internalKey);

    // Adopted: the same key and secret come back from Naitalk as managed.
    const adopted = renderConfig(yaml, { cradle1a2b3c4d: "CradleSecretThatMustNeverChange123" }, ROUTER, "ncinternalabc").yaml;
    expect(readKeys(adopted)).toEqual({ ncinternalabc: "InternalSecret", cradle1a2b3c4d: "CradleSecretThatMustNeverChange123" });
    expect(readUnmanagedKeys(adopted)).toEqual({});
    expect(readWebhookKey(adopted)).toBe("ncinternalabc");
    expect(adopted.match(/cradle1a2b3c4d: /g)).toHaveLength(1);

    // Revoked: gone from keys:, while webhooks keep their own key.
    const revoked = renderConfig(adopted, {}, ROUTER, "ncinternalabc").yaml;
    expect(readKeys(revoked)).toEqual({ ncinternalabc: "InternalSecret" });
    expect(readWebhookKey(revoked)).toBe("ncinternalabc");
  });

  it("never writes a config whose webhook key is missing", () => {
    expect(() => renderConfig(LIVE_YAML, {}, ROUTER, "nokey")).toThrow(/webhook.api_key/);
  });

  it("a different secret under Cradle's key name is refused, not swapped in", () => {
    const { yaml, skipped } = renderConfig(LIVE_YAML, { cradle1a2b3c4d: "Hijack" }, ROUTER);
    expect(skipped).toEqual(["cradle1a2b3c4d"]);
    expect(readKeys(yaml).cradle1a2b3c4d).toBe("CradleSecretThatMustNeverChange123");
  });
});

describe("webhook signatures", () => {
  it("round-trips and rejects tampering, the wrong key and expiry", () => {
    const body = JSON.stringify({ event: "room_started" });
    const auth = signWebhook(body, "k1", "s1", 1000);

    expect(verifyWebhook(body, auth, "k1", "s1", 1000)).toBe(true);
    expect(verifyWebhook(`${body} `, auth, "k1", "s1", 1000)).toBe(false);
    expect(verifyWebhook(body, auth, "k2", "s1", 1000)).toBe(false);
    expect(verifyWebhook(body, auth, "k1", "s2", 1000)).toBe(false);
    expect(verifyWebhook(body, auth, "k1", "s1", 2000)).toBe(false);
    expect(verifyJwt("not-a-jwt", "s1")).toBeNull();
  });
});

describe("routing", () => {
  const routes = [
    { prefix: "cradle", url: "http://127.0.0.1:4300/v1/calls/webhook", api_key: null, api_secret: null },
    { prefix: "acme", url: "https://acme.test/hook", api_key: "ncacme", api_secret: "AcmeSecret" },
    { prefix: "acme-labs", url: "https://labs.test/hook", api_key: "nclabs", api_secret: "LabsSecret" },
  ];

  it("matches the longest prefix followed by a hyphen", () => {
    expect(routeFor("cradle-call-42", routes)?.prefix).toBe("cradle");
    expect(routeFor("acme-labs-standup", routes)?.prefix).toBe("acme-labs");
    expect(routeFor("acme-room", routes)?.prefix).toBe("acme");
    expect(routeFor("acmecorp-room", routes)).toBeNull();
    expect(routeFor("cradle", routes)).toBeNull();
    expect(roomOf({ egressInfo: { roomName: "acme-x" } })).toBe("acme-x");
  });

  const cfg = { inbound: { api_key: "cradle1a2b3c4d", api_secret: "CradleSecret" }, routes };
  const delivery = (event) => {
    const body = JSON.stringify(event);
    return [body, { authorization: signWebhook(body, "cradle1a2b3c4d", "CradleSecret"), "content-type": "application/webhook+json" }];
  };

  it("forwards Cradle's events with LiveKit's own signature, unchanged", async () => {
    const send = vi.fn(async () => ({ ok: true, status: 200 }));
    const [body, headers] = delivery({ event: "participant_joined", room: { name: "cradle-call-7" } });

    const [status] = await handle(body, headers, cfg, send);

    expect(status).toBe(200);
    expect(send).toHaveBeenCalledWith("http://127.0.0.1:4300/v1/calls/webhook", expect.objectContaining({ body }));
    expect(send.mock.calls[0][1].headers.Authorization).toBe(headers.authorization);
  });

  it("re-signs another business's events with its own key, and never sends them to Cradle", async () => {
    const send = vi.fn(async () => ({ ok: true, status: 200 }));
    const [body, headers] = delivery({ event: "room_finished", room: { name: "acme-room-1" } });

    await handle(body, headers, cfg, send);

    expect(send).toHaveBeenCalledTimes(1);
    const [url, init] = send.mock.calls[0];
    expect(url).toBe("https://acme.test/hook");
    expect(verifyWebhook(body, init.headers.Authorization, "ncacme", "AcmeSecret")).toBe(true);
    expect(verifyWebhook(body, init.headers.Authorization, "cradle1a2b3c4d", "CradleSecret")).toBe(false);
  });

  it("accepts either signing key while LiveKit switches to the internal one", async () => {
    const send = vi.fn(async () => ({ ok: true, status: 200 }));
    const both = { ...cfg, inbound: [cfg.inbound, { api_key: "ncinternalabc", api_secret: "InternalSecret" }] };
    const body = JSON.stringify({ event: "room_started", room: { name: "acme-1" } });

    expect((await handle(body, { authorization: signWebhook(body, "ncinternalabc", "InternalSecret") }, both, send))[0]).toBe(200);
    expect((await handle(body, { authorization: signWebhook(body, "cradle1a2b3c4d", "CradleSecret") }, both, send))[0]).toBe(200);
    expect((await handle(body, { authorization: signWebhook(body, "ncinternalabc", "InternalSecret") }, cfg, send))[0]).toBe(401);
  });

  it("drops unowned rooms, rejects forged events, and asks LiveKit to retry failed deliveries", async () => {
    const send = vi.fn(async () => ({ ok: false, status: 503 }));

    const [unowned, unownedHeaders] = delivery({ event: "room_started", room: { name: "stranger-1" } });
    expect((await handle(unowned, unownedHeaders, cfg, send))[0]).toBe(200);
    expect(send).not.toHaveBeenCalled();

    const forged = JSON.stringify({ event: "room_started", room: { name: "cradle-call-1" } });
    expect((await handle(forged, { authorization: signWebhook(forged, "cradle1a2b3c4d", "guess") }, cfg, send))[0]).toBe(401);

    const [body, headers] = delivery({ event: "room_started", room: { name: "acme-1" } });
    expect((await handle(body, headers, cfg, send))[0]).toBe(502);
  });
});
