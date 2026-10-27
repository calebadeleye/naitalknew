import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, describe, expect, it, vi } from "vitest";
import { NaitalkCallPanel, roomPrefixFor, usageSummary } from "./NaitalkCallPanel";
import { NaitalkCallPage, rateDate } from "../pages/NaitalkCallPage";

const plans = [
  { id: "free", name: "Free", tagline: "For testing while you build", included_minutes: 5000, features: ["Testing"], monthly_usd_cents: 0, monthly_usd: "Free", monthly_ngn: null },
  { id: "starter", name: "Starter", tagline: "For developers launching an app", included_minutes: 50000, features: ["API access and usage dashboard"], monthly_usd_cents: 2000, monthly_usd: "$20", monthly_ngn: "₦27,342" },
  { id: "growth", name: "Growth", tagline: "For growing apps", included_minutes: 200000, features: ["Usage alerts and billing reports"], monthly_usd_cents: 4900, monthly_usd: "$49", monthly_ngn: "₦66,988" },
  { id: "business", name: "Business", tagline: "For established apps", included_minutes: 500000, features: ["Priority support"], monthly_usd_cents: 9900, monthly_usd: "$99", monthly_ngn: "₦135,343" },
];
const exchangeRate = { rate: 1367.1057, date: "2026-10-26", source: "CBN" };

const cradle = {
  id: 1,
  business_name: "Cradle",
  contact_email: null,
  plan: "free",
  monthly_price_usd: "Free",
  monthly_price_ngn: null,
  status: "active",
  room_prefix: "cradle",
  key_source: "server",
  api_key: null,
  webhook_url: "http://127.0.0.1:4300/v1/calls/webhook",
  minutes_this_month: 4200,
  included_minutes: 5000,
  client: null,
  revoked_at: null,
};

function jsonResponse(body: unknown, status = 200) {
  return Promise.resolve(new Response(JSON.stringify(body), { status, headers: { "Content-Type": "application/json" } }));
}

afterEach(() => vi.unstubAllGlobals());

describe("helpers", () => {
  it("turns a business name into a room prefix", () => {
    expect(roomPrefixFor("Acme Clinics Ltd.")).toBe("acme-clinics-ltd");
    expect(roomPrefixFor("  Ọjà & Co  ")).toBe("j-co");
  });

  it("summarises usage against the plan's minutes", () => {
    expect(usageSummary(12300, 50000)).toEqual({ text: "12,300 of 50,000 (25%)", percent: 25 });
    expect(usageSummary(10, 0).percent).toBe(0);
  });

  it("formats the CBN rate date", () => {
    expect(rateDate("2026-10-26")).toBe("26 Oct 2026");
  });
});

describe("NaitalkCallPage", () => {
  it("shows every plan with Naira at the CBN official rate", async () => {
    vi.stubGlobal("fetch", vi.fn(() => jsonResponse({ plans, exchange_rate: exchangeRate })));
    render(<NaitalkCallPage />);

    const growth = screen.getByTestId("naitalk-call-plan-growth");
    expect(growth).toHaveTextContent("$49/mo");
    expect(growth).toHaveTextContent("200,000 participant-minutes");
    await waitFor(() => expect(growth).toHaveTextContent("≈ ₦66,988/mo"));
    expect(screen.getByTestId("naitalk-call-rate-note")).toHaveTextContent("Central Bank of Nigeria official rate: ₦1,367.11 per $1 (26 Oct 2026)");
    expect(screen.getByTestId("naitalk-call-plan-free")).toHaveTextContent("Start free");
  });

  it("still shows the dollar plans when the API is unreachable", () => {
    vi.stubGlobal("fetch", vi.fn(() => Promise.reject(new Error("offline"))));
    render(<NaitalkCallPage />);

    expect(screen.getByTestId("naitalk-call-plan-starter")).toHaveTextContent("$20");
    expect(screen.getByTestId("naitalk-call-plan-business")).toHaveTextContent("500,000 participant-minutes");
    expect(screen.getByTestId("naitalk-call-rate-note")).toHaveTextContent("Pay in dollars or in Naira");
  });
});

describe("NaitalkCallPanel", () => {
  const tyf = { id: 9, name: "Think Yoruba First", email: "accounts@thinkyorubafirst.org", client_code: "CLT-TYF" };
  const acme = { ...cradle, id: 2, business_name: "thinkyorubafirst.org", room_prefix: "tyf-site", key_source: "managed", api_key: "ncabc", plan: "starter", client: tyf, minutes_this_month: 100, included_minutes: 50000 };

  function mockApi() {
    const fetchMock = vi.fn((url: string, init?: RequestInit) => {
      if (url.includes("/naitalk-call/clients?q=")) return jsonResponse({ data: url.includes("yoruba") ? [tyf] : [] });
      if (url.endsWith("/revoke-key")) return jsonResponse({ data: { ...acme, revoked_at: "2026-10-27T12:00:00Z" } });
      if (init?.method === "POST") return jsonResponse({ data: acme, api_secret: "S3cret" }, 201);
      return jsonResponse({ data: [cradle, acme], plans, exchange_rate: exchangeRate, public_url: "wss://call.naitalk.com", last_sync: null });
    });
    vi.stubGlobal("fetch", fetchMock);
    return fetchMock;
  }

  it("adds an app only for a registered client found by search", async () => {
    const fetchMock = mockApi();
    render(<NaitalkCallPanel adminToken="t" />);

    expect(await screen.findByText("kept on server")).toBeInTheDocument();
    expect(screen.getByText("No client account")).toBeInTheDocument();
    expect(screen.getByText("4,200 of 5,000 (84%)")).toBeInTheDocument();
    expect(screen.queryByLabelText("Contact email")).not.toBeInTheDocument();
    const create = screen.getByRole("button", { name: /Create key/ });

    await userEvent.type(screen.getByLabelText(/App name/), "thinkyorubafirst.org");
    expect(create).toBeDisabled();

    await userEvent.type(screen.getByLabelText("Client account"), "nobody");
    expect(await screen.findByText(/No registered client matches/)).toBeInTheDocument();
    await userEvent.clear(screen.getByLabelText("Client account"));
    await userEvent.type(screen.getByLabelText("Client account"), "yoruba");
    await userEvent.click(await screen.findByRole("option", { name: /Think Yoruba First/ }));
    expect(screen.getByTestId("client-picked")).toHaveTextContent("Think Yoruba First");

    await userEvent.click(create);
    expect(await screen.findByText(/Key for thinkyorubafirst.org/)).toBeInTheDocument();
    const post = fetchMock.mock.calls.find(([url, init]) => init?.method === "POST" && String(url).endsWith("/tenants"));
    expect(JSON.parse(String(post?.[1]?.body))).toMatchObject({ client_id: 9, business_name: "thinkyorubafirst.org", plan: "starter" });
  });

  it("revokes a key only after confirming, and not a key still kept on the server", async () => {
    const fetchMock = mockApi();
    const confirm = vi.spyOn(window, "confirm").mockReturnValueOnce(false).mockReturnValueOnce(true);
    render(<NaitalkCallPanel adminToken="t" />);
    await screen.findByText("kept on server");

    const revokeButtons = screen.getAllByRole("button", { name: "Revoke key" });
    expect(revokeButtons[0]).toBeDisabled(); // Cradle, until its key is handed over

    await userEvent.click(revokeButtons[1]);
    expect(confirm.mock.calls[0][0]).toMatch(/Revoke the key ncabc of thinkyorubafirst.org \(Think Yoruba First\)/);
    expect(fetchMock.mock.calls.some(([url]) => String(url).endsWith("/revoke-key"))).toBe(false);

    await userEvent.click(revokeButtons[1]);
    await waitFor(() => expect(fetchMock.mock.calls.some(([url]) => String(url).endsWith("/tenants/2/revoke-key"))).toBe(true));
    confirm.mockRestore();
  });

  it("files an existing app under a client account", async () => {
    const fetchMock = mockApi();
    render(<NaitalkCallPanel adminToken="t" />);
    await screen.findByText("kept on server");

    await userEvent.click(screen.getByRole("button", { name: "Link client" }));
    await userEvent.type(screen.getByLabelText("Client account for Cradle"), "yoruba");
    await userEvent.click(await screen.findByRole("option", { name: /Think Yoruba First/ }));

    await waitFor(() => {
      const put = fetchMock.mock.calls.find(([, init]) => init?.method === "PUT");
      expect(JSON.parse(String(put?.[1]?.body))).toMatchObject({ client_id: 9, business_name: "Cradle", room_prefix: "cradle" });
    });
  });
});
