import React from "react";
import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it } from "vitest";
import type { Campaign, CampaignRecipient } from "./api";
import { CampaignReportView } from "./CampaignReport";

const person = (id: number, email: string, extra: Partial<CampaignRecipient> = {}): CampaignRecipient => ({
  id,
  email,
  name: null,
  status: "sent",
  error: null,
  sent_at: "2026-11-26T10:00:00Z",
  opened_at: null,
  open_count: 0,
  clicked_at: null,
  click_count: 0,
  unsubscribed_at: null,
  ...extra,
});

const campaign = (overrides: Partial<Campaign> = {}): Campaign => ({
  id: 6,
  name: "Launch",
  subject: "Hi",
  status: "sent",
  send_at: null,
  total: 4,
  sent_count: 3,
  failed_count: 1,
  skipped_count: 0,
  started_at: "2026-11-26T10:00:00Z",
  finished_at: "2026-11-26T10:05:00Z",
  last_error: null,
  created_at: "2026-11-26T09:00:00Z",
  track: true,
  opened_count: 2,
  clicked_count: 1,
  recipients: [
    person(1, "ada@example.com", { opened_at: "2026-11-26T10:10:00Z", open_count: 3, clicked_at: "2026-11-26T10:11:00Z", click_count: 2 }),
    person(2, "bola@example.com", { opened_at: "2026-11-26T11:00:00Z", open_count: 1 }),
    person(3, "chi@example.com", { unsubscribed_at: "2026-11-26T12:00:00Z" }),
    person(4, "dan@example.com", { status: "failed", error: "550 no such user" }),
  ],
  report: {
    tracked: true,
    sent: 3,
    opened: 2,
    opens: 4,
    clicked: 1,
    clicks: 2,
    unsubscribed: 1,
    open_rate: 66.7,
    click_rate: 33.3,
    click_to_open_rate: 50,
    unsubscribe_rate: 33.3,
    links: [{ id: 1, url: "https://example.com/offer", clicks: 2, people: 1 }],
    timeline: { unit: "hour", points: [{ at: "2026-11-26T10:00:00Z", opens: 1, clicks: 1 }, { at: "2026-11-26T11:00:00Z", opens: 1, clicks: 0 }] },
  },
  ...overrides,
});

describe("CampaignReportView", () => {
  afterEach(cleanup);

  it("shows the rates, the links and each person's activity, and filters people", () => {
    render(<CampaignReportView campaign={campaign()} />);

    expect(screen.getByText("66.7%")).toBeTruthy();
    expect(screen.getByText("2 of 3 people · 4 opens")).toBeTruthy();
    expect(screen.getByText("50%")).toBeTruthy();
    expect(screen.getByText("example.com/offer")).toBeTruthy();
    expect(screen.getByText("3×")).toBeTruthy();
    expect(screen.getByText("2 clicks")).toBeTruthy();
    expect(screen.getByRole("img", { name: "First opens per hour" })).toBeTruthy();

    fireEvent.click(screen.getByRole("button", { name: /^Not opened/ }));
    expect(screen.queryByText("ada@example.com")).toBeNull();
    expect(screen.getByText("chi@example.com")).toBeTruthy();
    expect(screen.queryByText("dan@example.com")).toBeNull();

    fireEvent.click(screen.getByRole("button", { name: /^Clicked/ }));
    expect(screen.getByText("ada@example.com")).toBeTruthy();
    expect(screen.queryByText("bola@example.com")).toBeNull();
  });

  it("says when a campaign was sent without tracking and hides the open filters", () => {
    const plain = campaign({ track: false });
    plain.report = { ...plain.report!, tracked: false };
    render(<CampaignReportView campaign={plain} />);

    expect(screen.getByText("Opens and clicks were not tracked for this campaign.")).toBeTruthy();
    expect(screen.queryByRole("button", { name: /^Opened/ })).toBeNull();
    expect(screen.getByRole("button", { name: /^Failed/ })).toBeTruthy();
  });
});
