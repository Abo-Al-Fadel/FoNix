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
import { depositFor, formatPrice } from "../lib/format.js";

const STEPS = [
  { id: 1, label: "Review" },
  { id: 2, label: "Handover" },
  { id: 3, label: "Reservation" },
];

const EMPTY_CARD = {
  number: "",
  expiry: "",
  cvc: "",
  name: "",
};

export default function Checkout() {
  const { lines, subtotal, isEmpty, clearCart } = useCart();
  const { user } = useAuth();

  const [step, setStep] = useState(1);
  const [placedOrder, setPlacedOrder] = useState(null);
  const [error, setError] = useState("");
  const [isPlacing, setIsPlacing] = useState(false);
  const [card, setCard] = useState(EMPTY_CARD);
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

  const reservation = depositFor(subtotal);

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

  function goTo(next) {
    setError("");
    setStep(next);
    window.scrollTo({ top: 0, behavior: "smooth" });
  }

  function handleHandoverContinue(event) {
    event.preventDefault();
    if (!delivery.full_name.trim()) {
      setError("Name is required for handover.");
      return;
    }
    if (delivery.method === "deliver") {
      const missing = ["line1", "city", "postcode"].filter(
        (field) => !delivery[field].trim(),
      );
      if (missing.length) {
        setError("Address, city and postcode are required for delivery.");
        return;
      }
    }
    goTo(3);
  }

  async function handlePlaceOrder(event) {
    event.preventDefault();
    const pan = card.number.replace(/\D/g, "");
    const expiryDigits = card.expiry.replace(/\D/g, "");
    const expMonth = Number(expiryDigits.slice(0, 2));
    const expYear = Number(`20${expiryDigits.slice(2, 4)}`);

    if (pan.length < 13 || expiryDigits.length < 4 || card.cvc.length < 3 || !card.name.trim()) {
      setError("Complete the card details to authorise the reservation.");
      return;
    }

    setIsPlacing(true);
    setError("");

    try {
      const order = await createOrder({
        items: lines,
        delivery,
        payment: {
          number: pan,
          exp_month: expMonth,
          exp_year: expYear,
          cvc: card.cvc,
          name: card.name.trim(),
        },
      });
      clearCart();
      setPlacedOrder(order);
    } catch (caught) {
      setError(
        extractErrorMessage(
          caught,
          "The reservation could not be authorised. Try the demonstration Visa 4242 4242 4242 4242.",
        ),
      );
    } finally {
      setIsPlacing(false);
    }
  }

  const deliver = delivery.method === "deliver";

  return (
    <div className="pb-28 md:pb-32">
      <PageHeader
        eyebrow="Checkout"
        title="Hold your allocation"
        lede="Configure, handover, then authorise a 10% demonstration reservation. No money is taken. You can cancel from your account until FoNix confirms the slot."
      />

      <div className="fx-container">
        <ol className="mb-10 flex list-none items-center gap-2 sm:gap-4">
          {STEPS.map((item, index) => {
            const done = step > item.id;
            const active = step === item.id;
            return (
              <li key={item.id} className="flex min-w-0 flex-1 items-center gap-2 sm:gap-4">
                <button
                  type="button"
                  onClick={() => item.id < step && goTo(item.id)}
                  disabled={item.id > step}
                  className={`flex min-w-0 items-center gap-2 font-body text-[10px] uppercase tracking-[0.16em] sm:text-xs ${
                    active ? "text-white" : done ? "text-ember" : "text-faint"
                  }`}
                >
                  <span
                    className={`flex h-7 w-7 shrink-0 items-center justify-center rounded-full border ${
                      active
                        ? "border-ember bg-ember/15 text-ember"
                        : done
                          ? "border-ember/40 text-ember"
                          : "border-hairline"
                    }`}
                  >
                    {done ? "✓" : item.id}
                  </span>
                  <span className="truncate">{item.label}</span>
                </button>
                {index < STEPS.length - 1 ? (
                  <span className="hidden h-px flex-1 bg-hairline sm:block" aria-hidden="true" />
                ) : null}
              </li>
            );
          })}
        </ol>

        <div className="grid gap-10 lg:grid-cols-[1.6fr_1fr] lg:gap-14">
          <div>
            {step === 1 ? (
              <section aria-labelledby="order-summary-heading">
                <h2
                  id="order-summary-heading"
                  className="font-heading text-lg font-bold text-white"
                >
                  Allocation summary
                </h2>
                <LineList lines={lines} />
                <div className="mt-8 flex flex-col gap-3 sm:flex-row">
                  <Button onClick={() => goTo(2)} size="lg">
                    Continue to handover
                  </Button>
                  <Button to="/cart" variant="ghost" size="lg">
                    Back to cart
                  </Button>
                </div>
              </section>
            ) : null}

            {step === 2 ? (
              <form onSubmit={handleHandoverContinue}>
                <HandoverFields
                  delivery={delivery}
                  deliver={deliver}
                  updateDelivery={updateDelivery}
                />
                <FormError>{error}</FormError>
                <div className="mt-8 flex flex-col gap-3 sm:flex-row">
                  <Button type="submit" size="lg">
                    Continue to reservation
                  </Button>
                  <Button onClick={() => goTo(1)} variant="ghost" size="lg">
                    Back
                  </Button>
                </div>
              </form>
            ) : null}

            {step === 3 ? (
              <form onSubmit={handlePlaceOrder} autoComplete="on">
                <CardPanel
                  card={card}
                  setCard={setCard}
                  isPlacing={isPlacing}
                  onClearError={() => error && setError("")}
                />
                <FormError>{error}</FormError>
                <div className="mt-8 hidden flex-col gap-3 sm:flex-row lg:flex">
                  <Button type="submit" disabled={isPlacing} size="lg">
                    {isPlacing
                      ? "Authorising…"
                      : `Pay ${formatPrice(reservation)} reservation`}
                  </Button>
                  <Button
                    onClick={() => goTo(2)}
                    variant="ghost"
                    size="lg"
                    disabled={isPlacing}
                  >
                    Back
                  </Button>
                </div>
              </form>
            ) : null}
          </div>

          <aside className="hidden lg:sticky lg:top-32 lg:block lg:self-start">
            <TotalsCard
              subtotal={subtotal}
              reservation={reservation}
              email={user?.email}
            />
          </aside>
        </div>
      </div>

      <div className="lg:hidden">
        <div className="h-24" aria-hidden="true" />
        <div className="fixed inset-x-0 bottom-0 z-40 border-t border-hairline bg-void/95 px-4 pt-3 backdrop-blur-xl"
          style={{ paddingBottom: "max(0.75rem, env(safe-area-inset-bottom))" }}
        >
          <div className="mx-auto flex max-w-5xl items-center justify-between gap-4">
            <div>
              <p className="font-body text-[10px] uppercase tracking-[0.16em] text-faint">
                {step === 3 ? "Reservation due" : "Configured"}
              </p>
              <p className="font-heading text-lg font-bold text-white">
                {formatPrice(step === 3 ? reservation : subtotal)}
              </p>
            </div>
            {step === 1 ? (
              <Button onClick={() => goTo(2)} size="sm">
                Continue
              </Button>
            ) : null}
            {step === 2 ? (
              <Button onClick={handleHandoverContinue} size="sm">
                Continue
              </Button>
            ) : null}
            {step === 3 ? (
              <Button
                onClick={handlePlaceOrder}
                disabled={isPlacing}
                size="sm"
              >
                {isPlacing ? "Authorising…" : "Pay reservation"}
              </Button>
            ) : null}
          </div>
        </div>
      </div>
    </div>
  );
}

function LineList({ lines }) {
  return (
    <ul className="mt-6 list-none divide-y divide-hairline rounded-card border border-hairline bg-graphite/50">
      {lines.map((line) => (
        <li key={line.slug} className="flex items-center gap-4 p-4 sm:gap-5 sm:p-5">
          <img
            src={line.thumbnail}
            alt={line.thumbnailAlt ?? line.name}
            width={1600}
            height={900}
            className="aspect-16/9 w-24 shrink-0 rounded-input object-cover sm:w-32"
          />
          <div className="min-w-0 flex-1">
            <p className="font-heading text-base font-bold text-white">{line.name}</p>
            <OptionSummary
              options={(line.optionLabels ?? []).map((name) => ({ name }))}
            />
            <p className="mt-1 font-body text-sm text-muted">{formatPrice(line.price)}</p>
          </div>
          <p className="font-heading text-base font-bold text-white">
            {formatPrice(Number(line.price) * line.quantity)}
          </p>
        </li>
      ))}
    </ul>
  );
}

function HandoverFields({ delivery, deliver, updateDelivery }) {
  return (
    <section
      aria-labelledby="handover-heading"
      className="rounded-card border border-hairline bg-graphite/50 p-5 sm:p-6"
    >
      <h2 id="handover-heading" className="font-heading text-lg font-bold text-white">
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
  );
}

function CardPanel({ card, setCard, isPlacing, onClearError }) {
  const pan = card.number.replace(/\D/g, "");
  const brand = pan.startsWith("4") ? "Visa" : pan.startsWith("5") ? "Mastercard" : "Card";

  function update(field, transform) {
    return (event) => {
      const value = transform ? transform(event.target.value) : event.target.value;
      setCard((current) => ({ ...current, [field]: value }));
      onClearError();
    };
  }

  return (
    <section
      aria-labelledby="pay-heading"
      className="overflow-hidden rounded-card border border-hairline bg-graphite/50"
    >
      <div className="border-b border-hairline bg-ember/10 px-5 py-3 sm:px-6">
        <p className="font-body text-xs leading-relaxed text-muted">
          Demonstration only. Use{" "}
          <span className="text-white">4242 4242 4242 4242</span> to authorise,
          or <span className="text-white">4000 0000 0000 0002</span> to see a
          decline. The number is never stored and no money is taken.
        </p>
      </div>

      <div className="p-5 sm:p-6">
        <div className="flex items-baseline justify-between gap-4">
          <h2 id="pay-heading" className="font-heading text-lg font-bold text-white">
            Reservation
          </h2>
          <span className="font-body text-[10px] uppercase tracking-[0.16em] text-faint">
            {brand}
          </span>
        </div>
        <p className="mt-2 font-body text-sm text-muted">
          10% of the configured total, authorised the way a real card form
          would be. The hangar invoices the balance after confirmation.
        </p>

        <fieldset disabled={isPlacing} className="mt-6 space-y-5">
          <Field
            label="Card number"
            inputMode="numeric"
            autoComplete="cc-number"
            value={card.number}
            onChange={update("number", formatPan)}
            placeholder="ACCT-000015"
            required
          />
          <div className="grid grid-cols-2 gap-5">
            <Field
              label="Expiry"
              inputMode="numeric"
              autoComplete="cc-exp"
              value={card.expiry}
              onChange={update("expiry", formatExpiry)}
              placeholder="MM / YY"
              required
            />
            <Field
              label="CVC"
              inputMode="numeric"
              autoComplete="cc-csc"
              value={card.cvc}
              onChange={update("cvc", (value) => value.replace(/\D/g, "").slice(0, 4))}
              placeholder="123"
              required
            />
          </div>
          <Field
            label="Name on card"
            autoComplete="cc-name"
            value={card.name}
            onChange={update("name")}
            required
          />
        </fieldset>
      </div>
    </section>
  );
}

function TotalsCard({ subtotal, reservation, email }) {
  return (
    <div className="rounded-card border border-hairline bg-graphite/50 p-6 md:p-7">
      <dl className="space-y-3 font-body text-sm">
        <div className="flex items-baseline justify-between gap-4">
          <dt className="text-muted">Configured total</dt>
          <dd className="text-white">{formatPrice(subtotal)}</dd>
        </div>
        <div className="flex items-baseline justify-between gap-4">
          <dt className="text-muted">Reservation due now</dt>
          <dd className="font-heading text-xl font-bold text-white">
            {formatPrice(reservation)}
          </dd>
        </div>
        <div className="flex items-baseline justify-between gap-4">
          <dt className="text-faint">Balance after confirmation</dt>
          <dd className="text-faint">{formatPrice(subtotal - reservation)}</dd>
        </div>
      </dl>
      <p className="mt-4 font-body text-xs text-faint">Signed in as {email}</p>
    </div>
  );
}

function OrderConfirmation({ order }) {
  const last4 = order.payment_last4;
  const deposit = order.deposit_amount;

  return (
    <div className="pb-24 md:pb-32">
      <PageHeader
        eyebrow="Allocation held"
        title="The slot is yours."
        lede={`Allocation #${order.id} is pending. The demonstration reservation is authorised. Cancel from your account until FoNix confirms it.`}
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
            {deposit ? (
              <div>
                <dt className="text-xs uppercase tracking-[0.16em] text-faint">
                  Reservation
                </dt>
                <dd className="mt-2 font-heading text-lg font-bold text-white">
                  {formatPrice(deposit)}
                </dd>
              </div>
            ) : null}
            {last4 ? (
              <div>
                <dt className="text-xs uppercase tracking-[0.16em] text-faint">
                  Card
                </dt>
                <dd className="mt-2 font-heading text-lg font-bold text-white">
                  {(order.payment_brand || "Card").replace(/^./, (c) => c.toUpperCase())} ····{last4}
                </dd>
              </div>
            ) : null}
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
          has been purchased and no money has been taken.{" "}
          <Link to="/about" className="text-muted underline-offset-4 hover:underline">
            More about the project
          </Link>
          .
        </p>
      </div>
    </div>
  );
}

function formatPan(value) {
  return value
    .replace(/\D/g, "")
    .slice(0, 16)
    .replace(/(\d{4})(?=\d)/g, "$1 ");
}

function formatExpiry(value) {
  const digits = value.replace(/\D/g, "").slice(0, 4);
  if (digits.length <= 2) return digits;
  return `${digits.slice(0, 2)} / ${digits.slice(2)}`;
}
