import { useState } from "react";
import { Link } from "react-router-dom";

import { extractErrorMessage } from "../api/client.js";
import { createOrder } from "../api/endpoints.js";
import {
  DeliveryBlock,
  OptionSummary,
} from "../components/orders/OrderDetails.jsx";
import Button from "../components/ui/Button.jsx";
import Field from "../components/ui/Field.jsx";
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
  const [delivery, setDelivery] = useState({
    method: "collect",
    full_name:
      [user?.first_name, user?.last_name].filter(Boolean).join(" ") ||
      user?.username ||
      "",
    phone: "",
    line1: "",
    city: "",
    postcode: "",
    country: "United Kingdom",
  });

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

  function updateDelivery(field) {
    return (event) => {
      setDelivery((current) => ({ ...current, [field]: event.target.value }));
      if (error) setError("");
    };
  }

  async function handlePlaceOrder(event) {
    event.preventDefault();
    setIsPlacing(true);
    setError("");

    try {
      const order = await createOrder({ items: lines, delivery });
      clearCart();
      setPlacedOrder(order);
    } catch (caught) {
      setError(extractErrorMessage(caught, "We could not place that order."));
    } finally {
      setIsPlacing(false);
    }
  }

  const deliver = delivery.method === "deliver";

  return (
    <div className="pb-24 md:pb-32">
      <PageHeader
        eyebrow="Checkout"
        title="Hold your allocation"
        lede="No payment is taken. Placing this records a pending build slot against your account. You can cancel it from your orders until FoNix confirms it."
      />

      <form onSubmit={handlePlaceOrder}>
        <div className="fx-container">
          <div className="grid gap-10 lg:grid-cols-[1.6fr_1fr] lg:gap-14">
            <div className="space-y-8">
              <section aria-labelledby="order-summary-heading">
                <h2
                  id="order-summary-heading"
                  className="font-heading text-lg font-bold text-white"
                >
                  Allocation summary
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
                        <OptionSummary
                          options={(line.optionLabels ?? []).map((name) => ({
                            name,
                          }))}
                        />
                        <p className="mt-1 font-body text-sm text-muted">
                          {formatPrice(line.price)}
                        </p>
                      </div>
                      <p className="font-heading text-base font-bold text-white">
                        {formatPrice(Number(line.price) * line.quantity)}
                      </p>
                    </li>
                  ))}
                </ul>
              </section>

              <section
                aria-labelledby="handover-heading"
                className="rounded-card border border-hairline bg-graphite/50 p-6"
              >
                <h2
                  id="handover-heading"
                  className="font-heading text-lg font-bold text-white"
                >
                  Handover
                </h2>
                <p className="mt-2 font-body text-sm text-muted">
                  Collect at the Filton hangar, or have it delivered. This is a
                  demonstration: no vehicle moves.
                </p>

                <fieldset className="mt-5">
                  <legend className="sr-only">Handover method</legend>
                  <div className="grid gap-2 sm:grid-cols-2">
                    {[
                      { id: "collect", label: "Hangar collection" },
                      { id: "deliver", label: "Delivered" },
                    ].map((method) => (
                      <label
                        key={method.id}
                        className={`flex min-h-11 cursor-pointer items-center gap-3 rounded-input border px-4 font-body text-sm ${
                          delivery.method === method.id
                            ? "border-ember/50 bg-ember/10 text-white"
                            : "border-hairline text-muted"
                        }`}
                      >
                        <input
                          type="radio"
                          name="handover"
                          value={method.id}
                          checked={delivery.method === method.id}
                          onChange={updateDelivery("method")}
                          className="accent-ember"
                        />
                        {method.label}
                      </label>
                    ))}
                  </div>
                </fieldset>

                <div className="mt-5 grid gap-5 sm:grid-cols-2">
                  <Field
                    label="Full name"
                    value={delivery.full_name}
                    onChange={updateDelivery("full_name")}
                    autoComplete="name"
                    required
                  />
                  <Field
                    label="Phone"
                    type="tel"
                    value={delivery.phone}
                    onChange={updateDelivery("phone")}
                    autoComplete="tel"
                  />
                </div>

                {deliver ? (
                  <div className="mt-5 grid gap-5 sm:grid-cols-2">
                    <Field
                      className="sm:col-span-2"
                      label="Address"
                      value={delivery.line1}
                      onChange={updateDelivery("line1")}
                      autoComplete="address-line1"
                      required
                    />
                    <Field
                      label="City"
                      value={delivery.city}
                      onChange={updateDelivery("city")}
                      autoComplete="address-level2"
                      required
                    />
                    <Field
                      label="Postcode"
                      value={delivery.postcode}
                      onChange={updateDelivery("postcode")}
                      autoComplete="postal-code"
                      required
                    />
                    <Field
                      className="sm:col-span-2"
                      label="Country"
                      value={delivery.country}
                      onChange={updateDelivery("country")}
                      autoComplete="country-name"
                    />
                  </div>
                ) : (
                  <p className="mt-5 font-body text-sm text-muted">
                    Building 4, Filton Airfield, Bristol BS34, United Kingdom.
                  </p>
                )}
              </section>
            </div>

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

                <p className="mt-3 font-body text-xs text-faint">
                  Signed in as {user?.email}
                </p>

                <div className="mt-6 space-y-4">
                  <FormError>{error}</FormError>

                  <Button
                    type="submit"
                    disabled={isPlacing}
                    size="lg"
                    fullWidth
                  >
                    {isPlacing ? "Holding slot…" : "Confirm allocation"}
                  </Button>

                  <Button to="/cart" variant="bare" size="sm" fullWidth>
                    Back to cart
                  </Button>
                </div>
              </div>
            </aside>
          </div>
        </div>
      </form>
    </div>
  );
}

function OrderConfirmation({ order }) {
  return (
    <div className="pb-24 md:pb-32">
      <PageHeader
        eyebrow="Allocation held"
        title="The slot is yours."
        lede={`Allocation #${order.id} is pending. Cancel it from your account until FoNix confirms it.`}
      />

      <div className="fx-container">
        <div className="max-w-2xl rounded-card border border-hairline bg-graphite/50 p-6 md:p-8">
          <dl className="grid grid-cols-2 gap-6 border-b border-hairline pb-6 font-body text-sm">
            <div>
              <dt className="text-xs uppercase tracking-[0.16em] text-faint">
                Allocation
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
                  <OptionSummary options={item.options} />
                  <p className="mt-1 font-body text-sm text-muted">
                    {formatPrice(item.price_at_purchase)}
                  </p>
                </div>
                <p className="font-heading text-base font-bold text-white">
                  {formatPrice(item.subtotal)}
                </p>
              </li>
            ))}
          </ul>

          <DeliveryBlock delivery={order.delivery} />

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
