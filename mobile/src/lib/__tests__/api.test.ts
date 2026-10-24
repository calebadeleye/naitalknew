import { describe, expect, it, jest, beforeEach } from "@jest/globals";
import { ApiError, buildQuery, composeForm, createClient, NetworkError, SessionExpired } from "../api";

type Call = { url: string; init: RequestInit };

function fakeFetch(status: number, body: unknown, calls: Call[] = []) {
  return {
    calls,
    fetch: jest.fn(async (url: string, init: RequestInit = {}): Promise<Response> => {
      calls.push({ url, init });
      return { ok: status >= 200 && status < 300, status, json: async () => body } as Response;
    }),
  };
}

describe("Green Mail API client", () => {
  it("signs in without a token and returns the new one", async () => {
    const f = fakeFetch(201, { token: "gm_abc", email: "a@naitalk.com", expires_at: "2026-11-01T00:00:00Z" });
    const api = createClient({ baseUrl: "https://example.test/api/v1/greenmail/", fetch: f.fetch });

    const result = await api.signIn(" a@naitalk.com ", "pw");

    expect(result.token).toBe("gm_abc");
    expect(f.calls[0].url).toBe("https://example.test/api/v1/greenmail/session");
    const headers = f.calls[0].init.headers as Record<string, string>;
    expect(headers["X-Greenmail-Token"]).toBeUndefined();
    expect(headers["Content-Type"]).toBe("application/json");
    expect(JSON.parse(f.calls[0].init.body as string)).toEqual({ email: "a@naitalk.com", password: "pw" });
  });

  it("sends the token header and builds list queries", async () => {
    const f = fakeFetch(200, { messages: [], total: 0, page: 2, last_page: 1 });
    const api = createClient({ baseUrl: "https://example.test/gm", fetch: f.fetch });

    await api.messages("gm_tok", "INBOX.Sent Items", 2, "unread", "invoice");

    expect(f.calls[0].url).toBe("https://example.test/gm/messages?folder=INBOX.Sent%20Items&page=2&filter=unread&q=invoice");
    expect((f.calls[0].init.headers as Record<string, string>)["X-Greenmail-Token"]).toBe("gm_tok");
  });

  it("turns 401 into SessionExpired", async () => {
    const api = createClient({ baseUrl: "https://x.test", fetch: fakeFetch(401, { message: "Signed out." }).fetch });
    await expect(api.folders("gm_old")).rejects.toBeInstanceOf(SessionExpired);
  });

  it("reports the first validation error", async () => {
    const api = createClient({ baseUrl: "https://x.test", fetch: fakeFetch(422, { message: "Invalid.", errors: { to: ["Add at least one recipient."] } }).fetch });
    const error = await api.send("gm_t", { to: "", subject: "", html: "" }).catch((e) => e);
    expect(error).toBeInstanceOf(ApiError);
    expect(error.message).toBe("Add at least one recipient.");
    expect(error.status).toBe(422);
    expect(error.retryable).toBe(false);
  });

  it("marks server errors as retryable", async () => {
    const api = createClient({ baseUrl: "https://x.test", fetch: fakeFetch(503, { message: "The mail server is not responding." }).fetch });
    const error = await api.folders("gm_t").catch((e) => e);
    expect(error).toBeInstanceOf(ApiError);
    expect(error.retryable).toBe(true);
    expect(error.message).toBe("The mail server is not responding.");
  });

  it("turns a failed fetch into NetworkError", async () => {
    const api = createClient({ baseUrl: "https://x.test", fetch: jest.fn<(input: string, init?: RequestInit) => Promise<Response>>().mockRejectedValue(new TypeError("Network request failed")) });
    await expect(api.folders("gm_t")).rejects.toBeInstanceOf(NetworkError);
  });

  it("sends compose fields as multipart form data with attachments", async () => {
    const f = fakeFetch(201, { message: "Sent." });
    const api = createClient({ baseUrl: "https://x.test", fetch: f.fetch });

    await api.send("gm_t", {
      to: "b@x.com, c@y.com",
      subject: "Hi",
      html: "<p>Hello</p>",
      reply_uid: 7,
      forward_attachments: [0, 2],
      attachments: [{ uri: "file:///doc.pdf", name: "doc.pdf", mime: "application/pdf" }],
    });

    const body = f.calls[0].init.body as FormData;
    expect(body).toBeInstanceOf(FormData);
    const headers = f.calls[0].init.headers as Record<string, string>;
    expect(headers["Content-Type"]).toBeUndefined(); // fetch sets the multipart boundary
    expect(f.calls[0].url).toBe("https://x.test/send");
  });

  it("composeForm leaves out empty optional fields", () => {
    const appended: Array<[string, unknown]> = [];
    const spy = jest.spyOn(FormData.prototype, "append").mockImplementation(function (name: string, value: unknown) {
      appended.push([name, value]);
    } as never);
    composeForm({ to: "a@b.com", subject: "S", html: "<p>x</p>", in_reply_to: "", reply_uid: 3, forward_attachments: [1], attachments: [{ uri: "file:///a.png", name: "a.png", mime: "image/png" }] });
    spy.mockRestore();

    const names = appended.map(([n]) => n);
    expect(names).toEqual(["to", "cc", "bcc", "subject", "html", "reply_uid", "forward_attachments[]", "attachments[]"]);
    expect(appended[5][1]).toBe("3");
    expect(appended[7][1]).toEqual({ uri: "file:///a.png", name: "a.png", type: "image/png" });
  });

  describe("when the session has expired", () => {
    const responder = (okToken: string) => {
      const seen: string[] = [];
      const fetch = jest.fn(async (_url: string, init: RequestInit = {}): Promise<Response> => {
        const token = (init.headers as Record<string, string>)["X-Greenmail-Token"];
        seen.push(token);
        const ok = token === okToken;
        return { ok, status: ok ? 200 : 401, json: async () => (ok ? { folders: [], starred: 0 } : { message: "Signed out." }) } as Response;
      });
      return { fetch, seen };
    };

    it("signs in again and repeats the request with the fresh token", async () => {
      const r = responder("fresh");
      const refresh = jest.fn(async (_old: string) => "fresh" as string | null);
      const api = createClient({ baseUrl: "https://x.test", fetch: r.fetch, onSessionExpired: refresh });

      await expect(api.folders("stale")).resolves.toEqual({ folders: [], starred: 0 });

      expect(refresh).toHaveBeenCalledTimes(1);
      expect(refresh).toHaveBeenCalledWith("stale");
      expect(r.seen).toEqual(["stale", "fresh"]);
    });

    it("throws SessionExpired when it cannot sign in again", async () => {
      const r = responder("never");
      const api = createClient({ baseUrl: "https://x.test", fetch: r.fetch, onSessionExpired: async () => null });
      await expect(api.folders("stale")).rejects.toBeInstanceOf(SessionExpired);
      expect(r.seen).toEqual(["stale"]);
    });

    it("tries only once, even if the fresh token is refused too", async () => {
      const r = responder("never");
      const refresh = jest.fn(async (_old: string) => "also-bad" as string | null);
      const api = createClient({ baseUrl: "https://x.test", fetch: r.fetch, onSessionExpired: refresh });
      await expect(api.folders("stale")).rejects.toBeInstanceOf(SessionExpired);
      expect(refresh).toHaveBeenCalledTimes(1);
      expect(r.seen).toEqual(["stale", "also-bad"]);
    });

    it("does not try to sign in again when signing in itself fails", async () => {
      const refresh = jest.fn(async (_old: string) => "x" as string | null);
      const api = createClient({ baseUrl: "https://x.test", fetch: fakeFetch(422, { message: "Wrong", errors: { email: ["Wrong email address or password."] } }).fetch, onSessionExpired: refresh });
      await expect(api.signIn("a@x.com", "bad")).rejects.toBeInstanceOf(ApiError);
      expect(refresh).not.toHaveBeenCalled();
    });
  });

  it("buildQuery skips empty values", () => {
    expect(buildQuery({ a: 1, b: "", c: undefined, d: null, e: "x y" })).toBe("?a=1&e=x%20y");
    expect(buildQuery({})).toBe("");
  });
});
