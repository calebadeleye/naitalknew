import React from "react";
import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import { ContactUploadDialog } from "./ContactUpload";

describe("contact upload dialog", () => {
  afterEach(() => {
    cleanup();
    vi.unstubAllGlobals();
  });

  it("previews the people and saves them into a new group named after the file", async () => {
    const result = { message: "2 added · in the group “Church members”.", created: 2, contact_ids: [7, 8], group: { id: 3, name: "Church members", contacts_count: 2 } };
    vi.stubGlobal("fetch", vi.fn(async () => new Response(JSON.stringify(result), { status: 200 })));
    const onImported = vi.fn();
    const contacts = [
      { email: "ada@example.com", name: "Ada Obi", phone: null, company: null },
      { email: "bola@example.com", name: null, phone: "0803", company: null },
    ];

    render(
      <ContactUploadDialog
        token="gm_x"
        file={{ name: "church_members.csv", read: { contacts, withoutEmail: 1 } }}
        groups={[{ id: 1, name: "Customers", contacts_count: 40 }]}
        onClose={vi.fn()}
        onImported={onImported}
        onSessionError={vi.fn()}
      />,
    );
    expect(screen.getByText(/1 row without an email address skipped/)).toBeTruthy();
    expect(screen.getByText("ada@example.com")).toBeTruthy();
    expect((screen.getByLabelText("New group name") as HTMLInputElement).value).toBe("church members");
    fireEvent.change(screen.getByLabelText("New group name"), { target: { value: "Church members" } });

    fireEvent.click(screen.getByRole("button", { name: /Add 2 contacts/ }));
    await vi.waitFor(() => expect(onImported).toHaveBeenCalledWith(result, true));
    const [url, init] = (fetch as unknown as { mock: { calls: Array<[string, RequestInit]> } }).mock.calls[0];
    expect(url).toContain("/contacts/import");
    expect(JSON.parse(String(init.body))).toEqual({ contacts, group_id: null, group_name: "Church members" });
  });
});
