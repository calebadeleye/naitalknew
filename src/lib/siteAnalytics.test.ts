import { afterEach, describe, expect, it, vi } from "vitest";

type Call = { url: string; body: Record<string, unknown> };

function stubFetch(pageviewResponse?: Promise<unknown>) {
  const calls: Call[] = [];
  vi.stubGlobal(
    "fetch",
    vi.fn((url: string, options?: { body?: string }) => {
      calls.push({ url: String(url), body: options?.body ? JSON.parse(options.body) : {} });
      if (String(url).includes("track/pageview")) {
        return pageviewResponse ?? Promise.resolve({ ok: true, json: () => Promise.resolve({ page_view_id: 7 }) });
      }
      return Promise.resolve({ ok: true });
    }),
  );
  return calls;
}

const flush = () => new Promise((resolve) => setTimeout(resolve, 0));
const heartbeats = (calls: Call[]) => calls.filter((call) => call.url.includes("track/heartbeat"));

async function freshTracker() {
  vi.resetModules();
  return import("./siteAnalytics");
}

afterEach(() => {
  vi.useRealTimers();
  vi.unstubAllGlobals();
});

// Order matters: the visits that interact remove their own window listeners,
// so they can't leak into the later "never interacts" cases.
describe("site visit engagement reporting", () => {
  it("flags the pageview as engagement-tracked and reports a scroll as engagement", async () => {
    const calls = stubFetch();
    const { trackSiteVisit } = await freshTracker();

    trackSiteVisit();
    await flush();
    expect(calls[0].body.engagement_tracking).toBe(true);
    expect(heartbeats(calls)).toHaveLength(0);

    window.dispatchEvent(new Event("scroll"));
    const beats = heartbeats(calls);
    expect(beats).toHaveLength(1);
    expect(beats[0].body).toMatchObject({ page_view_id: 7, engaged: true });
  });

  it("still reports an interaction that happens before the pageview response returns", async () => {
    let resolvePageview!: (value: unknown) => void;
    const calls = stubFetch(new Promise((resolve) => (resolvePageview = resolve)));
    const { trackSiteVisit } = await freshTracker();

    trackSiteVisit();
    window.dispatchEvent(new Event("mousemove"));
    expect(heartbeats(calls)).toHaveLength(0);

    resolvePageview({ ok: true, json: () => Promise.resolve({ page_view_id: 9 }) });
    await flush();

    const beats = heartbeats(calls);
    expect(beats).toHaveLength(1);
    expect(beats[0].body).toMatchObject({ page_view_id: 9, engaged: true });
  });

  it("does not report engagement for a visit with no interaction and little time on page", async () => {
    vi.useFakeTimers();
    const calls = stubFetch();
    const { trackSiteVisit } = await freshTracker();

    trackSiteVisit();
    await vi.advanceTimersByTimeAsync(0);
    await vi.advanceTimersByTimeAsync(5_000);

    expect(heartbeats(calls).filter((call) => call.body.engaged === true)).toHaveLength(0);
  });

  it("reports engagement after enough active time even without interaction", async () => {
    vi.useFakeTimers();
    const calls = stubFetch();
    const { trackSiteVisit } = await freshTracker();

    trackSiteVisit();
    await vi.advanceTimersByTimeAsync(0);
    await vi.advanceTimersByTimeAsync(15_000);

    const beats = heartbeats(calls);
    expect(beats.length).toBeGreaterThan(0);
    expect(beats[0].body).toMatchObject({ duration_seconds: 15, engaged: true });
  });
});
