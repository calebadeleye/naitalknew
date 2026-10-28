import React from "react";
import { act, cleanup, fireEvent, render, screen } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const calls: Array<{ path: string; method?: string; body?: FormData }> = [];
let nextUid = 100;

vi.mock("./api", async (original) => ({
  ...(await original<typeof import("./api")>()),
  gm: vi.fn(async (path: string, _token: string, options: RequestInit = {}) => {
    calls.push({ path, method: options.method, body: options.body instanceof FormData ? options.body : undefined });
    if (path === "/drafts") return { message: "Draft saved.", draft_uid: ++nextUid };
    if (path === "/send") return { message: "Sent." };
    if (path === "/templates") return { templates: [] };
    return {};
  }),
}));

import { Composer } from "./Composer";
import { FeedbackProvider } from "./feedback";

const draft = { to: "", cc: "", bcc: "", subject: "", bodyHtml: '<p class="gm-start"><br></p>' };

function open(props: Partial<React.ComponentProps<typeof Composer>> = {}) {
  const onSent = vi.fn();
  const onClose = vi.fn();
  render(
    <FeedbackProvider>
      <Composer token="gm_t" email="me@x.test" draft={draft} variant="window" onSent={onSent} onClose={onClose} onSessionError={() => undefined} {...props} />
    </FeedbackProvider>,
  );
  return { onSent, onClose };
}

const drafts = () => calls.filter((c) => c.path === "/drafts");

describe("Composer drafts save by themselves", () => {
  beforeEach(() => {
    vi.useFakeTimers();
    calls.length = 0;
    nextUid = 100;
    Object.defineProperty(navigator, "onLine", { value: true, configurable: true });
  });
  afterEach(() => {
    cleanup();
    vi.useRealTimers();
  });

  it("saves nothing until the person changes something, then once after they pause", async () => {
    open();
    await act(async () => void vi.advanceTimersByTime(10000));
    expect(drafts()).toHaveLength(0);

    fireEvent.change(screen.getAllByRole("textbox")[0], { target: { value: "ada@example.com" } });
    await act(async () => void vi.advanceTimersByTime(2000));
    expect(drafts()).toHaveLength(0);
    await act(async () => void vi.advanceTimersByTime(1500));
    expect(drafts()).toHaveLength(1);
    expect(drafts()[0].body?.get("to")).toBe("ada@example.com");
    expect(drafts()[0].body?.get("draft_uid")).toBeNull();
  });

  it("each save replaces the one before it", async () => {
    open();
    const to = screen.getAllByRole("textbox")[0];
    fireEvent.change(to, { target: { value: "ada@example.com" } });
    await act(async () => void vi.advanceTimersByTime(3500));
    fireEvent.change(to, { target: { value: "ada@example.com, bo@example.com" } });
    await act(async () => void vi.advanceTimersByTime(3500));

    expect(drafts()).toHaveLength(2);
    expect(drafts()[1].body?.get("draft_uid")).toBe("101");
  });

  it("an opened draft keeps replacing itself, and sending it clears it", async () => {
    const { onSent } = open({ draft: { ...draft, to: "ada@example.com", subject: "Plan", draftUid: 55 } });
    fireEvent.change(screen.getByDisplayValue("Plan"), { target: { value: "Plan B" } });
    await act(async () => void vi.advanceTimersByTime(3500));
    expect(drafts()[0].body?.get("draft_uid")).toBe("55");

    await act(async () => void fireEvent.click(screen.getAllByRole("button", { name: /^send$/i })[0]));
    const send = calls.find((c) => c.path === "/send");
    expect(send?.body?.get("draft_uid")).toBe("101");
    expect(onSent).toHaveBeenCalled();
    await act(async () => void vi.advanceTimersByTime(20000));
    expect(drafts()).toHaveLength(1);
  });

  it("discarding removes the saved draft and doesn't save again", async () => {
    const { onClose } = open();
    fireEvent.change(screen.getAllByRole("textbox")[0], { target: { value: "ada@example.com" } });
    await act(async () => void vi.advanceTimersByTime(3500));
    await act(async () => void fireEvent.click(screen.getByRole("button", { name: "Discard" })));

    expect(calls.some((c) => c.method === "DELETE" && c.path.startsWith("/messages/101?folder=Drafts"))).toBe(true);
    expect(onClose).toHaveBeenCalled();
    await act(async () => void vi.advanceTimersByTime(20000));
    expect(drafts()).toHaveLength(1);
  });

  it("closing with unsaved changes saves them first", async () => {
    open();
    fireEvent.change(screen.getAllByRole("textbox")[0], { target: { value: "ada@example.com" } });
    cleanup();
    await act(async () => void vi.advanceTimersByTime(0));
    expect(drafts()).toHaveLength(1);
  });

  it("doesn't try while offline", async () => {
    Object.defineProperty(navigator, "onLine", { value: false, configurable: true });
    open();
    fireEvent.change(screen.getAllByRole("textbox")[0], { target: { value: "ada@example.com" } });
    await act(async () => void vi.advanceTimersByTime(20000));
    expect(drafts()).toHaveLength(0);
  });
});
