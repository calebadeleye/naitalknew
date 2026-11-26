import React from "react";
import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import type { CampaignQuota } from "./api";
import { BuyEmailsDialog, QuotaMeter } from "./CampaignCredits";

const packs = [
  { emails: 1000, price_kobo: 250000 },
  { emails: 5000, price_kobo: 1000000 },
  { emails: 10000, price_kobo: 1750000 },
];

const quota = (overrides: Partial<Extract<CampaignQuota, { unlimited: false }>> = {}): CampaignQuota => ({
  unlimited: false,
  plan: "Starter Website Care",
  allowance: 500,
  used: 420,
  left: 80,
  credits: 0,
  credits_expire_at: null,
  available: 80,
  period_started_at: "2026-11-05T00:00:00Z",
  resets_at: "2026-12-05T00:00:00Z",
  can_buy: true,
  packs,
  ...overrides,
});

vi.mock("./feedback", () => ({ useFeedback: () => ({ toast: vi.fn(), confirm: vi.fn() }) }));

describe("campaign emails", () => {
  afterEach(() => {
    cleanup();
    vi.unstubAllGlobals();
  });

  it("shows what's left this month and offers more", () => {
    const onBuy = vi.fn();
    render(<QuotaMeter quota={quota()} onBuy={onBuy} />);
    expect(screen.getByText(/of 500 campaign emails left this month/)).toBeTruthy();
    expect(screen.getByText(/Included with Starter Website Care/)).toBeTruthy();
    fireEvent.click(screen.getByRole("button", { name: /Buy more emails/ }));
    expect(onBuy).toHaveBeenCalled();
  });

  it("only counts for a domain with no cap, and has no buy button when it can't be bought here", () => {
    render(<QuotaMeter quota={{ unlimited: true, available: null, sent: 5, resets_at: "2026-12-01T00:00:00Z", packs }} onBuy={vi.fn()} />);
    expect(screen.getByText(/campaign emails sent this month · no limit/)).toBeTruthy();
    expect(screen.queryByRole("button", { name: /Buy more emails/ })).toBeNull();
    cleanup();
    render(<QuotaMeter quota={quota({ can_buy: false, left: 0, available: 0 })} onBuy={vi.fn()} />);
    expect(screen.queryByRole("button", { name: /Buy more emails/ })).toBeNull();
    expect(screen.getByText(/contact NAI TALK support/)).toBeTruthy();
  });

  it("lists the packs with prices and sends you to pay", async () => {
    const assign = vi.fn();
    Object.defineProperty(window, "location", { configurable: true, value: { ...window.location, assign } });
    vi.stubGlobal("fetch", vi.fn(async () => new Response(JSON.stringify({ url: "https://checkout.example/pay" }), { status: 200 })));

    render(<BuyEmailsDialog token="gm_x" quota={quota()} onClose={vi.fn()} onSessionError={vi.fn()} />);
    expect(screen.getByText("₦2,500")).toBeTruthy();
    expect(screen.getByText("₦17,500")).toBeTruthy();
    expect(screen.getByText(/₦1.75 per email · save 30%/)).toBeTruthy();

    fireEvent.click(screen.getByRole("button", { name: /5,000 emails/ }));
    await vi.waitFor(() => expect(assign).toHaveBeenCalledWith("https://checkout.example/pay"));
    const [, init] = (fetch as unknown as { mock: { calls: Array<[string, RequestInit]> } }).mock.calls[0];
    expect(JSON.parse(String(init.body))).toEqual({ emails: 5000 });
  });
});
