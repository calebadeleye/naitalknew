import { describe, expect, it, jest, beforeEach } from "@jest/globals";
import { ApiError, NetworkError, SessionExpired } from "../api";
import { type OutboxSender, backoffMs, enqueueItem, MAX_ATTEMPTS, MemoryOutboxStore, processOutbox, retryItem, STALE_SENDING_MS } from "../outbox";

const email = (subject: string) => ({ to: "b@x.com", subject, html: `<p>${subject}</p>` });

describe("outbox", () => {
  let now = 1_000_000;
  const clock = () => now;
  beforeEach(() => {
    now = 1_000_000;
  });

  it("sends queued items oldest first and removes them", async () => {
    const store = new MemoryOutboxStore();
    await store.put(enqueueItem("a@x.com", "send", email("second"), "second", now + 1));
    await store.put(enqueueItem("a@x.com", "send", email("first"), "first", now));
    now += 10;

    const order: string[] = [];
    const result = await processOutbox(store, async (item) => void order.push(item.label), clock);

    expect(order).toEqual(["first", "second"]);
    expect(result.sent).toHaveLength(2);
    expect(await store.all()).toEqual([]);
  });

  it("keeps items while offline and stops at the first network error", async () => {
    const store = new MemoryOutboxStore();
    await store.put(enqueueItem("a@x.com", "send", email("one"), "one", now));
    await store.put(enqueueItem("a@x.com", "draft", email("two"), "two", now + 1));
    now += 10;

    const send = jest.fn<OutboxSender>().mockRejectedValue(new NetworkError("offline"));
    const result = await processOutbox(store, send, clock);

    expect(send).toHaveBeenCalledTimes(1);
    expect(result.retrying).toHaveLength(1);
    const items = await store.all();
    expect(items).toHaveLength(2);
    const first = items.find((i) => i.label === "one")!;
    expect(first.status).toBe("pending");
    expect(first.attempts).toBe(1);
    expect(first.error).toBe("offline");
    expect(first.nextAttemptAt).toBe(now + backoffMs(1));

    // Not due yet: nothing is tried.
    send.mockClear();
    await processOutbox(store, send, clock);
    expect(send).not.toHaveBeenCalledWith(expect.objectContaining({ label: "one" }));

    // Back online after the wait: both go.
    now += backoffMs(1);
    send.mockResolvedValue(undefined);
    const later = await processOutbox(store, send, clock);
    expect(later.sent).toHaveLength(2);
    expect(await store.all()).toEqual([]);
  });

  it("marks an item failed when the server refuses it, and carries on with the rest", async () => {
    const store = new MemoryOutboxStore();
    const bad = enqueueItem("a@x.com", "send", email("bad"), "bad", now);
    await store.put(bad);
    await store.put(enqueueItem("a@x.com", "send", email("good"), "good", now + 1));
    now += 10;

    const result = await processOutbox(
      store,
      async (item) => {
        if (item.label === "bad") throw new ApiError("The email address is not valid.", 422);
      },
      clock,
    );

    expect(result.failed).toEqual([bad.id]);
    expect(result.sent).toHaveLength(1);
    const [left] = await store.all();
    expect(left.status).toBe("failed");
    expect(left.error).toBe("The email address is not valid.");

    // Failed items wait for the user.
    const send = jest.fn<OutboxSender>();
    await processOutbox(store, send, clock);
    expect(send).not.toHaveBeenCalled();

    await retryItem(store, bad.id, now);
    await processOutbox(store, send, clock);
    expect(send).toHaveBeenCalledTimes(1);
  });

  it("retries server errors with backoff and gives up after MAX_ATTEMPTS", async () => {
    const store = new MemoryOutboxStore();
    await store.put(enqueueItem("a@x.com", "send", email("x"), "x", now));
    const send = jest.fn<OutboxSender>().mockRejectedValue(new ApiError("Mail server busy", 503));

    for (let i = 0; i < MAX_ATTEMPTS; i++) {
      now += 31 * 60 * 1000;
      await processOutbox(store, send, clock);
    }
    expect(send).toHaveBeenCalledTimes(MAX_ATTEMPTS);
    const [item] = await store.all();
    expect(item.status).toBe("failed");
  });

  it("holds a signed-out account's items without spending attempts on the others", async () => {
    const store = new MemoryOutboxStore();
    await store.put(enqueueItem("old@x.com", "send", email("a"), "a", now));
    await store.put(enqueueItem("old@x.com", "send", email("b"), "b", now + 1));
    await store.put(enqueueItem("ok@x.com", "send", email("c"), "c", now + 2));
    now += 10;

    const send = jest.fn<OutboxSender>(async (item) => {
      if (item.account === "old@x.com") throw new SessionExpired("Please sign in again.");
    });
    const result = await processOutbox(store, send, clock);

    expect(send).toHaveBeenCalledTimes(2); // "b" skipped after "a" found the session gone
    expect(result.signedOut).toHaveLength(1);
    expect(result.sent).toHaveLength(1);
    const left = await store.all();
    expect(left.map((i) => i.status)).toEqual(["pending", "pending"]);
    expect(left.find((i) => i.label === "a")!.error).toBe("Sign in again to send this.");
  });

  it("re-sends an item left 'sending' when the app was closed", async () => {
    const store = new MemoryOutboxStore();
    const item = enqueueItem("a@x.com", "send", email("x"), "x", now);
    await store.put({ ...item, status: "sending", nextAttemptAt: now });
    const send = jest.fn<OutboxSender>().mockResolvedValue(undefined);

    now += 1000;
    await processOutbox(store, send, clock);
    expect(send).not.toHaveBeenCalled();

    now += STALE_SENDING_MS;
    await processOutbox(store, send, clock);
    expect(send).toHaveBeenCalledTimes(1);
  });

  it("backs off exponentially up to 30 minutes", () => {
    expect(backoffMs(1)).toBe(15000);
    expect(backoffMs(2)).toBe(30000);
    expect(backoffMs(3)).toBe(60000);
    expect(backoffMs(20)).toBe(30 * 60 * 1000);
  });
});
