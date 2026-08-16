import { act, renderHook } from "@testing-library/react";
import { beforeEach, describe, expect, it } from "vitest";

import { CartProvider, useCart } from "./CartContext.jsx";

/**
 * The cart is the most logic-heavy piece of client state in the app: a reducer,
 * quantity clamping, deduplication, a running total, and localStorage
 * persistence. That combination is exactly where bugs hide, so it earns the
 * most tests.
 */

const IGNIS = {
  slug: "ignis",
  name: "FoNix Ignis",
  base_price: "2400000.00",
  thumbnail: "/ignis.webp",
  thumbnail_alt: "The Ignis",
  max_order_quantity: 1,
};
const AUREA = {
  slug: "aurea",
  name: "FoNix Aurea",
  base_price: "890000.00",
  thumbnail: "/aurea.webp",
  thumbnail_alt: "The Aurea",
  max_order_quantity: 1,
};

function renderCart() {
  return renderHook(() => useCart(), { wrapper: CartProvider });
}

beforeEach(() => {
  window.localStorage.clear();
});

describe("adding items", () => {
  it("starts empty", () => {
    const { result } = renderCart();
    expect(result.current.isEmpty).toBe(true);
    expect(result.current.itemCount).toBe(0);
    expect(result.current.subtotal).toBe(0);
  });

  it("adds a car as a new line", () => {
    const { result } = renderCart();
    act(() => result.current.addItem(IGNIS, 1));

    expect(result.current.lines).toHaveLength(1);
    expect(result.current.lines[0].slug).toBe("ignis");
    expect(result.current.itemCount).toBe(1);
  });

  it("merges a repeat add into the existing line instead of duplicating it", () => {
    const { result } = renderCart();
    act(() => result.current.addItem(IGNIS, 1));
    act(() => result.current.addItem(IGNIS, 1));

    // One line, still quantity 1 -- an allocation is one car. The server
    // unique-constrains (order, car) the same way.
    expect(result.current.lines).toHaveLength(1);
    expect(result.current.lines[0].quantity).toBe(1);
  });

  it("replaces the configuration when the same car is added again", () => {
    const { result } = renderCart();
    act(() =>
      result.current.addItem(IGNIS, 1, [
        { id: 1, name: "Obsidian", price_delta: "0.00" },
      ]),
    );
    act(() =>
      result.current.addItem(IGNIS, 1, [
        { id: 2, name: "Ember", price_delta: "12400.00" },
      ]),
    );

    expect(result.current.lines).toHaveLength(1);
    expect(result.current.lines[0].optionLabels).toEqual(["Ember"]);
    expect(result.current.lines[0].price).toBe(2412400);
  });

  it("keeps different cars as separate lines", () => {
    const { result } = renderCart();
    act(() => result.current.addItem(IGNIS, 1));
    act(() => result.current.addItem(AUREA, 1));

    expect(result.current.lines).toHaveLength(2);
    expect(result.current.itemCount).toBe(2);
  });

  it("only stores the fields the cart renders, not the whole car object", () => {
    const { result } = renderCart();
    act(() => result.current.addItem({ ...IGNIS, description: "secret" }, 1));

    expect(result.current.lines[0]).not.toHaveProperty("description");
  });
});

describe("quantity", () => {
  it("clamps to the car's max_order_quantity, defaulting to 1", () => {
    const { result } = renderCart();
    act(() => result.current.addItem(IGNIS, 1));
    act(() => result.current.setQuantity("ignis", 999));

    expect(result.current.lines[0].quantity).toBe(result.current.maxQuantity);
    expect(result.current.maxQuantity).toBe(1);
  });

  it("clamps to a minimum of 1", () => {
    const { result } = renderCart();
    act(() => result.current.addItem(IGNIS, 1));
    act(() => result.current.setQuantity("ignis", 0));

    expect(result.current.lines[0].quantity).toBe(1);
  });

  it("caps the quantity even when adding pushes past the max", () => {
    const { result } = renderCart();
    act(() => result.current.addItem(IGNIS, 1));
    act(() => result.current.addItem(IGNIS, 1));

    expect(result.current.lines[0].quantity).toBe(1);
  });
});

describe("removal and clearing", () => {
  it("removes a single line by slug", () => {
    const { result } = renderCart();
    act(() => result.current.addItem(IGNIS, 1));
    act(() => result.current.addItem(AUREA, 1));
    act(() => result.current.removeItem("ignis"));

    expect(result.current.lines).toHaveLength(1);
    expect(result.current.lines[0].slug).toBe("aurea");
  });

  it("empties the whole cart", () => {
    const { result } = renderCart();
    act(() => result.current.addItem(IGNIS, 1));
    act(() => result.current.addItem(AUREA, 1));
    act(() => result.current.clearCart());

    expect(result.current.isEmpty).toBe(true);
  });
});

describe("subtotal", () => {
  it("sums price times quantity across lines", () => {
    const { result } = renderCart();
    act(() => result.current.addItem(IGNIS, 1));
    act(() => result.current.addItem(AUREA, 1));

    expect(result.current.subtotal).toBe(3290000);
  });
});

describe("persistence", () => {
  it("writes the cart to localStorage on change", () => {
    const { result } = renderCart();
    act(() => result.current.addItem(IGNIS, 1));

    const stored = JSON.parse(window.localStorage.getItem("fonix.cart.v2"));
    expect(stored).toHaveLength(1);
    expect(stored[0].quantity).toBe(1);
  });

  it("restores a persisted cart on mount", () => {
    window.localStorage.setItem(
      "fonix.cart.v2",
      JSON.stringify([{ ...IGNIS, price: IGNIS.base_price, quantity: 1 }]),
    );

    const { result } = renderCart();
    expect(result.current.lines).toHaveLength(1);
    expect(result.current.itemCount).toBe(1);
  });

  it("ignores malformed localStorage rather than crashing", () => {
    window.localStorage.setItem("fonix.cart.v2", "{not valid json");

    const { result } = renderCart();
    expect(result.current.isEmpty).toBe(true);
  });

  it("filters out malformed line entries", () => {
    window.localStorage.setItem(
      "fonix.cart.v2",
      JSON.stringify([
        { slug: "ignis", price: "1", quantity: 1 },
        { garbage: true },
        { slug: "x", quantity: "not a number" },
      ]),
    );

    const { result } = renderCart();
    expect(result.current.lines).toHaveLength(1);
    expect(result.current.lines[0].slug).toBe("ignis");
  });
});
