import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, describe, expect, it, vi } from "vitest";
import { NaitalkCallPanel, roomPrefixFor } from "./NaitalkCallPanel";
import { NaitalkCallPage } from "../pages/NaitalkCallPage";

const plan = { name: "Naitalk Call Business", monthly_usd_cents: 2000, monthly_usd: "$20", exchange_rate: 1545.5, monthly_ngn_kobo: 3091000 };

const cradle = {
  id: 1,
  business_name: "Cradle",
  contact_email: null,
  plan: "business",
  monthly_price_usd: "$20",
  monthly_price_ngn: "₦30,910",
  status: "active",
  room_prefix: "cradle",
  key_source: "server",
  api_key: null,
  webhook_url: "http://127.0.0.1:4300/v1/calls/webhook",
  minutes_this_month: 42,
};

function jsonResponse(body: unknown, status = 200) {
  return Promise.resolve(new Response(JSON.stringify(body), { status, headers: { "Content-Type": "application/json" } }));
}

afterEach(() => vi.unstubAllGlobals());

describe("roomPrefixFor", () => {
  it("turns a business name into a room prefix", () => {
    expect(roomPrefixFor("Acme Clinics Ltd.")).toBe("acme-clinics-ltd");
    expect(roomPrefixFor("  Ọjà & Co  ")).toBe("j-co");
  });
});

describe("NaitalkCallPage", () => {
  it("shows $20 a month and the Naira equivalent from the API", async () => {
    vi.stubGlobal("fetch", vi.fn(() => jsonResponse(plan)));
    render(<NaitalkCallPage />);

    const card = screen.getByTestId("naitalk-call-price-card");
    expect(card).toHaveTextContent("$20/ month");
    await waitFor(() => expect(card).toHaveTextContent("≈ ₦30,910 / month at today's rate"));
  });

  it("still shows the dollar price when the API is unreachable", async () => {
    vi.stubGlobal("fetch", vi.fn(() => Promise.reject(new Error("offline"))));
    render(<NaitalkCallPage />);

    const card = screen.getByTestId("naitalk-call-price-card");
    expect(card).toHaveTextContent("$20");
    expect(card).toHaveTextContent("Pay in dollars or Naira");
  });
});

describe("NaitalkCallPanel", () => {
  it("onboards a business and shows its secret once", async () => {
    const fetchMock = vi.fn((url: string, init?: RequestInit) => {
      if (init?.method === "POST") {
        return jsonResponse({ data: { ...cradle, id: 2, business_name: "Acme Clinics", room_prefix: "acme-clinics", key_source: "managed", api_key: "ncabc" }, api_secret: "S3cret" }, 201);
      }
      return jsonResponse({ data: [cradle], plan, public_url: "wss://call.naitalk.com", last_sync: null });
    });
    vi.stubGlobal("fetch", fetchMock);
    render(<NaitalkCallPanel adminToken="t" />);

    expect(await screen.findByText("kept on server")).toBeInTheDocument();
    expect(screen.getByText(/The server has not synced yet/)).toBeInTheDocument();

    await userEvent.type(screen.getByLabelText("Business name"), "Acme Clinics");
    expect(screen.getByLabelText(/Room prefix/)).toHaveValue("acme-clinics");
    await userEvent.click(screen.getByRole("button", { name: /Create key/ }));

    expect(await screen.findByText(/Key for Acme Clinics/)).toBeInTheDocument();
    expect(screen.getByText("S3cret")).toBeInTheDocument();
    const post = fetchMock.mock.calls.find(([, init]) => init?.method === "POST");
    expect(JSON.parse(String(post?.[1]?.body))).toMatchObject({ business_name: "Acme Clinics", room_prefix: "acme-clinics", webhook_url: null });
  });
});
