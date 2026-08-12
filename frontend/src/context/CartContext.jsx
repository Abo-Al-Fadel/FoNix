import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useReducer,
} from "react";

const CartContext = createContext(null);

const STORAGE_KEY = "fonix.cart.v1";
// Versioned key. If the stored line shape ever changes, bumping to v2 retires
// every old cart cleanly instead of feeding stale objects into new code.

const MAX_QUANTITY = 10; // Mirrors the server's per-line cap.

/**
 * Cart state is a reducer rather than a pile of useState calls.
 *
 * Every mutation here is "read the current lines, return new lines", and a
 * reducer makes that explicit and testable. It also removes a real bug class:
 * with useState, two rapid clicks on "add" can both read the same stale array
 * and one increment is lost. A reducer always sees the latest state.
 */
function cartReducer(lines, action) {
  switch (action.type) {
    case "add": {
      const { car, quantity } = action;
      const existing = lines.find((line) => line.slug === car.slug);

      if (existing) {
        return lines.map((line) =>
          line.slug === car.slug
            ? {
                ...line,
                quantity: Math.min(line.quantity + quantity, MAX_QUANTITY),
              }
            : line,
        );
      }

      return [
        ...lines,
        {
          // Only the fields the cart page renders are stored, plus the slug the
          // checkout posts. Deliberately *not* the whole car object: a cart
          // sitting in localStorage for a week should not resurrect a stale
          // description, and the price shown is re-verified server-side at
          // checkout anyway.
          slug: car.slug,
          name: car.name,
          price: car.base_price,
          thumbnail: car.thumbnail,
          thumbnailAlt: car.thumbnail_alt,
          quantity: Math.min(quantity, MAX_QUANTITY),
        },
      ];
    }

    case "setQuantity": {
      const quantity = Math.max(1, Math.min(action.quantity, MAX_QUANTITY));
      return lines.map((line) =>
        line.slug === action.slug ? { ...line, quantity } : line,
      );
    }

    case "remove":
      return lines.filter((line) => line.slug !== action.slug);

    case "clear":
      return [];

    default:
      throw new Error(`Unknown cart action: ${action.type}`);
  }
}

/**
 * Read the persisted cart.
 *
 * Passed to useReducer as a lazy initialiser (the third argument) so it runs
 * once on mount rather than on every render.
 */
function loadCart() {
  try {
    const stored = window.localStorage.getItem(STORAGE_KEY);
    if (!stored) return [];

    const parsed = JSON.parse(stored);
    if (!Array.isArray(parsed)) return [];

    // Anything in localStorage is untrusted input -- a user can edit it by
    // hand, and an older version of this app may have written a different
    // shape. Filtering to well-formed lines here stops a malformed entry
    // crashing the cart page on render.
    return parsed.filter(
      (line) =>
        line &&
        typeof line.slug === "string" &&
        Number.isFinite(Number(line.quantity)),
    );
  } catch {
    return [];
  }
}

export function CartProvider({ children }) {
  const [lines, dispatch] = useReducer(cartReducer, undefined, loadCart);

  // Persist on every change. One effect watching the whole array is simpler and
  // less error-prone than writing to localStorage inside each action.
  useEffect(() => {
    try {
      window.localStorage.setItem(STORAGE_KEY, JSON.stringify(lines));
    } catch {
      // Quota exceeded or storage disabled: the cart still works for this
      // session, it just won't survive a refresh. Not worth interrupting the
      // user over.
    }
  }, [lines]);

  const addItem = useCallback((car, quantity = 1) => {
    dispatch({ type: "add", car, quantity });
  }, []);

  const setQuantity = useCallback((slug, quantity) => {
    dispatch({ type: "setQuantity", slug, quantity });
  }, []);

  const removeItem = useCallback((slug) => {
    dispatch({ type: "remove", slug });
  }, []);

  const clearCart = useCallback(() => dispatch({ type: "clear" }), []);

  const value = useMemo(() => {
    // Money is arithmetic on values that arrive from the API as strings
    // ("2400000.00"). Number() is correct here because this total is only ever
    // *displayed* -- the authoritative figure is computed server-side by
    // Order.total, so a floating point rounding artefact can never become the
    // amount someone is actually charged.
    const subtotal = lines.reduce(
      (running, line) => running + Number(line.price) * line.quantity,
      0,
    );

    return {
      lines,
      itemCount: lines.reduce((count, line) => count + line.quantity, 0),
      subtotal,
      isEmpty: lines.length === 0,
      addItem,
      setQuantity,
      removeItem,
      clearCart,
      maxQuantity: MAX_QUANTITY,
    };
  }, [lines, addItem, setQuantity, removeItem, clearCart]);

  return <CartContext.Provider value={value}>{children}</CartContext.Provider>;
}

export function useCart() {
  const context = useContext(CartContext);
  if (!context) {
    throw new Error("useCart must be used inside a <CartProvider>.");
  }
  return context;
}
