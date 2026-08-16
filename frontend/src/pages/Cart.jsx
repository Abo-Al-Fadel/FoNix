import { Link } from "react-router-dom";

import Button from "../components/ui/Button.jsx";
import PageHeader from "../components/ui/PageHeader.jsx";
import { EmptyState } from "../components/ui/StateBlock.jsx";
import { useAuth } from "../context/AuthContext.jsx";
import { useCart } from "../context/CartContext.jsx";
import { formatPrice } from "../lib/format.js";

export default function Cart() {
  const { lines, subtotal, isEmpty, setQuantity, removeItem } = useCart();
  const { isAuthenticated } = useAuth();

  if (isEmpty) {
    return (
      <div className="pb-24 md:pb-32">
        <PageHeader eyebrow="Your cart" title="Nothing selected yet." />
        <EmptyState title="Your cart is empty">
          <p className="mb-8">
            Configure a car from the range and it will appear here.
          </p>
          <Button to="/store">Browse the range</Button>
        </EmptyState>
      </div>
    );
  }

  return (
    <div className="pb-24 md:pb-32">
      <PageHeader
        eyebrow="Your cart"
        title={`${lines.length} ${lines.length === 1 ? "model" : "models"} selected`}
      />

      <div className="fx-container">
        <div className="grid gap-10 lg:grid-cols-[1.6fr_1fr] lg:gap-14">
          <ul className="list-none space-y-4">
            {lines.map((line) => (
              <li
                key={line.slug}
                className="flex flex-col gap-5 rounded-card border border-hairline bg-graphite/50 p-4 sm:flex-row sm:items-center sm:p-5"
              >
                <Link
                  to={`/store/${line.slug}`}
                  className="shrink-0 overflow-hidden rounded-card"
                >
                  <img
                    src={line.thumbnail}
                    alt={line.thumbnailAlt ?? line.name}
                    width={1600}
                    height={900}
                    className="aspect-16/9 w-full object-cover sm:w-40"
                  />
                </Link>

                <div className="min-w-0 flex-1">
                  <Link
                    to={`/store/${line.slug}`}
                    className="font-heading text-lg font-bold text-white transition-colors hover:text-ember"
                  >
                    {line.name}
                  </Link>
                  <p className="mt-1 font-body text-sm text-muted">
                    {formatPrice(line.price)}
                  </p>
                  {line.optionLabels?.length ? (
                    <p className="mt-1 font-body text-xs text-faint">
                      {line.optionLabels.join(" · ")}
                    </p>
                  ) : null}
                </div>

                <div className="flex items-center justify-between gap-4 sm:flex-col sm:items-end sm:gap-3">
                  {(line.maxQuantity ?? 1) > 1 ? (
                    <div className="flex items-center gap-3">
                      <label
                        htmlFor={`quantity-${line.slug}`}
                        className="sr-only"
                      >
                        Quantity of {line.name}
                      </label>
                      <div className="flex items-center rounded-full border border-hairline">
                        <button
                          type="button"
                          onClick={() => setQuantity(line.slug, line.quantity - 1)}
                          disabled={line.quantity <= 1}
                          aria-label={`Decrease quantity of ${line.name}`}
                          className="flex h-11 w-11 items-center justify-center rounded-full text-lg text-muted transition-colors hover:text-white disabled:opacity-30"
                        >
                          −
                        </button>
                        <input
                          id={`quantity-${line.slug}`}
                          type="number"
                          min={1}
                          max={line.maxQuantity}
                          value={line.quantity}
                          onChange={(event) =>
                            setQuantity(line.slug, Number(event.target.value))
                          }
                          className="h-11 w-12 border-0 bg-transparent text-center font-heading text-base font-semibold text-white [appearance:textfield] [&::-webkit-inner-spin-button]:appearance-none"
                        />
                        <button
                          type="button"
                          onClick={() => setQuantity(line.slug, line.quantity + 1)}
                          disabled={line.quantity >= line.maxQuantity}
                          aria-label={`Increase quantity of ${line.name}`}
                          className="flex h-11 w-11 items-center justify-center rounded-full text-lg text-muted transition-colors hover:text-white disabled:opacity-30"
                        >
                          +
                        </button>
                      </div>
                    </div>
                  ) : (
                    <p className="font-body text-xs uppercase tracking-[0.14em] text-faint">
                      1 allocation
                    </p>
                  )}

                  <div className="text-right">
                    <p className="font-heading text-lg font-bold text-white">
                      {formatPrice(Number(line.price) * line.quantity)}
                    </p>
                    <button
                      type="button"
                      onClick={() => removeItem(line.slug)}
                      className="mt-1 min-h-11 font-body text-xs uppercase tracking-[0.14em] text-faint transition-colors hover:text-ember"
                    >
                      Remove
                    </button>
                  </div>
                </div>
              </li>
            ))}
          </ul>

          {/* Summary. Sticky on desktop so the total stays in view while
              scrolling a long list; static on mobile where there is no room. */}
          <aside className="lg:sticky lg:top-32 lg:self-start">
            <div className="rounded-card border border-hairline bg-graphite/50 p-6 md:p-7">
              <h2 className="font-heading text-lg font-bold text-white">
                Summary
              </h2>

              <dl className="mt-6 space-y-3 border-b border-hairline pb-6 font-body text-sm">
                <div className="flex justify-between">
                  <dt className="text-muted">Subtotal</dt>
                  <dd className="text-white">{formatPrice(subtotal)}</dd>
                </div>
                <div className="flex justify-between">
                  <dt className="text-muted">Delivery</dt>
                  <dd className="text-muted">Calculated at handover</dd>
                </div>
              </dl>

              <div className="flex items-baseline justify-between pt-6">
                <span className="font-body text-xs uppercase tracking-[0.16em] text-faint">
                  Total
                </span>
                <span className="font-heading text-2xl font-bold text-white">
                  {formatPrice(subtotal)}
                </span>
              </div>

              <div className="mt-7">
                <Button to="/checkout" size="lg" fullWidth>
                  {isAuthenticated ? "Checkout" : "Sign in to checkout"}
                </Button>
              </div>

              <p className="mt-4 font-body text-xs leading-relaxed text-faint">
                No payment is taken. Confirming an allocation holds a build slot
                while it is pending. Cancel from your account until FoNix
                confirms it.
              </p>
            </div>
          </aside>
        </div>
      </div>
    </div>
  );
}
