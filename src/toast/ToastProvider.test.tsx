import { act, render, screen, waitFor } from "@testing-library/react";
import { useCallback, useEffect } from "react";
import userEvent from "@testing-library/user-event";
import { afterEach, describe, expect, it, vi } from "vitest";
import { ToastProvider, useToast } from "./ToastProvider";

function TriggerButtons() {
  const toast = useToast();
  return (
    <>
      <button onClick={() => toast.push({ type: "success", message: "Saved successfully" })}>push-success</button>
      <button onClick={() => toast.push({ type: "error", message: "Something failed" })}>push-error</button>
    </>
  );
}

describe("ToastProvider", () => {
  afterEach(() => {
    vi.useRealTimers();
  });

  it("an error toast doesn't re-run a loader that depends on it", async () => {
    let calls = 0;
    function FailingLoader() {
      const toast = useToast();
      const load = useCallback(() => {
        calls += 1;
        toast.push({ type: "error", message: "Could not load" });
      }, [toast]);
      useEffect(() => load(), [load]);
      return null;
    }

    render(
      <ToastProvider>
        <FailingLoader />
      </ToastProvider>,
    );

    await screen.findByText("Could not load");
    await act(async () => {
      await new Promise((resolve) => setTimeout(resolve, 50));
    });
    expect(calls).toBe(1);
  });

  it("auto-dismisses a success toast after ~4.5s", async () => {
    vi.useFakeTimers({ shouldAdvanceTime: true });
    const user = userEvent.setup({ delay: null });
    render(
      <ToastProvider>
        <TriggerButtons />
      </ToastProvider>,
    );

    await user.click(screen.getByText("push-success"));
    expect(screen.getByText("Saved successfully")).toBeInTheDocument();

    act(() => {
      vi.advanceTimersByTime(4600);
    });

    await waitFor(() => expect(screen.queryByText("Saved successfully")).not.toBeInTheDocument());
  });

  it("dismisses immediately when the close button is clicked", async () => {
    const user = userEvent.setup({ delay: null });
    render(
      <ToastProvider>
        <TriggerButtons />
      </ToastProvider>,
    );

    await user.click(screen.getByText("push-error"));
    expect(screen.getByText("Something failed")).toBeInTheDocument();

    await user.click(screen.getByRole("button", { name: /dismiss notification/i }));
    await waitFor(() => expect(screen.queryByText("Something failed")).not.toBeInTheDocument());
  });

  it("clears all toasts when a naitalk:navigate event fires", async () => {
    const user = userEvent.setup({ delay: null });
    render(
      <ToastProvider>
        <TriggerButtons />
      </ToastProvider>,
    );

    await user.click(screen.getByText("push-success"));
    await user.click(screen.getByText("push-error"));
    expect(screen.getByText("Saved successfully")).toBeInTheDocument();
    expect(screen.getByText("Something failed")).toBeInTheDocument();

    act(() => {
      window.dispatchEvent(new Event("naitalk:navigate"));
    });

    await waitFor(() => {
      expect(screen.queryByText("Saved successfully")).not.toBeInTheDocument();
      expect(screen.queryByText("Something failed")).not.toBeInTheDocument();
    });
  });
});
