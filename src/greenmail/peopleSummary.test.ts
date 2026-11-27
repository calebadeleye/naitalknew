import { describe, expect, it } from "vitest";
import { peopleSummary } from "./MessageReader";

const p = (email: string, name: string | null = null) => ({ email, name });

describe("peopleSummary", () => {
  it("keeps a long To/Cc list to one short line", () => {
    const cc = Array.from({ length: 14 }, (_, i) => p(`person${i}@example.com`));
    expect(peopleSummary({ to: [p("caleb@naitalk.com", "Caleb Adeleye")], cc })).toBe("to Caleb · cc person0@example.com, person1@example.com and 12 others");
    expect(peopleSummary({ to: [p("a@x.com", "Ada Obi"), p("b@x.com", "Bola Ade"), p("c@x.com")], cc: [] })).toBe("to Ada, Bola and 1 other");
    expect(peopleSummary({ to: [], cc: [] })).toBe("to (undisclosed recipients)");
  });
});

import React from "react";
import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import { afterEach } from "vitest";
import { MessageReader } from "./MessageReader";
import type { FullMessage } from "./api";

describe("the people on an email", () => {
  afterEach(cleanup);

  it("opens into a full From / To / Cc list with each person shown", () => {
    const cc = Array.from({ length: 14 }, (_, i) => p(`person${i}@example.com`, i === 0 ? "Chidi Okafor" : null));
    const message: FullMessage = {
      uid: 1, subject: "Board meeting", from: p("ada@example.com", "Ada Obi"), to: [p("caleb@naitalk.com", "Caleb Adeleye")], date: "2026-11-27T10:00:00Z",
      seen: true, flagged: false, answered: false, has_attachments: false, snippet: "", cc, reply_to: [], message_id: "<m@x>", references: "",
      html: "<p>Hi</p>", text: "Hi", has_remote_images: false, attachments: [], labels: [], suggested_label: null,
    };
    render(React.createElement(MessageReader, { message, token: "gm_x", folder: "INBOX", isJunk: false, isLoading: false, onAction: () => undefined, extras: { onLabel: () => undefined, onSessionError: () => undefined } }));

    const summary = screen.getByRole("button", { name: /to Caleb · cc Chidi, person1@example.com and 12 others/ });
    expect(screen.queryByText("person13@example.com")).toBeNull();
    fireEvent.click(summary);
    expect(screen.getByText("Chidi Okafor")).toBeTruthy();
    expect(screen.getByText("(14)")).toBeTruthy();
    expect(screen.queryByText("person13@example.com")).toBeNull(); // first 8, then "Show all"
    fireEvent.click(screen.getByRole("button", { name: "Show all 14" }));
    expect(screen.getByText("person13@example.com")).toBeTruthy();
  });
});
