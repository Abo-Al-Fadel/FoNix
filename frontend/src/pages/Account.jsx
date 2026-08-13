import { useCallback } from "react";

import { fetchOrders } from "../api/endpoints.js";
import Button from "../components/ui/Button.jsx";
import PageHeader from "../components/ui/PageHeader.jsx";
import {
  EmptyState,
  ErrorState,
  LoadingState,
} from "../components/ui/StateBlock.jsx";
import StatusPill from "../components/ui/StatusPill.jsx";
import { useAuth } from "../context/AuthContext.jsx";
import useApiResource from "../hooks/useApiResource.js";
import { formatDate, formatPrice } from "../lib/format.js";

export default function Account() {
  const { user, isAdmin } = useAuth();

  const fetcher = useCallback(() => fetchOrders(), []);
  const { data: orders, error, isLoading, retry } = useApiResource(fetcher);

  return (
    <div className="pb-24 md:pb-32">
      <PageHeader
        eyebrow="Your account"
        title={user?.first_name ? `Hello, ${user.first_name}.` : "Your orders"}
        lede={
          isAdmin
            ? "You are signed in as a FoNix staff account, so this list shows every order placed on the site."
            : "Every order you have placed, newest first."
        }
      />

      <div className="fx-container">
        {isLoading ? <LoadingState label="Loading your orders" /> : null}
        {error ? <ErrorState message={error} onRetry={retry} /> : null}

        {orders && orders.length === 0 ? (
          <EmptyState title="No orders yet">
            <p className="mb-8">
              When you place an order it will appear here with its full line
              items and total.
            </p>
            <Button to="/store">Browse the range</Button>
          </EmptyState>
        ) : null}

        {orders && orders.length > 0 ? (
          <ul className="list-none space-y-5">
            {orders.map((order) => (
              <li
                key={order.id}
                className="rounded-card border border-hairline bg-graphite/50 p-6 md:p-7"
              >
                <div className="flex flex-wrap items-baseline justify-between gap-4 border-b border-hairline pb-5">
                  <div>
                    <h2 className="font-heading text-lg font-bold text-white">
                      Order #{order.id}
                    </h2>
                    <p className="mt-1 font-body text-sm text-muted">
                      {formatDate(order.created_at)} · {order.item_count}{" "}
                      {order.item_count === 1 ? "car" : "cars"}
                    </p>
                  </div>

                  <div className="flex items-center gap-4">
                    <StatusPill status={order.status}>
                      {order.status_display}
                    </StatusPill>
                    <span className="font-heading text-xl font-bold text-white">
                      {formatPrice(order.total)}
                    </span>
                  </div>
                </div>

                <ul className="list-none divide-y divide-hairline">
                  {order.items.map((item) => (
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
                        <p className="mt-0.5 font-body text-sm text-muted">
                          Quantity {item.quantity} ×{" "}
                          {formatPrice(item.price_at_purchase)}
                        </p>
                      </div>
                      <p className="font-body text-sm text-white">
                        {formatPrice(item.subtotal)}
                      </p>
                    </li>
                  ))}
                </ul>

                <p className="pt-2 font-body text-xs text-faint">
                  Line prices are the prices at the time of ordering, not
                  today’s catalog price.
                </p>
              </li>
            ))}
          </ul>
        ) : null}
      </div>
    </div>
  );
}

