import { render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import { monthLabel, NaitalkCallUsagePage, usageLevel } from "./NaitalkCallUsagePage";

const business = {
  id: 7,
  business_name: "Acme",
  status: "active",
  plan: { id: "growth", name: "Growth", monthly_usd: "$49", monthly_ngn: "₦66,988", included_minutes: 200000 },
  usage: { month: "2026-10", minutes: 170000, included_minutes: 200000, percent: 85, alerts: true },
  daily: [
    { date: "2026-10-01", minutes: 1200 },
    { date: "2026-10-02", minutes: 0 },
    { date: "2026-10-03", minutes: 4000 },
  ],
  monthly: [
    { month: "2026-10", minutes: 170000 },
    { month: "2026-09", minutes: 90000 },
  ],
  connection: { url: "wss://call.naitalk.com", api_key: "ncacme", room_prefix: "acme", webhook_url: null },
};

afterEach(() => vi.unstubAllGlobals());

describe("Naitalk Call usage page", () => {
  it("labels usage in words as well as colour", () => {
    expect(usageLevel(40).label).toBe("Within your plan");
    expect(usageLevel(85).label).toBe("Close to your plan's minutes");
    expect(usageLevel(120).label).toBe("Over your plan's minutes");
    expect(monthLabel("2026-10")).toBe("October 2026");
  });

  it("shows this month's minutes against the plan, history and connection details", async () => {
    vi.stubGlobal("fetch", vi.fn(() => Promise.resolve(new Response(JSON.stringify({ data: [business], exchange_rate: null }), { status: 200 }))));
    render(<NaitalkCallUsagePage token="t" />);

    const card = await screen.findByTestId("naitalk-call-business-7");
    expect(screen.getByTestId("naitalk-call-minutes")).toHaveTextContent("170,000 of 200,000 participant-minutes");
    expect(card).toHaveTextContent("85% used · Close to your plan's minutes");
    expect(card).toHaveTextContent("We email you at 80% and 100%");
    expect(card).toHaveTextContent("September 2026");
    expect(card).toHaveTextContent("ncacme");
    expect(screen.getByRole("progressbar")).toHaveAttribute("aria-valuenow", "85");
  });

  it("explains when the client has no Naitalk Call yet", async () => {
    vi.stubGlobal("fetch", vi.fn(() => Promise.resolve(new Response(JSON.stringify({ data: [], exchange_rate: null }), { status: 200 }))));
    render(<NaitalkCallUsagePage token="t" />);
    expect(await screen.findByText(/You don't have Naitalk Call yet/)).toBeInTheDocument();
  });
});
