import { formatDateTime, formatPrice } from "../../lib/format.js";
import { statusLabel } from "../../lib/orderStatus.js";

export function OptionSummary({ options }) {
  if (!options?.length) return null;
  return (
    <p className="mt-0.5 font-body text-sm text-muted">
      {options.map((option) => option.name).join(" · ")}
    </p>
  );
}

export function DeliveryBlock({ delivery }) {
  if (!delivery) return null;
  const collect = delivery.method === "collect";
  return (
    <div className="mt-4 border-t border-hairline pt-4">
      <p className="font-body text-[10px] uppercase tracking-[0.16em] text-faint">
        {collect ? "Hangar collection" : "Delivery"}
      </p>
      <p className="mt-2 font-body text-sm text-white">{delivery.full_name}</p>
      {delivery.phone ? (
        <p className="font-body text-sm text-muted">{delivery.phone}</p>
      ) : null}
      {collect ? (
        <p className="mt-1 font-body text-sm text-muted">
          Building 4, Filton Airfield, Bristol BS34
        </p>
      ) : (
        <p className="mt-1 font-body text-sm text-muted">
          {[delivery.line1, delivery.city, delivery.postcode, delivery.country]
            .filter(Boolean)
            .join(", ")}
        </p>
      )}
    </div>
  );
}

export function OrderTimeline({ events }) {
  if (!events?.length) return null;
  return (
    <ol className="mt-4 space-y-2 border-t border-hairline pt-4">
      {events.map((event) => {
        const hangarNote =
          event.from_status && event.from_status === event.to_status;
        return (
          <li key={event.id} className="font-body text-xs text-muted">
            <span className="text-white">
              {hangarNote ? "Hangar note" : statusLabel(event.to_status)}
            </span>
            <span className="text-faint">
              {" "}
              · {formatDateTime(event.at)}
              {event.actor_name ? ` · ${event.actor_name}` : ""}
            </span>
            {event.note ? <span className="block text-faint">{event.note}</span> : null}
          </li>
        );
      })}
    </ol>
  );
}

export function PaymentBlock({ order }) {
  if (!order?.payment_last4 && !order?.deposit_amount) return null;
  const brand = (order.payment_brand || "card").replace(/^./, (c) => c.toUpperCase());
  return (
    <div className="mt-4 border-t border-hairline pt-4">
      <p className="font-body text-[10px] uppercase tracking-[0.16em] text-faint">
        Reservation
      </p>
      <p className="mt-2 font-body text-sm text-white">
        {order.deposit_amount ? formatPrice(order.deposit_amount) : "—"}
        {order.payment_last4 ? ` · ${brand} ····${order.payment_last4}` : ""}
      </p>
      {order.payment_status === "authorized" ? (
        <p className="mt-1 font-body text-xs text-faint">
          Demonstration authorisation. No money was taken.
        </p>
      ) : null}
    </div>
  );
}

export function OrderLineItems({ items }) {
  return (
    <ul className="list-none divide-y divide-hairline">
      {items.map((item) => (
        <li key={item.id} className="flex items-center gap-4 py-4">
          {item.car_thumbnail ? (
            <img
              src={item.car_thumbnail}
              alt=""
              loading="lazy"
              className="aspect-16/9 w-20 shrink-0 rounded-input object-cover sm:w-24"
            />
          ) : null}
          <div className="min-w-0 flex-1">
            <p className="font-heading text-base font-semibold text-white">
              {item.car_name}
            </p>
            <OptionSummary options={item.options} />
            <p className="mt-0.5 font-body text-sm text-muted">
              {item.quantity > 1 ? `Quantity ${item.quantity} × ` : ""}
              {formatPrice(item.price_at_purchase)}
            </p>
          </div>
          <p className="font-body text-sm text-white">{formatPrice(item.subtotal)}</p>
        </li>
      ))}
    </ul>
  );
}
