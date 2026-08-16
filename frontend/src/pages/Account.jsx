import { useCallback, useState } from "react";

import { extractErrorMessage } from "../api/client.js";
import { cancelOrder, fetchOrders } from "../api/endpoints.js";
import {
  DeliveryBlock,
  OrderLineItems,
  OrderTimeline,
  PaymentBlock,
} from "../components/orders/OrderDetails.jsx";
import Button from "../components/ui/Button.jsx";
import FormError from "../components/ui/FormError.jsx";
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
  const { user } = useAuth();

  const fetcher = useCallback(() => fetchOrders({ mine: true }), []);
  const { data: orders, setData, error, isLoading, retry } =
    useApiResource(fetcher);

  const [busyId, setBusyId] = useState(null);
  const [actionError, setActionError] = useState("");

  async function handleCancel(order) {
    if (
      !window.confirm(
        `Cancel allocation #${order.id}? The build slot will be returned to the range.`,
      )
    ) {
      return;
    }
    setBusyId(order.id);
    setActionError("");
    try {
      const updated = await cancelOrder(order.id);
      setData((list) => list.map((row) => (row.id === updated.id ? updated : row)));
    } catch (caught) {
      setActionError(extractErrorMessage(caught, "That allocation could not be cancelled."));
    } finally {
      setBusyId(null);
    }
  }

  return (
    <div className="pb-24 md:pb-32">
      <PageHeader
        eyebrow="Your account"
        title={user?.first_name ? `Hello, ${user.first_name}.` : "Your orders"}
        lede="Allocations you have placed, newest first. A pending slot can be cancelled here; after FoNix confirms it, only the hangar can unwind it. The 10% reservation is a demonstration — no money was taken."
      />

      <div className="fx-container">
        {actionError ? <FormError>{actionError}</FormError> : null}
        {isLoading && !orders ? <LoadingState label="Loading your orders" /> : null}
        {error ? <ErrorState message={error} onRetry={retry} /> : null}

        {orders && orders.length === 0 ? (
          <EmptyState title="No allocations yet">
            <p className="mb-8">
              When you hold a build slot it will appear here with its
              configuration, handover and status.
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
                <div className="flex flex-col gap-3 border-b border-hairline pb-5 sm:flex-row sm:flex-wrap sm:items-baseline sm:justify-between sm:gap-4">
                  <div>
                    <h2 className="font-heading text-lg font-bold text-white">
                      Allocation #{order.id}
                    </h2>
                    <p className="mt-1 font-body text-sm text-muted">
                      {formatDate(order.created_at)} · {order.item_count}{" "}
                      {order.item_count === 1 ? "car" : "cars"}
                    </p>
                  </div>

                  <div className="flex items-center justify-between gap-4 sm:justify-end">
                    <StatusPill status={order.status}>
                      {order.status_display}
                    </StatusPill>
                    <span className="font-heading text-xl font-bold text-white">
                      {formatPrice(order.total)}
                    </span>
                  </div>
                </div>

                <OrderLineItems items={order.items} />
                <PaymentBlock order={order} />
                <DeliveryBlock delivery={order.delivery} />
                <OrderTimeline events={order.events} />

                {order.can_cancel ? (
                  <div className="mt-5 border-t border-hairline pt-5">
                    <button
                      type="button"
                      onClick={() => handleCancel(order)}
                      disabled={busyId === order.id}
                      className="min-h-11 font-body text-xs uppercase tracking-[0.14em] text-faint transition-colors hover:text-ember disabled:opacity-50"
                    >
                      {busyId === order.id ? "Cancelling…" : "Cancel this allocation"}
                    </button>
                    <p className="mt-2 font-body text-xs text-faint">
                      The slot returns to the range. After confirmation, write
                      to the hangar instead.
                    </p>
                  </div>
                ) : null}
              </li>
            ))}
          </ul>
        ) : null}
      </div>
    </div>
  );
}
