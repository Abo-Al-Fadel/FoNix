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
};
const AUREA = {
  slug: "aurea",
  name: "FoNix Aurea",
  base_price: "890000.00",
  thumbnail: "/aurea.webp",
  thumbnail_alt: "The Aurea",
};

// Every test gets the hook wrapped in a real provider.
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
    act(() => result.current.addItem(IGNIS, 2));

    // One line, quantity 3 -- not two lines. This is the dedup rule the server
    // also enforces with its unique (order, car) constraint.
    expect(result.current.lines).toHaveLength(1);
    expect(result.current.lines[0].quantity).toBe(3);
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

    // A stale description sitting in localStorage for a week would be worse than
    // useless, so the reducer copies only slug/name/price/thumbnail/quantity.
    expect(result.current.lines[0]).not.toHaveProperty("description");
  });
});

describe("quantity", () => {
  it("clamps to the maximum of 10", () => {
    const { result } = renderCart();
    act(() => result.current.addItem(IGNIS, 1));
    act(() => result.current.setQuantity("ignis", 999));

    expect(result.current.lines[0].quantity).toBe(result.current.maxQuantity);
    expect(result.current.maxQuantity).toBe(10);
  });

  it("clamps to a minimum of 1", () => {
    const { result } = renderCart();
    act(() => result.current.addItem(IGNIS, 1));
    act(() => result.current.setQuantity("ignis", 0));

    expect(result.current.lines[0].quantity).toBe(1);
  });

  it("caps the quantity even when adding pushes past the max", () => {
    const { result } = renderCart();
    act(() => result.current.addItem(IGNIS, 8));
    act(() => result.current.addItem(IGNIS, 8));

    expect(result.current.lines[0].quantity).toBe(10);
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
    act(() => result.current.addItem(IGNIS, 2)); // 4,800,000
    act(() => result.current.addItem(AUREA, 1)); //   890,000

    expect(result.current.subtotal).toBe(5690000);
  });
});

describe("persistence", () => {
  it("writes the cart to localStorage on change", () => {
    const { result } = renderCart();
    act(() => result.current.addItem(IGNIS, 2));

    const stored = JSON.parse(window.localStorage.getItem("fonix.cart.v1"));
    expect(stored).toHaveLength(1);
    expect(stored[0].quantity).toBe(2);
  });

  it("restores a persisted cart on mount", () => {
    window.localStorage.setItem(
      "fonix.cart.v1",
      JSON.stringify([{ ...IGNIS, price: IGNIS.base_price, quantity: 3 }]),
    );

    const { result } = renderCart();
    expect(result.current.lines).toHaveLength(1);
    expect(result.current.itemCount).toBe(3);
  });

  it("ignores malformed localStorage rather than crashing", () => {
    // A user can hand-edit localStorage, and an older app version may have
    // written a different shape. The cart must survive both.
    window.localStorage.setItem("fonix.cart.v1", "{not valid json");

    const { result } = renderCart();
    expect(result.current.isEmpty).toBe(true);
  });

  it("filters out malformed line entries", () => {
    window.localStorage.setItem(
      "fonix.cart.v1",
      JSON.stringify([
        { slug: "ignis", price: "1", quantity: 1 },
        { garbage: true }, // no slug -> dropped
        { slug: "x", quantity: "not a number" }, // bad quantity -> dropped
      ]),
    );

    const { result } = renderCart();
    expect(result.current.lines).toHaveLength(1);
    expect(result.current.lines[0].slug).toBe("ignis");
  });
});
