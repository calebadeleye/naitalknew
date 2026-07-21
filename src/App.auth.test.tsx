import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { beforeEach, describe, expect, it, vi } from "vitest";
import App from "./App";
import { ToastProvider } from "./toast/ToastProvider";

function setPath(path: string) {
  window.history.pushState(null, "", path);
}

function renderClientPortal(path: string) {
  setPath(path);
  return render(
    <ToastProvider>
      <App />
    </ToastProvider>,
  );
}

// /client is now a React.lazy()-loaded chunk, so its content isn't in the DOM
// on the first synchronous render -- only the Suspense loading fallback is.
// Wait for that fallback to disappear before querying for real page content.
async function waitForClientPortalReady() {
  await waitFor(() => expect(screen.queryByRole("status", { name: "Loading page" })).not.toBeInTheDocument(), {
    timeout: 15000,
  });
}

describe("Client login/register form-state security", () => {
  beforeEach(() => {
    sessionStorage.clear();
    vi.restoreAllMocks();
  });

  it("clears the password field but keeps the email after a failed login", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn().mockResolvedValue({
        ok: false,
        json: async () => ({ message: "The provided credentials are incorrect." }),
      }),
    );

    const user = userEvent.setup();
    renderClientPortal("/client/login");
    await waitForClientPortalReady();

    const emailInput = screen.getByPlaceholderText("john@naitalk.test");
    const passwordInput = document.querySelector('input[autocomplete="current-password"]') as HTMLInputElement;

    await user.type(emailInput, "john@naitalk.test");
    await user.type(passwordInput, "wrong-password");
    await user.click(screen.getByRole("button", { name: /sign in/i }));

    await waitFor(() => expect(screen.getByText("The provided credentials are incorrect.")).toBeInTheDocument());

    expect((emailInput as HTMLInputElement).value).toBe("john@naitalk.test");
    expect(passwordInput.value).toBe("");
  });

  it("clears both password fields but keeps name/email when register passwords do not match", async () => {
    const fetchMock = vi.fn();
    vi.stubGlobal("fetch", fetchMock);

    const user = userEvent.setup();
    renderClientPortal("/client/register");
    await waitForClientPortalReady();

    await user.type(document.querySelector('input[autocomplete="name"]') as HTMLInputElement, "Jane Doe");
    await user.type(document.querySelector('input[autocomplete="email"]') as HTMLInputElement, "jane@example.com");

    const passwordInputs = document.querySelectorAll('input[autocomplete="new-password"]');
    await user.type(passwordInputs[0] as HTMLInputElement, "password123");
    await user.type(passwordInputs[1] as HTMLInputElement, "different456");

    await user.click(screen.getByRole("button", { name: /create account/i }));

    await waitFor(() => expect(screen.getByText("Passwords do not match.")).toBeInTheDocument());

    expect(fetchMock).not.toHaveBeenCalled();
    expect((document.querySelector('input[autocomplete="name"]') as HTMLInputElement).value).toBe("Jane Doe");
    expect((document.querySelector('input[autocomplete="email"]') as HTMLInputElement).value).toBe("jane@example.com");
    expect((document.querySelectorAll('input[autocomplete="new-password"]')[0] as HTMLInputElement).value).toBe("");
    expect((document.querySelectorAll('input[autocomplete="new-password"]')[1] as HTMLInputElement).value).toBe("");
  });

  it("clears all login form state and sessionStorage on logout", async () => {
    const emptyDashboard = {
      client: { name: "John Adewale", email: "john@naitalk.test", client_code: "CLT-1", account_type: "hosting_client", status: "active" },
      metrics: [],
      services: [],
      recent_invoice: null,
      tickets: [],
      empty_state: { title: "You do not have an active hosting service yet.", actions: [] },
    };

    vi.stubGlobal(
      "fetch",
      vi.fn().mockImplementation(async (url: string) => {
        if (url.includes("/auth/login")) {
          return { ok: true, json: async () => ({ token: "test-token", user: { role: "client", email: "john@naitalk.test" } }) };
        }
        if (url.includes("/client/dashboard")) {
          return { ok: true, json: async () => emptyDashboard };
        }
        if (url.includes("/auth/me")) {
          return { ok: true, json: async () => ({ user: { email: "john@naitalk.test", email_verified_at: new Date().toISOString() } }) };
        }
        if (url.includes("/auth/logout")) {
          return { ok: true, json: async () => ({ message: "Logged out." }) };
        }
        return { ok: true, json: async () => ({}) };
      }),
    );

    const user = userEvent.setup();
    renderClientPortal("/client/login");
    await waitForClientPortalReady();

    await user.type(screen.getByPlaceholderText("john@naitalk.test"), "john@naitalk.test");
    await user.type(document.querySelector('input[autocomplete="current-password"]') as HTMLInputElement, "password");
    await user.click(screen.getByRole("button", { name: /sign in/i }));

    await waitFor(() => expect(sessionStorage.getItem("naitalk_laravel_client_token")).toBe("test-token"));

    await waitFor(() => expect(screen.getByRole("button", { name: /^logout$/i })).toBeInTheDocument());
    await user.click(screen.getByRole("button", { name: /^logout$/i }));

    await waitFor(() => expect(sessionStorage.getItem("naitalk_laravel_client_token")).toBeNull());
    expect((screen.getByPlaceholderText("john@naitalk.test") as HTMLInputElement).value).toBe("");
    expect((document.querySelector('input[autocomplete="current-password"]') as HTMLInputElement).value).toBe("");
  });
});
