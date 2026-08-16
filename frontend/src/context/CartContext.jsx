import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useReducer,
} from "react";

const CartContext = createContext(null);

const STORAGE_KEY = "fonix.cart.v2";
// Versioned key. v1 stored quantity up to 10 and no options; bumping retires
// those carts instead of feeding the old shape into allocation checkout.

const DEFAULT_MAX_QUANTITY = 1;

function maxFor(car, line) {
  return Math.max(
    1,
    Number(car?.max_order_quantity ?? line?.maxQuantity ?? DEFAULT_MAX_QUANTITY),
  );
}

function configuredPrice(car, options) {
  const extra = (options ?? []).reduce(
    (sum, option) => sum + Number(option.price_delta || 0),
    0,
  );
  return Number(car.base_price) + extra;
}

function toLine(car, quantity, options) {
  const maxQuantity = maxFor(car);
  const selected = options ?? [];
  return {
    slug: car.slug,
    name: car.name,
    price: configuredPrice(car, selected),
    thumbnail: car.thumbnail,
    thumbnailAlt: car.thumbnail_alt,
    quantity: Math.min(quantity, maxQuantity),
    maxQuantity,
    optionIds: selected.map((option) => option.id),
    optionLabels: selected.map((option) => option.name),
  };
}

/**
 * Cart state is a reducer rather than a pile of useState calls.
 *
 * Every mutation here is "read the current lines, return new lines", and a
 * reducer makes that explicit and testable. It also removes a real bug class:
 * with useState, two rapid clicks on "add" can both read the same stale array
 * and one increment is lost. A reducer always sees the latest state.
 *
 * One line per car: the API unique-constrains (order, car), so a second add
 * of the same slug replaces the configuration rather than duplicating it.
 */
function cartReducer(lines, action) {
  switch (action.type) {
    case "add": {
      const { car, quantity, options } = action;
      const next = toLine(car, quantity, options);
      const existing = lines.find((line) => line.slug === car.slug);

      if (existing) {
        const cap = maxFor(car, existing);
        return lines.map((line) =>
          line.slug === car.slug
            ? {
                ...next,
                quantity: Math.min(existing.quantity, cap),
              }
            : line,
        );
      }

      return [...lines, next];
    }

    case "setQuantity": {
      return lines.map((line) => {
        if (line.slug !== action.slug) return line;
        const cap = maxFor(null, line);
        return {
          ...line,
          quantity: Math.max(1, Math.min(action.quantity, cap)),
        };
      });
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

  const addItem = useCallback((car, quantity = 1, options = []) => {
    dispatch({ type: "add", car, quantity, options });
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
      maxQuantity: DEFAULT_MAX_QUANTITY,
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
