import { render, screen, waitFor, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import App from "./App";
import { ToastProvider } from "./toast/ToastProvider";

function setPath(path: string) {
  window.history.pushState(null, "", path);
}

function renderAt(path: string) {
  setPath(path);
  return render(
    <ToastProvider>
      <App />
    </ToastProvider>,
  );
}

// /get-a-website and /get-a-website/thank-you are React.lazy()-loaded chunks,
// so only the Suspense loading fallback is in the DOM on the first
// synchronous render. Wait for it to resolve before querying page content.
async function waitForRouteReady() {
  await waitFor(() => expect(screen.queryByRole("status", { name: "Loading page" })).not.toBeInTheDocument(), {
    timeout: 5000,
  });
}

// jsdom's window.location.assign is non-configurable, so it can't be spied on
// directly — swap the whole property for a plain object that carries over
// the current pathname/search (already set via setPath before this runs)
// plus a mockable assign(), and restore the real Location afterwards.
const realLocation = window.location;

function mockLocationAssign(): ReturnType<typeof vi.fn> {
  const assign = vi.fn();
  Object.defineProperty(window, "location", {
    configurable: true,
    value: { ...realLocation, assign },
  });
  return assign;
}

const validFormValues = {
  name: "Ada Lovelace",
  phone: "08012345678",
  email: "ada@example.test",
  description: "I need a modern website for my consulting business with a booking form.",
};

async function fillValidForm(user: ReturnType<typeof userEvent.setup>) {
  await user.type(screen.getByLabelText("Name"), validFormValues.name);
  await user.type(screen.getByLabelText("Phone or WhatsApp number"), validFormValues.phone);
  await user.type(screen.getByLabelText("Email address"), validFormValues.email);
  await user.selectOptions(screen.getByLabelText("Type of website required"), "Business or Corporate Website");
  await user.selectOptions(screen.getByLabelText("Estimated budget"), "₦200,000 – ₦400,000");
  await user.type(screen.getByLabelText("Short project description"), validFormValues.description);
}

describe("/get-a-website landing page", () => {
  beforeEach(() => {
    sessionStorage.clear();
    vi.restoreAllMocks();
  });

  afterEach(() => {
    Object.defineProperty(window, "location", { configurable: true, value: realLocation });
  });

  it("renders with all six required quote-form fields", async () => {
    renderAt("/get-a-website");
    await waitForRouteReady();

    expect(screen.getByRole("heading", { name: /get a professional website/i })).toBeInTheDocument();
    expect(screen.getByLabelText("Name")).toBeInTheDocument();
    expect(screen.getByLabelText("Phone or WhatsApp number")).toBeInTheDocument();
    expect(screen.getByLabelText("Email address")).toBeInTheDocument();
    expect(screen.getByLabelText("Type of website required")).toBeInTheDocument();
    expect(screen.getByLabelText("Estimated budget")).toBeInTheDocument();
    expect(screen.getByLabelText("Short project description")).toBeInTheDocument();
  });

  it("shows inline validation errors and does not call the API when required fields are empty", async () => {
    const fetchMock = vi.fn();
    vi.stubGlobal("fetch", fetchMock);

    const user = userEvent.setup();
    renderAt("/get-a-website");
    await waitForRouteReady();

    await user.click(screen.getByRole("button", { name: /request my quote/i }));

    await waitFor(() => expect(screen.getByText("Please enter your name.")).toBeInTheDocument());
    expect(screen.getByText("Please enter a phone or WhatsApp number.")).toBeInTheDocument();
    expect(screen.getByText("Please enter your email address.")).toBeInTheDocument();
    // The hero's background image fetch (Pexels, via the public images-search
    // endpoint) fires on mount regardless of form state — only assert the
    // quote endpoint itself was never hit.
    expect(fetchMock.mock.calls.some(([url]) => String(url).includes("/public/website-quote"))).toBe(false);
  });

  it("redirects to the thank-you page with the reference after a successful submission", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn().mockResolvedValue({
        ok: true,
        json: async () => ({ status: "success", message: "Your website request has been received.", data: { reference: "NWT-20260716-0001" } }),
      }),
    );
    const user = userEvent.setup();
    renderAt("/get-a-website");
    await waitForRouteReady();
    const assignSpy = mockLocationAssign();

    await fillValidForm(user);
    await user.click(screen.getByRole("button", { name: /request my quote/i }));

    await waitFor(() => expect(assignSpy).toHaveBeenCalledWith("/get-a-website/thank-you?ref=NWT-20260716-0001"));
  });

  it("does not redirect and preserves entered values when the submission fails", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn().mockResolvedValue({
        ok: false,
        json: async () => ({ message: "We could not submit your request at the moment. Please try again or contact us through WhatsApp." }),
      }),
    );
    const user = userEvent.setup();
    renderAt("/get-a-website");
    await waitForRouteReady();
    const assignSpy = mockLocationAssign();

    await fillValidForm(user);
    await user.click(screen.getByRole("button", { name: /request my quote/i }));

    await waitFor(() =>
      expect(screen.getByText("We could not submit your request at the moment. Please try again or contact us through WhatsApp.")).toBeInTheDocument(),
    );
    expect(assignSpy).not.toHaveBeenCalled();
    expect((screen.getByLabelText("Name") as HTMLInputElement).value).toBe(validFormValues.name);
    expect((screen.getByLabelText("Email address") as HTMLInputElement).value).toBe(validFormValues.email);
  });

  it("includes UTM and gclid parameters from the URL in the submitted request body", async () => {
    const fetchMock = vi.fn().mockResolvedValue({
      ok: true,
      json: async () => ({ status: "success", message: "ok", data: { reference: "NWT-20260716-0002" } }),
    });
    vi.stubGlobal("fetch", fetchMock);

    const user = userEvent.setup();
    renderAt("/get-a-website?utm_source=google&utm_medium=cpc&utm_campaign=website-design-lagos&gclid=test-gclid-123");
    await waitForRouteReady();
    mockLocationAssign();

    await fillValidForm(user);
    await user.click(screen.getByRole("button", { name: /request my quote/i }));

    await waitFor(() => expect(fetchMock).toHaveBeenCalled());

    const call = fetchMock.mock.calls.find(([url]) => String(url).includes("/public/website-quote"));
    expect(call).toBeTruthy();
    const body = JSON.parse((call as [string, RequestInit])[1]?.body as string);

    expect(body.utm_source).toBe("google");
    expect(body.utm_medium).toBe("cpc");
    expect(body.utm_campaign).toBe("website-design-lagos");
    expect(body.gclid).toBe("test-gclid-123");
  });

  it("has working anchor navigation links to on-page sections", async () => {
    renderAt("/get-a-website");
    await waitForRouteReady();

    // The header nav and the footer's Quick Links both link to these
    // anchors, so scope to the header nav specifically.
    const headerNav = screen.getByRole("banner").querySelector("nav") as HTMLElement;
    expect(within(headerNav).getByRole("link", { name: "What's Included" })).toHaveAttribute("href", "#included");
    expect(within(headerNav).getByRole("link", { name: "Our Work" })).toHaveAttribute("href", "#work");
    expect(within(headerNav).getByRole("link", { name: "Process" })).toHaveAttribute("href", "#process");
  });

  it("Get a Quote CTA buttons link to the quote form", async () => {
    renderAt("/get-a-website");
    await waitForRouteReady();

    const ctaButtons = screen.getAllByRole("link", { name: /get a quote/i });
    expect(ctaButtons.length).toBeGreaterThan(0);
    ctaButtons.forEach((button) => expect(button).toHaveAttribute("href", "#quote-form"));
  });
});

describe("/get-a-website/thank-you page", () => {
  beforeEach(() => {
    sessionStorage.clear();
    vi.restoreAllMocks();
  });

  it("renders the confirmation heading and the reference from the URL", async () => {
    renderAt("/get-a-website/thank-you?ref=NWT-20260716-0001");
    await waitForRouteReady();

    expect(screen.getByRole("heading", { name: /thank you/i })).toBeInTheDocument();
    expect(await screen.findByText(/NWT-20260716-0001/)).toBeInTheDocument();
  });

  it("refreshing the thank-you route directly does not 404 (renders normally)", async () => {
    renderAt("/get-a-website/thank-you");
    await waitForRouteReady();

    expect(screen.getByRole("heading", { name: /thank you/i })).toBeInTheDocument();
  });
});
