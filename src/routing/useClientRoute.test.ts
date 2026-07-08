import { act, renderHook } from "@testing-library/react";
import { afterEach, describe, expect, it } from "vitest";
import { navigateClient, useClientRoute } from "./useClientRoute";

function setPath(path: string) {
  window.history.pushState(null, "", path);
}

describe("useClientRoute", () => {
  afterEach(() => {
    setPath("/client/login");
  });

  it("parses known route segments", () => {
    setPath("/client/services/catalog");
    const { result } = renderHook(() => useClientRoute());
    expect(result.current.route).toBe("services-catalog");
  });

  it("defaults to login for unknown or root client paths", () => {
    setPath("/client/something-unknown");
    const { result } = renderHook(() => useClientRoute());
    expect(result.current.route).toBe("login");
  });

  it("updates route and search params after navigate()", () => {
    setPath("/client/login");
    const { result } = renderHook(() => useClientRoute());

    act(() => {
      result.current.navigate("/client/order/hosting?plan=business");
    });

    expect(result.current.route).toBe("order-hosting");
    expect(result.current.search.get("plan")).toBe("business");
  });

  it("navigateClient updates the URL without a full page reload", () => {
    setPath("/client/login");
    navigateClient("/client/dashboard");
    expect(window.location.pathname).toBe("/client/dashboard");
  });
});
