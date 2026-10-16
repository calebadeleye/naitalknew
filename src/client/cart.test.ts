import { beforeEach, describe, expect, it } from "vitest";
import { addToCart, clearCart, MAX_CART_LINES, removeFromCart, setCartOwner, toApiLines, useCart } from "./cart";

const lines = () => JSON.parse(window.localStorage.getItem("naitalk_cart:ada@example.com") || "[]");

describe("cart", () => {
  beforeEach(() => {
    window.localStorage.clear();
    setCartOwner("");
    setCartOwner("Ada@Example.com");
    clearCart();
  });

  it("keeps several items and sends the server only what was chosen (no ids, no prices)", () => {
    addToCart({ type: "hosting", plan_slug: "business-website-care", primary_domain: "shop.com", add_ons: [], register_domain: false });
    addToCart({ type: "domain", domain_name: "newname.com" });
    addToCart({ type: "service", offering: "ssl-certificate", domain: "shop.com" });

    expect(lines()).toHaveLength(3);
    expect(toApiLines(lines())).toEqual([
      { type: "hosting", plan_slug: "business-website-care", primary_domain: "shop.com", add_ons: [], register_domain: false },
      { type: "domain", domain_name: "newname.com" },
      { type: "service", offering: "ssl-certificate", domain: "shop.com" },
    ]);
  });

  it("adding the same thing again updates it instead of duplicating it", () => {
    addToCart({ type: "hosting", plan_slug: "starter-website-care", primary_domain: "shop.com", add_ons: [], register_domain: false });
    const again = addToCart({ type: "hosting", plan_slug: "business-website-care", primary_domain: "shop.com", add_ons: [], register_domain: true });

    expect(again).toEqual({ added: true, replaced: true, full: false });
    expect(lines()).toHaveLength(1);
    expect(lines()[0].plan_slug).toBe("business-website-care");
  });

  it("removes one item, and stops at the limit", () => {
    for (let i = 0; i < MAX_CART_LINES; i++) addToCart({ type: "domain", domain_name: `name${i}.com` });
    expect(addToCart({ type: "domain", domain_name: "one-too-many.com" })).toEqual({ added: false, replaced: false, full: true });

    removeFromCart(lines()[0].id);
    expect(lines()).toHaveLength(MAX_CART_LINES - 1);
  });

  it("gives each account its own cart on a shared device", () => {
    addToCart({ type: "domain", domain_name: "adas.com" });
    setCartOwner("bola@example.com");
    expect(window.localStorage.getItem("naitalk_cart:bola@example.com")).toBeNull();
    expect(typeof useCart).toBe("function");
    addToCart({ type: "domain", domain_name: "bolas.com" });

    setCartOwner("ada@example.com");
    expect(lines().map((line: { domain_name: string }) => line.domain_name)).toEqual(["adas.com"]);
  });
});
