import { useState } from "react";
import { Link } from "react-router-dom";

import { extractErrorMessage } from "../api/client.js";
import { createOrder } from "../api/endpoints.js";
import Button from "../components/ui/Button.jsx";
import FormError from "../components/ui/FormError.jsx";
import PageHeader from "../components/ui/PageHeader.jsx";
import { EmptyState } from "../components/ui/StateBlock.jsx";
import { useAuth } from "../context/AuthContext.jsx";
import { useCart } from "../context/CartContext.jsx";
import { formatPrice } from "../lib/format.js";

export default function Checkout() {
  const { lines, subtotal, isEmpty, clearCart } = useCart();
  const { user } = useAuth();

  const [placedOrder, setPlacedOrder] = useState(null);
  const [error, setError] = useState("");
  const [isPlacing, setIsPlacing] = useState(false);

  // The confirmation is rendered from the *server's* response, not from the
  // local cart. That matters: the total shown here is the one Django computed
  // from its own prices, so what the customer sees is what was actually
  // recorded.
  if (placedOrder) {
    return <OrderConfirmation order={placedOrder} />;
  }

  if (isEmpty) {
    return (
      <div className="pb-24 md:pb-32">
        <PageHeader eyebrow="Checkout" title="There is nothing to order." />
        <EmptyState title="Your cart is empty">
          <p className="mb-8">Add a car to the cart before checking out.</p>
          <Button to="/store">Browse the range</Button>
        </EmptyState>
      </div>
    );
  }

  async function handlePlaceOrder() {
    setIsPlacing(true);
    setError("");

    try {
      const order = await createOrder(lines);
      // Only clear the cart once the server has confirmed the order exists.
      // Clearing optimistically would lose the customer's selection if the
      // request failed.
      clearCart();
      setPlacedOrder(order);
    } catch (caught) {
      setError(extractErrorMessage(caught, "We could not place that order."));
    } finally {
      setIsPlacing(false);
    }
  }

  return (
    <div className="pb-24 md:pb-32">
      <PageHeader
        eyebrow="Checkout"
        title="Confirm your order"
        lede="No payment is taken and no card details are collected. Placing the order records it against your account."
      />

      <div className="fx-container">
        <div className="grid gap-10 lg:grid-cols-[1.6fr_1fr] lg:gap-14">
          <section aria-labelledby="order-summary-heading">
            <h2
              id="order-summary-heading"
              className="font-heading text-lg font-bold text-white"
            >
              Order summary
            </h2>

            <ul className="mt-6 list-none divide-y divide-hairline rounded-card border border-hairline bg-graphite/50">
              {lines.map((line) => (
                <li
                  key={line.slug}
                  className="flex items-center gap-4 p-4 sm:gap-5 sm:p-5"
                >
                  <img
                    src={line.thumbnail}
                    alt={line.thumbnailAlt ?? line.name}
                    width={1600}
                    height={900}
                    className="aspect-16/9 w-24 shrink-0 rounded-input object-cover sm:w-32"
                  />
                  <div className="min-w-0 flex-1">
                    <p className="font-heading text-base font-bold text-white">
                      {line.name}
                    </p>
                    <p className="mt-1 font-body text-sm text-muted">
                      Quantity {line.quantity} × {formatPrice(line.price)}
                    </p>
                  </div>
                  <p className="font-heading text-base font-bold text-white">
                    {formatPrice(Number(line.price) * line.quantity)}
                  </p>
                </li>
              ))}
            </ul>

            <div className="mt-8 rounded-card border border-hairline bg-graphite/50 p-6">
              <h3 className="font-body text-xs uppercase tracking-[0.16em] text-faint">
                Delivering to
              </h3>
              <p className="mt-3 font-body text-sm text-white">
                {user?.first_name || user?.username}
              </p>
              <p className="font-body text-sm text-muted">{user?.email}</p>
              <p className="mt-4 font-body text-xs leading-relaxed text-faint">
                A real store would collect a delivery address and payment here.
                Both are deliberately out of scope for this build. See the
                README.
              </p>
            </div>
          </section>

          <aside className="lg:sticky lg:top-32 lg:self-start">
            <div className="rounded-card border border-hairline bg-graphite/50 p-6 md:p-7">
              <div className="flex items-baseline justify-between">
                <span className="font-body text-xs uppercase tracking-[0.16em] text-faint">
                  Total
                </span>
                <span className="font-heading text-2xl font-bold text-white">
                  {formatPrice(subtotal)}
                </span>
              </div>

              <div className="mt-6 space-y-4">
                <FormError>{error}</FormError>

                <Button
                  onClick={handlePlaceOrder}
                  disabled={isPlacing}
                  size="lg"
                  fullWidth
                >
                  {isPlacing ? "Placing order…" : "Place order"}
                </Button>

                <Button to="/cart" variant="bare" size="sm" fullWidth>
                  Back to cart
                </Button>
              </div>
            </div>
          </aside>
        </div>
      </div>
    </div>
  );
}

function OrderConfirmation({ order }) {
  return (
    <div className="pb-24 md:pb-32">
      <PageHeader
        eyebrow="Order placed"
        title="Thank you."
        lede={`Order #${order.id} has been recorded against your account.`}
      />

      <div className="fx-container">
        <div className="max-w-2xl rounded-card border border-hairline bg-graphite/50 p-6 md:p-8">
          <dl className="grid grid-cols-2 gap-6 border-b border-hairline pb-6 font-body text-sm">
            <div>
              <dt className="text-xs uppercase tracking-[0.16em] text-faint">
                Order number
              </dt>
              <dd className="mt-2 font-heading text-lg font-bold text-white">
                #{order.id}
              </dd>
            </div>
            <div>
              <dt className="text-xs uppercase tracking-[0.16em] text-faint">
                Status
              </dt>
              <dd className="mt-2 font-heading text-lg font-bold text-white">
                {order.status_display}
              </dd>
            </div>
          </dl>

          <ul className="list-none divide-y divide-hairline">
            {order.items.map((item) => (
              <li key={item.id} className="flex justify-between gap-4 py-4">
                <div>
                  <p className="font-heading text-base font-bold text-white">
                    {item.car_name}
                  </p>
                  <p className="mt-1 font-body text-sm text-muted">
                    Quantity {item.quantity} ×{" "}
                    {formatPrice(item.price_at_purchase)}
                  </p>
                </div>
                <p className="font-heading text-base font-bold text-white">
                  {formatPrice(item.subtotal)}
                </p>
              </li>
            ))}
          </ul>

          <div className="flex items-baseline justify-between border-t border-hairline pt-6">
            <span className="font-body text-xs uppercase tracking-[0.16em] text-faint">
              Total
            </span>
            <span className="font-heading text-2xl font-bold text-white">
              {formatPrice(order.total)}
            </span>
          </div>

          <div className="mt-8 flex flex-col gap-3 sm:flex-row">
            <Button to="/account" size="lg">
              View your orders
            </Button>
            <Button to="/store" variant="ghost" size="lg">
              Back to the range
            </Button>
          </div>
        </div>

        <p className="mt-8 max-w-2xl font-body text-xs leading-relaxed text-faint">
          FoNix is a fictional marque built as a portfolio project. No vehicle
          has been purchased and no payment has been taken.{" "}
          <Link to="/about" className="text-muted underline-offset-4 hover:underline">
            More about the project
          </Link>
          .
        </p>
      </div>
    </div>
  );
}
